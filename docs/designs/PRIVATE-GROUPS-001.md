# PRIVATE-GROUPS-001 — Private circle memory model

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 (Recorded Wit, Private Memory, Single-Composer) — GitHub epic #826
**Release:** Wave 2 (Private memory primitives) — first net-new data model of the redirect
**Issue:** https://github.com/CivilDiscourse/cdiscourse/issues/838

> **This is a DESIGN-ONLY document.** It specifies a *future* migration-bearing card. No code, no
> migration file, no schema change, no Edge Function change ships with this doc. The implementation
> lands as a separate GATE-C (migration-bearing) card that consumes this spec. Every table, helper,
> policy, and RPC named below is a *proposal to be built later*, grounded in the substrate that
> already exists on `main` (baseline `2f3c75c`).

---

## Goal (one paragraph)

CDiscourse today has **no persistent social-graph entity**. Invites are ephemeral, email-keyed,
single-seat, and scoped to exactly one room (`argument_room_invites`, migration
`20260524000013`). Once an invite is accepted the relationship it created evaporates — there is no
re-invitable "these are my people" object. The PRODUCT-REDIRECT thesis (umbrella §1, §9) is that
**private, small, persistent circles are the soul of the product**: "a reusable audience + a durable
memory boundary." This card designs that entity — a **circle** — so that rooms, lore, callbacks, and
opt-in nudges can be scoped to a durable group instead of a throwaway per-room invite. The design is
constrained by doctrine at every turn: a circle is an *access + memory boundary*, never a verdict or a
ranking (cdiscourse-doctrine §1–§3); membership-gated reads must be **at least as private** as a
`visibility='private'` room today and may never loosen any existing `arguments`/`debates`/`debate_participants`
RLS arm (QOL-039 + COV-004); all new tables are RLS-enabled, soft-delete only, sequential-migration,
and every privileged write goes through a service-role Edge Function exactly where the invite pattern
already does (supabase-edge-contract §1–§7); and there is **no public leaderboard, no push
notification, no argument search** (v1 scope guards §10; "nudges" here are strictly in-app/opt-in).

---

## The load-bearing decision: circle-of-N, with the 1:1 pair as the minimal circle

### Why this card is the roadmap blocker

Per the umbrella dependency map (§13.394–395), `PRIVATE-GROUPS-001` (the group model) **blocks**
`QUOTE-FORGE-*`, `LORE-*`, `HIGHLIGHT-*`, `MEMORY-LANE-*`, `STYLE-*`, and (via audience inference)
`UX-COMPOSER-001`, plus its own siblings `PRIVATE-GROUPS-002/003`. Every one of those features is
"group-scoped" in the umbrella (§5A–§5H). None can define its scoping boundary until this entity
exists. It is the single net-new pillar of Wave 2; everything downstream reads *from* it.

### The open product question (must be resolved, not punted)

> Is the friend group (N members) the primary unit, or is the primary unit a 1:1 pair, with groups as
> containers of 1:1s?

The operator synthesis emphasizes **both** persistent friend groups *and* 1:1 PvP heavily. The two
readings pull in opposite directions, so the model must pick one and make the other a projection.

### Alternatives evaluated

| Option | Primary unit | 1:1 is… | Rooms scoped to | Verdict |
|---|---|---|---|---|
| **A. Circle-of-N (recommended)** | A `circle` with N≥2 members | The minimal circle (exactly 2 members) | A circle (FK on `debates`) | **CHOSEN** |
| B. Pair-primary | A `pair` (exactly 2 users) | The atomic unit | A pair; groups are bags of pairs | Rejected |
| C. Dual-entity | Both `circle` and `pair` as first-class tables | A `pair` row *and* a 2-member circle | Either — polymorphic scope | Rejected |

**Why B is rejected.** A pair-primary model forces every N-person group to be modeled as a set of
`C(N,2)` pairs. A 5-person friend group becomes 10 pair rows; a room shared by all 5 has no single
scope to attach to — it would need a many-to-many "room belongs to these 10 pairs" join, and lore
scoped to "the group" has nowhere to live. The invite substrate (`argument_room_invites`) is already
*room-scoped and email-keyed*; layering pairs on top of it re-creates the "single relationship
evaporates" problem the card exists to fix, just at pair granularity. Pair-primary optimizes for the
1:1 case at the cost of making the N-person case (the stated soul of the product) structurally
awkward.

**Why C is rejected.** Two first-class entities means two RLS surfaces, two membership tables, two
sets of helpers, and a polymorphic `scope_kind ∈ {circle, pair}` column on every downstream artifact.
Every dependent card (`QUOTE-FORGE`, `LORE`, `HIGHLIGHT`, `MEMORY-LANE`, `STYLE`) would branch on
scope kind. That is a large, permanent complexity tax paid to avoid a one-line observation: a pair
*is* a circle with two members.

**Why A is chosen.** A **circle** is a named, persistent group of N≥2 members. **The 1:1 pair is
simply the minimal circle — a circle whose `member_count = 2`.** Rooms are scoped to a circle by a
single nullable FK on `debates`. Pair-level features (e.g. a future "resonance" read) query the
*two-member projection*: a circle with exactly two members, or a deterministic two-member view over a
larger circle. This gives us:

- **One** RLS surface, **one** membership table, **one** helper family — the exact
  economy the QOL-039 / COV-004 helper pattern was designed for.
- The N-person "friend group" is first-class (the stated soul), and 1:1 PvP is a *constraint*
  (`member_count = 2`) rather than a separate schema — so 1:1 features are a WHERE clause, not a fork.
- The invite lifecycle we already trust (`argument_room_invites` token mint/hash/redeem) maps cleanly:
  a circle invite enrolls the redeemer into the circle instead of (or in addition to) a single room.

**Justification (two sentences).** The circle-of-N model makes the N-person friend group — the
operator-canonical soul of the redirect — a first-class entity with a single RLS/membership/helper
surface, while treating 1:1 PvP as the degenerate `member_count = 2` case rather than a second schema
that would double the RLS attack surface and force every downstream card to branch on scope kind.
This composes directly with the existing invite/visibility substrate because a circle is exactly "a
reusable audience + a durable memory boundary" layered over the room primitives we already ship.

---

## Data model

Naming follows the house style (`snake_case` tables, `is_*` SECURITY DEFINER helpers, soft-delete
column, `created_at`/`updated_at` timestamps, `gen_random_uuid()` PKs via pgcrypto — documented in the
migration header, not asserted at apply time, per the `argument_room_invites` precedent).

### `public.circles` — the group entity

```sql
create table public.circles (
  id                uuid        primary key default gen_random_uuid(),
  -- The owner. Hard FK to auth.users; a deleted owner cascades (ownership must
  -- always resolve). Ownership can be transferred by the owner (PRIVATE-GROUPS-002),
  -- never orphaned.
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  -- User-chosen name. Doctrine-neutral free text; the ban-list test scans it in
  -- rendered UI (a circle name is user content — treated like a room title).
  name              text        not null check (char_length(trim(name)) between 1 and 80),
  -- Optional short blurb. Same doctrine treatment as name.
  description       text        not null default '',
  -- Soft-delete only (never hard-deleted by the app). A deleted circle stops
  -- scoping new rooms and hides its lore, but existing rooms + audit survive.
  is_deleted        boolean     not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

### `public.circle_members` — membership + role

```sql
create table public.circle_members (
  id            uuid        primary key default gen_random_uuid(),
  circle_id     uuid        not null references public.circles(id) on delete cascade,
  -- The member. FK to auth.users to mirror the invite/participant write-attribution
  -- FKs (argument_room_invites.invited_by, debate_participants.user_id).
  user_id       uuid        not null references auth.users(id) on delete cascade,
  -- MINIMAL role set: exactly two values. 'owner' can invite, rename, transfer,
  -- soft-delete the circle, and remove members; 'member' can read + participate.
  -- Justification for keeping it to two: every downstream card needs only the
  -- membership boolean (is_circle_member) for reads and the owner boolean
  -- (is_circle_owner) for admin actions. A richer role ladder (moderator, etc.)
  -- is a v2 concern with no Wave-2 consumer — adding it now is speculative.
  role          text        not null default 'member' check (role in ('owner','member')),
  -- Soft-remove: a removed member stops seeing new circle content but their
  -- past authored moves + derived lore are handled by the artifact-level author
  -- removal rights (see "Privacy invariants"). Never hard-deleted (audit).
  is_removed    boolean     not null default false,
  removed_at    timestamptz,
  joined_at     timestamptz not null default now(),
  -- one live membership per (circle, user); a re-add after removal reuses the row
  -- via status flip (mirrors the invite one-live partial-index idiom).
  unique (circle_id, user_id)
);

-- Exactly-one active owner per circle (partial unique). Ownership transfer flips
-- the old owner to 'member' and promotes the new owner in one tx.
create unique index circle_members_one_owner
  on public.circle_members (circle_id)
  where role = 'owner' and is_removed = false;

create index circle_members_user on public.circle_members (user_id) where is_removed = false;
create index circle_members_circle on public.circle_members (circle_id) where is_removed = false;
```

### How a room becomes circle-scoped: a nullable FK on `debates` (decided — NOT a join table)

```sql
alter table public.debates
  add column circle_id uuid null references public.circles(id) on delete set null;

create index debates_circle_id on public.debates (circle_id) where circle_id is not null;
```

**Decision: single nullable FK, not a join table.** A room belongs to **at most one** circle (the
circle is the room's home). This is a 1-to-many (circle→rooms), not many-to-many, so a join table
would be strictly wrong shape and would permit a room in two circles — a cross-circle leak vector we
explicitly forbid. `on delete set null` (not cascade) so soft/hard-deleting a circle never destroys the
room's arguments; the room simply becomes circle-less (falls back to its existing public/private
visibility behavior). `circle_id IS NULL` = today's behavior exactly (a public-hall or standalone
private room) — the column is purely additive and every existing row keeps `NULL`.

### How invite redemption enrolls into a circle (reusing the QOL-038 token lifecycle)

A **circle invite** reuses the `argument_room_invites` token machinery *pattern* but targets a circle.
Two viable shapes; the design chooses shape (ii):

- **(i) Overload `argument_room_invites`** with a nullable `circle_id` — rejected: it muddies the
  per-room unique indexes (`argument_room_invites_one_live`,
  `argument_room_invites_one_live_per_room`) whose predicates assume a room, and the ARG-ROOM-002
  capacity trigger reads that table. Overloading risks the existing 1:1-room invariants.

- **(ii) A sibling table `public.circle_invites`** — **chosen.** Same columns and doctrine as
  `argument_room_invites` (email-keyed, `token_hash` only, `expires_at` mandatory with 14-day default,
  status `pending|accepted|revoked|expired`), but keyed to a `circle_id` instead of a `debate_id`. The
  redeem path enrolls the redeemer into `circle_members` (role `member`) via service role — mirroring
  `enrolAndFlipInvite` in `manage-room-invite`, which today inserts into `debate_participants`.

```sql
create table public.circle_invites (
  id                  uuid        primary key default gen_random_uuid(),
  circle_id           uuid        not null references public.circles(id) on delete cascade,
  invited_by          uuid        not null references auth.users(id) on delete cascade,
  invitee_email_lower text        not null,
  invitee_profile_id  uuid        references public.profiles(id) on delete set null,
  status              text        not null default 'pending'
                        check (status in ('pending','accepted','revoked','expired')),
  token_hash          text        not null,   -- sha-256 hex; raw token NEVER stored
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '14 days'),
  accepted_at         timestamptz,
  revoked_at          timestamptz
);

create unique index circle_invites_one_live
  on public.circle_invites (circle_id, invitee_email_lower) where status = 'pending';
create index circle_invites_token_hash on public.circle_invites (token_hash);
create index circle_invites_circle on public.circle_invites (circle_id);
```

Note: `circle_invites` deliberately has **no per-circle single-invite cap** (unlike
`argument_room_invites_one_live_per_room`, which encodes the 1:1-room seat matrix). A circle is a
*group* — multiple pending invites to different people is the normal case. The per-address
`circle_invites_one_live` index (one live invite per email per circle) is the only uniqueness rule.

### Relationship to room invites (composition, not replacement)

Circle invites and room invites coexist. A circle-scoped room still uses the existing room invite /
capacity machinery for *seating a specific room*; circle membership governs *who can see the circle's
home + lore + accumulated artifacts*. A future card (`PRIVATE-GROUPS-003`) may add "create a room
directly inside a circle" that auto-enrolls all circle members as participants, but that is
out-of-scope here (this card designs the entity + membership + scoping, not the room-creation UX).

---

## API / interface contracts

### SECURITY DEFINER helpers (proposed — mirror the QOL-039 / COV-004 pattern exactly)

All helpers: `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, `REVOKE ALL … FROM
PUBLIC`, `GRANT EXECUTE … TO authenticated` (except the definer-only oracle-avoidance cases, which
follow ARG-ROOM-002's "not granted to authenticated" discipline).

```sql
-- Membership predicate. The read spine for every downstream card.
create function public.is_circle_member(p_circle_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id   = p_user_id
      and cm.is_removed = false
  ) and not public.is_circle_deleted(p_circle_id);
$$;

-- Owner predicate. Gates rename / transfer / soft-delete / member-removal / invite mint.
create function public.is_circle_owner(p_circle_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id   = p_user_id
      and cm.role      = 'owner'
      and cm.is_removed = false
  );
$$;

-- Soft-delete predicate (mirrors is_debate_inactive). Definer so it reads circles
-- without recursing through the circles SELECT policy.
create function public.is_circle_deleted(p_circle_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circles c where c.id = p_circle_id and c.is_deleted = true
  );
$$;
```

> **Recursion discipline (the QOL-039 landmine):** `is_circle_member` reads `circle_members` and
> `circles` as definer, so it can be used *inside* the `circles` and `circle_members` SELECT policies
> without the circle→members→circle recursion the `is_debate_participant` helper was invented to break.
> Fully-qualify every column inside policy subqueries (OPS-001 §4 Class 1).

### The circle-scoped argument visibility helper (composes with COV-004 — see RLS section)

```sql
-- Extends the COV-004 canonical arms with a circle-membership arm. Update in
-- LOCKSTEP with is_argument_visible (the concessionAccessibilityRlsScan test is
-- the alarm bell). This helper is what downstream lore/callback SELECT policies call.
create function public.is_argument_visible_in_circle(arg_id uuid, viewer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_argument_visible(arg_id, viewer_id)  -- never loosens the canonical arms
    or exists (
      select 1 from public.arguments a
      join public.debates d on d.id = a.debate_id
      where a.id = arg_id
        and a.status = 'posted'
        and a.inactive_at is null
        and not public.is_debate_inactive(a.debate_id)
        and d.circle_id is not null
        and public.is_circle_member(d.circle_id, viewer_id)
    );
$$;
```

### Client wrappers (proposed — mirror `inviteApi.ts` / `useRoomInvites.ts`)

- `src/features/circles/circlesApi.ts` — `createCircle`, `renameCircle`, `softDeleteCircle`,
  `transferOwnership`, `removeMember` (all call a `manage-circle` Edge Function; **no** direct
  `circles`/`circle_members` writes from the client, mirroring the invite substrate's "no
  authenticated write policy" posture).
- `src/features/circles/circleInviteApi.ts` — `createCircleInvite`, `revokeCircleInvite`,
  `lookupCircleInviteByToken`, `acceptCircleInvite` — thin wrappers over a `manage-circle-invite`
  Edge Function (six-action shape cloned from `manage-room-invite`).
- `src/features/circles/useCircles.ts` — RLS-filtered list hook (mirrors `useRoomInvites`).
- `src/features/circles/circleModel.ts` — **pure-TS** derivations (member-count band, "minimal circle
  (pair)" detection `memberCount === 2`, display roll-up). No React/Supabase/network — testable like
  `inviteModel.ts` / `roomCapacityModel.ts`.

### Edge Function contracts (proposed — the standard shape from supabase-edge-contract)

- **`manage-circle`** — `verify_jwt = true`. Actions: `create` (mint circle + owner membership row in
  one service-role RPC), `rename`, `soft_delete`, `transfer_ownership`, `remove_member`,
  `list_mine`. Every mutating action first authorizes the caller via `is_circle_owner` (owner) or
  self (leave), then mutates via the narrowest client. Never returns another member's email/PII.
- **`manage-circle-invite`** — `verify_jwt = false` (so `lookup_by_token` runs pre-signup, exactly
  like `manage-room-invite`). Actions cloned verbatim in spirit: `create`, `revoke`,
  `list_for_circle`, `lookup_by_token`, `accept`, `provision_and_accept`. Email-binding is the
  security spine, enforced *before* provisioning. Raw token never stored/logged/echoed except the
  create-time response to the inviter. Enrollment target is `circle_members` (role `member`).
- **`create_circle(...)` RPC** — SECURITY DEFINER, granted to `service_role` ONLY (mirrors
  `create_argument_room`): inserts the `circles` row + the owner `circle_members` row atomically in
  one transaction.

---

## RLS design

Every table below is **RLS-enabled with no authenticated write policy** — all writes flow through the
service-role Edge Functions, mirroring `argument_room_invites` (migration `20260524000013`, §157–164)
and `room_visibility_changes`. Reads are membership-gated via the helpers.

### `public.circles` policies

- **SELECT** — `to authenticated using ( public.is_circle_member(id, auth.uid()) or
  public.is_circle_owner(id, auth.uid()) or public.is_moderator_or_admin() )`. A non-member cannot
  read a circle's existence, name, or description. (Owner is always a member, but the owner arm is
  spelled out for clarity per the QOL-039 precedent.)
- **NO** INSERT/UPDATE/DELETE for `authenticated` — the `manage-circle` service-role client is the
  only writer (create via `create_circle` RPC; rename/soft-delete via authorized service-role
  UPDATE). Comment re-asserts this so a future maintainer adding a write policy must justify it.

### `public.circle_members` policies

- **SELECT** — `using ( public.is_circle_member(circle_id, auth.uid()) or public.is_moderator_or_admin() )`.
  A member can see their co-members (required for the circle home roster). A non-member sees nothing.
  Fully-qualified `circle_members.circle_id` inside the helper call context.
- **NO** authenticated writes — enrollment (invite accept, owner add) and removal go through service
  role. This mirrors the exact reason `argument_room_invites` and `debate_participants` private-join
  are service-role-only: the row may pre-date the invitee's RLS match, and role changes are
  privileged.

### `public.circle_invites` policies (clone of `argument_room_invites` SELECT arms)

- **SELECT — inviter own:** `using ( circle_invites.invited_by = auth.uid() )`.
- **SELECT — circle owner:** `using ( public.is_circle_owner(circle_invites.circle_id, auth.uid()) )`.
- **SELECT — invitee own (verified email):** `using ( circle_invites.invitee_email_lower =
  lower(auth.jwt() ->> 'email') )`.
- **SELECT — mod/admin:** `using ( public.is_moderator_or_admin() )`.
- **NO** authenticated writes — the `manage-circle-invite` service-role client mints/revokes/accepts.

### How circle-scoping composes with QOL-039 room visibility WITHOUT weakening it

This is the load-bearing safety property. Three rules, stated as invariants:

1. **A circle room is at least as private as a private room today.** A room with `circle_id IS NOT
   NULL` must set `visibility = 'private'` at creation (enforced by the future room-creation path;
   asserted in the implementation card's RLS scan). A circle room is therefore *never* globally
   readable — the public arm (`is_debate_open_or_locked_public`) can never fire for it because
   `visibility = 'private'` makes that helper return false.

2. **Circle membership is an ADDITIVE read grant layered on top of the existing participant arm — it
   never replaces or loosens an arm.** The canonical `arguments` SELECT policy (COV-004,
   `is_argument_visible`) is **not edited**. The circle grant lives in the *sibling* helper
   `is_argument_visible_in_circle`, which is a strict superset: `is_argument_visible(...) OR
   (circle-member arm)`. Because the circle arm additionally requires `d.visibility` to already be
   private-and-scoped and the debate to be non-inactive and the argument posted, it can only *add*
   the circle's own members to the read audience of the circle's own private rooms — never expose a
   public-hall argument differently, never widen a non-circle room, never grant a non-member anything.

3. **No arm of the existing `arguments` / `debates` / `debate_participants` SELECT policies is
   loosened.** The implementation card MUST NOT touch the COV-004 `is_argument_visible` body or the
   QOL-039 `arguments`/`debates`/`debate_participants` SELECT policies. Downstream lore/callback
   tables get their circle read grant by calling `is_argument_visible_in_circle` in *their own* SELECT
   policies (the COV-004 pattern: derived tables delegate to a helper). The
   `concessionAccessibilityRlsScan` test is extended to also pin that `is_argument_visible_in_circle`
   begins with a call to `is_argument_visible` (proving the canonical arms are preserved, never
   inlined-and-diverged).

> **Explicit attestation:** the implementation card loosens **zero** arms of any existing
> `arguments`, `debates`, or `debate_participants` RLS policy. Circle reads are strictly additive via
> a new sibling helper and new tables' own policies.

---

## Integration map for the dependent cards

What each downstream card **consumes** from this model (the "unblocks" contract):

| Card | Consumes from PRIVATE-GROUPS-001 |
|---|---|
| **QUOTE-FORGE-001** (light up QOL-042 callbacks) | The callback picker scopes to *the circle's own prior rooms* — `debates.circle_id = <circle> AND is_circle_member(...)`. This is how "no argument search" (v1 §11) is satisfied: discovery is circle-scoped + structure-driven, never global free-text. QOL-042's three-state link access (`authorized`/`title_only`/`unavailable`) still governs the excerpt. |
| **LORE-001** (Private Lore Codex) | Lore entries are **circle-scoped**: a `lore_entries` table (net-new in LORE-001) carries `circle_id` + a `source_argument_id`, and its SELECT policy calls `is_argument_visible_in_circle(source_argument_id, auth.uid())`. `is_circle_member` gates the codex view. Author-of-source-move removal right (below) governs deletion. |
| **HIGHLIGHT-001** (reels) | Reel = an ordered selection of moves *within a circle*; participant/member visibility is the same `is_circle_member` + `is_argument_visible_in_circle` gate. Export consent is per-reel (PRIVACY-001), not granted by circle membership alone. |
| **MEMORY-LANE-001** (opt-in nudges) | Nudges are sourced **only** from the member's own accessible circles and never cross-circle. The nudge candidate query is `is_circle_member` ∧ `is_argument_visible_in_circle`. Opt-in consent (PRIVACY-001) is a separate gate; membership is necessary but not sufficient. **In-app only — no push notifications (v1 §10).** |
| **STYLE-001** (private style points) | Style celebrations are visible only to circle members (`is_circle_member`); **no public leaderboard, no cross-circle ranking** (umbrella §11 / doctrine §3). |
| **UX-COMPOSER-001** (audience inference) | When the composer opens inside a circle-scoped room, the inferred audience = the circle. The composer reads `debates.circle_id` + `is_circle_member` to know "who will see this," so it can default the room private and skip the visibility dialog (umbrella §6, §15 acceptance). |
| **PRIVATE-GROUPS-002** (circle management) | Consumes `is_circle_owner`, the `transfer_ownership` / `remove_member` / `soft_delete` Edge actions, and the `circle_members_one_owner` invariant. |
| **PRIVATE-GROUPS-003** (circle home / room-in-circle) | Consumes `debates.circle_id`, `is_circle_member`, and (optionally) a member-auto-enroll room-creation path. The circle home replaces the public gallery as the default surface (umbrella §9). |

---

## Privacy / consent invariants

- **Membership-gated reads.** No non-member can read a circle, its roster, its invites, or any
  circle-scoped argument. Enforced by `is_circle_member` in every SELECT policy.
- **No cross-circle leakage.** A room has at most one `circle_id` (single FK, not a join table). The
  circle read arm requires membership in *that specific* circle. There is no path by which membership
  in circle A grants any read on circle B's content.
- **Author-of-source-move removal rights over derived artifacts.** When a downstream artifact (lore
  entry, reel item, callback echo) is *derived from* a user's move, the author of that source move
  retains the right to remove the derived artifact. This card establishes the invariant; each
  downstream table (`lore_entries`, etc.) implements it via an UPDATE/soft-delete policy arm keyed to
  `source_argument.author_id = auth.uid()` (delegated through a definer helper). No derived artifact
  may outlive the author's revocation of its source.
- **Export opt-in.** Circle membership grants *in-app reads only*. Leaving the privacy boundary
  (HIGHLIGHT export, share) requires explicit per-artifact consent, owned by PRIVACY-001 — never
  implied by membership. Exports strip machine internals (no family/rawKey/verdict; doctrine §9,
  §10a).
- **No public leaderboard / no ranking / no popularity signal.** Style, lore, and callbacks are
  friend-visible and low-stakes. Heat/temperament ranking is explicitly removed from the circle home
  (umbrella §9.317) because it implies popularity-as-signal (doctrine §3).
- **Nudges are in-app + opt-in, default-off, per-type disable, never cross-circle, never from
  inaccessible rooms** (umbrella §12 memory-nudge-creepiness mitigation). **No push notifications**
  (v1 scope guard §10).
- **Soft-remove is not erasure.** A removed member stops seeing new circle content; their past
  authored moves are governed by the argument soft-delete/deletion-request machinery, not by circle
  removal. Circle removal never hard-deletes a user's content.

---

## Migration + rollout plan

### Future migration file(s) — content summary (NOT written here)

A single sequential migration, next number after the current head
(`20260630000001_cov_004_argument_visibility_helper.sql`) → **`20260701000001_private_groups_001_circles.sql`**
(the implementation card confirms the exact timestamp is the highest at that time). Statement order
(OPS-001 §4 Class 3 — helpers before policies that call them):

1. `create table public.circles` (+ indexes, RLS enable, comments).
2. `create table public.circle_members` (+ `circle_members_one_owner` partial unique, indexes, RLS enable).
3. `create table public.circle_invites` (+ per-address one-live index, token/circle indexes, RLS enable).
4. `alter table public.debates add column circle_id uuid null …` (+ partial index). **Additive,
   default NULL — every existing row keeps today's behavior.**
5. Helpers: `is_circle_deleted`, `is_circle_member`, `is_circle_owner`,
   `is_argument_visible_in_circle` (created after the tables they read, before the policies that call
   them). `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated` per helper.
6. `create_circle(...)` RPC (SECURITY DEFINER, granted to `service_role` only).
7. SELECT policies on `circles`, `circle_members`, `circle_invites` (no authenticated write policies).

A **second, thin migration** may register the `manage-circle` / `manage-circle-invite` Edge Functions
in `config.toml` (per the Supabase-integration auto-deploy note in operator memory — *unregistered
function dirs silently never deploy*). Config registration is a deploy-bearing concern flagged for the
operator.

### GATE-C review requirement

The implementation card is **migration-bearing** and therefore receives heightened verification
(CLAUDE.md § "Migration-bearing card verification"): the reviewer either runs `npx supabase db reset
--linked=false` (Docker available) or performs the heightened textual review against the four named
issue classes (ambiguous column / type mismatch / statement order / function-extension deps). This is
GATE-C per the pipeline governance contract.

### Backfill story (decided)

**Decision: NO automatic backfill of existing private 1:1 rooms into implicit two-member circles.**

Rationale:
- Existing private rooms were created under `argument_room_invites` (per-room, email-keyed) with **no
  consent to a persistent group memory boundary**. Auto-converting them into circles would
  retroactively create a durable social-graph object the participants never opted into — a consent
  violation (the exact "private lore consent" risk, umbrella §12).
- The circle is a *forward* primitive. Existing rooms keep `circle_id = NULL` (today's behavior,
  bit-for-bit). Users opt into circles going forward by creating them.
- A future opt-in "adopt this room into a circle" affordance (PRIVATE-GROUPS-003) can let a room
  creator *choose* to scope an existing room — with consent — but that is user-initiated, never a
  migration backfill.

The migration is therefore **purely additive**: new tables + one nullable column defaulting to NULL.
Zero existing rows are mutated. This is the safest possible rollout posture.

### Rollback posture

- The migration adds tables + one nullable column + helpers + RPC. Rolling back = a follow-up
  migration that `DROP`s the new objects and the `circle_id` column (never editing the applied file).
  Because `circle_id` defaults NULL and nothing else reads it until downstream cards ship, dropping it
  is non-destructive to existing room behavior.
- No existing policy/helper is edited, so rollback cannot re-open a private-room leak.
- Deploy is operator-run (`npx supabase db push --linked`); Claude does not deploy (see Operator steps).

---

## Test plan (for the implementation card)

Pure-model + source-scan + Edge tests, mirroring the repo's established patterns. Tests are part of
"done" (test-discipline).

- **`__tests__/circleModel.test.ts`** — pure-TS `circleModel`: minimal-circle (pair) detection
  (`memberCount === 2`), member-count bands, display roll-up; happy path + failure/empty-input cases
  for each public function (test-discipline: every public function has a test).
- **`__tests__/circleRlsScan.test.ts`** — source-scan of the migration (mirrors
  `concessionAccessibilityRlsScan.test.ts` / `debateInactiveCascadeRlsScan.test.ts`): asserts every
  new table has `enable row level security`, has **no** `for insert/update/delete … to authenticated`
  policy, and that each SELECT policy calls the expected membership helper. Pure `fs.readFileSync`, no
  Docker.
- **`__tests__/circleVisibilityCompositionRlsScan.test.ts`** — pins that
  `is_argument_visible_in_circle` **begins with a call to** `public.is_argument_visible(...)` (proving
  the COV-004 canonical arms are preserved, not inlined-and-diverged), and that the circle arm
  requires `visibility='private'`/`is_circle_member`. This is the alarm bell that the composition
  invariant (RLS §rule 2/3) is never weakened. Extend the COV-004 drift test to also fire if
  `is_argument_visible` changes without a coordinated edit to the circle helper.
- **`__tests__/circleInviteFlow.test.ts`** — invite lifecycle over a mocked service client (mirrors
  the invite-flow tests): mint → lookup_by_token (pre-signup) → email-binding-mismatch refusal →
  accept enrolls into `circle_members` → idempotent re-accept → expired/revoked refusals.
- **Doctrine ban-list assertions** — scan any rendered circle/lore-adjacent copy (circle name display,
  member roster, any celebration string introduced) for the banned truth/verdict tokens (doctrine §1)
  and confirm no raw internal codes leak (doctrine §9). Circle **name/description are user content**
  and are treated exactly like room titles for the ban-list purpose (scanned in rendered UI, not
  rejected at input).
- **Edge Function tests** — `manage-circle` and `manage-circle-invite`: happy path + auth-refused +
  invalid-input + email-binding-mismatch + not-owner-refused, per the supabase-edge-contract required
  coverage (happy / auth-refused / invalid-input).

---

## Dependencies (cards / docs / files)

- **Reads / reuses the invite substrate:** `manage-room-invite/index.ts` (`enrolAndFlipInvite`,
  `handleLookupByToken`, `handleAccept`, `handleProvisionAndAccept`, token mint/hash via
  `_shared/inviteToken.ts`), `create-argument-room/index.ts` + the `create_argument_room` RPC pattern
  (`20260613000001`), `argument_room_invites` table + RLS (`20260524000013`), and the invites feature
  dir (`inviteDeepLink.ts`, `useRoomInvites.ts`, `inviteApi.ts`, `InviteRedeemGate.tsx`,
  `InviteCredentialStep.tsx`) — all cloned in *spirit* for the circle variant.
- **Composes with the visibility substrate:** QOL-039 (`20260524000015`) `is_debate_private` /
  `is_debate_open_or_locked_public` / `is_debate_participant`, and the one-way private trigger.
- **Composes with the canonical arg-visibility helper:** COV-004 (`20260630000001`)
  `is_argument_visible` + the `concessionAccessibilityRlsScan` drift test.
- **Recursion helpers reused:** `is_debate_participant`, `is_debate_joinable`,
  `is_debate_open_or_locked` (`20260516000006`).
- **Blocks (this card must land first):** `QUOTE-FORGE-*`, `LORE-*`, `HIGHLIGHT-*`, `MEMORY-LANE-*`,
  `STYLE-*`, `PRIVATE-GROUPS-002/003`, and `UX-COMPOSER-001`'s audience inference (umbrella
  §13.394–395).
- **Sibling consent card:** `PRIVACY-001` owns export/share consent; this card owns membership +
  scoping + author-removal invariant, and defers export consent to PRIVACY-001.

---

## Risks

- **The composition invariant is the whole game.** If a future implementer inlines the COV-004 arms
  into `is_argument_visible_in_circle` and then edits one copy, the two diverge silently and a private
  room could leak. **Mitigation:** the sibling helper *calls* `is_argument_visible` (never re-inlines
  it), and `circleVisibilityCompositionRlsScan` pins that call. Reviewer verifies at GATE-C.
- **Recursion landmine.** `circles` ↔ `circle_members` policies could recurse the same way
  `debates` ↔ `debate_participants` did. **Mitigation:** every cross-table read inside a policy goes
  through a SECURITY DEFINER helper (the `20260516000006` pattern); no raw cross-table subquery in any
  policy.
- **`circle_members_one_owner` partial index under ownership transfer.** Transferring ownership must
  demote-then-promote in **one transaction** or the partial unique index will reject an interleaving.
  **Mitigation:** a `transfer_ownership` service-role RPC does both flips atomically (mirrors
  `create_argument_room`'s in-tx creator+invite ordering).
- **Overloading vs sibling invite table.** Choosing `circle_invites` (not overloading
  `argument_room_invites`) avoids perturbing the ARG-ROOM-002 capacity trigger + per-room unique
  indexes, at the cost of a near-duplicate table. Accepted: the 1:1-room seat matrix invariants are
  worth more than DRY.
- **Config-toml registration.** The two new Edge Functions must be registered in `config.toml` or the
  Supabase GitHub integration silently never deploys them (operator memory:
  `supabase-merge-autodeploy`). Flagged as an operator deploy step.
- **Existing bot-fixture scripts.** ARG-ROOM-002 already noted that authenticated `debates` inserts in
  `scripts/bot-fixtures/` are refused post-deploy. Circle-scoped rooms have the same constraint;
  fixtures that need circles must go through the Edge path. Out of scope for this card; noted for the
  implementer.

---

## Out of scope (explicit — reduces scope creep)

- **No room-creation-inside-a-circle UX.** This card designs the entity, membership, invite, and
  scoping FK. The "start a room already scoped to this circle + auto-enroll members" flow is
  `PRIVATE-GROUPS-003`.
- **No circle home screen / gallery demotion.** UI surfaces are `PRIVATE-GROUPS-003` + the SUNSET
  cards.
- **No lore / callback / reel / style / memory-lane tables.** Each downstream card defines its own
  artifact table scoped by `circle_id` + the helpers here.
- **No export / share consent model.** Owned by `PRIVACY-001`.
- **No backfill of existing rooms** (decided above — forward-only, consent-preserving).
- **No richer role ladder** beyond owner/member (v2; no Wave-2 consumer).
- **No push notifications, no argument search, no voting/ranking** (v1 scope guards §10 — restated
  because circles are the surface most tempting to bolt these onto).
- **No AI calls.** Nothing here invokes Anthropic/xAI/X. Circle membership is deterministic SQL; any
  future "suggested lore candidate" detection reuses already-produced observations, in an Edge
  Function, never the client (doctrine §7).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** circles are an access/memory boundary; nothing in the
  model labels a person/claim as winner/loser/true/false. Circle name/description are user content,
  scanned by the ban-list test in rendered UI. ✅
- **§2 (heat = activity):** heat/temperament ranking is *removed* from the circle home; membership is
  not a signal of correctness or popularity. ✅
- **§3 (popularity ≠ evidence):** no leaderboard, no ranking, no engagement-as-signal anywhere in the
  circle model. ✅
- **§4 (AI moderator limits):** no AI in this model; membership is deterministic SQL. ✅
- **§5 (engine sacred):** the Constitution engine is untouched. ✅
- **§6 (secrets):** no secrets printed; `token_hash` (sha-256) only, raw token never stored — mirrors
  `argument_room_invites`. Service-role only inside Edge Functions. ✅
- **§7 (no AI from production app):** none. ✅
- **§8 (Supabase conventions):** RLS enabled on every new table; no authenticated write policies (all
  writes via service-role Edge Functions); soft-delete only (`is_deleted`/`is_removed`, never hard
  delete); sequential append-only migration; helpers `REVOKE ALL FROM PUBLIC` + grant to
  `authenticated`; RPC granted to `service_role` only. ✅
- **§9 (plain language):** no internal codes surfaced; exports strip machine internals. ✅
- **§10 (v1 scope guards):** no voting/winner, no OAuth-new, no public API, **no push notifications**
  (nudges are in-app/opt-in), **no argument search** (callback/lore discovery is circle-scoped +
  structure-driven, never global free-text). ✅
- **supabase-edge-contract:** no service-role in client; no direct `arguments` insert; RLS always on;
  migrations append-only; soft-delete only; standard Edge Function shape (CORS → auth → validate →
  authorize → narrowest-client mutate → audit → JSON, no secrets echoed). ✅
- **COV-004 composition (the load-bearing one):** the canonical `is_argument_visible` arms are
  **preserved by call, never inlined-and-diverged**; the circle grant is a strict additive superset in
  a sibling helper; **zero existing RLS arms are loosened**; the drift test extends to the circle
  helper. ✅

---

## Operator steps (when the implementation card commits)

The implementation card is migration-bearing + adds Edge Functions. After the implementer commits (and
the PR merges), the operator runs:

- `npx supabase db push --linked` — applies `20260701000001_private_groups_001_circles.sql` (the exact
  filename is confirmed by the implementer as the highest sequential timestamp at build time).
- Register `manage-circle` and `manage-circle-invite` in `supabase/config.toml` **before** relying on
  auto-deploy (unregistered function dirs silently never deploy — operator memory
  `supabase-merge-autodeploy`), then `npx supabase functions deploy manage-circle --linked` and
  `npx supabase functions deploy manage-circle-invite --linked` (or let the merge-to-main Supabase
  integration redeploy the *registered* functions).
- No env var, no secret rotation, no provider spend required.

**For THIS design-only card: None — pure documentation change. No migration, no DDL/DML, no Edge
deploy, no provider spend.**
