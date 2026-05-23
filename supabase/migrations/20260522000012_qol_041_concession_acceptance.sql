-- ── QOL-041.2 RECOVERY — IN-PLACE EDIT (2026-05-23) ─────────────────
--
-- This migration was edited in place on 2026-05-23 per issue #258
-- (QOL-041.2). The original version (merged via PR #255, commit
-- a41dd3c) contained 5 unqualified `debate_id` references in INSERT-
-- policy WITH-CHECK subqueries that caused SQLSTATE 42702 on every
-- deploy attempt.
--
-- The QOL-041.1 fix-forward attempt (PR #257, commit df0a61d) added a
-- subsequent migration to recreate the broken policies with qualified
-- references. That approach failed empirically: Postgres applies
-- migrations in order, so the broken original always failed before
-- the fix-forward could run. The fix-forward migration
-- (20260523000001_qol_041_1_fix_concession_acceptances_policies.sql)
-- is REMOVED in this recovery PR.
--
-- DOCTRINE EXCEPTION: CLAUDE.md §8 normally forbids editing migration
-- files after they have been APPLIED. The exception is justified here
-- by the factual condition that this migration has NEVER been applied
-- to any database (verified via `npx supabase migration list --linked`
-- on 2026-05-23T22:54Z — Remote column empty for 20260522000012). No
-- environment divergence exists. The exception is one-time and
-- scoped narrowly to this recovery; future migration-bearing cards
-- continue to follow the standard never-edit-applied doctrine.
--
-- The schema state produced by this migration is unchanged from what
-- the original QOL-041 design intended. Only the SQL ambiguity is
-- resolved.
-- ─────────────────────────────────────────────────────────────────────

-- ============================================================
-- Migration: 20260522000012_qol_041_concession_acceptance
-- Description: QOL-041 — Concession list, per-concession acceptance
--   gradient, and the no-score fist-bump reaction.
--
--   This migration creates the three tables that hang off an `arguments`
--   row to give the storyboard Step 6 / Step 8 / Step 19 surfaces their
--   stable, machine-addressable shape:
--
--     1. `concession_items`        — one row per conceded point (an
--                                    itemized forced list attached to a
--                                    `respond` argument).
--     2. `concession_acceptances`  — one row per receiver's stance on a
--                                    single concession item (a per-item
--                                    5-level gradient attached to a
--                                    `respond_to_concession` argument).
--     3. `move_reactions`          — the fist-bump reaction. v1 vocabulary
--                                    is a SINGLE value (`fist_bump`); no
--                                    voting, no score.
--
--   The next sequential migration number after
--   `20260522000011_admin_ai_001_semantic_referee_runtime_config.sql`.
--
--   Doctrine encoded by this migration:
--     - A concession is a scoring REPAIR, not a defeat. QOL-041 stores
--       only the LEVEL + the CLARIFICATION; no `broadStandingDelta`, no
--       `narrowStandingDelta`, no score column anywhere. The future
--       wiring stage routes these rows through `gradeRepair`.
--     - A non-`agree` acceptance level REQUIRES a clarification. The
--       CHECK constraint `clarification_required_unless_agree` is
--       defense-in-depth — the Edge Function and client both enforce it
--       too.
--     - `move_reactions.kind` CHECK has EXACTLY ONE value (`fist_bump`).
--       Adding any other value would require a NEW migration and a
--       doctrine review — the schema is structurally incapable of
--       becoming a voting system in v1.
--     - All three tables: RLS enabled. Soft-delete only (where
--       applicable); no `DELETE` policy on any of them.
--
-- Companion design: docs/designs/QOL-041.md §5 / §11.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1) concession_items — the itemized concession list (design §5.1).
-- ──────────────────────────────────────────────────────────────

create table if not exists public.concession_items (
  id                       uuid        primary key default gen_random_uuid(),
  debate_id                uuid        not null references public.debates(id)   on delete cascade,
  -- The response argument whose concession SECTION this item belongs to.
  argument_id              uuid        not null references public.arguments(id) on delete cascade,
  -- The node this concession concedes a point TO (the parent being
  -- responded to). The receiver of the concession is that node's author;
  -- this is who may set the gradient (§6.2 / §8 permissions).
  conceded_to_argument_id  uuid        not null references public.arguments(id) on delete cascade,
  author_id                uuid        not null references public.profiles(id)  on delete restrict,
  ordinal                  int         not null check (ordinal >= 0),
  item_text                text        not null
                             check (char_length(trim(item_text)) between 1 and 600),
  -- Soft-delete only; rows are never hard-deleted (repo doctrine).
  removed_at               timestamptz,
  removed_by               uuid        references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),

  -- One ordinal per (argument, ordinal) keeps the mirrored list stable
  -- for the receiver across reloads.
  unique (argument_id, ordinal)
);

create index if not exists concession_items_argument_idx
  on public.concession_items (argument_id) where removed_at is null;
create index if not exists concession_items_debate_idx
  on public.concession_items (debate_id) where removed_at is null;
create index if not exists concession_items_conceded_to_idx
  on public.concession_items (conceded_to_argument_id) where removed_at is null;

alter table public.concession_items enable row level security;

-- ── INSERT — the conceding-party author writes the row; the
--    submit-argument Edge Function is the real gate, RLS is
--    defense-in-depth. The argument must belong to the debate and the
--    author must be the row's author_id. ──
drop policy if exists ci_insert_author on public.concession_items;
create policy ci_insert_author
  on public.concession_items
  for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.arguments a
      where a.id = argument_id
        and a.debate_id = concession_items.debate_id
        and a.author_id = author_id
    )
    and exists (
      select 1 from public.arguments p
      where p.id = conceded_to_argument_id
        and p.debate_id = concession_items.debate_id
    )
  );

-- ── SELECT — anyone who can read the parent argument can read its
--    concession items. ──
drop policy if exists ci_select_read_access on public.concession_items;
create policy ci_select_read_access
  on public.concession_items
  for select
  using (
    exists (
      select 1 from public.arguments a
      where a.id = argument_id
    )
  );

-- ── UPDATE — only the original author OR an admin may set
--    removed_at / removed_by (soft-delete). Item-text immutability is
--    not enforced at the column level here; the Edge Function only ever
--    issues soft-delete updates (the apply-manual-tag pattern). ──
drop policy if exists ci_update_soft_delete on public.concession_items;
create policy ci_update_soft_delete
  on public.concession_items
  for update
  using (
    auth.uid() = author_id
    or public.is_admin(auth.uid())
  )
  with check (
    auth.uid() = author_id
    or public.is_admin(auth.uid())
  );

-- ── DELETE — no policy. Soft-delete only. ──

comment on table public.concession_items is
  'QOL-041: itemized concession list. Each row is a single conceded point attached to the conceding party''s `respond` argument. Doctrine: a concession is a scoring REPAIR, not a defeat — there is NO score column. The row stores only the conceded point''s text + its ordinal in the forced list. Soft-delete only via removed_at; never hard-deleted.';

-- ──────────────────────────────────────────────────────────────
-- 2) concession_acceptances — the per-concession gradient (§5.2).
-- ──────────────────────────────────────────────────────────────

create table if not exists public.concession_acceptances (
  id                  uuid        primary key default gen_random_uuid(),
  debate_id           uuid        not null references public.debates(id)          on delete cascade,
  concession_item_id  uuid        not null references public.concession_items(id) on delete cascade,
  -- The response argument that carries this acceptance (the receiver's
  -- `respond_to_concession` move).
  argument_id         uuid        not null references public.arguments(id)        on delete cascade,
  receiver_id         uuid        not null references public.profiles(id)         on delete restrict,
  -- The 5-value vocabulary verbatim from the QOL-041
  -- `AcceptanceLevel` (src/features/concessions/acceptanceGradient.ts).
  acceptance_level    text        not null
                        check (acceptance_level in (
                          'agree',
                          'agree_with_caveat',
                          'disagree_framing',
                          'disagree_context',
                          'disagree_fact'
                        )),
  -- Required iff acceptance_level <> 'agree'; enforced ALSO in the Edge
  -- Function (authoritative) and in the client model (UX).
  clarification_body  text        not null default '',
  created_at          timestamptz not null default now(),

  constraint clarification_required_unless_agree check (
    acceptance_level = 'agree'
    or char_length(trim(clarification_body)) >= 1
  ),

  -- One acceptance per item per receiving argument: a `respond_to_concession`
  -- move grades each incoming item exactly once.
  unique (concession_item_id, argument_id)
);

create index if not exists concession_acceptances_argument_idx
  on public.concession_acceptances (argument_id);
create index if not exists concession_acceptances_item_idx
  on public.concession_acceptances (concession_item_id);
create index if not exists concession_acceptances_debate_idx
  on public.concession_acceptances (debate_id);

alter table public.concession_acceptances enable row level security;

-- ── INSERT — only the receiver of the original concession may grade
--    it. The receiver is the AUTHOR of the conceded-to node behind the
--    concession_item_id. The submit-argument Edge Function enforces
--    this authoritatively; RLS is defense-in-depth. ──
drop policy if exists ca_insert_receiver on public.concession_acceptances;
create policy ca_insert_receiver
  on public.concession_acceptances
  for insert
  with check (
    auth.uid() = receiver_id
    -- The receiving argument must belong to the same debate and be
    -- authored by the receiver.
    and exists (
      select 1 from public.arguments r
      where r.id = argument_id
        and r.debate_id = concession_acceptances.debate_id
        and r.author_id = receiver_id
    )
    -- The conceded-to node's author MUST be the receiver — only the
    -- participant the concession was MADE TO may grade it.
    and exists (
      select 1
      from public.concession_items ci
      join public.arguments p
        on p.id = ci.conceded_to_argument_id
      where ci.id = concession_item_id
        and ci.debate_id = concession_acceptances.debate_id
        and p.author_id = receiver_id
    )
  );

-- ── SELECT — anyone who can read the parent argument can read its
--    acceptance rows. Mirrors the META-1A `point_tags` pattern: the
--    `arguments` table's own RLS does the room-visibility work, so the
--    join through `public.arguments` is sufficient. ──
drop policy if exists ca_select_read_access on public.concession_acceptances;
create policy ca_select_read_access
  on public.concession_acceptances
  for select
  using (
    exists (
      select 1 from public.arguments a
      where a.id = argument_id
    )
  );

-- ── UPDATE / DELETE — no policy. An acceptance is an immutable record
--    of a posted move. To change a stance, the receiver posts a NEW
--    `respond_to_concession` move (a new argument, new acceptance
--    rows) — this is why §5.3 derives from the NEWEST acceptances. ──

comment on table public.concession_acceptances is
  'QOL-041: the receiver''s per-concession-item stance, one of 5 levels (agree / agree_with_caveat / disagree_framing / disagree_context / disagree_fact). Doctrine: this table stores LEVELS + CLARIFICATION only; no score column anywhere. The clarification_required_unless_agree CHECK is doctrine in the schema. Immutable — to change a stance the receiver posts a NEW respond_to_concession move.';

-- ──────────────────────────────────────────────────────────────
-- 3) move_reactions — the fist-bump reaction (§5.4).
-- ──────────────────────────────────────────────────────────────

create table if not exists public.move_reactions (
  id            uuid        primary key default gen_random_uuid(),
  debate_id     uuid        not null references public.debates(id)   on delete cascade,
  argument_id   uuid        not null references public.arguments(id) on delete cascade,
  reactor_id    uuid        not null references public.profiles(id)  on delete restrict,
  -- v1 vocabulary is a SINGLE value. No up/down, no like, no vote.
  -- Adding any other value would require a NEW migration AND a
  -- doctrine review — the schema is structurally incapable of becoming
  -- a voting system in this card.
  kind          text        not null default 'fist_bump'
                  check (kind in ('fist_bump')),
  removed_at    timestamptz,
  removed_by    uuid        references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- A participant may have at most ONE ACTIVE reaction of a given kind on
-- a given move. A soft-deleted row does NOT block re-adding (toggle off /
-- on is fine). Matches the META-1A `point_tags_one_active_per_tagger`
-- precedent.
create unique index if not exists move_reactions_one_active_per_reactor
  on public.move_reactions (argument_id, reactor_id, kind)
  where removed_at is null;

create index if not exists move_reactions_argument_active_idx
  on public.move_reactions (argument_id) where removed_at is null;
create index if not exists move_reactions_debate_active_idx
  on public.move_reactions (debate_id) where removed_at is null;

alter table public.move_reactions enable row level security;

-- ── INSERT — the reactor may insert as themselves on a move they can
--    see. The eligibility rule "no fist-bump on your own move" is
--    enforced in the `react-to-move` Edge Function (RLS does not have
--    cheap access to the argument's author_id without a join — the
--    function is the authoritative gate). RLS is defense-in-depth. ──
drop policy if exists mr_insert_reactor on public.move_reactions;
create policy mr_insert_reactor
  on public.move_reactions
  for insert
  with check (
    auth.uid() = reactor_id
    and exists (
      select 1 from public.arguments a
      where a.id = argument_id
        and a.debate_id = move_reactions.debate_id
    )
  );

-- ── SELECT — anyone who can read the move can read its reactions.
--    Mirrors the META-1A `point_tags` pattern. ──
drop policy if exists mr_select_read_access on public.move_reactions;
create policy mr_select_read_access
  on public.move_reactions
  for select
  using (
    exists (
      select 1 from public.arguments a
      where a.id = argument_id
    )
  );

-- ── UPDATE — only the reactor or an admin may set removed_at
--    (soft-delete = toggle off). ──
drop policy if exists mr_update_soft_delete on public.move_reactions;
create policy mr_update_soft_delete
  on public.move_reactions
  for update
  using (
    auth.uid() = reactor_id
    or public.is_admin(auth.uid())
  )
  with check (
    auth.uid() = reactor_id
    or public.is_admin(auth.uid())
  );

-- ── DELETE — no policy. Soft-delete only. ──

comment on table public.move_reactions is
  'QOL-041: the fist-bump (acknowledge) reaction. The kind CHECK has EXACTLY ONE value (fist_bump) — the table is structurally incapable of becoming a voting system in v1. No score, no weight, no vote-tally column. A fist-bump count is computed at READ TIME from row count and never stored. Soft-delete only (removed_at = toggle off); never hard-deleted.';
