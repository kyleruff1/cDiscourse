/**
 * OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 gate-probe safety scan.
 *
 * Verifies the read-only gate probes added by the A-G stability roadmap:
 *   - SQL probes:   scripts/ops-stage1-sql/0N-*.sql
 *   - Shell wrappers: scripts/ops/stage1/gate-*.sh
 *
 * The SQL probes must:
 *   - be read-only: no INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE/
 *     GRANT/REVOKE keyword in executable (comment-stripped) SQL;
 *   - end with a terminating ';';
 *   - have their FIRST non-empty line be a comment referencing the card;
 *   - contain no `select * from public.arguments`, no bare `arguments.body`,
 *     no bare `evidence_span`, no secret-shaped literal.
 *
 * The shell wrappers must:
 *   - start with `#!/usr/bin/env bash`, then `set -uo pipefail`, then
 *     `set +x`;
 *   - run only read-only `npx supabase db query --linked --file ...`;
 *   - contain NO banned token ANYWHERE (including inside `#` comments):
 *     SERVICE_ROLE / service_role / service-role, ANTHROPIC_API_KEY, the
 *     bare words anthropic / xai, X_BEARER_TOKEN, the word Authorization,
 *     the 'Bearer ' string, and any sk-ant- / sb_secret / xai- literal.
 *
 * SQL placement guard: the committed Stage-1 SQL lives in the SIBLING dir
 * scripts/ops-stage1-sql/, never under scripts/ops/ — the observability
 * suite asserts an exact 17-file .sql count recursively under scripts/ops/,
 * so an extra .sql there would break the build.
 *
 * Doctrine: cdiscourse-doctrine §1/§6 — read-only operator queries; no body
 * content; no evidence span; no secret literal; system-health signals only.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const SQL_DIR = path.join(REPO, 'scripts', 'ops-stage1-sql');
const SH_DIR = path.join(REPO, 'scripts', 'ops', 'stage1');
const CARD = 'OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP';

// Explicit allow-list so this test scopes ONLY to the probes added by this
// card and does not pull in other Stage-1 artifacts authored elsewhere.
const SQL_PROBES = [
  '01-routing-liveness-and-leakage.sql',
  '02-organic-vs-smoke-routed.sql',
  '03-deadletter-and-per-family.sql',
  '04-idempotency-and-singleflight.sql',
  '05-drainer-freshness-and-depth.sql',
];
const SH_WRAPPERS = [
  'gate-routing-leakage.sh',
  'gate-organic-vs-smoke.sh',
  'gate-deadletter-per-family.sh',
  'gate-idempotency-singleflight.sh',
  'gate-drainer-freshness-depth.sh',
];

const SQL_FILES = SQL_PROBES.map((f) => path.join(SQL_DIR, f));
const SH_FILES = SH_WRAPPERS.map((f) => path.join(SH_DIR, f));

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

// Secret-shaped literals that must never appear in any committed file.
const SECRET_SHAPES: Array<[string, RegExp]> = [
  ['sk-ant- literal', /sk-ant-/],
  ['sb_secret literal', /sb_secret/],
  ['xai- key literal', /xai-[A-Za-z0-9]/],
  ['JWT-shaped literal', /\beyJ[A-Za-z0-9_-]{6,}\./],
];

describe(`${CARD} — Stage-1 gate-probe SQL safety`, () => {
  it('all five SQL probes exist in the sibling dir scripts/ops-stage1-sql/', () => {
    for (const f of SQL_FILES) {
      expect(fs.existsSync(f)).toBe(true);
    }
  });

  it('none of the probes live under scripts/ops/ (would break the 17-file count)', () => {
    for (const f of SQL_FILES) {
      const rel = path.relative(REPO, f).replace(/\\/g, '/');
      expect(rel.startsWith('scripts/ops-stage1-sql/')).toBe(true);
      expect(rel.startsWith('scripts/ops/')).toBe(false);
    }
  });

  describe.each(DDL_KEYWORDS)('no executable %s keyword in any probe', (kw) => {
    it(`every probe rejects ${kw}`, () => {
      const re = new RegExp('\\b' + kw + '\\b', 'i');
      const offenders: string[] = [];
      for (const file of SQL_FILES) {
        const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
        if (re.test(stripped)) offenders.push(path.basename(file));
      }
      expect(offenders).toEqual([]);
    });
  });

  it('no probe contains `select * from public.arguments`', () => {
    for (const file of SQL_FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
      expect(/select\s+\*\s+from\s+public\.arguments\b/i.test(stripped)).toBe(false);
    }
  });

  it('no probe references bare `arguments.body`', () => {
    for (const file of SQL_FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
      expect(/arguments\.body/i.test(stripped)).toBe(false);
    }
  });

  it('no probe references bare `evidence_span`', () => {
    for (const file of SQL_FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8'));
      expect(/\bevidence_span\b/i.test(stripped)).toBe(false);
    }
  });

  it('every probe first non-empty line is a comment referencing the card', () => {
    for (const file of SQL_FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const firstNonEmpty = src
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      expect(firstNonEmpty).toBeDefined();
      expect(firstNonEmpty?.startsWith('--')).toBe(true);
      expect(firstNonEmpty).toContain(CARD);
    }
  });

  it('every probe ends with a terminating semicolon', () => {
    for (const file of SQL_FILES) {
      const stripped = stripSqlComments(fs.readFileSync(file, 'utf8')).trim();
      expect(stripped.endsWith(';')).toBe(true);
    }
  });

  it('no probe contains a secret-shaped literal', () => {
    for (const file of SQL_FILES) {
      const src = fs.readFileSync(file, 'utf8');
      for (const [label, re] of SECRET_SHAPES) {
        expect({ file: path.basename(file), label, hit: re.test(src) }).toEqual({
          file: path.basename(file),
          label,
          hit: false,
        });
      }
    }
  });
});

describe(`${CARD} — Stage-1 gate-probe shell wrapper safety`, () => {
  it('all five wrappers exist under scripts/ops/stage1/', () => {
    for (const f of SH_FILES) {
      expect(fs.existsSync(f)).toBe(true);
    }
  });

  it('each wrapper opens with shebang, set -uo pipefail, then set +x', () => {
    for (const file of SH_FILES) {
      const lines = fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim());
      expect(lines[0]).toBe('#!/usr/bin/env bash');
      const idxPipefail = lines.indexOf('set -uo pipefail');
      const idxNoXtrace = lines.indexOf('set +x');
      expect(idxPipefail).toBeGreaterThan(0);
      expect(idxNoXtrace).toBeGreaterThan(idxPipefail);
    }
  });

  it('each wrapper runs only read-only linked db query on a sibling-dir SQL file', () => {
    for (const file of SH_FILES) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).toContain('npx supabase db query --linked --file scripts/ops-stage1-sql/');
      // No secrets-set / push / deploy / percentage mutation in a read-only probe.
      expect(/supabase\s+secrets\s+set/i.test(src)).toBe(false);
      expect(/supabase\s+db\s+push/i.test(src)).toBe(false);
      expect(/supabase\s+functions\s+deploy/i.test(src)).toBe(false);
      expect(/CLASSIFIER_QUEUE_ROUTING_/.test(src)).toBe(false);
    }
  });

  it('no wrapper contains any banned token (including inside # comments)', () => {
    const banned: Array<[string, RegExp]> = [
      ['SERVICE_ROLE', /service[_-]?role/i],
      ['ANTHROPIC_API_KEY', /ANTHROPIC_API_KEY/],
      ['anthropic', /anthropic/i],
      ['xai', /\bxai\b/i],
      ['X_BEARER_TOKEN', /X_BEARER_TOKEN/],
      ['Authorization', /authorization/i],
      ['Bearer-space', /Bearer /],
      ['sk-ant-', /sk-ant-/],
      ['sb_secret', /sb_secret/],
      ['xai- literal', /xai-[A-Za-z0-9]/],
    ];
    for (const file of SH_FILES) {
      const src = fs.readFileSync(file, 'utf8');
      for (const [label, re] of banned) {
        expect({ file: path.basename(file), label, hit: re.test(src) }).toEqual({
          file: path.basename(file),
          label,
          hit: false,
        });
      }
    }
  });
});
