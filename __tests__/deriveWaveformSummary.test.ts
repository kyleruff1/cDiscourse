/**
 * VOICE-004 (issue 662) - unit coverage for the sibling post-artifact
 * projection helper.
 *
 * Every named case (T-D1..T-D7) plus a small property block asserting
 * the projection is pure (same input twice yields the same output).
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import { deriveWaveformSummary } from '../src/features/voice/waveform/deriveWaveformSummary';
import type { VoiceWaveformArtifact } from '../src/features/voice/waveform/voiceWaveformArtifact.types';

function buildArtifact(overrides: Partial<VoiceWaveformArtifact>): VoiceWaveformArtifact {
  const base: VoiceWaveformArtifact = {
    waveformId: 'wf-1',
    sessionId: 'sess-1',
    audioSource: 'metering_only',
    amplitudeBuckets: [],
    peakLevel: 0,
    meanLevel: 0,
    sampleCount: 0,
    durationMs: 0,
    activeDurationMs: 0,
    sessionStartedAt: '2026-08-01T00:00:00.000Z',
    sessionEndedAt: '2026-08-01T00:00:00.000Z',
    terminalState: 'finalized',
    lastErrorCode: null,
    rawAudioPersisted: false,
    audioUri: null,
    producedByModuleVersion: '1.0.0',
  };
  return { ...base, ...overrides };
}

describe('deriveWaveformSummary', () => {
  test('T-D1 non-degenerate finalized artifact with 10 buckets', () => {
    const buckets = [0.1, 0.3, 0.5, 0.7, 0.9, 0.7, 0.5, 0.3, 0.1, 0.05];
    const art = buildArtifact({
      amplitudeBuckets: buckets,
      sampleCount: 10,
      activeDurationMs: 800,
    });
    const s = deriveWaveformSummary(art);
    expect(s.peakLevel).toBe(0.9);
    const expectedMean = buckets.reduce((a, b) => a + b, 0) / buckets.length;
    expect(s.meanLevel).toBeCloseTo(expectedMean, 10);
    expect(s.activeDurationMs).toBe(800);
    // silence baseline 0.02 - only the last 0.05 crosses it... actually 0.05 > 0.02.
    // Every bucket sits above the baseline, so silentBucketRatio is 0.
    expect(s.silentBucketRatio).toBe(0);
    expect(s.isDegenerate).toBe(false);
  });

  test('T-D2 zero-bucket no_signal artifact', () => {
    const art = buildArtifact({
      terminalState: 'no_signal',
      amplitudeBuckets: [],
      sampleCount: 0,
    });
    const s = deriveWaveformSummary(art);
    expect(s.peakLevel).toBe(0);
    expect(s.meanLevel).toBe(0);
    expect(s.silentBucketRatio).toBe(0);
    expect(s.isDegenerate).toBe(true);
  });

  test('T-D3 finalized artifact with sampleCount 2 is defensively degenerate', () => {
    const art = buildArtifact({
      terminalState: 'finalized',
      amplitudeBuckets: [0.4, 0.6],
      sampleCount: 2,
    });
    const s = deriveWaveformSummary(art);
    expect(s.isDegenerate).toBe(true);
  });

  test('T-D4 all-silent buckets - silentBucketRatio = 1', () => {
    const buckets = new Array(20).fill(0.01);
    const art = buildArtifact({
      terminalState: 'finalized',
      amplitudeBuckets: buckets,
      sampleCount: 20,
    });
    const s = deriveWaveformSummary(art);
    expect(s.silentBucketRatio).toBe(1);
    expect(s.peakLevel).toBe(0.01);
    expect(s.meanLevel).toBeCloseTo(0.01, 10);
    expect(s.isDegenerate).toBe(false);
  });

  test('T-D5 aborted artifact with 100 buckets is degenerate regardless of sampleCount', () => {
    const buckets = new Array(100).fill(0).map((_, i) => i / 100);
    const art = buildArtifact({
      terminalState: 'aborted',
      amplitudeBuckets: buckets,
      sampleCount: 100,
    });
    const s = deriveWaveformSummary(art);
    expect(s.isDegenerate).toBe(true);
    expect(s.peakLevel).toBe(0.99);
  });

  test('T-D6 error artifact is degenerate', () => {
    const art = buildArtifact({
      terminalState: 'error',
      amplitudeBuckets: [0.5, 0.6, 0.7],
      sampleCount: 3,
      lastErrorCode: 'metering_lost',
    });
    const s = deriveWaveformSummary(art);
    expect(s.isDegenerate).toBe(true);
  });

  test('T-D7 pure function - two calls deep-equal', () => {
    const buckets = [0.2, 0.4, 0.6, 0.4, 0.2];
    const art = buildArtifact({
      amplitudeBuckets: buckets,
      sampleCount: 5,
      activeDurationMs: 400,
    });
    const a = deriveWaveformSummary(art);
    const b = deriveWaveformSummary(art);
    expect(b).toEqual(a);
    // And the artifact must not be mutated by the projection.
    expect(art.amplitudeBuckets).toEqual(buckets);
  });

  test('mixed silent + active buckets - silentBucketRatio between 0 and 1', () => {
    const buckets = [0.5, 0.01, 0.01, 0.5, 0.5, 0.01];
    const art = buildArtifact({
      terminalState: 'finalized',
      amplitudeBuckets: buckets,
      sampleCount: 6,
    });
    const s = deriveWaveformSummary(art);
    expect(s.silentBucketRatio).toBeCloseTo(3 / 6, 10);
  });

  test('projection returns a NEW object each call (no cached reference leak)', () => {
    const art = buildArtifact({
      amplitudeBuckets: [0.3, 0.4, 0.5],
      sampleCount: 3,
    });
    const a = deriveWaveformSummary(art);
    const b = deriveWaveformSummary(art);
    // Deep-equal but not reference-equal.
    expect(b).toEqual(a);
    expect(b).not.toBe(a);
  });
});
