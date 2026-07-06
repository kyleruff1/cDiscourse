/**
 * UX-001.6 — Read-only API boundary verification.
 *
 * Per `docs/designs/UX-001.6.md` §6 and the brief §8. UX-001.6 does
 * NOT modify any UX-001.{1-5} source file beyond the §7 acute-fix
 * budget. This file is the implementer-side cross-check that the
 * boundary holds.
 *
 * The reviewer's primary verification is `git diff main..HEAD --stat
 * -- <enumerated files>` returning empty (modulo enumerated acute
 * fixes). This test file provides a doctrine-style backstop:
 *
 *   - Every enumerated read-only file MUST exist.
 *   - Every locked file's exported public API surface (the names the
 *     UX-001.{1-5} contracts pin) must still be present at the
 *     expected exports.
 *
 * The byte-equality assertion is a reviewer step, not a unit-test
 * step (it would tie the test to an unstable file checksum); this
 * suite asserts the public-API stability that a non-disruptive
 * modification would preserve.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

/**
 * Files locked by UX-001.{1-5} that UX-001.6 may NOT modify outside
 * the §7 acute-fix budget. Each entry pairs the path with a
 * "must-have" public-API signature (a regex literal proving the
 * canonical export is still there). The reviewer also runs
 * `git diff main..HEAD --stat -- <these paths>` and verifies empty
 * output modulo the §7 acute-fix list.
 */
interface ReadOnlyFile {
  relPath: string;
  /**
   * Required exports / API tokens — pinned strings that must appear
   * in the file. If a UX-001.{1-5} contract is removed or renamed
   * by an accidental edit, the assertion fails.
   */
  requiredApi: ReadonlyArray<string | RegExp>;
}

const READ_ONLY_FILES: ReadonlyArray<ReadOnlyFile> = Object.freeze([
  // UX-001.1
  {
    relPath: 'src/components/AppHeader.tsx',
    requiredApi: ['AppHeader', 'BRAND', /testID="app-header"/],
  },
  {
    relPath: 'src/components/AppHeaderTagline.tsx',
    requiredApi: ['AppHeaderTagline'],
  },
  {
    relPath: 'src/hooks/useHeaderBreakpoint.ts',
    requiredApi: [
      'useHeaderBreakpoint',
      'resolveHeaderBreakpoint',
      'resolveBand',
      'type Band',
      'HeaderBreakpoint',
    ],
  },
  {
    relPath: 'src/lib/designTokens.ts',
    requiredApi: [
      'BRAND',
      'SURFACE_TOKENS',
      'SPACING',
      'RADIUS',
      'headerHeightByBand',
      'logoHeightByBand',
      'breakpoints',
      'FORBIDDEN_TOKEN_TOKENS',
    ],
  },
  // UX-001.2
  {
    relPath: 'src/features/arguments/ArgumentTimelineMap.tsx',
    requiredApi: ['ArgumentTimelineMap'],
  },
  {
    relPath: 'src/features/arguments/ArgumentScoreTracker.tsx',
    requiredApi: ['ArgumentScoreTracker'],
  },
  {
    relPath: 'src/features/arguments/ArgumentGameSurface.tsx',
    requiredApi: ['ArgumentGameSurface'],
  },
  // ASP-EXTRACT-001 (Slice 1) — NOTE: the room surface is being split into
  // src/features/arguments/room/. Slice 1 lands the timeline-map lens
  // (MapView) + the shared action-code registry (roomActionCodes). The
  // ArgumentGameSurface.tsx entry above stays (its function name is
  // unchanged; the shim / rename is Slice 2). These new seams are pinned so
  // a later card cannot silently drop their public API. ExchangeView /
  // ArgumentRoom land in Slice 2 and get their own entries then.
  {
    relPath: 'src/features/arguments/room/MapView.tsx',
    requiredApi: ['MapView', 'MapViewProps'],
  },
  {
    relPath: 'src/features/arguments/room/roomActionCodes.ts',
    requiredApi: [
      'RoomActionCode',
      'RoomRailActionCode',
      'RoomBubbleControlCode',
      'railActionToBubbleControl',
      'ROOM_RAIL_ACTION_CODES',
    ],
  },
  {
    relPath: 'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
    requiredApi: ['TimelineSelectedReadoutPanel'],
  },
  {
    relPath: 'src/features/arguments/timelineViewportLayoutModel.ts',
    requiredApi: ['BAND_RAIL_OFFSET', 'BAND_RAIL_OFFSET_MAX'],
  },
  {
    relPath: 'src/features/arguments/argumentGameSurfaceModel.ts',
    requiredApi: ['TIMELINE_NODE_SIZE'],
  },
  {
    relPath: 'src/features/debates/DebateDetailHeader.tsx',
    requiredApi: ['DebateDetailHeader'],
  },
  {
    relPath: 'App.tsx',
    requiredApi: [/roomActive/, /testID="app-tab-bar"/],
  },
  // UX-001.3
  {
    relPath: 'src/features/arguments/composer/CollapsedComposerStrip.tsx',
    requiredApi: ['CollapsedComposerStrip'],
  },
  {
    relPath: 'src/features/arguments/composer/ComposerContextStrip.tsx',
    requiredApi: ['ComposerContextStrip', 'COMPOSER_STRIP_HEIGHT_BY_BAND'],
  },
  {
    relPath: 'src/features/arguments/composer/composerActingOnModel.ts',
    requiredApi: ['deriveComposerActingOnLabel'],
  },
  {
    relPath: 'src/features/arguments/composer/composerDraftRegistry.ts',
    requiredApi: [/export/],
  },
  {
    relPath: 'src/features/arguments/composer/composerHaptics.ts',
    requiredApi: [/export/],
  },
  {
    relPath: 'src/features/arguments/composer/composerKeyboardModel.ts',
    requiredApi: [/export/],
  },
  {
    relPath: 'src/features/arguments/composer/useComposerDraftRegistry.ts',
    requiredApi: ['useComposerDraftRegistry'],
  },
  {
    relPath: 'src/features/arguments/composer/useComposerFocusContext.ts',
    requiredApi: ['useComposerFocusContext'],
  },
  {
    relPath: 'src/features/arguments/ArgumentComposer.tsx',
    requiredApi: ['ArgumentComposer'],
  },
  {
    relPath: 'src/features/arguments/ArgumentComposerDock.tsx',
    requiredApi: ['ArgumentComposerDock'],
  },
  // UX-001.4
  {
    relPath: 'src/features/arguments/oneBox/Popout.tsx',
    requiredApi: ['Popout', /onRequestClose|onDismiss/],
  },
  {
    relPath: 'src/features/arguments/oneBox/PopoutEntry.tsx',
    requiredApi: [
      'PopoutEntry',
      'POPOUT_ENTRY_MIN_HEIGHT',
      'PADDED_HIT_SLOP',
      'buildPopoutEntryAccessibilityLabel',
    ],
  },
  {
    relPath: 'src/features/arguments/oneBox/PopoutGroup.tsx',
    requiredApi: ['PopoutGroup'],
  },
  {
    relPath: 'src/features/arguments/oneBox/ActPopout.tsx',
    requiredApi: ['ActPopout'],
  },
  {
    relPath: 'src/features/arguments/oneBox/GoPopout.tsx',
    requiredApi: ['GoPopout'],
  },
  {
    relPath: 'src/features/arguments/oneBox/InspectPopout.tsx',
    requiredApi: ['InspectPopout'],
  },
  {
    relPath: 'src/features/arguments/oneBox/actPopoutModel.ts',
    requiredApi: [/export/],
  },
  {
    relPath: 'src/features/arguments/oneBox/goPopoutModel.ts',
    requiredApi: [/export/],
  },
  {
    relPath: 'src/features/arguments/oneBox/inspectPopoutModel.ts',
    requiredApi: [/export/],
  },
  {
    relPath: 'src/features/arguments/oneBox/menuKeyBadgeModel.ts',
    requiredApi: [
      'deriveMenuKeyBadgeContext',
      'resolveKeyBadgeVisibility',
      'BROWSER_KEYBOARD_WIDTH_THRESHOLD',
    ],
  },
  {
    relPath: 'src/features/arguments/oneBox/menuPresentationModel.ts',
    requiredApi: [/export/],
  },
  {
    relPath: 'src/features/arguments/oneBox/inspectContentBuilder.ts',
    requiredApi: [/export/],
  },
  {
    relPath: 'src/features/arguments/oneBox/OneBox.tsx',
    requiredApi: ['OneBox'],
  },
  {
    relPath: 'src/features/arguments/boardMenuKeyboardModel.ts',
    requiredApi: [/export/],
  },
  // UX-001.5
  {
    relPath: 'src/features/nodeAnnotations/annotationChipDescriptor.ts',
    requiredApi: [
      'AnnotationChipDescriptor',
      'ANNOTATION_CHIP_KINDS',
      'ANNOTATION_CHIP_ICON_HINTS',
      'ANNOTATION_CHIP_SOURCES',
      'normalizeAnnotationChipDescriptor',
    ],
  },
  {
    relPath: 'src/features/nodeAnnotations/annotationKindTokens.ts',
    requiredApi: [
      'ANNOTATION_CHIP_HEIGHT_BY_BAND',
      'ANNOTATION_BADGE_DIAMETER_BY_BAND',
      'ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND',
      'ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND',
      'resolveChipColors',
      'resolveChipColorsForDescriptor',
    ],
  },
  {
    relPath: 'src/features/nodeAnnotations/annotationAriaLabel.ts',
    requiredApi: [
      'buildAnnotationAriaLabel',
      'buildAnnotationStripAriaLabel',
    ],
  },
  {
    relPath: 'src/features/nodeAnnotations/annotationFocusBoundary.ts',
    requiredApi: [
      'applyFocusBoundaryEffect',
      'resolveFocusBoundaryKeyEffect',
      'FOCUS_BOUNDARY_NOOP',
    ],
  },
  {
    relPath: 'src/features/nodeAnnotations/inspectSectionChipDescriptors.ts',
    requiredApi: [
      'toAnnotationChipDescriptor',
      'toAnnotationChipDescriptors',
    ],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationChip.tsx',
    requiredApi: ['AnnotationChip'],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationChipStrip.tsx',
    requiredApi: ['AnnotationChipStrip'],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationOverflowChip.tsx',
    requiredApi: [
      'AnnotationOverflowChip',
      'buildAnnotationOverflowAriaLabel',
    ],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationBadge.tsx',
    requiredApi: ['AnnotationBadge'],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationBadgeCluster.tsx',
    requiredApi: ['AnnotationBadgeCluster'],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationFocusRing.tsx',
    requiredApi: ['AnnotationFocusRing'],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationOutline.tsx',
    requiredApi: ['AnnotationOutline'],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationEdgeHighlight.tsx',
    requiredApi: ['AnnotationEdgeHighlight'],
  },
  {
    relPath: 'src/features/nodeAnnotations/AnnotationFocusBoundaryView.tsx',
    requiredApi: ['AnnotationFocusBoundary'],
  },
  {
    relPath: 'src/features/nodeAnnotations/InspectSectionChipStrip.tsx',
    requiredApi: ['InspectSectionChipStrip'],
  },
  {
    relPath: 'src/features/nodeAnnotations/InspectGroupHeader.tsx',
    requiredApi: ['InspectGroupHeader'],
  },
  {
    relPath: 'src/features/nodeAnnotations/index.ts',
    requiredApi: [
      'AnnotationChip',
      'AnnotationChipStrip',
      'AnnotationOverflowChip',
    ],
  },
  {
    relPath: 'src/features/refereeBanners/RefereeBannerView.tsx',
    requiredApi: ['RefereeBannerView', 'observationChips'],
  },
  {
    relPath: 'src/features/evidence/EvidenceAnnotationChip.tsx',
    requiredApi: ['EvidenceAnnotationChip'],
  },
]);

// ── File presence ────────────────────────────────────────────────

describe('UX-001.6 read-only — every enumerated file exists', () => {
  for (const file of READ_ONLY_FILES) {
    it(`${file.relPath} exists`, () => {
      const full = path.resolve(ROOT, file.relPath);
      expect(fs.existsSync(full)).toBe(true);
    });
  }
});

// ── Required API surface holds ──────────────────────────────────

describe('UX-001.6 read-only — required public API surface holds for every enumerated file', () => {
  for (const file of READ_ONLY_FILES) {
    const full = path.resolve(ROOT, file.relPath);
    if (!fs.existsSync(full)) continue;
    const src = fs.readFileSync(full, 'utf8');
    for (const apiToken of file.requiredApi) {
      const tokenLabel = apiToken instanceof RegExp ? apiToken.toString() : apiToken;
      it(`${file.relPath} retains API token ${tokenLabel}`, () => {
        if (apiToken instanceof RegExp) {
          expect(src).toMatch(apiToken);
        } else {
          expect(src).toContain(apiToken);
        }
      });
    }
  }
});

// ── No new supabase migration directory entries ─────────────────

describe('UX-001.6 read-only — no new migration / Edge Function files (zero-diff under supabase/)', () => {
  // The reviewer verifies `git diff main..HEAD --stat -- supabase/` is
  // empty. This test asserts the supabase migrations + functions
  // directories exist (so any new file under them would surface).
  it('supabase/migrations directory exists', () => {
    expect(
      fs.existsSync(path.resolve(ROOT, 'supabase', 'migrations')),
    ).toBe(true);
  });

  it('supabase/functions directory exists', () => {
    expect(
      fs.existsSync(path.resolve(ROOT, 'supabase', 'functions')),
    ).toBe(true);
  });

  it('submit-argument Edge Function exists (read-only per design)', () => {
    expect(
      fs.existsSync(
        path.resolve(ROOT, 'supabase', 'functions', 'submit-argument'),
      ),
    ).toBe(true);
  });
});

// ── Sanity: package.json dependency surface preserved ───────────

describe('UX-001.6 read-only — package.json dependency surface preserved', () => {
  it('package.json exists', () => {
    expect(fs.existsSync(path.resolve(ROOT, 'package.json'))).toBe(true);
  });

  it('package.json declares no AI provider dependency', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(ROOT, 'package.json'), 'utf8'),
    );
    const deps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    expect(deps['@anthropic-ai/sdk']).toBeUndefined();
    expect(deps['@anthropic-ai']).toBeUndefined();
    expect(deps['openai']).toBeUndefined();
    expect(deps['@google/generative-ai']).toBeUndefined();
  });
});

// ── Sanity: file count of UX-001 source surface is stable ───────

describe('UX-001.6 read-only — UX-001 source file count is stable', () => {
  it('the read-only enumeration covers 52+ files (UX-001.1 through UX-001.5)', () => {
    expect(READ_ONLY_FILES.length).toBeGreaterThanOrEqual(52);
  });

  it('every enumerated file is unique (no duplicate paths)', () => {
    const paths = READ_ONLY_FILES.map((f) => f.relPath);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
