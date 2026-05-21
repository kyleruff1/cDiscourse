/**
 * IX-002 — Timeline mini-map forbidden-imports source scan.
 *
 * Pattern copied from `timelineNodeActionDockForbiddenImports.test.ts`.
 *
 * The mini-map MODEL (`timelineMiniMapModel.ts`) is pure TypeScript: it
 * MUST NOT value-import React / React Native / Supabase / Expo / a router
 * / `Linking`, MUST NOT call `fetch` / `XMLHttpRequest` / `Date.now`, MUST
 * NOT reference any secret, and MUST NOT value-import the upstream
 * derivation functions — it CONSUMES the already-built
 * `ArgumentTimelineMapModel` as a type-only import; it never re-derives
 * heat or branches.
 *
 * Type-only imports (`import type { ... }`) are OK.
 */
import * as fs from 'fs';
import * as path from 'path';

const ARGUMENTS_DIR = path.join(__dirname, '..', 'src', 'features', 'arguments');
const MODEL_FILE = 'timelineMiniMapModel.ts';

function readSrc(file: string): string {
  return fs.readFileSync(path.join(ARGUMENTS_DIR, file), 'utf8');
}

/** Identify lines that are value imports (NOT `import type`). */
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
        const acc = trimmed;
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

describe('IX-002 forbidden-imports — model is pure TS (no React / RN / Supabase / Expo)', () => {
  const src = readSrc(MODEL_FILE);
  const valueImports = valueImportLines(src);
  const allText = valueImports.join('\n');

  it('no value import of `react`', () => {
    expect(allText.includes("'react'")).toBe(false);
    expect(allText.includes('"react"')).toBe(false);
  });

  it('no value import of `react-native`', () => {
    expect(allText.includes("'react-native'")).toBe(false);
    expect(allText.includes('"react-native"')).toBe(false);
  });

  it('no value import of `@supabase/supabase-js`', () => {
    expect(allText.includes('@supabase/supabase-js')).toBe(false);
  });

  it('no value import of any `expo-*` package', () => {
    expect(allText.includes("'expo-")).toBe(false);
    expect(allText.includes('"expo-')).toBe(false);
    expect(allText.includes("'expo'")).toBe(false);
  });

  it('no router import', () => {
    expect(allText.includes('react-router')).toBe(false);
    expect(allText.includes('expo-router')).toBe(false);
    expect(allText.includes('@react-navigation')).toBe(false);
  });

  it('no `Linking` import', () => {
    expect(allText.includes('Linking')).toBe(false);
  });
});

describe('IX-002 forbidden-imports — no network, no Date.now, no logging', () => {
  const src = readSrc(MODEL_FILE);

  it('does not call fetch(', () => {
    // The word "fetch" is allowed in comments; an actual call is banned.
    expect(/\bfetch\s*\(/.test(src)).toBe(false);
  });

  it('does not reference XMLHttpRequest', () => {
    expect(src.includes('XMLHttpRequest')).toBe(false);
  });

  it('does not call Date.now(', () => {
    expect(/Date\.now\s*\(/.test(src)).toBe(false);
  });

  it('does not contain console.log calls', () => {
    expect(/\bconsole\.log\s*\(/.test(src)).toBe(false);
  });
});

describe('IX-002 forbidden-imports — no secrets', () => {
  const src = readSrc(MODEL_FILE);

  it('does not reference ANTHROPIC_API_KEY / XAI_API_KEY / SERVICE_ROLE', () => {
    expect(src.includes('ANTHROPIC_API_KEY')).toBe(false);
    expect(src.includes('XAI_API_KEY')).toBe(false);
    expect(src.includes('SERVICE_ROLE')).toBe(false);
    expect(src.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
  });

  it('does not insert into public.arguments', () => {
    expect(src.includes("from('arguments').insert")).toBe(false);
    expect(src.includes('supabase.from')).toBe(false);
  });
});

describe('IX-002 forbidden-imports — model consumes, never re-derives', () => {
  const src = readSrc(MODEL_FILE);
  const valueImports = valueImportLines(src);
  const allText = valueImports.join('\n');

  it('does NOT value-import `inferTemperatureBand` (re-labels, never re-infers heat)', () => {
    expect(allText.includes('inferTemperatureBand')).toBe(false);
  });

  it('does NOT value-import `inferStandingBand` (never reads standing)', () => {
    expect(allText.includes('inferStandingBand')).toBe(false);
  });

  it('does NOT value-import `inferToneBand`', () => {
    expect(allText.includes('inferToneBand')).toBe(false);
  });

  it('does NOT value-import `buildArgumentTimelineMap` (consumes the built model)', () => {
    expect(allText.includes('buildArgumentTimelineMap')).toBe(false);
  });

  it('does NOT value-import any branch-topology builder', () => {
    expect(allText.includes('buildBranchKindMap')).toBe(false);
    expect(allText.includes('buildEvidenceThreadMap')).toBe(false);
    expect(allText.includes('deriveBranchKindFromConstitutionModel')).toBe(false);
  });

  it('imports `ArgumentTimelineMapModel` ONLY as a type', () => {
    // The type appears in an `import type` line, never a value import.
    expect(allText.includes('ArgumentTimelineMapModel')).toBe(false);
    expect(src.includes('ArgumentTimelineMapModel')).toBe(true);
  });

  it('imports `BranchCollapseState` ONLY as a type', () => {
    expect(allText.includes('BranchCollapseState')).toBe(false);
    expect(src.includes('BranchCollapseState')).toBe(true);
  });

  it('the only allowed value imports are TIMELINE_KIND_COLORS + deriveBranchLabel', () => {
    // TIMELINE_KIND_COLORS — reused token table for marker fill.
    // deriveBranchLabel — reused plain-language branch descriptor.
    expect(allText.includes('TIMELINE_KIND_COLORS')).toBe(true);
    expect(allText.includes('deriveBranchLabel')).toBe(true);
  });
});

describe('IX-002 forbidden-imports — module ownership', () => {
  it('the model lives in src/features/arguments/, NOT a new directory', () => {
    const file = path.join(ARGUMENTS_DIR, MODEL_FILE);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '..', 'src', 'features', 'miniMap'))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(__dirname, '..', 'src', 'features', 'minimap'))).toBe(
      false,
    );
  });

  it('the component lives in src/features/arguments/', () => {
    expect(fs.existsSync(path.join(ARGUMENTS_DIR, 'TimelineMiniMap.tsx'))).toBe(true);
  });
});
