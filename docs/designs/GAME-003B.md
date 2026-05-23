# GAME-003B — Argument Setup Screen — Design

**Status:** Design draft (expanded from the 2026-05-21 stub).
**Epic:** Epic 12 — Evidence-Enhanced Game Rules and Flow (setup / room-creation layer).
**Release:** Roadmap — pairs with QOL-030 (Release 6.6 one-box foundation); see §13.
**Issue:** local catalogue card `GAME-003B` — a blank storyboard-dependency card listed
in `docs/core/ux-ui-project-board.md` §"GAME-003B are blank cards the storyboards depend on".
No GitHub issue yet; an operator creates it from `scripts/github/uxBoardCards.json`.
**Branch:** `feat/GAME-003B-design`.
**Companion docs:**
[`docs/designs/QOL-030.md`](./QOL-030.md) (the one-box composer + `root_claim` box type
this setup panel lives inside),
[`docs/designs/GAME-003.md`](./GAME-003.md) (the `argumentMode` vocabulary + the
`ModeSetupScreen` spec this card supersedes the screen half of),
[`docs/designs/QOL-038.md`](./QOL-038.md) (the invite backend + auth-return path),
[`docs/designs/QOL-039.md`](./QOL-039.md) (the `visibility` column + the public→private
transition),
[`docs/ux-storyboards/roommates-dishes-public-argument.md`](../ux-storyboards/roommates-dishes-public-argument.md)
(Steps 1–3 — public argument setup),
[`docs/ux-storyboards/band-space-rent-private-evidence-argument.md`](../ux-storyboards/band-space-rent-private-evidence-argument.md)
(Step 1 — private argument setup).

> **Naming note (binding).** The card prefix stays `GAME-003B` for roadmap
> continuity — renaming a roadmap prefix is churn, and GAME-003 already names
> this follow-up "GAME-003B — Argument mode setup screen". The **screen** is
> named, in **all normal-user copy**, **"Argument setup"** / **"Start an
> argument"** — never "game", never "debate", never "player". The internal
> `debates` table name is **not** renamed; it stays internal.

---

## §0 — Card-vs-reality discrepancies (read this first)

The stub, the GAME-003 design, and the storyboards describe the setup step as if
the one-box composer already exists and as if a "mode setup screen" component is
the deliverable. This was checked against the repo at the head of this worktree
(Stage 6.4 complete). Where the card and reality disagree, **the design follows
reality** — the same discipline QOL-039 §0 applied.

| # | Card / stub / GAME-003 says | Reality at this worktree head | Design decision |
|---|---|---|---|
| D1 | "Build a setup panel *inside* the QOL-030 `root_claim` box." The stub treats the one-box as a built dependency. | **The QOL-030 one-box does not exist.** `Glob src/features/arguments/oneBox/*` returns nothing. `OneBox.tsx`, `boxModel.ts`, `Popout.tsx` are all design-only in `docs/designs/QOL-030.md`. The live room-creation surface is the bespoke `src/features/debates/CreateDebateForm.tsx` (a `Screen` with three `TextInputField`s and a "Create Debate" button). | GAME-003B ships the **setup-field model + the setup panel component + the title-fallback rule + the API wiring** in a chassis-independent way. The setup panel is a **self-contained component (`ArgumentSetupPanel`)** that QOL-030's `root_claim` box renders as its room-setup section. Until QOL-030 lands, the same `ArgumentSetupPanel` is hosted by a thin replacement screen (`ArgumentSetupScreen`) that retires `CreateDebateForm`. The model API does not change between the two hosts — see §7 + §9. |
| D2 | GAME-003 part B names `ModeSetupScreen.tsx` + `ModeRulesColumn.tsx` + `useModeSetup.ts` as the deliverable — a standalone two-column mode-compare screen. | GAME-003 shipped the **model** (`src/features/modes/argumentModeModel.ts` — the 13-mode enum, `buildModeRuleRows`, `argumentModeDisplayName`, `DEFAULT_ARGUMENT_MODE`, `ARGUMENT_MODE_TEMPLATES`) and `ARGUMENT_MODE_COPY` in `gameCopy.ts`. No screen was built. | GAME-003B **supersedes the "standalone `ModeSetupScreen`" idea**. The mode picker is **one section of the unified `ArgumentSetupPanel`**, not a separate bespoke screen — a separate screen would re-introduce a navigation surface the codebase (state-driven, no router — QOL-038 §6.1) avoids. GAME-003B **consumes** `argumentModeModel` read-only; it adds no mode-model code. `useModeSetup.ts` is replaced by `useArgumentSetup.ts` (§5.4). |
| D3 | The stub's field table names `visibility`, `invitedRespondentEmail`, `observerPolicy`, `chimeInAllowed` as setup fields. | `public.debates` has **no `visibility` column** (QOL-039 §0 D1 — it ships that column). There is **no `argument_room_invites` table** and **no `manage-room-invite` function** (QOL-038 ships them). There is **no `mode` column** on `debates` (GAME-003 explicitly deferred persistence). | GAME-003B does **not** ship the visibility column, the invite table, or a `mode` column. It defines the **client-side `ArgumentSetupDraft`** that *collects* these fields and **routes each to its owning card's API**: `visibility` → `createDebate` (QOL-039's column), the invite email → `createRoomInvite` (QOL-038), the mode → a single forward-compat `debates.mode` column **this card adds** (§4.2 — GAME-003 deferred it to "a later card"; GAME-003B *is* that later card for `mode` only). Observer/chime-in policy → §4.3. The setup panel is the **assembly point**; the persistence is split across cards by ownership. |
| D4 | The stub: "Public/private chosen before send; private rooms never appear on public lists." | The public→private *transition* and the RLS that hides private rooms are **QOL-039's** (`docs/designs/QOL-039.md` §4). | GAME-003B owns the **create-time visibility choice in the panel** (a control QOL-039 §6.1 already expects the setup surface to host). The *RLS enforcement* and the *transition* are QOL-039's. GAME-003B passes `visibility` into `createDebate`; QOL-039's migration + RLS make it real. If QOL-039 has not landed, the control still renders and the value is stored on the column QOL-039 adds — GAME-003B's migration (§4.2) and QOL-039's migration are **independent and order-free** (each `ADD COLUMN IF NOT EXISTS`-safe; see §4.2 + §12). |
| D5 | The stub: "Root claim posts via `submit-argument`; no direct insert." | `submit-argument` is the live Edge Function; the client invokes it via `src/lib/edgeFunctions.ts` (used by `ArgumentComposerDock.tsx`). `createDebate` (`debatesApi.ts`) inserts the `debates` row + auto-joins the creator. The **room row and the root argument are two writes**: `createDebate` makes the room; `submit-argument` makes the root claim. | GAME-003B keeps that split. The setup panel's "Start argument" action runs **`createDebate` (room row) → then `submit-argument` (root claim)** in sequence. No direct insert into `public.arguments`. The two-step is sequenced and made resilient in §5.3 + §8 (partial-failure handling). |

**Cannot proceed? — No.** Every field the card needs has an owning card or a
small, clearly-scoped addition here. GAME-003B's *only* schema change is **one
append-only migration adding `debates.mode`** (§4.2) — GAME-003 explicitly
deferred mode persistence "to a later card", and the setup screen is the natural
home. Everything else is client composition over `createDebate` (QOL-039's
column), `argumentModeModel` (GAME-003, shipped), `createRoomInvite` (QOL-038),
and `submit-argument` (live). The one-box dependency (QOL-030) is a *host* for
the panel, not a blocker — §9 covers its absence.

---

## §1 — Goal & scope

Starting an argument needs a coherent **setup step**: an optional title, a
public/private choice, an optional invited respondent, observer / chime-in
policy, an argument mode, evidence expectation, and category tags. Today the only
room-creation surface is the bespoke `CreateDebateForm` — three text fields and a
button, with discouraged "New Debate" / "Create Debate" copy and **no** mode,
visibility, invite, observer, or category affordance at all.

GAME-003B builds the **Argument Setup Panel**: the single, doctrine-clean setup
surface that collects every setup field, lives inside the QOL-030 `root_claim`
box (with a thin standalone host while QOL-030 is unbuilt), produces the root
claim through `submit-argument`, and registers the new room so it surfaces as
exactly one Conversation Gallery card.

### In scope

1. The pure-TS **setup-field model** — `ArgumentSetupDraft`, `ArgumentVisibility`,
   `ChimeInPolicy`, `ArgumentSetupValidation`, the title-fallback rule, defaults,
   and the `buildCreateDebateInput` / `buildRootClaimSubmission` mappers.
2. The **`ArgumentSetupPanel`** component — the setup section: title field,
   visibility segmented control, invite-by-email field, observer/chime-in policy,
   the mode picker (consuming GAME-003's `argumentModeModel`), an
   evidence-expected toggle, category tag chips, and the "Start argument" action.
3. The **`useArgumentSetup`** hook — draft state, validation, and the
   create-room → post-root-claim → register-invite orchestration.
4. **One append-only migration** adding `debates.mode text` (the GAME-003-deferred
   mode-persistence column) with a safe default and a `CHECK` against the
   shipped-mode set. *Written, not deployed.*
5. The **`ArgumentSetupScreen`** thin host — a screen that renders
   `ArgumentSetupPanel` and **retires `CreateDebateForm`** (the §9 fallback host
   when QOL-030 has not landed; when it has, the panel moves into the box and
   this screen is deleted by a follow-up).
6. Wiring: `CreateDebateInput` gains `visibility?` + `mode?`; `createDebate`
   writes them; the gallery refresh shows the new room.
7. Doctrine-clean copy in `gameCopy.ts` — the `ARGUMENT_SETUP_COPY` block.

### Out of scope — see §14

The invite backend / token / auth deep link (QOL-038); the `visibility` column +
RLS + the public↔private transition (QOL-039); evidence-upload storage and the
evidence object (EV-001 / QOL-036); the concession composer (QOL-041); voting /
promotion / scoring; the one-box chassis itself (QOL-030); the `argumentMode`
*model* (GAME-003, shipped — consumed read-only).

The doctrine anchor, inherited from GAME-003: **the setup step configures a
consented room; it never declares a winner, never assigns truth, and never blocks
posting. A non-empty root claim is the only hard requirement — every other field
is optional with a safe default.**

---

## §2 — Source storyboards & analysis

| Source | What it contributes to GAME-003B |
|---|---|
| Roommates / dishes **Step 1** | The entry action is a clearly-labelled **"Start an argument"** — "There is no 'Start a game' and no 'Start a debate' anywhere." The app opens to the Conversation Gallery; this affordance is its primary entry. |
| Roommates / dishes **Step 2** | The compose screen has, explicitly: an **optional title** field; a **visibility control (Public / Private, defaulting to Public)**; an **invite-by-email** field; and helper copy that "a blank title will fall back to an excerpt of the root claim." On submit, "a room record is created (internally a `debates` row), the creator is enrolled as a participant, and a pending invite record is created." |
| Roommates / dishes **Step 3** | The root claim "is written via the `submit-argument` Edge Function — never a direct insert." Classification tags (claim / household agreement / fairness / fact / source) are selected below the body — the **category-tag** surface. |
| Band / rent **Step 1** | The second creation path: visibility set to **Private *before* sending**; the room "is never added to any public list." Optional title `March practice-room rent`; the same blank-title fallback. |
| Band / rent **Step 2** | Root-claim tags include `evidence expected` and `private` — confirming **`evidenceExpected`** and the category set are setup-time choices, advisory only. |
| GAME-003 design §"Mode setup screen design" + scope split | GAME-003 ships the mode *model* and explicitly defers the setup *screen* to "GAME-003B". GAME-003B consumes `argumentModeModel`; it builds the picker, not the model. |
| `docs/designs/QOL-030.md` §5 (F1 both scenarios) | "`root_claim` carries room setup (title, visibility, invite) — the root box is the *only* box that also configures the room." This is GAME-003B's integration target. |
| `docs/designs/QOL-038.md` §2 | The invite affordance lives in the `root_claim` box's room-setup section; QOL-038 owns the backend. GAME-003B's panel hosts the field; `createRoomInvite` is QOL-038's. |
| `docs/designs/QOL-039.md` §6.1 | The create-time visibility control is "a `root_claim` box room-setup field" — exactly the control GAME-003B builds. QOL-039 owns the column + RLS. |
| `docs/core/ux-ui-project-board.md` §"blank cards" | GAME-003B is a blank storyboard-dependency card; it "must be designed before confident implementation." This doc is that design. |

---

## §3 — Problem statement

`CreateDebateForm.tsx` is the only room-creation surface. It is wrong on three
axes:

1. **It uses banned vocabulary.** `Screen title="New Debate"`, a `"Create
   Debate"` button, placeholders that say "this debate" and "the falsifiable
   proposition being debated". The terminology audit
   (`npm run ux:terminology:audit`, scoped to normal-user mode by PR #195) flags
   every one of these. Doctrine requires "Argument setup" / "Start an argument" /
   "Public argument" / "Private argument".
2. **It is missing every setup field the storyboards require.** No mode, no
   visibility, no invite, no observer/chime-in policy, no category tags, no
   evidence-expected hint. The storyboards' Step 1–3 of *both* scenarios cannot
   be performed.
3. **Its title is mandatory and its `resolution` is a separate required field.**
   The storyboards say the title is **optional** (blank → root-claim excerpt),
   and the one-box model (QOL-030) makes the **root claim itself** the primary
   body — `resolution` as a distinct required field is a legacy artifact of the
   pre-one-box "formal debate" framing.

The hard parts GAME-003B must solve:

1. **Hosting the panel without the one-box.** QOL-030 is the intended home but is
   unbuilt. The panel must be a self-contained component that QOL-030 can drop
   in, *and* must work today behind a thin screen. The model and the component
   API must be identical in both worlds (§7, §9).
2. **The two-write create.** A room is a `debates` row (`createDebate`); the root
   claim is an `arguments` row (`submit-argument`). They are separate writes. If
   the room is created but the root-claim post fails, the user must not be
   stranded with an empty room and no recovery path (§8).
3. **The title fallback without mutating the body.** The displayed title falls
   back to a root-claim excerpt when blank — but the stored `debates.title` and
   the stored `arguments.body` are two different columns; the fallback is a
   **display-time** derivation (`pickDisplayTitle`, already shipped), never a
   write that copies the body into the title (§4.4).
4. **Routing each field to its owning card.** `visibility` belongs to QOL-039's
   column; the invite belongs to QOL-038's table; the mode belongs to a column
   GAME-003B adds. The panel is the single collection point but it must not
   *own* contracts other cards own — it composes them (§4, §5).

---

## §4 — Data model & file changes

### 4.1 The setup-field model (pure TS — the heart of the card)

All types live in a new pure-TS module `src/features/arguments/argumentSetupModel.ts`.
No React, no Supabase, no network, no AI, no `Date.now()` — deterministic, safe
to import from Node tests and from server-side code.

```ts
/**
 * GAME-003B — visibility chosen at room setup. 'public' = listed on the
 * Conversation Gallery and readable by any authenticated user (today's
 * behaviour, made explicit by QOL-039). 'private' = readable only by
 * participants. GAME-003B collects this; QOL-039 owns the column + RLS.
 */
export type ArgumentVisibility = 'public' | 'private';

/**
 * Whether observers (non-participants) may post a chime-in in a PUBLIC room.
 *  - 'allow'   — chime-ins permitted (GAME-005 chime-in seats apply).
 *  - 'disallow'— observers may watch + inspect but not chime in.
 * Doctrine (GAME-003B Open Question OQ-3, resolved): observer *watching* of a
 * public room is ALWAYS on — a public room is public. The only setup choice
 * is whether chime-ins are accepted. A private room has no observers at all,
 * so this field is inert when visibility = 'private'.
 */
export type ChimeInPolicy = 'allow' | 'disallow';

/**
 * The closed category vocabulary for a room. A small, fixed, doctrine-safe
 * list — NOT free text and NOT the message-qualifier vocabulary (those tag a
 * single argument; these tag the room's subject area). Reusing the qualifier
 * vocabulary would conflate "what kind of move is this" with "what is this
 * room about" — see §4.5 + Open Question OQ-2 (resolved: a new closed list).
 */
export type RoomCategory =
  | 'household'        // chores, shared space, roommates
  | 'money'            // payments, rent, shared expenses
  | 'relationship'     // interpersonal, non-therapy
  | 'work'             // workplace decisions, team disputes
  | 'plans'            // logistics, scheduling, trips
  | 'facts'            // a factual / "what actually happened" dispute
  | 'opinion'          // a values / preference disagreement
  | 'other';           // explicit catch-all — never a hidden default

/** Frozen ordered category list. Tests + the chip row iterate this. */
export const ALL_ROOM_CATEGORIES: ReadonlyArray<RoomCategory>;

/** A room may carry at most this many category tags. Keeps the chip row sane. */
export const MAX_ROOM_CATEGORIES = 3;

/**
 * GAME-003B — the in-memory draft a user assembles in the setup panel before
 * the room exists. Every field except `rootClaimBody` has a safe default;
 * `rootClaimBody` is the ONLY hard requirement (a room with no root claim is
 * not a room). Nothing here is persisted until "Start argument" runs.
 */
export interface ArgumentSetupDraft {
  /** Optional. Blank is valid — display falls back to a root-claim excerpt. */
  title: string;
  /** The root claim body. REQUIRED, non-empty after trim. Becomes the root
   *  `arguments.body` via submit-argument. Never copied into `title`. */
  rootClaimBody: string;
  /** Default 'public'. Storyboards: Public is the default; Private is opt-in. */
  visibility: ArgumentVisibility;
  /** Optional invited respondent email. Empty = no invite. QOL-038 owns the
   *  send; GAME-003B only collects + validates the address shape. */
  invitedRespondentEmail: string;
  /** Default 'allow'. Inert when visibility = 'private'. */
  chimeInPolicy: ChimeInPolicy;
  /** The GAME-003 argument mode. Default DEFAULT_ARGUMENT_MODE
   *  ('casual_disagreement'). Only `isShippedMode` modes are selectable. */
  mode: ArgumentMode;
  /** Advisory hint that evidence is expected in this room. Never a gate —
   *  it tunes helper copy only. Storyboard: an `evidence expected` tag. */
  evidenceExpected: boolean;
  /** 0..MAX_ROOM_CATEGORIES room categories. May be empty. */
  categories: ReadonlyArray<RoomCategory>;
}

/** The defaults a fresh panel opens with. Frozen. */
export const DEFAULT_ARGUMENT_SETUP_DRAFT: Readonly<ArgumentSetupDraft>;
```

`DEFAULT_ARGUMENT_SETUP_DRAFT` is:
`{ title: '', rootClaimBody: '', visibility: 'public', invitedRespondentEmail: '',
chimeInPolicy: 'allow', mode: DEFAULT_ARGUMENT_MODE, evidenceExpected: false,
categories: [] }`.

### 4.2 The migration — `debates.mode` (the ONLY schema change)

One new migration, `supabase/migrations/20260521000003_game003b_debate_mode.sql`
(timestamp must sort after the latest existing migration
`20260517000009_meta_1a_point_tags.sql` — confirm at write time; if QOL-038's
`…000010` or QOL-039's `…000001` land first, renumber so this sorts last).
Append-only; never edits an applied file.

```sql
-- GAME-003B — persist the consented argument mode chosen at room setup.
-- GAME-003 shipped the mode MODEL and explicitly deferred persistence
-- "to a later card"; GAME-003B is that card (for `mode` only).
--
-- Default 'casual_disagreement' = DEFAULT_ARGUMENT_MODE: the gentlest mode,
-- so every existing row backfills to the safe, lowest-friction default and
-- no live room silently gains friction. NOT NULL + default backfills in one
-- statement. IF NOT EXISTS keeps this order-free vs QOL-038 / QOL-039.
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'casual_disagreement'
    CHECK (mode IN (
      'casual_disagreement',
      'court_record_strict',
      'internet_fact_check',
      'debate_club'
    ));

COMMENT ON COLUMN public.debates.mode IS
  'GAME-003B — the consented argument mode (GAME-003 vocabulary). CHECK is '
  'the 4 SHIPPED modes only; the 9 design-only modes are not yet selectable. '
  'A later card widens the CHECK when a stub mode ships. Mode changes '
  'friction/helper copy only; it never assigns truth and never blocks a post.';
```

Design notes:

- **Why `text` + `CHECK`, not a Postgres `enum`:** the codebase uses `text +
  CHECK` for `debates.status` and `debate_participants.side` (QOL-039 §4.1 makes
  the same call for `visibility`). Consistency, and a `CHECK` is widened by a
  later append-only migration without an `ALTER TYPE` dance — exactly what
  happens when a GAME-003 design-only mode is promoted to shipped.
- **The `CHECK` lists only the 4 shipped modes**, mirroring
  `MVP_ARGUMENT_MODES`. The panel only ever offers `isShippedMode` modes
  (§4.3.3 of the model), so a non-shipped value can never be written. If a stub
  mode later ships, a one-line append-only migration widens the `CHECK`.
- **No RLS change.** `mode` is a non-sensitive descriptive column. The existing
  `debates` SELECT/INSERT/UPDATE policies already gate the row; `mode` rides
  along. The creator sets it at `INSERT`; **GAME-003B does not add a
  change-mode-later path** (Open Question OQ-1 — the mode is fixed at creation,
  consistent with GAME-003's "immutable once a room is created").
- **No `visibility` column here** — that is QOL-039's migration. The two
  migrations are independent; each uses `ADD COLUMN IF NOT EXISTS` so they apply
  in any order. If QOL-039 has not landed, `createDebate` writing `visibility`
  would error on a missing column — §4.6 handles that with a feature-detect:
  `createDebate` includes `visibility` in the insert payload **only when the
  column exists** (a one-time capability probe), so GAME-003B degrades cleanly
  to "every room public" exactly as QOL-039 §4.3 already describes for its own
  absence.

### 4.3 Where the other setup fields land

| Setup-draft field | Persisted by | GAME-003B's responsibility |
|---|---|---|
| `title` | `debates.title` (exists) | Pass through `createDebate`; allow blank (§4.4). |
| `rootClaimBody` | `arguments.body` via `submit-argument` (exists) | Sequence the post after `createDebate` (§5.3). |
| `visibility` | `debates.visibility` — **QOL-039's column** | Collect + pass to `createDebate`; QOL-039's migration + RLS make it real. Feature-detected (§4.6). |
| `mode` | `debates.mode` — **GAME-003B's column** (§4.2) | The one schema change this card owns. |
| `invitedRespondentEmail` | `argument_room_invites` — **QOL-038's table** | Collect + validate the address shape; call `createRoomInvite` after the room exists (§5.3). QOL-038 owns the token/email/auth. |
| `chimeInPolicy` | See below | §4.3.1. |
| `evidenceExpected` | Advisory only — **not persisted in v1** | Tunes helper copy in the panel and (forward-compat) the composer; not a stored room property. §4.3.2 + Open Question OQ-4. |
| `categories` | See below | §4.3.3. |

**4.3.1 `chimeInPolicy` — not a new column in v1.** GAME-005 shipped the
public-room chime-in seat model (`publicSeatModel.ts`) as a **read-time model
with no migration** (GAME-005 §0 D3). A `chimeInPolicy` is conceptually a room
property, but adding a column would force a GAME-005 read-path change GAME-003B
does not own. **v1 decision:** `chimeInPolicy` is collected in the draft and
surfaced as a setup choice, but **persisted by reusing the `debates.description`
field as a structured suffix is rejected** (it would pollute a free-text field).
Instead, v1 ships `chimeInPolicy` as a **panel-only choice that is recorded in
the migration as a second column on the same `…000003` migration** — a small,
honest addition:

```sql
-- chime-in acceptance for PUBLIC rooms. 'allow' = observers may chime in;
-- 'disallow' = observers may watch but not chime in. Inert for private rooms.
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS chime_in_policy text NOT NULL DEFAULT 'allow'
    CHECK (chime_in_policy IN ('allow', 'disallow'));

COMMENT ON COLUMN public.debates.chime_in_policy IS
  'GAME-003B — whether observers may post a chime-in in a public room. '
  'Inert when visibility = private. GAME-005 chime-in governance reads this '
  'as a gate on chime-in ACQUISITION; it never affects observer read access.';
```

GAME-005's `buildPublicRoomSeatMap` gains a forward-compat `chimeInPolicy?`
input (defaulting to `'allow'`, so GAME-005 with no caller change is unaffected)
— wiring it is a **named GAME-005 follow-up**, not GAME-003B (§14). GAME-003B
ships the column + writes it; GAME-005 consuming it is the follow-up. This keeps
GAME-003B's write honest (the choice is stored, not dropped) without GAME-003B
reaching into GAME-005's model.

**4.3.2 `evidenceExpected` — advisory, not persisted.** The storyboard's
`evidence expected` is a *root-claim classification tag*, not a stored room
property. EV-001's evidence model and EV-003's evidence-debt are the real
evidence machinery. GAME-003B treats `evidenceExpected` as a **setup-time hint
that tunes the panel's helper copy** ("You can attach evidence after you post")
and is **not written to any column** — persisting it would imply a contract
GAME-003B does not own. Open Question OQ-4 records that a later evidence card may
promote it to a real column; v1 keeps it advisory.

**4.3.3 `categories` — a third column on the same migration.** Room categories
are a genuine, queryable room property (the Conversation Gallery's section
grouping could use them later). They are stored as a Postgres `text[]` with a
per-element `CHECK` via a trigger-free constraint:

```sql
-- room category tags (0..3). A closed vocabulary; see argumentSetupModel.ts.
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}'
    CHECK (
      array_length(categories, 1) IS NULL          -- empty array allowed
      OR (
        array_length(categories, 1) <= 3
        AND categories <@ ARRAY[
          'household','money','relationship','work',
          'plans','facts','opinion','other'
        ]::text[]
      )
    );

COMMENT ON COLUMN public.debates.categories IS
  'GAME-003B — 0..3 room category tags from a closed vocabulary. Descriptive '
  'only; never affects scoring, truth, heat, or visibility.';
```

So the single migration `…000003` adds **three columns to `debates`**: `mode`,
`chime_in_policy`, `categories`. All append-only, all `IF NOT EXISTS`, all with
safe defaults that backfill every existing row, none requiring an RLS change.

### 4.4 The title-fallback rule

The displayed title falls back to a root-claim excerpt when the title is blank.
This is **already a shipped pure helper** — `pickDisplayTitle` in
`src/features/debates/debateTitleHelpers.ts`:

```ts
pickDisplayTitle({ debateTitle, rootBody, maxChars }): string
// explicit title → trimmed/clamped; else root-body excerpt; else 'Untitled argument'.
```

GAME-003B's contract:

- **The setup panel stores whatever the user typed** (possibly empty) into
  `debates.title` via `createDebate`. An empty title is a valid, stored value —
  `''`.
- **The displayed title is always computed by `pickDisplayTitle`** at render
  time, fed `debates.title` + the root argument's `body`. GAME-003B never writes
  the body into the title column. The fallback is a *view derivation*, not a
  write — exactly the discipline Stage 6.1.8 established ("updating the title
  never mutates `arguments.body`"; the inverse holds too).
- `validateDebateTitle` (also shipped) is reused to clamp the title to
  `MAX_DEBATE_TITLE_CHARS` (120) and strip control characters before the write.
- The panel's title field shows helper copy: *"Optional — if you leave this
  blank, we'll use the start of your argument."* (the storyboard's exact intent).

GAME-003B adds **no new title helper** — it consumes `pickDisplayTitle` and
`validateDebateTitle` unchanged. The only new code is the helper copy string and
the panel wiring.

### 4.5 Why categories are a new closed list, not the qualifier vocabulary

`src/features/arguments/messageQualifiers.ts` (Stage 6.1.5.1) has a 13-value
`MessageCategory` + 26-value `MessageQualifier`. Those describe **one argument's
move shape** (is this a concession? a clarification? off-topic?). A *room*
category describes **the room's subject area** (household / money / facts). They
are orthogonal axes; reusing the qualifier vocabulary for rooms would (a)
mis-fit (no qualifier means "this room is about money"), and (b) couple the
room-setup surface to a per-argument annotation taxonomy that evolves on its own
schedule. So GAME-003B defines a small, **separate, closed** `RoomCategory` list
(§4.1). Open Question OQ-2 records this decision as resolved.

### 4.6 File changes

**New — migration**

- `supabase/migrations/20260521000003_game003b_debate_mode.sql` (~45 lines) —
  the `mode` + `chime_in_policy` + `categories` columns (§4.2 + §4.3.1 + §4.3.3).
  All `ADD COLUMN IF NOT EXISTS`, all safe defaults. *Written, not deployed.*

**New — pure-TS model**

- `src/features/arguments/argumentSetupModel.ts` (~200 lines) —
  `ArgumentVisibility`, `ChimeInPolicy`, `RoomCategory`, `ALL_ROOM_CATEGORIES`,
  `MAX_ROOM_CATEGORIES`, `ArgumentSetupDraft`, `DEFAULT_ARGUMENT_SETUP_DRAFT`,
  `ArgumentSetupValidation`, `validateArgumentSetup(draft)`,
  `buildCreateDebateInput(draft)`, `buildRootClaimSubmission(draft, debateId)`,
  `summariseSetupForReview(draft)`, and `_forbiddenArgumentSetupTokens` (the
  ban-list helper). No React / Supabase / network / AI / `Date.now()`.

**New — client UI**

- `src/features/arguments/ArgumentSetupPanel.tsx` (~260 lines) — the
  self-contained setup section: the title field, the visibility segmented
  control, the invite-email field, the chime-in policy control, the mode picker,
  the evidence-expected toggle, the category chip row, and the "Start argument"
  primary action. Chassis-independent — QOL-030's `root_claim` box renders it;
  the §9 host renders it; the component does not know which.
- `src/features/arguments/ArgumentSetupScreen.tsx` (~90 lines) — the **thin
  host** that wraps `ArgumentSetupPanel` in a `Screen` and wires
  `useArgumentSetup`. This is the §9 fallback host and the live entry while
  QOL-030 is unbuilt. When QOL-030 lands, this screen is deleted by a follow-up
  and the box hosts the panel directly.
- `src/features/arguments/useArgumentSetup.ts` (~150 lines) — the hook: draft
  state, field setters, live validation, and the create-room → post-root-claim →
  register-invite orchestration (§5.3 + §8). Replaces GAME-003's planned
  `useModeSetup.ts`.
- `src/features/arguments/ModePickerRow.tsx` (~110 lines) — the mode-picker
  sub-component: renders one selectable row per `isShippedMode` mode using
  `argumentModeDisplayName` + `argumentModeDescription` + `buildModeRuleRows`
  (all from `argumentModeModel`). Extracted so the picker is independently
  testable. (Optional extraction — may live inside `ArgumentSetupPanel.tsx` if
  the implementer prefers; the design treats it as a sub-component.)

**Modified**

- `src/features/debates/types.ts` (~+8 lines) — `CreateDebateInput` gains
  `visibility?: ArgumentVisibility`, `mode?: ArgumentMode`,
  `chimeInPolicy?: ChimeInPolicy`, `categories?: ReadonlyArray<RoomCategory>`;
  `resolution` becomes optional (`resolution?: string`) — the one-box model
  makes the root claim the body, not a separate `resolution` (§3 point 3). The
  `Debate` interface gains `visibility`, `mode`, `chimeInPolicy`, `categories`
  (read-back).
- `src/features/debates/debatesApi.ts` (~+40 lines) — `DebateRow` gains the four
  columns; `mapDebateRow` maps them (with safe fallbacks so a pre-migration row
  still maps: `mode ?? 'casual_disagreement'`, `visibility ?? 'public'`,
  `chime_in_policy ?? 'allow'`, `categories ?? []`); `createDebate` writes
  `mode`, `chime_in_policy`, `categories` always and `visibility`
  feature-detected (§4.6 / §4.2 note); the `select(...)` column lists in
  `listDebates` + `createDebate` add the four columns. `createDebate`'s
  `resolution` insert uses `input.resolution ?? ''` (a room created from the
  one-box has no separate resolution).
- `src/features/debates/useDebates.ts` (~+4 lines) — `create` already takes
  `CreateDebateInput`; no signature change. `useArgumentSetup` calls
  `useDebates().create` for the room row.
- `src/features/arguments/gameCopy.ts` (~+70 lines) — add a frozen
  `ARGUMENT_SETUP_COPY` block (the panel labels, helper strings, the visibility
  copy, the category-tag labels, the chime-in policy copy, the partial-failure
  recovery copy); register it in `ALL_COPY`; add any new internal code that
  surfaces (e.g. `setup_room_created_post_failed`) to `PLAIN_LANGUAGE_COPY` so
  `toPlainLanguage` resolves it.
- `src/features/arguments/index.ts` (barrel — `+`exports) — export
  `argumentSetupModel` types + functions, `ArgumentSetupPanel`,
  `ArgumentSetupScreen`, `useArgumentSetup`.
- `src/features/debates/index.ts` (~+4 lines) — re-export the widened
  `CreateDebateInput` / `Debate` types if consumers import from here.
- The Conversation Gallery entry (`ConversationGalleryScreen.tsx`) — repoint the
  "Start an argument" affordance from `CreateDebateForm` to `ArgumentSetupScreen`
  (~+6 / −4 lines). The affordance label is already "Start an argument" (Stage
  6.3) — only the target screen changes.

**Deleted**

- `src/features/debates/CreateDebateForm.tsx` — **retired by this card.**
  GAME-003B's `ArgumentSetupPanel` + `ArgumentSetupScreen` fully supersede it
  (§13). All `CreateDebateForm` imports (`ConversationGalleryScreen.tsx`,
  `DebateListScreen.tsx`, `useDebates.ts` if any) are repointed. The stub said
  "retired in P10 after GAME-003B is green" — but GAME-003B *is* the
  replacement, so the retirement happens **in this card**: shipping the
  replacement and leaving the doctrine-violating original in the tree would keep
  a `npm run ux:terminology:audit` failure alive. The deletion is part of
  "done".

No other file is deleted. `argumentModeModel.ts` is **not** modified — consumed
read-only.

---

## §5 — The setup panel: structure, validation, and the create orchestration

### 5.1 Panel section order (top → bottom)

The `ArgumentSetupPanel` renders, in this fixed order — the order the
storyboards' Step 1–3 walk:

1. **Root claim body** — a multi-line input. The one required field. Helper:
   *"What's the argument? State your point in your own words."* This is the
   QOL-030 `root_claim` box's body when the panel is hosted there; in the §9
   standalone host it is the panel's first field.
2. **Title** (optional) — a single-line input, helper *"Optional — if you leave
   this blank, we'll use the start of your argument."*
3. **Visibility** — a 2-option segmented control, **Public** (default) /
   **Private**. Helpers: Public — *"Anyone can find and read this argument."*;
   Private — *"Only people you invite can find and read this argument."* (the
   QOL-039 §6.1 copy).
4. **Invite a respondent** (optional) — a single email field, helper *"They'll
   get a link that takes them straight to this argument."* (QOL-038 §7.1 copy).
5. **If anyone can chime in** (public rooms only — hidden when Private is
   selected) — a 2-option control **Allow chime-ins** (default) / **Just the two
   of us**. Helper: *"Chime-ins let people watching add a side note. You and the
   other person decide what to do with each one."*
6. **Argument mode** — the `ModePickerRow` list (§5.2).
7. **Add evidence later** — a toggle (`evidenceExpected`), helper *"Turn this on
   if this argument will lean on receipts or screenshots. You can attach them
   after you post."*
8. **What's this about** (optional) — a category chip row (§5.3 of the model;
   0–3 of `ALL_ROOM_CATEGORIES`).
9. **Primary action** — **"Start argument"** (the button label; never "Create
   debate"). A secondary **"Cancel"**.

Section 5 is **conditionally hidden** when `visibility === 'private'` (a private
room has no observers, so chime-in policy is meaningless — §4.1). The draft still
carries `chimeInPolicy: 'allow'` but it is inert; `buildCreateDebateInput`
forces `chime_in_policy = 'allow'` for private rooms so the stored value is
unambiguous.

### 5.2 The mode picker

`ModePickerRow` iterates `MVP_ARGUMENT_MODES` (the 4 `isShippedMode` modes —
`casual_disagreement`, `court_record_strict`, `internet_fact_check`,
`debate_club`). The 9 `design_only` modes are **not rendered** (GAME-003:
"design-only means not yet selectable in the live setup screen"). Each row shows:

- the mode display name — `argumentModeDisplayName(mode)`;
- the one-line description — `argumentModeDescription(mode)`;
- an expandable "the rules" detail — the rows from `buildModeRuleRows(mode)`,
  each a `{ label, value }` plain-language pair (tone, evidence, pacing,
  informality, etc. — GAME-003's pure function).

The default-selected row is `DEFAULT_ARGUMENT_MODE` (`casual_disagreement`).
Selection is a single `accessibilityRole="radiogroup"` of 4 ≥44px targets; the
selected state is conveyed by **more than color** (label weight + a check mark)
per `accessibility-targets`. GAME-003B writes **no mode-model code** — every
string and every rule row comes from `argumentModeModel` + `ARGUMENT_MODE_COPY`.

GAME-003's two-column "compare two modes side by side" idea is **dropped** for v1
(D2): a single selectable list with an expandable rules detail is simpler, fits a
phone, and avoids a bespoke compare screen. The `buildModeRuleRows` data is the
same; only the layout is one-column.

### 5.3 The create orchestration (`useArgumentSetup`)

"Start argument" runs a **three-step sequence**. Each step is awaited; a failure
at any step is surfaced without losing the draft.

```
validateArgumentSetup(draft)  ──fail──▶  show inline field errors, stop
        │ ok
        ▼
STEP 1  createDebate(buildCreateDebateInput(draft), userId)
        │   writes the `debates` row: title, resolution:'', visibility, mode,
        │   chime_in_policy, categories; status 'open'; auto-joins the creator.
        ├──fail──▶  show "We couldn't start the argument. Try again." — draft
        │           intact, nothing was created. (Atomic: createDebate either
        │           makes the row or doesn't.)
        │ ok → debateId
        ▼
STEP 2  submit-argument  (buildRootClaimSubmission(draft, debateId))
        │   posts the root claim as the root `arguments` row via the Edge
        │   Function — the existing submit-argument path, same as the composer.
        ├──fail──▶  the ROOM EXISTS but has no root claim. See §8 case 1:
        │           the user is taken INTO the new (empty) room with a
        │           non-blocking notice "Your argument room is ready — post
        │           your first point to get started." The root-claim body
        │           they typed is pre-filled into the room's composer. No
        │           orphan, no dead end.
        │ ok → rootArgumentId
        ▼
STEP 3  if draft.invitedRespondentEmail is non-empty:
        │   createRoomInvite({ debateId, inviteeEmail, intendedSeat:'respondent' })
        │   — QOL-038's client wrapper. Best-effort: an invite failure does NOT
        │   undo the room or the root claim.
        ├──fail──▶  the room + root claim are fine; show a non-blocking
        │           "The argument is ready, but we couldn't send the invite.
        │           You can invite them from inside the argument." The room
        │           opens regardless.
        │ ok
        ▼
selectDebate(debateId)  →  the room opens; the gallery refreshes so the new
room is exactly one Conversation Gallery card.
```

Key properties:

- **Step ordering is load-bearing.** The room must exist before the root claim
  (`submit-argument` needs a `debate_id`) and before the invite
  (`createRoomInvite` needs a `debateId`). The invite is **last** because it is
  the only non-essential step — a room with a root claim and no invite is a
  valid room; the creator can invite from inside later.
- **No step is silently swallowed.** Every failure path surfaces a
  plain-language message via `gameCopy.toPlainLanguage`. This honours the
  QOL-025 "no silent no-op" doctrine — every action either succeeds visibly or
  fails visibly.
- **`submit-argument` is the only `arguments` write.** GAME-003B never inserts
  into `public.arguments` directly. `buildRootClaimSubmission` produces the
  request body for the existing Edge Function (the root claim has no parent —
  it is the root; the Constitution engine treats a root claim as the only valid
  type with `parent_id = null`, exactly as `CreateDebateForm` + the first
  composer post do today).
- **`createDebate` is the only `debates` write.** It already auto-joins the
  creator as a participant (`debate_participants` row) — so by the time
  `selectDebate` opens the room, the creator is a primary participant and Stage
  6.4 seamless entry shows them the primary view, not observer.

### 5.4 `useArgumentSetup` — the hook surface

```ts
export interface UseArgumentSetupResult {
  draft: ArgumentSetupDraft;
  /** One typed setter per field; each is a pure draft update. */
  setTitle: (v: string) => void;
  setRootClaimBody: (v: string) => void;
  setVisibility: (v: ArgumentVisibility) => void;
  setInvitedRespondentEmail: (v: string) => void;
  setChimeInPolicy: (v: ChimeInPolicy) => void;
  setMode: (v: ArgumentMode) => void;
  setEvidenceExpected: (v: boolean) => void;
  toggleCategory: (c: RoomCategory) => void;   // add/remove, capped at MAX
  /** Live validation result — recomputed on every draft change. */
  validation: ArgumentSetupValidation;
  /** The three-step orchestration (§5.3). Returns the new debateId on a
   *  room-created success (even if a later step degraded), or null if the
   *  room itself could not be created. */
  startArgument: () => Promise<{ debateId: string; rootClaimPosted: boolean;
                                 inviteSent: boolean } | null>;
  /** True while startArgument is running. Disables the panel. */
  submitting: boolean;
  /** The current non-fatal stage notice, if any (§8). */
  stageNotice: string | null;
}
```

`validation` is `ArgumentSetupValidation`:

```ts
export interface ArgumentSetupValidation {
  /** True iff the draft can be submitted — i.e. rootClaimBody is non-empty. */
  canSubmit: boolean;
  /** Per-field issues, each a plain-language string. Empty when fine. */
  issues: {
    rootClaimBody?: string;   // 'Write your argument before you start.'
    title?: string;           // length > 120 → the validateDebateTitle error
    invitedRespondentEmail?: string;  // 'Enter a valid email address.'
    categories?: string;      // > 3 selected (UI prevents; defence in depth)
  };
}
```

`validateArgumentSetup(draft)` is the pure function behind it. **Only
`rootClaimBody` non-empty gates `canSubmit`** — every other issue is a soft
warning that does not block (an over-long title is clamped, not rejected; a
malformed invite email blocks *the invite step* but the design choice is: the
panel shows the email error inline and the user fixes it before "Start
argument", so a bad email never reaches step 3 — see §8 case 4).

---

## §6 — UI states

All copy lives in `ARGUMENT_SETUP_COPY` (`gameCopy.ts`); the strings below are
intent, finalized in the copy block. Normal-user copy: "argument" / "room",
never "game", never "debate", never "player".

| State | UI |
|---|---|
| **Empty (fresh panel)** | All fields at `DEFAULT_ARGUMENT_SETUP_DRAFT`. "Start argument" **disabled** (no root claim yet). The disabled button has an `accessibilityHint`: *"Write your argument first."* |
| **Root claim typed, rest default** | "Start argument" **enabled.** A one-paragraph room is fully valid — every other field is optional. |
| **Private selected** | The "If anyone can chime in" section (§5.1 step 5) is **hidden**. The visibility helper updates to the Private copy. |
| **Invite email being typed** | No error while focused + incomplete; on blur, if non-empty and malformed → inline *"Enter a valid email address."* A valid or empty address shows no error. |
| **Mode expanded** | A mode row's "the rules" detail expands to the `buildModeRuleRows` list — plain-language tone/evidence/pacing rows. Collapsible; only one expanded at a time is fine (not required). |
| **Submitting** | The whole panel is disabled; "Start argument" → spinner. No field is editable mid-submit. |
| **Created — full success** | The panel unmounts; `selectDebate` opens the new room with the root claim as Node 1; a brief neutral toast *"Your argument is live."* |
| **Created — root-claim post failed** (§8 case 1) | The room opens **empty**; a non-blocking in-room notice *"Your argument room is ready — post your first point to get started."*; the composer is pre-filled with the typed root-claim body. |
| **Created — invite failed** (§8 case 3) | The room opens normally with the root claim; a non-blocking notice *"The argument is ready, but we couldn't send the invite — you can invite them from inside."* |
| **Room creation failed** (§8 case 2) | The panel stays mounted, all fields intact; an inline `ErrorNotice` *"We couldn't start the argument. Check your connection and try again."* (routed through `gameCopy`, never a raw Postgres string). |
| **Not signed in** | The panel is unreachable — "Start an argument" is gated by the session like every authenticated surface; an unauthenticated tap routes to `AuthScreen` (existing behaviour, unchanged). |
| **Supabase not configured** (dev) | `createDebate` already returns `{ ok:false, error:'Supabase is not configured.' }`; the panel surfaces it via the room-creation-failed state. |

**Forbidden labels** (a `gameCopy` ban-list test asserts their absence in every
`ARGUMENT_SETUP_COPY` string): "Start a game", "Start a debate", "New Debate",
"Create Debate", "Debate mode", "Debate room", "Debate", "Game", "Player",
"challenger", "opponent", "winner", "loser".

**Accessibility (per `accessibility-targets`):** every control (visibility
segmented control, chime-in control, mode rows, category chips, the toggle) is a
≥44px target with an `accessibilityRole` and an `accessibilityState` reflecting
selection; selection is never color-only (weight + check mark / filled chip);
the panel is fully keyboard-traversable; reduce-motion suppresses the
mode-detail expand animation (instant show/hide).

---

## §7 — One-box integration (how the panel lives inside the QOL-030 `root_claim` box)

QOL-030's design (§5 F1, §6.2) establishes that the **`root_claim` box is the
only box that also configures the room** — "title, visibility, invite" are the
`root_claim` box's room-setup section. GAME-003B supplies exactly that section.

**The contract:**

- `ArgumentSetupPanel` is a **pure presentational + hook-driven component** that
  takes a `useArgumentSetup` result (or accepts it built internally for the §9
  standalone host). It does **not** import the one-box chassis — it has no
  dependency on `OneBox.tsx` / `boxModel.ts` / `Popout.tsx`.
- When QOL-030 lands, the `root_claim` box's renderer (`renderSchema('root_claim',
  'room')` — QOL-030 §6.5) renders **the root-claim body field itself** (the box
  already owns the body) and **embeds `ArgumentSetupPanel` minus its own body
  field** as the room-setup section. To make that clean, `ArgumentSetupPanel`
  accepts a prop `bodyFieldOwnedExternally?: boolean` — when `true` (the one-box
  case) the panel renders sections 2–9 only and reads the body from the hook;
  when `false` (the §9 standalone case) it renders section 1 (the body) too.
- The "Start argument" action: in the one-box world it is the `root_claim` box's
  post action; in the standalone world it is the panel's button. Both call the
  **same** `useArgumentSetup().startArgument`. The orchestration (§5.3) is
  identical.
- `visibility` as a one-box concern: QOL-030 §5 F7 + QOL-039 §6.2 also make
  `make private` a `room`-target *direct flash-menu entry* (the post-creation
  transition). GAME-003B owns only the **create-time** visibility choice in the
  setup section; the post-creation transition is QOL-039's. No overlap.

This is the same two-surface discipline QOL-039 §5/§9 used: GAME-003B ships the
**model + the panel component + the API wiring + the migration**; the one-box
*wiring* is a thin embed described here, and the §9 fallback host covers QOL-030
not having landed. The model and the `ArgumentSetupPanel` API do **not** change
between the two worlds — moving from the standalone host to the box is a
mechanical follow-up (delete `ArgumentSetupScreen`, render the panel with
`bodyFieldOwnedExternally`).

---

## §8 — Edge cases

| # | Case | Handling |
|---|---|---|
| 1 | **Room created, root-claim `submit-argument` fails** | The most important partial-failure case. The room exists (`createDebate` succeeded). `useArgumentSetup` does **not** roll back the room (no service-role, and a half-deleted room is worse than an empty one). It calls `selectDebate(debateId)` to open the new **empty** room and surfaces a non-blocking notice; the typed `rootClaimBody` is pre-filled into the room's composer so one tap completes it. `startArgument` returns `{ debateId, rootClaimPosted:false, inviteSent:false }`. No orphan, no dead end. |
| 2 | **`createDebate` itself fails** (no active constitution, network, RLS) | `createDebate` is atomic — the row is made or it isn't. The panel stays mounted, draft intact, an inline `ErrorNotice`. Nothing was created; the user retries. |
| 3 | **Room + root claim succeed, invite `createRoomInvite` fails** | The room is fully valid. The invite is best-effort (§5.3 step 3). The room opens with the root claim; a non-blocking notice tells the creator to invite from inside. `inviteSent:false`. |
| 4 | **Malformed invite email** | Caught by `validateArgumentSetup` → an inline field error before "Start argument". A bad address never reaches step 3. If the user clears the field, the invite step is simply skipped. |
| 5 | **Blank title** | Valid. `''` is written to `debates.title`; `pickDisplayTitle` derives the displayed title from the root-claim excerpt (§4.4). No error, no fallback write. |
| 6 | **Title over 120 chars** | `validateDebateTitle` clamps it (with an `…`); the panel shows a soft helper *"Titles are trimmed to 120 characters."* — not a blocking error. |
| 7 | **Root claim is only whitespace** | `rootClaimBody.trim().length === 0` → `canSubmit: false`; "Start argument" disabled. The button never posts an empty claim. |
| 8 | **Private room + chime-in policy** | The chime-in section is hidden when Private is selected; `buildCreateDebateInput` forces `chime_in_policy: 'allow'` (inert) for private rooms so the stored value is deterministic and a later switch to public has a sane default. |
| 9 | **`debates.visibility` column absent** (QOL-039 not deployed) | `createDebate` feature-detects the column (§4.6) and omits `visibility` from the insert when absent. The room is created (defaults to public-equivalent behaviour, exactly as QOL-039 §4.3 describes for its own absence). The panel still shows the visibility control — the choice is simply not yet persisted until QOL-039 lands. No crash. |
| 10 | **`debates.mode` / `chime_in_policy` / `categories` columns absent** (GAME-003B migration not deployed) | Same feature-detect: `createDebate` omits absent columns; `mapDebateRow` fills `mode ?? 'casual_disagreement'` etc. The panel works; the mode is just not persisted until the operator deploys. The design notes the operator deploy step (§16). |
| 11 | **A `design_only` mode reaches the draft** (e.g. a stale deep-link param) | The picker only ever offers `isShippedMode` modes, so a typed UI path can't. Defence in depth: `buildCreateDebateInput` runs `mode` through `coerceArgumentMode` and then asserts `isShippedMode` — a non-shipped value falls back to `DEFAULT_ARGUMENT_MODE`. The `CHECK` constraint is the final backstop. |
| 12 | **Double "Start argument" tap** | `submitting` disables the panel for the whole orchestration; a second tap is a no-op. No duplicate room. |
| 13 | **Category selection exceeds 3** | The chip row disables un-selected chips once 3 are picked; `validateArgumentSetup` also reports a `categories` issue as defence in depth; the `CHECK` constraint is the DB backstop. |
| 14 | **User cancels mid-draft** | "Cancel" discards the draft and returns to the gallery. Nothing was written (no room exists until step 1). A QOL-030 follow-up may add draft-park via `ComposerDraftRecoveryNotice`; v1 simply discards. |
| 15 | **Doctrine edge — does the mode block posting?** | No. The mode tunes helper copy and (forward-compat) pacing/review strength. It is **never** a gate on the setup panel or on `submit-argument`. The only hard gate is a non-empty root claim. Asserted by a named test. |
| 16 | **Doctrine edge — does evidence-expected gate anything?** | No. `evidenceExpected` is advisory copy only, not persisted, not a gate (§4.3.2). |
| 17 | **Concurrent create from two devices by the same user** | Each `createDebate` makes a distinct `debates` row — two rooms. This is benign (the user made two rooms); no uniqueness is violated. Not a v1 concern. |
| 18 | **Supabase email-confirmation pending creator** | The creator must be signed in to reach the panel (§6 "Not signed in"); `createDebate` uses their JWT. An unconfirmed-email account that somehow reaches the panel is gated by RLS at `createDebate` — surfaced as a room-creation failure. |

---

## §9 — Fallback if QOL-030 (one-box) has not landed

QOL-030 is the intended host but is **unbuilt at this worktree head** (§0 D1).
GAME-003B must not hard-block on it.

- **The host:** `ArgumentSetupScreen.tsx` — a thin `Screen` that renders
  `ArgumentSetupPanel` with `bodyFieldOwnedExternally={false}` (so the panel
  draws the root-claim body field itself) and wires `useArgumentSetup`. This
  screen replaces `CreateDebateForm` as the "Start an argument" destination.
- **The model, the panel, the hook, the API wiring, the migration are
  identical** in both worlds. Only the *host* differs: a `Screen` now, the
  `root_claim` box later.
- When QOL-030 lands, the follow-up is mechanical: render `ArgumentSetupPanel`
  with `bodyFieldOwnedExternally={true}` inside the box's `root_claim` renderer,
  and delete `ArgumentSetupScreen.tsx`. No model change, no `useArgumentSetup`
  change, no migration change. This is the same low-coupling outcome QOL-039 §9
  achieves.
- **`CreateDebateForm` is still retired in this card** regardless of QOL-030 —
  the replacement (`ArgumentSetupScreen`) exists, so leaving the
  doctrine-violating original would keep a terminology-audit failure alive (§3
  point 1, §13).

---

## §10 — Test plan

Per `test-discipline` — pure models get unit tests; UI gets state/render tests;
doctrine gets ban-list scans; the migration is verified by `db reset`.

**Pure-model tests — `__tests__/argumentSetupModel.test.ts`**

- `DEFAULT_ARGUMENT_SETUP_DRAFT` has the documented defaults; it is frozen.
- `validateArgumentSetup`: empty `rootClaimBody` → `canSubmit:false` with the
  `rootClaimBody` issue; a non-empty root claim with everything else default →
  `canSubmit:true`; an over-120-char title → a soft `title` issue but
  `canSubmit` stays `true` (title never blocks); a malformed invite email → an
  `invitedRespondentEmail` issue; > 3 categories → a `categories` issue.
- `buildCreateDebateInput`: maps the draft to `CreateDebateInput` — `title`
  passed through (blank stays blank), `resolution` omitted/empty, `visibility` /
  `mode` / `chimeInPolicy` / `categories` carried; a private room forces
  `chimeInPolicy:'allow'`; a `design_only` or junk `mode` is coerced to
  `DEFAULT_ARGUMENT_MODE`.
- `buildRootClaimSubmission`: produces a `submit-argument` request body with the
  trimmed root-claim body, the `debateId`, `parent_id` null (it is the root),
  and the root argument type.
- Title fallback: feeding `buildCreateDebateInput`'s output title +
  a root body to `pickDisplayTitle` yields the root excerpt when the title is
  blank and the explicit title otherwise — and `buildCreateDebateInput` never
  copies the body into the title (a structural assertion).

**Hook test — `__tests__/useArgumentSetup.test.ts`**

- `startArgument` happy path: `createDebate` → `submit-argument` →
  `createRoomInvite` all called in order with the right args; returns
  `{ debateId, rootClaimPosted:true, inviteSent:true }`.
- Step-2 failure: `createDebate` ok, `submit-argument` mocked to fail →
  `selectDebate` still called, `rootClaimPosted:false`, a stage notice set, no
  room rollback attempted.
- Step-1 failure: `createDebate` mocked to fail → `submit-argument` /
  `createRoomInvite` **not** called; returns `null`; the error surfaces.
- Step-3 failure: room + root claim ok, `createRoomInvite` fails →
  `inviteSent:false`, the room still opens.
- No invite email → step 3 skipped entirely.
- Double-submit guard: a second `startArgument` while `submitting` is a no-op.

**UI tests**

- `__tests__/ArgumentSetupPanel.test.tsx` — every §6 state renders; "Start
  argument" disabled until a root claim is typed; the chime-in section hides on
  Private; the invite-email inline error appears on blur with a bad address;
  `bodyFieldOwnedExternally` toggles the body field's presence; all controls
  expose `accessibilityRole` + `accessibilityState`.
- `__tests__/ModePickerRow.test.tsx` — exactly the 4 `MVP_ARGUMENT_MODES`
  render (no `design_only` mode appears); `DEFAULT_ARGUMENT_MODE` is selected by
  default; expanding a row shows the `buildModeRuleRows` rows; selection is a
  radiogroup.

**Doctrine — `__tests__/argumentSetupCopyDoctrine.test.ts`**

- Ban-list scan over every exported string in `ARGUMENT_SETUP_COPY` (and every
  label `argumentSetupModel` produces) for: *game, debate, New Debate, Create
  Debate, Debate mode, Debate room, player, challenger, opponent, winner, loser,
  true, false, correct, liar, dishonest, bad faith*. (`_forbiddenArgumentSetupTokens`
  is the shared list, mirroring `_forbiddenArgumentModeTokens`.)
- No raw internal code is user-facing: every code that can surface
  (`setup_room_created_post_failed`, `setup_invite_failed`, …) resolves through
  `gameCopy.toPlainLanguage` to a neutral string (the standard `gameCopy`
  regression test catches an unmapped code).
- A scan asserting `CreateDebateForm.tsx` no longer exists / is not imported
  (the retirement is verified, not assumed).

**Migration verification (operator / CI `db reset`)** — not a Jest test:

- `npx supabase db reset` applies `20260521000003` cleanly against the seed;
  `npx supabase db lint` passes.
- After reset, every seeded debate has `mode = 'casual_disagreement'`,
  `chime_in_policy = 'allow'`, `categories = '{}'` (the default backfill).
- An `INSERT` with `mode = 'court_record_strict'` succeeds; `mode = 'nonsense'`
  is rejected by the `CHECK`; a 4-element `categories` array is rejected.

**Source scan** — no service-role in `src/`; no direct `arguments` insert by
this card (the root claim goes via `submit-argument`); no AI / network / xAI /
Anthropic import in `argumentSetupModel.ts`; no `Date.now()` in the model.

---

## §11 — Permission / rules implications

| Concern | Rule |
|---|---|
| Who may start an argument | Any authenticated user. `createDebate` runs under the creator's JWT; the existing `debates` INSERT policy permits it. The creator is auto-joined as a participant by `createDebate`. |
| Visibility at creation | Any authenticated user may create a public **or** private room (`CreateDebateInput.visibility`). The *RLS* that makes a private room invisible to non-participants is QOL-039's; GAME-003B writes the column value QOL-039's RLS reads. |
| Who may post the root claim | The creator, via `submit-argument`. The Constitution engine treats a root claim (`parent_id = null`) as the only valid type at the root — unchanged by this card. |
| Constitution engine (`engine.ts`) | **Untouched.** The setup step configures a room; it is not an argument type, a transition, or a rule. The mode tunes *helper copy + advisory strength*, never the engine's transition table. |
| `submit-argument` Edge Function | **Untouched.** GAME-003B calls it with the same request shape the composer uses for a root post. Visibility / mode / category never gate the write path. |
| The invite | The invite is collected here but created by QOL-038's `createRoomInvite` (a `manage-room-invite` Edge Function call). GAME-003B never mints a token, never writes the invite table. |
| Mode immutability | The mode is set at creation and **not editable afterwards in v1** (Open Question OQ-1) — consistent with GAME-003's "immutable once a room is created". No change-mode UI, no `UPDATE` path. |
| Heat / popularity / standing | Never inputs to setup. Visibility, mode, and category are creator-chosen; none is ever auto-set by reply count, heat, or standing. |
| Moderator role | A moderator has no special setup power — anyone may start an argument. (Mod powers over an *existing* room are GAME-005 / admin cards, not GAME-003B.) |

---

## §12 — Dependencies

**Consumes (existing, unchanged):**

- `src/features/modes/argumentModeModel.ts` (GAME-003, **shipped**) —
  `ArgumentMode`, `MVP_ARGUMENT_MODES`, `DEFAULT_ARGUMENT_MODE`,
  `isShippedMode`, `coerceArgumentMode`, `argumentModeDisplayName`,
  `argumentModeDescription`, `buildModeRuleRows`. GAME-003B writes **no**
  mode-model code.
- `src/features/debates/debateTitleHelpers.ts` (Stage 6.1.8, **shipped**) —
  `pickDisplayTitle`, `validateDebateTitle`, `MAX_DEBATE_TITLE_CHARS`.
- `src/features/debates/debatesApi.ts` `createDebate` + `useDebates().create` —
  modified (§4.6) to carry the new columns; the room-creation call.
- `submit-argument` Edge Function via `src/lib/edgeFunctions.ts` — the
  root-claim write path (the same one `ArgumentComposerDock` uses).
- `src/features/arguments/gameCopy.ts` — `toPlainLanguage`, `ALL_COPY`; the new
  `ARGUMENT_SETUP_COPY` block is added beside the existing blocks.
- `selectDebate` (`useCurrentDebate.ts`) — opens the new room after creation.
- Stage 6.4 seamless entry — relied on, not modified: `createDebate` auto-joins
  the creator, so they enter the new room as a primary, not an observer.

**Soft dependencies (degrade cleanly — §8 cases 9, 10; §9):**

- **QOL-039** (room visibility column + RLS). GAME-003B feature-detects
  `debates.visibility`; if QOL-039 has not landed, the visibility control still
  renders but the value is not persisted until QOL-039's migration applies. The
  two migrations are independent and order-free.
- **QOL-038** (invite backend). GAME-003B's invite field calls
  `createRoomInvite`; if QOL-038 has not landed, the field is **hidden** (a
  capability check on the presence of the `invites` API export) — collecting an
  email we cannot send would be a silent no-op, which the QOL-025 doctrine
  forbids. So: invite field present iff `createRoomInvite` is available.
- **QOL-030** (one-box chassis). The intended host; §9 covers its absence with
  the thin `ArgumentSetupScreen`.

**Provides to:**

- **QOL-030** — `ArgumentSetupPanel` is the component QOL-030's `root_claim` box
  renders as its room-setup section (§7). QOL-030 consumes it; it is not a
  blocker for QOL-030's chassis work.
- **The Conversation Gallery (Epic 11)** — a newly-created room surfaces as
  exactly one gallery card via the existing `listDebates` → `conversationGalleryModel`
  path; GAME-003B's `categories` column is available for a future
  category-aware gallery section (not built here).
- **GAME-005** — the `chime_in_policy` column is the input GAME-005's
  `buildPublicRoomSeatMap` will read (forward-compat, a named GAME-005
  follow-up — §14).

**Assumes complete:** GAME-003 (mode model — shipped), Stage 6.1.8 (title
helpers — shipped), Stage 6.4 (seamless entry — shipped), the
`debates` / `debate_participants` schema + `submit-argument` (shipped).

---

## §13 — Supersedes / superseded-by

- **Supersedes the bespoke `CreateDebateForm.tsx`.** `ArgumentSetupPanel` +
  `ArgumentSetupScreen` are the doctrine-clean replacement. The stub said
  `CreateDebateForm` is "retired in P10 after GAME-003B is green" — but
  GAME-003B *is* the replacement; the retirement (file deletion + import
  repoint) happens **in this card** (§4.6), because shipping the replacement
  while leaving the `npm run ux:terminology:audit`-failing original alive would
  be incomplete.
- **Supersedes the "standalone `ModeSetupScreen`" half of GAME-003 part B.**
  GAME-003 named `ModeSetupScreen.tsx` / `ModeRulesColumn.tsx` / `useModeSetup.ts`
  as a follow-up. GAME-003B replaces that two-column compare screen with **one
  section of the unified `ArgumentSetupPanel`** (the `ModePickerRow`) — a single
  setup surface, not a separate mode screen. GAME-003's mode **model** is
  untouched and consumed as-is.
- **Not superseded by QOL-030.** QOL-030 builds the one-box *chassis*;
  GAME-003B builds the `root_claim` box's *room-setup content*. They are
  complementary — QOL-030 hosts `ArgumentSetupPanel`; GAME-003B does not
  re-create the chassis.
- **Internal table name unchanged.** `debates` stays `debates`. Only user-facing
  copy changes.

---

## §14 — Out of scope (explicit)

- **The invite backend, token, email, and auth deep link** — QOL-038. GAME-003B
  collects the email and calls `createRoomInvite`; it builds none of the invite
  machinery.
- **The `visibility` column, its RLS, and the public↔private transition** —
  QOL-039. GAME-003B writes the column value and renders the create-time
  control; it builds neither the RLS nor the `make private` transition.
- **Evidence upload, the evidence object, evidence-debt** — EV-001 / QOL-036 /
  EV-003. `evidenceExpected` is an advisory copy hint only.
- **The concession composer / acceptance gradient** — QOL-041.
- **Voting, promotion, scoring, winner/loser** — never; v1 doctrine.
- **The one-box chassis** (`OneBox`, `boxModel`, `Popout`) — QOL-030.
- **The `argumentMode` model** — GAME-003 (shipped); consumed read-only.
- **A change-mode-after-creation path** — the mode is fixed at creation in v1
  (Open Question OQ-1). A later card may add it.
- **Wiring `chime_in_policy` into GAME-005's `buildPublicRoomSeatMap`** — a
  named GAME-005 follow-up (§4.3.1). GAME-003B ships + writes the column;
  GAME-005 reading it is the follow-up.
- **Promoting a GAME-003 `design_only` mode to shipped** — each is a one-line
  `CHECK`-widening migration when that mode's design is finished.
- **A category-aware Conversation Gallery section** — the `categories` column is
  shipped for it, but the gallery grouping change is a later Epic 11 card.
- **Draft-park / recovery for the setup panel** — v1 discards on cancel; a
  QOL-030 follow-up may add `ComposerDraftRecoveryNotice` integration.
- **Search** (by category or otherwise) — v1 doctrine: no argument search.

---

## §15 — Doctrine & safety self-check

- **cdiscourse-doctrine — no truth labels.** The setup step configures a room;
  it labels nothing as true/false/correct, names no winner or loser. The mode,
  visibility, and category are structural room properties. Verified by the §10
  ban-list scan over `ARGUMENT_SETUP_COPY`.
- **cdiscourse-doctrine — score never blocks posting.** The only hard gate in
  the whole panel is a **non-empty root claim**. The mode never blocks; evidence
  expectation never blocks; validation issues other than an empty root claim are
  soft. The mode tunes helper copy / advisory strength, never the write path.
  Asserted by a named test (§8 case 15).
- **cdiscourse-doctrine — heat / popularity not inputs.** Visibility, mode, and
  category are creator-chosen at setup; none is ever auto-set by reply count,
  heat, or standing (§11).
- **cdiscourse-doctrine — no service-role in the client.** GAME-003B adds no
  Edge Function and no service-role usage. `createDebate` is an RLS-gated client
  insert under the creator's JWT (the existing path); the root claim goes
  through `submit-argument`; the invite goes through QOL-038's
  `manage-room-invite`. `grep -r "SERVICE_ROLE" src/` stays clean.
- **cdiscourse-doctrine — no direct `arguments` insert.** The root claim is
  posted **only** via `submit-argument`. `buildRootClaimSubmission` produces the
  Edge Function request body; GAME-003B never `INSERT`s into `public.arguments`.
- **supabase-edge-contract — migration discipline.** One new append-only
  migration; no applied file edited; every `ADD COLUMN` is `IF NOT EXISTS` with
  a safe default that backfills every existing row, so it is order-free vs
  QOL-038 / QOL-039 and re-runnable. No RLS change (the three new columns are
  descriptive and ride the existing `debates` policies).
- **supabase-edge-contract — RLS always on.** No policy is disabled or
  weakened. The new columns are covered by the existing `debates`
  SELECT/INSERT/UPDATE policies.
- **No AI calls.** No Anthropic / xAI / OpenAI / X API anywhere in this card.
  `argumentSetupModel.ts` is pure deterministic TS — no network, no AI, no
  `Date.now()` (timestamps are the DB's `default now()`). The production app
  makes no AI call; GAME-003B does not change that.
- **Terminology.** Every user-facing string says "argument" / "room"; never
  "game", "debate", "player", "Start a game", "Start a debate", "New Debate",
  "Create Debate". `CreateDebateForm` — the surviving source of those banned
  strings — is **deleted** in this card (§4.6, §13). `npm run ux:terminology:audit`
  (normal-user scope, per PR #195) must be clean after the change. The internal
  `debates` table name is untouched.
- **QOL-025 "no silent no-op".** Every "Start argument" outcome is visible: full
  success opens the room; a root-claim post failure opens the empty room with a
  recovery notice + pre-filled body; an invite failure opens the room with a
  notice; a room-creation failure keeps the panel with an inline error. No
  action silently does nothing. The invite field is **hidden** when
  `createRoomInvite` is unavailable, rather than collecting an email that would
  silently go nowhere.
- **v1 scope guards.** No voting, no scoring, no search, no push notifications,
  no OAuth, no public API, no real-time collaborative body editing. GAME-003B
  adds none of these.
- **Plain language.** Every internal code that can surface routes through
  `gameCopy.toPlainLanguage`; no raw code reaches the UI (§4.6, §10).

---

## §16 — Open questions (for the operator)

- **OQ-1 — Mode change after creation.** GAME-003B fixes the mode at room
  creation (consistent with GAME-003's "immutable once a room is created"). The
  storyboards never show a mode change. Confirm v1 has **no** change-mode path;
  if a later card wants one it is additive (a guarded single-column `UPDATE` +
  a panel control). Default: fixed at creation.
- **OQ-2 — Category vocabulary.** GAME-003B uses a new closed 8-value
  `RoomCategory` list (§4.5), **not** the per-argument `MessageCategory`
  qualifier vocabulary, because they describe different things. Confirm the
  8-value list (`household / money / relationship / work / plans / facts /
  opinion / other`) is the right starting set, or adjust it before
  implementation.
- **OQ-3 — Observer policy granularity.** GAME-003B makes observer *watching* of
  a public room always-on (a public room is public) and exposes only the
  **chime-in acceptance** choice (`chime_in_policy`). Confirm that observer
  read-access should never be a creation-time toggle — i.e. there is no "public
  but no observers" state. Default: public ⇒ observers may watch; the only
  choice is chime-ins.
- **OQ-4 — Persisting `evidenceExpected`.** v1 treats it as advisory copy only,
  not a stored column (§4.3.2). Confirm that is acceptable, or have a later
  evidence card (QOL-036 / EV-003) promote it to a real `debates` column with
  evidence-debt semantics.
- **OQ-5 — `resolution` field retirement.** GAME-003B makes
  `CreateDebateInput.resolution` optional and the panel does not collect a
  separate `resolution` (the one-box model makes the root claim the body). The
  `debates.resolution` column stays (it is `NOT NULL` in the initial schema —
  `createDebate` writes `''`). Confirm leaving the column in place with an empty
  default is fine, versus a later migration making it nullable. Default: keep
  the column, write `''`.

---

## §17 — Deploy steps (operator)

After the implementer commits (Claude does **not** deploy):

```bash
# Apply the debates.mode + chime_in_policy + categories columns.
npx supabase db push --linked

# Confirm the new columns + CHECK constraints lint clean.
npx supabase db lint
```

- **No Edge Function deploy.** GAME-003B adds no Edge Function. The root claim
  uses the already-deployed `submit-argument`; the invite uses QOL-038's
  `manage-room-invite` (deployed by QOL-038).
- **No new client env var.** No dependency install — `ArgumentSetupPanel` uses
  React Native primitives + existing shared components (`Screen`,
  `TextInputField`, `Button`, `ErrorNotice`) only.
- The migration is **order-free** vs QOL-038's and QOL-039's migrations (every
  `ADD COLUMN` is `IF NOT EXISTS`). If GAME-003B's migration is applied before
  QOL-039's, `debates.visibility` simply does not exist yet and `createDebate`
  feature-detects it (§4.6) — no error.
- Until this migration is applied, the setup panel works but the mode /
  chime-in-policy / categories choices are not persisted (§8 case 10) — a clean
  degraded state, not a failure.
