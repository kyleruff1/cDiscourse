#!/usr/bin/env node
/**
 * OPS-MCP-LATENCY-BUDGET — Auto-trigger latency budget report.
 *
 * Read-only operator entry script. Pure helpers live in
 * `mcp-latency-report-lib.cjs` (CommonJS so the Jest default loader can
 * `require()` them). This file is the CLI surface — it resolves the repo
 * root via `import.meta.url`, runs the two latency SQL files in
 * `scripts/ops/sql/` via the lib's reused `runSupabaseSqlFile`, computes
 * per-family + wall-clock percentiles + classification + projection in JS,
 * stitches the markdown + JSON artifact, runs the doctrine ban-list scan,
 * and writes the artifacts to `out/ops-latency/<UTC>/` (or prints on
 * --no-write).
 *
 * This card MEASURES + CODIFIES only. It does NOT change dispatch
 * behavior, parallelize, or flip any family. The budget binds to
 * `wall_clock_background` (D2) and never blocks argument posting
 * (cdiscourse-doctrine §1; submit is fire-and-forget via
 * EdgeRuntime.waitUntil).
 *
 * Source-of-truth: docs/designs/OPS-MCP-LATENCY-BUDGET.md
 * Intent brief:    docs/designs/OPS-MCP-LATENCY-BUDGET-intent.md
 * Budget doc:      docs/ops/LATENCY-BUDGET.md
 *
 * Doctrine:
 *   - No service-role usage (runs via `npx supabase db query --linked`,
 *     the operator's authenticated CLI session).
 *   - No raw argument bodies; no evidence_span content (the SQL never
 *     selects one).
 *   - No verdict/quality token in operator-facing markdown.
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
const lib = require('./mcp-latency-report-lib.cjs');

const {
  parseCliArgs,
  helpText,
  LATENCY_SECTIONS,
  PROJECTION_TARGET_COUNTS,
  runSupabaseSqlFile,
  scanMarkdownForBannedTokens,
  aggregatePerFamily,
  computeWallClockSamples,
  classifyLatencyBudget,
  projectWallClockForFamilyCounts,
  stitchLatencyMarkdown,
  buildLatencyJson,
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

  // 1. Run each SQL file in order (read-only SELECTs via the linked CLI).
  const sectionsData = {};
  let anySqlFailed = false;
  for (const section of LATENCY_SECTIONS) {
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

  // 2. Compute aggregates + classification + projection (pure; always runs so
  //    the codification is never blocked by a transient DB hiccup).
  const q16Rows = sectionsData['q16-per-family-duration'] || [];
  const q17Rows = sectionsData['q17-wall-clock-per-argument'] || [];
  const perFamily = aggregatePerFamily(q16Rows);
  const wallClock = computeWallClockSamples(q17Rows);

  let classification;
  let projection = null;
  if (wallClock.samples === 0 || wallClock.p95 === null) {
    classification = 'indeterminate (no samples)';
  } else {
    // submitBlocked is always false here: this report never observes a
    // blocked submit (submit is fire-and-forget). A blocked submit would be
    // surfaced by the post-merge smoke's HTTP response-time metric (D3); the
    // classifier parameter exists so that path maps to an immediate FAIL.
    classification = classifyLatencyBudget(wallClock.p95, false);
    const measuredPerFamilyP95 = perFamily
      .filter((f) => f.p95 !== null)
      .map((f) => ({ family: f.family, p95Seconds: f.p95 }));
    if (measuredPerFamilyP95.length > 0) {
      projection = projectWallClockForFamilyCounts(
        measuredPerFamilyP95,
        wallClock.p95,
        PROJECTION_TARGET_COUNTS,
      );
    }
  }

  const generatedAt = nowIsoUtc();
  const model = {
    generatedAt,
    sampleLimit: options.sampleLimit,
    sectionsData,
    perFamily,
    wallClock,
    classification,
    projection,
  };

  const markdown = stitchLatencyMarkdown(model);
  const json = buildLatencyJson(model);

  // 3. Doctrine ban-list scan on the stitched markdown (exclude the
  //    "## Doctrine scan" footer which enumerates the policy as meta-text).
  const beforeDoctrineFooter = markdown.split('## Doctrine scan')[0];
  const hits = scanMarkdownForBannedTokens(beforeDoctrineFooter);
  if (hits.length > 0) {
    process.stderr.write(
      `Doctrine ban-list scan triggered. Tokens found: ${hits
        .map((h) => h.token)
        .join(', ')}\n`,
    );
    process.exit(2);
  }

  // 4. Write or dry-run.
  if (options.noWrite) {
    process.stdout.write(`[classification] ${classification}\n`);
    process.stdout.write('[no-write] dry-run complete.\n');
    process.exit(anySqlFailed ? 1 : 0);
  }
  const outDir = options.outDir
    ? resolve(options.outDir)
    : join(REPO_ROOT, 'out', 'ops-latency', nowStampForDir());
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
