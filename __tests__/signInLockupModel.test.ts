/**
 * UX-BRAND-ASSETS-001 — Sign In hero lockup sizing model.
 *
 * Pure-TS unit tests for `resolveSignInLockupWidthPx` + the exported
 * sizing constants. The helper owns the single responsive decision that
 * keeps the cream lockup from ever overflowing horizontally or creating
 * a mobile edge gutter, so it is unit-tested at the four hard-blocker
 * viewports plus the extension widths the card enumerates
 * (320/360/390/414/600/768/1024).
 */
import {
  resolveSignInLockupWidthPx,
  SIGNIN_LOCKUP_ASPECT_RATIO,
  MAX_SIGNIN_LOCKUP_WIDTH_PX,
  SIGNIN_LOCKUP_HORIZONTAL_BUDGET_PX,
} from '../src/features/auth/signInLockupModel';

describe('UX-BRAND-ASSETS-001 — sizing constants', () => {
  it('aspect ratio matches the intrinsic ~1499/388 lockup proportion', () => {
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBeCloseTo(1499 / 388, 5);
    // It is a wide horizontal lockup, so aspect ratio > 3.
    expect(SIGNIN_LOCKUP_ASPECT_RATIO).toBeGreaterThan(3);
  });

  it('caps the rendered width so the mark stays editorial on wide viewports', () => {
    expect(MAX_SIGNIN_LOCKUP_WIDTH_PX).toBe(320);
  });

  it('reserves a horizontal chrome budget (screen + card padding)', () => {
    expect(SIGNIN_LOCKUP_HORIZONTAL_BUDGET_PX).toBe(72);
  });
});

describe('UX-BRAND-ASSETS-001 — resolveSignInLockupWidthPx clamping', () => {
  // The card's available width is viewport - 72 (20px screen padding ×2 +
  // 16px card padding ×2). The result must never exceed that, never exceed
  // the cap, and never be negative.
  const VIEWPORTS = [320, 360, 390, 414, 600, 768, 1024] as const;

  for (const width of VIEWPORTS) {
    it(`width=${width}: never overflows the card and never exceeds the cap`, () => {
      const result = resolveSignInLockupWidthPx(width);
      const available = width - SIGNIN_LOCKUP_HORIZONTAL_BUDGET_PX;
      // Never wider than the card's available width (no overflow / gutter).
      expect(result).toBeLessThanOrEqual(available);
      // Never wider than the editorial cap.
      expect(result).toBeLessThanOrEqual(MAX_SIGNIN_LOCKUP_WIDTH_PX);
      // Always a positive, finite width on a real viewport.
      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });
  }

  it('narrow phone (320) fits within the available card width', () => {
    // 320 - 72 = 248 available; below the 320 cap, so the available width wins.
    expect(resolveSignInLockupWidthPx(320)).toBe(248);
  });

  it('mid phone (390) fits within the available card width', () => {
    // 390 - 72 = 318 available; still below the 320 cap.
    expect(resolveSignInLockupWidthPx(390)).toBe(318);
  });

  it('the cap engages once the viewport is wide enough', () => {
    // 414 - 72 = 342 available > 320 cap → cap wins.
    expect(resolveSignInLockupWidthPx(414)).toBe(MAX_SIGNIN_LOCKUP_WIDTH_PX);
    expect(resolveSignInLockupWidthPx(768)).toBe(MAX_SIGNIN_LOCKUP_WIDTH_PX);
    expect(resolveSignInLockupWidthPx(1024)).toBe(MAX_SIGNIN_LOCKUP_WIDTH_PX);
  });

  it('monotonic: a wider viewport never returns a narrower width', () => {
    let prev = 0;
    for (const width of VIEWPORTS) {
      const result = resolveSignInLockupWidthPx(width);
      expect(result).toBeGreaterThanOrEqual(prev);
      prev = result;
    }
  });
});

describe('UX-BRAND-ASSETS-001 — SSR / first-paint safety', () => {
  it('non-positive width (width===0 first paint) falls back to the cap', () => {
    expect(resolveSignInLockupWidthPx(0)).toBe(MAX_SIGNIN_LOCKUP_WIDTH_PX);
    expect(resolveSignInLockupWidthPx(-100)).toBe(MAX_SIGNIN_LOCKUP_WIDTH_PX);
  });

  it('non-finite width falls back to the cap', () => {
    expect(resolveSignInLockupWidthPx(Number.NaN)).toBe(MAX_SIGNIN_LOCKUP_WIDTH_PX);
    expect(resolveSignInLockupWidthPx(Number.POSITIVE_INFINITY)).toBe(
      MAX_SIGNIN_LOCKUP_WIDTH_PX,
    );
  });
});
