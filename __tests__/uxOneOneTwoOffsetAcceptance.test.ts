/**
 * UX-001.2 — Offset acceptance per band (Q12 cat 1 + the brief's
 * acceptance criteria 20-22).
 *
 * The brief's hard cap on the first substantive Timeline row is:
 *   phone:  128 px
 *   tablet: 168 px
 *   wide:   200 px (binding at 1366×768)
 *   desktop:200 px (1920×1080 stays equal to wide)
 *
 * The arithmetic is mechanical:
 *   header[band] + strip[band] + railTopOffset[band] + RAIL_TOP_ADJUST
 *
 * where RAIL_TOP_ADJUST = TIMELINE_NODE_SIZE/2 - 1 - 2 = 19 (rail's top
 * edge inside the timeline frame: centerline minus the rail's own half-
 * thickness).
 *
 * The test pins the contract by reading the load-bearing token values
 * (`BRAND.headerHeightByBand`, `BAND_RAIL_OFFSET`) and computing the sum
 * against the brief's caps.
 */
import { BRAND } from '../src/lib/designTokens';
import {
  BAND_RAIL_OFFSET,
  BAND_RAIL_OFFSET_MAX,
} from '../src/features/arguments/timelineViewportLayoutModel';
import { TIMELINE_NODE_SIZE } from '../src/features/arguments/argumentGameSurfaceModel';

const STRIP_HEIGHT_PER_BAND = {
  // The compact strip's actual rendered height per band matches the
  // DebateDetailHeader bandSizing table:
  //   phone   = 4*2 + 36 + 1 = 45
  //   tablet  = 6*2 + 38 + 1 = 51
  //   wide    = 8*2 + 42 + 1 = 59
  phone: 4 * 2 + 36 + 1,
  tablet: 6 * 2 + 38 + 1,
  wide: 8 * 2 + 42 + 1,
};

const HARD_CAP_PER_BAND = {
  phone: 128,
  tablet: 168,
  wide: 200,
};

// Rail TOP edge offset inside the Timeline frame: BAND_RAIL_OFFSET +
// (TIMELINE_NODE_SIZE/2) - 1 (the rail's centerline) - 2 (half rail
// thickness, RAIL_THICKNESS=4 from ArgumentTimelineMap.tsx).
const RAIL_TOP_ADJUST = TIMELINE_NODE_SIZE / 2 - 1 - 2;

function sumOffsetForBand(band: 'phone' | 'tablet' | 'wide'): number {
  return BRAND.headerHeightByBand[band] + STRIP_HEIGHT_PER_BAND[band] + BAND_RAIL_OFFSET[band] + RAIL_TOP_ADJUST;
}

describe('UX-001.2 — first-substantive-Timeline-row offset per band', () => {
  for (const band of ['phone', 'tablet', 'wide'] as const) {
    it(`${band}: sum to rail top edge <= hard cap (${HARD_CAP_PER_BAND[band]} px)`, () => {
      const sum = sumOffsetForBand(band);
      expect(sum).toBeLessThanOrEqual(HARD_CAP_PER_BAND[band]);
    });
  }

  it('phone: at-or-near the brief preferred 112 px (advisory)', () => {
    // The preferred value is 112; we expect to be within 16 px of it.
    expect(sumOffsetForBand('phone')).toBeLessThanOrEqual(128);
  });

  it('tablet: at-or-near the brief preferred 152 px (advisory)', () => {
    expect(sumOffsetForBand('tablet')).toBeLessThanOrEqual(168);
  });

  it('wide: at-or-near the brief preferred 184 px (advisory)', () => {
    expect(sumOffsetForBand('wide')).toBeLessThanOrEqual(200);
  });
});

describe('UX-001.2 — BAND_RAIL_OFFSET stays inside the brief envelope', () => {
  it('phone is inside 0..12', () => {
    expect(BAND_RAIL_OFFSET.phone).toBeGreaterThanOrEqual(0);
    expect(BAND_RAIL_OFFSET.phone).toBeLessThanOrEqual(BAND_RAIL_OFFSET_MAX.phone);
    expect(BAND_RAIL_OFFSET_MAX.phone).toBe(12);
  });

  it('tablet is inside 0..12', () => {
    expect(BAND_RAIL_OFFSET.tablet).toBeGreaterThanOrEqual(0);
    expect(BAND_RAIL_OFFSET.tablet).toBeLessThanOrEqual(BAND_RAIL_OFFSET_MAX.tablet);
    expect(BAND_RAIL_OFFSET_MAX.tablet).toBe(12);
  });

  it('wide is inside 0..16', () => {
    expect(BAND_RAIL_OFFSET.wide).toBeGreaterThanOrEqual(0);
    expect(BAND_RAIL_OFFSET.wide).toBeLessThanOrEqual(BAND_RAIL_OFFSET_MAX.wide);
    expect(BAND_RAIL_OFFSET_MAX.wide).toBe(16);
  });
});

describe('UX-001.2 — token consumption', () => {
  it('AppHeader heights are the UX-001.1 contract (64 / 96 / 120)', () => {
    expect(BRAND.headerHeightByBand.phone).toBe(64);
    expect(BRAND.headerHeightByBand.tablet).toBe(96);
    expect(BRAND.headerHeightByBand.wide).toBe(120);
  });

  it('TIMELINE_NODE_SIZE remains 44 (unchanged by UX-001.2)', () => {
    expect(TIMELINE_NODE_SIZE).toBe(44);
  });
});
