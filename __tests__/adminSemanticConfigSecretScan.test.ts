/**
 * ADMIN-AI-001 — secret source-scan.
 *
 * Mirrors the CLAUDE.md secrets-policy check
 * (`grep -r "ANTHROPIC_API_KEY|SERVICE_ROLE" app/ src/` → zero matches),
 * scoped to the ADMIN-AI-001 surface:
 *
 *  - the new client files never reference `ANTHROPIC_API_KEY` / `SERVICE_ROLE`
 *    nor any secret-shaped literal;
 *  - `Deno.env.get('ANTHROPIC_API_KEY')` appears ONLY inside Edge Function
 *    files (`supabase/functions/`), never under `src/`;
 *  - the whole `src/` tree carries no `ANTHROPIC_API_KEY` literal in
 *    executable code (the key is server-only).
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();

/** Strip comments + string literals so an executable-code scan is clean. */
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``');
}

/** Recursively concatenate all `.ts` / `.tsx` source under a directory. */
function readTree(dir: string): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
        out.push({ rel: path.relative(repoRoot, p), src: fs.readFileSync(p, 'utf8') });
      }
    }
  }
  walk(dir);
  return out;
}

// ── 1. The new client files ──────────────────────────────────────

describe('ADMIN-AI-001 secret-scan — the new client files', () => {
  const NEW_CLIENT_FILES = [
    'src/features/admin/AdminSemanticRefereeTab.tsx',
    'src/features/admin/semanticRefereeConfigApi.ts',
  ];

  for (const rel of NEW_CLIENT_FILES) {
    const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');

    it(`${rel} references no ANTHROPIC_API_KEY / SERVICE_ROLE (anywhere)`, () => {
      expect(src).not.toContain('ANTHROPIC_API_KEY');
      expect(src).not.toContain('SERVICE_ROLE');
      expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(src).not.toContain('service_role');
    });

    it(`${rel} carries no sk-ant / sb_secret / Bearer-token / JWT literal`, () => {
      // Patterns assembled from fragments so this TEST file carries no
      // contiguous banned literal.
      expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{8}').test(src)).toBe(false);
      expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{8}').test(src)).toBe(false);
      expect(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(src)).toBe(false);
      expect(/\bBearer\s+[A-Za-z0-9._-]{16,}/.test(src)).toBe(false);
    });

    it(`${rel} never reads an env-var key value (no Deno.env, no process.env key read)`, () => {
      expect(src).not.toContain('Deno.env');
    });
  }
});

// ── 2. Deno.env.get('ANTHROPIC_API_KEY') is Edge-Function-only ───

describe('ADMIN-AI-001 secret-scan — ANTHROPIC_API_KEY is server-only', () => {
  it('no file under src/ contains ANTHROPIC_API_KEY in executable code', () => {
    for (const { rel, src } of readTree(path.join(repoRoot, 'src'))) {
      const code = stripCommentsAndStrings(src);
      // `rel` is included in the failure message via the assertion context.
      expect({ rel, hasKey: code.includes('ANTHROPIC_API_KEY') }).toEqual({
        rel,
        hasKey: false,
      });
    }
  });

  it('`Deno.env.get(ANTHROPIC_API_KEY)` appears only inside supabase/functions', () => {
    // The runtime config handler reads the key as a boolean
    // (anthropicKeyPresent) inside admin-users/index.ts — an Edge Function.
    // It must NOT appear under src/.
    const needle = "Deno.env.get('ANTHROPIC_API_KEY')";
    const srcHits = readTree(path.join(repoRoot, 'src')).filter((f) =>
      f.src.includes(needle),
    );
    expect(srcHits.map((f) => f.rel)).toEqual([]);

    const fnHits = readTree(path.join(repoRoot, 'supabase/functions')).filter((f) =>
      f.src.includes(needle),
    );
    // At least the admin-users handler reads it — proves the scan is live.
    expect(fnHits.length).toBeGreaterThan(0);
    for (const f of fnHits) {
      expect(f.rel.replace(/\\/g, '/')).toMatch(/^supabase\/functions\//);
    }
  });
});

// ── 3. The admin-users handler returns only a boolean ────────────

describe('ADMIN-AI-001 secret-scan — the Edge handler returns a key boolean only', () => {
  const handlerSrc = fs.readFileSync(
    path.join(repoRoot, 'supabase/functions/admin-users/index.ts'),
    'utf8',
  );

  it('handleGetSemanticConfig wraps the key read in Boolean(...) — never the value', () => {
    expect(handlerSrc).toMatch(/anthropicKeyPresent = Boolean\(Deno\.env\.get\('ANTHROPIC_API_KEY'\)\)/);
  });

  it('the get handler returns `anthropicKeyPresent` but never the key value', () => {
    // Isolate the handleGetSemanticConfig body, then its single `return ok({…})`
    // response object — that object must list `anthropicKeyPresent` and must
    // NOT contain the raw key literal.
    const handlerBody = handlerSrc.slice(
      handlerSrc.indexOf('async function handleGetSemanticConfig'),
      handlerSrc.indexOf('async function handleSetSemanticConfig'),
    );
    const returnIdx = handlerBody.indexOf('return ok({');
    expect(returnIdx).toBeGreaterThan(-1);
    const responseBlock = handlerBody.slice(returnIdx);
    expect(responseBlock).toContain('anthropicKeyPresent');
    expect(responseBlock).not.toContain('ANTHROPIC_API_KEY');
  });

  it('never logs the key, the Authorization header, or the service-role key', () => {
    expect(/console\.\w+\([^)]*ANTHROPIC_API_KEY/.test(handlerSrc)).toBe(false);
    expect(/console\.\w+\([^)]*[Aa]uthorization/.test(handlerSrc)).toBe(false);
    expect(/console\.\w+\([^)]*SERVICE_ROLE/.test(handlerSrc)).toBe(false);
  });
});
