# GAME-005 — Public room participant seats and chime-in governance

**Status:** Design draft
**Epic:** Rules UX (PvP argument-game roadmap expansion)
**Release:** 6.7
**Priority / Effort:** P1 / L
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/142
**Branch:** `feat/GAME-005-game-005-public-room-participant-seats-a`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\GAME-005.md`

**Depends on (verified against the repo at the head of this worktree — Stage 6.4 complete):**
- **GAME-004** (1v1 PvP room contract + Primary Opponent model, #141) — MERGED. Model shipped at `src/features/debates/roomContractModel.ts` (NOT `src/features/rooms/` as the GAME-004 design proposed — see §0 D1). Owns `RoomContract`, `RoomType`, `PrimarySeat`, `buildRoomContract`, `resolvePrimaryOpponent`, `RoomContractViewModel`, `buildRoomContractViewModel`, `RoomParticipantInput`, `RoomArgumentInput`, `QualifyingResponseSignals`, `ROOM_CONTRACT_COPY`. UI at `src/features/debates/RoomContractSeatStrip.tsx`; read hook at `src/features/debates/useRoomContract.ts`. Design: `docs/designs/GAME-004.md`.
- **BR-004** (branch grammar — mainline / vertical chime-in / diagonal tangent, #143) — MERGED. Model shipped at `src/features/arguments/branchGrammarModel.ts`. Owns `BranchDirection` (incl. `chime_in_vertical`), `BranchGrammarNode`, `buildBranchGrammarMap`, `CollapsedBranchSummary`, `buildCollapsedBranchSummary`, `BRANCH_GRAMMAR_COPY`. Design: `docs/designs/BR-004.md`. **GAME-005 consumes this grammar; it does not redesign it.**
- **IX-004** (timeline selected-message readout, #135) — MERGED. `src/features/arguments/timelineSelectedReadoutModel.ts` + `TimelineSelectedReadoutPanel.tsx`. GAME-005's read-time metrics may surface near this panel; GAME-005 does not modify it.

---

## §0 — Card-vs-reality discrepancies (read this first)

The card body names symbols, file paths, and shapes that were checked against the actual repo at the head of this worktree. Where the card and reality disagree, **the design follows reality** — the same discipline GAME-004 §0 and BR-004 §0 applied.

| # | Card / coordinator brief says | Reality | Design decision |
|---|---|---|---|
| D1 | "Check where the GAME-004 room-contract model lives and place GAME-005's model consistently." GAME-004's own design proposed `src/features/rooms/roomContractModel.ts`. | **`src/features/rooms/` does not exist.** GAME-004 actually shipped to `src/features/debates/roomContractModel.ts` + `RoomContractSeatStrip.tsx` + `useRoomContract.ts`. BR-004 shipped to `src/features/arguments/branchGrammarModel.ts`. | GAME-005's new pure-TS model ships as **`src/features/debates/publicSeatModel.ts`** — beside `roomContractModel.ts`, the GAME-004 contract it extends. The thin React layer ships beside `RoomContractSeatStrip.tsx`. A one-file `rooms/` folder would split GAME-005 from its direct GAME-004 dependency. |
| D2 | `docs/roadmap-expansions/2026-05-20-pvp-argument-game-roadmap.md` (the parent PvP roadmap) is named as required reading. | **That file does not exist.** `Glob "docs/roadmap-expansions/**"` returns only `2026-05-20-mcp-semantic-referee-roadmap.md`. GAME-004 §0 made the identical finding against the same phantom path. | This design depends only on the issue body, the merged GAME-004 / BR-004 code + designs, and `docs/core/ux-ui-project-board.md`. The missing roadmap doc is **not** a blocker — the card body is self-sufficient. |
| D3 | "Check whether the `debate_participants` table / a public-room concept exists in the schema." The card's `PublicSeat` shape implies a persisted seat record. | `public.debate_participants` exists (`supabase/migrations/20260516000001_initial_schema.sql` lines 164–173) with `(debate_id, user_id, side, joined_at)`. `side` is a **CHECK-constrained** enum: `'affirmative' | 'negative' | 'observer' | 'moderator'`. There is **no `seat_index`, no `role`, no `chime_in` value, no `governance_reaction` table, no public-room flag**. GAME-004 already established `roomType` is **not derivable from persisted data** and is a caller-supplied input. | GAME-005 ships **no migration and no Edge Function** (see §4). The public-seat model is **derived at read-time** from `debate_participants` + `arguments` + the GAME-004 `RoomContract` + the BR-004 grammar map — exactly the no-persistence pattern GAME-004 and BR-004 both used. Governance reactions in v1 are **ephemeral, in-session, caller-supplied** input to a deterministic evaluator; v1 does not persist a reaction. §1.6 and §4 state the exact seam a future migration card plugs into. The card body itself says "No Supabase schema change without a follow-up migration card" — this design honors that. |
| D4 | `PublicSeat { seatIndex 1..6, userId, role: 'initiator' \| 'primary_opponent' \| 'chime_in' }`. | GAME-004 already names the two primary roles `PrimarySeat = 'initiator' \| 'primary_opponent'`. The CHECK constraint on `debate_participants.side` has no `chime_in` value. | GAME-005 keeps the card's `PublicSeat` shape **but reuses GAME-004's vocabulary**: `SeatRole = 'initiator' \| 'primary_opponent' \| 'chime_in'` is a superset of GAME-004's `PrimarySeat` (the two primary literals are identical, so a `PublicSeat` for a primary seat is consistent with the GAME-004 contract). `chime_in` is a **derived seat role only** — it is never written to `debate_participants.side` (that column stays `affirmative/negative/observer/moderator`). §1.1. |
| D5 | "the both-parties threshold", "a defined rule window" — the card leaves the window length and threshold timing as Open decisions. | Nothing in the repo defines a governance window. | GAME-005 ships the window as a **single frozen named constant** (`CHIME_IN_GOVERNANCE_WINDOW_MS`, proposed `24 * 60 * 60 * 1000` = 24h) so the operator tunes it with one edit. `evaluateChimeInStanding` takes `nowMs` and is fully deterministic. **OD-1** asks the operator to confirm the value. The "both-parties threshold" is non-negotiable doctrine (anti-abuse), not tunable — it is encoded structurally, not as a constant. |
| D6 | "GAME-006 (Jump Branch) and GAME-008 (bot public-room policy)" are downstream consumers. | GAME-006 and GAME-008 are open, not merged. | GAME-005 ships the **public-seat model + governance evaluator + observer-fallback transition + read-time metrics**. It ships **no Jump Branch navigation** (GAME-006) and **no bot seat policy** (GAME-008). §7 documents both seams. GAME-005 does not redesign or pre-empt either. |
| D7 | "the reaction set ... `useful` · `not useful / off-track` · `needs source` · `move to tangent`" — and "Final reaction labels ... is an Open decision". | `BR-004` already ships `gameCopy.BRANCH_GRAMMAR_COPY`; `OBSERVER_COPY` (Stage 6.4) exists. There is no governance-reaction copy block. | GAME-005 adds a frozen **`CHIME_IN_GOVERNANCE_COPY`** block in `src/features/arguments/gameCopy.ts` beside `BRANCH_GRAMMAR_COPY`. The four reaction *kinds* are a stable enum (`GovernanceReactionKind`); the user-facing **labels** route through the copy block so **OD-2** can re-word them without touching logic. The card's doctrine note ("prefer `useful / not useful` over `like/dislike`") is honored: no like/dislike vocabulary anywhere. |

None of these block the card. The pure-TS model, the deterministic seat derivation, the governance evaluator, the observer-fallback transition, and the read-time metrics are all buildable today with **no migration and no Edge Function**. Three operator decisions are isolated and do not gate the build: **OD-1** (the governance window length), **OD-2** (final reaction-label copy), **OD-3** (the re-entry / appeal path — deliberately deferred, see §3.4).

### Cannot proceed? — No.

The card is buildable. Every contract the issue asks for is a deterministic function of data the room already loads at read-time:
- The **6-seat cap + chime-in role** is a pure derivation over `debate_participants` + `arguments` + the GAME-004 `RoomContract` (§1).
- **`evaluateChimeInStanding`** is a pure, deterministic function of a reaction list + a window + `nowMs` (§3.1) — exactly the shape the card names.
- **Read-time metrics** (seat count, chime-in count, branch states) fall out of the seat map + the BR-004 grammar map (§5).
- **Governance reactions** in v1 are ephemeral in-session input; persistence is a documented, isolated future-migration seam (§4) — the card explicitly permits deferring schema.

The only thing GAME-005 cannot do without a migration is **persist** a governance reaction across sessions / devices. The card's own "Do not implement" line says "No Supabase schema change without a follow-up migration card", and the card's UI section says governance reactions are "a small constrained control". v1 ships the **deterministic model + the control + the read-time metrics**; cross-session persistence of reactions is a clearly-named follow-up migration card (§4, §11). Proceed.

---

## Goal (one paragraph)

GAME-005 defines **public-room participant seats** and **chime-in governance** — the layer that lets a public argument room scale past the GAME-004 1v1 mainline without (a) drowning the OP↔Primary-Opponent spine, (b) letting the two primary parties silence a good challenger, or (c) introducing any popularity-as-evidence, public shaming, or person-verdict mechanic. Concretely: a public room has an **active-seat cap of 6** — seat 1 the Initiator (OP), seat 2 the Primary Opponent, seats 3–6 **chime-in participants**; everyone past the cap is an observer, with no failure state. A chime-in's first move opens a **vertical branch** off the mainline — and GAME-005 *consumes* BR-004's `chime_in_vertical` branch direction for that; it does not re-derive branch grammar. The two primary parties (and only them) can apply **governance reactions** — `useful` · `not useful / off-track` · `needs source` · `move to tangent` — which are **participation-structure signals, never correctness votes**. When **both** primary parties mark the same chime-in `not useful / off-track` within a bounded rule window, that participant becomes **observer-only** for the room — a structural transition framed as "moved to observer", never "booted" — and their on-record branch collapses into a "Side branches" area but stays fully in the record. The deliverable is a **pure-TS deterministic model** (`publicSeatModel.ts`) plus a **small read-time governance control + metrics surface** in the existing room shell. The doctrine anchor, inherited from GAME-004 and BR-004: **a seat describes a structural game ROLE, never the person; a governance reaction describes participation STRUCTURE, never correctness; losing a seat is a structural transition, never a penalty or a verdict.** Heat, popularity, reply count, and standing are never inputs to seat assignment or governance. GAME-005 ships **no migration, no Edge Function, no Supabase write, no AI call, no service-role, no new dependency, no route transition.**

---

## §1 — Data model: public seats + chime-in role

All types are pure TypeScript, exported from a new `src/features/debates/publicSeatModel.ts`. No React / Supabase / network / AI imports. JSON-serializable so the same model could run in an Edge Function later if a follow-up persistence card needs it server-side. The model **imports types from GAME-004's `roomContractModel.ts`** (it extends that contract) and **mirrors BR-004's `BranchDirection` as a consumed type** (it does not import a render concern).

### 1.1 `SeatRole` — the seat vocabulary (extends GAME-004)

```ts
/**
 * GAME-005 — the role a public-room seat plays. The two primary literals
 * are IDENTICAL to GAME-004's `PrimarySeat` so a `PublicSeat` for seat 1
 * or 2 is consistent with the existing RoomContract. `chime_in` is a
 * DERIVED role only — it is NEVER written to `debate_participants.side`
 * (that column's CHECK constraint stays affirmative/negative/observer/
 * moderator). A user's `chime_in` standing is read-time state.
 */
export type SeatRole = 'initiator' | 'primary_opponent' | 'chime_in';

/** Active-seat cap for a public room. Seat 1 OP, seat 2 Primary Opponent,
 *  seats 3-6 chime-ins. Beyond the cap -> observer. OD-1 may confirm; the
 *  card proposes 6. Single named constant so a tuning card is one edit. */
export const PUBLIC_ROOM_SEAT_CAP = 6;

/** The number of seats reserved for the two primary parties. Seats 3..N
 *  are chime-in seats. Derived: chime-in capacity = CAP - PRIMARY_SEATS. */
export const PRIMARY_SEAT_COUNT = 2;
```

### 1.2 `PublicSeat` — one seat record (the card's named shape)

The card names `PublicSeat { seatIndex 1..6, userId, role }`. GAME-005 keeps that shape and derives every field.

```ts
/**
 * GAME-005 — one occupied active seat in a public room. Pure derived data,
 * never persisted. `seatIndex` is 1-based: 1 = OP, 2 = Primary Opponent,
 * 3..PUBLIC_ROOM_SEAT_CAP = chime-in seats in deterministic claim order.
 */
export interface PublicSeat {
  /** 1-based seat index, 1..PUBLIC_ROOM_SEAT_CAP. */
  seatIndex: number;
  /** The user holding the seat. Never rendered as raw text — labels are
   *  role-relative ("You" / "Chime-in 1" / etc.), never the person name. */
  userId: string;
  /** The seat's structural role. */
  role: SeatRole;
  /**
   * Chime-in standing. For role 'initiator' / 'primary_opponent' this is
   * always 'active'. For role 'chime_in' it is the output of
   * `evaluateChimeInStanding` — 'active' or 'observer_only'. A seat that
   * is 'observer_only' is NOT in `activeSeats` (it has been moved to
   * observer); it appears only in `movedToObserver` (§1.4).
   */
  standing: ChimeInStanding;
}

/** A chime-in's structural standing in the room. Never a verdict. */
export type ChimeInStanding = 'active' | 'observer_only';
```

### 1.3 `PublicRoomSeatMap` — the full read-time projection

```ts
/**
 * GAME-005 — the derived public-room seat layout. Recomputed on every room
 * load from `debate_participants` + `arguments` + the GAME-004 RoomContract
 * + (optionally) the in-session governance reactions. Never persisted.
 */
export interface PublicRoomSeatMap {
  roomId: string;
  /** The active seats, ordered by seatIndex ascending (1..N). Length is
   *  0..PUBLIC_ROOM_SEAT_CAP. Always includes the OP when a room exists. */
  activeSeats: ReadonlyArray<PublicSeat>;
  /**
   * Users who reached the room as active participants but are now
   * observer-only — either because the cap was full when they arrived
   * (overflow) or because both primary parties moved them to observer
   * (governance fallback). Each carries WHY, for non-punitive copy.
   */
  movedToObserver: ReadonlyArray<MovedToObserverRecord>;
  /** True when every active seat is filled (length === PUBLIC_ROOM_SEAT_CAP). */
  isCapReached: boolean;
  /** Count of free chime-in seats (0 when full or when primaries unseated). */
  openChimeInSeatCount: number;
}

/** GAME-005 — a user who is observer-only, plus the structural reason. */
export interface MovedToObserverRecord {
  userId: string;
  /**
   * 'overflow'  — arrived after the 6-seat cap was full; never held a seat.
   * 'governance'— held a chime-in seat; both primaries marked the chime-in
   *               'not useful / off-track' within the window.
   */
  reason: ObserverFallbackReason;
  /** The branchId of this user's on-record chime-in branch, if any. The
   *  branch STAYS in the record; it may collapse into "Side branches".
   *  null for an 'overflow' user who never posted. */
  branchId: string | null;
}

export type ObserverFallbackReason = 'overflow' | 'governance';
```

### 1.4 How a chime-in seat is claimed — deterministic, structural

The card: "a chime-in's first entry creates a vertical branch off the mainline." GAME-005 must decide *who occupies seats 3–6* without persistence and without reading heat / popularity. The rule, mirroring GAME-004's `resolvePrimaryOpponent` first-qualifying-response discipline:

- Seats 1 and 2 are the GAME-004 `RoomContract.initiatorUserId` and `RoomContract.primaryOpponentUserId`. GAME-005 **reuses GAME-004's resolution verbatim** — it does not re-derive the primary seats.
- A **chime-in** is any user who has authored a posted argument in the room that is **not** the OP, **not** the Primary Opponent, **not a bot** (bot seat policy is GAME-008 — §7), and whose move qualifies (reuses GAME-004's `isQualifyingResponse` predicate so a one-word "lol" never claims a chime-in seat — anti-sniping is inherited, not re-invented).
- Chime-in seats 3–6 are assigned in **deterministic claim order**: the chronological order of each chime-in's *first qualifying move* (sort by `createdAt` asc, tie-break by `id` asc — identical determinism to GAME-004).
- The 3rd through 6th distinct qualifying chime-in fill seats 3–6. The **7th and beyond are `movedToObserver` with `reason: 'overflow'`** — no failure state, no error.

This is purely structural: claim *order*, never claim *quality* or *popularity*. A test feeds a 9-chime-in room and asserts seats 3–6 hold the 1st–4th chime-ins by first-move time and the 5th–7th are overflow observers.

### 1.5 `GovernanceReaction` — the card's named shape

```ts
/**
 * GAME-005 — a single governance reaction applied by ONE primary party to
 * ONE chime-in's branch (or a specific message in it). A participation-
 * structure signal, NEVER a correctness vote. v1: ephemeral, in-session,
 * caller-supplied. A future migration card persists these (§4).
 */
export interface GovernanceReaction {
  /** Which primary seat applied it. Only these two may govern. */
  byPrimarySeat: 'initiator' | 'primary_opponent';
  /** The userId of the primary party (for the both-parties check + the
   *  reversibility check — a party may only retract its OWN reaction). */
  byUserId: string;
  /** The chime-in branch this reaction targets (BR-004 branchId) OR a
   *  specific message id within it. Branch-level is the v1 default. */
  targetBranchOrMessageId: string;
  /** The chime-in user the target branch belongs to. Used by
   *  `evaluateChimeInStanding` to group reactions per chime-in. */
  targetChimeInUserId: string;
  /** The reaction kind — a structural signal, see GovernanceReactionKind. */
  kind: GovernanceReactionKind;
  /** ISO timestamp the reaction was applied. Drives the rule window. */
  at: string;
  /**
   * True when the reaction has been retracted (reversibility — §3.3). A
   * retracted reaction is KEPT in the list (audit) but does not count
   * toward the both-parties threshold. Never hard-deleted.
   */
  retracted: boolean;
}

/**
 * GAME-005 — the governance-reaction vocabulary. A STRUCTURAL signal about
 * participation, never a correctness verdict. No like/dislike vocabulary
 * (doctrine). OD-2 confirms the user-facing labels via CHIME_IN_GOVERNANCE_COPY.
 *   'useful'        — this chime-in helps the room; structural "keep".
 *   'off_track'     — this chime-in does not fit the current thread;
 *                     the ONLY kind that counts toward observer-fallback.
 *   'needs_source'  — asks the chime-in for a primary source; advisory.
 *   'move_to_tangent' — suggests routing the chime-in to a tangent branch;
 *                     advisory, hands off to BR-003/BR-004 routing.
 */
export type GovernanceReactionKind =
  | 'useful'
  | 'off_track'
  | 'needs_source'
  | 'move_to_tangent';

/** Frozen list — tests iterate this; copy coverage iterates this. */
export const ALL_GOVERNANCE_REACTION_KINDS: ReadonlyArray<GovernanceReactionKind> =
  Object.freeze(['useful', 'off_track', 'needs_source', 'move_to_tangent']);
```

**Why only `off_track` counts toward observer-fallback:** the observer transition is the one consequential outcome; making *only* the explicitly-structural "does not fit this thread" kind drive it (and requiring *both* parties — §3) keeps `useful` / `needs_source` / `move_to_tangent` purely advisory. `needs_source` is an evidence nudge (it routes to the existing source-request affordance); `move_to_tangent` is a routing nudge (it hands off to BR-003/BR-004). Neither ever demotes anyone.

### 1.6 The persistence seam (no migration in v1)

The card's `GovernanceReaction` and `PublicSeat` *look* like rows. They are not — v1 derives everything at read-time. The seam a **future migration card** plugs into, documented so it is not a surprise:

- A future `public.chime_in_governance_reactions` table `(id, debate_id, by_user_id, target_branch_id, kind, created_at, retracted_at)` with RLS (insert/update scoped to the two primary parties; select to room participants) would feed `GovernanceReaction[]` into `evaluateChimeInStanding` instead of the in-session array. **The model does not change** — it already takes `GovernanceReaction[]` as input.
- The seat *roles* never need persistence — they derive from `debate_participants` + `arguments`, both already loaded.
- The card's "No Supabase schema change without a follow-up migration card" line is honored exactly: v1 ships zero schema, and the persistence card is named, scoped, and isolated.

---

## §2 — API / interface contracts (`publicSeatModel.ts`)

### 2.1 `buildPublicRoomSeatMap(input) → PublicRoomSeatMap`

```ts
export interface BuildPublicRoomSeatMapInput {
  /** The GAME-004 room contract — already built by useRoomContract. */
  roomContract: RoomContract;
  /** All posted `arguments` rows for the room (RoomArgumentInput[] —
   *  GAME-004's narrowed shape, reused verbatim). */
  arguments: ReadonlyArray<RoomArgumentInput>;
  /** All `debate_participants` rows (RoomParticipantInput[] — GAME-004's
   *  narrowed shape). Used only to recognise observers / non-posters. */
  participants: ReadonlyArray<RoomParticipantInput>;
  /** Optional GAME-004 QualifyingResponseSignals — reused so a flagged or
   *  deletion-requested move never claims a chime-in seat. */
  signals?: QualifyingResponseSignals;
  /**
   * The in-session governance reactions (v1: ephemeral, caller-supplied;
   * a future card supplies persisted rows here). Empty array = no
   * governance applied yet. Optional.
   */
  governanceReactions?: ReadonlyArray<GovernanceReaction>;
  /** Current time, ms epoch — for the rule-window evaluation. The caller
   *  passes Date.now(); the model never reads the clock itself. */
  nowMs: number;
}

/**
 * Build the derived public-room seat layout. Pure. Deterministic — calling
 * it twice on the same input yields a deeply-equal frozen result. Steps:
 *  1. Seat 1 = roomContract.initiatorUserId (role 'initiator').
 *  2. Seat 2 = roomContract.primaryOpponentUserId (role 'primary_opponent')
 *     when non-null; otherwise seat 2 is open.
 *  3. Collect distinct chime-in users (qualifying author, not OP, not
 *     Primary Opponent, not a bot) in first-qualifying-move chronological
 *     order. Reuses GAME-004 isQualifyingResponse.
 *  4. Assign seats 3..PUBLIC_ROOM_SEAT_CAP to chime-ins in that order.
 *  5. For each seated chime-in, compute standing via
 *     evaluateChimeInStanding(reactions for that user, window, nowMs).
 *     standing 'observer_only' -> the user moves to movedToObserver
 *     (reason 'governance') and frees the seat (the seat is NOT
 *     re-filled by a later chime-in within the same render — re-fill is
 *     a fresh derivation on the next load; see §6 edge cases).
 *  6. Chime-ins past the cap -> movedToObserver (reason 'overflow').
 */
export function buildPublicRoomSeatMap(
  input: BuildPublicRoomSeatMapInput,
): PublicRoomSeatMap;
```

### 2.2 `evaluateChimeInStanding(reactions, options) → ChimeInStanding`

The card names this exact function: `evaluateChimeInStanding(reactions, window): 'active' | 'observer_only'` — "deterministic; requires *both* primary parties".

```ts
export interface EvaluateChimeInStandingOptions {
  /** The rule window in ms. Defaults to CHIME_IN_GOVERNANCE_WINDOW_MS.
   *  Both qualifying `off_track` reactions must fall inside one window. */
  windowMs?: number;
  /** Current time, ms epoch. The model never reads the clock itself. */
  nowMs: number;
  /** The two primary party userIds — used to validate that the two
   *  `off_track` reactions came from the TWO DISTINCT primaries (not the
   *  same party twice, not a non-primary). When the Primary Opponent seat
   *  is open this is a 1-element array and `evaluateChimeInStanding` can
   *  never return 'observer_only' (governance pauses — §3.5 / OD/edge). */
  primaryUserIds: ReadonlyArray<string>;
}

/**
 * Deterministic governance evaluator for ONE chime-in. Returns
 * 'observer_only' if and only if ALL of the following hold:
 *  - There are at least two NON-retracted `off_track` reactions targeting
 *    this chime-in.
 *  - They were applied by TWO DISTINCT users, BOTH in `primaryUserIds`
 *    (the both-parties requirement — anti-abuse core).
 *  - The two reactions fall within ONE `windowMs` span of each other
 *    (`|t1 - t2| <= windowMs`). Stale single reactions never accumulate
 *    into a demotion across unbounded time.
 * Otherwise returns 'active'. `useful` / `needs_source` / `move_to_tangent`
 * reactions NEVER affect the result. A retracted reaction NEVER counts.
 */
export function evaluateChimeInStanding(
  reactions: ReadonlyArray<GovernanceReaction>,
  options: EvaluateChimeInStandingOptions,
): ChimeInStanding;
```

### 2.3 `canApplyGovernanceReaction(actor, options) → GovernanceActorResult`

The actor matrix is doctrine, not advice — it must be enforced by a pure function the UI gates on (the UI is never the only gate).

```ts
export type GovernanceDenyReason =
  | 'not_a_primary_party'  // observers + chime-ins may never govern
  | 'self_target'          // a primary cannot govern their own content
  | 'primary_seat_open'    // governance pauses when a primary seat is empty
  | 'target_not_chime_in'; // a reaction may only target a chime-in branch

export interface GovernanceActorResult {
  allowed: boolean;
  /** null when allowed; the first failing reason otherwise. */
  reason: GovernanceDenyReason | null;
}

/**
 * Pure predicate. May `actorUserId` apply a governance reaction to
 * `targetChimeInUserId`'s branch in this room? Allowed ONLY when:
 *  - actorUserId is the Initiator or the Primary Opponent, AND
 *  - both primary seats are currently filled (governance pauses if one is
 *    open — §3.5), AND
 *  - the target is a chime-in (not the other primary, not an observer).
 * Chime-ins cannot govern each other; observers cannot govern.
 */
export function canApplyGovernanceReaction(
  actorUserId: string,
  options: {
    roomContract: RoomContract;
    targetChimeInUserId: string;
    seatMap: PublicRoomSeatMap;
  },
): GovernanceActorResult;
```

### 2.4 View-model builders (for the UI)

```ts
/** One row in the read-time public-room metrics strip. Pure data, no JSX. */
export interface PublicRoomMetricsViewModel {
  /** "4 of 6 seats active" — plain language, never a leaderboard. */
  seatCountLabel: string;
  /** "2 people chiming in" — count only, never ranked. */
  chimeInCountLabel: string;
  /** Per-branch state chips (count, recency) — sourced from BR-004's
   *  CollapsedBranchSummary, NOT re-derived. Non-correctness only. */
  branchStateLabels: ReadonlyArray<string>;
  /** Verbose screen-reader summary of the whole strip. */
  accessibilityLabel: string;
}

/** The governance control's view-model for ONE chime-in branch, shown
 *  ONLY to the OP + Primary Opponent. */
export interface GovernanceControlViewModel {
  targetChimeInUserId: string;
  targetBranchId: string;
  /** One entry per GovernanceReactionKind — label + whether THIS viewer
   *  has already applied it (so the control shows applied/not-applied,
   *  toggle = retract). */
  reactions: ReadonlyArray<{
    kind: GovernanceReactionKind;
    label: string;            // from CHIME_IN_GOVERNANCE_COPY
    appliedByViewer: boolean; // viewer may retract their own
    accessibilityLabel: string;
  }>;
  /** Calm, non-punitive status line when the chime-in is observer-only,
   *  e.g. "This chime-in moved to observer. Their side branch is kept." */
  observerFallbackNotice: string | null;
}

export function buildPublicRoomMetricsViewModel(
  seatMap: PublicRoomSeatMap,
  branchSummaries: ReadonlyArray<CollapsedBranchSummary>,
): PublicRoomMetricsViewModel;

export function buildGovernanceControlViewModel(
  args: {
    seatMap: PublicRoomSeatMap;
    targetChimeInUserId: string;
    targetBranchId: string;
    viewerUserId: string;
    governanceReactions: ReadonlyArray<GovernanceReaction>;
  },
): GovernanceControlViewModel;
```

### 2.5 Named constants + copy

```ts
/** GAME-005 — the rule window inside which BOTH primary `off_track`
 *  reactions must fall to move a chime-in to observer. 24h proposed.
 *  Single named constant — OD-1 confirms. */
export const CHIME_IN_GOVERNANCE_WINDOW_MS = 24 * 60 * 60 * 1000;
```

```ts
// added to src/features/arguments/gameCopy.ts, beside BRANCH_GRAMMAR_COPY:
/** GAME-005 — plain-language copy for chime-in governance. Structural,
 *  never a verdict, never person-attribution, never "booted/kicked/banned".
 *  OD-2 confirms final wording. */
export const CHIME_IN_GOVERNANCE_COPY = Object.freeze({
  // Reaction labels — participation-structure, never correctness.
  reaction_useful: 'Helpful here',
  reaction_off_track: 'Off the current thread',
  reaction_needs_source: 'Ask for a source',
  reaction_move_to_tangent: 'Better as a side issue',

  // Reaction one-line explainers (for the control's a11y hint).
  explain_useful: 'Marks this chime-in as helping the current thread.',
  explain_off_track: 'Notes this chime-in does not fit the current thread.',
  explain_needs_source: 'Asks this chime-in for a primary source.',
  explain_move_to_tangent: 'Suggests moving this chime-in to a side branch.',

  // Observer-fallback — calm, non-punitive. Explains access remains.
  moved_to_observer_title: 'Moved to observer',
  moved_to_observer_body:
    'This chime-in moved to observer for this room. They can still read '
    + 'everything and their side branch stays in the record.',
  // Overflow (cap full) — never a failure, never "rejected".
  overflow_observer_body:
    'This room has a full set of active seats right now. New voices join '
    + 'as observers and can still read and follow along.',

  // Seat / metrics strip — counts only, never a ranking.
  seat_count: '{active} of {cap} seats active',
  chime_in_count_one: '1 person chiming in',
  chime_in_count_many: '{count} people chiming in',
  chime_in_count_none: 'No chime-ins yet',
  side_branches_heading: 'Side branches',
} as const);
```

All strings: plain English, no `snake_case`, **zero verdict / amplification / person-attribution / "booted/kicked/banned" tokens**, non-punitive. `looksLikeInternalCode` returns `false` for every visible string.

---

## §3 — Governance model: reactions, window, both-parties threshold, observer fallback

### 3.1 The reaction set and who may apply

- The four kinds are `useful` / `off_track` / `needs_source` / `move_to_tangent` (§1.5). Final user-facing labels are **OD-2** (routed through `CHIME_IN_GOVERNANCE_COPY`).
- **Only the Initiator and the Primary Opponent** may apply a governance reaction (`canApplyGovernanceReaction`). Chime-ins cannot govern each other; observers cannot govern; the public cannot govern.
- A governance reaction targets a **chime-in branch** (or a message within it). A primary cannot govern the mainline, the other primary, or their own content (`self_target` deny).
- Governance reactions are **never** applied to a verdict or a score — they describe participation structure.

### 3.2 The rule window and the both-parties threshold

- The observer-fallback transition fires only when `evaluateChimeInStanding` returns `observer_only`, which requires **both** distinct primary parties to have a non-retracted `off_track` reaction on the same chime-in **within one `CHIME_IN_GOVERNANCE_WINDOW_MS` span**.
- One primary's `off_track` alone **never** demotes anyone — a test asserts this directly (anti-abuse: a single primary cannot silence a challenger).
- Two `off_track` reactions from the *same* primary (e.g. applied, retracted, re-applied) never satisfy the threshold — the model requires two *distinct* `byUserId` values, both in `primaryUserIds`.
- `useful`, `needs_source`, `move_to_tangent` never count toward the threshold regardless of how many primaries apply them.

### 3.3 Reversibility (anti-abuse)

- A primary may **retract their own** reaction at any time (`retracted: true`). The reaction is kept in the list (audit trail) but no longer counts. The model never hard-deletes — consistent with doctrine §8 (flags are dismissed, not deleted).
- Because standing is *recomputed* on every render from the current reaction list, a retraction immediately restores the chime-in to `active` on the next derivation if the both-parties threshold is no longer met. The demotion is fully reversible — no "permanent" state.
- A primary cannot retract the *other* primary's reaction (`canApplyGovernanceReaction` is scoped per-actor; the retract path checks `byUserId === actorUserId`).

### 3.4 Observer-fallback transition (active → chime_in observer-only)

- When a chime-in's standing becomes `observer_only`, that user moves into `movedToObserver` with `reason: 'governance'` and their chime-in seat (3–6) is freed in the current seat map.
- **This is a structural transition, never a penalty or a verdict.** Copy: `moved_to_observer_title` = "Moved to observer", `moved_to_observer_body` explains the user keeps full read access and their branch stays in the record. No "booted", "kicked", "banned", "removed", "rejected" anywhere — the ban-list test enforces it.
- A moved-to-observer user **retains full observer rights**: they can read everything, follow the timeline, and use every observer affordance. They **cannot post new active mainline/chime-in moves** for this room (their seat is gone). They are exactly an observer — not a lesser one.
- Their on-record chime-in branch **stays in the record**. The room shell collapses it into a **"Side branches"** area (`side_branches_heading`) — and this collapse *reuses BR-004's existing `buildCollapsedBranchSummary`*; GAME-005 does not build a new collapse mechanism. The branch is never hidden or deleted.
- **Re-entry / appeal** after moved-to-observer is **OD-3 — deliberately deferred.** The card lists it as an Open decision. v1 ships the doctrine-safe default: a moved-to-observer user stays an observer for the room; because the demotion is reversible *by retraction*, a primary who reconsiders can retract their `off_track` reaction, which on the next render restores the chime-in to `active` (if a free seat exists). That is the v1 re-entry mechanism — no separate appeal flow. A first-class appeal UI is a future card. §11 flags this.

### 3.5 Governance when a primary seat is empty

- The card's edge case: "A primary party leaves → governance needs both; if one seat is empty, governance pauses (Open decision)."
- v1 adopts the **doctrine-safe default: governance pauses.** `canApplyGovernanceReaction` returns `{ allowed: false, reason: 'primary_seat_open' }` whenever `roomContract.primaryOpponentUserId === null`. `evaluateChimeInStanding` is also given `primaryUserIds` with only one entry in that case and can never reach the two-distinct-parties bar — so even a stale reaction set cannot demote anyone while a primary seat is open.
- Rationale: the both-parties requirement is the anti-abuse core. If only one primary exists, "both parties" is unsatisfiable, so governance is structurally paused — not a special case, just the math. This is the conservative, non-silencing default; it is not a separate Open decision needing operator input (it falls out of the doctrine).

---

## §4 — Data model summary: migration / Edge Function decision

**No migration. No Edge Function. No Supabase write. No service-role.**

- The public-seat map, the chime-in roles, the read-time metrics — all **derived per render** from `debate_participants` + `arguments` + the GAME-004 `RoomContract` + the BR-004 grammar map. All four are already loaded by the existing room shell (`useRoomContract` already reads `debate_participants` and `arguments`; the timeline already builds the BR-004 grammar map).
- Governance reactions in v1 are **ephemeral, in-session, caller-supplied** input to `evaluateChimeInStanding`. They live in React state (e.g. a `useState` array, or a small `useChimeInGovernance` hook) for the lifetime of the room view. They are **not** persisted.
- **Consequence (stated honestly):** a governance reaction does not survive a reload or sync across devices in v1. Two primaries on two devices cannot complete a both-parties demotion across sessions until a persistence card lands. This is acceptable for a v1 governance scaffold and matches the card's own "No Supabase schema change without a follow-up migration card". The deterministic model is built and tested now; the persistence card is small and isolated (§1.6, §11).
- The seam is exact: the future `public.chime_in_governance_reactions` table feeds the *same* `GovernanceReaction[]` into the *same* `evaluateChimeInStanding`. The model is forward-compatible with zero change.

**Operator deploy step for GAME-005 itself: none.** Pure code change (a pure-TS model, a copy block, a small read-time UI surface, a thin governance hook holding in-session state).

---

## §5 — Read-time public-room metrics (non-correctness only)

The card scope item: "Read-time public-room metrics (seat count, chime-in count, branch states) — non-correctness only."

- **Seat count** — "4 of 6 seats active" via `seat_count`. A capacity readout, never a leaderboard, never ranked.
- **Chime-in count** — "2 people chiming in" via `chime_in_count_*`. A count, never ordered by "quality".
- **Branch states** — sourced directly from BR-004's `CollapsedBranchSummary` (count · recency · unresolved · primary-party-engaged). GAME-005 **does not re-derive** branch state — `buildPublicRoomMetricsViewModel` *consumes* the BR-004 summaries the timeline already built. Recency is "active 2h ago"-style (BR-004's `formatRelativeShort`), never a raw timestamp, never a "hotness rank".
- **Doctrine guard:** none of these are truth or quality signals. A high seat count does not mean the room is "right"; a chime-in with many replies is not "winning". `buildPublicRoomMetricsViewModel` reads only counts + structural BR-004 fields — it imports nothing from any score / standing / heat / anti-amplification module (enforced by the forbidden-import test, §10).
- **Where it surfaces:** the metrics strip renders inside the existing room shell, near the GAME-004 `RoomContractSeatStrip` and/or the IX-004 readout panel — as a read-only addition. GAME-005 **does not modify** the IX-004 panel; it renders a sibling strip. The card says "No route transition" — honored; everything renders in place.

---

## §6 — Consuming BR-004's branch grammar + GAME-004's room contract

GAME-005 is a **consumer** of both merged cards. It re-derives nothing they own.

**From GAME-004 (`roomContractModel.ts`):**
- `RoomContract` — the source of seats 1 and 2 (`initiatorUserId`, `primaryOpponentUserId`). GAME-005 imports `RoomContract`, `RoomArgumentInput`, `RoomParticipantInput`, `QualifyingResponseSignals`, `isQualifyingResponse`, `PrimarySeat`.
- `isQualifyingResponse` — reused verbatim so a chime-in seat is claimed only by a real argumentative move (anti-sniping inherited).
- GAME-005 does **not** modify the room contract, the Primary Opponent resolution, or the GAME-004 turn model.

**From BR-004 (`branchGrammarModel.ts`):**
- `BranchDirection` (specifically the `chime_in_vertical` value) — a chime-in's first move opens a branch BR-004 already classifies as `chime_in_vertical`. GAME-005 keys its chime-in branch recognition on `BranchGrammarNode.direction === 'chime_in_vertical'`. It **does not** re-derive branch direction — BR-004 §6 explicitly left this seam for GAME-005.
- `BranchGrammarNode.participantCount` and `.primaryPartyEngaged` — BR-004 §6 says these are "exactly the fields GAME-005's seat logic will want". GAME-005 reads them; it does not recompute them.
- `CollapsedBranchSummary` + `buildCollapsedBranchSummary` — reused verbatim for the "Side branches" collapse when a chime-in moves to observer (§3.4) and for the branch-state metrics (§5). GAME-005 builds **no new collapse mechanism**.
- GAME-005 does **not** modify the branch grammar model, the render contract, or `BRANCH_GRAMMAR_COPY`.

**Coordination note:** BR-004's grammar map is keyed by `branchId`; GAME-005's `PublicSeat`/`MovedToObserverRecord` carry the same `branchId`, so the room shell can join "this seat → this BR-004 branch → this collapsed summary" with no new identifier. The mainline (BR-004 `mainline` direction) is the OP↔Primary spine and is **never** governed — governance only ever targets `chime_in_vertical` branches.

---

## §7 — Downstream consumers (GAME-006, GAME-008) — not redesigned here

- **GAME-006 (Jump Branch).** A navigation affordance to jump directly to a branch. GAME-005 ships the seat map + the branch-state metrics; the *navigation* to a chime-in branch is GAME-006's job. GAME-005's `PublicRoomSeatMap` carries `branchId` per seat, which is the stable handle GAME-006 will navigate to. GAME-005 ships **no Jump Branch navigation**.
- **GAME-008 (bot public-room policy).** Whether and how a bot may occupy a chime-in seat is GAME-008's scope. GAME-005's `buildPublicRoomSeatMap` **excludes bot authors from claiming a chime-in seat in v1** (it reuses GAME-004's `isBot` exclusion — bots never claim a human PvP seat). GAME-008 can later widen or refine this; GAME-005's exclusion is the conservative default, not a final bot policy. GAME-005 ships **no bot seat policy beyond the GAME-004-inherited exclusion**.

GAME-005 does not import, redesign, or pre-empt either card. Documented so the implementer does not scope-creep.

---

## §8 — File changes

### New files (GAME-005 footprint)

| Path | Purpose | Approx LOC |
|---|---|---:|
| `src/features/debates/publicSeatModel.ts` | Pure-TS model. Exports `SeatRole`, `PublicSeat`, `ChimeInStanding`, `PublicRoomSeatMap`, `MovedToObserverRecord`, `ObserverFallbackReason`, `GovernanceReaction`, `GovernanceReactionKind`, `ALL_GOVERNANCE_REACTION_KINDS`, `GovernanceDenyReason`, `GovernanceActorResult`, `PublicRoomMetricsViewModel`, `GovernanceControlViewModel`, `PUBLIC_ROOM_SEAT_CAP`, `PRIMARY_SEAT_COUNT`, `CHIME_IN_GOVERNANCE_WINDOW_MS`, `buildPublicRoomSeatMap`, `evaluateChimeInStanding`, `canApplyGovernanceReaction`, `buildPublicRoomMetricsViewModel`, `buildGovernanceControlViewModel`, `_forbiddenChimeInGovernanceTokens()` (ban-list support). Imports GAME-004 `roomContractModel` types + BR-004 `CollapsedBranchSummary`/`BranchDirection` as types. No React, no Supabase, no network, no AI. | ~340–420 |
| `src/features/debates/ChimeInGovernanceControl.tsx` | Read-time RN component — the small constrained governance control shown ONLY to the OP + Primary Opponent on a chime-in branch. Renders the four reaction `Pressable`s from `GovernanceControlViewModel`. ≥44px targets, full a11y. Pure presentation over the view-model + an `onApply`/`onRetract` callback. | ~150–190 |
| `src/features/debates/PublicRoomMetricsStrip.tsx` | Read-time RN component — the non-correctness metrics strip (seat count, chime-in count, branch states). Pure presentation over `PublicRoomMetricsViewModel`. No `Pressable` (informational). | ~110–140 |
| `src/features/debates/useChimeInGovernance.ts` | Thin React hook holding the in-session `GovernanceReaction[]` state + `apply` / `retract` callbacks. **No I/O** — it holds ephemeral state only (v1: no persistence). Exposes the reactions array for `buildPublicRoomSeatMap`. | ~70–90 |
| `__tests__/publicSeatModel.test.ts` | Pure-model tests (see §10). | ~360 |
| `__tests__/chimeInGovernanceActorMatrix.test.ts` | `canApplyGovernanceReaction` actor matrix + anti-abuse tests. | ~140 |
| `__tests__/chimeInGovernanceDoctrine.test.ts` | Ban-list across reaction labels + observer-fallback copy + forbidden-import scan. | ~110 |
| `__tests__/chimeInGovernanceControl.test.tsx` | `ChimeInGovernanceControl` render + a11y + actor-gating tests. | ~150 |
| `__tests__/publicRoomMetricsStrip.test.tsx` | `PublicRoomMetricsStrip` render tests. | ~90 |

### Modified files

| Path | What changes | What stays |
|---|---|---|
| `src/features/arguments/gameCopy.ts` | ADD the frozen `CHIME_IN_GOVERNANCE_COPY` block beside `BRANCH_GRAMMAR_COPY`. ~+30 lines. | Everything existing. `toPlainLanguage` / `looksLikeInternalCode` / `BRANCH_GRAMMAR_COPY` / `OBSERVER_COPY` unchanged. |
| `src/features/debates/index.ts` (barrel, if present — verify) | Re-export the new model types + components. ~+4 lines. If no barrel exists, skip. | Everything existing. |
| The room shell that mounts the timeline + the GAME-004 `RoomContractSeatStrip` (verify the exact mount: GAME-004 wired it via `App.tsx` / `FullRoomGameSurfaceMount` per `docs/designs/GAME-004.md`) | **Minimal additive wiring.** ~+40–70 net lines. Build `buildPublicRoomSeatMap` once per render (memoized on the room-contract hash + arguments + the in-session reactions). Mount `PublicRoomMetricsStrip` near the existing seat strip. Mount `ChimeInGovernanceControl` on a chime-in branch **only when the viewer is the OP or Primary Opponent**. Pass the in-session reactions from `useChimeInGovernance`. | All node-tap / selection logic; the GAME-004 seat strip; the BR-004 timeline rail; the IX-004 panel. No existing prop made required; every new prop optional with a no-render default. |

### Files this card does NOT touch (and why)

- `src/features/debates/roomContractModel.ts` — GAME-004's contract is **read** (types + `isQualifyingResponse`), never modified.
- `src/features/arguments/branchGrammarModel.ts` + `branchGrammarRenderContract.ts` — BR-004's grammar is **read** (`BranchDirection`, `CollapsedBranchSummary`, `buildCollapsedBranchSummary`), never modified.
- `src/features/arguments/timelineSelectedReadoutModel.ts` + `TimelineSelectedReadoutPanel.tsx` — IX-004's readout is **not modified**; GAME-005 renders a sibling strip.
- `src/lib/constitution/engine.ts` — the rules engine is sacred. GAME-005 adds no rule, no flag, no block.
- `supabase/migrations/*` + `supabase/functions/*` — **no migration, no Edge Function** (§4). `submit-argument` untouched.
- `src/features/pointStanding/*`, `argumentScoreModel.ts`, any heat module — never imported; governance is orthogonal to standing.

### Future-card footprint (NOT this card)

- **Persistence of governance reactions** (`public.chime_in_governance_reactions` table + RLS + an Edge Function or RLS-bound write) → a follow-up **migration card** (§1.6, §4). Named, scoped, isolated.
- **Re-entry / appeal flow** for moved-to-observer participants → **OD-3**, a future card (§3.4).
- **Jump Branch navigation** to a chime-in branch → **GAME-006** (§7).
- **Bot seat policy** for public rooms → **GAME-008** (§7).

---

## §9 — Edge cases

The implementer must handle each; each maps to a named test in §10.

1. **Empty room (no arguments).** `buildPublicRoomSeatMap` returns `activeSeats` = [seat 1 OP only] (or [] if no contract), `movedToObserver` = [], `isCapReached` false. No crash.
2. **Root-only room (OP posted, no replies).** Seat 1 filled, seat 2 open, no chime-ins, `openChimeInSeatCount` reflects seats 3–6 unreachable while seat 2 is open (or counted as open per §6 — the model documents the choice: chime-in seats are only *claimable* once at least the OP exists; an open seat 2 does not block seats 3–6 being claimed by chime-ins, because a public room can have chime-ins before a Primary Opponent is locked).
3. **Exactly 6 distinct qualifying participants.** Seats 1–6 all filled, `isCapReached` true, `openChimeInSeatCount` 0.
4. **Chime-in swarm — 9+ qualifying participants.** Seats 3–6 hold the 1st–4th chime-ins by first-move time; the 5th+ are `movedToObserver` with `reason: 'overflow'`. No failure state, no error — the card's explicit requirement.
5. **A non-qualifying first move** (one-word "lol", flagged, deletion-requested, draft). Does **not** claim a chime-in seat — `isQualifyingResponse` rejects it (GAME-004 logic reused). The user is not seated and not an overflow observer; they are simply a non-poster until they post a real move.
6. **Single primary applies `off_track`.** `evaluateChimeInStanding` returns `active` — one party never demotes. Anti-abuse core. Tested directly.
7. **Both primaries apply `off_track` but outside the window.** `|t1 - t2| > windowMs` → `active`. A stale reaction never accumulates across unbounded time.
8. **Both primaries apply `off_track` within the window.** → `observer_only`; the chime-in moves to `movedToObserver` (`reason: 'governance'`); their branch stays on record.
9. **A primary retracts their `off_track` after a demotion.** On the next render the both-parties threshold is no longer met → the chime-in is `active` again (if a seat is free). Fully reversible.
10. **The same primary applies `off_track` twice** (e.g. retract + re-apply). Two non-retracted reactions but only one distinct `byUserId` → never satisfies the two-distinct-parties bar → `active`.
11. **A chime-in tries to govern another chime-in.** `canApplyGovernanceReaction` → `{ allowed: false, reason: 'not_a_primary_party' }`.
12. **An observer tries to govern.** Same `not_a_primary_party` deny.
13. **A primary tries to govern their own content / the mainline / the other primary.** `self_target` (own) or `target_not_chime_in` (mainline / other primary) deny.
14. **The Primary Opponent seat is open.** `canApplyGovernanceReaction` → `primary_seat_open` deny for everyone; `evaluateChimeInStanding` gets a 1-element `primaryUserIds` and can never return `observer_only`. Governance pauses (§3.5).
15. **Both primary seats open (no OP — impossible: a room always has a creator).** Defensive: `buildPublicRoomSeatMap` still returns a valid map with seat 1 from `roomContract.initiatorUserId`.
16. **A chime-in is also flagged for moderation.** Moderation flags (`argument_flags`) and governance reactions are **separate systems** — a moderation flag does not auto-demote a chime-in, and a governance reaction is not a moderation flag. GAME-005 governance never touches `argument_flags`.
17. **Concurrent edits / a new chime-in arrives.** The room re-renders; `buildPublicRoomSeatMap` re-runs; the new chime-in claims the next free seat or becomes overflow. Deterministic — no race (claim order is by `createdAt` + `id` tie-break).
18. **Offline / network failure.** GAME-005 is pure UI over already-loaded data; v1 reactions are in-session only, so offline simply means no new data. The seat map keeps describing the last-known state. No special handling, no crash.
19. **A moved-to-observer user posts again** (e.g. via a stale composer). Their move is still an `arguments` row, but `buildPublicRoomSeatMap` does not re-seat them while the both-parties `off_track` reactions stand — standing is recomputed and stays `observer_only`. (Whether the composer should be disabled for them is a room-shell concern; the model's job is only to keep the standing correct.)
20. **Doctrine edge — does a hot / high-reply chime-in get a seat priority?** No. Seat order is `createdAt` of the first qualifying move only. `buildPublicRoomSeatMap` reads no heat, no reply count, no standing. A test feeds a low-activity chime-in that posted earlier vs a high-activity one that posted later and asserts the earlier one holds the lower seat index.
21. **Doctrine edge — does `not useful / off-track` mean the chime-in is "wrong"?** No. It is a participation-structure signal. The copy says "Off the current thread", never "wrong" / "incorrect" / "bad". The ban-list test enforces it.
22. **Doctrine edge — can a governance reaction block a post?** No. Governance has no post path, no validation gate. A moved-to-observer user lost a *seat* (a structural role); their existing content is never blocked, hidden, or deleted.

---

## §10 — Test plan (Build-phase responsibility)

Per `test-discipline`: tests ship **with** the Build-phase code. Every public function of `publicSeatModel.ts` needs happy-path + failure-case coverage; 100% line + branch coverage is achievable (pure TS, no I/O).

### `__tests__/publicSeatModel.test.ts`
- `buildPublicRoomSeatMap` — seats 1/2 from the GAME-004 contract; chime-ins fill 3–6 in first-qualifying-move chronological order; 7th+ → overflow `movedToObserver`; `isCapReached` / `openChimeInSeatCount` correct.
- `buildPublicRoomSeatMap` — a non-qualifying first move never claims a seat (reuses GAME-004 `isQualifyingResponse`); a bot author never claims a chime-in seat.
- **Doctrine — seat order is structural:** a low-activity earlier chime-in holds a lower seat index than a high-activity later one.
- `evaluateChimeInStanding` — table: single `off_track` → `active`; two `off_track` from two distinct primaries within window → `observer_only`; two outside window → `active`; two from the *same* primary → `active`; `useful` / `needs_source` / `move_to_tangent` never demote; a retracted `off_track` never counts; `primaryUserIds` with one entry → never `observer_only`.
- `canApplyGovernanceReaction` — actor matrix: OP allowed, Primary Opponent allowed, chime-in denied (`not_a_primary_party`), observer denied, self-target denied (`self_target`), mainline/other-primary target denied (`target_not_chime_in`), open primary seat denied (`primary_seat_open`).
- **Anti-abuse:** a single-party reaction never demotes; a demotion is reversed when the reaction is retracted (recompute returns `active`).
- `buildPublicRoomMetricsViewModel` — seat/chime-in counts; branch-state labels sourced from BR-004 `CollapsedBranchSummary`; pluralization (0 / 1 / N).
- `buildGovernanceControlViewModel` — one entry per reaction kind; `appliedByViewer` reflects the viewer's own reactions; `observerFallbackNotice` non-null only when the target is observer-only.
- **Determinism:** `buildPublicRoomSeatMap` twice on the same input → deeply-equal frozen output. No-mutation: frozen input arrays are not mutated.
- Edge cases §9: empty room, root-only, exactly 6, 9-swarm overflow, concurrent new chime-in, open Primary Opponent seat.

### `__tests__/chimeInGovernanceActorMatrix.test.ts`
- Full `canApplyGovernanceReaction` permutation matrix (actor role × target role × primary-seat-filled state) — every `GovernanceDenyReason` plus the allowed paths.

### `__tests__/chimeInGovernanceDoctrine.test.ts`
- **Ban-list:** collect every string in `CHIME_IN_GOVERNANCE_COPY` + every label/notice produced by `buildGovernanceControlViewModel` and `buildPublicRoomMetricsViewModel` across all permutations; assert none contains (case-insensitive) `winner`, `loser`, `correct`, `incorrect`, `true`, `false`, `right`, `wrong`, `won`, `lost`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `booted`, `kicked`, `banned`, `removed`, `rejected`, `silenced`, `troll`, `bot`, `popular`, `trending`, `viral`, `like`, `dislike`, `upvote`, `downvote`, `vote`.
- `looksLikeInternalCode` is `false` for every visible string (no `snake_case` / enum-value leak — `off_track` the enum value must never appear in a user-facing string; the label is "Off the current thread").
- **Forbidden imports:** source-scan `publicSeatModel.ts` — assert it imports nothing from `react`, `../../lib/supabase`, any score / standing / heat / anti-amplification module, or any network module. Governance is not influenced by score or heat — proven by the absence of the import.
- **No service-role / no Edge Function:** source-scan `publicSeatModel.ts` + the two components + the hook for `SERVICE_ROLE` / `service_role` / `functions.invoke` → zero matches.

### `__tests__/chimeInGovernanceControl.test.tsx`
- Renders the four reaction `Pressable`s for an OP viewer on a chime-in branch.
- Renders nothing (or a disabled state) for a chime-in / observer viewer (actor-gated).
- Each `Pressable` has `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState` (`selected` = applied), ≥44px hit target.
- Reaction state is not color-only (an applied reaction shows a shape/text change, verified grayscale).
- `observerFallbackNotice` renders the calm copy when the chime-in is observer-only.

### `__tests__/publicRoomMetricsStrip.test.tsx`
- Renders seat count + chime-in count + branch-state chips from the view-model.
- Every visible string inside `<Text>`; strip root exposes `accessibilityLabel`.
- Renders the "Side branches" heading when a moved-to-observer branch exists.

---

## §11 — Dependencies (cards / docs / files)

- **Assumes GAME-004 (#141) is complete** — MERGED. GAME-005 imports `RoomContract`, `RoomArgumentInput`, `RoomParticipantInput`, `QualifyingResponseSignals`, `isQualifyingResponse`, `PrimarySeat` from `src/features/debates/roomContractModel.ts`. The public-seat model *extends* the 1v1 contract — seats 1–2 are GAME-004's, seats 3–6 are GAME-005's.
- **Assumes BR-004 (#143) is complete** — MERGED. GAME-005 imports `BranchDirection`, `CollapsedBranchSummary`, `buildCollapsedBranchSummary` from `src/features/arguments/branchGrammarModel.ts` and keys chime-in branch recognition on `direction === 'chime_in_vertical'`. BR-004 §6 explicitly reserved this seam.
- **References IX-004 (#135)** — MERGED. The read-time metrics strip renders as a sibling of the IX-004 readout panel; IX-004 is not modified.
- **Reads existing schema:** `public.debate_participants` `(debate_id, user_id, side, joined_at)`, `public.arguments` — both confirmed in `supabase/migrations/20260516000001_initial_schema.sql`. RLS already lets a room participant read co-participant rows (`20260516000002_rls_policies.sql` — "debate_participants: select own or open debate") — no policy change needed.
- **Will block GAME-006 (Jump Branch)** — GAME-006 navigates to a chime-in branch GAME-005's seat map identifies.
- **Will block GAME-008 (bot public-room policy)** — GAME-008 refines the bot-seat exclusion GAME-005 inherits from GAME-004.
- **Future migration card** plugs into the §1.6 / §4 seam: a `public.chime_in_governance_reactions` table feeds persisted `GovernanceReaction[]` into the unchanged `evaluateChimeInStanding`.

---

## §12 — Risks

- **Governance becoming a silencing tool (the headline risk).** Mitigations are all in the model, not just the UI: the **both-parties requirement** (two distinct primaries — `evaluateChimeInStanding`), **reversibility** (any primary may retract their own reaction; standing recomputes), **the bounded rule window** (stale single reactions never accumulate), **on-record persistence of the branch** (a moved-to-observer branch is never hidden or deleted — it collapses into "Side branches"), and **governance pauses when a primary seat is open**. A test suite asserts every one.
- **Reaction copy reading as a popularity contest.** Mitigation: no like/dislike vocabulary anywhere; labels are participation-structure ("Helpful here" / "Off the current thread"); **OD-2** routes final copy through `CHIME_IN_GOVERNANCE_COPY` for a copy review; the ban-list test forbids `like`/`dislike`/`vote`/`upvote`/`downvote`.
- **v1 reactions are in-session only (§4).** A both-parties demotion cannot complete across two devices / a reload until a persistence card lands. This is an accepted v1 limitation, not a bug — the deterministic model is built and tested now; the persistence card is small and isolated. The implementer must not silently add a migration to "fix" this — the card forbids schema changes without a follow-up card.
- **Room-shell wiring.** GAME-005 mounts a metrics strip + a governance control into the room shell. GAME-004 already established the mount path; GAME-005's additions are optional-prop, no-render-by-default. If threading the in-session reactions into the memoized `buildPublicRoomSeatMap` is fiddly, an acceptable degraded fallback is to render the metrics strip (which needs no reactions) and gate the governance control behind a later wiring step — but prefer the full wiring.
- **Seat-cap = 6 is a judgement call.** It is a single named constant (`PUBLIC_ROOM_SEAT_CAP`) so **OD-1** can tune it with one edit; tests pin the boundary (6 fill, 7th overflows).
- **No existing test should need updating.** GAME-005 adds new files + an additive copy block + optional-prop UI. The GAME-004 seat strip, the BR-004 grammar, and the IX-004 panel are untouched; their tests are unaffected.

---

## §13 — Out of scope

Explicitly **not** in GAME-005 (each is named in the issue's Non-scope / Do-not sections or follows from doctrine):
- Branch **grammar / visuals** (mainline / vertical / diagonal rendering) → **BR-004** (merged; consumed, not rebuilt).
- **Jump Branch** navigation → **GAME-006**.
- The **1v1 contract / Primary Opponent assignment** → **GAME-004** (merged; consumed, not rebuilt).
- **Resolution / enough-tags / room closing** → **GAME-007**.
- **Bot seeding / bot seat policy** → **GAME-008** (GAME-005 inherits only the GAME-004 bot-exclusion).
- Any **Supabase schema change** — no governance-reaction table, no `seat_index` column, no public-room flag, no migration. A follow-up migration card owns persistence.
- Any **Edge Function** — no `submit-argument` change, no new function.
- Any **correctness voting** of any kind — observers and the public never vote on truth or standing; governance reactions are not votes.
- A **re-entry / appeal UI** for moved-to-observer participants → **OD-3**, a future card. v1's re-entry path is reaction-retraction only (§3.4).
- Profile / display-name loading — seats are labeled by role relative to the viewer, never by name.
- A **route / screen transition** — everything renders in the existing room shell (the card states "No route transition").

---

## §14 — Doctrine self-check

- **cdiscourse-doctrine §1 (score is gameplay analysis, never truth; score never blocks posting).** A governance reaction is a participation-structure signal — `useful` / `off_track` / `needs_source` / `move_to_tangent`, zero verdict words. `evaluateChimeInStanding` returns `active` / `observer_only` — a structural standing, never "correct/incorrect". Governance has no post path — it cannot block, hide, or delete any content; a moved-to-observer user keeps every byte of their content on the record. Enforced by `chimeInGovernanceDoctrine.test.ts` (ban-list + no-block assertion).
- **cdiscourse-doctrine §2 (heat = activity).** Heat is not an input. `buildPublicRoomSeatMap` orders chime-in seats by first-qualifying-move `createdAt` only; it reads no heat band. `publicSeatModel.ts` imports nothing from any heat module — enforced by the forbidden-import test.
- **cdiscourse-doctrine §3 (popularity is not evidence).** Seat assignment, governance, and the read-time metrics never read engagement / reply count / view count as a quality or truth signal. The metrics strip shows counts as *capacity readouts*, never rankings. A high-reply chime-in gets no seat priority (tested).
- **cdiscourse-doctrine §4 / §7 (AI limits, no client AI).** GAME-005 makes no AI call. The model is deterministic pure TS. No annotation, no classification, no summary call.
- **cdiscourse-doctrine §5 (rules engine sacred).** `src/lib/constitution/engine.ts` is untouched. No new rule, no flag, no transition.
- **cdiscourse-doctrine §6 (secrets).** No new key, no `.env*` change. No service-role anywhere (`publicSeatModel.ts` is pure TS; the v1 governance hook holds in-session state with no I/O).
- **cdiscourse-doctrine §8 (Supabase conventions; never hard-delete).** No migration in v1. A retracted governance reaction is *kept* in the list (audit trail), never hard-deleted — the same discipline as `flags` being dismissed not deleted. A moved-to-observer user's branch is kept on the record.
- **cdiscourse-doctrine §9 (plain language).** Internal enum values (`off_track`, `chime_in`, `observer_only`) never reach a user string — every visible string routes through `CHIME_IN_GOVERNANCE_COPY`. `looksLikeInternalCode` returns false for each, tested.
- **cdiscourse-doctrine §10 (v1 scope guards).** No voting that produces a winner — governance reactions are explicitly *not* votes and produce no winner. No real-time collab, no OAuth, no public API, no push, no search.
- **point-standing-economy (seats / governance stay separate from standing).** A `PublicSeat` and a `GovernanceReaction` carry no numeric field, no band, no debt. A user can hold a chime-in seat while their point standing is in any band; the two are orthogonal. `publicSeatModel.ts` imports nothing from `argumentScoreModel` / `pointStanding` / `antiAmplification` — enforced by the forbidden-import test. Losing a seat does not change a single point of anyone's standing.
- **accessibility-targets.** `ChimeInGovernanceControl`'s reaction `Pressable`s carry `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState` (`selected` = applied), and ≥44px hit targets (`hitSlop` if the visual is smaller). Applied/not-applied state is shape/text, not color-only (grayscale-verified). `PublicRoomMetricsStrip` is informational (no `Pressable`) and exposes an `accessibilityLabel` on the strip root. The observer-fallback notice is announced calmly; no chatty per-render announcement.
- **expo-rn-patterns.** No new dependency — both components are `<View>` + `<Text>` + `<Pressable>` primitives. `publicSeatModel.ts` is pure TS with no React / Supabase import (matches the `*Model.ts` convention beside `roomContractModel.ts`). The components are thin presentational layers over view-models.
- **test-discipline.** Five test files ship with the Build-phase code (model, actor matrix, doctrine, two component suites), covering every public function's happy + failure paths, the full `evaluateChimeInStanding` and `canApplyGovernanceReaction` tables, the anti-abuse cases, and the ban-list. Tests are part of this card's deliverable.

---

## §15 — Operator steps / decisions

**Operator deploy step: None — pure code change.** No migration (`npx supabase db push` not needed), no Edge Function deploy, no new env var, no new dependency. GAME-005 adds a pure-TS model, a copy block, two read-only RN components, and a thin in-session governance hook.

**Operator decisions (isolated — none gate the build):**
- **OD-1 — the governance window length.** `CHIME_IN_GOVERNANCE_WINDOW_MS` is proposed at `24h`. Confirm `24h` vs `12h` / `48h`. Also confirm the seat cap `PUBLIC_ROOM_SEAT_CAP = 6` (the card proposes 6). Both are single named constants — a one-edit tuning.
- **OD-2 — final reaction-label copy.** The four labels in `CHIME_IN_GOVERNANCE_COPY` ("Helpful here" / "Off the current thread" / "Ask for a source" / "Better as a side issue") plus the observer-fallback copy need a copy review to confirm none reads as a popularity contest or a verdict. The card lists this as an Open decision.
- **OD-3 — re-entry / appeal path for moved-to-observer participants.** Deliberately **deferred** to a future card. v1's re-entry mechanism is reaction-retraction (a primary retracts their `off_track`, the chime-in returns to `active` on the next render). A first-class appeal UI is out of scope here; the card lists it as an Open decision and this design recommends a dedicated follow-up card.
- **Future migration card (not a decision — a heads-up).** Cross-session / cross-device persistence of governance reactions needs a `public.chime_in_governance_reactions` table + RLS. Named and scoped in §1.6 / §4. The operator should expect this as the natural follow-up if governance needs to survive a reload.
