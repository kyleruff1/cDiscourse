/**
 * OPS-MCP-OBSERVABILITY — Pure helpers library (CommonJS).
 *
 * This module holds the pure, side-effect-free helpers used by both
 * the `.mjs` entry script and the Jest test suites. CommonJS is used
 * so Jest's default loader can `require()` the module without an
 * additional transform.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md.
 *
 * Doctrine:
 *   - No service-role usage.
 *   - No raw argument bodies; no evidence_span content by default.
 *   - No banned tokens in operator-facing labels.
 *   - Source 6 production-only filter at
 *     `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
 *     is independently verified (literal-line readback).
 */

'use strict';

const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

/* ------------------------------------------------------------------ */
/* CLI parsing                                                         */
/* ------------------------------------------------------------------ */

const DEFAULTS = Object.freeze({
  outDir: null,
  timeWindowDays: 7,
  includeArgumentDetail: false,
  includeEvidencePreview: false,
  jsonOnly: false,
  noWrite: false,
  help: false,
});

function parseCliArgs(argv) {
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

function helpText() {
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
/* SQL section descriptors                                             */
/* ------------------------------------------------------------------ */

const SECTIONS = Object.freeze([
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
    title: 'Duplicate runs (classified)',
    question:
      'Q9 — Are production rows accumulating duplicates for the same (argument_id, family, run_mode, schema_version, provider_key, model_name) tuple? Classifies each duplicate-pair as audit_or_smoke_rerun / synthetic_test_data / needs_investigation / organic_duplicate_candidate so documented audit/smoke re-fires do not over-read as runtime defect.',
    sqlFile: '09-duplicate-runs.sql',
    columns: [
      'argument_id',
      'family',
      'run_mode',
      'schema_version',
      'provider_key',
      'model_name',
      'duplicate_successful_runs',
      'classification',
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
    id: 'q11-per-family-per-mode-coverage',
    title: 'Per-family per-mode coverage',
    question:
      'Q11 — How are runs distributed across families and run_modes? (5-family carrier-forward state: A+B+C+G (resolution_progress) production + admin_validation; D admin_validation only with 18-key Subset for G; E, F production; H Card-1 admin_validation; I, J unsupported.)',
    sqlFile: '11-per-family-per-mode-coverage.sql',
    columns: [
      'requested_family',
      'run_mode',
      'run_count',
      'success_count',
      'failed_count',
      'fallback_count',
    ],
    emptyMessage: 'No runs in the table.',
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
  {
    id: 'q14-per-family-per-mode-signal-density',
    title: 'Per-family per-mode signal density',
    question:
      'Q14 — What is the per-(run, possible_key) signal density across all five Subset-backfilled families (A, B, C, D, G) and both run_modes?',
    sqlFile: '14-per-family-per-mode-signal-density.sql',
    columns: [
      'family',
      'run_mode',
      'runs',
      'positives',
      'raw_keys_observed',
      'family_key_count',
      'positives_per_run_key_cell',
    ],
    emptyMessage:
      'No runs in the table. Density math requires runs to evaluate.',
  },
  {
    id: 'q15-family-d-subset-coverage',
    title: 'Family D 22-key subset coverage',
    question:
      'Q15 — Are all observed Family D raw_keys within the 22-key ai_classifier Subset, with zero deterministic-key leaks?',
    sqlFile: '15-family-d-subset-coverage.sql',
    columns: [
      'raw_key',
      'run_mode',
      'positive_count',
      'distinct_arguments',
      'subset_membership',
    ],
    emptyMessage:
      'No Family D positive results yet. Subset coverage will populate after admin_validation runs produce positives.',
  },
  {
    id: 'q16-family-g-subset-coverage',
    title: 'Family G 21-key subset coverage',
    question:
      'Q16 — Are all observed Family G raw_keys within the 21-key ai_classifier Subset, with zero deterministic-key leaks?',
    sqlFile: '16-family-g-subset-coverage.sql',
    columns: [
      'raw_key',
      'run_mode',
      'positive_count',
      'distinct_arguments',
      'subset_membership',
    ],
    emptyMessage:
      'No Family G positive results yet. Subset coverage will populate after admin_validation or production runs produce positives.',
  },
]);

/* ------------------------------------------------------------------ */
/* Source 6 safety check                                               */
/* ------------------------------------------------------------------ */

const SOURCE_SIX_PATH = join(
  'src',
  'features',
  'nodeLabels',
  'machineObservationPersistenceQuery.ts',
);

// Build the literal substring from fragments so this file itself does
// not carry the contiguous binding string.
const SOURCE_SIX_LITERAL_FRAGMENT_A =
  ".eq('argument_machine_observation_runs.run_mode',";
const SOURCE_SIX_LITERAL_FRAGMENT_B = " 'production')";

function checkSourceSixFilter(repoRoot) {
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
/* Family registry parsing (Edge)                                      */
/* ------------------------------------------------------------------ */

const EDGE_FAMILY_REGISTRY_PATH = join(
  'supabase',
  'functions',
  '_shared',
  'booleanObservations',
  'familyRegistry.ts',
);

function parseEdgeFamilyRegistry(repoRoot) {
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
  const entryRe =
    /family:\s*'([a-z_]+)'[\s\S]*?productionEnabled:\s*(true|false)[\s\S]*?adminValidationEnabled:\s*(true|false)/g;
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
/* Doctrine ban-list                                                   */
/* ------------------------------------------------------------------ */

const BANNED_TOKENS = Object.freeze([
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

const BANNED_VERDICT_TOKENS = Object.freeze(['correct', 'incorrect']);

function scanMarkdownForBannedTokens(markdown) {
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

function runSupabaseSqlFile(absoluteSqlPath) {
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
      exitCode: result.status != null ? result.status : 1,
    };
  }
  const stdout = result.stdout || '';
  try {
    const parsed = JSON.parse(stdout);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)) {
      return { ok: true, rows: parsed.rows, stderr: '', exitCode: 0 };
    }
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
  if (value === null || value === undefined) return '—';
  const s = String(value);
  return s.replace(/\|/g, '\\|');
}

function renderSectionMarkdown(section, rows) {
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

function stitchMarkdownReport(args) {
  const {
    sectionsData,
    sourceSixCheck,
    edgeRegistry,
    generatedAt,
    defaultTimeWindowDays,
    includeEvidencePreview,
  } = args;
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
  for (const section of SECTIONS) {
    const rows =
      sectionsData && Object.prototype.hasOwnProperty.call(sectionsData, section.id)
        ? sectionsData[section.id]
        : [];
    lines.push(`<a id="${section.id}"></a>`);
    lines.push(renderSectionMarkdown(section, rows));
  }
  lines.push('## Appendix A — Family registry snapshot');
  lines.push('');
  if (edgeRegistry && edgeRegistry.ok) {
    lines.push(`Source file: \`${EDGE_FAMILY_REGISTRY_PATH}\``);
    lines.push('');
    lines.push(
      `- Production-mode families: \`${edgeRegistry.productionEnabled.join(', ') || '(none)'}\``,
    );
    lines.push(
      `- Admin-validation-mode families: \`${edgeRegistry.adminValidationEnabled.join(', ') || '(none)'}\``,
    );
    lines.push('');
  } else {
    lines.push('Edge family registry parsing was skipped.');
    lines.push('');
  }
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
    'Evidence span preview included: ' +
      (includeEvidencePreview ? 'YES (truncated <=120 chars)' : 'NO (default)') +
      '.',
  );
  lines.push('');
  return lines.join('\n');
}

function buildJsonArtifact(args) {
  const {
    sectionsData,
    sourceSixCheck,
    edgeRegistry,
    generatedAt,
    defaultTimeWindowDays,
  } = args;
  const sections = SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    question: s.question,
    sqlFile: `scripts/ops/sql/${s.sqlFile}`,
    columns: [...s.columns],
    rows:
      sectionsData && Object.prototype.hasOwnProperty.call(sectionsData, s.id)
        ? sectionsData[s.id]
        : [],
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
    familyRegistrySnapshot:
      edgeRegistry && edgeRegistry.ok
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
/* Evidence preview truncation + safety (--include-evidence-preview)   */
/* ------------------------------------------------------------------ */

const EVIDENCE_PREVIEW_MAX_CHARS = 120;

/**
 * Truncate an evidence span string to at most 120 chars, then scan the
 * truncated value for banned tokens. The truncation MUST happen
 * before the scan so a long span carrying a banned token at character
 * 200 is not silently let through.
 *
 * Returns { ok, truncated } when safe and { ok: false, reason } when
 * the doctrine scan finds a banned token.
 */
function safeTruncateEvidence(rawSpan) {
  const str = typeof rawSpan === 'string' ? rawSpan : '';
  const truncated = str.length > EVIDENCE_PREVIEW_MAX_CHARS
    ? str.slice(0, EVIDENCE_PREVIEW_MAX_CHARS)
    : str;
  const hits = scanMarkdownForBannedTokens(truncated);
  if (hits.length > 0) {
    return { ok: false, reason: 'banned_token_in_truncated_excerpt', truncated };
  }
  return { ok: true, truncated };
}

module.exports = {
  parseCliArgs,
  helpText,
  SECTIONS,
  SOURCE_SIX_PATH,
  SOURCE_SIX_LITERAL_FRAGMENT_A,
  SOURCE_SIX_LITERAL_FRAGMENT_B,
  checkSourceSixFilter,
  EDGE_FAMILY_REGISTRY_PATH,
  parseEdgeFamilyRegistry,
  BANNED_TOKENS,
  BANNED_VERDICT_TOKENS,
  scanMarkdownForBannedTokens,
  runSupabaseSqlFile,
  renderSectionMarkdown,
  stitchMarkdownReport,
  buildJsonArtifact,
  EVIDENCE_PREVIEW_MAX_CHARS,
  safeTruncateEvidence,
  DEFAULTS,
};
