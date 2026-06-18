# VOICE-PATCH-001 — DAG correction + voice-to-mediator bridge

**Status:** Design / planning patch (docs only).
**Epic:** 15 — Speech-first voice input + waveform (`epic:voice`)
**Patches:** `docs/designs/VOICE-001-SPEECH-WAVEFORM-ARCHITECTURE.md` (the architecture this formalizes), `docs/designs/VOICE-SLATE-2026-06-13-INDEX.md` (the slate index — dependency table + §6 DAG + §12 next command), `docs/core/next-prompts.md` (VOICE-SLATE start-here command).
**Doctrine root:** VOICE-ADR-001 (#658) — speech-first input doctrine + no-audio privacy posture.
**Companion bridge target:** UX-MEDIATOR-001 (`src/features/mediator/deriveMediatorBoardState.ts`) + UX-MEDIATOR-005 (`src/features/mediator/DisagreementPointsRail.tsx`).

> This is a **DOCS-ONLY** planning patch. It writes no source, runs no install, applies no migration, deploys nothing, and files no GitHub issue. It corrects the published VOICE-SLATE-2026-06-13 dependency DAG (now that VOICE-001 is merged as #673), tightens the VOICE-009 persistence privacy posture to metadata-first, describes a **future** voice-to-mediator bridge add-on (NOT filed as an issue here), and patches two pre-record / visual-path / StartArgumentPage / MCP-K wording points so the downstream cards build the speech-first surface the operator actually wants.

---

## Frozen doctrine (the operative subset this patch is held to)

- **The deterministic Constitution engine is the SOLE acceptance gate.** Speech, waveform, transcript, and MCP Family K are upstream composition aids or post-storage observations. None of them may **block, route, delay, or penalize** a post. (VOICE-001 §"Goal"; cdiscourse-doctrine §1.)
- **Raw audio is never stored / uploaded / replayed / shared / sent to MCP / UI-exposed in v1.** No local audio URI is persisted; `recordingOptions.persist` stays OFF at every call site; `enableBackgroundRecording` stays false. (VOICE-001 §4, §6.4, §15; ADR #658.)
- **No emotion / tone / voice-stress / anger / confidence-as-trait / honesty / sincerity / manipulation-by-voice / biometric / speaker-identity / credibility / intent / truth / winner-loser / verdict / person-accusation inference** anywhere. (VOICE-001 §12, §17; cdiscourse-doctrine §1, §4.)
- **A text-only path exists for every entry window.** Permission denial, recognizer-unavailable, speech-error, waveform-unavailable, and snapshot-unavailable NEVER block text posting. (VOICE-001 §5.5, §16.)
- **Mark the POINT, not the PERSON.** Preserve the machine-**Observation** vs user-**Allegation** boundary. Plain language only. (UX-MEDIATOR-ASSESSMENT-001 §6 safe-label rule; cdiscourse-doctrine §9, §10a.)
- **No Expo-Go assumption where a dev build is required; no platform claim beyond verified upstream facts; the view-shot / Skia canvas→image snapshot is a SPIKE, never a posting dependency.** (VOICE-001 §2, §8, §9.)

---

## §6.1 DAG correction

**VOICE-001 is COMPLETE** — merged as PR **#673** (`design: VOICE-001 — speech + waveform architecture …`). The doctrine root VOICE-ADR-001 (#658) is the operative contract restated in VOICE-001 §17 and §"Frozen doctrine" above.

The published slate DAG (VOICE-SLATE-2026-06-13-INDEX §6) and the slate issue table (#661 VOICE-003 / #662 VOICE-004) both list those two cards as depending on **VOICE-002** (the native dependency install + config plugin + dev build). That ordering is **wrong for the pure-TS model cards** and this patch supersedes it.

**Why it is wrong:** VOICE-003 (speech session state machine + transcript artifact model) and VOICE-004 (waveform artifact core: `normalizeDbToAmplitude`, `bucketAmplitudes`, the ring buffer, the artifact shapes) are **pure-TypeScript model cards**. VOICE-001 already specifies them as such:

- VOICE-003 is "Pure-TS state machine. No React, no network, no Supabase imports" (VOICE-001 §5). Its model file `speechSessionModel.ts` reduces a typed event stream into `SpeechSessionStatus`; the *hook* (`useSpeechSession`) that wraps `useSpeechRecognitionEvent` is a thin, separately-testable adapter.
- VOICE-004 is the "pure TS amplitude model … source-agnostic: it consumes a stream of dB/level samples regardless of whether they came from `useAudioStream` or metering" (VOICE-001 §6.1–§6.3). Its model file `waveformModel.ts` is a pure function library.
- VOICE-001 §14 already records both as `[no gate]` / `[no gate unless native lands in-card]`, and §16.1 specifies their tests run as pure-model suites that "need none of" the Skia/native Jest config.

So VOICE-003 and VOICE-004 can be **modeled and unit-tested with no native imports, no microphone, no install, no config plugin, and no dev build.** They consume *typed event/sample inputs* — not a live recognizer or a live audio stream. Forcing them to wait on VOICE-002's GATE-C native install needlessly serializes pure-TS work behind a dev-build gate and behind operator hardware confirmation.

**Corrected sequence (this section supersedes VOICE-SLATE-2026-06-13-INDEX §6):**

```
VOICE-ADR-001 (#658, doctrine root)
  -> VOICE-001 (#659)  COMPLETE — merged #673
       -> VOICE-003 (#661)  pure TS — speech session model + transcript artifact   [no native, no install, no dev build]
            -> VOICE-004 (#662)  pure TS — waveform artifact core                  [no native, no install, no dev build]
                 -> VOICE-002 (#660)  GATE-C — native dep / config plugin / dev build
                      -> VOICE-007 (#665)  universal VoiceInput adapter
                           -> VOICE-008 (#666)  surface integration (incl. StartArgumentPage adapter — §6.6)
                                -> VOICE-009 (#667)  GATE-C — metadata-first persistence (§6.2)
                                     -> MCP-K-001 (#669)  Family K design (GATE-A)
                                          -> MCP-K-002 (#670)  GATE-C — Deno Deploy + hosted smoke
```

Spikes and the smoke matrix stay in their logical spots after their dependencies land:

- **VOICE-005 (#663)** live-waveform visualizer spike — after VOICE-004 + VOICE-002 (the Skia branch is GATE-C; the `react-native-svg` static-path branch is the mergeable floor).
- **VOICE-006 (#664)** snapshot-export spike — after VOICE-005 (capture path may be native → GATE-C; never a posting dependency).
- **VOICE-010 (#668)** device/web smoke matrix — after VOICE-008 (docs/testing; operator-armed live run).
- **AUDIO-001 (#671)** stays deferred P3, off the main path.

**Operator latitude (explicit):** VOICE-002 **MAY** proceed right after VOICE-001 + VOICE-ADR-001 if the operator wants the native dependency / config-plugin / dev-build work done early (e.g. to unblock the VOICE-005 live-render spike on a device sooner). VOICE-002 is **not required before** VOICE-003 / VOICE-004 — the pure-TS models do not import it. The only hard ordering constraints are: VOICE-007 (the adapter that *activates* the native modules) needs both VOICE-002 (native available) and VOICE-003 + VOICE-004 (the models it owns); and nothing downstream installs natively before VOICE-002.

**Rationale (summary).** Pure-TS-first is a repo doctrine (`expo-rn-patterns` §"File structure"; mirrored by `engine.ts` and the already-merged LIFE-001 / EV-003 / UX-MEDIATOR-001 model layers). Sequencing the pure models before the GATE-C native card (a) lets the highest-value, lowest-risk, fully-testable logic land and merge first; (b) de-risks VOICE-007/008 by having the state machine + waveform math already proven by the time the adapter wires them to real modules; (c) keeps the GATE-C dev-build work on its own clean boundary instead of blocking unrelated pure-TS review.

---

## §6.2 Persistence privacy patch (VOICE-009) — METADATA-FIRST

VOICE-001 §11 recommends Option A (a new `argument_voice_artifacts` child table, post-store service-role attach, RLS SELECT-only, audio-free, `ON DELETE CASCADE`). This patch keeps Option A and tightens **what** it persists: **persist METADATA, not a transcript duplication.**

**Recommended v1 persisted fields (metadata-first):**

| Field | Source | Notes |
|---|---|---|
| `argument_id` | returned `argument.id` | FK → `public.arguments`, `ON DELETE CASCADE` |
| `debate_id` | draft context | FK → `public.debates`, `ON DELETE CASCADE` |
| `input_mode` | session machine | `speech` / `text_fallback` provenance |
| `recognizer` / `platform` / `locale` | `SpeechCapabilitySnapshot` + transcript artifact | advisory provenance (`ios` / `android` / `web`; locale e.g. `en-US`) |
| `on_device_recognition` | `supportsOnDeviceRecognition()` | nullable when unknown |
| `was_edited` | `submittedBody !== rawTranscript` | neutral provenance, NEVER a credibility signal |
| `edit_distance` | transcript artifact | advisory `>= 0` |
| `interim_count` | session machine | mic-activity provenance `>= 0` |
| `duration_ms` | waveform artifact | `>= 0` |
| waveform **bucket summary** | `amplitudeBuckets` (≤256) + `peak_summary` / `rms_summary` | bounded, non-replayable loudness envelope |
| `metering_unavailable` / `stream_unavailable` | capability/runtime | degradation provenance |
| errors | plain-language summaries | NEVER raw `event.error` codes |
| `audio_persisted` | constant | literal `false` (CHECK `= false`) |
| `audio_uri` | constant | literal `null` (CHECK `IS NULL`) |
| `raw_audio_persisted` | constant | literal `false` |

**Do NOT (v1, unless the operator explicitly ratifies it):**

- **Do NOT persist the raw transcript text.** The transcript is a draft aid; once the user edits and posts, `public.arguments.body` is the canonical artifact. Persisting `rawTranscript` would (a) duplicate user content into a second table, (b) create a "what the recognizer heard vs what they posted" record that invites exactly the credibility/intent reading the doctrine forbids, and (c) widen the privacy surface for no v1 product need. If a later card needs a raw-transcript audit trail, it ratifies that field explicitly with its own privacy review.
- **Do NOT duplicate `submittedBody`.** `public.arguments.body` already stores it. Re-storing it in `argument_voice_artifacts` is redundant unless a named audit requirement justifies it (and then it is the *posted* body, never the raw transcript).

**Why metadata-first is the safer default.** Provenance metadata ("a move was drafted by speech on iOS, on-device, lightly edited, ~6s of speaking, this loudness envelope") is enough to power Family K (§6.7) and the provenance chips, while carrying **none** of the user's words and **none** of the audio. It keeps the no-audio posture type- and SQL-enforced (VOICE-001 §10, §11) and keeps the artifact off the acceptance-gate path entirely.

**Deploy posture unchanged:** VOICE-009 stays GATE-C (migration + Edge persistence). Operator runs `npx supabase db push --linked` + `npx supabase functions deploy attach-voice-artifact`. Claude does not deploy.

---

## §6.3 Voice-to-mediator bridge (VOICE-MEDIATOR-BRIDGE-001 — FUTURE add-on)

> **Status of this section:** a **described future add-on**, **NOT filed as a GitHub issue in this card.** It is a product idea that connects the speech-first entry path (VOICE-008/009) to the already-merged mediator board (UX-MEDIATOR-001 / UX-MEDIATOR-005). No code, no card-filing, no derivation change is authorized here.

**The product idea.** A user replying to another party's argument should **not** have to fully self-frame the honesty, context, or structural shape of their own counterargument before they have even said it. Self-certification before speaking is friction and it pushes the user toward defensiveness. Instead: keep the **pre-recording prompt minimal**, let the user speak naturally, and **derive the STRUCTURAL markup AFTER the response exists** — as a read-only projection, never a judgment.

**Flow (response-FIRST, markup-AFTER):**

1. **Target.** The user selects another party's node to answer (the existing side-rail / Act flow).
2. **Minimal pre-record prompt.** Ask only: **"What point are you answering?"** — plus an *optional* one-tap intent hint: *"Are you asking for a source, narrowing scope, defining a term, or directly replying?"* No detailed self-certification, no honesty attestation, no form to fill before the mic opens (see §6.4).
3. **Speak.** The user records; the live waveform confirms the mic is hearing them (§6.5).
4. **Transcript lands in the editable box.** Final transcript reaches `draft.body` through the *unchanged* `handleBodyChange` path (VOICE-001 §1.3, §5.4). Interim text is never written to the body.
5. **Edit + submit.** The user edits and submits through the **UNCHANGED deterministic engine** (`handleSubmit` → `evaluateArgumentDraft` → `submit-argument`). The bridge changes nothing on the gate path.
6. **AFTER the response is stored**, the mediator board re-derives — over the now-larger node graph + persisted observations — what this move did to the target point. It may surface (as STRUCTURAL STATE, read-only):
   - **responds-to-node-X** — the back-reference anchor (`PointAnchor.parentNodeId` / `targetExcerpt`).
   - **may-ask-for-evidence** — `needs_evidence` (`deriveMediatorBoardState` decision step 3; pathway step `provide_source`).
   - **may-indicate-scope-mismatch** — `scope_mismatch` (decision step 5; `ScopeMismatch` marker).
   - **may-indicate-definition-mismatch** — `definition_not_shared` (decision step 4; `DefinitionMismatch` marker).
   - **may-create / satisfy evidence-debt** — `EvidenceDebtView` open/blocked/settled roll-up.
   - **may-narrow-the-dispute** — `narrowed` (decision step 2 — "a repair, never a defeat").
   - **may-mark-the-target-point still-open / needs-evidence / structurally-impassed** — `open` / `needs_evidence` / `structured_impasse` on the *target* point, rendered on the other party's node as the point's structural state.
7. **Offer post-response markup of the OTHER party's node** as the point's structural state — never as a person judgment. (e.g. the target point's chip becomes "Needs evidence" or "Stuck here — both sides made the case," anchored to that node via the existing rail "View in timeline" jump.)

**Required doctrine for the bridge (binding when this add-on is eventually carded):**

- **User-response-FIRST, markup-AFTER.** The structural markup is derived only after the user's reply is stored. The mediator never pre-grades a draft and never asks the user to grade themselves.
- **Markup is an advisory, read-only projection.** It is `deriveMediatorBoardState` output (already pure, deterministic, JSON-serializable, never a gate — see `deriveMediatorBoardState.ts` header and `mediatorBoardTypes.ts` doctrine §1–§4). The bridge adds **no** new derivation logic and **no** write to the gate path.
- **No person labels.** The OTHER party's node gets the *point's* structural state, never a label about the person (`mediatorBoardTypes.ts` §1; the rail's `looksLikeInternalCode` + ban-list discipline).
- **No truth / winner / verdict; no intent / honesty judgment.** None of the mediator state codes is a verdict (`MediatorStateCode` is a structural vocabulary); the bridge must not add one.
- **Mark the POINT not the PERSON; preserve the machine-Observation vs user-Allegation boundary.** Bridge-derived markup is a machine **Observation** projection; it must not be rendered as a user **Allegation** against the other party.
- **Never block posting.** The bridge sits entirely downstream of `submit-argument`; permission denial, recognizer failure, and "no markup derivable yet" never block or delay the post (the engine already accepted it).

**Links (where this bridge plugs in):**

- **UX-MEDIATOR-001** — the projection that derives the structural state. `src/features/mediator/deriveMediatorBoardState.ts` (`deriveMediatorBoardState`, `deriveOpenDisagreementPoints`, `deriveEvidenceDebt`, `deriveResolutionPathways`, `deriveImpasseMarkers`). The bridge consumes its output; it does not modify the deriver.
- **UX-MEDIATOR-005** — the **Disagreement Points rail** (`src/features/mediator/DisagreementPointsRail.tsx`) where the target point's structural state and "what would help next?" already render read-only, with a "View in timeline" jump to the node. The bridge's post-response markup surfaces here.
- **VOICE-008** — speech in the entry surfaces; the bridge's minimal pre-record prompt + intent hint live in the recording affordance (§6.4).
- **VOICE-009** — persists the speech/waveform **metadata** (§6.2) that lets a post-response surface know the move was spoken.
- **MCP-K-001** — Family K MAY consume the persisted speech/waveform metadata **post-persistence** to add advisory provenance observations (`speech_input_used`, `transcript_was_edited`, etc.) that the mediator board can read — text+metadata only, never audio (§6.7).

---

## §6.4 Pre-record prompt patch (VOICE-007 / VOICE-008)

The recording affordance must **NOT** open with a legalistic self-certification form. A user about to speak should see a short, conversational invitation — not a checklist they must clear before the mic turns on.

**Default minimal, conversational prompt (plain language):**

- **"Speak your response. You can edit before posting."**
- **"Try to answer the selected point."**
- Optional one-tap chip row (intent hint, not a requirement): **"Reply · Ask source · Define term · Narrow scope · Add evidence"**.

The chip row is an *optional* nudge that seeds the existing move-type / `initialPatch` mechanism (VOICE-001 §1.2; `quickActionPresets`); skipping it is always fine and never blocks recording. **No detailed self-certification before recording.** The pre-send review (RULE-004 `onBeforeSubmit` / `postSignal`, owned by `ArgumentComposerDock`) stays **advisory and AFTER the transcript exists** — the user reviews and edits what they actually said, rather than promising in advance how they will behave.

Doctrine fit: every terminal/error state still falls back to the keyboard (VOICE-001 §5.5); the prompt copy routes through plain language; no field asks the user to attest to honesty, tone, or intent.

---

## §6.5 Waveform visual-path patch

CDiscourse becomes a **speech-first VISUAL PATH board**, not merely a textarea with dictation bolted on. The waveform is part of the product's identity: it shows the user that their *spoken response traced a path* to a specific point.

**Where the waveform appears:**

- **Live while recording** — the Skia live render (VOICE-005), with the `react-native-svg` static path as the deterministic floor (VOICE-001 §7, §9). Loudness shape only; grayscale-legible; reduce-motion snaps.
- **As compact, NON-replayable provenance on the local draft** — a small static envelope on the in-progress draft, derived from the bounded `amplitudeBuckets` (≤256), confirming "you spoke this draft." Not playable, not audio.
- **Optionally as a static path preview on a SUBMITTED node** — only **after VOICE-009 ratifies metadata persistence**, the bounded bucket summary may render as a small static waveform on the posted node (decoration / provenance, derived from the persisted metadata).

**Where the waveform NEVER appears / what it NEVER is:**

- **NEVER as playable audio** (no audio is stored — VOICE-001 §6.4, §15).
- **NEVER as emotional / tone / stress / confidence evidence** (VOICE-001 §7, §12, §17). The component has no prop and no code path encoding any per-speaker inference.

**Framing.** The waveform is associated with the **RESPONSE PATH** — "you spoke this response to this point" — **not** "proof of how you sounded." It is mic-active feedback and (post-store, optional) non-authoritative provenance. It never reaches the engine, the score model, or the acceptance gate (VOICE-001 §16.3 doctrine edges).

---

## §6.6 StartArgumentPage patch (VOICE-008)

VOICE-001 §1.4 correctly notes that **StartArgumentPage is NOT covered by the universal composer seam**: it is a separate `createDebate` path with its **own** `TextInput`s (resolution + body), not the universal `composer-body-input`. The universal `VoiceInputAdapter` (which wraps `ArgumentComposer`'s body input) therefore does **not** auto-cover the root-claim creation surface.

**Downstream requirement (binding on VOICE-008):** VOICE-008 must include a **SEPARATE StartArgumentPage adapter** that wraps the root-claim body `TextInput` with the *same* `VoiceInputAdapter` — reusing the shared VOICE-003 session model + VOICE-004 waveform model; only the wrapping target differs. **Do not let "one seam covers all entry windows" silently exclude the root-claim creation path.** A user who starts a brand-new argument by speaking is a first-class speech-first flow; if VOICE-008 only flips `voiceEnabled` on the OneBox/dock surfaces, the very first thing a new user does (state their claim) would have no voice path. The VOICE-008 test plan must assert StartArgumentPage reaches a working spoken body, and must prove the `createDebate` path's own gate is byte-unchanged (mirroring the `submit-argument`-unchanged assertion in VOICE-001 §16.1).

---

## §6.7 MCP-K wording patch

In the Family K design (MCP-K-001) and any persisted v1 metadata, replace the ambiguous bare term **"confidence"** with **"recognizer confidence"** — and only adopt it **if** it is platform-provided and can be safely documented as a property of the *recognizer output*, never of the *speaker*.

**Preferred posture for v1:** **OMIT** any confidence field from the persisted metadata (§6.2 does not list one) until a later card explicitly ratifies "recognizer confidence" with a clear definition and a doctrine review. The mediator board and Family K do not need it for v1 provenance.

**Hard boundary (restated):** Family K cannot observe **user confidence, emotional confidence, credibility, intent, or honesty.** "Recognizer confidence," if ever adopted, is a numeric property the STT engine attaches to its own transcription guess — it is provenance about the *machine's certainty in the words*, and it must never be rendered or interpreted as a signal about the *person*. Any field, label, or observation key that could read as speaker-confidence / emotional-confidence is forbidden (VOICE-001 §12 FORBIDDEN list; §17 doctrine self-check).

---

## Patches applied by this card (summary)

1. **NEW** `docs/designs/VOICE-PATCH-001-DAG-AND-MEDIATOR-BRIDGE.md` (this file) — §6.1–§6.7.
2. **PATCHED** `docs/designs/VOICE-SLATE-2026-06-13-INDEX.md` — VOICE-003/004 dependency cells (was "VOICE-002" → "VOICE-ADR-001 (pure-TS; not blocked by the VOICE-002 native install)"); §6 Dependency DAG re-branched so VOICE-003/004 come from VOICE-ADR-001/VOICE-001 before VOICE-002; §12 next command VOICE-001 → **VOICE-003**; a "Superseded by VOICE-PATCH-001 (DAG correction)" pointer near the DAG.
3. **PATCHED** `docs/core/next-prompts.md` — VOICE-SLATE start-here command VOICE-001 → **VOICE-003** (VOICE-001 done + VOICE-ADR-001 formalized; VOICE-003/004 pure-TS, before the GATE-C VOICE-002 native install); links VOICE-PATCH-001.

## Out of scope (this card)

- Any code, install, config-plugin edit, migration, Edge/Deno change, or GitHub issue filing. (VOICE-MEDIATOR-BRIDGE-001 is **described, not filed**.)
- Any change to `deriveMediatorBoardState.ts` / `mediatorBoardTypes.ts` / `DisagreementPointsRail.tsx` — the bridge consumes them read-only; it does not modify the deriver.
- Any deploy, any arm, any provider call, any service-role usage.
