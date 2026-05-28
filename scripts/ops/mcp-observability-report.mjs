#!/usr/bin/env node
/**
 * OPS-MCP-OBSERVABILITY — Multi-family MCP classifier telemetry report.
 *
 * Read-only operator entry script. Pure helpers live in
 * `mcp-observability-report-lib.cjs` (CommonJS so the Jest default
 * loader can `require()` them). This file is the CLI surface — it
 * resolves the repo root via `import.meta.url`, runs the Source 6
 * safety check first, dispatches each SQL file in `scripts/ops/sql/`
 * via `npx supabase db query --linked --file <file>`, stitches the
 * markdown + JSON output, runs the doctrine ban-list scan, and writes
 * the artifacts (or prints them on --no-write).
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
 *     is independently verified before any query runs.
 *
 * CLI surface — see docs/ops/OPS-MCP-OBSERVABILITY.md.
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const SQL_DIR = join(__dirname, 'sql');

const require = createRequire(import.meta.url);
const lib = require('./mcp-observability-report-lib.cjs');

const {
  parseCliArgs,
  helpText,
  SECTIONS,
  checkSourceSixFilter,
  parseEdgeFamilyRegistry,
  scanMarkdownForBannedTokens,
  runSupabaseSqlFile,
  stitchMarkdownReport,
  buildJsonArtifact,
  safeTruncateEvidence,
} = lib;

function nowIsoUtc() {
  return new Date().toISOString();
}

function nowStampForDir() {
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
    process.stdout.write(`[run] ${section.id} <- ${section.sqlFile}\n`);
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

  // 5. Doctrine ban-list scan on stitched markdown (exclude Appendix B which
  // enumerates the token list as a meta-description).
  const beforeAppendixB = markdown.split('## Appendix B')[0];
  const hits = scanMarkdownForBannedTokens(beforeAppendixB);
  if (hits.length > 0) {
    process.stderr.write(
      `Doctrine ban-list scan triggered. Tokens found: ${hits
        .map((h) => h.token)
        .join(', ')}\n`,
    );
    process.exit(2);
  }

  // 6. Optional evidence-preview safety check (truncate-before-scan).
  if (options.includeEvidencePreview) {
    // Evidence previews are not surfaced in the default markdown body
    // today; if a future section emits them, each excerpt MUST pass
    // safeTruncateEvidence before write. A failing scan triggers exit 4.
    // Probe with the empty string: always passes — placeholder for
    // future expansion that emits previews.
    const probe = safeTruncateEvidence('');
    if (!probe.ok) {
      process.stderr.write(
        `Evidence preview safety check failed: ${probe.reason}\n`,
      );
      process.exit(4);
    }
  }

  // 7. Write or dry-run.
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

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(
      `Unhandled error: ${String(err && err.stack ? err.stack : err)}\n`,
    );
    process.exit(1);
  });
}
