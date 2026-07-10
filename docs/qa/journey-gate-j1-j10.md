# CDiscourse — J1–J10 ASP Journey Gate (QA-001)

_ASP release gate — card QA-001 (#692). Created 2026-07-11._

## Purpose

This is the **operator-armed release checklist** for the Argument Surface Pivot
(ASP). It scripts each of the Design Pass's ten "Core user journeys" (§4, J1–J10)
step-by-step against the **shipped** surfaces, with per-step expected states, and
pairs each journey with the automated jest coverage that guards its seams.

It is the **L1** gate in a two-level chain:

- **L0** — `docs/mvp-smoke-test.md` (Stage-5.5.6 MVP smoke: auth, debate create,
  tree, composer). Run first; it proves the app boots and the core loop works.
- **L1** — this document. Run per-journey when its flag is armed; it proves the
  ASP surfaces behave as designed.

The gate is **conditionally green**: seven journeys are walkable/automatable
today. Three — J5 (record voice), J8 (save recording), and the **audio half** of
J6 — have **no shipped surface** and are **BLOCKED ON VOICE-ADR-002 (#863)**. They
are documented here as unarmed; they do not fail the gate, and the automated
manifest (`__tests__/journeyGateCoverageMap.test.ts`) asserts they claim no test
and carry the `#863` marker.

Copy note: every script line quotes the **shipped** string. Where the Design Pass
§4 prose differs (aspirational), the shipped string wins and the divergence is
logged in the "Shipped-vs-prose copy ledger" at the bottom.

---

## Pre-conditions

Before arming any journey:

1. `npm run typecheck` — passes (0 errors).
2. `npm run lint` — passes (0 warnings).
3. `npm run test` — passes; the L1 automated seams are included in the suite.
4. L0 (`docs/mvp-smoke-test.md`) has passed for the current build.
5. `.env` has real `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   and the deployed build is reachable (dev: `dev-cdiscourse.netlify.app`).
6. The journey's flag is armed in the Netlify runtime env (see each section).

If pre-conditions 5–6 are not met, only the **"no `.env` path"** of each section is
walkable (flag-off byte-identity + render-shape). Record which steps were run and
which were skipped. The automated seams never need `.env` (pure models + JSDOM).

---

## How to arm a journey

Each journey names the ASP flag it needs. All eight ASP flags default **OFF in
code**; `home_v2` and `room_exchange_v2` are flipped **ON in the deployed build**
(2026-07-09 A×B ship). To arm an OFF journey, set its `EXPO_PUBLIC_*` var in the
Netlify runtime env and publish (strict-FF push + poll the deployed bundle hash),
then walk the script. Flags resolve **once in `App.tsx`** and thread down as props;
no feature file reads the env, so arming is a pure runtime concern.

| Journey | Flag | `EXPO_PUBLIC_*` var | Deployed state |
| --- | --- | --- | --- |
| J1–J4 | `home_v2` | `EXPO_PUBLIC_HOME_V2` | **LIVE** |
| J9 | `room_exchange_v2` | `EXPO_PUBLIC_ROOM_EXCHANGE_V2` | **LIVE** |
| J7 | `proof_drawer` | `EXPO_PUBLIC_PROOF_DRAWER` | OFF (needs PROOF-001 back-fill first) |
| J6 (text) | `timestamp_rebuttals` | `EXPO_PUBLIC_TIMESTAMP_REBUTTALS` | OFF |
| J10 | `move_marks` | `EXPO_PUBLIC_MOVE_MARKS` | OFF (10%-cohort rollout planned) |
| J5, J8, J6 (audio) | `voice_entries` / `one_time_playback` | — | OFF — **BLOCKED ON #863** |

---

<a id="j1"></a>
## J1 · First-time user knows what to do

- **Flag:** `home_v2` · **Deployed:** LIVE · **Blocked:** —
- **Seam:** `buildArgumentHomeViewModel` (`isFirstRun` true iff `yourTurn` and
  `ongoing` are both empty). Verbs from `HOME_COPY`.

**Operator steps**

1. [ ] Sign in (Google SSO) as a brand-new account with no rooms.
2. [ ] Land on Home. **Expected:** the empty your-turn strip (`home-empty-state`)
       shows exactly three verbs — `Resume`, `Start with someone`,
       `Watch the floor` (`home-empty-verb-resume` / `-start` / `-floor`).
3. [ ] **Expected:** the empty state offers `Start your first argument`
       (`home-empty-start-first`) and a demo corridor `See a real one`
       (`home-demo-corridor-link`).
4. [ ] **Expected:** no bucket / lane taxonomy is visible until `The floor` is
       opened.

**No `.env` path:** render the Home empty-state component in the flag-off build;
confirm the three verbs and the two entry CTAs render and no taxonomy shows.

**Automated seam (spine-of-record):** `argumentHome.test.tsx` (exactly three
verbs, no lane taxonomy pre-floor), `homeModel.test.ts` (`isFirstRun`),
`homeV2FlagOff.test.tsx` (flag-off byte-identity).

---

<a id="j2"></a>
## J2 · Resume an ongoing argument

- **Flag:** `home_v2` · **Deployed:** LIVE · **Blocked:** —
- **Seam:** `deriveGalleryEntryHint(card)` (⚠ renamed from
  `deriveConversationEntryHint`, GAL-002) sets the pre-activated message + verb;
  `isWaitingOnViewer` + `deriveYourTurn` build the strip.

**Operator steps**

1. [ ] As an account with one room where the opponent moved last, open Home.
2. [ ] **Expected:** the your-turn strip (`home-your-turn-strip`) shows the
       awaited-move card with the opponent's rebuttal excerpt and a relative time.
3. [ ] Tap the card (`argument-card-{debateId}`). **Expected:** the room opens
       with **that node active** (entry-hint pre-activation) and the composer
       scoped to it.
4. [ ] **Expected:** you can reply immediately — no mode choice, no seat ceremony.

**No `.env` path:** feed `deriveGalleryEntryHint` a fixture card and confirm the
pre-activated message id + verb; render the your-turn strip shape.

**Automated seam:** `argumentHome.test.tsx` (your-turn tap fires `onOpen` with
pre-activation), `galleryEntryHintModel.test.ts`, `conversationGalleryYourTurn.test.ts`.

---

<a id="j3"></a>
## J3 · Start an argument with a specific person

- **Flag:** `home_v2` (start sheet) · **Deployed:** LIVE · **Blocked:** —
- **Seam:** `orderPickerRows` (open-floor ALWAYS last), `deriveRecentOpponents`,
  `personTargetToCreationIntent` (two-tap invariant — passes visibility through,
  never forces `public`), `isStartArgumentDraftSubmittable`.

**Operator steps**

1. [ ] Home → `Start an argument`.
2. [ ] **Expected:** the picker (`person-argument-picker`) rows are in fixed
       order — recents → circles → invite-by-email → open-floor **last**
       (`person-picker-open-floor`, labelled `No one — open floor`).
3. [ ] Pick a recent person (`person-picker-recent-{email}`) and type the point
       (`start-sheet-declaration`).
4. [ ] **Expected:** the summary reads `Private — just you and {person}.` with the
       person's name filled in.
5. [ ] Tap `Start argument`. **Expected:** land in the room; the first move is the
       declaration posted as root. If the person is not a member, a one-time
       invite link box shows (`start-sheet-invite-success`).

**No `.env` path:** unit-drive `orderPickerRows` + `personTargetToCreationIntent`;
render the picker and confirm the fixed row order with no profile enumeration.

**Automated seam:** `startArgumentSheet.test.tsx` (J3 ordered walk),
`personArgumentPickerModel.test.ts` (order + intent), `personArgumentPicker.test.tsx`
(rendered order, no profile enumeration).

---

<a id="j4"></a>
## J4 · Start a public argument (non-default)

- **Flag:** `home_v2` (start sheet) · **Deployed:** LIVE · **Blocked:** —
- **Seam:** `nextPublicToggleState` (fail-closed to `private`),
  `resolveCreationVisibility` returns `public` **only** for `public_confirmed` —
  the single two-tap choke point; there is **no length-1 path** to public.

**Operator steps**

1. [ ] Start sheet → Who → `No one — open floor` (last, visually distinct).
2. [ ] **Expected:** Advanced auto-expands; the Public toggle is **OFF by default**.
3. [ ] Flip the toggle on (`public-argument-toggle-switch`). **Expected:** capacity
       + visibility consequence copy appears.
4. [ ] Tap the **second explicit** confirm `Make it public`
       (`public-argument-toggle-confirm`). **Expected:** creating the room places
       it on The Floor with the respondent seat open. (`Keep it private` /
       `public-argument-toggle-cancel` retreats to private.)

**No `.env` path:** unit-drive `nextPublicToggleState` + `resolveCreationVisibility`
(prove no single-event path reaches `public`); render the toggle default-OFF.

**Automated seam:** `publicArgumentToggleModel.test.ts` (two-tap L1: no single
event reaches public), `PublicArgumentToggle.test.tsx` (default OFF, retreat),
`startArgumentSheet.test.tsx` (open-floor stays private until the 2nd confirm).

---

<a id="j5"></a>
## J5 · Record a voice argument — **BLOCKED ON #863**

- **Flag:** `voice_entries` · **Deployed:** OFF · **Blocked:** **VOICE-ADR-002 (#863)**

**Doc-only target flow (unarmed):** hold mic → live waveform + streaming
transcript → review / trim / edit → send: text posts via `submit-argument`, audio
uploads in parallel, renders as a VoiceEntryBlock.

There is **no shipped voice surface**, so this journey cannot be armed and has no
automated spine. The manifest asserts J5 claims no spine and carries the `#863`
marker. Do not stub a fake voice surface to force a green cell.

**Unblocks when:** VOICE-ADR-002 (#863) + the P4–P6 voice cards ship the recorder.

---

<a id="j6"></a>
## J6 · Opponent listens once, rebuts a timestamped phrase

- **Flag:** `timestamp_rebuttals` (text half) / `one_time_playback` (audio half)
- **Deployed:** OFF · **Blocked:** **audio half — VOICE-ADR-002 (#863)**
- **Seam (text):** `segmentPhrases` (exact char offsets), `formatMarkerChipLabel`
  (curly-quoted, clamp 40), `buildSourceSpanSegments` (null on offset drift →
  chip falls back to durable `quoted_text`), `buildTimestampMarker` (`live` vs
  `orphaned`).

**Operator steps — TEXT half (armable when `timestamp_rebuttals` is on)**

1. [ ] On a posted opponent move, tap `Respond to this`
       (`ringside-respond-to-this-{id}`). **Expected:** the phrase picker opens
       (`marker-phrase-picker-sheet`) headed `Pick a phrase to respond to`.
2. [ ] Pick a phrase (`marker-phrase-row-{i}`). **Expected:** a marker chip forms
       with the exact span; the composer opens scoped to it, prefixed `Quoting: `.
3. [ ] Send the reply. **Expected:** the reply carries the marker chip
       (`timestamp-marker-reply-{id}`).
4. [ ] Soft-delete the target move. **Expected:** the chip still resolves to the
       stored quote and shows the orphaned tombstone `Quoted move was removed`.

**Doc-only — AUDIO half (unarmed): BLOCKED ON #863.** One-time playback gate,
karaoke transcript, long-press waveform 0:42–0:51 → the same marker. No shipped
surface; not scripted.

**No `.env` path:** unit-drive the model chain (`segmentPhrases` →
`formatMarkerChipLabel` → `buildSourceSpanSegments` happy + drift → live/orphaned).

**Automated seam:** `journeyJ6TextMarkerRebuttal.test.tsx` ⋆ (the ordered model
handoff), `timestampMarkerModel.test.ts`, `markerFlagOff.test.tsx`. (`⋆` = new.)

---

<a id="j7"></a>
## J7 · Add proof after being challenged

- **Flag:** `proof_drawer` · **Deployed:** OFF (needs PROOF-001 back-fill before
  the flip) · **Blocked:** —
- **Seam:** `deriveEvidenceDebts` (`requested → supplied` only when a later
  in-subtree move supplies the kind; a bare quote does **not** discharge a
  `source` debt), `isProofDraftPostable`, `attachProof({…, answersDebtKind})`.

**Operator steps**

1. [ ] Opponent asks for a source on your move. **Expected:** your state strip
       shows the owed marker `Source owed` and the move grows an owed chip
       (`argument-entry-composer-proof-owed`).
2. [ ] Tap the owed chip. **Expected:** the Proof drawer opens pre-scoped (paste a
       link / drop a screenshot / quote a source — one attach), attach button
       `Attach source`.
3. [ ] Attach a real source (`proof-drawer-attach`). **Expected:** a ProofChip
       appears and the debt flips owed → supplied (`Source requested` →
       `Evidence attached`); the opponent gets the existing `evidence_supplied`
       notification.
4. [ ] **Expected:** the exchange never paused — proof attaches to the **past**
       move, not to your next reply.

**No `.env` path:** unit-drive `deriveEvidenceDebts` (requested → supplied after a
real source lands; a quote-only attach stays `requested`).

**Automated seam:** `proofJ7Flow.test.tsx` (answers-debt threads through
`onAttach`; requested → supplied flip; quote-only stays requested),
`proofDrawerModel.test.ts`, `proofDrawerCopyBanList.test.ts`.

---

<a id="j8"></a>
## J8 · Save a recording before it expires — **BLOCKED ON #863**

- **Flag:** `voice_entries` / `one_time_playback` · **Deployed:** OFF
- **Blocked:** **VOICE-ADR-002 (#863)**

**Doc-only target flow (unarmed):** own voice block shows lifecycle ("Dana hasn't
listened yet · expires in 6d" + Keep) → Keep → confirm sheet (saved = replayable
forever until deleted) → badge flips to Saved; expiry + one-time rules stop; a
`recording_expiring` notification fires 24h before expiry.

No shipped voice surface. The manifest asserts J8 claims no spine and carries the
`#863` marker. **Unblocks when:** VOICE-ADR-002 (#863) ships the recorder.

---

<a id="j9"></a>
## J9 · Review the argument map after several turns

- **Flag:** `room_exchange_v2` · **Deployed:** LIVE · **Blocked:** —
- **Seam:** `deriveArgumentStateRail` (`open_points` chip carries `deepLink:'map'`,
  visible only when `openPointCount > 0`), `deriveRoomMediatorBoardState` →
  `deriveMediatorBoardState` (**single derivation**; the frozen board is shared by
  the rail + node markup), `getNodeMediatorMarker` (**one** marker per node),
  `buildMapNodeActionSurface` (`answerThisLabel = 'Answer this ↗'`, `answerThis`
  target = the node id).

**Operator steps**

1. [ ] In a room with several turns, read the state strip. **Expected:** it shows
       `N open point(s)` (`argument-state-rail-chip-open_points`).
2. [ ] Tap the chip. **Expected:** the room switches to Map mode (in-app `setMode`,
       never a URL).
3. [ ] **Expected:** nodes carry receipt marks / marker pins / open-point rings;
       an ordinary open node shows **no** chip (one state per node — no chip-soup).
4. [ ] **Expected:** the mediator rail's `What remains unresolved` list
       (`disagreement-points-rail`) docks as the map's legend
       (`disagreement-points-rail-marks-legend`).
5. [ ] Tap a node (`map-node-action-popover-{id}`). **Expected:** a sidecar readout;
       `Answer this ↗` (`map-popover-answer-this-{id}` / `map-sidecar-answer-this`)
       jumps back to Exchange **scoped to that node**.

**No `.env` path:** unit-drive the ordered handoff — one board drives the rail
count + the node markers; the tapped node id is the answer-this scope target.

**Automated seam:** `journeyJ9ReviewMap.test.tsx` ⋆ (ordered handoff + single
derivation + no chip-soup), `argumentStateRailModel.test.ts`,
`mapNodeActionSurfaceModel.test.ts`, `roomCapabilityParityMatrix.test.ts`,
`roomMediatorAdapter.test.ts`, `nodeMediatorMarkers.test.ts`,
`uxMediator002NodeMarkup.test.tsx`, `DisagreementPointsRail.test.tsx`. (`⋆` = new.)

---

<a id="j10"></a>
## J10 · Boolean feedback without game-submission feel

- **Flag:** `move_marks` · **Deployed:** OFF (10%-cohort rollout planned) · **Blocked:** —
- **Seam:** `summarizeViewerMarks` (own active marks only), `oppositeOf`
  (mutually-exclusive pair), `deriveMoveMarkAggregate` → **no score / standing /
  weight field**; the bar renders only when flag-on + not own move + participant +
  not observer.

**Operator steps**

1. [ ] Under an opponent move, confirm two quiet ghost buttons — `Answered my point`
       / `Didn't answer it` (`boolean-feedback-bar-{argumentId}`). **Expected:**
       optional, one tap, no modal.
2. [ ] Tap one, then tap it again. **Expected:** the second tap retracts; nothing
       is ever required in order to reply.
3. [ ] **Expected:** the same bar appears in both lenses — Ringside
       (`ringside-feedback-bar-{id}`) and Map (`map-popover-feedback-bar-{id}`).
4. [ ] **Expected:** on your own move and as an observer the bar is absent /
       inert. Human taps land as marks the mediator projection reads
       (`Moments marked unanswered feed what remains unresolved.`).

**No `.env` path:** unit-drive `summarizeViewerMarks` + `deriveMoveMarkAggregate`
(no standing field); render the bar one-tap-mark / second-tap-retract.

**Automated seam:** `moveMarksRoomAggregateWiring.test.tsx` (mark → aggregate →
rail count → legend; the mark surface is **independent of** compose/submit),
`BooleanFeedbackBar.test.tsx` (one-tap-mark / second-tap-retract, no modal),
`feedbackMoveMarksNoStanding.test.ts` (no standing path).

---

## Journey coverage map

Legend: **Prod** = deployed runtime state (code default is OFF for all eight
flags). `flagLiveState` lives **only** in this human table — never in the
executable manifest, so an operator flag flip cannot break CI. `⋆` = spine
authored by this card.

| J# | Journey | Flag | Prod | Blocked | Automatable now | Spine-of-record |
| --- | --- | --- | --- | --- | --- | --- |
| J1 | First-time knows what to do | `home_v2` | LIVE | — | yes | `argumentHome.test.tsx`, `homeModel.test.ts`, `homeV2FlagOff.test.tsx` |
| J2 | Resume ongoing argument | `home_v2` | LIVE | — | yes | `argumentHome.test.tsx`, `galleryEntryHintModel.test.ts`, `conversationGalleryYourTurn.test.ts` |
| J3 | Start with a specific person | `home_v2` | LIVE | — | yes | `startArgumentSheet.test.tsx`, `personArgumentPickerModel.test.ts`, `personArgumentPicker.test.tsx` |
| J4 | Start public (non-default) | `home_v2` | LIVE | — | yes | `publicArgumentToggleModel.test.ts`, `PublicArgumentToggle.test.tsx`, `startArgumentSheet.test.tsx` |
| J5 | Record a voice argument | `voice_entries` | OFF | **#863** | no | — (doc-only) |
| J6 | Rebut a timestamped phrase | `timestamp_rebuttals` (text) / `one_time_playback` (audio) | OFF | audio **#863** | text: yes / audio: no | `journeyJ6TextMarkerRebuttal.test.tsx` ⋆, `timestampMarkerModel.test.ts`, `markerFlagOff.test.tsx` |
| J7 | Add proof after challenge | `proof_drawer` | OFF | — | yes | `proofJ7Flow.test.tsx`, `proofDrawerModel.test.ts`, `proofDrawerCopyBanList.test.ts` |
| J8 | Save recording before expiry | `voice_entries` / `one_time_playback` | OFF | **#863** | no | — (doc-only) |
| J9 | Review the argument map | `room_exchange_v2` | LIVE | — | yes | `journeyJ9ReviewMap.test.tsx` ⋆, `argumentStateRailModel.test.ts`, `mapNodeActionSurfaceModel.test.ts`, `roomCapabilityParityMatrix.test.ts`, `roomMediatorAdapter.test.ts`, `nodeMediatorMarkers.test.ts`, `uxMediator002NodeMarkup.test.tsx`, `DisagreementPointsRail.test.tsx` |
| J10 | Boolean feedback | `move_marks` | OFF | — | yes | `moveMarksRoomAggregateWiring.test.tsx`, `BooleanFeedbackBar.test.tsx`, `feedbackMoveMarksNoStanding.test.ts` |

Cross-cutting doctrine (all journeys): `journeyGateCoverageMap.test.ts` ⋆ (the
executable manifest, with a firing negative control), `journeyGateDoctrineBanList.test.ts`
⋆ (consolidated ban-list, positive + negative controls), `uxMediator002NodeMarkup.test.tsx`
+ `nodeMediatorMarkers.test.ts` (one chip per node), `chimeInGovernanceDoctrine.test.ts`
(private room never exposes chime-in / floor), `roomMediatorAdapter.test.ts` +
`visualSimplify002AnalysisOnDemand.test.tsx` (single mediator derivation).

---

## Minimum passing criteria

- **Automated (blocks the gate):** the seven automatable journeys are green, and
  both cross-cutting suites pass, in `npm run test` with exit 0.
- **Blocked (does not block the gate):** J5, J8, and J6-audio are marked BLOCKED
  ON #863; the manifest asserts each claims no spine and carries the marker.
- **Operator-armed (post-merge, per flag flip):** the section script for the
  armed journey walks clean against the deployed build, with each expected-state
  checkbox ticked. Re-run the relevant section at every flag flip and update the
  Prod column above.

---

## Maintenance rule

The manifest (`__tests__/journeyGateCoverageMap.test.ts`) verifies every cited
spine file exists on disk. If a spine file is renamed, the `existsSync` guard
fails by design — update **both** the manifest and this doc's coverage-map table
in the **same** commit. This is the doc-drift protection, not a bug. When a flag
flips, update the Prod column here (and the arming table) in the flip's PR; the
executable manifest carries no live-state, so it needs no edit.

---

## Shipped-vs-prose copy ledger

The Design Pass §4 prose is aspirational; the scripts above use the **shipped**
strings. Divergences of record:

| Surface | Design Pass §4 prose | Shipped string (used here) |
| --- | --- | --- |
| J2 entry-hint accessor | `deriveConversationEntryHint` | `deriveGalleryEntryHint` (GAL-002) |
| J6 marker chip verb | "Respond to this moment" | `Respond to this` |
| J7 owed marker | "1 receipt owed" / "Receipts?" | `Source owed` |
| J3 start summary | "Private with {person}" | `Private — just you and {person}.` |
