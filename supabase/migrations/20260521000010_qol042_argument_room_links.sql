-- ============================================================
-- Migration: 20260521000010_qol042_argument_room_links
-- Description: QOL-042 — Linked prior argument reference as context.
--
--   A new argument room may reference an EARLIER SETTLED room as
--   context. One row in `public.argument_room_links` = one
--   one-directional, immutable reference from a SOURCE (new) room to a
--   TARGET (prior, settled) room. The new room surfaces a context chip
--   carrying the prior room's title.
--
-- Doctrine (QOL-042 design §5 / §7 / §10):
--   - The link is CONTEXT, not a verdict. It carries no truth field, no
--     score, no relationship-type enum. It never says the prior room
--     "won", "proved", or "supports" anything.
--   - The link NEVER re-opens or mutates a locked room. There is no code
--     path in QOL-042 — RLS, trigger, or otherwise — that writes to
--     `debates` or `arguments`. The link only ever inserts / soft-updates
--     its OWN row. The `link_columns_immutable` BEFORE-UPDATE trigger
--     proves the link itself is immutable except for `is_removed`.
--   - The access check is RLS-ENFORCED, not UI-only. A viewer reads the
--     prior room's body / nodes through the EXISTING `debates` /
--     `arguments` RLS under their own JWT — QOL-042 adds no policy on
--     either table. An unauthorized viewer gets zero rows there. The
--     prior room's TITLE reaches a title-only viewer through
--     `target_title_snapshot` on this link row — a bounded,
--     deliberately-cited, ≤ 200-char denormalization. Never body, never
--     nodes, never evidence, never participant identity.
--   - Soft-remove only: removing a chip sets `is_removed = true`. The
--     link is never hard-deleted by the client; there is intentionally
--     NO `for delete` policy.
--
-- Soft dependency — QOL-039 (public/private visibility): NOT yet built.
--   `public.debates` has no `visibility` column today, so the link's
--   target-readability check uses `is_debate_open_or_locked` +
--   `is_debate_participant` + `is_moderator_or_admin` alone (today's
--   behaviour — every open/locked room is content-readable). When QOL-039
--   lands, a follow-up migration swaps in the visibility-aware
--   source-readability helper (design §11). This migration is written so
--   that swap is a clean addition, not an edit.
--
-- RLS (four policies, design §7 — NO delete policy):
--   - SELECT: a viewer may read a link row if they can see its SOURCE
--     room. The link row holds only two room ids + author + note +
--     snapshot title — no prior-room content — so SELECT gates on the
--     source room, not the target.
--   - INSERT: only a participant of the SOURCE room may add a link to
--     it, and only they may be `created_by`. The TARGET-is-locked +
--     target-is-readable check is the `link_target_must_be_locked`
--     BEFORE-INSERT trigger (a recursive subquery into `debates` inside a
--     WITH CHECK would risk the recursion the …0006 migration fixed).
--   - UPDATE: soft-remove only — the link author or an admin may set
--     `is_removed`. The `link_columns_immutable` trigger rejects any
--     change to a column other than `is_removed`.
--
-- This card adds NO Edge Function — RLS + triggers fully enforce the
-- link rules. The operator applies this migration post-merge via
-- `npx supabase db push --linked`.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Table: public.argument_room_links
-- ──────────────────────────────────────────────────────────────
create table if not exists public.argument_room_links (
  id                    uuid        primary key default gen_random_uuid(),
  -- The NEW room that carries the context chip. ON DELETE CASCADE: if the
  -- new room is ever hard-removed, its links go with it.
  source_debate_id      uuid        not null references public.debates(id)  on delete cascade,
  -- The PRIOR settled room. ON DELETE RESTRICT: a referenced prior room
  -- cannot be hard-removed out from under a link (defensive — rooms are
  -- not user-deletable today).
  target_debate_id      uuid        not null references public.debates(id)  on delete restrict,
  -- The link author. ON DELETE RESTRICT: a link records who cited what.
  created_by            uuid        not null references public.profiles(id) on delete restrict,
  -- The prior room's title, snapshotted at creation time. The link author
  -- IS authorized on the target at creation, so they can read it. This is
  -- what renders in the title-only chip state for a viewer who cannot see
  -- a private prior room. ≤ 200 chars. Title ONLY — never body / nodes.
  target_title_snapshot text        not null
                                    check (char_length(target_title_snapshot) <= 200),
  -- The link author's optional one-line reason. ≤ 280 chars. Free text;
  -- held to the doctrine ban-list at the composer (client validation) and
  -- never rendered as a verdict.
  note                  text        not null default ''
                                    check (char_length(note) <= 280),
  -- Soft-remove flag. The link is never hard-deleted by the client.
  is_removed            boolean     not null default false,
  created_at            timestamptz not null default now(),

  -- A room never links itself.
  constraint argument_room_links_no_self_link
    check (source_debate_id <> target_debate_id),
  -- A new room links a given prior room at most once. Re-linking is
  -- idempotent — the create path treats the conflict as a no-op.
  constraint argument_room_links_one_link_per_pair
    unique (source_debate_id, target_debate_id)
);

comment on table public.argument_room_links is
  'QOL-042: one-directional, immutable reference from a source (new) argument room to a prior, settled (locked) argument room. The link is read-only context, never a verdict — it carries no truth / score / relationship-type field and never re-opens or mutates a locked room. target_title_snapshot is a bounded ≤200-char title-only denormalization; prior-room body / nodes are read through existing debates / arguments RLS under the caller JWT. Soft-remove via is_removed; rows are never hard-deleted.';

-- ──────────────────────────────────────────────────────────────
-- Indexes — partial on ACTIVE (not-removed) rows.
--   Source index: the timeline loads "links on this room" by source.
--   Target index: the back-reference count + the ON DELETE RESTRICT check.
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_arg_room_links_source
  on public.argument_room_links (source_debate_id) where is_removed = false;
create index if not exists idx_arg_room_links_target
  on public.argument_room_links (target_debate_id) where is_removed = false;

alter table public.argument_room_links enable row level security;

-- ──────────────────────────────────────────────────────────────
-- Trigger function: link_target_must_be_locked (BEFORE INSERT).
--   Rejects the insert unless `target_debate_id` resolves to a room with
--   status = 'locked' AND the inserting user can read that room. The
--   readability check mirrors the `debates` SELECT logic via the existing
--   SECURITY DEFINER helpers — no recursive subquery in a WITH CHECK.
--
--   QOL-039-absent path: a room is "content-readable" when it is
--   open/locked, the caller is a participant, or the caller is mod/admin.
--   When QOL-039 lands, a follow-up migration extends this with the
--   visibility-aware helper (design §11) — it is a clean addition here.
-- ──────────────────────────────────────────────────────────────
create or replace function public.link_target_must_be_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select d.status into v_status
  from public.debates d
  where d.id = new.target_debate_id;

  if v_status is null then
    raise exception
      'argument_room_links: target room % does not exist', new.target_debate_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Only a SETTLED (locked) prior room is link-eligible.
  if v_status <> 'locked' then
    raise exception
      'argument_room_links: a prior argument can only be linked once it is settled'
      using errcode = 'check_violation';
  end if;

  -- The inserting user must be able to read the target room. A locked
  -- room is open/locked, so `is_debate_open_or_locked` is true today;
  -- the participant / mod-admin arms keep the check correct once QOL-039
  -- makes a locked room privately scoped.
  if not (
    public.is_debate_open_or_locked(new.target_debate_id)
    or public.is_debate_participant(new.target_debate_id, new.created_by)
    or public.is_moderator_or_admin()
  ) then
    raise exception
      'argument_room_links: you can only link a prior argument you can see'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

comment on function public.link_target_must_be_locked() IS
  'QOL-042 BEFORE-INSERT guard on argument_room_links: the target room must be settled (status = locked) and readable by the inserting user. Enforces "a settled prior room only" + "you can only link a room you can see" without a recursive WITH CHECK subquery into debates.';

drop trigger if exists trg_link_target_must_be_locked on public.argument_room_links;
create trigger trg_link_target_must_be_locked
  before insert on public.argument_room_links
  for each row
  execute function public.link_target_must_be_locked();

-- ──────────────────────────────────────────────────────────────
-- Trigger function: link_columns_immutable (BEFORE UPDATE).
--   Raises if any column other than `is_removed` changes between OLD and
--   NEW. The link is immutable in every respect except the soft-remove
--   flag — there is no edit path for the cited room, the note, the
--   snapshot title, the author, or the created_at timestamp.
-- ──────────────────────────────────────────────────────────────
create or replace function public.link_columns_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.source_debate_id is distinct from old.source_debate_id
     or new.target_debate_id is distinct from old.target_debate_id
     or new.created_by is distinct from old.created_by
     or new.target_title_snapshot is distinct from old.target_title_snapshot
     or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at then
    raise exception
      'argument_room_links: only is_removed may change after a link is created'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.link_columns_immutable() IS
  'QOL-042 BEFORE-UPDATE guard on argument_room_links: only is_removed may change after insert. The link is otherwise immutable — changing the cited room or the note means soft-remove + create a new link.';

drop trigger if exists trg_link_columns_immutable on public.argument_room_links;
create trigger trg_link_columns_immutable
  before update on public.argument_room_links
  for each row
  execute function public.link_columns_immutable();

-- ──────────────────────────────────────────────────────────────
-- RLS Policy 1 — SELECT: a viewer may read a link row when they can see
--   its SOURCE room. The link row carries no prior-room content, so the
--   gate is the source room (not the target). is_removed rows are hidden.
-- ──────────────────────────────────────────────────────────────
drop policy if exists "argument_room_links: select if source room visible"
  on public.argument_room_links;
create policy "argument_room_links: select if source room visible"
  on public.argument_room_links
  for select
  to authenticated
  using (
    is_removed = false
    and (
      public.is_debate_open_or_locked(source_debate_id)
      or public.is_debate_participant(source_debate_id, auth.uid())
      or public.is_moderator_or_admin()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- RLS Policy 2 — INSERT: only a participant of the SOURCE room may add a
--   link to it, and only they may be `created_by`. The target-is-locked +
--   target-is-readable check is the link_target_must_be_locked trigger.
-- ──────────────────────────────────────────────────────────────
drop policy if exists "argument_room_links: insert by source room participant"
  on public.argument_room_links;
create policy "argument_room_links: insert by source room participant"
  on public.argument_room_links
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.is_debate_participant(source_debate_id, auth.uid())
  );

-- ──────────────────────────────────────────────────────────────
-- RLS Policy 3 — UPDATE (soft-remove only): the link author or an admin
--   may update. The link_columns_immutable trigger rejects any change to
--   a column other than is_removed, so the only effective update is the
--   soft-remove.
-- ──────────────────────────────────────────────────────────────
drop policy if exists "argument_room_links: soft-remove by author or admin"
  on public.argument_room_links;
create policy "argument_room_links: soft-remove by author or admin"
  on public.argument_room_links
  for update
  to authenticated
  using (created_by = auth.uid() or public.is_moderator_or_admin())
  with check (created_by = auth.uid() or public.is_moderator_or_admin());

-- ── DELETE: no policy. Soft-remove only — a hard delete is impossible
--    through PostgREST. ──
