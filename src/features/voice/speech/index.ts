/**
 * VOICE-003 (issue 661) - barrel export for the pure-TS speech module.
 *
 * The barrel is the sole public entry point. Consumers import from
 * '@/features/voice/speech'; sibling files are internal. No default
 * export.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

export type {
  SpeechTranscriptArtifact,
  FreshSpeechTranscriptArtifact,
  TerminalStateForArtifact,
} from './speechTranscriptArtifact.types';

export type {
  SpeechSessionState,
  VoiceInputMode,
  SpeechCapabilitySnapshot,
  SpeechErrorCode,
  RecognizerEvent,
  SpeechSessionMachineState,
  SpeechReduceResult,
} from './speechSessionMachine';

export {
  SPEECH_SESSION_MACHINE_VERSION,
  initialSpeechSessionState,
  reduceSpeechSession,
  deriveVoiceInputMode,
} from './speechSessionMachine';

export type { EditedProvenance } from './deriveEditedProvenance';
export { deriveEditedProvenance } from './deriveEditedProvenance';
