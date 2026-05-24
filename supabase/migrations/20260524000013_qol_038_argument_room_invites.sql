-- ============================================================
-- Migration: 20260524000013_qol_038_argument_room_invites
-- Description: QOL-038 — argument_room_invites table + RLS for the
--   invite-by-email lifecycle. The five Edge Function actions (create /
--   revoke / list_for_debate / lookup_by_token / accept) are owned by
--   the `manage-room-invite` Edge Function; this migration only creates
--   the persisted shape + RLS.
--
-- Sequential after `20260522000012_qol_041_concession_acceptance.sql`.
--
-- Extension dependencies:
--   - `pgcrypto` is required for `gen_random_uuid()` in the column
--     default. Supabase enables pgcrypto by default in the public
--     schema; verified for this project at 2026-05-24. The same
--     `gen_random_uuid()` default is used by every prior migration in
--     this repo (concession_items, point_tags, etc.). Per OPS-001 §4
--     "function/trigger/extension dependencies", the dependency is
--     documented here in the header rather than asserted at apply
--     time — re-create-extension-if-not-exists is intentionally avoided
--     to keep this migration's footprint to just the new objects.
--
-- Doctrine encoded by this migration:
--   - RLS enabled. No INSERT / UPDATE / DELETE policy for the
--     `authenticated` role. Every write goes through the
--     `manage-room-invite` Edge Function's service-role client. This
--     mirrors the `annotate-evidence` and `request-argument-deletion`
--     precedents — the create path mints a token (privileged), and the
--     accept path enrols an invitee via service role because the row
--     pre-dates the invitee's account.
--   - `intended_seat` is doctrine-neutral (`respondent` / `co_primary`)
--     — public side words like "challenger" / "supporter" are removed
--     per QOL-038 §4.1.
--   - `invitee_email_lower` is NOT NULL. Invites are email-keyed only;
--     QOL-038 deliberately adds no user-search surface.
--   - `expires_at` is NOT NULL with a 14-day default — a never-expiring
--     token would be a standing credential and is forbidden.
--   - The raw token is NEVER stored — only `token_hash` (sha-256 hex).
--   - Rows are NEVER hard-deleted from this table (no DELETE policy).
--     A revoked or expired invite stays for audit; the partial unique
--     index on (debate_id, invitee_email_lower) WHERE status='pending'
--     intentionally permits a re-invite to the same address after the
--     prior invite has been revoked / accepted / expired.
--
-- Companion design: docs/designs/QOL-038.md §4 + §5.
-- OPS-001 cascade-test review: every column reference inside a WITH
-- CHECK / USING subquery uses a fully-qualified name
-- (e.g. `argument_room_invites.debate_id`) to forbid the ambiguous-
-- column class (the QOL-041 motivating bug).
-- ============================================================

create table if not exists public.argument_room_invites (
  id                  uuid        primary key default gen_random_uuid(),
  -- Hard FK to the room being joined. ON DELETE CASCADE — if an admin
  -- hard-deletes the room the invite row must follow it. The realistic
  -- "room is no longer available" path is the `debates.status =
  -- 'archived'` soft-delete (QOL-038 design §17), and the Edge Function
  -- handles that branch explicitly without removing the invite row.
  debate_id           uuid        not null references public.debates(id) on delete cascade,
  -- The inviter. Hard FK to auth.users — if the inviter account is
  -- deleted the invite must also be invalidated (cascade prevents
  -- orphaned write-attribution).
  invited_by          uuid        not null references auth.users(id) on delete cascade,
  -- Stored lower-cased + trimmed (Edge Function normalises). Always
  -- present: invites are email-keyed.
  invitee_email_lower text        not null,
  -- Bound at accept time, never at create time. The invitee may have no
  -- account when the invite is minted. References profiles (not
  -- auth.users) to align with the rest of the schema's
  -- profile-side foreign keys.
  invitee_profile_id  uuid        references public.profiles(id) on delete set null,
  -- The seat the invitee takes on accept. 'respondent' = the opposing
  -- primary seat (the storyboard's "named respondent"). NOT a public
  -- side word.
  intended_seat       text        not null default 'respondent'
                        check (intended_seat in ('respondent','co_primary')),
  status              text        not null default 'pending'
                        check (status in ('pending','accepted','revoked','expired')),
  -- SHA-256 hex of the raw token. The raw token is NEVER stored — only
  -- e-mailed (or returned to the inviter once at create time).
  token_hash          text        not null,
  created_at          timestamptz not null default now(),
  -- Default 14 days. The Edge Function sets this explicitly; the DB
  -- default is a fail-closed safety net so a programmer error cannot
  -- mint a never-expiring token.
  expires_at          timestamptz not null default (now() + interval '14 days'),
  accepted_at         timestamptz,
  revoked_at          timestamptz
);

-- One live (pending) invite per (debate, email). A revoked / expired /
-- accepted invite does NOT block re-inviting the same address — the
-- partial predicate makes the constraint scope just the live state.
create unique index if not exists argument_room_invites_one_live
  on public.argument_room_invites (debate_id, invitee_email_lower)
  where status = 'pending';

create index if not exists argument_room_invites_token_hash
  on public.argument_room_invites (token_hash);
create index if not exists argument_room_invites_invitee_email
  on public.argument_room_invites (invitee_email_lower);
create index if not exists argument_room_invites_debate
  on public.argument_room_invites (debate_id);

alter table public.argument_room_invites enable row level security;

-- ── SELECT — inviter sees their own row. ──
-- Fully-qualified column reference per OPS-001 §4 (ambiguous-column
-- class). The subquery context is the policy target table itself; the
-- qualification is defensive against a future migration that joins
-- another table whose alias might shadow the bare name.
drop policy if exists ari_select_inviter_own on public.argument_room_invites;
create policy ari_select_inviter_own
  on public.argument_room_invites
  for select
  to authenticated
  using (argument_room_invites.invited_by = auth.uid());

-- ── SELECT — room creator sees every invite on a room they created.
-- Fully-qualified `argument_room_invites.debate_id` inside the exists
-- subquery (this is the exact pattern QOL-041.2 fixed in-place for the
-- INSERT WITH CHECK subqueries; the same discipline applies to SELECT
-- USING).
drop policy if exists ari_select_room_creator on public.argument_room_invites;
create policy ari_select_room_creator
  on public.argument_room_invites
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.debates d
      where d.id = argument_room_invites.debate_id
        and d.created_by = auth.uid()
    )
  );

-- ── SELECT — invitee sees invites addressed to their own confirmed
-- email. auth.jwt() ->> 'email' is the caller's verified email claim;
-- only the addressee may read their own pending invite.
drop policy if exists ari_select_invitee_own on public.argument_room_invites;
create policy ari_select_invitee_own
  on public.argument_room_invites
  for select
  to authenticated
  using (
    argument_room_invites.invitee_email_lower = lower(auth.jwt() ->> 'email')
  );

-- ── SELECT — mods / admins can read everything (support + abuse review).
drop policy if exists ari_select_mod_or_admin on public.argument_room_invites;
create policy ari_select_mod_or_admin
  on public.argument_room_invites
  for select
  to authenticated
  using (public.is_moderator_or_admin());

-- ── NO INSERT / UPDATE / DELETE policy for the authenticated role.
-- Every write goes through the manage-room-invite Edge Function's
-- service-role client. Re-asserted here as a code comment so a future
-- maintainer who adds a write-side policy is forced to explain why the
-- function's service-role gate is no longer sufficient. The anon role
-- has no policy at all — the only unauthenticated touch-point is the
-- function's lookup_by_token action, which itself runs through the
-- function (not direct PostgREST).

comment on table public.argument_room_invites is
  'QOL-038: invite-by-email rows for argument rooms. Doctrine: the raw token is NEVER stored — only token_hash (sha-256 hex). RLS enabled with no authenticated write policies — every write goes through the manage-room-invite Edge Function''s service-role client (mirrors annotate-evidence). Soft state only — rows are never hard-deleted by the application; ON DELETE CASCADE on debate_id covers the operator hard-delete-the-room path. intended_seat is doctrine-neutral (respondent / co_primary), never a public side word.';

comment on column public.argument_room_invites.token_hash is
  'sha-256 hex of the raw token. The raw token is NEVER stored — it appears only in the invite email link and the lookup_by_token request body.';

comment on column public.argument_room_invites.intended_seat is
  'The seat the invitee takes on accept. ''respondent'' = the opposing primary seat (Stage 6.4 ordering: enrolling them before the room opens makes seamless entry show them as a primary, not an observer).';

comment on column public.argument_room_invites.expires_at is
  'Default + 14 days. A never-expiring invite would be a standing credential and is forbidden. The Edge Function sets this explicitly; the DB default is a fail-closed safety net.';
