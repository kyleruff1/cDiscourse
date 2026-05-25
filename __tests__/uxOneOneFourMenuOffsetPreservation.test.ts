/**
 * UX-001.4 — Menu offset cap preservation guard.
 *
 * UX-001.2 set hard caps for the first substantive Timeline row at:
 *   phone   ≤ 128 px
 *   tablet  ≤ 168 px
 *   wide    ≤ 200 px
 *
 * UX-001.4's menus are Modal overlays (chassis Popout) — they sit ON
 * TOP of the viewport, they do not displace the Timeline. This suite
 * proves the invariant by verifying:
 *
 *   (a) `menuPresentationModel.resolveMenuPresentation` returns sizing
 *       VALUES the host applies to the overlay panel; it never returns
 *       a value the host could subtract from the Timeline area.
 *   (b) `timelineViewportLayoutModel.BAND_RAIL_OFFSET` is byte-equal
 *       across UX-001.4 (no modification by the new menus).
 *   (c) `BRAND.headerHeightByBand` is byte-equal (UX-001.1's
 *       pinned-by-UX-001.2 contract).
 */
import {
  resolveMenuPresentation,
  TABLET_LANDSCAPE_THRESHOLD,
} from '../src/features/arguments/oneBox/menuPresentationModel';
import {
  BAND_RAIL_OFFSET,
  BAND_RAIL_OFFSET_MAX,
} from '../src/features/arguments/timelineViewportLayoutModel';
import { BRAND } from '../src/lib/designTokens';

describe('UX-001.4 — UX-001.2 offset caps preserved', () => {
  it('BAND_RAIL_OFFSET values are byte-equal to UX-001.2 contract { phone: 0, tablet: 0, wide: 0 }', () => {
    expect(BAND_RAIL_OFFSET.phone).toBe(0);
    expect(BAND_RAIL_OFFSET.tablet).toBe(0);
    expect(BAND_RAIL_OFFSET.wide).toBe(0);
  });

  it('BAND_RAIL_OFFSET_MAX envelope is byte-equal to UX-001.2 contract { phone: 12, tablet: 12, wide: 16 }', () => {
    expect(BAND_RAIL_OFFSET_MAX.phone).toBe(12);
    expect(BAND_RAIL_OFFSET_MAX.tablet).toBe(12);
    expect(BAND_RAIL_OFFSET_MAX.wide).toBe(16);
  });

  it('BRAND.headerHeightByBand is byte-equal to UX-001.1 contract { phone: 64, tablet: 96, wide: 120 }', () => {
    expect(BRAND.headerHeightByBand.phone).toBe(64);
    expect(BRAND.headerHeightByBand.tablet).toBe(96);
    expect(BRAND.headerHeightByBand.wide).toBe(120);
  });
});

describe('UX-001.4 — menu presentation returns overlay sizing (not displaced sizing)', () => {
  // The three menus are Modal-mounted. The resolver returns a panel
  // maxHeight + width — these are caps on the OVERLAY's footprint, not
  // values the host would subtract from the timeline area. The
  // assertion: for every required viewport × menu, the returned
  // maxHeight fits inside the viewport AND the variant is one the
  // chassis renders as an overlay.

  const VIEWPORTS = [
    { name: '390x844 (phone)', band: 'phone' as const, w: 390, h: 844 },
    { name: '1024x1366 (tablet portrait)', band: 'tablet' as const, w: 1024, h: 1366 },
    { name: '1366x768 (laptop / tablet landscape)', band: 'tablet' as const, w: 1366, h: 768 },
    { name: '1920x1080 (wide)', band: 'wide' as const, w: 1920, h: 1080 },
  ];
  const MENUS = ['act', 'inspect', 'go'] as const;

  for (const v of VIEWPORTS) {
    for (const menu of MENUS) {
      it(`${menu} on ${v.name} returns sheet_bottom / panel_side / panel_anchored (Modal-overlay variants)`, () => {
        const out = resolveMenuPresentation({
          band: v.band,
          menu,
          windowWidth: v.w,
          windowHeight: v.h,
        });
        expect(['sheet_bottom', 'panel_side', 'panel_anchored']).toContain(out.variant);
      });

      it(`${menu} on ${v.name} maxHeight fits inside the viewport (overlay does not exceed viewport)`, () => {
        const out = resolveMenuPresentation({
          band: v.band,
          menu,
          windowWidth: v.w,
          windowHeight: v.h,
        });
        expect(out.maxHeight).toBeGreaterThan(0);
        expect(out.maxHeight).toBeLessThanOrEqual(v.h);
      });
    }
  }
});

describe('UX-001.4 — Timeline first-row offset cap arithmetic unchanged', () => {
  // The cap arithmetic from uxOneOneTwoOffsetAcceptance.test.ts:
  //   sumOffsetForBand =
  //     headerHeight + stripHeight + railTopOffset + RAIL_TOP_ADJUST(19)
  //
  // UX-001.4 modifies NONE of the inputs (headerHeightByBand,
  // strip dimensions, BAND_RAIL_OFFSET). The menus overlay; they
  // never shift the timeline body. The test below makes the
  // invariant explicit by recomputing the sum from the same primitives
  // and asserting the hard caps.

  const STRIP_HEIGHT = { phone: 45, tablet: 51, wide: 59 };
  const RAIL_TOP_ADJUST = 19;
  const HARD_CAP = { phone: 128, tablet: 168, wide: 200 };

  for (const band of ['phone', 'tablet', 'wide'] as const) {
    it(`${band} band offset sum ≤ ${HARD_CAP[band]} (UX-001.2 cap preserved)`, () => {
      const headerHeight = BRAND.headerHeightByBand[band];
      const railTopOffset = BAND_RAIL_OFFSET[band];
      const sum = headerHeight + STRIP_HEIGHT[band] + railTopOffset + RAIL_TOP_ADJUST;
      expect(sum).toBeLessThanOrEqual(HARD_CAP[band]);
    });
  }
});

describe('UX-001.4 — TABLET_LANDSCAPE_THRESHOLD matches the iPad Pro horizontal viewport', () => {
  it('threshold is exposed at 1024 (iPad Pro horizontal + Chromebook tablet-class landscape)', () => {
    expect(TABLET_LANDSCAPE_THRESHOLD).toBe(1024);
  });
});
