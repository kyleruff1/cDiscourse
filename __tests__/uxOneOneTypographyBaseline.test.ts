/**
 * UX-001.1 — Typography baseline tests (Q8 verdict).
 *
 * Pure-TS coverage of the new `BRAND.typography` sub-objects:
 *   - `wordmarkFallback` per band (phone / tablet / wide)
 *   - `tagline` per variant (inline / stacked)
 *   - `header` per band (right-slot label sizes; phone is icon-only)
 *
 * Plus doctrine ban-list scans (no verdict / popularity tokens in
 * typography keys or values) and the mental-model surface mapping
 * pins (Q2: BRAND-002's SURFACE_TOKENS + CONTROL unchanged).
 *
 * The existing `appHeaderTagline.test.tsx` already pins the visible
 * tagline rendering and the BRAND.text.taglineFg color. This file
 * only covers the typography contract the new tokens introduce.
 */
import fs from 'fs';
import path from 'path';
import {
  BRAND,
  SURFACE_TOKENS,
  CONTROL,
  FORBIDDEN_TOKEN_TOKENS,
} from '../src/lib/designTokens';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

// ── Q8.1-9 — Typography shape ───────────────────────────────────

describe('UX-001.1 — typography baseline (Q8)', () => {
  it('Q8.1: BRAND.typography has wordmarkFallback, tagline, header keys', () => {
    expect(Object.keys(BRAND.typography).sort()).toEqual(
      ['header', 'tagline', 'wordmarkFallback'].sort(),
    );
  });

  it('Q8.2a: wordmarkFallback.phone.fontSize === 18', () => {
    expect(BRAND.typography.wordmarkFallback.phone.fontSize).toBe(18);
  });

  it('Q8.2b: wordmarkFallback.tablet.fontSize === 28', () => {
    expect(BRAND.typography.wordmarkFallback.tablet.fontSize).toBe(28);
  });

  it('Q8.2c: wordmarkFallback.wide.fontSize === 34', () => {
    expect(BRAND.typography.wordmarkFallback.wide.fontSize).toBe(34);
  });

  it('Q8.3: wordmarkFallback fontWeight === "800" on every band', () => {
    expect(BRAND.typography.wordmarkFallback.phone.fontWeight).toBe('800');
    expect(BRAND.typography.wordmarkFallback.tablet.fontWeight).toBe('800');
    expect(BRAND.typography.wordmarkFallback.wide.fontWeight).toBe('800');
  });

  it('Q8.4a: tagline.inline.fontSize === 18 (mirrors prior inline literal)', () => {
    expect(BRAND.typography.tagline.inline.fontSize).toBe(18);
  });

  it('Q8.4b: tagline.stacked.fontSize === 14 (mirrors prior inline literal)', () => {
    expect(BRAND.typography.tagline.stacked.fontSize).toBe(14);
  });

  it('Q8.5: tagline fontWeight === "400" on every variant', () => {
    expect(BRAND.typography.tagline.inline.fontWeight).toBe('400');
    expect(BRAND.typography.tagline.stacked.fontWeight).toBe('400');
  });

  it('Q8.6a: header.phone.fontSize === 0 (icon-only on phone)', () => {
    expect(BRAND.typography.header.phone.fontSize).toBe(0);
  });

  it('Q8.6b: header.tablet.fontSize === 12', () => {
    expect(BRAND.typography.header.tablet.fontSize).toBe(12);
  });

  it('Q8.6c: header.wide.fontSize === 13', () => {
    expect(BRAND.typography.header.wide.fontSize).toBe(13);
  });

  it('Q8.7: every fontSize is a non-negative integer (0 for icon-only phone)', () => {
    const sizes = [
      BRAND.typography.wordmarkFallback.phone.fontSize,
      BRAND.typography.wordmarkFallback.tablet.fontSize,
      BRAND.typography.wordmarkFallback.wide.fontSize,
      BRAND.typography.tagline.inline.fontSize,
      BRAND.typography.tagline.stacked.fontSize,
      BRAND.typography.header.phone.fontSize,
      BRAND.typography.header.tablet.fontSize,
      BRAND.typography.header.wide.fontSize,
    ];
    for (const s of sizes) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(s)).toBe(true);
    }
  });

  it('Q8.8: every lineHeight is >= fontSize (RN layout safety)', () => {
    const pairs: Array<[number, number]> = [
      [BRAND.typography.wordmarkFallback.phone.fontSize, BRAND.typography.wordmarkFallback.phone.lineHeight],
      [BRAND.typography.wordmarkFallback.tablet.fontSize, BRAND.typography.wordmarkFallback.tablet.lineHeight],
      [BRAND.typography.wordmarkFallback.wide.fontSize, BRAND.typography.wordmarkFallback.wide.lineHeight],
      [BRAND.typography.tagline.inline.fontSize, BRAND.typography.tagline.inline.lineHeight],
      [BRAND.typography.tagline.stacked.fontSize, BRAND.typography.tagline.stacked.lineHeight],
      [BRAND.typography.header.phone.fontSize, BRAND.typography.header.phone.lineHeight],
      [BRAND.typography.header.tablet.fontSize, BRAND.typography.header.tablet.lineHeight],
      [BRAND.typography.header.wide.fontSize, BRAND.typography.header.wide.lineHeight],
    ];
    for (const [fontSize, lineHeight] of pairs) {
      expect(lineHeight).toBeGreaterThanOrEqual(fontSize);
    }
  });

  it('Q8.9: AppHeaderTagline source reads from BRAND.typography.tagline (no inline literal)', () => {
    const src = read('src/components/AppHeaderTagline.tsx');
    // Should reference the BRAND.typography.tagline path.
    expect(src).toMatch(/BRAND\.typography\.tagline\.inline/);
    expect(src).toMatch(/BRAND\.typography\.tagline\.stacked/);
    // Should NOT contain the prior inline literals as a fontSize value.
    // Comment lines (/^\s*(\/\/|\*|\/\*)/) are excluded because they reference the prior values descriptively.
    const codeOnly = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    expect(codeOnly).not.toMatch(/fontSize:\s*18\b/);
    expect(codeOnly).not.toMatch(/fontSize:\s*14\b/);
  });

  it('Q8.10: AppHeader source reads from BRAND.typography.wordmarkFallback (no inline literal in fallback styles)', () => {
    const src = read('src/components/AppHeader.tsx');
    expect(src).toMatch(/BRAND\.typography\.wordmarkFallback/);
    // The prior inline fontSize: 18 / 28 literals must be gone from the
    // wordmark fallback StyleSheet block. Comment lines excluded.
    const codeOnly = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    expect(codeOnly).not.toMatch(/wordmarkFallbackNarrow:\s*\{[^}]*fontSize:\s*18/);
    expect(codeOnly).not.toMatch(/wordmarkFallbackWide:\s*\{[^}]*fontSize:\s*28/);
  });
});

// ── Doctrine — ban-list scan ────────────────────────────────────

describe('UX-001.1 — typography doctrine ban-list (§15)', () => {
  function* allStrings(o: unknown): Generator<string> {
    if (typeof o === 'string') yield o;
    else if (typeof o === 'number') yield String(o);
    else if (o && typeof o === 'object') {
      for (const v of Object.values(o as Record<string, unknown>)) yield* allStrings(v);
    }
  }

  function* allKeys(o: unknown): Generator<string> {
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o as Record<string, unknown>)) {
        yield k;
        yield* allKeys((o as Record<string, unknown>)[k]);
      }
    }
  }

  it('Q8.11: no typography key matches FORBIDDEN_TOKEN_TOKENS', () => {
    for (const key of allKeys(BRAND.typography)) {
      for (const banned of FORBIDDEN_TOKEN_TOKENS) {
        expect(key.toLowerCase()).not.toContain(banned.toLowerCase());
      }
    }
  });

  it('Q8.12: no typography value contains a verdict string', () => {
    for (const s of allStrings(BRAND.typography)) {
      for (const banned of FORBIDDEN_TOKEN_TOKENS) {
        expect(s.toLowerCase()).not.toContain(banned.toLowerCase());
      }
    }
  });

  it('Q8.13: BRAND.taglineText still equals the Stage 2 fixture (no shell-copy drift)', () => {
    expect(BRAND.taglineText).toBe('Just get to the bottom of it');
  });

  it('Q8.14: BRAND.surface.app.bg === "#08060F" (Stage 1 invariant)', () => {
    expect(BRAND.surface.app.bg).toBe('#08060F');
  });

  it('Q8.15: BRAND.text.primary === "#F5EDE0" (Stage 1 invariant)', () => {
    expect(BRAND.text.primary).toBe('#F5EDE0');
  });
});

// ── Q2 — Surface hierarchy mental-model pins (BRAND-002 unchanged) ──

describe('UX-001.1 — surface hierarchy mental model (Q2)', () => {
  it('Q2.16: SURFACE_TOKENS still has the 14 BRAND-002 keys (no addition, no removal)', () => {
    expect(Object.keys(SURFACE_TOKENS).sort()).toEqual(
      [
        'base',
        'elevated',
        'overlay',
        'raised',
        'border',
        'divider',
        'textPrimary',
        'textSecondary',
        'textMuted',
        'textInverse',
        'inputBg',
        'inputBorder',
        'placeholder',
        'focusRing',
      ].sort(),
    );
  });

  it('Q2.17: CONTROL still has 3 keys (primary, secondary, danger)', () => {
    expect(Object.keys(CONTROL).sort()).toEqual(
      ['primary', 'secondary', 'danger'].sort(),
    );
  });

  it('Q2.18: SURFACE_TOKENS.overlay === "#0f172a" (tertiary surface; mental-model pin)', () => {
    expect(SURFACE_TOKENS.overlay).toBe('#0f172a');
  });
});
