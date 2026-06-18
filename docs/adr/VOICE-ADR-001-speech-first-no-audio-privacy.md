# VOICE-ADR-001 — Speech-first input, no-audio privacy posture

**Status:** Accepted
**Date:** 2026-06-18
**Deciders:** operator (kyleruff@gmail.com)
**Issue:** https://github.com/civildiscourse/cdiscourse/issues/658
**Slate:** VOICE-SLATE-2026-06-13 — `docs/roadmap-expansions/2026-06-13-speech-first-voice-waveform-roadmap.md` (index `docs/designs/VOICE-SLATE-2026-06-13-INDEX.md`)
**Architecture:** VOICE-001 — `docs/designs/VOICE-001-SPEECH-WAVEFORM-ARCHITECTURE.md` (issue #659)
**Binds:** every VOICE / MCP-K / AUDIO card downstream (VOICE-001…010, MCP-K-001/002, AUDIO-001); each card's doctrine self-check references THIS file as the durable contract.

> This ADR is the durable doctrine root the slate index calls "operator-ratified doctrine." The VOICE-001 architecture (§17 doctrine self-check, §18 operator notes) noted that no `docs/adr/` file existed yet; this is that file. It is intentionally short enough to be a binding reference and detailed enough for implementers and reviewers to check a card against. It is DOCS-ONLY — it introduces no code, install, config-plugin edit, migration, or mcp-server change.

---

## § Decision

CDiscourse becomes **speech-first** for ordinary argument drafting: tapping Speak is the first-class way to begin composing an argument. **Text-only input remains available for EVERY entry window** — speech never replaces the keyboard, it sits beside it.

Speech is a **composition aid**. It is never a judge, never an acceptance gate, and never required to post. The artifact that is submitted, stored, and gated is **plain text** passing through the *unchanged* deterministic constitution engine that gates every post today. Speech recognition, the live waveform, the transcript, and any voice metadata are upstream drafting help or downstream non-authoritative provenance — nothing more.

---

## § User loop

```
Tap Speak
  -> request microphone / speech permission IF not already granted
  -> user speaks
  -> live waveform confirms the mic is active (mic-active feedback only)
  -> interim transcript appears LOCALLY in the adapter (display-only)
  -> FINAL transcript lands in the existing editable composer body
       (via the same path as typed input — never a new write path)
  -> user EDITS the text with full keyboard parity
  -> the DETERMINISTIC engine validates the SUBMITTED TEXT (sole gate)
  -> user submits
  -> speech / waveform metadata MAY attach ONLY AFTER storage (post-store, off the critical path)
  -> MCP MAY consume the submitted TEXT + non-replayable METADATA ONLY AFTER storage
```

Every step before "engine validates" is optional drafting help. Every step after "user submits" is post-storage and cannot affect whether the post was accepted. The user is always able to skip Speak entirely and type.

---

## § Acceptance-gate invariant (VERBATIM)

> "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the sole gate. Speech recognition, waveform rendering, transcript metadata, voice artifacts, and MCP Family K run only as composition aids or post-storage observations. No path may block, reject, route, delay, or penalize an ordinary user post."

This invariant is load-bearing. It is verified in code at `submit-argument/index.ts` (evaluate at :297 → `if (!allowPost) return validationFailed` at :329 → service-role insert at :376-380; the MCP classifier fan-out is fire-and-forget AFTER the insert at :811-846). The deterministic engine lives at `src/domain/constitution/engine.ts` with the Edge byte-parity mirror `evaluateArgumentDraft.ts`. **VOICE-008 is GATE-C if it touches the submit path and must prove `evaluateArgumentDraft` / the `submit-argument` payload is byte-unchanged when voice is on.**

---

## § No-audio v1 privacy posture

In v1, **raw audio is NOT stored, uploaded, replayed, shared, sent to MCP, exposed in the UI, or persisted via a local URI.** Specifically:

- No local audio URI is ever written to Supabase or handed to MCP.
- `expo-speech-recognition` `recordingOptions.persist` is **absent / OFF at every call site** — with `persist` off the recognizer emits no `{uri}` and creates no replayable audio file.
- `expo-audio` prefers the no-file path (`useAudioStream`, real-time PCM with no persistent file). If a platform forces a recorder **cache** URI to obtain metering, that file is **cache-only, never document-directory, never background recording, never uploaded**, and the URI is **deleted as soon as the waveform artifact is derived** (on `audioend`). `enableBackgroundRecording` stays default false.
- The only voice artifacts that may exist are **bounded, NON-REPLAYABLE metadata**: amplitude buckets (≤ 256 normalized `[0,1]` bins — a loudness envelope, not reconstructable speech), duration, metering availability, recognizer availability, and error / provenance summaries. **None of these is audio.** There is intentionally no `AudioArtifact` shape anywhere in the model.

The no-audio posture is type-enforced (the artifact interfaces pin `audioPersisted: false` / `audioUri: null` / `rawAudioPersisted: false` as literals) and, where persistence is later ratified, SQL-enforced (`audio_persisted = false` / `audio_uri IS NULL` / 256-bucket CHECK constraints).

---

## § Transcript ownership

The user owns the submitted text.

- The **interim** transcript is display-only. It lives in the adapter's own chrome and **never enters the submitted body** — a half-recognized phrase can never be submitted.
- The **final** transcript may be inserted into the existing editable composer body **ONLY via the same path as typed input** (`handleBodyChange` → `updateField({ body })`). It never bypasses the keyboard write path; the engine, draft persistence, char-count, and validation panel behave identically whether text arrived by thumb or by voice.
- The user **may edit** the text before posting, with full keyboard parity.
- The app **may record `wasEdited` / `editDistance` as NEUTRAL provenance** (text arrived, then was corrected). These are never credibility, honesty, or sincerity signals, and no downstream consumer (including Family K) may interpret them as such.

---

## § Forbidden inference list

No part of the speech-first stack — UI, model, artifact, persistence, or MCP — may detect, infer, score, label, or expose any of:

- emotion detection
- tone judgment
- voice stress
- anger
- confidence as a speaker / person trait
- honesty / sincerity
- manipulation-by-voice
- biometric inference
- speaker identity
- credibility
- intent
- truth (no truth value on any claim)
- winner / loser / verdict
- public-person accusation (mark the POINT, never the PERSON)

**Wording patch (binding):** if speech-to-text confidence is ever surfaced, it MUST be named **`recognitionConfidence` / `recognizerConfidence`** — *never* "speaker confidence" (which reads as a person-trait inference and is forbidden above). Such a value is **non-user-facing unless separately ratified** by a later card, and v1 should **prefer deferring confidence entirely**. The boundary is: recognizer accuracy is a property of the *software*, never of the *person speaking*.

---

## § Text fallback

A **text-only fallback exists for every argument entry window.** Each of the following degrades to a working text box and **NEVER blocks text posting**:

- permission denial
- recognizer unavailable (device / browser / platform)
- speech error mid-session
- waveform unavailable
- snapshot / image export unavailable

When voice is unofferable the adapter renders no Speak button (or a disabled one with a plain-language hint) and the user simply types. Every terminal and error state in the speech session machine keeps the keyboard path alive.

---

## § Data classification table

This table is the canonical reference for what may persist, what is session-local, and what is forbidden in v1.

| Data | v1 classification | Notes |
|---|---|---|
| Submitted text (argument body) | **Persisted** — via the existing argument path | Sole writer is the service-role insert in `submit-argument`; clients are SELECT-only. `public.arguments.body` already stores the user-approved submitted text. |
| Final transcript | **Local by default; persist only if ratified** | Becomes the submitted body via the keyboard path; the *artifact* `rawTranscript` field is session-local unless a later card ratifies persistence. |
| Raw transcript (recognizer output, pre-edit) | **Session-local by default — do NOT persist by default** | The architecture's in-memory `rawTranscript` defaults to summary metadata; raw transcript persistence is NOT required in v1 (see patch note below). |
| Edit distance / `wasEdited` / duration / language / recognizer availability | **Metadata candidate** | Neutral provenance only; eligible for the VOICE-009 child-table if persistence is ratified. |
| Amplitude buckets (≤ 256 `[0,1]` bins) | **Bounded metadata candidate** | Loudness envelope; bounded and non-replayable; not audio. |
| Waveform PNG / image | **Local / transient only** unless a later card ratifies persistence | Decoration / provenance, never proof of what was said. |
| Raw audio (PCM / recording) | **FORBIDDEN in v1** | Never stored, uploaded, replayed, shared, sent to MCP, or UI-exposed. |
| Local audio URI | **FORBIDDEN to persist** | No local audio URI to Supabase or MCP; cache URI (if forced for metering) deleted on `audioend`. |
| MCP inputs | **Submitted text + metadata only** | Never audio, never a URI, never a playable file. |

**Patch note (binding):** v1 does **NOT** require raw-transcript persistence. The architecture doc's in-memory `rawTranscript` should default to **summary metadata** (e.g. `wasEdited` / `editDistance`), not durable raw text. The existing `public.arguments.body` already stores the user-approved submitted text, which is the only transcript v1 needs to keep.

---

## § MCP Family K boundaries

Family K (`speech_waveform_artifact`, the next free MCP letter — A–I are production-enabled, J `sensitive_composer` is frozen) is **POST-STORE ONLY** and **cannot affect submit**. It runs after the `public.arguments` row exists, off the 201 critical path, advisory, `authoritative: false`.

**Family K MAY consume:**

- submitted text (same text path as every existing family)
- post-store speech provenance metadata
- user-edited-after-speech boolean (`transcript_was_edited`)
- edit-distance summary
- recognizer availability / errors
- duration
- locale / language
- bounded amplitude summary
- text-fallback-used flag

**Family K MAY NOT consume:**

- raw audio
- a local audio URI
- any playable file
- a waveform image that includes user text
- emotion / identity / speaker-state / truth / credibility / intent features (the entire § Forbidden inference list)

Family K must respect the MCP response cap (`MAX_FLAGS_PER_RESPONSE = 20`) — ≤ 20 keys or the shipped #545 request batching (`BATCH_SIZE = 16`); the allowed list above stays comfortably under 20. `mcp-server/` deploys to **Deno Deploy** (not a Supabase Edge Function), so MCP-K-002 is deploy-bearing GATE-C — live only after a Deno Deploy redeploy and a hosted `*.deno.net` smoke. No MCP implementation lands before artifact persistence (MCP-K-002 after VOICE-009 + MCP-K-001).

---

## § UI doctrine

- The **waveform is feedback that the microphone is active** — NOT evidence of what was said or how it was said. It renders loudness-over-time and nothing else.
- A **waveform image is decoration / provenance, not proof.** A captured PNG (if ever exported) is a non-authoritative mic-active artifact, never evidence and never a posting dependency.
- The voice-first UI must be **accessible**: Speak / mic targets ≥ 44×44 px; a **visible text fallback** at every entry window; **screen-reader labels** on interactive elements (the Speak button carries `accessibilityRole="button"`, a plain-language label, and busy state; the waveform is hidden from the accessibility tree as decoration, and the mic-active fact is announced once, not per frame); **reduce-motion support** (the live animation snaps rather than animates when reduce-motion is on); and **color is never the only signal** — the waveform stays legible in grayscale because shape, not color, carries meaning.

---

## Relationship to the mediator board (read-only-projection precedent)

The speech-first stack follows the same doctrine spine already proven by the mediator board (`src/features/mediator/deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts`, `DisagreementPointsRail.tsx`): the mediator board is a **pure read-only projection from already-stored arguments** that "NEVER blocks, routes, delays, or gates a post — it only re-reads what already happened," reads move *structure* not popularity/heat/strength, preserves uncertainty (`unknown` is first-class), and emits markers only when a supporting persisted observation exists. Voice artifacts and MCP Family K obey the identical contract: post-storage, advisory, structure/provenance only, never a gate, never a verdict, never a person-attribution. Speech provenance is one more non-authoritative observation the post-store layer may read — it never moves a Disagreement Point, a strength band, a score, or the acceptance gate.

---

## Consequences

- Every downstream VOICE / MCP-K / AUDIO card carries a doctrine self-check that references this ADR; a card that violates any section above is not mergeable.
- The native-build, persistence, and Deno-Deploy costs stay isolated in their GATE-C cards (VOICE-002, VOICE-009, MCP-K-002, AUDIO-001); none precedes the design.
- The privacy posture is auditable: no `AudioArtifact` shape, `persist` OFF, no-file metering path, literal `audioPersisted: false` / `audioUri: null` / `rawAudioPersisted: false`, and (where persistence is ratified) SQL CHECK constraints all assert the no-audio guarantee.
