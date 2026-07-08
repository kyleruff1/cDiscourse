# ROOM-001 — ArgumentStateRail: ambient room state strip (read-only projection)

**Status:** Design draft
**Epic:** Argument Surface Pivot (ASP-000, #826) · Milestone M-ASP-2 · Phase 2 · PR slice 05
**Release:** behind `room_exchange_v2` feature flag, DEFAULT OFF
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/876
**Absorbs:** #681 (room header seat line / voices bar) — partial; see § "Scope-reality audit" and the #681 checklist
**Branch:** `feat/room-001-state-rail` (worktree `C:/Users/kyler/cdiscourse/wt-room-001`)

---

## Goal (one paragraph)

A person mid-argument has no single at-a-glance answer to "whose move is it, what is still open, what do I owe, and who can see this?" The state already exists — the mediator board (`deriveMediatorBoardState`), the evidence-debt ledger (`evidenceDebtModel`), and the 1:1 room-contract model (`roomContractModel`) all compute it — but it is spread across a score tracker, an open-issues rail, a mediator rail, and a seat strip that compete at first paint. Design Pass §3 replaces that clutter with one thin ambient strip atop the room; §6 specs it as `ArgumentStateRail`: turn cue · open points · receipts owed · visibility badge, identical in both lenses. This card builds that strip as a **pure read-only projection** over data the room already derives — zero new Supabase queries, zero writes, zero re-derivation of the mediator board (the single-derivation house rule), zero new action semantics. It mounts once above the Exchange ⇄ Map lens switch and rides `room_exchange_v2` (default OFF), so flag-off is byte-identical to today. Doctrine that shapes the design: the rail counts **points and receipts owed on the argument, never per-person standing** (cdiscourse-doctrine §1, point-standing-economy "mark the point not the person"); it shows **no score/heat/popularity** (§2/§3, the only audience number permitted — a neutral watching count — is deferred because no in-room source exists); it **never gates submission** (the deterministic engine is the sole gate); and it is **advisory display only** (§4).

---

## Cannot-proceed check

No blocking conflict with doctrine. There is **one scope-reality conflict** between two acceptance criteria — the seat/voices AC asks for an "N-of-3 chime-ins" count and a "watching count," but the hard "no new Supabase query" AC forbids the only way to obtain them (their data is not loaded in the room render path). This is resolved by a documented scope correction (render the no-new-query subset; reserve the counts behind optional model inputs), not by papering over. See § "Scope-reality audit (REQUIRED)". The card proceeds.

---

## Data model

**No new data model. No migration, no table, no column, no RLS, no Edge Function.** The rail is a pure client-side projection over already-derived in-memory state.

New pure-TS types live in `argumentStateRailModel.ts` (no persistence, JSON-serializable, no React/Supabase import):

```ts
// The four ambient turn states (§6). Neutral, informational — never an enforced lock.
export type StateRailTurnState = 'your_turn' | 'waiting' | 'resting' | 'observer';

// Which existing in-app surface a chip tap reveals. NEVER a URL / route (in-app state only).
export type StateRailDeepLink = 'map' | 'debts' | 'details' | null;

export type StateRailChipKind =
  | 'turn'          // turn cue (always first)
  | 'open_points'   // live disagreement-point count
  | 'receipts_owed' // open evidence-debt count
  | 'visibility'    // Public 1:1 / Private 1:1 (gold when private)
  | 'seat'          // respondent seat open / 2 principal voices (#681 subset)
  | 'saved_recordings'; // RESERVED (P5-6) — renders nothing until VOICE-ADR-002 ships

export interface StateRailChip {
  id: StateRailChipKind;
  /** Plain-language, ban-list-clean, ≤ ~22 chars. */
  label: string;
  /** Full screen-reader sentence. */
  accessibilityLabel: string;
  /** Logical tone → color token in the view. NEVER the only signal (glyph/shape carries meaning too). */
  tone: 'neutral' | 'attention' | 'private_gold';
  /** Which existing surface a tap reveals; null = informational (not pressable). */
  deepLink: StateRailDeepLink;
  /** True when the chip carries meaning worth showing (e.g. suppresses a zero receipts_owed chip). */
  isVisible: boolean;
}

export interface ArgumentStateRailModel {
  turnState: StateRailTurnState;
  /** ALL derived chips in canonical order (turn · open_points · receipts_owed · visibility · seat · saved_recordings). */
  chips: ReadonlyArray<StateRailChip>;   // only isVisible === true entries
  /** First N (=3) shown inline; the rest scroll. */
  visibleChips: ReadonlyArray<StateRailChip>;
  overflowCount: number;                 // chips.length - visibleChips.length (drives "+N")
  /** Root a11y summary for the strip container. */
  accessibilityLabel: string;
}

/** Pure. Inputs are PRIMITIVES already computed in ArgumentRoom (no board/debt/deriver import here). */
export function deriveArgumentStateRail(input: ArgumentStateRailInput): ArgumentStateRailModel;

export interface ArgumentStateRailInput {
  viewerRole: 'observer' | 'participant';          // ArgumentRoom.resolvedViewerRole
  participantSide: string | null;                  // 'affirmative' | 'negative' | 'observer' | 'moderator' | null
  turnLabel: string | null;                        // RoomContractViewModel.turnLabel (already derived, App.tsx)
  visibility: 'public' | 'private';                // currentDebate.visibility (already loaded, App.tsx)
  opponentSeatIsOpen: boolean;                     // RoomContractViewModel.opponentSeat.isOpen
  openPointCount: number;                          // computed in ArgumentRoom from mediatorBoard.points (see below)
  receiptsOwedCount: number;                       // computed in ArgumentRoom from evidenceDebts (see below)
  savedRecordingCount?: number | null;             // RESERVED — omit/0 renders nothing (P5-6)
  openChimeInSeatCount?: number | null;            // RESERVED — no in-room source yet (see scope-reality audit)
  watchingCount?: number | null;                   // RESERVED — no in-room source yet
}
```

**Why primitives, not the board object:** the AC requires a source-scan proving the model imports no Supabase client and does not import `deriveMediatorBoardState` / `deriveRoomMediatorBoardState`. Passing precomputed `openPointCount` / `receiptsOwedCount` (numbers) makes `argumentStateRailModel.ts` import **nothing** from the mediator or evidence layers — the read-only proof is trivially clean, and the single-derivation invariant is impossible to violate from the model.

**Count rules (computed once in ArgumentRoom from the already-derived board/debts):**

- `openPointCount = mediatorBoard.points.filter(p => p.state !== 'resolved_or_settled').length`
  This is byte-identical to the private `selectLivePoints` rule in `DisagreementPointsRail.tsx:144-147`, so the StateRail count and the Map legend count can never drift (Design Pass §9 — "aggregates surface in exactly two places … never a leaderboard"). See § Risks for the no-drift options.
- `receiptsOwedCount = getRoomEvidenceDebtSummary(debate.id, evidenceDebts).openCount`
  Reuses the shipped pure helper (`evidenceDebtModel.ts:663`). `evidenceDebts` is already derived in ArgumentRoom (line 767).

---

## Design decisions (the seven the brief calls out)

### 1. Rail data contract — a pure `deriveArgumentStateRail`, zero queries, zero writes

`deriveArgumentStateRail(input)` is a pure function of primitives (see Data model). It takes the **already-derived** mediator-board-derived count, debt-derived count, room-contract turn label, visibility, and seat state as inputs. It performs **no** fetch, **no** Supabase import, **no** mutation, and does not import any deriver. Chip taxonomy and order (canonical): `turn · open_points · receipts_owed · visibility · seat · saved_recordings`. Overflow rule (§6): **3 chips visible inline; the remainder collapse to a `+N` affordance and horizontal scroll** in the strip's own `ScrollView` (the body never scrolls horizontally). The `turn` chip is always first and always visible.

### 2. Deep-links — supplied callbacks to EXISTING in-app handlers, no new action semantics

Chip taps invoke callbacks supplied by `ArgumentRoom` (the orchestrator). No chip writes state; each reveals an existing in-app surface via an **in-app state jump** (never `Linking.openURL`, never a router — see the `inRoomNoRoute` pin):

| Chip | Deep-link | Reused existing behavior |
|---|---|---|
| `open_points` | `map` | `if (mode !== 'timeline') setMode('timeline')` — the exact behavior of the shipped `open_timeline` `RailActionCode` handler (`ArgumentRoom.tsx:1892`). `activeMessageId` is untouched, so selection is preserved across the switch (the shipped shared-selection invariant). |
| `receipts_owed` | `debts` | Reveal the existing on-demand Disagreement Points / evidence-debt surface (`DisagreementPointsRail`, summoned via the VISUAL-SIMPLIFY-002 col3 on-demand path). The implementer wires `onOpenDebts` to the existing summon handler. Documented fallback if no clean single summon handler exists: route to `map` (debt rings render on the timeline map). No new surface, no new code path. |
| `visibility` / `seat` | `details` | `onOpenRoomDetails()` — a callback threaded from App.tsx that toggles the existing `DebateDetailHeader` overflow/room-details panel (invite + make-private + seat strip already live there). Optional; when omitted the chip is informational (not pressable). |

The rail defines **no** new `RailActionCode` / `RoomActionCode` and does not touch `roomActionCodes.ts`. Capability parity across lenses is **structural**: the rail mounts once above the lens switch (the `topBanner` slot, § File changes), so the identical strip renders in both Exchange and Map — there is no per-lens capability gate to reconcile.

### 3. What the rail replaces vs. what stays — purely additive behind the flag

Per the issue non-goal and the Design Pass, the rail does **not** remove the score tracker, open-issues rail, mediator rail, or seat strip in this card. It is **additive behind `room_exchange_v2`**. Removing the legacy chrome is a later cleanup card (ROOM-002+). Justification: (a) removal would enlarge the blast radius into heavily-pinned surfaces (`uxOneOneSixViewportMatrix` Surface 6 asserts `<ArgumentScoreTracker` is present in `ArgumentRoom.tsx:323`); (b) additive-behind-flag makes the flag-off proof trivial (the rail subtree simply is not mounted — see decision 5); (c) the slice-05 mitigation in the Pivot plan explicitly keeps the old rails "collapsed behind the flag," removal deferred.

### 4. Turn-cue doctrine — informational, never a lock, never a verdict, no score

The cue is a **display projection of the already-derived awaited-reply state** (`RoomContractViewModel.turnLabel`), never an enforced turn-lock (anyone can post anytime — cf. Design Pass §5C "the spine is informational") and never a verdict. States map through a new additive `STATE_RAIL_COPY` block (neutral copy, ban-list scanned). **No score, standing band, winner/loser, heat, or popularity value appears on the rail.** The gallery's reserved preview fields (`voteScorePreview`, `winnerPreview`, …) stay unread — the same rule HOME-001 followed. Turn-state derivation (pure, in the model):

```
observer   ⟵ viewerRole === 'observer'  (or participantSide ∈ {observer, moderator, null})
your_turn  ⟵ turnLabel === 'Your move'
resting    ⟵ participant AND openPointCount === 0 AND turnLabel !== 'Your move'
waiting    ⟵ otherwise (a live point exists / another side's move / respondent seat open)
```

`resting` uses the "nothing open, not your move" rule — an orchestrator default (no explicit `resting` state exists in `roomContractModel`); recorded in § Interpretive decisions for operator review.

### 5. Flag wiring — App.tsx reads `room_exchange_v2`, threads a boolean prop (NO feature-tree import, NO pin relaxation)

The rail rides `room_exchange_v2` (default OFF). **Decision: Option A — App.tsx (the shell/nav seam) reads `isRoomExchangeV2Enabled()` and threads a boolean prop down.** This matches the HOME-001 / START-001 precedent verbatim ("No new featureFlags importer — App.tsx sole consumer") and keeps **both** `featureFlagsStaticEnv` pins green with **zero relaxation**:

- `App.tsx` reads the flag exactly like line 563's `const homeV2Enabled = isHomeV2Enabled();` → add `const roomExchangeV2Enabled = isRoomExchangeV2Enabled();`.
- The flag import MUST be a **separate import line** — see the #1 landmine in the Pin-relaxation inventory (merging accessors into the existing `{ isHomeV2Enabled }` import breaks a regex pin).
- The boolean threads `App.tsx → ArgumentTreeScreen → ArgumentGameSurface(alias) → ArgumentRoom` as an additive optional prop. `ArgumentGameSurface.tsx` is a 20-line re-export alias (`export { ArgumentRoom as ArgumentGameSurface }`), so it needs **no change** — the prop flows straight into `ArgumentRoom`'s `Props`.
- **No file under `src/features` or `src/components` imports `featureFlags`** — the `featureFlagsStaticEnv:98-109` doctrine pin stays green.

Flag-off proof strategy: when `roomExchangeV2Enabled` is falsy, `ArgumentRoom` renders the `topBanner` exactly as today (the microMoment banner alone). The rail subtree is simply not mounted → zero visual diff, and every existing suite is untouched-green. Considered alternative **Option B** (ArgumentRoom reads the flag directly) was rejected: it forces a relaxation of the `featureFlagsStaticEnv:98-109` doctrine pin ("feature tree must never couple to global env state") and breaks the established precedent, for no blast-radius saving now that `ArgumentGameSurface` is a zero-cost alias.

### 6. Slices

- **S1 — pure model + unit matrix.** `argumentStateRailModel.ts` + `argumentStateRailModel.test.ts`. All four turn states, open/owed counts, visibility variants, seat states, overflow `+N`, reserved-slot-renders-nothing, ban-list. No UI, no wiring. Green in isolation.
- **S2 — the view.** `ArgumentStateRail.tsx` (presentational, consumes the model) + `ArgumentStateRail.test.tsx` (RNTL: both-lens parity by mount, deep-link callback wiring, a11y roles/labels/state, color-independence, 390px 3-chips+scroll, reduce-motion). Plus additive `STATE_RAIL_COPY` in `gameCopy.ts` + its ban-list assertion.
- **S3 — mount behind the flag.** App.tsx flag read + prop thread; `ArgumentTreeScreen` + `ArgumentRoom` Props additions; mount in the `topBanner` slot; wire the three deep-link callbacks to existing handlers; flag-off proof test.

### 7. Non-goals (restated, load-bearing)

No saved-recording data (slot reserved, renders nothing); no removal of the mediator/score/seat chrome; no Map legend changes; no Edge/migration/query/write; no ROOM-002 exchange re-weight; no new `RailActionCode`; no chime-in / watching counts sourced (deferred — no in-room data, see scope-reality audit); no take-seat / chime-in actions (the rail shows seat state, acting on it is other cards).

---

## Scope-reality audit (REQUIRED)

This card's success depends on **current data availability in the room render path**. A pre-launch trace (over `oneToOneRoomModel.ts`, `roomContractModel.ts`, `useRoomContract.ts`, `useActiveParticipantCount.ts`, `publicSeatModel.ts`, and the App.tsx room mount) surfaced that the brief's seat/voices AC assumes data that is **not loaded**:

**The current data chain (what is actually derived in the room render path):**

| Rail need | Actual in-room source | Available with no new query? |
|---|---|---|
| Turn cue | `roomContract.viewModel.turnLabel` — already built by `useRoomContract` in **App.tsx:837-843**, passed to `DebateDetailHeader` | ✅ yes |
| Open points count | `mediatorBoard.points` — derived once in **ArgumentRoom.tsx:816** | ✅ yes |
| Receipts owed count | `evidenceDebts` — derived in **ArgumentRoom.tsx:767** | ✅ yes |
| Visibility (public/private) | `currentDebate.visibility` — already loaded in App.tsx | ✅ yes |
| Respondent-seat-open vs 2-principals | `roomContract.viewModel.opponentSeat.isOpen` — already in App.tsx | ✅ yes |
| **N-of-3 chime-in count** | `PublicRoomSeatMap.openChimeInSeatCount` — `buildPublicRoomSeatMap` is **never invoked** in shipped code; the seat map is not mounted in-room | ❌ **NO — would require a new query** |
| **Watching / observer count** | No such scalar is loaded anywhere; `useActiveParticipantCount` returns only the 0-2 active count (`.neq('side','observer')`), no observer count | ❌ **NO — would require a new query** |

**Hard blocker:** the "N-of-3 chime-ins" and "watching count" pieces of the #681 seat AC conflict with the hard "no new Supabase query / read-only proven by test" AC. The `oneToOneRoomModel.ts` header comment and the issue both assume these come "from `oneToOneRoomModel` output," but that model **derives no counts** — it maps a `RoomOneToOneDisplayInput` (which itself needs `openChimeInSeatCount` fed in) to a display-state enum, and it is currently **dead-except-tested** (no screen calls it).

**Recommended scope correction (adopted by this design):**

- The seat/visibility segment renders the **no-new-query subset**: `Public 1:1` / `Private 1:1` (gold when private), and respondent-seat-open vs 2-principal-voices — all from `RoomContractViewModel` + `currentDebate.visibility`, both already in App.tsx scope.
- The **chime-in count and watching count are RESERVED** as optional model inputs (`openChimeInSeatCount?`, `watchingCount?`) that render **nothing** when absent — the identical pattern to `savedRecordingCount`. When a future data-mount card wires `buildPublicRoomSeatMap` / an observer-count read (a legitimately new query, out of ROOM-001's read-only scope), it passes these and the chips light up with no rail change.
- The rail's display-state label MAY be driven by `deriveRoomOneToOneDisplayState` / `buildRoomOneToOneViewModel` with `openChimeInSeatCount` **omitted** (they degrade to `public_principal_voices_established` / `observer_reading`, no chime state, no query). This makes `oneToOneRoomModel` the rail's first real consumer while honoring the no-query rule.

**Effort:** unchanged (M). The correction narrows what renders; it does not add work.

**#681 absorption is therefore PARTIAL and honest** — see the #681 checklist below.

---

## File changes

### New files

- `src/features/arguments/room/argumentStateRailModel.ts` (~140-180 lines) — pure model: types above + `deriveArgumentStateRail`. **No** import of Supabase, `deriveMediatorBoardState`/`deriveRoomMediatorBoardState`, `evidenceDebtModel` derivers, React. May import the `STATE_RAIL_COPY` block from `gameCopy` for labels. Comments **apostrophe-free** if the file is added to the doctrine scan set (see Pin inventory).
- `src/features/arguments/room/ArgumentStateRail.tsx` (~180-240 lines) — presentational RN component. Props: `{ model: ArgumentStateRailModel; onOpenMap?: () => void; onOpenDebts?: () => void; onOpenRoomDetails?: () => void; reduceMotion?: boolean; testID?: string }`. Horizontal `ScrollView` of chips; each interactive chip is a `Pressable` (44px target via `minHeight`/`hitSlop`), `accessibilityRole="button"`, label + `accessibilityState`. Informational chips (visibility when no `onOpenRoomDetails`) are non-pressable `View`s with a text label. Gold-private treatment via a file-local style token (existing private badge is slate; gold is new — additive). Comments apostrophe-free if added to the doctrine scan set.
- `__tests__/argumentStateRailModel.test.ts` — model matrix (see Test plan).
- `__tests__/ArgumentStateRail.test.tsx` — component/RNTL (see Test plan).

### Modified files

- `src/features/arguments/gameCopy.ts` (+~14 lines) — new additive `STATE_RAIL_COPY = Object.freeze({...})` block: turn-cue labels (`turn_your_move`, `turn_waiting`, `turn_resting`, `turn_observer`), `open_points_label`, `receipts_owed_label`, `overflow_more` (`+{n}`), and reuse `ROOM_ONE_TO_ONE_COPY` for `Public 1:1` / `Private 1:1`. No `evidence_debt` raw code; no verdict tokens. (This is the block the extended gameCopy ban-list scans, per the START-001 precedent.)
- `App.tsx` (+~6 lines) — (a) add a **separate** `import { isRoomExchangeV2Enabled } from './src/lib/featureFlags';` line (do NOT merge into the `{ isHomeV2Enabled }` import — landmine #1); (b) `const roomExchangeV2Enabled = isRoomExchangeV2Enabled();`; (c) pass `roomExchangeV2Enabled`, `roomContract={roomContract.viewModel ?? null}` (or a bundled `stateRailContext`), `roomVisibility={currentDebate.visibility}`, and `onOpenRoomDetails` to `<ArgumentTreeScreen>` (line ~1178). All additive props; no reordering of existing mounts/props (preserve `<ArgumentTreeScreen … entryHint={entryHint}` marker + dock order).
- `src/features/arguments/ArgumentTreeScreen.tsx` (+~8 lines) — add the same optional props to `Props`, destructure them in the signature (line 118), and forward them verbatim onto `<ArgumentGameSurface … />` (line 545). Pure pass-through; do not add the token `inactiveReason` (unrelated ban pin).
- `src/features/arguments/room/ArgumentRoom.tsx` (+~30-45 lines, smallest possible diff) —
  - Add the optional props to `Props` (line 302) + destructure (line 480): `roomExchangeV2Enabled?: boolean`, `roomContract?: RoomContractViewModel`, `roomVisibility?: 'public' | 'private'`, `onOpenRoomDetails?: () => void`.
  - Compute `const openPointCount = mediatorBoard.points.filter(p => p.state !== 'resolved_or_settled').length;` and `const receiptsOwedCount = getRoomEvidenceDebtSummary(debate.id, evidenceDebts).openCount;` (or reuse the existing `getRoomEvidenceDebtSummary` import if present) — both read the already-derived board/debts; **no second `deriveRoomMediatorBoardState(` call**.
  - `const stateRailModel = useMemo(() => deriveArgumentStateRail({ viewerRole: resolvedViewerRole, participantSide, turnLabel: roomContract?.turnLabel ?? null, visibility: roomVisibility ?? 'private', opponentSeatIsOpen: roomContract?.opponentSeat.isOpen ?? false, openPointCount, receiptsOwedCount }), [...]);`
  - Add a small `handleOpenMapFromRail = () => { if (mode !== 'timeline') setMode('timeline'); };` (mirrors the `open_timeline` handler at line 1892) and wire `onOpenDebts` to the existing Disagreement Points summon (or the map fallback).
  - Mount in the `topBanner` slot, composed with the existing microMoment JSX:
    ```tsx
    topBanner={
      <>
        {roomExchangeV2Enabled ? (
          <ArgumentStateRail
            model={stateRailModel}
            onOpenMap={handleOpenMapFromRail}
            onOpenDebts={handleOpenDebtsFromRail}
            onOpenRoomDetails={onOpenRoomDetails}
            reduceMotion={reduceMotionOverride}
          />
        ) : null}
        {/* existing microMoment conditional — UNCHANGED */}
        {entryHint?.verbPhrase && !microMomentDismissed ? ( … ) : null}
      </>
    }
    ```
    The `RoomBoardLayout` `topBanner` slot renders above the board body in **all** bands (phone/tablet/wide — `RoomBoardLayout.tsx:87,106,139`), so the strip is atop the room in both lenses with no `RoomBoardLayout` API change. The existing `argument-micro-moment` testID + `microMomentDismissed` flag + render condition are preserved verbatim (satisfies `uxOneOneTwoMicroMomentDismiss`).

### Deleted files

None.

---

## API / interface contracts

**`deriveArgumentStateRail`** — signature in Data model. Pure, deterministic, JSON-serializable in/out.

**`ArgumentStateRail` props:**
```ts
interface ArgumentStateRailProps {
  model: ArgumentStateRailModel;
  onOpenMap?: () => void;          // open_points chip → in-app setMode('timeline')
  onOpenDebts?: () => void;        // receipts_owed chip → reveal debt/points surface
  onOpenRoomDetails?: () => void;  // visibility/seat chip → App.tsx room-details panel
  reduceMotion?: boolean;
  testID?: string;                 // default 'argument-state-rail'
}
```

**Threaded props (additive-optional on `ArgumentTreeScreen.Props` and `ArgumentRoom.Props`):**
```ts
roomExchangeV2Enabled?: boolean;             // flag, read in App.tsx only
roomContract?: RoomContractViewModel;        // from useRoomContract (App.tsx), carries turnLabel + opponentSeat.isOpen
roomVisibility?: 'public' | 'private';       // currentDebate.visibility
onOpenRoomDetails?: () => void;              // App.tsx toggles DebateDetailHeader overflow/details
```
(The implementer may bundle `roomContract` + `roomVisibility` + `onOpenRoomDetails` into one `stateRailContext?` object to keep the Props surface small; either shape is additive-safe.)

**Reused, unchanged:** `RoomContractViewModel` (`roomContractModel.ts:453` — `turnLabel: string | null`, `opponentSeat.isOpen`, `roomTypeLabel`), `getRoomEvidenceDebtSummary` (`evidenceDebtModel.ts:663`), `MediatorBoardState.points[].state` (`mediatorBoardTypes.ts`), `ROOM_ONE_TO_ONE_COPY` / `ROOM_CONTRACT_COPY` labels, `setMode`/`mode` internal state (`ArgumentRoom.tsx:542`), the `open_timeline` behavior (`ArgumentRoom.tsx:1892`), `RoomBoardLayout.topBanner`.

No Edge Function, no RLS, no SQL.

---

## Edge cases

- **Empty room / not opened yet:** `turnLabel === null` (room not opened) → turn state resolves `resting` for a participant (openPointCount 0) or `observer`; `openPointCount === 0` → the `open_points` chip is suppressed (`isVisible:false`); `receiptsOwedCount === 0` → `receipts_owed` chip suppressed. The strip degrades to `[turn, visibility]` at minimum.
- **Observer viewer:** turn state `observer`; deep-link callbacks may be observer-safe no-ops; visibility/seat chips still render (read-only), consistent with observer-first doctrine.
- **Board null / mid-load:** if `mediatorBoard`/`evidenceDebts` are momentarily empty, counts are 0 → chips suppressed; no crash (model guards `Array.isArray`).
- **Respondent seat open (public, no opponent):** `opponentSeatIsOpen === true` → seat chip reads "Respondent seat open"; turn state `waiting`.
- **Private room:** visibility chip is `Private 1:1`, gold tone; no observer/watching/chime affordance rendered at all (absence, not a disabled control — matches the one-to-one doctrine); `openChimeInSeatCount`/`watchingCount` inputs ignored.
- **Overflow (> 3 visible chips):** e.g. `[turn, open_points, receipts_owed, visibility, seat]` (5) → 3 inline + `+2` + horizontal scroll; the strip's own `ScrollView` scrolls, the page body never scrolls horizontally.
- **Reserved slots absent/zero:** `savedRecordingCount`/`openChimeInSeatCount`/`watchingCount` omitted or 0 → those chips are `isVisible:false` and render nothing (AC).
- **Concurrent edits / new message arrives:** the rail re-derives via `useMemo` when `mediatorBoard`/`evidenceDebts`/`turnLabel` change — a pure re-render, no write, no race (read-only projection).
- **Offline / network failure:** N/A — the rail issues no network. It renders whatever the in-memory (possibly stale) board holds; no error surface needed.
- **Permission-denied:** N/A — no privileged action; the rail cannot change visibility or seats (doctrine — the one-way `roomVisibilityModel` rule is untouched; the visibility chip only reveals the existing details panel).
- **Doctrine edge — "what if heat/popularity tries to influence a chip?":** it cannot — the only inputs are structural (point states, debt counts, turn label, visibility, seat). No `standingBand`/`toneBand`/`temperatureBand`/engagement input exists in the contract. The mediator board itself refuses those inputs (`mediatorBoardTypes.ts` doctrine §2).
- **Doctrine edge — turn cue read as an enforced lock:** copy is neutral and informational; the model never blocks; posting is always available (the deterministic engine is the sole gate). Recorded as an interpretive default.

---

## Test plan

- `__tests__/argumentStateRailModel.test.ts` (S1) — fixture-driven:
  - all four turn states (`observer` / `your_turn` / `resting` / `waiting`) across the derivation table;
  - `openPointCount` / `receiptsOwedCount` → correct `open_points` / `receipts_owed` chip visibility + labels; zero suppresses;
  - visibility variants (`public` → `Public 1:1` neutral; `private` → `Private 1:1` gold tone);
  - the seat states available with no new query (respondent-seat-open vs 2-principal-voices);
  - overflow: 4+ chips → exactly 3 `visibleChips` + `overflowCount` = remainder;
  - reserved slots: `savedRecordingCount`/`openChimeInSeatCount`/`watchingCount` absent or 0 → chip `isVisible:false`;
  - **read-only source scan** (mirrors the single-derivation scan idiom): assert `argumentStateRailModel.ts` source contains no `supabase`, no `.from(`, no `fetch(`, no `.insert(/.update(/.delete(/.upsert(`, and does **not** match `deriveMediatorBoardState|deriveRoomMediatorBoardState`.
- `__tests__/ArgumentStateRail.test.tsx` (S2) — RNTL:
  - renders identically regardless of lens (parity is structural — assert the same chip set from the same model props);
  - deep-link callback wiring: tapping `open_points` calls `onOpenMap`; `receipts_owed` calls `onOpenDebts`; `visibility` calls `onOpenRoomDetails`; **no state write on tap** (callbacks are the only effect);
  - accessibility: every interactive chip has `accessibilityRole="button"` + label + `accessibilityState`; 44px target;
  - color-independence: chip meaning legible via glyph/text with color neutralized (grayscale check);
  - 390px: 3 chips inline + `+N` + horizontal scroll in the strip container (body no horizontal overflow);
  - reduce-motion: no non-essential animation when `reduceMotion` true.
- `__tests__/argumentStateRailCopy.test.ts` (S2) — **verdict-token ban** over every `STATE_RAIL_COPY` string (same pattern as the message-qualifier vocabulary / `copySystemBanList` tests): no `winner/loser/correct/incorrect/liar/dishonest/bad faith/manipulative/extremist/propagandist/stupid/idiot/truth`, no snake_case internal code (no raw `evidence_debt`).
- `__tests__/argumentStateRailFlagOff.test.tsx` (S3) — **flag-off proof**: with `roomExchangeV2Enabled` falsy/absent, `ArgumentRoom`'s `topBanner` renders only the microMoment (no `argument-state-rail` testID present); the surface is unchanged.
- **No-writes / no-new-queries proof** — covered by the model read-only source scan above **and** an `ArgumentRoom` source assertion that the rail wiring adds no `deriveRoomMediatorBoardState(` call (the single-derivation count stays 1) and no `.from(`/`.insert(` in the new wiring.
- **Expected delta vs baseline (914 suites / 33078 tests):** ~+4 suites (`argumentStateRailModel`, `ArgumentStateRail`, `argumentStateRailCopy`, `argumentStateRailFlagOff`) / ~+45-60 tests. All existing suites stay green with **zero pin relaxations** (see Pin inventory). Test count goes up, never down.

---

## Pin-relaxation inventory (REQUIRED)

A full sweep of `__tests__` for every suite that `readFileSync`-scans or byte-equal-pins `App.tsx`, `ArgumentTreeScreen.tsx`, `room/ArgumentRoom.tsx`, or the `room/` dir. **Headline: zero boundary-suite relaxations are required.** The issue anticipated relaxing `uxOneOneFive/Six ReadOnlyBoundary` and `uxOneOneTwoDoctrine`; the reality is that all three are additive-safe as written. The real budget is **four conditions the implementation must honor**, not test edits.

| Suite | Scan type | Targets | Verdict |
|---|---|---|---|
| `uxOneOneFiveReadOnlyBoundary.test.ts` | byte-equal `git diff main` → `''` | composer/timeline/popout files only — **none of ours** | **ADDITIVE-SAFE** — App.tsx/ArgumentRoom/ArgumentTreeScreen/`room/` are NOT in `READ_ONLY_PATHS`. No relaxation. |
| `uxOneOneSixReadOnlyBoundary.test.ts` | contains-`requiredApi` (explicitly NOT byte-equal) | `App.tsx` (`roomActive`, `testID="app-tab-bar"`), `room/ArgumentRoom.tsx` (`['ArgumentRoom','Props']`); file-count floor ≥52 | **ADDITIVE-SAFE** — required symbols survive additive edits; new files can't trip a floor. |
| `uxOneOneTwoDoctrine.test.ts` | ban-substring in string literals | `App.tsx` + `room/ArgumentRoom.tsx` (also MapView/ExchangeView/roomActionCodes) | **ADDITIVE-SAFE, doctrine-conditional** — any new rail string in these files must avoid verdict tokens and the raw `evidence_debt` code (route through plain language). **Optional hygiene:** add the two new `room/` files to `UX_001_2_FILES` (additive scan extension, not a relaxation) — if done, their comments MUST be apostrophe-free (the naive quote-parity STRING_RE gotcha). |
| `featureFlagsStaticEnv.test.ts:98-109` | import-guard (`no featureFlags import under src/features\|components`) | whole feature tree incl. both new files | **ADDITIVE-SAFE iff Option A** — flag threaded as a prop; no feature-tree `featureFlags` import. No relaxation. |
| `featureFlagsStaticEnv.test.ts:112-117` | exact-regex on App.tsx import | `App.tsx` | **LANDMINE (no relaxation needed if avoided)** — the regex pins `import { isHomeV2Enabled } from …` exactly. Add `isRoomExchangeV2Enabled` on a **separate import line** (repo has no `no-duplicate-imports` lint). Merging into `{ isHomeV2Enabled }` → RED. |
| `uxBoardRail002Topology.test.tsx:288`, `uxBoardRail004BottomChrome.test.tsx:240`, `visualSimplify002AnalysisOnDemand.test.tsx:279`, `uxFeedback001ProgressNote.test.tsx:245` | source-scan `deriveRoomMediatorBoardState(` count `=== 1` | `room/ArgumentRoom.tsx` | **ADDITIVE-SAFE, house-rule-conditional** — rail consumes `mediatorBoard`; keep exactly one `deriveRoomMediatorBoardState(` call; the model must not import/call it. |
| `inRoomNoRoute.test.ts:207-211`, `timelineReadoutNoRoute.test.ts` | ban `Linking.openURL` / nav-lib in ArgumentRoom.tsx | `room/ArgumentRoom.tsx` | **ADDITIVE-SAFE, conditional** — deep-link callbacks are in-app state jumps (`setMode`, summon handler), never `Linking.openURL`/router. |
| `requestReviewFlagsConventions.test.ts` | ban `.insert(/.update(/.delete(/.upsert(` + `.from('argument_flags')` | `room/ArgumentRoom.tsx` | **ADDITIVE-SAFE** — rail is read-only; zero DB writes. |
| `uxOneOneTwoAppSafeguard.test.ts` | contains mounts + ban router/AI/Modal imports | `App.tsx`, `room/ArgumentRoom.tsx` | **ADDITIVE-SAFE** — `featureFlags` import is not a router import; no Modal/AI added. Preserve `<ArgumentTreeScreen` mount. |
| `oneToOneRoomModel.test.ts:354,362,413` | ban `POINT_SCOPED_CHIME_IN_COPY` in App.tsx + ArgumentRoom.tsx; check App.tsx `useRoomContract` wiring | `App.tsx`, `room/ArgumentRoom.tsx` | **ADDITIVE-SAFE** — reinforces the scope-reality decision to keep chime-in copy dormant (do NOT surface `POINT_SCOPED_CHIME_IN_COPY`). |
| `uxOneOneSixViewportMatrix.test.ts` (Surface 6) | contains `<ArgumentScoreTracker` in ArgumentRoom.tsx | `room/ArgumentRoom.tsx` | **ADDITIVE-SAFE** — reinforces decision 3: keep the legacy score tracker mounted (additive rail only). |
| ~35 other App.tsx / ArgumentRoom.tsx / ArgumentTreeScreen.tsx contains/mount-order scanners (`argumentGameSurfaceSemanticWiring`, `argumentGameSurfaceDockComposerWiring`, `composerDockInRoom`, `composerDockPresetWiring`, `linkTargetPickerModel`, `argumentInactiveLeakageScan`, `uxOneOneTwoChromeLayerRemovals`, `uxBoardReadability001`, `uxSelectedNode001CenterOfRoom`, `timeline*`, `*MountSite`, etc.) | contains / index-order | our three files | **ADDITIVE-SAFE** — new optional props + a new `<ArgumentStateRail>` mount preserve every asserted token and ordering. |
| `mcpOneTwoOneBReadOnlyBoundary.test.ts` (RO-23/24/26 byte-equal-pin existing test files `uxOneOneSixTouchTargets/ColorIndependence/Doctrine`) | byte-equal on those **test** files | not our files | **ADDITIVE-SAFE** — do NOT edit those existing test files when adding rail coverage; add NEW test files instead. |

**Room dir count guard:** none. No suite `readdirSync`-counts `src/features/arguments/room/*.tsx` (the only `readdirSync` counters target `supabase/migrations` `.sql`). The two new `room/` files trip no counter.

**Net pin budget: 0 test relaxations.** Four implementation conditions (separate flag import line; prop-threaded flag; single `deriveRoomMediatorBoardState(` preserved; in-app deep-links only) + doctrine-clean copy + apostrophe-free comments (if new files are added to the doctrine scan set) are the entire "budget."

---

## Dependencies (cards / docs / files)

- **Depends on:** ASP-EXTRACT-001 (#864, shipped) — the `room/ArgumentRoom.tsx` orchestrator + `ExchangeView`/`MapView` lenses + `RoomBoardLayout` exist on `main` (base `ec336ec`). Reads the single-derived `mediatorBoard` (`ArgumentRoom.tsx:816`) and `evidenceDebts` (`767`).
- **Depends on:** ASP-FLAGS-001 (#873, shipped) — `isRoomExchangeV2Enabled()` already exists (`featureFlags.ts:96`).
- **Reads existing:** `roomContractModel.buildRoomContractViewModel` (via `useRoomContract`, App.tsx), `evidenceDebtModel.getRoomEvidenceDebtSummary`, `mediatorBoardTypes.MediatorBoardState`, `gameCopy.ROOM_ONE_TO_ONE_COPY`/`ROOM_CONTRACT_COPY`, `RoomBoardLayout.topBanner`.
- **Absorbs:** #681 — **partially** (see checklist). Recommend closing #681 as "absorbed into ROOM-001 (visibility + principal-voices shipped; watching/chime counts deferred to a data-mount follow-up)."
- **Blocks / feeds:** ROOM-002 / ROOM-003 (Exchange re-weight consume the same flag + rail); P4 `derivedObservationSignals.ts` (StateRail is a named consumer); P5-6 voice (the reserved `savedRecordingCount` chip, gated on VOICE-ADR-002).
- **Not blocked by** VOICE-ADR-002 — the reserved recording slot renders nothing until ratification.

### #681 absorption checklist (honest)

- [x] Visibility badge PUBLIC 1:1 / PRIVATE 1:1 — shipped (gold-private is new styling).
- [x] Respondent seat open vs two principal voices — shipped (from `RoomContractViewModel.opponentSeat.isOpen`).
- [x] Private rooms never show observer/chime counts — shipped (absence, not a disabled control).
- [ ] Watching (observer) count — **DEFERRED** (no in-room source; rendering = new query, out of scope). Reserved as `watchingCount?`.
- [ ] N-of-3 chime-in count / seats-full — **DEFERRED** (no in-room source; `buildPublicRoomSeatMap` unmounted). Reserved as `openChimeInSeatCount?`.
- [x] Tablet/desktop header presence — the rail renders in all bands via `topBanner`.

---

## Risks

- **`ArgumentRoom.tsx` is a ~3238-line orchestrator** — keep the diff minimal (props + two count computations + one `useMemo` + one `topBanner` composition + two small handlers). Do not refactor surrounding code. Anchor drift risk: the `topBanner` and mediator-board `useMemo` line numbers cited here are from base `ec336ec`; the implementer should anchor by symbol (`topBanner={`, `deriveRoomMediatorBoardState(`, `entryHint?.verbPhrase && !microMomentDismissed`) not by line number.
- **The single-derivation house rule** is enforced by four source-scans (`=== 1`). The rail must consume `mediatorBoard`; never add a second `deriveRoomMediatorBoardState(` and never import the deriver into the model/component. This is the top correctness risk.
- **Landmine #1 — the flag import line** — merging `isRoomExchangeV2Enabled` into the existing `{ isHomeV2Enabled }` import turns `featureFlagsStaticEnv.test.ts:112-117` red. Separate import line only.
- **Deep-link `Linking.openURL` ban** — the `receipts_owed` / `open_points` deep-links must be in-app state (`setMode`, summon handler), or `inRoomNoRoute.test.ts` goes red.
- **Doctrine scanner apostrophe gotcha** — if the two new `room/` files are added to `uxOneOneTwoDoctrine`'s `UX_001_2_FILES` (recommended hygiene), a single apostrophe in ANY comment poisons the file-wide quote-parity STRING_RE and flags innocent comments. Keep new-file comments apostrophe-free and run the doctrine suite pre-push. (The turn/1:1 copy strings themselves — "Other voice's move", "You are watching." — live in `gameCopy.ts`, which is not in that scan set, so their apostrophes are fine.)
- **Aggregate-count drift with the Map legend** — the StateRail `openPointCount` and the `DisagreementPointsRail` count must stay identical (Design Pass §9). They use the same rule (`p.state !== 'resolved_or_settled'`), but `selectLivePoints` is currently **private** to `DisagreementPointsRail.tsx:144`. Preferred no-drift option: export a tiny pure `countLiveDisagreementPoints(board)` from the mediator index and use it in both places — but that edits the pinned `DisagreementPointsRail.tsx`. Shipped fallback (lower blast radius): ArgumentRoom computes the count inline with the identical rule + a unit test asserting parity against the rule. Recommend the fallback for ROOM-001; note the export as a follow-up cleanup.
- **`RoomContractViewModel` availability** — the rail's turn cue + seat state depend on `roomContract.viewModel` being non-null. `useRoomContract` can return null transiently; the model must default gracefully (turn `observer`/`resting`, seat chip suppressed) — covered by the empty-input edge case.
- **No existing web-build step in CI** — asset/bundle regressions aren't caught by jest. This card adds no assets and no dynamic env read, so the risk is low, but the implementer should run `npm run web:build` (exit 0) as the START-001 precedent did, since App.tsx + a feature component change reaches the Netlify bundle.

---

## Out of scope

- Removing the legacy score tracker / open-issues rail / mediator rail / seat strip (later cleanup card).
- Any Map legend change (the DisagreementPointsRail docks as the Map legend in a later phase).
- Sourcing the watching count or N-of-3 chime-in count (needs a new query — a data-mount follow-up card).
- Saved-recording data (slot reserved; renders nothing; gated on VOICE-ADR-002 / P5-6).
- Take-seat / chime-in / make-private actions (the rail shows state; acting on it is other cards; the one-way `roomVisibilityModel` rule is untouched).
- Exchange lens re-weighting / one-bar composer (ROOM-002 / ROOM-003).
- Any new `RailActionCode` / `RoomActionCode`, any Edge Function, migration, or RLS.
- Per-person scores, leaderboard, heat/popularity counters.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; no service-role):** the rail carries no winner/loser/correct/true/false; strength bands / standing are never shown; it never gates submission (the deterministic engine is the sole gate); it is a pure client view over props — no service-role, no keys, no Edge call, no `.env` read. Copy is ban-list scanned.
- **cdiscourse-doctrine §2 (heat = activity, not truth) & §3 (popularity ≠ evidence):** the rail's only inputs are structural (point states, debt counts, turn label, visibility, seat). No `standingBand`/`toneBand`/`temperatureBand`/engagement input exists in the contract; the mediator board it reads already refuses those inputs. The only audience number the brief wanted (watching count) is **deferred**, and even when added it is a neutral presence count, never velocity/virality (anti-amplification).
- **cdiscourse-doctrine §4 (AI advisory only):** the rail renders counts of open points and owed receipts — never an authoritative flag or a correctness verdict. Mediator inputs include persisted advisory observations only; nothing here decides who is right.
- **cdiscourse-doctrine §9 (plain language):** all copy routes through `STATE_RAIL_COPY` / existing plain-language blocks; no internal code (`evidence_debt`, `resolved_or_settled`, …) appears in a user-facing string; unknown codes are suppressed.
- **point-standing-economy ("mark the point, not the person"):** chips count points and receipts owed **on the argument**, never per-person standing; no leaderboard; the "one credit per debt" / concession economy is untouched (the rail reads the debt ledger, never writes it). Verdict-token ban enforced by test.
- **point-standing-economy (bands are gameplay, not truth):** no band/percentage/ordinal is shown on the rail — the aggregate is a count, not a score.
- **accessibility-targets:** 44px chip targets (visual or `hitSlop`); role/label/state on every Pressable; color never the only signal (glyph/text carries meaning; grayscale-legible); reduce-motion parity; 390px → 3 chips + horizontal scroll in the strip's own container.
- **Deterministic engine sole gate:** the rail touches nothing in `src/domain/constitution/engine.ts`; it never gates, delays, or routes a post.
- **Private-by-default:** the visibility badge reads room state and cannot change visibility; the one-way public→private rule (`roomVisibilityModel`, no `canTransitionToPublic`) is untouched.

---

## Interpretive decisions / operator-review

This design is authored from operator-filed issue #876. Where the design resolved ambiguity by orchestrator default, it is recorded here for operator review post-ship:

1. **Scope correction (chime-in + watching counts deferred).** The seat/voices AC's "N-of-3 chime-ins" and "watching count" have no in-room data source; rendering them = a new query, which the hard read-only AC forbids. Design renders the no-new-query subset and reserves the counts as optional inputs. **Operator: confirm the deferral** (vs. broadening ROOM-001 to add a seat-map/observer-count read, which would make it a query-bearing card).
2. **`resting` turn-state definition.** No `resting` state exists in `roomContractModel`; default rule = "participant + zero live points + not your move." **Operator: confirm** this reads correctly against the "Peace treaty-ish · resting" gallery notion, or supply a preferred rule.
3. **Deep-link targets.** `open_points → map (setMode timeline)`, `receipts_owed → existing Disagreement Points/debt summon (map fallback)`, `visibility/seat → App.tsx room-details panel`. **Operator/implementer: confirm** the exact debt-surface summon handler in ArgumentRoom (VISUAL-SIMPLIFY-002 on-demand col3); if none is cleanly reachable, the documented `map` fallback applies.
4. **Flag Option A (App.tsx reads, threads a prop).** Chosen for precedent + zero pin relaxation. Recorded so the operator knows the room now receives `roomContract` + visibility + a details callback from the shell.
5. **Gold-private treatment is new styling** (existing badge is slate). Additive file-local token; **operator: confirm** the gold shade against the brand token system (`designTokens.ts` `BRAND.accent.gold*`).

---

## Operator steps (if any)

**None to deploy — pure code change** (no migration, no Edge Function, no secret). To turn the surface **ON** after merge: set `EXPO_PUBLIC_ROOM_EXCHANGE_V2=true` and rebuild/publish the web bundle (the same mechanism as `EXPO_PUBLIC_HOME_V2`). Rollback = unset the env var + rebuild. Default OFF means merging changes zero live surfaces.
