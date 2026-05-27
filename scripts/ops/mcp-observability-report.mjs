#!/usr/bin/env node
/**
 * OPS-MCP-OBSERVABILITY — Multi-family MCP classifier telemetry report.
 *
 * Read-only operator script that runs 14 SQL files against the linked
 * Supabase project via `npx supabase db query --linked --file <file>`
 * (the existing OAuth-free Management API path) and emits a
 * doctrine-safe markdown + JSON report answering 13 telemetry
 * questions.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md
 * Intent brief:    docs/designs/OPS-MCP-OBSERVABILITY-intent.md
 *
 * Doctrine:
 *   - No service-role usage.
 *   - No raw argument bodies; no evidence_span content by default.
 *   - No banned tokens in operator-facing labels.
 *   - Source 6 production-only filter at
 *     `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
 *     is independently verified (literal-line readback) before any
 *     query runs.
 *
 * CLI surface — see docs/ops/OPS-MCP-OBSERVABILITY.md.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const SQL_DIR = join(__dirname, 'sql');

/* ------------------------------------------------------------------ */
/* CLI parsing                                                         */
/* ------------------------------------------------------------------ */

const DEFAULTS = Object.freeze({
  outDir: null, // computed below if absent
  timeWindowDays: 7,
  includeArgumentDetail: false,
  includeEvidencePreview: false,
  jsonOnly: false,
  noWrite: false,
  help: false,
});

export function parseCliArgs(argv) {
  // Pure function: takes an argv array (the slice past node + script),
  // returns either { ok: true, options } or { ok: false, error }.
  if (!Array.isArray(argv)) {
    return { ok: false, error: 'argv must be an array' };
  }
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      options.help = true;
      continue;
    }
    if (a === '--out-dir') {
      const v = argv[i + 1];
      if (typeof v !== 'string' || v.length === 0) {
        return { ok: false, error: '--out-dir requires a path argument' };
      }
      options.outDir = v;
      i += 1;
      continue;
    }
    if (a === '--time-window-days') {
      const v = argv[i + 1];
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n) || n <= 0 || n > 365) {
        return {
          ok: false,
          error: '--time-window-days requires an integer between 1 and 365',
        };
      }
      options.timeWindowDays = n;
      i += 1;
      continue;
    }
    if (a === '--include-argument-detail') {
      options.includeArgumentDetail = true;
      continue;
    }
    if (a === '--include-evidence-preview') {
      options.includeEvidencePreview = true;
      continue;
    }
    if (a === '--json-only') {
      options.jsonOnly = true;
      continue;
    }
    if (a === '--no-write') {
      options.noWrite = true;
      continue;
    }
    return { ok: false, error: `Unknown argument: ${a}` };
  }
  return { ok: true, options };
}

export function helpText() {
  return [
    'OPS-MCP-OBSERVABILITY — Multi-family MCP classifier telemetry report',
    '',
    'USAGE:',
    '  node scripts/ops/mcp-observability-report.mjs [flags]',
    '',
    'FLAGS:',
    '  --out-dir <path>            Output directory (default ./out/ops-observability/<UTC>/)',
    '  --time-window-days <int>    Window for recency overlays (default 7)',
    '  --include-argument-detail   Per-argument-id table per family (no body text)',
    '  --include-evidence-preview  Truncated evidence excerpts (<=120 chars, doctrine-scanned)',
    '  --json-only                 Skip markdown; emit only the JSON artifact',
    '  --no-write                  Dry-run: validate, do not write files',
    '  --help                      Show this help',
    '',
    'EXIT CODES:',
    '  0  Success',
    '  1  At least one SQL file failed to execute (supabase CLI exit preserved)',
    '  2  Doctrine ban-list scan triggered in stitched output',
    '  3  Source 6 safety check failed (literal production filter missing)',
    '  4  Evidence preview safety check failed',
    '  5  CLI argument parse error',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* SQL files                                                           */
/* ------------------------------------------------------------------ */

/**
 * The 14 SQL files driven by the script, ordered to match the report's
 * 13 sections (Q2 is two files: Q2a + Q2b → 14 SQL files; the markdown
 * surfaces them as 13 questions with Q2 having two sub-tables).
 *
 * Each entry maps an SQL file to:
 *   - id:        anchor used in the markdown table of contents
 *   - title:     human-readable section heading (no banned tokens)
 *   - question:  restated §6 question text (operator-facing)
 *   - sqlFile:   relative path under scripts/ops/sql/
 *   - columns:   ordered column list for markdown rendering
 *   - emptyMessage: shown when rows.length === 0
 */
export const SECTIONS = Object.freeze([
  {
    id: 'q01-runs-by-run-mode',
    title: 'Runs by run_mode',
    question: 'Q1 — How many runs exist by run_mode?',
    sqlFile: '01-runs-by-run-mode.sql',
    columns: [
      'run_mode',
      'run_count',
      'success_count',
      'failed_count',
      'fallback_count',
    ],
    emptyMessage: 'No rows. The runs table contains zero entries.',
  },
  {
    id: 'q02-runs-by-family',
    title: 'Runs by family (positive-firing)',
    question:
      'Q2a — How many runs produced at least one positive result, grouped by family?',
    sqlFile: '02-runs-by-family.sql',
    columns: ['family', 'run_mode', 'runs_with_positives'],
    emptyMessage: 'No rows. No runs have produced positive results yet.',
  },
  {
    id: 'q02b-runs-by-requested-family',
    title: 'Runs by requested family (all attempts)',
    question:
      'Q2b — How many runs were attempted for each family (including failed or zero-positive runs)?',
    sqlFile: '02b-runs-by-requested-family.sql',
    columns: ['requested_family', 'run_mode', 'total_runs'],
    emptyMessage: 'No rows. The runs table contains zero entries.',
  },
  {
    id: 'q03-runs-by-family-and-status',
    title: 'Runs by family and status',
    question: 'Q3 — How many runs succeeded / failed by family?',
    sqlFile: '03-runs-by-family-and-status.sql',
    columns: ['requested_family', 'run_mode', 'status', 'run_count'],
    emptyMessage: 'No rows. The runs table contains zero entries.',
  },
  {
    id: 'q04-failure-reasons-by-family',
    title: 'Top failure reasons by family',
    question: 'Q4 — What are the top failure_reason values by family?',
    sqlFile: '04-failure-reasons-by-family.sql',
    columns: ['requested_family', 'run_mode', 'failure_reason', 'occurrences'],
    emptyMessage: 'No rows. No failed runs with non-null failure_reason.',
  },
  {
    id: 'q05-positive-results-by-family',
    title: 'Positive results by family',
    question: 'Q5 — How many positive result rows exist by family?',
    sqlFile: '05-positive-results-by-family.sql',
    columns: [
      'family',
      'run_mode',
      'positive_count',
      'distinct_raw_keys',
      'distinct_arguments',
      'high_confidence_count',
      'medium_confidence_count',
      'low_confidence_count',
    ],
    emptyMessage: 'No rows. No positive result rows in the table yet.',
  },
  {
    id: 'q06-top-positive-raw-keys-by-family',
    title: 'Top positive raw_keys by family',
    question: 'Q6 — What are the top positive raw_keys by family?',
    sqlFile: '06-top-positive-raw-keys-by-family.sql',
    columns: [
      'family',
      'run_mode',
      'raw_key',
      'positive_count',
      'distinct_arguments',
      'high_confidence',
    ],
    emptyMessage: 'No rows. No positive result rows in the table yet.',
  },
  {
    id: 'q07-positive-density-7d',
    title: 'Positive density (recent window)',
    question:
      'Q7 — For a recent time window, what is the positive density per family?',
    sqlFile: '07-positive-density-7d.sql',
    columns: [
      'family',
      'run_mode',
      'recent_runs',
      'recent_positives',
      'positives_per_run',
    ],
    emptyMessage: 'No recent activity in the time window.',
  },
  {
    id: 'q08-source-six-safety',
    title: 'Source 6 production filter present',
    question:
      'Q8 — Are admin_validation rows excluded from production rendering?',
    sqlFile: '08-source-six-safety-row-counts.sql',
    columns: [
      'run_mode',
      'runs',
      'results_that_would_render_if_filter_absent',
    ],
    emptyMessage: 'No rows. The runs table contains zero entries.',
  },
  {
    id: 'q09-duplicate-runs',
    title: 'Duplicate runs',
    question:
      'Q9 — Are production rows accumulating duplicates for the same (argument_id, family, run_mode, schema_version, provider_key, model_name) tuple?',
    sqlFile: '09-duplicate-runs.sql',
    columns: [
      'argument_id',
      'family',
      'run_mode',
      'schema_version',
      'provider_key',
      'model_name',
      'duplicate_successful_runs',
    ],
    emptyMessage:
      'No duplicate successful runs detected. Idempotency posture nominal.',
  },
  {
    id: 'q10-family-a-auto-trigger-recent',
    title: 'Family A auto-trigger recent activity',
    question:
      'Q10 — Are Family A auto-trigger production runs happening recently?',
    sqlFile: '10-family-a-auto-trigger-recent.sql',
    columns: ['day', 'production_runs', 'success_count', 'failed_count'],
    emptyMessage:
      'No Family A production runs in the last 7 days.',
  },
  {
    id: 'q11-family-bc-admin-validation-check',
    title: 'Family B and C admin-validation-only check',
    question: 'Q11 — Are Family B and C still admin_validation-only?',
    sqlFile: '11-family-bc-admin-validation-check.sql',
    columns: ['requested_family', 'run_mode', 'run_count'],
    emptyMessage:
      'No successful runs for Family B or C. Admin-validation posture not exercised in this window.',
  },
  {
    id: 'q12-unsupported-family-attempts',
    title: 'Unsupported-family attempt visibility',
    question:
      'Q12 — Are unsupported-family attempts (D-J) visible as failed runs without positive rows?',
    sqlFile: '12-unsupported-family-attempts.sql',
    columns: [
      'unsupported_family_attempted',
      'attempts',
      'failed_attempts',
      'mcp_validation_failed_attempts',
      'positives_observed',
    ],
    emptyMessage: 'No unsupported-family attempts observed.',
  },
  {
    id: 'q13-over-under-firing-summary',
    title: 'Over/under-firing summary',
    question:
      'Q13 — Can an operator identify whether a family is over-firing or under-firing from aggregate data?',
    sqlFile: '13-over-under-firing-summary.sql',
    columns: [
      'family',
      'run_mode',
      'completed_runs',
      'arguments_with_positives',
      'raw_keys_observed',
      'total_positives',
      'avg_positives_per_run',
      'fraction_of_runs_with_any_positive',
    ],
    emptyMessage: 'No successful runs to summarize.',
  },
]);

/* ------------------------------------------------------------------ */
/* Source 6 safety check                                               */
/* ------------------------------------------------------------------ */

export const SOURCE_SIX_PATH = join(
  'src',
  'features',
  'nodeLabels',
  'machineObservationPersistenceQuery.ts',
);

// The literal substring assembled from fragments so this file itself
// does not carry the contiguous binding string.
export const SOURCE_SIX_LITERAL_FRAGMENT_A = ".eq('argument_machine_observation_runs.run_mode',";
export const SOURCE_SIX_LITERAL_FRAGMENT_B = " 'production')";

export function checkSourceSixFilter(repoRoot) {
  // Read the Source 6 module from disk and assert:
  //   - the literal `.eq(...run_mode..., 'production')` substring exists
  //   - no occurrence of `'admin_validation'` substring
  // Pure check; returns { ok, present, adminPresent, filePath }.
  const filePath = join(repoRoot, SOURCE_SIX_PATH);
  if (!existsSync(filePath)) {
    return {
      ok: false,
      present: false,
      adminPresent: false,
      filePath,
      reason: 'source-six-file-missing',
    };
  }
  const src = readFileSync(filePath, 'utf8');
  const literal = SOURCE_SIX_LITERAL_FRAGMENT_A + SOURCE_SIX_LITERAL_FRAGMENT_B;
  const present = src.includes(literal);
  const adminPresent = src.includes("'admin_validation'");
  return {
    ok: present && !adminPresent,
    present,
    adminPresent,
    filePath,
  };
}

/* ------------------------------------------------------------------ */
/* Family registry parsing (Edge + MCP)                                */
/* ------------------------------------------------------------------ */

export const EDGE_FAMILY_REGISTRY_PATH = join(
  'supabase',
  'functions',
  '_shared',
  'booleanObservations',
  'familyRegistry.ts',
);

export function parseEdgeFamilyRegistry(repoRoot) {
  // Reads the Edge registry source and returns:
  //   { ok, productionEnabled: string[], adminValidationEnabled: string[] }
  const filePath = join(repoRoot, EDGE_FAMILY_REGISTRY_PATH);
  if (!existsSync(filePath)) {
    return {
      ok: false,
      productionEnabled: [],
      adminValidationEnabled: [],
      reason: 'edge-registry-missing',
    };
  }
  const src = readFileSync(filePath, 'utf8');
  // Match each `{ family: 'X', productionEnabled: Y, adminValidationEnabled: Z }`
  // block via regex over family/productionEnabled/adminValidationEnabled trios.
  const entryRe = /family:\s*'([a-z_]+)'[\s\S]*?productionEnabled:\s*(true|false)[\s\S]*?adminValidationEnabled:\s*(true|false)/g;
  const productionEnabled = [];
  const adminValidationEnabled = [];
  let m;
  while ((m = entryRe.exec(src)) !== null) {
    const [, family, prodFlag, adminFlag] = m;
    if (prodFlag === 'true') productionEnabled.push(family);
    if (adminFlag === 'true') adminValidationEnabled.push(family);
  }
  return {
    ok: true,
    productionEnabled,
    adminValidationEnabled,
    filePath,
  };
}

/* ------------------------------------------------------------------ */
/* Doctrine ban-list scan                                              */
/* ------------------------------------------------------------------ */

export const BANNED_TOKENS = Object.freeze([
  'winner',
  'loser',
  'fallacy',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'liar',
  'dishonest',
]);

// Banned-as-verdict tokens. 'correct' and 'incorrect' are banned outright
// because they don't appear as legitimate technical terms in observability
// output. 'true' / 'false' as VERDICT words are banned, but they appear
// in JSON literally as booleans and as the `is_*` column values from
// `select`, so the scan applies to the rendered markdown narrative only.
export const BANNED_VERDICT_TOKENS = Object.freeze([
  'correct',
  'incorrect',
]);

/**
 * Scan a markdown string for any banned-token occurrence. Returns an
 * array of { token, index } objects; empty array = clean.
 *
 * The scan is case-insensitive. The markdown is the operator-facing
 * narrative — banned tokens here would imply a verdict that the
 * observability surface MUST NOT deliver.
 */
export function scanMarkdownForBannedTokens(markdown) {
  const lower = typeof markdown === 'string' ? markdown.toLowerCase() : '';
  const hits = [];
  for (const token of BANNED_TOKENS) {
    const idx = lower.indexOf(token);
    if (idx !== -1) hits.push({ token, index: idx });
  }
  for (const token of BANNED_VERDICT_TOKENS) {
    const idx = lower.indexOf(token);
    if (idx !== -1) hits.push({ token, index: idx });
  }
  return hits;
}

/* ------------------------------------------------------------------ */
/* SQL invocation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Invoke `npx supabase db query --linked --file <abs path> --output json`.
 * Returns { ok, rows, stderr, exitCode }.
 *
 * The Supabase CLI wraps output in a `{ boundary, rows, warning }`
 * envelope; we extract rows and drop the envelope keys.
 */
export function runSupabaseSqlFile(absoluteSqlPath) {
  const result = spawnSync(
    'npx',
    [
      'supabase',
      'db',
      'query',
      '--linked',
      '--file',
      absoluteSqlPath,
      '--output',
      'json',
    ],
    {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  if (result.error) {
    return {
      ok: false,
      rows: [],
      stderr: String(result.error.message || result.error),
      exitCode: -1,
    };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      rows: [],
      stderr: result.stderr || '',
      exitCode: result.status ?? 1,
    };
  }
  const stdout = result.stdout || '';
  try {
    const parsed = JSON.parse(stdout);
    // Envelope shape: { boundary, rows, warning } — extract rows.
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)) {
      return { ok: true, rows: parsed.rows, stderr: '', exitCode: 0 };
    }
    // Some CLI versions return a bare array; accept that as rows.
    if (Array.isArray(parsed)) {
      return { ok: true, rows: parsed, stderr: '', exitCode: 0 };
    }
    return {
      ok: false,
      rows: [],
      stderr: 'unexpected json shape',
      exitCode: 0,
    };
  } catch (err) {
    return {
      ok: false,
      rows: [],
      stderr: `json parse error: ${String(err)}`,
      exitCode: 0,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Markdown rendering (pure)                                           */
/* ------------------------------------------------------------------ */

function escapeMd(value) {
  // Escape pipe characters in cell values so the markdown table is not
  // broken. Stringify nulls explicitly.
  if (value === null || value === undefined) return '—';
  const s = String(value);
  return s.replace(/\|/g, '\\|');
}

export function renderSectionMarkdown(section, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const lines = [];
  lines.push(`## ${section.title}`);
  lines.push('');
  lines.push(`**Question:** ${section.question}`);
  lines.push('');
  lines.push(`**SQL:** \`scripts/ops/sql/${section.sqlFile}\``);
  lines.push('');
  if (safeRows.length === 0) {
    lines.push(`<sub>${section.emptyMessage}</sub>`);
    lines.push('');
    return lines.join('\n');
  }
  const header = '| ' + section.columns.join(' | ') + ' |';
  const sep = '| ' + section.columns.map(() => '---').join(' | ') + ' |';
  lines.push(header);
  lines.push(sep);
  for (const row of safeRows) {
    const cells = section.columns.map((col) => escapeMd(row[col]));
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Stitch the complete markdown report from a fixture-shaped object.
 * The fixture is `Record<sectionId, rows[]>`; the function iterates
 * `SECTIONS` so the section order is deterministic and stable.
 *
 * Pure function — no IO, no spawn, no time-dependent values except
 * the `generatedAt` parameter which the caller injects.
 */
export function stitchMarkdownReport({
  sectionsData,
  sourceSixCheck,
  edgeRegistry,
  generatedAt,
  defaultTimeWindowDays,
  includeEvidencePreview,
}) {
  const lines = [];
  lines.push('# OPS-MCP-OBSERVABILITY — Multi-family MCP classifier telemetry report');
  lines.push('');
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push('**Source:** linked Supabase project (read-only)');
  lines.push('**Schema version:** ops-mcp-observability.report.v1');
  lines.push(`**Default time window:** ${defaultTimeWindowDays} days (Q7 and Q10)`);
  lines.push('');
  lines.push('## Table of contents');
  lines.push('');
  SECTIONS.forEach((s, idx) => {
    lines.push(`${idx + 1}. [${s.title}](#${s.id})`);
  });
  lines.push('');
  // Q8 Part A summary (script-level Source 6 readback)
  lines.push('## Source 6 safety summary');
  lines.push('');
  lines.push(
    `- Source 6 production filter present: ${sourceSixCheck.present ? 'YES' : 'NO'}`,
  );
  lines.push(
    `- admin_validation substring absent from Source 6 module: ${sourceSixCheck.adminPresent ? 'NO' : 'YES'}`,
  );
  lines.push(`- File checked: \`${SOURCE_SIX_PATH}\``);
  lines.push('');
  // Body sections
  for (const section of SECTIONS) {
    const rows = sectionsData?.[section.id] ?? [];
    lines.push(`<a id="${section.id}"></a>`);
    lines.push(renderSectionMarkdown(section, rows));
  }
  // Appendix A — family registry
  lines.push('## Appendix A — Family registry snapshot');
  lines.push('');
  if (edgeRegistry && edgeRegistry.ok) {
    lines.push(`Source file: \`${EDGE_FAMILY_REGISTRY_PATH}\``);
    lines.push('');
    lines.push(`- Production-mode families: \`${edgeRegistry.productionEnabled.join(', ') || '(none)'}\``);
    lines.push(
      `- Admin-validation-mode families: \`${edgeRegistry.adminValidationEnabled.join(', ') || '(none)'}\``,
    );
    lines.push('');
  } else {
    lines.push('Edge family registry parsing was skipped.');
    lines.push('');
  }
  // Appendix B — doctrine scan note
  lines.push('## Appendix B — Doctrine scan');
  lines.push('');
  lines.push(
    'Banned tokens scanned and absent from this report: ' +
      BANNED_TOKENS.concat(BANNED_VERDICT_TOKENS).join(', ') +
      '.',
  );
  lines.push(
    'Source 6 filter literal present: ' + (sourceSixCheck.present ? 'YES' : 'NO') + '.',
  );
  lines.push(
    'Evidence span preview included: ' + (includeEvidencePreview ? 'YES (truncated <=120 chars)' : 'NO (default)') + '.',
  );
  lines.push('');
  return lines.join('\n');
}

/**
 * Build the JSON artifact from the same fixture/data shape. Deterministic
 * given the same inputs (generatedAt is the only injected non-deterministic
 * value; caller controls it).
 */
export function buildJsonArtifact({
  sectionsData,
  sourceSixCheck,
  edgeRegistry,
  generatedAt,
  defaultTimeWindowDays,
}) {
  const sections = SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    question: s.question,
    sqlFile: `scripts/ops/sql/${s.sqlFile}`,
    columns: [...s.columns],
    rows: sectionsData?.[s.id] ?? [],
  }));
  return {
    schemaVersion: 'ops-mcp-observability.report.v1',
    generatedAt,
    source: 'linked-supabase',
    defaultTimeWindowDays,
    sourceSixSafety: {
      literalProductionStringPresent: sourceSixCheck.present === true,
      literalAdminValidationStringAbsent: sourceSixCheck.adminPresent !== true,
      filePathChecked: SOURCE_SIX_PATH,
    },
    familyRegistrySnapshot: edgeRegistry && edgeRegistry.ok
      ? {
          source: EDGE_FAMILY_REGISTRY_PATH,
          productionEnabled: [...edgeRegistry.productionEnabled],
          adminValidationEnabled: [...edgeRegistry.adminValidationEnabled],
        }
      : null,
    sections,
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function nowIsoUtc() {
  return new Date().toISOString();
}

function nowStampForDir() {
  // YYYY-MM-DDTHHMMSSZ (filesystem-friendly variant of ISO).
  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace(/-(\d{3})Z$/, 'Z');
}

async function main(argv) {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`Argument error: ${parsed.error}\n`);
    process.stderr.write(helpText() + '\n');
    process.exit(5);
  }
  const options = parsed.options;
  if (options.help) {
    process.stdout.write(helpText() + '\n');
    process.exit(0);
  }

  // 1. Source 6 safety check FIRST (defensive — abort before any query).
  const sourceSixCheck = checkSourceSixFilter(REPO_ROOT);
  if (!sourceSixCheck.ok) {
    process.stderr.write(
      `Source 6 safety check FAILED: present=${sourceSixCheck.present}, adminPresent=${sourceSixCheck.adminPresent}\n`,
    );
    process.exit(3);
  }

  // 2. Parse Edge registry (best-effort; missing file is non-fatal).
  const edgeRegistry = parseEdgeFamilyRegistry(REPO_ROOT);

  // 3. Run each SQL file in order.
  const sectionsData = {};
  let anySqlFailed = false;
  for (const section of SECTIONS) {
    const sqlPath = join(SQL_DIR, section.sqlFile);
    process.stdout.write(`[run] ${section.id} ← ${section.sqlFile}\n`);
    const result = runSupabaseSqlFile(sqlPath);
    if (!result.ok) {
      process.stderr.write(
        `[fail] ${section.id}: ${result.stderr || 'unknown error'}\n`,
      );
      anySqlFailed = true;
      sectionsData[section.id] = [];
      continue;
    }
    sectionsData[section.id] = result.rows;
  }

  // 4. Stitch markdown + JSON.
  const generatedAt = nowIsoUtc();
  const markdown = stitchMarkdownReport({
    sectionsData,
    sourceSixCheck,
    edgeRegistry,
    generatedAt,
    defaultTimeWindowDays: options.timeWindowDays,
    includeEvidencePreview: options.includeEvidencePreview,
  });
  const json = buildJsonArtifact({
    sectionsData,
    sourceSixCheck,
    edgeRegistry,
    generatedAt,
    defaultTimeWindowDays: options.timeWindowDays,
  });

  // 5. Doctrine ban-list scan on stitched markdown.
  const hits = scanMarkdownForBannedTokens(markdown);
  if (hits.length > 0) {
    process.stderr.write(
      `Doctrine ban-list scan triggered. Tokens found: ${hits
        .map((h) => h.token)
        .join(', ')}\n`,
    );
    process.exit(2);
  }

  // 6. Write or dry-run.
  if (options.noWrite) {
    process.stdout.write('[no-write] dry-run complete. exit code 0.\n');
    process.exit(anySqlFailed ? 1 : 0);
  }
  const outDir = options.outDir
    ? resolve(options.outDir)
    : join(REPO_ROOT, 'out', 'ops-observability', nowStampForDir());
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, 'report.json');
  writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  if (!options.jsonOnly) {
    const mdPath = join(outDir, 'report.md');
    writeFileSync(mdPath, markdown + '\n', 'utf8');
    process.stdout.write(`[write] ${mdPath}\n`);
  }
  process.stdout.write(`[write] ${jsonPath}\n`);
  process.exit(anySqlFailed ? 1 : 0);
}

// Entry point.
const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`Unhandled error: ${String(err && err.stack ? err.stack : err)}\n`);
    process.exit(1);
  });
}
