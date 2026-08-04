/**
 * VOICE-005 (issue 663) - Skia path-builder adapter tests.
 *
 * Uses a fake SkiaPathLike that records every call. Parametric parity
 * with the SVG joiner over the canonical shape set (empty / single /
 * multi-bucket) proves INV-C - the two adapters render the same
 * geometry from the same segments.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import {
  applyPathSegmentsToSkiaPath,
  bucketsToPathSegments,
  pathSegmentsToSvgD,
} from '../src/features/voice/visualizer';
import type {
  PathSegment,
  SkiaPathLike,
  VisualizerLayout,
} from '../src/features/voice/visualizer';

type Recorded =
  | readonly ['moveTo', number, number]
  | readonly ['lineTo', number, number]
  | readonly ['close'];

function makeFakeSkiaPath(): { path: SkiaPathLike; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const path: SkiaPathLike = {
    moveTo: (x: number, y: number) => {
      calls.push(['moveTo', x, y] as const);
    },
    lineTo: (x: number, y: number) => {
      calls.push(['lineTo', x, y] as const);
    },
    close: () => {
      calls.push(['close'] as const);
    },
  };
  return { path, calls };
}

describe('VOICE-005 applyPathSegmentsToSkiaPath - call order', () => {
  test('empty segments produce no calls', () => {
    const { path, calls } = makeFakeSkiaPath();
    applyPathSegmentsToSkiaPath(path, []);
    expect(calls).toEqual([]);
  });

  test('M L L L Z sequence produces matching moveTo / lineTo / close calls in order', () => {
    const { path, calls } = makeFakeSkiaPath();
    const segs: readonly PathSegment[] = [
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 10, y: 0 },
      { type: 'L', x: 10, y: 5 },
      { type: 'L', x: 0, y: 5 },
      { type: 'Z' },
    ];
    applyPathSegmentsToSkiaPath(path, segs);
    expect(calls).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 10, 0],
      ['lineTo', 10, 5],
      ['lineTo', 0, 5],
      ['close'],
    ]);
  });
});

describe('VOICE-005 applyPathSegmentsToSkiaPath - INV-C parity with SVG joiner', () => {
  const cases: ReadonlyArray<{
    name: string;
    buckets: readonly number[];
    layout: VisualizerLayout;
  }> = [
    { name: 'empty', buckets: [], layout: { width: 300, height: 60 } },
    { name: 'single 0.5', buckets: [0.5], layout: { width: 100, height: 40 } },
    {
      name: 'four alternating',
      buckets: [0, 1, 0, 1],
      layout: { width: 400, height: 40 },
    },
    {
      name: 'eight varied',
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      layout: { width: 640, height: 100 },
    },
  ];

  test.each(cases)(
    '$name - call count matches SVG command count and coords match at 3 dp',
    ({ buckets, layout }) => {
      const segs = bucketsToPathSegments(buckets, layout);
      const { path, calls } = makeFakeSkiaPath();
      applyPathSegmentsToSkiaPath(path, segs);

      // Length parity: each segment produces exactly one call.
      expect(calls.length).toBe(segs.length);

      // Byte parity: format the recorded coords at 3 dp and rebuild the
      // SVG d string from the fake calls. It must match the joiner.
      const rebuilt = calls
        .map((c) => {
          if (c[0] === 'moveTo') return 'M' + c[1].toFixed(3) + ' ' + c[2].toFixed(3);
          if (c[0] === 'lineTo') return 'L' + c[1].toFixed(3) + ' ' + c[2].toFixed(3);
          return 'Z';
        })
        .join(' ');
      const svg = pathSegmentsToSvgD(segs);
      expect(rebuilt).toBe(svg);
    },
  );
});

describe('VOICE-005 applyPathSegmentsToSkiaPath - no external state', () => {
  test('two independent applies over the same segments produce identical call logs', () => {
    const segs = bucketsToPathSegments([0.5, 0.5, 0.5], {
      width: 300,
      height: 40,
    });
    const a = makeFakeSkiaPath();
    const b = makeFakeSkiaPath();
    applyPathSegmentsToSkiaPath(a.path, segs);
    applyPathSegmentsToSkiaPath(b.path, segs);
    expect(a.calls).toEqual(b.calls);
  });
});

describe('VOICE-005 applyPathSegmentsToSkiaPath - source bans Skia SVG parser', () => {
  test('source contains no reference to the Skia SVG-parser entry-point name', () => {
    const src = require('fs').readFileSync(
      require('path').join(
        process.cwd(),
        'src/features/voice/visualizer/applyPathSegmentsToSkiaPath.ts',
      ),
      'utf8',
    );
    // The banned literal is assembled from parts so this test file does
    // not itself carry the token that the doctrine scanner would bite on
    // in the source folder. The visualizer guard scan owns the canonical
    // check; this is a per-file belt-and-braces.
    const banned = 'Make' + 'From' + 'SVG' + 'String';
    expect(src).not.toContain(banned);
  });

  test('source imports no native Skia module', () => {
    const src = require('fs').readFileSync(
      require('path').join(
        process.cwd(),
        'src/features/voice/visualizer/applyPathSegmentsToSkiaPath.ts',
      ),
      'utf8',
    );
    expect(src).not.toContain('@shopify/react-native-skia');
  });
});
