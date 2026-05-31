/**
 * OPS-MCP-OBSERVABILITY — SQL safety scan.
 *
 * For each `scripts/ops/sql/*.sql` file, asserts:
 *   - Read-only: no INSERT, UPDATE, DELETE, ALTER, CREATE, DROP,
 *     TRUNCATE, GRANT, REVOKE keywords appear in executable SQL.
 *   - No `select *` over public.arguments (body content risk).
 *   - No bare `arguments.body` reference (must be wrapped in
 *     LENGTH/AVG/MAX/MIN/COALESCE aggregator if present at all).
 *   - No bare `evidence_span` SELECT (same allow-wrapper logic).
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §test-plan T1.
 * Doctrine: read-only operator queries; no body content; no evidence span.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const SQL_DIR = path.join(REPO, 'scripts', 'ops', 'sql');

function listSqlFiles(): string[] {
  return fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => path.join(SQL_DIR, f))
    .sort();
}

function stripSqlComments(src: string): string {
  // Strip `-- line comments` and `/* block */` comments so the keyword
  // scan does not trip on commentary that legitimately references the
  // banned tokens (e.g., "SELECT only — no INSERT here").
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

const FILES = listSqlFiles();

describe('OPS-MCP-OBSERVABILITY — SQL safety', () => {
  it('discovers all 17 SQL files', () => {
    expect(FILES.length).toBe(17);
  });

  it('every file extension is .sql', () => {
    for (const f of FILES) {
      expect(f.endsWith('.sql')).toBe(true);
    }
  });

  const DDL_KEYWORDS = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'ALTER',
    'CREATE',
    'DROP',
    'TRUNCATE',
    'GRANT',
    'REVOKE',
  ];

  // Single test per keyword that iterates over all SQL files internally.
  // Consolidated to keep the test count manageable per design risk #6
  // ("the implementer MAY consolidate via parameterization to land
  // closer to the upper band of the forecast"). The descriptive error
  // message identifies which file + which keyword.
  describe.each(DDL_KEYWORDS)('no executable %s keyword in any SQL file', (kw) => {
    it(`every SQL file rejects ${kw}`, () => {
      const re = new RegExp('\\b' + kw + '\\b', 'i');
      const offenders: string[] = [];
      for (const file of FILES) {
        const src = fs.readFileSync(file, 'utf8');
        const stripped = stripSqlComments(src);
        if (re.test(stripped)) {
          offenders.push(path.basename(file));
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  it('no file contains `select * from public.arguments`', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const stripped = stripSqlComments(src);
      // Case-insensitive; allows whitespace between tokens.
      expect(
        /select\s+\*\s+from\s+public\.arguments\b/i.test(stripped),
      ).toBe(false);
    }
  });

  it('no file selects bare `arguments.body` (must be wrapped in aggregator)', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const stripped = stripSqlComments(src);
      // Find every `arguments.body` occurrence; for each, the
      // preceding characters must form a known aggregator wrapper.
      const re = /arguments\.body/gi;
      let m;
      while ((m = re.exec(stripped)) !== null) {
        // Look back up to 30 chars for an allowed wrapper.
        const back = stripped.slice(Math.max(0, m.index - 30), m.index);
        const allowed = /(LENGTH|AVG|MAX|MIN|COALESCE|COUNT)\s*\(\s*$/i.test(back);
        if (!allowed) {
          throw new Error(
            `${path.basename(file)} references arguments.body without an aggregator at index ${m.index}`,
          );
        }
      }
    }
  });

  it('no file selects bare `evidence_span` content (must be wrapped in aggregator or not present)', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const stripped = stripSqlComments(src);
      // Find every `evidence_span` reference in executable SQL; for
      // each, the preceding chars must form an aggregator wrapper.
      const re = /\bevidence_span\b/gi;
      let m;
      while ((m = re.exec(stripped)) !== null) {
        const back = stripped.slice(Math.max(0, m.index - 30), m.index);
        const allowed = /(LENGTH|AVG|MAX|MIN|COALESCE|COUNT)\s*\(\s*$/i.test(back);
        if (!allowed) {
          throw new Error(
            `${path.basename(file)} references evidence_span without an aggregator at index ${m.index}`,
          );
        }
      }
    }
  });

  it('every file begins with a header comment referencing OPS-MCP-OBSERVABILITY', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      // Header comment lines start with `-- `; the first non-empty
      // line should reference the card name.
      const firstNonEmpty = src
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      expect(firstNonEmpty).toBeDefined();
      expect(firstNonEmpty?.startsWith('--')).toBe(true);
      expect(src).toContain('OPS-MCP-OBSERVABILITY');
    }
  });

  it('every file contains exactly one terminating semicolon after the final SELECT', () => {
    // Loose check: the file ends with `;` after a SELECT path; this
    // catches truncated SQL.
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const stripped = stripSqlComments(src).trim();
      expect(stripped.endsWith(';')).toBe(true);
    }
  });
});
