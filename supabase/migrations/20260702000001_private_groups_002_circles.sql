-- ============================================================
-- Migration: 20260702000001_private_groups_002_circles
-- Card: PRIVATE-GROUPS-002 (#859) — private circle schema + access controls.
-- Epic: PRODUCT-REDIRECT-001 (#826).
-- Canonical design: docs/designs/PRIVATE-GROUPS-001.md (#838, merged).
-- Implementation doc: docs/designs/PRIVATE-GROUPS-002-IMPLEMENTATION-2026-07-02.md
--
-- Creates the first net-new social-graph entity in CDiscourse: a CIRCLE —
-- a named, persistent group of N>=2 members, with the 1:1 pair as the
-- minimal circle (member_count = 2). Rooms scope to a circle via a single
-- nullable FK on public.debates. Every privileged write flows through a
-- service-role Edge Function (manage-circle / manage-circle-invite); there
-- is NO authenticated INSERT/UPDATE/DELETE policy on any new table. Reads
-- are membership-gated via SECURITY DEFINER helpers.
--
-- Sequential after 20260630000001_cov_004_argument_visibility_helper.sql —
-- highest sequential timestamp at build time (confirmed 2026-07-02).
--
-- ── Extension dependencies (OPS-001 §4 Class 4) ─────────────
--   - pgcrypto is required for gen_random_uuid() in every PK column
--     default. Supabase enables pgcrypto by default in the public schema;
--     the same gen_random_uuid() default is used by every prior migration
--     in this repo (argument_room_invites, concession_items, etc.). Per
--     OPS-001 §4 the dependency is DOCUMENTED here in the header rather
--     than asserted at apply time (no create-extension-if-not-exists) —
--     the argument_room_invites (QOL-038) / arg_room_002 precedent.
--
-- ── Doctrine encoded by this migration ──────────────────────
--   - A circle is an ACCESS + MEMORY boundary, never a verdict or a
--     ranking (cdiscourse-doctrine §1-§3). Nothing here labels a person
--     or claim. Circle name/description are user content (scanned in
--     rendered UI by the ban-list test, like a room title).
--   - RLS is ENABLED on every new table; nothing is disabled
--     (cdiscourse-doctrine §8 / supabase-edge-contract §5).
--   - NO authenticated write policy on any of the 3 new tables. Every
--     write goes through the manage-circle / manage-circle-invite Edge
--     Functions' service-role clients (mirrors argument_room_invites).
--     Re-asserted as a comment on each table so a future maintainer who
--     adds a write policy is forced to explain why the service-role gate
--     is no longer sufficient.
--   - Soft-delete / soft-remove only (is_deleted / is_removed). Rows are
--     never hard-deleted by the application.
--   - Recursion landmine respected: every cross-table read inside a policy
--     goes through a SECURITY DEFINER STABLE helper (the 20260516000006
--     pattern). No raw cross-table subquery in any policy. is_circle_member
--     reads circle_members + circles as definer so it can be used INSIDE
--     the circles / circle_members SELECT policies without recursion.
--   - Composition invariant (the load-bearing one): the canonical
--     is_argument_visible arms are preserved BY CALL inside
--     is_argument_visible_in_circle, never inlined-and-diverged; the
--     circle arm is a strict additive superset. Zero existing RLS arms
--     are loosened. The circleVisibilityCompositionRlsScan test is the
--     alarm bell — update is_argument_visible_in_circle in LOCKSTEP with
--     is_argument_visible.
--
-- ── OPS-001 four-class compliance ───────────────────────────
--   Class 1 (ambiguous column): every column reference inside a policy /
--     helper subquery is fully qualified (e.g. circle_members.circle_id,
--     circle_invites.invited_by) so an ambiguous-column failure (the
--     QOL-041 motivating class) cannot occur even if a future maintainer
--     adds a join.
--   Class 2 (type mismatch): all helper params + FKs are uuid / text /
--     timestamptz matching their target columns; create_circle re-uses
--     the circles / circle_members column types verbatim.
--   Class 3 (statement order): tables are created BEFORE the helpers that
--     read them, the helpers BEFORE the create_circle RPC and the SELECT
--     policies that call them. is_circle_deleted precedes is_circle_member
--     (which calls it); is_argument_visible_in_circle precedes nothing but
--     is created after the tables + is_circle_member it depends on.
--   Class 4 (function/extension deps): NO new extension. owner_id /
--     invited_by / circle_members.user_id reference auth.users; the
--     helpers read only public schema tables (search_path = public).
--     is_argument_visible / is_debate_inactive / is_moderator_or_admin are
--     reused from COV-004 (20260630000001) + prior migrations (already
--     applied).
--
-- ── NO-BACKFILL (hard) ──────────────────────────────────────
--   This migration is PURELY ADDITIVE: 3 new tables + one nullable column
--   (debates.circle_id, default NULL) + helpers + one RPC + SELECT
--   policies. ZERO existing rows are mutated. There is NO INSERT INTO
--   circles / circle_members / circle_invites and NO UPDATE public.debates
--   SET circle_id anywhere in this file. Existing private rooms were
--   created under argument_room_invites with NO consent to a persistent
--   group memory boundary; auto-converting them would be a consent
--   violation. Circles are a FORWARD primitive — users opt in by creating
--   them. Every existing debates row keeps circle_id = NULL (today's
--   behaviour, bit-for-bit). This is the safest possible rollout posture.
-- ============================================================

-- ============================================================
-- 1. public.circles — the group entity
-- ============================================================
create table if not exists public.circles (
  id                uuid        primary key default gen_random_uuid(),
  -- The owner. Hard FK to auth.users; on delete cascade deletes the WHOLE
  -- circles row (the circle itself) if the owner's auth row is deleted —
  -- acceptable for v1 because account deletion is not self-serve today.
  -- A PRIVATE-GROUPS follow-on must transfer-or-restrict before any
  -- self-serve account-deletion flow ships.
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  -- User-chosen name. Doctrine-neutral free text; the ban-list test scans
  -- it in rendered UI (a circle name is user content — treated like a room
  -- title, scanned in UI, never rejected at input for a verdict token).
  name              text        not null check (char_length(trim(name)) between 1 and 80),
  -- Optional short blurb. Same doctrine treatment as name.
  description       text        not null default '',
  -- Soft-delete only (never hard-deleted by the app). A deleted circle
  -- stops scoping new rooms and hides its content, but existing rooms +
  -- audit survive.
  is_deleted        boolean     not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.circles enable row level security;

comment on table public.circles is
  'PRIVATE-GROUPS-002 (#859): the circle entity — a named, persistent group of N>=2 members; the 1:1 pair is the minimal circle (member_count = 2). An access + memory boundary, never a verdict or ranking. RLS enabled with NO authenticated write policy — every write goes through the manage-circle Edge Function''s service-role client (create via the create_circle RPC; rename/soft-delete via authorized service-role UPDATE). Soft-delete only (is_deleted). Circle name/description are user content, scanned in rendered UI by the ban-list test.';
comment on column public.circles.owner_id is
  'PRIVATE-GROUPS-002: circle owner. Hard FK to auth.users; on delete cascade deletes the whole circle if the owner auth row is deleted (acceptable v1 — account deletion is not self-serve; a follow-on must transfer-or-restrict).';
comment on column public.circles.is_deleted is
  'PRIVATE-GROUPS-002: soft-delete flag. A deleted circle stops scoping new rooms and hides its content; existing rooms + audit survive. Never hard-deleted by the app.';

-- ============================================================
-- 2. public.circle_members — membership + role
-- ============================================================
create table if not exists public.circle_members (
  id            uuid        primary key default gen_random_uuid(),
  circle_id     uuid        not null references public.circles(id) on delete cascade,
  -- The member. FK to auth.users to mirror the invite / participant
  -- write-attribution FKs (argument_room_invites.invited_by,
  -- debate_participants.user_id).
  user_id       uuid        not null references auth.users(id) on delete cascade,
  -- MINIMAL role set: exactly two values. 'owner' can invite, rename,
  -- transfer, soft-delete the circle, and remove members; 'member' can
  -- read + participate. A richer role ladder is a v2 concern with no
  -- Wave-2 consumer.
  role          text        not null default 'member' check (role in ('owner','member')),
  -- Soft-remove: a removed member stops seeing new circle content. Never
  -- hard-deleted (audit). A re-add after removal reuses the row via status
  -- flip (mirrors the invite one-live partial-index idiom).
  is_removed    boolean     not null default false,
  removed_at    timestamptz,
  joined_at     timestamptz not null default now(),
  -- one membership row per (circle, user).
  unique (circle_id, user_id)
);

-- Exactly-one active owner per circle (partial unique). Ownership transfer
-- flips the old owner to 'member' and promotes the new owner in one tx
-- (the manage-circle transfer_ownership action) or the index will reject
-- an interleaving.
create unique index if not exists circle_members_one_owner
  on public.circle_members (circle_id)
  where role = 'owner' and is_removed = false;

create index if not exists circle_members_user
  on public.circle_members (user_id) where is_removed = false;
create index if not exists circle_members_circle
  on public.circle_members (circle_id) where is_removed = false;

alter table public.circle_members enable row level security;

comment on table public.circle_members is
  'PRIVATE-GROUPS-002 (#859): circle membership + role (owner / member). RLS enabled with NO authenticated write policy — enrollment (invite accept, owner add) and removal go through the manage-circle / manage-circle-invite service-role clients (the row may pre-date the invitee''s RLS match, and role changes are privileged — the same reason argument_room_invites / debate_participants private-join are service-role-only). Soft-remove only (is_removed). The circle_members_one_owner partial unique index enforces exactly one active owner.';
comment on column public.circle_members.role is
  'PRIVATE-GROUPS-002: minimal role set (owner / member). owner gates rename / transfer / soft-delete / member-removal / invite mint; member reads + participates.';
comment on column public.circle_members.is_removed is
  'PRIVATE-GROUPS-002: soft-remove flag. A removed member stops seeing new circle content; their past authored moves are governed by the argument soft-delete machinery, not circle removal. Never hard-deleted (audit).';

-- ============================================================
-- 3. public.circle_invites — clone of argument_room_invites, keyed to a circle
-- ============================================================
create table if not exists public.circle_invites (
  id                  uuid        primary key default gen_random_uuid(),
  circle_id           uuid        not null references public.circles(id) on delete cascade,
  -- The inviter. Hard FK to auth.users (write-attribution) — mirrors
  -- argument_room_invites.invited_by.
  invited_by          uuid        not null references auth.users(id) on delete cascade,
  -- Stored lower-cased + trimmed (the Edge Function normalises). Always
  -- present: invites are email-keyed.
  invitee_email_lower text        not null,
  -- Bound at accept time, never at create time. References profiles (not
  -- auth.users) to align with the invite substrate's profile-side FK.
  --
  -- INTENTIONAL two-FK-target pattern — do NOT "clean up" to one target:
  -- invitee_profile_id -> public.profiles is bind-at-accept identity
  -- (mirrors argument_room_invites), while invited_by + the
  -- membership/ownership FKs -> auth.users is write-attribution (mirrors
  -- debate_participants.user_id). The split matches the existing invite
  -- substrate; unifying the targets would break either pre-signup
  -- redemption or attribution semantics.
  invitee_profile_id  uuid        references public.profiles(id) on delete set null,
  status              text        not null default 'pending'
                        check (status in ('pending','accepted','revoked','expired')),
  -- sha-256 hex of the raw token. The raw token is NEVER stored — only
  -- e-mailed / returned to the inviter once at create time.
  token_hash          text        not null,
  created_at          timestamptz not null default now(),
  -- Default 14 days. The Edge Function sets this explicitly; the DB
  -- default is a fail-closed safety net so a programmer error cannot mint
  -- a never-expiring token.
  expires_at          timestamptz not null default (now() + interval '14 days'),
  accepted_at         timestamptz,
  revoked_at          timestamptz
);

-- One live (pending) invite per (circle, email). A revoked / expired /
-- accepted invite does NOT block re-inviting the same address. NOTE:
-- circle_invites deliberately has NO per-circle single-invite cap (unlike
-- argument_room_invites_one_live_per_room, which encodes the 1:1-room seat
-- matrix). A circle is a GROUP — multiple pending invites to different
-- people is the normal case. The per-address index below is the only
-- uniqueness rule.
create unique index if not exists circle_invites_one_live
  on public.circle_invites (circle_id, invitee_email_lower) where status = 'pending';

create index if not exists circle_invites_token_hash
  on public.circle_invites (token_hash);
create index if not exists circle_invites_circle
  on public.circle_invites (circle_id);

alter table public.circle_invites enable row level security;

comment on table public.circle_invites is
  'PRIVATE-GROUPS-002 (#859): invite-by-email rows for circles (clone of argument_room_invites keyed to a circle_id). Doctrine: the raw token is NEVER stored — only token_hash (sha-256 hex). RLS enabled with NO authenticated write policy — every write goes through the manage-circle-invite Edge Function''s service-role client. Soft state only — rows are never hard-deleted by the app; on delete cascade on circle_id covers the operator hard-delete-the-circle path. NO per-circle single-invite cap (a circle is a group); the per-address circle_invites_one_live index is the only uniqueness rule.';
comment on column public.circle_invites.token_hash is
  'sha-256 hex of the raw token. The raw token is NEVER stored — it appears only in the invite link and the lookup_by_token request body.';
comment on column public.circle_invites.invitee_profile_id is
  'PRIVATE-GROUPS-002: bind-at-accept identity. References public.profiles (not auth.users) — the INTENTIONAL two-FK-target pattern: profile-side for bind-at-accept, auth.users for invited_by / membership write-attribution. Do not unify the targets.';

-- ============================================================
-- 4. debates.circle_id — how a room becomes circle-scoped (nullable FK)
-- ============================================================
-- A room belongs to AT MOST ONE circle (single nullable FK, NOT a join
-- table — a join table would permit a room in two circles, a cross-circle
-- leak vector we forbid). on delete set null so soft/hard-deleting a circle
-- never destroys the room's arguments; the room simply becomes circle-less.
-- Additive, default NULL — every existing row keeps today's behaviour.
alter table public.debates
  add column if not exists circle_id uuid null references public.circles(id) on delete set null;

create index if not exists debates_circle_id
  on public.debates (circle_id) where circle_id is not null;

comment on column public.debates.circle_id is
  'PRIVATE-GROUPS-002 (#859): nullable FK to the circle a room is scoped to (at most one). NULL = today''s behaviour (a public-hall or standalone private room). on delete set null keeps the debates_circle_requires_private CHECK satisfied if the circle is removed. Additive, default NULL — every existing row is unchanged.';

-- ============================================================
-- 5. SECURITY DEFINER helpers (dependency order: is_circle_deleted first,
--    then is_circle_member which calls it, then is_circle_owner, then the
--    circle-scoped argument-visibility helper). All: LANGUAGE sql STABLE
--    SECURITY DEFINER SET search_path = public.
-- ============================================================

-- Soft-delete predicate (mirrors is_debate_inactive). Definer so it reads
-- circles without recursing through the circles SELECT policy. DEFINER-ONLY
-- (oracle avoidance): NOT granted to authenticated — it is only called
-- inside the other helpers.
create or replace function public.is_circle_deleted(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circles c
    where c.id = p_circle_id and c.is_deleted = true
  );
$$;

comment on function public.is_circle_deleted(uuid) is
  'PRIVATE-GROUPS-002: true iff the circle is soft-deleted. SECURITY DEFINER STABLE — reads circles without policy recursion (the 20260516000006 pattern). Definer-only: called ONLY inside the other circle helpers; NOT granted to authenticated (oracle avoidance).';

revoke all on function public.is_circle_deleted(uuid) from public;
-- Intentionally NOT granted to authenticated (definer-only oracle avoidance).

-- Membership predicate. The read spine for every downstream card.
create or replace function public.is_circle_member(
  p_circle_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id   = p_user_id
      and cm.is_removed = false
  ) and not public.is_circle_deleted(p_circle_id);
$$;

comment on function public.is_circle_member(uuid, uuid) is
  'PRIVATE-GROUPS-002: true iff p_user_id is a live (is_removed = false) member of a non-deleted circle. SECURITY DEFINER STABLE — reads circle_members + circles as definer so it can be used INSIDE the circles / circle_members SELECT policies without the circle->members->circle recursion. Fully-qualified columns (OPS-001 Class 1). The read spine for every downstream card.';

revoke all on function public.is_circle_member(uuid, uuid) from public;
grant execute on function public.is_circle_member(uuid, uuid) to authenticated;

-- Owner predicate. Gates rename / transfer / soft-delete / member-removal /
-- invite mint.
create or replace function public.is_circle_owner(
  p_circle_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id   = p_user_id
      and cm.role      = 'owner'
      and cm.is_removed = false
  );
$$;

comment on function public.is_circle_owner(uuid, uuid) is
  'PRIVATE-GROUPS-002: true iff p_user_id is the live owner of the circle. SECURITY DEFINER STABLE. Gates rename / transfer / soft-delete / member-removal / invite mint. Fully-qualified columns (OPS-001 Class 1).';

revoke all on function public.is_circle_owner(uuid, uuid) from public;
grant execute on function public.is_circle_owner(uuid, uuid) to authenticated;

-- The circle-scoped argument-visibility helper. Extends the COV-004
-- canonical arms with a circle-membership arm. The body MUST BEGIN with a
-- call to public.is_argument_visible (never inlines-and-diverges the
-- canonical arms). Update in LOCKSTEP with is_argument_visible — the
-- circleVisibilityCompositionRlsScan test is the alarm bell. This helper is
-- what downstream lore/callback SELECT policies call.
create or replace function public.is_argument_visible_in_circle(arg_id uuid, viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
        -- Defense-in-depth: the circle arm is self-enforcing on privacy.
        -- The debates_circle_requires_private CHECK already guarantees
        -- circle rooms are private at the DB level; this predicate makes
        -- the helper true-by-inspection even if that constraint were ever
        -- relaxed, and makes the composition invariant match the SQL.
        and d.visibility = 'private'
        and public.is_circle_member(d.circle_id, viewer_id)
    );
$$;

comment on function public.is_argument_visible_in_circle(uuid, uuid) is
  'PRIVATE-GROUPS-002: returns true iff viewer_id can see arg_id under the canonical arguments visibility (by CALLING is_argument_visible — never inlined) OR via the additive circle-member arm (posted, active arg in an active PRIVATE circle-scoped room where viewer is a live circle member). Strict additive superset of is_argument_visible — zero existing arms are loosened. Update in LOCKSTEP with is_argument_visible; the circleVisibilityCompositionRlsScan test is the alarm bell. Mirrors COV-004''s inactive predicates (does NOT use is_debate_open_or_locked_public).';

revoke all on function public.is_argument_visible_in_circle(uuid, uuid) from public;
grant execute on function public.is_argument_visible_in_circle(uuid, uuid) to authenticated;

-- ============================================================
-- 6. debates_circle_requires_private — DB-level guarantee that circle rooms
--    are ALWAYS private (Invariant 1). Same-row CHECK; validates trivially
--    on add (every existing row has circle_id NULL). Composes with the
--    QOL-039 one-way visibility trigger (private can never flip back to
--    public), so the invariant is durable over time. on delete set null on
--    circle_id keeps the CHECK satisfied (NULL passes) if the circle row is
--    removed.
-- ============================================================
alter table public.debates
  add constraint debates_circle_requires_private
  check (circle_id is null or visibility = 'private');

comment on constraint debates_circle_requires_private on public.debates is
  'PRIVATE-GROUPS-002 (#859): circle_id IS NOT NULL => visibility = ''private''. Makes circle rooms private at the DB level for ALL callers (service-role included). Composes with the QOL-039 one-way visibility trigger so the invariant is durable. The public arm (is_debate_open_or_locked_public) can therefore never fire for a circle room.';

-- ============================================================
-- 7. create_circle(...) RPC — atomic circle + owner membership row in one tx.
--    SECURITY DEFINER; granted to service_role ONLY (mirrors
--    create_argument_room).
-- ============================================================
create or replace function public.create_circle(
  p_owner_id uuid,
  p_name text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_circle_id uuid;
begin
  insert into public.circles (owner_id, name, description)
  values (p_owner_id, p_name, coalesce(p_description, ''))
  returning id into v_circle_id;

  -- The owner is enrolled as the circle's single active owner. The
  -- circle_members_one_owner partial unique index guarantees exactly one.
  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle_id, p_owner_id, 'owner');

  return v_circle_id;
end;
$$;

comment on function public.create_circle(uuid, text, text) is
  'PRIVATE-GROUPS-002 (#859): atomic circle creation — circles row + owner circle_members row in ONE transaction; returns the new circle id. SECURITY DEFINER; granted to service_role ONLY (the manage-circle Edge Function). NOT granted to authenticated — the client never writes circles directly (mirrors create_argument_room).';

revoke all on function public.create_circle(uuid, text, text) from public;
-- Granted to service_role ONLY (the Edge Function caller); never to authenticated.
grant execute on function public.create_circle(uuid, text, text) to service_role;

-- ============================================================
-- 8. SELECT policies (to authenticated; fully-qualified columns). ZERO
--    authenticated INSERT/UPDATE/DELETE on any of the 3 tables — all writes
--    flow through the service-role Edge Functions.
-- ============================================================

-- ── circles SELECT — members / owner / mod-admin only. A non-member
--    cannot read a circle's existence, name, or description. (Owner is
--    always a member, but the owner arm is spelled out per the QOL-039
--    precedent.)
drop policy if exists circles_select_member_owner_admin on public.circles;
create policy circles_select_member_owner_admin
  on public.circles
  for select
  to authenticated
  using (
    public.is_circle_member(circles.id, auth.uid())
    or public.is_circle_owner(circles.id, auth.uid())
    or public.is_moderator_or_admin()
  );

-- NO INSERT / UPDATE / DELETE policy for authenticated on public.circles.
-- The manage-circle service-role client is the ONLY writer (create via the
-- create_circle RPC; rename / soft-delete via authorized service-role
-- UPDATE). A future maintainer adding a write policy must justify why the
-- function's service-role gate is no longer sufficient.

-- ── circle_members SELECT — a member can see their co-members (required
--    for the circle roster). A non-member sees nothing.
drop policy if exists circle_members_select_member_admin on public.circle_members;
create policy circle_members_select_member_admin
  on public.circle_members
  for select
  to authenticated
  using (
    public.is_circle_member(circle_members.circle_id, auth.uid())
    or public.is_moderator_or_admin()
  );

-- NO INSERT / UPDATE / DELETE policy for authenticated on
-- public.circle_members. Enrollment (invite accept, owner add) and removal
-- go through the service-role Edge Functions — the row may pre-date the
-- invitee's RLS match and role changes are privileged.

-- ── circle_invites SELECT — four arms as separate policies (clone of the
--    argument_room_invites SELECT arms). Fully-qualified columns.
drop policy if exists circle_invites_select_inviter_own on public.circle_invites;
create policy circle_invites_select_inviter_own
  on public.circle_invites
  for select
  to authenticated
  using (circle_invites.invited_by = auth.uid());

drop policy if exists circle_invites_select_circle_owner on public.circle_invites;
create policy circle_invites_select_circle_owner
  on public.circle_invites
  for select
  to authenticated
  using (public.is_circle_owner(circle_invites.circle_id, auth.uid()));

drop policy if exists circle_invites_select_invitee_own on public.circle_invites;
create policy circle_invites_select_invitee_own
  on public.circle_invites
  for select
  to authenticated
  using (circle_invites.invitee_email_lower = lower(auth.jwt() ->> 'email'));

drop policy if exists circle_invites_select_mod_or_admin on public.circle_invites;
create policy circle_invites_select_mod_or_admin
  on public.circle_invites
  for select
  to authenticated
  using (public.is_moderator_or_admin());

-- NO INSERT / UPDATE / DELETE policy for authenticated on
-- public.circle_invites — the manage-circle-invite service-role client
-- mints / revokes / accepts. The anon role has no policy; the only
-- unauthenticated touch-point is the function's lookup_by_token action,
-- which itself runs through the function (not direct PostgREST).
