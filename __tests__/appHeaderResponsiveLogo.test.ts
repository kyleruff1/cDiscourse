/**
 * UX-MOBILE-001 (TICKET-001/002) + UX-BRAND-ASSETS-002 — responsive
 * masthead logo sizing.
 *
 * The logo Image renders at width = height × LOGO_ASPECT_RATIO.
 * UX-BRAND-ASSETS-002 swapped the masthead logo to the gold horizontal
 * lockup; QUICK-BRAND-LOCKUP-002 re-cut it to the gold/cream duotone
 * 960×342 lockup; QUICK-BRAND-LOCKUP-003 re-cut it again to the isolated
 * b/w bird + larger gold wordmark 1400×331 lockup (aspect ≈ 4.230), which
 * is MUCH wider per unit height than the prior grey scene (3:2 / aspect
 * 1.5). At the prominent 288px height the gold lockup would be ≈ 1218px
 * wide and overflow EVERY viewport short of ~1242px, so
 * resolveMastheadLogoHeightPx now caps the height by the
 * AVAILABLE WIDTH on every band (not just phone): the rendered width
 * (height × aspect) can never exceed the viewport, while the prominent
 * size is preserved where it physically fits (wide; tablet once the
 * viewport is wide enough).
 */
import { resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import type { Band } from '../src/hooks/useHeaderBreakpoint';

// QUICK-BRAND-LOCKUP-003 — gold lockup aspect (was 960/342 ≈ 2.807, before
// that 1.5 for the grey scene).
const ASPECT = 1400 / 331;
const PROMINENT = 288;
const HEADER_PADDING = 24; // root paddingHorizontal (12 + 12)

describe('UX-MOBILE-001 / UX-BRAND-ASSETS-002 resolveMastheadLogoHeightPx', () => {
  it('preserves the prominent logo on tablet and wide WHERE IT FITS', () => {
    // The prominent 288px gold lockup is 288 × 4.230 ≈ 1218px wide; it only
    // fits once the available width clears that, i.e. viewport ≳ 1242px.
    // At 1280: available = 1256, fit = floor(1256 / 4.230) = 296 ≥ 288 → 288.
    for (const band of ['tablet', 'wide'] as Band[]) {
      expect(resolveMastheadLogoHeightPx(band, 1280)).toBe(PROMINENT);
      expect(resolveMastheadLogoHeightPx(band, 1440)).toBe(PROMINENT);
    }
  });

  it('caps the logo by available width on a NARROW tablet (it would otherwise overflow)', () => {
    // 768px tablet: available = 744, fit = floor(744 / 4.230) = 175 < 288.
    const h = resolveMastheadLogoHeightPx('tablet', 768);
    expect(h).toBeLessThan(PROMINENT);
    expect(h * ASPECT).toBeLessThanOrEqual(768 - HEADER_PADDING);
  });

  it('keeps the prominent size for a non-positive (SSR / static) width', () => {
    expect(resolveMastheadLogoHeightPx('phone', 0)).toBe(PROMINENT);
    expect(resolveMastheadLogoHeightPx('wide', 0)).toBe(PROMINENT);
  });

  it('fits the logo so its rendered width never exceeds the viewport at every band', () => {
    const cases: Array<[Band, number]> = [
      ['phone', 320],
      ['phone', 360],
      ['phone', 390],
      ['phone', 414],
      ['phone', 480],
      ['tablet', 600],
      ['tablet', 768],
      ['tablet', 1024],
      ['wide', 1280],
      ['wide', 1440],
    ];
    for (const [band, width] of cases) {
      const h = resolveMastheadLogoHeightPx(band, width);
      // Core acceptance: width (height × aspect) must fit within the viewport.
      expect(h * ASPECT).toBeLessThanOrEqual(width);
      // Never larger than the prominent size.
      expect(h).toBeLessThanOrEqual(PROMINENT);
      expect(h).toBeGreaterThan(0);
    }
  });

  it('at the 390px target the fitted logo is well under the viewport', () => {
    const h = resolveMastheadLogoHeightPx('phone', 390);
    expect(h * ASPECT).toBeLessThanOrEqual(390 - HEADER_PADDING); // minus header padding
    expect(h).toBeGreaterThan(0);
  });

  it('never shrinks the phone logo below a legible floor while staying viewport-safe', () => {
    // Even on a very narrow phone the brand stays visible (and still fits).
    const h = resolveMastheadLogoHeightPx('phone', 320);
    expect(h).toBeGreaterThanOrEqual(64);
    expect(h * ASPECT).toBeLessThanOrEqual(320);
  });
});
