/**
 * OPS-MCP-LATENCY-BUDGET — Latency SQL safety scan.
 *
 * The latency SQL lives in the DEDICATED sibling directory
 * `scripts/ops-latency-sql/` — NOT in the observability-owned
 * `scripts/ops/sql/`. The observability SQL-safety suites
 * (`opsMcpObservabilitySqlSafety.test.ts` +
 * `opsMcpObservabilityNoServiceRoleNoSecrets.test.ts`) recursively scan
 * `scripts/ops/` and assert an EXACT 16-file observability count, so the
 * latency SQL must live outside that tree. This suite mirrors the
 * observability safety scans, scoped to the latency dir, so the latency SQL
 * gets equivalent doctrine coverage in its new home.
 *
 * For each `scripts/ops-latency-sql/*.sql` file, asserts:
 *   - Read-only: no INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE/
 *     GRANT/REVOKE keyword in executable SQL.
 *   - No `select * from public.arguments` (body content risk).
 *   - No bare `arguments.body` (must be aggregator-wrapped if present at all).
 *   - No bare `evidence_span` (aggregator-wrapped or absent).
 *   - No SERVICE_ROLE / SUPABASE_SERVICE_ROLE / ANTHROPIC_API_KEY /
 *     X_BEARER_TOKEN / XAI_API_KEY / Authorization / "Bearer " / JWT-shaped
 *     / sk-ant- / sb_secret literal anywhere.
 *   - Every file ends with a terminating `;`.
 *   - Every file header references OPS-MCP-LATENCY-BUDGET.
 *
 * Source-of-truth: docs/designs/OPS-MCP-LATENCY-BUDGET.md (operator
 * decision — Option B: relocate latency SQL out of scripts/ops/sql/).
 * Doctrine: read-only operator queries; no body content; no evidence span;
 * cdiscourse-doctrine §6 (secrets policy).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const LATENCY_SQL_DIR = path.join(REPO, 'scripts', 'ops-latency-sql');

function listSqlFiles(): string[] {
  if (!fs.existsSync(LATENCY_SQL_DIR)) return [];
  return fs
    .readdirSync(LATENCY_SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => path.join(LATENCY_SQL_DIR, f))
    .sort();
}

/**
 * Strip `-- line comments` and `/* block *​/` comments so the executable
 * scan does not trip on commentary that legitimately references a banned
 * token (e.g., "no body content; no evidence_span" or "no service-role").
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

describe('OPS-MCP-LATENCY-BUDGET — latency SQL safety', () => {
  it('discovers exactly the two latency SQL files (01, 02) in the dedicated sibling dir', () => {
    expect(FILES.length).toBe(2);
    expect(FILES.map((f) => path.basename(f))).toEqual([
      '01-auto-trigger-per-family-duration.sql',
      '02-auto-trigger-wall-clock-per-argument.sql',
    ]);
  });

  it('the latency dir is a SIBLING of scripts/ops/ (not a subdir — keeps the obs recursive scan at 16)', () => {
    // scripts/ops-latency-sql/ must NOT be nested under scripts/ops/, or the
    // observability secrets test (recursive over scripts/ops/) would count 18.
    const opsDir = path.join(REPO, 'scripts', 'ops');
    const rel = path.relative(opsDir, LATENCY_SQL_DIR);
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

  describe.each(DDL_KEYWORDS)('no executable %s keyword in any latency SQL file', (kw) => {
    it(`every latency SQL file rejects ${kw}`, () => {
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

  it('every file begins with a header comment referencing OPS-MCP-LATENCY-BUDGET', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const firstNonEmpty = src
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      expect(firstNonEmpty).toBeDefined();
      expect(firstNonEmpty?.startsWith('--')).toBe(true);
      expect(src).toContain('OPS-MCP-LATENCY-BUDGET');
    }
  });

  it('the standalone-run header path points at the new scripts/ops-latency-sql/ location', () => {
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const base = path.basename(file);
      // The header documents `npx supabase db query --linked --file <path>`;
      // the path must reference the new dedicated dir, not the old obs dir.
      expect(src).toContain(`scripts/ops-latency-sql/${base}`);
      expect(src).not.toContain('scripts/ops/sql/');
    }
  });
});
