/**
 * VOICE-003 (issue 661) - types for the SpeechTranscriptArtifact
 * produced by the pure-TS speech-session reducer.
 *
 * This file is the SOLE location under src/features/voice/** where
 * the string literal 'scoped_governed' may appear (INV-C3). The
 * reducer implementation must never reference it. Live enforcement
 * lives in __tests__/voice003ForbiddenInferenceGuard.test.ts.
 *
 * Comments are apostrophe-free to keep the doctrine scanner happy.
 *
 * Doctrine: every field carries neutral recognizer provenance only.
 * The full ban list of inference-shaped tokens is enumerated in
 * __tests__/voice003ForbiddenInferenceGuard.test.ts and enforced at
 * build time via INV-C1.
 */

// Terminal states that produce a SpeechTranscriptArtifact.
// The 'unavailable' terminal is intentionally absent - unavailable
// yields null, never an artifact (INV-A3).
export type TerminalStateForArtifact =
  | 'final'
  | 'interrupted'
  | 'timeout_no_speech'
  | 'error';

/**
 * SpeechTranscriptArtifact - the immutable record of a completed session.
 *
 * Yielded on the transition into 'final', 'interrupted', 'timeout_no_speech',
 * or 'error'. Never yielded from 'unavailable'. Every field is readonly.
 * The reducer returns Object.freeze-d instances (INV-B1).
 *
 * The submitted body is NOT a field on this artifact. It lives in the
 * composer draft; wasEdited and editDistance are derived at submit time
 * by deriveEditedProvenance(artifact, draft.body).
 */
export interface SpeechTranscriptArtifact {
  readonly transcriptId: string;
  readonly sessionId: string;
  readonly recognizer: 'ios' | 'android' | 'web';
  readonly onDeviceRecognition: boolean;
  readonly language: string; // BCP-47
  readonly sessionStartedAt: string; // ISO-8601 UTC
  readonly sessionEndedAt: string; // ISO-8601 UTC; >= sessionStartedAt
  readonly rawTranscript: string; // empty iff hadFinalEvent === false
  readonly hadFinalEvent: boolean;
  readonly interimCount: number; // integer >= 0
  readonly terminalState: TerminalStateForArtifact;
  readonly wasEdited: boolean; // freshly produced: literal false
  readonly editDistance: number; // freshly produced: literal 0
  readonly audioPersistence: 'none' | 'scoped_governed'; // v1 reducer emits 'none'
  readonly audioUri: null; // literal null - the client holds no audio reference
  readonly producedByModuleVersion: string; // semver of speechSessionMachine
}

/**
 * FreshSpeechTranscriptArtifact - the branded "just produced" shape.
 *
 * The reducer return type is narrowed to this. wasEdited, editDistance,
 * and audioPersistence are literal types so TS refuses a produced artifact
 * carrying the wrong shape (INV-A2, INV-A4). A submit-time replacement
 * record widens back to SpeechTranscriptArtifact.
 */
export type FreshSpeechTranscriptArtifact = SpeechTranscriptArtifact & {
  readonly wasEdited: false;
  readonly editDistance: 0;
  readonly audioPersistence: 'none';
};
