# ARG-ROOM-005 — Public participant slot claiming

**Status:** Design draft
**Epic:** Rules UX
**Release:** 6.7
**Issue:** [#616](https://github.com/kyleruff1/cDiscourse/issues/616) (operator-rescoped: *Public participant slot claiming* — supersedes the original "Seat-state + capacity surfacing (gallery + room)" title)
**Baseline:** `main @ HEAD` (post ARG-ROOM-002 GATE-C deploy)
**Slate:** `ARG-ROOM-VISIBILITY-INVITE-SLATE-2026-06-13` · roadmap `docs/roadmap-expansions/2026-06-13-public-private-argument-room-invites-roadmap.md`
**Doctrine anchors:** `cdiscourse-doctrine` §1 (no winner/loser/verdict copy — "full" / "observe" are structural facts, never judgments), §2–§3 (heat/popularity are *activity*, never an input to a seat or to access), §8 (RLS always on, never disabled; migrations append-only), §9 (plain language via `gameCopy`), §10a (seat states are machine **Observations** of access/activity, never allegations about a person). Roadmap §1 (the four seat states must never be collapsed) + §5 (no enumeration; raw token never echoed; masked invitee identity only). `src/lib/constitution/engine.ts` is **not engaged** (no transition-matrix or constitution-version touch).
**Stamp:** 2026-06-13

**Gating verdict (determined below, §"Doctrine compliance"):** **STANDARD-GATED.** ARG-ROOM-005 is **pure client + tests over the already-deployed ARG-ROOM-002 enforcement** — it adds **no** `supabase/**` file, **no** migration, **no** RLS change, **no** Edge Function. The binding invariant is already true at the database. One *optional* GATE-C 002-follow-up delta (a soft-enumeration tightening of the trigger's exception `DETAIL`) is **called out** but is explicitly **out of 005's scope**; if a reviewer instead rules that delta mandatory, 005 converts to **STOP-AT-PR** for that one file only.

---

## Goal

Make public rooms usable beyond creation. A signed-in user who is not yet an active participant can **claim an open public seat** (become affirmative/negative), the room **enforces the cap of 5**, and the **reserved invite seat is protected** — a public claim can never consume the seat the invitee is holding, and the invitee can always still accept even when the room looks full to everyone else. When no active seat is available, the claim flow degrades gracefully to the already-shipped **observe** affordance instead of a dead end. The card proves the seven seat-accounting invariants as concrete tests and surfaces the open-slot count + the observer-vs-active distinction without ever rendering a verdict or enumerating who holds a reserved seat.

---

## Product contract

**Binding invariant (restated; already enforced server-side):**

> `publicActiveParticipants + reservedInviteSeats <= 5` for a public room (`= 2` for private). Observers are never active participants and never count toward the cap.

This is enforced by the ARG-ROOM-002 `enforce_room_capacity()` BEFORE INSERT trigger (`supabase/migrations/20260613000001_arg_room_002_room_capacity_and_creation.sql:211-253`), whose join check is `active + reserved + 1 <= cap` (`:245`). ARG-ROOM-005 does **not** re-enforce it; it **surfaces** it and handles its refusal.

**The four seat states (roadmap §1 — never collapse them).** ARG-ROOM-005 is the surfacing/claim card for the public-facing three:

1. **Active participant** — a `debate_participants` row with `side ∈ {affirmative, negative, moderator}`. Counts against the cap. The creator auto-joins as `moderator` (RPC `:341-342`), so a fresh public room is *creator(1 active) + open slots*.
2. **Observer / reader** — `side = observer`, or no row at all (a public room is globally readable). **Uncapped.** The graceful destination when no seat is free. **Proofs 5 + 6.**
3. **Pending reserved invite seat** — a live pending `argument_room_invites` row. Reserves one of the five seats; **invisible to the public** (RLS); the invitee can always accept. **Proofs 3 + 7.**
4. **Open public seat** — `cap − active − reserved`. The slot a non-invited user self-claims (public rooms only). **Proofs 1, 2, 4.**

The seven required proofs (see §Test plan for the 1:1 mapping):
(1) public + no invite ⇒ creator + 4 open; (2) public + 1 invite ⇒ creator + 1 reserved + 3 open; (3) a pending invitee can still accept their reserved seat even when the room looks full to the public; (4) the 6th active participant is refused (`room_capacity_reached`); (5) an observer may join a FULL public room; (6) an observer is never an active participant; (7) a public join does not steal the reserved seat (the invite row is untouched; the invitee can still accept).

---

## Existing shipped state (REUSE — do not rebuild)

**Seat math — the single source of truth (cap 5). Import; never author a second literal.**
- `src/features/debates/publicSeatModel.ts:67` — `PUBLIC_ROOM_SEAT_CAP = 5` (the 6→5 reconciliation **already landed** with 001/002; this card consumes it, it does **not** perform the flip), `:73` `PRIMARY_SEAT_COUNT = 2`.
- `src/features/debates/argumentRoomCreationMatrix.ts:62-63` — `PUBLIC_ACTIVE_PARTICIPANT_CAP: 5`, `PRIVATE_ACTIVE_PARTICIPANT_CAP: 2` (compile-time pinned to the seam constants); `:66` `MAX_DIRECT_INVITES_AT_CREATION = 1`; `:249` `deriveArgumentRoomCreation` (create-time accounting; `openSlots` typed `0 | 3 | 4` at `:129`); `:340/:351` `fitsPublicCapacity` / `fitsPrivateCapacity`.
- `src/features/debates/roomCapacityModel.ts` — the pure twin of the SQL trigger: `:42` `roomActiveSeatCap(visibility)`, `:79` `openSlotsAfterCreate(visibility, directInvites)`, `:95-103` `canJoinActive(active, reserved, cap)` = exact twin of `active + reserved + 1 <= cap`. **005's live-room seat math is built on these.**

**Server enforcement — already deployed (what 002 covers so 005 does not duplicate).**
- `enforce_room_capacity()` trigger `:211-253`: observer pass-through `:224`; already-seated idempotency via `is_debate_participant` `:231`; the refusal `RAISE EXCEPTION 'room_capacity_reached' USING ERRCODE = 'check_violation'` `:246-248`.
- `count_active_participants(uuid)` `:117-128` — counts `WHERE dp.side <> 'observer'` (`:124-127`) — the SQL definition of "active" that proof 6 mirrors.
- `count_reserved_invites(uuid, text)` `:168-203` — counts live pending invites **excluding the joining user's own invite** (`:183`) **and any invite whose addressee already holds an active seat** (`:184-191`). **This is the entire reserved-seat-protection + invitee-can-always-accept mechanism (proofs 3 + 7).**
- One-invite-per-room unique index `:273-275`; public-only client self-join INSERT policy `:282-291`; service-role-only `create_argument_room` RPC `:299-369`; dropped client `debates` INSERT policy `:391`.
- 002 live smoke (cite as the live-provable anchor): `docs/testing-runs/2026-06-13-arg-room-002-gatec-deploy-smoke.md` — proved the cap trigger refuses an over-cap join with `room_capacity_reached`, the direct-insert door is closed (`42501`), and the matrix is enforced.

**Create surface — what 003 covers (005 does not touch create).**
- `src/features/debates/debatesApi.ts:149` `createArgumentRoom`, `:196` `createDebate` (routes through the Edge path); `CreateDebateInput.invite` (`src/features/debates/types.ts:64`). Create-time accounting (proofs 1/2 at *create*) is 001/003's; 005 re-pins it at the *live-room* layer.

**Join + room seams (the integration points 005 wires into).**
- `src/features/debates/debatesApi.ts:236-262` `joinDebate(debateId, side, userId)` — a single `debate_participants` INSERT; `:70-72` `isAlreadyJoinedError` (`code === '23505'`). **Note: it currently flattens any error into `error.message` and has no capacity branch.**
- `src/features/debates/useDebates.ts:54-70` `join` → returns `ParticipantSide | null`, funnels all failures into a generic `setError` (`:65`). **No graceful full-room path today.**
- `App.tsx:931-935` `onJoinSide` → `await join(...)` → `selectDebate` on success, silent no-op on null. **The dead-end 005 fixes.**
- `src/features/arguments/ArgumentGameSurface.tsx:1545-1553` `handleRailAction` routes `join_aff`/`join_neg` → `onJoinSide`, `watch` → no-op (`:1549`); `:482-483` `resolvedViewerRole`; rail mount `:2217-2221`. `src/features/arguments/ArgumentTreeScreen.tsx:54,508` threads `onJoinSide` + viewerRole.
- `src/features/arguments/ArgumentSideActionRail.tsx` — `OBSERVER_ACTIONS` (`:92-101`: `watch`, `join_aff`, `join_neg`, `share`), `getRailActions` (`:121-125`), `railActionToBubbleControl` (`:133-145`). **These definitions are a locked contract** (`railActionGrouping.test.ts`, see the file header `:13-22`); 005 must extend the rail only via **new optional props** (the SC-005 backward-compatible pattern, `:160-182`), never by editing the action set. The rail already hides a redundant join chip when the participant is on that side (`:309-315`).

**Copy + masking (reuse).**
- `src/features/arguments/gameCopy.ts:925-945` `OBSERVER_COPY` — `watch: 'Watch'`, `enterRoom: 'Observe'`, `watchHelp: 'Read the room without joining a side yet.'`; `:865` `toPlainLanguage`, `:903` `toPlainLanguageOrSuppress`; `:1318` `CHIME_IN_GOVERNANCE_COPY.seat_count = '{active} of {cap} seats active'` (an existing capacity-readout string available to reuse).
- `src/features/invites/inviteModel.ts:147-159` `maskInviteeEmail` — reused **only** on creator-visible surfaces; the public claim surfaces in 005 show **counts only, never invitee identity**.

**RLS read posture (grounds the open-slot accuracy honesty below).**
- `debate_participants` SELECT (`supabase/migrations/20260516000006_fix_debates_rls_recursion.sql:147-155`): any authenticated user may read participant rows for an open/locked room (`is_debate_open_or_locked(debate_id)`). ⇒ **the client can always derive `activeParticipantCount` for a public room.**
- `argument_room_invites` SELECT (`supabase/migrations/20260524000013_qol_038_argument_room_invites.sql:111-155`): only the inviter, the room creator, the invitee (own JWT email), or a mod/admin can read invite rows; **no INSERT/UPDATE/DELETE for `authenticated`** (`:157-164`). ⇒ **a public claimant cannot count reserved invites** — the reserved seat is invisible by design.

---

## Net-new vs already-shipped

| Concern | Already shipped (where) | Net-new in ARG-ROOM-005 |
|---|---|---|
| Cap value (5/2), create-time accounting | matrix `:62-63`, roomCapacityModel `:42/:79`, publicSeatModel `:67` | Nothing — **import only** |
| `active + reserved + 1 <= cap` enforcement | 002 trigger `:245` | Nothing — surfaced + handled, not re-enforced |
| Reserved-seat protection / invitee-always-accepts | 002 `count_reserved_invites` `:183-191` | Nothing server-side — **proven** as client tests; gracefully handled |
| Observer pass-through (full-room observe is allowed) | 002 trigger `:224`; `debate_participants` INSERT RLS | Nothing server-side — surfaced as the graceful affordance |
| **Live-room seat view-model** (open slots, isFull, observe-only, viewer active vs observer) | — | **`seatClaimModel.ts` (new, pure)** |
| **Join-error → outcome classifier** (`room_capacity_reached` → observe) | — | **`classifyJoinOutcome` (new, pure)**; `joinDebate`/`join` return-shape widened (client-only) |
| **Open-active-slots arithmetic twin** | `canJoinActive` boolean only | **`openActiveSlots(active, reserved, cap)`** additive to roomCapacityModel |
| **Full-room UX** (graceful claim → observe; disabled join chips + nudge) | rail action set exists, no full-room awareness | **rail new optional props + App.tsx full-room branch + tiny seat strip** |
| **Seat-availability copy** | `OBSERVER_COPY`, `seat_count` | **minimal `SEAT_CLAIM_COPY` block** (ban-list scanned; 007 consolidates) |

Everything that *enforces* the invariant is already shipped. 005 is the **claim flow, the full-room UX, the open-slot surfacing, and the seven proofs**.

---

## Data / API shape

All new pure-TS lives in `src/features/debates/` and obeys engine discipline: no React, no Supabase, no network, no async, no clock, no randomness; JSON-serializable in/out; frozen outputs; deterministic.

### 1. `roomCapacityModel.ts` — additive (one new export, no new literal)

```ts
/**
 * Open ACTIVE slots remaining right now: max(0, cap - active - reserved).
 * Pure twin of the SQL `cap - active - reserved`. Consistent with
 * canJoinActive: openActiveSlots(...) >= 1  ⟺  canJoinActive(...) === true.
 * Negative / non-finite inputs clamp to 0 (defensive; SQL counts are >= 0).
 */
export function openActiveSlots(activeCount: number, reservedInvites: number, cap: number): number;
```

### 2. `seatClaimModel.ts` — NEW pure model (the heart of the card)

```ts
import type { ParticipantSide } from './types';
import type { ArgumentRoomVisibility, ArgumentRoomCapacity } from './argumentRoomCreationMatrix';
// reuses roomActiveSeatCap, canJoinActive, openActiveSlots from roomCapacityModel

/** Pure twin of the SQL `side <> 'observer'` (migration :124-127, :224).
 *  affirmative | negative | moderator => active; observer | null => not active. */
export function isActiveParticipantSide(side: ParticipantSide | null | undefined): boolean;

export interface SeatAvailabilityInput {
  visibility: ArgumentRoomVisibility;
  /** From the already-loaded debate_participants rows (side !== 'observer'). */
  activeParticipantCount: number;
  /** RLS-bounded: creator/inviter/admin may pass the real count; a public
   *  viewer passes 0 (invite rows are hidden — no enumeration). Default 0. */
  knownReservedInviteCount: number;
  /** The viewer's own side; null = not a participant (pure reader). */
  viewerSide: ParticipantSide | null;
}

export interface SeatAvailability {
  cap: ArgumentRoomCapacity;                 // roomActiveSeatCap(visibility)
  activeParticipantCount: number;            // clamped >= 0
  reservedInviteCount: number;               // the KNOWN reserved (advisory for public)
  openSlots: number;                         // openActiveSlots(active, reserved, cap)
  isFull: boolean;                           // !canJoinActive(active, reserved, cap)
  viewerIsActiveParticipant: boolean;        // isActiveParticipantSide(viewerSide)
  canClaimActiveSeat: boolean;               // !isFull && !viewerIsActiveParticipant
  observeIsOnlyOption: boolean;              // isFull && !viewerIsActiveParticipant
  /** false for a public viewer (reserved is RLS-hidden) → openSlots is a
   *  preview only; the 002 trigger is authoritative. Drives no copy by itself. */
  reservedCountIsAuthoritative: boolean;
}

export function deriveSeatAvailability(input: SeatAvailabilityInput): SeatAvailability; // frozen

/** Classify a Supabase write error WITHOUT surfacing any count. Detects
 *  capacity via message includes 'room_capacity_reached' (primary; the token
 *  we raise) and/or SQLSTATE '23514' check_violation; 23505 => already_*.
 *  The trigger's DETAIL (cap=/active=/reserved=) is DISCARDED — never returned,
 *  never shown (no soft enumeration). */
export type JoinOutcomeKind =
  | 'claimed' | 'already_active' | 'already_observer'
  | 'room_full' | 'unavailable' | 'error';
export function classifyJoinOutcome(
  error: { code?: string | null; message?: string | null } | null,
  existingSide?: ParticipantSide | null,
): JoinOutcomeKind;

/** Read-only view-model. Verdict-free; counts only, never identities. */
export interface SeatAvailabilityViewModel {
  openSeatsLabel: string;          // "3 open seats" / "1 open seat" / "No open seats"
  isFull: boolean;
  fullRoomObserveNudge: string | null;  // SEAT_CLAIM_COPY.fullRoomObserve when full+non-participant, else null
  viewerStateLabel: string;        // "You're in this argument." / "You're watching."
  accessibilityLabel: string;      // verbose, single-shot screen-reader summary
}
export function buildSeatAvailabilityViewModel(
  a: SeatAvailability, viewerSide: ParticipantSide | null,
): SeatAvailabilityViewModel;
```

### 3. `gameCopy.ts` — minimal additive copy block (ban-list scanned; 007 consolidates)

```ts
export const SEAT_CLAIM_COPY = Object.freeze({
  openSeatsZero: 'No open seats',
  openSeatsOne: '1 open seat',
  openSeatsMany: '{count} open seats',
  fullRoomObserve: 'This argument is full. You can still watch.',
  youAreActive: "You're in this argument.",
  youAreWatching: "You're watching.",
});
```
All person-neutral, verdict-free, no snake_case. The observe affordance label reuses `OBSERVER_COPY.watch` / `OBSERVER_COPY.enterRoom`.

### 4. Client API return-shape (client-only widening — no server change)

```ts
// debatesApi.ts — joinDebate failure carries the classified outcome.
export type JoinDebateResult =
  | { ok: true; data: JoinResult /* + outcome: 'claimed'|'already_active'|'already_observer' */ }
  | { ok: false; error: string; outcome: JoinOutcomeKind };
```
`joinDebate` runs `classifyJoinOutcome(error, existingSide)` on its existing error/`23505` branches and returns the discriminant. `useDebates.join` forwards the outcome to `App.tsx`. These are local client types; the shared `DebateApiResult<T>` is left untouched.

---

## File changes

| File | Change | Lane |
|---|---|---|
| `src/features/debates/roomCapacityModel.ts` | Add `openActiveSlots(active, reserved, cap)` (additive; reuses the cap seam, no new literal). | client / pure |
| `src/features/debates/seatClaimModel.ts` | **New** pure model: `isActiveParticipantSide`, `deriveSeatAvailability`, `classifyJoinOutcome`, `buildSeatAvailabilityViewModel`, `_forbiddenSeatClaimTokens` (ban-list, mirrors `publicSeatModel.ts:838`). | client / pure |
| `src/features/arguments/gameCopy.ts` | Add `SEAT_CLAIM_COPY` block. | client / copy |
| `src/features/debates/debatesApi.ts` | `joinDebate`: widen the result to `JoinDebateResult`; classify the capacity/`23505` errors via `classifyJoinOutcome`. **No new query/table/Edge** — same single `debate_participants` INSERT (`:243-245`). | client |
| `src/features/debates/useDebates.ts` | `join` returns `{ side, outcome }` (or equivalent) instead of bare `ParticipantSide | null`; stop funnelling `room_full` into the generic `setError`. | client |
| `App.tsx` | `onJoinSide` (`:931-935`): on `outcome === 'room_full'`, set a full-room state → surface the observe affordance (keep observer/read mode, render the nudge) instead of a silent no-op; `claimed`/`already_active` keep the existing `selectDebate`. | client / UI |
| `src/features/arguments/ArgumentSideActionRail.tsx` | Add **optional** props `canClaimActiveSeat?: boolean` + `fullRoomNotice?: string \| null` (backward-compatible, SC-005 pattern). When `canClaimActiveSeat === false`: render `join_aff`/`join_neg` chips **disabled** (`accessibilityState={{ disabled: true }}`, hitSlop preserved) and surface the nudge; `watch` stays enabled. **Do not touch** `OBSERVER_ACTIONS` / `getRailActions` / `railActionToBubbleControl` (locked contract). | client / UI |
| `src/features/arguments/ArgumentGameSurface.tsx` | Derive `SeatAvailability` from the already-loaded participants + debate visibility; pass `canClaimActiveSeat`/`fullRoomNotice` to the rail; render the new seat strip (read-only). `handleRailAction` (`:1545-1553`) unchanged in routing. | client / UI |
| `src/features/arguments/SeatAvailabilityStrip.tsx` | **New** tiny presentational component consuming `SeatAvailabilityViewModel` — open-slot count + viewer state line. Read-only; 44×44 targets; no Pressable verdicts. | client / UI |

**`supabase/**`: NONE.** No migration, no RLS, no Edge, no `config.toml` change. (See §Doctrine for the one *optional* GATE-C delta that is deliberately excluded.)

Data source: `activeParticipantCount` comes from the participant rows the room surface already holds for `publicSeatModel` (`BuildPublicRoomSeatMapInput.participants`, `publicSeatModel.ts:451`), filtered `side !== 'observer'` (RLS-readable for open rooms, `20260516000006:147-155`). If a given mount does not already hold them, a single caller-scoped `select` count is added — a client read of an existing table, **not** a new server object. `knownReservedInviteCount` defaults to `0` (public viewer); a creator surface may thread the QOL-038 list count later (006 territory).

---

## Edge cases

- **Reserved seat is invisible (the protection working).** A public viewer's `openSlots` may read `1` when the true open count is `0` because a pending invite is RLS-hidden. They claim → the 002 trigger refuses `room_capacity_reached` → graceful observe. The copy is **identical** to an active-full room (`SEAT_CLAIM_COPY.fullRoomObserve`); the system never reveals that a reserved invite exists or for whom. `reservedCountIsAuthoritative=false` records this is a preview, but drives no distinct copy. **(Proof 7 + no-enumeration.)**
- **Invitee accepts a "full-to-public" room.** Accept runs through `manage-room-invite` (service-role); the trigger computes `count_reserved_invites` **excluding the invitee's own invite** (`:183`) → reserved `0`, so `active(4) + 0 + 1 = 5 <= 5` passes. The client model's twin: `canJoinActive(4, 0, 5) === true`. **(Proof 3.)**
- **Observer with an existing `observer` row clicks Join.** A plain INSERT collides on the `(debate_id, user_id)` PK → `23505` → `joinDebate` returns the existing `observer` side; `classifyJoinOutcome` ⇒ `already_observer`. A true **observer→active promotion is OUT OF SCOPE**: it requires an UPDATE, and the 002 trigger is **BEFORE INSERT only** (`:263-265`), so an UPDATE-based side change would *bypass* the cap. 005 must not introduce that path; promotion is deferred (a future trigger-on-UPDATE or Edge path = GATE-C). The common case — an observer with **no** row (Stage 6.4 read-mode entry) — claims via a fresh INSERT and is fully governed by the trigger.
- **Creator / already-active viewer.** `viewerIsActiveParticipant=true` ⇒ `canClaimActiveSeat=false`, `observeIsOnlyOption=false`; they post normally, no full-room nudge. Moderator counts as active (`isActiveParticipantSide('moderator')===true`, mirroring SQL `<> 'observer'`).
- **Private room.** `cap=2`, its one seat is the reserved invite; public self-join into a private room is refused by RLS (`:282-291`) and the room is hidden from non-members (QOL-039). `deriveSeatAvailability('private', ...)` ⇒ `openSlots 0`, no public claim chips. The claim flow is a public-room feature.
- **Last-seat race.** Two public users claim the final slot at once → the trigger serializes; one is `claimed`, the other gets `room_full` → graceful observe. The model handles the refusal identically regardless of cause.
- **Malformed/empty join error.** `classifyJoinOutcome(null)` ⇒ `error`; an error with neither the token nor `23514`/`23505` ⇒ `unavailable`/`error`; never silently treated as `claimed`.
- **Idempotent re-claim.** Re-clicking Join when already active → `23505` → `already_active`, no duplicate row (PK + trigger already-seated pass-through `:231`).

---

## Test plan

New suites: `__tests__/seatClaimModel.test.ts` (pure, 100% branch), `__tests__/seatClaimModel.doctrine.test.ts` (ban-list + source scan), `__tests__/seatClaimWiring.test.ts` (integration-mocked). Conventions mirror `__tests__/roomCapacityModel.test.ts` and `__tests__/argRoom002Doctrine.test.ts`.

**The seven required proofs, labelled by provability:**

| # | Proof | pure-model | integration-mocked | live-provable |
|---|---|---|---|---|
| 1 | public + no invite ⇒ creator + 4 open | ✅ `deriveSeatAvailability({public, active:1, reserved:0, viewerSide:null}).openSlots === 4`; cross-pin `openSlotsAfterCreate('public',0)===4` (`roomCapacityModel.ts:79`) | — | (create smoke, 002 doc) |
| 2 | public + 1 invite ⇒ creator + 1 reserved + 3 open | ✅ `deriveSeatAvailability({public, active:1, reserved:1}).openSlots === 3 && reservedInviteCount === 1`; cross-pin `openSlotsAfterCreate('public',1)===3` | — | (create smoke, 002 doc) |
| 3 | pending invitee can accept even when full-to-public | ✅ twin `canJoinActive(4, 0, 5) === true` (invitee's own invite excluded ⇒ reserved 0) vs public `isFull` true | ✅ mock the count helpers / accept path: invitee insert allowed at active=4 | ✅ operator: accept into a full-to-public room (mechanism: migration `:183`, `:245`) |
| 4 | 6th active participant refused (`room_capacity_reached`) | ✅ `canJoinActive(5,0,5)===false`; `deriveSeatAvailability(...).isFull===true`; `classifyJoinOutcome({code:'23514', message:'room_capacity_reached'}) === 'room_full'` | ✅ mock `joinDebate` returning the check_violation error ⇒ `join` yields `room_full` ⇒ App routes to observe | ✅ **already proven** — 002 smoke `docs/testing-runs/2026-06-13-arg-room-002-gatec-deploy-smoke.md` |
| 5 | observer may join a FULL public room | ✅ `deriveSeatAvailability` full ⇒ `observeIsOnlyOption===true`; observer join is never capacity-gated in the model | ✅ mock `joinDebate(side:'observer')` succeeds at active+reserved=5 (no capacity branch hit) | ✅ trigger observer pass-through (migration `:224`) |
| 6 | observer is never an active participant | ✅ `isActiveParticipantSide('observer')===false` (& `null`); `deriveSeatAvailability` counts only `side!=='observer'` — mirrors SQL `count_active_participants` `:124-127` | — | ✅ SQL definition `:124-127` |
| 7 | public join does not steal the reserved seat | — | ✅ source/behavior scan: `joinDebate` writes **only** `debate_participants`, never `argument_room_invites` (`debatesApi.ts:243-245`); mocked invite row unchanged; invitee accept still succeeds afterward | ✅ public self-join path never references the invite table; `count_reserved_invites` keeps reserving (`:168-203`) |

**Additional pure-model tests:** `openActiveSlots` (happy + clamp + `>=1 ⟺ canJoinActive`); `classifyJoinOutcome` (capacity by message, by `23514`, `23505`→`already_*`, null→`error`, unknown→`unavailable`); `buildSeatAvailabilityViewModel` singular/plural/zero labels + viewer-state line; `deriveSeatAvailability` private-room (openSlots 0), already-active viewer (canClaim false), frozen-output + determinism.

**Doctrine tests:** ban-list scan of `SEAT_CLAIM_COPY` + every produced string (reuse `_forbiddenChimeInGovernanceTokens`-style list incl. `winner/loser/true/false/correct/booted/kicked/banned/troll/bot/vote`); a test asserting **no count is interpolated into any user-facing capacity string** beyond the open-slot number (the trigger DETAIL is never surfaced); a source scan that `seatClaimModel.ts` imports nothing from React/Supabase/network and authors no second cap literal (parity-pins to `PUBLIC_ROOM_SEAT_CAP === 5`).

**Integration-mocked wiring:** `useDebates.join` returns `room_full` on a mocked capacity error and does **not** set the generic error banner; `App.onJoinSide` enters full-room observe state on `room_full`; the rail renders `join_*` disabled + the nudge when `canClaimActiveSeat===false` and keeps `watch` enabled (RTL on `ArgumentSideActionRail`).

**Accessibility (per `accessibility-targets`):** disabled join chips keep `accessibilityRole="button"` + `accessibilityState={{ disabled: true }}` + 44×44 hitSlop; the full-room nudge uses `accessibilityLiveRegion="polite"` / a single `announceForAccessibility`, not per-render chatter; the seat strip is color-independent (the open-slot **number** carries the meaning, not a color); reduce-motion inherits the rail's existing snap path.

Gate: `npm run typecheck && npm run lint && npm run test` all exit 0; test count rises (no `.skip`/`.only`); no committed `console.log`.

---

## Doctrine compliance

- **No verdict copy.** "Full" is a seat fact; "observe" is a first-class state, never a demotion or a loss. `SEAT_CLAIM_COPY` + every produced string is ban-list scanned (§Test plan). Reuses the verdict-free `OBSERVER_COPY`. (§1.)
- **Heat/popularity never gate a seat.** `seatClaimModel` imports nothing from any score/heat/anti-amplification module; seat availability is pure structural arithmetic on counts + cap. (§2–§3.)
- **Seat states as Observations.** The open-slot count and observer-vs-active line are machine Observations of access/activity, never allegations about a person; identities are never rendered on public seat surfaces. (§10a.)
- **RLS / secrets / enumeration.**
  - **No `supabase/**` change** — RLS is untouched and stays enabled.
  - **No service-role in client** — the claim path is the existing JWT-scoped `debate_participants` INSERT.
  - **No enumeration:** public seat surfaces show **counts only**; reserved invites are RLS-hidden, so the public never learns a reserved seat exists or for whom; `classifyJoinOutcome` **discards the trigger's `DETAIL`** (`cap=/active=/reserved=`) so the refusal copy is identical whether the room is full by active seats or by a hidden reserved one. `maskInviteeEmail` is reused only on creator-visible surfaces (mostly 006), not here.
- **Gating verdict — STANDARD-GATED.** 005 touches only client + tests over already-deployed 002 enforcement; per the rescope brief that is standard-gated. There is **no STOP-AT-PR** because no backend/RLS/Edge/access is touched.
- **The one optional GATE-C delta (called out, excluded).** The 002 trigger's exception `DETAIL` interpolates `reserved=%s` (`migration 20260613000001:248`). That string is on the wire to a *refused* caller, so a determined public client could infer that a reserved seat exists — a **soft** enumeration signal. **005 (client) mitigates** by never reading or surfacing the DETAIL. **Fully closing it requires a GATE-C, append-only 002-follow-up migration** that drops or de-attributes the `reserved=` term in the DETAIL — a separate operator decision, **out of 005's standard-gated client scope**. If a reviewer rules this delta mandatory inside 005, that single `supabase/migrations/*` file is **GATE-C / STOP-AT-PR** and the rest of 005 remains standard-gated.

---

## Dependencies

- **ARG-ROOM-001** (`argumentRoomCreationMatrix.ts`) and **ARG-ROOM-002** (the deployed trigger + helpers + RPC) — hard prerequisites; both shipped. 005 consumes their constants and relies on their enforcement.
- **roomCapacityModel.ts / publicSeatModel.ts** — the seat-math single source of truth (cap 5 already reconciled). 005 reuses; it does **not** perform the 6→5 flip (already done).
- **Stage 6.4 rail + seamless entry** (`ArgumentSideActionRail`, `ArgumentGameSurface`, `App.onJoinSide`) — the integration surface.
- **ARG-ROOM-007** (capacity/visibility plain-language copy) — *soft* overlap: 005 adds a minimal `SEAT_CLAIM_COPY` now; 007 owns the final vocabulary and may rename/move it. Flagged in Open questions.
- **ARG-ROOM-006** (invite lifecycle: view/revoke/resend) — the creator-visible reserved-seat surface; 006 may thread a real `knownReservedInviteCount` into 005's model later. Not required for 005.
- **No** dependency on hosted Auth config, live invite smoke, or QOL-040 email transport (roadmap §4.5) — those gate only the eventual live end-to-end smoke, not this client card.

---

## Open questions

1. **Copy ownership vs ARG-ROOM-007.** Land `SEAT_CLAIM_COPY` in `gameCopy.ts` now (recommended — keeps 005 testable + ban-list covered) and let 007 consolidate, or stub the strings and defer all capacity copy to 007? Recommendation: land minimal now; note the consolidation in 007's design.
2. **Full-room affordance shape.** On `room_full`, (a) keep the user in read mode + show the nudge (no write — recommended, public rooms are already readable), or (b) auto-insert an explicit `observer` row so "watching" is recorded? Option (b) exercises proof 5's allowed-observer-join live but writes a row on a failed *active* attempt. Recommendation: (a) by default; expose Watch as the one-tap explicit path.
3. **`knownReservedInviteCount` for the creator.** Thread the QOL-038 `list_for_debate` count into the creator's seat strip in 005, or defer entirely to 006? Recommendation: default `0` in 005; wire the creator count in 006 to avoid an extra invite read here.
4. **Observer→active promotion.** Confirm it stays **out of scope** for 005 (it needs a trigger-on-UPDATE or an Edge path because the 002 trigger is BEFORE INSERT only — a GATE-C concern), and file it as a separate card if product wants seat upgrades.
5. **Operator decision on the DETAIL delta.** Does the operator want the optional GATE-C 002-follow-up that removes `reserved=` from the trigger DETAIL, or is the client-side mitigation (never surface it) sufficient for 6.7?
