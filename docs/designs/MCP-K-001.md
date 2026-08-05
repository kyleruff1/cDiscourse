# MCP-K-001 — Family K (`speech_waveform_artifact`) design

- **Card:** issue 669
- **Governing contracts:**
  - `docs/adr/VOICE-ADR-001-speech-first-no-audio-privacy.md` § MCP Family K boundaries (MAY / MAY NOT lists), § Forbidden inference list (with the `recognizerConfidence` wording patch), § Text fallback, § Data classification table
  - `docs/adr/VOICE-ADR-002-scoped-audio-persistence-one-time-playback.md` §0 (carry-forward of ADR-001 boundaries, verbatim), §12 enforcement checklist item "Family K payload schema contains no URL / audio field"
  - `docs/designs/VOICE-001.md` (voice shell doctrine + waveform-is-decoration rule)
  - `docs/designs/VOICE-003.md` (`SpeechTranscriptArtifact` shape, `deriveEditedProvenance`, forbidden-inference guard house pattern)
  - `docs/designs/VOICE-004.md` (`VoiceWaveformArtifact` shape, `SILENCE_THRESHOLD` pinned-constant pattern, source-scan guard extension)
  - `docs/core/pipeline-governance-contract.md` (mutation cards; MCP-K-002 is deploy-bearing GATE-C on Deno Deploy per ADR-001:157)
- **Status:** design ready for implementer (MCP-K-002)
- **Scope:** register a new MCP family `speech_waveform_artifact` (letter K, the next free letter after J) and define its ten boolean observations, each of which projects deterministically from a shipped `SpeechTranscriptArtifact` (VOICE-003) or `VoiceWaveformArtifact` (VOICE-004) field, or from a persisted `SpeechCapabilitySnapshot` companion row (see §12 for the operator ruling this depends on). K carries `authoritative: false`, runs post-store fire-and-forget, never appears in the acceptance gate, never emits a `PointStandingDelta`, and never characterizes the author.
- **Dependencies:** `VOICE-009` (artifact persistence) MUST ship before MCP-K-002 begins. MCP-K-002's Edge deriver reads `SpeechTranscriptArtifact` / `VoiceWaveformArtifact` rows produced by VOICE-009; running MCP-K-002 before VOICE-009 is a no-op (K observations degrade to their falsy default with no source-of-truth to read). If §12.1 rules OPTION A, VOICE-009 (or a companion VOICE-DB card) also ships the `SpeechCapabilitySnapshot` + `WaveformCapabilitySnapshot` INSERT-only tables.

## Summary

Family K is the eleventh MCP family (`A`–`J` already exist, `sensitive_composer` J is frozen). Its role is **provenance-only**: every K observation answers a yes/no question about *how the argument was captured* — voice vs typed, whether the recognizer was available, whether the session ended cleanly, whether the posted text differs from the initial transcript, whether the mic captured a usable signal. Every question is answered by looking at fields already persisted by VOICE-009 (the artifact-persistence card), so K is **source-uniform non-`ai_classifier`** (nine `auto_metadata` keys + one `lifecycle` key). K does not call Anthropic. It is not classified by an LLM. It is a pure boolean projection over deterministic artifact fields, computed at the Edge, and written to the same observation ledger as A–J.

The panel produced three source-classification lenses (uniform `ai_classifier`, mixed source, uniform non-`ai_classifier`). This design adopts the completeness critic's ruling — **uniform non-`ai_classifier`** — because every predicate is already a field on a persisted row; asking an LLM to answer questions whose answer is a literal field would burn tokens and introduce hallucination surface for zero value. The operational consequence is significant: **MCP-K-002 is not deploy-bearing on Deno Deploy** (no `mcp-server/lib/familyK*.ts` files needed) and instead ships an Edge deriver that reads VOICE-009 rows. Operator sign-off on this scope reduction is a §12 open question.

---

## §0 — Doctrine reconciliation

### 0.1 Card AC vs shipped design

| Card AC (issue 669)                                                                | Ship (per ADR-001 + ADR-002 + VOICE-003/004 parity)                                                                                                                                                                                       | Source                                                              |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 10 named observations including `low_transcript_confidence`                        | **8 shipped unchanged + 2 from splitting 1 fuzzy key + 1 DEFERRED slot documented but not populated = 10 shipped rawKeys total.** `low_transcript_confidence` is deferred (VOICE-003 §0 REMOVED all confidence fields; ADR-001 wording patch says v1 prefers deferring confidence entirely). `transcript_heavily_edited_after_dictation` splits into `transcript_was_edited` + `transcript_edit_distance_high`. | Critic ruling; VOICE-003 §0; ADR-001 § Forbidden inference wording patch |
| `transcript_heavily_edited_after_dictation` (one rawKey with a fuzzy "heavily")    | **SPLIT.** `transcript_was_edited` (verbatim from ADR-001:141) + `transcript_edit_distance_high` (threshold predicate against pinned module constant `K_TRANSCRIPT_EDIT_DISTANCE_HIGH`, mirroring VOICE-004's `SILENCE_THRESHOLD = 0.02` pattern). | Critic ruling; ADR-001:141 verbatim vocabulary                      |
| `speech_audio_level_too_low_for_reliable_capture`                                  | **RENAMED** to `speech_capture_signal_below_threshold`. Scopes the observation to the *recorder capture path*, not the *speaker*. The plain-language mapping must never read "the speaker was quiet."                                     | Critic doctrine-risks ruling; ADR-001 § Forbidden inference (biometric / stress / arousal) |
| `recognizer_unavailable`, `waveform_metering_unavailable`, `text_only_fallback_used` | Require a persisted `SpeechCapabilitySnapshot` companion row (per §12 open question). Without it these observations return **`unknown`** (never `false`) — see INV-K-UNKNOWN in §8.                                                     | Critic ruling; VOICE-003 INV-A3 / VOICE-004 INV-A4 (unavailable yields NULL) |
| `speech_capture_artifact_incomplete` source unspecified                             | **`source: 'lifecycle'`** (not `auto_metadata`). Terminal-state / completeness observations map to `lifecycle` semantically per `nodeLabelTypes.ts:37-38`. Nine other K keys map to `auto_metadata`.                                    | Critic ruling                                                       |
| Family K classification for source-uniformity                                       | **Source-uniform non-`ai_classifier`.** 9 `auto_metadata` + 1 `lifecycle`. NO entry in `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (the Edge builder map at `booleanObservationRequestBuilder.ts:68`). NO `FAMILY_K_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant. NO `mcp-server/lib/familyK*.ts` files. MCP-K-002 becomes an upstream-registry + Edge-deriver card, NOT GATE-C on Deno Deploy. | Critic ruling; ADR-001:157; HALT-14 rule (unnecessary supported-sources entry is itself a defect) |
| `productionEnabled` posture                                                         | **`productionEnabled: false, adminValidationEnabled: true`** at MCP-K-002 ship. Mirrors Family J's frozen ceiling. A production flip is a separate future card with a fresh `cdiscourse-doctrine` §10a review.                          | PRECEDENT-PARITY ruling; `familyRegistry.ts:114-118`               |

### 0.2 Carry-forward from ADR-001 § MCP Family K boundaries (verbatim)

- Family K is **POST-STORE ONLY** and **cannot affect submit**.
- Family K MAY consume submitted text, post-store speech provenance metadata, `transcript_was_edited`, edit-distance summary, recognizer availability / errors, duration, locale / language, bounded amplitude summary, text-fallback-used flag.
- Family K MAY NOT consume raw audio, a local audio URI, any playable file, a waveform image that includes user text, or any emotion / identity / speaker-state / truth / credibility / intent feature (the entire § Forbidden inference list).
- Family K must respect the MCP response cap (`MAX_FLAGS_PER_RESPONSE = 20`).

VOICE-ADR-002 §0 restates this verbatim under scoped-audio persistence: "Under this ADR the audio object now exists, but Family K still never receives a URL, a storage key, a playable file, or audio bytes — the MAY / MAY NOT boundary above is unchanged."

### 0.3 `recognitionConfidence` / `recognizerConfidence` wording lock

If the DEFERRED slot `low_transcript_confidence` is ever ratified by a future ADR bump, the internal field name MUST be `recognitionConfidence` or `recognizerConfidence` (recognizer property). "Speaker confidence" is banned (person-trait inference). The recognizer's accuracy is a property of the *software*, never of the *person speaking*.

---

## §1 — Family K registry entry

### 1.1 Source-uniformity ruling

**K is source-uniform non-`ai_classifier`.** The eleven per-key source values are drawn from two of the deterministic Machine-Observation source subtypes declared at `src/features/nodeLabels/nodeLabelTypes.ts:37-38`:

- `'auto_metadata'` (Source 2) — nine keys (all boolean-field or threshold-predicate projections).
- `'lifecycle'` (Source 3) — one key (`speech_capture_artifact_incomplete`, terminal-state / completeness observation).

Neither `semantic_referee` nor `ai_classifier` appears in K's v1 registry. Consequences:

- **NO** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['speech_waveform_artifact']` entry in `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts`. Per the source-uniform Family J precedent (design §7.1 / HALT-14), an unnecessary entry is itself a defect.
- **NO** `FAMILY_K_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant.
- **NO** `mcp-server/lib/familyKKeys.ts` / `familyKPrompt.ts` / `familyKAnthropic.ts` / `familyKFixtureProvider.ts` / `familyKBanListScan.ts` files — the six-file mcp-server sibling convention applies only to families with at least one `ai_classifier` or `semantic_referee` key. K is Edge-derived only.
- **NO** `mcp-server/tests/familyKKeysParity.test.ts` (there is no server mirror to keep in parity).

If §12 open question 12.3 rules that a future K increment ships an `ai_classifier` key (e.g. a ratified `recognizerConfidence`), the source-uniformity ruling **must** be revisited via a fresh design and MCP-K-002 becomes GATE-C on Deno Deploy.

### 1.2 Family taxonomy edits

Two coordinated additions to the `MachineObservationFamily` union — one upstream, one in the Edge mirror. Both files must land in the same MCP-K-002 commit.

| File                                                                                             | Edit                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/nodeLabels/nodeLabelTypes.ts`                                                       | Append `\| 'speech_waveform_artifact'` to `MachineObservationFamily` (currently ends at `'sensitive_composer'`, line 189). Append `'speech_waveform_artifact'` as the eleventh entry of `ALL_MACHINE_OBSERVATION_FAMILIES` (line 205). Update the doc-comment count "10 families" → "11 families". |
| `supabase/functions/_shared/booleanObservations/nodeLabelTypes.ts`                                | Twin edit — parity is enforced by `mcpOneTwoOneCEdgeParserParity`. Same append at the corresponding line in the Edge-side type file.                                                                                                             |

### 1.3 `FAMILY_REGISTRY` entry (Edge)

Append to `supabase/functions/_shared/booleanObservations/familyRegistry.ts` `FAMILY_REGISTRY` (line 68), as the eleventh entry after `sensitive_composer`:

```
{
  family: 'speech_waveform_artifact',
  productionEnabled: false,
  adminValidationEnabled: true,
},
```

Rationale: mirrors J's frozen ceiling. Card is design-only; MCP-K-002 has not shipped; VOICE-009 artifact rows have not shipped; the capability-snapshot decision (§12.1) is unresolved. A production flip requires a separate future card + a fresh `cdiscourse-doctrine` §10a review.

### 1.4 Upstream definition file wiring

`src/features/nodeLabels/machineObservationDefinitions.ts` composes `ALL_DEFINITIONS` from ten per-family imports (`FAMILY_A_DEFINITIONS` … `FAMILY_J_DEFINITIONS`). MCP-K-002 adds an eleventh import + push:

```
import { FAMILY_K_DEFINITIONS } from './machineObservationDefinitions/familyK';
// …
for (const def of FAMILY_K_DEFINITIONS) all.push(def);
```

Order: appended after the FAMILY_J block. Missing this edit produces an orphan family file: `familyK.ts` compiles but `FAMILY_K_DEFINITIONS` never reaches `ALL_DEFINITIONS`, K silently no-ops, and no test catches it (registration is the load-bearing linkage).

### 1.5 No `mcp-server` registration

Because K has zero `ai_classifier` keys in v1, `mcp-server/lib/familyRegistryInit.ts` receives **no** `register('speech_waveform_artifact', …)` call. The mcp-server never sees K. This is the source-uniform non-`ai_classifier` architectural difference from J (semantic_referee) and E/F/H (ai_classifier). If §12.3 later ratifies an `ai_classifier` key, that follow-up card adds the `register(…)` call, the six sibling files, and the parity test — all within its own scope.

---

## §2 — The 10 boolean observations

All ten entries share:

- `family: 'speech_waveform_artifact'`
- `kind: 'machine_observation'`
- `defaultSurface: 'inspect'`
- `disposition: 'inspect_only'` (mirrors J's inspect-only pair; K is provenance about the AUTHOR'S OWN artifact, so `composer_only` and `inspect_only` are the only defensible dispositions — `timeline_node` on a target's node would read as accusation)
- `visibleByDefault: false`
- `confidenceEligibility: { timelineMinConfidence: 'high', selectedContextMinConfidence: 'high', inspectMinConfidence: 'high' }`
- `id: 'registry:machine_observation:<source>:<rawKey>'` where `<source>` is `auto_metadata` or `lifecycle`
- Priority: unique integers in the 55-64 band (continuing J's inspect-only 53-54; keeps K low-priority relative to argument-substance labels while preserving within-K ordering)

Two source-scan-pinned module constants live at the top of `src/features/nodeLabels/machineObservationDefinitions/familyK.ts` and are referenced by the Edge deriver:

- `K_TRANSCRIPT_EDIT_DISTANCE_HIGH` — a character-count threshold pinned as an integer (MCP-K-002 chooses the initial value; recommend **40**). Mirrors VOICE-004's `SILENCE_THRESHOLD = 0.02` pinned-constant pattern.
- `K_PEAK_LEVEL_LOW_THRESHOLD` — an amplitude threshold in the shipped `[0,1]` normalized envelope. Recommend **0.05** (above VOICE-004's `SILENCE_THRESHOLD = 0.02` so `terminalState === 'no_signal'` and "below-threshold-but-not-silent" remain distinct observations).

Both constants are non-configurable in v1 and source-scan enforced by the doctrine guard (§8, INV-C).

### 2.1 Observation table

| # | rawKey                                    | source           | Artifact-field dependency                                                                                                                                                                                                                                                    | true-condition                                                                                                                                                                                                                                                             | false-condition                                                                                                                                    | Plain-language TRUE                                                        | Plain-language FALSE                          | Why not a forbidden inference                                                                                                                              |
|---|-------------------------------------------|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------|-----------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | `speech_input_used`                       | `auto_metadata`  | Presence of a persisted `SpeechTranscriptArtifact` row (VOICE-009) linked to `public.arguments.id`.                                                                                                                                                                          | A `SpeechTranscriptArtifact` exists AND `terminalState ∈ {'final','interrupted','timeout_no_speech','error'}` (any artifact-yielding terminal per VOICE-003).                                                                                                              | No `SpeechTranscriptArtifact` for this argument (pure-text path).                                                                                  | The author started with voice input.                                        | The author typed this without voice input.    | Provenance of the entry method. Describes the artifact's existence, never the author.                                                                       |
| 2 | `text_only_fallback_used`                 | `auto_metadata`  | `SpeechCapabilitySnapshot` row (§12.1) for the composer session showing `voiceOfferable === false` OR a prior aborted speech session in the same composer window; combined with an argument submitted without a linked `SpeechTranscriptArtifact`.                            | The composer session recorded a voice-then-fallback sequence OR the persisted snapshot proves voice was not offerable, AND the submitted body arrived without a linked transcript artifact.                                                                                | The submitted body has a linked transcript artifact, OR no evidence that a fallback path was traversed. Returns **`unknown`** if §12.1 is unresolved. | Voice input was tried and typing was used to finish.                        | No text-only fallback was observed.           | Text fallback is guaranteed at every entry window (ADR-001 § Text fallback verbatim). Using it is neutral provenance, never a signal of author skill.       |
| 3 | `recognizer_unavailable`                  | `auto_metadata`  | `SpeechCapabilitySnapshot.voiceOfferable === false` for the composer session (§12.1).                                                                                                                                                                                        | `SpeechCapabilitySnapshot.voiceOfferable === false` at compose time.                                                                                                                                                                                                       | `SpeechCapabilitySnapshot.voiceOfferable === true`. Returns **`unknown`** if §12.1 is unresolved.                                                  | The speech recognizer was not available on the author's device or browser. | The speech recognizer was available.          | Device / browser / platform property. ADR-001:95: "recognizer accuracy is a property of the software, never of the person speaking."                        |
| 4 | `speech_session_interrupted`              | `auto_metadata`  | `SpeechTranscriptArtifact.terminalState` (VOICE-003 shipped enum).                                                                                                                                                                                                           | `SpeechTranscriptArtifact.terminalState === 'interrupted'`.                                                                                                                                                                                                                | Any other terminal state OR no artifact.                                                                                                           | The speech session was interrupted before it completed.                     | The speech session was not interrupted.       | Interruption is a session-lifecycle property (backgrounding, phone call, tab switch, permission revoked mid-session). Never a property of the author.       |
| 5 | `speech_timeout_or_no_speech`             | `auto_metadata`  | `SpeechTranscriptArtifact.terminalState`.                                                                                                                                                                                                                                    | `SpeechTranscriptArtifact.terminalState === 'timeout_no_speech'`.                                                                                                                                                                                                          | Any other terminal state OR no artifact.                                                                                                           | The speech session ended without capturing any speech.                      | The speech session captured speech.           | Recognizer's own no-speech / timeout terminal — a recognizer property, not a person property. Plain-language MUST NOT read "the author was silent."         |
| 6 | `transcript_was_edited`                   | `auto_metadata`  | `SpeechTranscriptArtifact.wasEdited` (derived at submit time by `deriveEditedProvenance(rawTranscript, draft.body)` per VOICE-003 §0).                                                                                                                                       | `SpeechTranscriptArtifact.wasEdited === true`.                                                                                                                                                                                                                             | `SpeechTranscriptArtifact.wasEdited === false` OR no artifact.                                                                                     | The posted text differs from the initial transcript.                        | The posted text matches the initial transcript. | Neutral provenance (ADR-001:72 verbatim: "never credibility, honesty, or sincerity signals; no downstream consumer including Family K may interpret them as such"). |
| 7 | `transcript_edit_distance_high`           | `auto_metadata`  | `SpeechTranscriptArtifact.wasEdited` AND `SpeechTranscriptArtifact.editDistance` AND the pinned constant `K_TRANSCRIPT_EDIT_DISTANCE_HIGH`.                                                                                                                                  | `wasEdited === true` AND `editDistance >= K_TRANSCRIPT_EDIT_DISTANCE_HIGH`.                                                                                                                                                                                                | `wasEdited === false` OR `editDistance < K_TRANSCRIPT_EDIT_DISTANCE_HIGH` OR no artifact.                                                          | The posted text differs substantially from the initial transcript.          | The posted text is close to the initial transcript. | Same neutral-provenance doctrine as #6. Description MUST NOT frame large edits as suspicious. Threshold is a pinned constant, not a fuzzy judgment.       |
| 8 | `waveform_metering_unavailable`           | `auto_metadata`  | `WaveformCapabilitySnapshot` row (§12.1) OR `VoiceWaveformArtifact.terminalState === 'error'` AND `lastErrorCode === 'metering_lost'`.                                                                                                                                       | Any of: (a) `WaveformCapabilitySnapshot.waveformOfferable === false`; (b) `VoiceWaveformArtifact.terminalState === 'error'` AND `lastErrorCode === 'metering_lost'`; (c) `sampleCount === 0`.                    | A well-formed `VoiceWaveformArtifact` with `sampleCount > 0` OR no waveform session was attempted. Returns **`unknown`** if §12.1 is unresolved for path (a). | The device could not render a live loudness indicator during recording.     | The device rendered a live loudness indicator. | Metering-availability is a device / OS / browser property. VOICE-001 doctrine: waveform is "feedback that the microphone is active — NOT evidence of what was said." |
| 9 | `speech_capture_signal_below_threshold`   | `auto_metadata`  | `VoiceWaveformArtifact.terminalState === 'no_signal'` OR `VoiceWaveformArtifact.peakLevel < K_PEAK_LEVEL_LOW_THRESHOLD` (pinned).                                                                                                                                            | `VoiceWaveformArtifact.terminalState === 'no_signal'` OR (`terminalState === 'finalized'` AND `peakLevel < K_PEAK_LEVEL_LOW_THRESHOLD`).                                                                                                                                    | No waveform artifact OR `peakLevel >= K_PEAK_LEVEL_LOW_THRESHOLD`.                                                                                 | The microphone captured a very low signal during this recording.            | The microphone signal was normal.             | RECORDER property (peakLevel is a mic-capture amplitude bin). Plain-language MUST NOT read "the speaker was quiet / mumbling / soft-spoken" — biometric drift banned. |
| 10 | `speech_capture_artifact_incomplete`      | `lifecycle`      | `SpeechTranscriptArtifact.terminalState` AND `VoiceWaveformArtifact.terminalState` AND presence-of-both-artifacts when the composer session was voice-authored.                                                                                                              | Any of: (a) `SpeechTranscriptArtifact.terminalState ∈ {'interrupted','error'}`; (b) `VoiceWaveformArtifact.terminalState ∈ {'aborted','error'}`; (c) exactly one of the two artifacts is present when the composer session was a voice session (asymmetric-persistence failure). | Both artifacts present AND both in clean-finish terminals (`'final'`/`'timeout_no_speech'` + `'finalized'`/`'no_signal'`).                          | The voice-capture record for this post is incomplete.                       | The voice-capture record for this post is complete. | Lifecycle observation on the persisted provenance pair. Never implies the author's post is incomplete or the argument is incomplete.                       |

> **Row 8 path (c) note.** Path (c) simplified to `sampleCount === 0` alone; `audioSource === 'metering_only'` is the fresh-artifact default per `voiceWaveformArtifact.types.ts:87` and would be redundant. Belt-and-suspenders `metering_only` check is deferred until K is fed non-fresh artifacts (not the shipped state).

### 2.2 DEFERRED slot: `low_transcript_confidence`

**Explicitly deferred from v1.** The design names the slot and documents the boundary conditions so a future ADR bump can ratify it against a known specification, but no rawKey is added to `FAMILY_K_DEFINITIONS`. Rationale:

- VOICE-003 §0 REMOVED every confidence field: "No confidence, recognitionConfidence, recognizerConfidence, or speakerConfidence field appears anywhere in `src/features/voice/**`. Deferred entirely for v1."
- VOICE-ADR-001 § Forbidden inference list wording patch (carried forward verbatim by VOICE-ADR-002 §0): "v1 should prefer deferring confidence entirely."
- Shipping as an always-false stub would silently misrepresent — users / admins could not distinguish "never surfaced" from "always false." A three-way stub returning `unknown` is legitimate but the doctrine says defer entirely rather than seed the shape.

**If ratified later** (a future ADR-K-002 or an ADR-001 wording-patch bump):
- The internal field MUST be named `recognitionConfidence` or `recognizerConfidence`. `speakerConfidence` is banned.
- The observation MUST NOT compare the confidence value against speaker traits.
- The rawKey adds K to the `ai_classifier` source set — the source-uniform ruling in §1.1 breaks and MCP-K-002's successor becomes GATE-C on Deno Deploy.

---

## §3 — Forbidden observations

K MUST NOT detect, infer, score, label, or expose any of:

**From ADR-001 § Forbidden inference list (verbatim):** emotion detection · tone judgment · voice stress · anger · confidence as a speaker / person trait · honesty / sincerity · manipulation-by-voice · biometric inference · speaker identity · credibility · intent · truth (no truth value on any claim) · winner / loser / verdict · public-person accusation.

**From card AC (verbatim):** angry · emotional · manipulative · dishonest · intent · credibility · voice-stress · biometric · accusation · verdict.

**From VOICE-004 waveform-specific extensions (source-scan enforced today at `voice004ForbiddenInferenceGuard`):** formant · phoneme · spectrogram · prosody · voiceprint · speakerId · shoutingIndicator · aggressionLevel · stressScore · voice signature · vocal print · arousal · pitch · fft · mfcc · envelope-as-signal-feature.

**Also banned in every K string:** troll · bot · astroturfer · liar · propagandist · extremist · bad faith · manipulative (mirroring the anti-amplification banned-label list).

### §3 authoritative inheritance

> **The K forbidden-inference guard inherits the shipped voice004 lexicon in its entirety, not just the tokens enumerated above.** `familyKForbiddenInferenceGuard.test.ts` MUST import and reuse `voice004ForbiddenInferenceGuard`'s exported `WHOLE_WORD_BANS_INHERITED` + `WHOLE_WORD_BANS_WAVEFORM` + `SUBSTRING_BANS` verbatim (mirroring VOICE-004's own inheritance of VOICE-003's list). It additionally adds the two card-AC tokens missing from voice004 today — `emotional` and `accusation` — as K-specific extensions. The enumeration in §3 above is illustrative for readers; the source-of-truth is the shipped voice004 guard file plus these two additions. Any voice004 lexicon expansion automatically extends K's guard without a K-side edit.

The union of the three lists appears in NO K rawKey, `label`, `shortLabel`, `description`, `positiveDefinition`, `negativeDefinition`, `positiveExample`, `negativeExample`, `falsePositiveGuard`, `doctrineNote`, or plain-language mapping string. Enforced by `familyKForbiddenInferenceGuard.test.ts` (§9), which mirrors VOICE-003 / VOICE-004's guard house pattern and ships with a firing positive-control fixture.

Additional K-specific bans that surface only in the plain-language mapping:

- `the speaker was silent / hesitant / quiet / soft-spoken / mumbling` — biometric drift on `speech_timeout_or_no_speech` and `speech_capture_signal_below_threshold`.
- `suspicious / dishonest / evasive edit` — credibility drift on `transcript_was_edited` and `transcript_edit_distance_high`.
- `analyzed the voice / voice indicators / voice analysis` — biometric drift as a family header string.

---

## §4 — Post-store contract

K observations are computed AFTER the argument row exists in the persisted-artifact tables (VOICE-009), fire-and-forget off the 201 critical path. Concretely:

- `supabase/functions/submit-argument/index.ts` performs the service-role INSERT into `public.arguments` around lines 376-380 (per the referenced context).
- The auto-trigger fan-out is dispatched around `submit-argument/index.ts:811-846` (`dispatchAutoTriggerForArgument`, un-awaited, kept alive by `EdgeRuntime.waitUntil`), AFTER the 201 has been prepared.
- K attaches at the same fan-out point as A-J. K NEVER appears in the deterministic engine (`src/domain/constitution/engine.ts` / `evaluateArgumentDraft.ts`) and NEVER influences the pre-insert `validationFailed` branch.

**Byte-equal proof.** MCP-K-002's GATE-A/B evidence must include a byte-equal diff of `submit-argument/index.ts` demonstrating that the acceptance path (from request parse through 201 response construction) is unchanged and only the fan-out dispatcher receives an additional K classifier hook. A test asserts `dispatchAutoTriggerForArgument` is invoked with `insertedArg.id` set to a valid UUID before any K code path is reachable.

Failure modes handled by post-store fan-out:

- K classifier failure / timeout / mcp_validation_failed — does NOT change the submit response, does NOT delete or hide the row, does NOT delay the 201.
- K observation ledger row absent — the argument still renders; the K observation surface degrades gracefully to "no observations for this argument."

---

## §5 — Cap + batching

K contains 10 rawKeys in v1. `MAX_FLAGS_PER_RESPONSE = 20` per `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:35` and the Edge mirror at `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts:161`. K is comfortably under the cap by 10 keys.

**Response shape.** One entry per checked key regardless of true/false (per `booleanObservationBatching.ts:5-7`: "counted over EVERY checked key (true and false)"). A K request producing 10 checked keys returns 10 entries in each of `observations` / `confidence` / `evidenceSpan` / `checkedRawKeys`. K's Edge deriver output MUST be structurally identical to what an MCP response would produce — same four coordinated maps, same key-set coordination, same validator (`validateMcpBooleanObservationResponse`) — so downstream `admin_validation` surfaces stay family-agnostic.

**No batching required in v1.** If a future K increment ever grows past 20 rawKeys (a hypothetical only — no such expansion is on the roadmap), the shipped `#545` request-batching path (`chunkRawKeys` / `buildBatchRequestFromFull` / `mergeBatchResponses` at `supabase/functions/_shared/booleanObservations/booleanObservationBatching.ts`) handles the split unchanged. `BATCH_SIZE = 16`, `BATCH_SPLIT_THRESHOLD = 20`, all-or-nothing merge, single `run_id`, lexicographic pre-sort so idempotent re-runs keep a given rawKey in the same batch. Precedent: Family D 22 → 16+6, Family G 21 → 16+5. Do NOT introduce a K-specific batching constant.

**Cap-invariant test.** A size-invariant test in the K parity suite asserts `FAMILY_K_DEFINITIONS.length === 10` and `FAMILY_K_DEFINITIONS.length <= MAX_FLAGS_PER_RESPONSE`. Any K expansion beyond 20 must go through the shipped batching path.

---

## §6 — Plain-language mapping surface

Per card AC bullet 5, no raw codes surface to users. Every K rawKey that ever reaches a user surface (composer nudge, inspect chip, admin dashboard) MUST have a plain-language entry.

**Placement.** K's plain-language mappings live in `src/features/arguments/gameCopy.ts` (specifically the `toPlainLanguage` map that already routes internal codes to normal-user prose per the shipped Stage-6.4 seamless-conversation-entry copy layer). Rationale:

- `gameCopy.ts` is inside the `uxDoctrineCopyLint` `SCAN_SET_TIER_A` (25 authored files scanned by `__tests__/uxDoctrineCopyLint.test.ts:196-231`). Placing K's plain-language strings there means the shipped doctrine ban-list scan already covers them without a SCAN_SET amendment — no risk of surface drift shipping past the guard.
- A NEW `*Copy.ts` file (e.g. `src/features/voice/voiceProvenanceCopy.ts`) is legal ONLY if the file path is added to `SCAN_SET_TIER_A` in the same PR. Failing to add it silently bypasses the doctrine ban-list scan for K's copy — verdict / emotion tokens could ship in K user-facing strings with no test catching them. If MCP-K-002 elects a new file, the SCAN_SET amendment is a mandatory reviewer checklist item.

**Admin surface parity.** K rawKeys surfaced in `admin_validation` dashboards MUST use the same `toPlainLanguage` mapping — a single source of truth. The admin plain-language strings pass through the same forbidden-inference guard.

**Family header string.** The `MachineObservationFamily` code `'speech_waveform_artifact'` is internal only. Any user-facing family-header string (e.g. "Composition method" or "Draft provenance") MUST NOT read "voice analysis" or "voice indicators" — those phrases invite biometric drift. Bind the family header string to inert language.

---

## §7 — File layout MCP-K-002 will create

Given the source-uniform non-`ai_classifier` ruling in §1.1, the file layout is **substantially reduced** from the six-file `mcp-server` sibling convention. MCP-K-002 creates or edits the following files ONLY:

### 7.1 New files

| File                                                                                     | Purpose                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/nodeLabels/machineObservationDefinitions/familyK.ts`                        | The 10-entry `FAMILY_K_DEFINITIONS: ReadonlyArray<MachineObservationDefinition>` (each `Object.freeze`d), plus the two pinned constants `K_TRANSCRIPT_EDIT_DISTANCE_HIGH` and `K_PEAK_LEVEL_LOW_THRESHOLD`.                 |
| `supabase/functions/_shared/booleanObservations/familyKEdgeDeriver.ts`                    | Pure-TS deriver that reads the persisted VOICE-009 rows (`SpeechTranscriptArtifact`, `VoiceWaveformArtifact`, `SpeechCapabilitySnapshot`, `WaveformCapabilitySnapshot`) for a given argument and produces the K response envelope (`observations` / `confidence` / `evidenceSpan` / `checkedRawKeys` / `modelInfo`) with `classifierSetVersion: 'family-k-v1'`, `run_mode: 'admin_validation'`. Structurally identical to an MCP response. Emits `unknown` where §12.1 open questions leave a source-of-truth gap. |
| `src/features/nodeLabels/machineObservationDefinitions/__tests__/familyK.test.ts`         | Per-key predicate tests (each with a fake `SpeechTranscriptArtifact` / `VoiceWaveformArtifact` / capability-snapshot fixture asserting the true / false / unknown output).                                                 |
| `src/features/voice/__tests__/familyKForbiddenInferenceGuard.test.ts`                     | Doctrine source-scan: reads `familyK.ts` and the plain-language mapping additions to `gameCopy.ts` as source text and asserts none of the §3 forbidden-token union appears in any string. Ships with a firing positive-control `.ts.txt` fixture that inserts a banned token and proves the guard bites (mirroring `voice003ForbiddenInferenceGuard` / `voice004ForbiddenInferenceGuard`). |
| `supabase/functions/_shared/booleanObservations/__tests__/familyKEdgeDeriver.test.ts`     | Integration-style tests exercising the ten scenarios from §9's test plan, including the ternary-value `unknown` return path and the "no `parentText` in K payload" source-scan.                                            |

### 7.2 Edited files

| File                                                                                                       | Edit                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/nodeLabels/nodeLabelTypes.ts`                                                                 | Append `'speech_waveform_artifact'` to `MachineObservationFamily` union + `ALL_MACHINE_OBSERVATION_FAMILIES` frozen array. Update the doc-comment count.                                                                                                                                                                   |
| `supabase/functions/_shared/booleanObservations/nodeLabelTypes.ts`                                          | Twin edit, parity-enforced.                                                                                                                                                                                                                                                                                                |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts`                                          | Append 11th entry `{ family: 'speech_waveform_artifact', productionEnabled: false, adminValidationEnabled: true }`.                                                                                                                                                                                                        |
| `src/features/nodeLabels/machineObservationDefinitions.ts`                                                  | Add 11th import + push (see §1.4).                                                                                                                                                                                                                                                                                         |
| `src/features/arguments/gameCopy.ts`                                                                        | Add plain-language mappings for the 10 K rawKeys (or 8 if §12.1 defers the two capability-snapshot-dependent keys).                                                                                                                                                                                                        |
| `supabase/functions/submit-argument/index.ts`                                                                | Register K in the auto-trigger fan-out dispatcher (single-line addition alongside A-J at the fan-out point). Acceptance path (pre-insert) BYTE-UNCHANGED.                                                                                                                                                                   |
| **DB migration** (if §12.1 rules "ship capability-snapshot")                                                 | Creates `speech_capability_snapshots` + `waveform_capability_snapshots` tables (INSERT-only, RLS: author + admin SELECT, service-role INSERT). Table shape TBD in that follow-up card.                                                                                                                                     |

### 7.3 NOT created (source-uniform ruling consequence)

- `mcp-server/lib/familyKKeys.ts` — no server mirror because K makes no MCP call.
- `mcp-server/lib/familyKPrompt.ts` / `familyKAnthropic.ts` / `familyKFixtureProvider.ts` / `familyKBanListScan.ts` — no six-file sibling set.
- `mcp-server/tests/familyKKeysParity.test.ts` — no mirror to keep in parity with.
- `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['speech_waveform_artifact']` entry — HALT-14 defect if added.
- `FAMILY_K_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant — no exclusions needed when the family has no `ai_classifier` keys.

If §12.3 ratifies a future `ai_classifier` K key, its follow-up card creates all the above files under its own scope.

### 7.4 Read-side RLS on the K observation ledger

K observation rows carry drafting provenance about the AUTHOR (voice / typed / edited / capture-signal-below-threshold). Publishing them alongside the argument would leak drafting behavior the author did not consent to disclose. K's ledger rows are readable ONLY by:

- The argument's author (matched by `arguments.author_id` = `auth.uid()`).
- Platform-role moderators and admins (`is_moderator_or_admin()`).

K observations MUST NOT surface on the argument's public read path in v1. A future card MAY promote specific K keys to public read after a `cdiscourse-doctrine` §10a review. The RLS policy on the K rows lives in MCP-K-002's migration (if one is needed for K persistence — this depends on whether K reuses the existing MCP observation table with a `family = 'speech_waveform_artifact'` filter or gets its own table). If reusing the shared MCP observation table, no new RLS policy is required BUT a SELECT-side policy on `family = 'speech_waveform_artifact'` must restrict reads to author + moderators/admins.

---

## §8 — Doctrine invariants (INV-A / INV-B / INV-C)

Following VOICE-003 / VOICE-004's invariant taxonomy:

- **INV-A (TS-enforced):** compile-time guarantees the type system enforces.
- **INV-B (runtime-asserted):** guarantees the code asserts at execution time.
- **INV-C (source-scan-guarded):** guarantees a build-time source-scan test enforces.

### 8.1 TS-enforced (INV-A)

- **INV-A1** — `family` field of every entry in `FAMILY_K_DEFINITIONS` is the literal `'speech_waveform_artifact'`. Enforced by the `MachineObservationFamily` union.
- **INV-A2** — `source` field of every K entry is `'auto_metadata'` OR `'lifecycle'`. `semantic_referee` / `ai_classifier` / `composition_mutation` / `manual_tag` / `future_source` are legal in the wider union but do not appear in K in v1. Enforced by narrowing the union at declaration.
- **INV-A3** — `disposition` field of every K entry in v1 MUST be the literal `'inspect_only'`. Widening to `'composer_only'` or `'hidden_sensitive'` is legal in the wider union but gated to a future K increment card. Enforced by declaration type + a parity test (INV-C4).
- **INV-A4** — the two module constants (`K_TRANSCRIPT_EDIT_DISTANCE_HIGH`, `K_PEAK_LEVEL_LOW_THRESHOLD`) are `const` literals — TS never allows a runtime override.

### 8.2 Runtime-asserted (INV-B)

- **INV-B1** — K classifier response supports ternary values (`true | false | 'unknown'`). Absence of a source-of-truth field yields `'unknown'`, never `false`. See INV-K-UNKNOWN below.
- **INV-B2** — the K Edge deriver runs POST-STORE only. A runtime assertion at the top of the deriver refuses to run unless `argument_id` refers to an already-inserted row.
- **INV-B3** — the K payload builder rejects any input that references `parentText`, `parentNodeId`, or `threadContextExcerpt`. K is an ARTIFACT-SELF observation family — sending parent context invites a future maintainer to write a K predicate that infers author-consistency from parent.
- **INV-B4** — `FAMILY_K_DEFINITIONS.length` is asserted `<= MAX_FLAGS_PER_RESPONSE` at module load.

### 8.3 Source-scan-guarded (INV-C)

- **INV-C1 — Forbidden-inference guard.** `familyKForbiddenInferenceGuard.test.ts` reads `familyK.ts`, the plain-language mapping entries in `gameCopy.ts`, and any other K-owned copy file, as source text, and asserts none of the §3 forbidden-token union appears anywhere. Positive-control fixture inserts one banned token and asserts the guard bites.
- **INV-C2 — Pinned-constant guard.** The two module constants are literal integer / decimal numbers in the source (`40`, `0.05` or whatever MCP-K-002 pins) — not read from `process.env`, not derived from another module. Enforced by a source-scan reading `familyK.ts` and asserting the constant declarations match a fixed regex.
- **INV-C3 — No-audio-object leakage.** A source-scan on the K Edge deriver output payload builder asserts no field named `url`, `signedUrl`, `audioUri`, `audio_uri`, `storageKey`, `storage_key`, `objectKey`, `object_key`, `bucket`, `mp3`, `wav`, `pcm`, `audioBytes`, `playbackUrl`, `waveformImageUrl` appears. VOICE-ADR-002 §12 enforcement checklist item ("Family K payload schema contains no URL / audio field") is the anchoring line. **Scope:** INV-C3 applies to **output payload field names** in the K response envelope only, NOT to **internal variable names** in the Edge deriver that reference shipped VOICE-003/004 artifact fields (e.g. reading `VoiceWaveformArtifact.amplitudeBuckets` internally is legal; emitting a field named `bucket` in the outbound response is not). The scan MUST include a WHITELISTED_COMPOUNDS-style carve-out mirroring `voice004ForbiddenInferenceGuard.ts:166-173` for identifiers referencing shipped artifact fields.
- **INV-C4 — Disposition/source parity.** A parity test asserts every K entry's `source ∈ {'auto_metadata', 'lifecycle'}` and `defaultSurface ∈ {'composer', 'inspect', 'hidden'}` and `disposition ∈ {'composer_only', 'inspect_only', 'hidden_sensitive'}`.
- **INV-C5 — HALT-14 guard.** A source-scan asserts `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` in `booleanObservationRequestBuilder.ts` does NOT contain a `speech_waveform_artifact` key. Adding it is a defect.
- **INV-C6 — Cross-family rawKey collision.** For X in A..J, `intersection(FAMILY_X_RAW_KEYS, FAMILY_K_RAW_KEYS) === Ø`. Mirrors the HALT-9 guard in `familyIKeysParity.test.ts:202`.
- **INV-C7 — voice003 identifier footgun.** `voice003ForbiddenInferenceGuard` bans `heavilyEdited` / `heavily_edited` inside `src/features/voice/**`. K's rawKey `transcript_heavily_edited_after_dictation` is **not shipped** (the split ruling in §0.1 replaces it with `transcript_was_edited` + `transcript_edit_distance_high`); however, any impl-side helper reading K's edit-distance signal from INSIDE `src/features/voice/**` MUST NOT use a `heavilyEdited` identifier. This is a hazard warning for the MCP-K-002 implementer.

### 8.4 INV-K-UNKNOWN (three-valued observation output — LOAD-BEARING)

The absence of a source-of-truth field (missing `SpeechCapabilitySnapshot`, missing sibling artifact when the composer path would have produced one) yields `'unknown'` — never `false`. Rationale: collapsing `unknown → false` silently misclassifies device / accessibility gaps as user-choice, a real signal loss.

**Schema-support open question (P0):** the shipped `mcpBooleanObservationSchemaMirror.ts` / `mcpBooleanObservationSchema.ts` today models `observations` as `Record<string, boolean>`. Adding a first-class `'unknown'` value requires either (a) a schema change during MCP-K-002 (widening `observations` to `Record<string, boolean | 'unknown'>` and updating `validateMcpBooleanObservationResponse` + all A-J consumers to handle the wider shape), or (b) K uses a separate ledger row shape from A-J with its own ternary contract.

**Recommendation:** (a) is architecturally cleaner (A-J can adopt `unknown` gracefully as they gain observations whose predicates cannot be evaluated), but it is a shared-contract change that touches every family — high blast radius. (b) confines the change to K but introduces contract drift. **Operator ruling required (§12.2).** If neither (a) nor (b) is acceptable, the three capability-snapshot-dependent observations (`text_only_fallback_used`, `recognizer_unavailable`, `waveform_metering_unavailable`) MUST be deferred alongside the capability-snapshot decision (§12.1).

### 8.5 Version parity

K's classifier-set version is `'family-k-v1' as const`. K MUST bump this version whenever `SpeechTranscriptArtifact.producedByModuleVersion` or `VoiceWaveformArtifact.producedByModuleVersion` (or their capability-snapshot analogs) ratchets in a way that changes any field K reads. A version-compatibility comment header in `familyK.ts` names the exact artifact-schema versions K's v1 consumes; a follow-up drift test may pin it.

---

## §9 — Test plan MCP-K-002 will build

### 9.1 Per-observation predicate tests

Ten scenarios, one per rawKey, each with a synthetic `SpeechTranscriptArtifact` and / or `VoiceWaveformArtifact` and / or `SpeechCapabilitySnapshot` fixture asserting the true / false / (where applicable) `unknown` output.

| # | Scenario                                                                                | Artifact state                                                                                                                                                        | Expected K output                                                                                                                                                      | Invariant asserted        |
|---|-----------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------|
| 1 | Typed-only argument (no voice session)                                                  | No `SpeechTranscriptArtifact`; no `VoiceWaveformArtifact`; `SpeechCapabilitySnapshot.voiceOfferable === true` for the composer session.                              | `speech_input_used=false`; `text_only_fallback_used=false`; `recognizer_unavailable=false`; every other K key `false`.                                                | INV-A2, INV-B1            |
| 2 | Clean voice draft, no edit                                                              | `SpeechTranscriptArtifact(terminalState='final', wasEdited=false, editDistance=0, hadFinalEvent=true)`; `VoiceWaveformArtifact(terminalState='finalized', peakLevel=0.4, sampleCount>0, audioSource='metering_only')`. | `speech_input_used=true`; nine other keys `false`.                                                                                                                     | INV-A1, INV-A2            |
| 3 | Voice attempted, mid-session interruption; user typed the rest                         | `SpeechTranscriptArtifact(terminalState='interrupted', hadFinalEvent=false, rawTranscript='')`; `VoiceWaveformArtifact(terminalState='aborted')`.                    | `speech_input_used=true`; `speech_session_interrupted=true`; `speech_capture_artifact_incomplete=true`; other seven `false`.                                            | INV-A3 (lifecycle source) |
| 4 | Recognizer unavailable; no artifact ever produced                                       | `SpeechCapabilitySnapshot(voiceOfferable=false)`; no transcript / waveform artifact.                                                                                  | `recognizer_unavailable=true`; `text_only_fallback_used=true`; other eight `false`. If §12.1 unresolved: both keys return `'unknown'`.                                 | INV-B1 (ternary)          |
| 5 | Author edits transcript heavily                                                         | `SpeechTranscriptArtifact(terminalState='final', wasEdited=true, editDistance=120, hadFinalEvent=true, rawTranscript='<some text>')` and posted body differs by 120. | `speech_input_used=true`; `transcript_was_edited=true`; `transcript_edit_distance_high=true` (assuming `K_TRANSCRIPT_EDIT_DISTANCE_HIGH=40`); other seven `false`.     | INV-C1 (guard bite)       |
| 6 | Low mic capture signal                                                                  | `SpeechTranscriptArtifact(terminalState='final', wasEdited=false, hadFinalEvent=true)`; `VoiceWaveformArtifact(terminalState='finalized', peakLevel=0.03, meanLevel=0.02, sampleCount>0)`. | `speech_input_used=true`; `speech_capture_signal_below_threshold=true`; other eight `false`.                                                                          | INV-C1                    |
| 7 | Waveform metering unavailable mid-session                                               | `SpeechTranscriptArtifact(terminalState='final')`; `VoiceWaveformArtifact(terminalState='error', lastErrorCode='metering_lost')`.                                     | `waveform_metering_unavailable=true`; `speech_capture_artifact_incomplete=true`; other eight `false`.                                                                  | INV-A3                    |
| 8 | Timeout / no speech                                                                     | `SpeechTranscriptArtifact(terminalState='timeout_no_speech', hadFinalEvent=false)`.                                                                                    | `speech_input_used=true`; `speech_timeout_or_no_speech=true`; other eight `false`.                                                                                     | INV-A1                    |
| 9 | Asymmetric persistence — transcript present, waveform missing                           | `SpeechTranscriptArtifact(terminalState='final', hadFinalEvent=true)`; NO `VoiceWaveformArtifact`.                                                                    | `speech_input_used=true`; `speech_capture_artifact_incomplete=true`; `waveform_metering_unavailable=true` (or `unknown` per §12.1); other seven `false`.               | (critic gap fill)         |
| 10 | Capability-snapshot missing for `recognizer_unavailable` evaluation                     | No `SpeechTranscriptArtifact`; no `SpeechCapabilitySnapshot`; no `VoiceWaveformArtifact`.                                                                              | `recognizer_unavailable = 'unknown'`; `text_only_fallback_used = 'unknown'`; every other key `false`. NEVER `false` for the two capability-snapshot-dependent keys.    | INV-K-UNKNOWN             |

### 9.2 Doctrine source-scan (INV-C1)

- Fires build failure if any of the §3 forbidden-token union appears in `familyK.ts` or in the K plain-language mapping entries of `gameCopy.ts`.
- Positive-control fixture inserts a banned token (`stress`, `anger`, `formant`, `voiceprint`, `liar`) and asserts the guard bites.

### 9.3 Cap-compliance test

- Asserts `FAMILY_K_DEFINITIONS.length === 10`.
- Asserts `FAMILY_K_DEFINITIONS.length <= MAX_FLAGS_PER_RESPONSE`.

### 9.4 Cross-family collision (INV-C6 / HALT-9)

- For X in A..J, `intersection(FAMILY_X_RAW_KEYS, FAMILY_K_RAW_KEYS) === Ø`.

### 9.5 Registry-order + coordination

- `MachineObservationFamily` union contains `'speech_waveform_artifact'` as the 11th value.
- `ALL_MACHINE_OBSERVATION_FAMILIES.length === 11` and the 11th entry is `'speech_waveform_artifact'`.
- Edge `FAMILY_REGISTRY.length === 11` and the 11th entry is `{ family: 'speech_waveform_artifact', productionEnabled: false, adminValidationEnabled: true }`.
- `ALL_DEFINITIONS` in `machineObservationDefinitions.ts` contains at least 10 K entries.
- `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` does NOT contain a `speech_waveform_artifact` key (INV-C5).

### 9.6 Post-store contract test

- The K Edge deriver refuses to run unless `argument_id` refers to an already-inserted row.
- `submit-argument/index.ts` byte-equal proof for the acceptance path (pre-insert); only the fan-out dispatcher receives an additional K hook.
- A K classifier failure / timeout / `mcp_validation_failed` does NOT change the submit 201 response.

### 9.7 Payload-schema audio-object absence (INV-C3)

- Source-scan on the K Edge deriver output payload builder asserts no `url` / `signedUrl` / `audioUri` / `storageKey` / `objectKey` / `bucket` / `mp3` / `wav` / `pcm` / `audioBytes` / `playbackUrl` / `waveformImageUrl` field.

### 9.8 No parent-context in K payload (INV-B3)

- Source-scan asserts the K payload builder rejects `parentText`, `parentNodeId`, `threadContextExcerpt`.

### 9.9 Read-side RLS

- Authed non-author non-moderator user attempting to SELECT a K observation row for an argument they did not author receives 0 rows.
- Author + moderator + admin roles receive the row.

---

## §10 — Non-goals (this card only)

- No implementation (MCP-K-002 handles).
- No Deno Deploy — K is source-uniform non-`ai_classifier` and never calls the mcp-server.
- No `mcp-server/lib/familyK*.ts` files.
- No `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry.
- No `FAMILY_K_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant.
- No production flip — K enters `productionEnabled: false`.
- No forbidden inference of any kind (§3).
- No verdict, biometric, accusation, credibility, honesty, intent, truth-value, or engagement/factual-standing credit.
- No consumption of raw audio, local audio URI, storage key, signed URL, playable file, waveform image with user text — even though VOICE-ADR-002 now permits scoped audio persistence (VOICE-ADR-002 §0 explicit carry-forward).
- No shipping of `low_transcript_confidence` (DEFERRED, §2.2).
- No new copy file outside `SCAN_SET_TIER_A` (§6).

---

## §11 — Boundary (Claude does NOT do in this card)

**This card is design-only.** No Claude action in the following list is permitted by this card. MCP-K-002 handles impl and any operator-gated deploy under separate arming.

- NO Anthropic call by Claude.
- NO xAI call by Claude.
- NO X API call by Claude.
- NO Supabase write by Claude.
- NO service-role usage by Claude.
- NO migration write or apply by Claude.
- NO Edge Function edit or deploy by Claude.
- NO feature-flag flip by Claude.
- NO Deno Deploy trigger by Claude.
- NO `.env*` edit by Claude.
- NO commit or push by Claude on this document (the orchestrator commits after review).
- NO SendUserFile / no code beyond the design document itself.

MCP-K-002, when it runs, is a mutation card and follows the pipeline-governance-contract's stage gates. If §12.3 rules that K's future increment adds an `ai_classifier` key, that successor card is deploy-bearing GATE-C on Deno Deploy (per ADR-001:157) and requires the shipped `mcp-server-deno-deploy` runbook.

---

## §12 — Open questions for the operator

Three load-bearing rulings are required before MCP-K-002 is scoped. Each is a material scope call, not a minor detail. The design cannot commit past these without an operator answer.

### 12.1 Ship the `SpeechCapabilitySnapshot` / `WaveformCapabilitySnapshot` companion rows in VOICE-009 (or defer three K observations)?

**Context.** Three K observations depend on knowing that the composer session's recognizer / metering was unavailable at compose time:

- `text_only_fallback_used`
- `recognizer_unavailable`
- `waveform_metering_unavailable`

VOICE-003 INV-A3 / VOICE-004 INV-A4 explicitly say the `'unavailable'` terminal yields NULL — no artifact is produced. So the absence of a `SpeechTranscriptArtifact` does not distinguish "user typed by choice" from "user could not use voice." Without a persisted `SpeechCapabilitySnapshot` (an INSERT-only row per composer session recording `voiceOfferable`, `waveformOfferable`, `meteringSupported`, `probeErrorCode`), the three observations return only `false` (misclassification) or `unknown` (accurate but always).

**Options.**

- **(A) Ship the capability-snapshot rows.** VOICE-009 (or a companion VOICE-DB card) adds the two INSERT-only tables. K's three observations return true / false as designed. Adds two tables, two RLS policies, two migrations to VOICE-009's scope.
- **(B) Defer the three observations from K v1.** K ships with 7 rawKeys instead of 10 (or 7 + the DEFERRED slot). The three deferred keys are documented as "K v2 pending VOICE-DB companion rows." No new tables required.

**Recommendation.** (A). The capability snapshot is a real accessibility signal ("did the platform ever offer voice?") worth preserving. But this is an operator scoping call because it touches VOICE-009's blast radius.

### 12.2 Widen the shared observation schema to support `'unknown'` (a-vs-b in §8.4)?

**Context.** INV-K-UNKNOWN is load-bearing (converting `unknown → false` silently loses accessibility signals). The shipped MCP observation schema is `Record<string, boolean>`.

**Options.**

- **(A) Widen to `Record<string, boolean | 'unknown'>` for all families.** Shared-contract change; every A-J consumer must handle the wider shape. High blast radius, but architecturally correct — every family gains graceful degradation for un-evaluable predicates.
- **(B) K uses its own ledger row shape with a ternary contract.** Confines the change to K, at the cost of contract drift.
- **(C) Defer all three capability-snapshot-dependent observations (§12.1 option B) so K never needs `unknown`.** Removes the need for the schema change entirely.

**Recommendation.** (A) if the operator can accept the shared-contract touch; else (C) coupled with §12.1(B).

### 12.3 Does K stay source-uniform non-`ai_classifier` forever?

**Context.** The source-uniform ruling in §1.1 collapses MCP-K-002's blast radius considerably (no Deno Deploy, no six-file sibling set, no GATE-C). If a v2 K increment ever adds an `ai_classifier` observation, the ruling breaks and the successor card becomes deploy-bearing GATE-C.

**Ruling requested.** Operator sign-off that K is intended to remain source-uniform non-`ai_classifier` in v1, and that any future `ai_classifier` addition requires a new scoping card (mirroring `MCP-J-001-FAMILY-J-SCOPING-EXTENSION`) rather than being folded quietly into a K increment. This is a hedge, not a hard block, but the design closes the door explicitly.

---

## §13 — Acceptance mapping

| Card AC bullet                                                                                                     | Satisfied by                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Define Family K (letter, name, canonical description).                                                              | §1.1 (letter K, name `speech_waveform_artifact`, source-uniform non-`ai_classifier`), §1.2 (union edit), §1.3 (registry entry), §1.4 (definition wiring). |
| Define its ~10 allowed boolean observations (submission-provenance-only, never person-attribution).                  | §2 (10 observations table); §0.1 (renames + splits + one deferral); §2.2 (deferred slot).                             |
| Registry entry landing plan (which file, exact fields).                                                             | §1 (all subsections); §7 (file layout MCP-K-002 will create); §1.4 (upstream index wiring).                            |
| Boundary conditions: post-store fire-and-forget, no gating, authoritative=false, no consumption of raw audio / audio URI / playable file. | §4 (post-store contract); §0.2 (verbatim carry-forward); §3 (forbidden observations); INV-C3 (source-scan).            |
| Plain-language mappings for any user-facing surfacing (no raw codes shown to users).                                | §6 (plain-language mapping surface); §2 (per-key plain-language TRUE / FALSE columns).                                 |
| Test set that the impl card will build (per-observation predicate tests, forbidden-inference source-scan, cap-compliance). | §9 (test plan MCP-K-002 will build); §8 (invariant taxonomy).                                                          |
| Batching path noted if K ever grows past 20.                                                                         | §5 (shipped `#545` batching, `BATCH_SIZE = 16`, precedent D 22→16+6 and G 21→16+5, `mergeBatchResponses` under one `run_id`). |
