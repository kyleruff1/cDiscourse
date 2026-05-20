# GAME-008 — Bot public-room policy and public argument seeding

**Status:** Design draft
**Epic:** Rules UX (PvP argument-game roadmap expansion)
**Release:** 6.7
**Priority / Effort:** P2 / M
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/147
**Branch:** `feat/GAME-008-game-008-bot-public-room-policy-and-publ`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\GAME-008.md`

**Depends on (verified against the repo at the head of this worktree — Stage 6.4 complete):**
- **GAME-004** (1v1 PvP room contract + Primary Opponent model, #141) — MERGED. Model at
  `src/features/debates/roomContractModel.ts`. Owns `RoomContract`, `RoomType`, `PrimarySeat`,
  `RoomArgumentInput`, `RoomParticipantInput`, `buildRoomContract`, `resolvePrimaryOpponent`,
  `isQualifyingResponse`, `ROOM_TYPE_DEFAULT`. **`RoomArgumentInput` already carries an optional
  `isBot?: boolean | null` field** and `isQualifyingResponse` already rejects a bot move with the
  `bot_move` `DisqualifyReason`. GAME-008 consumes this; it does not redesign the contract.
- **GAME-005** (public-room seats + chime-in governance, #142) — MERGED. Model at
  `src/features/debates/publicSeatModel.ts`. Owns `PublicSeat`, `SeatRole`, `PublicRoomSeatMap`,
  `buildPublicRoomSeatMap`, `PUBLIC_ROOM_SEAT_CAP = 6`, `MovedToObserverRecord`,
  `ObserverFallbackReason` (`'overflow' | 'governance'`). `buildPublicRoomSeatMap` already
  **excludes bot authors from claiming a chime-in seat** (it reuses GAME-004's `isBot` exclusion).
  GAME-008 consumes this seat model; it does not redesign seats or governance.
- **BR-004** (branch grammar, #143) — MERGED. `src/features/arguments/branchGrammarModel.ts`.
  Referenced as already-built; not touched by GAME-008.
- **Existing bot infrastructure (read, not redesigned):** `public.bot_user_registry` table
  (`supabase/migrations/20260516000007_stage6_admin_operations.sql`), the
  `admin-users` Edge Function `create_bot_user` action, `scripts/bot-fixtures/` corpus runners,
  and the `bot-provocateur` / `bot-revocateur` skill gates (operator-gated, CLAUDE.md "Narrow
  exception"). GAME-008 is the **product-level policy** for bots in public rooms — it is **not**
  the bot-fixture runner internals.

---

## §0 — Card-vs-reality discrepancies (read this first)

The card names symbols, shapes, and an assumed data model. Every one was checked against the
actual repo at the head of this worktree. Where the card and reality disagree, **the design
follows reality** — the same discipline GAME-004 §0 and GAME-005 §0 applied.

| # | Card says | Reality | Design decision |
|---|---|---|---|
| D1 | `BotRoomPolicy { botsMayCreate: 'public_only', botMarkingRequired: true, botMayBePrimaryOpponentOfRealUser: false }` is a "data/model contract to design later". | No `BotRoomPolicy` symbol exists anywhere in `src/`. | GAME-008 ships `BotRoomPolicy` as a **frozen pure-TS constant** (not a row, not a per-room record) in a new `src/features/debates/botRoomPolicyModel.ts`. It is a single immutable policy object the whole app reads — there is exactly one policy, app-wide. §1.1. |
| D2 | `isBotSeededRoom(room): boolean` — a clean boolean over a "room". | There is **no `is_bot` column on `public.profiles`** (`20260516000001_initial_schema.sql` — `profiles` is `id, display_name, role, created_at` only). A bot's identity lives in **`auth.users.user_metadata.is_bot = true`** (set by `admin-users` `create_bot_user`, line 280) and in **`public.bot_user_registry`** (RLS: `is_admin` only — `20260516000007`). **The regular client app cannot read either of those.** GAME-004's `RoomArgumentInput.isBot` is therefore a **caller-supplied derived hint**, not a column the app reads directly. | `isBotSeededRoom` is **not** a query — it is a **pure predicate over already-derived per-argument `isBot` hints** (the same `isBot` flags GAME-004/GAME-005 already accept). A room is "bot-seeded" when its opening (root) argument's author is a bot. The provenance of the per-author `isBot` hint is a **caller concern with a documented, no-migration v1 source** (§1.3). No new schema, no new query in v1. |
| D3 | `docs/roadmap-expansions/2026-05-20-pvp-argument-game-roadmap.md` is named as the parent roadmap. | **That file does not exist.** `Glob "docs/roadmap-expansions/**"` returns only `2026-05-20-mcp-semantic-referee-roadmap.md`. GAME-004 §0 and GAME-005 §0 made the identical finding. | Not a blocker. This design depends only on the issue body, the merged GAME-004 / GAME-005 / BR-004 code + designs, `docs/ux-ui-project-board.md`, and the verified repo. |
| D4 | The card implies a per-room "bot-seeded" flag and a bot-marking "view contract". | GAME-005's `PublicRoomSeatMap` and GAME-004's `RoomContract` are **derived at read-time**, never persisted — both designs explicitly avoid a migration. | GAME-008 follows the same no-persistence pattern. The bot-marking contract is a **read-time view-model** derived from the same per-argument / per-participant `isBot` hints. v1 ships **no migration, no Edge Function, no Supabase write, no service-role**. §1, §4. |
| D5 | "Open decision: do bots yield public seats to real users? (Recommended: yes.)" | GAME-005's `buildPublicRoomSeatMap` assigns chime-in seats 3–6 by **first-qualifying-move chronological order** and already **excludes bots from claiming a chime-in seat**. So in GAME-005 a bot already cannot occupy a chime-in seat at all. | GAME-008 **adopts the recommended default and confirms it is already structurally true for chime-in seats** (GAME-005 excludes bots there). The only place a bot can hold a *primary* seat is seats 1–2. GAME-008 adds the policy rule for those two seats: a bot may seed seat 1 (Initiator) of a **public** room; a bot **never** holds the Primary Opponent seat *against a real user* in a way that misrepresents it as human (§3). "Bots yield seats to real users" is encoded as: bots only ever fully occupy a *fully-bot* public room; the moment a real user joins, the model marks every bot seat and never lets a bot displace a real claimant. This is **OD-1** for the operator to confirm wording, not mechanism. |
| D6 | Live bot posting / pilots / corpus harvests are non-scope; "policy + UI marking, not live-posting enablement". | `scripts/bot-fixtures/` runners are operator-gated (env + `--pilot`). The production app makes **no** AI / xAI / Anthropic call. | GAME-008 enables **zero** live bot posting. It ships a pure-TS policy model + a read-time marking view contract + gallery/in-room marker UI. It triggers no corpus run, no harvest, no scheduler, no Edge Function. §13, §14. |

None of these block the card. The pure-TS policy model, the `isBotSeededRoom` predicate, the
bot-marking view contract, and the gallery + in-room marker UI are all buildable today with **no
migration, no Edge Function, and no new query**. One operator decision is isolated and does not
gate the build: **OD-1** (the exact "bots yield seats" framing + the final bot-marker copy and
placement).

### Cannot proceed? — No.

The card is buildable. Every contract it asks for is a deterministic function of data the room /
gallery already loads at read-time:

- The **`BotRoomPolicy` constant** is a frozen object — pure declaration (§1.1).
- **`isBotSeededRoom`** is a pure predicate over the per-argument `isBot` hints GAME-004/GAME-005
  already accept (§1.3, §2.1).
- The **bot-marking view contract** (`BotMarkingViewModel`) is a pure projection over the same
  hints (§1.4, §2.3).
- The **seat-cap interaction** is already largely settled by GAME-005 (bots excluded from
  chime-in seats); GAME-008 adds only the two primary-seat rules and an enforcement predicate
  (§3, §2.4).

The one thing GAME-008 **cannot** do without a future migration is make the *production app*
read a first-class persisted "this author is a bot" flag without going through an admin Edge
Function. v1 does not need that: §1.3 documents two no-migration sources for the `isBot` hint
(an opt-in caller hint, and a deterministic display-name/title convention the corpus runners
already use and the gallery model already strips). The first-class persisted-flag path is a
**named, isolated future migration card** (§1.3, §11) — explicitly out of scope here, exactly as
the card requires ("No Supabase schema change without a follow-up migration card").

---

## Goal (one paragraph)

GAME-008 defines the **product-level policy for bots in public argument rooms** — the rules a
normal user can rely on, and the UI marking that makes those rules visible. Concretely: bots may
**seed and post public argument rooms only**; a bot **never** creates or joins a private 1v1 room
with a real user; a bot **never** holds the Primary Opponent seat against a real user in a way
that misrepresents the bot as human; and every bot — in the gallery and in-room — is **clearly,
individually, non-deceptively marked** with neutral "test bot" copy. Bot rooms are an explicit,
doctrine-safe test surface for the public-room layer GAME-005 (6-seat cap, chime-in governance)
and BR-004 (branch grammar) already shipped — so the public-room mechanics can be exercised
without pulling real users into untested flows. The deliverable is a **pure-TS deterministic
policy model** (`botRoomPolicyModel.ts`) — the frozen `BotRoomPolicy` constant, the
`isBotSeededRoom` predicate, an `assertBotRoomEligibility` enforcement predicate, and the
`BotMarkingViewModel` view contract — plus a **small read-time marker UI**: a non-alarming
"test room" affordance on gallery cards and an individual "test bot" marker on bot participants
in-room. The doctrine anchor, inherited from GAME-004 / GAME-005 / cdiscourse-doctrine: **a bot
marker describes the ACCOUNT TYPE, never a verdict; a bot never decides who is right; bot rooms
follow every standard doctrine rule; the marker copy is neutral ("test bot"), never alarming,
never deceptive, never a "this is a human" framing.** GAME-008 ships **no live bot posting, no
corpus run, no migration, no Edge Function, no Supabase write, no AI call, no service-role, no
new dependency, no route transition.**

---

## §1 — Data model

All types are pure TypeScript, exported from a new `src/features/debates/botRoomPolicyModel.ts`.
No React / Supabase / network / AI imports. JSON-serializable. The model **imports types from
GAME-004's `roomContractModel.ts`** (`RoomType`, `RoomArgumentInput`, `RoomParticipantInput`) and
**from GAME-005's `publicSeatModel.ts`** (`PublicRoomSeatMap`, `PublicSeat`) — it consumes those
contracts and does not redefine them.

### 1.1 `BotRoomPolicy` — the frozen app-wide policy constant (the card's named shape)

The card names `BotRoomPolicy { botsMayCreate: 'public_only', botMarkingRequired: true,
botMayBePrimaryOpponentOfRealUser: false }`. GAME-008 keeps that shape verbatim and ships it as
a **single frozen constant** — there is exactly one policy, app-wide, not a per-room record.

```ts
/**
 * GAME-008 — the product-level bot-room policy. A single immutable,
 * app-wide constant. Bots are a dev/test concept; this object states what
 * a bot may and may not do at the product level. It is NOT per-room and
 * NOT persisted — it is a frozen declaration the whole app reads.
 */
export interface BotRoomPolicy {
  /** Bots may CREATE / seed public rooms only — never a private 1v1. */
  readonly botsMayCreate: 'public_only';
  /** A bot participant must always be clearly + individually marked. */
  readonly botMarkingRequired: true;
  /**
   * A bot is NEVER the Primary Opponent of a REAL user. (A bot may face a
   * bot; a bot may seed a public room's Initiator seat. It must never sit
   * in seat 2 against a human in a way that misrepresents it as human.)
   */
  readonly botMayBePrimaryOpponentOfRealUser: false;
  /**
   * A bot NEVER joins a private 1v1 room that has a real-user party.
   * (Restates the private-room boundary as an explicit policy field so a
   * test can assert it directly.)
   */
  readonly botMayJoinPrivateRoomWithRealUser: false;
  /**
   * Bots yield active public seats to real users — a bot never displaces
   * or out-ranks a real claimant. (OD-1 confirms the user-facing framing;
   * the mechanism is already structural via GAME-005 — see §3.)
   */
  readonly botsYieldSeatsToRealUsers: true;
}

/** The single, frozen, app-wide bot-room policy. */
export const BOT_ROOM_POLICY: BotRoomPolicy = Object.freeze({
  botsMayCreate: 'public_only',
  botMarkingRequired: true,
  botMayBePrimaryOpponentOfRealUser: false,
  botMayJoinPrivateRoomWithRealUser: false,
  botsYieldSeatsToRealUsers: true,
});
```

`BotRoomPolicy` carries **no score, no band, no heat, no verdict, no person-attribution field**.
It is a behavioural-constraint declaration only.

### 1.2 `BotParticipantHint` / `BotRoomInputs` — what the model reads

GAME-008's predicates and view-model take **already-derived `isBot` hints** as input. They never
query the database themselves (D2). The shapes mirror GAME-004's narrowed input style.

```ts
/**
 * GAME-008 — a per-user "is this account a bot" hint. The model is given
 * a SET of these (one per relevant userId). The model does NOT derive the
 * hint — see §1.3 for the no-migration v1 sources.
 */
export interface BotParticipantHint {
  userId: string;
  /** True when this account is a dev/test bot. */
  isBot: boolean;
  /**
   * Optional neutral persona label for the in-room marker, e.g.
   * "Provocateur bot" / "Source-trail bot". Never a real person name,
   * never a verdict word. Routed through copy; falls back to the generic
   * "test bot" label when absent. From bot_user_registry.persona when an
   * admin surface supplies it; otherwise undefined.
   */
  personaLabel?: string | null;
}

/**
 * GAME-008 — the read-time inputs for the room-level predicates + the
 * marking view-model. All fields are data the room already loads.
 */
export interface BotRoomInputs {
  roomId: string;
  /** GAME-004 room type. v1 default 'public' (ROOM_TYPE_DEFAULT). */
  roomType: RoomType;
  /** The room's posted arguments — GAME-004's narrowed shape, reused. */
  arguments: ReadonlyArray<RoomArgumentInput>;
  /** Per-user bot hints for every author / participant in the room. A
   *  missing userId is treated as NOT a bot (fail-safe-human default). */
  botHintsByUserId: ReadonlyArray<BotParticipantHint>;
}
```

### 1.3 How a bot is identified — the no-migration resolution (the load-bearing finding)

This is the §0 D2 finding stated as a design decision. **Prefer no migration; exhaust existing
data first.**

- **There is no `is_bot` column on `public.profiles`.** The schema-of-record for "this account
  is a bot" is `auth.users.user_metadata.is_bot` + `public.bot_user_registry` — both **admin /
  service-role only**. The production app's anon client cannot read either.
- **GAME-004 already solved this seam.** `RoomArgumentInput.isBot` is an **optional,
  caller-supplied hint** — GAME-004 and GAME-005 both already accept it and act on it
  (`isQualifyingResponse` `bot_move` rejection; GAME-005 chime-in-seat exclusion). GAME-008 does
  **not** invent a new identification mechanism — it reuses the exact same hint, lifted to a
  per-user `BotParticipantHint`.
- **Two no-migration v1 sources for the hint** (the caller picks; the model is agnostic):
  1. **Deterministic display-name / title convention.** The corpus runners already tag
     bot-seeded titles with `[xai-adv …]` / `[ai-corpus …]` / `[stress …]` suffixes, and the
     gallery model **already has `cleanTitleForDedupe` + `SUFFIX_TAG_PATTERNS`** that recognise
     exactly those tags. GAME-008 ships one tiny pure helper, `looksLikeBotSeedTag(title)`,
     that **reuses the same pattern family** to recognise a bot-seeded title — a deterministic,
     no-migration, no-query signal that is *already* in the data. This is the recommended v1
     default source.
  2. **An explicit caller hint.** Any surface that already has admin context (the Admin tabs,
     a future loader that joins `bot_user_registry` server-side) can pass real
     `BotParticipantHint`s straight in. The model takes them verbatim.
- **The model never queries.** `botRoomPolicyModel.ts` is pure TS — it imports nothing from
  Supabase. It is *given* the hints; it does not fetch them.
- **Future migration card (named, isolated, NOT this card).** A first-class persisted bot flag
  the production anon client can read directly — e.g. `public.profiles.is_bot boolean NOT NULL
  DEFAULT false` with a backfill from `bot_user_registry` and a public-read RLS allowance —
  would let a loader populate `BotParticipantHint` without the display-name convention and
  without admin context. **The GAME-008 model does not change when it lands** — it already
  takes `BotParticipantHint[]` as input. This is flagged here, named, and explicitly deferred.

**Fail-safe default:** when the hint for a userId is *absent*, the model treats that user as a
**real human, not a bot**. The consequences of a wrong guess are asymmetric: wrongly marking a
human as a bot is a serious misrepresentation; wrongly *omitting* a bot marker degrades a test
surface but harms no real user. So absent → human. (A bot is marked only on a *positive* hint.)

### 1.4 `BotMarkingViewModel` — the bot-marking view contract

```ts
/** GAME-008 — the read-time bot marking for ONE participant. Pure data,
 *  no JSX. Consumed by the in-room participant marker. */
export interface BotParticipantMarking {
  userId: string;
  /** True when this participant must show a bot marker. */
  isBot: boolean;
  /**
   * Plain-language marker label — neutral, never alarming, never a
   * verdict. e.g. "Test bot" or a persona-specific "Provocateur (test
   * bot)". Routed through BOT_MARKER_COPY. Empty string when !isBot.
   */
  markerLabel: string;
  /** Verbose screen-reader label for the marker (see Accessibility). */
  accessibilityLabel: string;
}

/** GAME-008 — the read-time bot marking for a ROOM (gallery card +
 *  in-room header). Pure data, no JSX. */
export interface BotMarkingViewModel {
  roomId: string;
  /** True when the room's opening (root) argument author is a bot. */
  isBotSeededRoom: boolean;
  /** True when ANY participant in the room is a bot (mixed or pure). */
  hasBotParticipant: boolean;
  /**
   * Room-level marker for the gallery card + in-room header. Non-alarming
   * "test room" copy. Empty string when the room has no bot at all.
   */
  roomMarkerLabel: string;
  /** Verbose screen-reader label for the room-level marker. */
  roomAccessibilityLabel: string;
  /** Per-participant markings, one entry per known participant. Entries
   *  with isBot === false carry an empty markerLabel — the UI renders a
   *  marker only for isBot === true. */
  participantMarkings: ReadonlyArray<BotParticipantMarking>;
}
```

### 1.5 Copy — `BOT_MARKER_COPY` (plain language, neutral, non-deceptive)

```ts
// added to src/features/arguments/gameCopy.ts, beside BRANCH_GRAMMAR_COPY
// and CHIME_IN_GOVERNANCE_COPY:
/**
 * GAME-008 — plain-language copy for the bot marker. Neutral, never
 * alarming, never a verdict, never a "this is a human" framing.
 * "Test bot" / "Test room" are deliberately calm and honest. OD-1
 * confirms final wording + placement.
 */
export const BOT_MARKER_COPY = Object.freeze({
  // In-room, per-participant.
  participant_marker: 'Test bot',
  participant_marker_persona: '{persona} · test bot', // when a persona label exists
  participant_a11y:
    'This participant is a test bot, not a person. Test bots help '
    + 'exercise public rooms; they never decide who is right.',

  // Gallery card + in-room room-level marker.
  room_marker: 'Test room',
  room_marker_seeded: 'Bot-seeded test room',
  room_a11y_seeded:
    'This is a public test room seeded by a test bot. You can read and '
    + 'follow along; a test bot started it.',
  room_a11y_has_bot:
    'This public room includes one or more test bots. Each test bot is '
    + 'marked individually.',

  // Short helper line shown under a bot-seeded gallery card.
  gallery_helper:
    'A test bot started this public room. Test bots help exercise '
    + 'public-room features.',
} as const);
```

All strings: plain English, no `snake_case`, **zero verdict / amplification / person-attribution
tokens**, **no alarming words** (`warning`, `danger`, `fake`, `spam`, `malicious`, `troll`),
**no deceptive framing** (never "real user", never "human", never anything implying the bot is a
person). `looksLikeInternalCode` returns `false` for every visible string. The ban-list test
(§10) enforces all of this.

---

## §2 — API / interface contracts (`botRoomPolicyModel.ts`)

### 2.1 `isBotSeededRoom(inputs) → boolean` — the card's named predicate

```ts
/**
 * GAME-008 — true when the room's opening (root) argument was authored by
 * a test bot. Deterministic, pure. "Bot-seeded" is defined by the ROOT
 * author specifically — a public room a bot started — not merely by a bot
 * being present (use BotMarkingViewModel.hasBotParticipant for that).
 *
 * Steps:
 *  1. Find the root argument: parentId === null && status === 'posted',
 *     earliest by createdAt (defensive, mirrors GAME-004 buildRoomContract).
 *  2. If no root → false (an unopened room is not "bot-seeded").
 *  3. Look up the root author's BotParticipantHint. Absent hint → false
 *     (fail-safe-human, §1.3).
 *  4. Return that hint's isBot.
 */
export function isBotSeededRoom(inputs: BotRoomInputs): boolean;
```

### 2.2 `looksLikeBotSeedTag(title) → boolean` — no-migration hint helper

```ts
/**
 * GAME-008 — deterministic recognition of a corpus-runner bot-seed title
 * tag, e.g. "...[xai-adv 9018694f]" / "...[ai-corpus ...]" / "...[stress
 * ...]". REUSES the SUFFIX_TAG_PATTERNS family the gallery model already
 * ships (cleanTitleForDedupe). Pure string predicate — no I/O. This is
 * one of the two no-migration sources a caller may use to build a
 * BotParticipantHint (§1.3). The model itself does not call this — it is
 * exported so a loader can build hints without a query.
 */
export function looksLikeBotSeedTag(title: string): boolean;
```

### 2.3 `buildBotMarkingViewModel(inputs) → BotMarkingViewModel`

```ts
/**
 * GAME-008 — build the read-time bot-marking projection for a room.
 * Pure, deterministic — same input twice yields a deeply-equal frozen
 * result. Steps:
 *  1. isBotSeededRoom = isBotSeededRoom(inputs).
 *  2. Collect distinct author + participant userIds; for each, resolve
 *     the BotParticipantHint (absent → isBot:false).
 *  3. hasBotParticipant = any hint isBot === true.
 *  4. roomMarkerLabel: room_marker_seeded when isBotSeededRoom; else
 *     room_marker when hasBotParticipant; else '' (no marker).
 *  5. participantMarkings: one BotParticipantMarking per known userId;
 *     markerLabel from BOT_MARKER_COPY (persona variant when personaLabel
 *     present); '' for non-bots.
 *  6. All a11y labels from BOT_MARKER_COPY.
 */
export function buildBotMarkingViewModel(
  inputs: BotRoomInputs,
): BotMarkingViewModel;
```

### 2.4 `assertBotRoomEligibility(check) → BotRoomEligibilityResult` — the policy enforcement predicate

The policy must be a *function the UI gates on*, not just advice — doctrine is enforced
structurally, never by the UI alone (GAME-004 / GAME-005 discipline).

```ts
/** A proposed bot action the policy must vet, before it could ever happen. */
export type BotRoomAction =
  | 'create_room'        // a bot opening a new room
  | 'join_as_primary'    // a bot taking the Primary Opponent seat (seat 2)
  | 'join_as_chime_in'   // a bot taking a chime-in seat (3..6)
  | 'join_as_observer';  // a bot observing

export type BotPolicyDenyReason =
  | 'bots_create_public_only'        // bot tried to create a non-public room
  | 'bot_primary_against_real_user'  // bot tried seat 2 vs a real-user room
  | 'bot_in_private_room_with_real_user' // bot tried any seat in a private 1v1 with a real party
  | 'bot_chime_in_not_permitted';    // bots do not claim chime-in seats (GAME-005 inherited)

export interface BotRoomEligibilityResult {
  allowed: boolean;
  /** null when allowed; the first failing reason otherwise. */
  reason: BotPolicyDenyReason | null;
}

export interface AssertBotRoomEligibilityInput {
  /** The action a bot account is proposing. */
  action: BotRoomAction;
  /** The room's GAME-004 type. */
  roomType: RoomType;
  /**
   * Whether the room currently has at least one REAL-user party (a
   * non-bot Initiator or non-bot Primary Opponent). Caller derives this
   * from the GAME-004 RoomContract + the bot hints.
   */
  roomHasRealUserParty: boolean;
}

/**
 * GAME-008 — pure policy predicate. Given a proposed bot action, returns
 * whether the BOT_ROOM_POLICY permits it. Deterministic, no I/O.
 *
 * Rules (checked in order):
 *  - 'create_room' allowed ONLY when roomType === 'public'
 *    (bots_create_public_only otherwise).
 *  - ANY action in a 'private' room that has a real-user party is denied
 *    (bot_in_private_room_with_real_user) — bots never join a private 1v1
 *    with a real user.
 *  - 'join_as_primary' (seat 2) denied when roomHasRealUserParty is true
 *    (bot_primary_against_real_user) — a bot is never the Primary Opponent
 *    of a real user. (A bot-vs-bot public room is allowed.)
 *  - 'join_as_chime_in' is always denied (bot_chime_in_not_permitted) —
 *    GAME-005 already excludes bots from chime-in seats; GAME-008 states
 *    it as policy so a test can assert it.
 *  - 'join_as_observer' is always allowed (a bot observing harms nobody).
 *
 * NOTE: this predicate is a POLICY GATE. v1 has no live-bot-posting code
 * path that calls it at write time (live posting stays operator-gated in
 * scripts/bot-fixtures/). It exists so the policy is encoded + testable
 * NOW, and so any future write path (a follow-up card) has one
 * authoritative gate to call. GAME-008 ships the gate; it does NOT ship a
 * caller that triggers bot posting.
 */
export function assertBotRoomEligibility(
  input: AssertBotRoomEligibilityInput,
): BotRoomEligibilityResult;
```

### 2.5 Component props

```ts
/** In-room per-participant marker. */
interface BotParticipantMarkerProps {
  /** One BotParticipantMarking from the view-model. Renders nothing when
   *  marking.isBot === false. */
  marking: BotParticipantMarking;
}

/** Gallery-card + in-room room-level marker. */
interface BotRoomMarkerProps {
  viewModel: BotMarkingViewModel;
  /** 'gallery' tweaks density for the card; 'room' for the room header. */
  context: 'gallery' | 'room';
}
```

Both components are **pure render** over a view-model. **Neither has a `Pressable`** — the
markers are informational in v1 (the card says "marker", not "tappable filter"). Therefore the
44×44 tap-target rule does not apply; if a future card makes the marker a tappable filter it
must add `hitSlop` then. Every visible string is inside `<Text>`; each marker root carries an
`accessibilityLabel` (§7).

---

## §3 — Seat-cap interaction: how bots and public seats coexist

The card's Open decision: "A bot public room reaches the 6-seat cap with bots → real users
overflow to observer; document whether bots yield seats to real users (Recommended: yes)."

GAME-008's resolution, grounded in what GAME-005 **already** ships:

- **Chime-in seats 3–6: bots already cannot hold them.** GAME-005's `buildPublicRoomSeatMap`
  excludes bot authors from claiming a chime-in seat (it reuses GAME-004's `isBot` exclusion).
  So a bot can **never** crowd a real user out of a chime-in seat — that risk is already
  structurally eliminated. `assertBotRoomEligibility` returns `bot_chime_in_not_permitted` for
  `join_as_chime_in`, restating the GAME-005 reality as explicit GAME-008 policy.
- **Primary seats 1–2 are the only seats a bot can hold.** Seat 1 (Initiator): a bot **may**
  seed a *public* room as the Initiator (this is the whole point of "bots seed public rooms").
  Seat 2 (Primary Opponent): a bot may hold seat 2 **only in a bot-vs-bot public room**.
  `assertBotRoomEligibility('join_as_primary', …)` denies seat 2 with
  `bot_primary_against_real_user` whenever the room already has a real-user party.
- **"Bots yield seats to real users" — the adopted default, recommended in the card.** The
  mechanism: a bot occupies a *primary* seat only in a fully-bot public room. The moment a real
  user becomes a party, the policy never lets a bot *displace* or *out-rank* that real user.
  Because GAME-005 chime-in seats already exclude bots, and `assertBotRoomEligibility` denies a
  bot the primary-opponent seat against a real user, the net effect is exactly "bots yield":
  **real users always have a path to every seat a bot might have wanted; a bot never blocks
  one.** GAME-008 does **not** add a seat-eviction mutation (there is no write path; live bot
  posting is operator-gated). It encodes the *policy* and the *enforcement predicate*; the
  mechanism is already structural.
- **Overflow framing.** When a public room is genuinely full, GAME-005 already routes the
  surplus to observer with non-punitive copy (`overflow_observer_body`). GAME-008 adds nothing
  to that path — it reuses GAME-005's overflow handling unchanged.
- **`BOT_ROOM_POLICY.botsYieldSeatsToRealUsers = true`** records the decision as a policy field
  so a single test asserts it. **OD-1** is only the *wording* of any user-facing line about it
  — the mechanism is settled.

---

## §4 — Migration / Edge Function decision

**No migration. No Edge Function. No Supabase write. No service-role. No new query.**

- `BOT_ROOM_POLICY` is a frozen constant — pure declaration.
- `isBotSeededRoom`, `buildBotMarkingViewModel`, `assertBotRoomEligibility`,
  `looksLikeBotSeedTag` are pure functions over already-loaded data + caller-supplied `isBot`
  hints (§1.2, §1.3).
- The bot hints in v1 come from a **no-migration source** — the deterministic
  display-name/title convention the corpus runners already use and the gallery model already
  recognises, or an explicit caller hint from a surface that already has admin context (§1.3).
- The model imports nothing from Supabase; it never fetches.

**Operator deploy step for GAME-008 itself: none.** Pure code change — a pure-TS model, a copy
block, two read-only RN marker components, and small additive (optional-prop) wiring into the
gallery card and the in-room participant row.

**Future migration card (named, NOT this card):** a first-class `public.profiles.is_bot` column
+ backfill + public-read RLS, so a loader can populate `BotParticipantHint` without the
display-name convention. Named in §1.3 and §11. The GAME-008 model is forward-compatible — it
already takes `BotParticipantHint[]`.

---

## §5 — File changes

### New files (GAME-008 footprint)

| Path | Purpose | Approx LOC |
|---|---|---:|
| `src/features/debates/botRoomPolicyModel.ts` | Pure-TS model. Exports `BotRoomPolicy`, `BOT_ROOM_POLICY`, `BotParticipantHint`, `BotRoomInputs`, `BotParticipantMarking`, `BotMarkingViewModel`, `BotRoomAction`, `BotPolicyDenyReason`, `BotRoomEligibilityResult`, `AssertBotRoomEligibilityInput`, `isBotSeededRoom`, `looksLikeBotSeedTag`, `buildBotMarkingViewModel`, `assertBotRoomEligibility`, and `_forbiddenBotMarkerTokens()` (ban-list support). Imports GAME-004 `roomContractModel` types + GAME-005 `publicSeatModel` types **as types only**. No React, no Supabase, no network, no AI. | ~240–300 |
| `src/features/debates/BotParticipantMarker.tsx` | Read-time RN component — the individual "test bot" marker on a bot participant in-room. Pure presentation over one `BotParticipantMarking`. Renders nothing for a non-bot. No `Pressable`. | ~70–90 |
| `src/features/debates/BotRoomMarker.tsx` | Read-time RN component — the non-alarming room-level "test room" affordance for the gallery card + in-room header. Pure presentation over `BotMarkingViewModel`. No `Pressable`. | ~80–110 |
| `__tests__/botRoomPolicyModel.test.ts` | Pure-model tests (see §10). | ~300 |
| `__tests__/botRoomPolicyDoctrine.test.ts` | Ban-list across marker copy + view-model strings + forbidden-import + no-service-role scan. | ~110 |
| `__tests__/botParticipantMarker.test.tsx` | `BotParticipantMarker` render + a11y tests. | ~90 |
| `__tests__/botRoomMarker.test.tsx` | `BotRoomMarker` render + a11y tests (gallery + room context). | ~100 |

### Modified files

| Path | What changes | What stays |
|---|---|---|
| `src/features/arguments/gameCopy.ts` | ADD the frozen `BOT_MARKER_COPY` block beside `BRANCH_GRAMMAR_COPY` / `CHIME_IN_GOVERNANCE_COPY`. ~+30 lines. | Everything existing. `toPlainLanguage` / `looksLikeInternalCode` / the other copy blocks unchanged. |
| The Conversation Gallery card component (verify exact file — `ConversationGalleryScreen.tsx` renders cards from `conversationGalleryModel.ts`; the card sub-component is where a `[xai-adv …]` title currently renders cleaned via `cleanTitleForDedupe`) | **Minimal additive wiring.** ~+15–30 lines. When the loader supplies bot hints (or `looksLikeBotSeedTag` recognises the title), mount `<BotRoomMarker context="gallery" />` on the card. No existing card field removed; the marker is an additive row/badge. | All existing card layout, the dedupe, the bucket/heat/temperament chips, the timeline preview. |
| The in-room participant row (verify exact file — the argument-bubble / author label rendering in `src/features/arguments/`) | **Minimal additive wiring.** ~+15–30 lines. Beside a bot author's name, mount `<BotParticipantMarker />` from the room's `BotMarkingViewModel`. Mount `<BotRoomMarker context="room" />` in the room header when `isBotSeededRoom` / `hasBotParticipant`. | All existing bubble / author rendering, the GAME-004 seat strip, the GAME-005 metrics strip. No existing prop made required; every new prop optional, no-render-by-default. |
| `src/features/debates/index.ts` (barrel, if present — verify) | Re-export the new model types + components. ~+4 lines. If no barrel exists, skip. | Everything existing. |

*Implementer note (data plumbing):* the gallery and the room need `BotParticipantHint[]`. The
**lowest-risk v1 path** is the deterministic title convention — the gallery card already has the
title and `looksLikeBotSeedTag` is pure; a bot-seeded *gallery* marker needs **no new query at
all**. The richer per-participant in-room marking benefits from real hints; if threading them is
judged heavy for v1, an acceptable **degraded fallback** is: render the room-level "Test room"
marker from `looksLikeBotSeedTag(title)` (no query) and defer the per-participant marker to the
loader-hint wiring. Prefer the full per-participant marking. Either way, **no migration**.

### Files this card does NOT touch (and why)

- `src/features/debates/roomContractModel.ts` — GAME-004's contract is **read** (types), never
  modified.
- `src/features/debates/publicSeatModel.ts` — GAME-005's seat model is **read** (types), never
  modified. GAME-008 does not change seat assignment or governance.
- `src/features/arguments/branchGrammarModel.ts` — BR-004's grammar is untouched.
- `src/lib/constitution/engine.ts` — the rules engine is sacred. GAME-008 adds no rule, no flag,
  no block.
- `supabase/migrations/*` + `supabase/functions/*` — **no migration, no Edge Function** (§4).
  `submit-argument`, `admin-users`, `bot_user_registry` untouched.
- `scripts/bot-fixtures/*` — the bot-fixture runner internals are **explicitly non-scope**.
  GAME-008 reuses the *title-tag convention* those runners emit; it does not modify the runners.
- `src/features/pointStanding/*`, `argumentScoreModel.ts`, any heat module — never imported;
  the bot policy is orthogonal to standing and heat.

### Future-card footprint (NOT this card)

- **First-class persisted bot flag** (`public.profiles.is_bot` + backfill + public-read RLS) →
  a follow-up **migration card** (§1.3, §4, §11).
- **Live bot posting / pilots / corpus harvests** → operator-gated `scripts/bot-fixtures/`,
  never a product card.
- **A tappable "test rooms only" gallery filter** → a possible future UX card; v1 ships an
  informational marker only.

---

## §6 — Edge cases

The implementer must handle each; each maps to a named test in §10.

1. **Empty room (no arguments).** `isBotSeededRoom` → `false` (no root). `buildBotMarkingViewModel`
   → `isBotSeededRoom:false`, `hasBotParticipant` reflects participant hints, `roomMarkerLabel`
   '' unless a bot participant exists. No crash.
2. **Root-only room, bot author.** `isBotSeededRoom` → `true`. Room marker = "Bot-seeded test
   room".
3. **Root-only room, real-user author.** `isBotSeededRoom` → `false`. No room marker (unless a
   bot later joins as a participant).
4. **Missing hint for the root author.** Fail-safe-human (§1.3) — `isBotSeededRoom` → `false`.
   A room is marked bot-seeded only on a *positive* bot hint, never on absence.
5. **Mixed bot/human public room.** `hasBotParticipant` → `true`; `isBotSeededRoom` reflects the
   *root* author only. **Every bot participant is marked individually** — `participantMarkings`
   has one `isBot:true` entry per bot. The card's explicit requirement.
6. **A bot is the Primary Opponent against a real user.** `assertBotRoomEligibility('join_as_primary',
   { roomHasRealUserParty: true })` → `{ allowed:false, reason:'bot_primary_against_real_user' }`.
   Policy denies it. (`BOT_ROOM_POLICY.botMayBePrimaryOpponentOfRealUser` is `false`.)
7. **A bot tries to create a private room.** `assertBotRoomEligibility('create_room', { roomType:
   'private' })` → `{ allowed:false, reason:'bots_create_public_only' }`.
8. **A bot tries any seat in a private 1v1 with a real party.** Any action +
   `roomType:'private'` + `roomHasRealUserParty:true` → `bot_in_private_room_with_real_user`.
9. **A bot tries a chime-in seat.** `assertBotRoomEligibility('join_as_chime_in', …)` →
   `bot_chime_in_not_permitted` — restates the GAME-005 exclusion.
10. **A bot observes a public room.** `assertBotRoomEligibility('join_as_observer', …)` →
    `{ allowed:true }`. A bot observing harms nobody.
11. **A bot-vs-bot public room.** `join_as_primary` with `roomHasRealUserParty:false` →
    `{ allowed:true }`. A bot may face a bot.
12. **Bot-seeded room reaches the 6-seat cap.** GAME-005 routes the surplus to observer with
    non-punitive copy; GAME-008 adds nothing — the overflow path is unchanged (§3).
13. **A real user joins a previously all-bot room.** `roomHasRealUserParty` flips to `true`;
    `assertBotRoomEligibility` thereafter denies a bot the primary-opponent seat. Bots yield (§3).
14. **`personaLabel` present.** The in-room marker uses the persona variant
    (`participant_marker_persona`, e.g. "Provocateur · test bot"). Still neutral, still honest.
15. **`personaLabel` is itself a banned/verdict token** (defensive — a misconfigured registry).
    The marker builder must **not** echo a `personaLabel` that contains a verdict / alarming /
    person-attribution token — it falls back to the generic `participant_marker` ("Test bot").
    Tested.
16. **Title carries a bot-seed tag but the loader supplies a real-user hint.** Explicit hints
    win over `looksLikeBotSeedTag` — the model uses the `BotParticipantHint` it is *given*;
    `looksLikeBotSeedTag` is only a *hint-construction helper a loader may choose*, never an
    override inside the model. Documented so the implementer does not double-source.
17. **Determinism / no mutation.** `buildBotMarkingViewModel` twice on the same input → deeply
    equal frozen output; frozen input arrays are not mutated.
18. **Offline / network failure.** GAME-008 is pure UI over already-loaded data; offline simply
    means no fresh hints. The markers describe the last-known state. No crash, no special path.
19. **Doctrine edge — does a bot marker say the bot is "wrong" / "fake" / a "troll"?** No. The
    marker is "Test bot" — an account-type label, never a verdict, never alarming. The ban-list
    test (§10) forbids `wrong`, `fake`, `troll`, `spam`, `malicious`, etc.
20. **Doctrine edge — does the marker ever frame the bot as a human?** No. `BOT_MARKER_COPY`
    contains no "real user" / "human" / "person" framing of the *bot itself*; the a11y copy
    explicitly says "not a person". A test asserts no deceptive token appears.
21. **Doctrine edge — does a bot in a room change anyone's standing or heat?** No.
    `botRoomPolicyModel.ts` imports nothing from any score / standing / heat module — enforced
    by the forbidden-import test. A bot's presence is an account-type fact, orthogonal to
    standing.
22. **Doctrine edge — can the bot policy block a real user's post?** No. GAME-008 has no post
    path, no validation gate. `assertBotRoomEligibility` vets *bot* actions only; it has no
    branch that touches a real user's submission.

---

## §7 — Accessibility

- `BotParticipantMarker` and `BotRoomMarker` are **informational, not interactive** — no
  `Pressable`, so the 44×44 tap-target rule does not apply (documented; a future tappable-filter
  card must add `hitSlop`).
- **Color is never the only signal.** The bot marker carries a **shape + text** glyph — a small
  bordered chip with the literal word "Test bot" / "Test room" inside, recognisable in a
  grayscale snapshot. The marker does not rely on a color alone to mean "bot". The doctrine
  ban-list test plus a grayscale-legibility assertion enforce this.
- **Every string inside `<Text>`.** No raw string in a `<View>`.
- **`accessibilityLabel` on every marker root.** The per-participant marker exposes
  `participant_a11y` ("This participant is a test bot, not a person. …"). The room marker
  exposes `room_a11y_seeded` / `room_a11y_has_bot`. The labels are deliberately verbose —
  screen-reader users get one shot per element.
- **`accessibilityRole`.** The markers are non-interactive informational text; they carry a
  descriptive `accessibilityLabel` with no `button` role (per RN, an informational element with
  a label and no role is correct — matches the GAME-004 `RoomContractSeatStrip` precedent).
- **No chatty announcements.** The marker is static per render; no `announceForAccessibility` on
  every recompute. A screen reader picks the label up on focus.
- **Reduce motion.** The markers are static — no animation — so the reduce-motion path is a
  no-op. Nothing to disable.

---

## §8 — Consuming GAME-005's seat model and GAME-004's room types

GAME-008 is a **consumer** of both merged cards — it re-derives nothing they own.

**From GAME-004 (`roomContractModel.ts`):**
- `RoomType` — `assertBotRoomEligibility` and `BotRoomInputs` key on it (`'public'` vs
  `'private'`). GAME-008 does not redefine room types.
- `RoomArgumentInput` (incl. its existing optional `isBot` field) — reused verbatim as the
  argument input shape for `isBotSeededRoom`.
- `RoomParticipantInput` — reused for participant enumeration.
- GAME-008 does **not** modify the contract, the Primary Opponent resolution, or
  `isQualifyingResponse`.

**From GAME-005 (`publicSeatModel.ts`):**
- `PublicRoomSeatMap` / `PublicSeat` — GAME-008's `assertBotRoomEligibility` is consistent with
  GAME-005's already-shipped bot exclusion from chime-in seats (§3). GAME-008 imports the seat
  types so a caller can pass a seat map alongside the bot hints when it wants the richer
  per-seat marking, but the *core* predicates (`isBotSeededRoom`, `assertBotRoomEligibility`) do
  not require a seat map.
- GAME-008 does **not** modify `buildPublicRoomSeatMap`, the chime-in role, governance, or the
  6-seat cap. The card explicitly lists GAME-005 governance as non-scope.

**Coordination note:** GAME-005 already excludes bots from chime-in seats; GAME-008 is the
*product-policy statement* of that fact plus the two primary-seat rules. The two cards do not
conflict — GAME-008 names and tests at the policy layer what GAME-005 implemented at the
seat-derivation layer.

---

## §9 — Downstream / sibling cards — not redesigned here

- **GAME-006 (Jump Branch)** — navigation; GAME-008 does not touch it.
- **BR-004 (branch grammar)** — consumed by GAME-005, not by GAME-008; untouched.
- **GAME-007 (resolution / enough-tags)** — out of scope.
- **The future first-class-bot-flag migration card** (§1.3, §4) — named, isolated, not this card.
- **Live bot pilots / corpus harvests** — operator-gated `scripts/bot-fixtures/`; GAME-008
  enables none of it.

GAME-008 does not import, redesign, or pre-empt any of these. Documented so the implementer does
not scope-creep.

---

## §10 — Test plan (Build-phase responsibility)

Per `test-discipline`: tests ship **with** the Build-phase code. Every public function of
`botRoomPolicyModel.ts` needs happy-path + failure-case coverage; 100% line + branch coverage is
achievable (pure TS, no I/O).

### `__tests__/botRoomPolicyModel.test.ts`
- **`BOT_ROOM_POLICY`** — shape: `botsMayCreate === 'public_only'`, `botMarkingRequired === true`,
  `botMayBePrimaryOpponentOfRealUser === false`, `botMayJoinPrivateRoomWithRealUser === false`,
  `botsYieldSeatsToRealUsers === true`; the object is frozen (`Object.isFrozen`).
- **`isBotSeededRoom`** — table: bot-authored root → `true`; real-user root → `false`; no root
  (empty room) → `false`; root author hint absent → `false` (fail-safe-human); multiple roots →
  earliest root's author decides.
- **`looksLikeBotSeedTag`** — recognises `[xai-adv …]`, `[ai-corpus …]`, `[stress …]` suffixes;
  returns `false` for an ordinary human title; parity with the gallery model's
  `SUFFIX_TAG_PATTERNS` family (a shared fixture asserts both agree).
- **`buildBotMarkingViewModel`** — pure-bot room, mixed room, pure-human room; `hasBotParticipant`
  correct; `participantMarkings` has one `isBot:true` entry per bot and one `isBot:false`
  (empty markerLabel) per human; persona-variant label when `personaLabel` present; generic
  fallback when `personaLabel` is a banned token (§6.15); `roomMarkerLabel` selection
  (seeded vs has-bot vs none).
- **`assertBotRoomEligibility`** — full matrix: `create_room` public → allowed; `create_room`
  private → `bots_create_public_only`; `join_as_primary` with real-user party →
  `bot_primary_against_real_user`; `join_as_primary` bot-vs-bot → allowed; any action in a
  private room with a real party → `bot_in_private_room_with_real_user`; `join_as_chime_in` →
  `bot_chime_in_not_permitted`; `join_as_observer` → allowed.
- **Determinism** — `buildBotMarkingViewModel` twice on the same input → `toEqual`.
- **No-mutation** — `Object.freeze` the input arrays; assert no throw, output not aliased.
- **API surface** — the module exports no `enableBotPosting` / `scheduleBotRun` /
  `postBotMove` / `harvestCorpus` function (live-posting non-enablement encoded by omission) —
  assert `typeof (mod as any).enableBotPosting === 'undefined'` etc.

### `__tests__/botRoomPolicyDoctrine.test.ts`
- **Ban-list** — collect every string in `BOT_MARKER_COPY` + every label / a11y string produced
  by `buildBotMarkingViewModel` across pure-bot / mixed / human / persona permutations; assert
  none contains (case-insensitive) `winner`, `loser`, `correct`, `incorrect`, `true`, `false`,
  `right`, `wrong`, `won`, `lost`, `liar`, `dishonest`, `bad faith`, `manipulative`,
  `extremist`, `propagandist`, `stupid`, `idiot`, `fake`, `troll`, `spam`, `malicious`,
  `danger`, `warning`, `booted`, `kicked`, `banned`.
- **No deceptive framing** — assert no marker / a11y string presents the bot as a person:
  scan for `real user`, `real person`, `human` used to describe the bot itself; the only
  permitted use of "person" is the explicit negation "not a person" — the test allowlists
  exactly that phrase and forbids any other.
- **Plain language** — `looksLikeInternalCode` is `false` for every visible string; no
  `snake_case` / enum-value leak (`join_as_primary`, `bot_chime_in_not_permitted`, etc. must
  never reach a user string).
- **Forbidden imports** — source-scan `botRoomPolicyModel.ts`: assert it imports nothing from
  `react`, `../../lib/supabase`, any score / standing / heat / anti-amplification module, or
  any network module. The policy is not influenced by score or heat — proven by the absence.
- **No service-role / no Edge Function / no live posting** — source-scan
  `botRoomPolicyModel.ts` + the two components for `SERVICE_ROLE` / `service_role` /
  `functions.invoke` / `ANTHROPIC` / `XAI` / `x.ai` / `api.anthropic` → zero matches.

### `__tests__/botParticipantMarker.test.tsx`
- Renders the "Test bot" marker for an `isBot:true` marking.
- Renders **nothing** for an `isBot:false` marking.
- Renders the persona variant when `personaLabel` is present.
- Marker root exposes `accessibilityLabel`; every visible string inside `<Text>`.
- Grayscale-legibility: the marker is identifiable by shape + text without color.

### `__tests__/botRoomMarker.test.tsx`
- Renders "Bot-seeded test room" for an `isBotSeededRoom:true` view-model (gallery + room
  context).
- Renders "Test room" for `hasBotParticipant:true && isBotSeededRoom:false`.
- Renders **nothing** for a view-model with no bot at all.
- Marker root exposes `accessibilityLabel`; every visible string inside `<Text>`.
- `context: 'gallery'` vs `'room'` density variation does not change the copy.

(Test-count expectation: roughly +60–80 tests across the four files. The implementer updates
`docs/current-status.md` with the confirmed number after `npm run test` passes — per
test-discipline, only after it actually passes.)

---

## §11 — Dependencies (cards / docs / files)

- **Assumes GAME-004 (#141) is complete** — MERGED. GAME-008 imports `RoomType`,
  `RoomArgumentInput`, `RoomParticipantInput` from `src/features/debates/roomContractModel.ts`.
  The optional `RoomArgumentInput.isBot` field is the seam GAME-008's `isBot` hint extends.
- **Assumes GAME-005 (#142) is complete** — MERGED. GAME-008 imports `PublicRoomSeatMap` /
  `PublicSeat` types from `src/features/debates/publicSeatModel.ts` and is consistent with
  GAME-005's already-shipped bot exclusion from chime-in seats. GAME-008 does not modify the
  seat model.
- **References BR-004 (#143)** — MERGED; consumed by GAME-005, not directly by GAME-008.
- **Reuses the gallery model's title-tag convention** — `cleanTitleForDedupe` /
  `SUFFIX_TAG_PATTERNS` in `src/features/debates/conversationGalleryModel.ts`.
  `looksLikeBotSeedTag` mirrors that pattern family; a shared test fixture keeps them in
  lockstep.
- **Reads existing schema (for documentation only — no query):** `public.bot_user_registry`
  (`20260516000007_stage6_admin_operations.sql`), `auth.users.user_metadata.is_bot` (set by the
  `admin-users` `create_bot_user` action). GAME-008 documents these as the *schema-of-record*
  for bot identity but **does not query them** — the production app cannot (admin/service-role
  only). v1 uses the no-migration hint sources of §1.3.
- **Will be refined by a future migration card** — a first-class `public.profiles.is_bot`
  column (§1.3, §4) would replace the display-name convention as the hint source; the GAME-008
  model is unchanged when it lands.

---

## §12 — Risks

- **No first-class persisted bot flag the production app can read (the headline reality risk).**
  v1's bot hint comes from a deterministic display-name/title convention or a caller hint
  (§1.3). Consequence: a bot whose room title does **not** carry a corpus tag, and for which no
  loader supplies a hint, would be **un-marked** (fail-safe-human). The failure direction is the
  safe one — a missing marker degrades a test surface; it never misrepresents a human as a bot.
  The follow-up migration card removes the risk. The implementer must **not** silently add a
  migration to "fix" this — the card forbids schema changes without a follow-up card.
- **Persona label leakage.** `bot_user_registry.persona` is admin-authored free text. If a
  persona string ever contained a verdict / alarming token it must not reach the marker. §6.15
  + the ban-list test cover this — the builder falls back to the generic "Test bot".
- **Marker copy reading as alarming or deceptive.** Mitigation: `BOT_MARKER_COPY` is calm and
  honest ("Test bot" / "Test room"); the ban-list test forbids `fake`/`troll`/`spam`/`danger`/
  `warning` and forbids any "this is a human" framing. **OD-1** routes final copy + placement
  through a copy review.
- **Gallery / room-shell wiring.** GAME-008 mounts two markers into the gallery card and the
  in-room participant row. The additions are optional-prop, no-render-by-default. If threading
  per-participant hints into the room is fiddly, the documented degraded fallback (room-level
  marker from `looksLikeBotSeedTag`, no query) keeps the card unblocked (§5).
- **Scope creep toward live posting.** The card is policy + marking only. `assertBotRoomEligibility`
  is a *gate*, not a *trigger* — GAME-008 ships no caller that posts a bot move. The §10
  API-surface test asserts the module exports no posting / scheduling / harvest function.
- **No existing test should need updating.** GAME-008 adds new files + an additive copy block +
  optional-prop UI. The GAME-004 contract, the GAME-005 seat model, and the gallery model are
  untouched; their tests are unaffected.

---

## §13 — Out of scope

Explicitly **not** in GAME-008 (each is named in the issue's Non-scope / Do-not sections or
follows from doctrine):

- **Live bot posting / pilots / corpus harvests** — operator-gated `scripts/bot-fixtures/`.
  GAME-008 enables, triggers, and schedules **none** of it.
- **The bot-fixture runner internals** (`scripts/bot-fixtures/`) — GAME-008 reuses only the
  *title-tag convention* those runners emit; it does not modify them.
- **The 1v1 contract / Primary Opponent assignment** → **GAME-004** (merged; consumed).
- **Public-room seats / chime-in governance** → **GAME-005** (merged; consumed).
- **Branch grammar** → **BR-004** (merged).
- **Jump Branch** → **GAME-006**.
- **Resolution / enough-tags / room closing** → **GAME-007**.
- Any **Supabase schema change** — no `profiles.is_bot` column, no bot-room flag, no migration.
  A follow-up migration card owns the first-class persisted flag (§1.3, §11).
- Any **Edge Function** — `submit-argument`, `admin-users`, `bot_user_registry` untouched.
- Any **AI / xAI / Anthropic / X API call** — GAME-008's model is deterministic pure TS.
- A **tappable "test rooms only" gallery filter** — v1 ships an informational marker only.
- Profile / display-name *rendering* changes beyond adding the marker — seats and authors are
  still labeled exactly as today; GAME-008 only *adds* a marker.
- A **route / screen transition** — the markers render in place (the card states "No route
  transition").

---

## §14 — Doctrine self-check

- **cdiscourse-doctrine §1 (score is gameplay analysis, never truth; score never blocks
  posting).** The bot marker describes an *account type* ("Test bot"), never a verdict, never
  "right"/"wrong"/"winner". `BotRoomPolicy` carries no score, no band, no heat.
  `assertBotRoomEligibility` vets *bot* actions only and has no path that blocks a real user's
  post. Enforced by `botRoomPolicyDoctrine.test.ts` (ban-list + no-block assertion).
- **cdiscourse-doctrine §2 (heat = activity).** Heat is not an input to any GAME-008 function.
  `botRoomPolicyModel.ts` imports nothing from any heat module — enforced by the
  forbidden-import test. A bot in a hot room and a bot in a quiet room are marked identically.
- **cdiscourse-doctrine §3 (popularity is not evidence).** GAME-008 reads no engagement / reply
  / view count anywhere. The marker is account-type only; it never ranks or amplifies.
- **cdiscourse-doctrine §4 / §7 (AI limits; no client AI).** GAME-008 makes **no** AI / xAI /
  Anthropic / X API call. The model is deterministic pure TS. Bots **never decide who is
  right** — GAME-008 ships no verdict path; the bot marker is purely informational. Live bot
  posting stays operator-gated in `scripts/bot-fixtures/`; GAME-008 enables none of it.
- **cdiscourse-doctrine §5 (rules engine sacred).** `src/lib/constitution/engine.ts` is
  untouched. No new rule, no flag, no transition.
- **cdiscourse-doctrine §6 (secrets).** No new key, no `.env*` change, no service-role anywhere
  (`botRoomPolicyModel.ts` is pure TS; the components are pure render). The doctrine test scans
  for `SERVICE_ROLE` / `ANTHROPIC` / `XAI` → zero matches.
- **cdiscourse-doctrine §8 (Supabase conventions).** No migration in v1. No table edited, no
  RLS changed. The schema-of-record for bot identity (`bot_user_registry`,
  `auth.users.user_metadata`) is documented but not modified or queried by GAME-008.
- **cdiscourse-doctrine §9 (plain language).** Internal enum values (`join_as_primary`,
  `bot_chime_in_not_permitted`, `bots_create_public_only`) never reach a user string — every
  visible string routes through `BOT_MARKER_COPY`. `looksLikeInternalCode` returns false for
  each, tested.
- **cdiscourse-doctrine §10 (v1 scope guards).** No voting, no real-time collab, no OAuth, no
  public API, no push, no search. GAME-008 adds a read-time marker only.
- **point-standing-economy (the policy stays separate from standing).** `BotRoomPolicy`,
  `BotMarkingViewModel`, and every GAME-008 type carry no numeric field, no band, no debt. A
  bot's presence does not change a single point of anyone's standing. `botRoomPolicyModel.ts`
  imports nothing from `argumentScoreModel` / `pointStanding` / `antiAmplification` — enforced
  by the forbidden-import test.
- **accessibility-targets.** The markers are informational (no `Pressable`, so 44×44 does not
  apply — documented). Color is never the only signal — the marker is a shape + the literal
  word "Test bot" / "Test room", grayscale-legible (tested). Every string inside `<Text>`. Each
  marker root carries a verbose `accessibilityLabel`. No chatty `announceForAccessibility`.
- **expo-rn-patterns.** No new dependency — both components are `<View>` + `<Text>` primitives.
  `botRoomPolicyModel.ts` is pure TS with no React / Supabase import (matches the `*Model.ts`
  convention beside `roomContractModel.ts` and `publicSeatModel.ts`). The components are thin
  presentational layers over a view-model.
- **test-discipline.** Four test files ship with the Build-phase code (model, doctrine, two
  component suites), covering every public function's happy + failure paths, the full
  `assertBotRoomEligibility` matrix, the `isBotSeededRoom` table, the ban-list, and the
  no-deceptive-framing assertion. Tests are part of this card's deliverable.

---

## §15 — Operator steps / decisions

**Operator deploy step: None — pure code change.** No migration (`npx supabase db push` not
needed), no Edge Function deploy, no new env var, no new dependency. GAME-008 adds a pure-TS
model, a copy block, two read-only RN marker components, and small additive (optional-prop)
wiring into the gallery card and the in-room participant row.

**No live bot posting is enabled by this card.** GAME-008 ships a *policy* and a *marker*. Bot
posting remains operator-gated in `scripts/bot-fixtures/` exactly as before; GAME-008 triggers
no corpus run, no harvest, no scheduler, no Edge Function.

**Operator decision (isolated — does not gate the build):**
- **OD-1 — bot-marker copy, placement, and the "bots yield seats" framing.** The card lists
  two Open decisions: (a) do bots yield public seats to real users — this design adopts the
  card's recommended **yes**, and notes the mechanism is already structural via GAME-005 (§3);
  the only thing left is any user-facing *wording* about it. (b) the exact bot-marker copy and
  placement — the proposed `BOT_MARKER_COPY` strings ("Test bot" / "Test room" /
  "Bot-seeded test room") and placement (a chip beside a bot author in-room; a row/badge on the
  gallery card) need a copy + design review to confirm none reads as alarming or deceptive.
  Both are single-edit changes (the copy block + the policy field); neither blocks the build.

**Future migration card (a heads-up, not a decision):** a first-class
`public.profiles.is_bot boolean` column + backfill from `bot_user_registry` + a public-read RLS
allowance would let a loader populate `BotParticipantHint` without the display-name convention.
Named and scoped in §1.3 / §4 / §11. The operator should expect this as the natural follow-up if
bot marking needs to be robust beyond corpus-tagged titles.

---

## Implementer note (GAME-008 build — 2026-05-20)

The build followed this design exactly. One isolated, single-spot copy fix was needed; it is
within OD-1 scope (`BOT_MARKER_COPY` is a single frozen block — wording is a one-spot edit) and
required no logic change, no redesign.

**`participant_a11y` reworded — design §1.5 vs §10 self-contradiction.** The §1.5 `BOT_MARKER_COPY`
authored `participant_a11y` as *"…they never decide who is **right**."* — but the §10 ban-list
(and the §14 doctrine self-check) correctly forbid the verdict token **"right"** in any marker /
a11y string. The §10 ban-list test would have failed on the design's own copy. The doctrine
*intent* is clear and correct (a bot marker must state that bots do not judge a debate), so the
phrase was reworded to *"…they never **judge a debate**."* — same doctrine meaning, ban-list
clean. This is the only copy deviation from §1.5; every other `BOT_MARKER_COPY` string ships
verbatim. OD-1 (final copy + placement review) still applies.

Everything else shipped as specified: the frozen `BOT_ROOM_POLICY` constant; `isBotSeededRoom` as
a pure fail-safe-human predicate over the GAME-004 `isBot` seam (no DB query, no `profiles.is_bot`
column); `looksLikeBotSeedTag` reusing the gallery `SUFFIX_TAG_PATTERNS` family; the four-reason
`assertBotRoomEligibility` GATE (the §6 edge-case matrix is the test plan); `buildBotMarkingViewModel`;
the two non-interactive marker components; the additive gallery wiring (the §5 documented no-query
degraded fallback — gallery card has the title, not loaded per-author hints); and the §10 test
plan including the API-surface omission proof. No migration, no Edge Function, no Supabase write,
no service-role, no live bot posting, no new dependency. The per-participant in-room marker mount
remains the §5 optional-prop follow-up step.
