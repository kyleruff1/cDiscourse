/**
 * OPS-MCP-LATENCY-BUDGET — Pure-helper unit suite.
 *
 * Tests the pure helpers in `scripts/ops/mcp-latency-report-lib.cjs`
 * (CommonJS, `require()`d by Jest — the audit-lint-lib.cjs +
 * opsAuditLint.test.ts pattern). No network, no DB, no React.
 *
 * Centerpiece: the classifyLatencyBudget boundary cases (D8) and the
 * projectWallClockForFamilyCounts arithmetic (D6). Plus percentile,
 * aggregation, the doctrine ban-list on stitched markdown, and a
 * no-network purity assertion on the lib source.
 *
 * Source-of-truth: docs/designs/OPS-MCP-LATENCY-BUDGET.md § Test plan.
 */

import * as fs from 'fs';
import * as path from 'path';

type LatencyClassification = 'PASS' | 'PARTIAL' | 'FAIL';

interface PerFamilyP95 {
  family: string;
  p95Seconds: number;
}

interface ProjectionRow {
  familyCount: number;
  projectedWallClockP95Seconds: number;
  crossesWarn: boolean;
  crossesFail: boolean;
}

interface ProjectionResult {
  anchorSeconds: number;
  addedFamilyP95Used: number;
  addedFamilyP95Default: number | null;
  dispatchGapUsed: number;
  rows: ProjectionRow[];
  sensitivity: { addedFamilyP95Used: number; rows: ProjectionRow[] };
  warnCrossingFamilyCount: number | null;
  failCrossingFamilyCount: number | null;
  gUnderBudget: boolean | null;
  gRow: ProjectionRow | null;
}

interface PerFamilyAggregate {
  family: string;
  samples: number;
  min: number | null;
  p50: number | null;
  p95: number | null;
  max: number | null;
  lowSampleWarning: boolean;
}

interface WallClockAggregate {
  samples: number;
  p50: number | null;
  p95: number | null;
  min: number | null;
  max: number | null;
  lowSampleWarning: boolean;
}

const LIB_PATH = path.join(
  process.cwd(),
  'scripts',
  'ops',
  'mcp-latency-report-lib.cjs',
);
const SCRIPT_PATH = path.join(
  process.cwd(),
  'scripts',
  'ops',
  'mcp-latency-report.mjs',
);

const lib = require('../scripts/ops/mcp-latency-report-lib.cjs') as {
  WARN_SECONDS: number;
  FAIL_SECONDS: number;
  DEFAULT_PER_FAMILY_DISPATCH_GAP_SECONDS: number;
  PROJECTION_TARGET_COUNTS: number[];
  CURRENT_FAMILY_COUNT: number;
  LOW_SAMPLE_FLOOR: number;
  LATENCY_SECTIONS: ReadonlyArray<{
    id: string;
    title: string;
    question: string;
    sqlFile: string;
    columns: string[];
    emptyMessage: string;
  }>;
  DEFAULTS: Record<string, unknown>;
  parseCliArgs: (
    argv: unknown,
  ) => {
    ok: boolean;
    options?: Record<string, unknown>;
    error?: string;
  };
  helpText: () => string;
  percentile: (values: unknown, p: number) => number | null;
  toFiniteNumber: (value: unknown) => number | null;
  aggregatePerFamily: (rows: unknown) => PerFamilyAggregate[];
  computeWallClockSamples: (rows: unknown) => WallClockAggregate;
  classifyLatencyBudget: (
    wallClockBackgroundP95Seconds: number,
    submitBlocked: boolean,
  ) => LatencyClassification;
  projectWallClockForFamilyCounts: (
    measuredPerFamilyP95: PerFamilyP95[],
    measuredWallClockP95Seconds: number,
    targetCounts: number[],
    options?: {
      addedFamilyP95Seconds?: number;
      perFamilyDispatchGapSeconds?: number;
    },
  ) => ProjectionResult;
  deriveDefaultAddedFamilyP95: (measured: PerFamilyP95[]) => number | null;
  scanMarkdownForBannedTokens: (
    markdown: string,
  ) => Array<{ token: string; index: number }>;
  runSupabaseSqlFile: unknown;
  stitchLatencyMarkdown: (model: unknown) => string;
  buildLatencyJson: (model: unknown) => Record<string, unknown>;
};

const {
  WARN_SECONDS,
  FAIL_SECONDS,
  CURRENT_FAMILY_COUNT,
  LATENCY_SECTIONS,
  percentile,
  aggregatePerFamily,
  computeWallClockSamples,
  classifyLatencyBudget,
  projectWallClockForFamilyCounts,
  deriveDefaultAddedFamilyP95,
  scanMarkdownForBannedTokens,
  stitchLatencyMarkdown,
  buildLatencyJson,
} = lib;

/* ============================================================ */
/* 0. Thresholds + reused exports                               */
/* ============================================================ */

describe('OPS-MCP-LATENCY-BUDGET — constants + reused machinery', () => {
  it('WARN_SECONDS is 30 and FAIL_SECONDS is 45', () => {
    expect(WARN_SECONDS).toBe(30);
    expect(FAIL_SECONDS).toBe(45);
  });

  it('re-exports runSupabaseSqlFile + scanMarkdownForBannedTokens (require-and-re-export coupling)', () => {
    // If the observability lib renames these, this assertion fails loudly
    // (design § Dependencies — acceptable, visible coupling).
    expect(typeof lib.runSupabaseSqlFile).toBe('function');
    expect(typeof lib.scanMarkdownForBannedTokens).toBe('function');
  });

  it('exposes exactly the two latency SQL sections (Q16, Q17) by their local 01/02 filenames', () => {
    // The latency SQL lives in the dedicated sibling dir scripts/ops-latency-sql/
    // (NOT scripts/ops/sql/, which is observability-owned) and is locally
    // renumbered 01/02. See docs/ops/LATENCY-BUDGET.md § "Directory ownership".
    expect(LATENCY_SECTIONS.map((s) => s.sqlFile)).toEqual([
      '01-auto-trigger-per-family-duration.sql',
      '02-auto-trigger-wall-clock-per-argument.sql',
    ]);
  });
});

/* ============================================================ */
/* 1. classifyLatencyBudget — boundary cases (D8 centerpiece)   */
/* ============================================================ */

describe('OPS-MCP-LATENCY-BUDGET — classifyLatencyBudget boundary cases', () => {
  // The design Test plan line "classify(44.9,false) -> PASS" is an internal
  // typo: 44.9 is >= WARN_SECONDS (30) and < FAIL_SECONDS (45), so the binding
  // classification contract (design §"Pure classification function", decision
  // order ">= 30 -> PARTIAL") yields PARTIAL. The adjacent design entries
  // classify(44.999,false)->PARTIAL and classify(45,false)->FAIL confirm the
  // band. We follow the normative contract, not the typo. Every other row is
  // the exact design Test-plan value.
  it.each([
    [29.9, false, 'PASS', 'just-under-30'],
    [0, false, 'PASS', 'degenerate zero'],
    [30, false, 'PARTIAL', 'exactly-30 warning line, inclusive'],
    [37, false, 'PARTIAL', 'mid 30..45 band'],
    [44.9, false, 'PARTIAL', '>=30 and <45 warning band (design typo corrected)'],
    [44.999, false, 'PARTIAL', 'just under FAIL'],
    [45, false, 'FAIL', 'exactly-45, inclusive'],
    [60, false, 'FAIL', 'well over'],
    [5, true, 'FAIL', 'submitBlocked=true with FAST background -> FAIL (D3)'],
  ] as Array<[number, boolean, LatencyClassification, string]>)(
    'classify(%p, %p) -> %s (%s)',
    (wall, blocked, expected) => {
      expect(classifyLatencyBudget(wall, blocked)).toBe(expected);
    },
  );

  it('submitBlocked is checked FIRST: a NaN background with submitBlocked=true is still FAIL (no throw)', () => {
    // The D3 guard short-circuits before the finite-number check.
    expect(classifyLatencyBudget(Number.NaN, true)).toBe('FAIL');
  });

  it.each([
    [Number.NaN, 'NaN'],
    [-1, 'negative'],
    [Number.POSITIVE_INFINITY, 'Infinity'],
  ] as Array<[number, string]>)(
    'classify(%s, false) throws RangeError (never silently PASS)',
    (wall) => {
      expect(() => classifyLatencyBudget(wall, false)).toThrow(RangeError);
    },
  );

  it('is referentially transparent: same input -> same output across 100 calls', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(classifyLatencyBudget(37, false)).toBe('PARTIAL');
      expect(classifyLatencyBudget(45, false)).toBe('FAIL');
      expect(classifyLatencyBudget(10, false)).toBe('PASS');
    }
  });
});

/* ============================================================ */
/* 2. projectWallClockForFamilyCounts — arithmetic (D6)         */
/* ============================================================ */

describe('OPS-MCP-LATENCY-BUDGET — projectWallClockForFamilyCounts arithmetic', () => {
  // A fixture whose median per-family p95 = 6 so the FAIL crossing first
  // occurs at n=9 (matching the worked example): anchor 30.4 + (n-6)*(6+0.5).
  const measured: PerFamilyP95[] = [
    { family: 'a', p95Seconds: 6 },
    { family: 'b', p95Seconds: 6 },
    { family: 'c', p95Seconds: 6 },
    { family: 'd', p95Seconds: 7.6 },
    { family: 'e', p95Seconds: 6 },
    { family: 'f', p95Seconds: 5 },
  ];

  it('default addedFamilyP95 is the median of measured per-family p95, rounded up', () => {
    // median of [5,6,6,6,6,7.6] (sorted) -> nearest-rank p50 = 6 -> ceil = 6.
    expect(deriveDefaultAddedFamilyP95(measured)).toBe(6);
  });

  it('projected 7/8/9/10 equal the closed form anchor + (n-6)*(addedFamilyP95+gap)', () => {
    const anchor = 30.4;
    const result = projectWallClockForFamilyCounts(measured, anchor, [7, 8, 9, 10], {
      addedFamilyP95Seconds: 6,
      perFamilyDispatchGapSeconds: 0.5,
    });
    const per = 6 + 0.5;
    const expected = (n: number) =>
      Math.round((anchor + (n - CURRENT_FAMILY_COUNT) * per) * 1000) / 1000;
    expect(result.rows.map((r) => r.projectedWallClockP95Seconds)).toEqual([
      expected(7),
      expected(8),
      expected(9),
      expected(10),
    ]);
    // 36.9, 43.4, 49.9, 56.4
    expect(result.rows[0].projectedWallClockP95Seconds).toBe(36.9);
    expect(result.rows[2].projectedWallClockP95Seconds).toBe(49.9);
  });

  it('crosses-warn / crosses-fail booleans flip at the right family count (FAIL first at n=9)', () => {
    const result = projectWallClockForFamilyCounts(measured, 30.4, [7, 8, 9, 10], {
      addedFamilyP95Seconds: 6,
      perFamilyDispatchGapSeconds: 0.5,
    });
    expect(result.rows.map((r) => r.crossesWarn)).toEqual([true, true, true, true]);
    expect(result.rows.map((r) => r.crossesFail)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(result.warnCrossingFamilyCount).toBe(7);
    expect(result.failCrossingFamilyCount).toBe(9);
  });

  it('the G call (familyCount===7) derives crossesFail===false for the worked-example fixture', () => {
    const result = projectWallClockForFamilyCounts(measured, 30.4, [7, 8, 9, 10], {
      addedFamilyP95Seconds: 6,
      perFamilyDispatchGapSeconds: 0.5,
    });
    expect(result.gRow?.crossesFail).toBe(false);
    expect(result.gUnderBudget).toBe(true);
  });

  it('the G call is DATA-DERIVED: a pessimistic fixture makes G cross FAIL (crossesFail===true)', () => {
    // Anchor already at 44, added-family 8 -> 7 families = 44 + 8.5 = 52.5 >= 45.
    const result = projectWallClockForFamilyCounts(measured, 44, [7, 8, 9, 10], {
      addedFamilyP95Seconds: 8,
      perFamilyDispatchGapSeconds: 0.5,
    });
    expect(result.gRow?.crossesFail).toBe(true);
    expect(result.gUnderBudget).toBe(false);
    expect(result.failCrossingFamilyCount).toBe(7);
  });

  it('emits a sensitivity row set using the WORST measured family p95 (distinct from central)', () => {
    const result = projectWallClockForFamilyCounts(measured, 30.4, [7, 8, 9, 10]);
    // Central uses median-of-measured (6); sensitivity uses worst (7.6).
    expect(result.addedFamilyP95Used).toBe(6);
    expect(result.sensitivity.addedFamilyP95Used).toBe(7.6);
    // The two projections differ for n>6.
    expect(result.sensitivity.rows[0].projectedWallClockP95Seconds).not.toBe(
      result.rows[0].projectedWallClockP95Seconds,
    );
  });

  it('uses the default dispatch gap (0.5) when not supplied', () => {
    const result = projectWallClockForFamilyCounts(measured, 30.4, [7]);
    expect(result.dispatchGapUsed).toBe(0.5);
  });

  it('throws RangeError when the anchor is non-finite', () => {
    expect(() =>
      projectWallClockForFamilyCounts(measured, Number.NaN, [7]),
    ).toThrow(RangeError);
  });

  it('throws RangeError when no per-family p95 exists and none supplied', () => {
    expect(() => projectWallClockForFamilyCounts([], 30.4, [7])).toThrow(
      RangeError,
    );
  });
});

/* ============================================================ */
/* 3. percentile helper                                         */
/* ============================================================ */

describe('OPS-MCP-LATENCY-BUDGET — percentile', () => {
  const five = [4, 2, 5, 1, 3]; // unsorted; sorts to [1,2,3,4,5]

  it('p50 / p95 / p0 / p100 on a known 5-element array (nearest-rank)', () => {
    expect(percentile(five, 50)).toBe(3); // ceil(0.5*5)=3 -> 3rd -> 3
    expect(percentile(five, 95)).toBe(5); // ceil(0.95*5)=5 -> 5th -> 5
    expect(percentile(five, 0)).toBe(1); // min
    expect(percentile(five, 100)).toBe(5); // max
  });

  it('p95 / p50 on a 1-element array equals that element (low-sample path)', () => {
    expect(percentile([7.5], 95)).toBe(7.5);
    expect(percentile([7.5], 50)).toBe(7.5);
  });

  it('empty array and non-array return null (not 0, not throw) so callers branch', () => {
    expect(percentile([], 95)).toBeNull();
    expect(percentile(null, 95)).toBeNull();
  });

  it('coerces numeric strings (postgres numeric serialized as string) and drops non-finite entries', () => {
    expect(percentile(['1', '2', '3', '4', '5'], 50)).toBe(3);
    expect(percentile([1, 2, Number.NaN, 4, 5], 100)).toBe(5);
  });
});

/* ============================================================ */
/* 4. aggregatePerFamily / computeWallClockSamples              */
/* ============================================================ */

describe('OPS-MCP-LATENCY-BUDGET — aggregatePerFamily', () => {
  // Q16-shaped rows: family A has 5 samples; family F has 1 (low-sample).
  const q16Rows = [
    { argument_id: 'arg1', family: 'parent_relation', family_seconds: 4.3 },
    { argument_id: 'arg2', family: 'parent_relation', family_seconds: 5.0 },
    { argument_id: 'arg3', family: 'parent_relation', family_seconds: 5.1 },
    { argument_id: 'arg4', family: 'parent_relation', family_seconds: 6.0 },
    { argument_id: 'arg5', family: 'parent_relation', family_seconds: 4.6 },
    { argument_id: 'arg1', family: 'critical_question', family_seconds: 5.13 },
  ];

  it('aggregates to expected per-family min/p50/p95/max + samples', () => {
    const agg = aggregatePerFamily(q16Rows);
    const a = agg.find((f) => f.family === 'parent_relation')!;
    expect(a.samples).toBe(5);
    expect(a.min).toBeCloseTo(4.3, 5);
    expect(a.max).toBeCloseTo(6.0, 5);
    // sorted [4.3,4.6,5.0,5.1,6.0]: p50 nearest-rank 3rd = 5.0; p95 5th = 6.0.
    expect(a.p50).toBeCloseTo(5.0, 5);
    expect(a.p95).toBeCloseTo(6.0, 5);
    expect(a.lowSampleWarning).toBe(false);
  });

  it('flags low_sample_warning for a family with < 5 samples', () => {
    const agg = aggregatePerFamily(q16Rows);
    const f = agg.find((fam) => fam.family === 'critical_question')!;
    expect(f.samples).toBe(1);
    expect(f.lowSampleWarning).toBe(true);
    // single sample: p95 == p50 == the one value.
    expect(f.p95).toBeCloseTo(5.13, 5);
    expect(f.p50).toBeCloseTo(5.13, 5);
  });

  it('is sorted by family name', () => {
    const agg = aggregatePerFamily(q16Rows);
    expect(agg.map((f) => f.family)).toEqual([
      'critical_question',
      'parent_relation',
    ]);
  });

  it('ignores rows with missing family or non-numeric seconds', () => {
    const agg = aggregatePerFamily([
      { family: 'x', family_seconds: 'not-a-number' },
      { family: null, family_seconds: 5 },
      { family: 'y', family_seconds: 3 },
    ]);
    expect(agg.map((f) => f.family)).toEqual(['y']);
  });

  it('returns [] for non-array input', () => {
    expect(aggregatePerFamily(null)).toEqual([]);
  });
});

describe('OPS-MCP-LATENCY-BUDGET — computeWallClockSamples', () => {
  const q17Rows = [
    { argument_id: 'a', wall_clock_background_seconds: 30.44 },
    { argument_id: 'b', wall_clock_background_seconds: 27.98 },
    { argument_id: 'c', wall_clock_background_seconds: 21.54 },
    { argument_id: 'd', wall_clock_background_seconds: 21.16 },
    { argument_id: 'e', wall_clock_background_seconds: 20.64 },
  ];

  it('yields expected wall-clock p50/p95 across the recent-N arguments', () => {
    const wc = computeWallClockSamples(q17Rows);
    expect(wc.samples).toBe(5);
    // sorted [20.64,21.16,21.54,27.98,30.44]: p50 3rd = 21.54; p95 5th = 30.44.
    expect(wc.p50).toBeCloseTo(21.54, 5);
    expect(wc.p95).toBeCloseTo(30.44, 5);
    expect(wc.min).toBeCloseTo(20.64, 5);
    expect(wc.max).toBeCloseTo(30.44, 5);
    expect(wc.lowSampleWarning).toBe(false);
  });

  it('empty rows -> samples 0, p95 null, lowSampleWarning true', () => {
    const wc = computeWallClockSamples([]);
    expect(wc.samples).toBe(0);
    expect(wc.p95).toBeNull();
    expect(wc.lowSampleWarning).toBe(true);
  });
});

/* ============================================================ */
/* 5. Doctrine ban-list on stitched markdown (mandatory)        */
/* ============================================================ */

describe('OPS-MCP-LATENCY-BUDGET — doctrine ban-list on stitched markdown', () => {
  function buildFullModel() {
    const measured: PerFamilyP95[] = [
      { family: 'parent_relation', p95Seconds: 6 },
      { family: 'disagreement_axis', p95Seconds: 5 },
      { family: 'misunderstanding_repair', p95Seconds: 5 },
      { family: 'evidence_source_chain', p95Seconds: 7.6 },
      { family: 'argument_scheme', p95Seconds: 5 },
      { family: 'critical_question', p95Seconds: 5 },
    ];
    const perFamily = aggregatePerFamily([
      { family: 'parent_relation', family_seconds: 6 },
      { family: 'critical_question', family_seconds: 5 },
    ]);
    const wallClock = computeWallClockSamples([
      { wall_clock_background_seconds: 30.44 },
      { wall_clock_background_seconds: 27.98 },
    ]);
    const projection = projectWallClockForFamilyCounts(
      measured,
      wallClock.p95 as number,
      [7, 8, 9, 10],
    );
    return {
      generatedAt: '2026-05-28T00:00:00.000Z',
      sampleLimit: 5,
      sectionsData: {
        'q16-per-family-duration': [
          {
            argument_id: 'arg1',
            family: 'parent_relation',
            family_seconds: 6,
            started_at: 't0',
            completed_at: 't1',
          },
        ],
        'q17-wall-clock-per-argument': [
          {
            argument_id: 'arg1',
            family_runs: 6,
            wall_clock_background_seconds: 30.44,
            sum_of_per_family_seconds: 28.73,
          },
        ],
      },
      perFamily,
      wallClock,
      classification: classifyLatencyBudget(wallClock.p95 as number, false),
      projection,
    };
  }

  it('stitchLatencyMarkdown body carries ZERO banned tokens', () => {
    const md = stitchLatencyMarkdown(buildFullModel());
    // Exclude the meta-description footer that names the policy.
    const body = md.split('## Doctrine scan')[0];
    const hits = scanMarkdownForBannedTokens(body);
    expect(hits).toEqual([]);
  });

  it('explicitly contains none of the verdict/quality tokens', () => {
    const md = stitchLatencyMarkdown(buildFullModel())
      .split('## Doctrine scan')[0]
      .toLowerCase();
    for (const banned of [
      'winner',
      'loser',
      'correct',
      'incorrect',
      'liar',
      'dishonest',
      'bad faith',
      'manipulative',
      'extremist',
      'propagandist',
      'fallacy',
    ]) {
      expect(md).not.toContain(banned);
    }
  });

  it('the markdown BODY carries NO body / evidence_span field', () => {
    // Scope to the body before the "## Doctrine scan" meta-footer (the same
    // boundary the CLI uses for its ban-list scan). The footer legitimately
    // names the policy ("no argument body / evidence_span field"); the body
    // itself must never surface either field.
    const md = stitchLatencyMarkdown(buildFullModel())
      .split('## Doctrine scan')[0]
      .toLowerCase();
    expect(md).not.toContain('evidence_span');
    expect(md).not.toContain('| body ');
    expect(md).not.toContain('body:');
  });

  it('LATENCY_SECTIONS column sets exclude any body-ish key', () => {
    for (const section of LATENCY_SECTIONS) {
      for (const col of section.columns) {
        expect(col).not.toMatch(/body|evidence_span/i);
      }
    }
  });

  it('renders the G under/over-budget verdict line mechanically from the projection', () => {
    const md = stitchLatencyMarkdown(buildFullModel());
    expect(md).toContain('G (7th family) is projected');
    // worked-example fixture -> G UNDER, FAIL crosses at N=9.
    expect(md).toContain('UNDER the 45s FAIL budget');
    expect(md).toContain('FAIL line is crossed at N=9');
  });

  it('buildLatencyJson carries the frozen schemaVersion + binding clock', () => {
    const json = buildLatencyJson(buildFullModel());
    expect(json.schemaVersion).toBe('ops-mcp-latency.report.v1');
    expect(json.bindingClock).toBe('wall_clock_background');
    expect(json.thresholds).toEqual({ warnSeconds: 30, failSeconds: 45 });
  });

  it('an empty model renders an indeterminate classification (NOT PASS) and a no-projection note', () => {
    const md = stitchLatencyMarkdown({
      generatedAt: 'x',
      perFamily: [],
      wallClock: computeWallClockSamples([]),
      classification: 'indeterminate (no samples)',
      projection: null,
      sectionsData: {},
    });
    expect(md).toContain('indeterminate (no samples)');
    expect(md).not.toContain('Classification:** PASS');
    expect(md).toContain('Projection not available');
  });
});

/* ============================================================ */
/* 6. Purity / safety on the lib source                         */
/* ============================================================ */

describe('OPS-MCP-LATENCY-BUDGET — pure-helper discipline', () => {
  it('lib source is pure: no spawnSync / child_process / http / https / node-fetch / global.fetch', () => {
    // The SQL runner lives in the observability lib (re-exported here by
    // require); this lib's own source stays network-free. Pattern: the
    // audit-lint-lib purity test.
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).not.toContain('spawnSync');
    expect(src).not.toContain('node:child_process');
    expect(src).not.toContain("require('node:http')");
    expect(src).not.toContain("require('node:https')");
    expect(src).not.toContain("require('node-fetch')");
    expect(src).not.toContain('global.fetch');
  });

  it('lib source reuses the observability lib by require (no copy) and carries no key literal', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).toContain("require('./mcp-observability-report-lib.cjs')");
    expect(src).not.toContain('SERVICE_ROLE');
    expect(src).not.toContain('ANTHROPIC_API_KEY');
  });

  it('entry .mjs delegates via createRequire and writes only under out/ops-latency', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src).toContain('createRequire');
    expect(src).toContain('mcp-latency-report-lib.cjs');
    expect(src).toContain("'ops-latency'");
  });
});
