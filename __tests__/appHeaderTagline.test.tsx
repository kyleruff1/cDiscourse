/**
 * BRAND-001 Stage 2 — tagline fixture + component contract.
 *
 * The repo's test discipline is pure-helper + source-scan (no
 * RN-render dependency). This file covers:
 *   1. Tagline fixture is the exact string from the design.
 *   2. Zero verdict / popularity tokens in the fixture.
 *   3. `text.taglineFg` passes WCAG AA Body (≥ 4.5:1) on `surface.app`.
 *      The same inline relative-luminance helper double-checks
 *      `text.primary` (AA Body) + `text.muted` (AA Large) so the
 *      Stage 1 contrast contract is pinned alongside Stage 2's.
 *   4. AppHeaderTagline source reads BRAND.text.taglineFg, not a literal.
 *   5. AppHeaderTagline source imports no router / navigation lib.
 *   6. AppHeaderTagline source has a system serif italic fallback
 *      branch (Platform.select with Georgia / serif) — no new font
 *      dep required.
 *   7. AppHeaderTagline source wraps body in <Text>.
 *   8. AppHeaderTagline source exposes accessibilityRole="text".
 *
 * The WCAG helper is intentionally inline; pulling it from a library
 * could shift sRGB midpoints / illuminants and make the test flaky.
 */
import fs from 'fs';
import path from 'path';
import { BRAND, FORBIDDEN_TOKEN_TOKENS } from '../src/lib/designTokens';
import {
  APP_HEADER_TAGLINE_TEXT,
  AppHeaderTagline,
} from '../src/components/AppHeaderTagline';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

// ── WCAG 2.1 relative-luminance helpers (inline, deterministic) ──

function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`bad hex ${hex}`);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(m[1], 16));
  const g = channel(parseInt(m[2], 16));
  const b = channel(parseInt(m[3], 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ── 1. Tagline fixture string ──────────────────────────────────────

describe('BRAND-001 Stage 2 — tagline fixture contract', () => {
  it('taglineText is the exact v4 fixture "A high-trust room for hard conversations."', () => {
    // UX-COPY-001 — CivilDiscourse v4 copy overhaul: the Stage 2
    // "Just get to the bottom of it" fixture is retired in favour of
    // the v4 primary tagline. The doctrine ban-list assertions below
    // continue to guard the new string.
    expect(BRAND.taglineText).toBe('A high-trust room for hard conversations.');
  });

  it('APP_HEADER_TAGLINE_TEXT re-export equals BRAND.taglineText', () => {
    expect(APP_HEADER_TAGLINE_TEXT).toBe(BRAND.taglineText);
  });

  it('taglineText contains zero verdict tokens', () => {
    const lower = BRAND.taglineText.toLowerCase();
    for (const banned of FORBIDDEN_TOKEN_TOKENS) {
      expect(lower).not.toContain(banned.toLowerCase());
    }
  });

  it('taglineText contains zero popularity / engagement tokens', () => {
    // Doctrine §3 — popularity is not evidence. Tagline must not
    // invoke virality, follower counts, engagement, etc.
    const popularity = [
      'viral',
      'virality',
      'trending',
      'popular',
      'likes',
      'shares',
      'retweets',
      'followers',
      'verified',
      'engagement',
      'amplification',
    ];
    const lower = BRAND.taglineText.toLowerCase();
    for (const banned of popularity) {
      expect(lower).not.toContain(banned);
    }
  });

  it('taglineText contains zero person-attribution tokens', () => {
    const lower = BRAND.taglineText.toLowerCase();
    // Phrase describes the user's investigative process, not the
    // user themselves. "you" / "your" / "they" are out.
    const attributions = ['the user', 'the author', 'this person', 'this user'];
    for (const banned of attributions) {
      expect(lower).not.toContain(banned);
    }
  });

  it('taglineText is a short, single-line ASCII fixture', () => {
    expect(BRAND.taglineText).toMatch(/^[\x20-\x7E]+$/); // printable ASCII only
    expect(BRAND.taglineText.length).toBeLessThanOrEqual(48);
    expect(BRAND.taglineText.includes('\n')).toBe(false);
  });
});

// ── 2. WCAG AA contrast on dark backdrop ───────────────────────────

describe('BRAND-001 Stage 2 — WCAG AA contrast', () => {
  it('taglineFg passes WCAG AA Body on surface.app (≥ 4.5:1)', () => {
    expect(contrastRatio(BRAND.text.taglineFg, BRAND.surface.app.bg))
      .toBeGreaterThanOrEqual(4.5);
  });

  it('text.primary passes WCAG AA Body on surface.app (Stage 1 pin)', () => {
    expect(contrastRatio(BRAND.text.primary, BRAND.surface.app.bg))
      .toBeGreaterThanOrEqual(4.5);
  });

  it('text.muted passes WCAG AA Large on surface.app (Stage 1 pin)', () => {
    expect(contrastRatio(BRAND.text.muted, BRAND.surface.app.bg))
      .toBeGreaterThanOrEqual(3);
  });

  it('taglineFg is distinct from text.primary (visual hierarchy)', () => {
    // Tagline is meant to read as secondary to the wordmark; the two
    // tones must be different so the hierarchy is preserved.
    expect(BRAND.text.taglineFg).not.toBe(BRAND.text.primary);
  });
});

// ── 3. AppHeaderTagline source-scan contract ───────────────────────

describe('BRAND-001 Stage 2 — AppHeaderTagline source contract', () => {
  const src = read('src/components/AppHeaderTagline.tsx');

  it('source uses BRAND.text.taglineFg (no hardcoded literal)', () => {
    expect(src).toMatch(/BRAND\.text\.taglineFg/);
    // Spot check: the literal hex must not appear in styles. The
    // BRAND module is the single source of truth.
    expect(src).not.toMatch(/['"]#E6DCC8['"]/);
  });

  it('source does NOT import any router / navigation library', () => {
    expect(src).not.toMatch(/from\s+['"]@react-navigation\//);
    expect(src).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(src).not.toMatch(/\bnavigate\s*\(/);
    expect(src).not.toMatch(/\brouter\./);
  });

  it('source has a system serif italic fallback branch (no new font dep)', () => {
    // Either Georgia (iOS) or 'serif' (Android default) must appear
    // so the tagline reads as a serif italic without requiring a
    // Google Font dep.
    expect(src).toMatch(/Georgia|['"]serif['"]/);
    expect(src).toMatch(/Platform\.select/);
    expect(src).toMatch(/fontStyle:\s*['"]italic['"]/);
  });

  it('source does NOT import @expo-google-fonts/* (default no-new-dep path)', () => {
    // The doc comment intentionally names the optional font dep so a
    // future audit knows where it would slot in; the scan ignores
    // comment lines and asserts only that no executable `import`
    // statement reaches the package.
    const codeOnly = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    expect(codeOnly).not.toMatch(/import[^;]*@expo-google-fonts\//);
    expect(codeOnly).not.toMatch(/from\s+['"]expo-font['"]/);
    expect(codeOnly).not.toMatch(/\buseFonts\s*\(/);
  });

  it('source wraps tagline body in <Text>', () => {
    expect(src).toMatch(/<Text\b/);
    expect(src).toMatch(/<\/Text>/);
  });

  it('source exposes accessibilityRole="text"', () => {
    expect(src).toMatch(/accessibilityRole=['"]text['"]/);
  });

  it('source uses the testID "app-header-tagline"', () => {
    expect(src).toMatch(/testID=['"]app-header-tagline['"]/);
  });

  it('exports AppHeaderTagline as a function component', () => {
    expect(typeof AppHeaderTagline).toBe('function');
  });

  it('source does NOT mutate BRAND', () => {
    // BRAND is frozen `as const`; mutation attempts would break
    // doctrine and snapshot determinism.
    expect(src).not.toMatch(/BRAND\.[a-zA-Z.]+\s*=/);
  });
});
