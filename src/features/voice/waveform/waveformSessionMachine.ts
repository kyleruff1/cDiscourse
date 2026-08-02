/**
 * VOICE-004 (issue 662) - pure-TS waveform-session state machine.
 *
 * A JSON-serializable, side-effect-free reducer over an 8-state x
 * 8-event grammar (64 cells). Every cell is either a table-driven
 * transition or an explicit IGNORE (no implicit fallthrough). The
 * reducer yields an immutable FreshVoiceWaveformArtifact on the four
 * "session actually happened" terminals (finalized, aborted, no_signal,
 * error) and null on the "never offerable" terminal (unavailable).
 *
 * Boundary rules:
 *   - No React, no React Native, no Expo, no native, no Supabase, no
 *     network, no persistence, no UI.
 *   - No Date.now, no Math.random, no crypto. Purity is asserted by tests.
 *   - The reducer accepts only [0,1] amplitude input; INV-B3 clamps
 *     non-finite and out-of-range values defensively.
 *   - The bucket fold is Math.max (peak-per-bucket, associative in
 *     IEEE-754). Pair-averaging is intentionally not used because it
 *     monotonically decays peaks after each halving and is not
 *     associative in floats.
 *   - Bucket assignment is INDEX-driven, not timestamp-driven. This
 *     closes the rate-carrier steganographic channel.
 *   - 8-bit quantization runs on every bucket at terminal fold.
 *     Caps total artifact bucket entropy at 256 x 8 = 2048 bits.
 *   - The mean accumulator is integer-scaled so the terminal mean is
 *     bit-exact across V8, JSC, and Hermes.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import type {
  FreshVoiceWaveformArtifact,
  TerminalStateForArtifact,
  WaveformStreamErrorCode,
} from './voiceWaveformArtifact.types';

// ---------- State grammar ----------------------------------------------------

export type WaveformSessionState =
  | 'idle'
  | 'accumulating'
  | 'finalizing'
  | 'finalized'
  | 'aborted'
  | 'no_signal'
  | 'error'
  | 'unavailable';

// Re-export for consumers that want the terminal discriminant.
export type { TerminalStateForArtifact, WaveformStreamErrorCode };

// ---------- Capability snapshot handed in at USER_START ---------------------

export interface WaveformCapabilitySnapshot {
  readonly waveformOfferable: boolean;
  readonly meteringSupported: boolean;
}

// ---------- Event grammar ---------------------------------------------------

// Adapter-synthesized user-driven events use SCREAMING_SNAKE_CASE.
// Adapter-forwarded metering events use lowercase upstream names.
export type WaveformEvent =
  | {
      type: 'USER_START';
      sessionId: string;
      waveformId: string;
      capability: WaveformCapabilitySnapshot;
      audioSource: 'metering_only';
      nowIso: string;
    }
  | { type: 'USER_ABORT' }
  | { type: 'USER_RESET' }
  | {
      type: 'AVAILABILITY_LOST';
      reason: 'permission_revoked' | 'metering_disabled' | 'audio_session_lost';
    }
  | { type: 'stream_start' }
  | { type: 'level_sample'; normalizedLevel: number; sourceTimestampMs: number }
  | { type: 'stream_end' }
  | { type: 'stream_error'; code: WaveformStreamErrorCode };

// ---------- Module constants ------------------------------------------------

export const MAX_AMPLITUDE_BUCKETS = 256;
export const SILENCE_THRESHOLD = 0.02;
export const MIN_SAMPLES_FOR_FINALIZED = 3;
export const VOICE_WAVEFORM_MACHINE_VERSION = '1.0.0';

// Internal integer scale for mean accumulation. 65535 * 60s * 1000 Hz =
// 3.93e9 which is well inside the safe-integer domain of 2^53. Division
// happens only at terminal fold so the accumulator stays integer for
// the whole session.
const MEAN_ACCUM_SCALE = 65535;

// ---------- Internal reducer state ------------------------------------------

// Session-local reducer state. Includes fields never exported on the
// artifact (bucketWidth, samplesInCurrentBucket, meanSumIntScaled,
// activeFrameCount, firstSampleTsMs, lastSampleTsMs, streamStartFired).
export interface WaveformSessionMachineState {
  readonly state: WaveformSessionState;
  readonly sessionId: string | null;
  readonly waveformId: string | null;
  readonly audioSourceInternal: 'metering_only' | null;
  readonly sessionStartedAt: string | null;
  readonly sessionEndedAt: string | null;
  readonly amplitudeBuckets: readonly number[];
  readonly bucketWidth: number;
  readonly samplesInCurrentBucket: number;
  readonly sampleCount: number;
  readonly peakLevel: number;
  readonly meanSumIntScaled: number;
  readonly activeFrameCount: number;
  readonly firstSampleTsMs: number | null;
  readonly lastSampleTsMs: number | null;
  readonly streamStartFired: boolean;
  readonly lastErrorCode: WaveformStreamErrorCode | null;
  readonly terminalState: TerminalStateForArtifact | null;
}

// Reducer return shape (co-derived state + optional artifact).
export interface WaveformReduceResult {
  readonly nextState: WaveformSessionMachineState;
  readonly producedArtifact: FreshVoiceWaveformArtifact | null;
}

// ---------- Initial state factory -------------------------------------------

export function initialWaveformSessionState(): WaveformSessionMachineState {
  return {
    state: 'idle',
    sessionId: null,
    waveformId: null,
    audioSourceInternal: null,
    sessionStartedAt: null,
    sessionEndedAt: null,
    amplitudeBuckets: [],
    bucketWidth: 1,
    samplesInCurrentBucket: 0,
    sampleCount: 0,
    peakLevel: 0,
    meanSumIntScaled: 0,
    activeFrameCount: 0,
    firstSampleTsMs: null,
    lastSampleTsMs: null,
    streamStartFired: false,
    lastErrorCode: null,
    terminalState: null,
  };
}

// ---------- Helpers (pure) --------------------------------------------------

// Clamp a raw metering value to [0, 1]. Non-finite (NaN, +Inf, -Inf)
// maps to 0, not 1 - an adversary or bug injecting non-finite MUST
// NOT be silently treated as a peak. Negative maps to 0. Above 1
// clamps to 1.
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

// Quantize a bucket value to 8-bit precision (INV-B11). Idempotent -
// a second pass yields byte-identical output. Bounds per-bucket
// entropy at 8 bits.
function quantize8bit(x: number): number {
  return Math.round(x * 255) / 255;
}

// Halve the bucket array via pair-max. Pair-max is bit-exact and
// order-independent in IEEE-754. Length must be even (called only
// when the ring is full at 256).
function halveBucketsPairMax(buckets: readonly number[]): number[] {
  const halved = new Array<number>(buckets.length >>> 1);
  for (let i = 0; i < halved.length; i += 1) {
    const a = buckets[i * 2];
    const b = buckets[i * 2 + 1];
    halved[i] = a >= b ? a : b;
  }
  return halved;
}

// Append a raw metering value to the fold state. Returns the mutated
// bucket array (new instance) plus the new bucketWidth and
// samplesInCurrentBucket. Bucket assignment is INDEX-driven - no
// dependency on sourceTimestampMs.
function foldSampleIntoBuckets(
  buckets: readonly number[],
  bucketWidth: number,
  samplesInCurrentBucket: number,
  clamped: number,
): {
  buckets: number[];
  bucketWidth: number;
  samplesInCurrentBucket: number;
} {
  // Case 1: current tail bucket has room - fold via pair-max.
  if (buckets.length > 0 && samplesInCurrentBucket < bucketWidth) {
    const last = buckets.length - 1;
    const nextBuckets = buckets.slice();
    const existing = nextBuckets[last];
    nextBuckets[last] = existing >= clamped ? existing : clamped;
    return {
      buckets: nextBuckets,
      bucketWidth,
      samplesInCurrentBucket: samplesInCurrentBucket + 1,
    };
  }
  // Case 2: room for a new bucket - append.
  if (buckets.length < MAX_AMPLITUDE_BUCKETS) {
    const nextBuckets = buckets.slice();
    nextBuckets.push(clamped);
    return {
      buckets: nextBuckets,
      bucketWidth,
      samplesInCurrentBucket: 1,
    };
  }
  // Case 3: array is full at MAX_AMPLITUDE_BUCKETS and the tail is
  // full - halve, double bucketWidth, append the new sample.
  const halved = halveBucketsPairMax(buckets);
  halved.push(clamped);
  return {
    buckets: halved,
    bucketWidth: bucketWidth * 2,
    samplesInCurrentBucket: 1,
  };
}

// Add a whole-ms delta to an ISO-8601 UTC timestamp. Pure - never
// consults the wall clock. Uses Date.UTC to convert (y,mo,d,h,m,s,ms)
// to ms since epoch and new Date(numericMs).toISOString() to render
// back. Both operations are deterministic and depend only on inputs.
function addWholeMillisecondsToIso(iso: string, msToAdd: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(iso);
  if (m === null) return iso;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const mn = parseInt(m[5], 10);
  const s = parseInt(m[6], 10);
  const ms = parseInt(m[7], 10);
  const baseMs = Date.UTC(y, mo - 1, d, h, mn, s, ms);
  const totalMs = baseMs + Math.max(0, Math.floor(msToAdd));
  // new Date(numericMs) is a pure string parse - it does NOT consult
  // the system clock. Only new Date() with no arguments reads the wall
  // clock. This call is deterministic and depends only on totalMs.
  return new Date(totalMs).toISOString();
}

// Build the frozen artifact. Centralized so INV-B1 (freeze the artifact
// AND the inner buckets array) is enforced in one place. All quantization
// and terminal derivations happen here so a state-machine transition
// that yields an artifact does not have to re-derive them.
function makeArtifact(
  state: WaveformSessionMachineState,
  terminal: TerminalStateForArtifact,
  lastErrorCode: WaveformStreamErrorCode | null,
): FreshVoiceWaveformArtifact {
  if (
    state.sessionId === null ||
    state.waveformId === null ||
    state.sessionStartedAt === null ||
    state.audioSourceInternal !== 'metering_only'
  ) {
    throw new Error('makeArtifact called on uninitialised session state');
  }

  // 8-bit quantization (INV-B11). Idempotent.
  const quantizedBuckets = state.amplitudeBuckets.map(quantize8bit);
  const frozenBuckets = Object.freeze(quantizedBuckets);

  // Runtime bound check (INV-B4).
  if (frozenBuckets.length > MAX_AMPLITUDE_BUCKETS) {
    throw new Error('amplitudeBuckets exceeded MAX_AMPLITUDE_BUCKETS');
  }

  // Wall-clock and above-threshold derivations at terminal fold.
  let durationMs = 0;
  if (
    state.sampleCount >= 2 &&
    state.firstSampleTsMs !== null &&
    state.lastSampleTsMs !== null &&
    state.lastSampleTsMs >= state.firstSampleTsMs
  ) {
    durationMs = state.lastSampleTsMs - state.firstSampleTsMs;
  }

  const activeDurationMs =
    state.sampleCount > 0
      ? Math.round((state.activeFrameCount / state.sampleCount) * durationMs)
      : 0;

  const meanLevel =
    state.sampleCount > 0
      ? state.meanSumIntScaled / state.sampleCount / MEAN_ACCUM_SCALE
      : 0;

  const sessionEndedAt = addWholeMillisecondsToIso(
    state.sessionStartedAt,
    durationMs,
  );

  const artifact: FreshVoiceWaveformArtifact = {
    waveformId: state.waveformId,
    sessionId: state.sessionId,
    audioSource: 'metering_only',
    amplitudeBuckets: frozenBuckets,
    peakLevel: state.peakLevel,
    meanLevel,
    sampleCount: state.sampleCount,
    durationMs,
    activeDurationMs,
    sessionStartedAt: state.sessionStartedAt,
    sessionEndedAt,
    terminalState: terminal,
    lastErrorCode,
    rawAudioPersisted: false,
    audioUri: null,
    producedByModuleVersion: VOICE_WAVEFORM_MACHINE_VERSION,
  };

  return Object.freeze(artifact);
}

// Compact transition helpers. Each returns a new state plus an artifact
// (or null for non-yielding transitions).

function toFinalized(state: WaveformSessionMachineState): WaveformReduceResult {
  const next: WaveformSessionMachineState = {
    ...state,
    state: 'finalized',
    terminalState: 'finalized',
    sessionEndedAt: state.sessionStartedAt,
  };
  return {
    nextState: next,
    producedArtifact: makeArtifact(next, 'finalized', null),
  };
}

function toNoSignal(state: WaveformSessionMachineState): WaveformReduceResult {
  const next: WaveformSessionMachineState = {
    ...state,
    state: 'no_signal',
    terminalState: 'no_signal',
    sessionEndedAt: state.sessionStartedAt,
  };
  return {
    nextState: next,
    producedArtifact: makeArtifact(next, 'no_signal', null),
  };
}

function toAborted(state: WaveformSessionMachineState): WaveformReduceResult {
  const next: WaveformSessionMachineState = {
    ...state,
    state: 'aborted',
    terminalState: 'aborted',
    sessionEndedAt: state.sessionStartedAt,
  };
  return {
    nextState: next,
    producedArtifact: makeArtifact(next, 'aborted', null),
  };
}

function toError(
  state: WaveformSessionMachineState,
  code: WaveformStreamErrorCode,
): WaveformReduceResult {
  const next: WaveformSessionMachineState = {
    ...state,
    state: 'error',
    terminalState: 'error',
    lastErrorCode: code,
    sessionEndedAt: state.sessionStartedAt,
  };
  return {
    nextState: next,
    producedArtifact: makeArtifact(next, 'error', code),
  };
}

function toUnavailable(state: WaveformSessionMachineState): WaveformReduceResult {
  const next: WaveformSessionMachineState = {
    ...state,
    state: 'unavailable',
  };
  return { nextState: next, producedArtifact: null };
}

function resetToIdle(): WaveformReduceResult {
  return { nextState: initialWaveformSessionState(), producedArtifact: null };
}

// IGNORE returns the SAME state reference so INV-B6 (byte-identical
// no-op) and the blanket-ignore matrix pass Object.is checks across
// every field.
const ignore = (state: WaveformSessionMachineState): WaveformReduceResult => ({
  nextState: state,
  producedArtifact: null,
});

// Handle stream_end from finalizing per MIN_SAMPLES_FOR_FINALIZED.
function terminateOnStreamEnd(
  state: WaveformSessionMachineState,
): WaveformReduceResult {
  if (state.sampleCount >= MIN_SAMPLES_FOR_FINALIZED) {
    return toFinalized(state);
  }
  return toNoSignal(state);
}

// Fold a level_sample event into the accumulating state.
function applyLevelSample(
  state: WaveformSessionMachineState,
  event: Extract<WaveformEvent, { type: 'level_sample' }>,
): WaveformReduceResult {
  const clamped = clamp01(event.normalizedLevel);

  const nextPeak = state.peakLevel >= clamped ? state.peakLevel : clamped;
  const nextMeanAccum =
    state.meanSumIntScaled + Math.round(clamped * MEAN_ACCUM_SCALE);
  const nextSampleCount = state.sampleCount + 1;
  const nextActiveCount =
    clamped >= SILENCE_THRESHOLD ? state.activeFrameCount + 1 : state.activeFrameCount;
  const nextFirstTs =
    state.firstSampleTsMs === null ? event.sourceTimestampMs : state.firstSampleTsMs;
  const nextLastTs = event.sourceTimestampMs;

  const fold = foldSampleIntoBuckets(
    state.amplitudeBuckets,
    state.bucketWidth,
    state.samplesInCurrentBucket,
    clamped,
  );

  const next: WaveformSessionMachineState = {
    ...state,
    amplitudeBuckets: fold.buckets,
    bucketWidth: fold.bucketWidth,
    samplesInCurrentBucket: fold.samplesInCurrentBucket,
    sampleCount: nextSampleCount,
    peakLevel: nextPeak,
    meanSumIntScaled: nextMeanAccum,
    activeFrameCount: nextActiveCount,
    firstSampleTsMs: nextFirstTs,
    lastSampleTsMs: nextLastTs,
  };

  return { nextState: next, producedArtifact: null };
}

// ---------- Transition table ------------------------------------------------

type TransitionSpec = (
  state: WaveformSessionMachineState,
  event: WaveformEvent,
) => WaveformReduceResult;

// Every cell is either a transition or a pointer to ignore. The
// satisfies clause below makes TypeScript refuse a missing cell at
// build time (INV-A9), so the 8-event alphabet stays total across the
// 8-state grammar (64 cells).
const TRANSITIONS = {
  // ---------- idle ---------------------------------------------------------
  idle: {
    USER_START: (state, event) => {
      if (event.type !== 'USER_START') return ignore(state);
      if (
        !event.capability.waveformOfferable ||
        !event.capability.meteringSupported
      ) {
        return toUnavailable(state);
      }
      const next: WaveformSessionMachineState = {
        state: 'accumulating',
        sessionId: event.sessionId,
        waveformId: event.waveformId,
        audioSourceInternal: 'metering_only',
        sessionStartedAt: event.nowIso,
        sessionEndedAt: null,
        amplitudeBuckets: [],
        bucketWidth: 1,
        samplesInCurrentBucket: 0,
        sampleCount: 0,
        peakLevel: 0,
        meanSumIntScaled: 0,
        activeFrameCount: 0,
        firstSampleTsMs: null,
        lastSampleTsMs: null,
        streamStartFired: false,
        lastErrorCode: null,
        terminalState: null,
      };
      return { nextState: next, producedArtifact: null };
    },
    USER_ABORT: ignore,
    USER_RESET: ignore,
    AVAILABILITY_LOST: (state) => toUnavailable(state),
    stream_start: ignore,
    level_sample: ignore,
    stream_end: ignore,
    stream_error: ignore,
  },

  // ---------- accumulating -------------------------------------------------
  accumulating: {
    USER_START: ignore, // INV-B6 self-loop
    USER_ABORT: (state) => toAborted(state),
    USER_RESET: ignore,
    AVAILABILITY_LOST: (state) => toUnavailable(state),
    stream_start: (state) => ({
      nextState: { ...state, streamStartFired: true },
      producedArtifact: null,
    }),
    level_sample: (state, event) => {
      if (event.type !== 'level_sample') return ignore(state);
      return applyLevelSample(state, event);
    },
    // stream_end from accumulating routes DIRECTLY to the terminal
    // decision. The finalizing state exists as a defined stopping point
    // (see test #20 in the design doc where finalizing plus level_sample
    // is IGNORE) but the happy path in test #1 shows a single stream_end
    // reaches finalized. Tests that need to observe finalizing construct
    // that state directly.
    stream_end: (state) => terminateOnStreamEnd(state),
    stream_error: (state, event) => {
      if (event.type !== 'stream_error') return ignore(state);
      return toError(state, event.code);
    },
  },

  // ---------- finalizing ---------------------------------------------------
  finalizing: {
    USER_START: ignore, // INV-B6 self-loop
    USER_ABORT: (state) => toAborted(state),
    USER_RESET: ignore,
    AVAILABILITY_LOST: (state) => toUnavailable(state),
    stream_start: ignore,
    level_sample: ignore, // INV-B9 late-sample defense
    stream_end: (state) => terminateOnStreamEnd(state),
    stream_error: (state, event) => {
      if (event.type !== 'stream_error') return ignore(state);
      return toError(state, event.code);
    },
  },

  // ---------- finalized (terminal, artifact already yielded) ---------------
  finalized: {
    USER_START: ignore,
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore, // first terminal wins
    stream_start: ignore,
    level_sample: ignore,
    stream_end: ignore,
    stream_error: ignore, // late error does NOT retract the artifact
  },

  // ---------- aborted (terminal) -------------------------------------------
  aborted: {
    USER_START: ignore,
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore,
    stream_start: ignore,
    level_sample: ignore,
    stream_end: ignore,
    stream_error: ignore, // defensively no-op the coincident error
  },

  // ---------- no_signal (terminal) -----------------------------------------
  no_signal: {
    USER_START: ignore,
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore,
    stream_start: ignore,
    level_sample: ignore,
    stream_end: ignore,
    stream_error: ignore,
  },

  // ---------- error (terminal) ---------------------------------------------
  error: {
    USER_START: ignore,
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore,
    stream_start: ignore,
    level_sample: ignore,
    stream_end: ignore,
    stream_error: ignore,
  },

  // ---------- unavailable (terminal, no artifact) --------------------------
  unavailable: {
    USER_START: ignore, // adapter must USER_RESET and re-probe first
    USER_ABORT: ignore,
    USER_RESET: () => resetToIdle(),
    AVAILABILITY_LOST: ignore,
    stream_start: ignore,
    level_sample: ignore,
    stream_end: ignore,
    stream_error: ignore,
  },
} satisfies Record<WaveformSessionState, Record<WaveformEvent['type'], TransitionSpec>>;

// ---------- Public reducer --------------------------------------------------

export function reduceWaveformSession(
  state: WaveformSessionMachineState,
  event: WaveformEvent,
): WaveformReduceResult {
  const row = TRANSITIONS[state.state] as Record<string, TransitionSpec>;
  return row[event.type](state, event);
}
