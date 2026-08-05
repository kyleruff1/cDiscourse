/**
 * VOICE-005 (issue 663) - defensive re-quantizer tests.
 *
 * Idempotence, 256-level lattice, boundary values, non-finite handling
 * mirroring the VOICE-004 clamp posture.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import { quantizeBucketsForRender } from '../src/features/voice/visualizer';

function q8(x: number): number {
  return Math.round(x * 255) / 255;
}

describe('VOICE-005 quantizeBucketsForRender - idempotence', () => {
  test('applying twice yields byte-identical output', () => {
    const raw = [0.001, 0.123, 0.4999, 0.5, 0.5001, 0.9999];
    const once = quantizeBucketsForRender(raw);
    const twice = quantizeBucketsForRender(once);
    expect(twice).toEqual(once);
  });

  test('idempotence across every point on the 256-level lattice', () => {
    for (let k = 0; k < 256; k += 1) {
      const point = k / 255;
      const once = quantizeBucketsForRender([point]);
      const twice = quantizeBucketsForRender(once);
      expect(twice).toEqual(once);
      expect(once[0]).toBe(point);
    }
  });
});

describe('VOICE-005 quantizeBucketsForRender - clamp posture', () => {
  test('non-finite inputs (NaN, +Inf, -Inf) collapse to 0', () => {
    expect(quantizeBucketsForRender([NaN, Infinity, -Infinity])).toEqual([
      0, 0, 0,
    ]);
  });

  test('negative inputs collapse to 0 (never treated as amplitude)', () => {
    expect(quantizeBucketsForRender([-0.1, -1, -1000])).toEqual([0, 0, 0]);
  });

  test('above-one inputs clamp to 1', () => {
    expect(quantizeBucketsForRender([1.001, 2, 100])).toEqual([1, 1, 1]);
  });

  test('boundary values map to expected 8-bit lattice points', () => {
    expect(quantizeBucketsForRender([0])).toEqual([0]);
    expect(quantizeBucketsForRender([1])).toEqual([1]);
    expect(quantizeBucketsForRender([0.5])).toEqual([q8(0.5)]);
  });
});

describe('VOICE-005 quantizeBucketsForRender - parity with VOICE-004 quantize8bit', () => {
  test('shared points match Math.round(x * 255) / 255', () => {
    for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const local = quantizeBucketsForRender([x])[0];
      expect(local).toBe(q8(x));
    }
  });
});

describe('VOICE-005 quantizeBucketsForRender - output structural guarantees', () => {
  test('output is frozen', () => {
    const out = quantizeBucketsForRender([0.5, 0.5]);
    expect(Object.isFrozen(out)).toBe(true);
  });

  test('output length equals input length', () => {
    expect(quantizeBucketsForRender([]).length).toBe(0);
    expect(quantizeBucketsForRender([0]).length).toBe(1);
    expect(quantizeBucketsForRender(new Array(256).fill(0.5)).length).toBe(256);
  });

  test('empty input yields empty frozen output', () => {
    const out = quantizeBucketsForRender([]);
    expect(out).toEqual([]);
    expect(Object.isFrozen(out)).toBe(true);
  });
});
