/**
 * MCP-016 — semantic-referee no-live-call source scan.
 *
 * Statically proves the entire `semantic-referee` Edge Function + its
 * `_shared/semanticReferee/` module tree make NO live AI call: no `fetch`, no
 * provider host literal, no provider SDK import, and no `anthropicProvider.ts` /
 * `mcpAdapter.ts` module behind the stubbed registry slots.
 *
 * Because there is no live provider in MCP-016, the absence is structural — a
 * reviewer who sees a provider call, a key read, or a deploy step blocks the
 * card (MCP-016 design §"Risks").
 */
import * as fs from 'fs';
import * as path from 'path';

const FN_DIR = path.join(process.cwd(), 'supabase/functions/semantic-referee');
const SHARED_DIR = path.join(process.cwd(), 'supabase/functions/_shared/semanticReferee');

/** Every MCP-016-owned source file in the function + shared tree. */
const FN_FILES = ['index.ts'];
const SHARED_FILES = [
  'types.ts',
  'schema.ts',
  'redaction.ts',
  'mockProvider.ts',
  'fixtureProvider.ts',
  'fixtures.ts',
  'providerRouting.ts',
  'providers.ts',
];

function readFn(file: string): string {
  return fs.readFileSync(path.join(FN_DIR, file), 'utf8');
}
function readShared(file: string): string {
  return fs.readFileSync(path.join(SHARED_DIR, file), 'utf8');
}

/** Strip comments + string literals so a scan only sees executable code. */
function stripCommentsAndStrings(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\/\/[^\n]*/g, '');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``');
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

describe('MCP-016 no-live-call — the shared provider tree exists with no live module', () => {
  it('the _shared/semanticReferee tree contains exactly the mock-only file set', () => {
    const actual = fs.readdirSync(SHARED_DIR).filter((f) => f.endsWith('.ts')).sort();
    expect(actual).toEqual([...SHARED_FILES].sort());
  });

  it('no anthropicProvider.ts is present (the anthropic slot is a stub)', () => {
    expect(fs.existsSync(path.join(SHARED_DIR, 'anthropicProvider.ts'))).toBe(false);
  });

  it('no mcpAdapter.ts is present (the mcp slot is a stub)', () => {
    expect(fs.existsSync(path.join(SHARED_DIR, 'mcpAdapter.ts'))).toBe(false);
  });
});

describe('MCP-016 no-live-call — no fetch / network primitive in executable code', () => {
  for (const file of FN_FILES) {
    it(`semantic-referee/${file} calls no fetch / XMLHttpRequest`, () => {
      const code = stripCommentsAndStrings(readFn(file));
      expect(/\bfetch\s*\(/.test(code)).toBe(false);
      expect(code.includes('XMLHttpRequest')).toBe(false);
    });
  }
  for (const file of SHARED_FILES) {
    it(`_shared/semanticReferee/${file} calls no fetch / XMLHttpRequest`, () => {
      const code = stripCommentsAndStrings(readShared(file));
      expect(/\bfetch\s*\(/.test(code)).toBe(false);
      expect(code.includes('XMLHttpRequest')).toBe(false);
    });
  }
});

describe('MCP-016 no-live-call — no provider host literal anywhere', () => {
  const allSrc = [
    ...FN_FILES.map(readFn),
    ...SHARED_FILES.map(readShared),
  ].join('\n');

  it('no api.anthropic.com / api.x.ai / api.openai.com / api.x.com literal', () => {
    for (const host of PROVIDER_HOST_LITERALS) {
      expect(allSrc.includes(host)).toBe(false);
    }
  });

  it('no provider SDK / network library import', () => {
    for (const spec of FORBIDDEN_IMPORT_SPECIFIERS) {
      // `openai` is a substring of other words — match it as an import target.
      const importPattern = new RegExp(`from\\s+['"][^'"]*${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^'"]*['"]`);
      expect(importPattern.test(allSrc)).toBe(false);
    }
  });
});

describe('MCP-016 no-live-call — the registry stubs are literal returns', () => {
  /** Collect every `import ... from '...'` specifier from a source file. */
  function importSpecifiers(src: string): string[] {
    return Array.from(src.matchAll(/from\s+['"]([^'"]+)['"]/g)).map((m) => m[1]);
  }

  it('providerRouting.ts returns not_implemented for anthropic and mcp with no module import', () => {
    const raw = readShared('providerRouting.ts');
    // The anthropic / mcp branch is a literal object return (scan raw source —
    // the string literal is the assertion target).
    expect(raw).toMatch(/providerName === 'anthropic' \|\| providerName === 'mcp'/);
    expect(raw).toMatch(/return \{ enabled: false, reason: 'not_implemented' \}/);
    // No provider module is IMPORTED — the comments may name the stubbed-file
    // paths for documentation, but no import specifier resolves to either.
    for (const spec of importSpecifiers(raw)) {
      expect(spec).not.toMatch(/anthropicProvider/);
      expect(spec).not.toMatch(/mcpAdapter/);
    }
  });

  it('the mock + fixture providers are synchronous (no async / await — no I/O)', () => {
    for (const file of ['mockProvider.ts', 'fixtureProvider.ts', 'providerRouting.ts']) {
      const code = stripCommentsAndStrings(readShared(file));
      expect(/\basync\b/.test(code)).toBe(false);
      expect(/\bawait\b/.test(code)).toBe(false);
    }
  });
});
