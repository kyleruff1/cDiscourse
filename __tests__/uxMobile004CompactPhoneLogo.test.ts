/**
 * UX-MOBILE-004 — compact phone masthead logo (supersedes the UX-MOBILE-001
 * fit-to-width phone behavior). UX-BRAND-ASSETS-002 — re-pinned for the gold
 * lockup aspect.
 *
 * Live 390/300 measurement against main confirmed #654 removed the body
 * overflow, but the phone masthead stayed prominent-but-tall, eating the
 * mobile first screen. The logo is product guidance, not a fixed-pixel
 * mandate: on phone it is capped to a COMPACT height so the masthead leaves
 * room for the first interactive content, while tablet/wide keep the
 * prominent 288px WHERE IT FITS.
 *
 * QUICK-BRAND-LOCKUP-003 — the masthead logo is now the isolated b/w bird +
 * larger gold wordmark horizontal lockup (aspect ≈ 4.230, was 960/342 ≈ 2.807,
 * originally 1.5). At the new aspect the rendered logo width (height × aspect)
 * is the binding constraint on every band, so the height is capped by the
 * available width; the prominent 288px only fits once the viewport is wide
 * enough (≳ 1242px).
 */
import { resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import type { Band } from '../src/hooks/useHeaderBreakpoint';

const ASPECT = 1400 / 331; // QUICK-BRAND-LOCKUP-003 gold lockup aspect (≈ 4.230)
const PHONE_WIDTHS = [320, 360, 390, 414, 480];

describe('UX-MOBILE-004 / UX-BRAND-ASSETS-002 resolveMastheadLogoHeightPx — compact phone, prominent desktop', () => {
  it('caps the phone logo to a compact height (<= 160) so the masthead does not dominate mobile', () => {
    for (const w of PHONE_WIDTHS) {
      const h = resolveMastheadLogoHeightPx('phone', w);
      expect(h).toBeLessThanOrEqual(160);
    }
  });

  it('keeps the phone logo readable (>= 64) and viewport-safe (width <= viewport) at every width', () => {
    for (const w of PHONE_WIDTHS) {
      const h = resolveMastheadLogoHeightPx('phone', w);
      expect(h).toBeGreaterThanOrEqual(64);
      expect(h * ASPECT).toBeLessThanOrEqual(w);
    }
  });

  it('the gold lockup at 390 fits the width and is compact (height well under the 160 cap)', () => {
    // available = 390 - 24 = 366; fit = floor(366 / 4.230) = 86 (< the 160 cap).
    const h = resolveMastheadLogoHeightPx('phone', 390);
    expect(h).toBe(86);
    expect(h * ASPECT).toBeLessThanOrEqual(390);
    expect(h).toBeLessThan(160);
  });

  it('keeps the prominent 288px logo on tablet/wide WHERE IT FITS, else caps by width', () => {
    // The prominent gold lockup is 288 × 4.230 ≈ 1218px wide; it only fits
    // once the available width clears that (viewport ≳ 1242px).
    expect(resolveMastheadLogoHeightPx('tablet', 1280)).toBe(288);
    expect(resolveMastheadLogoHeightPx('wide', 1280)).toBe(288);
    for (const [w, band] of [[1280, 'tablet'], [1280, 'wide'], [1440, 'wide']] as Array<[number, Band]>) {
      const h = resolveMastheadLogoHeightPx(band, w);
      expect(h).toBe(288);
      expect(h * ASPECT).toBeLessThanOrEqual(w);
    }
    // Narrow tablet: the prominent height would overflow, so it is fitted
    // to the available width instead (no horizontal overflow / edge gutter).
    for (const [w, band] of [[600, 'tablet'], [768, 'tablet']] as Array<[number, Band]>) {
      const h = resolveMastheadLogoHeightPx(band, w);
      expect(h).toBeLessThan(288);
      expect(h * ASPECT).toBeLessThanOrEqual(w);
    }
  });
});
