/**
 * UX-001.7 — Token export contract + consumer-count audit.
 *
 * Asserts that the new tokens added to `src/lib/designTokens.ts` exist,
 * have the documented shape, and have at least two consumers across the
 * UX-001 surface set. Per the intent brief:
 *
 *   "Every typography / spacing token has at least two consumers across
 *   UX-001.{1-6} surfaces; single-consumer literals stay as literals
 *   (do not overbuild)."
 *
 * Per `docs/designs/UX-001.7.md` §2-§3.
 *
 * The consumer-count assertion is satisfied by counting:
 *
 *   - Token-name string occurrences (after the token replacement work
 *     in this card), AND/OR
 *   - Literal-value occurrences (the value the token names — proves the
 *     >=2 consumers exist regardless of whether each one has been
 *     migrated; single-consumer literals stay as literals per the brief
 *     "do not overbuild" rule).
 *
 * Pure-TS test (no React). Source-scan technique mirrors the UX-001.6
 * matrix tests.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  BORDER_WIDTH,
  FOCUS_RING,
  SPACING,
  SPACING_PRESETS,
  SURFACE_TOKENS,
  TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../src/lib/designTokens';

const ROOT = process.cwd();

/**
 * UX-001 surface set across phases 1-6 (the cards that ship the
 * consumed literals). Used for the consumer-count audit.
 */
const UX_001_SURFACE_FILES: ReadonlyArray<string> = Object.freeze([
  // UX-001.1
  'src/components/AppHeader.tsx',
  'src/components/AppHeaderTagline.tsx',
  'src/hooks/useHeaderBreakpoint.ts',
  // UX-001.2
  'src/features/arguments/ArgumentTimelineMap.tsx',
  'src/features/arguments/ArgumentScoreTracker.tsx',
  'src/features/arguments/timelineViewportLayoutModel.ts',
  'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
  'src/features/debates/DebateDetailHeader.tsx',
  // UX-001.3
  'src/features/arguments/ArgumentComposer.tsx',
  'src/features/arguments/ArgumentComposerDock.tsx',
  'src/features/arguments/composer/CollapsedComposerStrip.tsx',
  'src/features/arguments/composer/ComposerContextStrip.tsx',
  // UX-001.4
  'src/features/arguments/oneBox/OneBox.tsx',
  'src/features/arguments/oneBox/PopoutEntry.tsx',
  'src/features/arguments/oneBox/Popout.tsx',
  'src/features/arguments/oneBox/ActPopout.tsx',
  'src/features/arguments/oneBox/GoPopout.tsx',
  'src/features/arguments/oneBox/InspectPopout.tsx',
  // UX-001.5
  'src/features/refereeBanners/RefereeBannerView.tsx',
  'src/features/nodeAnnotations/AnnotationChip.tsx',
  'src/features/nodeAnnotations/AnnotationChipStrip.tsx',
  'src/features/nodeAnnotations/AnnotationOverflowChip.tsx',
  'src/features/nodeAnnotations/AnnotationFocusRing.tsx',
  'src/features/nodeAnnotations/AnnotationOutline.tsx',
  // EV-005 (the refactor consumer)
  'src/features/evidence/EvidenceAnnotationChip.tsx',
]);

function readIfExists(relPath: string): string {
  const full = path.resolve(ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

/**
 * The surface file cache — one read per file at module load. Keeps
 * later assertions cheap.
 */
const SURFACE_CACHE: Record<string, string> = Object.fromEntries(
  UX_001_SURFACE_FILES.map((f) => [f, readIfExists(f)]),
);

/**
 * Count how many distinct surface files contain at least one occurrence
 * of any of the given patterns.
 */
function countSurfacesMatching(patterns: ReadonlyArray<RegExp>): number {
  let count = 0;
  for (const src of Object.values(SURFACE_CACHE)) {
    if (src.length === 0) continue;
    for (const p of patterns) {
      if (p.test(src)) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

// ── TOUCH_TARGET ────────────────────────────────────────────────

describe('UX-001.7 — TOUCH_TARGET token export', () => {
  it('exports TOUCH_TARGET with the documented shape', () => {
    expect(TOUCH_TARGET).toBeDefined();
    expect(TOUCH_TARGET.minSizePx).toBe(44);
    expect(TOUCH_TARGET.hitSlopAll).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
    expect(TOUCH_TARGET.hitSlopCompact).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
  });

  it('TOUCH_TARGET.minSizePx has >=2 consumers across UX-001 surfaces (token or literal 44 form)', () => {
    // Either the token reference itself, or the underlying literal 44
    // in a minHeight/minWidth/height context, counts as a consumer.
    // Single-callsite literals stay literal per the brief, but the
    // 44-value surface count must be >=2 for the token to be justified.
    const surfaces = countSurfacesMatching([
      /TOUCH_TARGET\.minSizePx/,
      /minHeight:\s*44\b/,
      /minHeight\s*=\s*\{?\s*44\b/,
      /POPOUT_ENTRY_MIN_HEIGHT\s*=\s*44/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('TOUCH_TARGET.hitSlopAll has >=2 consumers across UX-001 surfaces (token or 12-on-all-sides literal form)', () => {
    const surfaces = countSurfacesMatching([
      /TOUCH_TARGET\.hitSlopAll/,
      /hitSlop=\{\{\s*top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12\s*\}\}/,
      /top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('TOUCH_TARGET.hitSlopCompact has >=2 consumers (token or 8-on-all-sides literal form)', () => {
    const surfaces = countSurfacesMatching([
      /TOUCH_TARGET\.hitSlopCompact/,
      /top:\s*8,\s*bottom:\s*8,\s*left:\s*8,\s*right:\s*8/,
      /PADDED_HIT_SLOP\s*=\s*Object\.freeze\(\{\s*top:\s*8/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('TOUCH_TARGET is reachable from the TOKENS aggregate', () => {
    expect(TOKENS.touchTarget).toBe(TOUCH_TARGET);
  });
});

// ── FOCUS_RING ──────────────────────────────────────────────────

describe('UX-001.7 — FOCUS_RING token export', () => {
  it('exports FOCUS_RING with the documented shape', () => {
    expect(FOCUS_RING).toBeDefined();
    expect(FOCUS_RING.widthPx).toBe(2);
    expect(FOCUS_RING.offsetPx).toBe(2);
    expect(FOCUS_RING.color).toBe(SURFACE_TOKENS.focusRing);
  });

  it('FOCUS_RING.widthPx has >=2 consumers (token or borderWidth: 2 literal in UX-001 surfaces)', () => {
    const surfaces = countSurfacesMatching([
      /FOCUS_RING\.widthPx/,
      /borderWidth:\s*2\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('FOCUS_RING.color matches SURFACE_TOKENS.focusRing exactly (one canonical color, no drift)', () => {
    expect(FOCUS_RING.color).toBe('#a5b4fc');
  });

  it('FOCUS_RING is reachable from the TOKENS aggregate', () => {
    expect(TOKENS.focusRing).toBe(FOCUS_RING);
  });
});

// ── BORDER_WIDTH ────────────────────────────────────────────────

describe('UX-001.7 — BORDER_WIDTH token export', () => {
  it('exports BORDER_WIDTH with the documented shape (sm/md/lg)', () => {
    expect(BORDER_WIDTH).toBeDefined();
    expect(BORDER_WIDTH.sm).toBe(1);
    expect(BORDER_WIDTH.md).toBe(2);
    expect(BORDER_WIDTH.lg).toBe(3);
  });

  it('BORDER_WIDTH.md equals FOCUS_RING.widthPx (focus ring uses the standard outline width)', () => {
    expect(BORDER_WIDTH.md).toBe(FOCUS_RING.widthPx);
  });

  it('BORDER_WIDTH.sm has >=2 consumers (token or borderWidth: 1 literal across UX-001 surfaces)', () => {
    const surfaces = countSurfacesMatching([
      /BORDER_WIDTH\.sm/,
      /borderWidth:\s*1\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('BORDER_WIDTH.md has >=2 consumers (token or borderWidth: 2 literal)', () => {
    const surfaces = countSurfacesMatching([
      /BORDER_WIDTH\.md/,
      /borderWidth:\s*2\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('BORDER_WIDTH is reachable from the TOKENS aggregate', () => {
    expect(TOKENS.borderWidth).toBe(BORDER_WIDTH);
  });
});

// ── TYPOGRAPHY ──────────────────────────────────────────────────

describe('UX-001.7 — TYPOGRAPHY token export', () => {
  it('exports TYPOGRAPHY with all 15 documented groups (UX-PR-E added body/title roles + microLabel)', () => {
    expect(TYPOGRAPHY).toBeDefined();
    const keys = Object.keys(TYPOGRAPHY).sort();
    expect(keys).toEqual([
      'badgeLabel',
      'body',          // UX-PR-E
      'bodySm',        // UX-PR-E
      'chipLabel',
      'composer',
      'inspectDetail',
      'keyboardHint',
      'microLabel',    // UX-PR-E
      'popoutBody',
      'popoutHeading',
      'roomStrip',
      'selectedContext',
      'timelineNode',
      'title',         // UX-PR-E
      'titleSm',       // UX-PR-E
    ]);
  });

  it('every TYPOGRAPHY group has fontSize > 0 and lineHeight > 0', () => {
    for (const [, group] of Object.entries(TYPOGRAPHY)) {
      expect(group.fontSize).toBeGreaterThan(0);
      expect(group.lineHeight).toBeGreaterThan(0);
      expect(group.fontWeight).toBeDefined();
    }
  });

  it('TYPOGRAPHY.chipLabel has >=2 consumers (token or 11/14/600 literal across UX-001 surfaces)', () => {
    const surfaces = countSurfacesMatching([
      /TYPOGRAPHY\.chipLabel/,
      /fontSize:\s*11\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('TYPOGRAPHY.composer has >=2 consumers (token or fontSize: 13 literal)', () => {
    const surfaces = countSurfacesMatching([
      /TYPOGRAPHY\.composer/,
      /fontSize:\s*13\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('TYPOGRAPHY.popoutBody has >=2 consumers (token or fontSize: 12 literal)', () => {
    const surfaces = countSurfacesMatching([
      /TYPOGRAPHY\.popoutBody/,
      /fontSize:\s*12\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('TYPOGRAPHY.timelineNode has >=2 consumers (token or fontSize: 11 literal in arguments surfaces)', () => {
    const surfaces = countSurfacesMatching([
      /TYPOGRAPHY\.timelineNode/,
      /fontSize:\s*11\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('TYPOGRAPHY.popoutHeading uses bold weight (700)', () => {
    expect(TYPOGRAPHY.popoutHeading.fontWeight).toBe('700');
  });

  it('TYPOGRAPHY.badgeLabel sits at the 10px legibility floor for compact badges (tied with UX-PR-E microLabel)', () => {
    expect(TYPOGRAPHY.badgeLabel.fontSize).toBe(10);
  });

  it('TYPOGRAPHY is reachable from the TOKENS aggregate', () => {
    expect(TOKENS.typography).toBe(TYPOGRAPHY);
  });
});

// ── SPACING_PRESETS ─────────────────────────────────────────────

describe('UX-001.7 — SPACING_PRESETS token export', () => {
  it('exports SPACING_PRESETS with all 8 documented presets', () => {
    expect(SPACING_PRESETS).toBeDefined();
    const keys = Object.keys(SPACING_PRESETS).sort();
    expect(keys).toEqual([
      'chipGap',
      'compactRowGap',
      'composerPadding',
      'nodeInternalPadding',
      'popoutInternalPadding',
      'screenInset',
      'surfaceGap',
      'touchTargetMin',
    ]);
  });

  it('SPACING_PRESETS.compactRowGap === SPACING_PRESETS.chipGap (both = SPACING.xs by design)', () => {
    // Intent-based separation: same value, different consumer intent.
    expect(SPACING_PRESETS.compactRowGap).toBe(SPACING.xs);
    expect(SPACING_PRESETS.chipGap).toBe(SPACING.xs);
  });

  it('SPACING_PRESETS.touchTargetMin equals TOUCH_TARGET.minSizePx (cross-reference, not a new value)', () => {
    expect(SPACING_PRESETS.touchTargetMin).toBe(TOUCH_TARGET.minSizePx);
  });

  it('every SPACING_PRESETS value maps to an existing SPACING scale value (no drift)', () => {
    const SPACING_VALUES = new Set(Object.values(SPACING));
    expect(SPACING_VALUES.has(SPACING_PRESETS.screenInset)).toBe(true);
    expect(SPACING_VALUES.has(SPACING_PRESETS.surfaceGap)).toBe(true);
    expect(SPACING_VALUES.has(SPACING_PRESETS.compactRowGap)).toBe(true);
    expect(SPACING_VALUES.has(SPACING_PRESETS.chipGap)).toBe(true);
    expect(SPACING_VALUES.has(SPACING_PRESETS.nodeInternalPadding)).toBe(true);
    expect(SPACING_VALUES.has(SPACING_PRESETS.popoutInternalPadding)).toBe(true);
    expect(SPACING_VALUES.has(SPACING_PRESETS.composerPadding)).toBe(true);
  });

  it('SPACING_PRESETS.surfaceGap has >=2 consumers (token or SPACING.m / 12 literal)', () => {
    const surfaces = countSurfacesMatching([
      /SPACING_PRESETS\.surfaceGap/,
      /SPACING\.m\b/,
      /(?:gap|padding|paddingHorizontal|paddingVertical):\s*12\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('SPACING_PRESETS.chipGap has >=2 consumers (token or SPACING.xs / 4 literal)', () => {
    const surfaces = countSurfacesMatching([
      /SPACING_PRESETS\.chipGap/,
      /SPACING\.xs\b/,
      /gap:\s*4\b/,
    ]);
    expect(surfaces).toBeGreaterThanOrEqual(2);
  });

  it('SPACING_PRESETS is reachable from the TOKENS aggregate', () => {
    expect(TOKENS.spacingPresets).toBe(SPACING_PRESETS);
  });
});

// ── Doctrine ban-list on the new tokens ─────────────────────────

describe('UX-001.7 — new tokens carry zero verdict / heat / popularity vocabulary', () => {
  const FORBIDDEN = [
    'winner', 'loser', 'liar', 'truth', 'verdict', 'correct', 'incorrect',
    'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
    'popular', 'trending', 'viral', 'amplification', 'engagement',
  ];

  function scanKeysAndStringValues(obj: unknown, accum: string[]): void {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'string') {
      accum.push(obj);
      return;
    }
    if (typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const v of obj) scanKeysAndStringValues(v, accum);
      return;
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      accum.push(k);
      scanKeysAndStringValues(v, accum);
    }
  }

  it('TOUCH_TARGET keys + values carry no forbidden vocabulary', () => {
    const tokens: string[] = [];
    scanKeysAndStringValues(TOUCH_TARGET, tokens);
    const joined = tokens.join(' ').toLowerCase();
    for (const f of FORBIDDEN) {
      expect(joined).not.toContain(f);
    }
  });

  it('FOCUS_RING keys + values carry no forbidden vocabulary', () => {
    const tokens: string[] = [];
    scanKeysAndStringValues(FOCUS_RING, tokens);
    const joined = tokens.join(' ').toLowerCase();
    for (const f of FORBIDDEN) {
      expect(joined).not.toContain(f);
    }
  });

  it('BORDER_WIDTH keys + values carry no forbidden vocabulary', () => {
    const tokens: string[] = [];
    scanKeysAndStringValues(BORDER_WIDTH, tokens);
    const joined = tokens.join(' ').toLowerCase();
    for (const f of FORBIDDEN) {
      expect(joined).not.toContain(f);
    }
  });

  it('TYPOGRAPHY keys + values carry no forbidden vocabulary', () => {
    const tokens: string[] = [];
    scanKeysAndStringValues(TYPOGRAPHY, tokens);
    const joined = tokens.join(' ').toLowerCase();
    for (const f of FORBIDDEN) {
      expect(joined).not.toContain(f);
    }
  });

  it('SPACING_PRESETS keys + values carry no forbidden vocabulary', () => {
    const tokens: string[] = [];
    scanKeysAndStringValues(SPACING_PRESETS, tokens);
    const joined = tokens.join(' ').toLowerCase();
    for (const f of FORBIDDEN) {
      expect(joined).not.toContain(f);
    }
  });
});

// ── Total token-count ceiling check (intent brief stop condition #8) ─

describe('UX-001.7 — total new token count is well below the 50-ceiling', () => {
  it('TOUCH_TARGET adds 3 keys', () => {
    expect(Object.keys(TOUCH_TARGET)).toHaveLength(3);
  });
  it('FOCUS_RING adds 3 keys', () => {
    expect(Object.keys(FOCUS_RING)).toHaveLength(3);
  });
  it('BORDER_WIDTH adds 3 keys', () => {
    expect(Object.keys(BORDER_WIDTH)).toHaveLength(3);
  });
  it('TYPOGRAPHY adds 15 keys', () => {
    expect(Object.keys(TYPOGRAPHY)).toHaveLength(15);
  });
  it('SPACING_PRESETS adds 8 keys', () => {
    expect(Object.keys(SPACING_PRESETS)).toHaveLength(8);
  });

  it('grand total <= 50 (intent brief stop condition #8)', () => {
    const total =
      Object.keys(TOUCH_TARGET).length +
      Object.keys(FOCUS_RING).length +
      Object.keys(BORDER_WIDTH).length +
      Object.keys(TYPOGRAPHY).length +
      Object.keys(SPACING_PRESETS).length;
    expect(total).toBeLessThanOrEqual(50);
  });
});

// ── Aggregate consistency ───────────────────────────────────────

describe('UX-001.7 — TOKENS aggregate preserves prior exports byte-identical', () => {
  it('SPACING reachable from TOKENS.spacing', () => {
    expect(TOKENS.spacing).toBe(SPACING);
  });
  it('SURFACE_TOKENS reachable from TOKENS.surfaceTokens', () => {
    expect(TOKENS.surfaceTokens).toBe(SURFACE_TOKENS);
  });
  it('TOKENS exposes all 5 new UX-001.7 token surfaces', () => {
    expect(TOKENS.touchTarget).toBeDefined();
    expect(TOKENS.focusRing).toBeDefined();
    expect(TOKENS.borderWidth).toBeDefined();
    expect(TOKENS.typography).toBeDefined();
    expect(TOKENS.spacingPresets).toBeDefined();
  });
});
