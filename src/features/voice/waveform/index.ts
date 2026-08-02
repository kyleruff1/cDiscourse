/**
 * VOICE-004 (issue 662) - barrel export for the pure-TS waveform module.
 *
 * The barrel is the sole public entry point. Consumers import from
 * @/features/voice/waveform; sibling files are internal. No default
 * export.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

export type {
  VoiceWaveformArtifact,
  FreshVoiceWaveformArtifact,
  TerminalStateForArtifact,
  WaveformAudioSource,
  WaveformStreamErrorCode,
} from './voiceWaveformArtifact.types';

export type {
  WaveformSessionState,
  WaveformSessionMachineState,
  WaveformEvent,
  WaveformCapabilitySnapshot,
  WaveformReduceResult,
} from './waveformSessionMachine';

export {
  MAX_AMPLITUDE_BUCKETS,
  SILENCE_THRESHOLD,
  MIN_SAMPLES_FOR_FINALIZED,
  VOICE_WAVEFORM_MACHINE_VERSION,
  reduceWaveformSession,
  initialWaveformSessionState,
} from './waveformSessionMachine';

export type { WaveformSummary } from './deriveWaveformSummary';
export { deriveWaveformSummary } from './deriveWaveformSummary';

export { normalizeMeteringDbFsToAmplitude } from './normalizeMeteringDbFsToAmplitude';
