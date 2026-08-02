/**
 * VOICE-004 (issue 662) - types for the VoiceWaveformArtifact produced
 * by the pure-TS waveform-session reducer.
 *
 * This file is the SOLE location under src/features/voice/waveform where
 * the string literals stream_pcm and cache_temp_deleted may appear
 * (INV-C4). The reducer implementation must never reference either
 * literal; v1 emits metering_only exclusively. The doctrine guard
 * scans the tree and asserts this placement invariant.
 *
 * Comments are apostrophe-free to keep the doctrine scanner happy.
 *
 * Doctrine: every field carries neutral acoustic-envelope provenance
 * only. The ban list of inference-shaped tokens is enumerated in
 * __tests__/voice004ForbiddenInferenceGuard.test.ts and enforced at
 * build time via INV-C1.
 */

// Terminal states that produce a VoiceWaveformArtifact.
// The unavailable terminal is intentionally absent - unavailable
// yields null, never an artifact (INV-A4).
export type TerminalStateForArtifact =
  | 'finalized'
  | 'aborted'
  | 'no_signal'
  | 'error';

// Reserved audio-source discriminant.
// The v1 reducer produces only metering_only via FreshVoiceWaveformArtifact
// narrowing. The stream_pcm and cache_temp_deleted literals are reserved
// for future adapter paths and must ONLY appear in this file (INV-C4).
export type WaveformAudioSource =
  | 'metering_only'
  | 'stream_pcm'
  | 'cache_temp_deleted';

// Metering-source error codes carried on the error-terminal artifact.
export type WaveformStreamErrorCode =
  | 'metering_lost'
  | 'permission_revoked'
  | 'audio_route_lost'
  | 'native_error';

/**
 * VoiceWaveformArtifact - the immutable record of a completed session.
 *
 * Yielded on the transition into finalized, aborted, no_signal, or
 * error. Never yielded from unavailable. Every field is readonly. The
 * reducer returns Object.freeze-d instances AND separately freezes the
 * inner amplitudeBuckets array (INV-B1).
 *
 * amplitudeBuckets holds a bounded, non-replayable peak-per-bucket
 * amplitude envelope of at most 256 elements, each 8-bit quantized to
 * k / 255 for integer k in [0, 255]. See §4.5 of the design doc for
 * the non-replayability argument.
 */
export interface VoiceWaveformArtifact {
  readonly waveformId: string;
  readonly sessionId: string;
  readonly audioSource: WaveformAudioSource;
  readonly amplitudeBuckets: readonly number[];
  readonly peakLevel: number;
  readonly meanLevel: number;
  readonly sampleCount: number;
  readonly durationMs: number;
  readonly activeDurationMs: number;
  readonly sessionStartedAt: string; // ISO-8601 UTC
  readonly sessionEndedAt: string; // ISO-8601 UTC; >= sessionStartedAt
  readonly terminalState: TerminalStateForArtifact;
  readonly lastErrorCode: WaveformStreamErrorCode | null;
  readonly rawAudioPersisted: false; // literal false - intra-artifact anti-drift
  readonly audioUri: null; // literal null - the client holds no audio reference
  readonly producedByModuleVersion: string; // semver of waveformSessionMachine
}

/**
 * FreshVoiceWaveformArtifact - the branded "just produced" shape.
 *
 * The reducer return type is narrowed to this. The audioSource field
 * is the literal metering_only; rawAudioPersisted is literal false; the
 * audioUri field is literal null (INV-A3, INV-A2, INV-A1). Downstream
 * widening back to VoiceWaveformArtifact is only possible via an
 * explicit adapter step outside the pure reducer.
 */
export type FreshVoiceWaveformArtifact = VoiceWaveformArtifact & {
  readonly audioSource: 'metering_only';
  readonly rawAudioPersisted: false;
  readonly audioUri: null;
};
