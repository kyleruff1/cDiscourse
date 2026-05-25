/**
 * UX-001.5 — Cross-viewport sizing matrix.
 *
 * Asserts the design §9 band table resolves correctly at the four
 * reference viewports:
 *   - 390 × 844   → phone
 *   - 1024 × 1366 → tablet
 *   - 1366 × 768  → wide
 *   - 1920 × 1080 → wide
 *
 * Uses `resolveBand` from useHeaderBreakpoint (pure helper) +
 * `resolveBandValue` to walk the four sizing tables for each band.
 */
import { resolveBand } from '../src/hooks/useHeaderBreakpoint';
import {
  ANNOTATION_BADGE_DIAMETER_BY_BAND,
  ANNOTATION_CHIP_HEIGHT_BY_BAND,
  ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND,
  ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND,
  resolveBandValue,
} from '../src/features/nodeAnnotations/annotationKindTokens';

/**
 * The four reference viewports (UX-001.2 / UX-001.3 / UX-001.4 / UX-001.5
 * acceptance) with the expected band resolution.
 */
const REFERENCE_VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, expectedBand: 'phone' as const },
  { name: 'tablet portrait', width: 1024, height: 1366, expectedBand: 'tablet' as const },
  { name: 'wide laptop', width: 1366, height: 768, expectedBand: 'wide' as const },
  { name: 'wide desktop', width: 1920, height: 1080, expectedBand: 'wide' as const },
];

describe('UX-001.5 — band resolution at reference viewports', () => {
  for (const v of REFERENCE_VIEWPORTS) {
    it(`${v.name} (${v.width}x${v.height}) resolves to "${v.expectedBand}"`, () => {
      expect(resolveBand(v.width)).toBe(v.expectedBand);
    });
  }
});

describe('UX-001.5 — strip max visible at reference viewports', () => {
  const EXPECTED: Record<'phone' | 'tablet' | 'wide', number> = {
    phone: 3,
    tablet: 4,
    wide: 6,
  };
  for (const v of REFERENCE_VIEWPORTS) {
    it(`${v.name}: strip max visible = ${EXPECTED[v.expectedBand]}`, () => {
      const band = resolveBand(v.width);
      const max = resolveBandValue(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND, band);
      expect(max).toBe(EXPECTED[v.expectedBand]);
    });
  }
});

describe('UX-001.5 — chip height at reference viewports', () => {
  const EXPECTED: Record<'phone' | 'tablet' | 'wide', number> = {
    phone: 28,
    tablet: 32,
    wide: 32,
  };
  for (const v of REFERENCE_VIEWPORTS) {
    it(`${v.name}: chip height = ${EXPECTED[v.expectedBand]}px`, () => {
      const band = resolveBand(v.width);
      const height = resolveBandValue(ANNOTATION_CHIP_HEIGHT_BY_BAND, band);
      expect(height).toBe(EXPECTED[v.expectedBand]);
    });
  }
});

describe('UX-001.5 — badge diameter at reference viewports', () => {
  const EXPECTED: Record<'phone' | 'tablet' | 'wide', number> = {
    phone: 8,
    tablet: 10,
    wide: 10,
  };
  for (const v of REFERENCE_VIEWPORTS) {
    it(`${v.name}: badge diameter = ${EXPECTED[v.expectedBand]}px`, () => {
      const band = resolveBand(v.width);
      const diameter = resolveBandValue(ANNOTATION_BADGE_DIAMETER_BY_BAND, band);
      expect(diameter).toBe(EXPECTED[v.expectedBand]);
    });
  }
});

describe('UX-001.5 — overflow chip min-width at reference viewports', () => {
  const EXPECTED: Record<'phone' | 'tablet' | 'wide', number> = {
    phone: 28,
    tablet: 32,
    wide: 36,
  };
  for (const v of REFERENCE_VIEWPORTS) {
    it(`${v.name}: overflow min-width = ${EXPECTED[v.expectedBand]}px`, () => {
      const band = resolveBand(v.width);
      const minWidth = resolveBandValue(ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND, band);
      expect(minWidth).toBe(EXPECTED[v.expectedBand]);
    });
  }
});

describe('UX-001.5 — band caps obey the brief monotonicity rule', () => {
  it('strip max visible is non-decreasing across phone → tablet → wide', () => {
    expect(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND.phone).toBeLessThanOrEqual(
      ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND.tablet,
    );
    expect(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND.tablet).toBeLessThanOrEqual(
      ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND.wide,
    );
  });

  it('badge diameter is non-decreasing', () => {
    expect(ANNOTATION_BADGE_DIAMETER_BY_BAND.phone).toBeLessThanOrEqual(
      ANNOTATION_BADGE_DIAMETER_BY_BAND.tablet,
    );
    expect(ANNOTATION_BADGE_DIAMETER_BY_BAND.tablet).toBeLessThanOrEqual(
      ANNOTATION_BADGE_DIAMETER_BY_BAND.wide,
    );
  });

  it('overflow min-width is non-decreasing', () => {
    expect(ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND.phone).toBeLessThanOrEqual(
      ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND.tablet,
    );
    expect(ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND.tablet).toBeLessThanOrEqual(
      ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND.wide,
    );
  });
});

describe('UX-001.5 — phone badge diameter respects 8 px upper cap from brief', () => {
  it('phone badge diameter ≤ 8 px (per brief §"Cross-viewport rendering")', () => {
    expect(ANNOTATION_BADGE_DIAMETER_BY_BAND.phone).toBeLessThanOrEqual(8);
  });

  it('tablet/wide badge diameter ≤ 10 px', () => {
    expect(ANNOTATION_BADGE_DIAMETER_BY_BAND.tablet).toBeLessThanOrEqual(10);
    expect(ANNOTATION_BADGE_DIAMETER_BY_BAND.wide).toBeLessThanOrEqual(10);
  });
});

describe('UX-001.5 — phone chip height respects 28 px upper cap from brief', () => {
  it('phone chip height ≤ 28 px', () => {
    expect(ANNOTATION_CHIP_HEIGHT_BY_BAND.phone).toBeLessThanOrEqual(28);
  });

  it('tablet/wide chip height ≤ 32 px', () => {
    expect(ANNOTATION_CHIP_HEIGHT_BY_BAND.tablet).toBeLessThanOrEqual(32);
    expect(ANNOTATION_CHIP_HEIGHT_BY_BAND.wide).toBeLessThanOrEqual(32);
  });
});
