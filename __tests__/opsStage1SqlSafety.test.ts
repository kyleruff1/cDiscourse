/**
 * OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 observation SQL safety scan.
 *
 * The Stage-1 OBSERVATION-CONTROL pack's committed SQL lives in the DEDICATED
 * sibling directory `scripts/ops-stage1-sql/` — NOT under `scripts/ops/`. The
 * observability SQL-safety suites recursively scan `scripts/ops/` and assert
 * an EXACT .sql count there, so any extra .sql under that tree would break the
 * build. Placing the Stage-1 SQL in a sibling dir (mirroring
 * `scripts/ops-latency-sql/`, which exists for exactly this reason) keeps that
 * recursive count untouched while still giving the Stage-1 SQL equivalent
 * doctrine coverage in its own home. This suite mirrors the latency safety
 * scan, scoped to the Stage-1 dir.
 *
 * For each `scripts/ops-stage1-sql/*.sql` file, asserts:
 *   - Read-only: no INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE/
 *     GRANT/REVOKE keyword in executable SQL (after stripping comments).
 *   - No `select * from public.arguments` (body content risk).
 *   - No bare `arguments.body` (must be aggregator-wrapped if present at all).
 *   - No bare `evidence_span` (aggregator-wrapped or absent).
 *   - No SERVICE_ROLE / SUPABASE_SERVICE_ROLE / ANTHROPIC_API_KEY /
 *     X_BEARER_TOKEN / XAI_API_KEY / Authorization / "Bearer " / JWT-shaped
 *     / sk-ant- / sb_secret literal anywhere.
 *   - Every file ends with a terminating `;`.
 *   - Every file header references OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP.
 *
 * The Stage-1 pack does NOT close the observation window, issue a PASS
 * verdict, enable H/I/J, or advance the routing percentage; these SQL files
 * are read-only reporting only.
 *
 * Doctrine: read-only operator queries; no body content; no evidence span;
 * cdiscourse-doctrine §6 (secrets policy).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const STAGE1_SQL_DIR = path.join(REPO, 'scripts', 'ops-stage1-sql');

function listSqlFiles(): string[] {
  if (!fs.existsSync(STAGE1_SQL_DIR)) return [];
  return fs
    .readdirSync(STAGE1_SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => path.join(STAGE1_SQL_DIR, f))
    .sort();
}

/**
 * Strip `-- line comments` and block comments so the executable scan does not
 * trip on commentary that legitimately references a banned token (e.g.,
 * "no body content; no evidence_span" or "no service-role").
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

const FILES = listSqlFiles();

describe('OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 SQL safety', () => {
  it('the Stage-1 SQL dir exists and holds at least 4 .sql files', () => {
    expect(fs.existsSync(STAGE1_SQL_DIR)).toBe(true);
    expect(FILES.length).toBeGreaterThanOrEqual(4);
  });

  it('the Stage-1 dir is a SIBLING of scripts/ops/ (not a subdir — keeps the obs recursive scan count intact)', () => {
    // scripts/ops-stage1-sql/ must NOT be nested under scripts/ops/, or the
    // observability secrets test (recursive over scripts/ops/) would count
    // extra .sql files and fail.
    const opsDir = path.join(REPO, 'scripts', 'ops');
    const rel = path.relative(opsDir, STAGE1_SQL_DIR);
    expect(rel.startsWith('..')).toBe(true);
  });

  it('every discovered file extension is .sql', () => {
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

  describe.each(DDL_KEYWORDS)('no executable %s keyword in any Stage-1 SQL file', (kw) => {
    it(`every Stage-1 SQL file rejects ${kw}`, () => {
      const re = new RegExp('\\b' + kw + '\\b', 'i');
      const offenders: string[] = [];
      for (const file of FILES) {
        const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
        if (re.test(stripped)) offenders.push(path.basename(file));
      }
      expect(offenders).toEqual([]);
    });
  });

  it('no file contains `select * from public.arguments`', () => {
    for (const file of FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
      expect(/select\s+\*\s+from\s+public\.arguments\b/i.test(stripped)).toBe(
        false,
      );
    }
  });

  it('no file selects bare `arguments.body` (must be wrapped in an aggregator)', () => {
    for (const file of FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
      const re = /arguments\.body/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(stripped)) !== null) {
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

  it('no file selects bare `evidence_span` content (aggregator-wrapped or absent)', () => {
    for (const file of FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
      const re = /\bevidence_span\b/gi;
      let m: RegExpExecArray | null;
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

  it('no file contains a SERVICE_ROLE / service-role literal in executable SQL', () => {
    for (const file of FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
      expect(stripped).not.toMatch(/SERVICE_ROLE/);
      expect(stripped).not.toMatch(/service_role/);
      expect(stripped).not.toMatch(/service-role/);
      expect(stripped).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });

  it('no file contains a key/secret/auth literal anywhere (full file, incl. comments)', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).not.toContain('ANTHROPIC_API_KEY');
      expect(src).not.toContain('X_BEARER_TOKEN');
      expect(src).not.toContain('XAI_API_KEY');
      // Auth-header literals MUST NOT appear (the supabase CLI handles auth).
      expect(src).not.toMatch(/Bearer /);
      expect(src).not.toMatch(/Authorization/i);
      // Secret-shaped literals (assembled from fragments so this test file
      // does not itself carry a contiguous banned literal).
      expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{8}').test(src)).toBe(
        false,
      );
      expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{12}').test(src)).toBe(false);
      expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{8}').test(src)).toBe(
        false,
      );
      expect(
        /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(src),
      ).toBe(false);
    }
  });

  it('every file ends with a terminating semicolon (catches truncated SQL)', () => {
    for (const file of FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8')).trim();
      expect(stripped.endsWith(';')).toBe(true);
    }
  });

  it('every file begins with a header comment referencing OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const firstNonEmpty = src
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      expect(firstNonEmpty).toBeDefined();
      expect(firstNonEmpty?.startsWith('--')).toBe(true);
      expect(src).toContain('OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP');
    }
  });

  it('the standalone-run header path points at the scripts/ops-stage1-sql/ location', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const base = path.basename(file);
      // The header documents `npx supabase db query --linked --file <path>`;
      // the path must reference the dedicated sibling dir.
      expect(src).toContain(`scripts/ops-stage1-sql/${base}`);
    }
  });
});
