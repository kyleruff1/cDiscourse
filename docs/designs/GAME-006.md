# GAME-006 — Jump Branch: once-per-room cross-branch participation

**Status:** Design draft
**Epic:** Rules UX (PvP argument-game roadmap expansion)
**Release:** 6.7
**Priority / Effort:** P2 / M
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/144
**Branch:** `feat/GAME-006-game-006-jump-branch-once-per-room-cross`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\GAME-006.md`

**Depends on (status verified against the repo at the head of this worktree — Stage 6.4 complete):**
- **GAME-004** (1v1 PvP room contract + Primary Opponent, #141) — MERGED. Model at `src/features/debates/roomContractModel.ts`. Owns `RoomContract`, `RoomType`, `PrimarySeat`, `RoomArgumentInput`, `RoomParticipantInput`, `QualifyingResponseSignals`, `isQualifyingResponse`, `explainQualifyingResponse`, `buildRoomContract`, `resolvePrimaryOpponent`. Design: `docs/designs/GAME-004.md`.
- **GAME-005** (public-room participant seats + chime-in governance, #142) — MERGED. Model at `src/features/debates/publicSeatModel.ts`. Owns `SeatRole` (`initiator | primary_opponent | chime_in`), `PublicSeat`, `ChimeInStanding`, `PublicRoomSeatMap`, `MovedToObserverRecord`, `ObserverFallbackReason`, `PUBLIC_ROOM_SEAT_CAP`, `buildPublicRoomSeatMap`, `canApplyGovernanceReaction`, `evaluateChimeInStanding`. UI at `ChimeInGovernanceControl.tsx` / `PublicRoomMetricsStrip.tsx`; hook `useChimeInGovernance.ts`. Design: `docs/designs/GAME-005.md`. **Jump Branch is a public-room participant action that builds directly on this seat model.**
- **BR-004** (branch grammar: mainline / vertical chime-in / diagonal tangent, #143) — MERGED. Model at `src/features/arguments/branchGrammarModel.ts`. Owns `BranchDirection` (`mainline | chime_in_vertical | tangent_diagonal | evidence_passthrough`), `BranchGrammarNode`, `buildBranchGrammarMap`, `CollapsedBranchSummary`, `branchDirectionLabel`. Design: `docs/designs/BR-004.md`. **GAME-006 consumes BR-004's branch identity / grammar; it does NOT redesign branch visuals.**
- **IX-004** (timeline selected-message readout, #135) — MERGED. `src/features/arguments/timelineSelectedReadoutModel.ts` + `TimelineSelectedReadoutPanel.tsx`. GAME-006's arrival display may surface near this panel; GAME-006 references it and does not redesign it.

---

## §0 — Card-vs-reality discrepancies (read this first)

The card body names symbols, file paths, and shapes that were checked against the actual repo at the head of this worktree. Where the card and reality disagree, **the design follows reality** — the same discipline GAME-004 §0, GAME-005 §0, and BR-004 §0 all applied.

| # | Card / coordinator brief says | Reality | Design decision |
|---|---|---|---|
| D1 | "Place GAME-006's model consistently with where GAME-004/GAME-005 models live (`src/features/debates/`)." | GAME-004's `roomContractModel.ts` and GAME-005's `publicSeatModel.ts` both live in **`src/features/debates/`**. BR-004's `branchGrammarModel.ts` lives in `src/features/arguments/`. | GAME-006's pure-TS model ships as **`src/features/debates/jumpBranchModel.ts`** — beside `publicSeatModel.ts`, the GAME-005 seat model it extends. A jump is a *public-room participant action* governed by GAME-005's seat layer, so it belongs next to that model, not next to the branch-grammar model it merely *reads*. |
| D2 | Data model names `JumpBranchRecord { participantUserId, fromBranchId, toBranchId, at }`. | Nothing named `JumpBranchRecord` exists; no jump concept exists at all. The card's brief also says the jump record must be **counted reliably** and asks whether it can be **derived** rather than persisted. | GAME-006 keeps the `JumpBranchRecord` shape **but derives it at read-time** from existing `arguments` rows — a jump *is* a move whose branch placement differs from the participant's home branch. See §1 + §4 (the derive-vs-persist decision). No new field on `JumpBranchRecord` beyond the card's four; an internal `viaArgumentId` is added so a derived record is auditable and idempotent. |
| D3 | The card's "data-model contracts" name `jumpsUsed(roomId, userId): number` and `canJump(participant, room, destination): { ok, reason }`. | No such functions exist. GAME-005 already exposes the room's seat layout (`PublicRoomSeatMap`) and the actor-eligibility pattern (`canApplyGovernanceReaction` returns `{ allowed, reason }`). | GAME-006 ships `jumpsUsed(...)` and `canJump(...)` **with the card's exact names and shapes**, and reuses GAME-005's `{ allowed/ok, reason }` result idiom. `canJump` returns `{ ok: boolean, reason: JumpDenyReason \| null }` so the disabled-state copy is data-driven (the card's "no silent no-op" requirement). |
| D4 | The card cross-references **QOL-025's "no-silent-no-op rule"** and **IX-004's arrival display**. | **QOL-025 has no design doc** (`docs/designs/` has QOL-023/024/026 only). IX-004 is merged but is *message-centric* — its `TimelineSelectedReadoutPanel` shows the selected *message*, not a jump arrival. | GAME-006 does not depend on a QOL-025 artifact — the "no silent no-op" principle is encoded directly: every disabled Jump control carries a plain-language `reason`. The arrival display is GAME-006's own small read-time surface (a marker view-model — §3); it does **not** modify the IX-004 panel. IX-004 is referenced only as the precedent for "read-time projection into a small panel". |
| D5 | "OP / Primary Opponent can see and respond to the arrival." | GAME-005 already models OP + Primary Opponent as seats 1–2 of `PublicRoomSeatMap` and chime-ins as seats 3–6. There is no notification system, and **push notifications are a v1 scope ban** (CLAUDE.md / doctrine §10). | "See and respond to" is satisfied by the **arrival marker being on the timeline** — the OP/Primary Opponent see it the same way they see any move, and "respond" is the existing reply path. GAME-006 ships **no notification, no alert, no push** — the arrival is a visible structural marker, nothing more. §3.4. |
| D6 | The card's data-model brief says the jump may need "a new table/column" but to "first exhaust whether the jump can be carried via an existing mechanism (e.g. a move's branch placement is already recorded)." | `public.arguments` already records `parent_id` (hence branch placement via BR-004's `branchId` derivation) and `author_id` and `created_at`. GAME-005 derives the entire seat map with **zero persistence**. | **GAME-006 ships no migration and no Edge Function.** A jump is fully derivable from `arguments` (§4). The card's own "Do not implement" line — "No Supabase schema change without a follow-up migration card" — is honored exactly. §4 documents the one persistence seam a *future* card could plug in if a jump must be recorded independently of a move. |

None of these block the card. The pure-TS model, the deterministic `canJump` predicate, the once-per-room `jumpsUsed` counter, the old-branch + arrival markers, and the read-time UI contract are all buildable today with **no migration and no Edge Function**. Two operator decisions are isolated and do not gate the build: **OD-1** (does a jump ever reset — the card's default is *no*) and **OD-2** (whether a destination branch may require arrival approval — the card's default is *no approval gate in v1*).

### Cannot proceed? — No.

The card is buildable. The load-bearing question the coordinator brief raises — *can the once-per-room jump be counted reliably without persistence?* — resolves cleanly:

- **A jump is not a separate event; it is a move.** When a public-room chime-in participant who is engaged on Branch A posts their next qualifying move as a reply onto Branch B (or the mainline), that move's `parent_id` *is* the jump record. The move is already a persisted `arguments` row.
- **`jumpsUsed(roomId, userId)`** is therefore a deterministic count over `arguments`: the number of distinct destination branches the participant moved *into* after their home branch. No counter table, no race — it recomputes on every room load exactly like GAME-005's seat map.
- **`canJump`** is a pure predicate over the same data plus the GAME-005 seat map. Deterministic, no AI, no clock-reading beyond a caller-supplied `nowMs` (and v1 does not even need that — see §2.4).

The only thing GAME-006 *cannot* do without a migration is record a jump that is **not** accompanied by a move (a "claim a destination, post later" two-step). The card does not ask for that — the card's jump *is* "move to engage another branch", i.e. the jump and the engaging move are the same act. Proceed.

---

## Goal (one paragraph)

GAME-006 defines the **Jump Branch** rule — a controlled, deliberate, **once-per-room** action that lets a public-room chime-in participant who is already engaged on their own branch move to engage a *different* branch (or the mainline). Public rooms (GAME-005) let many voices chime in, but uncontrolled cross-branch hopping would turn the structured board back into comment-thread chaos; a bounded "one jump per participant per room" rule preserves structure while still allowing genuine cross-pollination. GAME-006 is a **pure-TS deterministic model** (`jumpBranchModel.ts`) plus a **small read-time UI contract** — a confirm-required Jump control and two structural markers (the old branch shows "this participant moved to another branch"; the destination branch shows an auditable arrival marker with the participant and time). The doctrine anchor, inherited verbatim from GAME-004 / GAME-005 / BR-004: **a Jump describes structural MOVEMENT, never a verdict, never a quality or truth signal, never anything about the person.** The old-branch marker and the arrival marker describe *where a participant is engaging*, not *who is right*. The Jump action is deliberate and **confirm-required** — never accidental, never a side effect of scrolling or tapping. Eligibility (`canJump`) is **deterministic** — rate (the once-per-room cap), destination-branch state, and seat state are the only inputs; heat, popularity, reply count, and standing are never read. GAME-006 ships **no migration, no Edge Function, no Supabase write beyond the existing move-post path, no service-role, no AI call, no new dependency, no route transition.**

---

## §1 — Data model

**No new persisted data model. No migration. No new domain type stored in the DB.** Every GAME-006 value is **derived per render** from data the room already loads — `arguments` rows + the GAME-004 `RoomContract` + the GAME-005 `PublicRoomSeatMap` + the BR-004 branch-grammar map. This mirrors GAME-005 exactly (which derives its whole seat map with zero persistence).

All types are pure TypeScript, exported from a new `src/features/debates/jumpBranchModel.ts`. No React / Supabase / network / AI imports. JSON-serializable so the same model could run in an Edge Function later if a follow-up persistence card needs it server-side. The model **imports types from GAME-004's `roomContractModel.ts` and GAME-005's `publicSeatModel.ts`** (it extends those contracts) and **mirrors BR-004's `BranchDirection` as a consumed type** (it does not import a render concern).

### 1.1 `JumpBranchRecord` — the card's named shape (derived, never persisted)

```ts
/**
 * GAME-006 — one Jump Branch event. The card names the four core fields
 * verbatim. GAME-006 keeps that shape and DERIVES every field at read-time
 * from an existing `arguments` row — a jump IS a move whose branch
 * placement differs from the participant's home branch. Never persisted as
 * its own row; recomputed on every room load.
 */
export interface JumpBranchRecord {
  /** The chime-in participant who jumped. `arguments.author_id`. */
  participantUserId: string;
  /**
   * The BR-004 branchId the participant was engaged on BEFORE the jump —
   * their home branch (the branch their FIRST qualifying move opened).
   */
  fromBranchId: string;
  /**
   * The BR-004 branchId the participant jumped INTO — the branch of the
   * move that constitutes the jump. May be the mainline branch.
   */
  toBranchId: string;
  /** ISO timestamp of the jump — the `createdAt` of the jumping move. */
  at: string;
  /**
   * GAME-006 INTERNAL (not in the card's four-field shape, but required
   * for the derivation to be auditable + idempotent): the `arguments.id`
   * of the move that constitutes this jump. Lets the UI anchor the
   * arrival marker to a concrete message and lets a test pin exactly
   * which move was read as the jump. Never rendered as raw text.
   */
  viaArgumentId: string;
}
```

**Why `viaArgumentId` is added:** the card's four fields cannot, alone, point the arrival marker at a concrete timeline node, and a derivation that cannot name its source row is not testable. `viaArgumentId` is an internal audit handle, not a user-facing field — it is the same discipline GAME-004 used adding `explainQualifyingResponse` alongside the card's bare-boolean `isQualifyingResponse`.

### 1.2 `JumpEligibility` — the `canJump` result (the card's named shape)

```ts
/** GAME-006 — why a Jump is not currently allowed. Drives the disabled-
 *  state reason copy — the card's explicit "no silent no-op" requirement. */
export type JumpDenyReason =
  | 'not_a_chime_in'        // OP / Primary Opponent / observer — only
                            //   public-room chime-ins may Jump Branch
  | 'no_active_seat'        // the participant was moved to observer
                            //   (GAME-005) — no active seat, cannot jump
  | 'jump_already_used'     // the once-per-room jump is spent
  | 'destination_is_home'   // the destination is the participant's own
                            //   home branch — that is not a jump
  | 'destination_closed'    // the destination branch is collapsed /
                            //   observer-only / not open to engagement
  | 'destination_unknown'   // the destination branchId is not in the room
  | 'destination_needs_approval'; // OD-2 future: destination requires
                                  //   arrival approval (v1: never returned)

/**
 * GAME-006 — the result of `canJump`. The card names the shape
 * `{ ok: boolean, reason }`. `reason` is null when ok === true; the first
 * failing `JumpDenyReason` otherwise. A future card could surface a
 * non-accusatory hint from the reason — v1 maps it through `JUMP_BRANCH_COPY`.
 */
export interface JumpEligibility {
  ok: boolean;
  /** null when ok === true; the first failing reason otherwise. */
  reason: JumpDenyReason | null;
}
```

### 1.3 `BranchEngagementState` — the destination-branch-state input

`canJump` needs to know whether a destination branch is *open to engagement*. GAME-006 does not re-derive branch state — it consumes structural facts the room already has (the GAME-005 seat map + the BR-004 grammar map).

```ts
/**
 * GAME-006 — the engagement state of one branch, as far as a Jump cares.
 * A small derived projection — NOT a new persisted concept. Built by
 * `buildBranchEngagementMap` (§2.5) from the BR-004 grammar map + the
 * GAME-005 seat map. Carries only STRUCTURAL facts — never heat, never
 * reply count as a quality signal.
 */
export interface BranchEngagementState {
  branchId: string;
  /** The BR-004 direction — mainline / chime_in_vertical / tangent /
   *  evidence_passthrough. Consumed from `BranchGrammarNode.direction`. */
  direction: BranchDirection;
  /**
   * True when the branch is open to a new engaging move. A branch is
   * CLOSED to a jump when its owning chime-in has been moved to observer
   * by GAME-005 governance (the branch collapsed into "Side branches"),
   * OR when it is an evidence_passthrough branch (evidence threads are
   * not a chime-in engagement target — BR-004 owns their semantics).
   * The mainline and any active chime_in_vertical / tangent_diagonal
   * branch are open.
   */
  openToEngagement: boolean;
  /** True when this is the mainline branch (BR-004 'mainline'). A jump
   *  INTO the mainline is allowed; see §2.4 + §6 edge cases. */
  isMainline: boolean;
}
```

### 1.4 `JumpControlViewModel` — the read-time UI contract for the action

```ts
/**
 * GAME-006 — the view-model the confirm-required Jump control renders.
 * Pure data, no JSX. Built by `buildJumpControlViewModel` (§2.6).
 */
export interface JumpControlViewModel {
  /** The participant the control is for (the viewer, when they are a
   *  chime-in). Never rendered as raw text. */
  participantUserId: string;
  /** The destination branch the control would jump into. */
  destinationBranchId: string;
  /** The plain-language action label — e.g. "Jump to this branch". */
  actionLabel: string;
  /** Whether the action is enabled. False => the control renders disabled
   *  with `disabledReasonLabel` visible (no silent no-op). */
  enabled: boolean;
  /** Plain-language reason the action is disabled, or null when enabled.
   *  Mapped from the `JumpDenyReason` via `JUMP_BRANCH_COPY`. */
  disabledReasonLabel: string | null;
  /**
   * The confirm-step copy — shown when the user taps the (enabled)
   * action, BEFORE the jump commits. The jump is deliberate: it only
   * proceeds on an explicit confirm. e.g. "Move your participation to
   * this branch? You can only do this once per room."
   */
  confirmPrompt: string;
  /** The confirm-button label, e.g. "Yes, jump". */
  confirmLabel: string;
  /** The cancel-button label, e.g. "Stay here". */
  cancelLabel: string;
  /** Full screen-reader label for the action control. */
  accessibilityLabel: string;
  /** Screen-reader hint describing the confirm step. */
  accessibilityHint: string;
}
```

### 1.5 `JumpMarkerViewModel` — the old-branch + arrival markers

```ts
/** GAME-006 — which structural marker this view-model describes. */
export type JumpMarkerKind = 'departed_from' | 'arrived_at';

/**
 * GAME-006 — one structural Jump marker. `departed_from` renders on the
 * participant's OLD branch ("moved to another branch"); `arrived_at`
 * renders on the DESTINATION branch ("a participant joined this branch").
 * Pure data; describes structural MOVEMENT, never the person, never a
 * verdict. Built by `buildJumpMarkers` (§2.7).
 */
export interface JumpMarkerViewModel {
  kind: JumpMarkerKind;
  /** The branch this marker renders on. */
  branchId: string;
  /** The participant who jumped. Never rendered as raw text — the label
   *  is role-relative ("A chime-in" / "You"), never a person name. */
  participantUserId: string;
  /**
   * For `arrived_at`: the `viaArgumentId` of the jumping move, so the
   * marker can anchor to that timeline node. For `departed_from`: the
   * same id, so the old-branch marker can link "moved to →".
   */
  anchorArgumentId: string;
  /** Plain-language relative time, e.g. "moved 2h ago" / "joined 2h ago".
   *  From `formatRelativeShort` — never a raw timestamp. */
  whenLabel: string;
  /** The plain-language one-line marker text. From `JUMP_BRANCH_COPY`. */
  markerLabel: string;
  /** Full screen-reader label. Plain English, structural, no verdict. */
  accessibilityLabel: string;
}
```

### 1.6 New plain-language copy (`gameCopy.ts`)

A new frozen block added to `src/features/arguments/gameCopy.ts`, beside `CHIME_IN_GOVERNANCE_COPY` (the GAME-005 block) — same placement discipline GAME-005 used adding its block beside BR-004's `BRANCH_GRAMMAR_COPY`.

```ts
/**
 * GAME-006 — plain-language copy for Jump Branch. A Jump describes
 * structural MOVEMENT, never a verdict, never the person. No "booted /
 * kicked / abandoned / quit" — a participant who jumps has not "left" in
 * a punitive sense; their old branch is kept on the record. OD-1 / OD-2
 * confirm wording.
 */
export const JUMP_BRANCH_COPY = Object.freeze({
  // The action control.
  action_label: 'Jump to this branch',
  action_explainer:
    'Move your participation to this branch. You can do this once per room.',

  // The confirm step — deliberate, never one-tap-accidental.
  confirm_prompt:
    'Move your participation to this branch? You can only Jump Branch '
    + 'once per room, so this uses your jump.',
  confirm_label: 'Yes, jump',
  cancel_label: 'Stay here',

  // Disabled-state reasons — one per JumpDenyReason. No silent no-op.
  disabled_not_a_chime_in:
    'Jump Branch is for chime-in participants. The two main debaters '
    + 'stay on the main thread.',
  disabled_no_active_seat:
    'You are observing this room, so there is no branch to jump from.',
  disabled_jump_already_used:
    'You have already used your one jump for this room.',
  disabled_destination_is_home:
    'You are already engaging on this branch.',
  disabled_destination_closed:
    'This branch is not open to join right now.',
  disabled_destination_unknown:
    'That branch is no longer part of this room.',
  disabled_destination_needs_approval:
    'This branch asks new voices to be welcomed in first.',

  // Old-branch marker — structural, never punitive.
  marker_departed_title: 'Moved to another branch',
  marker_departed_body: 'This chime-in moved to engage another branch.',

  // Destination arrival marker — auditable, structural.
  marker_arrived_title: 'A chime-in joined this branch',
  marker_arrived_body: 'A chime-in jumped here from another branch.',

  // Relative-time fragments.
  when_moved: 'moved {rel}',
  when_joined: 'joined {rel}',
  when_unknown: 'recently',
} as const);
```

All strings: plain English, no `snake_case`, **zero verdict / amplification / person-attribution / punitive ("booted / kicked / abandoned / quit / left") tokens**, non-punitive. `looksLikeInternalCode` returns `false` for every visible string. A ban-list test enforces this (§8).

---

## §2 — API / interface contracts (`jumpBranchModel.ts`)

All functions are pure, deterministic, side-effect free, and never mutate their inputs — the same contract `roomContractModel.ts` and `publicSeatModel.ts` hold.

### 2.1 `deriveParticipantHomeBranch(participantUserId, args) → string | null`

```ts
/**
 * GAME-006 — the BR-004 branchId of a chime-in participant's HOME branch:
 * the branch their FIRST qualifying move opened. Pure. Returns null when
 * the participant has no qualifying move on record (they have not yet
 * become a chime-in). Reuses GAME-004 `isQualifyingResponse` so a
 * one-word non-move never counts as "engaged on a branch".
 *
 * "Home branch" = the branchId of the participant's earliest qualifying
 * move, chosen by createdAt asc, tie-broken by id asc (identical
 * determinism to GAME-004 / GAME-005).
 */
export function deriveParticipantHomeBranch(
  participantUserId: string,
  args: {
    roomContract: RoomContract;
    arguments: ReadonlyArray<RoomArgumentInput>;
    /** The branchId per argument id — the room already holds the BR-004
     *  grammar map; the caller passes a `Map<argumentId, branchId>`
     *  projection. GAME-006 does not re-derive branch placement. */
    branchIdByArgumentId: ReadonlyMap<string, string>;
    signals?: QualifyingResponseSignals;
  },
): string | null;
```

### 2.2 `listJumpsForParticipant(participantUserId, args) → JumpBranchRecord[]`

```ts
/**
 * GAME-006 — the derived list of Jump Branch records for ONE participant
 * in this room, in chronological order. Pure. Deterministic.
 *
 * A jump is detected structurally: walk the participant's qualifying
 * moves in chronological order; their FIRST qualifying move opens / sits
 * on their home branch (no jump). Every later qualifying move whose
 * branchId differs from the branch the participant was last engaging on
 * is a JUMP — its `fromBranchId` is the previously-engaged branch, its
 * `toBranchId` is the new branch, its `at` is the move's createdAt, its
 * `viaArgumentId` is the move's id.
 *
 * v1: because the once-per-room rule caps a participant at one jump, a
 * well-behaved participant produces 0 or 1 records. The function returns
 * ALL detected jumps (it does not truncate) so a test can prove the cap
 * is enforced by `canJump`, not by hiding data — and so a future
 * multi-jump revision (OD-1) needs no model change.
 */
export function listJumpsForParticipant(
  participantUserId: string,
  args: {
    roomContract: RoomContract;
    arguments: ReadonlyArray<RoomArgumentInput>;
    branchIdByArgumentId: ReadonlyMap<string, string>;
    signals?: QualifyingResponseSignals;
  },
): ReadonlyArray<JumpBranchRecord>;
```

### 2.3 `jumpsUsed(roomId, userId, args) → number` (the card's named function)

```ts
/**
 * GAME-006 — the once-per-room jump counter. The card names this exactly.
 * Returns the number of jumps the participant has already used in this
 * room. v1 default cap is `MAX_JUMPS_PER_ROOM` (= 1); `jumpsUsed` simply
 * returns `listJumpsForParticipant(...).length`. Pure, deterministic,
 * derived — no counter table, no race.
 *
 * `roomId` is part of the card's named signature; the function asserts
 * `roomId === roomContract.roomId` defensively and otherwise returns 0.
 */
export function jumpsUsed(
  roomId: string,
  userId: string,
  args: {
    roomContract: RoomContract;
    arguments: ReadonlyArray<RoomArgumentInput>;
    branchIdByArgumentId: ReadonlyMap<string, string>;
    signals?: QualifyingResponseSignals;
  },
): number;
```

```ts
/**
 * GAME-006 — the once-per-room jump cap. The card's default rule is
 * "one jump per public-room participant per room". A single named
 * constant so OD-1 (does a jump ever reset / can a room allow more) is a
 * one-edit tuning. Proposed: 1.
 */
export const MAX_JUMPS_PER_ROOM = 1;
```

### 2.4 `canJump(participant, room, destination) → JumpEligibility` (the card's named function)

```ts
/**
 * GAME-006 — the deterministic Jump eligibility predicate. The card names
 * this exactly: `canJump(participant, room, destination): { ok, reason }`.
 *
 * Pure. Deterministic. Reads ONLY structural inputs — the participant's
 * seat role, the participant's used-jump count, and the destination
 * branch's engagement state. It NEVER reads heat, popularity, reply
 * count, view count, or any strength / standing band.
 *
 * Returns `{ ok: false, reason }` (first failing reason) when ANY of the
 * following hold, checked in this fixed order so the reported reason is
 * stable:
 *  1. The participant is NOT a chime-in (they are the OP, the Primary
 *     Opponent, or an observer who never claimed a seat) -> 'not_a_chime_in'.
 *     The OP + Primary Opponent are fixed to the mainline (card actor
 *     rule); they do not jump.
 *  2. The participant has no active seat — they were moved to observer by
 *     GAME-005 governance (in `seatMap.movedToObserver`) -> 'no_active_seat'.
 *  3. The participant has already used their jump
 *     (`usedJumps >= MAX_JUMPS_PER_ROOM`) -> 'jump_already_used'.
 *  4. The destination branchId is not a known branch -> 'destination_unknown'.
 *  5. The destination IS the participant's home branch -> 'destination_is_home'
 *     (you cannot "jump" to where you already are).
 *  6. The destination branch is not open to engagement
 *     (`destination.openToEngagement === false`) -> 'destination_closed'.
 *  7. (OD-2, v1 inert) destination requires arrival approval ->
 *     'destination_needs_approval'. v1 never returns this — the v1
 *     default is no approval gate. The branch exists so a future card
 *     can flip it on with no signature change.
 * Otherwise `{ ok: true, reason: null }`.
 */
export function canJump(
  participant: {
    /** The chime-in participant's userId. */
    userId: string;
    /** The participant's seat role in the GAME-005 seat map — or
     *  'observer' when they hold no active seat. */
    seatRole: SeatRole | 'observer';
    /** The number of jumps the participant has already used this room
     *  (from `jumpsUsed`). */
    usedJumps: number;
    /** The participant's home branchId (from `deriveParticipantHomeBranch`),
     *  or null when they have not engaged on a branch yet. */
    homeBranchId: string | null;
  },
  room: {
    /** The GAME-005 seat map — used to confirm the participant holds an
     *  active chime-in seat (and is not in `movedToObserver`). */
    seatMap: PublicRoomSeatMap;
  },
  destination: BranchEngagementState,
): JumpEligibility;
```

**Note — no `nowMs` parameter.** The card's "rate" input is the once-per-room *count*, not a time-window. Unlike GAME-005's governance window, GAME-006's rate limit is a pure count (`usedJumps >= MAX_JUMPS_PER_ROOM`), so `canJump` needs no clock. The `at` timestamp on a `JumpBranchRecord` is purely descriptive (it drives the marker's "moved 2h ago" copy); it is never an eligibility input. This keeps `canJump` trivially deterministic and testable.

### 2.5 `buildBranchEngagementMap(args) → ReadonlyMap<branchId, BranchEngagementState>`

```ts
/**
 * GAME-006 — build the per-branch engagement-state map. Pure. Consumes
 * the BR-004 grammar map (for `direction`) + the GAME-005 seat map (to
 * know which chime-in branches collapsed into observer-fallback). GAME-006
 * re-derives NO branch state — it projects existing structural facts.
 */
export function buildBranchEngagementMap(args: {
  /** The BR-004 branch-grammar map (buildBranchGrammarMap output). */
  branchGrammarMap: ReadonlyMap<string, BranchGrammarNode>;
  /** The GAME-005 seat map — `movedToObserver` records carry the
   *  branchId of a collapsed chime-in branch. */
  seatMap: PublicRoomSeatMap;
}): ReadonlyMap<string, BranchEngagementState>;
```

### 2.6 `buildJumpControlViewModel(args) → JumpControlViewModel`

```ts
/**
 * GAME-006 — build the confirm-required Jump control's view-model for one
 * destination branch, for one viewer. Pure. The `enabled` flag and
 * `disabledReasonLabel` come straight from `canJump` — the control can
 * never be a silent no-op. Every disabled state has a visible reason.
 */
export function buildJumpControlViewModel(args: {
  eligibility: JumpEligibility;
  participantUserId: string;
  destinationBranchId: string;
}): JumpControlViewModel;
```

### 2.7 `buildJumpMarkers(roomArgs) → ReadonlyArray<JumpMarkerViewModel>`

```ts
/**
 * GAME-006 — build the structural Jump markers for the whole room. Pure.
 * For each derived `JumpBranchRecord` it emits TWO markers: a
 * `departed_from` marker on `fromBranchId` and an `arrived_at` marker on
 * `toBranchId`. The room shell renders each marker on its branch.
 *
 * Markers describe structural MOVEMENT — never the person, never a
 * verdict. The old branch is NEVER deleted; the marker is additive.
 */
export function buildJumpMarkers(roomArgs: {
  roomContract: RoomContract;
  arguments: ReadonlyArray<RoomArgumentInput>;
  branchIdByArgumentId: ReadonlyMap<string, string>;
  seatMap: PublicRoomSeatMap;
  signals?: QualifyingResponseSignals;
  /** Current time, ms epoch — only for the marker's relative-time copy
   *  ("moved 2h ago"). Optional; absent => "recently". */
  nowMs?: number;
}): ReadonlyArray<JumpMarkerViewModel>;
```

### 2.8 Ban-list support

```ts
/**
 * Forbidden tokens scanned by `__tests__/jumpBranchDoctrine.test.ts`.
 * Mirrors `_forbiddenChimeInGovernanceTokens` (GAME-005) so GAME-006 copy
 * is held to the same bar — verdict tokens, amplification tokens,
 * person-attribution tokens, AND punitive movement tokens ("abandoned /
 * quit / left / booted") because a jump is not a desertion.
 */
export function _forbiddenJumpBranchTokens(): string[];
```

---

## §3 — The read-time UI contract

### 3.1 The confirm-required Jump action

The card is explicit and repeats it three times: the Jump action is **deliberate, confirm-required, never accidental, never a side effect of scrolling/clicking.** GAME-006 ships the contract; the room shell renders it. The component is a small RN surface:

- A **Jump control** (`JumpBranchControl.tsx`) rendered for a destination branch, **only when the viewer is a public-room chime-in participant** with an active seat. Pure presentation over a `JumpControlViewModel`.
- The control is a single `<Pressable>` (the action), `accessibilityRole="button"`, `accessibilityLabel` from the view-model, `≥44px` hit target (`hitSlop` fills any gap — the GAME-005 `ChimeInGovernanceControl` `REACTION_HIT_SLOP` pattern).
- **Tapping the action does NOT jump.** It opens a **confirm step** — a small inline confirmation panel (not a route, not a modal screen) with `confirmPrompt` text, a `confirmLabel` button, and a `cancelLabel` button. Only the `confirmLabel` button commits the jump. This two-step gate is the card's "deliberate, not one-tap-accidental" requirement encoded structurally.
- The confirm step is reachable **without a pointer** — both confirm and cancel are focusable `<Pressable>`s in reading order; on web they are keyboard-operable (`Enter` / `Space`); `Esc` / the cancel button dismisses. This satisfies the accessibility requirement "the confirm step is reachable without a pointer".
- When the action is **disabled** (`enabled === false`), the control still renders, visibly, with `accessibilityState={{ disabled: true }}` and the `disabledReasonLabel` shown as visible text beside or below the control. **No silent no-op** — the disabled control always tells the user why (the card's QOL-025-style requirement; QOL-025 itself has no design doc — §0 D4).

### 3.2 Where the jump *commits*

There is **no new write path.** A jump *is* the participant posting their next qualifying move onto the destination branch via the existing `submit-argument` flow / the existing composer. The GAME-006 confirm step, when confirmed, hands off to the existing reply composer **pre-targeted at the destination branch** (the destination branch's root message id becomes the composer's reply parent). The composer, the `submit-argument` Edge Function, and the `arguments` insert are all unchanged. GAME-006 commits a jump exactly the way GAME-005 commits a chime-in: by the participant posting a normal move.

This is the reason no migration is needed — the jump is carried by the move's `parent_id`, which is already persisted.

### 3.3 The old-branch "departed" marker

After a participant jumps, their old branch shows a `departed_from` marker (`JumpMarkerViewModel`, `kind: 'departed_from'`):

- Rendered as a small, non-interactive structural badge on the old branch, near the participant's last move on that branch.
- Copy: `marker_departed_title` = "Moved to another branch", `marker_departed_body` = "This chime-in moved to engage another branch." Plus `whenLabel` ("moved 2h ago").
- **The old branch is never deleted or hidden** — the marker is purely additive (card doctrine constraint + cdiscourse-doctrine §8 "never hard-delete"). Every move the participant made on the old branch stays on the record.
- The marker describes structural movement — it never says the participant "lost", "gave up", "abandoned", or "left". The ban-list test enforces this.

### 3.4 The destination "arrival" marker

The destination branch shows an `arrived_at` marker (`JumpMarkerViewModel`, `kind: 'arrived_at'`):

- Rendered as a small structural badge on the destination branch, anchored to the jumping move (`anchorArgumentId` = `viaArgumentId`).
- Copy: `marker_arrived_title` = "A chime-in joined this branch", `marker_arrived_body` = "A chime-in jumped here from another branch." Plus `whenLabel` ("joined 2h ago").
- **Auditable**: the marker carries `participantUserId` (role-relative label only — "A chime-in" / "You", never a person name) and the time. It is the visible record the card asks for.
- "OP / Primary Opponent can see and respond to the arrival" (card actor rule) is satisfied by the marker being **on the timeline** — the OP/Primary Opponent see it exactly as they see any move, and "respond" is the existing reply path. GAME-006 ships **no notification, no alert, no push** (push is a v1 scope ban — §0 D5).

### 3.5 No route transition

The card states it twice: "No route transition." Everything — the Jump control, the confirm step, both markers — renders **in the existing room shell**. The confirm step is an inline panel, not a screen. The arrival display surfaces near the IX-004 readout panel (referenced, not modified — §0 D4). This mirrors GAME-005, which renders the metrics strip and governance control in place with no navigation.

---

## §4 — Data-model decision: derive vs persist

**Decision: DERIVE. No migration. No Edge Function. No new table, no new column.**

The coordinator brief asked specifically to determine whether the once-per-room counter and `JumpBranchRecord` can be derived from existing data before proposing any schema. The answer is yes, and cleanly:

| What | How it is obtained in v1 | Why no persistence is needed |
|---|---|---|
| `JumpBranchRecord` | Derived from `arguments` rows — a jump is a qualifying move whose `branchId` differs from the participant's last-engaged branch (§2.2). | The move is *already* a persisted `arguments` row. The "jump" is the move; recording the move records the jump. |
| `jumpsUsed(roomId, userId)` | `listJumpsForParticipant(...).length` — a count over `arguments` (§2.3). | A count derived per render is race-free and always consistent — exactly how GAME-005 derives its seat map with zero persistence. |
| `canJump` eligibility | Pure predicate over the seat map + the used-jump count + destination state (§2.4). | All three inputs are themselves derived from `arguments` + the GAME-004 contract + the BR-004 grammar map. |
| Old-branch + arrival markers | Derived from the `JumpBranchRecord` list (§2.7). | Markers are a projection of the derived records; nothing to store. |

**The one thing derive cannot do** (stated honestly): it cannot record a jump that is *not* accompanied by a move — i.e. a "reserve a destination now, post later" two-step. **The card does not ask for that.** The card's jump is "move to engage another branch" — the jump and the engaging move are the same act. The confirm step (§3.1–3.2) confirms intent and then routes the participant straight to the composer; the participant becomes "jumped" the moment the move posts.

**Future migration seam (NOT this card — flagged for completeness).** If a later card needs a jump to exist independently of a move (e.g. "claimed a branch, marked as 'arriving', has not posted yet"), it would add a `public.jump_branch_records` table `(id, debate_id, participant_user_id, from_branch_id, to_branch_id, via_argument_id, created_at)` with RLS (insert scoped to the jumping participant; select to room participants). **The model would not change** — `listJumpsForParticipant` already returns `JumpBranchRecord[]`; a persistence card would feed persisted rows into the same downstream functions. This is the identical seam GAME-005 documented for `chime_in_governance_reactions`. v1 ships **zero schema**; the card's own "Do not implement … No Supabase schema change without a follow-up migration card" is honored exactly.

---

## §5 — How GAME-006 consumes GAME-004 / GAME-005 / BR-004

GAME-006 is a **consumer** of three merged cards. It re-derives nothing they own.

**From GAME-004 (`roomContractModel.ts`):**
- `RoomContract` — to identify the OP (`initiatorUserId`) and Primary Opponent (`primaryOpponentUserId`), who are *fixed to the mainline and never jump* (card actor rule → `canJump` rule 1).
- `RoomArgumentInput`, `QualifyingResponseSignals`, `isQualifyingResponse` — reused verbatim so a one-word non-move never counts as "engaging a branch" and never counts as a jump. Anti-sniping is inherited, not re-invented.
- GAME-006 does **not** modify the room contract, the Primary Opponent resolution, or the turn model.

**From GAME-005 (`publicSeatModel.ts`):**
- `SeatRole` (`initiator | primary_opponent | chime_in`) — only `chime_in` seats may Jump Branch (`canJump` rule 1). `SeatRole` is imported, not redefined.
- `PublicRoomSeatMap` — `activeSeats` confirms the participant holds an active chime-in seat; `movedToObserver` confirms whether they were governance-moved to observer (`canJump` rule 2 — a moved-to-observer participant has no active seat and cannot jump). This is the card's explicit edge case "Participant was moved to observer (GAME-005) → cannot jump".
- `MovedToObserverRecord.branchId` — a collapsed chime-in branch's id; `buildBranchEngagementMap` uses it to mark that branch `openToEngagement: false` (you cannot jump *into* a branch that collapsed into "Side branches").
- GAME-006 does **not** modify the seat model, governance, or the observer-fallback transition.

**From BR-004 (`branchGrammarModel.ts`):**
- `BranchDirection` and `BranchGrammarNode` — the source of each branch's `direction` and identity. GAME-006 keys `BranchEngagementState` on `BranchGrammarNode.direction` — it does **not** re-derive branch direction or topology. BR-004 owns the branch grammar; GAME-006 *consumes* branch identity/grammar. (The card's non-scope is explicit: "Branch grammar/visuals → BR-004".)
- A jump *into* the mainline is recognized by `direction === 'mainline'` (`BranchEngagementState.isMainline`). The card's edge case: "Jump into the mainline … is allowed but the participant still cannot become a primary seat (GAME-004 governs seats)." GAME-006 honors this exactly — a jump changes *which branch the chime-in engages*, never *which seat they hold*; seat assignment stays 100% GAME-004's `resolvePrimaryOpponent`. A chime-in who jumps to the mainline is still a `chime_in` seat.
- An `evidence_passthrough` branch is **not** a chime-in engagement target — `buildBranchEngagementMap` marks it `openToEngagement: false`. BR-004 owns evidence-thread semantics; GAME-006 does not let a jump restyle or hijack one.
- GAME-006 does **not** modify the branch-grammar model, the render contract, or `BRANCH_GRAMMAR_COPY`.

**Coordination note:** GAME-005's `PublicSeat.branchId` and `MovedToObserverRecord.branchId` already carry the BR-004 `branchId`; GAME-006's records carry the same `branchId`, so the room shell joins "this jump → this BR-004 branch → this seat" with no new identifier — identical to the join GAME-005 set up.

---

## §6 — File changes

### New files (THIS card's footprint)

| Path | Purpose | Approx LOC |
|---|---|---:|
| `src/features/debates/jumpBranchModel.ts` | Pure-TS model. Exports `JumpBranchRecord`, `JumpDenyReason`, `JumpEligibility`, `BranchEngagementState`, `JumpControlViewModel`, `JumpMarkerKind`, `JumpMarkerViewModel`, `MAX_JUMPS_PER_ROOM`, `deriveParticipantHomeBranch`, `listJumpsForParticipant`, `jumpsUsed`, `canJump`, `buildBranchEngagementMap`, `buildJumpControlViewModel`, `buildJumpMarkers`, `_forbiddenJumpBranchTokens`. Imports GAME-004 + GAME-005 types from `roomContractModel`/`publicSeatModel`; mirrors BR-004 `BranchDirection`/`BranchGrammarNode` as consumed types. No React, no Supabase, no network, no AI. | ~320–400 |
| `src/features/debates/JumpBranchControl.tsx` | Read-time RN component — the confirm-required Jump action + the inline confirm step. Pure presentation over a `JumpControlViewModel` + `onRequestJump` / `onConfirmJump` / `onCancel` callbacks. `≥44px` targets, full a11y, disabled-state reason visible. | ~150–200 |
| `src/features/debates/JumpBranchMarker.tsx` | Read-time RN component — renders one `JumpMarkerViewModel` (the old-branch "departed" badge or the destination "arrival" badge). Non-interactive, informational. Pure presentation. | ~90–120 |
| `__tests__/jumpBranchModel.test.ts` | Pure-model tests — `canJump` table, `jumpsUsed` counter, `listJumpsForParticipant` derivation, markers, determinism (§8). | ~360 |
| `__tests__/jumpBranchEligibility.test.ts` | Full `canJump` permutation matrix — every `JumpDenyReason` + the allowed path (§8). | ~150 |
| `__tests__/jumpBranchDoctrine.test.ts` | Ban-list across `JUMP_BRANCH_COPY` + every produced label; `looksLikeInternalCode` scan; forbidden-import scan; no-service-role scan (§8). | ~120 |
| `__tests__/jumpBranchControl.test.tsx` | `JumpBranchControl` render + a11y + confirm-step + disabled-reason tests (§8). | ~170 |
| `__tests__/jumpBranchMarker.test.tsx` | `JumpBranchMarker` render tests for both marker kinds (§8). | ~90 |

### Modified files (THIS card's footprint)

| Path | What changes | What stays |
|---|---|---|
| `src/features/arguments/gameCopy.ts` | ADD the frozen `JUMP_BRANCH_COPY` block beside `CHIME_IN_GOVERNANCE_COPY`. ~+45 lines. | Everything existing. `toPlainLanguage` / `looksLikeInternalCode` / `BRANCH_GRAMMAR_COPY` / `CHIME_IN_GOVERNANCE_COPY` unchanged. |
| `src/features/debates/index.ts` | Re-export the GAME-006 model functions/types + the two components, in a `// GAME-006 — Jump Branch` block beside the GAME-005 block. ~+20 lines. | Every existing export. |
| The room shell that mounts the timeline + the GAME-005 `PublicRoomMetricsStrip` / `ChimeInGovernanceControl` (verify the exact mount path — GAME-005 §8 wired it via `App.tsx` / the room surface mount) | **Minimal additive wiring.** ~+40–70 net lines. Build `buildBranchEngagementMap` + `buildJumpMarkers` once per render (memoized on the room-contract hash + arguments + seat map + grammar map). Mount `JumpBranchControl` on a destination branch **only when the viewer is a chime-in with an active seat**. Mount `JumpBranchMarker` for each `JumpMarkerViewModel` on its branch. The confirm step routes to the existing composer pre-targeted at the destination branch. | All node-tap / selection logic; the GAME-004 seat strip; the GAME-005 strips; the BR-004 timeline rail; the IX-004 panel. No existing prop made required; every new prop optional with a no-render default. |

### Files this card does NOT touch (and why)

- `src/features/debates/roomContractModel.ts` — GAME-004's contract is **read** (types + `isQualifyingResponse`), never modified.
- `src/features/debates/publicSeatModel.ts` — GAME-005's seat model is **read** (`SeatRole`, `PublicRoomSeatMap`, `MovedToObserverRecord`), never modified.
- `src/features/arguments/branchGrammarModel.ts` — BR-004's grammar is **read** (`BranchDirection`, `BranchGrammarNode`), never modified.
- `src/features/arguments/timelineSelectedReadoutModel.ts` + `TimelineSelectedReadoutPanel.tsx` — IX-004's readout is **not modified** (§0 D4).
- `src/features/arguments/ArgumentComposer.tsx` / `submit-argument` Edge Function — the jump commits via the **existing** composer + post path; no change to either (§3.2).
- `src/lib/constitution/engine.ts` — the rules engine is sacred. GAME-006 adds no rule, no flag, no transition.
- `supabase/migrations/*` + `supabase/functions/*` — **no migration, no Edge Function** (§4).
- `src/features/pointStanding/*`, `argumentScoreModel.ts`, any heat module — never imported; a jump is orthogonal to standing.

### Future-card footprint (NOT this card)

- **Persistence of `JumpBranchRecord`** as its own table → a follow-up migration card, only if a future card needs a jump that is not carried by a move (§4 seam).
- **Multi-jump or per-phase jump reset** → governed by `MAX_JUMPS_PER_ROOM` + OD-1; a future card flips the constant / adds a reset rule with no model rewrite.
- **Destination arrival approval** → `JumpDenyReason.destination_needs_approval` exists but is inert in v1 (OD-2); a future card wires the approval input.
- **Bot public-room policy** (whether a bot may jump) → GAME-008. GAME-006 inherits the GAME-004 bot-exclusion (`isQualifyingResponse` rejects `isBot` moves), so a bot move never becomes a jump in v1.

---

## §7 — Edge cases

The implementer must handle every one; each maps to a named test (§8).

1. **Participant tries to jump after their one jump is used.** `jumpsUsed >= MAX_JUMPS_PER_ROOM` → `canJump` returns `{ ok: false, reason: 'jump_already_used' }`; the control renders disabled with the plain-language reason. (Card edge case, verbatim.)
2. **Destination branch is closed / collapsed / observer-only.** The destination's `openToEngagement` is `false` (its owning chime-in was moved to observer, or it is an `evidence_passthrough` branch) → `canJump` → `destination_closed`. (Card edge case, verbatim.)
3. **Participant was moved to observer (GAME-005).** They appear in `seatMap.movedToObserver`, hold no active seat → `canJump` → `no_active_seat`. (Card edge case, verbatim.)
4. **OP / Primary Opponent attempts a jump.** `seatRole` is `initiator` / `primary_opponent` → `canJump` → `not_a_chime_in`. They are fixed to the mainline (card actor rule).
5. **Destination is the participant's own home branch.** `destination.branchId === participant.homeBranchId` → `canJump` → `destination_is_home`. You cannot "jump" to where you already are.
6. **Destination branchId is unknown** (a stale UI handle, a deleted branch) → `canJump` → `destination_unknown`. No crash.
7. **Jump into the mainline.** `destination.isMainline === true` and the destination is open → `canJump` returns `{ ok: true }`. The chime-in may engage the mainline. **But their seat role stays `chime_in`** — a jump never makes a chime-in a primary seat (GAME-004 governs seats). A test asserts the seat role is unchanged. (Card edge case + Open decision: the card's default is "allowed".)
7b. **Participant has not engaged any branch yet** (`homeBranchId === null`). They have no qualifying move, so they are not yet a chime-in — `canJump` rule 1 (`not_a_chime_in`) already covers them; a participant with no home branch cannot jump because they have not arrived anywhere to jump *from*.
8. **Empty room / room with only the OP.** No chime-ins → `listJumpsForParticipant` returns `[]` for everyone; `buildJumpMarkers` returns `[]`. No crash, no marker.
9. **A participant posts two moves on the SAME branch.** Not a jump — `listJumpsForParticipant` detects a jump only when the branch *changes*. Staying put never consumes a jump.
10. **A participant jumps, then posts again on the destination branch.** The second move is on the same (destination) branch — not a second jump. `jumpsUsed` stays 1.
11. **A participant jumps back to their original home branch.** Detected as a *second* jump (the branch changed again). With `MAX_JUMPS_PER_ROOM = 1`, the participant could not have posted that second cross-branch move with the jump enabled — but if data shows it anyway (a stale composer, a future cap > 1), `listJumpsForParticipant` returns both records honestly; `canJump` is the gate, not the deriver. A test pins this.
12. **Concurrent edits / a new move arrives.** The room re-renders; `listJumpsForParticipant` / `buildJumpMarkers` re-run. Deterministic — claim order is by `createdAt` + `id` tie-break; no race.
13. **Offline / network failure.** GAME-006 is pure UI over already-loaded `arguments`; v1 records are derived, so offline means no new data. The markers keep describing the last-known state. The Jump control's confirm step routes to the composer, which already handles its own offline/submit-failure path — GAME-006 adds none. No crash.
14. **Reset rule.** The card's Open decision OD-1: does a jump ever reset within a room? **Default: no reset.** `MAX_JUMPS_PER_ROOM` is a flat per-room cap; nothing in v1 resets `jumpsUsed`. A test asserts a participant who used their jump stays `jump_already_used` regardless of how much later it is.
15. **Permission-denied path.** A jump commits as a normal move via `submit-argument` — if RLS or the Edge Function rejects the post, the existing composer error path handles it; the jump simply did not happen (no `JumpBranchRecord` is derived because no move exists). GAME-006 introduces no new permission surface.
16. **Doctrine edge — does a "hot" destination branch get jump priority / a different control?** No. `canJump` reads no heat, no reply count, no popularity — only structural state. A quiet branch and a busy branch present an identical Jump control. The model imports nothing from any heat / score module — enforced by the forbidden-import test.
17. **Doctrine edge — does the old-branch marker imply the participant "lost" or "gave up"?** No. The marker copy is "Moved to another branch" — structural movement only. The ban-list test forbids `lost` / `gave up` / `abandoned` / `quit` / `left` / `defeated`.
18. **Doctrine edge — is a jump a verdict on the old branch ("this branch is dead")?** No. The old branch is kept fully on the record; the marker says nothing about the branch's quality. A jump is one participant's movement, not a judgment of either branch.

---

## §8 — Test plan (Build-phase responsibility)

Per `test-discipline`: tests ship **with** the Build-phase code, not as a follow-up. Every public function of `jumpBranchModel.ts` needs happy-path + failure-case coverage; 100% line + branch coverage is achievable (pure TS, no I/O). All tests are Jest, matching repo conventions; pure-model tests import the model directly (no React / Supabase / fetch); component tests use the existing React Testing Library setup.

### `__tests__/jumpBranchModel.test.ts` — pure model

- `deriveParticipantHomeBranch` — returns the branchId of the participant's first qualifying move; returns `null` for a participant with no qualifying move; a one-word non-move never counts (reuses `isQualifyingResponse`).
- `listJumpsForParticipant` — no jump when all moves are on one branch; one jump when a later qualifying move is on a different branch (`fromBranchId` / `toBranchId` / `at` / `viaArgumentId` correct); two jumps when the branch changes twice; chronological order.
- `jumpsUsed` — `0` for a non-jumper, `1` after one jump; returns `0` when `roomId !== roomContract.roomId` (defensive).
- `buildBranchEngagementMap` — a mainline branch is `openToEngagement: true`, `isMainline: true`; an active chime-in branch is open; a `movedToObserver` chime-in branch is `openToEngagement: false`; an `evidence_passthrough` branch is `openToEngagement: false`.
- `buildJumpMarkers` — one `JumpBranchRecord` yields exactly two markers (`departed_from` on `fromBranchId`, `arrived_at` on `toBranchId`); `whenLabel` from `formatRelativeShort`; empty room → `[]`.
- `buildJumpControlViewModel` — `enabled` mirrors `eligibility.ok`; `disabledReasonLabel` non-null exactly when disabled; confirm copy present.
- **Determinism:** `listJumpsForParticipant` / `buildJumpMarkers` twice on the same input → deeply-equal frozen output. **No-mutation:** frozen input arrays are not mutated (`Object.freeze` the fixtures, assert no throw).
- **API surface:** the module exports no `forceJump` / `resetJumps` / `setJumpCount` function (the once-per-room cap + no-reset default are encoded by omission) — assert `typeof (mod as any).resetJumps === 'undefined'`.
- Edge cases §7: empty room, two-moves-same-branch (no jump), jump-then-stay (no second jump), jump-to-mainline (ok + seat role unchanged), unknown destination.

### `__tests__/jumpBranchEligibility.test.ts` — `canJump` matrix

- Full `canJump` permutation matrix (seat role × used-jump count × destination state), one `it` per `JumpDenyReason` plus the allowed path:
  `not_a_chime_in` (OP, Primary Opponent, observer), `no_active_seat` (moved-to-observer chime-in), `jump_already_used` (`usedJumps >= 1`), `destination_unknown`, `destination_is_home`, `destination_closed` (collapsed branch + evidence branch), and the happy path `{ ok: true, reason: null }` (a chime-in with an active seat, unused jump, valid open destination).
- The fixed reason-precedence order: a participant who is *both* not-a-chime-in *and* has a closed destination reports `not_a_chime_in` (the earlier rule).
- `canJump` reads no clock — calling it with identical inputs yields an identical result regardless of any time fixture.

### `__tests__/jumpBranchDoctrine.test.ts` — ban-list + doctrine

- **Ban-list:** collect every string in `JUMP_BRANCH_COPY` + every label produced by `buildJumpControlViewModel` and `buildJumpMarkers` across all permutations; assert none contains (case-insensitive) `winner`, `loser`, `correct`, `incorrect`, `true`, `false`, `right`, `wrong`, `won`, `lost`, `defeated`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `popular`, `trending`, `viral`, `like`, `dislike`, `vote`, `troll`, `bot`, `booted`, `kicked`, `banned`, `abandoned`, `quit`, `gave up`, `deserted`.
- `looksLikeInternalCode` returns `false` for every visible string (no `snake_case` / enum-value leak — the enum value `jump_already_used` must never appear in a user string; the label is "You have already used your one jump …").
- **Forbidden imports:** source-scan `jumpBranchModel.ts` — assert it imports nothing from `react`, `../../lib/supabase`, any score / standing / heat / anti-amplification module, or any network module. A jump is not influenced by score or heat — proven by the absence of the import.
- **No service-role / no Edge Function:** source-scan `jumpBranchModel.ts` + the two components for `SERVICE_ROLE` / `service_role` / `functions.invoke` → zero matches.

### `__tests__/jumpBranchControl.test.tsx` — component

- Renders the Jump action `<Pressable>` for a chime-in viewer with an active seat; `accessibilityRole="button"`, `accessibilityLabel`, `≥44px` hit target.
- Tapping the action does **not** jump — it opens the confirm step; only the confirm button commits (`onConfirmJump` fired); cancel dismisses (`onCancel`, no commit).
- Disabled state: `enabled === false` renders the control with `accessibilityState={{ disabled: true }}` and the `disabledReasonLabel` as visible text (no silent no-op).
- The confirm + cancel buttons are focusable in reading order; the disabled-reason is exposed to the screen reader.
- Grayscale snapshot — the enabled vs disabled distinction is shape/text, not color alone.

### `__tests__/jumpBranchMarker.test.tsx` — component

- Renders a `departed_from` marker with the "Moved to another branch" copy + `whenLabel`.
- Renders an `arrived_at` marker with the "A chime-in joined this branch" copy + `whenLabel`.
- Every visible string inside `<Text>`; the marker root exposes `accessibilityLabel`; the marker is non-interactive (no `Pressable`).

(Test-count expectation: roughly +70–90 tests across the five files. The implementer updates `docs/current-status.md` with the confirmed number after `npm run test` passes — per test-discipline, only after it actually passes.)

---

## §9 — Dependencies (cards / docs / files)

- **Assumes GAME-004 (#141) is complete** — MERGED. GAME-006 imports `RoomContract`, `RoomArgumentInput`, `QualifyingResponseSignals`, `isQualifyingResponse` from `src/features/debates/roomContractModel.ts`. The OP + Primary Opponent are fixed to the mainline and never jump.
- **Assumes GAME-005 (#142) is complete** — MERGED. GAME-006 imports `SeatRole`, `PublicRoomSeatMap`, `MovedToObserverRecord` from `src/features/debates/publicSeatModel.ts`. Jump Branch is a public-room *chime-in* action — only `chime_in` seats may jump; a moved-to-observer participant cannot. GAME-005 §11 explicitly named GAME-006 as a downstream consumer ("GAME-006 navigates to a chime-in branch GAME-005's seat map identifies").
- **Assumes BR-004 (#143) is complete** — MERGED. GAME-006 consumes `BranchDirection` / `BranchGrammarNode` from `src/features/arguments/branchGrammarModel.ts` for branch identity + direction. It does **not** redesign branch grammar or visuals (card non-scope, verbatim).
- **References IX-004 (#135)** — MERGED. The arrival display surfaces near the IX-004 readout panel; IX-004 is referenced as a precedent and is not modified (§0 D4).
- **Reads existing schema:** `public.arguments` `(id, parent_id, author_id, created_at, status, …)` — confirmed in `supabase/migrations/20260516000001_initial_schema.sql`. No new table, no new column, no RLS change.
- **Reuses existing copy infrastructure:** `gameCopy.ts` (`looksLikeInternalCode`, the frozen-block convention), `formatRelativeShort` from `src/lib/formatDateTime.ts`.
- **Card-vs-reality note:** the card references **QOL-025's "no-silent-no-op rule"**; QOL-025 has no design doc in the repo (§0 D4). GAME-006 encodes the principle directly — every disabled Jump control carries a visible plain-language reason — and does not depend on a QOL-025 artifact.
- **Future migration card** plugs into the §4 seam only if a jump must exist independently of a move — not needed by this card.

---

## §10 — Risks

- **Jump abuse / branch-hopping griefing (the headline risk, named by the card).** Mitigations are structural and tested: the **once-per-room cap** (`MAX_JUMPS_PER_ROOM = 1`, enforced by `canJump`), the **confirm step** (a jump can never be an accidental tap), the **deterministic `canJump` predicate** (no way to jump into a closed branch / when out of jumps / as a non-chime-in), and the **auditable markers** (every jump leaves a visible old-branch + arrival record). A jump cannot be spammed.
- **The Jump control being mistaken for a one-tap action.** Mitigation: the two-step confirm gate is part of the *contract* (`JumpControlViewModel` carries `confirmPrompt` / `confirmLabel` / `cancelLabel`) — the component cannot ship without it, and `jumpBranchControl.test.tsx` asserts tapping the action does not commit. The card repeats "deliberate, confirm-required" three times; the design encodes it three ways (the confirm step, the test, the copy).
- **Room-shell wiring.** GAME-006 mounts a Jump control + markers into the room shell. GAME-005 already established the additive-mount path; GAME-006's additions are optional-prop, no-render-by-default. If threading the memoized derivations is fiddly, an acceptable degraded fallback is to render the markers (which need no viewer context) and gate the Jump control behind a later wiring step — but prefer the full wiring.
- **Branch-placement join.** `listJumpsForParticipant` needs a `Map<argumentId, branchId>`. The room already builds the BR-004 grammar map (keyed by `branchId`, with per-node `branchId`); the caller projects `argumentId → branchId` from the timeline map's nodes. If that projection is awkward, the implementer should add a tiny pure helper *in the room shell* (not in the model) — the model takes the map as input and stays decoupled.
- **`MAX_JUMPS_PER_ROOM = 1` is a judgement call.** It is a single named constant so OD-1 can tune it (or a per-phase reset can be added) with one edit; tests pin the boundary (1 used → `jump_already_used`).
- **No existing test should need updating.** GAME-006 adds new files + an additive copy block + optional-prop UI. The GAME-004 / GAME-005 models, the BR-004 grammar, the IX-004 panel, and the composer are untouched; their tests are unaffected.

---

## §11 — Out of scope

Explicitly **not** in GAME-006 (each is named in the card's Non-scope / Do-not sections or follows from doctrine):

- **Branch grammar / visuals** (mainline / vertical / diagonal rendering) → **BR-004** (merged; consumed, not rebuilt).
- **Chime-in governance** (seats, reactions, observer fallback) → **GAME-005** (merged; consumed, not rebuilt).
- **The 1v1 contract / Primary Opponent / seat assignment** → **GAME-004** (merged; consumed, not rebuilt). A jump never changes which seat a participant holds.
- **Any Supabase schema change** — no `jump_branch_records` table, no new column, no migration. A follow-up migration card owns persistence *only if* a future card needs a move-independent jump (§4).
- **Any Edge Function** — the jump commits via the **existing** `submit-argument` path; no new function, no change to `submit-argument`.
- **Notifications / alerts / push** — "OP / Primary Opponent can see the arrival" is satisfied by the on-timeline marker; push is a v1 scope ban (§0 D5).
- **A route / screen transition** — everything renders in the existing room shell (the card states "No route transition" twice).
- **Multi-jump / per-phase jump reset** — v1 is a flat once-per-room cap, no reset (OD-1 default).
- **Destination arrival approval** — `destination_needs_approval` exists as an inert future hook only (OD-2 default: no approval gate).
- **Bot jump policy** → GAME-008. v1 inherits the GAME-004 bot-exclusion, so a bot move never derives as a jump.
- **Profile / display-name loading** — markers are labeled by role relative to the viewer ("A chime-in" / "You"), never by name.

---

## §12 — Doctrine self-check

- **cdiscourse-doctrine §1 (score is gameplay analysis, never truth; score never blocks posting).** A Jump is a *structural movement* mechanic — `JumpBranchRecord` / `JumpEligibility` carry zero verdict words, zero score, zero band. `canJump` returns `active`-style structural eligibility, never "correct/incorrect". A jump has no post-blocking power — it commits *as* a normal move through the unchanged `submit-argument` path; `canJump` gates the *Jump affordance*, never the ability to post. Enforced by `jumpBranchDoctrine.test.ts` (ban-list + no-block assertion).
- **cdiscourse-doctrine §2 (heat = activity).** Heat is never an input. `canJump` reads only seat role, used-jump count, and destination structural state. `jumpBranchModel.ts` imports nothing from any heat module — enforced by the forbidden-import test. A hot destination and a quiet destination present an identical Jump control.
- **cdiscourse-doctrine §3 (popularity is not evidence).** A jump destination is not chosen or gated by reply count, view count, or engagement. `BranchEngagementState` carries only `direction` + `openToEngagement` + `isMainline` — all structural. No popularity signal anywhere.
- **cdiscourse-doctrine §4 / §7 (AI limits, no client AI).** GAME-006 makes no AI call. `canJump` and every derivation are deterministic pure TS. No classification, no annotation, no summary.
- **cdiscourse-doctrine §5 (rules engine sacred).** `src/lib/constitution/engine.ts` is untouched. No new rule, no flag, no transition.
- **cdiscourse-doctrine §6 (secrets).** No new key, no `.env*` change. No service-role anywhere — `jumpBranchModel.ts` is pure TS; the components are pure presentation; the jump commits via the existing RLS-bound `submit-argument` path.
- **cdiscourse-doctrine §8 (Supabase conventions; never hard-delete).** No migration in v1. The old branch a participant jumps away from is **never deleted or hidden** — the `departed_from` marker is purely additive; every move on it stays on the record (same discipline as flags being dismissed not deleted).
- **cdiscourse-doctrine §9 (plain language).** Internal enum values (`jump_already_used`, `chime_in`, `departed_from`) never reach a user string — every visible string routes through `JUMP_BRANCH_COPY`. `looksLikeInternalCode` returns false for each, tested.
- **cdiscourse-doctrine §10 (v1 scope guards).** No voting / winner — a Jump produces no winner and is not a vote. No real-time collab, no OAuth, no public API, **no push notification** (the arrival is an on-timeline marker, not a push — §0 D5), no search.
- **point-standing-economy (movement stays separate from standing).** A `JumpBranchRecord` and a `JumpEligibility` carry no numeric field, no band, no debt. Jumping does not change a single point of anyone's standing; a chime-in who jumps to the mainline is still a `chime_in` seat with unchanged standing. `jumpBranchModel.ts` imports nothing from `argumentScoreModel` / `pointStanding` / `antiAmplification` — enforced by the forbidden-import test.
- **accessibility-targets.** The `JumpBranchControl` action `<Pressable>` carries `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState` (`disabled` when ineligible), and a `≥44px` hit target (`hitSlop` if the visual is smaller). The confirm step is reachable **without a pointer** — confirm + cancel are focusable `<Pressable>`s in reading order, keyboard-operable on web. The disabled state **exposes its reason** to the screen reader (no silent no-op). The enabled/disabled distinction is shape/text, not color-only (grayscale-verified). `JumpBranchMarker` is informational (no `Pressable`) and exposes an `accessibilityLabel` on its root.
- **expo-rn-patterns.** No new dependency — both components are `<View>` + `<Text>` + `<Pressable>` primitives. `jumpBranchModel.ts` is pure TS with no React / Supabase import (matches the `*Model.ts` convention beside `publicSeatModel.ts`). The components are thin presentational layers over view-models.
- **test-discipline.** Five test files ship with the Build-phase code (model, eligibility matrix, doctrine, two component suites), covering every public function's happy + failure paths, the full `canJump` matrix, the once-per-room counter, the marker derivation, and the ban-list. Tests are part of this card's deliverable, not a follow-up.

---

## §13 — Operator steps / decisions

**Operator deploy step: None — pure code change.** No migration (`npx supabase db push` not needed), no Edge Function deploy, no new env var, no new dependency. GAME-006 adds a pure-TS model, a copy block, two read-only RN components, and a minimal additive room-shell wiring step. A jump commits through the **existing, already-deployed** `submit-argument` path — nothing new for the operator to deploy.

**Operator decisions (isolated — none gate the build):**

- **OD-1 — does a jump ever reset?** The card's default is **no reset** within a room — `MAX_JUMPS_PER_ROOM = 1` is a flat per-room cap. v1 ships the no-reset default. If the operator wants a per-topic-phase reset, that is a future card; the constant + the derived `jumpsUsed` make it a one-spot change (the deriver would scope the count to the current phase). **Confirm: keep `MAX_JUMPS_PER_ROOM = 1`, no reset, for v1.**
- **OD-2 — may a destination branch require arrival approval?** The card's default is **no approval gate in v1**. The `JumpDenyReason.destination_needs_approval` value exists but `canJump` never returns it in v1. If the operator later wants destination owners to welcome arrivals in, a future card wires the approval input — no signature change. **Confirm: no arrival-approval gate for v1.**
- **OD-3 — final Jump Branch copy.** The strings in `JUMP_BRANCH_COPY` (action label, confirm prompt, disabled reasons, marker copy) need a copy review to confirm none reads as punitive or as a verdict on the participant or the branch. The card lists wording as an Open decision area. Single frozen block — a one-spot copy edit.

---

## Appendix — Implementer notes

- **Place the model in `src/features/debates/`** — beside `publicSeatModel.ts` (the GAME-005 model GAME-006 extends), NOT in `src/features/arguments/` and NOT in a new `src/features/rooms/` folder (which does not exist — §0 D1, and GAME-004/GAME-005 both made the same call).
- **`BranchGrammarNode` / `BranchDirection` are imported as types** from `src/features/arguments/branchGrammarModel.ts`. Import them as `import type { … }` so the model stays decoupled from the branch-grammar render concern — the same discipline `publicSeatModel.ts` used importing `CollapsedBranchSummary`.
- **The jump commits via the existing composer.** Do NOT add a new submit path, a new Edge Function call, or a direct `arguments` insert. The confirm step's `onConfirmJump` callback should route to the existing reply composer with the destination branch's root message id as the reply parent — that is the entire commit mechanism (§3.2).
- **`canJump` has no `nowMs` parameter** — the rate limit is a count, not a window (§2.4). Do not add a clock parameter; it would make the predicate harder to test for no benefit.
- Run `npm run typecheck`, `npm run lint`, and `npm run test` before claiming the card done; update `docs/current-status.md` with the confirmed new test count only after `npm run test` passes (test-discipline).
