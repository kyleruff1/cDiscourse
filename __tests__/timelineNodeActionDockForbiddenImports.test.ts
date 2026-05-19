/**
 * SC-004 — Forbidden-imports source scan.
 *
 * Per design §"Doctrine self-check" + §"Test plan" category 13 — the
 * SC-004 dock model MUST NOT value-import any of the upstream derivation
 * functions, any router, any network primitive, or any secret.
 *
 * Type-only imports (`import type { ... }`) are OK.
 */

import * as fs from 'fs';
import * as path from 'path';

const ARGUMENTS_DIR = path.join(__dirname, '..', 'src', 'features', 'arguments');
const DOCK_FILES = [
  'timelineNodeActionDockModel.ts',
];

function readSrc(file: string): string {
  return fs.readFileSync(path.join(ARGUMENTS_DIR, file), 'utf8');
}

// Identify lines that are value imports (NOT `import type`).
function valueImportLines(src: string): string[] {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inImport = false;
  let isTypeOnly = false;
  let buf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inImport) {
      if (/^import\s+(?!type\b)/.test(trimmed)) {
        inImport = true;
        isTypeOnly = false;
        buf = [trimmed];
        if (/;\s*$/.test(trimmed)) {
          if (!isTypeOnly) out.push(buf.join(' '));
          inImport = false;
          buf = [];
        }
      } else if (/^import\s+type\b/.test(trimmed)) {
        let acc = trimmed;
        if (!/;\s*$/.test(acc)) {
          inImport = true;
          isTypeOnly = true;
          buf = [acc];
        }
      }
    } else {
      buf.push(trimmed);
      if (/;\s*$/.test(trimmed)) {
        const joined = buf.join(' ');
        if (!isTypeOnly) out.push(joined);
        inImport = false;
        buf = [];
      }
    }
  }
  return out;
}

describe('SC-004 forbidden-imports — no value imports of upstream derivation functions', () => {
  for (const file of DOCK_FILES) {
    describe(file, () => {
      const src = readSrc(file);
      const valueImports = valueImportLines(src);
      const allText = valueImports.join('\n');

      it('no value-import of `deriveMessageCategory`', () => {
        expect(allText.includes('deriveMessageCategory')).toBe(false);
      });

      it('no value-import of `derivePrimaryQualifier`', () => {
        expect(allText.includes('derivePrimaryQualifier')).toBe(false);
      });

      it('no value-import of `deriveMessageQualifiers`', () => {
        expect(allText.includes('deriveMessageQualifiers')).toBe(false);
      });

      it('no value-import of `applyAntiAmplification`', () => {
        expect(allText.includes('applyAntiAmplification')).toBe(false);
      });

      it('no value-import of `gradeChallenge`', () => {
        expect(allText.includes('gradeChallenge')).toBe(false);
      });

      it('no value-import of `gradeRepair`', () => {
        expect(allText.includes('gradeRepair')).toBe(false);
      });

      it('no value-import of `buildPointLifecycleMap`', () => {
        expect(allText.includes('buildPointLifecycleMap')).toBe(false);
      });

      it('no value-import of `buildMoveMetadataLedger`', () => {
        // The dock CONSUMES a ledger, never re-builds one.
        expect(allText.includes('buildMoveMetadataLedger')).toBe(false);
      });

      it('no value-import of `deriveAxis`', () => {
        expect(allText.includes('deriveAxis')).toBe(false);
      });

      it('no React / RN / Supabase / Expo imports', () => {
        expect(allText.includes("'react'")).toBe(false);
        expect(allText.includes('"react"')).toBe(false);
        expect(allText.includes("'react-native'")).toBe(false);
        expect(allText.includes('@supabase/supabase-js')).toBe(false);
        expect(allText.includes("'expo-")).toBe(false);
        expect(allText.includes('"expo-')).toBe(false);
        expect(allText.includes('react-router')).toBe(false);
      });

      it('no `Linking` import', () => {
        expect(allText.includes('Linking')).toBe(false);
      });

      it('no import from engagementIntelligence', () => {
        expect(allText.includes('engagementIntelligence')).toBe(false);
      });
    });
  }
});

describe('SC-004 forbidden-imports — no network primitives or env secrets', () => {
  for (const file of DOCK_FILES) {
    it(`${file} does not call fetch / XMLHttpRequest`, () => {
      const src = readSrc(file);
      expect(src.includes('XMLHttpRequest')).toBe(false);
      // We allow the word "fetch" in comments but ban actual `fetch(` calls.
      expect(/\bfetch\s*\(/.test(src)).toBe(false);
    });

    it(`${file} does not reference ANTHROPIC_API_KEY / XAI_API_KEY / SERVICE_ROLE / SUPABASE_SERVICE_ROLE_KEY`, () => {
      const src = readSrc(file);
      expect(src.includes('ANTHROPIC_API_KEY')).toBe(false);
      expect(src.includes('XAI_API_KEY')).toBe(false);
      expect(src.includes('SERVICE_ROLE')).toBe(false);
      expect(src.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
    });

    it(`${file} does not contain console.log calls (pure model — no logging)`, () => {
      const src = readSrc(file);
      expect(/\bconsole\.log\s*\(/.test(src)).toBe(false);
    });

    it(`${file} does not insert into public.arguments`, () => {
      const src = readSrc(file);
      expect(src.includes("from('arguments').insert")).toBe(false);
      expect(src.includes('supabase.from')).toBe(false);
    });
  }
});

describe('SC-004 forbidden-imports — module ownership', () => {
  it('lives in src/features/arguments/, NOT a new src/features/dock/ directory', () => {
    const dockDir = path.join(__dirname, '..', 'src', 'features', 'dock');
    expect(fs.existsSync(dockDir)).toBe(false);
    const file = path.join(ARGUMENTS_DIR, 'timelineNodeActionDockModel.ts');
    expect(fs.existsSync(file)).toBe(true);
  });
});

describe('SC-004 forbidden-imports — no value import of the upstream lifecycle / metadata derivers', () => {
  it('the model file value-imports only the plain-language helpers from lifecycle + metadata', () => {
    const src = readSrc('timelineNodeActionDockModel.ts');
    const valueImports = valueImportLines(src);
    const allText = valueImports.join('\n');
    // Allowed value imports from lifecycle barrel:
    //   `getPointLifecyclePlainLabel`
    // Allowed value imports from metadata barrel:
    //   `getManualTagPlainLabel`, `getAutoMetadataPlainLabel`
    // We assert the lifecycle import line does NOT pull in derivers.
    expect(allText.includes('getPointLifecyclePlainLabel')).toBe(true);
    expect(allText.includes('getManualTagPlainLabel')).toBe(true);
    expect(allText.includes('getAutoMetadataPlainLabel')).toBe(true);
    // No deriver value imports.
    expect(allText.includes('buildPointLifecycleMap')).toBe(false);
    expect(allText.includes('buildMoveMetadataLedger')).toBe(false);
    expect(allText.includes('derivePointLifecycleSnapshot')).toBe(false);
  });
});
