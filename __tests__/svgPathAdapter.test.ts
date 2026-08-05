/**
 * VOICE-005 (issue 663) - SVG d-string adapter tests.
 *
 * Byte-exact joining, toFixed(3) locale-neutrality, module-re-import
 * byte identity.
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

describe('VOICE-005 pathSegmentsToSvgD - basic joining', () => {
  test('empty segment array yields empty string', () => {
    expect(pathSegmentsToSvgD([])).toBe('');
  });

  test('single M segment renders MX Y', () => {
    const d = pathSegmentsToSvgD([{ type: 'M', x: 1, y: 2 }]);
    expect(d).toBe('M1.000 2.000');
  });

  test('rectangle sequence joins with single spaces and a Z close', () => {
    const segs: readonly PathSegment[] = [
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 10, y: 0 },
      { type: 'L', x: 10, y: 5 },
      { type: 'L', x: 0, y: 5 },
      { type: 'Z' },
    ];
    expect(pathSegmentsToSvgD(segs)).toBe(
      'M0.000 0.000 L10.000 0.000 L10.000 5.000 L0.000 5.000 Z',
    );
  });
});

describe('VOICE-005 pathSegmentsToSvgD - toFixed(3) locale neutrality', () => {
  test('numbers always use U+002E as the decimal separator', () => {
    const d = pathSegmentsToSvgD([{ type: 'M', x: 1234.5678, y: 0.0005 }]);
    // toFixed rounds half-to-even so 0.0005 renders as 0.001 or 0.000
    // depending on IEEE-754 representation. Both outcomes are locale-
    // independent - the assertion is on the separator, not the rounding.
    expect(d).toMatch(/^M1234\.568 0\.[0-9]{3}$/);
    expect(d).not.toContain(',');
  });

  test('no thousands separator ever appears', () => {
    const d = pathSegmentsToSvgD([{ type: 'M', x: 1000000, y: 2000000 }]);
    expect(d).toBe('M1000000.000 2000000.000');
  });

  test('negative zero renders as 0.000', () => {
    const d = pathSegmentsToSvgD([{ type: 'M', x: -0, y: -0 }]);
    // JS Number.prototype.toFixed emits 0.000 for -0. Pin it here so an
    // engine upgrade cannot silently produce -0.000.
    expect(d).toBe('M0.000 0.000');
  });
});

describe('VOICE-005 pathSegmentsToSvgD - byte identity across module re-imports', () => {
  test('two independent import cycles produce byte-identical output for the same segments', () => {
    const layout: VisualizerLayout = { width: 300, height: 60 };
    const buckets = [0.1, 0.4, 0.7, 1.0];

    let firstOut = '';
    let secondOut = '';

    jest.isolateModules(() => {
      const mod = require('../src/features/voice/visualizer');
      firstOut = mod.pathSegmentsToSvgD(
        mod.bucketsToPathSegments(buckets, layout),
      );
    });
    jest.isolateModules(() => {
      const mod = require('../src/features/voice/visualizer');
      secondOut = mod.pathSegmentsToSvgD(
        mod.bucketsToPathSegments(buckets, layout),
      );
    });

    expect(firstOut).toBe(secondOut);

    // Also matches the non-isolated call so the barrel is consistent.
    const nonIsolated = pathSegmentsToSvgD(
      bucketsToPathSegments(buckets, layout),
    );
    expect(firstOut).toBe(nonIsolated);
  });
});

describe('VOICE-005 pathSegmentsToSvgD - canonical shape byte fixtures', () => {
  test('empty buckets golden output', () => {
    const d = pathSegmentsToSvgD(
      bucketsToPathSegments([], { width: 300, height: 60 }),
    );
    expect(d).toBe('M0.000 30.000 L300.000 30.000');
  });

  test('single 0.5 bucket golden output', () => {
    const d = pathSegmentsToSvgD(
      bucketsToPathSegments([0.5], { width: 100, height: 40 }),
    );
    // q8(0.5) = 128 / 255. halfH = (128 / 255) * 40 / 2 = 10.039215686...
    // yTop = 20 - halfH = 9.96078... -> 9.961.
    // yBot = 20 + halfH = 30.03921... -> 30.039.
    expect(d).toBe('M0.000 9.961 L99.000 9.961 L99.000 30.039 L0.000 30.039 Z');
  });

  test('two-bucket all-zero golden output', () => {
    const d = pathSegmentsToSvgD(
      bucketsToPathSegments([0, 0], { width: 100, height: 40 }),
    );
    // rawBarWidth = 50; barWidth = 49; both bars are zero-height ticks at cy = 20.
    expect(d).toBe(
      'M0.000 20.000 L49.000 20.000 L49.000 20.000 L0.000 20.000 Z ' +
        'M50.000 20.000 L99.000 20.000 L99.000 20.000 L50.000 20.000 Z',
    );
  });
});
