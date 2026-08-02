# VOICE-003 — Speech session state machine + SpeechTranscriptArtifact

- **Card:** issue 661
- **Governing contracts:** VOICE-ADR-002 (voice provenance ADR), VOICE-001 (voice shell + capability + doctrine boundary)
- **Status:** design ready for implementer
- **Scope:** pure-TS reducer over speech recognizer events + adapter-synthesized user events; typed SpeechTranscriptArtifact; forbidden-inference source-scan guard. No React, no native, no network, no persistence, no UI.

## Summary

Ship a JSON-serializable, side-effect-free reducer `reduceSpeechSession(state, event) => { nextState, artifactDraft, producedArtifact }` plus the `SpeechTranscriptArtifact` type it produces. The reducer covers a 10-state × 12-event grammar with a total transition matrix (every cell either ruled or explicitly ignored), yields an immutable `SpeechTranscriptArtifact` on the four "session actually happened" terminals, yields `null` on the "session was never offerable" terminal, and threads neutral recognizer provenance (recognizer, language, on-device, interim count, terminal reason) without ever encoding emotion, tone, stress, confidence-as-trait, honesty, sincerity, manipulation, biometric, identity, credibility, intent, or verdict signals. A bidirectional source-scan test with a firing positive-control fixture proves the doctrine guard bites.

---

## §0 — VOICE-001 + ADR-002 reconciliation (what the card AC says vs what ships)

The #661 acceptance criteria are **partially stale** because VOICE-001 already shipped the voice shell and VOICE-ADR-002 §0 rewrote the confidence rule after the card was written. This design adopts the newer contracts.

| #661 AC (stale)                                            | Ship (per ADR-002 + VOICE-001)                                                                                                                                                                    | Source                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `audioPersisted: false` (boolean literal on the artifact)  | `audioPersistence: 'none' \| 'scoped_governed'` (discriminated union). v1 reducer produces the literal `'none'` via a narrowed return type; `'scoped_governed'` is reserved for VOICE-DB/BE.       | VOICE-001 §5.1, ADR-002 §5 |
| `audioUri: null` (literal type)                            | **UNCHANGED — still ships.** `audioUri` is the TS literal type `null`, not `string \| null`, in every mode forever. The client NEVER holds an audio URI.                                            | VOICE-001 §5.3 invariant 1 |
| `recognitionConfidence?: number` (optional field)          | **REMOVED.** No `confidence`, `recognitionConfidence`, `recognizerConfidence`, or `speakerConfidence` field appears anywhere in `src/features/voice/**`. Deferred entirely for v1.                 | ADR-002 §0 wording patch   |
| Interim text may enter `finalTranscript` if session ends   | **NO.** Interim never becomes `rawTranscript`. A `hadFinalEvent` discriminant enforces the invariant. Interim-only Android platforms terminate to `timeout_no_speech` with no body-bound artifact. | ADR-002 §0 verbatim carry  |
| `submittedBody: string` on the artifact (VOICE-001 §5.1)   | **REMOVED from the artifact.** `submittedBody` lives in composer `draft.body`. `wasEdited` + `editDistance` are derived at submit time by `deriveEditedProvenance(rawTranscript, draft.body)`.     | Reconciles VOICE-001 §5.1  |
| `reviewing_transcript` as a `SpeechSessionState` value     | **NOT a session state.** Belongs to `VoiceInputMode = 'text_only' \| 'speech_active' \| 'reviewing_transcript'` — an adapter concern outside the recognizer's session lifecycle.                    | Panel consensus            |

The **card AC bullets that survive unchanged** are: pure-TS, no imports from React/Supabase/network/native; all fields readonly; JSON-serializable; the state machine covers idle/starting/listening/interim/final/interrupted/timeout_no_speech/error/unavailable; 100% branch coverage on the reducer.

---

## §1 — Exports

The module exports only the following names. No default export. No React hook, no adapter, no I/O.

```ts
// src/features/voice/speech/speechSessionMachine.ts

// State grammar
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

// Adapter-facing wider-scope discriminator (kept in this module because
// its terminal branch is co-derived; the adapter never re-derives it).
export type VoiceInputMode = 'text_only' | 'speech_active' | 'reviewing_transcript';

// Recognizer capability snapshot handed in at USER_START
export interface SpeechCapabilitySnapshot {
  readonly voiceOfferable: boolean;
  readonly recognizer: 'ios' | 'android' | 'web';
  readonly onDeviceRecognition: boolean;
  readonly language: string; // BCP-47
}

// Event grammar — see §3
export type RecognizerEvent =
  // Adapter-synthesized user-intent events (SCREAMING_SNAKE)
  | { type: 'USER_START'; sessionId: string; transcriptId: string; capability: SpeechCapabilitySnapshot; nowIso: string }
  | { type: 'USER_ABORT' }
  | { type: 'USER_RESET' }
  | { type: 'AVAILABILITY_LOST'; reason: 'permission_revoked' | 'service_unreachable' | 'recognizer_disabled' }
  // Recognizer-forwarded events (lowercase, matches upstream names)
  | { type: 'start' }
  | { type: 'speechstart' }
  | { type: 'result_interim'; transcript: string }
  | { type: 'result_final'; transcript: string }
  | { type: 'speechend' }
  | { type: 'end' }
  | { type: 'nomatch' }
  | { type: 'error'; code: SpeechErrorCode };

export type SpeechErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported';

// Internal reducer state — session-local, includes fields never exported on the artifact
export interface SpeechSessionMachineState {
  readonly state: SpeechSessionState;
  readonly sessionId: string | null;
  readonly transcriptId: string | null;
  readonly recognizer: 'ios' | 'android' | 'web' | null;
  readonly onDeviceRecognition: boolean;
  readonly language: string;
  readonly sessionStartedAt: string | null;   // ISO-8601 UTC
  readonly sessionEndedAt: string | null;
  readonly rawTranscript: string;              // populated only by result_final
  readonly latestInterimText: string;          // adapter-facing display; NEVER on artifact
  readonly interimCount: number;
  readonly speechStartFired: boolean;
  readonly hadFinalEvent: boolean;
  readonly lastErrorCode: SpeechErrorCode | null;
  readonly terminalState: TerminalStateForArtifact | null;
}

export type TerminalStateForArtifact = 'final' | 'interrupted' | 'timeout_no_speech' | 'error';
// Note: 'unavailable' is NOT in this union — that terminal yields null.

// Artifact — see §5
export interface SpeechTranscriptArtifact {
  readonly transcriptId: string;
  readonly sessionId: string;
  readonly recognizer: 'ios' | 'android' | 'web';
  readonly onDeviceRecognition: boolean;
  readonly language: string;
  readonly sessionStartedAt: string;
  readonly sessionEndedAt: string;
  readonly rawTranscript: string;         // empty iff hadFinalEvent === false
  readonly hadFinalEvent: boolean;
  readonly interimCount: number;
  readonly terminalState: TerminalStateForArtifact;
  readonly wasEdited: boolean;            // freshly produced: literal false
  readonly editDistance: number;          // freshly produced: literal 0
  readonly audioPersistence: 'none' | 'scoped_governed'; // v1: 'none'
  readonly audioUri: null;                // literal null type
  readonly producedByModuleVersion: string; // semver of speechSessionMachine
}

// Branded "just produced" shape — reducer return type is narrowed to this
export type FreshSpeechTranscriptArtifact = SpeechTranscriptArtifact & {
  readonly wasEdited: false;
  readonly editDistance: 0;
  readonly audioPersistence: 'none';
};

// Reducer return shape (co-derived state + artifact)
export interface SpeechReduceResult {
  readonly nextState: SpeechSessionMachineState;
  readonly producedArtifact: FreshSpeechTranscriptArtifact | null;
}

// The reducer itself
export function reduceSpeechSession(
  state: SpeechSessionMachineState,
  event: RecognizerEvent,
): SpeechReduceResult;

// Initial state factory
export function initialSpeechSessionState(): SpeechSessionMachineState;

// Adapter-facing derived-mode helper (projection, not a second state machine)
export function deriveVoiceInputMode(
  sessionState: SpeechSessionState,
  artifactSubmitted: boolean,
): VoiceInputMode;
```

And in a sibling file:

```ts
// src/features/voice/speech/deriveEditedProvenance.ts
export interface EditedProvenance {
  readonly wasEdited: boolean;
  readonly editDistance: number;
  readonly transcriptEditedAfterDictation: boolean; // wasEdited && terminalState === 'final'
}

export function deriveEditedProvenance(
  artifact: SpeechTranscriptArtifact,
  submittedBody: string,
): EditedProvenance;
// Uses Levenshtein distance. Returns wasEdited=false/0/false when
// artifact.terminalState !== 'final' (nothing to compare against).
```

---

## §2 — State grammar

Ten states. The four terminals that "record a session that actually happened" yield an artifact; `unavailable` yields `null`.

| State                | Purpose                                                                                                                                                                            | Terminal? | Yields artifact? |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------: | :--------------: |
| `idle`               | No session in flight. Text-only draft path is the sole input. Only `USER_START` and `AVAILABILITY_LOST` are meaningful; every other event is ignored.                                | no        | no               |
| `starting`           | Adapter has fired `USER_START`; awaiting the recognizer's `start` callback. Some platforms emit `speechstart`, `result_interim`, or `result_final` before `start` — all legal.       | no        | no               |
| `listening`          | Recognizer `start` fired; no interim received yet; no `speechstart` yet. Mic-active UX.                                                                                              | no        | no               |
| `interim`            | At least one `result_interim` or `speechstart` received. `latestInterimText` is being updated; `interimCount` is being incremented. Distinct state (not a facet) because `speechend` and `end` routing depends on whether any interim ever fired. | no        | no               |
| `finalizing`         | `speechend` fired; awaiting `result_final` (→ `final`) or `end`/`nomatch` (→ `timeout_no_speech`). Late `result_interim` is explicitly IGNORED here (INV-21).                       | no        | no               |
| `final`              | `result_final` (non-empty) received. `rawTranscript` set. Artifact yielded ONCE on the transition into this state. Late `error`/`end`/`result_interim`/`result_final` are no-ops.    | yes       | **yes**          |
| `interrupted`        | User aborted (`USER_ABORT`) or recognizer ended before any final (e.g. `end` in `starting`). No body-bound content, but the artifact records provenance for the fallback path.       | yes       | yes              |
| `timeout_no_speech`  | Session ended with zero final results — reached from `nomatch`, `end`-without-final, `error{no-speech}`, or `result_final` with an empty transcript. Neutral provenance artifact.    | yes       | yes              |
| `error`              | Recognizer emitted a non-recoverable error (`network`, `audio-capture`, `not-allowed`, `service-not-allowed`, `bad-grammar`, `language-not-supported`, or any `starting`-phase error). `lastErrorCode` set for the adapter's `gameCopy.toPlainLanguage`. | yes       | yes              |
| `unavailable`        | Session was never offerable (defensive `USER_START` with `capability.voiceOfferable === false`) OR mid-session `AVAILABILITY_LOST` fired. **Yields NO artifact.** `USER_RESET` recovers to `idle` (adapter must re-probe capability). | yes*      | **no (null)**    |

\* `unavailable` is a terminal-recoverable state via `USER_RESET`. Recovery does not resurrect the prior session; it clears state and returns to `idle`.

---

## §3 — Event grammar

Twelve events. Adapter-synthesized events use SCREAMING_SNAKE_CASE; recognizer-forwarded events use the lowercase upstream names.

`audiostart` and `audioend` are **NOT** in this reducer's alphabet — waveform coordination belongs to VOICE-004's parallel reducer.

| Event                  | Source                                                                                                                                    | Payload                                                                                                              | Notes                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`           | adapter (Speak tap after permission + capability resolved)                                                                                | `{ sessionId, transcriptId, capability, nowIso }`                                                                     | Only meaningful in `idle`. In non-terminal states it is a self-loop with no mutation (idempotent — `transcriptId` and `sessionStartedAt` unchanged). In terminals other than `unavailable`, adapter must `USER_RESET` first.                                                                                                                       |
| `USER_ABORT`           | adapter (Stop tap, mode switch, room settle/lock)                                                                                         | `{}`                                                                                                                 | Distinct from `error{aborted}` — user intent, not recognizer fault. Adapter contract: swallow any coincident recognizer `error{aborted}` and forward only this. Reducer defensively no-ops `error` in `interrupted`.                                                                                                                              |
| `USER_RESET`           | adapter (fresh session from a terminal, or recovery from `unavailable`)                                                                   | `{}`                                                                                                                 | Meaningful only in terminals. Returns to `idle` with a clean draft. Adapter must re-run capability probe before firing `USER_START` after resetting from `unavailable`.                                                                                                                                                                            |
| `AVAILABILITY_LOST`    | adapter (capability probe / permission listener / dev-toggle)                                                                             | `{ reason: 'permission_revoked' \| 'service_unreachable' \| 'recognizer_disabled' }`                                   | Legal from any non-terminal. Transitions to `unavailable` with no artifact. In terminals it is ignored (first terminal wins).                                                                                                                                                                                                                     |
| `start`                | recognizer                                                                                                                                | none                                                                                                                 | Legal in `starting` → `listening`. Ignored elsewhere.                                                                                                                                                                                                                                                                                              |
| `speechstart`          | recognizer                                                                                                                                | none                                                                                                                 | Sets `speechStartFired=true`. `starting/listening` → `listening/interim` respectively.                                                                                                                                                                                                                                                             |
| `result_interim`       | recognizer (`result` where `results[resultIndex].isFinal === false`)                                                                       | `{ transcript: string }`                                                                                             | Adapter unpacks the Web Speech API's `results[resultIndex][0].transcript` and hands the reducer a plain string. Increments `interimCount`; overwrites `latestInterimText`. **NEVER writes `rawTranscript`.** Legal after `speechend` in `interim` (recognizer quirk) but IGNORED in `finalizing` (INV-21: spurious late interim). |
| `result_final`         | recognizer (`result` where `results[resultIndex].isFinal === true`)                                                                        | `{ transcript: string }`                                                                                             | Empty-string transcript routes to `timeout_no_speech`, NOT `final` (INV: empty final is semantically no-speech; observed on some Android STT). Adapter must coerce `undefined` `isFinal` on iOS <17 to `false` before dispatching.                                                                                                                 |
| `speechend`            | recognizer                                                                                                                                | none                                                                                                                 | Mic-side speech detector timed out; NOT terminal. `listening/interim` → `finalizing`. Legal from `listening` even if `interimCount===0` and `speechStartFired===false` (phantom pre-speech `speechend` on Web Chrome). Self-loop in `finalizing`.                                                                                                     |
| `end`                  | recognizer (session terminated)                                                                                                           | none                                                                                                                 | Without a preceding `result_final` → `timeout_no_speech` from active states. In `starting` → `interrupted` (recognizer died before it began). In terminals → no-op.                                                                                                                                                                               |
| `nomatch`              | recognizer (recognizer confident no speech matched — Chrome desktop fires this instead of / in addition to `end`)                          | none                                                                                                                 | If no `result_final` has landed → `timeout_no_speech`. Kept as a distinct event: some engines emit `nomatch` alone, some `nomatch`+`end`.                                                                                                                                                                                                          |
| `error`                | recognizer                                                                                                                                | `{ code: SpeechErrorCode }`                                                                                          | Code-dispatched: `no-speech` → `timeout_no_speech`; `aborted` → `interrupted` (but usually swallowed by adapter after `USER_ABORT`); all others → `error` with `lastErrorCode = code`. Late `error` in `final` is a no-op on the artifact (the artifact is immutable once produced).                                                              |

---

## §4 — Transition matrix (full 10 × 12)

Every cell is either a **transition** (with side-effect note) or `IGNORE` (state unchanged, `latestInterimText`/`interimCount`/etc. unchanged, `producedArtifact = null`). There are no implicit fallthroughs — the reducer is table-driven and a build-time `satisfies Record<SpeechSessionState, Record<RecognizerEvent['type'], TransitionSpec>>` check catches any missing cell.

Load-bearing cells are marked **★**.

### 4.1 idle (10 IGNOREs; 2 meaningful)

| Event             | Result                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`      | If `capability.voiceOfferable === true`: → `starting`; initialise `sessionId`, `transcriptId`, `recognizer`, `onDeviceRecognition`, `language`, `sessionStartedAt=nowIso`, `rawTranscript=''`, `latestInterimText=''`, `interimCount=0`, `speechStartFired=false`, `hadFinalEvent=false`, `lastErrorCode=null`. **If `voiceOfferable === false`: → `unavailable` (defensive; producedArtifact=null).** ★ |
| `AVAILABILITY_LOST` | → `unavailable`; `producedArtifact = null`.                                                                                                                                                                                                                  |
| all other 10      | IGNORE.                                                                                                                                                                                                                                                       |

### 4.2 starting (2 IGNOREs; 10 meaningful)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`      | IGNORE (self-loop, idempotent — `transcriptId` and `sessionStartedAt` stable). ★                                                                 |
| `USER_ABORT`      | → `interrupted`; set `sessionEndedAt=nowIso`, `terminalState='interrupted'`; yield artifact.                                                     |
| `USER_RESET`      | IGNORE (must abort first).                                                                                                                       |
| `AVAILABILITY_LOST` | → `unavailable`; `producedArtifact = null`.                                                                                                    |
| `start`           | → `listening`; no mutation.                                                                                                                     |
| `speechstart`     | → `listening`; `speechStartFired=true`. (Some platforms fire `speechstart` before `start`.) ★                                                    |
| `result_interim`  | → `interim`; `speechStartFired=true`, `interimCount=1`, `latestInterimText=transcript`.                                                          |
| `result_final`    | If `transcript === ''` → `timeout_no_speech` ★ else → `final`; `rawTranscript=transcript`, `hadFinalEvent=true`, `terminalState='final'`; yield artifact. Fast-path for iOS 17 short utterances. |
| `speechend`       | IGNORE (phantom pre-start speechend). ★                                                                                                          |
| `end`             | → `interrupted`; `terminalState='interrupted'`; yield artifact. Recognizer died before start. ★                                                  |
| `nomatch`         | → `timeout_no_speech`; yield artifact.                                                                                                          |
| `error`           | If `code==='no-speech'` → `timeout_no_speech`; if `code==='aborted'` → `interrupted`; else → `error` with `lastErrorCode=code`. Yield artifact. ★ (Edge case a: this covers `not-allowed` before any `start` event — reducer does NOT distinguish permission_denied from other codes; adapter routes via `toPlainLanguage`.) |

### 4.3 listening (2 IGNOREs; 10 meaningful)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`      | IGNORE (self-loop).                                                                                                                             |
| `USER_ABORT`      | → `interrupted`; yield artifact.                                                                                                                |
| `USER_RESET`      | IGNORE.                                                                                                                                          |
| `AVAILABILITY_LOST` | → `unavailable`; null.                                                                                                                        |
| `start`           | IGNORE (already listening).                                                                                                                     |
| `speechstart`     | `speechStartFired=true`; stay in `listening` (no interim yet).                                                                                  |
| `result_interim`  | → `interim`; `interimCount=1`, `latestInterimText=transcript`, `speechStartFired=true`.                                                          |
| `result_final`    | If `transcript===''` → `timeout_no_speech`; else → `final`, yield artifact.                                                                     |
| `speechend`       | → `finalizing`. **Legal even if `interimCount===0` and `speechStartFired===false` — edge case b: phantom pre-speech speechend is not an error.** ★ |
| `end`             | → `timeout_no_speech`; yield artifact. **Edge case c.** ★                                                                                       |
| `nomatch`         | → `timeout_no_speech`; yield artifact.                                                                                                          |
| `error`           | Code dispatch (same as `starting`).                                                                                                             |

### 4.4 interim (2 IGNOREs; 10 meaningful)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`      | IGNORE (self-loop).                                                                                                                             |
| `USER_ABORT`      | → `interrupted`; yield artifact. **Interim never becomes body.** ★                                                                              |
| `USER_RESET`      | IGNORE.                                                                                                                                          |
| `AVAILABILITY_LOST` | → `unavailable`; null.                                                                                                                        |
| `start`           | IGNORE.                                                                                                                                          |
| `speechstart`     | `speechStartFired=true`; stay.                                                                                                                  |
| `result_interim`  | Stay in `interim`; `interimCount++`, `latestInterimText=transcript`. **Legal after `speechend` in `interim` (recognizer quirk).**               |
| `result_final`    | If empty → `timeout_no_speech`; else → `final`, yield artifact. **The speechend-then-final ordering never drops finals** because `speechend` self-loops in `finalizing`; here we haven't gone through `finalizing` yet. |
| `speechend`       | → `finalizing`.                                                                                                                                  |
| `end`             | → `timeout_no_speech`; yield artifact. **INV-6: NO auto-promote of interim.** ★                                                                 |
| `nomatch`         | → `timeout_no_speech`; yield artifact.                                                                                                          |
| `error`           | Code dispatch.                                                                                                                                  |

### 4.5 finalizing (2 IGNOREs; 10 meaningful)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_START`      | IGNORE (self-loop).                                                                                                                             |
| `USER_ABORT`      | → `interrupted`; yield artifact.                                                                                                                |
| `USER_RESET`      | IGNORE.                                                                                                                                          |
| `AVAILABILITY_LOST` | → `unavailable`; null.                                                                                                                        |
| `start`           | IGNORE.                                                                                                                                          |
| `speechstart`     | IGNORE (pre-final speechstart is odd but harmless).                                                                                             |
| `result_interim`  | **IGNORE — INV-21 spurious late interim after speechend is NOT appended.** ★ Explicit ruling, not fallthrough.                                  |
| `result_final`    | If empty → `timeout_no_speech`; else → `final`, yield artifact. **This is the correct home for the speechend-then-final ordering.** ★           |
| `speechend`       | Stay (idempotent — repeated speechend from some platforms).                                                                                     |
| `end`             | → `timeout_no_speech`; yield artifact.                                                                                                          |
| `nomatch`         | → `timeout_no_speech`; yield artifact.                                                                                                          |
| `error`           | Code dispatch.                                                                                                                                  |

### 4.6 final — terminal, artifact already yielded (1 exit; 11 IGNOREs)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_RESET`      | → `idle`; clear all session-local fields. **Only exit.**                                                                                        |
| all other 11      | IGNORE. **The artifact is immutable once yielded.** Late `error` after `final` does NOT retract; a second `result_final` does NOT replace the first; late `result_interim` does NOT append; `AVAILABILITY_LOST` in `final` is ignored (first terminal wins). ★ |

### 4.7 interrupted — terminal (1 exit; 11 IGNOREs)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_RESET`      | → `idle`; clear.                                                                                                                                |
| all other 11      | IGNORE. **Includes `error{aborted}` that may arrive coincidentally after `USER_ABORT` — adapter should swallow, reducer defensively no-ops.** ★ |

### 4.8 timeout_no_speech — terminal (1 exit; 11 IGNOREs)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_RESET`      | → `idle`; clear.                                                                                                                                |
| all other 11      | IGNORE. Trailing `end`, `nomatch`, `error`, `AVAILABILITY_LOST` are recognizer teardown ripples.                                                |

### 4.9 error — terminal (1 exit; 11 IGNOREs)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_RESET`      | → `idle`; clear (`lastErrorCode = null`).                                                                                                       |
| all other 11      | IGNORE.                                                                                                                                          |

### 4.10 unavailable — terminal, no artifact (1 exit; 11 IGNOREs)

| Event             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_RESET`      | → `idle`; clear. **Adapter must re-run capability probe before the next `USER_START`; the reducer's `idle + USER_START (voiceOfferable=false)` transition defensively returns here.** ★ |
| all other 11      | IGNORE.                                                                                                                                          |

### 4.11 Totals

- **10 states × 12 events = 120 cells.**
- **≈46 transitions with side-effects.**
- **≈74 explicit IGNOREs.**
- Every cell is covered by a parametric test (§7).

---

## §5 — SpeechTranscriptArtifact — field spec

Yielded on the transition into `final`, `interrupted`, `timeout_no_speech`, or `error`. Never yielded from `unavailable`. Every field is `readonly`. The reducer returns an `Object.freeze`d instance. The submitted body lives in `activeDraft.body` and is never on this artifact.

| Field                    | Type                                            | Purpose                                                                                                     | Invariant                                                                                            | Guarded by                                             |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `transcriptId`           | `string` (UUID v4)                              | Stable id joining artifact to future recording ref / sibling `VoiceWaveformArtifact.transcriptId`.          | Non-empty; unique per session; immutable after `USER_START`.                                          | (b) runtime + (c) type test                            |
| `sessionId`              | `string`                                        | Reducer-owned session id; adapter uses it to reject concurrent sessions across shared drafts.               | Non-empty; distinct from `transcriptId`.                                                              | (b) runtime                                            |
| `recognizer`             | `'ios' \| 'android' \| 'web'`                   | Neutral provenance — which platform recognizer produced the text.                                           | (a) TS literal union.                                                                                | (a) TS                                                 |
| `onDeviceRecognition`    | `boolean`                                       | Neutral provenance — on-device vs cloud. Never credibility.                                                 | Immutable after `USER_START`.                                                                        | (b) runtime + (c) source scan (see §6)                 |
| `language`               | `string` (BCP-47)                               | Locale metadata.                                                                                            | Non-empty.                                                                                            | (b) runtime                                            |
| `sessionStartedAt`       | `string` (ISO-8601 UTC)                         | When `USER_START` fired.                                                                                    | Parseable ISO; `sessionEndedAt >= sessionStartedAt` (string compare works for Z-suffixed ISO-8601).   | (b) runtime                                            |
| `sessionEndedAt`         | `string` (ISO-8601 UTC)                         | When terminal reached.                                                                                      | `>= sessionStartedAt`.                                                                                | (b) runtime                                            |
| `rawTranscript`          | `string`                                        | Recognizer's final output. **RECOGNIZER PROVENANCE, not the submitted body.**                              | Empty iff `hadFinalEvent === false`. **Never populated from interim.**                                | (a) type discriminant + (b) reducer unit tests         |
| `hadFinalEvent`          | `boolean`                                       | Discriminant — did a `result_final` (non-empty) actually fire?                                              | `hadFinalEvent === false ⟹ rawTranscript === ''`.                                                     | (a) type + (b) reducer unit tests                      |
| `interimCount`           | `number` (integer, ≥ 0)                         | Mic-activity provenance — how many interim results streamed.                                                 | Monotonic within a session; never decremented; never interpreted as correctness.                     | (b) runtime + (c) source scan on interpretation strings |
| `terminalState`          | `'final' \| 'interrupted' \| 'timeout_no_speech' \| 'error'` | Discriminant so the adapter routes without re-reading state.                                                | (a) TS literal union. **`'unavailable'` intentionally absent — unavailable yields null.**            | (a) TS + type test                                     |
| `wasEdited`              | `false` on the freshly-produced type            | Neutral provenance. Populated to `true` at submit time by `deriveEditedProvenance` in a REPLACEMENT record. | Freshly produced literal `false`. **Never a credibility, honesty, or sincerity signal.**              | (a) branded type + (b) runtime assertion               |
| `editDistance`           | `0` on the freshly-produced type                | Neutral provenance. Populated to Levenshtein distance at submit time.                                       | Freshly produced literal `0`. `>= 0` always.                                                          | (a) branded type + (b) runtime assertion               |
| `audioPersistence`       | `'none' \| 'scoped_governed'`                   | Discriminated union — replaces the card's stale `audioPersisted: false` boolean.                            | **v1 reducer produces literal `'none'`** via narrowed return type. `'scoped_governed'` unreachable in this module. | (a) TS narrowing + (c) source scan asserting the literal `'scoped_governed'` string appears only in type declarations, never in the reducer implementation |
| `audioUri`               | `null` (literal null type — NOT `string \| null`) | Enforces "client never holds an audio URI" at the type level.                                              | Literal null; TS refuses a non-null value at compile time.                                            | (a) TS literal + (c) `voiceNoUrlInClientTypes.test.ts`  |
| `producedByModuleVersion` | `string` (semver)                              | Migration provenance for when VOICE-DB widens `audioPersistence`.                                          | Non-empty; matches module `package` semver.                                                          | (b) runtime                                            |

### 5.1 Fields intentionally NOT on the artifact

- **`submittedBody`** — lives in `activeDraft.body` in the composer. `keyof SpeechTranscriptArtifact` excludes it; a type-level test asserts this.
- **`latestInterimText` / `interimTranscriptWindow`** — session-local only. `latestInterimText` (single string, replaced on each `result_interim`) is on the reducer's internal state for adapter display; it is stripped before yielding. **No ring buffer of interim strings ships on the artifact** — the artifact is JSON-serialized into logs, and even a bounded window of interim text is unnecessary transcript provenance.
- **`lastErrorCode` as a user-facing string** — kept on internal state; the adapter reads it and routes through `gameCopy.toPlainLanguage`. The artifact does NOT expose the raw code.
- **`recognitionConfidence` / `recognizerConfidence` / `confidence` / `speakerConfidence`** — deferred entirely per ADR-002 §0. Absent by design.
- **Any emotion / tone / stress / anger / honesty / sincerity / manipulation / biometric / identity / credibility / intent / truth / winner / loser / verdict / liar / dishonest / bad-faith / extremist / propagandist / heavilyEdited / suspicious / genuineness / authenticity token** — banned by the doctrine source-scan (§6).

### 5.2 Reconciliation with VOICE-001 §5.1

VOICE-001 §5.1's inline artifact sketch includes `submittedBody: string`. This design flags that as a mild conflation of recognizer provenance with user-authored text and moves `submittedBody` OUT of the artifact. Consumers that need the submitted body read it from `draft.body`. `wasEdited` and `editDistance` are derived at submit time by `deriveEditedProvenance(artifact, draft.body)` — a separate pure function in a sibling file, not the reducer.

---

## §6 — Invariants (doctrine)

Enumerated so tests can name each. The invariants split into (a) TS-enforced by literal types, (b) runtime-asserted in tests, (c) source-scan-guarded.

**Type-enforced (a):**
- **INV-A1** `audioUri: null` is the TS literal `null`, not `string | null`. Type-equal test: `TypeEqual<SpeechTranscriptArtifact['audioUri'], null>`.
- **INV-A2** `audioPersistence: 'none' | 'scoped_governed'`; the v1 reducer's return type is narrowed to `FreshSpeechTranscriptArtifact & { audioPersistence: 'none' }`. TS refuses a produced artifact with `'scoped_governed'`.
- **INV-A3** `terminalState: 'final' | 'interrupted' | 'timeout_no_speech' | 'error'`. TS excludes `'unavailable'`. Type-equal test asserts.
- **INV-A4** `FreshSpeechTranscriptArtifact` has `wasEdited: false` and `editDistance: 0` as literal types.
- **INV-A5** `keyof SpeechTranscriptArtifact` does NOT include `submittedBody`. Type test: `Exclude<keyof SpeechTranscriptArtifact, 'submittedBody'> === keyof SpeechTranscriptArtifact`.
- **INV-A6** `SpeechSessionState` is a closed union of exactly 10 members.
- **INV-A7** `RecognizerEvent['type']` is a closed union of exactly 12 members.
- **INV-A8** The reducer's transition dispatch is `satisfies Record<SpeechSessionState, Record<RecognizerEvent['type'], TransitionSpec>>` — TS refuses a missing cell at build time.

**Runtime-asserted (b):**
- **INV-B1** Reducer returns `Object.freeze`d artifacts. `Object.isFrozen(artifact) === true`.
- **INV-B2** `hadFinalEvent === false ⟹ rawTranscript === ''`. Reducer asserts before yielding.
- **INV-B3** `interimCount >= 0`; `editDistance >= 0`.
- **INV-B4** `sessionEndedAt >= sessionStartedAt` (asserted against state values, not `Date.now()`, so a mocked-clock rewind still triggers).
- **INV-B5** The reducer NEVER writes to `rawTranscript` from a `result_interim` event.
- **INV-B6** `USER_START` in `{starting, listening, interim, finalizing}` is a pure no-op: `state.transcriptId`, `sessionStartedAt`, `interimCount`, `latestInterimText`, `rawTranscript`, `speechStartFired`, `hadFinalEvent`, `sessionId` all UNCHANGED (`Object.is` on each).
- **INV-B7** `producedArtifact` is non-null only on the transition into `final`, `interrupted`, `timeout_no_speech`, or `error`. On every other reducer invocation (including transitions into `unavailable`, and all IGNOREs), `producedArtifact === null`.
- **INV-B8** JSON round-trip: `JSON.parse(JSON.stringify(artifact))` deep-equals the artifact. No `Date` objects; only ISO strings. No non-serializable fields.
- **INV-B9** `result_final` with `transcript === ''` transitions to `timeout_no_speech`, NOT `final`. Guards against Android STT services misreporting `nomatch` as `final`.

**Source-scan-guarded (c) — the doctrine guard**

A single test file `__tests__/voice003ForbiddenInferenceGuard.test.ts` mirrors `cohesionPrinciple9Guard`'s bidirectional pattern:

1. **Assert-absent lexicon.** Scan all files matching `src/features/voice/**/*.ts` (excluding `__fixtures__/**` and the guard test itself). The scanner enumerates field names, type members, string literals, and comments. Zero matches are required for these tokens (case-insensitive whole-word where applicable):

   `emotion`, `tone`, `stress`, `anger`, `angry`, `mood`, `sentiment`, `honesty`, `honest`, `sincerity`, `sincere`, `manipulation`, `manipulative`, `biometric`, `biometrics`, `identity`, `credibility`, `credible`, `intent`, `intention`, `truth`, `truthful`, `winner`, `loser`, `verdict`, `liar`, `dishonest`, `badFaith`, `bad_faith`, `bad faith`, `extremist`, `propagandist`, `recognitionConfidence`, `recognizerConfidence`, `speakerConfidence`, `confidence`, `heavilyEdited`, `heavily_edited`, `suspicious`, `genuineness`, `genuine`, `authenticity`, `authentic`.

   (The `confidence` word-boundary rule allows `SpeechCapabilitySnapshot` etc. — but any `confidence` substring is disallowed. The scanner uses a whole-word regex `\bconfidence\b` case-insensitive; if a future field genuinely needs the word "confidence" it must be added to a doctrine allowlist in a separate ratification card.)

2. **Assert-URI-null-only.** Extends `voiceNoUrlInClientTypes.test.ts` with a `SpeechTranscriptArtifact`-specific assertion: the substring `audioUri` in `src/features/voice/**` appears only next to the token `null` (never `string`, `URI`, `URL`, `uri`, `url`, `bucket`, `s3`, `mp3`, `wav`, `pcm`, `bytes`, `blob`, `storageKey`, `signedUrl`).

3. **Assert-scoped_governed-only-in-type-decls.** The string literal `'scoped_governed'` in `src/features/voice/**` appears only in files matching `**/speech/speechTranscriptArtifact.types.ts` (or wherever the type declaration lives). The reducer implementation must not reference it.

4. **FIRING POSITIVE CONTROL.** A fixture at `src/features/voice/speech/__fixtures__/voice003ForbiddenInferenceGuard.positiveControl.ts.txt` (extension `.ts.txt` so it does not compile) contains intentional banned tokens. A companion test loads the fixture as text and asserts the scanner reports **at least three** hits (one for a banned field name, one for a banned string literal, one for a banned comment). **If the scanner is broken (regex typo, glob mistake), this test fails and the whole doctrine guard is exposed as unenforced.** This is the load-bearing safeguard against the classic silent-cohesion-guard bug class.

- **INV-C1** All (a) source-scan rules above pass on the shipped module.
- **INV-C2** The positive-control fixture proves the scanner bites.

---

## §7 — Test plan

Target: **100% branch coverage on `reduceSpeechSession`** per the card AC.

Test files:

1. `__tests__/speechSessionMachine.test.ts` — transition matrix, reducer semantics, invariants (b).
2. `__tests__/speechTranscriptArtifact.test.ts` — type-level tests (a), field invariants, JSON round-trip, freeze.
3. `__tests__/voice003ForbiddenInferenceGuard.test.ts` — the (c) source-scan guard, both assert-absent AND the firing positive control.
4. `__tests__/deriveEditedProvenance.test.ts` — Levenshtein math, terminal-state gating.

### 7.1 Transition-per-cell tests (parametric `describe.each` / `test.each`)

Twenty-eight named scenarios + one blanket IGNORE matrix.

| #  | Scenario                                                                                                    | Start state           | Event(s)                                                          | Expected next state   | Expected artifact                                                                                                              |
| -- | ----------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1  | Happy path: mic → 3 interims → final → end                                                                  | idle                  | USER_START, start, speechstart, ×3 result_interim, result_final, end | final                 | hadFinalEvent=true, rawTranscript=<final>, interimCount=3, wasEdited=false, editDistance=0, audioPersistence='none', audioUri=null |
| 2  | Fast path: recognizer emits final directly (iOS 17 short utterance)                                          | listening             | result_final                                                     | final                 | hadFinalEvent=true, interimCount=0                                                                                             |
| 3  | Fast-fast path: final before start callback fires                                                            | starting              | result_final                                                     | final                 | hadFinalEvent=true                                                                                                             |
| 4  | Interim → final ordering (normal)                                                                            | interim               | result_final                                                     | final                 | hadFinalEvent=true                                                                                                             |
| 5  | Speechend-then-final ordering (Android / Web Chrome quirk)                                                   | interim               | speechend, result_final                                          | final (via finalizing) | hadFinalEvent=true; speechend was NOT a terminal                                                                              |
| 6  | Late interim after speechend is IGNORED (INV-21)                                                             | finalizing            | result_interim{transcript:'late ghost'}                         | finalizing            | interimCount UNCHANGED; latestInterimText UNCHANGED                                                                            |
| 7  | End without final from listening (edge case c)                                                               | listening             | end                                                              | timeout_no_speech     | hadFinalEvent=false, rawTranscript='', interimCount=0                                                                          |
| 8  | End without final from interim (Android 12- interim-only shape, INV-6 no auto-promote)                       | interim (count=2)     | end                                                              | timeout_no_speech     | hadFinalEvent=false, rawTranscript='', interimCount=2                                                                          |
| 9  | End without final from finalizing                                                                            | finalizing            | end                                                              | timeout_no_speech     | hadFinalEvent=false                                                                                                             |
| 10 | Empty-string result_final routes to timeout_no_speech (INV-B9)                                               | listening             | result_final{transcript:''}                                     | timeout_no_speech     | hadFinalEvent=false, rawTranscript=''                                                                                          |
| 11 | Nomatch from listening                                                                                       | listening             | nomatch                                                          | timeout_no_speech     | hadFinalEvent=false                                                                                                             |
| 12 | Nomatch then end (Chrome desktop)                                                                            | interim               | nomatch, end                                                    | timeout_no_speech     | trailing end is no-op                                                                                                          |
| 13 | Phantom pre-speech speechend (edge case b) — legal even with interimCount=0                                  | listening             | speechend                                                       | finalizing            | interimCount=0, speechStartFired=false; no error raised                                                                        |
| 14 | Phantom pre-start speechend                                                                                  | starting              | speechend                                                       | starting (IGNORE)     | no mutation                                                                                                                    |
| 15 | Speechstart before start (some platforms)                                                                    | starting              | speechstart                                                     | listening             | speechStartFired=true                                                                                                          |
| 16 | Interim before start (some platforms)                                                                        | starting              | result_interim                                                  | interim               | interimCount=1, speechStartFired=true                                                                                          |
| 17 | User cancel from listening (edge case d)                                                                     | listening             | USER_ABORT                                                       | interrupted           | hadFinalEvent=false; distinct from error{aborted}                                                                              |
| 18 | User cancel followed by error{aborted} — reducer defensively no-ops                                          | listening             | USER_ABORT, error{code:'aborted'}                              | interrupted           | error is no-op in interrupted                                                                                                  |
| 19 | Recognizer error{network} mid-stream                                                                         | interim               | error{code:'network'}                                          | error                 | lastErrorCode='network' internally; artifact.terminalState='error'                                                             |
| 20 | Permission denied (error{not-allowed}) during starting — edge case a                                         | starting              | error{code:'not-allowed'}                                       | error                 | terminalState='error'; state machine does NOT distinguish permission                                                          |
| 21 | error{code:'no-speech'} during listening                                                                     | listening             | error{code:'no-speech'}, end                                    | timeout_no_speech     | trailing end is no-op                                                                                                          |
| 22 | error{language-not-supported} in starting                                                                    | starting              | error{code:'language-not-supported'}                            | error                 | terminalState='error'                                                                                                          |
| 23 | Recognizer end from starting (died before start callback)                                                    | starting              | end                                                             | interrupted           | terminalState='interrupted'                                                                                                    |
| 24 | Availability lost mid-listen                                                                                 | listening             | AVAILABILITY_LOST                                                | unavailable           | producedArtifact === null                                                                                                      |
| 25 | Availability lost during starting                                                                            | starting              | AVAILABILITY_LOST                                                | unavailable           | producedArtifact === null                                                                                                      |
| 26 | Defensive fallthrough: USER_START with voiceOfferable=false                                                  | idle                  | USER_START (capability.voiceOfferable=false)                    | unavailable           | producedArtifact === null                                                                                                      |
| 27 | Late error after final does NOT retract artifact (INV-B7)                                                    | final                 | error{code:'network'}                                            | final                 | artifact from prior yield STANDS; producedArtifact === null on this call                                                       |
| 28 | Second result_final after final is IGNORED (first final wins)                                                | final                 | result_final                                                    | final                 | rawTranscript UNCHANGED                                                                                                        |
| 29 | Late result_interim in final IGNORED                                                                         | final                 | result_interim                                                  | final                 | interimCount UNCHANGED                                                                                                         |
| 30 | AVAILABILITY_LOST in a terminal is IGNORED (first terminal wins) — iOS 60s race                              | error                 | AVAILABILITY_LOST                                                | error                 | no mutation                                                                                                                    |
| 31 | Terminal + terminal race (network then timeout)                                                              | listening             | error{code:'network'}, timeout_no_speech synthetic?             | error                 | (Actually `timeout_no_speech` is not an event, it's a state; the second recognizer terminal — e.g. a trailing `end` — is a no-op in `error`.) |
| 32 | USER_START double-tap in starting is idempotent (INV-B6)                                                     | starting              | USER_START (second time)                                          | starting              | transcriptId UNCHANGED, sessionStartedAt UNCHANGED                                                                             |
| 33 | USER_START in listening is a no-op                                                                           | listening             | USER_START                                                      | listening             | no mutation                                                                                                                    |
| 34 | USER_RESET from final → idle                                                                                 | final                 | USER_RESET                                                       | idle                  | draft cleared                                                                                                                  |
| 35 | USER_RESET from interrupted → idle                                                                           | interrupted           | USER_RESET                                                       | idle                  | draft cleared                                                                                                                  |
| 36 | USER_RESET from timeout_no_speech → idle                                                                    | timeout_no_speech     | USER_RESET                                                       | idle                  | draft cleared                                                                                                                  |
| 37 | USER_RESET from error → idle (lastErrorCode cleared)                                                         | error                 | USER_RESET                                                       | idle                  | draft cleared, lastErrorCode=null                                                                                               |
| 38 | USER_RESET from unavailable → idle (recovery per ruling)                                                     | unavailable           | USER_RESET                                                       | idle                  | draft cleared                                                                                                                  |
| 39 | USER_START from final without USER_RESET is IGNORED                                                          | final                 | USER_START                                                      | final                 | prevents double-tap auto-restart                                                                                                |
| 40 | USER_START from error without USER_RESET is IGNORED                                                          | error                 | USER_START                                                      | error                 | adapter must reset first                                                                                                        |
| 41 | Idle IGNOREs stray recognizer events                                                                         | idle                  | result_interim (phantom)                                         | idle                  | no mutation                                                                                                                    |

**Blanket IGNORE matrix test #42.** `test.each` over the full Cartesian product `(state × event)` for the ≈74 cells NOT covered above; asserts `nextState === state` AND `producedArtifact === null` AND every field on `SpeechSessionMachineState` is `Object.is` unchanged.

### 7.2 Artifact-invariant tests (`speechTranscriptArtifact.test.ts`)

- **T-A1** `TypeEqual<SpeechTranscriptArtifact['audioUri'], null>` (type test via `expectTypeOf` or `tsd`).
- **T-A2** Reducer's produced-artifact return type equals `FreshSpeechTranscriptArtifact` (audioPersistence narrowed to `'none'`).
- **T-A3** `TypeEqual<SpeechTranscriptArtifact['terminalState'], 'final' | 'interrupted' | 'timeout_no_speech' | 'error'>`.
- **T-A4** `Exclude<keyof SpeechTranscriptArtifact, 'submittedBody'>` equals `keyof SpeechTranscriptArtifact`.
- **T-A5** `Object.isFrozen(artifact) === true` for every yielded artifact.
- **T-A6** Strict-mode assignment throws `TypeError`; non-strict silent no-op still leaves `Object.is` unchanged.
- **T-A7** JSON round-trip deep-equal.
- **T-A8** Runtime assertion for `hadFinalEvent=false ⟹ rawTranscript===''` on interrupted/timeout_no_speech/error artifacts.
- **T-A9** `interimCount >= 0` and `editDistance >= 0`.
- **T-A10** `sessionEndedAt >= sessionStartedAt` (string compare on Z-suffixed ISO).
- **T-A11** No artifact yielded on `unavailable` transitions (producedArtifact === null across all 3 unavailable-entry pairs).
- **T-A12** Every produced artifact carries `audioPersistence === 'none'`, `audioUri === null`, `wasEdited === false`, `editDistance === 0`.

### 7.3 Source-scan guard tests (`voice003ForbiddenInferenceGuard.test.ts`)

- **T-C1** Assert-absent lexicon (§6.C.1) — zero matches over `src/features/voice/**/*.ts`, excluding `__fixtures__/**` and this test file. Case-insensitive whole-word.
- **T-C2** `audioUri` context assertion (§6.C.2) — every occurrence of `audioUri` in the tree is adjacent to `null`, never a URI/URL/bucket token.
- **T-C3** `'scoped_governed'` allowed only in type declaration file(s) (§6.C.3).
- **T-C4** FIRING POSITIVE CONTROL: load the `.ts.txt` fixture as text; assert scanner reports at least 3 hits (one field name, one string literal, one comment). **If it reports zero, the test fails loudly.**

### 7.4 deriveEditedProvenance tests

- **T-D1** rawTranscript === submittedBody → wasEdited=false, editDistance=0.
- **T-D2** Single-char insertion → wasEdited=true, editDistance=1.
- **T-D3** Substitution → distance=1.
- **T-D4** Deletion → distance=1.
- **T-D5** `terminalState !== 'final'` → returns wasEdited=false, editDistance=0, transcriptEditedAfterDictation=false regardless of body diff (T-D5 covers the interaction of timeout_no_speech + typed body).
- **T-D6** Levenshtein pinned (not Damerau) — transposition of two chars → distance=2, not 1.
- **T-D7** Empty rawTranscript + non-empty submittedBody + `terminalState='final'` — this branch is unreachable in practice (rawTranscript='' implies hadFinalEvent=false implies terminalState !== 'final'), but the function defensively returns wasEdited=true, editDistance=submittedBody.length.

**Expected suite size: ≈50 test cases across 4 files.**

---

## §8 — File layout

```
src/features/voice/speech/
  speechSessionMachine.ts           // reducer + initial state + deriveVoiceInputMode
  speechTranscriptArtifact.types.ts // SpeechTranscriptArtifact + FreshSpeechTranscriptArtifact + Terminal union
  deriveEditedProvenance.ts         // pure submit-time provenance derivation
  index.ts                           // barrel — re-exports the four public modules above
  __fixtures__/
    voice003ForbiddenInferenceGuard.positiveControl.ts.txt  // .ts.txt so it does not compile
  __tests__/
    speechSessionMachine.test.ts
    speechTranscriptArtifact.test.ts
    voice003ForbiddenInferenceGuard.test.ts
    deriveEditedProvenance.test.ts
```

**Split rationale.** Types live in `speechTranscriptArtifact.types.ts` alone so the source-scan rule "`'scoped_governed'` appears only in type declarations" can be a single-file allowlist. `deriveEditedProvenance` is a sibling file (not part of the reducer module) because it consumes composer state that the reducer does not know about — keeps the reducer's dependency surface pure. `index.ts` is the sole public entry point.

---

## §9 — Non-goals

The card's non-goals PLUS what the panel surfaced:

- No React, no hooks, no components. This is a reducer, not a UI.
- No React Native, no `expo-speech-recognition`, no `expo-audio` imports. The adapter (later card) imports both; this module imports neither.
- No Supabase, no `@supabase/supabase-js`, no network, no fetch.
- No persistence — session state is process-local; a page reload discards it.
- No audio persistence (v1 audioPersistence='none'); no signed URLs; no client-side blob handling.
- No `recognitionConfidence` / `recognizerConfidence` / `confidence` / `speakerConfidence` — deferred entirely.
- No waveform coordination — `audiostart` / `audioend` are OUT of this reducer's alphabet.
- No MCP, no ML, no analytics — the artifact is a plain data record.
- No `submittedBody` on the artifact — lives in composer draft.
- No auto-promote of interim to final (INV-6); an adapter-owned `promoteInterim` UX for Android 12- interim-only platforms is a future card and its event slot is intentionally NOT reserved (adding it later triggers the full-matrix totality re-check).
- No cross-host concurrency logic — the reducer is single-session; the adapter enforces at-most-one active session per debate.id.
- No permission / consent flows — adapter's concern; the reducer sees a capability snapshot at `USER_START` and fails closed if `voiceOfferable === false`.
- No UI copy — user-facing strings route through `gameCopy.toPlainLanguage` in the adapter.

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

None load-bearing. The design ships a self-contained answer for every panel contradiction and every critic gap. The following are surfaced for the operator's awareness but require no ruling to implement:

1. **`producedByModuleVersion` semver source.** The design uses a string constant in the module (`'1.0.0'` for the first shipped version). If the operator wants this pinned to `package.json` version, the constant can be replaced with a `require('../../../package.json').version` read — but that violates the "no runtime file read" pure-reducer contract. Recommend leaving as a hard-coded constant that ratchets on each intentional VOICE-003 change; the operator can veto on review.
2. **Positive-control fixture extension.** The design uses `.ts.txt` so the fixture does not compile. If the operator prefers `.txt` or a different convention (some repos use `.snap` or a JSON manifest), the guard test can be adjusted — the load-bearing property is only that the fixture is text-loaded, not compiled.
3. **`SPEECH_SESSION_MACHINE_VERSION` export.** Whether to also export the semver as a named constant for consumers to key on. Recommend yes; no operator ruling needed.

---

## §12 — Acceptance mapping (#661 AC → design section)

| Card AC bullet (paraphrased)                                                                                              | Satisfied by                                              |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Pure TS module, no imports from React/Supabase/network/native                                                              | §1 exports, §8 file layout, §9 non-goals                  |
| State machine covers `idle`, `starting`, `listening`, `interim`, `final`, `interrupted`, `timeout_no_speech`, `error`, `unavailable` | §2 (adds `finalizing` as documented improvement)         |
| `SpeechTranscriptArtifact` with `audioPersisted: false` (stale)                                                            | §0 reconciliation → `audioPersistence: 'none'` + INV-A2   |
| `audioUri: null` literal                                                                                                  | §5 + INV-A1 + `voiceNoUrlInClientTypes.test.ts` extension |
| `recognitionConfidence?: number` (stale)                                                                                  | §0 reconciliation → removed per ADR-002 §0 + INV-C1       |
| No emotion/tone/stress/anger/etc. fields                                                                                  | INV-C1 + §6 positive control                              |
| Interim text never enters submitted body                                                                                  | INV-B5 + INV-A4 + scenarios #6, #8, #10                   |
| 100% branch coverage on the reducer                                                                                       | §7 — 41 named scenarios + blanket IGNORE matrix           |
| JSON-serializable state and events                                                                                        | INV-B8 + §1 explicit types                                |
| All fields readonly                                                                                                       | §1 + §5 + INV-B1 (Object.freeze)                          |
| Doctrine source-scan guard on the module                                                                                  | §6 (c) + §7.3 with firing positive control                |

---

*End of VOICE-003 design.*
