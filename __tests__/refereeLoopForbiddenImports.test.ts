/**
 * REF-002 — Forbidden-imports source-scan tests (mirrors
 * `metadataForbiddenImports.test.ts`).
 *
 * The Open Issue model is consultative + pure. It consumes the
 * already-derived seams and the two allowed pure joins (`buildActPopout`,
 * `deriveSuggestedMoves`). It MUST NOT value-import `selectBanner` or any
 * banner-priority constant (operator constraint 5 — one referee banner
 * surface), must never reach for React / RN / Supabase / Expo / a router /
 * a network primitive / `Date.now`, and must carry no secret reference or
 * `console.log`.
 */

import * as fs from 'fs';
import * as path from 'path';

const REFEREE_LOOP_DIR = path.join(__dirname, '..', 'src', 'features', 'refereeLoop');
const REFEREE_LOOP_FILES = ['openIssueModel.ts', 'index.ts'];

function readSrc(file: string): string {
  return fs.readFileSync(path.join(REFEREE_LOOP_DIR, file), 'utf8');
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

describe('REF-002 forbidden-imports — no banner-selection fork (operator constraint 5)', () => {
  for (const file of REFEREE_LOOP_FILES) {
    describe(file, () => {
      const valueImports = valueImportLines(readSrc(file));
      const allText = valueImports.join('\n');

      it('no value-import of `selectBanner`', () => {
        expect(allText.includes('selectBanner')).toBe(false);
      });
      it('no value-import of a banner-priority constant', () => {
        expect(allText.includes('BANNER_CATEGORY_PRIORITY')).toBe(false);
        expect(allText.toLowerCase().includes('bannerpriority')).toBe(false);
      });
      it('no React / RN / Supabase / Expo / router value imports', () => {
        expect(allText.includes("'react'")).toBe(false);
        expect(allText.includes('"react"')).toBe(false);
        expect(allText.includes("'react-native'")).toBe(false);
        expect(allText.includes('@supabase/supabase-js')).toBe(false);
        expect(allText.includes("'expo-")).toBe(false);
        expect(allText.includes('"expo-')).toBe(false);
        expect(allText.includes('react-navigation')).toBe(false);
        expect(allText.includes('expo-router')).toBe(false);
      });
    });
  }
});

describe('REF-002 forbidden-imports — no network primitives, secrets, logging, or Date.now', () => {
  for (const file of REFEREE_LOOP_FILES) {
    it(`${file} does not call fetch / XMLHttpRequest / Date.now`, () => {
      const src = readSrc(file);
      expect(src.includes('XMLHttpRequest')).toBe(false);
      expect(/\bfetch\s*\(/.test(src)).toBe(false);
      expect(/\bDate\.now\s*\(/.test(src)).toBe(false);
    });

    it(`${file} references no Anthropic / xAI / service-role secret`, () => {
      const src = readSrc(file);
      expect(src.includes('ANTHROPIC_API_KEY')).toBe(false);
      expect(src.includes('XAI_API_KEY')).toBe(false);
      expect(src.includes('SERVICE_ROLE')).toBe(false);
      expect(src.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
    });

    it(`${file} contains no console.log (pure model — no logging)`, () => {
      const src = readSrc(file);
      expect(/\bconsole\.log\s*\(/.test(src)).toBe(false);
    });
  }
});

describe('REF-002 forbidden-imports — the permitted pure joins ARE value-imported (positive boundary)', () => {
  it('openIssueModel.ts value-imports `buildActPopout` + `deriveSuggestedMoves`', () => {
    const allText = valueImportLines(readSrc('openIssueModel.ts')).join('\n');
    expect(allText.includes('buildActPopout')).toBe(true);
    expect(allText.includes('deriveSuggestedMoves')).toBe(true);
  });

  it('openIssueModel.ts value-imports the family-gate mirror constant + lookup', () => {
    const allText = valueImportLines(readSrc('openIssueModel.ts')).join('\n');
    expect(allText.includes('HUB_NON_PRODUCTION_FAMILIES')).toBe(true);
    expect(allText.includes('lookupMachineObservationDefinitionByCompoundKey')).toBe(true);
  });
});
