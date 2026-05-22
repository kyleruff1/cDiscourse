/**
 * MCP-016 / MCP-017 — semantic-referee forbidden-secrets source scan.
 *
 * Proves the semantic-referee file surface reads no provider key in EXECUTABLE
 * code (outside the one live-provider file), names no service-role key, logs no
 * Authorization header / key / JWT / raw provider body, and carries no
 * contiguous secret-shaped literal in the diff.
 *
 * Mirrors the CLAUDE.md secrets-policy check
 * (`grep -r "ANTHROPIC_API_KEY|SERVICE_ROLE" app/ src/` → zero matches),
 * scoped to the semantic-referee surface.
 *
 * MCP-017 NOTE: MCP-017 adds the live `anthropicProvider.ts`, which legitimately
 * reads `ANTHROPIC_API_KEY` via `Deno.env.get()`. That single file is covered by
 * the dedicated `semanticAnthropicSourceScan.test.ts` (which proves the key is
 * read in EXACTLY that one file). This suite keeps scanning the MCP-016 file
 * set; it additionally scans the three new zod-free files — `seedPrompt.ts`,
 * `anthropicClassifierCore.ts`, `contentSafetyScan.ts`, plus `providerRoutingCore.ts`
 * — none of which reads a key. `anthropicProvider.ts` is intentionally NOT in
 * the scanned set here (its key read is expected; the source-scan suite owns
 * it). `providers.ts` NAMES the key in its docblock to document the boundary
 * ("ANTHROPIC_API_KEY is read only inside anthropicProvider.ts") — it is
 * comment-exempt below, exactly as `edgeFunctions.ts` already is; the
 * executable-code scan still proves it never READS the key.
 */
import * as fs from 'fs';
import * as path from 'path';

const FN_INDEX = path.join(process.cwd(), 'supabase/functions/semantic-referee/index.ts');
const SHARED_DIR = path.join(process.cwd(), 'supabase/functions/_shared/semanticReferee');
const EDGE_FUNCTIONS = path.join(process.cwd(), 'src/lib/edgeFunctions.ts');

const SHARED_FILES = [
  'types.ts',
  'schema.ts',
  'redaction.ts',
  'mockProvider.ts',
  'fixtureProvider.ts',
  'fixtures.ts',
  'providerRouting.ts',
  'providerRoutingCore.ts',
  'providers.ts',
  // MCP-017 zod-free additions — none reads a provider key.
  'seedPrompt.ts',
  'anthropicClassifierCore.ts',
  'contentSafetyScan.ts',
];

/**
 * Files allowed to NAME a provider key in a docblock comment (never in
 * executable code). `edgeFunctions.ts` predates MCP-016; `providers.ts`
 * documents the MCP-017 key boundary ("ANTHROPIC_API_KEY is read only inside
 * anthropicProvider.ts"). The executable-code scan below still proves both of
 * them never READ the key.
 */
const COMMENT_EXEMPT = new Set<string>([
  'src/lib/edgeFunctions.ts',
  '_shared/semanticReferee/providers.ts',
]);

const MCP016_SOURCES: { name: string; src: string }[] = [
  { name: 'semantic-referee/index.ts', src: fs.readFileSync(FN_INDEX, 'utf8') },
  ...SHARED_FILES.map((f) => ({
    name: `_shared/semanticReferee/${f}`,
    src: fs.readFileSync(path.join(SHARED_DIR, f), 'utf8'),
  })),
  { name: 'src/lib/edgeFunctions.ts', src: fs.readFileSync(EDGE_FUNCTIONS, 'utf8') },
];

/** Strip comments + string literals so an executable-code scan is clean. */
function stripCommentsAndStrings(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\/\/[^\n]*/g, '');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``');
  return out;
}

describe('MCP-016 secrets — no provider key is read or named in executable code', () => {
  // The pre-existing `src/lib/edgeFunctions.ts` carries doctrinal COMMENTS that
  // name `ANTHROPIC_API_KEY` / `SERVICE_ROLE` as things the file must never use
  // — those comments are not executable code and predate MCP-016. The scan
  // strips comments + string literals so it asserts the real rule: no provider
  // key / service-role key is READ or REFERENCED in executable code.
  for (const { name, src } of MCP016_SOURCES) {
    const code = stripCommentsAndStrings(src);

    it(`${name} references no provider key in executable code`, () => {
      expect(code.includes('ANTHROPIC_API_KEY')).toBe(false);
      expect(code.includes('XAI_API_KEY')).toBe(false);
      expect(code.includes('OPENAI_API_KEY')).toBe(false);
      expect(code.includes('SEMANTIC_REFEREE_MCP_TOKEN')).toBe(false);
    });

    it(`${name} references no service-role key in executable code`, () => {
      expect(code.includes('SERVICE_ROLE')).toBe(false);
      expect(code.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
    });
  }

  it('the semantic-referee tree names no provider key at all (even in comments), outside the documented boundary', () => {
    // The MCP-016 + MCP-017 zod-free files carry zero secret-name literal —
    // comments included — EXCEPT the COMMENT_EXEMPT set, where `providers.ts`
    // documents the MCP-017 key boundary in its docblock. The live
    // `anthropicProvider.ts` is not in MCP016_SOURCES at all (the dedicated
    // source-scan suite owns it).
    for (const { name, src } of MCP016_SOURCES) {
      if (!name.startsWith('_shared/') && !name.startsWith('semantic-referee/')) continue;
      if (COMMENT_EXEMPT.has(name)) continue;
      expect(src.includes('ANTHROPIC_API_KEY')).toBe(false);
      expect(src.includes('XAI_API_KEY')).toBe(false);
      expect(src.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
    }
  });
});

describe('MCP-016 secrets — the function reads only the two feature-flag env vars', () => {
  const fnTreeSources = MCP016_SOURCES.filter((s) => !s.name.startsWith('src/'));

  it('the only Deno.env.get keys are SEMANTIC_REFEREE_ENABLED / _PROVIDER (+ shared client vars)', () => {
    const allowedEnvKeys = new Set([
      'SEMANTIC_REFEREE_ENABLED',
      'SEMANTIC_REFEREE_PROVIDER',
    ]);
    for (const { name, src } of fnTreeSources) {
      const matches = src.match(/Deno\.env\.get\(['"]([^'"]+)['"]\)/g) ?? [];
      for (const m of matches) {
        const key = /Deno\.env\.get\(['"]([^'"]+)['"]\)/.exec(m)?.[1];
        // supabaseClients.ts (not an MCP-016 file) owns SUPABASE_URL etc.; the
        // MCP-016 tree itself reads only the two feature-flag vars.
        expect(allowedEnvKeys.has(key ?? '')).toBe(true);
        expect(name).toBeTruthy();
      }
    }
  });
});

describe('MCP-016 secrets — no Authorization / key / JWT is logged', () => {
  for (const { name, src } of MCP016_SOURCES) {
    it(`${name} never console.logs an Authorization header / key / Bearer token`, () => {
      // No console call whose argument mentions a secret-ish identifier.
      expect(/console\.\w+\([^)]*[Aa]uthorization/.test(src)).toBe(false);
      expect(/console\.\w+\([^)]*Bearer/.test(src)).toBe(false);
      expect(/console\.\w+\([^)]*API_KEY/.test(src)).toBe(false);
      expect(/console\.\w+\([^)]*SERVICE_ROLE/.test(src)).toBe(false);
    });

    it(`${name} contains no console.log call`, () => {
      const code = stripCommentsAndStrings(src);
      expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
    });
  }
});

describe('MCP-016 secrets — no contiguous secret-shaped literal in the diff', () => {
  for (const { name, src } of MCP016_SOURCES) {
    it(`${name} carries no sk-ant / xai- / sb_secret / Bearer-token / JWT literal`, () => {
      // Assemble the patterns from fragments so this TEST file itself carries
      // no contiguous banned literal.
      expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{8}').test(src)).toBe(false);
      expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{12}').test(src)).toBe(false);
      expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{8}').test(src)).toBe(false);
      expect(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(src)).toBe(false);
      expect(/\bBearer\s+[A-Za-z0-9._-]{16,}/.test(src)).toBe(false);
    });
  }
});
