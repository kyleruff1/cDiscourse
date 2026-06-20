/**
 * QUICK-BRAND-LOCKUP-002 / QUICK-BRAND-LOCKUP-003 — CivilDiscourse lockup.
 *
 * The operator re-cut the horizontal CivilDiscourse lockup from the gold
 * 800×260 art (UX-BRAND-ASSETS-002) to a gold/cream duotone 960×342, and
 * then again (QUICK-BRAND-LOCKUP-003) to an isolated black/white bird +
 * larger gold wordmark + gold glow 1400×331 RGBA lockup. The PNG binary is
 * already placed in the worktree; this card is the aspect-ratio + test
 * wiring + a freeze guard.
 *
 * This suite is the authoritative guard for the new card. It pins:
 *   (1) both lockup PNGs are the new 1400×331 RGBA art and are byte-identical
 *       (the masthead + Sign In hero use the same lockup file content);
 *   (2) the rendered aspect (AppHeader masthead + Sign In hero) is 1400/331;
 *   (3) the favicon + native icons are FROZEN — `app.json` still points
 *       `expo.web.favicon` at `civildiscourse-favicon.png`, the favicon PNG
 *       is the unchanged 512×512 art, and the native icon / adaptive-icon /
 *       splash paths are untouched.
 *
 * Pure source/config + asset byte scan (repo idiom — "render tests aren't
 * set up project-wide", per appHeader.test.ts / uxBrandAssets002).
 */
import fs from 'fs';
import path from 'path';
import { resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import { SIGNIN_LOCKUP_ASPECT_RATIO } from '../src/features/auth/signInLockupModel';

const ROOT = path.join(__dirname, '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const PNG_SIGNATURE = '89504e470d0a1a0a';

interface PngHeader {
  isPng: boolean;
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  size: number;
}

function readPngHeader(rel: string): PngHeader {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  return {
    isPng: buf.subarray(0, 8).toString('hex') === PNG_SIGNATURE,
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
    size: buf.length,
  };
}

const LOCKUP_PATHS = [
  'assets/branding/lockup-horizontal.png',
  'assets/branding/civic-discourse-logo.png',
] as const;

// ── (1) the new 1400×331 RGBA b/w bird + larger gold wordmark lockup ─

describe('QUICK-BRAND-LOCKUP-003 (1) — lockup assets are the new 1400×331 RGBA art', () => {
  for (const rel of LOCKUP_PATHS) {
    it(`${rel} is a PNG, 1400×331, colorType 6 (RGBA), bitDepth 8`, () => {
      const h = readPngHeader(rel);
      expect(h.isPng).toBe(true);
      expect(h.width).toBe(1400);
      expect(h.height).toBe(331);
      expect(h.colorType).toBe(6); // RGBA
      expect(h.bitDepth).toBe(8);
      // Still a small editorial PNG (NOT the prior 2.3 MB grey scene).
      expect(h.size).toBeGreaterThan(10_000);
      expect(h.size).toBeLessThan(500_000);
    });
  }

  it('the masthead logo and the Sign In hero lockup are byte-identical (same art)', () => {
    const a = fs.readFileSync(path.join(ROOT, LOCKUP_PATHS[0]));
    const b = fs.readFileSync(path.join(ROOT, LOCKUP_PATHS[1]));
    expect(a.equals(b)).toBe(true);
  });
});

// ── (2) the rendered aspect is 1400/331 ──────────────────────────

describe('QUICK-BRAND-LOCKUP-003 (2) — rendered aspect is 1400/331 (≈ 4.230)', () => {
  const ASPECT = 1400 / 331;

  it('SIGNIN_LOCKUP_ASPECT_RATIO is exactly 1400 / 331', () => {
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBe(1400 / 331);
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBeCloseTo(4.230, 3);
    // It is wider than the prior gold/cream 960/342 (2.807) and the original
    // grey scene (1.5) — the larger gold wordmark stretches it horizontally.
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBeGreaterThan(960 / 342);
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBeGreaterThan(1.5);
  });

  it('the AppHeader masthead aspect constant source is 1400 / 331', () => {
    const headerSrc = read('src/components/AppHeader.tsx');
    expect(headerSrc).toMatch(/LOGO_ASPECT_RATIO\s*=\s*1400\s*\/\s*331/);
    // The prior gold 800/260 constant must be gone.
    expect(headerSrc).not.toMatch(/LOGO_ASPECT_RATIO\s*=\s*800\s*\/\s*260/);
    // The prior gold/cream 960/342 constant must be gone.
    expect(headerSrc).not.toMatch(/LOGO_ASPECT_RATIO\s*=\s*960\s*\/\s*342/);
  });

  it('the masthead resolver fits the rendered width to the 1400/331 aspect (no overflow)', () => {
    // The resolver caps the height so rendered width = height × aspect never
    // exceeds the available width (viewport − 24 px padding) on any band.
    const widths: Array<[number, number]> = [
      [320, 320],
      [390, 390],
      [768, 768],
      [1024, 1024],
    ];
    for (const [viewport] of widths) {
      const h = resolveMastheadLogoHeightPx('phone', viewport);
      expect(h * ASPECT).toBeLessThanOrEqual(viewport);
    }
    // 390 phone: available = 366, fit = floor(366 / (1400/331)) = 86.
    expect(resolveMastheadLogoHeightPx('phone', 390)).toBe(86);
  });
});

// ── (3) favicon + native icons FROZEN ────────────────────────────

describe('QUICK-BRAND-LOCKUP-003 (3) — favicon + native icons are FROZEN', () => {
  // app.json is read as raw JSON (not require) so the assertion is on the
  // committed config exactly as Expo / Metro reads it.
  const appJson = JSON.parse(read('app.json')) as {
    expo: {
      icon?: string;
      web?: { favicon?: string };
      android?: { adaptiveIcon?: { foregroundImage?: string } };
      splash?: { image?: string };
    };
  };

  it('expo.web.favicon still points at the unchanged civildiscourse-favicon.png', () => {
    expect(appJson.expo.web?.favicon).toBe('./assets/branding/civildiscourse-favicon.png');
  });

  it('civildiscourse-favicon.png exists and is the unchanged 512×512 RGBA art', () => {
    const h = readPngHeader('assets/branding/civildiscourse-favicon.png');
    expect(h.isPng).toBe(true);
    expect(h.width).toBe(512);
    expect(h.height).toBe(512);
  });

  it('the native icon / adaptive-icon / splash paths are untouched', () => {
    expect(appJson.expo.icon).toBe('./assets/icon.png');
    expect(appJson.expo.android?.adaptiveIcon?.foregroundImage).toBe('./assets/adaptive-icon.png');
    expect(appJson.expo.splash?.image).toBe('./assets/splash-icon.png');
  });

  it('app.json does NOT repoint any icon/favicon at a lockup asset', () => {
    // Guard against an accidental favicon/native swap to the lockup art.
    expect(appJson.expo.web?.favicon).not.toMatch(/lockup-horizontal|civic-discourse-logo/);
    expect(appJson.expo.icon).not.toMatch(/lockup-horizontal|civic-discourse-logo/);
  });
});
