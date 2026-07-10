-- ============================================================
-- Migration: 20260712000001_feedback_001_move_marks
-- Card: FEEDBACK-001 (#898) — human boolean move-mark ledger (move_marks).
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-7, Phase P7).
-- Canonical spec: Design Pass Output 8 (move_marks) + Output 9 (Boolean MCP
--   feedback). Design: docs/designs/FEEDBACK-001.md.
--
-- Write posture: SELECT-only / Edge-only writes (the current house default —
--   PROOF-001 #888 proof_items + proof_relations, MARK-001 #893 timestamp_markers,
--   circles #859; four SELECT-only instances). ALL writes (mark, retract, and the
--   paired-code exclusivity retract) are performed by the FEEDBACK-001 mark-move
--   Edge Function (service-role). This migration ships NO authenticated write
--   policy, NO write-gate helper, NO write-guard trigger. Rationale is recorded in
--   the design "RLS-posture decision"; in brief: the not-own-move guard needs
--   arguments.author_id (react-to-move notes RLS lacks cheap access without a
--   join), the participant-only gate + the paired-code mutual-exclusivity retract
--   are application logic, and SELECT-only makes the two aggregate surfaces
--   honest-by-construction (a row exists ONLY via the validated Edge).
--
-- Sequential after 20260711000002_mark_002_marker_reply_ref.sql (highest applied
--   timestamp at build time).
--
-- ── What this migration does (strictly additive) ────────────
--   Creates ONE new, RLS-enabled, EMPTY table: move_marks (Output 9 "Collect —
--   explicit"). Adds ONE SELECT policy. ZERO existing rows touched; ZERO existing
--   objects dropped or edited. The table is empty until the mark-move Edge writes
--   it and the move_marks flag is ON, so behaviour for every existing room is
--   bit-for-bit unchanged.
--
-- ── Doctrine encoded by this migration ──────────────────────
--   - A mark is a structural observation about a MOVE, never a person
--     (cdiscourse-doctrine sections 1 and 10a). The five mark_code values describe
--     what a move did (did_not_address), never who posted it — the ban-list scan
--     asserts no verdict/person token in any code.
--   - Anti-amplification separation preserved (point-standing-economy skill /
--     antiAmplification.ts): move_marks is INERT storage. No point-standing /
--     engagement-credit / score column; no trigger that writes any standing. A
--     mark can feed the mediator projection and the heat model but NEVER factual
--     standing.
--   - Retract is a timestamp, never a delete (retracted_at); rows are never
--     hard-deleted. No DELETE policy.
--   - RLS ENABLED; nothing disabled. The SELECT policy reads cross-table state
--     ONLY through the pre-applied SECURITY DEFINER STABLE helper
--     is_argument_visible_in_circle (no raw cross-table subquery in the policy) —
--     the COV-004 / PROOF-001 anti-recursion pattern.
--
-- ── OPS-001 four-class compliance (Docker-less heightened review) ──
--   Class 1 (ambiguous column): the SELECT policy body contains NO subquery — the
--     only cross-table read is the pre-applied helper is_argument_visible_in_circle.
--     Every column in the USING body is table-qualified (move_marks.*). No bare
--     same-name column (argument_id / debate_id) is referenced.
--   Class 2 (type mismatch): every FK column is uuid referencing a uuid PK
--     (debates.id / arguments.id / profiles.id). mark_code CHECK is text-vs-text
--     literal. created_at / retracted_at are timestamptz. auth.uid() is uuid. No
--     text-vs-uuid, no int-vs-bigint.
--   Class 3 (statement order): CREATE TABLE -> ENABLE RLS -> indexes -> SELECT
--     policy. RLS is enabled before the policy is created. No DROP of any kind.
--   Class 4 (function/extension deps): gen_random_uuid() requires pgcrypto —
--     DOCUMENTED here (Supabase default; every prior migration relies on it), not
--     asserted with a create-extension statement (the #859 / PROOF-001 precedent).
--     is_argument_visible_in_circle is pre-applied (20260702000001, granted to
--     authenticated, wired live by 20260709000001) — referenced, never redefined.
--     auth.uid() from the Supabase auth schema (present by default). This migration
--     CREATES no new function and no new grant. No COMMENT ON ... ON storage.* (the
--     sole COMMENT target is public.move_marks, which the migration role owns).
-- ============================================================

create table if not exists public.move_marks (
  id           uuid        primary key default gen_random_uuid(),
  debate_id    uuid        not null references public.debates(id)   on delete cascade,
  argument_id  uuid        not null references public.arguments(id) on delete cascade,
  marked_by    uuid        not null references public.profiles(id)  on delete cascade,
  -- The five Output 9 human-boolean codes, verbatim. Each describes the MOVE,
  -- never the mover (ban-list asserted). Source of truth:
  -- src/features/feedback/moveMarksModel.ts ALL_MOVE_MARK_CODES.
  mark_code    text        not null
                 check (mark_code in (
                   'addressed_my_point',
                   'did_not_address',
                   'receipts_requested',
                   'good_receipt',
                   'off_the_point'
                 )),
  created_at   timestamptz not null default now(),
  -- NULL = active; set = retracted. Retract is a timestamp, never a delete.
  retracted_at timestamptz,

  -- One row per (argument, marker, code) forever. The mark-move Edge re-activates
  -- via upsert (ON CONFLICT DO UPDATE SET retracted_at = NULL); retract sets
  -- retracted_at. A durable two-state latch, not an event log — the FULL unique
  -- (not the point_tags partial-where-null form) is the spec choice (#898) and
  -- gives the Edge race-safe idempotency (the UNIQUE is the atomic guard, the
  -- playback_receipts idiom).
  constraint move_marks_one_per_marker_code unique (argument_id, marked_by, mark_code)
);

-- Partial indexes on ACTIVE marks — every reader filters retracted_at is null.
create index if not exists move_marks_argument_active_idx
  on public.move_marks (argument_id) where retracted_at is null;
create index if not exists move_marks_debate_active_idx
  on public.move_marks (debate_id)   where retracted_at is null;

alter table public.move_marks enable row level security;

-- ── move_marks SELECT — active + room-visible (canonical + #882 circle arm) ──
drop policy if exists move_marks_select_room_visible on public.move_marks;
create policy move_marks_select_room_visible
  on public.move_marks
  for select
  to authenticated
  using (
    move_marks.retracted_at is null
    and public.is_argument_visible_in_circle(move_marks.argument_id, auth.uid())
  );

-- move_marks INSERT / UPDATE / DELETE: no policy. SELECT-only posture — all writes
-- (mark upsert, retract, paired-code exclusivity retract) go through the
-- FEEDBACK-001 mark-move service-role Edge. PostgREST cannot insert, update, or
-- delete a move_marks row for an authenticated caller.

comment on table public.move_marks is
  'FEEDBACK-001 (#898): the human boolean move-mark ledger (Design Pass Output 9). One row per (argument, marker, code); mark_code is a structural observation about the MOVE, never the mover (ban-list clean). RLS enabled. SELECT-only posture (house default: PROOF-001 / MARK-001 / circles): SELECT active + room-visible via is_argument_visible_in_circle; ALL writes (mark / retract / paired-code exclusivity) are performed by the mark-move service-role Edge. Inert storage: NO point-standing / score / engagement column, no standing trigger — a mark feeds the mediator projection and heat, NEVER factual standing (anti-amplification). Retract = retracted_at timestamp; never hard-deleted.';
