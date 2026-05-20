/**
 * MCP-011 — Semantic referee no-live-call source scan.
 *
 * Statically proves the entire `src/features/semanticReferee/` directory is
 * pure TypeScript: no provider SDK, no `fetch` / network primitive, no
 * Supabase, no React, no `Deno`, no `process.env` / `.env` read. Because there
 * is no provider seam in MCP-011, the absence is structural, not behavioral.
 */

import * as fs from 'fs';
import * as path from 'path';

const SR_DIR = path.join(__dirname, '..', 'src', 'features', 'semanticReferee');
const SR_FILES = [
  'semanticRefereeTypes.ts',
  'semanticRefereeValidator.ts',
  'semanticRefereeFixtures.ts',
  'semanticRefereeCacheKey.ts',
  'index.ts',
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

describe('MCP-011 no-live-AI — value imports are pure', () => {
  for (const file of SR_FILES) {
    describe(file, () => {
      const valueImports = valueImportLines(readSrc(file)).join('\n');

      it('imports no provider SDK / network library / Supabase / React', () => {
        for (const spec of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect(valueImports.includes(spec)).toBe(false);
        }
      });
    });
  }

  it('only semanticRefereeValidator.ts value-imports zod', () => {
    for (const file of SR_FILES) {
      const valueImports = valueImportLines(readSrc(file)).join('\n');
      const importsZod = /from\s+['"]zod['"]/.test(valueImports);
      if (file === 'semanticRefereeValidator.ts') {
        expect(importsZod).toBe(true);
      } else {
        expect(importsZod).toBe(false);
      }
    }
  });

  it('semanticRefereeTypes.ts is runtime-dependency-free (no value import)', () => {
    const valueImports = valueImportLines(readSrc('semanticRefereeTypes.ts'));
    expect(valueImports.length).toBe(0);
  });
});

describe('MCP-011 no-live-AI — no network / env / Deno in executable code', () => {
  for (const file of SR_FILES) {
    const code = stripCommentsAndStrings(readSrc(file));

    it(`${file} calls no fetch / XMLHttpRequest`, () => {
      expect(/\bfetch\s*\(/.test(code)).toBe(false);
      expect(code.includes('XMLHttpRequest')).toBe(false);
    });

    it(`${file} references no Deno`, () => {
      expect(/\bDeno\b/.test(code)).toBe(false);
    });

    it(`${file} reads no process.env / env var`, () => {
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
  }
});

describe('MCP-011 no-live-AI — no user-reachable strings to ban-scan', () => {
  it('the card surfaces no user-facing copy (the set is empty by design)', () => {
    // MCP-011 has no gameCopy code and no user-facing string field. The
    // assertion here is structural: the public surface exports types,
    // validator functions, fixtures, and the cache-key helper only — no
    // function whose return value is a rendered user string.
    const indexSrc = readSrc('index.ts');
    expect(indexSrc.includes('gameCopy')).toBe(false);
    expect(indexSrc.includes('toPlainLanguage')).toBe(false);
  });
});
