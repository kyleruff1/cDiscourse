/**
 * OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — card-scoped SQL + manifest
 * safety tests.
 *
 * Verifies the binding shape of the 5-family observability update
 * (Family G resolution_progress data-coverage catch-up):
 *   - Group A: Q11 narrative regression (file header gains G bullet;
 *     SQL body byte-equal; SECTIONS question mentions
 *     resolution_progress).
 *   - Group B: Q14 CASE regression (file header table gains
 *     resolution_progress=18 row + CASE expression gains the branch
 *     `when 'resolution_progress' then 18`; A/B/C/D branches preserved;
 *     SECTIONS question reflects the 5-family Subset state).
 *   - Group C: Q16 new file + Family G subset coverage (header
 *     documents the 18-vs-30 distinction; verbatim 18-key Subset list
 *     + verbatim 12-key deterministic-excluded list; 3-bucket
 *     subset_membership classification; leak-first ORDER BY; doctrine
 *     note that Family G's concession / synthesis / settlement keys
 *     are SCORING REPAIRS).
 *   - Group D: cross-section invariants (SECTIONS length 17; ordered
 *     id list q01..q16; Q11/Q14/Q16 each reference Family G; Q16
 *     columns mirror Q15's 5-column shape).
 *   - Group E: fixture compatibility (q16 key present in both
 *     fixtures; Q15 fixture rows byte-equal — D card preservation;
 *     runner stitcher consumes the new fixture cleanly).
 *   - Group F (optional doctrine self-check): Q16 SQL has no
 *     G-extended verdict-adjacency banned phrases (won, lost, winner,
 *     loser, defeated, prevailed, capitulated, ahead, behind,
 *     "settled in favor") in executable SQL after comment strip.
 *
 * Pattern: pure Jest, fs.readFileSync, regex / substring assertions;
 * no live DB call (live DB sanity check lives in the post-merge
 * smoke audit, not here).
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md §8.
 * Predecessor pattern: __tests__/opsMcpObservabilityFamilyDCoverage.test.ts.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  FIXTURE_EDGE_REGISTRY,
  FIXTURE_EMPTY_SECTIONS_DATA,
  FIXTURE_GENERATED_AT,
  FIXTURE_SECTIONS_DATA,
  FIXTURE_SOURCE_SIX_CHECK,
} from './fixtures/opsMcpObservabilityFixture';

const REPO = process.cwd();
const SQL_DIR = path.join(REPO, 'scripts', 'ops', 'sql');
const Q11_PATH = path.join(SQL_DIR, '11-per-family-per-mode-coverage.sql');
const Q14_PATH = path.join(SQL_DIR, '14-per-family-per-mode-signal-density.sql');
const Q16_PATH = path.join(SQL_DIR, '16-family-g-subset-coverage.sql');

function readFile(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function stripSqlComments(src: string): string {
  // Mirror of opsMcpObservabilitySqlSafety.test.ts helper. Strips
  // `-- line comments` and `/* block */` comments so executable-SQL
  // scans do not trip on commentary.
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '-' && next === '-') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const BANNED_TOKENS = [
  'winner',
  'loser',
  'fallacy',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'liar',
  'dishonest',
  'correct',
  'incorrect',
];

// G-specific verdict-adjacency extended banned phrases per
// familyGKeys.ts:66-79 doctrine anchor. Family G's domain
// (concession / synthesis / settlement) carries the highest
// verdict-adjacency risk in the taxonomy — these phrases sit one
// semantic step from "who won / lost". They are forbidden from
// appearing in executable SQL (the `-- comment` regions may quote
// them as doctrine notes; the comment-stripped scan checks only
// executable SQL).
const G_VERDICT_ADJACENCY_BANNED_PHRASES = [
  'won',
  'lost',
  'winner',
  'loser',
  'defeated',
  'prevailed',
  'capitulated',
  'ahead',
  'behind',
  'settled in favor',
];

// 21-key ai_classifier Subset (FAMILY_G_RAW_KEYS at
// mcp-server/lib/familyGKeys.ts:99-118; 18 baseline + 3 MCP-BUILD2g) in
// declaration order.
const FAMILY_G_SUBSET_KEYS = [
  'narrows_claim',
  'concedes_narrow_point',
  'ready_for_synthesis',
  'suggests_side_branch',
  'suggests_diagonal_tangent',
  'accepts_partial_with_caveat',
  'concedes_with_new_dispute',
  'proposes_settlement_terms',
  'accepts_settlement_terms',
  'concedes_broader_point',
  'common_ground_identified',
  'unresolved_point_isolated',
  'synthesis_proposed',
  'move_on_requested',
  'issue_closed_by_participant',
  'decision_criterion_proposed',
  'action_item_proposed',
  'followup_question_proposed',
  // MCP-BUILD2g (Build-2 manifest §6) — Subset 18 → 21.
  'records_remaining_disagreement',
  'defines_next_evidence_needed',
  'separates_normative_from_empirical',
];

// 12 deterministic-excluded unique strings
// (FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS at
// mcp-server/lib/familyGKeys.ts:136-151). 5 auto_metadata + 7
// lifecycle.
const FAMILY_G_EXCLUDED_DETERMINISTIC_KEYS = [
  // auto_metadata (5)
  'branch_suggested',
  'branch_created',
  'point_stalled',
  'point_exhausted',
  'synthesis_candidate',
  // lifecycle (7)
  'narrowed',
  'conceded',
  'confirmed',
  'synthesis_ready',
  'exhausted',
  'branch_recommended',
  'archived_or_resolved',
];

/* ------------------------------------------------------------------ */
/* Group A — Q11 narrative regression                                  */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — Group A: Q11 narrative regression', () => {
  it('Q11 SQL header references resolution_progress and 18-key Subset', () => {
    const src = readFile(Q11_PATH);
    expect(src).toContain('resolution_progress');
    expect(src).toContain('18-key ai_classifier Subset');
  });

  it('Q11 SQL body is byte-equal (no new SELECT columns, no new filters)', () => {
    const src = readFile(Q11_PATH);
    const stripped = stripSqlComments(src);
    // The 6-column report-parser contract is unchanged.
    const expectedColumns = [
      'run_count',
      'success_count',
      'failed_count',
      'fallback_count',
    ];
    for (const name of expectedColumns) {
      const re = new RegExp('\\bas\\s+' + name + '\\b', 'i');
      expect(re.test(stripped)).toBe(true);
    }
    // requested_family + run_mode are bare SELECT columns.
    expect(/\brequested_family\b/i.test(stripped)).toBe(true);
    expect(/\brun_mode\b/i.test(stripped)).toBe(true);
    // The family-agnostic attribution path is preserved.
    expect(/unnest\s*\(\s*requested_families\s*\)/i.test(stripped)).toBe(true);
    // No new column aliases beyond the D set (e.g., no
    // family_key_count or subset_membership which belong to Q14/Q16).
    expect(/\bas\s+family_key_count\b/i.test(stripped)).toBe(false);
    expect(/\bas\s+subset_membership\b/i.test(stripped)).toBe(false);
  });

  it('Q11 SECTIONS question text mentions resolution_progress', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q11 = (lib.SECTIONS as Array<{ id: string; question: string }>).find(
      (s) => s.id === 'q11-per-family-per-mode-coverage',
    );
    expect(q11).toBeDefined();
    expect(q11?.question).toContain('resolution_progress');
  });

  it('Q11 SQL still has no verdict tokens after narrative update', () => {
    const src = readFile(Q11_PATH);
    const lower = src.toLowerCase();
    for (const tok of BANNED_TOKENS) {
      expect(lower.includes(tok)).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Group B — Q14 CASE regression                                       */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — Group B: Q14 CASE regression', () => {
  it('Q14 SQL hardcoded CASE includes the 5 family constants verbatim (A=19, B=17, C=20, D=22, G=21)', () => {
    const src = readFile(Q14_PATH);
    const stripped = stripSqlComments(src);
    // MCP-BUILD2b: parent_relation 16 → 19 (+3 parent-relation quality booleans).
    expect(stripped).toContain("when 'parent_relation' then 19");
    // MCP-BUILD2a: disagreement_axis 14 → 17 (+3 disagreement-quality booleans).
    expect(stripped).toContain("when 'disagreement_axis' then 17");
    // MCP-BUILD2c: misunderstanding_repair 17 → 20 (+3 repair-quality booleans).
    expect(stripped).toContain("when 'misunderstanding_repair' then 20");
    // MCP-BUILD2d: evidence_source_chain Subset 19 → 22 (+3 evidence-dynamic booleans).
    expect(stripped).toContain("when 'evidence_source_chain' then 22");
    // MCP-BUILD2g: resolution_progress Subset 18 → 21 (+3 resolution-progress bookkeeping booleans; batched 16+5).
    expect(stripped).toContain("when 'resolution_progress' then 21");
    // Unsupported families fall through to 0 (else branch).
    expect(/else\s+0/i.test(stripped)).toBe(true);
  });

  it('Q14 SQL header references the 21 family_key_count constant with familyGKeys.ts citation', () => {
    const src = readFile(Q14_PATH);
    expect(src).toContain('familyGKeys.ts');
    expect(src).toContain('21');
    // Header narrative carries the resolution_progress row.
    expect(src).toContain('resolution_progress');
    // Header still cites the original 4 families (A/B/C/D).
    expect(src).toContain('familyAKeys.ts');
    expect(src).toContain('familyBKeys.ts');
    expect(src).toContain('familyCKeys.ts');
    expect(src).toContain('familyDKeys.ts');
  });

  it('Q14 SECTIONS question text reflects the 5-family Subset state', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q14 = (lib.SECTIONS as Array<{ id: string; question: string }>).find(
      (s) => s.id === 'q14-per-family-per-mode-signal-density',
    );
    expect(q14).toBeDefined();
    // Stable canary: the comma-letter roster entry `, G` (per
    // OPS-MCP-OBSERVABILITY-FAMILY-HI-COVERAGE §HI-5 R2). The count word
    // shifts as E/F/H/I backfill cards ship (five → eight → nine), so
    // asserting the count word is fragile; the family-letter enumeration
    // entry for G is stable across those cards.
    expect(q14?.question).toContain(', G');
  });
});

/* ------------------------------------------------------------------ */
/* Group C — Q16 new file + Family G subset coverage                   */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — Group C: Q16 Family G subset coverage', () => {
  it('Q16 SQL file exists at scripts/ops/sql/16-family-g-subset-coverage.sql', () => {
    expect(fs.existsSync(Q16_PATH)).toBe(true);
  });

  it('Q16 SQL header documents the 21-vs-33 distinction explicitly (was 18-vs-30 pre MCP-BUILD2g)', () => {
    const src = readFile(Q16_PATH);
    const lower = src.toLowerCase();
    // Current state after MCP-BUILD2g: 21-key Subset of 33 total.
    expect(lower).toContain('21');
    expect(lower).toContain('33');
    // Historical 18-vs-30 baseline still referenced in the header narrative.
    expect(lower).toContain('18');
    expect(lower).toContain('30');
    expect(lower).toContain('ai_classifier');
    expect(lower).toContain('subset');
  });

  it('Q16 SQL header cites mcp-server/lib/familyGKeys.ts at lines 99-118 and 136-151', () => {
    const src = readFile(Q16_PATH);
    expect(src).toContain('familyGKeys.ts:99-118');
    expect(src).toContain('familyGKeys.ts:136-151');
  });

  // Group C subset-rawKey verbatim assertion: a single test iterates
  // the 18-key Subset internally per design §8 (consolidation option
  // to land near the +40 ceiling). The failure message identifies the
  // missing key.
  it('Q16 SQL contains every Subset rawKey from FAMILY_G_RAW_KEYS verbatim', () => {
    const src = readFile(Q16_PATH);
    const missing: string[] = [];
    for (const key of FAMILY_G_SUBSET_KEYS) {
      const re = new RegExp("'" + key + "'\\s*[,)]");
      if (!re.test(src)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it('Q16 SQL contains every deterministic-excluded rawKey from FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS verbatim', () => {
    const src = readFile(Q16_PATH);
    const missing: string[] = [];
    for (const key of FAMILY_G_EXCLUDED_DETERMINISTIC_KEYS) {
      const re = new RegExp("'" + key + "'\\s*[,)]");
      if (!re.test(src)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it('Q16 SQL classifies via subset_membership column with the three expected values', () => {
    const src = readFile(Q16_PATH);
    expect(src).toContain("'ai_classifier_subset'");
    expect(src).toContain("'deterministic_excluded_leak'");
    expect(src).toContain("'unknown_key_outside_taxonomy'");
  });

  it('Q16 SQL preserves the 5-column report-parser contract', () => {
    const src = readFile(Q16_PATH);
    const stripped = stripSqlComments(src);
    // raw_key + run_mode + positive_count + distinct_arguments +
    // subset_membership — bare-name in the final SELECT.
    const finalSelectColumns = [
      'raw_key',
      'run_mode',
      'positive_count',
      'distinct_arguments',
      'subset_membership',
    ];
    for (const name of finalSelectColumns) {
      const re = new RegExp('\\b' + name + '\\b', 'i');
      expect(re.test(stripped)).toBe(true);
    }
  });

  it("Q16 SQL filters on family = 'resolution_progress'", () => {
    const src = readFile(Q16_PATH);
    const stripped = stripSqlComments(src);
    expect(/where\s+res\.family\s*=\s*'resolution_progress'/i.test(stripped)).toBe(true);
  });

  it('Q16 SQL has no verdict tokens (case-insensitive)', () => {
    const src = readFile(Q16_PATH);
    const lower = src.toLowerCase();
    for (const tok of BANNED_TOKENS) {
      expect(lower.includes(tok)).toBe(false);
    }
  });

  it('Q16 ordering prioritizes deterministic_excluded_leak first', () => {
    const src = readFile(Q16_PATH);
    const stripped = stripSqlComments(src);
    // The defensive ordering: ORDER BY CASE block sorts leaks at
    // priority 1, unknown at 2, subset at 3.
    expect(
      /case\s+subset_membership[\s\S]*when\s+'deterministic_excluded_leak'\s+then\s+1/i.test(stripped),
    ).toBe(true);
    expect(/when\s+'unknown_key_outside_taxonomy'\s+then\s+2/i.test(stripped)).toBe(true);
    expect(/when\s+'ai_classifier_subset'\s+then\s+3/i.test(stripped)).toBe(true);
  });

  it('lib SECTIONS contains q16-family-g-subset-coverage with the 5 expected columns', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q16 = (lib.SECTIONS as Array<{ id: string; columns: string[]; sqlFile: string }>).find(
      (s) => s.id === 'q16-family-g-subset-coverage',
    );
    expect(q16).toBeDefined();
    expect(q16?.columns).toEqual([
      'raw_key',
      'run_mode',
      'positive_count',
      'distinct_arguments',
      'subset_membership',
    ]);
    expect(q16?.sqlFile).toBe('16-family-g-subset-coverage.sql');
  });

  it('Q16 SQL contains a doctrine note that Family G concession / synthesis / settlement keys are SCORING REPAIRS, not verdicts', () => {
    const src = readFile(Q16_PATH);
    // The doctrine note is in the header narrative; assert the
    // load-bearing phrases are present (uppercase per
    // point-standing-economy framing).
    expect(src).toContain('SCORING REPAIR');
    expect(src).toContain('cdiscourse-doctrine §1');
    expect(src).toContain('point-standing-economy');
  });
});

/* ------------------------------------------------------------------ */
/* Group D — Cross-section invariants                                  */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — Group D: cross-section invariants', () => {
  it('SECTIONS length is now 18 (was 16 pre-card; HI-coverage appended q17)', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    expect((lib.SECTIONS as Array<unknown>).length).toBe(18);
  });

  it('SECTIONS section ids are stable, unique, and ordered (q01..q17 with q02b)', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const ids = (lib.SECTIONS as Array<{ id: string }>).map((s) => s.id);
    expect(ids).toEqual([
      'q01-runs-by-run-mode',
      'q02-runs-by-family',
      'q02b-runs-by-requested-family',
      'q03-runs-by-family-and-status',
      'q04-failure-reasons-by-family',
      'q05-positive-results-by-family',
      'q06-top-positive-raw-keys-by-family',
      'q07-positive-density-7d',
      'q08-source-six-safety',
      'q09-duplicate-runs',
      'q10-family-a-auto-trigger-recent',
      'q11-per-family-per-mode-coverage',
      'q12-unsupported-family-attempts',
      'q13-over-under-firing-summary',
      'q14-per-family-per-mode-signal-density',
      'q15-family-d-subset-coverage',
      'q16-family-g-subset-coverage',
      'q17-family-i-subset-coverage',
    ]);
    // Uniqueness check.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Q11 + Q14 + Q16 SQL headers each reference Family G operational state by name', () => {
    for (const filePath of [Q11_PATH, Q14_PATH, Q16_PATH]) {
      const src = readFile(filePath);
      expect(src).toContain('resolution_progress');
    }
  });

  it('Q16 fixture rows iterate cleanly through every SECTIONS column (no NaN / undefined / missing key)', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q16Entry = (lib.SECTIONS as Array<{ id: string; columns: string[] }>).find(
      (s) => s.id === 'q16-family-g-subset-coverage',
    );
    expect(q16Entry).toBeDefined();
    const rows = FIXTURE_SECTIONS_DATA['q16-family-g-subset-coverage'];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const col of q16Entry!.columns) {
        const value = (row as Record<string, unknown>)[col];
        expect(value).not.toBeUndefined();
        expect(value).not.toBe(null);
        if (typeof value === 'number') {
          expect(Number.isNaN(value)).toBe(false);
        }
      }
      // Every fixture row is in the healthy state (ai_classifier_subset).
      expect((row as Record<string, unknown>).subset_membership).toBe('ai_classifier_subset');
    }
  });

  it('Q16 column names do not collide with Q11/Q14 column names in a confusing way', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const sections = lib.SECTIONS as Array<{ id: string; columns: string[] }>;
    const q11Cols = new Set(
      sections.find((s) => s.id === 'q11-per-family-per-mode-coverage')!.columns,
    );
    const q14Cols = new Set(
      sections.find((s) => s.id === 'q14-per-family-per-mode-signal-density')!.columns,
    );
    const q15Cols = sections.find((s) => s.id === 'q15-family-d-subset-coverage')!.columns;
    const q16Cols = sections.find((s) => s.id === 'q16-family-g-subset-coverage')!.columns;
    // family_key_count + positives_per_run_key_cell are unique to Q14.
    expect(q11Cols.has('family_key_count')).toBe(false);
    expect(q11Cols.has('positives_per_run_key_cell')).toBe(false);
    expect(q16Cols.includes('family_key_count')).toBe(false);
    expect(q16Cols.includes('positives_per_run_key_cell')).toBe(false);
    // subset_membership is shared with Q15 (both subset-coverage
    // queries) and absent from Q11/Q14.
    expect(q11Cols.has('subset_membership')).toBe(false);
    expect(q14Cols.has('subset_membership')).toBe(false);
    expect(q16Cols.includes('subset_membership')).toBe(true);
    // Q16 mirrors Q15's 5-column shape perfectly.
    expect(q16Cols).toEqual(q15Cols);
  });
});

/* ------------------------------------------------------------------ */
/* Group E — Fixture compatibility                                     */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — Group E: fixture compatibility', () => {
  it('fixture has q16-family-g-subset-coverage key with at least 1 row', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_SECTIONS_DATA,
        'q16-family-g-subset-coverage',
      ),
    ).toBe(true);
    const rows = FIXTURE_SECTIONS_DATA['q16-family-g-subset-coverage'];
    expect(rows.length).toBeGreaterThan(0);
  });

  it('fixture empty-sections data has the q16 key with empty array', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_EMPTY_SECTIONS_DATA,
        'q16-family-g-subset-coverage',
      ),
    ).toBe(true);
    const rows = FIXTURE_EMPTY_SECTIONS_DATA['q16-family-g-subset-coverage'];
    expect(rows.length).toBe(0);
  });

  it('fixture q15-family-d-subset-coverage rows are byte-equal (no regression in D fixture)', () => {
    // The D fixture is locked per design §12 read-only boundary list
    // and Group E test #26 (this assertion). Asserting (a) the 2 rows
    // exist, (b) the binding raw_key + subset_membership values are
    // unchanged, and (c) no row has subset_membership !=
    // 'ai_classifier_subset' (a leak / unknown row would be a
    // regression).
    const rows = FIXTURE_SECTIONS_DATA['q15-family-d-subset-coverage'];
    expect(rows.length).toBe(2);
    const evidenceGap = rows.find(
      (r) => r.raw_key === 'evidence_gap_present',
    );
    const evidenceDebt = rows.find(
      (r) => r.raw_key === 'opens_evidence_debt_marker',
    );
    expect(evidenceGap).toBeDefined();
    expect(evidenceDebt).toBeDefined();
    expect(evidenceGap?.subset_membership).toBe('ai_classifier_subset');
    expect(evidenceDebt?.subset_membership).toBe('ai_classifier_subset');
    for (const r of rows) {
      expect(r.subset_membership).toBe('ai_classifier_subset');
    }
  });

  it('runner stitcher consumes the new fixture cleanly (no NaN / undefined; Q16 section renders title + rows)', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const md: string = lib.stitchMarkdownReport({
      sectionsData: FIXTURE_SECTIONS_DATA,
      sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
      edgeRegistry: FIXTURE_EDGE_REGISTRY,
      generatedAt: FIXTURE_GENERATED_AT,
      defaultTimeWindowDays: 7,
      includeEvidencePreview: false,
    });
    expect(typeof md).toBe('string');
    expect(md.length).toBeGreaterThan(100);
    expect(md).not.toMatch(/\bNaN\b/);
    expect(md).not.toContain('undefined');
    // The Q16 section renders with its title.
    expect(md).toContain('## Family G 21-key subset coverage');
  });

  it('runner JSON artifact has 18 sections including q16-family-g-subset-coverage', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const json = lib.buildJsonArtifact({
      sectionsData: FIXTURE_SECTIONS_DATA,
      sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
      edgeRegistry: FIXTURE_EDGE_REGISTRY,
      generatedAt: FIXTURE_GENERATED_AT,
      defaultTimeWindowDays: 7,
    });
    expect(json.sections).toHaveLength(18);
    const q16 = json.sections.find(
      (s: { id: string }) => s.id === 'q16-family-g-subset-coverage',
    );
    expect(q16).toBeDefined();
    expect(q16?.rows.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Group F — G verdict-adjacency doctrine self-check (optional)        */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE — Group F: G verdict-adjacency doctrine', () => {
  it('Q16 SQL does NOT contain any of the G verdict-adjacency banned phrases in executable SQL (after comment strip)', () => {
    const src = readFile(Q16_PATH);
    const stripped = stripSqlComments(src).toLowerCase();
    for (const phrase of G_VERDICT_ADJACENCY_BANNED_PHRASES) {
      expect(stripped.includes(phrase)).toBe(false);
    }
  });
});
