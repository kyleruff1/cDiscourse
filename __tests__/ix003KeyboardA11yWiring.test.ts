/**
 * IX-003 — Keyboard + accessibility wiring source scan.
 *
 * Jest/JSDOM cannot simulate real keypresses without React-Testing-
 * Library, and the repo's discipline is pure-helper + source-scan tests
 * (no `render()`). The traversal *logic* is verified directly in
 * `keyboardNavigationModel.test.ts`; this file asserts that
 * `ArgumentTimelineMap.tsx` actually wires that model in — and that the
 * pure model file stays React-free.
 *
 * Same pattern as `timelineNodeActionDockForbiddenImports.test.ts`.
 */
import * as fs from 'fs';
import * as path from 'path';

const ARGUMENTS_DIR = path.join(__dirname, '..', 'src', 'features', 'arguments');

function readSrc(file: string): string {
  return fs.readFileSync(path.join(ARGUMENTS_DIR, file), 'utf8');
}

describe('IX-003 — ArgumentTimelineMap keyboard + a11y wiring', () => {
  const src = readSrc('ArgumentTimelineMap.tsx');

  it('imports the traversal resolver + label builder from ./keyboardNavigationModel', () => {
    expect(src).toContain('./keyboardNavigationModel');
    expect(src).toContain('resolveTimelineNavEffect');
    expect(src).toContain('buildNodeAccessibilityLabel');
  });

  it('wires an onKeyDown handler', () => {
    expect(src).toContain('onKeyDown');
  });

  it("guards the keyboard layer with Platform.OS === 'web'", () => {
    expect(src).toContain("Platform.OS === 'web'");
  });

  it('calls preventDefault inside the key handler', () => {
    expect(src).toMatch(/preventDefault/);
  });

  it('keeps the node accessibilityRole="button" + selected state contract', () => {
    // Regression guard — IX-003 must not drop the existing node contract.
    expect(src).toContain('accessibilityRole="button"');
    expect(src).toContain('accessibilityState={{ selected:');
  });

  it('adds an accessibilityState disabled for the Prev/Next end state', () => {
    expect(src).toContain('accessibilityState={{ disabled:');
  });

  it('adds tabIndex for web focus order (group + nodes)', () => {
    expect(src).toContain('tabIndex');
  });

  it('imports no new npm package — only react / react-native / relative paths', () => {
    const importLines = src
      .split(/\r?\n/)
      .filter((l) => /^\s*import\s/.test(l) || /^\s*}\s*from\s/.test(l));
    const fromMatches = src.match(/from\s+['"]([^'"]+)['"]/g) ?? [];
    for (const m of fromMatches) {
      const spec = m.replace(/from\s+['"]/, '').replace(/['"]$/, '');
      const ok =
        spec === 'react' ||
        spec === 'react-native' ||
        spec.startsWith('./') ||
        spec.startsWith('../');
      expect(ok ? null : spec).toBeNull();
    }
    // Touch importLines so the lint rule cannot flag it unused.
    expect(importLines.length).toBeGreaterThan(0);
  });
});

describe('IX-003 — keyboardNavigationModel is a pure model file', () => {
  const src = readSrc('keyboardNavigationModel.ts');

  it('does not import from react', () => {
    expect(src.includes("from 'react'")).toBe(false);
    expect(src.includes('from "react"')).toBe(false);
  });

  it('does not import from react-native', () => {
    expect(src.includes("from 'react-native'")).toBe(false);
    expect(src.includes('from "react-native"')).toBe(false);
  });

  it('does not import Supabase / Expo / a router / a network primitive', () => {
    expect(src.includes('@supabase/supabase-js')).toBe(false);
    expect(src.includes("'expo-")).toBe(false);
    expect(src.includes('"expo-')).toBe(false);
    expect(src.includes('react-router')).toBe(false);
    expect(src.includes('fetch(')).toBe(false);
  });

  it('value-imports nothing from argumentGameSurfaceModel (type-only dependency)', () => {
    // The model inlines the prev/next index logic so the dependency on
    // argumentGameSurfaceModel stays type-only — no runtime import cycle.
    // Every import that resolves './argumentGameSurfaceModel' must be an
    // `import type` (the only one is the type-only import).
    expect(src).toMatch(
      /import\s+type\s*{[\s\S]*?}\s*from\s*'\.\/argumentGameSurfaceModel'/,
    );
    // A plain value import (`import {` without `type`) from that module
    // would create a runtime import cycle — assert there is none.
    expect(src).not.toMatch(
      /import\s+{[\s\S]*?}\s*from\s*'\.\/argumentGameSurfaceModel'/,
    );
  });
});
