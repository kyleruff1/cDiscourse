/**
 * OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE — card-scoped SQL + manifest
 * safety tests (Family H claim_clarity; UNIFORM ai_classifier source).
 *
 * Family H is a UNIFORM single-source family (12 ai_classifier keys, no
 * FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS constant). Per the E/F
 * precedent it gets the Q11 header bullet + the Q14 hardcoded-CASE branch
 * ONLY — NO dedicated subset-coverage SQL file and NO new SECTIONS entry.
 * The test groups therefore mirror only the applicable subset of the
 * Family G test:
 *   - Group A: Q11 narrative regression (header gains claim_clarity +
 *     Family H bullet; SQL body byte-equal; SECTIONS question present).
 *   - Group B: Q14 CASE regression (CASE gains `when 'claim_clarity'
 *     then 12`; A–G branches + else 0 preserved; header table gains a
 *     claim_clarity row citing familyHKeys.ts; SECTIONS question reflects
 *     the new roster via the stable comma-letter canary `, H`).
 *   - Group C: H doctrine self-check (no base banned tokens; the H
 *     verdict-adjacency phrases are absent from the comment-stripped
 *     executable SQL; the claim_clarity family is framed as DESCRIPTIVE
 *     FORMULATION-STATE / uniform ai_classifier).
 *   - Group D: uniform-source guard (NO 17-family-h-subset-coverage.sql;
 *     NO q*-family-h-* SECTIONS entry — H must not gain a subset file).
 *
 * Pattern: pure Jest, fs.readFileSync, regex / substring assertions; no
 * live DB call.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-HI-COVERAGE.md §6.
 * Predecessor pattern: __tests__/opsMcpObservabilityFamilyGCoverage.test.ts.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const SQL_DIR = path.join(REPO, 'scripts', 'ops', 'sql');
const Q11_PATH = path.join(SQL_DIR, '11-per-family-per-mode-coverage.sql');
const Q14_PATH = path.join(SQL_DIR, '14-per-family-per-mode-signal-density.sql');

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

// H-specific verdict-adjacency phrases per familyHKeys.ts:252,193,207,313
// doctrine anchors. Family H's domain (claim clarity / formulation) sits
// one careless phrasing away from a quality verdict on the move
// ("weak / vague / sloppy argument"). These phrases are forbidden from
// appearing in executable SQL (the `-- comment` regions may quote them as
// doctrine notes; the comment-stripped scan checks only executable SQL).
const H_VERDICT_ADJACENCY_BANNED_PHRASES = [
  'weak',
  'vague',
  'lazy',
  'sloppy',
  'careless',
  'confused',
  'unsound',
  'unsupported',
  'incoherent',
  'illogical',
  'bad reasoning',
  'bad argument',
  'incomplete',
  'unfinished',
  'ungrounded',
  'unjustified',
];

/* ------------------------------------------------------------------ */
/* Group A — Q11 narrative regression                                  */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE — Group A: Q11 narrative regression', () => {
  it('Q11 SQL header references claim_clarity and the Family H production-enabled state', () => {
    const src = readFile(Q11_PATH);
    expect(src).toContain('claim_clarity');
    expect(src).toContain('Family H');
    // The bullet declares H production-enabled (no longer the stale
    // "H Card-1 admin_validation" / "I, J unsupported" line).
    expect(/Family H[^\n]*production/i.test(src)).toBe(true);
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
    // No Q14/Q17 column aliases leaked into Q11.
    expect(/\bas\s+family_key_count\b/i.test(stripped)).toBe(false);
    expect(/\bas\s+subset_membership\b/i.test(stripped)).toBe(false);
  });

  it('Q11 SECTIONS question text is still present', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q11 = (lib.SECTIONS as Array<{ id: string; question: string }>).find(
      (s) => s.id === 'q11-per-family-per-mode-coverage',
    );
    expect(q11).toBeDefined();
    expect(typeof q11?.question).toBe('string');
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

describe('OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE — Group B: Q14 CASE regression', () => {
  it("Q14 SQL hardcoded CASE includes `when 'claim_clarity' then 12` verbatim", () => {
    const src = readFile(Q14_PATH);
    const stripped = stripSqlComments(src);
    expect(stripped).toContain("when 'claim_clarity' then 12");
  });

  it('Q14 SQL CASE preserves the A–G branches and the else 0 fallthrough', () => {
    const src = readFile(Q14_PATH);
    const stripped = stripSqlComments(src);
    expect(stripped).toContain("when 'parent_relation' then 19");
    expect(stripped).toContain("when 'disagreement_axis' then 17");
    expect(stripped).toContain("when 'misunderstanding_repair' then 20");
    expect(stripped).toContain("when 'evidence_source_chain' then 22");
    expect(stripped).toContain("when 'argument_scheme' then 19");
    expect(stripped).toContain("when 'critical_question' then 17");
    expect(stripped).toContain("when 'resolution_progress' then 21");
    expect(/else\s+0/i.test(stripped)).toBe(true);
  });

  it('Q14 SQL header table contains a claim_clarity row citing familyHKeys.ts', () => {
    const src = readFile(Q14_PATH);
    expect(src).toContain('claim_clarity');
    expect(src).toContain('familyHKeys.ts');
    expect(src).toContain('12');
  });

  it('Q14 SECTIONS question reflects the new roster via the stable comma-letter canary `, H`', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const q14 = (lib.SECTIONS as Array<{ id: string; question: string }>).find(
      (s) => s.id === 'q14-per-family-per-mode-signal-density',
    );
    expect(q14).toBeDefined();
    // Stable across count-word shifts (five → eight → nine).
    expect(q14?.question).toContain(', H');
  });

  it('Q14 SQL still has no base banned tokens after the CASE + header update', () => {
    const src = readFile(Q14_PATH).toLowerCase();
    for (const tok of BANNED_TOKENS) {
      expect(src.includes(tok)).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Group C — H doctrine self-check                                     */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE — Group C: H doctrine self-check', () => {
  it('Q11 + Q14 executable SQL (comment-stripped) contain none of the H verdict-adjacency phrases', () => {
    for (const filePath of [Q11_PATH, Q14_PATH]) {
      const stripped = stripSqlComments(readFile(filePath)).toLowerCase();
      for (const phrase of H_VERDICT_ADJACENCY_BANNED_PHRASES) {
        expect(stripped.includes(phrase)).toBe(false);
      }
    }
  });

  it('Q14 header frames claim_clarity (Family H) as DESCRIPTIVE FORMULATION-STATE, never a verdict', () => {
    const src = readFile(Q14_PATH);
    expect(src).toContain('DESCRIPTIVE FORMULATION-STATE');
    expect(src).toContain('cdiscourse-doctrine');
  });

  it('Q11 + Q14 headers describe Family H as uniform ai_classifier with no deterministic exclusions', () => {
    const q11 = readFile(Q11_PATH).toLowerCase();
    const q14 = readFile(Q14_PATH).toLowerCase();
    // Q11 bullet: "uniform source, no deterministic exclusions".
    expect(q11.includes('uniform')).toBe(true);
    // Q14 header row: "uniform; 12 ai_classifier, no exclusions".
    expect(q14.includes('uniform')).toBe(true);
    expect(q14.includes('ai_classifier')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Group D — uniform-source guard                                      */
/* ------------------------------------------------------------------ */

describe('OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE — Group D: uniform-source guard', () => {
  it('no dedicated Family H subset-coverage SQL file exists (H is uniform like E/F)', () => {
    const files = fs.readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql'));
    const hSubsetFiles = files.filter((f) => /family-h/i.test(f));
    expect(hSubsetFiles).toEqual([]);
    // Explicit assertion on the would-be filename.
    expect(fs.existsSync(path.join(SQL_DIR, '17-family-h-subset-coverage.sql'))).toBe(false);
  });

  it('report-lib SECTIONS has no q*-family-h-* entry (H adds no section)', () => {
    const lib = require(path.join(REPO, 'scripts', 'ops', 'mcp-observability-report-lib.cjs'));
    const ids = (lib.SECTIONS as Array<{ id: string }>).map((s) => s.id);
    const hSections = ids.filter((id) => /family-h/i.test(id));
    expect(hSections).toEqual([]);
  });
});
