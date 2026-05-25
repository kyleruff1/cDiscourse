/**
 * UX-001.4 — Doctrine ban-list + no-route-transition + disabled-reason
 * copy guard.
 *
 * Scans the new UX-001.4 source files for:
 *   - Forbidden verdict tokens in any string literal.
 *   - Internal-code leaks in any string literal (snake_case codes that
 *     should be plain-language-mapped).
 *   - Router / Linking / navigation primitive imports (Modal popouts
 *     must not push routes).
 *   - Direct supabase imports (the new menus must NEVER write).
 *
 * The disabled-reason copy in goPopoutModel.GO_DISABLED_REASON is also
 * scanned to verify plain-language compliance.
 */
import fs from 'fs';
import path from 'path';
import { GO_DISABLED_REASON } from '../src/features/arguments/oneBox/goPopoutModel';

const FILES = [
  'src/features/arguments/boardMenuKeyboardModel.ts',
  'src/features/arguments/oneBox/menuPresentationModel.ts',
  'src/features/arguments/oneBox/menuKeyBadgeModel.ts',
  'src/features/arguments/oneBox/inspectContentBuilder.ts',
];

const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'manipulative',
  'extremist',
  'propagandist',
  'bad faith',
  'proof of',
  'this is wrong',
  'this is false',
  'this is invalid',
  'correctness',
  'truth value',
  'verdict',
];

const INTERNAL_CODES = [
  'topic_satisfaction_lexical',
  'source_chain_lexical',
  'anti_amplification',
  'evidence_debt_unresolved',
  'platform_support_warning',
  'validation_failed_after_retries',
  'max_depth_reached',
  'synthesis_ready_lexical',
  'submit_failed_lexical',
];

const FORBIDDEN_ROUTE_IMPORTS = [
  '@react-navigation/native',
  'expo-router',
  'react-router',
];

describe('UX-001.4 — doctrine ban-list scan on new modules', () => {
  for (const relPath of FILES) {
    const fullPath = path.resolve(__dirname, '..', relPath);
    const src = fs.readFileSync(fullPath, 'utf8');
    const stringLiterals = extractStringLiterals(src);

    for (const token of VERDICT_TOKENS) {
      it(`${relPath} — no string literal contains "${token}"`, () => {
        const hits = stringLiterals.filter((s) => s.toLowerCase().includes(token.toLowerCase()));
        // Doctrine commentary in JSDoc / comments lives outside string
        // literals; only user-facing strings are scanned here.
        expect(hits).toEqual([]);
      });
    }

    for (const code of INTERNAL_CODES) {
      it(`${relPath} — no string literal leaks internal code "${code}"`, () => {
        const hits = stringLiterals.filter((s) => s.includes(code));
        expect(hits).toEqual([]);
      });
    }

    for (const route of FORBIDDEN_ROUTE_IMPORTS) {
      it(`${relPath} — does NOT import from "${route}" (no route transition)`, () => {
        expect(src).not.toMatch(new RegExp(`from\\s+['"]${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`));
      });
    }

    it(`${relPath} — does NOT import supabase (no write path)`, () => {
      expect(src).not.toMatch(/from\s+['"][^'"]*\/lib\/supabase['"]/);
    });

    it(`${relPath} — does NOT call fetch (no network)`, () => {
      expect(src).not.toMatch(/\bfetch\s*\(/);
    });
  }
});

describe('UX-001.4 — GO_DISABLED_REASON copy ban-list', () => {
  it('every disabled reason is plain English', () => {
    for (const value of Object.values(GO_DISABLED_REASON)) {
      // No snake_case codes leaking into the user-facing copy.
      expect(value).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('every disabled reason avoids verdict tokens', () => {
    for (const value of Object.values(GO_DISABLED_REASON)) {
      for (const token of VERDICT_TOKENS) {
        expect(value.toLowerCase()).not.toContain(token.toLowerCase());
      }
    }
  });

  it('leaveRoomUnavailable copy is plain English (UX-001.4 addition)', () => {
    expect(GO_DISABLED_REASON.leaveRoomUnavailable).toBe('Leaving is not available here.');
  });
});

describe('UX-001.4 — ArgumentGameSurface mount imports (read-only doctrine)', () => {
  const SURFACE_PATH = path.resolve(
    __dirname,
    '..',
    'src',
    'features',
    'arguments',
    'ArgumentGameSurface.tsx',
  );
  const src = fs.readFileSync(SURFACE_PATH, 'utf8');

  it('does NOT import a router primitive', () => {
    for (const route of FORBIDDEN_ROUTE_IMPORTS) {
      expect(src).not.toMatch(new RegExp(`from\\s+['"]${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`));
    }
  });

  it('does NOT import Linking from react-native', () => {
    expect(src).not.toMatch(/import\s+\{[^}]*\bLinking\b[^}]*\}\s+from\s+['"]react-native['"]/);
  });

  it('mutual exclusion: opening Act closes Inspect + Go', () => {
    // The trigger / keyboard handler sequence sets all three states.
    expect(src).toMatch(/setInspectVisible\(false\);[\s\S]*?setGoVisible\(false\);[\s\S]*?setBoardActVisible\(true\)/);
  });

  it('mutual exclusion: opening Inspect closes Act + Go', () => {
    expect(src).toMatch(/setBoardActVisible\(false\);[\s\S]*?setGoVisible\(false\);[\s\S]*?setInspectVisible\(true\)/);
  });

  it('mutual exclusion: opening Go closes Act + Inspect', () => {
    expect(src).toMatch(/setBoardActVisible\(false\);[\s\S]*?setInspectVisible\(false\);[\s\S]*?setGoVisible\(true\)/);
  });
});

// ── Helper ──────────────────────────────────────────────────────

/**
 * Extract every string literal (single-quoted, double-quoted, template
 * literal) from a TypeScript source file. Skips comments (which are
 * allowed to discuss doctrine vocabulary).
 */
function extractStringLiterals(src: string): string[] {
  // Strip line + block comments first so doctrine commentary doesn't
  // trigger the scan.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const literals: string[] = [];
  const pattern = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(stripped)) !== null) {
    literals.push(m[2]);
  }
  return literals;
}
