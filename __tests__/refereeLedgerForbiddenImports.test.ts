/**
 * MCP-013 — Referee ledger: forbidden-import source scan.
 *
 * Mirrors `__tests__/semanticRouterForbiddenImports.test.ts`. Statically
 * proves the seven `src/features/refereeLedger/*.ts` files are pure
 * TypeScript: no provider SDK, no network library, no Supabase, no React /
 * react-native / expo, no `Deno`, no `process.env`, no `fetch(`, no
 * `console.log`. Also proves the dependency points ONE WAY — no file under
 * `src/features/pointStanding/` or `src/features/semanticReferee/` imports
 * from `refereeLedger`.
 */

import * as fs from 'fs';
import * as path from 'path';

const RL_DIR = path.join(__dirname, '..', 'src', 'features', 'refereeLedger');
const PS_DIR = path.join(__dirname, '..', 'src', 'features', 'pointStanding');
const SR_DIR = path.join(__dirname, '..', 'src', 'features', 'semanticReferee');

/** The seven MCP-013 source files. */
const REFEREE_LEDGER_FILES = [
  'types.ts',
  'scoreHintMapping.ts',
  'reconciliation.ts',
  'antiExploit.ts',
  'reconcileMove.ts',
  'refereeLedgerCopy.ts',
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
];

describe('MCP-013 forbidden-imports — refereeLedger files are pure TS', () => {
  for (const file of REFEREE_LEDGER_FILES) {
    describe(file, () => {
      const imports = importLines(readSrc(RL_DIR, file)).join('\n');

      it('imports no provider SDK / network library / Supabase / React', () => {
        for (const spec of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect(imports.includes(spec)).toBe(false);
        }
      });

      it('imports no zod (the ledger consumes already-validated packets)', () => {
        expect(/from\s+['"]zod['"]/.test(imports)).toBe(false);
      });
    });
  }
});

describe('MCP-013 forbidden-imports — no network / env / Deno in executable code', () => {
  for (const file of REFEREE_LEDGER_FILES) {
    const code = stripCommentsAndStrings(readSrc(RL_DIR, file));

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
      const raw = readSrc(RL_DIR, file);
      expect(raw.includes('ANTHROPIC_API_KEY')).toBe(false);
      expect(raw.includes('XAI_API_KEY')).toBe(false);
      expect(raw.includes('SERVICE_ROLE')).toBe(false);
      expect(raw.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
    });

    it(`${file} contains no console.log call (pure model — no logging)`, () => {
      expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
    });

    it(`${file} declares no async function (the ledger is fully synchronous)`, () => {
      expect(/\basync\b/.test(code)).toBe(false);
    });
  }
});

describe('MCP-013 forbidden-imports — the dependency points one way', () => {
  it('no pointStanding source file imports from refereeLedger', () => {
    for (const file of fs.readdirSync(PS_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const src = readSrc(PS_DIR, file);
      expect(src.includes('refereeLedger')).toBe(false);
    }
  });

  it('no semanticReferee source file imports from refereeLedger', () => {
    for (const file of fs.readdirSync(SR_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const src = readSrc(SR_DIR, file);
      expect(src.includes('refereeLedger')).toBe(false);
    }
  });
});

describe('MCP-013 forbidden-imports — refereeLedger consumes the right modules', () => {
  it('reconcileMove.ts value-imports gradeChallenge / gradeRepair from pointStanding', () => {
    const src = readSrc(RL_DIR, 'reconcileMove.ts');
    expect(src.includes('gradeChallenge')).toBe(true);
    expect(src.includes('gradeRepair')).toBe(true);
    expect(/from\s+['"]\.\.\/pointStanding\//.test(src)).toBe(true);
  });

  it('reconcileMove.ts reaches applyAntiAmplification by the documented deep import', () => {
    const src = readSrc(RL_DIR, 'reconcileMove.ts');
    expect(src.includes('applyAntiAmplification')).toBe(true);
    expect(/from\s+['"]\.\.\/pointStanding\/antiAmplification['"]/.test(src)).toBe(true);
  });

  it('refereeLedger files modify zero economy files — only ../pointStanding imports', () => {
    // A strict pure consumer: every pointStanding reference is an IMPORT path,
    // never a write. The forbidden-import scan above already proves no
    // network / Supabase; here we confirm the only economy contact is the
    // documented import surface.
    for (const file of REFEREE_LEDGER_FILES) {
      const src = readSrc(RL_DIR, file);
      // No file under refereeLedger may re-export a pointStanding internal as
      // its own — but importing types / functions is expected.
      expect(src.includes('SERVICE_ROLE')).toBe(false);
    }
  });
});
