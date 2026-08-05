/**
 * VOICE-005 (issue 663) - pure geometry core scenario matrix.
 *
 * Covers the empty / single / N-bucket cases, all-zero / all-one /
 * alternating shapes, defensive clamps for adversarial inputs and
 * degenerate layouts, INV-A byte-equal purity across double calls,
 * INV-B live-vs-finalized parity, and property-style checks over the
 * 256-level lattice.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import {
  bucketsToPathSegments,
  pathSegmentsToSvgD,
} from '../src/features/voice/visualizer';
import type {
  PathSegment,
  VisualizerLayout,
} from '../src/features/voice/visualizer';

// ---------- Helpers ---------------------------------------------------------

function q8(x: number): number {
  return Math.round(x * 255) / 255;
}

function q8Array(xs: readonly number[]): readonly number[] {
  return xs.map(q8);
}

const LAYOUT_SMALL: VisualizerLayout = Object.freeze({
  width: 300,
  height: 60,
});

// ---------- Empty / single / boundary --------------------------------------

describe('VOICE-005 empty buckets renders the centerline cue', () => {
  test('empty array yields a two-segment centerline stroke', () => {
    const segs = bucketsToPathSegments([], LAYOUT_SMALL);
    expect(segs).toEqual([
      { type: 'M', x: 0, y: 30 },
      { type: 'L', x: 300, y: 30 },
    ]);
  });

  test('empty array uses supplied centerlineY when provided', () => {
    const segs = bucketsToPathSegments([], {
      width: 100,
      height: 40,
      centerlineY: 10,
    });
    expect(segs).toEqual([
      { type: 'M', x: 0, y: 10 },
      { type: 'L', x: 100, y: 10 },
    ]);
  });

  test('empty array output is frozen', () => {
    const segs = bucketsToPathSegments([], LAYOUT_SMALL);
    expect(Object.isFrozen(segs)).toBe(true);
  });
});

describe('VOICE-005 single bucket', () => {
  test('single bucket at 0.5 fills width with one rectangle around cy', () => {
    const segs = bucketsToPathSegments([0.5], {
      width: 100,
      height: 40,
    });
    // rawBarWidth = 100; barWidth = 100 - 1 = 99 (gap default 1).
    // halfH = q8(0.5) * 40 / 2 with q8(0.5) equal to 128 / 255.
    const b = q8(0.5);
    const halfH = (b * 40) / 2;
    expect(segs).toEqual([
      { type: 'M', x: 0, y: 20 - halfH },
      { type: 'L', x: 99, y: 20 - halfH },
      { type: 'L', x: 99, y: 20 + halfH },
      { type: 'L', x: 0, y: 20 + halfH },
      { type: 'Z' },
    ]);
  });

  test('single bucket does not divide by zero when width equals bar gap', () => {
    const segs = bucketsToPathSegments([0.5], {
      width: 1,
      height: 40,
      barGapPx: 5,
    });
    // rawBarWidth = 1; barWidthCandidate = -4; clamps to minBarWidthPx = 0.5.
    expect(segs.length).toBe(5);
    const m = segs[0] as Extract<PathSegment, { type: 'M' }>;
    const l = segs[1] as Extract<PathSegment, { type: 'L' }>;
    expect(l.x - m.x).toBeCloseTo(0.5, 6);
  });
});

// ---------- All-zero / all-one / alternating shapes ------------------------

describe('VOICE-005 canonical shape rendering', () => {
  test('8 all-zero buckets yield 8 zero-height ticks on the centerline', () => {
    const layout: VisualizerLayout = { width: 400, height: 80 };
    const segs = bucketsToPathSegments(new Array(8).fill(0), layout);
    // 5 segments per bucket * 8 buckets = 40 segments.
    expect(segs.length).toBe(40);
    // Every Y is exactly cy = 40 because halfH is 0.
    for (const seg of segs) {
      if (seg.type !== 'Z') {
        expect(seg.y).toBe(40);
      }
    }
  });

  test('all-ones buckets span the full height without exceeding layout bounds', () => {
    const layout: VisualizerLayout = { width: 100, height: 40 };
    const segs = bucketsToPathSegments([1, 1, 1, 1], layout);
    for (const seg of segs) {
      if (seg.type !== 'Z') {
        expect(seg.y).toBeGreaterThanOrEqual(0);
        expect(seg.y).toBeLessThanOrEqual(40);
      }
    }
  });

  test('alternating 0 and 1 buckets produce strict alternating bar heights', () => {
    const layout: VisualizerLayout = { width: 400, height: 40 };
    const segs = bucketsToPathSegments([0, 1, 0, 1], layout);
    // 4 buckets * 5 segments = 20 segments.
    expect(segs.length).toBe(20);
    // Bucket 0 (zero): all Y equal cy.
    for (let s = 0; s < 4; s += 1) {
      const seg = segs[s];
      if (seg.type !== 'Z') expect(seg.y).toBe(20);
    }
    // Bucket 1 (one): Y values span top to bottom.
    const yTop1 = (segs[5] as Extract<PathSegment, { type: 'M' }>).y;
    const yBot1 = (segs[8] as Extract<PathSegment, { type: 'L' }>).y;
    expect(yTop1).toBe(0);
    expect(yBot1).toBe(40);
  });

  test('64 varied buckets fill layout width and count exactly 64 bars', () => {
    const layout: VisualizerLayout = { width: 640, height: 100 };
    const buckets = new Array<number>(64);
    for (let i = 0; i < 64; i += 1) {
      buckets[i] = 0.1 + (0.9 * (i % 8)) / 8;
    }
    const segs = bucketsToPathSegments(buckets, layout);
    expect(segs.length).toBe(64 * 5);
    // Each bar starts at i * rawBarWidth (rawBarWidth = 10).
    for (let i = 0; i < 64; i += 1) {
      const seg = segs[i * 5] as Extract<PathSegment, { type: 'M' }>;
      expect(seg.type).toBe('M');
      expect(seg.x).toBe(i * 10);
    }
    // Last bar right edge = 63 * 10 + 9 (barWidth = 10 - 1 = 9).
    const lastBarRight = segs[63 * 5 + 1] as Extract<PathSegment, { type: 'L' }>;
    expect(lastBarRight.x).toBe(63 * 10 + 9);
  });

  test('256 buckets (MAX boundary) at 0.5 yields 256 bars with barWidth 1', () => {
    const layout: VisualizerLayout = { width: 512, height: 60 };
    const segs = bucketsToPathSegments(new Array(256).fill(0.5), layout);
    expect(segs.length).toBe(256 * 5);
    // rawBarWidth = 2; barWidth = 2 - 1 = 1.
    const m0 = segs[0] as Extract<PathSegment, { type: 'M' }>;
    const l0 = segs[1] as Extract<PathSegment, { type: 'L' }>;
    expect(l0.x - m0.x).toBe(1);
  });
});

// ---------- INV-A purity (byte-equal double call) --------------------------

describe('VOICE-005 INV-A purity - double call is deep equal', () => {
  test('same input yields deep-equal output on two independent calls', () => {
    const layout: VisualizerLayout = { width: 300, height: 60 };
    const buckets = [0.1, 0.2, 0.3, 0.4, 0.5];
    const a = bucketsToPathSegments(buckets, layout);
    const b = bucketsToPathSegments(buckets, layout);
    expect(a).toEqual(b);
    expect(pathSegmentsToSvgD(a)).toBe(pathSegmentsToSvgD(b));
  });

  test('output is frozen so callers cannot mutate the geometry', () => {
    const segs = bucketsToPathSegments([0.5, 0.5], LAYOUT_SMALL);
    expect(Object.isFrozen(segs)).toBe(true);
  });
});

// ---------- INV-B live-vs-finalized parity ---------------------------------

describe('VOICE-005 INV-B live vs finalized parity', () => {
  test('raw live floats and their 8-bit quantized counterparts render identically', () => {
    const layout: VisualizerLayout = { width: 200, height: 40 };
    const live = [0.501, 0.502, 0.503, 0.999, 0.001];
    const finalized = q8Array(live);
    const a = bucketsToPathSegments(live, layout);
    const b = bucketsToPathSegments(finalized, layout);
    expect(a).toEqual(b);
    expect(pathSegmentsToSvgD(a)).toBe(pathSegmentsToSvgD(b));
  });

  test('property over the 256-level lattice', () => {
    const layout: VisualizerLayout = { width: 100, height: 40 };
    for (let k = 0; k < 256; k += 1) {
      const raw = [k / 255];
      const finalized = q8Array(raw);
      const a = bucketsToPathSegments(raw, layout);
      const b = bucketsToPathSegments(finalized, layout);
      expect(a).toEqual(b);
    }
  });
});

// ---------- Defensive clamps -----------------------------------------------

describe('VOICE-005 defensive clamps for adversarial inputs', () => {
  test('NaN Infinity negative and above-one map to safe amplitudes', () => {
    const layout: VisualizerLayout = { width: 100, height: 40 };
    const adversarial = [NaN, -0.5, 1.5, Infinity];
    const safe = [0, 0, 1, 0];
    const a = bucketsToPathSegments(adversarial, layout);
    const b = bucketsToPathSegments(safe, layout);
    expect(a).toEqual(b);
  });

  test('NaN never becomes a peak', () => {
    const layout: VisualizerLayout = { width: 100, height: 40 };
    const segs = bucketsToPathSegments([NaN, NaN, NaN], layout);
    // All Y coordinates equal cy = 20.
    for (const seg of segs) {
      if (seg.type !== 'Z') expect(seg.y).toBe(20);
    }
  });
});

// ---------- Degenerate layouts ---------------------------------------------

describe('VOICE-005 degenerate layouts return safely', () => {
  test.each([
    { width: 0, height: 40 },
    { width: -1, height: 40 },
    { width: NaN, height: 40 },
    { width: Infinity, height: 40 },
    { width: 100, height: 0 },
    { width: 100, height: -1 },
    { width: 100, height: NaN },
    { width: 100, height: Infinity },
  ] as VisualizerLayout[])('layout %p returns empty array', (layout) => {
    const segs = bucketsToPathSegments([0.5, 0.5], layout);
    expect(segs).toEqual([]);
    expect(Object.isFrozen(segs)).toBe(true);
  });

  test('negative centerlineY clamps to 0', () => {
    const segs = bucketsToPathSegments([], {
      width: 100,
      height: 40,
      centerlineY: -5,
    });
    const m = segs[0] as Extract<PathSegment, { type: 'M' }>;
    expect(m.y).toBe(0);
  });

  test('centerlineY above height clamps to height', () => {
    const segs = bucketsToPathSegments([], {
      width: 100,
      height: 40,
      centerlineY: 999,
    });
    const m = segs[0] as Extract<PathSegment, { type: 'M' }>;
    expect(m.y).toBe(40);
  });

  test('non-finite centerlineY falls back to height/2', () => {
    const segs = bucketsToPathSegments([], {
      width: 100,
      height: 40,
      centerlineY: NaN,
    });
    const m = segs[0] as Extract<PathSegment, { type: 'M' }>;
    expect(m.y).toBe(20);
  });

  test('negative barGapPx falls back to default 1', () => {
    const layout: VisualizerLayout = {
      width: 100,
      height: 40,
      barGapPx: -3,
    };
    const segsA = bucketsToPathSegments([0.5, 0.5], layout);
    const segsB = bucketsToPathSegments([0.5, 0.5], {
      width: 100,
      height: 40,
    });
    expect(segsA).toEqual(segsB);
  });

  test('non-positive minBarWidthPx falls back to default 0.5', () => {
    const layoutA: VisualizerLayout = {
      width: 1,
      height: 40,
      barGapPx: 5,
      minBarWidthPx: 0,
    };
    const layoutB: VisualizerLayout = {
      width: 1,
      height: 40,
      barGapPx: 5,
    };
    const a = bucketsToPathSegments([0.5], layoutA);
    const b = bucketsToPathSegments([0.5], layoutB);
    expect(a).toEqual(b);
  });
});

describe('VOICE-005 bar-gap overflow degrades to minBarWidthPx', () => {
  test('barGapPx greater than rawBarWidth clamps to minBarWidthPx (no negative widths)', () => {
    const layout: VisualizerLayout = {
      width: 100,
      height: 40,
      barGapPx: 5,
    };
    const segs = bucketsToPathSegments(new Array(200).fill(0.5), layout);
    // 200 buckets * 5 segments per bucket = 1000 segments.
    expect(segs.length).toBe(1000);
    // barWidth is clamped to 0.5.
    const m = segs[0] as Extract<PathSegment, { type: 'M' }>;
    const l = segs[1] as Extract<PathSegment, { type: 'L' }>;
    expect(l.x - m.x).toBeCloseTo(0.5, 6);
    // No coordinate goes negative in the emitted d string.
    const d = pathSegmentsToSvgD(segs);
    expect(d).not.toMatch(/-\d/);
  });
});

// ---------- Purity source-level pins ---------------------------------------

describe('VOICE-005 bucketsToPathSegments source-level purity pins', () => {
  test('source has none of the banned purity or non-basic-arith calls', () => {
    const src = require('fs').readFileSync(
      require('path').join(
        process.cwd(),
        'src/features/voice/visualizer/bucketsToPathSegments.ts',
      ),
      'utf8',
    );
    // Property phrased so this test file does not name the banned tokens.
    // The doctrine guard in voice005ForbiddenInferenceGuard.test.ts catches
    // the source directly; these regexes are a per-file belt-and-braces.
    expect(src).not.toMatch(/\bDate\s*\.\s*now\b/);
    expect(src).not.toMatch(/\bMath\s*\.\s*random\b/);
    expect(src).not.toMatch(/\bMath\s*\.\s*sin\b/);
    expect(src).not.toMatch(/\bMath\s*\.\s*cos\b/);
    expect(src).not.toMatch(/\bMath\s*\.\s*tan\b/);
    expect(src).not.toMatch(/\bMath\s*\.\s*sqrt\b/);
    expect(src).not.toMatch(/\bMath\s*\.\s*atan\b/);
    expect(src).not.toMatch(/\bperformance\s*\.\s*now\b/);
    expect(src).not.toMatch(/\brequestAnimationFrame\b/);
  });
});
