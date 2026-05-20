/**
 * MCP-012 — Semantic call router: forbidden-import source scan.
 *
 * Mirrors `__tests__/semanticRefereeNoLiveAi.test.ts`. Statically proves the
 * five new MCP-012 source files are pure TypeScript: no provider SDK, no
 * network library, no Supabase, no React, no `Deno`, no `process` / env read,
 * no `fetch`, no `console.log`, no `async`. Also proves `semanticCache.ts`
 * value-imports `serializeSemanticCacheKey` from MCP-011 and does NOT
 * re-derive it.
 */

import * as fs from 'fs';
import * as path from 'path';

const SR_DIR = path.join(__dirname, '..', 'src', 'features', 'semanticReferee');

/** The five new MCP-012 source files. */
const MCP012_FILES = [
  'triggerGates.ts',
  'classifierBatching.ts',
  'semanticCache.ts',
  'tokenBudget.ts',
  'retryPolicy.ts',
];

function readSrc(file: string): string {
  return fs.readFileSync(path.join(SR_DIR, file), 'utf8');
}

/** Collect every value import (NOT `import type`) statement in a source file. */
function valueImportLines(src: string): string[] {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inImport = false;
  let isTypeOnly = false;
  let buf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inImport) {
      if (/^import\s+type\b/.test(trimmed)) {
        if (!/;\s*$/.test(trimmed)) {
          inImport = true;
          isTypeOnly = true;
          buf = [trimmed];
        }
      } else if (/^import\s+/.test(trimmed) || /^export\s+\*\s+from/.test(trimmed)) {
        inImport = true;
        isTypeOnly = false;
        buf = [trimmed];
        if (/;\s*$/.test(trimmed)) {
          if (!isTypeOnly) out.push(buf.join(' '));
          inImport = false;
          buf = [];
        }
      }
    } else {
      buf.push(trimmed);
      if (/;\s*$/.test(trimmed)) {
        if (!isTypeOnly) out.push(buf.join(' '));
        inImport = false;
        buf = [];
      }
    }
  }
  return out;
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

const FORBIDDEN_IMPORT_SPECIFIERS = [
  'node-fetch',
  'undici',
  'axios',
  "'http'",
  '"http"',
  "'https'",
  '"https"',
  "'net'",
  '"net"',
  '@anthropic-ai/sdk',
  "'openai'",
  '"openai"',
  '@supabase/supabase-js',
  "'react'",
  '"react"',
  "'react-native'",
  '"react-native"',
  "'expo-",
  '"expo-',
];

describe('MCP-012 forbidden-imports — value imports are pure', () => {
  for (const file of MCP012_FILES) {
    describe(file, () => {
      const valueImports = valueImportLines(readSrc(file)).join('\n');

      it('imports no provider SDK / network library / Supabase / React', () => {
        for (const spec of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect(valueImports.includes(spec)).toBe(false);
        }
      });

      it('value-imports no zod (only MCP-011 validator may)', () => {
        expect(/from\s+['"]zod['"]/.test(valueImports)).toBe(false);
      });
    });
  }
});

describe('MCP-012 forbidden-imports — no network / env / Deno in executable code', () => {
  for (const file of MCP012_FILES) {
    const code = stripCommentsAndStrings(readSrc(file));

    it(`${file} calls no fetch / XMLHttpRequest`, () => {
      expect(/\bfetch\s*\(/.test(code)).toBe(false);
      expect(code.includes('XMLHttpRequest')).toBe(false);
    });

    it(`${file} references no Deno`, () => {
      expect(/\bDeno\b/.test(code)).toBe(false);
    });

    it(`${file} reads no process / process.env`, () => {
      expect(code.includes('process.env')).toBe(false);
      expect(/\bprocess\b/.test(code)).toBe(false);
    });

    it(`${file} references no provider / service-role secret name`, () => {
      const raw = readSrc(file);
      expect(raw.includes('ANTHROPIC_API_KEY')).toBe(false);
      expect(raw.includes('XAI_API_KEY')).toBe(false);
      expect(raw.includes('SERVICE_ROLE')).toBe(false);
      expect(raw.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
    });

    it(`${file} contains no console.log call (pure model — no logging)`, () => {
      expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
    });

    it(`${file} declares no async function (the card is fully synchronous)`, () => {
      expect(/\basync\b/.test(code)).toBe(false);
    });

    it(`${file} sets no setTimeout / setInterval (the retry executor is MCP-016's)`, () => {
      expect(/\bsetTimeout\s*\(/.test(code)).toBe(false);
      expect(/\bsetInterval\s*\(/.test(code)).toBe(false);
    });
  }
});

describe('MCP-012 forbidden-imports — semanticCache.ts reuses the MCP-011 key', () => {
  const cacheSrc = readSrc('semanticCache.ts');
  const cacheValueImports = valueImportLines(cacheSrc).join('\n');

  it('value-imports serializeSemanticCacheKey from ./semanticRefereeCacheKey', () => {
    const importsSerializer =
      cacheValueImports.includes('serializeSemanticCacheKey') &&
      /from\s+['"]\.\/semanticRefereeCacheKey['"]/.test(cacheValueImports);
    expect(importsSerializer).toBe(true);
  });

  it('does NOT re-derive serializeSemanticCacheKey — no local definition', () => {
    const code = stripCommentsAndStrings(cacheSrc);
    // A local definition would look like `function serializeSemanticCacheKey(`
    // or `const serializeSemanticCacheKey =`. The import-reference is fine; a
    // DEFINITION is not.
    expect(/function\s+serializeSemanticCacheKey\b/.test(code)).toBe(false);
    expect(/const\s+serializeSemanticCacheKey\b/.test(code)).toBe(false);
  });

  it('does NOT re-derive the FNV-1a hash (no local fnv1a32 / hashClassifierSet)', () => {
    const code = stripCommentsAndStrings(cacheSrc);
    expect(/function\s+fnv1a32\b/.test(code)).toBe(false);
    expect(/function\s+hashClassifierSet\b/.test(code)).toBe(false);
  });

  it('does NOT define a second SemanticCacheKey type / interface', () => {
    const code = stripCommentsAndStrings(cacheSrc);
    expect(/interface\s+SemanticCacheKey\b/.test(code)).toBe(false);
    expect(/type\s+SemanticCacheKey\b/.test(code)).toBe(false);
  });
});

describe('MCP-012 forbidden-imports — index.ts append-only', () => {
  it('still re-exports the four MCP-011 modules and adds the five MCP-012 modules', () => {
    const indexSrc = readSrc('index.ts');
    // MCP-011 (must remain).
    expect(indexSrc.includes("export * from './semanticRefereeTypes'")).toBe(true);
    expect(indexSrc.includes("export * from './semanticRefereeValidator'")).toBe(true);
    expect(indexSrc.includes("export * from './semanticRefereeCacheKey'")).toBe(true);
    expect(indexSrc.includes("export * from './semanticRefereeFixtures'")).toBe(true);
    // MCP-012 (appended).
    expect(indexSrc.includes("export * from './triggerGates'")).toBe(true);
    expect(indexSrc.includes("export * from './classifierBatching'")).toBe(true);
    expect(indexSrc.includes("export * from './semanticCache'")).toBe(true);
    expect(indexSrc.includes("export * from './tokenBudget'")).toBe(true);
    expect(indexSrc.includes("export * from './retryPolicy'")).toBe(true);
  });
});
