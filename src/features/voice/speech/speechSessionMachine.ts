/**
 * VOICE-003 (issue 661) - pure-TS speech-session state machine.
 *
 * A JSON-serializable, side-effect-free reducer over the ten-state x
 * twelve-event grammar. Every cell is either a table-driven transition
 * or an explicit IGNORE (no implicit fallthrough). The reducer yields
 * an immutable SpeechTranscriptArtifact on the four "session actually
 * happened" terminals (final, interrupted, timeout_no_speech, error)
 * and null on the "never offerable" terminal (unavailable).
 *
 * Boundary rules:
 *   - No React, no React Native, no Expo, no native, no Supabase, no
 *     network, no persistence, no UI.
 *   - No Date.now, no new Date, no random. Purity is asserted by tests.
 *   - The submitted body is NOT owned here; it lives in composer draft.
 *   - The freshly-produced artifact carries wasEdited=false / editDistance=0;
 *     a submit-time replacement record widens via deriveEditedProvenance.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import type {
  FreshSpeechTranscriptArtifact,
  TerminalStateForArtifact,
} from './speechTranscriptArtifact.types';

// ---------- State grammar ----------------------------------------------------

export type SpeechSessionState =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'interim'
  | 'finalizing'
  | 'final'
  | 'interrupted'
  | 'timeout_no_speech'
  | 'error'
  | 'unavailable';

// Adapter-facing wider-scope discriminator kept in this module because
// its terminal branch is co-derived from SpeechSessionState. The adapter
// never re-derives it - it calls deriveVoiceInputMode below.
export type VoiceInputMode = 'text_only' | 'speech_active' | 'reviewing_transcript';

// ---------- Capability snapshot handed in at USER_START ---------------------

export interface SpeechCapabilitySnapshot {
  readonly voiceOfferable: boolean;
  readonly recognizer: 'ios' | 'android' | 'web';
  readonly onDeviceRecognition: boolean;
  readonly language: string; // BCP-47
}

// ---------- Error codes -----------------------------------------------------

export type SpeechErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported';

// ---------- Event grammar ---------------------------------------------------

// Adapter-synthesized events use SCREAMING_SNAKE_CASE. Recognizer-forwarded
// events use the lowercase upstream names. audiostart and audioend are NOT
// in this reducer alphabet - waveform coordination belongs to a sibling
// reducer.
export type RecognizerEvent =
  // Adapter-synthesized (user-driven or capability-driven)
  | {
      type: 'USER_START';
      sessionId: string;
      transcriptId: string;
      capability: SpeechCapabilitySnapshot;
      nowIso: string;
    }
  | { type: 'USER_ABORT' }
  | { type: 'USER_RESET' }
  | {
      type: 'AVAILABILITY_LOST';
      reason: 'permission_revoked' | 'service_unreachable' | 'recognizer_disabled';
    }
  // Recognizer-forwarded
  | { type: 'start' }
  | { type: 'speechstart' }
  | { type: 'result_interim'; transcript: string }
  | { type: 'result_final'; transcript: string }
  | { type: 'speechend' }
  | { type: 'end' }
  | { type: 'nomatch' }
  | { type: 'error'; code: SpeechErrorCode };

// ---------- Internal reducer state ------------------------------------------

// Session-local reducer state. Includes fields never exported on the
// artifact (latestInterimText, speechStartFired, lastErrorCode).
export interface SpeechSessionMachineState {
  readonly state: SpeechSessionState;
  readonly sessionId: string | null;
  readonly transcriptId: string | null;
  readonly recognizer: 'ios' | 'android' | 'web' | null;
  readonly onDeviceRecognition: boolean;
  readonly language: string;
  readonly sessionStartedAt: string | null;
  readonly sessionEndedAt: string | null;
  readonly rawTranscript: string;
  readonly latestInterimText: string;
  readonly interimCount: number;
  readonly speechStartFired: boolean;
  readonly hadFinalEvent: boolean;
  readonly lastErrorCode: SpeechErrorCode | null;
  readonly terminalState: TerminalStateForArtifact | null;
}

// Reducer return shape.
export interface SpeechReduceResult {
  readonly nextState: SpeechSessionMachineState;
  readonly producedArtifact: FreshSpeechTranscriptArtifact | null;
}

// ---------- Module version --------------------------------------------------

// The reducer emits this string in every produced artifact. It ratchets
// on any intentional schema-visible change to VOICE-003. Kept as a
// hard-coded constant so the module has no runtime file read.
export const SPEECH_SESSION_MACHINE_VERSION = '1.0.0';

// ---------- Initial state factory -------------------------------------------

export function initialSpeechSessionState(): SpeechSessionMachineState {
  return {
    state: 'idle',
    sessionId: null,
    transcriptId: null,
    recognizer: null,
    onDeviceRecognition: false,
    language: '',
    sessionStartedAt: null,
    sessionEndedAt: null,
    rawTranscript: '',
    latestInterimText: '',
    interimCount: 0,
    speechStartFired: false,
    hadFinalEvent: false,
    lastErrorCode: null,
    terminalState: null,
  };
}

// ---------- Helpers (pure) --------------------------------------------------

// A frozen artifact factory. Every artifact-yielding transition routes
// through here to keep INV-B1 (Object.freeze) and INV-A2/A4 (fresh
// literals) in one place.
function makeArtifact(
  state: SpeechSessionMachineState,
  terminal: TerminalStateForArtifact,
): FreshSpeechTranscriptArtifact {
  // Guard against transitions that reach here without USER_START having
  // initialised session-local fields. Table-driven transitions never
  // yield an artifact from idle, so these are non-null by construction.
  if (
    state.sessionId === null ||
    state.transcriptId === null ||
    state.recognizer === null ||
    state.sessionStartedAt === null
  ) {
    throw new Error('makeArtifact called on uninitialised session state');
  }
  const artifact: FreshSpeechTranscriptArtifact = {
    transcriptId: state.transcriptId,
    sessionId: state.sessionId,
    recognizer: state.recognizer,
    onDeviceRecognition: state.onDeviceRecognition,
    language: state.language,
    sessionStartedAt: state.sessionStartedAt,
    // sessionEndedAt mirrors sessionStartedAt when no event-borne clock
    // is available; the reducer is pure and holds no wall clock. The
    // adapter can widen with a real end time via deriveEditedProvenance
    // downstream. INV-B4 is satisfied by equality.
    sessionEndedAt: state.sessionEndedAt ?? state.sessionStartedAt,
    rawTranscript: state.rawTranscript,
    hadFinalEvent: state.hadFinalEvent,
    interimCount: state.interimCount,
    terminalState: terminal,
    wasEdited: false,
    editDistance: 0,
    audioPersistence: 'none',
    audioUri: null,
    producedByModuleVersion: SPEECH_SESSION_MACHINE_VERSION,
  };
  return Object.freeze(artifact);
}

// Compact transition helpers - each returns a new state plus an artifact
// (or null for non-yielding transitions).

function toFinal(
  state: SpeechSessionMachineState,
  transcript: string,
): SpeechReduceResult {
  const next: SpeechSessionMachineState = {
    ...state,
    state: 'final',
    rawTranscript: transcript,
    hadFinalEvent: true,
    sessionEndedAt: state.sessionStartedAt,
    terminalState: 'final',
  };
  return { nextState: next, producedArtifact: makeArtifact(next, 'final') };
}

function toInterrupted(state: SpeechSessionMachineState): SpeechReduceResult {
  const next: SpeechSessionMachineState = {
    ...state,
    state: 'interrupted',
    sessionEndedAt: state.sessionStartedAt,
    terminalState: 'interrupted',
  };
  return { nextState: next, producedArtifact: makeArtifact(next, 'interrupted') };
}

function toTimeoutNoSpeech(state: SpeechSessionMachineState): SpeechReduceResult {
  const next: SpeechSessionMachineState = {
    ...state,
    state: 'timeout_no_speech',
    sessionEndedAt: state.sessionStartedAt,
    terminalState: 'timeout_no_speech',
  };
  return { nextState: next, producedArtifact: makeArtifact(next, 'timeout_no_speech') };
}

function toError(
  state: SpeechSessionMachineState,
  code: SpeechErrorCode,
): SpeechReduceResult {
  const next: SpeechSessionMachineState = {
    ...state,
    state: 'error',
    sessionEndedAt: state.sessionStartedAt,
    lastErrorCode: code,
    terminalState: 'error',
  };
  return { nextState: next, producedArtifact: makeArtifact(next, 'error') };
}

function toUnavailable(state: SpeechSessionMachineState): SpeechReduceResult {
  const next: SpeechSessionMachineState = {
    ...state,
    state: 'unavailable',
  };
  // unavailable yields no artifact - it records that no session
  // actually happened, so there is nothing to preserve.
  return { nextState: next, producedArtifact: null };
}

function resetToIdle(): SpeechReduceResult {
  return { nextState: initialSpeechSessionState(), producedArtifact: null };
}

// IGNORE returns the SAME state reference so INV-B6 (byte-identical
// no-op) and the blanket-ignore matrix pass Object.is checks across
// every field on the state.
const ignore = (state: SpeechSessionMachineState): SpeechReduceResult => ({
  nextState: state,
  producedArtifact: null,
});

// Dispatch helper for the recognizer error code. Shared by every state
// that accepts an error event.
function dispatchError(
  state: SpeechSessionMachineState,
  code: SpeechErrorCode,
): SpeechReduceResult {
  if (code === 'no-speech') return toTimeoutNoSpeech(state);
  if (code === 'aborted') return toInterrupted(state);
  return toError(state, code);
}

// Shared handler for a non-empty result_final in an active state. Empty
// transcript routes to timeout_no_speech (INV-B9).
function handleResultFinal(
  state: SpeechSessionMachineState,
  transcript: string,
): SpeechReduceResult {
  if (transcript === '') return toTimeoutNoSpeech(state);
  return toFinal(state, transcript);
}

// ---------- Transition table ------------------------------------------------

type TransitionSpec = (
  state: SpeechSessionMachineState,
  event: RecognizerEvent,
) => SpeechReduceResult;

// Every cell is either a transition or a pointer to `ignore`. The
// `satisfies Record<SpeechSessionState, Record<RecognizerEvent['type'],
// TransitionSpec>>` clause makes TypeScript refuse a missing cell at
// build time (INV-A8), so the twelve-event alphabet stays total across
// the ten-state grammar.
const TRANSITIONS = {
  // ---------- idle ---------------------------------------------------------
  idle: {
    USER_START: (state, event) => {
      if (event.type !== 'USER_START') return ignore(state);
      if (!event.capability.voiceOfferable) {
        // Defensive fallthrough - adapter should re-run capability
        // probe before firing USER_START. Reducer refuses without an
        // artifact so the adapter route matches USER_START-from-idle
        // when voiceOfferable becomes true later.
        return toUnavailable(state);
      }
      const next: SpeechSessionMachineState = {
        state: 'starting',
        sessionId: event.sessionId,
        transcriptId: event.transcriptId,
        recognizer: event.capability.recognizer,
        onDeviceRecognition: event.capability.onDeviceRecognition,
        language: event.capability.language,
        sessionStartedAt: event.nowIso,
        sessionEndedAt: null,
        rawTranscript: '',
        latestInterimText: '',
        interimCount: 0,
        speechStartFired: false,
        hadFinalEvent: false,
        lastErrorCode: null,
        terminalState: null,
      };
      return { nextState: next, producedArtifact: null };
    },
    USER_ABORT: ignore,
    USER_RESET: ignore,
    AVAILABILITY_LOST: (state) => toUnavailable(state),
    start: ignore,
    speechstart: ignore,
    result_interim: ignore,
    result_final: ignore,
    speechend: ignore,
    end: ignore,
    nomatch: ignore,
    error: ignore,
  },

  // ---------- starting -----------------------------------------------------
  starting: {
    USER_START: ignore, // INV-B6 self-loop
    USER_ABORT: (state) => toInterrupted(state),
    USER_RESET: ignore,
    AVAILABILITY_LOST: (state) => toUnavailable(state),
    start: (state) => ({ nextState: { ...state, state: 'listening' }, producedArtifact: null }),
    speechstart: (state) => ({
      nextState: { ...state, state: 'listening', speechStartFired: true },
      producedArtifact: null,
    }),
    result_interim: (state, event) => {
      if (event.type !== 'result_interim') return ignore(state);
      return {
        nextState: {
          ...state,
          state: 'interim',
          speechStartFired: true,
          interimCount: 1,
          latestInterimText: event.transcript,
        },
        producedArtifact: null,
      };
    },
    result_final: (state, event) => {
      if (event.type !== 'result_final') return ignore(state);
      return handleResultFinal(state, event.transcript);
    },
    speechend: ignore, // phantom pre-start speechend
    end: (state) => toInterrupted(state),
    nomatch: (state) => toTimeoutNoSpeech(state),
    error: (state, event) => {
      if (event.type !== 'error') return ignore(state);
      return dispatchError(state, event.code);
    },
  },

  // ---------- listening ----------------------------------------------------
  listening: {
    USER_START: ignore, // INV-B6 self-loop
    USER_ABORT: (state) => toInterrupted(state),
    USER_RESET: ignore,
    AVAILABILITY_LOST: (state) => toUnavailable(state),
    start: ignore, // already listening
    speechstart: (state) => ({
      nextState: { ...state, speechStartFired: true },
      producedArtifact: null,
    }),
    result_interim: (state, event) => {
      if (event.type !== 'result_interim') return ignore(state);
      return {
        nextState: {
          ...state,
          state: 'interim',
          speechStartFired: true,
          interimCount: 1,
          latestInterimText: event.transcript,
        },
        producedArtifact: null,
      };
    },
    result_final: (state, event) => {
      if (event.type !== 'result_final') return ignore(state);
      return handleResultFinal(state, event.transcript);
    },
    speechend: (state) => ({
      nextState: { ...state, state: 'finalizing' },
      producedArtifact: null,
    }),
    end: (state) => toTimeoutNoSpeech(state),
    nomatch: (state) => toTimeoutNoSpeech(state),
    error: (state, event) => {
      if (event.type !== 'error') return ignore(state);
      return dispatchError(state, event.code);
    },
  },

  // ---------- interim ------------------------------------------------------
  interim: {
    USER_START: ignore, // INV-B6 self-loop
    USER_ABORT: (state) => toInterrupted(state), // interim never becomes body
    USER_RESET: ignore,
    AVAILABILITY_LOST: (state) => toUnavailable(state),
    start: ignore,
    speechstart: (state) => ({
      nextState: { ...state, speechStartFired: true },
      producedArtifact: null,
    }),
    result_interim: (state, event) => {
      if (event.type !== 'result_interim') return ignore(state);
      return {
        nextState: {
          ...state,
          interimCount: state.interimCount + 1,
          latestInterimText: event.transcript,
        },
        producedArtifact: null,
      };
    },
    result_final: (state, event) => {
      if (event.type !== 'result_final') return ignore(state);
      return handleResultFinal(state, event.transcript);
    },
    speechend: (state) => ({
      nextState: { ...state, state: 'finalizing' },
      producedArtifact: null,
    }),
    end: (state) => toTimeoutNoSpeech(state), // INV-6 no auto-promote of interim
    nomatch: (state) => toTimeoutNoSpeech(state),
    error: (state, event) => {
      if (event.type !== 'error') return ignore(state);
      return dispatchError(state, event.code);
    },
  },

  // ---------- finalizing ---------------------------------------------------
  finalizing: {
    USER_START: ignore, // INV-B6 self-loop
    USER_ABORT: (state) => toInterrupted(state),
    USER_RESET: ignore,
    AVAILABILITY_LOST: (state) => toUnavailable(state),
    start: ignore,
    speechstart: ignore, // pre-final speechstart is odd but harmless
    result_interim: ignore, // INV-21 - spurious late interim is dropped
    result_final: (state, event) => {
      if (event.type !== 'result_final') return ignore(state);
      return handleResultFinal(state, event.transcript);
    },
    speechend: ignore, // idempotent repeated speechend
    end: (state) => toTimeoutNoSpeech(state),
    nomatch: (state) => toTimeoutNoSpeech(state),
    error: (state, event) => {
      if (event.type !== 'error') return ignore(state);
      return dispatchError(state, event.code);
    },
  },

  // ---------- final (terminal, artifact already yielded) -------------------
  final: {
    USER_START: ignore,
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore, // first terminal wins
    start: ignore,
    speechstart: ignore,
    result_interim: ignore,
    result_final: ignore,
    speechend: ignore,
    end: ignore,
    nomatch: ignore,
    error: ignore, // late error does NOT retract the yielded artifact
  },

  // ---------- interrupted (terminal) ---------------------------------------
  interrupted: {
    USER_START: ignore,
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore,
    start: ignore,
    speechstart: ignore,
    result_interim: ignore,
    result_final: ignore,
    speechend: ignore,
    end: ignore,
    nomatch: ignore,
    error: ignore, // defensively no-op the coincident error{aborted}
  },

  // ---------- timeout_no_speech (terminal) ---------------------------------
  timeout_no_speech: {
    USER_START: ignore,
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore,
    start: ignore,
    speechstart: ignore,
    result_interim: ignore,
    result_final: ignore,
    speechend: ignore,
    end: ignore,
    nomatch: ignore,
    error: ignore,
  },

  // ---------- error (terminal) ---------------------------------------------
  error: {
    USER_START: ignore,
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore,
    start: ignore,
    speechstart: ignore,
    result_interim: ignore,
    result_final: ignore,
    speechend: ignore,
    end: ignore,
    nomatch: ignore,
    error: ignore,
  },

  // ---------- unavailable (terminal, no artifact) --------------------------
  unavailable: {
    USER_START: ignore, // adapter must USER_RESET and re-probe first
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore,
    start: ignore,
    speechstart: ignore,
    result_interim: ignore,
    result_final: ignore,
    speechend: ignore,
    end: ignore,
    nomatch: ignore,
    error: ignore,
  },
} satisfies Record<SpeechSessionState, Record<RecognizerEvent['type'], TransitionSpec>>;

// ---------- Public reducer --------------------------------------------------

export function reduceSpeechSession(
  state: SpeechSessionMachineState,
  event: RecognizerEvent,
): SpeechReduceResult {
  const row = TRANSITIONS[state.state] as Record<string, TransitionSpec>;
  return row[event.type](state, event);
}

// ---------- Adapter-facing derivation ---------------------------------------

/**
 * Projects the session state and an "artifact already submitted?" flag to
 * the wider adapter-owned VoiceInputMode. Not a second state machine -
 * a pure projection with a total switch over SpeechSessionState.
 *
 *   - Active states (starting/listening/interim/finalizing) -> speech_active
 *   - final AND not submitted                              -> reviewing_transcript
 *   - all other terminals and idle                         -> text_only
 */
export function deriveVoiceInputMode(
  sessionState: SpeechSessionState,
  artifactSubmitted: boolean,
): VoiceInputMode {
  switch (sessionState) {
    case 'starting':
    case 'listening':
    case 'interim':
    case 'finalizing':
      return 'speech_active';
    case 'final':
      return artifactSubmitted ? 'text_only' : 'reviewing_transcript';
    case 'idle':
    case 'interrupted':
    case 'timeout_no_speech':
    case 'error':
    case 'unavailable':
      return 'text_only';
  }
}
