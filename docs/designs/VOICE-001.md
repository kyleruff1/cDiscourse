# VOICE-001 — Speech + waveform architecture design (VOICE-ADR-002 reconciliation)

**Status:** Design draft
**Epic:** 15 — Speech-first voice input + waveform (`epic:voice`)
**Release:** v1 (ASP program / post-Stage 6.4 UI-UX track)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/659
**Governing contract:** **VOICE-ADR-002** — `docs/adr/VOICE-ADR-002-scoped-audio-persistence-one-time-playback.md` (ratified 2026-07-25 on operator merge of #863 / PR #943), which supersedes VOICE-ADR-001 in part and carries the rest forward verbatim in its §0.
**Secondary doctrine:** VOICE-ADR-001 — `docs/adr/VOICE-ADR-001-speech-first-no-audio-privacy.md` (Accepted; superseded in part). Read only through ADR-002 §0.
**Slate:** VOICE-SLATE-2026-06-13 — `docs/roadmap-expansions/2026-06-13-speech-first-voice-waveform-roadmap.md`, index `docs/designs/VOICE-SLATE-2026-06-13-INDEX.md`
**Supersedes:** `docs/designs/VOICE-001-SPEECH-WAVEFORM-ARCHITECTURE.md` (merged PR #673, authored against `main @ 79b9508`) and the DAG corrections in `docs/designs/VOICE-PATCH-001-DAG-AND-MEDIATOR-BRIDGE.md` — see §0.
**Baseline:** `feat/voice-001-design`, branched from `main @ 6193931c` (UX-MOTION-TOKENS #945). Every line reference below was re-verified against that commit.

> DESIGN ONLY. This card writes exactly one markdown file. No production code, no installs, no config-plugin edit, no migration, no Edge Function, no mcp-server change, no deploy, no flag flip.

---

## §0 Reality audit — what changed since the card was written

Issue 659 was filed 2026-06-13 and its ADR-001-era architecture doc **already shipped** (PR #673). Two things happened afterwards that make the shipped doc materially stale, which is why this card re-runs as a reconciliation rather than a fresh design:

**(a) The governing contract changed.** VOICE-ADR-002 was ratified 2026-07-25. It supersedes ADR-001's *No-audio v1 privacy posture* and the two data-classification rows *Raw audio (PCM / recording)* and *Local audio URI*. Audio is now a **scoped, consent-gated, retention-bounded stored artifact** (D1) on **AWS S3 from day one** (D2), playable as **one receipt-gated session** (D3), in **private 1:1 rooms only at launch** (D4), transcribed by **Deepgram nova-3** (D5), under **tighter retention numbers** (D6), collecting **rendering-only timing metadata** (D7). The shipped VOICE-001 doc asserts the opposite posture in §2, §4, §6, §10, §11, §15, §17 and §20.

**(b) The composer surface changed.** The ASP program (ROOM-003 #829, PROOF-002, MARK-002, UX-COMPOSER-005, SETTLE-001, A11Y-PR0) reshaped argument entry. The shipped doc's central claim — *"`ArgumentComposer.tsx` is the sole shared composer … a universal voice adapter wrapping that body TextInput covers every ordinary drafting surface in ONE insertion point"* — **is no longer true at the rendering layer.** There are now four distinct body-bearing `TextInput` elements on the drafting path (§2.1).

**Handling of the prior file.** `docs/designs/VOICE-001-SPEECH-WAVEFORM-ARCHITECTURE.md` is left **byte-unchanged** (append-only doc discipline, the same treatment ADR-002 gave ADR-001). Where this doc and that doc disagree, **this doc governs**; where this doc is silent, that doc's engineering detail still stands (the state machine event table, the dB normalization math, the SVG path export, the Family K key list). Operator follow-up: add a one-line status header to the prior file reading `Superseded by docs/designs/VOICE-001.md (VOICE-ADR-002 reconciliation)` — a one-line edit outside this card's single-file scope.

**No doctrine conflict found.** The card is buildable as reconciled. Nothing below asks for a v1-scope-banned feature (no voting, no search, no push, no OAuth, no public API, no client AI call).

---

## §1 Goal

Make speech a first-class way to draft an argument in CDiscourse, and specify — precisely enough that an implementer never has to guess — **where** voice attaches, **what** it produces, **what it may never produce**, and **in what order** the downstream cards land.

The constraints that shape every decision below are doctrinal, not stylistic:

- **The deterministic Constitution engine is the SOLE acceptance gate.** (ADR-002 §0, carried verbatim from ADR-001 § Acceptance-gate invariant.) Speech recognition, waveform rendering, transcript metadata, voice artifacts, and MCP Family K are composition aids or post-storage observations. No path may block, reject, route, delay, or penalize an ordinary user post. Verified in code: `supabase/functions/submit-argument/index.ts` evaluate at :297 → `if (!evalResult.allowPost)` at :329 → service-role insert at :376-378.
- **A text-only fallback exists for every argument entry window.** (ADR-002 §0, carried verbatim.) Permission denial, recognizer unavailable, speech error mid-session, waveform unavailable, and snapshot unavailable each degrade to a working text box and never block text posting.
- **Audio is a governed artifact, not a forbidden one — and not a free one.** (ADR-002 §1, §2, §3, §6.) Consent-gated, one-listen by default, retention-bounded, hard-deleted from storage with a HEAD verification, tombstoned in the DB.
- **Voice launches in private 1:1 rooms only.** (ADR-002 D4, §5.) Circle rooms and public rooms are excluded at launch. This is a **UI gating requirement**, not just a backend one — see §4.3.
- **No emotion, tone, voice-stress, anger, speaker-confidence, honesty, sincerity, manipulation-by-voice, biometric, speaker-identity, credibility, intent, truth, verdict, or person-accusation inference anywhere** — UI, model, artifact, persistence, or MCP. (ADR-002 §0, carried verbatim from ADR-001 § Forbidden inference list, including the `recognitionConfidence` wording patch.)
- **The waveform is mic-active feedback, not evidence** of what was said or how it was said.
- **No service-role in the client; no direct client insert into `public.arguments`.** (`supabase-edge-contract`.) Every voice write goes through an Edge Function.

---

## §2 Entry-surface inventory — verified against `main @ 6193931c`

### 2.1 The seam is now TWO layers, not one

The shipped doc's "one seam" claim collapses two different things: the **draft-state write path** and the **rendering host**. At current main they have diverged.

**The state seam is still singular.** Every in-room drafting surface shares ONE session draft via `useArgumentComposer(debateId, selectedParentId)` (`src/features/arguments/useArgumentComposer.ts:24`), which reads `state.snapshot.activeDraft` (:33, :62-63) and writes through a single `updateField` callback (:17, :69). Both in-room composers call the same hook against the same `debate.id`, so a body typed in one is the body seen by the other.

**The rendering seam is now plural.** Four body-bearing `TextInput` elements exist on the drafting path:

| # | Host | Element | testID | Body write callsite | Draft owner |
|---|---|---|---|---|---|
| 1 | `src/features/arguments/ArgumentComposer.tsx` | body input :424, inside the body section :417-435 | `composer-body-input` (:432) | `onChangeText={handleBodyChange}` (:426) → `handleBodyChange = (body) => updateField({ body })` (:339) | `useArgumentComposer` |
| 2 | `src/features/arguments/composer/ArgumentEntryComposer.tsx` | bar input :316-327 | `argument-entry-composer-input` (:326) | inline `onChangeText={(body) => updateField({ body })}` (:318) | `useArgumentComposer` (:140) — **same draft** |
| 3 | `src/features/arguments/startArgument/StartArgumentPage.tsx` | declaration input :348-362 | `start-argument-declaration` (:361) | local `setDeclaration(v)` (:350-353) | file-local `useState` |
| 4 | `src/features/arguments/startArgument/StartArgumentSheet.tsx` | declaration input :329-342 | `start-sheet-declaration` (:342) | file-local state | file-local `useState` |

Hosts 1 and 2 are the **reply** path (both post via `buildSubmitArgumentPayload` → `submit-argument`). Hosts 3 and 4 are the **root-claim creation** path (`createDebate` / `create-argument-room`), which the shipped doc covered only for host 3 and which VOICE-PATCH-001 §6.6 correctly insisted must not be silently skipped. Host 4 (`StartArgumentSheet`) is **new since the shipped doc** and is not mentioned in it at all.

### 2.2 Surfaces that re-type hosts 1 and 2 (no input of their own)

Re-verified; every one of these routes into host 1 or host 2 and therefore needs **zero** additional voice wiring:

- **`ArgumentComposerDock`** — `src/features/arguments/ArgumentComposerDock.tsx:160` (export), hosts `<OneBox>` at :590; mounted at `App.tsx:1580`. Owns the submit lifecycle and the RULE-004 pre-send review sheet (`onBeforeSubmit` / `postSignal`, the additive-optional prop precedent at `ArgumentComposer.tsx:71-80`, :237-245, :294-307).
- **`OneBox`** — `src/features/arguments/oneBox/OneBox.tsx`; mounts exactly one `<ArgumentComposer>` at :400 and the Act popout at :419. The box-type header is the **mode / type-switch seam**.
- **`ActPopout`** — `src/features/arguments/oneBox/ActPopout.tsx:269`; also rendered from the room at `src/features/arguments/room/ArgumentRoom.tsx:3564`. A launcher that re-targets the hosted composer; no separate input.
- **Referee Card next-move** — `RefereeCardView` `onMove` → `handleOpenIssueMove`, now at `src/features/arguments/room/ArgumentRoom.tsx:2674`, wired at :3819. *(Drift: the shipped doc cites `ArgumentGameSurface.handleOpenIssueMove:2264`; the surface was extracted into `room/ArgumentRoom.tsx` by the ASP-EXTRACT work.)*
- **`CollapsedComposerStrip`** — moved to `src/features/arguments/composer/CollapsedComposerStrip.tsx:86`; mounted at `room/ArgumentRoom.tsx:3400`. *(Drift: the shipped doc cites the old path.)*
- **All move types** seeded via `src/features/arguments/quickActionPresets.ts` (Reply / Ask source / Ask quote / Add evidence / Narrow / Branch / Concede / Confirm / Synthesize / Clarify) — these apply an `initialPatch` to the same composer.
- **Demo corridor** — `src/features/demoCorridor/DemoComposerPanel.tsx:19` imports and :62 mounts the real `OneBox`, so it inherits whatever the composer gets.

### 2.3 Non-drafting form surfaces — explicitly out of scope

Still present, still forms rather than argument entry, still out of the voice slate:

- `src/features/requestReview/RequestReviewComposer.tsx` (REF-005 review request; its own `TextInput` at :233).
- `src/features/arguments/DeletionRequestSheet.tsx` (`request-argument-deletion`).

### 2.4 Dormant structured-form bodies — still dormant

Re-verified: all three exist and have **zero non-test mounts** at current main.

- `src/features/evidence/RespondToEvidenceForm.tsx`
- `src/features/arguments/oneBox/schemas/RespondToConcessionSchema.tsx`
- `src/features/arguments/oneBox/schemas/OfferConcessionSchema.tsx`

They inherit voice only if and when they are wired, through whatever adapter wraps their free-text field. Not in scope for any VOICE card.

### 2.5 The mic teaser that exists today

The reserved voice slot is live and **ungated by room type** — the exact §13.2 risk ADR-002 records:

- Copy: `ARGUMENT_ENTRY_COMPOSER_COPY.micLabel = 'Voice — coming soon'` and `.micA11yLabel = 'Voice reply, coming soon'` at `src/features/arguments/composer/argumentEntryComposerModel.ts:50-51`.
- Render: a `disabled` `Pressable` at `src/features/arguments/composer/ArgumentEntryComposer.tsx:369-379`, testID `argument-entry-composer-mic` (:376), with **no room-type condition** around it.
- Pinned by `__tests__/argumentEntryComposerUi.test.tsx:176-180` (asserts `accessibilityState.disabled === true` and the label renders) and by `__tests__/roomThreeSourceScan.test.ts:37-40` (asserts the bar imports no audio API).
- **A11y observation for the implementer:** unlike its siblings in the same controls row (Source :336, More :386, Send), the mic `Pressable` carries **no `hitSlop`**. When VOICE-UI-001 activates the slot it must add `hitSlop={TOUCH_TARGET.hitSlopAll}` (`src/lib/designTokens.ts:552-554`, `minSizePx: 44`) or size the visual to 44×44.

### 2.6 Inventory drift ledger (shipped doc → current reality)

| Shipped-doc claim | Current reality | Impact |
|---|---|---|
| `ArgumentComposer.tsx` is the sole shared composer; one adapter covers everything | Two in-room body inputs (hosts 1 + 2) sharing one draft; two root-claim inputs (hosts 3 + 4) | **Design-changing** — §4 re-specifies the seam |
| `ArgumentComposerDock.tsx:153`, mounted at `App.tsx:1045` | Export at :160; mounted at `App.tsx:1580` | Reference-only |
| `ArgumentGameSurface.handleOpenIssueMove:2264` | `room/ArgumentRoom.tsx:2674`, wired :3819 | Reference-only |
| `CollapsedComposerStrip.tsx` (arguments root) | `arguments/composer/CollapsedComposerStrip.tsx:86` | Reference-only |
| StartArgumentPage has two inputs (resolution :339 + body :392) | One declaration input at :348-362 | Reference-only |
| (no mention) | `StartArgumentSheet.tsx` exists with its own declaration input | **Scope-adding** — a fourth host |
| `app.json` has `plugins: []` | `plugins` key is **absent entirely** | VOICE-002 adds the key, not an entry |
| No mic teaser existed | Teaser is live and ungated by room type | **Design-changing** — §4.3 gate |
| `voice_entries` / `one_time_playback` flags did not exist | Both registered and dark | **Design-changing** — §4.4 coupling |

---

## §3 Compatibility matrix

> **Provenance rule for this whole section:** every row is an **upstream fact carried from the card and from the slate roadmap §5** ("upstream docs, verified 2026-06"). This card made **no new upstream verification and makes no platform claim beyond those facts.** Rows marked *operator ruling* come from ADR-002's D-table, not from an upstream doc. VOICE-002 re-verifies the library rows against the then-current upstream docs before installing anything.

### 3.1 Repo stack — verified in this card against `main @ 6193931c`

| Fact | Value | How verified |
|---|---|---|
| Expo SDK | `~54.0.33` | `package.json` |
| React / React Native | `19.1.0` / `0.81.5` | `package.json` |
| New architecture | `newArchEnabled: true` | `app.json` |
| Build model | **managed / CNG** — no `ios/`, `android/`, `eas.json`, `app.config.*`, `babel.config.*`, `metro.config.*` | directory probe |
| `app.json` plugins | key **absent** (not an empty array) | `app.json` |
| `ios.infoPlist` / `android.permissions` | both **absent** | `app.json` |
| Audio / speech / drawing deps | **all ABSENT** — `expo-speech-recognition`, `expo-audio`, `expo-av`, `expo-speech`, `@shopify/react-native-skia`, `react-native-view-shot`, `react-native-svg`, `@deepgram/sdk`, `@aws-sdk/client-s3`. Zero dependency keys match `/audio|speech|voice|skia|view-shot|deepgram|aws/i`. | `node -e` over `package.json` |

**Consequence (stated as the card requires):** every audio and speech dependency is **net-new**, config plugins are required, and a **development build is required — the voice stack cannot run in Expo Go.** This is the single largest implementation cost and it is isolated into VOICE-002.

### 3.2 Speech recognition platform matrix — upstream facts, carried

| Platform | STT | Interim results | Notes |
|---|---|---|---|
| Android 12 and earlier | basic only | interim only | No continuous, no on-device, no recording |
| Android 13+ | full | yes | — |
| iOS 17+ | full | yes | — |
| iOS below 17 | limited | verify at runtime via the capability probe | Degrade via `voiceOfferable` |
| Web — Chrome | yes | yes | — |
| Web — Safari 16+ | yes | yes | — |
| Web — Safari below 16 | unavailable | — | No Speak affordance; text only |
| Web — Firefox | **unavailable** | — | No Speak affordance; text only |

### 3.3 Library matrix — upstream facts, carried

| Library | Role | Stack fit (carried) | Native / build impact (carried) | Verdict |
|---|---|---|---|---|
| `expo-speech-recognition` (jamsch) | primary on-device / platform STT for the **composer draft aid** | wraps iOS `SFSpeechRecognizer` / Android `SpeechRecognizer` / Web `SpeechRecognition` | config plugin (`microphonePermission`, `speechRecognitionPermission`, `androidSpeechServicePackages`) **plus a dev build** | adopt |
| `expo-audio` | waveform data source (`useAudioStream` real-time PCM, or `useAudioRecorderState` metering) **and** the recorder for the ADR-002 audio object | first-party Expo module | config plugin (`microphonePermission`, `recordAudioAndroid`); `enableBackgroundRecording` stays **false**; dev build | adopt |
| `@shopify/react-native-skia` | live animated waveform | requires RN ≥ 0.79 + React ≥ 19 → this stack **is compatible** | dev build; iOS pod install; Android NDK + proguard keep rule; Jest `testEnvironment` + `setupFilesAfterEnv` + `transformIgnorePatterns`; web bundle ≈ 2.9 MB | adopt as the live renderer; **spike** |
| `react-native-view-shot` | optional waveform PNG export | compatible | `result:'tmpfile'` default; `releaseCapture(uri)`; `collapsable={false}` on Android; capture only after first `onLayout`; `handleGLSurfaceViewOnAndroid` false by default | **spike only**; capturing a Skia canvas is undocumented upstream |
| `react-native-svg` | deterministic static waveform + path export | v15.15.5 (2026-05); Expo-installable | no plugin block needed; already named in the Jest `transformIgnorePatterns` regex | adopt — **the deterministic floor under both spikes** |
| `expo-av` | — | — | — | **do not adopt** (superseded by `expo-audio`) |
| `expo-speech` | TTS | — | — | **do not adopt** (v1 is speech-in, not speech-out) |
| Deepgram **nova-3** | server-side transcript segments with word timestamps (ADR-002 §8) | *operator ruling D5* — confirmed by the VOICE-STT-001 10-clip bake-off | key in **Supabase Edge secrets only**; spend **operator-armed**; never called from the client | adopt server-side |
| AWS S3 | the audio object store (ADR-002 §6) | *operator ruling D2* — S3 day one; Supabase Storage is the config swap | SSE-S3; versioning **OFF**; `Cache-Control: private, no-store`; 30-day lifecycle backstop; bucket-owner-enforced ACLs; **new credential surface**, operator-provisioned | adopt server-side |

**Every spike has a non-spike floor.** If Skia live rendering or view-shot capture fails, `react-native-svg` still draws a deterministic waveform and speech entry still works. No card downstream may make a working snapshot, or a working live renderer, a hard dependency of speech entry.

---

## §4 The insertion seam

### 4.1 What the adapter is

**One component, `VoiceInputAdapter`, mounted at up to four rendering hosts, funnelling text through each host's own existing write path.** The adapter is presentational plus session state; it owns no submit path and no persistence.

The invariant that survives from ADR-001 and is carried by ADR-002 §0 (§ Transcript ownership, verbatim):

- The **interim** transcript is display-only. It lives in the adapter's own chrome and **never enters the submitted body**. A half-recognized phrase can never be submitted.
- The **final** transcript reaches the body **only via the same path as typed input**. For hosts 1 and 2 that is `updateField({ body })`; for hosts 3 and 4 it is the file-local `setDeclaration` setter. The engine, draft persistence, char count, and validation panel behave identically whether text arrived by thumb or by voice.
- The user may edit the text before posting with full keyboard parity.
- `wasEdited` / `editDistance` are **neutral provenance** — never credibility, honesty, or sincerity signals, and no downstream consumer including Family K may read them as such.

Because hosts 1 and 2 share one `activeDraft`, a transcript finalized in the bar is immediately visible in the dock and vice versa — **no cross-host merge logic is needed**, and none may be added. The body-merge policy applies within a single host: if the body is empty the final transcript replaces it; if non-empty it is appended after a single separating space, so keyboarded text is never lost.

### 4.2 Prop contract added to each host

Additive and optional at every host, mirroring the shipped `onBeforeSubmit` / `postSignal` precedent (`ArgumentComposer.tsx:71-80`). **Omitting every prop must leave the host byte-identical to today.**

```ts
// src/features/voice/voiceAdapterTypes.ts (VOICE-007 / VOICE-UI-001)
// All fields optional and additive. Absent => the host renders todays UI.
export interface VoiceHostProps {
  /**
   * Resolved voice availability for THIS host in THIS room. Computed by the
   * shell (App / room) and threaded down. The composer NEVER reads the flag
   * registry itself -- same discipline as onOpenProof / onInsertCallback.
   */
  voiceAvailability?: VoiceAvailability;
  /**
   * Sink for the composition-time artifacts. Fires when a speech session
   * reaches its final state. The host never persists anything itself.
   */
  onVoiceSessionComplete?: (artifacts: VoiceDraftArtifacts) => void;
}
```

`VoiceAvailability` is the single object that answers "may this host show a mic at all, and if so in what state":

```ts
export type VoiceUnofferableReason =
  | 'flag_off'              // voice_entries resolves false
  | 'room_type_excluded'    // ADR-002 D4: circle or public room
  | 'room_not_accepting'    // settled / locked / observer seat
  | 'recognizer_unavailable'// capability probe says no
  | 'consent_required'      // voice_consent_version not accepted yet
  | 'permission_denied';    // OS refused mic

export interface VoiceAvailability {
  /** When false the host renders NO voice slot at all (see 4.3). */
  readonly offerable: boolean;
  /** Present only when offerable === false. Maps to plain language via gameCopy. */
  readonly reason: VoiceUnofferableReason | null;
  /** Capability snapshot, present only when offerable. */
  readonly capability: SpeechCapabilitySnapshot | null;
}
```

Every `VoiceUnofferableReason` value is an **internal code** and must be routed through `toPlainLanguage` (`src/features/arguments/gameCopy.ts:888`) before any of it reaches a user-visible string. Unknown codes are suppressed, never echoed (`toPlainLanguageOrSuppress`, :926).

### 4.3 Room-type gating — ADR-002 D4 and §13.2, the binding pre-flip gate

ADR-002 §13.2 is a **pre-flip gate**: both the Speak affordance and the teaser that precedes it must render **only in private 1:1 rooms** and be **absent** in circle and public rooms. And absent means absent: *"a `disabled` Pressable can still take keyboard focus on RN Web, so a gated-out slot must not be present in the tree at all."*

There is **no existing room-type discriminator that answers this question.** `RoomType` is only `'private' | 'public'` (`src/features/debates/roomContractModel.ts:26`). Circles arrive as a *private room with a non-null `circleId`* (`src/features/debates/types.ts` — `visibility: RoomVisibility` and `circleId?: string | null`). So the D4 gate needs a new three-way classification. It belongs in a pure model:

```ts
// src/features/voice/voiceRoomEligibilityModel.ts (VOICE-UI-001 / VOICE-007)
// Pure TS. No React, no Supabase, no network. Deterministic, frozen output.

export type VoiceRoomClass = 'private_one_to_one' | 'circle' | 'public' | 'unknown';

export function classifyVoiceRoom(input: {
  visibility: 'public' | 'private' | null | undefined;
  circleId: string | null | undefined;
}): VoiceRoomClass {
  if (input.visibility === 'public') return 'public';
  if (input.visibility === 'private') {
    return input.circleId == null ? 'private_one_to_one' : 'circle';
  }
  return 'unknown'; // fail closed -- caller treats unknown as NOT voice-eligible
}

/** ADR-002 D4: voice launches in private 1:1 rooms ONLY. */
export function isVoiceEligibleRoom(roomClass: VoiceRoomClass): boolean {
  return roomClass === 'private_one_to_one';
}
```

`'unknown'` **fails closed** — an unresolved room shows no mic. This mirrors the `deriveMenuKeyBadgeContext` fail-safe (`src/features/arguments/oneBox/menuKeyBadgeModel.ts:57-77`), which returns `'unknown'` and suppresses on a non-finite width.

**Where the gate is applied.** In the shell (`App.tsx` for hosts 1 and 2; the start surfaces for hosts 3 and 4), never inside the composer. `App.tsx` already threads exactly this way for `onOpenProof` (:1613), `scopedMarker` (:1620), and `onInsertCallback` (:1625) — the composer never reads the flag registry. Voice follows that shipped pattern.

**Root-claim hosts (3 and 4)** are a special case: the room does not exist yet, so `classifyVoiceRoom` runs against the **visibility the user has selected in the form** (`start-argument-visibility-public` / `start-argument-visibility-private` at `StartArgumentPage.tsx:385/:393`, and the circle selection on the sheet). If the user flips from private to public with a mic session open, the adapter must terminate the session, keep the already-transcribed text in the declaration field, and remove the slot. That is an edge case the implementer must handle (§7).

**Rendering rule.** `offerable === false` renders `null` — not a `disabled` `Pressable`. The current teaser at `ArgumentEntryComposer.tsx:369-379` violates this and is the thing the seam replaces. The one permitted exception is the ADR-001 § Text-fallback wording *"renders no Speak button (or a disabled one with a plain-language hint)"* — a disabled-with-hint variant is permitted **only** for `recognizer_unavailable` and `permission_denied`, i.e. reasons where a hint helps the user, and **never** for `room_type_excluded` or `flag_off`, where the correct outcome is absence.

### 4.4 Flag coupling — ADR-002 §13.1, the other binding pre-flip gate

Both voice flags are registered and dark:

- `voice_entries` — `AspFeatureFlag` member (`src/lib/featureFlags.ts:47`), env `EXPO_PUBLIC_VOICE_ENTRIES` (`VOICE_ENTRIES_FLAG`, :78), resolver `isVoiceEntriesEnabled` (:120), registry descriptor under `ASP_FEATURE_FLAGS` (:214).
- `one_time_playback` — env `EXPO_PUBLIC_ONE_TIME_PLAYBACK` (`ONE_TIME_PLAYBACK_FLAG`, :80), resolver `isOneTimePlaybackEnabled` (:136), same registry.

Both are default-OFF resolvers, true only on the exact string `'true'`, read via a **static** `process.env.EXPO_PUBLIC_*` dot access (the #776 inlining rule — a dynamic `process.env[...]` lookup is not inlined by babel-preset-expo and silently resolves undefined in the web bundle).

**The rule:** `voice_entries` is **never ON while `one_time_playback` is OFF**, unless an intermediate-state consent copy that does *not* promise one-listen has been authored and consent-versioned first. A flag-registry test enforces it (§9).

### 4.5 What the seam explicitly does NOT do

- It does not touch `handleSubmit` (`ArgumentComposer.tsx:249`), `buildSubmitArgumentPayload`, `useEntryComposerSubmit`, `evaluateArgumentDraft`, or the `submit-argument` wire payload. **The audio never gates a post; it is a linked object, never an acceptance dependency** (ADR-002 §1).
- It does not introduce a second write path into `draft.body`.
- It does not carry a signed URL, storage key, or audio URI in any client-held type (§5.3).
- It does not read or write score, heat, strength band, or evidence standing.

---

## §5 Data and artifact shapes

Staged deliberately: **v1 composition-time artifacts are transcript-first and audio-free**, and the persistence fields arrive with the VOICE-DB / VOICE-BE cards. This is the reconciliation the card asks for — the ADR-001 hard literals `audioPersisted: false` / `audioUri: null` are *replaced* by an explicit lifecycle discriminator so the type never has to lie once ADR-002 persistence lands.

### 5.1 Composition-time (v1, shipped before any persistence card)

```ts
// src/features/voice/voiceArtifactTypes.ts (VOICE-003 transcript, VOICE-004 waveform)

/**
 * Replaces the ADR-001 literal `audioPersisted: false`. v1 composition-time
 * artifacts are 'none'. The VOICE-DB / VOICE-BE cards introduce
 * 'scoped_governed' -- the ADR-002 lifecycle. There is no third value and no
 * ungoverned mode.
 */
export type AudioPersistenceMode = 'none' | 'scoped_governed';

/**
 * SpeechTranscriptArtifact -- provenance of how text arrived in the box.
 * NEVER asserts truth, correctness, sincerity, emotion, intent, or identity.
 */
export interface SpeechTranscriptArtifact {
  readonly transcriptId: string;
  readonly recognizer: 'ios' | 'android' | 'web';
  readonly onDeviceRecognition: boolean;
  readonly language: string;              // e.g. 'en-US'
  readonly rawTranscript: string;         // SESSION-LOCAL. Not persisted in v1.
  readonly submittedBody: string;         // what the user approved, read at submit time
  readonly wasEdited: boolean;            // neutral provenance
  readonly editDistance: number;          // neutral provenance, >= 0
  readonly interimCount: number;          // mic-activity provenance, >= 0
  readonly createdAt: string;             // ISO
  readonly audioPersistence: AudioPersistenceMode;  // 'none' in v1
  readonly audioUri: null;                // literal null while audioPersistence === 'none'
}

/**
 * VoiceWaveformArtifact -- non-authoritative feedback that the mic was active.
 * NOT evidence of what was said, how it was said, or the speakers state.
 * No field encodes emotion, tone, stress, confidence, or identity -- by design.
 */
export interface VoiceWaveformArtifact {
  readonly waveformId: string;
  readonly transcriptId: string;
  readonly durationMs: number;
  readonly sampleWindowCount: number;
  readonly amplitudeBuckets: ReadonlyArray<number>; // <= 256 normalized [0,1] bins
  readonly peakSummary: number;                     // [0,1]
  readonly rmsSummary: number;                      // [0,1]
  readonly renderer: 'skia' | 'svg';
  readonly imageRef: string | null;  // LOCAL/transient handle only. NEVER an audio handle.
  readonly createdAt: string;
  readonly audioPersistence: AudioPersistenceMode;
  readonly audioUri: null;
}

/** What the adapter hands the host after a session. In-memory only. */
export interface VoiceDraftArtifacts {
  readonly transcript: SpeechTranscriptArtifact;
  readonly waveform: VoiceWaveformArtifact | null;
}
```

**The 256-bucket cap is the bounded, non-replayable guarantee.** 256 floats in `[0,1]` is a loudness envelope: no spectral content, no phase, nothing from which words can be recovered. The live model keeps a fixed-size ring buffer so it cannot grow into something resembling a recording; the artifact stores at most `MAX_AMPLITUDE_BUCKETS = 256` downsampled bins plus two scalars.

**`recognitionConfidence` is deliberately absent.** ADR-002 §0 carries the binding wording patch: if recognizer confidence is ever surfaced it must be named `recognitionConfidence` / `recognizerConfidence`, never "speaker confidence", it is non-user-facing unless separately ratified, and **v1 should prefer deferring it entirely**. This design defers it entirely. Adding the field is a later card with its own doctrine review.

### 5.2 The ADR-002 extension (VOICE-DB / VOICE-BE cards)

When persistence lands, the composition-time artifacts gain **one nullable reference** — not a widened audio payload:

```ts
// Added by the VOICE-DB / VOICE-BE cards. Additive; v1 consumers ignore it.

export type VoiceRetentionState =
  | 'pending_upload'
  | 'stored_unplayed'      // 3-day expiry clock running (ADR-002 D6)
  | 'stored_consumed'      // 12-hour post-consume grace
  | 'saved_by_author'      // ADR-002 section 4 -- deletion job cancelled
  | 'moderation_hold'      // ADR-002 section 7 -- 7-day auto-expiring hold
  | 'deletion_scheduled'
  | 'deleted_tombstoned';  // row survives audio-free; storage object HEAD-verified gone

/**
 * The clients handle on a stored recording. Deliberately carries NO url, NO
 * storage key, NO uri, NO bytes. A playback URL is minted per receipt-gated
 * session by an Edge Function and lives only in the player instance -- it is
 * never written into app state, a draft, a log, or an artifact.
 */
export interface VoiceRecordingRef {
  readonly recordingId: string;
  readonly consentVersion: string;      // ADR-002 section 2 -- versioned author consent
  readonly retentionState: VoiceRetentionState;
  readonly expiresAt: string | null;    // ISO; null when saved_by_author
  readonly durationMs: number;          // <= 60000 -- the D6 60-second recording cap
}

/** Rendering / navigation metadata only. The BODY remains authoritative. */
export interface TranscriptSegment {
  readonly index: number;
  readonly startMs: number;
  readonly endMs: number;               // endMs > startMs
  readonly text: string;
}
```

Both `SpeechTranscriptArtifact` and `VoiceWaveformArtifact` then carry `audioPersistence: 'scoped_governed'` and an optional `readonly recording: VoiceRecordingRef | null`. The `audioUri: null` literal stays — **the client never holds an audio URI in either mode.**

**ADR-002 §8 is binding on `TranscriptSegment`:** the body (the user-edited text at post time) is authoritative and immutable like every argument body; segments are labelled "transcript" and are navigation metadata, not the authoritative record; correction is a **segment re-run, never a body mutation**. And ADR-002 §9: a marker snapshots `quoted_text` at creation so a later segment re-run can never rewrite what a rebuttal quoted.

The marker table is already built for this. `supabase/migrations/20260711000001_mark_001_timestamp_markers.sql` ships `span_unit text not null default 'chars' check (span_unit in ('chars'))` with an in-file comment stating that P5 widens the check to add `'ms'` for the voice/waveform lane — *"a one-line follow-up, never a reshape"* — and that `recording_id` is **deliberately absent until P5**. `quoted_text` is `not null` and is described as *"self-sufficient after any body edit, argument soft-delete, or (P5) audio deletion."* **MARK-003 is the card that widens `span_unit` and adds `recording_id`.** No VOICE card may reshape that table.

### 5.3 The hard client-side invariants

These four are the load-bearing shape rules. A reviewer can check them mechanically:

1. **No client-held type carries a URL, signed URL, storage key, or audio URI.** `VoiceRecordingRef` is the whole client surface; a playback URL exists only inside the player instance for the life of one receipt-gated session.
2. **No artifact field encodes emotion, tone, stress, confidence, honesty, sincerity, identity, credibility, or intent.** A source-scan test enforces this over the whole `src/features/voice/` tree.
3. **`amplitudeBuckets.length <= 256`**, in TypeScript and (when the table lands) as a SQL `CHECK`.
4. **`audioPersistence` has exactly two values.** There is no third mode, and no code path may store audio outside the ADR-002 lifecycle.

---

## §6 File changes

**This card:** one new file.

- **new** — `docs/designs/VOICE-001.md` (this document, ~700 lines) — the ADR-002-reconciled architecture.
- **modified** — none.
- **deleted** — none.

**Downstream file map** (what each card touches; nothing here is written by this card):

| Card | Files | Rough size |
|---|---|---|
| VOICE-002 | `package.json` + lockfile, `app.json` (add the `plugins` key, ios/android permission blocks), Jest config for Skia, dev-build config | config only |
| VOICE-003 | `src/features/voice/speechSessionModel.ts`, `voiceArtifactTypes.ts`, `useSpeechSession.ts`, `gameCopy` additions | ~350 lines + tests |
| VOICE-004 | `src/features/voice/waveformModel.ts`, `useWaveformStream.ts` | ~250 lines + tests |
| VOICE-005 | `src/features/voice/LiveWaveform.tsx` (Skia), `StaticWaveform.tsx` (SVG), `buildWaveformSvgPath.ts` | ~300 lines |
| VOICE-006 | `src/features/voice/waveformSnapshot.ts`, spike doc | ~120 lines |
| VOICE-007 | `src/features/voice/VoiceInputAdapter.tsx`, `voiceAdapterTypes.ts`, `voiceRoomEligibilityModel.ts`, `voiceBodyMergeModel.ts` | ~450 lines |
| VOICE-UI-001 / VOICE-008 | `ArgumentComposer.tsx` (+2 optional props), `ArgumentEntryComposer.tsx` (replace the teaser slot), `App.tsx` (thread availability), `StartArgumentPage.tsx`, `StartArgumentSheet.tsx` | ~40 lines per host |
| VOICE-DB-* | `supabase/migrations/<ts>_voice_entries.sql` (recordings, receipts, transcript segments, consent versions) | migration |
| VOICE-BE-* | `supabase/functions/voice-upload-url`, `voice-playback-url`, `voice-recording-lifecycle` + the 4-function S3 provider adapter in `_shared/` | Edge |
| VOICE-STT-001 | Deepgram nova-3 integration inside an Edge Function; bake-off doc | Edge |
| SEC-VOICE-004 | docs only — AWS backup and purge behaviour confirmation | docs |
| MARK-003 | migration widening `span_unit` to `'ms'` + adding `recording_id`; waveform region picker | migration + UI |
| MCP-K-001 / 002 | `docs/designs/MCP-K-001-*.md`; then `mcp-server/` Family K handler, `familyRegistry.ts`, `nodeLabelTypes.ts` | design; then Deno |

---

## §7 Edge cases the implementer must handle

**Composition**

- **Empty transcript / no speech.** Final result is empty — do not write an empty body over keyboarded text. Stay in text.
- **Interim-only session with no final** (the Android 12-and-earlier shape). Promote the last interim to the body only on an explicit user confirm, or keep it display-only. **Never auto-submit an interim.**
- **User types mid-recognition.** The final transcript appends after a single space; keyboarded text is never overwritten.
- **Permission revoked mid-session.** Transition to the denied state, keep the body editable, never lose the draft.
- **Recognizer error mid-stream.** Recoverable state, retry offered, keyboard alive. The raw `event.error` code is never echoed — it maps through `toPlainLanguage`.
- **Offline / network failure.** On-device recognition still works where available; a cloud recognizer failure degrades to text. Submit itself is unchanged and is the engine's concern.
- **Concurrent submit while listening.** Post is gated by body content plus `allowPost`; a still-listening session neither blocks nor is blocked by Post.
- **Both in-room hosts mounted at once.** `room_exchange_v2` is live, so `ArgumentEntryComposer` (`App.tsx:1602`) and `ArgumentComposerDock` (:1580) can both be in the tree. Only ONE speech session may be active at a time across the shared draft; starting a session in one host must terminate any session in the other. A second concurrent session would produce two finals racing into one `activeDraft`.

**Room type and gating**

- **Circle or public room.** No mic slot in the tree at all, and therefore not in the web focus order. Not a disabled button.
- **Room class `'unknown'`.** Fail closed — no mic.
- **Visibility flipped mid-draft on the start surfaces.** Terminate the session, keep the transcribed text, remove the slot. Do not discard user text because the room class changed.
- **Room settled or locked.** `App.tsx` already suppresses the composer when `currentDebate.status === 'locked'` (SETTLE-001, :1634) and gates on `roomAcceptsMoves`; voice inherits that suppression and must not resurrect an entry affordance.
- **Observer seat.** `seatCanPost` (`ArgumentEntryComposer.tsx:119`) already renders the read-only join prompt for observers; no mic in that state.

**Persistence and playback (the ADR-002 cards)**

- **Receipt insert succeeds, URL mint crashes.** Fail-closed by design (ADR-002 D3): the listener loses a listen. Recovery is the `abandoned` play-state plus an admin re-issue path — never a free replay.
- **Two simultaneous mint attempts.** The `UNIQUE(recording_id, listener_id)` receipt makes one win. A race test is required.
- **Dropped playback session.** Resumes on the same receipt inside the 5-minute window.
- **Author replays own recording.** Non-consuming (`consuming=false`); the author never spends a listener's listen.
- **Save after consume.** Re-opens playback for people who already used their listen — and the confirm sheet must say exactly that.
- **Deletion with an in-flight session.** Honest limit: an in-flight session holding a valid short-TTL URL may finish. Copy never promises more than "the app deletes it."
- **Report during the retention window.** Sets `moderation_hold`, pausing the deletion job; the transcript persists regardless; the hold auto-expires after 7 days.
- **Recording exceeds the 60-second cap.** Stop at the cap with a plain-language notice. Never silently truncate without telling the user.

**Doctrine edges**

- *"Can the waveform influence the strength band, the score, or acceptance?"* — **No.** It never reaches the engine, the score model, or the acceptance gate.
- *"Does an edited transcript imply the user was dishonest?"* — **No.** `wasEdited` / `editDistance` are neutral provenance. Family K may not read them as credibility.
- *"Does a longer or louder recording earn more standing?"* — **No.** Duration and amplitude are rendering metadata. They feed no score, no band, no debt, no heat.
- *"Can heat or engagement change who may record?"* — **No.** Eligibility is room class plus seat plus consent. Nothing else.
- *"Does deleting the audio delete the argument?"* — **No.** The body, the transcript segments, the waveform peaks, and the markers are the durable trace. **DB rows tombstone; only storage objects hard-delete** — ADR-002 §6 names this the one deliberate exception to the house soft-delete convention.

---

## §8 Test plan

Per `test-discipline`: tests are part of each card's deliverable, not a follow-up. Paths below are the required suites.

**Pure models**

- `__tests__/speechSessionModel.test.ts` — every event-to-state transition; permission-denied falls through to text; error keeps the keyboard alive; interim never reaches the submitted body; capability derivations (Firefox web is not offerable; Android 12-and-earlier is interim-only).
- `__tests__/waveformModel.test.ts` — dB normalization clamps and returns 0 for non-finite input; bucketing never exceeds 256 bins for any input length; the ring buffer is fixed-size; determinism (same input, same buckets).
- `__tests__/voiceRoomEligibilityModel.test.ts` — the full 3×2 matrix of `visibility` × `circleId` plus null and undefined; `'unknown'` is not eligible; only `private_one_to_one` is eligible.
- `__tests__/voiceBodyMergeModel.test.ts` — empty body replaces; non-empty body appends with exactly one separator; keyboarded text is never lost.

**Gating (the ADR-002 §12 checklist made executable)**

- `__tests__/voiceComposerGatingMatrix.test.tsx` — **the §13.2 test.** By room type (private 1:1, circle, public), assert the mic slot is present ONLY in private 1:1 and is **absent from the tree** — not merely disabled — in circle and public. Assert absence from the web focus order.
- `__tests__/voiceFlagCoupling.test.ts` — **the §13.1 test.** Over `ASP_FEATURE_FLAGS` (`src/lib/featureFlags.ts:214`), assert no resolved state has `voice_entries` enabled while `one_time_playback` is disabled absent the versioned intermediate consent.
- `__tests__/voiceFlagOff.test.tsx` — with `voice_entries` off, assert every touched host renders byte-identically to today (the flag-off proof ADR-002 §12 requires).
- `__tests__/voiceSubmitPathUnchanged.test.ts` — assert `buildSubmitArgumentPayload` output and the `evaluateArgumentDraft` input are byte-unchanged with voice on. **This is the acceptance-gate invariant made mechanical.**

**Doctrine ban-lists**

- `__tests__/voiceDoctrineBanList.test.ts` — source-scan `src/features/voice/**` and every voice copy constant for the full forbidden list (emotion, tone, stress, anger, confidence-as-trait, honesty, sincerity, manipulation, biometric, identity, credibility, intent, truth, winner, loser, verdict, liar, dishonest, bad faith). Include a firing positive control so the guard is provably able to fail.
- `__tests__/voiceCopyPlainLanguage.test.ts` — every `VoiceUnofferableReason` and every session-state code maps through `toPlainLanguage`; no snake_case code reaches a rendered string.
- `__tests__/voiceNoUrlInClientTypes.test.ts` — source-scan the client voice types for `url`, `signedUrl`, `storageKey`, `uri`, `bucket`, `s3`. Only `imageRef` and `audioUri: null` may appear, and `audioUri` must be the literal `null`.

**Accessibility**

- `__tests__/voiceA11y.test.tsx` — the Speak control has `accessibilityRole="button"`, a plain-language label, `accessibilityState` including `busy` while listening, and meets 44×44 via visual size or `hitSlop`; the waveform is hidden from the accessibility tree as decoration; mic-active is announced **once**, not per frame; reduce-motion (via `src/features/preferences/useReduceMotion.ts` — reuse, never re-inline) snaps instead of animating; the waveform is legible in grayscale.
- Cross-device: the voice affordance is checked at 390×844, 1024×1366, 1366×768, 1920×1080. The Speak control is a **touch-first affordance on every platform** — it is not a keyboard badge and must not be routed through `deriveMenuKeyBadgeContext`.

**Server-side (the persistence cards)**

- Bucket client-read probe denied. Receipt-before-URL ordering. Race test: two mints, one receipt. HEAD-verified deletion. Consent-version gate. RLS SELECT-only with zero client INSERT/UPDATE/DELETE policies. Audit rows never contain a URL, a storage key, or transcript text.
- Family K: registry membership, key count within `MAX_FLAGS_PER_RESPONSE = 20` or the shipped batching, and an **adversarial doctrine test** proving no forbidden observation key can appear in any field and that no audio, URL, or file reaches the handler.

**Tests that will need updating (name them in the card that breaks them, do not silently edit)**

- `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts:128` pins `src/features/arguments/ArgumentComposer.tsx` as **zero-diff**. Adding the two optional voice props requires an operator-authorized relaxation with an explanatory `NOTE`, following the shipped precedent for `ArgumentComposerDock.tsx` (A11Y-PR0 #913) and `TimelineSelectedReadoutPanel.tsx` (UX-SELECTED-NODE-001).
- `__tests__/roomThreeSourceScan.test.ts:37-40` asserts `ArgumentEntryComposer.tsx` imports no `expo-av|expo-audio|expo-speech-recognition|expo-speech` and no `MediaRecorder|getUserMedia|navigator.mediaDevices`. The voice UI card must relax this deliberately — and should keep the `MediaRecorder` / `getUserMedia` half of the ban, since the adapter owns capture, not the bar.
- `__tests__/argumentEntryComposerUi.test.tsx:176-180` pins the mic as permanently disabled.
- `__tests__/argumentEntryComposerCopyBanList.test.ts` covers the current `'Voice — coming soon'` copy and must be updated when the copy changes.
- `__tests__/journeyGateCoverageMap.test.ts` (QA-001) asserts that J5 record-voice, J8 save-recording, and the J6 audio half **claim no spine** and carry the `BLOCKED ON #863` marker. Once voice ships those rows flip and the manifest must be updated in the same card.

---

## §9 API and interface contracts

Beyond the types in §4.2 and §5, the contracts another file will call:

```ts
// VOICE-003 -- capability probe. Pure derivation over the recognizer facts.
export interface SpeechCapabilitySnapshot {
  readonly recognitionAvailable: boolean;
  readonly onDeviceRecognition: boolean;
  readonly supportsRecording: boolean;
  readonly platform: 'ios' | 'android' | 'web';
  readonly interimSupported: boolean;   // Android 12- is interim-only
  readonly voiceOfferable: boolean;     // false on Firefox web, Safari < 16, no recognizer
}

// VOICE-003 -- the session states. Every terminal state keeps the keyboard alive.
export type SpeechSessionStatus =
  | 'idle' | 'permission_pending' | 'permission_denied' | 'unavailable'
  | 'listening' | 'recognizing' | 'finalizing' | 'final'
  | 'error_recoverable' | 'text_fallback';

// VOICE-004 -- the bounded amplitude contract.
export const MAX_AMPLITUDE_BUCKETS = 256;
export function normalizeDbToAmplitude(db: number): number;         // [-60,0] -> [0,1]; non-finite -> 0
export function bucketAmplitudes(samples: ReadonlyArray<number>, maxBuckets?: number): number[];
export function buildWaveformSvgPath(amplitudes: ReadonlyArray<number>, w: number, h: number): string;
```

**Edge Function contracts (VOICE-BE cards — shape only, not written here).** Every one is JWT-verified, caller-scoped, and returns a plain-language error body. None returns a storage key. None logs an `Authorization` header, a signed URL, or transcript text.

| Function | Request | Response | Notes |
|---|---|---|---|
| `voice-upload-url` | `{ debateId, durationMs, consentVersion }` | `{ recordingId, uploadUrl, expiresIn }` | Rejects when the room is not private 1:1, when consent version is stale, or when `durationMs` exceeds the 60-second cap |
| `voice-playback-url` | `{ recordingId }` | `{ playbackUrl, expiresIn, receiptId, consuming }` | **Receipt INSERT precedes the mint, fail-closed.** Author and moderator get `consuming:false` |
| `voice-recording-lifecycle` | `{ recordingId, action: 'save' \| 'unsave' \| 'delete_now' \| 'report' }` | `{ retentionState }` | Author-only for save/unsave/delete; report sets the moderation hold |

**RLS posture** (VOICE-DB cards): every new table has RLS enabled with **SELECT-only** client policies delegating to the canonical argument/room visibility, and **no client INSERT / UPDATE / DELETE policy at all** — all writes are service-role from an Edge Function, matching the shipped `timestamp_markers` and `proof_items` precedent. The storage bucket is private with deny-all client policies; **only Edge Functions mint signed URLs, in either direction.**

---

## §10 Implementation DAG

Each node cites VOICE-ADR-002 as its doctrine gate; each carries a doctrine self-check naming the ADR sections it satisfies. This supersedes the DAG in the shipped VOICE-001 §14 and refines VOICE-PATCH-001 §6.1 (whose pure-TS-before-native correction is **kept**).

```
VOICE-ADR-002 (#863, RATIFIED 2026-07-25)  [the governing contract]
  |
  +-> VOICE-001 (issue 659)  THIS DOC  [design only; no gate]
        |
        +-> VOICE-003  speech session model + transcript artifact   pure TS   [no gate]
        +-> VOICE-004  waveform model (normalize / bucket / ring)   pure TS   [no gate]
        |     (VOICE-003 and VOICE-004 are parallel; neither imports a native module)
        |
        +-> VOICE-002  deps + config plugins + dev build            **GATE-C**
        |     (may start any time after VOICE-001; required before VOICE-007)
        |
        +-> {VOICE-002, VOICE-003, VOICE-004}
              +-> VOICE-005  live waveform  [Skia branch GATE-C; SVG branch mergeable]
              |     +-> VOICE-006  snapshot spike  [GATE-C if the capture path is native]
              +-> VOICE-007  VoiceInputAdapter + room-eligibility model  [gate-adjacent]
                    +-> VOICE-UI-001 / VOICE-008  host integration (4 hosts)
                    |     [GATE-C if the submit path changes -- it MUST NOT]
                    |     [PRE-FLIP GATE: ADR-002 section 13.2 room-type gating]
                    |
                    +-> VOICE-STT-001  Deepgram nova-3 bake-off + Edge integration
                    |     [GATE-C -- provider spend is OPERATOR-ARMED]
                    +-> VOICE-DB-*    voice_entries / receipts / segments / consent  **GATE-C** (migration)
                          +-> VOICE-BE-*  S3 provider adapter + the 3 Edge Functions  **GATE-C**
                          |     [NEW CREDENTIAL SURFACE -- AWS keys, Edge secrets only]
                          |     [PRE-FLIP GATE: ADR-002 section 13.1 flag coupling]
                          +-> SEC-VOICE-004  AWS backup / purge confirmation  [docs; BEFORE any copy freeze]
                          +-> one-time-playback card  [receipt-gated session; ADR-002 section 3]
                          +-> MARK-003 (#895)  waveform region-select twin
                          |     [widens timestamp_markers.span_unit to 'ms' + adds recording_id]
                          +-> QA-003 (#668)  recorder device matrix
                          +-> QA-004 (#902)  playback race / lifecycle matrix
                          +-> MCP-K-001  Family K design  [GATE-A only]
                                +-> MCP-K-002  Family K impl  **GATE-C** (Deno Deploy + hosted smoke)
AUDIO-001  [deferred P3; off the main path]
```

**Sequencing rules, all satisfied:**

- Nothing installs natively before VOICE-002. Nothing designs before VOICE-001.
- The pure-TS models (VOICE-003, VOICE-004) do **not** wait on the GATE-C native card — VOICE-PATCH-001 §6.1's correction stands.
- **No audio object exists before VOICE-DB.** No playback card before the audio object. No `one_time_playback` flip before the receipt table.
- **MARK-003 waits on VOICE-DB** — `recording_id` has no producer until then, which is exactly why MARK-001 deferred the column.
- **No MCP implementation before artifact persistence.** MCP-K-001 after VOICE-DB; MCP-K-002 after MCP-K-001.
- **SEC-VOICE-004 lands before any consent copy is frozen**, so the copy never overpromises about AWS purge behaviour.
- QA-003 and QA-004 run after the surface exists; QA-001's journey manifest rows for J5, J8, and J6-audio flip in the same card that ships each surface.

**GATE-C flags per node:** VOICE-002 (native deps + dev build), VOICE-005 Skia branch, VOICE-006 capture path, VOICE-UI-001/008 *only if* it touches the submit path (it must not), VOICE-STT-001 (**operator-armed provider spend**), VOICE-DB-* (migration), VOICE-BE-* (**new AWS credential surface**), MCP-K-002 (Deno Deploy redeploy plus a hosted `*.deno.net` smoke — a git merge does not make it live).

---

## §11 Dependencies

- **Governed by** VOICE-ADR-002 (#863), ratified. Every downstream card's doctrine self-check cites it; a card that violates any section is not mergeable.
- **Supersedes** `docs/designs/VOICE-001-SPEECH-WAVEFORM-ARCHITECTURE.md` (#673) on posture and inventory; that file keeps its engineering detail where this doc is silent.
- **Refines** `docs/designs/VOICE-PATCH-001-DAG-AND-MEDIATOR-BRIDGE.md` — its §6.1 pure-TS-first ordering and its §6.4 minimal pre-record prompt (no self-certification before the mic opens) are **kept**; its §6.2 metadata-first persistence stance is **superseded** by ADR-002 §1 for the audio object, while its "do not duplicate the posted body into a second table" rule is kept.
- **Reads (must remain stable for the adapter):** `ArgumentComposer.tsx` (:249, :339, :417-435, :71-80); `composer/ArgumentEntryComposer.tsx` (:140, :316-327, :369-379); `useArgumentComposer.ts` (:24, :62-69); `oneBox/OneBox.tsx:400`; `ArgumentComposerDock.tsx:160`; `App.tsx:1580,1602`; `startArgument/StartArgumentPage.tsx:348-362`; `startArgument/StartArgumentSheet.tsx:329-342`; `src/lib/featureFlags.ts` (:47, :78-80, :120, :136, :214); `src/features/debates/types.ts` (`visibility`, `circleId`); `roomContractModel.ts:26`; `src/lib/designTokens.ts:552-554`; `src/features/preferences/useReduceMotion.ts`; `gameCopy.ts:888,926`; `supabase/functions/submit-argument/index.ts` (:297, :329, :376-378); `supabase/migrations/20260711000001_mark_001_timestamp_markers.sql`.
- **Blocks:** VOICE-002 and the entire downstream DAG; MARK-003 (#895); QA-003 (#668); QA-004 (#902); the J5 / J8 / J6-audio rows of the QA-001 journey gate.
- **Coordinates with (does not rebuild):** QOL-030 one-box chassis, QOL-031 Act popout, IX-003 accessibility and keyboard contract, UX-MEDIATOR-001 read-only projection precedent.

---

## §12 Risks

- **The seam is no longer singular.** Four rendering hosts instead of one. Mitigation: one adapter component, one shared `activeDraft` for the two in-room hosts, and an explicit rule that only one speech session may be live at a time. The alternative — wiring voice separately per host — would produce four divergent implementations and is refused.
- **`ArgumentComposer.tsx` is on the zero-diff boundary** (`uxOneOneFiveReadOnlyBoundary.test.ts:128`). Adding props requires an operator-authorized relaxation with a `NOTE`. Do not quietly delete the pin.
- **The mic teaser is live in every room type today.** Until the §13.2 gate exists, the app advertises a capability the D4 launch scope cannot keep in circle and public rooms. The gating card should ship the gate **before or with** the affordance, never after.
- **`disabled` is not `absent` on RN Web.** A disabled `Pressable` still takes keyboard focus. The gate must remove the node, and the test must assert absence from the tree, not `disabled === true`.
- **Static env inlining.** Voice flags must be read through the existing static-dot-access resolvers. A dynamic `process.env[...]` read passes jest and typecheck but resolves undefined in the Netlify web bundle (the #776 class of bug). `__tests__/roomThreeSourceScan.test.ts:48` already guards this pattern for the ROOM-003 files.
- **New credential surface.** AWS keys are a genuinely new secret class for this repo, live only in Supabase Edge secrets, operator-provisioned when the VOICE-BE cards start. They must never appear in client code, in git, or in any log. The existing pre-commit check (`grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` returning zero) should be extended to the AWS and Deepgram key names.
- **Native build complexity.** Managed/CNG forces config plugins plus a dev build; the stack cannot run in Expo Go. All of it is isolated into VOICE-002 and nothing downstream installs natively before it.
- **Skia and view-shot capture reliability.** Canvas-to-image is undocumented upstream for both. `react-native-svg` is the deterministic floor; capture is spike-only and never a posting dependency.
- **Privacy misreading.** ADR-001 said "no audio, ever"; ADR-002 says "scoped, consent-gated, deleted." Any reviewer or implementer working from the older doc will reach the wrong conclusion. Mitigation: §0 of this document, and every downstream card citing ADR-002 by name.
- **Consent copy overpromising.** ADR-002 §6 fixes the copy rule at *"the app deletes it"* — no more. SEC-VOICE-004 must land before any copy freeze.
- **Deploy-bearing MCP.** `mcp-server/` deploys to Deno Deploy, not Supabase. A green merge does not make Family K live.
- **Test-count and boundary churn.** At least five existing suites need deliberate updates (§8). Each must be updated in the card that breaks it, with a stated reason — never silently.

---

## §13 Out of scope

- **Any code, install, config-plugin edit, migration, Edge Function, mcp-server change, deploy, or flag flip.** This card is one markdown file.
- **Voice in circle rooms and public rooms.** ADR-002 D4 and §5 exclude both at launch; they join the §5 revisit list, where the recorded constraint is that an unbounded listener set makes one-listen incoherent, and the revisit options are saved-only or transcript-only.
- **Emotion, tone, stress, confidence, honesty, manipulation, biometric, identity, credibility, or intent analysis** — forbidden, not deferred.
- **`recognitionConfidence` as a persisted or surfaced field** — deferred entirely in v1; a later card ratifies it or it stays absent.
- **Timing-structure research analysis** (pauses, words-per-minute as a studied signal). ADR-002 D7 is disclose-or-do-not-collect: v1 collects rendering-only timing metadata, stored not scored.
- **TTS / read-aloud** (`expo-speech`) — v1 is speech-in only.
- **Dictation on the non-drafting forms** (`RequestReviewComposer`, `DeletionRequestSheet`) and on the three dormant structured-form bodies.
- **Speech as a submit gate** — the deterministic engine remains the sole acceptance gate.
- **v1-banned scope** — no voting, no argument search, no push notifications, no public API, no OAuth beyond the shipped Google lane, no real-time collaborative body editing.

---

## §14 Doctrine self-check

**cdiscourse-doctrine**

- **§1 no truth labels; score never blocks posting.** The engine is the sole gate (`submit-argument` :297 → :329 → :376). Speech is upstream drafting help; artifacts and Family K are post-storage and advisory. No field anywhere encodes truth, winner, loser, or verdict. The waveform never reaches the engine or the score model.
- **§2 heat means activity.** Nothing in this design lets recording volume, duration, or frequency read as importance, correctness, or consensus.
- **§3 popularity is not evidence.** No engagement input anywhere. Amplitude is loudness over time, not influence. A recording earns no factual standing.
- **§4 AI moderator limits.** No AI runs on the client. Deepgram runs **inside an Edge Function only**, produces navigation metadata, and decides nothing. Family K is post-store, advisory, `authoritative: false`, text and metadata only, never audio.
- **§6 secrets.** AWS and Deepgram keys live only in Supabase Edge secrets. Nothing in `app/` or `src/`, nothing in git.
- **§7 no AI calls from the production app.** The client calls a device or OS speech API and Supabase Edge Functions. It calls no external AI provider.
- **§8 Supabase conventions.** RLS on every new table, SELECT-only client policies, no client write policy, sequential migrations, never edit an applied migration. **Named exception, deliberate and ADR-ratified:** ADR-002 §6 hard-deletes the S3 **storage object** while the DB row **tombstones**. Rows still never hard-delete.
- **§9 plain language.** Every internal code — `VoiceUnofferableReason`, session status, recognizer errors, retention state — routes through `toPlainLanguage`. Unknown codes are suppressed, not echoed.
- **§10a Observations vs Allegations.** Family K outputs are machine **Observations** (`source: 'machine'`), never user allegations, never person attributions.
- **§10 v1 scope guards.** Nothing here builds voting, search, push, a public API, or collaborative editing.

**VOICE-ADR-002 (governing)**

- **§0 acceptance-gate invariant** — the submit path is byte-unchanged; §8 makes it a mechanical test.
- **§0 text fallback** — §4.2's `VoiceAvailability` guarantees a working text box at every host in every unofferable state; §7 enumerates them.
- **§0 forbidden inference list** — §5.3 invariant 2 plus the `voiceDoctrineBanList` source-scan; `recognitionConfidence` deferred entirely.
- **§0 transcript ownership** — interim stays adapter-local; final enters through the host's own typed-input path; `wasEdited` / `editDistance` are neutral.
- **§0 Family K MAY / MAY-NOT** — unchanged; Family K still never receives a URL, storage key, playable file, or audio bytes.
- **§1 / D4 room scope** — §4.3's `classifyVoiceRoom` gates on private 1:1 only, failing closed on `'unknown'`.
- **§2 consent** — versioned author consent gates recording; the disclosure list and the D6 numbers are stated up front.
- **§3 one-time playback** — server-enforced; receipt INSERT precedes the URL mint, fail-closed; author replay non-consuming.
- **§6 deletion and honest limits** — HEAD-verified deletion, `no-store` headers, versioning off; copy never promises more than "the app deletes it."
- **§8 transcript accuracy** — body authoritative and immutable; segments are navigation metadata; correction is a segment re-run.
- **§9 marker misrepresentation** — `quoted_text` snapshotted verbatim at creation; MARK-003 widens `span_unit` without reshaping the table.
- **§11 audit** — never log audio bytes, signed URLs, full storage keys, or transcript text.
- **§12 enforcement checklist** — every item has a named suite in §8.
- **§13.1 flag coupling** — `voiceFlagCoupling.test.ts`.
- **§13.2 room-type gating** — `voiceComposerGatingMatrix.test.tsx`, asserting absence from the tree and from the focus order.

**expo-rn-patterns** — deps via `npx expo install`; RN primitives first; model files pure TS with no React or Supabase imports; `Platform.select` over scattered `Platform.OS` checks; the Speak control is touch-first on every platform and is **not** routed through the keyboard-badge gating.

**accessibility-targets** — 44×44 on the Speak control via visual size or `TOUCH_TARGET.hitSlopAll` (the current teaser lacks `hitSlop` and must gain it); role, label, and `accessibilityState` including `busy`; the waveform is hidden from the accessibility tree as decoration; mic-active announced once, not per frame; reduce-motion snaps via the shared `useReduceMotion` hook; grayscale-legible because height and shape carry the meaning, not colour; a gated-out slot is absent from the focus order, not disabled within it.

**test-discipline** — every card ships its suites; ban-list tests carry firing positive controls; gates are green only on a captured exit code of 0.

**No conflict found.** The card is buildable as reconciled.

---

## §15 Operator steps

**For this card: none — pure design doc.** No install, no plugin, no migration, no deploy, no flag flip, no push.

Flagged for the operator, in the order they will be needed:

1. **One-line status header** on `docs/designs/VOICE-001-SPEECH-WAVEFORM-ARCHITECTURE.md` pointing at this file (outside this card's single-file scope).
2. **VOICE-002** — after the implementer commits, confirm a development build launches on a real device. The voice stack cannot run in Expo Go.
3. **VOICE-STT-001** — Deepgram spend is operator-armed. Provision `DEEPGRAM_API_KEY` in Supabase Edge secrets only, and arm the bake-off explicitly.
4. **VOICE-BE-*** — provision the AWS credentials (new credential surface) in Supabase Edge secrets; create the S3 bucket with SSE-S3, **versioning OFF**, `Cache-Control: private, no-store`, the 30-day lifecycle backstop, and bucket-owner-enforced ACLs.
5. **VOICE-DB-*** — `npx supabase db push --linked`, then `npx supabase functions deploy <name> --linked` for each new function.
6. **SEC-VOICE-004** — confirm AWS backup and purge behaviour on the chosen plan tier **before** any consent copy is frozen.
7. **Flag flips** — `EXPO_PUBLIC_VOICE_ENTRIES` and `EXPO_PUBLIC_ONE_TIME_PLAYBACK` flip **together** (ADR-002 §13.1), and only after the §13.2 room-type gate ships. Set them in the Netlify runtime env; the deployed bundle must be rebuilt and the new bundle hash confirmed.
8. **MCP-K-002** — redeploy `mcp-server/` to Deno Deploy and pass a hosted `*.deno.net` smoke. A green merge is not a live deploy.

---

## §16 Reviewer summary

VOICE-001 is re-delivered as a reconciliation, not a fresh design, because its original architecture doc shipped in June against VOICE-ADR-001 and both of its load-bearing assumptions have since broken: the governing contract is now VOICE-ADR-002 (audio is a scoped, consent-gated, retention-bounded stored artifact on AWS S3, one receipt-gated playback session, private 1:1 rooms only at launch, Deepgram nova-3, tighter retention, rendering-only timing metadata), and the composer surface is no longer a single seam — the ASP program produced four body-bearing inputs (`composer-body-input`, `argument-entry-composer-input`, `start-argument-declaration`, `start-sheet-declaration`), of which the first two share one `activeDraft` through `useArgumentComposer.updateField` and the last two are root-claim creation surfaces with file-local state. This document therefore re-specifies the seam as one `VoiceInputAdapter` mounted at up to four hosts, each funnelling only the **final** transcript through that host's own existing typed-input path while interim text stays adapter-local; adds the two pieces ADR-002 §13 makes pre-flip gates — a new pure `classifyVoiceRoom` model that fails closed and renders the mic slot **absent from the tree** (not disabled) in circle and public rooms, replacing the currently ungated `'Voice — coming soon'` teaser at `ArgumentEntryComposer.tsx:369-379`, and a flag-registry coupling test forbidding `voice_entries`-ON while `one_time_playback` is OFF; restages the artifact shapes so the ADR-001 hard literal `audioPersisted: false` becomes an `audioPersistenceMode: 'none' | 'scoped_governed'` discriminator that does not lie once persistence lands, with a `VoiceRecordingRef` that deliberately carries no URL, storage key, or URI on the client; and sequences a DAG in which no audio object exists before VOICE-DB, MARK-003 waits for `recording_id` to have a producer, no MCP implementation precedes persistence, SEC-VOICE-004 precedes any consent-copy freeze, and STT spend plus the AWS credential surface stay operator-armed GATE-C. All nine audio, speech, drawing, STT, and storage dependencies are confirmed absent from `package.json`; `app.json` has no `plugins` key at all; the build is managed/CNG, so a development build is required and Expo Go cannot run the stack; and no platform claim is made beyond the upstream facts carried from the card and the slate roadmap. The deterministic engine remains the sole acceptance gate throughout — the audio never gates a post.
