/**
 * VOICE-004 (issue 662) - unit coverage for the sibling dBFS mapping.
 *
 * Contract table lives in the helper file. Every named boundary case
 * from the design (T-N1..T-N10) is asserted here.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import { normalizeMeteringDbFsToAmplitude } from '../src/features/voice/waveform/normalizeMeteringDbFsToAmplitude';

describe('normalizeMeteringDbFsToAmplitude', () => {
  test('T-N1 -160 dBFS -> 0 (native silence sentinel)', () => {
    expect(normalizeMeteringDbFsToAmplitude(-160)).toBe(0);
  });

  test('T-N2 -60 dBFS -> 0 (silence floor)', () => {
    expect(normalizeMeteringDbFsToAmplitude(-60)).toBe(0);
  });

  test('T-N3 -30 dBFS -> 0.5', () => {
    expect(normalizeMeteringDbFsToAmplitude(-30)).toBeCloseTo(0.5, 10);
  });

  test('T-N4 -6 dBFS -> 0.9', () => {
    expect(normalizeMeteringDbFsToAmplitude(-6)).toBeCloseTo(0.9, 10);
  });

  test('T-N5 0 dBFS -> 1 (clip)', () => {
    expect(normalizeMeteringDbFsToAmplitude(0)).toBe(1);
  });

  test('T-N6 +10 dBFS -> 1 (clamped clip)', () => {
    expect(normalizeMeteringDbFsToAmplitude(10)).toBe(1);
  });

  test('T-N7 NaN -> 0 (non-finite maps to 0)', () => {
    expect(normalizeMeteringDbFsToAmplitude(Number.NaN)).toBe(0);
  });

  test('T-N8 +Infinity -> 0 (non-finite rule beats clip arithmetic)', () => {
    // Load-bearing: without the isFinite guard, (Infinity + 60) / 60 = Infinity
    // and would clamp to 1. The doctrine posture is that any non-finite input
    // maps to 0 - closes the covert-channel where an adapter emitting Infinity
    // would be treated as maximum signal.
    expect(normalizeMeteringDbFsToAmplitude(Number.POSITIVE_INFINITY)).toBe(0);
  });

  test('T-N9 -Infinity -> 0', () => {
    expect(normalizeMeteringDbFsToAmplitude(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  test('T-N10 same input twice yields identical output (determinism)', () => {
    for (const dbfs of [-45, -12.5, -0.1, -60.0001]) {
      const a = normalizeMeteringDbFsToAmplitude(dbfs);
      const b = normalizeMeteringDbFsToAmplitude(dbfs);
      expect(a).toBe(b);
    }
  });

  test('output is always in [0, 1] for a range of inputs', () => {
    const inputs = [
      -1000, -160, -60, -59.9999, -30, -6, -0.0001, 0, 0.0001, 10, 1e100,
      Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
    ];
    for (const dbfs of inputs) {
      const out = normalizeMeteringDbFsToAmplitude(dbfs);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThanOrEqual(1);
    }
  });

  test('monotone increasing between silence floor and clip ceiling', () => {
    // Sample the interior of the mapping and assert monotonicity.
    let prev = normalizeMeteringDbFsToAmplitude(-60);
    for (let dbfs = -59; dbfs <= 0; dbfs += 1) {
      const curr = normalizeMeteringDbFsToAmplitude(dbfs);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});
