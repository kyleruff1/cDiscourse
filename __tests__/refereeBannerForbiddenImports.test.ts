/**
 * MCP-014 — Referee banner library: forbidden-import source scan.
 *
 * Mirrors `__tests__/refereeLedgerForbiddenImports.test.ts`. Statically proves
 * the six `src/features/refereeBanners/*.ts` files are pure TypeScript: no
 * provider SDK, no network library, no Supabase, no React / react-native /
 * expo, no `Deno`, no `process.env`, no `fetch(`, no `console.log`. The only
 * cross-feature imports allowed are `import type` from MCP-011 / MCP-013 and
 * the runtime import of `gameCopy.ts` (which the library itself does NOT use —
 * only the deferred render component will).
 */

import * as fs from 'fs';
import * as path from 'path';

const RB_DIR = path.join(__dirname, '..', 'src', 'features', 'refereeBanners');

/** The six MCP-014 source files. */
const REFEREE_BANNER_FILES = [
  'types.ts',
  'accessibilityLabel.ts',
  'refereeBannerLibrary.ts',
  'classifierBannerMap.ts',
  'selectBanner.ts',
  'index.ts',
];

function readSrc(file: string): string {
  return fs.readFileSync(path.join(RB_DIR, file), 'utf8');
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
        if (
          /from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed) ||
          /;\s*$/.test(trimmed)
        ) {
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
  "'zod'",
];

describe('MCP-014 forbidden-imports — refereeBanners files are pure TS', () => {
  for (const file of REFEREE_BANNER_FILES) {
    describe(file, () => {
      const imports = importLines(readSrc(file)).join('\n');

      it('imports no provider SDK / network library / Supabase / React / zod', () => {
        for (const spec of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect(imports.includes(spec)).toBe(false);
        }
      });
    });
  }
});

describe('MCP-014 forbidden-imports — no network / env / Deno in executable code', () => {
  for (const file of REFEREE_BANNER_FILES) {
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

    it(`${file} declares no async function (the model is fully synchronous)`, () => {
      expect(/\basync\b/.test(code)).toBe(false);
    });
  }
});

describe('MCP-014 forbidden-imports — only the documented cross-feature imports', () => {
  /**
   * Allowed cross-feature import path fragments:
   *   - `../semanticReferee/` — MCP-011 type contract (import type only).
   *   - `../refereeLedger/`   — MCP-013 type contract (import type only).
   *   - `../arguments/gameCopy` — the plain-language map (runtime allowed).
   *   - `../../lib/constitution/semanticClassifierCatalog` — the per-id
   *     catalog source of truth (post-MCP-MOD-006). `CLASSIFIER_TO_BANNERS`
   *     is now a derived view over `SEMANTIC_CLASSIFIER_CATALOG`'s
   *     `bannerCodePriorityList` field; the runtime import is required.
   * Everything else is a violation.
   */
  const ALLOWED_CROSS_FEATURE = [
    '../semanticReferee/',
    '../refereeLedger/',
    '../arguments/gameCopy',
    '../../lib/constitution/semanticClassifierCatalog',
  ];

  for (const file of REFEREE_BANNER_FILES) {
    it(`${file} imports nothing outside refereeBanners except the documented modules`, () => {
      const imports = importLines(readSrc(file));
      for (const line of imports) {
        const m = line.match(/from\s+['"]([^'"]+)['"]/);
        if (!m) continue;
        const spec = m[1];
        // A relative import that climbs out of the feature dir.
        if (spec.startsWith('../')) {
          const allowed = ALLOWED_CROSS_FEATURE.some((frag) =>
            spec.startsWith(frag),
          );
          expect(allowed ? null : `${file}: forbidden import ${spec}`).toBeNull();
        }
        // Same-dir relative imports (`./...`) are always fine.
      }
    });
  }

  it('the MCP-011 / MCP-013 imports are type-only', () => {
    // types.ts and the data files reference MCP-011 / MCP-013 — every such
    // import must be `import type` (the contract is consumed, never executed).
    // The semantic-classifier catalog (post-MCP-MOD-006) is a RUNTIME import
    // and is NOT subject to the type-only constraint; the loop skips it.
    for (const file of ['types.ts', 'refereeBannerLibrary.ts', 'classifierBannerMap.ts']) {
      const imports = importLines(readSrc(file));
      for (const line of imports) {
        const m = line.match(/from\s+['"]([^'"]+)['"]/);
        if (!m) continue;
        const spec = m[1];
        if (
          spec.startsWith('../semanticReferee/') ||
          spec.startsWith('../refereeLedger/')
        ) {
          expect(/^import\s+type\b/.test(line)).toBe(true);
        }
      }
    }
  });

  it('no MCP-011 / MCP-013 source file imports from refereeBanners (dependency points one way)', () => {
    const SR_DIR = path.join(__dirname, '..', 'src', 'features', 'semanticReferee');
    const RL_DIR = path.join(__dirname, '..', 'src', 'features', 'refereeLedger');
    for (const dir of [SR_DIR, RL_DIR]) {
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.ts')) continue;
        const src = fs.readFileSync(path.join(dir, file), 'utf8');
        expect(src.includes('refereeBanners')).toBe(false);
      }
    }
  });
});
