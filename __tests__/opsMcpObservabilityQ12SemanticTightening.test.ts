/**
 * OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING — Q12 post-fix safety.
 *
 * Asserts the post-fix SQL at
 *   scripts/ops/sql/12-unsupported-family-attempts.sql
 * conforms to the design at
 *   docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING.md §3.
 *
 * The 9 tests here verify (a) the OR-clause regression is gone,
 * (b) the data-derived supported_families/unsupported_families CTE
 * pair is in place, (c) the synthetic-provider exclusion predicate is
 * present, (d) the report-parser column-name contract is preserved,
 * and (e) the doctrine + header conventions hold (no verdict tokens;
 * header references OPS-MCP-OBSERVABILITY).
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING.md §3.
 * Pattern: pure Jest, fs.readFileSync, regex/substring assertions; no
 * live DB call (live DB sanity check lives in the post-merge smoke
 * audit, not here).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const Q12_PATH = path.join(
  REPO,
  'scripts',
  'ops',
  'sql',
  '12-unsupported-family-attempts.sql',
);

function readQ12(): string {
  return fs.readFileSync(Q12_PATH, 'utf8');
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

function extractPositivesObservedSubquery(src: string): string {
  // Locate the `as positives_observed` alias and walk backward from
  // its preceding `)` to find the matching `(` that opens the
  // correlated subquery block. Returns the substring between the
  // matching parens (exclusive).
  const stripped = stripSqlComments(src);
  const aliasIdx = stripped.search(/\)\s*as\s+positives_observed\b/i);
  if (aliasIdx === -1) {
    throw new Error('positives_observed alias not found in stripped SQL');
  }
  // Walk back from aliasIdx (which is the `)` position) to find the
  // matching `(` via paren balancing.
  let depth = 1;
  let i = aliasIdx - 1;
  while (i >= 0 && depth > 0) {
    if (stripped[i] === ')') depth += 1;
    else if (stripped[i] === '(') depth -= 1;
    if (depth === 0) break;
    i -= 1;
  }
  if (depth !== 0) {
    throw new Error('Unbalanced parens scanning back from positives_observed');
  }
  // i is the matching `(`; return the inside (exclusive of parens).
  return stripped.slice(i + 1, aliasIdx);
}

function extractSupportedFamiliesCteBlock(src: string): string {
  // Locate `supported_families as (` and walk forward to the matching
  // `)`. Returns the substring between them (exclusive).
  const stripped = stripSqlComments(src);
  const openMatch = stripped.match(/supported_families\s+as\s*\(/i);
  if (!openMatch || openMatch.index === undefined) {
    throw new Error('supported_families CTE opener not found');
  }
  const start = openMatch.index + openMatch[0].length;
  let depth = 1;
  let i = start;
  while (i < stripped.length && depth > 0) {
    if (stripped[i] === '(') depth += 1;
    else if (stripped[i] === ')') depth -= 1;
    if (depth === 0) break;
    i += 1;
  }
  if (depth !== 0) {
    throw new Error('Unbalanced parens scanning supported_families CTE');
  }
  return stripped.slice(start, i);
}

describe('OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING — post-fix SQL safety', () => {
  it('regression: OR-on-requested_families clause is removed', () => {
    // The binding new test per intent brief §10. The over-counting
    // predicate that referenced r2.requested_families inside the
    // positives_observed subquery must be gone.
    const src = readQ12();
    const stripped = stripSqlComments(src);
    // Case-insensitive, tolerant of single/multi-space whitespace.
    const orClauseRe = /or\s+u\.family_name\s*=\s*any\s*\(\s*r2\.requested_families\s*\)/i;
    expect(orClauseRe.test(stripped)).toBe(false);
    // Also assert the `r2` alias itself is gone from the
    // positives_observed subquery (it was only ever used by that
    // join). The outer query still uses `r` for the run-level join,
    // and the CTE may use `r_sf` — but `r2` should be unused.
    const subquery = extractPositivesObservedSubquery(src);
    expect(/\br2\b/i.test(subquery)).toBe(false);
  });

  it('supported_families CTE is present with `with` opener', () => {
    const src = readQ12();
    const stripped = stripSqlComments(src);
    expect(stripped).toMatch(/\bsupported_families\b/i);
    // The CTE must be opened by a `with` keyword (the SQL standard
    // form for a leading CTE).
    expect(/\bwith\s+supported_families\s+as\b/i.test(stripped)).toBe(true);
  });

  it('unsupported_families CTE is present and derived from results', () => {
    const src = readQ12();
    const stripped = stripSqlComments(src);
    expect(/\bunsupported_families\s+as\b/i.test(stripped)).toBe(true);
    // The unsupported_families CTE must subtract supported_families
    // via a `not in (select … from supported_families)` pattern.
    expect(
      /not\s+in\s*\(\s*select\s+[^)]*\bsupported_families\b/i.test(stripped),
    ).toBe(true);
  });

  it('supported_families excludes synthetic providers via NOT LIKE smoke-%', () => {
    // Synthetic test seeds (provider_key LIKE 'smoke-%') must NOT
    // ratify a family as supported.
    const src = readQ12();
    const stripped = stripSqlComments(src);
    expect(/provider_key\s+not\s+like\s+'smoke-%'/i.test(stripped)).toBe(true);
  });

  it('supported_families CTE JOINs through runs to access provider_key', () => {
    // provider_key lives on argument_machine_observation_runs, not
    // on results. The CTE must JOIN to pull provider_key into scope.
    const src = readQ12();
    const cte = extractSupportedFamiliesCteBlock(src);
    expect(/inner\s+join\s+public\.argument_machine_observation_runs/i.test(cte)).toBe(
      true,
    );
    expect(/\bprovider_key\b/i.test(cte)).toBe(true);
  });

  it('positives_observed uses strict res.family = u.family_name with no array predicate', () => {
    // The post-fix subquery must contain the strict equality and
    // MUST NOT contain `requested_families` or any `any(` array
    // predicate (which would indicate the OR clause survived).
    const src = readQ12();
    const stripped = stripSqlComments(src);
    expect(/where\s+res\.family\s*=\s*u\.family_name/i.test(stripped)).toBe(true);
    const subquery = extractPositivesObservedSubquery(src);
    expect(/\brequested_families\b/i.test(subquery)).toBe(false);
    expect(/\bany\s*\(/i.test(subquery)).toBe(false);
  });

  it('hardcoded D-J family array is removed from the SQL', () => {
    // The pre-fix file enumerated 7 family names in an inline array.
    // The post-fix data-derived CTE must not retain that literal.
    const src = readQ12();
    // The exact three-name prefix from the pre-fix array.
    expect(src).not.toContain(
      "'evidence_source_chain', 'argument_scheme', 'critical_question'",
    );
    // Also no `unnest(array[` form for the unsupported-families
    // source (the post-fix shape uses CTEs, not unnest).
    const stripped = stripSqlComments(src);
    expect(/\bunnest\s*\(\s*array\s*\[/i.test(stripped)).toBe(false);
  });

  it('preserves the 5-column report-parser contract', () => {
    // Column names are pinned by
    // scripts/ops/mcp-observability-report-lib.cjs SECTIONS entry
    // q12-unsupported-family-attempts. All 5 must appear verbatim
    // as `as <name>` aliases in the SQL.
    const src = readQ12();
    const stripped = stripSqlComments(src);
    const expectedColumns = [
      'unsupported_family_attempted',
      'attempts',
      'failed_attempts',
      'mcp_validation_failed_attempts',
      'positives_observed',
    ];
    for (const name of expectedColumns) {
      const re = new RegExp('\\bas\\s+' + name + '\\b', 'i');
      expect(re.test(stripped)).toBe(true);
    }
    // Cross-check that the lib SECTIONS descriptor is byte-equal to
    // these column names (catches lib drift if anyone modifies the
    // contract from the lib side).
    const lib = require(path.join(
      REPO,
      'scripts',
      'ops',
      'mcp-observability-report-lib.cjs',
    ));
    const q12Section = (lib.SECTIONS as Array<{ id: string; columns: string[] }>).find(
      (s) => s.id === 'q12-unsupported-family-attempts',
    );
    expect(q12Section).toBeDefined();
    expect(q12Section?.columns).toEqual(expectedColumns);
  });

  it('header preserved + doctrine clean (no verdict tokens; data-derived intent surfaced)', () => {
    const src = readQ12();
    // Header convention: first non-empty line is a -- comment that
    // references OPS-MCP-OBSERVABILITY.
    const firstNonEmpty = src
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    expect(firstNonEmpty).toBeDefined();
    expect(firstNonEmpty?.startsWith('--')).toBe(true);
    expect(firstNonEmpty).toContain('OPS-MCP-OBSERVABILITY');

    // No verdict tokens in any SQL comment (or anywhere in the file).
    const banned = [
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
    const lower = src.toLowerCase();
    for (const tok of banned) {
      expect(lower.includes(tok)).toBe(false);
    }

    // The header comment block (everything before the first `with`
    // keyword) must surface the data-derived intent — either by
    // mentioning `data-derived` or by naming `supported_families`.
    const withIdx = src.search(/\bwith\b/i);
    expect(withIdx).toBeGreaterThan(-1);
    const header = src.slice(0, withIdx);
    const mentionsDataDerived =
      /data-derived/i.test(header) || /supported_families/i.test(header);
    expect(mentionsDataDerived).toBe(true);
  });
});
