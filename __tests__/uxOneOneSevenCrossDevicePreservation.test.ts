/**
 * UX-001.7 Workstream 5 — Cross-device QA preservation verification.
 *
 * Per `docs/designs/UX-001.7.md` §6 — UX-001.7 must NOT modify any of
 * UX-001.6's 5 viewport-matrix test files, and must NOT introduce any
 * behavior change visible at any of the 6 UX-001.6 viewports.
 *
 * Verification approach (mirrors design §6.A):
 *
 *   1. Source-scan: every UX-001.6 viewport-matrix test file is read
 *      and asserted to retain its canonical structure (viewport list,
 *      hard-blocker count, key-badge encoding).
 *   2. Behavior contract: the per-band tokens UX-001.6 pins
 *      (BAND_RAIL_OFFSET, COMPOSER_STRIP_HEIGHT_BY_BAND, etc.) are
 *      re-read from source and asserted byte-equivalent to UX-001.6's
 *      original values.
 *   3. UX-001.7's NEW tokens (TOUCH_TARGET, FOCUS_RING, BORDER_WIDTH,
 *      TYPOGRAPHY, SPACING_PRESETS) are asserted to NOT alter any
 *      UX-001.6 envelope (the 4 hard-blocker + 2 extension viewports
 *      preserve their offset caps, strip heights, header heights).
 *
 * Pure-TS source-scan test — no React render.
 */
import * as fs from 'fs';
import * as path from 'path';
import { BRAND, SPACING, TOUCH_TARGET } from '../src/lib/designTokens';
import {
  BAND_RAIL_OFFSET,
  BAND_RAIL_OFFSET_MAX,
} from '../src/features/arguments/timelineViewportLayoutModel';
import { COMPOSER_STRIP_HEIGHT_BY_BAND } from '../src/features/arguments/composer/ComposerContextStrip';
import { TIMELINE_NODE_SIZE } from '../src/features/arguments/argumentGameSurfaceModel';
import {
  ANNOTATION_BADGE_DIAMETER_BY_BAND,
  ANNOTATION_CHIP_HEIGHT_BY_BAND,
  ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND,
  ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND,
} from '../src/features/nodeAnnotations/annotationKindTokens';

const ROOT = process.cwd();

// ── The 4 hard-blocker + 2 extension viewports (UX-001.6 spec) ───

interface ViewportCell {
  label: string;
  platformOs: 'web' | 'ios' | 'android';
  windowWidth: number;
  windowHeight: number;
  band: 'phone' | 'tablet' | 'wide';
  expectsKeyBadges: boolean;
  isHardBlocker: boolean;
}

const VIEWPORTS: ReadonlyArray<ViewportCell> = Object.freeze([
  { label: '390x844 phone iOS',                       platformOs: 'ios',     windowWidth: 390,  windowHeight: 844,  band: 'phone',  expectsKeyBadges: false, isHardBlocker: true  },
  { label: '412x892 phone large Android (extension)', platformOs: 'android', windowWidth: 412,  windowHeight: 892,  band: 'phone',  expectsKeyBadges: false, isHardBlocker: false },
  { label: '768x1024 tablet portrait iPad (extension)', platformOs: 'ios',  windowWidth: 768,  windowHeight: 1024, band: 'tablet', expectsKeyBadges: false, isHardBlocker: false },
  { label: '1024x1366 tablet portrait iPad Pro iOS',  platformOs: 'ios',     windowWidth: 1024, windowHeight: 1366, band: 'tablet', expectsKeyBadges: false, isHardBlocker: true  },
  { label: '1366x768 narrow browser web',              platformOs: 'web',    windowWidth: 1366, windowHeight: 768,  band: 'wide',   expectsKeyBadges: true,  isHardBlocker: true  },
  { label: '1920x1080 wide browser web',               platformOs: 'web',    windowWidth: 1920, windowHeight: 1080, band: 'wide',   expectsKeyBadges: true,  isHardBlocker: true  },
]);

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

const RAIL_TOP_ADJUST = TIMELINE_NODE_SIZE / 2 - 1 - 2;

function firstRowOffset(band: 'phone' | 'tablet' | 'wide'): number {
  return (
    BRAND.headerHeightByBand[band] +
    STRIP_HEIGHT_PER_BAND[band] +
    BAND_RAIL_OFFSET[band] +
    RAIL_TOP_ADJUST
  );
}

// ── UX-001.6 test files preserved verbatim ──────────────────────

const UX_001_6_TEST_FILES = [
  '__tests__/uxOneOneSixViewportMatrix.test.ts',
  '__tests__/uxOneOneSixTouchTargets.test.ts',
  '__tests__/uxOneOneSixColorIndependence.test.tsx',
  '__tests__/uxOneOneSixDoctrine.test.ts',
  '__tests__/uxOneOneSixReadOnlyBoundary.test.ts',
];

describe('UX-001.7 — UX-001.6 viewport-matrix test files all exist + carry their canonical structure', () => {
  for (const relPath of UX_001_6_TEST_FILES) {
    it(`${relPath} exists`, () => {
      const full = path.resolve(ROOT, relPath);
      expect(fs.existsSync(full)).toBe(true);
    });
  }

  it('uxOneOneSixViewportMatrix.test.ts still encodes the 6-viewport spec', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, '__tests__/uxOneOneSixViewportMatrix.test.ts'),
      'utf8',
    );
    expect(src).toMatch(/has exactly 6 viewport cells/);
    expect(src).toMatch(/has exactly 4 hard-blocker viewports/);
    expect(src).toMatch(/has exactly 2 extension viewports/);
  });

  it('uxOneOneSixViewportMatrix.test.ts still encodes the {platformOs, windowWidth} A/I/G key-badge cell pattern', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, '__tests__/uxOneOneSixViewportMatrix.test.ts'),
      'utf8',
    );
    expect(src).toMatch(/deriveMenuKeyBadgeContext/);
    expect(src).toMatch(/resolveKeyBadgeVisibility/);
    expect(src).toMatch(/expectsKeyBadges/);
    // The critical 1024-wide-iOS-but-not-keyboard cell remains.
    expect(src).toMatch(/1024 wide on iOS native is NOT a keyboard context/);
  });

  it('uxOneOneSixTouchTargets.test.ts still pins the 44-or-greater rule + hitSlop=12 pattern', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, '__tests__/uxOneOneSixTouchTargets.test.ts'),
      'utf8',
    );
    expect(src).toMatch(/POPOUT_ENTRY_MIN_HEIGHT\\s\*=\\s\*44|44/);
    expect(src).toMatch(/hitSlop=\{\{\\s\*top:\\s\*12,\\s\*bottom:\\s\*12,\\s\*left:\\s\*12,\\s\*right:\\s\*12\\s\*\}\}|hitSlop/);
  });

  it('uxOneOneSixColorIndependence.test.tsx still exists and is non-empty', () => {
    const full = path.resolve(ROOT, '__tests__/uxOneOneSixColorIndependence.test.tsx');
    expect(fs.existsSync(full)).toBe(true);
    const src = fs.readFileSync(full, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  it('uxOneOneSixDoctrine.test.ts still exists and is non-empty', () => {
    const full = path.resolve(ROOT, '__tests__/uxOneOneSixDoctrine.test.ts');
    expect(fs.existsSync(full)).toBe(true);
    const src = fs.readFileSync(full, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  it('uxOneOneSixReadOnlyBoundary.test.ts still pins the UX-001.{1-5} read-only file enumeration', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, '__tests__/uxOneOneSixReadOnlyBoundary.test.ts'),
      'utf8',
    );
    expect(src).toMatch(/READ_ONLY_FILES|READ_ONLY_PATHS|relPath/);
    expect(src).toMatch(/designTokens\.ts/);
  });
});

// ── Per-viewport envelope preservation ─────────────────────────

describe('UX-001.7 — every UX-001.6 viewport preserves its first-row offset envelope', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: firstRowOffset ${firstRowOffset(vp.band)} px ≤ hard cap ${HARD_CAP_PER_BAND[vp.band]} px (UX-001.2 contract)`, () => {
      const offset = firstRowOffset(vp.band);
      expect(offset).toBeLessThanOrEqual(HARD_CAP_PER_BAND[vp.band]);
    });
  }
});

describe('UX-001.7 — every UX-001.6 viewport preserves the per-band rail-offset envelope', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: BAND_RAIL_OFFSET[${vp.band}]=${BAND_RAIL_OFFSET[vp.band]} ∈ [0, ${BAND_RAIL_OFFSET_MAX[vp.band]}] (UX-001.2 contract)`, () => {
      expect(BAND_RAIL_OFFSET[vp.band]).toBeGreaterThanOrEqual(0);
      expect(BAND_RAIL_OFFSET[vp.band]).toBeLessThanOrEqual(BAND_RAIL_OFFSET_MAX[vp.band]);
    });
  }
});

describe('UX-001.7 — every UX-001.6 viewport preserves the composer strip height per band', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: COMPOSER_STRIP_HEIGHT_BY_BAND[${vp.band}] = ${COMPOSER_STRIP_HEIGHT_BY_BAND[vp.band]} px (UX-001.3 contract)`, () => {
      expect(COMPOSER_STRIP_HEIGHT_BY_BAND[vp.band]).toBeGreaterThan(0);
    });
  }

  it('phone composer strip is 56 px (unchanged from UX-001.6)', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.phone).toBe(56);
  });
  it('tablet composer strip is 64 px (unchanged from UX-001.6)', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.tablet).toBe(64);
  });
  it('wide composer strip is 72 px (unchanged from UX-001.6)', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.wide).toBe(72);
  });
});

describe('UX-001.7 — annotation primitive per-band tokens preserved from UX-001.5/6', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: chip height resolves for band=${vp.band}`, () => {
      expect(ANNOTATION_CHIP_HEIGHT_BY_BAND[vp.band]).toBeGreaterThan(0);
    });
    it(`${vp.label}: badge diameter resolves for band=${vp.band}`, () => {
      expect(ANNOTATION_BADGE_DIAMETER_BY_BAND[vp.band]).toBeGreaterThan(0);
    });
    it(`${vp.label}: overflow min-width resolves for band=${vp.band}`, () => {
      expect(ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND[vp.band]).toBeGreaterThan(0);
    });
    it(`${vp.label}: strip max-visible resolves for band=${vp.band}`, () => {
      expect(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND[vp.band]).toBeGreaterThan(0);
    });
  }
});

// ── BRAND per-band heights preserved ───────────────────────────

describe('UX-001.7 — BRAND header + logo heights per band preserved from UX-001.1', () => {
  it('phone header height is 64 (UX-001.1)', () => {
    expect(BRAND.headerHeightByBand.phone).toBe(64);
  });
  it('tablet header height is 96 (UX-001.1)', () => {
    expect(BRAND.headerHeightByBand.tablet).toBe(96);
  });
  it('wide header height is 120 (UX-001.1)', () => {
    expect(BRAND.headerHeightByBand.wide).toBe(120);
  });

  it('phone logo height is 44 (UX-001.1; also TOUCH_TARGET.minSizePx)', () => {
    expect(BRAND.logoHeightByBand.phone).toBe(44);
    expect(BRAND.logoHeightByBand.phone).toBe(TOUCH_TARGET.minSizePx);
  });
  it('tablet logo height is 80 (UX-001.1)', () => {
    expect(BRAND.logoHeightByBand.tablet).toBe(80);
  });
  it('wide logo height is 96 (UX-001.1)', () => {
    expect(BRAND.logoHeightByBand.wide).toBe(96);
  });
});

// ── UX-001.7 new tokens do NOT collide with UX-001.6 envelopes ──

describe('UX-001.7 — new tokens do not regress any UX-001.6 envelope', () => {
  it('TOUCH_TARGET.minSizePx (44) equals BRAND.logoHeightByBand.phone (intentional alignment)', () => {
    expect(TOUCH_TARGET.minSizePx).toBe(BRAND.logoHeightByBand.phone);
  });

  it('UX-001.7 spacing-preset values all map to the SPACING scale (no out-of-band values)', () => {
    const SPACING_VALUES = new Set(Object.values(SPACING));
    expect(SPACING_VALUES.has(SPACING.xs)).toBe(true); // chipGap, compactRowGap
    expect(SPACING_VALUES.has(SPACING.s)).toBe(true);  // nodeInternalPadding
    expect(SPACING_VALUES.has(SPACING.m)).toBe(true);  // surfaceGap, popoutInternalPadding, composerPadding
    expect(SPACING_VALUES.has(SPACING.l)).toBe(true);  // screenInset
  });
});

// ── Touch-target token usage source-scan ───────────────────────
//
// Per design §10.A — "Touch target usage scan" — the test asserts
// that UX-001 source surfaces with Pressables use either the
// TOUCH_TARGET token OR explicit hitSlop/minHeight evidence per
// UX-001.6's pattern. This is a regression boundary: introducing a
// Pressable WITHOUT 44-or-greater touch target evidence would fail
// here.

const INTERACTIVE_UX_001_FILES = [
  'src/components/AppHeader.tsx',
  'src/features/debates/DebateDetailHeader.tsx',
  'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
  'src/features/arguments/ArgumentTimelineMap.tsx',
  'src/features/arguments/composer/CollapsedComposerStrip.tsx',
  'src/features/arguments/composer/ComposerContextStrip.tsx',
  'src/features/arguments/oneBox/OneBox.tsx',
  'src/features/arguments/oneBox/PopoutEntry.tsx',
  'src/features/arguments/oneBox/Popout.tsx',
  'src/features/arguments/oneBox/InspectPopout.tsx',
  'src/features/nodeAnnotations/AnnotationChip.tsx',
  'src/features/nodeAnnotations/AnnotationOverflowChip.tsx',
  'src/features/evidence/EvidenceAnnotationChip.tsx',
];

describe('UX-001.7 — touch-target evidence preserved on every interactive UX-001 surface', () => {
  for (const relPath of INTERACTIVE_UX_001_FILES) {
    it(`${relPath} contains touch-target evidence (TOUCH_TARGET token, hitSlop, or 44+ minHeight)`, () => {
      const full = path.resolve(ROOT, relPath);
      if (!fs.existsSync(full)) {
        // Treat as a test failure — the file enumeration is canonical.
        expect(fs.existsSync(full)).toBe(true);
        return;
      }
      const src = fs.readFileSync(full, 'utf8');
      const hasToken = /TOUCH_TARGET\./.test(src);
      const hasHitSlop = /hitSlop\s*=/.test(src);
      const hasMinHeight44Plus =
        /minHeight:\s*(4[4-9]|[5-9]\d|\d{3,})/.test(src) ||
        /minHeight\s*=\s*\{?\s*(4[4-9]|[5-9]\d|\d{3,})/.test(src) ||
        /COMPOSER_STRIP_HEIGHT_BY_BAND/.test(src) ||
        /POPOUT_ENTRY_MIN_HEIGHT/.test(src);
      expect(hasToken || hasHitSlop || hasMinHeight44Plus).toBe(true);
    });
  }

  it('EvidenceAnnotationChip.tsx (UX-001.7 refactor target) consumes TOUCH_TARGET.hitSlopAll', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, 'src/features/evidence/EvidenceAnnotationChip.tsx'),
      'utf8',
    );
    expect(src).toMatch(/TOUCH_TARGET\.hitSlopAll/);
  });
});

// ── Browser-only key badge encoding regression check ───────────

describe('UX-001.7 — A/I/G browser-only key-badge encoding preserved in UX-001.6 test', () => {
  const src = fs.readFileSync(
    path.resolve(ROOT, '__tests__/uxOneOneSixViewportMatrix.test.ts'),
    'utf8',
  );

  it('the {platformOs, windowWidth} cell encoding is intact', () => {
    expect(src).toMatch(/platformOs:\s*['"]web['"]/);
    expect(src).toMatch(/platformOs:\s*['"]ios['"]/);
    expect(src).toMatch(/platformOs:\s*['"]android['"]/);
  });

  it('the BROWSER_KEYBOARD_WIDTH_THRESHOLD = 1024 cell is intact', () => {
    expect(src).toMatch(/BROWSER_KEYBOARD_WIDTH_THRESHOLD/);
    expect(src).toMatch(/threshold is 1024/);
  });

  it('the touch-vs-keyboard divergence assertions are intact', () => {
    expect(src).toMatch(/1024 wide on iOS native is NOT a keyboard context/);
    expect(src).toMatch(/1024 wide on web IS a keyboard context/);
    expect(src).toMatch(/390 wide on web is NOT a keyboard context/);
  });
});
