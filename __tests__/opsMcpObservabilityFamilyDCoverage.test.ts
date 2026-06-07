/**
 * OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — card-scoped SQL + manifest
 * safety tests.
 *
 * Verifies the binding shape of the 4-family observability update:
 *   - Group A: Q11 rename (file + lib SECTIONS) + new 6-column shape +
 *     unnest-attribution preserves the original B+C signal.
 *   - Group B: Q14 new file + 7-column report-parser contract + hardcoded
 *     family_key_count CASE (16/14/17/19) + nullif zero-guard + header
 *     citations to the source-of-truth family*Keys.ts files.
 *   - Group C: Q15 new file + 22-vs-30 distinction in header (post MCP-BUILD2d;
 *     was 19-vs-27) + verbatim 22-key ai_classifier Subset list + 6-key
 *     deterministic-excluded list + 3-bucket subset_membership classification
 *     + leak-first ORDER BY.
 *   - Group D: cross-section invariants (SECTIONS length 16, ordered
 *     ids, 4-family doctrine note in each new header, no banned tokens).
 *   - Group E: fixture compatibility (renamed Q11 key, new Q14/Q15
 *     keys present, runner stitcher consumes them).
 *
 * Pattern: pure Jest, fs.readFileSync, regex / substring assertions; no
 * live DB call (live DB sanity check lives in the post-merge smoke
 * audit, not here).
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §6.
 * Predecessor pattern: __tests__/opsMcpObservabilityQ12SemanticTightening.test.ts.
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
const Q11_NEW_PATH = path.join(SQL_DIR, '11-per-family-per-mode-coverage.sql');
const Q11_OLD_PATH = path.join(SQL_DIR, '11-family-bc-admin-validation-check.sql');
const Q14_PATH = path.join(SQL_DIR, '14-per-family-per-mode-signal-density.sql');
const Q15_PATH = path.join(SQL_DIR, '15-family-d-subset-coverage.sql');

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

// 22-key ai_classifier Subset (FAMILY_D_RAW_KEYS at
// mcp-server/lib/familyDKeys.ts:85-105) in declaration order (19 baseline + 3
// MCP-BUILD2d). 22 > the 20-key cap, so the Edge serves Family D in 2 batches.
const FAMILY_D_SUBSET_KEYS = [
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'creates_source_chain_gap',
  'opens_evidence_debt_marker',
  'closes_evidence_debt_marker',
  'supplies_corroborating_document',
  'source_provided',
  'quote_provided',
  'concrete_example_requested',
  'concrete_example_provided',
  'evidence_claim_present',
  'evidence_gap_present',
  'source_chain_repair',
  'anecdote_used',
  'statistic_used',
  'external_authority_used',
  'evidence_quality_questioned',
  'burden_request_present',
  // MCP-BUILD2d additions (Subset 19 → 22).
  'names_method_difference',
  'separates_observation_from_inference',
  'flags_context_limit',
];

// 6 deterministic-excluded unique strings (FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS
// at mcp-server/lib/familyDKeys.ts:119-129).
const FAMILY_D_EXCLUDED_DETERMINISTIC_KEYS = [
  'has_evidence',
  'source_requested',
  'quote_requested',
  'source_attached',
  'quote_attached',
  'sourced',
];

/* ------------------------------------------------------------------ */
/* Group A — Q11 rename + new shape                                    */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — Group A: Q11 rename + new shape', () => {
  it('renamed file exists at scripts/ops/sql/11-per-family-per-mode-coverage.sql', () => {
    expect(fs.existsSync(Q11_NEW_PATH)).toBe(true);
  });

  it('old filename scripts/ops/sql/11-family-bc-admin-validation-check.sql no longer exists', () => {
    expect(fs.existsSync(Q11_OLD_PATH)).toBe(false);
  });

  it('Q11 SQL header references OPS-MCP-OBSERVABILITY and per-family per-mode', () => {
    const src = readFile(Q11_NEW_PATH);
    const firstNonEmpty = src
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    expect(firstNonEmpty).toBeDefined();
    expect(firstNonEmpty?.startsWith('--')).toBe(true);
    expect(firstNonEmpty).toContain('OPS-MCP-OBSERVABILITY');
    expect(firstNonEmpty?.toLowerCase()).toContain('per-family per-mode');
  });

  it('Q11 SQL preserves the 6-column report-parser contract', () => {
    const src = readFile(Q11_NEW_PATH);
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
    // requested_family + run_mode are bare SELECT columns (not `as`
    // aliases) so confirm both are present in the SELECT list.
    expect(/\brequested_family\b/i.test(stripped)).toBe(true);
    expect(/\brun_mode\b/i.test(stripped)).toBe(true);
  });

  it('Q11 SQL no longer hardcodes B+C-only family filter', () => {
    const src = readFile(Q11_NEW_PATH);
    const stripped = stripSqlComments(src);
    // The pre-reframe filter must be gone.
    expect(stripped).not.toContain(
      "requested_family in ('disagreement_axis', 'misunderstanding_repair')",
    );
  });

  it('Q11 SQL uses unnest(requested_families) for family attribution', () => {
    const src = readFile(Q11_NEW_PATH);
    const stripped = stripSqlComments(src);
    expect(/unnest\s*\(\s*requested_families\s*\)/i.test(stripped)).toBe(true);
  });

  it('Q11 SQL has no verdict tokens in any line (case-insensitive)', () => {
    const src = readFile(Q11_NEW_PATH);
    const lower = src.toLowerCase();
    for (const tok of BANNED_TOKENS) {
      expect(lower.includes(tok)).toBe(false);
    }
  });

  it('lib SECTIONS contains q11-per-family-per-mode-coverage with the 6 expected columns', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q11 = (lib.SECTIONS as Array<{ id: string; columns: string[]; sqlFile: string }>).find(
      (s) => s.id === 'q11-per-family-per-mode-coverage',
    );
    expect(q11).toBeDefined();
    expect(q11?.columns).toEqual([
      'requested_family',
      'run_mode',
      'run_count',
      'success_count',
      'failed_count',
      'fallback_count',
    ]);
    expect(q11?.sqlFile).toBe('11-per-family-per-mode-coverage.sql');
  });

  it('lib SECTIONS no longer contains q11-family-bc-admin-validation-check', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const oldId = (lib.SECTIONS as Array<{ id: string }>).find(
      (s) => s.id === 'q11-family-bc-admin-validation-check',
    );
    expect(oldId).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Group B — Q14 new file + density math                              */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — Group B: Q14 density math', () => {
  it('Q14 SQL file exists at scripts/ops/sql/14-per-family-per-mode-signal-density.sql', () => {
    expect(fs.existsSync(Q14_PATH)).toBe(true);
  });

  it('Q14 SQL header references the 16/14/17/19 family_key_count constants with citations', () => {
    const src = readFile(Q14_PATH);
    expect(src).toContain('familyAKeys.ts');
    expect(src).toContain('familyBKeys.ts');
    expect(src).toContain('familyCKeys.ts');
    expect(src).toContain('familyDKeys.ts');
    // The values themselves appear in the header documentation as well.
    expect(src).toContain('16');
    expect(src).toContain('14');
    expect(src).toContain('17');
    expect(src).toContain('19');
  });

  it('Q14 SQL preserves the 7-column report-parser contract', () => {
    const src = readFile(Q14_PATH);
    const stripped = stripSqlComments(src);
    const aliasColumns = [
      'runs',
      'positives',
      'raw_keys_observed',
      'family_key_count',
      'positives_per_run_key_cell',
    ];
    for (const name of aliasColumns) {
      const re = new RegExp('\\bas\\s+' + name + '\\b', 'i');
      expect(re.test(stripped)).toBe(true);
    }
    // family + run_mode are bare in the final SELECT.
    expect(/\bfamily\b/i.test(stripped)).toBe(true);
    expect(/\brun_mode\b/i.test(stripped)).toBe(true);
  });

  it('Q14 SQL hardcoded CASE includes the 4 family constants verbatim', () => {
    const src = readFile(Q14_PATH);
    const stripped = stripSqlComments(src);
    // MCP-BUILD2b: parent_relation 16 → 19 (+3 parent-relation quality booleans).
    expect(stripped).toContain("when 'parent_relation' then 19");
    // MCP-BUILD2a: disagreement_axis 14 → 17 (+3 disagreement-quality booleans).
    expect(stripped).toContain("when 'disagreement_axis' then 17");
    // MCP-BUILD2c: misunderstanding_repair 17 → 20 (+3 repair-quality booleans).
    expect(stripped).toContain("when 'misunderstanding_repair' then 20");
    // MCP-BUILD2d: evidence_source_chain Subset 19 → 22 (+3 evidence-dynamic
    // booleans; 22 > the 20-key cap → served in 2 batches at the Edge).
    expect(stripped).toContain("when 'evidence_source_chain' then 22");
    // MCP-BUILD2e: argument_scheme 16 → 19 (+3 argument-structure booleans).
    expect(stripped).toContain("when 'argument_scheme' then 19");
    // MCP-BUILD2f: critical_question 14 → 17 (+3 question-quality booleans).
    expect(stripped).toContain("when 'critical_question' then 17");
    // Unsupported families fall through to 0 (else branch).
    expect(/else\s+0/i.test(stripped)).toBe(true);
  });

  it('Q14 SQL uses nullif over runs * family_key_count to handle zero gracefully', () => {
    const src = readFile(Q14_PATH);
    const stripped = stripSqlComments(src);
    expect(/nullif\s*\(/i.test(stripped)).toBe(true);
    // The zero-guard binding: runs * family_key_count appears inside
    // nullif. Tolerate whitespace.
    expect(/nullif\s*\(\s*runs\s*\*\s*family_key_count/i.test(stripped)).toBe(true);
  });

  it('Q14 SQL has no verdict tokens (case-insensitive)', () => {
    const src = readFile(Q14_PATH);
    const lower = src.toLowerCase();
    for (const tok of BANNED_TOKENS) {
      expect(lower.includes(tok)).toBe(false);
    }
  });

  it('lib SECTIONS contains q14-per-family-per-mode-signal-density with the 7 expected columns', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q14 = (lib.SECTIONS as Array<{ id: string; columns: string[]; sqlFile: string }>).find(
      (s) => s.id === 'q14-per-family-per-mode-signal-density',
    );
    expect(q14).toBeDefined();
    expect(q14?.columns).toEqual([
      'family',
      'run_mode',
      'runs',
      'positives',
      'raw_keys_observed',
      'family_key_count',
      'positives_per_run_key_cell',
    ]);
    expect(q14?.sqlFile).toBe('14-per-family-per-mode-signal-density.sql');
  });
});

/* ------------------------------------------------------------------ */
/* Group C — Q15 new file + Family D subset coverage                   */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — Group C: Q15 Family D subset coverage', () => {
  it('Q15 SQL file exists at scripts/ops/sql/15-family-d-subset-coverage.sql', () => {
    expect(fs.existsSync(Q15_PATH)).toBe(true);
  });

  it('Q15 SQL header documents the 22-vs-30 distinction explicitly (post MCP-BUILD2d)', () => {
    const src = readFile(Q15_PATH);
    // MCP-BUILD2d: the Subset is now 22 (was 19); the upstream taxonomy is 30
    // (was 27). The header references the 22/30 distinction and the
    // ai_classifier Subset terminology. Case-insensitive across the header.
    const lower = src.toLowerCase();
    expect(lower).toContain('22');
    expect(lower).toContain('30');
    expect(lower).toContain('ai_classifier');
    expect(lower).toContain('subset');
  });

  it('Q15 SQL header cites mcp-server/lib/familyDKeys.ts at lines 85-105 and 119-129', () => {
    const src = readFile(Q15_PATH);
    expect(src).toContain('familyDKeys.ts:85-105');
    expect(src).toContain('familyDKeys.ts:119-129');
  });

  // Group C subset-rawKey verbatim assertion: a single test iterates
  // the 19-key Subset and the 6-key deterministic-excluded list
  // internally per design §6.3 (consolidation option to land near the
  // +40 ceiling). The failure message identifies the missing key.
  it('Q15 SQL contains every Subset rawKey from FAMILY_D_RAW_KEYS verbatim', () => {
    const src = readFile(Q15_PATH);
    const missing: string[] = [];
    for (const key of FAMILY_D_SUBSET_KEYS) {
      const re = new RegExp("'" + key + "'\\s*[,)]");
      if (!re.test(src)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it('Q15 SQL contains every deterministic-excluded rawKey from FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS verbatim', () => {
    const src = readFile(Q15_PATH);
    const missing: string[] = [];
    for (const key of FAMILY_D_EXCLUDED_DETERMINISTIC_KEYS) {
      const re = new RegExp("'" + key + "'\\s*[,)]");
      if (!re.test(src)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it('Q15 SQL classifies via subset_membership column with the three expected values', () => {
    const src = readFile(Q15_PATH);
    expect(src).toContain("'ai_classifier_subset'");
    expect(src).toContain("'deterministic_excluded_leak'");
    expect(src).toContain("'unknown_key_outside_taxonomy'");
  });

  it('Q15 SQL preserves the 5-column report-parser contract', () => {
    const src = readFile(Q15_PATH);
    const stripped = stripSqlComments(src);
    // raw_key + run_mode + positive_count + distinct_arguments +
    // subset_membership — these are bare-name in the final SELECT.
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

  it("Q15 SQL filters on family = 'evidence_source_chain'", () => {
    const src = readFile(Q15_PATH);
    const stripped = stripSqlComments(src);
    expect(/where\s+res\.family\s*=\s*'evidence_source_chain'/i.test(stripped)).toBe(true);
  });

  it('Q15 SQL has no verdict tokens (case-insensitive)', () => {
    const src = readFile(Q15_PATH);
    const lower = src.toLowerCase();
    for (const tok of BANNED_TOKENS) {
      expect(lower.includes(tok)).toBe(false);
    }
  });

  it('Q15 ordering prioritizes deterministic_excluded_leak first', () => {
    const src = readFile(Q15_PATH);
    const stripped = stripSqlComments(src);
    // The defensive ordering: the ORDER BY CASE block sorts leaks at
    // priority 1, unknown at 2, subset at 3.
    expect(
      /case\s+subset_membership[\s\S]*when\s+'deterministic_excluded_leak'\s+then\s+1/i.test(stripped),
    ).toBe(true);
    expect(/when\s+'unknown_key_outside_taxonomy'\s+then\s+2/i.test(stripped)).toBe(true);
    expect(/when\s+'ai_classifier_subset'\s+then\s+3/i.test(stripped)).toBe(true);
  });

  it('lib SECTIONS contains q15-family-d-subset-coverage with the 5 expected columns', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q15 = (lib.SECTIONS as Array<{ id: string; columns: string[]; sqlFile: string }>).find(
      (s) => s.id === 'q15-family-d-subset-coverage',
    );
    expect(q15).toBeDefined();
    expect(q15?.columns).toEqual([
      'raw_key',
      'run_mode',
      'positive_count',
      'distinct_arguments',
      'subset_membership',
    ]);
    expect(q15?.sqlFile).toBe('15-family-d-subset-coverage.sql');
  });
});

/* ------------------------------------------------------------------ */
/* Group D — Cross-section invariants                                 */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — Group D: cross-section invariants', () => {
  it('SECTIONS length is now 17 (was 16 after this D card; G-coverage appended q16)', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    expect((lib.SECTIONS as Array<unknown>).length).toBe(17);
  });

  it('SECTIONS section ids are stable, unique, and ordered (q01..q16 with q02b + renamed q11)', () => {
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
    ]);
    // Uniqueness check.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Q11 + Q14 SQL headers each reference the 4-family operational state by family name', () => {
    const expectedFamilyNames = [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
    ];
    for (const filePath of [Q11_NEW_PATH, Q14_PATH]) {
      const src = readFile(filePath);
      for (const fam of expectedFamilyNames) {
        expect(src).toContain(fam);
      }
    }
  });

  it('Q15 SQL is Family-D-scoped and names evidence_source_chain explicitly', () => {
    const src = readFile(Q15_PATH);
    expect(src).toContain('evidence_source_chain');
  });

  it('Q14 and Q15 column names do not collide with Q11 column names', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const sections = lib.SECTIONS as Array<{ id: string; columns: string[] }>;
    const q11Cols = new Set(
      sections.find((s) => s.id === 'q11-per-family-per-mode-coverage')!.columns,
    );
    const q14Cols = sections.find(
      (s) => s.id === 'q14-per-family-per-mode-signal-density',
    )!.columns;
    const q15Cols = sections.find((s) => s.id === 'q15-family-d-subset-coverage')!.columns;
    // run_mode is allowed to overlap across sections (it is the same
    // semantic axis). The other column names are distinct enough not to
    // confuse a parser.
    expect(q14Cols).toContain('family_key_count');
    expect(q14Cols).toContain('positives_per_run_key_cell');
    expect(q15Cols).toContain('subset_membership');
    // family_key_count + subset_membership are unique to the new sections.
    expect(q11Cols.has('family_key_count')).toBe(false);
    expect(q11Cols.has('subset_membership')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Group E — Fixture compatibility                                     */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — Group E: fixture compatibility', () => {
  it('fixture has q14-per-family-per-mode-signal-density key with at least 1 row', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_SECTIONS_DATA,
        'q14-per-family-per-mode-signal-density',
      ),
    ).toBe(true);
    const rows = FIXTURE_SECTIONS_DATA['q14-per-family-per-mode-signal-density'];
    expect(rows.length).toBeGreaterThan(0);
  });

  it('fixture has q15-family-d-subset-coverage key with at least 1 row', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_SECTIONS_DATA,
        'q15-family-d-subset-coverage',
      ),
    ).toBe(true);
    const rows = FIXTURE_SECTIONS_DATA['q15-family-d-subset-coverage'];
    expect(rows.length).toBeGreaterThan(0);
  });

  it('fixture q11 key uses the renamed id and the old id is absent', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_SECTIONS_DATA,
        'q11-per-family-per-mode-coverage',
      ),
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_SECTIONS_DATA,
        'q11-family-bc-admin-validation-check',
      ),
    ).toBe(false);
  });

  it('fixture empty-sections data has the renamed q11 + new q14 + q15 keys', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_EMPTY_SECTIONS_DATA,
        'q11-per-family-per-mode-coverage',
      ),
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_EMPTY_SECTIONS_DATA,
        'q14-per-family-per-mode-signal-density',
      ),
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_EMPTY_SECTIONS_DATA,
        'q15-family-d-subset-coverage',
      ),
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        FIXTURE_EMPTY_SECTIONS_DATA,
        'q11-family-bc-admin-validation-check',
      ),
    ).toBe(false);
  });

  it('runner stitcher consumes the new fixture cleanly (no NaN / undefined)', () => {
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
    // The new sections render as their titles.
    expect(md).toContain('## Per-family per-mode coverage');
    expect(md).toContain('## Per-family per-mode signal density');
    expect(md).toContain('## Family D 22-key subset coverage');
  });

  it('runner JSON artifact has rows for the new sections', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const json = lib.buildJsonArtifact({
      sectionsData: FIXTURE_SECTIONS_DATA,
      sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
      edgeRegistry: FIXTURE_EDGE_REGISTRY,
      generatedAt: FIXTURE_GENERATED_AT,
      defaultTimeWindowDays: 7,
    });
    expect(json.sections).toHaveLength(17);
    const q14 = json.sections.find(
      (s: { id: string }) => s.id === 'q14-per-family-per-mode-signal-density',
    );
    const q15 = json.sections.find(
      (s: { id: string }) => s.id === 'q15-family-d-subset-coverage',
    );
    expect(q14?.rows.length).toBeGreaterThan(0);
    expect(q15?.rows.length).toBeGreaterThan(0);
  });
});
