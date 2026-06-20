/**
 * QUICK-BRAND-LOCKUP-003 — isolated b/w bird + larger gold wordmark lockup.
 *
 * The operator re-cut the horizontal CivilDiscourse lockup from the
 * gold/cream duotone 960×342 art (QUICK-BRAND-LOCKUP-002) to an isolated
 * black/white bird + a LARGER gold wordmark (full "C" preserved) + gold
 * glow, exported at 1400×331 RGBA. The PNG binary is already placed in the
 * worktree; this card is the aspect-ratio + test wiring + a freeze guard.
 *
 * The wider aspect (≈ 4.230 vs the prior ≈ 2.807) means the prominent
 * 288 px masthead height now fits at a WIDER viewport: 288 × 4.230 ≈ 1218 px
 * of rendered width needs ~1242 px of viewport, so the prominent-288
 * threshold moves from ~1024 to ~1280. `resolveMastheadLogoHeightPx` is
 * UNCHANGED — its `min(PROMINENT_288, widthFit)` already returns the
 * prominent height only where it physically fits and width-fits otherwise.
 *
 * This suite pins:
 *   (1) both lockup PNGs are the new 1400×331 RGBA art and are byte-identical;
 *   (2) the rendered aspect (AppHeader masthead + Sign In hero) is 1400/331;
 *   (3) the prominent-288 masthead height fits at ≳1242 px (1280 → 288) but
 *       NOT at 1024 (it width-fits below 288), with no horizontal overflow
 *       at any band;
 *   (4) the favicon + native icons are FROZEN.
 *
 * Pure source/config + asset byte scan (repo idiom — "render tests aren't
 * set up project-wide", per appHeader.test.ts / uxBrandAssets002).
 */
import fs from 'fs';
import path from 'path';
import { resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import {
  SIGNIN_LOCKUP_ASPECT_RATIO,
  resolveSignInLockupHeightPx,
  resolveSignInLockupWidthPx,
} from '../src/features/auth/signInLockupModel';
import type { Band } from '../src/hooks/useHeaderBreakpoint';

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

const PROMINENT = 288;
const HEADER_PADDING = 24; // root paddingHorizontal (12 + 12)

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
  it('SIGNIN_LOCKUP_ASPECT_RATIO is exactly 1400 / 331', () => {
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBe(1400 / 331);
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBeCloseTo(4.23, 2);
    // Wider than the prior gold/cream 960/342 (2.807) — the larger gold
    // wordmark stretches the lockup horizontally.
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBeGreaterThan(960 / 342);
  });

  it('the AppHeader masthead aspect constant source is 1400 / 331', () => {
    const headerSrc = read('src/components/AppHeader.tsx');
    expect(headerSrc).toMatch(/LOGO_ASPECT_RATIO\s*=\s*1400\s*\/\s*331/);
    // The prior gold/cream 960/342 and gold 800/260 constants must be gone.
    expect(headerSrc).not.toMatch(/LOGO_ASPECT_RATIO\s*=\s*960\s*\/\s*342/);
    expect(headerSrc).not.toMatch(/LOGO_ASPECT_RATIO\s*=\s*800\s*\/\s*260/);
  });

  it('the Sign In hero height tracks the 1400/331 aspect (width / aspect)', () => {
    for (const w of [320, 360, 390, 414, 768, 1024]) {
      const width = resolveSignInLockupWidthPx(w);
      const height = resolveSignInLockupHeightPx(w);
      expect(height).toBeCloseTo(width / SIGNIN_LOCKUP_ASPECT_RATIO, 1);
      expect(height).toBeGreaterThan(0);
    }
  });
});

// ── (3) the prominent-288 threshold moves to ~1280 (correct, not weaker) ─

describe('QUICK-BRAND-LOCKUP-003 (3) — prominent-288 fits at the wider aspect threshold', () => {
  it('the prominent 288 px height fits at ≳1242 px (1280 → 288), NOT at 1024', () => {
    // 288 × 4.230 ≈ 1218 px wide needs available ≥ 1218 (viewport ≳ 1242).
    for (const band of ['tablet', 'wide'] as Band[]) {
      // 1280: available = 1256, fit = floor(1256 / (1400/331)) = 296 ≥ 288 → 288.
      expect(resolveMastheadLogoHeightPx(band, 1280)).toBe(PROMINENT);
      expect(resolveMastheadLogoHeightPx(band, 1440)).toBe(PROMINENT);
      // 1024: available = 1000, fit = floor(1000 / (1400/331)) = 236 < 288 →
      // the logo width-fits BELOW the prominent height (correct, no overflow).
      expect(resolveMastheadLogoHeightPx(band, 1024)).toBeLessThan(PROMINENT);
    }
  });

  it('the rendered logo width never exceeds the available width at any band', () => {
    const aspect = 1400 / 331;
    const cases: Array<[Band, number]> = [
      ['phone', 320],
      ['phone', 360],
      ['phone', 390],
      ['phone', 414],
      ['tablet', 600],
      ['tablet', 768],
      ['tablet', 1024],
      ['wide', 1280],
      ['wide', 1440],
      ['wide', 1920],
    ];
    for (const [band, width] of cases) {
      const h = resolveMastheadLogoHeightPx(band, width);
      // height × aspect ≤ available width (viewport − header padding).
      expect(h * aspect).toBeLessThanOrEqual(width - HEADER_PADDING + 1);
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(PROMINENT);
    }
  });

  it('the phone legibility floor (≥64) stays viewport-safe at the narrowest phone', () => {
    // 320: available = 296, fit = floor(296 / (1400/331)) = 69 ≥ 64 → 69.
    const h = resolveMastheadLogoHeightPx('phone', 320);
    expect(h).toBeGreaterThanOrEqual(64);
    expect(h * (1400 / 331)).toBeLessThanOrEqual(320);
  });
});

// ── (4) favicon + native icons FROZEN ────────────────────────────

describe('QUICK-BRAND-LOCKUP-003 (4) — favicon + native icons are FROZEN', () => {
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

  it('civildiscourse-favicon.png is the unchanged 512×512 RGBA art', () => {
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
    expect(appJson.expo.web?.favicon).not.toMatch(/lockup-horizontal|civic-discourse-logo/);
    expect(appJson.expo.icon).not.toMatch(/lockup-horizontal|civic-discourse-logo/);
  });
});
