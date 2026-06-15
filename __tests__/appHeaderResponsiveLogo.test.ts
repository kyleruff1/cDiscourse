/**
 * UX-MOBILE-001 (TICKET-001/002) — responsive masthead logo sizing.
 *
 * The logo Image renders at width = height × 1.5. At the prominent 288px height
 * that is 432px wide, which forces body-level horizontal scroll on a 390px
 * phone. resolveMastheadLogoHeightPx fits the logo to the viewport on phone so
 * its rendered width never exceeds the screen, while preserving the prominent
 * operator-decided size on tablet / wide.
 */
import { resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import type { Band } from '../src/hooks/useHeaderBreakpoint';

const ASPECT = 1.5;
const PROMINENT = 288;

describe('UX-MOBILE-001 resolveMastheadLogoHeightPx', () => {
  it('preserves the prominent logo on tablet and wide', () => {
    for (const band of ['tablet', 'wide'] as Band[]) {
      expect(resolveMastheadLogoHeightPx(band, 768)).toBe(PROMINENT);
      expect(resolveMastheadLogoHeightPx(band, 1440)).toBe(PROMINENT);
    }
  });

  it('keeps the prominent size for a non-positive (SSR / static) width', () => {
    expect(resolveMastheadLogoHeightPx('phone', 0)).toBe(PROMINENT);
    expect(resolveMastheadLogoHeightPx('wide', 0)).toBe(PROMINENT);
  });

  it('fits the phone logo so its rendered width never exceeds the viewport', () => {
    for (const width of [280, 320, 360, 390, 414, 480]) {
      const h = resolveMastheadLogoHeightPx('phone', width);
      // Core acceptance: width (height × aspect) must fit within the viewport.
      expect(h * ASPECT).toBeLessThanOrEqual(width);
      // Never larger than the prominent size.
      expect(h).toBeLessThanOrEqual(PROMINENT);
    }
  });

  it('at the 390px target the fitted logo is well under the viewport', () => {
    const h = resolveMastheadLogoHeightPx('phone', 390);
    expect(h * ASPECT).toBeLessThanOrEqual(390 - 24); // minus header padding
    expect(h).toBeGreaterThan(0);
  });

  it('never shrinks the phone logo below a legible floor', () => {
    // Even on a very narrow phone the brand stays visible (and still fits).
    const h = resolveMastheadLogoHeightPx('phone', 200);
    expect(h).toBeGreaterThanOrEqual(96);
    expect(h * ASPECT).toBeLessThanOrEqual(200);
  });
});
