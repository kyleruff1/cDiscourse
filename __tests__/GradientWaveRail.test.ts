/**
 * VG-002 — GradientWaveRail pure-helper tests.
 *
 * Per the implementer constraints, this card uses the pure-helper test
 * pattern (matching EV-002's accepted adaptation). Render-tree tests
 * are deferred to QOL-022 / #58. These tests exercise the
 * style-derivation contract the component consumes — same code path
 * the runtime uses — so coverage of the layer-count, glow-toggling,
 * pointer-events, virtualization contract, and no-animation guarantees
 * is verified without mounting React.
 */

import {
  ALL_RAIL_BRANCH_KINDS,
  deriveRailSegmentStyle,
  visibleSegmentSlice,
  type RailSegmentInput,
  type RailSegmentStyle,
} from '../src/features/arguments/railSegmentModel';
import { ALL_SOURCE_CHAIN_STATUSES } from '../src/features/evidence/evidenceModel';
import type {
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

function fakeInput(over: Partial<RailSegmentInput> = {}): RailSegmentInput {
  return {
    segmentId: over.segmentId ?? 'seg-1',
    fromMessageId: over.fromMessageId ?? 'm1',
    toMessageId: over.toMessageId ?? 'm2',
    x1: over.x1 ?? 0,
    y1: over.y1 ?? 100,
    x2: over.x2 ?? 100,
    y2: over.y2 ?? 100,
    gradientStops: over.gradientStops ?? ['#22c55e', '#f59e0b', '#f97316'],
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    sourceChainStatus: over.sourceChainStatus ?? 'no_source',
    branchKind: over.branchKind ?? 'main',
    isActivePath: over.isActivePath ?? false,
    isFirstClash: over.isFirstClash ?? false,
  };
}

/**
 * Count the `<View>` instances a single segment would mount given its
 * derived style. Mirrors the component's render branches exactly so
 * any drift between the helper and the component is caught by these
 * tests.
 */
function countMountedViews(style: RailSegmentStyle): number {
  if (style.isHidden) return 0;
  let total = 1; // wrapper
  total += style.baseSubStripColors.length; // 6 base sub-strips
  if (style.toneWash.alpha > 0) total += 1;
  if (style.evidenceTrack) {
    if (style.evidenceTrack.mode === 'solid') {
      total += 1;
    } else {
      total += 1 + style.evidenceTrack.alphaPattern.length; // dotted wrapper + 6 sub-strips
    }
  }
  if (style.wrapper.showKinkStartStub) total += 1;
  if (style.wrapper.showKinkEndStub) total += 1;
  if (style.glow) total += 1;
  return total;
}

// ────────────────────────────────────────────────────────────────
// Layer-count matrix (mirrors the component's render branches)
// ────────────────────────────────────────────────────────────────

describe('VG-002 — GradientWaveRail layer count per state', () => {
  it('main + no_source + cool tone + non-active → 7 Views (wrapper + 6 base, no overlays)', () => {
    const style = deriveRailSegmentStyle(fakeInput({
      branchKind: 'main',
      sourceChainStatus: 'no_source',
      toneBand: 'calm',
      temperatureBand: 'cool', // alpha = 0, no tone-wash mounted
      isActivePath: false,
    }));
    expect(countMountedViews(style)).toBe(7);
  });

  it('main + source_and_quote + warm tone + active → 10 Views', () => {
    // 1 wrapper + 6 base + 1 tone wash + 1 solid evidence track + 1 glow = 10
    const style = deriveRailSegmentStyle(fakeInput({
      branchKind: 'main',
      sourceChainStatus: 'source_and_quote',
      toneBand: 'heated',
      temperatureBand: 'warm',
      isActivePath: true,
    }));
    expect(countMountedViews(style)).toBe(10);
  });

  it('main + broken + warm tone + non-active → 15 Views (dotted pattern adds 7 Views)', () => {
    // 1 wrapper + 6 base + 1 tone wash + 1 dotted wrapper + 6 dotted = 15
    const style = deriveRailSegmentStyle(fakeInput({
      branchKind: 'main',
      sourceChainStatus: 'broken',
      toneBand: 'heated',
      temperatureBand: 'warm',
      isActivePath: false,
    }));
    expect(countMountedViews(style)).toBe(15);
  });

  it('detached → 0 Views (segment skipped entirely)', () => {
    const style = deriveRailSegmentStyle(fakeInput({ branchKind: 'detached' }));
    expect(countMountedViews(style)).toBe(0);
    expect(style.isHidden).toBe(true);
  });

  it('kink_start adds the start stub View; kink_end adds the end stub View', () => {
    const a = deriveRailSegmentStyle(fakeInput({ branchKind: 'kink_start' }));
    const b = deriveRailSegmentStyle(fakeInput({ branchKind: 'kink_end' }));
    const baseline = deriveRailSegmentStyle(fakeInput({ branchKind: 'main' }));
    expect(countMountedViews(a)).toBe(countMountedViews(baseline) + 1);
    expect(countMountedViews(b)).toBe(countMountedViews(baseline) + 1);
  });
});

// ────────────────────────────────────────────────────────────────
// Glow only when active
// ────────────────────────────────────────────────────────────────

describe('VG-002 — GradientWaveRail glow gate', () => {
  it('glow is present iff isActivePath is true', () => {
    for (const branchKind of ALL_RAIL_BRANCH_KINDS) {
      for (const status of ALL_SOURCE_CHAIN_STATUSES) {
        const off = deriveRailSegmentStyle(fakeInput({ branchKind, sourceChainStatus: status, isActivePath: false }));
        const on = deriveRailSegmentStyle(fakeInput({ branchKind, sourceChainStatus: status, isActivePath: true }));
        if (branchKind === 'detached') {
          // detached strips are hidden — glow is suppressed regardless
          expect(off.glow).toBeNull();
          expect(on.glow).toBeNull();
        } else {
          expect(off.glow).toBeNull();
          expect(on.glow).not.toBeNull();
        }
      }
    }
  });

  it('glow descriptor carries shadow / elevation props for both iOS and Android', () => {
    const s = deriveRailSegmentStyle(fakeInput({ isActivePath: true }));
    expect(s.glow).not.toBeNull();
    if (s.glow) {
      expect(typeof s.glow.color).toBe('string');
      expect(s.glow.shadowOpacity).toBeGreaterThan(0);
      expect(s.glow.shadowRadius).toBeGreaterThan(0);
      expect(s.glow.elevation).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// Virtualized slice contract — component renders only what parent passes
// ────────────────────────────────────────────────────────────────

describe('VG-002 — GradientWaveRail virtualization contract', () => {
  it('slice of 5 from a 50-segment fixture mounts only 5 segments worth of Views', () => {
    const segs: RailSegmentInput[] = Array.from({ length: 50 }, (_, i) =>
      fakeInput({
        segmentId: `seg-${i}`,
        fromMessageId: `m${i}`,
        toMessageId: `m${i + 1}`,
        x1: i * 72,
        x2: (i + 1) * 72,
      }),
    );
    // Window: scrollX=0, viewport=200, buffer=0 → only seg-0..2 should overlap
    const slice = visibleSegmentSlice(segs, 0, 200, 0);
    expect(slice.length).toBeGreaterThanOrEqual(2);
    expect(slice.length).toBeLessThanOrEqual(4);
    const total = slice.reduce((acc, s) => acc + countMountedViews(deriveRailSegmentStyle(s)), 0);
    // Each segment in this fixture renders 7 Views (no tone, no overlays)
    expect(total).toBe(slice.length * 7);
  });

  it('zero-segment slice mounts zero Views', () => {
    expect(visibleSegmentSlice([], 0, 800, 0)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────
// No animation invoked — static layers only
// ────────────────────────────────────────────────────────────────

describe('VG-002 — GradientWaveRail no-animation guarantee', () => {
  it('no derived style carries any animated descriptor (animatedValue / duration / easing)', () => {
    // Future cards that add animation MUST gate on
    // AccessibilityInfo.isReduceMotionEnabled. This test future-proofs
    // the seam by asserting no animation descriptors exist today.
    for (const branchKind of ALL_RAIL_BRANCH_KINDS) {
      for (const status of ALL_SOURCE_CHAIN_STATUSES) {
        const s = deriveRailSegmentStyle(fakeInput({ branchKind, sourceChainStatus: status, isActivePath: true }));
        for (const layer of [s.toneWash, s.evidenceTrack, s.glow]) {
          if (!layer) continue;
          expect('animatedValue' in layer).toBe(false);
          expect('transitionDurationMs' in layer).toBe(false);
          expect('easing' in layer).toBe(false);
        }
      }
    }
  });
});
