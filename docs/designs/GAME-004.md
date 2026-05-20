# GAME-004 — 1v1 PvP room contract and Primary Opponent model

**Status:** Design draft
**Epic:** Epic 12 — Rules UX (PvP argument-game roadmap expansion)
**Release:** 6.6
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/141

---

## Scope-conflict findings (read first)

Two things the issue and coordinator brief reference do not exist in the repo.
Per the coordinator's constraints this design does **not** widen to cover them,
and it does **not** silently add a migration to paper over them. Both are stated
here so the implementer is not surprised.

1. **`docs/roadmap-expansions/2026-05-20-pvp-argument-game-roadmap.md` does not
   exist.** The issue's "Part of …" line points at it. A repo search
   (`Glob "docs/roadmap-expansions/**"`) returns no files. Per the coordinator
   brief the issue body is self-sufficient; this design depends only on the
   issue body, `docs/ux-ui-project-board.md`, and the existing code.

2. **There is no persisted "private vs public" flag and no persisted
   "invited opponent" anywhere in the schema.** `public.debates`
   (`supabase/migrations/20260516000001_initial_schema.sql` lines 137-149) has
   `id, created_by, title, resolution, description, status, constitution_id,
   created_at, updated_at` — no `room_type`, no `is_private`, no `visibility`.
   `public.debate_participants` has `(debate_id, user_id, side, joined_at)` —
   no "invited" / "primary" marker. The `src/features/invites/` module
   (`inviteTypes.ts`) is explicitly **UI/foundation only, not persisted**
   (`PlannedInvite` is "Local-only … not persisted to DB in this stage";
   `ArgumentRoomInviteRecord` is a commented "Future DB shape").

   **This is the load-bearing finding.** The issue and the coordinator both
   require: *no migration, no new DB column, no persistence; the `RoomContract`
   is DERIVED at read-time from existing `debates` / `participants` /
   `arguments` data.* `primaryOpponentUserId` **can** be derived purely at
   read-time (it falls out of `debate_participants` + `arguments`). `roomType`
   **cannot** be derived from existing persisted data alone — nothing in the DB
   records whether a room was opened private or public.

   This design does **not** treat that as a hard blocker (see "Cannot proceed?"
   immediately below). It resolves it without a migration by making `roomType`
   a **caller-supplied input with a documented, doctrine-safe default** rather
   than a derived field. See **Data model → `RoomType` provenance**.

### Cannot proceed? — No. Here is why the card is still buildable.

The card is **not** blocked, because every contract the issue actually asks for
is buildable at read-time:

- `resolvePrimaryOpponent(room, arguments[])` is a **pure function of existing
  data** — `debate_participants` rows + posted `arguments`. No new column.
- `isQualifyingResponse(argument)` is a **pure predicate over an existing
  `arguments` row** + a tiny set of co-located signals already loaded by the
  room (`flagsByArgumentId`, `deletionRequestedMap`). No new column.
- `roomType` is the **only** field that cannot be derived. The issue's own
  `RoomContract` shape lists `roomType` as a *field of the contract*, not as the
  output of a derive function — `resolvePrimaryOpponent` is the only function
  the issue asks to be "deterministic, pure" over `arguments[]`. So `roomType`
  being a constructor input (not a derived value) is consistent with the
  issue's own contract shape. v1 supplies it via a deterministic default
  (`'public'`) plus an optional explicit override; no persistence, no
  migration. A later **migration card** can add a real `debates.room_type`
  column and feed it in — the read-time model does not change when it does.

Therefore: proceed. The design below ships the full pure model + the read-time
room-header UI, takes the `roomType` default as `'public'`, and documents the
exact seam a future migration card plugs into.

---

## Goal (one paragraph)

GAME-004 defines the **1v1 PvP room contract** — the formal model of the two
*primary seats* in an argument room — and the **Primary Opponent assignment
rule**. Today a room has `debate_participants` rows with sides
(`affirmative` / `negative` / `observer` / `moderator`) and a Stage 6.4
observer-vs-participant split, but no notion of *who the two primary parties
are*. Every later PvP card (chime-in seats GAME-005, branch governance BR-004,
resolution GAME-007, pacing GAME-002) needs a well-defined two-party contract so
that "whose move is it", "who governs the mainline", and "who can apply an
enough-tag" are answerable. The deliverable is a **pure-TS deterministic model**
(`roomContractModel.ts`) plus a **small, screen-reader-accessible read-time
header strip** (`RoomContractSeatStrip.tsx`) mounted inside the existing
`DebateDetailHeader`. The doctrine that shapes the whole design:
**seat labels describe a ROLE in the game, never the person** — "Primary
Opponent", never "the challenger who is wrong"; **heat and standing are not seat
properties** (a seat is just "who holds this role", it carries no score); and
**the contract is derived, not persisted** — it recomputes on every room load
from `debates` + `debate_participants` + `arguments`, so it can never drift out
of sync with a stale column. The model is **pure-TS, no React, no Supabase, no
network, no AI**; the UI change is **read-only** (it renders the contract, it
never writes one); there is **no migration, no new dependency, and no route
transition**.

---

## Data model

All types are pure TypeScript, exported from a new
`src/features/rooms/roomContractModel.ts`. No React / Supabase / network
imports. JSON-serializable (so the same model is reusable in an Edge Function
later if a PvP card ever needs it server-side).

### Core contract types (verbatim from the issue)

```ts
/** Whether the room was opened as an invite-only 1v1 or an open public room. */
export type RoomType = 'private' | 'public';

/** The two primary seats in a 1v1 PvP room. */
export type PrimarySeat = 'initiator' | 'primary_opponent';

/**
 * The derived 1v1 room contract. Recomputed on every room load — never
 * persisted. `primaryOpponentUserId` is null when the opponent seat is
 * still open (public room, no qualifying response yet).
 */
export interface RoomContract {
  roomId: string;
  roomType: RoomType;
  /** The room creator. `debates.created_by`. */
  initiatorUserId: string;
  /** The user holding the Primary Opponent seat, or null when the seat is open. */
  primaryOpponentUserId: string | null;
  /** `debates.created_at`. */
  openedAt: string;
  /** The id of the root argument (parentId === null), or null if none yet. */
  openingArgumentId: string | null;
}
```

### `RoomType` provenance — the no-migration resolution

`roomType` is **not derivable from existing persisted data** (finding #2). It is
therefore a **constructor input** with a deterministic default:

```ts
export interface BuildRoomContractInput {
  /** `debates.id`. */
  roomId: string;
  /** `debates.created_by` — the Initiator. Required. */
  initiatorUserId: string;
  /** `debates.created_at`. */
  openedAt: string;
  /**
   * Room type. v1 has no persisted source for this, so the caller supplies
   * it. When omitted it defaults to ROOM_TYPE_DEFAULT ('public') — the
   * doctrine-safe default because a public room leaves the opponent seat
   * OPEN and claimable, whereas a wrong 'private' guess would freeze the
   * seat. A future migration card adds `debates.room_type` and threads the
   * real value here; the model below does not change when it does.
   */
  roomType?: RoomType;
  /**
   * Private-room invited opponent. v1 has no persisted invite, so this is
   * also caller-supplied and optional. Only consulted when roomType ===
   * 'private'. When a private room has an invitedOpponentUserId, that user
   * is the Primary Opponent regardless of post order.
   */
  invitedOpponentUserId?: string | null;
  /** All `debate_participants` rows for the room (already RLS-loaded). */
  participants: ReadonlyArray<RoomParticipantInput>;
  /**
   * All posted `arguments` rows for the room, any order. The model sorts
   * them chronologically internally.
   */
  arguments: ReadonlyArray<RoomArgumentInput>;
  /**
   * Optional per-argument signals used by `isQualifyingResponse` to reject
   * a sniped seat claim. All optional — an empty map means "no extra
   * signal", and the predicate falls back to the row's own fields.
   */
  signals?: QualifyingResponseSignals;
}

/** Default room type when the caller cannot supply one. Public = seat stays open. */
export const ROOM_TYPE_DEFAULT: RoomType = 'public';
```

```ts
/** A `debate_participants` row, narrowed to what the contract needs. */
export interface RoomParticipantInput {
  userId: string;
  /** 'affirmative' | 'negative' | 'observer' | 'moderator'. */
  side: string;
  /** `debate_participants.joined_at` ISO string. */
  joinedAt: string;
}

/** An `arguments` row, narrowed to what the contract + predicate need. */
export interface RoomArgumentInput {
  id: string;
  parentId: string | null;
  authorId: string | null;
  /** 'thesis' | 'claim' | 'rebuttal' | 'counter_rebuttal' | 'evidence' |
   *  'clarification_request' | 'concession' | 'synthesis'. */
  argumentType: string | null;
  body: string;
  /** 'draft' | 'posted' | 'hidden' | 'deleted'. */
  status: string | null;
  createdAt: string;
  /** Optional — true when the row is a bot fixture move. */
  isBot?: boolean | null;
}

/**
 * Co-located per-argument signals the room already loads (Stage 6.4 / EV /
 * META). All optional. Used to reject a sniped first response.
 */
export interface QualifyingResponseSignals {
  /**
   * Per-argument open (non-dismissed) flag codes — from `argument_flags`.
   * Already loaded by `useArgumentRoomMessages` as `flagsByArgumentId`.
   */
  flagCodesByArgumentId?: Record<string, ReadonlyArray<string>>;
  /**
   * Per-argument "has an open deletion request" boolean — the room's
   * existing `deletionRequestedMap`. A move with an open deletion request
   * does NOT claim the seat.
   */
  deletionRequestedByArgumentId?: Record<string, boolean>;
}
```

### Predicate result type

`isQualifyingResponse` returns a small explainable struct, not a bare boolean,
so the implementer can unit-test *why* a response was rejected and so a future
card can surface a non-accusatory hint ("This won't claim the seat yet — it's
flagged for review"). The issue asks for a `boolean` predicate; we satisfy that
with `isQualifyingResponse(...)` returning `boolean` and additionally export
`explainQualifyingResponse(...)` returning the struct. The boolean is
`explain(...).qualifies`.

```ts
export type DisqualifyReason =
  | 'not_a_mainline_move' //   evidence-only / clarification-request-only one-liner, or a non-argumentative type
  | 'too_short' //            body below MIN_QUALIFYING_BODY_CHARS after trim
  | 'is_root' //              the root/opening argument itself is never a "response"
  | 'authored_by_initiator' // the OP's own move never claims the opponent seat
  | 'not_posted' //           status !== 'posted' (draft / hidden / deleted)
  | 'flagged_for_review' //   has an open review/blocking flag
  | 'deletion_requested' //   has an open deletion request
  | 'bot_move'; //            isBot === true — bots never claim a human PvP seat (GAME-008 owns bot rooms)

export interface QualifyingResponseResult {
  qualifies: boolean;
  /** null when qualifies === true; the first failing reason otherwise. */
  reason: DisqualifyReason | null;
}

export function isQualifyingResponse(
  argument: RoomArgumentInput,
  options: IsQualifyingResponseOptions,
): boolean;

export function explainQualifyingResponse(
  argument: RoomArgumentInput,
  options: IsQualifyingResponseOptions,
): QualifyingResponseResult;
```

### Seat view-model (for the UI)

```ts
/** One of the two seats, projected for rendering. Pure data — no JSX. */
export interface SeatViewModel {
  seat: PrimarySeat;
  /**
   * Plain-language label describing the seat's relationship to the VIEWER.
   * 'You' | 'Opponent' | 'Open seat — first reply takes it'.
   * Never the person's name, never a verdict word.
   */
  label: string;
  /** True when this seat is held by the current viewer. */
  isViewer: boolean;
  /** True when this seat is currently unclaimed (opponent seat, open public room). */
  isOpen: boolean;
  /** The userId in the seat, or null when isOpen. NOT rendered as text. */
  userId: string | null;
}

/** The full read-time projection the header strip renders. */
export interface RoomContractViewModel {
  roomId: string;
  /** 'Private room' | 'Public room'. */
  roomTypeLabel: string;
  initiatorSeat: SeatViewModel;
  opponentSeat: SeatViewModel;
  /**
   * Whose move it is, in plain language, or null when it cannot be
   * determined (no opening argument yet, or opponent seat still open).
   * 'Your move' | "Opponent's move" | 'Waiting for the first reply' |
   * 'Open seat — first reply takes it'.
   */
  turnLabel: string | null;
  /** The id of the opening (root) argument, or null. Used to scroll/anchor. */
  openingArgumentId: string | null;
  /** Full a11y label for the strip root (see Accessibility section). */
  accessibilityLabel: string;
}
```

### Turn model — minimal and explicitly scoped

The issue requires the header to show "current turn". GAME-004 ships a
**minimal, deterministic** turn signal only — **turn *pacing* is GAME-002's
job** (non-scope item in the issue). The rule:

- If there is no opening argument → `turnLabel = 'Waiting for the first reply'`
  is wrong; with no root the room has not opened. Use
  `turnLabel = null` (header shows the opening-claim row only).
- If the opponent seat is still open (public room, unclaimed) →
  `turnLabel = 'Open seat — first reply takes it'`.
- Otherwise the move belongs to whoever did **not** author the latest posted
  mainline argument. If the latest mainline author is the Initiator →
  it is the Primary Opponent's move; if the latest is the Primary Opponent →
  it is the Initiator's move. Project relative to the viewer:
  `'Your move'` / `"Opponent's move"` / (for an observer) `"Initiator's move"`
  / `"Opponent's move"`.

"Mainline argument" here = a posted argument authored by either primary seat
holder (chime-in / observer moves are ignored — they do not change whose turn it
is on the 1v1 mainline). This keeps GAME-004's turn signal correct even before
GAME-005 introduces chime-in seats.

---

## File changes

### New files

- `src/features/rooms/roomContractModel.ts` — **pure-TS model** (~260 lines).
  Exports the types above plus the functions:
  `buildRoomContract(input): RoomContract`,
  `resolvePrimaryOpponent(input): string | null`,
  `isQualifyingResponse(argument, options): boolean`,
  `explainQualifyingResponse(argument, options): QualifyingResponseResult`,
  `buildRoomContractViewModel(contract, viewerUserId): RoomContractViewModel`,
  and the constants `ROOM_TYPE_DEFAULT`, `PRIMARY_OPPONENT_INACTIVITY_MS`,
  `MIN_QUALIFYING_BODY_CHARS`, plus `ROOM_CONTRACT_COPY` (frozen string set,
  re-exported for tests so they never re-author copy).
- `src/features/rooms/RoomContractSeatStrip.tsx` — **read-time RN component**
  (~140 lines). Renders the two seats + room-type chip + turn label as a
  horizontal strip. Pure presentation over `RoomContractViewModel`. No state,
  no network, no write path.
- `src/features/rooms/index.ts` — barrel export (~6 lines).
- `__tests__/roomContractModel.test.ts` — pure-model tests (~340 lines, see
  Test plan).
- `__tests__/roomContractSeatStrip.test.tsx` — component render tests
  (~150 lines).
- `__tests__/roomContractDoctrine.test.ts` — ban-list + doctrine assertions
  (~90 lines).

### Modified files

- `src/features/debates/DebateDetailHeader.tsx` — **add** the
  `RoomContractSeatStrip` below the existing title/resolution block. The
  component takes one new optional prop `roomContract?: RoomContractViewModel`.
  When the prop is absent the header renders exactly as today (zero behavior
  change for any caller that does not pass it). ~15 lines changed: one import,
  one prop, one conditional render. **Nothing existing is removed** — the
  status badge, side badge, title, resolution, and Leave button are untouched.
- `App.tsx` — the room mount (around line 308-315) builds the contract and the
  view-model and passes `roomContract` into `DebateDetailHeader`. ~25 lines
  added: it already has `currentDebate`, `participantSide`, and the session
  `userId`; it needs the participants list and the room's arguments. The
  arguments are already loaded inside `FullRoomGameSurfaceMount` via
  `useArgumentRoomMessages` — to avoid a second fetch, App.tsx uses a small
  new hook (next item). See Risks for the data-plumbing note.
- `src/features/debates/index.ts` — re-export `RoomContractSeatStrip` /
  `roomContractModel` types if any debate-layer consumer needs them. ~2 lines.

### New supporting hook (small, not a "file change to existing logic")

- `src/features/rooms/useRoomContract.ts` — a thin React hook (~70 lines) that
  loads `debate_participants` for the room (one RLS-bound `select`) and the
  room's posted `arguments` (it can reuse `listArgumentsForDebateIds([id])`
  from `src/features/debates/useGalleryArguments` machinery, or
  `useArgumentRoomMessages` shape), then calls `buildRoomContract` +
  `buildRoomContractViewModel`. This hook is the **only** new I/O. It performs
  **reads only** — `select` on `debate_participants` and `arguments`. No
  insert, no update, no service-role, no Edge Function.

  *Implementer note:* if plumbing a second participants query is judged too
  heavy for v1, an acceptable fallback is to derive a **degraded** contract
  from data App.tsx already has (`currentDebate.createdBy`, the viewer's
  `participantSide`, and the root argument) and render the strip with the
  opponent seat shown as "Open seat" whenever the opponent identity is unknown.
  The model supports this: pass `participants: []` and the resolver returns
  `null` (open seat). Prefer the real query; the fallback is documented so the
  card is not blocked on a plumbing decision.

### Deleted files

None.

---

## API / interface contracts

### `buildRoomContract(input: BuildRoomContractInput): RoomContract`

Deterministic. Steps:

1. `roomType = input.roomType ?? ROOM_TYPE_DEFAULT`.
2. `openingArgumentId` = the id of the single `arguments` row with
   `parentId === null && status === 'posted'`, chosen as the **earliest by
   `createdAt`** if more than one exists (defensive — schema does not forbid
   multiple roots). `null` when none.
3. `primaryOpponentUserId = resolvePrimaryOpponent(input)`.
4. Returns the frozen `RoomContract`.

### `resolvePrimaryOpponent(input: BuildRoomContractInput): string | null`

Deterministic, pure. The single source of truth for who holds the opponent
seat. Algorithm:

```
if roomType === 'private':
    if invitedOpponentUserId is a non-empty string AND
       invitedOpponentUserId !== initiatorUserId:
        return invitedOpponentUserId        // invite overrides post order
    // private room with no recorded invite → fall through to the public rule
    // (so a private room still resolves an opponent from real activity)

// public rule (and private-without-invite fallback):
// 1. Build the chronological list of posted arguments (sort by createdAt asc,
//    tie-break by id asc for determinism).
// 2. Walk it; for each argument call isQualifyingResponse(arg, options).
//    options.initiatorUserId = input.initiatorUserId; signals = input.signals.
// 3. The FIRST qualifying argument's authorId is the Primary Opponent.
// 4. If no argument qualifies → return null (seat is open).
```

Abandoned-seat re-open: `resolvePrimaryOpponent` is **purely a function of the
current data** — it does not itself "re-open" anything. The inactivity re-open
is a *caller* concern: see "Abandoned-seat re-open" under Edge cases. The
exported constant `PRIMARY_OPPONENT_INACTIVITY_MS` is the named window the
caller uses; the model exposes one helper for it (below).

### `isPrimaryOpponentSeatStale(contract, arguments, nowMs): boolean`

```ts
/**
 * True when the Primary Opponent seat MAY be re-opened: the seat is claimed,
 * and the Primary Opponent has not posted a qualifying mainline move within
 * PRIMARY_OPPONENT_INACTIVITY_MS. Advisory only — it never mutates the
 * contract. The OP (caller) decides whether to act on it.
 */
export function isPrimaryOpponentSeatStale(
  contract: RoomContract,
  argumentsList: ReadonlyArray<RoomArgumentInput>,
  nowMs: number,
): boolean;
```

The decision to actually re-open is **out of scope for GAME-004's automatic
path** — the issue's adopted default is "**only via inactivity re-open**", and
re-opening is an *explicit OP action* (it would be a follow-up card that lets
the OP clear the opponent and re-derive). GAME-004 ships the deterministic
*detector* (`isPrimaryOpponentSeatStale`) and the named constant; it does not
ship a re-open mutation (no persistence exists to mutate, and an explicit
re-open UI is a separate card). This is the adopted default stated verbatim.

### `isQualifyingResponse(argument, options): boolean`

```ts
export interface IsQualifyingResponseOptions {
  /** The room Initiator — used for the `authored_by_initiator` rejection. */
  initiatorUserId: string;
  /** Optional co-located signals (flags, deletion requests). */
  signals?: QualifyingResponseSignals;
}
```

Deterministic predicate. Returns `false` (with a `DisqualifyReason` from
`explainQualifyingResponse`) when **any** of these hold, checked in this order:

1. `status !== 'posted'` → `not_posted`.
2. `parentId === null` → `is_root` (the opening argument is never a "response").
3. `authorId === options.initiatorUserId` (or `authorId == null`) →
   `authored_by_initiator`.
4. `isBot === true` → `bot_move` (bots never claim a human PvP seat;
   GAME-008 owns bot rooms).
5. `signals.deletionRequestedByArgumentId[argument.id] === true` →
   `deletion_requested`.
6. `signals.flagCodesByArgumentId[argument.id]` contains any code in
   `SEAT_BLOCKING_FLAG_CODES` (a small frozen set: review/blocking-severity
   moderation flags such as `civility`, `spam`, `off_topic_blocking`, plus
   any code the room already treats as review/blocking) → `flagged_for_review`.
7. `argumentType` is not in `MAINLINE_RESPONSE_TYPES` →
   `not_a_mainline_move`. `MAINLINE_RESPONSE_TYPES` =
   `{'claim','rebuttal','counter_rebuttal','concession','synthesis'}`.
   `evidence` and `clarification_request` are **not** mainline-claiming moves
   on their own — an opponent who only attaches a source or only asks a
   one-line clarification has not yet made the real argumentative move that
   claims the seat. (This is the anti-sniping core: a bare
   `clarification_request` one-liner does not take the seat.)
8. `body.trim().length < MIN_QUALIFYING_BODY_CHARS` → `too_short`.
   `MIN_QUALIFYING_BODY_CHARS` is a small named constant (proposed `40`) — a
   real argumentative move is at least a sentence; a one-word "no" or "lol"
   does not claim the seat. This is the second anti-sniping gate.

Otherwise → `qualifies: true, reason: null`.

Note on item 7: the issue says a qualifying response is "a real argumentative
move on the mainline". `evidence` and `clarification_request` are legitimate
moves, but they are *support / inquiry* moves, not the claim-staking
back-and-forth that defines the second primary party. Excluding them from
seat-claiming is the deterministic encoding of "real argumentative move". This
is documented here so the implementer does not relax it casually — it is the
anti-sniping mechanism the issue's Risks section names.

### `buildRoomContractViewModel(contract, viewerUserId): RoomContractViewModel`

Pure projection. `viewerUserId` may be `null` (observer not signed in / not a
participant). Label rules:

- `roomTypeLabel`: `'Private room'` / `'Public room'`.
- `initiatorSeat.label`: `'You'` when `viewerUserId === initiatorUserId`, else
  `'Initiator'`. (Never the display name — GAME-004 does not load profiles.)
- `opponentSeat.label`:
  - `primaryOpponentUserId === null` → `'Open seat — first reply takes it'`,
    `isOpen: true`.
  - `viewerUserId === primaryOpponentUserId` → `'You'`.
  - else → `'Opponent'`.
- `turnLabel`: per the Turn model section above.
- `accessibilityLabel`: see Accessibility.

### `RoomContractSeatStrip` props

```ts
interface RoomContractSeatStripProps {
  viewModel: RoomContractViewModel;
}
```

The component is **pure render**. It renders, in a single horizontal row that
wraps on narrow screens:

- a room-type chip (`Private room` / `Public room`) — text + a non-color glyph
  (a lock glyph `🔒`-equivalent drawn as a `<Text>` character or a small
  bordered shape; **shape/text, not color, carries the meaning**);
- the Initiator seat pill (`You` / `Initiator`);
- a `vs` separator (`<Text>`);
- the Primary Opponent seat pill (`You` / `Opponent` / `Open seat — first reply
  takes it`);
- the turn label (`Your move` / `Opponent's move` / etc.) when non-null.

No `Pressable` — the strip is informational in v1 (the issue says "read-time UI
contract"; tapping a seat to act is a later card). Therefore no 44px tap-target
requirement applies, but every text node is inside `<Text>` and the strip root
carries an `accessibilityLabel` + `accessibilityRole="summary"` (or no role
with a label, per RN — see Accessibility).

---

## Edge cases

The implementer must handle every one of these; each maps to a named test.

- **Empty room (no arguments).** `openingArgumentId = null`,
  `primaryOpponentUserId = null`, `turnLabel = null`. Strip shows room type +
  Initiator + "Open seat — first reply takes it".
- **Root-only room (opening argument, no replies).** Opponent seat open,
  `turnLabel = 'Open seat — first reply takes it'`.
- **First response is spam / too short** (`too_short`). Does **not** claim the
  seat; resolver keeps walking; seat stays open if nothing else qualifies.
- **First response is a bare flag.** A "flag" is not an `arguments` row — it is
  an `argument_flags` row — so it is never even a candidate. Additionally, an
  argument that *carries* an open review/blocking flag is rejected
  (`flagged_for_review`). Both paths covered.
- **First response is off-topic one-liner.** Caught by `too_short` and/or
  `flagged_for_review` (if an `off_topic` review flag is present). The model
  does not itself run topic analysis (no AI in the app) — it relies on the
  short-body gate plus any flag the room already loaded. Documented so the
  implementer does not add an AI call.
- **First response is immediately deletion-requested.** `deletion_requested`
  rejection — does not claim the seat.
- **First posted response is the Initiator's own move** (OP replies to their
  own root). `authored_by_initiator` — never claims the opponent seat.
- **First qualifying response is a bot move** (`isBot === true`). `bot_move`
  rejection — bots do not claim a human PvP seat. (GAME-008 owns bot rooms.)
- **Invited-private overrides post-order.** `roomType === 'private'`,
  `invitedOpponentUserId = U`. Even if user `V` posts the first qualifying
  response, `resolvePrimaryOpponent` returns `U`. Test asserts exactly this.
- **Private room with no recorded invite.** `roomType === 'private'`,
  `invitedOpponentUserId` null/undefined → falls through to the public
  first-qualifying-response rule (a private room still resolves an opponent
  from real activity rather than freezing forever).
- **`invitedOpponentUserId === initiatorUserId`** (malformed input). Ignored —
  the OP cannot be their own opponent; falls through to the public rule.
- **Abandoned-seat re-open.** The Primary Opponent stops posting.
  `isPrimaryOpponentSeatStale(contract, args, nowMs)` returns `true` once
  `PRIMARY_OPPONENT_INACTIVITY_MS` has elapsed since the opponent's last
  qualifying mainline move. The **adopted default** is *only via inactivity
  re-open* — GAME-004 ships the detector + the named constant; the actual
  re-open is an explicit OP action in a follow-up card (no persistence to
  mutate in v1).
- **Sniping** — a low-effort move racing to claim the seat. Mitigated entirely
  by `isQualifyingResponse`: `too_short` + `not_a_mainline_move` +
  `flagged_for_review` + `deletion_requested` together mean a one-word reply, a
  bare clarification, or a flagged move never takes the seat. The first
  *substantive* response does.
- **OP cannot reject a qualifying first responder.** The **adopted default** is
  *no — anti-griefing*. There is no "reject" function in the model. Once a
  response qualifies, `resolvePrimaryOpponent` returns that author and there is
  no API to override it. A non-qualifying response simply does not claim the
  seat (the predicate is the only gate). This is encoded by *omission* — the
  test `roomContractModel.test.ts` asserts the exported surface has no reject /
  override function.
- **Two qualifying responses posted within the same millisecond.** Resolver
  sorts by `createdAt` then tie-breaks by `id` ascending — fully
  deterministic, no race.
- **Detached / orphaned arguments** (`parentId` points at a soft-deleted
  parent). They are still candidates if `status === 'posted'` and they pass the
  predicate — the resolver does not require the parent to exist (it only
  excludes the root). Documented so the implementer does not over-filter.
- **Observer viewer (`viewerUserId === null` or not a seat holder).** Both
  seat labels render as `'Initiator'` / `'Opponent'` / `'Open seat …'`; no
  `'You'`. `turnLabel` projects as `"Initiator's move"` / `"Opponent's move"`.
- **Concurrent edits.** Not applicable — the contract is read-only and
  recomputed on every load. There is no write path to conflict.
- **Offline / network failure.** `useRoomContract` read fails → the hook
  returns `null`, App.tsx omits the `roomContract` prop, and
  `DebateDetailHeader` renders exactly as it does today (graceful degradation,
  no crash, no error banner specific to the contract).
- **Doctrine edge case — "what if the room is hot, does that change the
  seats?"** No. Heat is an activity signal; it is not an input to
  `buildRoomContract` or `resolvePrimaryOpponent`. A seat is "who holds this
  role", full stop. The model file imports nothing from the heat / standing /
  score modules — enforced by a forbidden-import test.

---

## Test plan

All tests are Jest, matching repo conventions. Pure-model tests import the
model directly (no React / Supabase / fetch). Component tests use the existing
React Testing Library setup.

### `__tests__/roomContractModel.test.ts` — pure model

- **`resolvePrimaryOpponent` edge table** (one `it` per row, data-driven):
  - first qualifying response → that author is the opponent.
  - spam-first (too short) → seat stays open, second qualifying move wins.
  - flag-first (carries a review flag) → rejected, seat stays open.
  - deletion-requested-first → rejected, seat stays open.
  - off-topic one-liner first → rejected via `too_short`.
  - OP's own first reply → rejected (`authored_by_initiator`).
  - bot first reply → rejected (`bot_move`).
  - invited-private → invited user wins even when someone else posts first.
  - private-without-invite → falls through to first-qualifying-response.
  - `invitedOpponentUserId === initiatorUserId` → ignored, public rule applies.
  - empty `arguments` → `null`.
  - root-only room → `null`.
  - two qualifying moves same `createdAt` → deterministic `id`-tie-break.
- **`isQualifyingResponse` / `explainQualifyingResponse` predicate table**
  (one `it` per `DisqualifyReason` + the happy path):
  `not_posted`, `is_root`, `authored_by_initiator`, `bot_move`,
  `deletion_requested`, `flagged_for_review`, `not_a_mainline_move`
  (an `evidence`-typed and a `clarification_request`-typed move both rejected),
  `too_short` (39-char body rejected, 40-char accepted at the boundary), and a
  full happy-path `rebuttal` returning `qualifies: true, reason: null`.
- **`buildRoomContract`**: assembles `roomId`/`roomType`/`initiatorUserId`/
  `openedAt`/`openingArgumentId`/`primaryOpponentUserId`; `roomType` defaults
  to `'public'` when omitted; multiple-root defensive pick = earliest.
- **`buildRoomContractViewModel`**: `'You'` vs `'Initiator'` vs `'Opponent'`
  vs `'Open seat — first reply takes it'` for viewer = initiator / opponent /
  observer / null; `turnLabel` for each turn state.
- **`isPrimaryOpponentSeatStale`**: false before the window, true after, false
  again when the opponent posts a fresh qualifying move; false when the seat
  is still open.
- **Determinism**: calling `buildRoomContract` twice on the same input is
  deeply equal (`toEqual`).
- **No-mutation**: the input `arguments` / `participants` arrays are not
  mutated (`Object.freeze` the fixtures and assert no throw).
- **API surface**: the module exports no `rejectOpponent` / `setOpponent` /
  `replaceOpponent` / `overrideSeat` function (anti-griefing default encoded
  by omission) — assert `typeof (mod as any).rejectOpponent === 'undefined'`.

### `__tests__/roomContractSeatStrip.test.tsx` — component render

- renders both seat pills + room-type chip for a **public, seat-open** room.
- renders `'You'` on the Initiator seat when viewer is the OP.
- renders `'You'` on the Opponent seat when viewer is the Primary Opponent.
- renders `'Private room'` chip when `roomType === 'private'`.
- renders the `turnLabel` when non-null; omits the turn row when null.
- every visible string is inside a `<Text>` element (no raw string in a
  `<View>`); strip root exposes `accessibilityLabel`.

### `__tests__/roomContractDoctrine.test.ts` — ban-list + doctrine

- **Ban-list**: collect every string in `ROOM_CONTRACT_COPY` and every label
  produced by `buildRoomContractViewModel` across all viewer permutations;
  assert none contains (case-insensitive) `winner`, `loser`, `correct`,
  `incorrect`, `true`, `false`, `right`, `wrong`, `liar`, `dishonest`,
  `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`,
  `idiot`, `challenger who is wrong`.
- **Forbidden imports**: source-scan `roomContractModel.ts` — assert it does
  **not** import from `react`, `../../lib/supabase`, any score / standing /
  heat module (`argumentScoreModel`, `claimStanding`, `pointStanding`,
  `heatModel`, `antiAmplification`), or any network module. The contract is
  not influenced by score or heat — proven by the absence of the import.
- **No service-role / no Edge Function**: source-scan `roomContractModel.ts`
  and `RoomContractSeatStrip.tsx` for `SERVICE_ROLE` / `service_role` /
  `functions.invoke` → zero matches.

(Test-count expectation: roughly +55–70 tests across the three files. The
implementer updates `docs/current-status.md` with the confirmed number after
`npm run test` passes — per test-discipline, only after it actually passes.)

---

## Dependencies (cards / docs / files)

- **Assumes IX-004 (#135) is complete** — shipped. The selected-message readout
  surface establishes the "read-time projection of room state into a header
  strip" pattern; `RoomContractSeatStrip` follows the same shape
  (`buildXViewModel` → thin presentational component).
- **Assumes COMPOSER-002 (#111) is complete** — shipped. In-board moves mean
  the room surface (and thus the header) stays mounted during a move, so the
  contract strip never unmounts/remounts mid-interaction.
- **Reads existing types**: `Debate` / `ParticipantSide` from
  `src/features/debates/types.ts`; `ArgumentRow` / `ArgumentStatus` /
  `ArgumentType` from `src/features/arguments/types.ts`. The model's input
  interfaces (`RoomParticipantInput`, `RoomArgumentInput`) are *narrowed*
  copies — the model deliberately does not import the app types so it stays
  decoupled and JSON-serializable. The *caller* maps app rows → input shapes.
- **Reads existing data shapes**: `debates.created_by` (Initiator),
  `debates.created_at` (`openedAt`), `debate_participants` rows,
  `arguments` rows. All confirmed in
  `supabase/migrations/20260516000001_initial_schema.sql`.
- **Reuses existing room signals**: `flagsByArgumentId` and
  `deletionRequestedMap` already produced by `useArgumentRoomMessages` /
  `ArgumentGameSurface` feed `QualifyingResponseSignals`.
- **Will block GAME-005** (public chime-in seats 3–6) — chime-in governance is
  defined relative to the two primary seats this card establishes.
- **Will block BR-004** (branch grammar) and **GAME-007** (resolution /
  enough-tags) — both need "which two parties govern the mainline".
- **Future migration card** plugs into the `roomType` / `invitedOpponentUserId`
  seam: when `debates.room_type` (and a persisted invite) exist, the caller
  passes the real values into `BuildRoomContractInput`; the model is unchanged.

---

## Risks

- **`roomType` has no persisted source (the main risk).** v1 defaults every
  room to `'public'`. Consequence: a room the OP *intended* as private 1v1 is
  modeled as public until a real responder claims the seat — which is the
  *safe* failure mode (the seat stays open and claimable; nobody is wrongly
  frozen out). The wrong direction (defaulting to `'private'`) would freeze the
  opponent seat forever in a genuinely public room. The default is chosen
  deliberately for that reason. The follow-up migration card removes the risk.
- **Data plumbing in App.tsx.** The header lives in `App.tsx`; the room's
  arguments are loaded a level down in `FullRoomGameSurfaceMount` via
  `useArgumentRoomMessages`. Threading them up, or adding the small
  `useRoomContract` read, is the fiddliest part. The design gives the
  implementer an explicit **degraded fallback** (derive from
  `currentDebate.createdBy` + viewer side + root only, opponent shown "Open
  seat") so the card is never blocked on this. Prefer the real query.
- **`debate_participants` RLS.** The new read in `useRoomContract` does a
  `select` on `debate_participants`. The existing RLS
  (`20260516000002_rls_policies.sql`) already governs that table; no policy
  change is needed (the design adds **no** migration). If the existing policy
  does not let a participant read co-participant rows, the resolver still works
  from `arguments` alone (the public first-qualifying-response rule needs only
  `arguments` + `initiatorUserId`); the participants list is used only for the
  private-invite path and for nothing the public path requires. Documented so
  the implementer verifies the policy but is not blocked by it.
- **`MIN_QUALIFYING_BODY_CHARS = 40` is a judgement call.** Too high rejects a
  terse-but-real rebuttal; too low lets "I disagree." snipe the seat. 40 chars
  ≈ one short sentence. It is a single named constant so a future card can tune
  it with one edit; tests pin the boundary (39 rejected / 40 accepted).
- **No existing test should need updating.** `DebateDetailHeader` gains an
  *optional* prop with a no-render default; existing `DebateDetailHeader`
  callers and tests are unaffected. If a snapshot test of the header exists it
  will not change (the strip only renders when the prop is passed).

---

## Out of scope

Explicitly **not** in GAME-004 (each is named in the issue's Non-scope or Do-not
sections):

- Public chime-in seats 3–6 and their governance → **GAME-005**.
- Branch / tangent grammar → **BR-004**.
- Resolution, enough-tags, room closing → **GAME-007**.
- Turn *pacing* (cooldowns, daily caps, response windows) → **GAME-002**.
  GAME-004 ships only a *minimal turn label* ("whose move"), not pacing.
- Bot rooms / bot-vs-human seat assignment → **GAME-008**. GAME-004 explicitly
  rejects bot moves from claiming a human PvP seat (`bot_move`).
- Any **Supabase schema change** — no `debates.room_type` column, no persisted
  invite table, no migration. Those belong to a follow-up migration card.
- Any **write path** — the contract is derived and read-only. No re-open
  mutation, no "set opponent", no "reject opponent" function.
- Profile / display-name loading — seats are labeled by *role* relative to the
  viewer (`You` / `Opponent` / `Initiator`), never by name.
- A route / screen transition — the strip renders inside the existing
  `DebateDetailHeader`.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels, score never blocks posting, no
  service-role).** Seat labels are `You` / `Opponent` / `Initiator` / `Open
  seat — first reply takes it` — pure role descriptions, zero verdict words.
  `RoomContract` carries no score, no band, no heat. The model never blocks
  anything (it has no write path at all). No service-role: the model is
  pure-TS; the one new read hook uses the standard RLS-bound anon client.
  Enforced by `roomContractDoctrine.test.ts` (ban-list + service-role scan).
- **cdiscourse-doctrine §2 (heat = activity).** Heat is not an input to the
  contract. `roomContractModel.ts` imports nothing from any heat module —
  enforced by the forbidden-import test. A hot room and a quiet room produce
  identical seat assignments for identical participant/argument data.
- **cdiscourse-doctrine §3 (popularity is not evidence).** Not applicable —
  the contract derives from authorship and post order, never from engagement
  counts. Seat assignment cannot be bought with replies/views.
- **cdiscourse-doctrine §9 (plain language).** No internal `snake_case` code
  ever reaches a user string. `DisqualifyReason` values are internal enum
  members used only in tests / future hint copy; the UI renders only the
  frozen `ROOM_CONTRACT_COPY` plain strings.
- **point-standing-economy (seats stay separate from standing).** A seat is
  "who holds this game role". It is **not** a standing band, **not** a point
  total, **not** a debt. `RoomContract` and `SeatViewModel` have no numeric
  field. The model file does not import `argumentScoreModel`, `claimStanding`,
  `pointStanding`, or `antiAmplification` — enforced by the forbidden-import
  test. A user can hold the Primary Opponent seat while their points are in any
  band; the two are orthogonal, exactly as the doctrine requires.
- **accessibility-targets.** `RoomContractSeatStrip` exposes an
  `accessibilityLabel` on the strip root summarising room type + both seats +
  whose turn (e.g. *"Public room. You are the Initiator. Opponent seat is
  open — the first qualifying reply takes it."*). The room-type chip carries a
  **shape/text glyph**, not color alone (color-independence). Every string is
  inside `<Text>`. The strip is informational (no `Pressable`) so the 44px
  tap-target rule does not apply; if a future card makes a seat tappable it
  must add `hitSlop` then. Turn changes are not announced via
  `announceForAccessibility` (would be chatty); the label updates on re-render,
  which the screen reader picks up on focus.
- **expo-rn-patterns.** No new dependency. `RoomContractSeatStrip` is built
  from `<View>` + `<Text>` flexbox primitives only. The model lives in
  `src/features/rooms/roomContractModel.ts` and is pure TS with no React /
  Supabase import (matches the `*Model.ts` convention). The component is a
  thin presentational layer over the view-model.
- **timeline-grammar.** Not engaged — GAME-004 touches the *room header*, not
  node rendering, branch lanes, or strength bands. The seat strip introduces no
  node visual and no new token. No conflict.
- **test-discipline.** Three test files ship with the card (model, component,
  doctrine), covering every public function's happy path and failure cases,
  the full `resolvePrimaryOpponent` edge table, the full `isQualifyingResponse`
  predicate table, and the ban-list. Tests are part of this card's deliverable,
  not a follow-up.

---

## Operator steps (if any)

**None — pure code change.** No migration (`npx supabase db push` not needed),
no Edge Function deploy, no new env var, no new dependency to install. The card
adds a pure-TS model, one read-only RN component, one read-only React hook
(standard RLS-bound `select` only), and a small optional-prop addition to an
existing header component. Nothing for the operator to run after the implementer
commits.
