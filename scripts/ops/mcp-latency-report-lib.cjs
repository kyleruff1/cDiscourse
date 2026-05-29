/**
 * OPS-MCP-LATENCY-BUDGET — Pure helpers library (CommonJS).
 *
 * Holds the pure, side-effect-free helpers used by both the `.mjs`
 * entry script and the Jest test suite. CommonJS is used so Jest's
 * default loader can `require()` the module without an extra transform
 * (mirroring `audit-lint-lib.cjs` + `mcp-observability-report-lib.cjs`).
 *
 * This card MEASURES + CODIFIES the auto-trigger latency budget. It does
 * NOT change dispatch behavior, parallelize, or flip any family. The
 * threshold binds to ONE precisely-defined clock: `wall_clock_background`
 * (D2). Latency is a SYSTEM-PERFORMANCE metric, never a gameplay/truth
 * signal (cdiscourse-doctrine §1) and never blocks argument posting.
 *
 * Source-of-truth: docs/designs/OPS-MCP-LATENCY-BUDGET.md
 * Intent brief:    docs/designs/OPS-MCP-LATENCY-BUDGET-intent.md
 *
 * Doctrine:
 *   - No service-role usage; no key literals.
 *   - No raw argument bodies; no evidence_span content (the SQL never
 *     selects one; helpers never synthesize one).
 *   - No verdict/quality tokens in operator-facing markdown (ban-list
 *     scanned via the re-exported scanMarkdownForBannedTokens).
 *
 * The SQL-runner (`runSupabaseSqlFile`) and the doctrine ban-list scanner
 * (`scanMarkdownForBannedTokens`) are REUSED from the observability lib by
 * require-and-re-export — single source of truth, no copy, no drift. If a
 * future card renames those exports, the re-export below breaks loudly and
 * a test catches it (an acceptable, visible coupling — design § Dependencies).
 */

'use strict';

const observabilityLib = require('./mcp-observability-report-lib.cjs');

/* ------------------------------------------------------------------ */
/* Reused machinery (require-and-re-export; NO copy)                   */
/* ------------------------------------------------------------------ */

const { runSupabaseSqlFile, scanMarkdownForBannedTokens } = observabilityLib;

/* ------------------------------------------------------------------ */
/* Thresholds (D5; against wall_clock_background p95)                  */
/* ------------------------------------------------------------------ */

// WARN line (PARTIAL): >= 30s wall-clock-background p95 — headroom pressure
// worth flagging before the next production family.
const WARN_SECONDS = 30;
// FAIL line: >= 45s wall-clock-background p95 — over the product-experience
// budget. (Well under the EdgeRuntime.waitUntil ~150s platform ceiling; 45s is
// a product budget, not a platform hard limit — design § A.3.)
const FAIL_SECONDS = 45;

// Projection defaults (D6; stated + justified in design § A.3).
const DEFAULT_PER_FAMILY_DISPATCH_GAP_SECONDS = 0.5; // ~0.34s observed, rounded up.
const PROJECTION_TARGET_COUNTS = Object.freeze([7, 8, 9, 10]);
const CURRENT_FAMILY_COUNT = 6; // A+B+C+D+E+F production-enabled (anchor).
const LOW_SAMPLE_FLOOR = 5; // a family with < 5 samples is flagged low-sample.

/* ------------------------------------------------------------------ */
/* CLI parsing                                                         */
/* ------------------------------------------------------------------ */

const DEFAULTS = Object.freeze({
  outDir: null,
  sampleLimit: 5,
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
    if (a === '--sample-limit') {
      const v = argv[i + 1];
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n) || n < 2) {
        return {
          ok: false,
          error: '--sample-limit requires an integer >= 2',
        };
      }
      options.sampleLimit = n;
      i += 1;
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
    'OPS-MCP-LATENCY-BUDGET — Auto-trigger latency budget report (read-only)',
    '',
    'USAGE:',
    '  node scripts/ops/mcp-latency-report.mjs [flags]',
    '',
    'FLAGS:',
    '  --sample-limit <int>   N for the recent-args window (default 5;',
    '                         informational — the SQL LIMIT is the binding',
    '                         cap; values < 2 are rejected)',
    '  --out-dir <path>       Output directory (default ./out/ops-latency/<UTC>/)',
    '  --json-only            Skip markdown; emit only the JSON artifact',
    '  --no-write             Dry-run: compute + validate, do not write files',
    '  --help                 Show this help',
    '',
    'EXIT CODES:',
    '  0  Success',
    '  1  At least one SQL file failed (supabase CLI exit preserved)',
    '  2  Doctrine ban-list scan triggered in stitched output',
    '  5  CLI argument parse error',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* SQL section descriptors                                             */
/* ------------------------------------------------------------------ */

const LATENCY_SECTIONS = Object.freeze([
  {
    id: 'q16-per-family-duration',
    title: 'Per-family production durations (Q16)',
    question:
      'Q16 — Per-(argument, family) production-success durations for the most recent N arguments (one row per family run).',
    sqlFile: '01-auto-trigger-per-family-duration.sql',
    columns: ['argument_id', 'family', 'family_seconds', 'started_at', 'completed_at'],
    emptyMessage:
      'No rows. No production-success auto-trigger runs in the recent-N window yet.',
  },
  {
    id: 'q17-wall-clock-per-argument',
    title: 'Per-argument wall-clock background time (Q17)',
    question:
      'Q17 — Per-argument wall_clock_background (max(completed_at) − min(started_at)) + sum_of_per_family + family-run count for the same recent-N arguments. wall_clock_background is the BINDING threshold clock (D2).',
    sqlFile: '02-auto-trigger-wall-clock-per-argument.sql',
    columns: [
      'argument_id',
      'family_runs',
      'wall_clock_background_seconds',
      'sum_of_per_family_seconds',
    ],
    emptyMessage:
      'No rows. No production-success auto-trigger runs in the recent-N window yet.',
  },
]);

/* ------------------------------------------------------------------ */
/* Numeric helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Coerce a value to a finite number, or return null. Postgres `round(...)`
 * returns numeric, which the supabase CLI may serialize as a JSON string.
 */
function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Percentile of a numeric array using the nearest-rank method on a sorted
 * copy. p in [0, 100]. Returns null for an empty array (callers branch on
 * it — never silently 0). A 1-element array returns that element for every
 * percentile (the low-sample path). Non-finite entries are dropped first.
 */
function percentile(values, p) {
  if (!Array.isArray(values)) return null;
  const nums = values
    .map((v) => toFiniteNumber(v))
    .filter((v) => v !== null)
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  if (!Number.isFinite(p)) return null;
  const clamped = Math.max(0, Math.min(100, p));
  // Nearest-rank: rank = ceil(p/100 * n), 1-indexed; p=0 -> first element.
  const rank = Math.ceil((clamped / 100) * nums.length);
  const idx = Math.min(nums.length, Math.max(1, rank)) - 1;
  return nums[idx];
}

function minOf(values) {
  const nums = values.map(toFiniteNumber).filter((v) => v !== null);
  return nums.length === 0 ? null : Math.min(...nums);
}

function maxOf(values) {
  const nums = values.map(toFiniteNumber).filter((v) => v !== null);
  return nums.length === 0 ? null : Math.max(...nums);
}

/* ------------------------------------------------------------------ */
/* Aggregation (pure)                                                  */
/* ------------------------------------------------------------------ */

/**
 * Aggregate Q16-shaped rows ({ family, family_seconds }) into per-family
 * stats. Returns an array sorted by family name, each:
 *   { family, samples, min, p50, p95, max, lowSampleWarning }
 * lowSampleWarning is true when samples < LOW_SAMPLE_FLOOR (5).
 */
function aggregatePerFamily(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const byFamily = new Map();
  for (const row of safeRows) {
    if (!row || typeof row !== 'object') continue;
    const family = typeof row.family === 'string' ? row.family : null;
    const seconds = toFiniteNumber(row.family_seconds);
    if (family === null || seconds === null) continue;
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(seconds);
  }
  const out = [];
  for (const [family, secs] of byFamily.entries()) {
    out.push({
      family,
      samples: secs.length,
      min: minOf(secs),
      p50: percentile(secs, 50),
      p95: percentile(secs, 95),
      max: maxOf(secs),
      lowSampleWarning: secs.length < LOW_SAMPLE_FLOOR,
    });
  }
  out.sort((a, b) => (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));
  return out;
}

/**
 * Aggregate Q17-shaped rows ({ wall_clock_background_seconds }) into
 * wall-clock-background sample stats across the recent-N arguments.
 * Returns { samples, p50, p95, min, max, lowSampleWarning }.
 */
function computeWallClockSamples(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const secs = [];
  for (const row of safeRows) {
    if (!row || typeof row !== 'object') continue;
    const s = toFiniteNumber(row.wall_clock_background_seconds);
    if (s !== null) secs.push(s);
  }
  return {
    samples: secs.length,
    p50: percentile(secs, 50),
    p95: percentile(secs, 95),
    min: minOf(secs),
    max: maxOf(secs),
    lowSampleWarning: secs.length < LOW_SAMPLE_FLOOR,
  };
}

/* ------------------------------------------------------------------ */
/* Classification (D8) — submitBlocked checked FIRST                   */
/* ------------------------------------------------------------------ */

/**
 * classifyLatencyBudget(wallClockBackgroundP95Seconds, submitBlocked)
 *   -> 'PASS' | 'PARTIAL' | 'FAIL'
 *
 * Decision order (D3 — a blocked submit is an immediate FAIL regardless of
 * background timing; this is HALT-trigger-8's correctness core as control
 * flow):
 *   submitBlocked === true                         -> 'FAIL'  (checked FIRST)
 *   wallClockBackgroundP95Seconds >= FAIL_SECONDS  -> 'FAIL'  (>= 45)
 *   wallClockBackgroundP95Seconds >= WARN_SECONDS  -> 'PARTIAL'(>= 30, < 45)
 *   otherwise                                      -> 'PASS'  (< 30, not blocked)
 *
 * Non-finite / negative input throws RangeError (never silently PASS).
 */
function classifyLatencyBudget(wallClockBackgroundP95Seconds, submitBlocked) {
  if (submitBlocked === true) return 'FAIL';
  if (
    typeof wallClockBackgroundP95Seconds !== 'number' ||
    !Number.isFinite(wallClockBackgroundP95Seconds) ||
    wallClockBackgroundP95Seconds < 0
  ) {
    throw new RangeError(
      'classifyLatencyBudget: wallClockBackgroundP95Seconds must be a finite, non-negative number',
    );
  }
  if (wallClockBackgroundP95Seconds >= FAIL_SECONDS) return 'FAIL';
  if (wallClockBackgroundP95Seconds >= WARN_SECONDS) return 'PARTIAL';
  return 'PASS';
}

/* ------------------------------------------------------------------ */
/* Projection (D6)                                                     */
/* ------------------------------------------------------------------ */

/**
 * Default addedFamilyP95 = median of the measured per-family p95 values,
 * rounded UP to the nearest whole second (conservative ceiling; robust to a
 * single heavy family — design § A.3). Returns null if no per-family p95s.
 */
function deriveDefaultAddedFamilyP95(measuredPerFamilyP95) {
  const p95s = (Array.isArray(measuredPerFamilyP95) ? measuredPerFamilyP95 : [])
    .map((f) => (f && typeof f === 'object' ? toFiniteNumber(f.p95Seconds) : null))
    .filter((v) => v !== null);
  if (p95s.length === 0) return null;
  const median = percentile(p95s, 50);
  if (median === null) return null;
  return Math.ceil(median);
}

/** Worst (max) measured per-family p95 — drives the pessimistic sensitivity row. */
function deriveWorstFamilyP95(measuredPerFamilyP95) {
  const p95s = (Array.isArray(measuredPerFamilyP95) ? measuredPerFamilyP95 : [])
    .map((f) => (f && typeof f === 'object' ? toFiniteNumber(f.p95Seconds) : null))
    .filter((v) => v !== null);
  return p95s.length === 0 ? null : Math.max(...p95s);
}

function roundTo(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function buildProjectionRows(anchor, addedFamilyP95, dispatchGap, targetCounts) {
  const perAddedFamily = addedFamilyP95 + dispatchGap;
  return targetCounts.map((familyCount) => {
    const projected = roundTo(
      anchor + (familyCount - CURRENT_FAMILY_COUNT) * perAddedFamily,
      3,
    );
    return {
      familyCount,
      projectedWallClockP95Seconds: projected,
      crossesWarn: projected >= WARN_SECONDS,
      crossesFail: projected >= FAIL_SECONDS,
    };
  });
}

/**
 * projectWallClockForFamilyCounts(...) — anchor on the measured 6-family
 * wall-clock p95, then add (n − 6) × (addedFamilyP95 + perFamilyDispatchGap)
 * per family beyond 6 (design § A.3). The anchor already includes the real
 * dispatch gaps, so it (not the per-family sum, which under-counts) is the
 * correct base.
 *
 * Emits a CENTRAL projection (median-of-measured addedFamilyP95) and a
 * SENSITIVITY projection (worst measured family p95), and mechanically
 * derives the warn/fail crossing counts + the G(7) under/over-budget call.
 */
function projectWallClockForFamilyCounts(
  measuredPerFamilyP95,
  measuredWallClockP95Seconds,
  targetCounts,
  options,
) {
  const opts = options || {};
  const counts =
    Array.isArray(targetCounts) && targetCounts.length > 0
      ? targetCounts.slice()
      : PROJECTION_TARGET_COUNTS.slice();

  const anchor = toFiniteNumber(measuredWallClockP95Seconds);
  if (anchor === null || anchor < 0) {
    throw new RangeError(
      'projectWallClockForFamilyCounts: measuredWallClockP95Seconds must be a finite, non-negative number',
    );
  }

  const dispatchGap =
    typeof opts.perFamilyDispatchGapSeconds === 'number' &&
    Number.isFinite(opts.perFamilyDispatchGapSeconds)
      ? opts.perFamilyDispatchGapSeconds
      : DEFAULT_PER_FAMILY_DISPATCH_GAP_SECONDS;

  const addedFamilyP95Default = deriveDefaultAddedFamilyP95(measuredPerFamilyP95);
  const addedFamilyP95Used =
    typeof opts.addedFamilyP95Seconds === 'number' &&
    Number.isFinite(opts.addedFamilyP95Seconds)
      ? opts.addedFamilyP95Seconds
      : addedFamilyP95Default;

  if (addedFamilyP95Used === null) {
    throw new RangeError(
      'projectWallClockForFamilyCounts: addedFamilyP95Seconds could not be derived (no measured per-family p95) and was not supplied via options',
    );
  }

  const rows = buildProjectionRows(anchor, addedFamilyP95Used, dispatchGap, counts);

  // Sensitivity row set: worst measured family p95 (pessimistic). Falls back
  // to the central addedFamilyP95 when no per-family p95 is available.
  const worstFamilyP95 = deriveWorstFamilyP95(measuredPerFamilyP95);
  const sensitivityAddedFamilyP95 =
    worstFamilyP95 !== null ? worstFamilyP95 : addedFamilyP95Used;
  const sensitivityRows = buildProjectionRows(
    anchor,
    sensitivityAddedFamilyP95,
    dispatchGap,
    counts,
  );

  // Crossing counts: smallest familyCount that crosses each line (null = none
  // crosses within the target set).
  const firstWarn = rows.find((r) => r.crossesWarn);
  const firstFail = rows.find((r) => r.crossesFail);
  const gRow = rows.find((r) => r.familyCount === 7) || null;

  return {
    anchorSeconds: anchor,
    addedFamilyP95Used,
    addedFamilyP95Default,
    dispatchGapUsed: dispatchGap,
    rows,
    sensitivity: {
      addedFamilyP95Used: sensitivityAddedFamilyP95,
      rows: sensitivityRows,
    },
    warnCrossingFamilyCount: firstWarn ? firstWarn.familyCount : null,
    failCrossingFamilyCount: firstFail ? firstFail.familyCount : null,
    gUnderBudget: gRow ? gRow.crossesFail === false : null,
    gRow,
  };
}

/* ------------------------------------------------------------------ */
/* Markdown rendering (pure)                                           */
/* ------------------------------------------------------------------ */

function fmtSeconds(value) {
  const n = toFiniteNumber(value);
  return n === null ? '—' : `${n.toFixed(3)}s`;
}

function escapeMd(value) {
  if (value === null || value === undefined) return '—';
  return String(value).replace(/\|/g, '\\|');
}

function renderRawSection(section, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const lines = [];
  lines.push(`## ${section.title}`);
  lines.push('');
  lines.push(`**Question:** ${section.question}`);
  lines.push('');
  lines.push(`**SQL:** \`scripts/ops-latency-sql/${section.sqlFile}\``);
  lines.push('');
  if (safeRows.length === 0) {
    lines.push(`<sub>${section.emptyMessage}</sub>`);
    lines.push('');
    return lines.join('\n');
  }
  lines.push('| ' + section.columns.join(' | ') + ' |');
  lines.push('| ' + section.columns.map(() => '---').join(' | ') + ' |');
  for (const row of safeRows) {
    lines.push(
      '| ' + section.columns.map((c) => escapeMd(row[c])).join(' | ') + ' |',
    );
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Stitch the full operator-facing markdown. Pure — takes a computed model
 * (see buildLatencyJson) plus the raw section rows. Carries NO verdict /
 * quality / heat token (ban-list scanned by the caller) and NO body /
 * evidence_span field (the SQL never selects one; LATENCY_SECTIONS columns
 * are timing/identity only).
 */
function stitchLatencyMarkdown(model) {
  const m = model || {};
  const sectionsData = m.sectionsData || {};
  const perFamily = Array.isArray(m.perFamily) ? m.perFamily : [];
  const wallClock = m.wallClock || {};
  const classification = m.classification || 'indeterminate (no samples)';
  const projection = m.projection || null;
  const generatedAt = m.generatedAt || '';
  const excludedIncompleteRuns =
    typeof m.excludedIncompleteRuns === 'number' ? m.excludedIncompleteRuns : null;

  const lines = [];
  lines.push('# OPS-MCP-LATENCY-BUDGET — Auto-trigger latency budget report');
  lines.push('');
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push('**Source:** linked Supabase project (read-only)');
  lines.push('**Schema version:** ops-mcp-latency.report.v1');
  lines.push(
    `**Binding clock:** wall_clock_background (D2) — max(completed_at) − min(started_at) per argument.`,
  );
  lines.push(
    `**Thresholds:** warning (PARTIAL) at >= ${WARN_SECONDS}s; FAIL at >= ${FAIL_SECONDS}s wall_clock_background p95.`,
  );
  lines.push('');
  lines.push('## Table of contents');
  lines.push('');
  lines.push('1. [Budget classification](#budget-classification)');
  lines.push('2. [Per-family duration summary](#per-family-duration-summary)');
  lines.push('3. [Wall-clock background summary](#wall-clock-background-summary)');
  lines.push('4. [Sequential-dispatch projection](#sequential-dispatch-projection)');
  LATENCY_SECTIONS.forEach((s, idx) => {
    lines.push(`${idx + 5}. [${s.title}](#${s.id})`);
  });
  lines.push('');

  // 1. Classification.
  lines.push('<a id="budget-classification"></a>');
  lines.push('## Budget classification');
  lines.push('');
  lines.push(`- **Classification:** ${classification}`);
  lines.push(
    `- Basis: wall_clock_background p95 = ${fmtSeconds(wallClock.p95)} across ${
      typeof wallClock.samples === 'number' ? wallClock.samples : 0
    } recent argument(s).`,
  );
  lines.push(
    `- Submit path is fire-and-forget (EdgeRuntime.waitUntil); this report measures background time only and never blocks posting.`,
  );
  if (excludedIncompleteRuns !== null) {
    lines.push(
      `- Excluded incomplete runs (started but completed_at IS NULL): ${excludedIncompleteRuns}.`,
    );
  }
  if (wallClock.lowSampleWarning) {
    lines.push(
      `- low_sample_warning: wall-clock samples < ${LOW_SAMPLE_FLOOR}; treat the p95 as coarse.`,
    );
  }
  lines.push('');

  // 2. Per-family summary.
  lines.push('<a id="per-family-duration-summary"></a>');
  lines.push('## Per-family duration summary');
  lines.push('');
  if (perFamily.length === 0) {
    lines.push('<sub>No per-family samples in the recent-N window.</sub>');
    lines.push('');
  } else {
    lines.push('| family | samples | min | p50 | p95 | max | low_sample_warning |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const f of perFamily) {
      lines.push(
        `| ${escapeMd(f.family)} | ${f.samples} | ${fmtSeconds(f.min)} | ${fmtSeconds(
          f.p50,
        )} | ${fmtSeconds(f.p95)} | ${fmtSeconds(f.max)} | ${
          f.lowSampleWarning ? 'YES' : 'no'
        } |`,
      );
    }
    lines.push('');
  }

  // 3. Wall-clock summary.
  lines.push('<a id="wall-clock-background-summary"></a>');
  lines.push('## Wall-clock background summary');
  lines.push('');
  lines.push('| metric | value |');
  lines.push('| --- | --- |');
  lines.push(`| samples | ${typeof wallClock.samples === 'number' ? wallClock.samples : 0} |`);
  lines.push(`| p50 | ${fmtSeconds(wallClock.p50)} |`);
  lines.push(`| p95 (binding) | ${fmtSeconds(wallClock.p95)} |`);
  lines.push(`| min | ${fmtSeconds(wallClock.min)} |`);
  lines.push(`| max | ${fmtSeconds(wallClock.max)} |`);
  lines.push('');

  // 4. Projection.
  lines.push('<a id="sequential-dispatch-projection"></a>');
  lines.push('## Sequential-dispatch projection');
  lines.push('');
  if (!projection) {
    lines.push(
      '<sub>Projection not available — no measured wall-clock p95 to anchor on. Codified thresholds + method still apply once samples exist.</sub>',
    );
    lines.push('');
  } else {
    lines.push(
      `Anchored on measured ${CURRENT_FAMILY_COUNT}-family wall_clock_background p95 = ${fmtSeconds(
        projection.anchorSeconds,
      )}; added-family p95 = ${fmtSeconds(
        projection.addedFamilyP95Used,
      )} (central: median of measured per-family p95, rounded up); per-family dispatch gap = ${fmtSeconds(
        projection.dispatchGapUsed,
      )}.`,
    );
    lines.push('');
    lines.push('**Central projection (median added-family p95):**');
    lines.push('');
    lines.push('| families | projected wall_clock p95 | crosses 30s warn | crosses 45s FAIL |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of projection.rows) {
      lines.push(
        `| ${r.familyCount} | ${fmtSeconds(r.projectedWallClockP95Seconds)} | ${
          r.crossesWarn ? 'YES' : 'no'
        } | ${r.crossesFail ? 'YES' : 'no'} |`,
      );
    }
    lines.push('');
    lines.push('**Sensitivity projection (worst measured family p95):**');
    lines.push('');
    lines.push(
      `Added-family p95 = ${fmtSeconds(projection.sensitivity.addedFamilyP95Used)}.`,
    );
    lines.push('');
    lines.push('| families | projected wall_clock p95 | crosses 30s warn | crosses 45s FAIL |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of projection.sensitivity.rows) {
      lines.push(
        `| ${r.familyCount} | ${fmtSeconds(r.projectedWallClockP95Seconds)} | ${
          r.crossesWarn ? 'YES' : 'no'
        } | ${r.crossesFail ? 'YES' : 'no'} |`,
      );
    }
    lines.push('');
    const gCall =
      projection.gUnderBudget === true
        ? 'UNDER'
        : projection.gUnderBudget === false
          ? 'OVER'
          : 'indeterminate against';
    const warnAt =
      projection.warnCrossingFamilyCount === null
        ? 'not within the projected range'
        : `N=${projection.warnCrossingFamilyCount}`;
    const failAt =
      projection.failCrossingFamilyCount === null
        ? 'not within the projected range'
        : `N=${projection.failCrossingFamilyCount}`;
    lines.push(
      `**Verdict:** G (7th family) is projected ${gCall} the ${FAIL_SECONDS}s FAIL budget; the ${WARN_SECONDS}s warning line is crossed at ${warnAt}; the ${FAIL_SECONDS}s FAIL line is crossed at ${failAt}.`,
    );
    lines.push('');
    lines.push(
      '> The G under/over-budget call and the crossing counts are derived mechanically from the projection rows (the 7-family row\'s FAIL flag). A FAIL projection is a signal to file a parallelization card (OPS-MCP-AUTO-TRIGGER-PARALLELIZATION); it is NOT an instruction to drop a family or block a submit.',
    );
    lines.push('');
  }

  // 5+. Raw section dumps.
  for (const section of LATENCY_SECTIONS) {
    const rows = Object.prototype.hasOwnProperty.call(sectionsData, section.id)
      ? sectionsData[section.id]
      : [];
    lines.push(`<a id="${section.id}"></a>`);
    lines.push(renderRawSection(section, rows));
  }

  // Doctrine footer (meta-description; the scan in the CLI excludes from here).
  lines.push('## Doctrine scan');
  lines.push('');
  lines.push(
    'Latency is a system-performance metric, never a gameplay/truth/heat signal. This report carries no verdict/quality token and no argument body / evidence_span field.',
  );
  lines.push('');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* JSON artifact (pure)                                                */
/* ------------------------------------------------------------------ */

function buildLatencyJson(model) {
  const m = model || {};
  return {
    schemaVersion: 'ops-mcp-latency.report.v1',
    generatedAt: m.generatedAt || '',
    source: 'linked-supabase',
    bindingClock: 'wall_clock_background',
    thresholds: { warnSeconds: WARN_SECONDS, failSeconds: FAIL_SECONDS },
    classification: m.classification || 'indeterminate (no samples)',
    sampleLimit: typeof m.sampleLimit === 'number' ? m.sampleLimit : null,
    excludedIncompleteRuns:
      typeof m.excludedIncompleteRuns === 'number' ? m.excludedIncompleteRuns : null,
    perFamily: Array.isArray(m.perFamily) ? m.perFamily : [],
    wallClock: m.wallClock || {},
    projection: m.projection || null,
    sections: LATENCY_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      question: s.question,
      sqlFile: `scripts/ops-latency-sql/${s.sqlFile}`,
      columns: [...s.columns],
      rows:
        m.sectionsData && Object.prototype.hasOwnProperty.call(m.sectionsData, s.id)
          ? m.sectionsData[s.id]
          : [],
    })),
  };
}

module.exports = {
  // Reused (require-and-re-export; no copy).
  runSupabaseSqlFile,
  scanMarkdownForBannedTokens,
  // Constants.
  WARN_SECONDS,
  FAIL_SECONDS,
  DEFAULT_PER_FAMILY_DISPATCH_GAP_SECONDS,
  PROJECTION_TARGET_COUNTS,
  CURRENT_FAMILY_COUNT,
  LOW_SAMPLE_FLOOR,
  LATENCY_SECTIONS,
  DEFAULTS,
  // CLI.
  parseCliArgs,
  helpText,
  // Numeric.
  percentile,
  toFiniteNumber,
  // Aggregation.
  aggregatePerFamily,
  computeWallClockSamples,
  // Classification + projection.
  classifyLatencyBudget,
  projectWallClockForFamilyCounts,
  deriveDefaultAddedFamilyP95,
  // Rendering.
  stitchLatencyMarkdown,
  buildLatencyJson,
};
