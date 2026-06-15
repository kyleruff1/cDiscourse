/**
 * UX-MOBILE-004 — compact phone masthead logo (supersedes the UX-MOBILE-001
 * fit-to-width phone behavior).
 *
 * Live 390/300 measurement against current main confirmed #654 removed the body
 * overflow (no horizontal scroll, no edge gutter, usedFraction 1.0), but the
 * phone masthead stayed prominent-but-tall (fitted ~244px at 390), eating the
 * mobile first screen. The logo is product guidance, not a fixed-pixel mandate:
 * on phone it is now capped to a COMPACT height so the masthead leaves room for
 * the first interactive content, while tablet/wide keep the prominent 288px.
 * Width still never exceeds the viewport at any tested width.
 */
import { resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import type { Band } from '../src/hooks/useHeaderBreakpoint';

const ASPECT = 1.5;
const PHONE_WIDTHS = [320, 360, 390, 414, 480];

describe('UX-MOBILE-004 resolveMastheadLogoHeightPx — compact phone, prominent desktop', () => {
  it('caps the phone logo to a compact height (<= 160) so the masthead does not dominate mobile', () => {
    for (const w of PHONE_WIDTHS) {
      const h = resolveMastheadLogoHeightPx('phone', w);
      expect(h).toBeLessThanOrEqual(160);
    }
  });

  it('keeps the phone logo readable (>= 96) and viewport-safe (width <= viewport) at every width', () => {
    for (const w of PHONE_WIDTHS) {
      const h = resolveMastheadLogoHeightPx('phone', w);
      expect(h).toBeGreaterThanOrEqual(96);
      expect(h * ASPECT).toBeLessThanOrEqual(w);
    }
  });

  it('is meaningfully more compact than the prior fit-to-width behavior at 390', () => {
    // Prior behavior fitted to (390-24)/1.5 = 244; the compact cap is 160.
    expect(resolveMastheadLogoHeightPx('phone', 390)).toBe(160);
    expect(resolveMastheadLogoHeightPx('phone', 390)).toBeLessThan(244);
  });

  it('keeps the prominent 288px logo on tablet and wide (it physically fits)', () => {
    for (const [w, band] of [[768, 'tablet'], [1024, 'tablet'], [1280, 'wide']] as Array<[number, Band]>) {
      const h = resolveMastheadLogoHeightPx(band, w);
      expect(h).toBe(288);
      expect(h * ASPECT).toBeLessThanOrEqual(w);
    }
  });
});
