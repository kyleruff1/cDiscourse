-- ============================================================
-- Migration: 20260517000009_meta_1a_point_tags
-- Description: META-1A — Persisted manual-tag ledger (point_tags table).
--
--   META-001 modeled the manual-tag vocabulary + eligibility matrix in an
--   IN-MEMORY ledger. META-1A persists it: a participant marking a move
--   `needs_source` (etc.) now writes a shared, durable row that every other
--   participant sees on reload.
--
--   Doctrine:
--     - A manual tag is a participant GAMEPLAY annotation. It marks a move's
--       gameplay state ("this point lacks a source"); it never rules on a
--       person or asserts a fact. The 10 tag codes below are the META-001
--       `ManualTagCode` vocabulary verbatim — see
--       src/features/metadata/moveMetadataLedger.ts `ALL_MANUAL_TAG_CODES`.
--     - A tag is created only by an explicit participant action. The table
--       has no count, no score, and no activity-volume column — recency or
--       reach of a move can neither create nor weight a tag.
--     - The `apply-manual-tag` Edge Function is the ONLY write path. The
--       room-shell loader does a read-only SELECT (the documented exception).
--     - Soft-delete only: `removed_at` is set; rows are never hard-deleted.
--       There is intentionally NO `for delete` policy.
--
-- RLS:
--   - INSERT: an eligible participant / admin may insert a tag on an
--     argument they can see; observers may NOT (eligibility enforced in the
--     Edge Function; RLS is defense-in-depth).
--   - SELECT: anyone who can read the argument can read its tags.
--   - UPDATE: the original tagger OR an admin may set `removed_at`
--     (soft-delete). No other column may be mutated in practice — the Edge
--     Function only ever writes `removed_at` + `removed_by`.
-- ============================================================

create table if not exists public.point_tags (
  id          uuid        primary key default gen_random_uuid(),
  debate_id   uuid        not null references public.debates(id)   on delete cascade,
  argument_id uuid        not null references public.arguments(id) on delete cascade,
  tag_code    text        not null,
  tagged_by   uuid        not null references public.profiles(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  removed_at  timestamptz,                      -- NULL = active; set = soft-deleted
  removed_by  uuid        references public.profiles(id) on delete set null,

  -- The 10 META-001 ManualTagCode values, verbatim. Source of truth:
  -- src/features/metadata/moveMetadataLedger.ts `ALL_MANUAL_TAG_CODES`.
  constraint point_tags_tag_code_check check (tag_code in (
    'needs_source', 'needs_quote', 'definition_issue', 'scope_issue',
    'causal_mechanism', 'evidence_debt', 'concession_offered',
    'narrowed_claim', 'tangent', 'ready_for_synthesis'
  ))
);

-- Partial indexes on ACTIVE rows — the room-shell loader always filters
-- `removed_at is null`, so the partial index keeps lookups tight.
create index if not exists point_tags_argument_idx
  on public.point_tags (argument_id) where removed_at is null;
create index if not exists point_tags_debate_idx
  on public.point_tags (debate_id)   where removed_at is null;

-- Dedupe — one ACTIVE tag per (argument, tag_code, tagger). Mirrors
-- META-001's `makeManualTagDedupeKey(code, userId)` idempotency: the same
-- applier cannot apply the same code twice on the same message. A
-- soft-deleted row does NOT block re-applying (oscillating tags are fine).
create unique index if not exists point_tags_one_active_per_tagger
  on public.point_tags (argument_id, tag_code, tagged_by)
  where removed_at is null;

alter table public.point_tags enable row level security;

-- ── INSERT: an eligible actor may tag an argument they can see. ──
-- Eligibility (observer-cannot-apply, own-bubble restrictions) is enforced
-- in the apply-manual-tag Edge Function against the mirrored
-- MANUAL_TAG_ELIGIBILITY_TABLE. This RLS policy is defense-in-depth: the
-- caller must be the tagger, and the argument must be visible to them.
drop policy if exists pt_insert_eligible on public.point_tags;
create policy pt_insert_eligible
  on public.point_tags
  for insert
  with check (
    auth.uid() = tagged_by
    and exists (
      select 1 from public.arguments a
      where a.id = argument_id
        and a.debate_id = debate_id
    )
  );

-- ── SELECT: anyone who can read the argument can read its tags. ──
drop policy if exists pt_select_read_access on public.point_tags;
create policy pt_select_read_access
  on public.point_tags
  for select
  using (
    exists (
      select 1 from public.arguments a
      where a.id = argument_id
    )
  );

-- ── UPDATE: the original tagger or an admin may soft-delete (set
--    removed_at). No other write path exists; the Edge Function only ever
--    sets removed_at + removed_by. ──
drop policy if exists pt_update_soft_delete on public.point_tags;
create policy pt_update_soft_delete
  on public.point_tags
  for update
  using (
    auth.uid() = tagged_by
    or public.is_admin(auth.uid())
  )
  with check (
    auth.uid() = tagged_by
    or public.is_admin(auth.uid())
  );

-- ── DELETE: no policy. Soft-delete only — a hard delete is impossible
--    through PostgREST. ──

comment on table public.point_tags is
  'META-1A: persisted manual-tag ledger. A manual tag is a participant gameplay annotation (one of the 10 META-001 ManualTagCode values) that marks a move gameplay state; it never rules on a person or asserts a fact. Written only via the apply-manual-tag Edge Function. Soft-delete via removed_at; rows are never hard-deleted.';
