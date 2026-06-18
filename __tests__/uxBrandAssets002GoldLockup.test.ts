/**
 * UX-BRAND-ASSETS-002 — gold logo lockup everywhere + Sign In masthead dedup.
 *
 * Follow-up to UX-BRAND-ASSETS-001 (#678/#699). This card:
 *   (1) swaps the grey lockup/scene for the trimmed gold lockup on the Sign In
 *       value-prop card AND the app masthead, plus a new gold bird mark asset;
 *   (2) removes the DUPLICATIVE bare masthead banner that rendered above the
 *       AuthScreen (`signed_out`) — the Sign In screen already carries the
 *       gold lockup inside its value-prop card, so the top masthead was a
 *       second brand mark directly above it. The bare masthead still docks for
 *       the loading / invite / `/auth/callback` states;
 *   (3) width-guards the masthead logo sizing for the wider gold lockup aspect
 *       (≈ 3.077) so it never overflows / creates an edge gutter.
 *
 * Source/config + asset + pure-resolver scan (repo idiom — "render tests
 * aren't set up project-wide", per appHeader.test.ts).
 */
import fs from 'fs';
import path from 'path';
import { resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import type { Band } from '../src/hooks/useHeaderBreakpoint';

const ROOT = path.join(__dirname, '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const APP_SRC = read('App.tsx');
const AUTH_SRC = read('src/features/auth/AuthScreen.tsx');
const HEADER_SRC = read('src/components/AppHeader.tsx');
const SIGNIN_MODEL_SRC = read('src/features/auth/signInLockupModel.ts');

// ── (1) Gold assets are committed at the canonical paths ──────────

describe('UX-BRAND-ASSETS-002 (1) — gold assets committed', () => {
  function pngDims(rel: string): { width: number; height: number; size: number; isPng: boolean } {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    const isPng =
      buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), size: buf.length, isPng };
  }

  it('lockup-horizontal.png is the gold 800×260 lockup (Sign In card)', () => {
    const { width, height, size, isPng } = pngDims('assets/branding/lockup-horizontal.png');
    expect(isPng).toBe(true);
    expect(width).toBe(800);
    expect(height).toBe(260);
    expect(size).toBeLessThan(200_000); // small editorial PNG, not the 2.3 MB scene
  });

  it('civic-discourse-logo.png is now the gold 800×260 lockup (app masthead)', () => {
    const { width, height, size, isPng } = pngDims('assets/branding/civic-discourse-logo.png');
    expect(isPng).toBe(true);
    expect(width).toBe(800);
    expect(height).toBe(260);
    expect(size).toBeLessThan(200_000);
  });

  it('civildiscourse-mark.png is the new gold bird mark (420×315)', () => {
    const { width, height, isPng } = pngDims('assets/branding/civildiscourse-mark.png');
    expect(isPng).toBe(true);
    expect(width).toBe(420);
    expect(height).toBe(315);
  });
});

// ── (2) Sign In masthead dedup ───────────────────────────────────

describe('UX-BRAND-ASSETS-002 (2) — Sign In masthead removed; loading/invite/callback kept', () => {
  it('showRootHeader is FALSE for the plain signed_out (AuthScreen) state', () => {
    // The dedup: the bare masthead must NOT include the plain signed_out
    // branch. The new expression shows the root header for authCallback /
    // unconfigured / pendingInviteIntent only.
    expect(APP_SRC).toMatch(/const showRootHeader\s*=/);
    // It is still TRUE for the callback flow.
    expect(APP_SRC).toMatch(/showRootHeader\s*=\s*\n?\s*authCallback\.active/);
    // It is still TRUE for the loading state.
    expect(APP_SRC).toMatch(/state\.status === 'unconfigured'/);
    // It is still TRUE while an invite intent is in flight.
    expect(APP_SRC).toMatch(/Boolean\(pendingInviteIntent\)/);
    // The retired expression that ALSO showed the header for plain
    // signed_out (via the negated signed-in compound) must be gone.
    expect(APP_SRC).not.toMatch(
      /showRootHeader\s*=\s*[\s\S]*?!\(\s*[\s\S]*?state\.status !== 'signed_out'/,
    );
  });

  it('the bare AppHeader is still mounted under the showRootHeader gate', () => {
    // The masthead is rendered conditionally on showRootHeader (so it docks
    // for loading / invite / callback but not the plain Sign In screen).
    expect(APP_SRC).toMatch(
      /showRootHeader\s*\?\s*\(\s*\n?\s*<AppHeader onHomePress=\{handleHomePress\} rightSlot=\{preferencesTrigger\}\s*\/>/,
    );
  });

  it('the AuthScreen mount path is unchanged (signed_out branch)', () => {
    expect(APP_SRC).toMatch(/state\.status === 'signed_out'/);
    expect(APP_SRC).toMatch(/<AuthScreen \/>/);
  });
});

// ── (2b) Sign In screen still carries the gold lockup ────────────

describe('UX-BRAND-ASSETS-002 (2b) — Sign In value-prop lockup is preserved', () => {
  it('AuthScreen still renders the lockup Image from the gold asset path', () => {
    expect(AUTH_SRC).toContain("require('../../../assets/branding/lockup-horizontal.png')");
    expect(AUTH_SRC).toContain('testID="auth-brand-lockup"');
    expect(AUTH_SRC).toContain('source={SIGNIN_LOCKUP}');
  });

  it('the lockup Image keeps its brand-name accessibility label', () => {
    expect(AUTH_SRC).toContain('accessibilityLabel={AUTH_FIRST_RUN_COPY.brand}');
    expect(AUTH_SRC).toContain('accessibilityRole="image"');
  });

  it('the value-prop card is still present (it is the in-content brand surface)', () => {
    expect(AUTH_SRC).toContain('testID="auth-value-prop"');
  });
});

// ── (3) Sign In lockup aspect re-cut for the gold art ────────────

describe('UX-BRAND-ASSETS-002 (3) — Sign In lockup aspect is the gold 800/260', () => {
  it('SIGNIN_LOCKUP_ASPECT_RATIO is 800 / 260', () => {
    expect(SIGNIN_MODEL_SRC).toMatch(/SIGNIN_LOCKUP_ASPECT_RATIO\s*=\s*800\s*\/\s*260/);
    // The old grey-lockup constant must be gone.
    expect(SIGNIN_MODEL_SRC).not.toMatch(/SIGNIN_LOCKUP_ASPECT_RATIO\s*=\s*1499\s*\/\s*388/);
  });
});

// ── (4) Masthead width-guard for the wider gold aspect ───────────

describe('UX-BRAND-ASSETS-002 (4) — masthead width-guard for the gold lockup', () => {
  // The gold lockup is aspect ≈ 3.077; rendered width = height × aspect.
  const ASPECT = 800 / 260;
  const HEADER_PADDING = 24;

  it('the masthead uses the gold lockup aspect (≈ 3.077), not the old 1.5', () => {
    expect(HEADER_SRC).toMatch(/LOGO_ASPECT_RATIO\s*=\s*800\s*\/\s*260/);
    expect(HEADER_SRC).not.toMatch(/const LOGO_ASPECT_RATIO\s*=\s*1\.5/);
  });

  it('the rendered logo width never exceeds the viewport at the QA matrix widths', () => {
    const cases: Array<[Band, number]> = [
      ['phone', 320],
      ['phone', 360],
      ['phone', 390],
      ['phone', 414],
      ['tablet', 600],
      ['tablet', 768],
      ['tablet', 1024],
      ['wide', 1280],
      ['wide', 1920],
    ];
    for (const [band, width] of cases) {
      const h = resolveMastheadLogoHeightPx(band, width);
      expect(h * ASPECT).toBeLessThanOrEqual(width - HEADER_PADDING + 1);
      expect(h).toBeGreaterThan(0);
    }
  });

  it('caps a narrow tablet below the prominent height (the gold lockup would overflow)', () => {
    // 768px tablet: prominent 288 × 3.077 ≈ 886 > 744 available → fitted down.
    expect(resolveMastheadLogoHeightPx('tablet', 768)).toBeLessThan(288);
  });

  it('keeps the prominent 288 where the gold lockup physically fits (wide)', () => {
    expect(resolveMastheadLogoHeightPx('wide', 1280)).toBe(288);
    expect(resolveMastheadLogoHeightPx('wide', 1920)).toBe(288);
  });

  it('the legible phone floor stays viewport-safe at the narrowest tested phone', () => {
    const h = resolveMastheadLogoHeightPx('phone', 320);
    expect(h).toBeGreaterThanOrEqual(64);
    expect(h * ASPECT).toBeLessThanOrEqual(320);
  });
});
