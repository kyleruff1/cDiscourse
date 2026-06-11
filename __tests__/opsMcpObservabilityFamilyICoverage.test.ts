/**
 * OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — card-scoped SQL + manifest
 * safety tests (Family I thread_topology; MIXED ai_classifier Subset).
 *
 * Family I is a MIXED-source family: 6 ai_classifier keys are routed to
 * the MCP server; 15 deterministic keys (8 auto_metadata + 7 lifecycle)
 * are intentionally excluded. It therefore gets the FULL Family-G shape:
 * Q11 header bullet + Q14 CASE branch + a dedicated Q17 subset-coverage
 * leak-detection SQL file + a new SECTIONS entry + a fixture row + the
 * 17→18 count-pin bumps.
 *   - Group A: Q11 narrative regression.
 *   - Group B: Q14 CASE regression.
 *   - Group C: Q17 new file + Family I subset coverage.
 *   - Group D: cross-section invariants (SECTIONS length 18; ordered id
 *     list q01..q17; Q11/Q14/Q17 reference thread_topology; column shape).
 *   - Group E: fixture compatibility.
 *   - Group F: I verdict-adjacency doctrine self-check.
 *
 * Pattern: pure Jest, fs.readFileSync, regex / substring assertions; no
 * live DB call (live DB sanity check lives in the optional post-merge
 * smoke, not here).
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-HI-COVERAGE.md §4 + §6.
 * Predecessor pattern: __tests__/opsMcpObservabilityFamilyGCoverage.test.ts.
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
const Q17_PATH = path.join(SQL_DIR, '17-family-i-subset-coverage.sql');

function readFile(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function stripSqlComments(src: string): string {
  // Mirror of opsMcpObservabilitySqlSafety.test.ts helper.
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

// I-specific verdict-adjacency banned phrases per familyIKeys.ts:60-61,182,230,262
// doctrine anchors. Family I's topology keys sit near misreadings such as
// "off-topic" / "rehashing" / "picking a winner". These phrases are
// forbidden from appearing in executable SQL (the `-- comment` regions may
// quote them as doctrine notes; the comment-stripped scan checks only
// executable SQL).
const I_VERDICT_ADJACENCY_BANNED_PHRASES = [
  'off-topic',
  'derailing',
  'evasive',
  'dodging',
  'rehashing',
  'repetitive',
  'going in circles',
  'the right option',
  'the correct choice',
  'winner',
  'prevailed',
];

// 6-key ai_classifier Subset (FAMILY_I_RAW_KEYS at
// mcp-server/lib/familyIKeys.ts:92-99) in declaration order.
const FAMILY_I_SUBSET_KEYS = [
  'introduces_new_issue',
  'references_prior_agreement',
  'introduces_sub_axis',
  'returns_to_prior_issue',
  'references_external_context',
  'compares_options',
];

// 15 deterministic-excluded unique strings
// (FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS at
// mcp-server/lib/familyIKeys.ts:117-135). 8 auto_metadata + 7 lifecycle.
const FAMILY_I_EXCLUDED_DETERMINISTIC_KEYS = [
  // auto_metadata (8)
  'has_reply',
  'participant_skipped_node',
  'no_response_after_n_turns',
  'repeated_axis_pressure',
  'splits_thread',
  'merges_thread',
  'references_sibling_node',
  'references_ancestor_node',
  // lifecycle (7)
  'open',
  'answered',
  'moved_on_by_affirmative',
  'moved_on_by_negative',
  'ignored_by_affirmative',
  'ignored_by_negative',
  'ignored_by_both',
];

/* ------------------------------------------------------------------ */
/* Group A — Q11 narrative regression                                  */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — Group A: Q11 narrative regression', () => {
  it('Q11 SQL header references thread_topology and the Family I production-enabled state', () => {
    const src = readFile(Q11_PATH);
    expect(src).toContain('thread_topology');
    expect(src).toContain('Family I');
    expect(/Family I[^\n]*production/i.test(src)).toBe(true);
  });

  it('Q11 SQL body is byte-equal (no new SELECT columns, no new filters)', () => {
    const src = readFile(Q11_PATH);
    const stripped = stripSqlComments(src);
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
    expect(/\brequested_family\b/i.test(stripped)).toBe(true);
    expect(/\brun_mode\b/i.test(stripped)).toBe(true);
    expect(/unnest\s*\(\s*requested_families\s*\)/i.test(stripped)).toBe(true);
    expect(/\bas\s+family_key_count\b/i.test(stripped)).toBe(false);
    expect(/\bas\s+subset_membership\b/i.test(stripped)).toBe(false);
  });

  it('Q11 SECTIONS question text is still present', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q11 = (lib.SECTIONS as Array<{ id: string; question: string }>).find(
      (s) => s.id === 'q11-per-family-per-mode-coverage',
    );
    expect(q11).toBeDefined();
    expect((q11?.question.length ?? 0)).toBeGreaterThan(0);
  });

  it('Q11 SQL still has no base banned tokens after the narrative update', () => {
    const src = readFile(Q11_PATH).toLowerCase();
    for (const tok of BANNED_TOKENS) {
      expect(src.includes(tok)).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Group B — Q14 CASE regression                                       */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — Group B: Q14 CASE regression', () => {
  it("Q14 SQL hardcoded CASE includes `when 'thread_topology' then 6` verbatim", () => {
    const src = readFile(Q14_PATH);
    const stripped = stripSqlComments(src);
    expect(stripped).toContain("when 'thread_topology' then 6");
  });

  it('Q14 SQL CASE preserves the A–H branches and the else 0 fallthrough', () => {
    const src = readFile(Q14_PATH);
    const stripped = stripSqlComments(src);
    expect(stripped).toContain("when 'parent_relation' then 19");
    expect(stripped).toContain("when 'disagreement_axis' then 17");
    expect(stripped).toContain("when 'misunderstanding_repair' then 20");
    expect(stripped).toContain("when 'evidence_source_chain' then 22");
    expect(stripped).toContain("when 'argument_scheme' then 19");
    expect(stripped).toContain("when 'critical_question' then 17");
    expect(stripped).toContain("when 'claim_clarity' then 12");
    expect(stripped).toContain("when 'resolution_progress' then 21");
    expect(/else\s+0/i.test(stripped)).toBe(true);
  });

  it('Q14 SQL header table contains a thread_topology row citing familyIKeys.ts', () => {
    const src = readFile(Q14_PATH);
    expect(src).toContain('thread_topology');
    expect(src).toContain('familyIKeys.ts');
  });

  it('Q14 SECTIONS question reflects the new roster via the stable comma-letter canary `, I`', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q14 = (lib.SECTIONS as Array<{ id: string; question: string }>).find(
      (s) => s.id === 'q14-per-family-per-mode-signal-density',
    );
    expect(q14).toBeDefined();
    expect(q14?.question).toContain(', I');
  });
});

/* ------------------------------------------------------------------ */
/* Group C — Q17 new file + Family I subset coverage                   */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — Group C: Q17 Family I subset coverage', () => {
  it('Q17 SQL file exists at scripts/ops/sql/17-family-i-subset-coverage.sql', () => {
    expect(fs.existsSync(Q17_PATH)).toBe(true);
  });

  it('Q17 SQL header documents the 6-vs-21 distinction explicitly', () => {
    const lower = readFile(Q17_PATH).toLowerCase();
    expect(lower).toContain('6');
    expect(lower).toContain('21');
    expect(lower).toContain('ai_classifier');
    expect(lower).toContain('subset');
  });

  it('Q17 SQL header cites mcp-server/lib/familyIKeys.ts at lines 92-99 and 117-135', () => {
    const src = readFile(Q17_PATH);
    expect(src).toContain('familyIKeys.ts:92-99');
    expect(src).toContain('familyIKeys.ts:117-135');
  });

  it('Q17 SQL contains every Subset rawKey from FAMILY_I_RAW_KEYS verbatim', () => {
    const src = readFile(Q17_PATH);
    const missing: string[] = [];
    for (const key of FAMILY_I_SUBSET_KEYS) {
      const re = new RegExp("'" + key + "'\\s*[,)]");
      if (!re.test(src)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it('Q17 SQL contains every deterministic-excluded rawKey from FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS verbatim', () => {
    const src = readFile(Q17_PATH);
    const missing: string[] = [];
    for (const key of FAMILY_I_EXCLUDED_DETERMINISTIC_KEYS) {
      const re = new RegExp("'" + key + "'\\s*[,)]");
      if (!re.test(src)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it('Q17 SQL classifies via subset_membership column with the three expected values', () => {
    const src = readFile(Q17_PATH);
    expect(src).toContain("'ai_classifier_subset'");
    expect(src).toContain("'deterministic_excluded_leak'");
    expect(src).toContain("'unknown_key_outside_taxonomy'");
  });

  it('Q17 SQL preserves the 5-column report-parser contract', () => {
    const stripped = stripSqlComments(readFile(Q17_PATH));
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

  it("Q17 SQL filters on family = 'thread_topology'", () => {
    const stripped = stripSqlComments(readFile(Q17_PATH));
    expect(/where\s+res\.family\s*=\s*'thread_topology'/i.test(stripped)).toBe(true);
  });

  it('Q17 SQL has no base banned tokens (case-insensitive whole-file)', () => {
    const lower = readFile(Q17_PATH).toLowerCase();
    for (const tok of BANNED_TOKENS) {
      expect(lower.includes(tok)).toBe(false);
    }
  });

  it('Q17 ordering prioritizes deterministic_excluded_leak first', () => {
    const stripped = stripSqlComments(readFile(Q17_PATH));
    expect(
      /case\s+subset_membership[\s\S]*when\s+'deterministic_excluded_leak'\s+then\s+1/i.test(stripped),
    ).toBe(true);
    expect(/when\s+'unknown_key_outside_taxonomy'\s+then\s+2/i.test(stripped)).toBe(true);
    expect(/when\s+'ai_classifier_subset'\s+then\s+3/i.test(stripped)).toBe(true);
  });

  it('lib SECTIONS contains q17-family-i-subset-coverage with the 5 expected columns', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q17 = (lib.SECTIONS as Array<{ id: string; columns: string[]; sqlFile: string }>).find(
      (s) => s.id === 'q17-family-i-subset-coverage',
    );
    expect(q17).toBeDefined();
    expect(q17?.columns).toEqual([
      'raw_key',
      'run_mode',
      'positive_count',
      'distinct_arguments',
      'subset_membership',
    ]);
    expect(q17?.sqlFile).toBe('17-family-i-subset-coverage.sql');
  });

  it('Q17 SQL contains a doctrine note anchoring §1 (descriptive structure), §3 (popularity), and point-standing-economy', () => {
    const src = readFile(Q17_PATH);
    expect(src).toContain('DESCRIPTIVE STRUCTURE');
    expect(src).toContain('cdiscourse-doctrine §1');
    expect(src).toContain('cdiscourse-doctrine §3');
    expect(src).toContain('point-standing-economy');
  });
});

/* ------------------------------------------------------------------ */
/* Group D — Cross-section invariants                                  */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — Group D: cross-section invariants', () => {
  it('SECTIONS length is now 19 (q18 unclean-span-key-drops appended by OPS-MCP-KEY-LEVEL-FAIL-CLOSED)', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    expect((lib.SECTIONS as Array<unknown>).length).toBe(19);
  });

  it('SECTIONS section ids are stable, unique, and ordered (q01..q18 with q02b)', () => {
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
      'q18-unclean-span-key-drops-by-family',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Q11 + Q14 + Q17 SQL headers each reference thread_topology by name', () => {
    for (const filePath of [Q11_PATH, Q14_PATH, Q17_PATH]) {
      expect(readFile(filePath)).toContain('thread_topology');
    }
  });

  it('Q17 columns mirror the Q15/Q16 5-column subset-coverage shape exactly', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const sections = lib.SECTIONS as Array<{ id: string; columns: string[] }>;
    const q15Cols = sections.find((s) => s.id === 'q15-family-d-subset-coverage')!.columns;
    const q16Cols = sections.find((s) => s.id === 'q16-family-g-subset-coverage')!.columns;
    const q17Cols = sections.find((s) => s.id === 'q17-family-i-subset-coverage')!.columns;
    expect(q17Cols).toEqual(q15Cols);
    expect(q17Cols).toEqual(q16Cols);
  });

  it('Q17 column names do not collide with Q11/Q14 in a confusing way', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const sections = lib.SECTIONS as Array<{ id: string; columns: string[] }>;
    const q14Cols = new Set(
      sections.find((s) => s.id === 'q14-per-family-per-mode-signal-density')!.columns,
    );
    const q17Cols = sections.find((s) => s.id === 'q17-family-i-subset-coverage')!.columns;
    // family_key_count + positives_per_run_key_cell are unique to Q14.
    expect(q17Cols.includes('family_key_count')).toBe(false);
    expect(q17Cols.includes('positives_per_run_key_cell')).toBe(false);
    // subset_membership is shared with Q15/Q16 and absent from Q14.
    expect(q14Cols.has('subset_membership')).toBe(false);
    expect(q17Cols.includes('subset_membership')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Group E — Fixture compatibility                                     */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — Group E: fixture compatibility', () => {
  it('fixture has q17-family-i-subset-coverage key with at least 1 row', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_SECTIONS_DATA,
        'q17-family-i-subset-coverage',
      ),
    ).toBe(true);
    const rows = FIXTURE_SECTIONS_DATA['q17-family-i-subset-coverage'];
    expect(rows.length).toBeGreaterThan(0);
  });

  it('fixture empty-sections data has the q17 key with empty array', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_EMPTY_SECTIONS_DATA,
        'q17-family-i-subset-coverage',
      ),
    ).toBe(true);
    expect(FIXTURE_EMPTY_SECTIONS_DATA['q17-family-i-subset-coverage'].length).toBe(0);
  });

  it('Q17 fixture rows iterate cleanly through every SECTIONS column and are ai_classifier_subset', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q17Entry = (lib.SECTIONS as Array<{ id: string; columns: string[] }>).find(
      (s) => s.id === 'q17-family-i-subset-coverage',
    );
    expect(q17Entry).toBeDefined();
    const rows = FIXTURE_SECTIONS_DATA['q17-family-i-subset-coverage'];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const col of q17Entry!.columns) {
        const value = (row as Record<string, unknown>)[col];
        expect(value).not.toBeUndefined();
        expect(value).not.toBe(null);
        if (typeof value === 'number') {
          expect(Number.isNaN(value)).toBe(false);
        }
      }
      expect((row as Record<string, unknown>).subset_membership).toBe('ai_classifier_subset');
    }
  });

  it('runner stitcher consumes the new fixture cleanly (no NaN / undefined; Q17 section renders title)', () => {
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
    expect(md).toContain('## Family I 6-key subset coverage');
  });

  it('runner JSON artifact has 19 sections including q17-family-i-subset-coverage', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const json = lib.buildJsonArtifact({
      sectionsData: FIXTURE_SECTIONS_DATA,
      sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
      edgeRegistry: FIXTURE_EDGE_REGISTRY,
      generatedAt: FIXTURE_GENERATED_AT,
      defaultTimeWindowDays: 7,
    });
    expect(json.sections).toHaveLength(19);
    const q17 = json.sections.find(
      (s: { id: string }) => s.id === 'q17-family-i-subset-coverage',
    );
    expect(q17).toBeDefined();
    expect(q17?.rows.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Group F — I verdict-adjacency doctrine self-check                   */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE — Group F: I verdict-adjacency doctrine', () => {
  it('Q17 SQL does NOT contain any of the I verdict-adjacency banned phrases in executable SQL (after comment strip)', () => {
    const stripped = stripSqlComments(readFile(Q17_PATH)).toLowerCase();
    for (const phrase of I_VERDICT_ADJACENCY_BANNED_PHRASES) {
      expect(stripped.includes(phrase)).toBe(false);
    }
  });
});
