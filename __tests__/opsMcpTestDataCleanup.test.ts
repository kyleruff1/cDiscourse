/**
 * OPS-MCP-TEST-DATA-CLEANUP — Approach A (hard delete) migration shape.
 *
 * This card cleans 11 synthetic test rows (2 runs + 9 results) that the
 * OPS-MCP-OBSERVABILITY smoke at 0e98c27 surfaced as contamination of
 * the production-mode aggregate at Q11 + Q12. Per operator Stage 2B
 * decision, the cleanup uses Approach A (hard delete) — a single DELETE
 * on public.argument_machine_observation_runs with an exact-match
 * provider_key predicate. The FK ON DELETE CASCADE on results.run_id
 * auto-removes the 9 dependent result rows in the same transaction.
 *
 * Source-of-truth:
 *   - docs/designs/OPS-MCP-TEST-DATA-CLEANUP-intent.md (operator brief)
 *   - docs/designs/OPS-MCP-TEST-DATA-CLEANUP.md §4 (Approach A SQL)
 *   - docs/designs/OPS-MCP-TEST-DATA-CLEANUP.md §6.a (Approach A test plan)
 *
 * Tests A-1..A-10 enumerated in design §6.a are encoded here. The tests
 * are structural — they parse the migration file and assert shape /
 * doctrine invariants. Live DB verification happens at the post-merge
 * smoke phase 2 (Q11 + Q12 re-run); tests never hit Supabase.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const MIGRATION_PATH = path.join(
  REPO,
  'supabase',
  'migrations',
  '20260527000020_ops_mcp_test_data_cleanup.sql',
);

/**
 * Strip SQL comments (line comments and block comments) so structural
 * keyword scans never trip on commentary that legitimately references
 * banned tokens (e.g., a header comment saying "this migration does NOT
 * touch the flags table").
 *
 * Mirrors the helper in __tests__/opsMcpObservabilitySqlSafety.test.ts so
 * the same scan pattern is used across the OPS family.
 */
function stripSqlComments(src: string): string {
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

const SRC = fs.existsSync(MIGRATION_PATH)
  ? fs.readFileSync(MIGRATION_PATH, 'utf8')
  : '';
const EXECUTABLE_SQL = stripSqlComments(SRC).trim();

describe('OPS-MCP-TEST-DATA-CLEANUP — Approach A migration shape', () => {
  // A-1
  it('migration file exists at expected path', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    expect(SRC.length).toBeGreaterThan(0);
  });

  // A-2
  it('migration file header references the card + intent brief + smoke chain', () => {
    expect(SRC).toContain('OPS-MCP-TEST-DATA-CLEANUP');
    expect(SRC).toContain('docs/designs/OPS-MCP-TEST-DATA-CLEANUP-intent.md');
    // The 4 predecessor SHAs from design §1 / header convention.
    expect(SRC).toContain('19b8d8a');
    expect(SRC).toContain('e060eef');
    expect(SRC).toContain('0e98c27');
    expect(SRC).toContain('d500037');
  });

  // A-3
  it('migration contains exactly one DELETE statement and no INSERT/UPDATE/ALTER/DROP/CREATE/TRUNCATE in executable SQL', () => {
    const deleteMatches = EXECUTABLE_SQL.match(/\bDELETE\b/gi) ?? [];
    expect(deleteMatches.length).toBe(1);

    // Defense-in-depth: scope-check that the executable SQL contains
    // none of the other DDL/DML keywords. The header comment may
    // legitimately reference these tokens in prose; stripSqlComments
    // removes the comments first.
    const BANNED_IN_EXECUTABLE = [
      'INSERT',
      'UPDATE',
      'ALTER',
      'DROP',
      'CREATE',
      'TRUNCATE',
      'GRANT',
      'REVOKE',
    ];
    for (const kw of BANNED_IN_EXECUTABLE) {
      const re = new RegExp('\\b' + kw + '\\b', 'i');
      expect({ keyword: kw, present: re.test(EXECUTABLE_SQL) }).toEqual({
        keyword: kw,
        present: false,
      });
    }
  });

  // A-4
  it('DELETE targets exactly public.argument_machine_observation_runs', () => {
    // The single DELETE FROM clause must name this table and no other.
    const fromMatches = EXECUTABLE_SQL.match(
      /\bDELETE\s+FROM\s+([A-Za-z0-9_.]+)/gi,
    );
    expect(fromMatches).not.toBeNull();
    expect(fromMatches!.length).toBe(1);
    const target = fromMatches![0]
      .replace(/\bDELETE\s+FROM\s+/i, '')
      .trim();
    expect(target).toBe('public.argument_machine_observation_runs');

    // The CASCADE-removed results table must NOT be referenced in
    // executable SQL (CASCADE handles it). The header comment may
    // mention it in prose; stripSqlComments removed those.
    expect(EXECUTABLE_SQL.toLowerCase()).not.toContain(
      'public.argument_machine_observation_results',
    );
  });

  // A-5
  it('WHERE uses single exact provider_key match (not LIKE, not IN, not pattern)', () => {
    // The WHERE clause should be `provider_key = 'smoke-mcp:test-server'`
    // with optional whitespace. NOT a LIKE pattern (HALT trigger 2).
    expect(EXECUTABLE_SQL).toMatch(
      /WHERE\s+provider_key\s*=\s*'smoke-mcp:test-server'/i,
    );

    // Explicit defense: no LIKE / ILIKE / IN / SIMILAR TO / ~ regex
    // anywhere in the WHERE region of executable SQL.
    expect(EXECUTABLE_SQL).not.toMatch(/\bLIKE\b/i);
    expect(EXECUTABLE_SQL).not.toMatch(/\bILIKE\b/i);
    expect(EXECUTABLE_SQL).not.toMatch(/\bSIMILAR\s+TO\b/i);
    expect(EXECUTABLE_SQL).not.toMatch(/\bIN\s*\(/i);
    // PostgreSQL POSIX regex operators ~ / ~* / !~ / !~*
    expect(EXECUTABLE_SQL).not.toMatch(/[!]?~[*]?\s*'/);
  });

  // A-6
  it('idempotency: no DELETE without a WHERE clause (guard against accidental table truncation)', () => {
    // Every DELETE statement in executable SQL must be followed (after
    // the FROM target) by a WHERE clause. We tokenize crudely: split
    // on semicolons and check each DELETE statement.
    const statements = EXECUTABLE_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      if (/\bDELETE\b/i.test(stmt)) {
        expect(stmt).toMatch(/\bWHERE\b/i);
      }
    }
  });

  // A-7
  it('no PII or argument body content in migration text', () => {
    // No email-shaped strings (defensive PII scan).
    expect(SRC).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    // No quoted argument body content (defensive — bodies would be
    // multi-word quoted strings; the migration's only string literal
    // is the provider_key value).
    const singleQuoted = SRC.match(/'[^']*'/g) ?? [];
    // The only allowed quoted literal is 'smoke-mcp:test-server'. No
    // body-shaped sentence text.
    for (const literal of singleQuoted) {
      const inner = literal.slice(1, -1);
      // A body sentence would contain spaces and exceed provider_key
      // length. Provider_key is a short colon-separated identifier.
      const looksLikeBody = inner.includes(' ') || inner.length > 64;
      expect({ literal, looksLikeBody }).toEqual({ literal, looksLikeBody: false });
    }
  });

  // A-8
  it('no verdict tokens in migration header or executable SQL', () => {
    // The cdiscourse-doctrine §1 ban-list. The migration is operator-
    // facing, so the strictness is defensive.
    const VERDICT_TOKENS = [
      'winner',
      'loser',
      'liar',
      'dishonest',
      'bad faith',
      'manipulative',
      'extremist',
      'propagandist',
      'stupid',
      'idiot',
    ];
    const lower = SRC.toLowerCase();
    for (const token of VERDICT_TOKENS) {
      expect({ token, present: lower.includes(token) }).toEqual({
        token,
        present: false,
      });
    }
  });

  // A-9
  it('cleanup never touches the flags table', () => {
    // cdiscourse-doctrine §8: flags rows never delete. This migration
    // must not reference the flags table at all (in executable SQL or
    // header — defensive).
    const lower = SRC.toLowerCase();
    expect(lower).not.toContain('public.flags');
    expect(lower).not.toContain('flags(');
    expect(lower).not.toMatch(/\bfrom\s+flags\b/);
    expect(lower).not.toMatch(/\bjoin\s+flags\b/);
    expect(lower).not.toMatch(/\binto\s+flags\b/);
  });

  // A-10
  it('cleanup never touches public.arguments (or by extension, the argument bodies)', () => {
    // The 2 target argument rows referenced in the design (f41b18b0...
    // and 781f8057...) are real posted production arguments. The
    // cleanup deletes runs + results (via CASCADE) but never touches
    // public.arguments itself.
    const exec = EXECUTABLE_SQL.toLowerCase();
    expect(exec).not.toContain('public.arguments');
    expect(exec).not.toMatch(/\bfrom\s+arguments\b/);
    expect(exec).not.toMatch(/\bjoin\s+arguments\b/);
    expect(exec).not.toMatch(/\binto\s+arguments\b/);
    // Defensive: also never touches the canonical argument body column
    // directly.
    expect(exec).not.toContain('arguments.body');
  });
});
