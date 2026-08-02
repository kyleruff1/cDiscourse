/**
 * VOICE-004 (issue 662) - post-artifact projection helper.
 *
 * A pure post-artifact projection with no side effects. Given a produced
 * VoiceWaveformArtifact, returns a compact summary suitable for display
 * layers and MCP Family K aggregation.
 *
 * The projection is a MANY-TO-ONE compression of the artifact: several
 * distinct artifacts can map to the same summary. That is intentional -
 * the summary is a lossy display projection, not a re-derivation surface.
 *
 * isDegenerate is true when the terminal state is anything other than
 * finalized OR when sampleCount is below the reducer minimum (3). The
 * adapter routes degenerate summaries through gameCopy.toPlainLanguage
 * to explain to the user why no waveform rendered.
 *
 * The silence value and finalized-minimum are baked in here as anonymous
 * literals (0.02 and 3). They intentionally do NOT re-import the reducer
 * constants because INV-C5 requires those named symbols appear only in
 * the reducer module and the barrel. A separate parity test asserts
 * these anonymous literals match the reducer constants at build time.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import type { VoiceWaveformArtifact } from './voiceWaveformArtifact.types';

export interface WaveformSummary {
  readonly peakLevel: number;
  readonly meanLevel: number;
  readonly activeDurationMs: number;
  readonly silentBucketRatio: number;
  readonly isDegenerate: boolean;
}

export function deriveWaveformSummary(
  artifact: VoiceWaveformArtifact,
): WaveformSummary {
  const buckets = artifact.amplitudeBuckets;
  const len = buckets.length;

  let localPeak = 0;
  let sum = 0;
  let silent = 0;
  for (let i = 0; i < len; i += 1) {
    const b = buckets[i];
    if (b > localPeak) localPeak = b;
    sum += b;
    // Anonymous silence baseline (0.02) - matches the reducer constant.
    if (b < 0.02) silent += 1;
  }

  const peakLevel = len > 0 ? localPeak : 0;
  const meanLevel = len > 0 ? sum / len : 0;
  const silentBucketRatio = len > 0 ? silent / len : 0;

  // Anonymous finalized-minimum (3) - matches the reducer constant.
  const isDegenerate =
    artifact.terminalState !== 'finalized' || artifact.sampleCount < 3;

  return {
    peakLevel,
    meanLevel,
    activeDurationMs: artifact.activeDurationMs,
    silentBucketRatio,
    isDegenerate,
  };
}
