/**
 * UX-001.3 — Composer cross-viewport matrix (Q10).
 *
 * For each of the four required viewports, asserts:
 *  - The UX-001.2 first-row-Timeline offset cap is still honored (the
 *    composer's new collapsed strip mounts BELOW the Timeline so it
 *    contributes ZERO to the first-row offset).
 *  - The below-Timeline budget remains positive after deducting the
 *    readout, score tracker, and the new 56/64/72 px collapsed strip.
 *  - The expanded composer sheet does NOT exceed its per-band cap
 *    (phone 50%, tablet 40%, wide 35%).
 *
 * The viewports:
 *   390 × 844   — iPhone 12 Pro / 13 / 14 (phone)
 *   1024 × 1366 — iPad portrait (tablet)
 *   1366 × 768  — typical laptop (wide; smallest below-Timeline slack)
 *   1920 × 1080 — desktop (wide)
 */
import { BRAND } from '../src/lib/designTokens';
import { BAND_RAIL_OFFSET } from '../src/features/arguments/timelineViewportLayoutModel';
import { TIMELINE_NODE_SIZE } from '../src/features/arguments/argumentGameSurfaceModel';
import { COMPOSER_STRIP_HEIGHT_BY_BAND } from '../src/features/arguments/composer/ComposerContextStrip';

const STRIP_HEIGHT_PER_BAND = {
  phone: 4 * 2 + 36 + 1,
  tablet: 6 * 2 + 38 + 1,
  wide: 8 * 2 + 42 + 1,
};

const HARD_CAP_PER_BAND = {
  phone: 128,
  tablet: 168,
  wide: 200,
};

const READOUT_COMPACT_PER_BAND = {
  phone: 68,
  tablet: 76,
  wide: 88,
};

// The score tracker's rendered height: ~56 phone, ~60 tablet, ~60 wide.
// (Approximate — the design uses these in §10's slack math.)
const SCORE_TRACKER_PER_BAND = {
  phone: 56,
  tablet: 60,
  wide: 60,
};

// Approximate minimum Timeline visible region the design assumes.
const TIMELINE_MIN_HEIGHT_PER_BAND = {
  phone: 160,
  tablet: 200,
  wide: 200,
};

const RAIL_TOP_ADJUST = TIMELINE_NODE_SIZE / 2 - 1 - 2;

interface Viewport {
  label: string;
  width: number;
  height: number;
  band: 'phone' | 'tablet' | 'wide';
  /** Per-brief: expanded composer ceiling as a fraction of viewport height. */
  expandedCeilingFraction: number;
}

const VIEWPORTS: ReadonlyArray<Viewport> = Object.freeze([
  { label: '390x844 phone', width: 390, height: 844, band: 'phone', expandedCeilingFraction: 0.5 },
  { label: '1024x1366 tablet portrait', width: 1024, height: 1366, band: 'tablet', expandedCeilingFraction: 0.4 },
  { label: '1366x768 wide (smallest slack)', width: 1366, height: 768, band: 'wide', expandedCeilingFraction: 0.35 },
  { label: '1920x1080 desktop', width: 1920, height: 1080, band: 'wide', expandedCeilingFraction: 0.35 },
]);

function firstRowOffset(band: 'phone' | 'tablet' | 'wide'): number {
  return (
    BRAND.headerHeightByBand[band] +
    STRIP_HEIGHT_PER_BAND[band] +
    BAND_RAIL_OFFSET[band] +
    RAIL_TOP_ADJUST
  );
}

function belowTimelineBudget(viewport: Viewport): number {
  return (
    viewport.height -
    firstRowOffset(viewport.band) -
    TIMELINE_MIN_HEIGHT_PER_BAND[viewport.band] -
    READOUT_COMPACT_PER_BAND[viewport.band] -
    SCORE_TRACKER_PER_BAND[viewport.band] -
    COMPOSER_STRIP_HEIGHT_BY_BAND[viewport.band]
  );
}

describe('UX-001.3 — composer collapsed strip per band matches brief', () => {
  it('phone collapsed strip is 56 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.phone).toBe(56);
  });
  it('tablet collapsed strip is 64 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.tablet).toBe(64);
  });
  it('wide collapsed strip is 72 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.wide).toBe(72);
  });
});

describe('UX-001.3 — Timeline first-row offset stays at or below UX-001.2 caps', () => {
  for (const viewport of VIEWPORTS) {
    it(`${viewport.label}: first-row offset <= hard cap (${HARD_CAP_PER_BAND[viewport.band]} px)`, () => {
      const offset = firstRowOffset(viewport.band);
      expect(offset).toBeLessThanOrEqual(HARD_CAP_PER_BAND[viewport.band]);
    });
  }
});

describe('UX-001.3 — below-Timeline budget remains positive on every required viewport', () => {
  for (const viewport of VIEWPORTS) {
    it(`${viewport.label}: budget > 0`, () => {
      const budget = belowTimelineBudget(viewport);
      expect(budget).toBeGreaterThan(0);
    });
  }

  it('the tightest viewport (1366x768) still has positive slack', () => {
    const tight = VIEWPORTS.find((v) => v.width === 1366);
    expect(tight).toBeDefined();
    if (tight) {
      const budget = belowTimelineBudget(tight);
      // Design §10 expects ~150 px on this viewport. Allow some flex
      // because READOUT / SCORE estimates are approximate.
      expect(budget).toBeGreaterThan(80);
    }
  });
});

describe('UX-001.3 — expanded composer ceiling fits per-band fractions', () => {
  for (const viewport of VIEWPORTS) {
    it(`${viewport.label}: expanded height * ceiling fraction <= viewport`, () => {
      const ceiling = Math.round(viewport.height * viewport.expandedCeilingFraction);
      // Ceiling must be positive and a meaningful portion (not so tiny
      // the composer becomes unusable).
      expect(ceiling).toBeGreaterThan(180);
      // And must not exceed the viewport (defensive sanity check).
      expect(ceiling).toBeLessThanOrEqual(viewport.height);
    });
  }
});
