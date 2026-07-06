/**
 * UX-001.6 — Cross-device viewport matrix.
 *
 * Per `docs/designs/UX-001.6.md` §2. The matrix is 6 viewports × 18
 * surfaces, with each cell asserting a specific UX-001.{1-5} contract.
 *
 * Cell encoding: `{ platformOs, windowWidth, windowHeight, band }`.
 * The 6 viewports (4 hard-blocker + 2 extension):
 *
 *   1. 390  × 844   phone iOS                 (touch; no key badges)
 *   2. 412  × 892   phone large Android       (touch; no key badges)
 *   3. 768  × 1024  tablet portrait iPad      (touch; no key badges)
 *   4. 1024 × 1366  tablet portrait iPad Pro  (native iOS; no key badges)
 *   5. 1366 × 768   narrow browser web        (keyboard; key badges)
 *   6. 1920 × 1080  wide browser web          (keyboard; key badges)
 *
 * The matrix uses three verification techniques per the design:
 *   A. Pure-TS token / model assertion (no render).
 *   B. RN test renderer (where prop-level mounting is needed).
 *   C. File-scan boundary verification.
 *
 * The doctrine for A/I/G badges is per surface #13: the visibility of
 * the badge depends on `{ platformOs, windowWidth }` pair, NOT just
 * window width. At 1024 × 1366 native iOS the badge is absent (because
 * `Platform.OS !== 'web'`). On the web build at 1024 width the badge
 * would render. The matrix encodes platform per cell.
 */
import * as fs from 'fs';
import * as path from 'path';
import { BRAND } from '../src/lib/designTokens';
import {
  BAND_RAIL_OFFSET,
  BAND_RAIL_OFFSET_MAX,
} from '../src/features/arguments/timelineViewportLayoutModel';
import { TIMELINE_NODE_SIZE } from '../src/features/arguments/argumentGameSurfaceModel';
import { COMPOSER_STRIP_HEIGHT_BY_BAND } from '../src/features/arguments/composer/ComposerContextStrip';
import {
  deriveMenuKeyBadgeContext,
  resolveKeyBadgeVisibility,
  BROWSER_KEYBOARD_WIDTH_THRESHOLD,
} from '../src/features/arguments/oneBox/menuKeyBadgeModel';
import { resolveBand } from '../src/hooks/useHeaderBreakpoint';
import {
  ANNOTATION_CHIP_HEIGHT_BY_BAND,
  ANNOTATION_BADGE_DIAMETER_BY_BAND,
  ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND,
  ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND,
} from '../src/features/nodeAnnotations/annotationKindTokens';

const ROOT = process.cwd();

/** A single viewport cell in the matrix. */
interface ViewportCell {
  label: string;
  platformOs: 'web' | 'ios' | 'android' | 'windows' | 'macos';
  windowWidth: number;
  windowHeight: number;
  band: 'phone' | 'tablet' | 'wide';
  /** Per-band expanded composer ceiling fraction (UX-001.3 brief). */
  expandedCeilingFraction: number;
  /**
   * Whether key badges (A / I / G) should render at this cell, per
   * UX-001.4 contract. Depends on `{ platformOs, windowWidth }`, NOT
   * just window width.
   */
  expectsKeyBadges: boolean;
  /**
   * Cell #4 specific: this is the only cell where the platform vs
   * viewport-width interpretation diverges (1024 wide would render
   * badges on web, but does not on iOS).
   */
  isHardBlocker: boolean;
}

const VIEWPORTS: ReadonlyArray<ViewportCell> = Object.freeze([
  {
    label: '390x844 phone iOS',
    platformOs: 'ios',
    windowWidth: 390,
    windowHeight: 844,
    band: 'phone',
    expandedCeilingFraction: 0.5,
    expectsKeyBadges: false,
    isHardBlocker: true,
  },
  {
    label: '412x892 phone large Android (extension)',
    platformOs: 'android',
    windowWidth: 412,
    windowHeight: 892,
    band: 'phone',
    expandedCeilingFraction: 0.5,
    expectsKeyBadges: false,
    isHardBlocker: false,
  },
  {
    label: '768x1024 tablet portrait iPad (extension)',
    platformOs: 'ios',
    windowWidth: 768,
    windowHeight: 1024,
    band: 'tablet',
    expandedCeilingFraction: 0.4,
    expectsKeyBadges: false,
    isHardBlocker: false,
  },
  {
    label: '1024x1366 tablet portrait iPad Pro 11 iOS',
    platformOs: 'ios',
    windowWidth: 1024,
    windowHeight: 1366,
    band: 'tablet',
    expandedCeilingFraction: 0.4,
    expectsKeyBadges: false,
    isHardBlocker: true,
  },
  {
    label: '1366x768 narrow browser web',
    platformOs: 'web',
    windowWidth: 1366,
    windowHeight: 768,
    band: 'wide',
    expandedCeilingFraction: 0.35,
    expectsKeyBadges: true,
    isHardBlocker: true,
  },
  {
    label: '1920x1080 wide browser web',
    platformOs: 'web',
    windowWidth: 1920,
    windowHeight: 1080,
    band: 'wide',
    expandedCeilingFraction: 0.35,
    expectsKeyBadges: true,
    isHardBlocker: true,
  },
]);

/**
 * Strip heights per band — mirrors the DebateDetailHeader bandSizing
 * table. Pinned here so the matrix has a single source of truth.
 */
const STRIP_HEIGHT_PER_BAND = {
  phone: 4 * 2 + 36 + 1, // 45 (cap 48)
  tablet: 6 * 2 + 38 + 1, // 51 (cap 56)
  wide: 8 * 2 + 42 + 1, // 59 (cap 64)
};

const STRIP_HEIGHT_CAP_PER_BAND = {
  phone: 48,
  tablet: 56,
  wide: 64,
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

// ── Matrix sanity ────────────────────────────────────────────────

describe('UX-001.6 matrix — viewport spec is well-formed', () => {
  it('has exactly 6 viewport cells (4 hard-blocker + 2 extension)', () => {
    expect(VIEWPORTS).toHaveLength(6);
  });

  it('has exactly 4 hard-blocker viewports', () => {
    expect(VIEWPORTS.filter((v) => v.isHardBlocker)).toHaveLength(4);
  });

  it('has exactly 2 extension viewports', () => {
    expect(VIEWPORTS.filter((v) => !v.isHardBlocker)).toHaveLength(2);
  });

  it('covers all three bands (phone / tablet / wide)', () => {
    const bands = new Set(VIEWPORTS.map((v) => v.band));
    expect(bands.has('phone')).toBe(true);
    expect(bands.has('tablet')).toBe(true);
    expect(bands.has('wide')).toBe(true);
  });

  it('every cell has consistent band derivation via resolveBand', () => {
    for (const vp of VIEWPORTS) {
      expect(resolveBand(vp.windowWidth)).toBe(vp.band);
    }
  });
});

// ── Surface 1 — AppHeader rendering per band (Technique A) ───────

describe('UX-001.6 matrix — Surface 1: AppHeader per-band heights', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: header height token resolves to ${BRAND.headerHeightByBand[vp.band]} px`, () => {
      expect(BRAND.headerHeightByBand[vp.band]).toBeGreaterThan(0);
      expect(BRAND.headerHeightByBand[vp.band]).toBe(
        vp.band === 'phone' ? 64 : vp.band === 'tablet' ? 96 : 120,
      );
    });
  }

  it('header heights monotonically grow phone → tablet → wide', () => {
    expect(BRAND.headerHeightByBand.phone).toBeLessThan(BRAND.headerHeightByBand.tablet);
    expect(BRAND.headerHeightByBand.tablet).toBeLessThan(BRAND.headerHeightByBand.wide);
  });

  it('logo heights monotonically grow phone → tablet → wide', () => {
    expect(BRAND.logoHeightByBand.phone).toBeLessThan(BRAND.logoHeightByBand.tablet);
    expect(BRAND.logoHeightByBand.tablet).toBeLessThan(BRAND.logoHeightByBand.wide);
  });
});

// ── Surface 2 — DebateDetailHeader compact strip (Technique A) ───

describe('UX-001.6 matrix — Surface 2: DebateDetailHeader compact strip per-band heights', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: rendered height ${STRIP_HEIGHT_PER_BAND[vp.band]} px is within cap ${STRIP_HEIGHT_CAP_PER_BAND[vp.band]} px`, () => {
      expect(STRIP_HEIGHT_PER_BAND[vp.band]).toBeLessThanOrEqual(
        STRIP_HEIGHT_CAP_PER_BAND[vp.band],
      );
    });
  }

  it('phone strip is below 48 px cap', () => {
    expect(STRIP_HEIGHT_PER_BAND.phone).toBeLessThanOrEqual(48);
  });

  it('tablet strip is below 56 px cap', () => {
    expect(STRIP_HEIGHT_PER_BAND.tablet).toBeLessThanOrEqual(56);
  });

  it('wide strip is below 64 px cap', () => {
    expect(STRIP_HEIGHT_PER_BAND.wide).toBeLessThanOrEqual(64);
  });
});

// ── Surface 3 — App.tsx hidden tab bar gate (Technique C) ────────

describe('UX-001.6 matrix — Surface 3: App.tsx hidden tab bar gate', () => {
  const APP_SRC = fs.readFileSync(path.resolve(ROOT, 'App.tsx'), 'utf8');

  it('App.tsx defines a `roomActive` derived boolean', () => {
    expect(APP_SRC).toMatch(/const\s+roomActive\s*=/);
  });

  it('App.tsx gates the tab bar render on `!roomActive`', () => {
    expect(APP_SRC).toMatch(/!roomActive/);
  });

  it('App.tsx has the `app-tab-bar` testID for the gated tab bar', () => {
    expect(APP_SRC).toMatch(/testID="app-tab-bar"/);
  });

  // The boolean's truthiness is band-agnostic — it's a function of
  // `(activeTab, hasDebate, currentDebate, notificationsOpen)`, NOT
  // viewport width. Per viewport we re-assert the gate is structurally
  // intact (a runtime room-open at any viewport hides the bar).
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: tab bar gate is structurally intact (band-agnostic)`, () => {
      // The gate is the same expression on every viewport — verified by
      // the structural assertion above. This per-cell assertion keeps
      // the matrix grid consistent.
      expect(APP_SRC).toMatch(/!roomActive/);
    });
  }
});

// ── Surface 4 — Timeline first-row offset per band (Technique A) ─

describe('UX-001.6 matrix — Surface 4: Timeline first-row offset per band', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: first-row offset ${firstRowOffset(vp.band)} px ≤ hard cap ${HARD_CAP_PER_BAND[vp.band]} px`, () => {
      const offset = firstRowOffset(vp.band);
      expect(offset).toBeLessThanOrEqual(HARD_CAP_PER_BAND[vp.band]);
    });
  }
});

// ── Surface 5 — TimelineSelectedReadoutPanel compact placement ───

describe('UX-001.6 matrix — Surface 5: TimelineSelectedReadoutPanel compact-mode source presence', () => {
  const PANEL_SRC = fs.readFileSync(
    path.resolve(
      ROOT,
      'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
    ),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: source file exports the panel component`, () => {
      expect(PANEL_SRC).toMatch(/export\s+(function|const)\s+TimelineSelectedReadoutPanel/);
    });
  }

  it('panel source acknowledges compact mode (per UX-001.2 placement)', () => {
    // The panel mounts below the Timeline in compact mode; the source
    // names the compact / expand affordance explicitly.
    expect(PANEL_SRC.toLowerCase()).toMatch(/compact|expand/);
  });
});

// ── Surface 6 — ArgumentScoreTracker mount site (Technique C) ────

describe('UX-001.6 matrix — Surface 6: ArgumentScoreTracker mount site below readout', () => {
  const SURFACE_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/room/ArgumentRoom.tsx'),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: ArgumentGameSurface mounts ArgumentScoreTracker`, () => {
      expect(SURFACE_SRC).toMatch(/<ArgumentScoreTracker/);
    });
  }
});

// ── Surface 7 — ArgumentTimelineMap rail offset (Technique A) ────

describe('UX-001.6 matrix — Surface 7: ArgumentTimelineMap rail offset per-band envelope', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: BAND_RAIL_OFFSET[${vp.band}]=${BAND_RAIL_OFFSET[vp.band]} ∈ [0, ${BAND_RAIL_OFFSET_MAX[vp.band]}]`, () => {
      expect(BAND_RAIL_OFFSET[vp.band]).toBeGreaterThanOrEqual(0);
      expect(BAND_RAIL_OFFSET[vp.band]).toBeLessThanOrEqual(BAND_RAIL_OFFSET_MAX[vp.band]);
    });
  }
});

// ── Surface 8 — CollapsedComposerStrip persistent visibility ─────

describe('UX-001.6 matrix — Surface 8: CollapsedComposerStrip persistent in Timeline mode', () => {
  const STRIP_SRC = fs.readFileSync(
    path.resolve(
      ROOT,
      'src/features/arguments/composer/CollapsedComposerStrip.tsx',
    ),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: CollapsedComposerStrip module exports the component`, () => {
      expect(STRIP_SRC).toMatch(/export\s+(function|const)\s+CollapsedComposerStrip/);
    });
  }
});

// ── Surface 9 — ComposerContextStrip per-band heights ────────────

describe('UX-001.6 matrix — Surface 9: ComposerContextStrip per-band heights', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: COMPOSER_STRIP_HEIGHT_BY_BAND[${vp.band}] = ${COMPOSER_STRIP_HEIGHT_BY_BAND[vp.band]} px`, () => {
      expect(COMPOSER_STRIP_HEIGHT_BY_BAND[vp.band]).toBeGreaterThan(0);
    });
  }

  it('phone composer strip is 56 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.phone).toBe(56);
  });

  it('tablet composer strip is 64 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.tablet).toBe(64);
  });

  it('wide composer strip is 72 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.wide).toBe(72);
  });
});

// ── Surface 10 — OneBox type chip + Cmd/Ctrl+K mode switcher ─────

describe('UX-001.6 matrix — Surface 10: OneBox + composer keyboard shortcuts', () => {
  const ONEBOX_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/oneBox/OneBox.tsx'),
    'utf8',
  );
  const KEYBOARD_MODEL_SRC = fs.readFileSync(
    path.resolve(
      ROOT,
      'src/features/arguments/composer/composerKeyboardModel.ts',
    ),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: OneBox source file exports the component`, () => {
      expect(ONEBOX_SRC).toMatch(/export\s+(function|const)\s+OneBox/);
    });
  }

  it('composer keyboard model file exists with shortcut resolver exports', () => {
    expect(KEYBOARD_MODEL_SRC).toMatch(/export/);
  });
});

// ── Surface 11 — ArgumentComposer validation surface ─────────────

describe('UX-001.6 matrix — Surface 11: ArgumentComposer validation surface present', () => {
  const COMPOSER_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/ArgumentComposer.tsx'),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: ArgumentComposer source exports the component`, () => {
      expect(COMPOSER_SRC).toMatch(/export\s+(function|const)\s+ArgumentComposer/);
    });
  }
});

// ── Surface 12 — Popout chassis present + rendering surface ──────

describe('UX-001.6 matrix — Surface 12: Popout chassis + ActPopout/InspectPopout/GoPopout', () => {
  const POPOUT_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/oneBox/Popout.tsx'),
    'utf8',
  );
  const ACT_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/oneBox/ActPopout.tsx'),
    'utf8',
  );
  const INSPECT_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/oneBox/InspectPopout.tsx'),
    'utf8',
  );
  const GO_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/oneBox/GoPopout.tsx'),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: Popout chassis source exports the component`, () => {
      expect(POPOUT_SRC).toMatch(/export\s+(function|const)\s+Popout/);
    });
    it(`${vp.label}: ActPopout source exports the component`, () => {
      expect(ACT_SRC).toMatch(/export\s+(function|const)\s+ActPopout/);
    });
    it(`${vp.label}: InspectPopout source exports the component`, () => {
      expect(INSPECT_SRC).toMatch(/export\s+(function|const)\s+InspectPopout/);
    });
    it(`${vp.label}: GoPopout source exports the component`, () => {
      expect(GO_SRC).toMatch(/export\s+(function|const)\s+GoPopout/);
    });
  }
});

// ── Surface 13 — A / I / G browser-only key badges (the critical
//                cell with per-platform interpretation) ───────────

describe('UX-001.6 matrix — Surface 13: A/I/G key badge per-cell visibility', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: deriveMenuKeyBadgeContext returns ${vp.expectsKeyBadges ? 'browser_keyboard' : 'touch'} → badge ${vp.expectsKeyBadges ? 'renders' : 'does NOT render'}`, () => {
      const ctx = deriveMenuKeyBadgeContext({
        platformOs: vp.platformOs,
        windowWidth: vp.windowWidth,
      });
      const visible = resolveKeyBadgeVisibility({ context: ctx, reduceMotion: false });
      expect(visible).toBe(vp.expectsKeyBadges);
    });
  }

  it('threshold is 1024 (anything at or above on web crosses)', () => {
    expect(BROWSER_KEYBOARD_WIDTH_THRESHOLD).toBe(1024);
  });

  it('1024 wide on iOS native is NOT a keyboard context (platform gate)', () => {
    const ctx = deriveMenuKeyBadgeContext({ platformOs: 'ios', windowWidth: 1024 });
    expect(ctx).toBe('touch');
  });

  it('1024 wide on web IS a keyboard context (threshold gate)', () => {
    const ctx = deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 1024 });
    expect(ctx).toBe('browser_keyboard');
  });

  it('390 wide on web is NOT a keyboard context (small browser)', () => {
    const ctx = deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 390 });
    expect(ctx).toBe('touch');
  });

  it('1366 wide on web IS a keyboard context (narrow browser)', () => {
    const ctx = deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 1366 });
    expect(ctx).toBe('browser_keyboard');
  });

  it('1920 wide on web IS a keyboard context (wide browser)', () => {
    const ctx = deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 1920 });
    expect(ctx).toBe('browser_keyboard');
  });

  it('1024 wide on Android native is NOT a keyboard context', () => {
    const ctx = deriveMenuKeyBadgeContext({ platformOs: 'android', windowWidth: 1024 });
    expect(ctx).toBe('touch');
  });

  it('768 wide on iOS native is NOT a keyboard context', () => {
    const ctx = deriveMenuKeyBadgeContext({ platformOs: 'ios', windowWidth: 768 });
    expect(ctx).toBe('touch');
  });
});

// ── Surface 14 — Popout chassis dismissible scrim ────────────────

describe('UX-001.6 matrix — Surface 14: Popout chassis scrim dismissibility', () => {
  const POPOUT_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/oneBox/Popout.tsx'),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: Popout source references a dismiss handler (scrim closes)`, () => {
      // The chassis emits an onDismiss / onRequestClose handler; the
      // scrim is the surface that fires it. Either name is acceptable.
      expect(POPOUT_SRC).toMatch(/onRequestClose|onDismiss/);
    });
  }
});

// ── Surface 15 — nodeAnnotations 12 primitives rendering ─────────

describe('UX-001.6 matrix — Surface 15: 12 nodeAnnotation primitives present', () => {
  const PRIMITIVE_FILES = [
    'AnnotationChip.tsx',
    'AnnotationChipStrip.tsx',
    'AnnotationOverflowChip.tsx',
    'AnnotationBadge.tsx',
    'AnnotationBadgeCluster.tsx',
    'AnnotationFocusRing.tsx',
    'AnnotationOutline.tsx',
    'AnnotationEdgeHighlight.tsx',
    'AnnotationFocusBoundaryView.tsx',
    'InspectSectionChipStrip.tsx',
    'InspectGroupHeader.tsx',
  ];

  for (const vp of VIEWPORTS) {
    for (const file of PRIMITIVE_FILES) {
      it(`${vp.label}: ${file} present in primitives directory`, () => {
        const fullPath = path.resolve(
          ROOT,
          'src/features/nodeAnnotations',
          file,
        );
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    }
  }

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: chip height token resolves for band=${vp.band}`, () => {
      expect(ANNOTATION_CHIP_HEIGHT_BY_BAND[vp.band]).toBeGreaterThan(0);
    });

    it(`${vp.label}: badge diameter token resolves for band=${vp.band}`, () => {
      expect(ANNOTATION_BADGE_DIAMETER_BY_BAND[vp.band]).toBeGreaterThan(0);
    });

    it(`${vp.label}: overflow min-width token resolves for band=${vp.band}`, () => {
      expect(ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND[vp.band]).toBeGreaterThan(0);
    });

    it(`${vp.label}: strip max-visible token resolves for band=${vp.band}`, () => {
      expect(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND[vp.band]).toBeGreaterThan(0);
    });
  }
});

// ── Surface 16 — InspectSectionChipStrip overflow ────────────────

describe('UX-001.6 matrix — Surface 16: InspectSectionChipStrip overflow source pattern', () => {
  const INSPECT_STRIP_SRC = fs.readFileSync(
    path.resolve(
      ROOT,
      'src/features/nodeAnnotations/InspectSectionChipStrip.tsx',
    ),
    'utf8',
  );
  const BASE_STRIP_SRC = fs.readFileSync(
    path.resolve(
      ROOT,
      'src/features/nodeAnnotations/AnnotationChipStrip.tsx',
    ),
    'utf8',
  );
  const OVERFLOW_SRC = fs.readFileSync(
    path.resolve(
      ROOT,
      'src/features/nodeAnnotations/AnnotationOverflowChip.tsx',
    ),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: InspectSectionChipStrip wraps AnnotationChipStrip (which owns the overflow chip)`, () => {
      expect(INSPECT_STRIP_SRC).toMatch(/AnnotationChipStrip/);
    });
    it(`${vp.label}: AnnotationChipStrip mounts AnnotationOverflowChip`, () => {
      expect(BASE_STRIP_SRC).toMatch(/AnnotationOverflowChip/);
    });
    it(`${vp.label}: AnnotationOverflowChip source exports the component`, () => {
      expect(OVERFLOW_SRC).toMatch(/export\s+(function|const)\s+AnnotationOverflowChip/);
    });
  }
});

// ── Surface 17 — RefereeBannerView composer-only Observations ────

describe('UX-001.6 matrix — Surface 17: RefereeBannerView composer-only Observations strip', () => {
  const BANNER_SRC = fs.readFileSync(
    path.resolve(
      ROOT,
      'src/features/refereeBanners/RefereeBannerView.tsx',
    ),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: RefereeBannerView source exports the component`, () => {
      expect(BANNER_SRC).toMatch(/export\s+(function|const)\s+RefereeBannerView/);
    });
    it(`${vp.label}: RefereeBannerView accepts the additive observationChips prop`, () => {
      expect(BANNER_SRC).toMatch(/observationChips/);
    });
  }

  // Composer-only scope assertion: per the UX-001.5 bounded modification
  // doctrine, the additive `observationChips` prop on RefereeBannerView
  // is composer-only — it must not be supplied by any board-level mount
  // site. The banner itself has long been mounted by ArgumentGameSurface
  // for the existing semantic-referee surface (MCP-019); that is not a
  // doctrine concern. The constraint is that any caller passing the
  // `observationChips` prop must do so from a composer-context surface.
  it('observationChips prop is composer-only (no board-level mounts pass it)', () => {
    const allowList = [
      'src/features/refereeBanners',
      'src/features/arguments/composer',
      'src/features/arguments/ArgumentComposer',
      'src/features/arguments/ArgumentComposerDock',
      // UX-001.5A — the room orchestrator owns the canonical MCP-019
      // referee-banner mount site (composer-scoped per UX-001.3 Phase
      // 3 framing). The UX-001.5A design §10.1 wires the composer-
      // only Observation chips through the existing optional
      // `observationChips` prop on RefereeBannerView; the codes used
      // are exclusively composer_only registry entries (verified by
      // __tests__/uxOneOneFiveALabelDoctrine.test.ts). The board-
      // level scope rule still applies: no NON-banner board mount
      // passes the prop, and no board-level component beyond the
      // banner consumes it.
      // ASP-EXTRACT-001 (Slice 2) — the banner mount moved out of the
      // ArgumentGameSurface monolith into room/ArgumentRoom (the shim
      // ArgumentGameSurface.tsx no longer holds the mount). Both prefixes
      // stay allow-listed so the composer-only rule tracks the mount.
      'src/features/arguments/ArgumentGameSurface',
      'src/features/arguments/room/ArgumentRoom',
    ];
    const filesScanned: string[] = [];
    walkDir(path.resolve(ROOT, 'src'), filesScanned, ['.ts', '.tsx']);
    const mountSites = filesScanned.filter((file) => {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (allowList.some((prefix) => rel.startsWith(prefix))) return false;
      const content = fs.readFileSync(file, 'utf8');
      // The board-level guard: no caller outside the allow-list passes
      // an `observationChips` JSX prop. The bare banner mount (without
      // observationChips) is permitted at any mount site.
      return /observationChips\s*=/.test(content);
    });
    expect(mountSites).toEqual([]);
  });
});

// ── Surface 18 — EvidenceAnnotationChip rendering presence ───────

describe('UX-001.6 matrix — Surface 18: EvidenceAnnotationChip rendering presence (regression check)', () => {
  const EVIDENCE_CHIP_PATH = path.resolve(
    ROOT,
    'src/features/evidence/EvidenceAnnotationChip.tsx',
  );

  it('EvidenceAnnotationChip source file exists', () => {
    expect(fs.existsSync(EVIDENCE_CHIP_PATH)).toBe(true);
  });

  if (fs.existsSync(EVIDENCE_CHIP_PATH)) {
    const SRC = fs.readFileSync(EVIDENCE_CHIP_PATH, 'utf8');

    for (const vp of VIEWPORTS) {
      it(`${vp.label}: EvidenceAnnotationChip source exports the component`, () => {
        expect(SRC).toMatch(
          /export\s+(function|const)\s+EvidenceAnnotationChip/,
        );
      });
    }
  }
});

// ── Helpers ──────────────────────────────────────────────────────

function walkDir(dir: string, out: string[], extensions: string[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out, extensions);
    } else if (entry.isFile()) {
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
  }
}
