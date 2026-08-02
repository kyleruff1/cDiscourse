# VOICE-004 — Waveform session reducer + VoiceWaveformArtifact (pure-TS core)

- **Card:** issue 662
- **Governing contracts:** VOICE-ADR-002 (voice provenance + scoped audio persistence), VOICE-001 (voice shell + capability + doctrine boundary), VOICE-003 (house pattern — reducer + artifact + doctrine guard)
- **Status:** design ready for implementer
- **Scope:** pure-TS reducer over adapter-synthesized user-intent events and adapter-forwarded metering events; typed `VoiceWaveformArtifact` yielded on the four "session actually happened" terminals; sibling pure-fn `deriveWaveformSummary` for post-artifact projection; sibling pure-fn `normalizeMeteringDbFsToAmplitude` for the canonical dBFS→[0,1] mapping; forbidden-inference source-scan guard with waveform-specific ban extensions and a firing positive-control fixture. No React, no native, no expo-audio, no network, no persistence, no UI, no rendering.

## Summary

Ship a JSON-serializable, side-effect-free reducer `reduceWaveformSession(state, event) => { nextState, producedArtifact }` plus the `VoiceWaveformArtifact` type it produces, plus one sibling projection helper and one sibling normalization helper. The reducer covers an **8-state x 8-event grammar (64 cells)** with a total transition matrix (every cell either ruled or explicitly ignored, `satisfies Record<...>` totality clause enforced), yields an immutable `VoiceWaveformArtifact` on the four "session actually happened" terminals (`finalized`, `aborted`, `no_signal`, `error`), yields `null` on the `unavailable` terminal, and threads a bounded, non-replayable amplitude envelope (at most 256 8-bit-quantized peak-per-bucket floats) plus neutral acoustic scalars (`peakLevel`, `meanLevel`, `sampleCount`, `durationMs`, `activeDurationMs`) without ever encoding emotion, tone, stress, arousal, energy-as-trait, shouting, whisper, aggression, dominance, speaker-identity, or any speech-reconstruction signal (formant, phoneme, spectrogram, fft, mfcc, prosody, pitch, envelope-as-signal-feature, raw PCM, sample buffer). A bidirectional source-scan test with a firing positive-control fixture proves the doctrine guard bites; the guard inherits VOICE-003's forbidden-inference lexicon verbatim and extends it with waveform-specific bans.

The design adopts the completeness critic's rulings on every panel contradiction: within-bucket fold = `Math.max` (peak, associative in IEEE-754); halving = pair-`Math.max` (bit-exact, never pair-averaging); bucket count fixed at 256; state machine (not pure fold function); index-driven bucket assignment (rate-invariant, defeats the rate-carrier steganographic channel); 8-bit quantization on finalize (defeats amplitude-LSB steganography and gives an operational entropy ceiling); integer-scaled meanLevel accumulator (bit-exact across V8 / JSC / Hermes); both `rawAudioPersisted: false` (literal type) AND `audioSource: 'metering_only' | 'stream_pcm' | 'cache_temp_deleted'` (discriminant); dBFS normalization moved to a sibling pure-fn so the pure-TS core accepts only `[0,1]`; explicit `no_signal` terminal with `MIN_SAMPLES_FOR_FINALIZED = 3`; `durationMs` (wall clock) separated from `activeDurationMs` (time above baked-in `SILENCE_THRESHOLD = 0.02`).

---

## §0 — VOICE-001 + ADR-002 + VOICE-003-parity reconciliation

The issue 662 acceptance criteria are **partially stale** because (a) VOICE-001 §5.1 formalized the artifact shape after the card was written, (b) VOICE-ADR-002 rewrote the audio-persistence rule from "no audio ever" to "scoped, consent-gated, retention-bounded", and (c) VOICE-003 shipped the house pattern (state machine + `Object.freeze` factory + discriminated union + literal-`null` audioUri + doctrine source-scan) that VOICE-004 must mirror. This design adopts the newer contracts.

### 0.1 Card AC vs shipped design

| issue 662 AC (stale)                                                       | Ship (per ADR-002 + VOICE-001 + VOICE-003 parity)                                                                                                                                                                                                                                                                            | Source                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `rawAudioPersisted: false` (bare boolean on the artifact)                  | **BOTH.** `rawAudioPersisted: false` retained as a **TS literal `false`** (intra-artifact anti-drift assertion — this artifact never holds audio bytes), **AND** a new discriminant `audioSource: 'metering_only' \| 'stream_pcm' \| 'cache_temp_deleted'` (sibling-recording lifecycle provenance mirroring VOICE-003's `audioPersistence`). v1 reducer produces `audioSource: 'metering_only'` via narrowed return type; `'stream_pcm'` and `'cache_temp_deleted'` are reserved literals appearing only in `voiceWaveformArtifact.types.ts`. | VOICE-001 §5.1, ADR-002 §5, VOICE-003 §0 |
| `audioUri: null` implicit (never stated in card)                           | **ADD explicitly.** `audioUri: null` (TS literal null type, not `string \| null`) inherited verbatim from VOICE-003. Enforces "client never holds an audio URI" at the type level, covered by the same `voiceNoUrlInClientTypes.test.ts` doctrine scan extended to the waveform tree.                                                                                        | VOICE-001 §5.3 invariant 1    |
| Pure reducers to fold samples into bounded buckets                         | **STATE MACHINE, not a naked one-shot fold function.** Adapter needs incremental state so the live visualizer (VOICE-005 spike) can render bars as samples arrive; a one-shot fold forces state accumulation to leak into the adapter, defeats the `satisfies Record<...>` totality clause, and breaks parity with VOICE-003. 8 states x 8 events = 64 cells. | Critic ruling, VOICE-003 pattern |
| Depends on VOICE-002 (native config plugin)                                | **NOT a dependency of the pure-TS core.** The reducer, artifact types, and sibling helpers import nothing from `expo-audio` or any native module. VOICE-002 is a dependency of the **metering adapter** (a later card — VOICE-005 spike branch or a dedicated VOICE-004b). VOICE-004 ships independently.                                                                    | Panel consensus (Lens 1, Lens 3) |
| dBFS -> [0,1] normalization unspecified                                    | **RULED.** A sibling pure-fn `normalizeMeteringDbFsToAmplitude(dbfs)` at `src/features/voice/waveform/normalizeMeteringDbFsToAmplitude.ts` implements the canonical formula `clamp01((dbfs + 60) / 60)` — -60 dBFS is functional silence (0), 0 dBFS is clip (1), values below -60 clamp to 0 (defeats the -160 dBFS native-silence sentinel from becoming a covert channel via arithmetic). Non-configurable. Adapter is required to call it before dispatching `LEVEL_SAMPLE`; the reducer defensively clamps out-of-range input via INV-B3. | Critic gap P0 ruling          |
| Amplitude bucket count / precision unspecified                             | **RULED.** `MAX_AMPLITUDE_BUCKETS = 256` (VOICE-001 §5.1 sketch). Every finalized bucket runs through `Math.round(bucket * 255) / 255` (8-bit quantization, INV-B11) before `Object.freeze` — bounds total artifact bucket entropy at 256 x 8 = 2048 bits and defeats amplitude-LSB steganographic channels.                                                                | Critic gap P0 ruling          |
| activeDurationMs semantics unspecified                                     | **SPLIT.** `durationMs` = wall clock (`sessionEndedAt` - `sessionStartedAt`); `activeDurationMs` = time above baked-in `SILENCE_THRESHOLD = 0.02` (module constant, non-configurable, source-scan enforced INV-B12). Both fields ship: `durationMs` for bar-spacing in the visualizer, `activeDurationMs` for MCP Family K's all-silence rejection.                          | Critic gap P0/P1 ruling       |
| Fold rule (peak vs mean, rate-driven vs index-driven) unspecified         | **RULED.** Within-bucket = `Math.max` (peak — associative in IEEE-754, many-to-one, matches visualizer semantics, ADR-002 minimization posture). Halving = pair-`Math.max` (bit-exact, never pair-average — pair-averaging is non-associative in floats and monotonically decays peaks after each halving). Bucket assignment is **index-driven** (sample count + bucketWidth, not timestamp) — defeats rate-carrier steganographic channels. | Critic ruling                 |

### 0.2 Explicit VOICE-003 parity table

VOICE-004 is a sibling of VOICE-003; the two artifacts pair 1:1 in a single voice session. Structural parity is doctrine.

| VOICE-003 element                                                         | VOICE-004 mirror                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `reduceSpeechSession(state, event) => { nextState, producedArtifact }`    | `reduceWaveformSession(state, event) => { nextState, producedArtifact }`                                                      |
| `SpeechSessionMachineState`                                               | `WaveformSessionMachineState`                                                                                                 |
| `SpeechTranscriptArtifact`                                                | `VoiceWaveformArtifact`                                                                                                       |
| `FreshSpeechTranscriptArtifact`                                           | `FreshVoiceWaveformArtifact`                                                                                                  |
| `RecognizerEvent` (12 events)                                             | `WaveformEvent` (8 events)                                                                                                    |
| `SpeechSessionState` (10 states)                                          | `WaveformSessionState` (8 states)                                                                                             |
| `TerminalStateForArtifact = 'final' \| 'interrupted' \| 'timeout_no_speech' \| 'error'` | `TerminalStateForArtifact = 'finalized' \| 'aborted' \| 'no_signal' \| 'error'` (semantic rename to fit the waveform vocabulary; `'unavailable'` intentionally absent, mirrors VOICE-003 INV-A3) |
| `audioPersistence: 'none' \| 'scoped_governed'` discriminant              | `audioSource: 'metering_only' \| 'stream_pcm' \| 'cache_temp_deleted'` discriminant (different concern — provenance path, not persistence lifecycle) PLUS `rawAudioPersisted: false` literal boolean (intra-artifact anti-drift) |
| `audioUri: null` literal type                                             | `audioUri: null` literal type (verbatim carry)                                                                                |
| `SPEECH_SESSION_MACHINE_VERSION = '1.0.0'`                                | `VOICE_WAVEFORM_MACHINE_VERSION = '1.0.0'` (hard-coded semver constant, ratchets on schema-visible change)                    |
| Sibling `deriveEditedProvenance(artifact, submittedBody)`                 | Sibling `deriveWaveformSummary(artifact) => { peakLevel, meanLevel, activeDurationMs, silentBucketRatio, isDegenerate }` (post-artifact projection). Different semantics, same file-layout pattern. |
| Doctrine guard: `voice003ForbiddenInferenceGuard.test.ts` + `.ts.txt` positive-control fixture | `voice004ForbiddenInferenceGuard.test.ts` + `.ts.txt` positive-control fixture. Inherits VOICE-003 lexicon verbatim (copy-and-extend, not shared import — see §6). |
| Adapter events SCREAMING_SNAKE (USER_START, USER_ABORT, USER_RESET, AVAILABILITY_LOST); recognizer events lowercase | Adapter events SCREAMING_SNAKE (USER_START, USER_ABORT, USER_RESET, AVAILABILITY_LOST); metering-forwarded events lowercase (`level_sample`, `stream_end`, `stream_error`) |
| `makeArtifact` centralization for `Object.freeze` in one place            | Same. VOICE-004 additionally freezes the inner `amplitudeBuckets` array (VOICE-003 had no array fields — this is a new requirement).                                     |

### 0.3 The card AC bullets that survive unchanged

Pure TS; no imports from React/Supabase/network/native/expo-audio; all fields readonly; JSON-serializable; the reducer covers idle / active-accumulation / terminal states with a state machine shape; 100% branch coverage on the reducer; no emotion/tone/stress inference; no speech-reconstruction signal.

---

## §1 — Exports

The module exports only the following names. No default export. No React hook, no adapter, no I/O.

```ts
// src/features/voice/waveform/waveformSessionMachine.ts

// State grammar
export type WaveformSessionState =
  | 'idle'
  | 'accumulating'
  | 'finalizing'
  | 'finalized'
  | 'aborted'
  | 'no_signal'
  | 'error'
  | 'unavailable';

// Terminal-artifact discriminant (unavailable intentionally absent — yields null)
export type TerminalStateForArtifact = 'finalized' | 'aborted' | 'no_signal' | 'error';

// Metering-source error codes
export type WaveformStreamErrorCode =
  | 'metering_lost'
  | 'permission_revoked'
  | 'audio_route_lost'
  | 'native_error';

// Capability snapshot handed in at USER_START
export interface WaveformCapabilitySnapshot {
  readonly waveformOfferable: boolean; // permission + policy gate
  readonly meteringSupported: boolean; // device capability gate
}

// Event grammar — see §3
export type WaveformEvent =
  // Adapter-synthesized user-intent events (SCREAMING_SNAKE)
  | {
      type: 'USER_START';
      sessionId: string;
      waveformId: string;
      capability: WaveformCapabilitySnapshot;
      audioSource: 'metering_only' | 'stream_pcm' | 'cache_temp_deleted';
      nowIso: string;
    }
  | { type: 'USER_ABORT' }
  | { type: 'USER_RESET' }
  | { type: 'AVAILABILITY_LOST'; reason: 'permission_revoked' | 'metering_disabled' | 'audio_session_lost' }
  // Adapter-forwarded metering events (lowercase, matches native/upstream naming)
  | { type: 'stream_start' }
  | { type: 'level_sample'; normalizedLevel: number; sourceTimestampMs: number }
  | { type: 'stream_end' }
  | { type: 'stream_error'; code: WaveformStreamErrorCode };

// Module constants
export const MAX_AMPLITUDE_BUCKETS = 256;
export const SILENCE_THRESHOLD = 0.02;
export const MIN_SAMPLES_FOR_FINALIZED = 3;
export const VOICE_WAVEFORM_MACHINE_VERSION = '1.0.0';

// Internal reducer state — includes fields that are session-local and NEVER exported on the artifact
export interface WaveformSessionMachineState {
  readonly state: WaveformSessionState;
  readonly sessionId: string | null;
  readonly waveformId: string | null;
  readonly audioSource: 'metering_only' | 'stream_pcm' | 'cache_temp_deleted' | null;
  readonly sessionStartedAt: string | null;   // ISO-8601 UTC
  readonly sessionEndedAt: string | null;
  // Running fold state — reset on USER_RESET
  readonly amplitudeBuckets: readonly number[]; // length 0..256
  readonly bucketWidth: number;                  // samples per bucket, doubles on each halving
  readonly samplesInCurrentBucket: number;       // count of samples folded into the tail bucket
  readonly sampleCount: number;                  // total accepted LEVEL_SAMPLEs
  readonly peakLevel: number;                    // running max of clamped samples
  readonly meanSumInt65535: number;              // integer-scaled accumulator for cross-engine bit-exact mean
  readonly activeFrameCount: number;             // samples with level >= SILENCE_THRESHOLD
  readonly firstSampleTsMs: number | null;       // relative ms from adapter (session-local, NOT on artifact)
  readonly lastSampleTsMs: number | null;        // relative ms from adapter
  readonly streamStartFired: boolean;
  readonly lastErrorCode: WaveformStreamErrorCode | null;
  readonly terminalState: TerminalStateForArtifact | null;
}

// Reducer return shape (co-derived state + optional artifact)
export interface WaveformReduceResult {
  readonly nextState: WaveformSessionMachineState;
  readonly producedArtifact: FreshVoiceWaveformArtifact | null;
}

// The reducer itself
export function reduceWaveformSession(
  state: WaveformSessionMachineState,
  event: WaveformEvent,
): WaveformReduceResult;

// Initial state factory
export function initialWaveformSessionState(): WaveformSessionMachineState;
```

And in the types file:

```ts
// src/features/voice/waveform/voiceWaveformArtifact.types.ts

export interface VoiceWaveformArtifact {
  readonly waveformId: string;
  readonly sessionId: string;
  readonly audioSource: 'metering_only' | 'stream_pcm' | 'cache_temp_deleted';
  readonly amplitudeBuckets: readonly number[]; // length 0..256, each element in [0,1] at 8-bit precision
  readonly peakLevel: number;                    // [0,1]
  readonly meanLevel: number;                    // [0,1]
  readonly sampleCount: number;                  // integer >= 0
  readonly durationMs: number;                   // integer >= 0 — wall clock
  readonly activeDurationMs: number;             // integer >= 0 — time above SILENCE_THRESHOLD
  readonly sessionStartedAt: string;             // ISO-8601 UTC
  readonly sessionEndedAt: string;               // ISO-8601 UTC
  readonly terminalState: TerminalStateForArtifact;
  readonly lastErrorCode: WaveformStreamErrorCode | null; // non-null iff terminalState==='error'
  readonly rawAudioPersisted: false;             // literal false — intra-artifact anti-drift
  readonly audioUri: null;                       // literal null — client never holds an audio URI
  readonly producedByModuleVersion: string;      // semver of waveformSessionMachine
}

// Branded "just produced" shape — reducer return type is narrowed to this
export type FreshVoiceWaveformArtifact = VoiceWaveformArtifact & {
  readonly audioSource: 'metering_only';
  readonly rawAudioPersisted: false;
  readonly audioUri: null;
};
```

And in the sibling files:

```ts
// src/features/voice/waveform/deriveWaveformSummary.ts

export interface WaveformSummary {
  readonly peakLevel: number;         // max of amplitudeBuckets, or 0 when empty
  readonly meanLevel: number;         // arithmetic mean of amplitudeBuckets, or 0 when empty
  readonly activeDurationMs: number;  // echo of artifact.activeDurationMs
  readonly silentBucketRatio: number; // fraction of buckets below SILENCE_THRESHOLD, in [0,1]
  readonly isDegenerate: boolean;     // terminalState !== 'finalized' OR sampleCount < MIN_SAMPLES_FOR_FINALIZED
}

export function deriveWaveformSummary(artifact: VoiceWaveformArtifact): WaveformSummary;
```

```ts
// src/features/voice/waveform/normalizeMeteringDbFsToAmplitude.ts

// Canonical dBFS -> [0,1] mapping. Non-configurable. Adapter is required to call this
// before dispatching LEVEL_SAMPLE to the reducer.
//   - -60 dBFS or below       -> 0 (functional silence floor)
//   - 0 dBFS or above         -> 1 (clip)
//   - non-finite (NaN, +/-Inf) -> 0
//   - otherwise               -> (dbfs + 60) / 60
export function normalizeMeteringDbFsToAmplitude(dbfs: number): number;
```

And the barrel:

```ts
// src/features/voice/waveform/index.ts — named exports only, no default
export type {
  VoiceWaveformArtifact,
  FreshVoiceWaveformArtifact,
} from './voiceWaveformArtifact.types';
export type {
  WaveformSessionState,
  WaveformSessionMachineState,
  WaveformEvent,
  WaveformCapabilitySnapshot,
  WaveformStreamErrorCode,
  TerminalStateForArtifact,
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
```

---

## §2 — State grammar

Eight states. The four terminals that "record a session that actually happened" yield an artifact; `unavailable` yields `null`.

| State           | Purpose                                                                                                                                                                                                                | Terminal? | Yields artifact? |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------: | :--------------: |
| `idle`          | No session in flight. Only `USER_START` and `AVAILABILITY_LOST` are meaningful; every other event is ignored.                                                                                                          |    no     |        no        |
| `accumulating`  | Adapter fired `USER_START` (with `waveformOfferable === true`) and metering is streaming. Every `level_sample` is clamped, updates running scalars, and folds into the bucket ring via the online-adaptive-halving rule (see §4). |    no     |        no        |
| `finalizing`    | Adapter fired `stream_end` from `accumulating`. Awaits the terminal decision: `sampleCount >= MIN_SAMPLES_FOR_FINALIZED` -> `finalized`; else -> `no_signal`. Late `level_sample` in this state is IGNORE (INV-B9 late-sample defense — mirrors VOICE-003 INV-21). |    no     |        no        |
| `finalized`     | Terminal — normal end of a session with enough samples to render. Artifact yielded ONCE on the transition into this state. Late events (`level_sample`, `stream_end`, `stream_error`, `AVAILABILITY_LOST`) are IGNORE. |    yes    |     **yes**      |
| `aborted`       | Terminal — user cancelled via `USER_ABORT`. Artifact yielded with the samples-so-far (mirrors VOICE-003 `interrupted`). Doctrine: aborted sessions preserve provenance.                                                |    yes    |       yes        |
| `no_signal`     | Terminal — `stream_end` fired with `sampleCount < MIN_SAMPLES_FOR_FINALIZED` (3), OR `stream_end` fired directly from `accumulating` before any `level_sample` arrived. Empty-bucket artifact yielded (mirrors VOICE-003 `timeout_no_speech`). |    yes    |       yes        |
| `error`         | Terminal — adapter emitted `stream_error` (`metering_lost`, `permission_revoked`, `audio_route_lost`, or `native_error`). `lastErrorCode` set on the artifact for the adapter's `gameCopy.toPlainLanguage`. Samples-so-far preserved. |    yes    |       yes        |
| `unavailable`   | Terminal — session was never offerable (defensive `USER_START` with `waveformOfferable === false`) OR mid-session `AVAILABILITY_LOST` fired. **Yields NO artifact.** `USER_RESET` recovers to `idle` (adapter must re-probe capability). |    yes*   |   **no (null)**  |

\* `unavailable` is a terminal-recoverable state via `USER_RESET`. Recovery does not resurrect the prior session; it clears state and returns to `idle`. Direct parity with VOICE-003 §2.

---

## §3 — Event grammar

Eight events. Adapter-synthesized events use SCREAMING_SNAKE_CASE; adapter-forwarded metering events use lowercase (mirrors VOICE-003's SCREAMING_SNAKE-for-user-intent, lowercase-for-upstream convention).

| Event               | Source                                                                                          | Payload                                                                                                                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`        | adapter (Speak tap after permission + capability resolved)                                      | `{ sessionId, waveformId, capability, audioSource, nowIso }`                                                                                       | Only meaningful in `idle`. In non-terminal states it is a self-loop with no mutation regardless of whether payload `sessionId`/`waveformId`/`audioSource` differ (INV-B6 — closes the mid-session hijack race). In terminals other than `unavailable`, adapter must `USER_RESET` first.                                                                                                                     |
| `USER_ABORT`        | adapter (Stop tap, mode switch, room settle/lock)                                               | `{}`                                                                                                                                               | Distinct from `stream_error{code:'audio_route_lost'}` — user intent, not metering fault. Aborted sessions yield an artifact with `terminalState: 'aborted'` (samples-so-far preserved for provenance parity with VOICE-003 `interrupted`).                                                                                                                                                                    |
| `USER_RESET`        | adapter (fresh session from a terminal, or recovery from `unavailable`)                         | `{}`                                                                                                                                               | Meaningful only in terminals. Returns to `idle` with a clean state via `initialWaveformSessionState()`. Adapter must re-run capability probe before firing `USER_START` after resetting from `unavailable`.                                                                                                                                                                                                  |
| `AVAILABILITY_LOST` | adapter (capability probe / permission listener / dev toggle)                                   | `{ reason: 'permission_revoked' \| 'metering_disabled' \| 'audio_session_lost' }`                                                                   | Legal from any non-terminal. Transitions to `unavailable` with no artifact — samples-so-far are discarded (mirrors VOICE-003 `unavailable` semantics: "a session that was never offerable produces nothing"). In terminals it is ignored (first terminal wins).                                                                                                                                              |
| `stream_start`      | adapter-forwarded (native metering became live)                                                 | none                                                                                                                                               | Sets `streamStartFired = true`. Legal in `accumulating` (idempotent — some native modules fire it once, some multiple times). Explicit event even though it does not change state — it is a legibility marker and future MCP Family K may attach it as provenance.                                                                                                                                             |
| `level_sample`      | adapter-forwarded (one metering frame, adapter has already called `normalizeMeteringDbFsToAmplitude`) | `{ normalizedLevel: number, sourceTimestampMs: number }`                                                                                          | In `accumulating`: clamp `normalizedLevel` to `[0,1]` with NaN / +/-Infinity / negative -> 0 and >1 -> 1 (INV-B3), update `peakLevel = max(...)`, accumulate integer `meanSumInt65535`, increment `sampleCount`, increment `activeFrameCount` if `clamped >= SILENCE_THRESHOLD`, fold into the bucket ring per §4. `sourceTimestampMs` is integer relative ms from session start (adapter clock) — see §4 boundary cases for out-of-order behavior. In `finalizing` / any terminal: IGNORE (late-sample defense INV-B9). |
| `stream_end`        | adapter-forwarded (native metering ended)                                                       | none                                                                                                                                               | From `accumulating` -> `finalizing`. From `finalizing`: proceeds to terminal (`finalized` if `sampleCount >= MIN_SAMPLES_FOR_FINALIZED`, else `no_signal`). Idempotent in `finalizing` (some platforms may double-fire).                                                                                                                                                                                     |
| `stream_error`      | adapter-forwarded (metering pipeline error)                                                     | `{ code: WaveformStreamErrorCode }`                                                                                                                | From `accumulating` / `finalizing` -> `error`. `lastErrorCode = code`. Samples-so-far preserved. Late `stream_error` in any terminal is IGNORE (first terminal wins, mirrors VOICE-003 INV-B7).                                                                                                                                                                                                              |

---

## §4 — Fold algorithm + transition table

### 4.1 Bucket count

`MAX_AMPLITUDE_BUCKETS = 256` — fixed cap, hard-coded module constant. Matches VOICE-001 §5.1 verbatim. Bounded and non-growable — cannot be widened without a doctrine ratification card. Runtime-asserted in `makeArtifact` per critic ruling (TypeScript branded fixed-length types are `as unknown as`-castable and provide false comfort; the runtime assertion plus the source-scan negative-space check on `MAX_*_BUCKETS` declarations is the load-bearing enforcement). Runtime length is `min(sampleCount, 256)` — shorter sessions return shorter arrays.

At the 60s D6 recording cap divided across 256 buckets, effective envelope rate is 4.3 Hz — well below the >20 Hz needed to convey amplitude-envelope speech intelligibility and orders of magnitude below the >100 Hz needed for formant tracking. See §4.5 non-replayability argument.

### 4.2 Fold rule — ONLINE ADAPTIVE HALVING with PEAK-per-bucket

Reducer state carries `amplitudeBuckets: readonly number[]` (length 0..256), `bucketWidth: number` (samples per bucket, starts at 1 and doubles on each halving), `samplesInCurrentBucket: number`, and the running scalars `peakLevel`, `meanSumInt65535`, `sampleCount`, `activeFrameCount`, `firstSampleTsMs`, `lastSampleTsMs`.

**On `level_sample` in `accumulating`:**

1. **Clamp** `normalizedLevel` to `[0,1]`: NaN / +Infinity / -Infinity / negative -> 0; `>1` -> 1.
2. **Running scalars:**
   - `peakLevel = Math.max(peakLevel, clamped)`
   - `meanSumInt65535 += Math.round(clamped * 65535)` (integer-scaled accumulator for cross-engine bit-exact mean — see §4.4)
   - `sampleCount += 1`
   - if `clamped >= SILENCE_THRESHOLD` (0.02), `activeFrameCount += 1`
   - if `firstSampleTsMs === null`, `firstSampleTsMs = sourceTimestampMs`
   - `lastSampleTsMs = sourceTimestampMs`
3. **Bucket assignment (INDEX-DRIVEN, not timestamp-driven):**
   - If `samplesInCurrentBucket < bucketWidth`: fold into the tail via `amplitudeBuckets[last] = Math.max(amplitudeBuckets[last], clamped)`; increment `samplesInCurrentBucket`.
   - Else if `amplitudeBuckets.length < 256`: append a new bucket `[clamped]`; set `samplesInCurrentBucket = 1`.
   - Else (256 buckets full and the tail is full): run one **halving step** — pair-fold the array into `[max(b[0],b[1]), max(b[2],b[3]), ..., max(b[254],b[255])]` (128 buckets); double `bucketWidth`; append `[clamped]` as bucket[128]; set `samplesInCurrentBucket = 1`.

**Halving is bit-exact and deterministic.** `Math.max(a, Math.max(b, c))` is exactly `Math.max(Math.max(a, b), c)` in IEEE-754 (max is associative and commutative), so pair-halving is order-independent. Pair-averaging (rejected by the critic) is NOT associative in floats and monotonically decays peaks after each halving, so a 60s recording would render visually flatter than a 30s one at the same true peak.

**Rate-invariance.** Because bucket assignment is driven by `sampleCount` and `bucketWidth` (not by `sourceTimestampMs`), the same input sample sequence produces byte-identical buckets regardless of adapter emission rate. `sourceTimestampMs` is captured for `durationMs` derivation only. This closes the rate-carrier steganographic channel where an adapter could vary sample rate to encode covert bits into bucket boundaries.

**On `stream_end` -> terminal (`finalized` or `no_signal`) or `USER_ABORT` -> `aborted`:**

1. **8-bit quantization (INV-B11):** every bucket `b` runs through `Math.round(b * 255) / 255`. Idempotent. Bounds per-bucket entropy at 8 bits, total artifact bucket entropy at 256 x 8 = 2048 bits. Defeats amplitude-LSB steganographic channels.
2. **meanLevel finalize:** `meanLevel = sampleCount > 0 ? (meanSumInt65535 / sampleCount) / 65535 : 0`. Bit-exact across V8 / JSC / Hermes.
3. **durationMs finalize:** `durationMs = (sampleCount >= 2 && lastSampleTsMs !== null && firstSampleTsMs !== null && lastSampleTsMs >= firstSampleTsMs) ? (lastSampleTsMs - firstSampleTsMs) : 0`.
4. **activeDurationMs finalize:** `activeDurationMs = sampleCount > 0 ? Math.round((activeFrameCount / sampleCount) * durationMs) : 0`.
5. **sessionEndedAt finalize:** `sessionEndedAt = new String derivation from sessionStartedAt + durationMs` — but the reducer holds no wall clock; per critic ruling adopt VOICE-003's pattern: `sessionEndedAt` is stored on internal state as the last `nowIso` handed in (fallback to `sessionStartedAt` when no sample arrived, mirrors VOICE-003 line 186). Since `level_sample` carries only `sourceTimestampMs` (integer, relative ms — not ISO), the reducer synthesizes `sessionEndedAt` by adding `durationMs` (whole ms) to `sessionStartedAt` at terminal via a small pure ISO helper. Alternative: adapter dispatches a synthetic `stream_end` with a `nowIso` field. Design chooses **the ISO-add helper** (simpler contract, no extra payload). The helper `addWholeMillisecondsToIso(iso: string, ms: number): string` lives inline in the reducer file (private, not exported).
6. **`amplitudeBuckets`, `sessionEndedAt`, `lastErrorCode`** — assigned on the produced artifact.
7. **`Object.freeze` both** the artifact AND `artifact.amplitudeBuckets` (VOICE-003 has no arrays; this is a NEW invariant — INV-B1 extended).

### 4.3 Boundary cases

- **Zero samples on `stream_end`** (or empty session) -> `no_signal` terminal: `amplitudeBuckets = []`, `peakLevel = 0`, `meanLevel = 0`, `sampleCount = 0`, `durationMs = 0`, `activeDurationMs = 0`. Artifact still yielded (parity with VOICE-003 `timeout_no_speech`).
- **1 or 2 samples on `stream_end`** -> `no_signal` (sampleCount < `MIN_SAMPLES_FOR_FINALIZED = 3`). Samples fold into 1 or 2 buckets; `peakLevel` and `meanLevel` computed but `terminalState = 'no_signal'`. Rationale: at typical 100 Hz metering, 3 samples = 30 ms — below any visible bar and functionally silence.
- **Single sample `level = 0.5`** on `USER_ABORT` -> `aborted`: `amplitudeBuckets = [quantized(0.5) === 128/255]`, `peakLevel = 0.5`, `meanLevel = 0.5`, `sampleCount = 1`, `durationMs = 0`, `activeDurationMs = 0`.
- **All-zero samples (N=100)** -> `amplitudeBuckets = [0, 0, ..., 0]` length 100, `peakLevel = 0`, `meanLevel = 0`, `activeFrameCount = 0`, `activeDurationMs = 0`.
- **`level = 1.5` (above 1)** -> clamped to 1 at INV-B3 entry. Reducer never throws.
- **`level = NaN`** -> clamped to 0 (non-finite -> 0, NOT max — an adversary or bug that injects NaN should not be silently treated as peak).
- **`level = +Infinity` / `-Infinity`** -> clamped to 0 (same rule).
- **`level = -0.5` (negative)** -> clamped to 0.
- **N == 256 exact** -> identity fold; each bucket = one sample; `bucketWidth` stays 1; no halving.
- **N == 257** -> first halving: 256 buckets pair-fold to 128, `bucketWidth` doubles to 2, sample 257 appended as bucket[128] with `samplesInCurrentBucket = 1`.
- **N == 512** -> after one halving: `amplitudeBuckets.length = 256`, each bucket = max of 2 adjacent originals, `bucketWidth = 2`.
- **N == 1024** -> after two halvings: length 256, each bucket = max of 4 originals, `bucketWidth = 4`.
- **N == 60,000 (60s at 1000 Hz)** -> after `log2(60000/256)` = ~8 halvings: length 256, each bucket = max of ~256 samples. Total halving work = 256+128+64+... < 512 ops. Amortized O(N).
- **Out-of-order `sourceTimestampMs`** (e.g. `[0, 100, 50, 200, 300]`) -> reducer accepts all in reception order (index-driven fold guarantees this); `firstSampleTsMs = 0`, `lastSampleTsMs = 300`, `sampleCount = 5`. `durationMs = 300`. Design tradeoff: the reducer trusts adapter timestamp monotonicity but does not throw on violation (defensive floor at 0 for negative durations).
- **`level_sample` in `finalizing`** -> IGNORE (INV-B9 late-sample defense; mirrors VOICE-003 INV-21). State returned Object.is-unchanged.
- **`level_sample` in any terminal** -> IGNORE. Artifact is immutable once yielded.
- **`stream_end` in `finalizing`** -> proceeds to terminal (idempotent no-op if the terminal has already been reached; but the transition ONLY happens on the first `stream_end` from `accumulating`).
- **`USER_ABORT` with zero samples** -> yields artifact with all-zero fields, `terminalState: 'aborted'`.
- **`AVAILABILITY_LOST` mid-accumulation** -> `unavailable`, `producedArtifact === null`, samples-so-far discarded.
- **Terminal-then-late-event race** -> first terminal wins; every subsequent event is IGNORE (mirrors VOICE-003 INV-B7).
- **`USER_START` in `accumulating` with a DIFFERENT `sessionId`/`waveformId`/`audioSource`** -> IGNORE (self-loop, no mutation, INV-B6). Closes the mid-session hijack race. Adapter must `USER_RESET` first.

### 4.4 Determinism argument

Determinism is enforced at four layers:

1. **INDEX-DRIVEN fold.** Bucket assignment depends only on `sampleCount` and `bucketWidth` (both integer). Timestamps are captured for provenance and duration only; the fold decision never inspects them. Property test: same 100 samples emitted at 10 Hz, 100 Hz, and 1000 Hz produce byte-identical `amplitudeBuckets`, `peakLevel`, and `meanLevel`; only `durationMs` differs.
2. **FLOAT-SAFE OPERATIONS.** `Math.max(a, b)` is associative and commutative in IEEE-754 (`max(a, max(b, c)) === max(max(a, b), c)` exactly). Pair-halving is bit-exact regardless of reduction order.
3. **INTEGER-SCALED meanLevel.** Every clamped sample is scaled to `Math.round(clamped * 65535)` as a 32-bit integer and accumulated as a JS Number in the safe-integer domain: `65535 * 60s * 1000 Hz = 3.93e9` << `2^53`. Division happens only at finalize (`meanSumInt65535 / sampleCount / 65535`). Bit-exact across V8 / JSC / Hermes — pinned by a fixture snapshot test (§7).
4. **PURE REDUCER.** No `Date.now`, no `new Date`, no `Math.random`, no `crypto`, no environment read, no file read. `waveformId`, `sessionId`, `sessionStartedAt` all enter via `USER_START`. `producedByModuleVersion` is the hard-coded `VOICE_WAVEFORM_MACHINE_VERSION` constant.

### 4.5 Non-replayability argument

Four load-bearing layers:

1. **SAMPLE-RATE LOSS.** At the 60s D6 cap divided across 256 buckets, effective envelope rate is 4.3 Hz. Envelope-based speech intelligibility research (Shannon 1995, Drullman 1994) establishes that envelope information below ~4 Hz destroys intelligibility even for the amplitude-envelope-only signal — and no amount of envelope alone reconstructs the 200-8000 Hz formant content that carries phoneme identity. At 1s recordings, 256 buckets = 3.9 ms/bucket = 256 Hz envelope, still magnitude-only.
2. **PHASE LOSS.** Buckets carry MAGNITUDE only. Speech waveform phoneme identity is encoded in formant frequencies (spectral peaks 200-8000 Hz) and their phase relationships; magnitude envelope alone omits both. LPC-based speech synthesis requires spectral envelope (10+ coefficients at >=50 Hz update rate), not amplitude envelope.
3. **PEAK-FOLD LOSS.** `Math.max` is many-to-one. From a bucket with `peakLevel = 0.8` aggregating 100 raw samples, an adversary cannot recover the 99 non-peak samples — that information is destroyed at fold time and never persists in reducer state (online fold, no raw sample buffer retained).
4. **8-BIT QUANTIZATION LOSS.** INV-B11 rounds every finalized bucket to nearest 1/255. Caps per-bucket entropy at 8 bits; total artifact bucket entropy is bounded at 256 * 8 = 2048 bits — enough to render a bar chart, insufficient to encode any meaningful audio.

This claim is made **operational** (not merely prose) by the test matrix:
- An **entropy-bound assertion** — a produced artifact's `amplitudeBuckets` contains at most 256 distinct values; JSON payload byte-size is bounded.
- A **naive-reconstruction negative control** — expand the 256 buckets to a fixed-length audio sequence via nearest-neighbor upsampling; a small in-repo FFT helper (test-file-local, not production) asserts the resulting spectral entropy is below a fixed floor, proving magnitude envelope alone carries no formant content.

### 4.6 Transition matrix (full 8 x 8 = 64 cells)

Every cell is either a **transition** (with side-effect note) or `IGNORE` (state unchanged, every field on `WaveformSessionMachineState` `Object.is`-unchanged, `producedArtifact = null`). There are no implicit fallthroughs — the reducer is table-driven and a build-time `satisfies Record<WaveformSessionState, Record<WaveformEvent['type'], TransitionSpec>>` check catches any missing cell.

Load-bearing cells are marked **★**.

#### 4.6.1 idle (6 IGNOREs; 2 meaningful)

| Event               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `USER_START`        | If `capability.waveformOfferable === true` AND `capability.meteringSupported === true`: -> `accumulating`; initialise `sessionId`, `waveformId`, `audioSource`, `sessionStartedAt = nowIso`, `amplitudeBuckets = []`, `bucketWidth = 1`, `samplesInCurrentBucket = 0`, `sampleCount = 0`, `peakLevel = 0`, `meanSumInt65535 = 0`, `activeFrameCount = 0`, `firstSampleTsMs = null`, `lastSampleTsMs = null`, `streamStartFired = false`, `lastErrorCode = null`. **If either capability is false: -> `unavailable` (defensive; producedArtifact = null).** ★ |
| `AVAILABILITY_LOST` | -> `unavailable`; `producedArtifact = null`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| all other 6         | IGNORE.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

#### 4.6.2 accumulating (0 IGNOREs; 8 meaningful)

| Event               | Result                                                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`        | IGNORE (self-loop, INV-B6 — payload-invariant no-op even when `sessionId`/`waveformId`/`audioSource` differ). ★                                                                                                                     |
| `USER_ABORT`        | -> `aborted`; run terminal fold (quantize + freeze); `terminalState = 'aborted'`; yield artifact.                                                                                                                                    |
| `USER_RESET`        | IGNORE (must abort first).                                                                                                                                                                                                          |
| `AVAILABILITY_LOST` | -> `unavailable`; `producedArtifact = null`; samples-so-far discarded. ★                                                                                                                                                             |
| `stream_start`      | `streamStartFired = true`; stay in `accumulating`. (Idempotent — some native modules fire multiple times.)                                                                                                                          |
| `level_sample`      | Stay in `accumulating`; apply the online-adaptive-halving fold (§4.2). Update running scalars.                                                                                                                                       |
| `stream_end`        | -> `finalizing`. No terminal fold yet — awaits `MIN_SAMPLES_FOR_FINALIZED` check.                                                                                                                                                    |
| `stream_error`      | -> `error`; `lastErrorCode = code`; run terminal fold; `terminalState = 'error'`; yield artifact.                                                                                                                                    |

#### 4.6.3 finalizing (2 IGNOREs; 6 meaningful)

| Event               | Result                                                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`        | IGNORE (self-loop). ★                                                                                                                                                                                                              |
| `USER_ABORT`        | -> `aborted`; run terminal fold; yield artifact.                                                                                                                                                                                    |
| `USER_RESET`        | IGNORE.                                                                                                                                                                                                                             |
| `AVAILABILITY_LOST` | -> `unavailable`; null.                                                                                                                                                                                                             |
| `stream_start`      | IGNORE (pre-finalize stream_start is odd but harmless).                                                                                                                                                                             |
| `level_sample`      | **IGNORE — INV-B9 spurious late sample after stream_end is NOT folded.** ★ Explicit ruling, not fallthrough. Mirrors VOICE-003 INV-21.                                                                                              |
| `stream_end`        | Advance to terminal. If `sampleCount >= MIN_SAMPLES_FOR_FINALIZED` (3): -> `finalized`; run terminal fold; `terminalState = 'finalized'`; yield artifact. Else: -> `no_signal`; run terminal fold; `terminalState = 'no_signal'`; yield artifact. ★ |
| `stream_error`      | -> `error`; `lastErrorCode = code`; run terminal fold; yield artifact.                                                                                                                                                              |

#### 4.6.4 finalized — terminal, artifact already yielded (1 exit; 7 IGNOREs)

| Event         | Result                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `USER_RESET`  | -> `idle`; clear all session-local fields via `initialWaveformSessionState()`. **Only exit.**                                                                                                                                              |
| all other 7   | IGNORE. **The artifact is immutable once yielded.** Late `stream_error` does NOT retract; second `stream_end` is a no-op; late `level_sample` does NOT append; `AVAILABILITY_LOST` in `finalized` is ignored (first terminal wins). ★     |

#### 4.6.5 aborted — terminal (1 exit; 7 IGNOREs)

| Event         | Result                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `USER_RESET`  | -> `idle`; clear.                                                                                                                                                                                                                          |
| all other 7   | IGNORE. Late `stream_error{code:'audio_route_lost'}` that may arrive coincidentally after `USER_ABORT` is defensively no-op'd (adapter should swallow, reducer defensively no-ops — mirrors VOICE-003 §4.7). ★                            |

#### 4.6.6 no_signal — terminal (1 exit; 7 IGNOREs)

| Event         | Result                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `USER_RESET`  | -> `idle`; clear.                                                                                                                                                                                                                          |
| all other 7   | IGNORE. Trailing `stream_end`, `stream_error`, `AVAILABILITY_LOST` are teardown ripples.                                                                                                                                                   |

#### 4.6.7 error — terminal (1 exit; 7 IGNOREs)

| Event         | Result                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `USER_RESET`  | -> `idle`; clear (`lastErrorCode = null`).                                                                                                                                                                                                 |
| all other 7   | IGNORE.                                                                                                                                                                                                                                    |

#### 4.6.8 unavailable — terminal, no artifact (1 exit; 7 IGNOREs)

| Event         | Result                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `USER_RESET`  | -> `idle`; clear. **Adapter must re-run capability probe before the next `USER_START`; the reducer's `idle + USER_START (waveformOfferable=false OR meteringSupported=false)` transition defensively returns here.** ★                    |
| all other 7   | IGNORE.                                                                                                                                                                                                                                    |

#### 4.6.9 Totals

- **8 states x 8 events = 64 cells.**
- **~24 transitions with side-effects.**
- **~40 explicit IGNOREs.**
- Every cell is covered by a parametric test (§7).

---

## §5 — VoiceWaveformArtifact — field spec

Yielded on the transition into `finalized`, `aborted`, `no_signal`, or `error`. Never yielded from `unavailable`. Every field is `readonly`. The reducer returns an `Object.freeze`d instance and separately `Object.freeze`s `artifact.amplitudeBuckets` (VOICE-003 had no arrays; this is a NEW invariant — INV-B1 extended). Guard columns follow VOICE-003 convention: (a) TS-enforced, (b) runtime-asserted in tests, (c) source-scan-guarded.

| Field                        | Type                                                                     | Purpose                                                                                                                                                                       | Invariant                                                                                                                                                            | Guarded by                                             |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `waveformId`                 | `string`                                                                 | Stable id joining artifact to sibling `SpeechTranscriptArtifact.transcriptId` for the same session pair (adapter passes on `USER_START`, no runtime generation).             | Non-empty; unique per session; immutable after `USER_START`.                                                                                                          | (b) runtime                                            |
| `sessionId`                  | `string`                                                                 | Reducer-owned session id; adapter uses it to reject concurrent sessions across shared drafts. Pairs 1:1 with `SpeechTranscriptArtifact.sessionId` when both artifacts co-produce. | Non-empty; distinct from `waveformId`.                                                                                                                              | (b) runtime                                            |
| `audioSource`                | `'metering_only' \| 'stream_pcm' \| 'cache_temp_deleted'`                | Discriminated union — adapter's sample-source lifecycle. `metering_only` (safest, preferred — `useAudioRecorderState().metering`); `stream_pcm` (real-time PCM samples fed the reducer, never persisted — VOICE-005 spike); `cache_temp_deleted` (recorder wrote a temp file, extracted levels, deleted immediately per ADR-002 no-persistence rule for the waveform-only path). | v1 reducer produces literal `'metering_only'` via narrowed return type. `'stream_pcm'` and `'cache_temp_deleted'` reserved literals appearing only in `voiceWaveformArtifact.types.ts`. | (a) TS narrowing + (c) source scan asserting the reserved literals appear only in type declarations |
| `amplitudeBuckets`           | `readonly number[]` (length 0..256; each element in [0,1] at 8-bit precision) | Bounded, non-replayable amplitude envelope. Peak-per-bucket via online adaptive halving. Bar-chart data.                                                                       | INV-A6 length <= 256; INV-B4 runtime-asserted; INV-B5 element range [0,1]; INV-B11 8-bit quantized; INV-B1 frozen alongside the artifact.                             | (a) `readonly number[]` + (b) runtime + (c) `MAX_*_BUCKETS` source scan |
| `peakLevel`                  | `number` in [0,1]                                                        | Running max of clamped samples (INV-B updated online, NOT derived from quantized buckets — captures true pre-quantization peak).                                              | `peakLevel = max(clamp01(level_i))` for all i; `>= max(amplitudeBuckets)` (since buckets are also peaks of subsets); in [0,1].                                        | (b) runtime                                            |
| `meanLevel`                  | `number` in [0,1]                                                        | Mean of clamped samples via integer-scaled accumulation (INV-B6).                                                                                                             | In [0,1]; `<= peakLevel`; 0 when `sampleCount === 0`; bit-exact across V8 / JSC / Hermes.                                                                             | (b) runtime + cross-engine pinned fixture              |
| `sampleCount`                | `number` (integer, `>= 0`)                                               | Total `level_sample` events accepted during the session. Adapter uses for degrade decisions; MCP Family K uses for post-storage aggregation.                                  | `>= 0`; integer; monotonic within a session.                                                                                                                          | (b) runtime                                            |
| `durationMs`                 | `number` (integer, `>= 0`)                                               | Wall-clock duration = `lastSampleTsMs - firstSampleTsMs`, or 0 when `sampleCount <= 1`.                                                                                       | `>= 0`; derived at finalize, never mid-fold.                                                                                                                          | (b) runtime                                            |
| `activeDurationMs`           | `number` (integer, `>= 0`)                                               | Time above `SILENCE_THRESHOLD = 0.02` = `Math.round((activeFrameCount / sampleCount) * durationMs)` when `sampleCount > 0` else 0.                                             | `0 <= activeDurationMs <= durationMs`.                                                                                                                                | (b) runtime + INV-B12 source scan on `SILENCE_THRESHOLD` |
| `sessionStartedAt`           | `string` (ISO-8601 UTC)                                                  | When `USER_START` fired (`nowIso` payload).                                                                                                                                    | Parseable ISO Z-suffixed matching `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`.                                                                                  | (b) runtime                                            |
| `sessionEndedAt`             | `string` (ISO-8601 UTC)                                                  | Synthesized from `sessionStartedAt + durationMs`. Fallback to `sessionStartedAt` when no sample arrived (mirrors VOICE-003 line 186).                                          | `>= sessionStartedAt` (string compare on Z-suffixed ISO after format regex passes).                                                                                    | (b) runtime                                            |
| `terminalState`              | `'finalized' \| 'aborted' \| 'no_signal' \| 'error'`                     | Discriminant so adapter routes without re-reading state.                                                                                                                       | (a) TS literal union. **`'unavailable'` intentionally absent — unavailable yields null.**                                                                             | (a) TS + type test                                     |
| `lastErrorCode`              | `WaveformStreamErrorCode \| null`                                        | Non-null iff `terminalState === 'error'`. Adapter routes through `gameCopy.toPlainLanguage`.                                                                                    | Non-null iff `terminalState === 'error'`; null on all other terminals.                                                                                                | (b) runtime                                            |
| `rawAudioPersisted`          | `false` (TS literal, NOT `boolean`)                                      | **Intra-artifact anti-drift assertion.** This artifact NEVER holds audio bytes, regardless of `audioSource`. Documentation-of-invariant field the card's AC asks for. Defense-in-depth complement to `audioSource`. | Literal `false`; TS refuses `true` at every callsite; runtime double-checked in `makeArtifact`.                                                                       | (a) TS literal + (b) runtime                           |
| `audioUri`                   | `null` (TS literal, NOT `string \| null`)                                | Enforces "client never holds an audio URI" at the type level. Direct verbatim carry from VOICE-003 INV-A1.                                                                    | Literal null; TS refuses non-null at compile time.                                                                                                                    | (a) TS literal + (c) `voiceNoUrlInClientTypes.test.ts` extension to waveform tree |
| `producedByModuleVersion`    | `string` (semver, from `VOICE_WAVEFORM_MACHINE_VERSION`)                 | Migration provenance for when VOICE-DB widens `audioSource` or adds fields.                                                                                                    | Non-empty; hard-coded module constant; ratchets on schema-visible change.                                                                                             | (b) runtime                                            |

### 5.1 Fields intentionally NOT on the artifact

- **`bucketCount`** (redundant with `amplitudeBuckets.length`) — dropped per critic ruling. Consumers use `artifact.amplitudeBuckets.length`. Prevents INV-B3-style repair invariants for a class of drift.
- **`firstSampleTsIso` / `lastSampleTsIso`** — session-local only, on internal reducer state as `firstSampleTsMs` / `lastSampleTsMs` (integer relative ms). Not exposed on the artifact — `sessionStartedAt` / `sessionEndedAt` cover the session boundary, and per-sample first/last is duplicative and adds two frozen strings.
- **`bucketWidth`, `samplesInCurrentBucket`, `meanSumInt65535`, `activeFrameCount`, `streamStartFired`** — session-local scratch, never exposed on the artifact.
- **`latestInterimText` / `interimTranscriptWindow`** — N/A (this is the waveform artifact, not the speech artifact).
- **`recognitionConfidence` / `recognizerConfidence` / `confidence` / `speakerConfidence`** — deferred entirely per ADR-002 §0 (also carried by VOICE-003).
- **Any emotion / tone / stress / arousal / energy-as-trait / shouting / whisper / aggression / dominance / anger / mood / sentiment / honesty / sincerity / manipulation / biometric / identity / credibility / intent / truth / winner / loser / verdict / liar / dishonest / bad-faith / extremist / propagandist / heavilyEdited / suspicious / genuineness / authenticity token** — banned by the doctrine source-scan (§6).
- **Any speech-reconstruction signal — `envelope` (as signal-feature field name), `formant`, `phoneme`, `spectrogram`, `fft`, `fourier`, `melspec`, `mfcc`, `prosody`, `cepstral`, `pitch`, `f0`, `speakerId`, `speakerRecognition`, `pcm`, `rawSamples`, `audioBlob`, `audioBuffer`, `rawPcm`, `sampleBuffer`, `waveformPcm`, `Uint8Array` field, `ArrayBuffer` field, `AudioBuffer` field, `storageKey`, `signedUrl`, `bucket` (as S3 bucket)** — banned by the doctrine source-scan (§6, extended lexicon).

### 5.2 Reconciliation with VOICE-001 §5.1

VOICE-001 §5.1's inline sketch used `rmsSummary`. This design ships `meanLevel` (arithmetic mean of clamped samples via integer accumulator, not RMS). Rationale: true RMS requires squared-then-square-rooted sample buffering that is harder to keep pure across engines; `meanLevel` via integer accumulator is bit-exact. The name `mean` is unambiguously arithmetic mean and avoids the energy-domain connotation of "RMS". Consumers who need RMS derive it downstream.

VOICE-001 §5.1's sketch also implied per-sample first/last ISO strings; this design collapses those to session-boundary ISO strings on the artifact and integer-relative-ms on internal state (per critic ruling — 30-byte ISO strings x 60,000 samples = 1.8 MB per session of allocation garbage).

---

## §6 — Invariants (doctrine)

Enumerated so tests can name each. Split into (a) TS-enforced by literal types, (b) runtime-asserted in tests, (c) source-scan-guarded.

### 6.1 Type-enforced (a)

- **INV-A1** `audioUri: null` is the TS literal `null`, not `string | null`. Type-equal test: `TypeEqual<VoiceWaveformArtifact['audioUri'], null>`. Verbatim carry from VOICE-003 INV-A1.
- **INV-A2** `rawAudioPersisted: false` is a TS literal `false`, not `boolean`. Type-equal test asserts.
- **INV-A3** `audioSource: 'metering_only' | 'stream_pcm' | 'cache_temp_deleted'`; the v1 reducer's return type is narrowed to `FreshVoiceWaveformArtifact & { audioSource: 'metering_only' }`. TS refuses a produced artifact with `'stream_pcm'` or `'cache_temp_deleted'`.
- **INV-A4** `terminalState: 'finalized' | 'aborted' | 'no_signal' | 'error'`. TS excludes `'unavailable'`. Type-equal test asserts.
- **INV-A5** `FreshVoiceWaveformArtifact` narrows to `{ audioSource: 'metering_only'; rawAudioPersisted: false; audioUri: null }`.
- **INV-A6** `amplitudeBuckets: readonly number[]` (bound enforced at runtime; see INV-B4). `keyof VoiceWaveformArtifact` does NOT include any raw-audio field names (`pcm`, `rawSamples`, `audioBlob`, `audioBuffer`, `rawPcm`, `sampleBuffer`, `waveformPcm`, `storageKey`, `signedUrl`). Type test asserts.
- **INV-A7** `WaveformSessionState` is a closed union of exactly 8 members.
- **INV-A8** `WaveformEvent['type']` is a closed union of exactly 8 members.
- **INV-A9** The reducer's transition dispatch is `satisfies Record<WaveformSessionState, Record<WaveformEvent['type'], TransitionSpec>>` — TS refuses a missing cell at build time.

### 6.2 Runtime-asserted (b)

- **INV-B1** Reducer returns `Object.freeze`d artifacts AND `Object.freeze`s `artifact.amplitudeBuckets`. Both `Object.isFrozen(artifact) === true` and `Object.isFrozen(artifact.amplitudeBuckets) === true`.
- **INV-B2** `sampleCount === 0` ⟹ `amplitudeBuckets.length === 0` AND `peakLevel === 0` AND `meanLevel === 0` AND `activeDurationMs === 0`. Reducer asserts before yielding.
- **INV-B3** Input sanitation is total — the reducer NEVER throws on a malformed `level_sample.normalizedLevel`. NaN / +Infinity / -Infinity / negative -> 0; `>1` -> 1.
- **INV-B4** `amplitudeBuckets.length <= MAX_AMPLITUDE_BUCKETS` (256). Enforced by the online adaptive halving (never grows beyond 256 by construction) AND runtime-asserted in `makeArtifact`.
- **INV-B5** Every `amplitudeBuckets[i]` is a finite number in [0, 1].
- **INV-B6** `USER_START` in `{accumulating, finalizing}` is a pure no-op: `sessionId`, `waveformId`, `audioSource`, `sessionStartedAt`, `amplitudeBuckets`, `bucketWidth`, `samplesInCurrentBucket`, `sampleCount`, `peakLevel`, `meanSumInt65535`, `activeFrameCount`, `firstSampleTsMs`, `lastSampleTsMs`, `streamStartFired` all UNCHANGED (`Object.is` on each) — regardless of whether payload `sessionId`/`waveformId`/`audioSource` differ.
- **INV-B7** `producedArtifact` is non-null only on the transition into `finalized`, `aborted`, `no_signal`, or `error`. On every other reducer invocation (including transitions into `unavailable`, all IGNOREs, and every subsequent event once a terminal is reached), `producedArtifact === null`.
- **INV-B8** JSON round-trip: `JSON.parse(JSON.stringify(artifact))` deep-equals the artifact (including `amplitudeBuckets`). No `Date` objects; only ISO strings. All fields JSON-primitive.
- **INV-B9** `level_sample` in `finalizing` or any terminal is IGNORE (byte-identical no-op via `Object.is`). Guards against native leak of stale metering frames.
- **INV-B10** `sessionEndedAt >= sessionStartedAt` after format-regex validation `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`. String-compare is valid only for validated Z-suffixed strings of identical length.
- **INV-B11** 8-bit quantization on terminal fold — every bucket runs through `Math.round(bucket * 255) / 255` before `Object.freeze`. Idempotent (second pass yields byte-identical output). Non-negotiable given the anti-steganography posture.
- **INV-B12** `SILENCE_THRESHOLD = 0.02` and `MIN_SAMPLES_FOR_FINALIZED = 3` are module constants, never accepted as configuration arguments, event payload fields, or overrides. Source-scan asserts the string `SILENCE_THRESHOLD` appears exactly once in the reducer module (its declaration) and nowhere else in the waveform tree; same for `MIN_SAMPLES_FOR_FINALIZED`. Closes covert-channel classes.
- **INV-B13** meanLevel bit-exactness across engines: pinned fixture snapshot test — a fixed 10,000-sample seeded fixture produces a byte-identical `meanLevel` against a pre-computed reference value. Guards against future `array.reduce` refactor introducing float-order non-determinism.
- **INV-B14** Rate-invariance: same input sample sequence emitted at 10 Hz, 100 Hz, 1000 Hz produces byte-identical `amplitudeBuckets`, `peakLevel`, `meanLevel`. Only `durationMs` differs. Property test.
- **INV-B15** Halving-fold determinism: splitting N samples into k chunks (`k in {1, 2, 5, 7, 13, 100, 1000}`) and driving the reducer per chunk yields a terminal artifact deep-equal to the single-shot artifact.
- **INV-B16** Entropy bound: total distinct bucket values in a produced artifact is at most 256; JSON payload byte-size is bounded (proves INV-B11 quantization enforced).

### 6.3 Source-scan-guarded (c) — the doctrine guard

A single test file `__tests__/voice004ForbiddenInferenceGuard.test.ts` mirrors VOICE-003's bidirectional pattern:

1. **Assert-absent lexicon.** Scan all files matching `src/features/voice/waveform/**/*.ts` (excluding `__fixtures__/**` and the guard test itself). The scanner enumerates field names, type members, string literals, and comments. Zero matches are required for these tokens (case-insensitive whole-word where applicable):

   **VOICE-003 lexicon inherited verbatim** (copy-and-extend, not shared import — see risk note in §11): `emotion`, `tone`, `stress`, `anger`, `angry`, `mood`, `sentiment`, `honesty`, `honest`, `sincerity`, `sincere`, `manipulation`, `manipulative`, `biometric`, `biometrics`, `identity`, `credibility`, `credible`, `intent`, `intention`, `truth`, `truthful`, `winner`, `loser`, `verdict`, `liar`, `dishonest`, `badFaith`, `bad_faith`, `bad faith`, `extremist`, `propagandist`, `recognitionConfidence`, `recognizerConfidence`, `speakerConfidence`, `confidence`, `heavilyEdited`, `heavily_edited`, `suspicious`, `genuineness`, `genuine`, `authenticity`, `authentic`.

   **VOICE-004 waveform-specific bans (NEW)** — signal-reconstruction, speaker-inference, and voice-inference tokens: `arousal`, `energyLevel`, `energy_level`, `intensity`, `agitation`, `excitement`, `passion`, `volume` (as whole-word field name), `loudness` (as whole-word field name), `shouting`, `shouting_indicator`, `shoutingIndicator`, `whisper`, `aggression`, `aggression_level`, `aggressionLevel`, `dominance`, `dominance_index`, `dominanceIndex`, `assertiveness`, `assertivenessScore`, `emotionalIntensity`, `stressScore`, `angerScore`, `speakerEnergy`, `speakerActivity`, `speakerId`, `speaker_id`, `speakerRecognition`, `speaker_recognition`, `voice stress`, `voice-stress`, `voice_stress`, `voice print`, `voice-print`, `voiceprint`, `voice biometric`, `voice-biometric`, `formant`, `phoneme`, `spectrogram`, `fft`, `fourier`, `melspec`, `mfcc`, `prosody`, `cepstral`, `pitch`, `f0`.

   Whole-word rules use `\bTOKEN\b` case-insensitive. `envelope` is banned as a **field name substring** (`readonly envelope`, `envelope:`) but not as a comment token (the reducer file uses `envelope` in a comment "bounded amplitude envelope" — allowed because the ban targets fields/identifiers). If a future field genuinely needs one of these tokens it must be added to a doctrine allowlist in a separate ratification card.

2. **Assert-no raw-audio identifier.** Scan the tree for `pcm`, `audioBlob`, `audioBuffer`, `Uint8Array` (except in a doctrine-explanation comment), `sampleBuffer`, `rawSamples`, `AudioBuffer`, `storageKey`, `signedUrl`, `waveformPcm`, `rawPcm`, `readonly pcm`, `readonly rawSamples`, `readonly audioBlob`, `readonly audioBuffer`, `readonly waveformPcm`. Zero matches. `bucket` as a whole word is banned to avoid the S3-bucket connotation; the compound identifiers `amplitudeBuckets`, `bucketWidth`, `samplesInCurrentBucket`, `bucketCount` (in tests, not the artifact — the artifact drops `bucketCount`) are explicitly allowlisted via a `WHITELISTED_COMPOUNDS` array in the guard test file.

3. **Assert-`audioUri`-null-only** (extension of VOICE-003 rule). Every occurrence of `audioUri` in `src/features/voice/waveform/**` appears on a line that also carries the token `null`, and never adjacent to `bucket`, `s3`, `mp3`, `wav`, `pcm`, `bytes`, `blob`, `storageKey`, `signedUrl`, `uri`, `url`, `URI`, `URL`, `string`.

4. **Assert-reserved-literals-only-in-types-file.** The string literals `'stream_pcm'` and `'cache_temp_deleted'` in `src/features/voice/waveform/**` appear only in `voiceWaveformArtifact.types.ts`. The reducer implementation must not reference either literal — v1 emits `'metering_only'` exclusively.

5. **Assert-module-constants-scoped.** The strings `SILENCE_THRESHOLD` and `MIN_SAMPLES_FOR_FINALIZED` appear only in `waveformSessionMachine.ts` (their declaration) and in the barrel `index.ts` (their re-export). Never as an event payload field, never as a function parameter, never as a configuration override.

6. **Assert-pure-TS boundary.** The waveform tree imports nothing from `react`, `react-native`, `expo-audio`, `expo-*`, `@supabase/`, `fetch`, `XMLHttpRequest`, `AbortController`, `WebSocket`. Byte-level scan; zero matches. Mirrors VOICE-003's speech-module boundary.

7. **FIRING POSITIVE CONTROL.** A fixture at `src/features/voice/waveform/__fixtures__/voice004ForbiddenInferenceGuard.positiveControl.ts.txt` (extension `.ts.txt` so it does not compile AND is not picked up by ESLint recurse — load-bearing per user-memory `eslint-scans-claude-tmp-ts-scratch.md`) contains intentional banned tokens covering three roles AND at least one waveform-specific ban:

   - Comment role: banned token in a `//` comment (`// This computes emotional intensity from formant peaks`).
   - Field-name role: banned token as a field name (`readonly stressScore: number`, `readonly speakerId: string`).
   - String-literal role: banned token in a `const` string (`const label = 'angry_shouting_voiceprint';`).

   The companion test loads the fixture as text and asserts the scanner reports **at least 3 distinct hits across the three roles AND at least one waveform-specific ban** (e.g. `formant`, `stressScore`, `speakerId`, `voiceprint`). If the scanner is broken (regex typo, glob mistake), this test fails loudly. This is the load-bearing safeguard against the classic silent-cohesion-guard bug class — non-negotiable per VOICE-003 lesson.

- **INV-C1** All (a) source-scan rules above pass on the shipped module.
- **INV-C2** The positive-control fixture proves the scanner bites.
- **INV-C3** No reducer-state ring buffer of raw samples — the fold is online and never retains a raw sample sequence. Enforced by source-scan on `rawSamples`, `sampleBuffer`, and by inspection of `WaveformSessionMachineState` (which carries only the 256-bucket array plus scalars).
- **INV-C4** Comments in files scanned by the doctrine guard are apostrophe-free (per user-memory `doctrine-scanner-apostrophe-gotcha.md`). Reviewer confirms.

---

## §7 — Test plan

Target: **100% branch coverage on `reduceWaveformSession`** per the card AC.

Test files (all in top-level `__tests__/` per repo convention, mirrors VOICE-003):

1. `__tests__/waveformSessionMachine.test.ts` — transition matrix, reducer semantics, invariants (b).
2. `__tests__/voiceWaveformArtifact.test.ts` — type-level tests (a), field invariants, JSON round-trip, freeze.
3. `__tests__/voice004ForbiddenInferenceGuard.test.ts` — the (c) source-scan guard, both assert-absent AND the firing positive control.
4. `__tests__/deriveWaveformSummary.test.ts` — sibling projection helper.
5. `__tests__/normalizeMeteringDbFsToAmplitude.test.ts` — sibling dBFS -> [0,1] helper.

### 7.1 Transition-per-cell tests (parametric `describe.each` / `test.each`)

Twenty-eight named scenarios + one blanket IGNORE matrix.

| #  | Scenario                                                                              | Start state    | Event(s)                                                                                                                                                                       | Expected next state | Expected artifact                                                                                                                                          |
| -- | ------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Happy path — 5 samples then stream_end                                                | idle           | USER_START (offerable+supported), stream_start, 5 x level_sample (0.2, 0.4, 0.6, 0.4, 0.2 at ts 50/100/150/200/250), stream_end                                                 | finalized           | terminalState='finalized', amplitudeBuckets length 5, peakLevel=0.6, meanLevel≈0.36, sampleCount=5, durationMs=200, audioSource='metering_only', rawAudioPersisted=false, audioUri=null, artifact frozen, buckets frozen |
| 2  | Zero-sample happy path — USER_START then stream_end without any level_sample          | idle           | USER_START, stream_end                                                                                                                                                        | no_signal           | terminalState='no_signal', amplitudeBuckets=[], peakLevel=0, meanLevel=0, sampleCount=0, durationMs=0, activeDurationMs=0                                  |
| 3  | Below-threshold — 2 samples on stream_end -> no_signal (sampleCount < MIN=3)          | idle           | USER_START, 2 x level_sample, stream_end                                                                                                                                     | no_signal           | terminalState='no_signal', amplitudeBuckets length 2 (folded), scalars computed but no_signal terminal                                                     |
| 4  | Exactly-threshold — 3 samples on stream_end -> finalized                              | idle           | USER_START, 3 x level_sample, stream_end                                                                                                                                     | finalized           | terminalState='finalized', amplitudeBuckets length 3                                                                                                       |
| 5  | Single-sample USER_ABORT -> aborted with 1 bucket                                     | idle           | USER_START, 1 x level_sample{0.5}, USER_ABORT                                                                                                                                | aborted             | terminalState='aborted', amplitudeBuckets=[128/255], peakLevel=0.5, meanLevel≈0.5, sampleCount=1, durationMs=0                                             |
| 6  | Above-1 level clamped                                                                 | idle           | USER_START, level_sample{1.5}, stream_end                                                                                                                                     | no_signal           | amplitudeBuckets=[1], peakLevel=1, no throw                                                                                                                |
| 7  | NaN treated as 0                                                                      | idle           | USER_START, level_sample{NaN}, stream_end                                                                                                                                     | no_signal           | amplitudeBuckets=[0], peakLevel=0                                                                                                                          |
| 8  | +Infinity treated as 0 (not clamped to 1)                                             | idle           | USER_START, level_sample{Infinity}, stream_end                                                                                                                                | no_signal           | amplitudeBuckets=[0], peakLevel=0                                                                                                                          |
| 9  | Negative level clamped to 0                                                           | idle           | USER_START, level_sample{-0.7}, stream_end                                                                                                                                    | no_signal           | amplitudeBuckets=[0], peakLevel=0                                                                                                                          |
| 10 | dBFS-shaped negative (e.g. -6) clamped, not rejected (adapter bug defense)            | idle           | USER_START, level_sample{-6}, stream_end                                                                                                                                      | no_signal           | amplitudeBuckets=[0]; proves INV-B3 catches an adapter that forgot to normalize                                                                            |
| 11 | Identity fold at N=256                                                                | idle           | USER_START, 256 x level_sample (distinct levels i/256), stream_end                                                                                                            | finalized           | amplitudeBuckets length 256; each bucket = quantized(i/256); bucketWidth stayed 1; no halving triggered                                                    |
| 12 | N=257 triggers first halving                                                          | idle           | USER_START, 257 x level_sample, stream_end                                                                                                                                    | finalized           | amplitudeBuckets length 129 (256 halved to 128 + 1 new); first 128 = max of adjacent pairs                                                                 |
| 13 | N=512 exactly one halving completes                                                   | idle           | USER_START, 512 x level_sample, stream_end                                                                                                                                    | finalized           | length 256; each bucket = max of 2 adjacent originals; bucketWidth=2                                                                                       |
| 14 | Rate-invariance — 100 samples at 10Hz vs 100Hz vs 1000Hz -> byte-identical buckets (INV-B14) | idle           | Three runs, same 100 level values, sourceTimestampMs stepping 100 / 10 / 1 ms                                                                                                | finalized           | JSON.stringify(A.amplitudeBuckets) === JSON.stringify(B) === JSON.stringify(C); peakLevel/meanLevel identical; only durationMs differs                     |
| 15 | Halving-fold determinism — split N=5000 samples into k in {1,2,5,7,13,100,1000} chunks (INV-B15) | idle | 6 reducer runs each fed chunked events, then stream_end                                                                                                                    | finalized           | All 6 terminal artifacts deep-equal to the single-shot artifact                                                                                             |
| 16 | Determinism across three runs with identical inputs                                   | idle           | Fixed 1000-sample deterministic fixture, run reducer three times                                                                                                              | finalized           | JSON.stringify(A) === JSON.stringify(B) === JSON.stringify(C)                                                                                              |
| 17 | Peak-fold associativity — order-independent within a bucket                           | idle           | 4 samples [0.1, 0.9, 0.2, 0.8] folding 2-per-bucket via bucketWidth=2 path                                                                                                    | finalized           | Buckets=[quantized(0.9), quantized(0.8)] regardless of halving path                                                                                        |
| 18 | meanLevel cross-engine bit-exact (INV-B13) — pinned 10,000-sample fixture             | idle           | Fixed seeded fixture, run reducer                                                                                                                                             | finalized           | meanLevel === pre-computed reference value (fixture-pinned)                                                                                                |
| 19 | Silence threshold — samples below 0.02 excluded from activeDurationMs                 | idle           | USER_START, 50 x level_sample{0.01}, 50 x level_sample{0.5} across ts 0..1000, stream_end                                                                                    | finalized           | activeDurationMs ≈ 500; durationMs ≈ 1000; activeFrameCount internally = 50                                                                                |
| 20 | level_sample in `finalizing` IGNORED (INV-B9)                                         | finalizing     | level_sample{0.9}                                                                                                                                                              | finalizing          | state Object.is-unchanged; producedArtifact = null                                                                                                          |
| 21 | level_sample in `finalized` IGNORED — artifact immutable                              | finalized      | level_sample{1.0}                                                                                                                                                              | finalized           | state unchanged; no second artifact                                                                                                                         |
| 22 | USER_ABORT from `accumulating` -> aborted; interim samples preserved                   | accumulating   | USER_ABORT                                                                                                                                                                    | aborted             | terminalState='aborted', amplitudeBuckets from before abort                                                                                                |
| 23 | stream_error{metering_lost} mid-accumulation                                          | accumulating   | stream_error{code:'metering_lost'}                                                                                                                                            | error               | terminalState='error', lastErrorCode='metering_lost', buckets preserved                                                                                    |
| 24 | AVAILABILITY_LOST{permission_revoked} mid-accumulation -> unavailable, null artifact   | accumulating   | AVAILABILITY_LOST                                                                                                                                                              | unavailable         | producedArtifact === null; samples discarded                                                                                                                |
| 25 | Defensive fallthrough — USER_START with waveformOfferable=false                       | idle           | USER_START (capability.waveformOfferable=false)                                                                                                                                | unavailable         | producedArtifact === null                                                                                                                                    |
| 26 | Defensive fallthrough — USER_START with meteringSupported=false                       | idle           | USER_START (capability.meteringSupported=false)                                                                                                                                | unavailable         | producedArtifact === null                                                                                                                                    |
| 27 | Late stream_error after finalized does NOT retract (INV-B7 first terminal wins)        | finalized      | stream_error{code:'metering_lost'}                                                                                                                                            | finalized           | artifact from prior yield STANDS; producedArtifact === null on this call                                                                                    |
| 28 | Late AVAILABILITY_LOST after aborted IGNORED                                          | aborted        | AVAILABILITY_LOST                                                                                                                                                              | aborted             | state unchanged                                                                                                                                             |
| 29 | USER_START double-tap in accumulating is idempotent (INV-B6)                          | accumulating   | USER_START (second time)                                                                                                                                                       | accumulating        | sessionId, waveformId, sessionStartedAt UNCHANGED                                                                                                          |
| 30 | USER_START with DIFFERENT sessionId in accumulating IGNORED (hijack close, INV-B6)     | accumulating   | USER_START{sessionId='B', waveformId='wf-B', audioSource='stream_pcm'}                                                                                                        | accumulating        | state's sessionId remains 'A', waveformId 'wf-A', audioSource 'metering_only' — all Object.is-unchanged                                                    |
| 31 | USER_RESET from each of the 5 terminals -> idle                                       | (each terminal)| USER_RESET                                                                                                                                                                     | idle                | deep-equal to initialWaveformSessionState()                                                                                                                 |
| 32 | idle IGNOREs stray metering events                                                    | idle           | level_sample without prior USER_START                                                                                                                                          | idle                | state unchanged                                                                                                                                             |
| 33 | Out-of-order sourceTimestampMs (mid-stream)                                           | idle           | USER_START, level_sample{0.5, ts=0}, level_sample{0.6, ts=100}, level_sample{0.7, ts=50}, level_sample{0.4, ts=200}, level_sample{0.3, ts=300}, stream_end                     | finalized           | sampleCount=5; index-driven fold preserves ordering; firstSampleTsMs=0, lastSampleTsMs=300; durationMs=300                                                 |
| 34 | Non-monotonic terminal timestamps -> durationMs floors to 0 defensively               | idle           | USER_START, level_sample{0.5, ts=300}, level_sample{0.6, ts=100}, stream_end                                                                                                  | no_signal           | durationMs=0 (lastSampleTsMs < firstSampleTsMs; defensive floor, no throw)                                                                                  |
| 35 | Terminal fold quantization idempotent (INV-B11)                                       | (after any yield) | quantize buckets again via `Math.round(b * 255) / 255`                                                                                                                       | n/a                 | Second pass yields byte-identical buckets                                                                                                                   |

**Blanket IGNORE matrix test #36.** `test.each` over the full Cartesian product `(state x event)` for the ~40 cells NOT covered above; asserts `nextState === state` AND `producedArtifact === null` AND every field on `WaveformSessionMachineState` is `Object.is`-unchanged.

### 7.2 Artifact-invariant tests (`voiceWaveformArtifact.test.ts`)

- **T-A1** `TypeEqual<VoiceWaveformArtifact['audioUri'], null>` (via `expectTypeOf` or `tsd`).
- **T-A2** `TypeEqual<VoiceWaveformArtifact['rawAudioPersisted'], false>`.
- **T-A3** Reducer's produced-artifact return type equals `FreshVoiceWaveformArtifact` (audioSource narrowed to `'metering_only'`).
- **T-A4** `TypeEqual<VoiceWaveformArtifact['terminalState'], 'finalized' | 'aborted' | 'no_signal' | 'error'>`.
- **T-A5** `Exclude<keyof VoiceWaveformArtifact, 'pcm' | 'rawSamples' | 'audioBlob' | 'audioBuffer' | 'rawPcm' | 'sampleBuffer' | 'waveformPcm' | 'storageKey' | 'signedUrl'>` equals `keyof VoiceWaveformArtifact` (no forbidden fields declared).
- **T-A6** TS compile error: attempt `{ ..., rawAudioPersisted: true, ... }` -> `Type 'true' is not assignable to type 'false'`.
- **T-A7** TS compile error: attempt `{ ..., audioSource: 'cloud_stored', ... }` -> `Type ... is not assignable ...`.
- **T-A8** `Object.isFrozen(artifact) === true` AND `Object.isFrozen(artifact.amplitudeBuckets) === true` for every yielded artifact.
- **T-A9** Strict-mode assignment throws `TypeError` on `artifact.peakLevel = 0`; on `artifact.amplitudeBuckets.push(0)`.
- **T-A10** JSON round-trip deep-equal, including the buckets array.
- **T-A11** Runtime assertion INV-B2: `sampleCount === 0` ⟹ empty buckets + zero scalars, on the `no_signal` zero-sample artifact.
- **T-A12** `sampleCount >= 0`; `peakLevel`, `meanLevel`, `amplitudeBuckets[i]` all in [0, 1]; `meanLevel <= peakLevel`.
- **T-A13** `sessionEndedAt >= sessionStartedAt` after format-regex validation (INV-B10).
- **T-A14** No artifact yielded on `unavailable` transitions (producedArtifact === null across all 3 unavailable-entry pairs: `idle + USER_START(offerable=false)`, `idle + AVAILABILITY_LOST`, `accumulating + AVAILABILITY_LOST`).
- **T-A15** Every produced artifact carries `audioSource === 'metering_only'`, `rawAudioPersisted === false`, `audioUri === null`.
- **T-A16** `lastErrorCode` is non-null iff `terminalState === 'error'`.
- **T-A17** Entropy bound (INV-B16): a produced artifact's amplitudeBuckets contains at most 256 distinct values; every value is exactly `k / 255` for some integer `0 <= k <= 255`.
- **T-A18** Naive-reconstruction negative control: expand a produced 256-bucket artifact via nearest-neighbor upsampling to a 65,536-sample synthetic sequence; a test-file-local FFT helper computes spectral entropy of the result and asserts it is below a fixed floor (proves magnitude envelope alone carries no formant content). The FFT helper stays in the test file, not the production module.

### 7.3 Source-scan guard tests (`voice004ForbiddenInferenceGuard.test.ts`)

- **T-C1** Assert-absent lexicon (§6.3.1) — zero matches over `src/features/voice/waveform/**/*.ts`, excluding `__fixtures__/**` and this test file. Case-insensitive whole-word.
- **T-C2** Assert-no raw-audio identifier (§6.3.2) — zero matches for `pcm`, `audioBlob`, `audioBuffer`, `Uint8Array`, `sampleBuffer`, `rawSamples`, `AudioBuffer`, `storageKey`, `signedUrl`, `waveformPcm`, `rawPcm`, `readonly pcm`, `readonly rawSamples`, `readonly audioBlob`, `readonly audioBuffer`, `readonly waveformPcm`; whole-word `bucket` banned outside the `WHITELISTED_COMPOUNDS = ['amplitudeBuckets', 'bucketWidth', 'samplesInCurrentBucket', 'bucketCount']` allowlist.
- **T-C3** `audioUri` context assertion (§6.3.3) — every occurrence adjacent to `null`, never to a URI/URL/bucket/pcm/blob/bytes/storageKey/signedUrl token.
- **T-C4** Reserved-literal placement (§6.3.4) — `'stream_pcm'` and `'cache_temp_deleted'` appear only in `voiceWaveformArtifact.types.ts`. Positive-control side of the assertion: the types file DOES carry each literal (asserts the scanner is not merely finding zero because it is broken).
- **T-C5** Module-constant scoping (§6.3.5) — `SILENCE_THRESHOLD` and `MIN_SAMPLES_FOR_FINALIZED` string occurrences bounded to reducer file + barrel.
- **T-C6** Pure-TS boundary (§6.3.6) — no imports from `react`, `react-native`, `expo-audio`, `expo-*`, `@supabase/`, `fetch`, `XMLHttpRequest`, `AbortController`, `WebSocket`.
- **T-C7** FIRING POSITIVE CONTROL (§6.3.7): load the `.ts.txt` fixture as text; assert scanner reports at least 3 distinct hits across three roles AND at least one waveform-specific ban token among the hits. If it reports zero, the test fails loudly.
- **T-C8** Apostrophe-free comments in files scanned by the guard (INV-C4) — asserts the reducer, types, and sibling files carry no apostrophes in `//` or `/* */` comments (per doctrine-scanner-apostrophe-gotcha memory).

### 7.4 `deriveWaveformSummary` tests

- **T-D1** Non-degenerate `finalized` artifact with 10 buckets: `peakLevel = max(buckets)`, `meanLevel = mean(buckets)`, `activeDurationMs` echoes artifact, `silentBucketRatio = countBelowThreshold / 10`, `isDegenerate = false`.
- **T-D2** Zero-bucket `no_signal` artifact: `peakLevel = 0`, `meanLevel = 0`, `silentBucketRatio = 0` (no buckets to count), `isDegenerate = true` (terminalState !== 'finalized').
- **T-D3** `finalized` artifact with `sampleCount === 2` — unreachable in practice (MIN=3), but defensively `isDegenerate = true` (sampleCount < MIN).
- **T-D4** All-silent buckets: `silentBucketRatio = 1`.
- **T-D5** `aborted` artifact with 100 buckets: `isDegenerate = true` regardless of sampleCount (terminal is not finalized).
- **T-D6** `error` artifact: `isDegenerate = true`.
- **T-D7** Pure-fn property: `deriveWaveformSummary(a)` deep-equals `deriveWaveformSummary(a)` on two calls (no side effect).

### 7.5 `normalizeMeteringDbFsToAmplitude` tests

- **T-N1** `-160 dBFS` -> 0 (native silence sentinel).
- **T-N2** `-60 dBFS` -> 0 (silence floor).
- **T-N3** `-30 dBFS` -> 0.5.
- **T-N4** `-6 dBFS` -> 0.9.
- **T-N5** `0 dBFS` -> 1 (clip).
- **T-N6** `+10 dBFS` -> 1 (clamped clip).
- **T-N7** `NaN` -> 0 (non-finite).
- **T-N8** `+Infinity` -> 1 (positive-infinite clamps to clip since `(Inf + 60) / 60 = Inf`, then clamp to 1). NOTE: implementation must explicitly check `!Number.isFinite(dbfs)` FIRST and return 0 (matching INV-B3-style non-finite handling) — otherwise +Infinity would slip through to clip. Ruling: **non-finite always maps to 0**, mirroring INV-B3 defense.
- **T-N9** `-Infinity` -> 0.
- **T-N10** Determinism: same input twice yields identical output; no engine dependency.

**Expected suite size: ~55 test cases across 5 files.**

---

## §8 — File layout

```
src/features/voice/waveform/
  waveformSessionMachine.ts             // reducer + initial state + module constants
  voiceWaveformArtifact.types.ts        // VoiceWaveformArtifact + FreshVoiceWaveformArtifact + Terminal union
  deriveWaveformSummary.ts              // pure post-artifact projection helper
  normalizeMeteringDbFsToAmplitude.ts   // pure dBFS -> [0,1] helper
  index.ts                              // barrel — re-exports the public API above
  __fixtures__/
    voice004ForbiddenInferenceGuard.positiveControl.ts.txt  // .ts.txt so it does not compile OR lint-recurse
__tests__/
  waveformSessionMachine.test.ts
  voiceWaveformArtifact.test.ts
  voice004ForbiddenInferenceGuard.test.ts
  deriveWaveformSummary.test.ts
  normalizeMeteringDbFsToAmplitude.test.ts
```

**Split rationale.** Types live in `voiceWaveformArtifact.types.ts` alone so the source-scan rule "`'stream_pcm'` / `'cache_temp_deleted'` appear only in type declarations" can be a single-file allowlist. `deriveWaveformSummary` is a sibling file (not part of the reducer module) because it is a post-artifact projection with a different concern surface. `normalizeMeteringDbFsToAmplitude` is a sibling helper so the reducer module keeps the "core accepts only [0,1]" contract clean and the adapter has a single canonical import point. `index.ts` is the sole public entry point. Test files in top-level `__tests__/` mirrors VOICE-003 (repo convention).

---

## §9 — Non-goals

The card's non-goals PLUS what the panel and critic surfaced:

- No React, no hooks, no components. This is a reducer, not a UI.
- No React Native, no `expo-audio`, no `expo-*` imports. The metering adapter (later card — VOICE-005 spike or VOICE-004b) imports `expo-audio`; this module imports neither.
- No Supabase, no `@supabase/supabase-js`, no network, no fetch, no XHR, no WebSocket, no AbortController.
- No persistence — session state is process-local; a page reload discards it.
- No audio persistence (v1 audioSource='metering_only'); no signed URLs; no client-side blob handling; no S3 or storage token.
- No live rendering / no waveform SVG generation / no bar-chart component / no Skia stream / no snapshot / no PNG output — all display concerns belong to the adapter and VOICE-005 spike.
- No dB -> linear conversion inside the reducer core (moved to sibling `normalizeMeteringDbFsToAmplitude`).
- No transcript pairing logic inside this module — pairing is by shared `sessionId` at the adapter layer.
- No `recognitionConfidence` / `recognizerConfidence` / `confidence` / `speakerConfidence` — deferred entirely per ADR-002 §0.
- No emotion / tone / stress / arousal / shouting / whisper / aggression / dominance / assertiveness / passion / energy-as-trait / speaker-recognition / speaker-identity — banned by doctrine (§6).
- No speech-reconstruction signal — no formant, phoneme, spectrogram, fft, mfcc, prosody, pitch, f0, cepstral analysis. Banned by doctrine (§6).
- No `bucketCount` field (dropped as redundant with `amplitudeBuckets.length`).
- No RMS calculation (dropped in favor of arithmetic `meanLevel` for cross-engine determinism).
- No configurable `silenceThreshold` / `minSamplesForFinalized` — module constants, non-configurable, source-scan enforced (INV-B12) to close covert-channel classes.
- No per-sample ISO timestamps — `sourceTimestampMs` is integer relative ms; per-sample first/last ISO would balloon session allocation to 1.8 MB per 60,000 samples.
- No timestamp-driven bucket assignment — index-driven only (rate-invariant, defeats rate-carrier steganographic channel).
- No pair-averaging halving — pair-max only (bit-exact, preserves envelope salience).
- No MCP, no ML, no analytics — the artifact is a plain data record.
- No cross-host concurrency logic — the reducer is single-session; the adapter enforces at-most-one active session per debate.id.
- No permission / consent flows — adapter's concern; the reducer sees a capability snapshot at `USER_START` and fails closed if `waveformOfferable === false` OR `meteringSupported === false`.
- No UI copy — user-facing strings route through `gameCopy.toPlainLanguage` in the adapter.
- No auto-recover of `unavailable` — adapter must `USER_RESET` and re-probe capability.
- No shared-lexicon module import from VOICE-003's guard (deferred to a follow-up DRY refactor — see §11 risk).
- No `deriveWaveformDisplayMode` / `deriveWaveformPresentation` — deferred to VOICE-005 spike; those touch display concerns.

---

## §10 — Boundary (what Claude does NOT do)

- NO Anthropic API call by Claude
- NO xAI API call by Claude
- NO X (Twitter) API call by Claude
- NO Supabase write by Claude
- NO service-role usage by Claude
- NO database migration by Claude
- NO Edge Function deploy by Claude
- NO feature flag flip by Claude
- NO Netlify or hosted-app deploy by Claude
- NO `.env*` file edit by Claude
- NO `git push`, `git commit`, or branch switch by Claude in the design phase (the orchestrator commits after review)
- NO Bootstrap or web-only dependency added (per expo-rn-patterns)
- NO reproduction of copyrighted material

---

## §11 — Open questions for the operator

None load-bearing. The design ships a self-contained answer for every panel contradiction and every critic gap. The following are surfaced for operator awareness but require no ruling to implement:

1. **`VOICE_WAVEFORM_MACHINE_VERSION` semver source.** The design uses a string constant in the module (`'1.0.0'` for the first shipped version), mirroring VOICE-003. If the operator wants this pinned to `package.json` version, the constant can be replaced with a build-time inline — but that violates the pure-reducer contract. Recommend leaving as a hard-coded constant that ratchets on each intentional VOICE-004 change.

2. **Positive-control fixture extension.** The design uses `.ts.txt` so the fixture does not compile AND is not picked up by ESLint recurse (per user-memory `eslint-scans-claude-tmp-ts-scratch.md`). If the operator prefers a different convention, the guard test can be adjusted — the load-bearing property is only that the fixture is text-loaded, not compiled.

3. **Shared doctrine-lexicon extraction.** VOICE-004's guard test COPIES VOICE-003's forbidden-inference lexicon inline (whole-word + substring bans) and EXTENDS with waveform-specific tokens. A follow-up card can DRY this to `src/features/voice/__shared__/doctrineLexicon.ts` once both guards have shipped and the lexicon has stabilized. Refactoring VOICE-003's shipped guard test as part of VOICE-004's PR would expand blast radius; recommend the follow-up card.

4. **`meanSummary` vs `meanLevel` naming.** VOICE-001 §5.1 sketch used `rmsSummary`. This design ships `meanLevel` (arithmetic mean via integer accumulator, not true RMS — cross-engine determinism reason). Operator may want to keep the `rmsSummary` name from the sketch with a JSDoc note that it is arithmetic mean, or prefer the more precise `meanLevel` name. Recommend `meanLevel` (name matches semantics).

5. **`stream_start` as a distinct event.** Included even though it does not change state (self-loop in `accumulating`, IGNORE elsewhere) — legibility marker and future MCP Family K provenance. Operator may prefer to drop it and let `level_sample` be the sole signal that metering is live. Recommend keeping — matches VOICE-003's `speechstart` pattern.

6. **`ArgumentSurfaceMode` / MCP Family K integration.** This module produces a `VoiceWaveformArtifact` but does not wire it to MCP Family K or the SQL table (VOICE-DB is a later card). Downstream cards attach the pair. No ruling needed at this stage.

7. **RN-side test runner engine.** The bit-exactness fixture (INV-B13) pins a reference value computed under Node V8. If the CI matrix later adds a Hermes-only lane, the same fixture must produce the same reference value (that is the whole point). Operator confirms the CI matrix at their discretion; no design change.

---

## §12 — Acceptance mapping (issue 662 AC -> design section)

| Card AC bullet (paraphrased)                                                                                    | Satisfied by                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Pure TS module, no imports from React/Supabase/network/native/expo-audio                                          | §1 exports, §8 file layout, §9 non-goals, §6 INV-C6 (source-scan)   |
| Reducers to fold incoming level samples into bounded buckets deterministically                                    | §4 fold algorithm, INV-B14/B15 rate-invariance + halving determinism |
| `VoiceWaveformArtifact` with `rawAudioPersisted: false` (card AC verbatim)                                        | §5 field spec + INV-A2 literal + BOTH-fields reconciliation §0.1    |
| `audioUri: null` literal (inherited from VOICE-003)                                                               | §5 + INV-A1 + `voiceNoUrlInClientTypes.test.ts` extension           |
| `amplitudeBuckets` bounded to 256 normalized floats                                                               | §4.1 + §5 + INV-A6 + INV-B4                                          |
| No emotion / tone / stress / anger / speaker-inference fields                                                     | INV-C1 + §6.3 lexicon + positive control INV-C2                     |
| No speech-reconstruction signal (formant, phoneme, spectrogram, fft, mfcc)                                        | §6.3 extended lexicon INV-C1 + INV-A6 field-name absence type test  |
| 100% branch coverage on the reducer                                                                               | §7 — 35+ named scenarios + blanket IGNORE matrix                    |
| JSON-serializable state and events                                                                                | INV-B8 + §1 explicit types                                          |
| All fields readonly                                                                                               | §1 + §5 + INV-B1 (Object.freeze + inner-array freeze)                |
| Doctrine source-scan guard on the module                                                                          | §6.3 + §7.3 with firing positive control                             |
| Halving fold is deterministic                                                                                     | §4.2 fold rule + §4.4 determinism argument + INV-B14/B15             |
| Amplitude envelope is non-replayable                                                                              | §4.5 four-layer argument + INV-B11 + INV-B16 entropy bound + T-A18   |

---

*End of VOICE-004 design.*
