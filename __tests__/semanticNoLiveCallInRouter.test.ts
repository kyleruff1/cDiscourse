/**
 * MCP-017 — semantic-referee still-pure-files no-live-call source scan.
 *
 * RETARGET of MCP-016's `semanticNoLiveCall.test.ts`. MCP-016 asserted the
 * ENTIRE `_shared/semanticReferee/` tree made no live call. MCP-017 adds the
 * one file that legitimately DOES — `anthropicProvider.ts` — and wires it
 * through `providerRouting.ts` / `providers.ts`, so the old whole-tree
 * assertion is no longer true.
 *
 * This suite narrows the scan to the files that STAY pure after MCP-017: the
 * deterministic providers (`mockProvider.ts`, `fixtureProvider.ts`), the
 * defensive redaction (`redaction.ts`), the zod-free live-provider core
 * (`seedPrompt.ts`, `anthropicClassifierCore.ts`, `contentSafetyScan.ts`), the
 * contract types (`types.ts`), and the fixture map (`fixtures.ts`). None of
 * these makes a `fetch`, names a provider host, or imports a provider SDK.
 *
 * The two files MCP-017 deliberately makes / wires a live call —
 * `anthropicProvider.ts` and the `providerRouting.ts` / `providers.ts` pair —
 * are NOT scanned here; they are covered by `semanticAnthropicSourceScan.test.ts`
 * instead. `providerRoutingCore.ts` is zod-free and makes no `fetch`, but its
 * routing switch is now legitimately `async` (it awaits the live provider), so
 * the "no async / await" assertion below cannot include it.
 *
 * The retarget keeps every still-valid MCP-016 assertion. It also continues to
 * assert `mcpAdapter.ts` does NOT exist (the `mcp` slot stays a stub).
 *
 * Net test count vs MCP-016's `semanticNoLiveCall.test.ts`: the file is renamed
 * and re-scoped; the assertions that became false (whole-tree no-fetch,
 * `anthropicProvider.ts` absence, `providerRouting.ts` literal-stub) move to
 * the new source-scan suite.
 */
import * as fs from 'fs';
import * as path from 'path';

const SHARED_DIR = path.join(process.cwd(), 'supabase/functions/_shared/semanticReferee');

/**
 * The `_shared/semanticReferee/` files that STAY pure after MCP-017 — they make
 * no live call, name no provider host, and import no provider SDK.
 */
const STILL_PURE_SHARED_FILES = [
  'mockProvider.ts',
  'fixtureProvider.ts',
  'redaction.ts',
  'seedPrompt.ts',
  'anthropicClassifierCore.ts',
  'contentSafetyScan.ts',
  'types.ts',
  'fixtures.ts',
];

function readShared(file: string): string {
  return fs.readFileSync(path.join(SHARED_DIR, file), 'utf8');
}

/**
 * Strip comments + string literals so a scan only sees executable code. A
 * char-scanner — NOT a naive regex — so a nested template literal (e.g.
 * `mockProvider.ts`'s `` `mock-${hashToken(fnv1a(`...`))}` ``) cannot make a
 * regex consume a runaway span and silently drop real code. `${...}`
 * interpolations are code, so they are KEPT; only the literal text is blanked.
 */
function stripCommentsAndStrings(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      out += quote + quote;
      i += 1;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (c === '`') {
      out += '`';
      i += 1;
      while (i < n) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === '`') {
          out += '`';
          i += 1;
          break;
        }
        if (src[i] === '$' && src[i + 1] === '{') {
          out += '${';
          i += 2;
          let depth = 1;
          const codeStart = i;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth += 1;
            else if (src[i] === '}') depth -= 1;
            if (depth === 0) break;
            i += 1;
          }
          out += stripCommentsAndStrings(src.slice(codeStart, i));
          out += '}';
          i += 1;
          continue;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const PROVIDER_HOST_LITERALS = [
  'api.anthropic.com',
  'api.x.ai',
  'api.openai.com',
  'api.x.com',
];

const FORBIDDEN_IMPORT_SPECIFIERS = [
  '@anthropic-ai/sdk',
  'openai',
  'node-fetch',
  'axios',
  'undici',
];

describe('MCP-017 no-live-call — every still-pure shared file is present', () => {
  it('each still-pure file exists in the _shared/semanticReferee tree', () => {
    for (const file of STILL_PURE_SHARED_FILES) {
      expect(fs.existsSync(path.join(SHARED_DIR, file))).toBe(true);
    }
  });

  it('no mcpAdapter.ts is present (the mcp slot is still a stub)', () => {
    expect(fs.existsSync(path.join(SHARED_DIR, 'mcpAdapter.ts'))).toBe(false);
  });
});

describe('MCP-017 no-live-call — the still-pure files make no fetch / network primitive', () => {
  for (const file of STILL_PURE_SHARED_FILES) {
    it(`_shared/semanticReferee/${file} calls no fetch / XMLHttpRequest`, () => {
      const code = stripCommentsAndStrings(readShared(file));
      expect(/\bfetch\s*\(/.test(code)).toBe(false);
      expect(code.includes('XMLHttpRequest')).toBe(false);
    });
  }
});

describe('MCP-017 no-live-call — the still-pure files name no provider host', () => {
  const allSrc = STILL_PURE_SHARED_FILES.map(readShared).join('\n');

  it('no api.anthropic.com / api.x.ai / api.openai.com / api.x.com literal', () => {
    for (const host of PROVIDER_HOST_LITERALS) {
      expect(allSrc.includes(host)).toBe(false);
    }
  });

  it('no provider SDK / network library import', () => {
    for (const spec of FORBIDDEN_IMPORT_SPECIFIERS) {
      const importPattern = new RegExp(
        `from\\s+['"][^'"]*${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^'"]*['"]`,
      );
      expect(importPattern.test(allSrc)).toBe(false);
    }
  });
});

describe('MCP-017 no-live-call — the still-pure files read no Deno.env', () => {
  // The disabled-by-default flags are read in `providers.ts`; the live key is
  // read in `anthropicProvider.ts`. None of the STILL-pure files reads env.
  for (const file of STILL_PURE_SHARED_FILES) {
    it(`_shared/semanticReferee/${file} does not call Deno.env.get`, () => {
      const code = stripCommentsAndStrings(readShared(file));
      expect(/Deno\.env\.get/.test(code)).toBe(false);
    });
  }
});

describe('MCP-017 no-live-call — the deterministic providers stay synchronous', () => {
  // The mock + fixture providers + the redaction pass + the zod-free
  // live-provider core's pure functions do no I/O — they stay synchronous.
  // `providerRoutingCore.ts` is deliberately EXCLUDED: its routing switch is
  // now `async` (it awaits the live `anthropic` provider).
  const SYNCHRONOUS_FILES = [
    'mockProvider.ts',
    'fixtureProvider.ts',
    'redaction.ts',
    'seedPrompt.ts',
    'anthropicClassifierCore.ts',
    'contentSafetyScan.ts',
  ];
  for (const file of SYNCHRONOUS_FILES) {
    it(`_shared/semanticReferee/${file} contains no async / await (no I/O)`, () => {
      const code = stripCommentsAndStrings(readShared(file));
      expect(/\basync\b/.test(code)).toBe(false);
      expect(/\bawait\b/.test(code)).toBe(false);
    });
  }
});
