/**
 * MCP-015 — Semantic override forbidden-imports + dependency-direction scan.
 *
 * Mirrors `__tests__/refereeLedgerForbiddenImports.test.ts`. Statically proves
 * the four `src/features/semanticOverride/*.ts` files are pure TypeScript: no
 * provider SDK, no network library, no Supabase, no React / react-native /
 * expo, no `Deno`, no `process.env`, no `fetch(`, no `console.log`,
 * no `Date.now()` / `new Date(`. Also proves the dependency points ONE WAY —
 * no file under `semanticReferee/`, `refereeLedger/`, or `metadata/` imports
 * from `semanticOverride`.
 */

import * as fs from 'fs';
import * as path from 'path';

const SO_DIR = path.join(__dirname, '..', 'src', 'features', 'semanticOverride');
const SR_DIR = path.join(__dirname, '..', 'src', 'features', 'semanticReferee');
const RL_DIR = path.join(__dirname, '..', 'src', 'features', 'refereeLedger');
const META_DIR = path.join(__dirname, '..', 'src', 'features', 'metadata');

/** The four MCP-015 source files. */
const SEMANTIC_OVERRIDE_FILES = [
  'types.ts',
  'overrideTriggerModel.ts',
  'overrideRecordModel.ts',
  'index.ts',
];

function readSrc(dir: string, file: string): string {
  return fs.readFileSync(path.join(dir, file), 'utf8');
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

/** Collect every import / export-from statement, type-only included. */
function importLines(src: string): string[] {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inImport = false;
  let buf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inImport) {
      if (/^import\b/.test(trimmed) || /^export\s+(\*|\{|type)/.test(trimmed)) {
        if (/from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed) || /;\s*$/.test(trimmed)) {
          out.push(trimmed);
        } else {
          inImport = true;
          buf = [trimmed];
        }
      }
    } else {
      buf.push(trimmed);
      if (/;\s*$/.test(trimmed) || /from\s+['"][^'"]+['"]/.test(trimmed)) {
        out.push(buf.join(' '));
        inImport = false;
        buf = [];
      }
    }
  }
  return out;
}

const FORBIDDEN_IMPORT_SPECIFIERS = [
  'node-fetch',
  'undici',
  'axios',
  "'http'",
  '"http"',
  "'https'",
  "'net'",
  '@anthropic-ai/sdk',
  "'openai'",
  '@supabase/supabase-js',
  '@supabase/ssr',
  "'react'",
  '"react"',
  "'react-native'",
  '"react-native"',
  "'expo-",
  '"expo-',
  'zod',
];

describe('MCP-015 forbidden-imports — semanticOverride files are pure TS', () => {
  for (const file of SEMANTIC_OVERRIDE_FILES) {
    describe(file, () => {
      const imports = importLines(readSrc(SO_DIR, file)).join('\n');

      it('imports no provider SDK / network library / Supabase / React / zod', () => {
        for (const spec of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect({ file, spec, hit: imports.includes(spec) }).toEqual({
            file,
            spec,
            hit: false,
          });
        }
      });
    });
  }
});

describe('MCP-015 forbidden-imports — no network / env / Deno / clock in executable code', () => {
  for (const file of SEMANTIC_OVERRIDE_FILES) {
    const code = stripCommentsAndStrings(readSrc(SO_DIR, file));

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
      const raw = readSrc(SO_DIR, file);
      expect(raw.includes('ANTHROPIC_API_KEY')).toBe(false);
      expect(raw.includes('XAI_API_KEY')).toBe(false);
      expect(raw.includes('SERVICE_ROLE')).toBe(false);
      expect(raw.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
    });

    it(`${file} contains no console.log call (pure model — no logging)`, () => {
      expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
    });

    it(`${file} declares no async function (the model is fully synchronous)`, () => {
      expect(/\basync\b/.test(code)).toBe(false);
    });

    it(`${file} reads no clock — no Date.now() / new Date( (at is caller-supplied)`, () => {
      expect(code.includes('Date.now(')).toBe(false);
      expect(/\bnew\s+Date\s*\(/.test(code)).toBe(false);
    });
  }
});

describe('MCP-015 forbidden-imports — types.ts is type-only', () => {
  it('types.ts has zero runtime (value) imports', () => {
    const imports = importLines(readSrc(SO_DIR, 'types.ts'));
    for (const line of imports) {
      // Every import line in types.ts must be type-only.
      if (/^import\b/.test(line)) {
        expect(line.startsWith('import type')).toBe(true);
      }
    }
  });
});

/**
 * The one-way dependency check scans `import ... from`/`export ... from`
 * statements only — a comment that merely names the `semanticOverride`
 * directory (e.g. a doc note in `moveMetadataLedger.ts`) is not a dependency.
 */
function importsFromSemanticOverride(src: string): boolean {
  return /(?:import|export)\b[^;]*from\s+['"][^'"]*semanticOverride/.test(src);
}

describe('MCP-015 forbidden-imports — the dependency points one way', () => {
  it('no semanticReferee source file imports from semanticOverride', () => {
    for (const file of fs.readdirSync(SR_DIR)) {
      if (!file.endsWith('.ts')) continue;
      expect(importsFromSemanticOverride(readSrc(SR_DIR, file))).toBe(false);
    }
  });

  it('no refereeLedger source file imports from semanticOverride', () => {
    for (const file of fs.readdirSync(RL_DIR)) {
      if (!file.endsWith('.ts')) continue;
      expect(importsFromSemanticOverride(readSrc(RL_DIR, file))).toBe(false);
    }
  });

  it('no metadata source file imports from semanticOverride', () => {
    for (const file of fs.readdirSync(META_DIR)) {
      if (!file.endsWith('.ts')) continue;
      expect(importsFromSemanticOverride(readSrc(META_DIR, file))).toBe(false);
    }
  });

  it('gameCopy.ts imports nothing from semanticOverride', () => {
    const src = readSrc(
      path.join(__dirname, '..', 'src', 'features', 'arguments'),
      'gameCopy.ts',
    );
    expect(/from\s+['"][^'"]*semanticOverride/.test(src)).toBe(false);
  });

  it('moveMetadataLedger.ts imports nothing from semanticOverride', () => {
    const src = readSrc(META_DIR, 'moveMetadataLedger.ts');
    expect(/from\s+['"][^'"]*semanticOverride/.test(src)).toBe(false);
  });
});

describe('MCP-015 forbidden-imports — semanticOverride consumes the right modules', () => {
  it('overrideTriggerModel.ts type-imports from semanticReferee and refereeLedger', () => {
    const src = readSrc(SO_DIR, 'overrideTriggerModel.ts');
    expect(/from\s+['"]\.\.\/semanticReferee\//.test(src)).toBe(true);
    expect(/from\s+['"]\.\.\/refereeLedger\//.test(src)).toBe(true);
  });

  it('overrideRecordModel.ts type-imports the MetadataEvent from metadata', () => {
    const src = readSrc(SO_DIR, 'overrideRecordModel.ts');
    expect(/from\s+['"]\.\.\/metadata\/moveMetadataLedger['"]/.test(src)).toBe(true);
  });
});
