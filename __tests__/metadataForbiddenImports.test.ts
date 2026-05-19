/**
 * META-001 — Forbidden-imports source-scan tests.
 *
 * Per design §"Forbidden-imports test" + roadmap §16 risk #1 — this is
 * the headline doctrine anchor. The deriver MUST NOT value-import the
 * upstream derivation functions; it consumes the already-derived seams
 * (LIFE-001 axis on `PointLifecycleSnapshot.axis`, qualifier codes via
 * `node.droppedTags[].code`, EV-001 artifacts via the input map).
 *
 * Type-only imports (`import type { ... }`) are OK and required — the
 * model uses `PointLifecycleState`, `PointLifecycleAxis`, etc. as types.
 */

import * as fs from 'fs';
import * as path from 'path';

const METADATA_DIR = path.join(__dirname, '..', 'src', 'features', 'metadata');
const METADATA_FILES = [
  'moveMetadataLedger.ts',
  'manualTagModel.ts',
  'autoMetadataModel.ts',
  'metadataEvents.ts',
  'index.ts',
];

function readSrc(file: string): string {
  return fs.readFileSync(path.join(METADATA_DIR, file), 'utf8');
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
        // type-only top-level import; collapse line-continuations.
        let acc = trimmed;
        if (!/;\s*$/.test(acc)) {
          // skip until ;
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

describe('META-001 forbidden-imports — no value imports of upstream derivation functions', () => {
  for (const file of METADATA_FILES) {
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

      it('no value-import of `deriveAxis` (axis comes from PointLifecycleSnapshot.axis)', () => {
        // Type imports of axis-related types are OK; value imports of the
        // derivation function are not.
        expect(allText.includes('deriveAxis')).toBe(false);
      });

      it('no value-import of `applyAntiAmplification`', () => {
        expect(allText.includes('applyAntiAmplification')).toBe(false);
      });

      it('no value-import of `gradeChallenge` / `gradeRepair`', () => {
        expect(allText.includes('gradeChallenge')).toBe(false);
        expect(allText.includes('gradeRepair')).toBe(false);
      });

      it('no import from `src/features/engagementIntelligence/`', () => {
        expect(allText.includes('engagementIntelligence')).toBe(false);
      });

      it('no React / RN / Supabase / Expo imports', () => {
        expect(allText.includes("'react'")).toBe(false);
        expect(allText.includes('"react"')).toBe(false);
        expect(allText.includes("'react-native'")).toBe(false);
        expect(allText.includes('@supabase/supabase-js')).toBe(false);
        expect(allText.includes("'expo-")).toBe(false);
        expect(allText.includes('"expo-')).toBe(false);
      });
    });
  }
});

describe('META-001 forbidden-imports — no network primitives or env secrets', () => {
  for (const file of METADATA_FILES) {
    it(`${file} does not call fetch / XMLHttpRequest`, () => {
      const src = readSrc(file);
      expect(src.includes('XMLHttpRequest')).toBe(false);
      // We allow the word "fetch" in comments but ban actual `fetch(`
      // call expressions.
      expect(/\bfetch\s*\(/.test(src)).toBe(false);
    });

    it(`${file} does not reference ANTHROPIC_API_KEY / XAI_API_KEY / SERVICE_ROLE`, () => {
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
  }
});

describe('META-001 forbidden-imports — qualifier reads stay structural', () => {
  // Strip comments + string literals so we only scan actual source code.
  function stripCommentsAndStrings(src: string): string {
    let out = src;
    // Block comments.
    out = out.replace(/\/\*[\s\S]*?\*\//g, '');
    // Line comments.
    out = out.replace(/\/\/[^\n]*/g, '');
    // String literals — be conservative; replace contents with empty.
    out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
    out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
    out = out.replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``');
    return out;
  }

  it('autoMetadataModel.ts reads qualifier codes only via node.droppedTags', () => {
    const raw = readSrc('autoMetadataModel.ts');
    const code = stripCommentsAndStrings(raw);
    // The deriver MUST consume qualifier codes by inspecting
    // `node.droppedTags[].code` — never by calling a derivation function.
    expect(raw.includes('node.droppedTags')).toBe(true);
    // In the executable code (post-strip), no call to deriveMessageCategory.
    expect(code.includes('deriveMessageCategory')).toBe(false);
  });

  it('moveMetadataLedger.ts surfaces axis ONLY from PointLifecycleSnapshot.axis', () => {
    const raw = readSrc('moveMetadataLedger.ts');
    const code = stripCommentsAndStrings(raw);
    expect(raw.includes('snap?.axis') || raw.includes('snap.axis')).toBe(true);
    expect(code.includes('deriveAxis')).toBe(false);
  });
});

describe('META-001 forbidden-imports — type imports of `MessageCategory` / `MessageQualifier` are OK', () => {
  it('no module value-imports the qualifier deriver — type imports allowed', () => {
    for (const file of METADATA_FILES) {
      const src = readSrc(file);
      // Allow `import type { MessageCategory } from '../arguments/messageQualifiers';`
      // but ban value imports.
      const lines = src.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^import\s+(?!type\b)[^;]*messageQualifiers/.test(trimmed)) {
          throw new Error(
            `Value import of messageQualifiers found in ${file}: ${trimmed}`,
          );
        }
      }
    }
  });
});
