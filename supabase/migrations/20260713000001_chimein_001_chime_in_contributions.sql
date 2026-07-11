-- ============================================================
-- Migration: 20260713000001_chimein_001_chime_in_contributions
-- Card: CHIMEIN-P8 Round 2 (#761) — point-scoped public-only chime-in
--   contribution marker (chime_in_contributions).
-- Epic: civildiscourse-v4 / Argument Surface Pivot (M-ASP-8).
-- Design: docs/designs/P8-CHIMEIN-ARC.md + docs/designs/CHIMEIN-SEMANTICS-ASSESSMENT.md.
--
-- Write posture: SELECT-only / Edge-only writes (the house default — PROOF-001
--   #888 proof_items, MARK-001 #893 timestamp_markers, FEEDBACK-001 #898
--   move_marks). ALL writes (attach, retract) are performed by the chime-in
--   service-role Edge Function. This migration ships NO authenticated write
--   policy and NO write-gate trigger. Rationale (design "RLS-posture decision"):
--   public-only + cap + author-scope + point-scope are enforced in the Edge as
--   application logic (the DB CHECK cannot read debates.visibility cheaply — the
--   move_marks participant-gate-is-app-logic precedent); SELECT-only makes the
--   count surface honest-by-construction (a row exists ONLY via the validated Edge).
--
-- Sequential after 20260712000001_feedback_001_move_marks.sql (highest applied
--   timestamp at build time).
--
-- ── What this migration does (strictly additive) ────────────
--   Creates ONE new, RLS-enabled, EMPTY table: chime_in_contributions. Adds ONE
--   SELECT policy + partial UNIQUE guards. ZERO existing rows touched; ZERO
--   existing objects dropped or edited. The table is empty until the chime-in
--   Edge writes it and the chime_in flag is ON, so behaviour for every existing
--   room is bit-for-bit unchanged.
--
-- ── Doctrine encoded ────────────────────────────────────────
--   - A chime-in is a bounded point-scoped contribution ROLE + attached treatment,
--     NEVER a third principal voice and NEVER a node's structural state
--     (CIVILDISCOURSE-V4 L849/L855; cdiscourse-doctrine sections 1 and 10a). This
--     table stores ONLY the marker (which argument is a chime-in on which point);
--     it has NO principal-seat column, NO score/standing column, NO node-state
--     column. It never writes debate_participants.side (chime_in stays a derived
--     role there).
--   - Public-only: the Edge rejects a private-room insert; there is no chime row
--     for a private debate.
--   - Anti-amplification preserved (point-standing-economy / antiAmplification.ts):
--     inert storage. No engagement/score column, no standing trigger. A chime
--     marker feeds display subordination + the seat count, NEVER factual standing.
--   - Retract is a timestamp (retracted_at), never a delete. No DELETE policy.
--   - RLS ENABLED; nothing disabled. The SELECT policy reads cross-table
--     visibility ONLY through the pre-applied SECURITY DEFINER STABLE helper
--     is_argument_visible_in_circle (the COV-004 / PROOF-001 / move_marks
--     anti-recursion pattern) — no raw cross-table subquery in the policy.
--
-- ── OPS-001 four-class compliance (Docker-less heightened review) ──
--   Class 1 (ambiguous column): the SELECT policy body contains NO subquery — the
--     only cross-table read is the pre-applied helper is_argument_visible_in_circle.
--     Every column in the USING body is table-qualified (chime_in_contributions.*).
--   Class 2 (type mismatch): every FK column is uuid referencing a uuid PK
--     (debates.id / arguments.id / profiles.id). seat_index is smallint with a
--     CHECK 1..3. created_at / retracted_at are timestamptz. auth.uid() is uuid.
--   Class 3 (statement order): CREATE TABLE -> ENABLE RLS -> indexes/UNIQUE ->
--     SELECT policy. RLS enabled before the policy. No DROP of any kind.
--   Class 4 (function/extension deps): gen_random_uuid() requires pgcrypto
--     (Supabase default; every prior migration relies on it) — DOCUMENTED, not
--     asserted with a create-extension statement (the #859 / PROOF-001 precedent).
--     is_argument_visible_in_circle is pre-applied (20260702000001, granted to
--     authenticated, wired live by 20260709000001) — referenced, never redefined.
--     auth.uid() from the Supabase auth schema (present by default). CREATES no
--     new function and no new grant.
-- ============================================================

create table if not exists public.chime_in_contributions (
  id                  uuid        primary key default gen_random_uuid(),
  debate_id           uuid        not null references public.debates(id)   on delete cascade,
  -- The chime-in CONTENT: an ordinary argument posted through the byte-identical
  -- submit-argument deterministic gate. This table only MARKS it as a chime-in.
  argument_id         uuid        not null references public.arguments(id) on delete cascade,
  -- The POINT the chime-in attaches to (point-scoping). The Edge asserts it equals
  -- arguments.parent_id(argument_id).
  target_argument_id  uuid        not null references public.arguments(id) on delete cascade,
  author_id           uuid        not null references public.profiles(id)  on delete cascade,
  -- 1-based bounded chime seat index. CHECK 1..3 is the cap ceiling; the partial
  -- UNIQUE below is the atomic race guard. One source of truth with GAME-005 chime
  -- capacity (PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT = 3). OD-2 confirms the
  -- number; OD-6 confirms the scope (room-level UNIQUE key shown; a per-point cap
  -- would key the UNIQUE on target_argument_id instead).
  seat_index          smallint    not null check (seat_index between 1 and 3),
  created_at          timestamptz not null default now(),
  -- NULL = active; set = retracted. Retract is a timestamp, never a delete.
  retracted_at        timestamptz
);

-- Partial indexes on ACTIVE chime-ins — every reader filters retracted_at is null.
create index if not exists chime_in_contributions_debate_active_idx
  on public.chime_in_contributions (debate_id)          where retracted_at is null;
create index if not exists chime_in_contributions_target_active_idx
  on public.chime_in_contributions (target_argument_id) where retracted_at is null;
create index if not exists chime_in_contributions_argument_idx
  on public.chime_in_contributions (argument_id);

-- ATOMIC CAP GUARD (the move_marks UNIQUE idiom): at most one ACTIVE chime-in per
-- (debate, seat_index). The Edge computes the lowest free seat_index (1..3) and
-- inserts; two concurrent inserts that pick the same index -> the second fails the
-- UNIQUE and is retried/rejected as seats_full. Race-safe without an advisory lock.
-- (Room-scope per the OD-6 recommendation. A per-point cap keys on target_argument_id.)
create unique index if not exists chime_in_contributions_one_active_seat
  on public.chime_in_contributions (debate_id, seat_index)
  where retracted_at is null;

-- One active chime-in per argument — an argument is marked a chime-in at most once.
create unique index if not exists chime_in_contributions_one_active_per_argument
  on public.chime_in_contributions (argument_id)
  where retracted_at is null;

alter table public.chime_in_contributions enable row level security;

-- ── SELECT — active + room-visible (canonical + circle arm) ──
drop policy if exists chime_in_contributions_select_room_visible on public.chime_in_contributions;
create policy chime_in_contributions_select_room_visible
  on public.chime_in_contributions
  for select
  to authenticated
  using (
    chime_in_contributions.retracted_at is null
    and public.is_argument_visible_in_circle(chime_in_contributions.argument_id, auth.uid())
  );

-- chime_in_contributions INSERT / UPDATE / DELETE: no policy. SELECT-only posture —
-- all writes (attach, retract) go through the chime-in service-role Edge, which
-- enforces public-only + author-scope + point-scope + cap. PostgREST cannot
-- insert, update, or delete a chime_in_contributions row for an authenticated caller.

comment on table public.chime_in_contributions is
  'CHIMEIN-P8 Round 2 (#761): point-scoped public-only chime-in contribution marker. The chime CONTENT is an ordinary argument through the byte-identical submit-argument deterministic gate; this table only MARKS which argument is a bounded chime-in on which point (target_argument_id). RLS enabled. SELECT-only posture (house default: PROOF-001 / MARK-001 / move_marks): SELECT active + room-visible via is_argument_visible_in_circle; ALL writes via the chime-in service-role Edge (public-only + author-scope + point-scope + cap enforced there). seat_index CHECK 1..3 + partial UNIQUE (debate_id, seat_index) is the atomic cap guard. Inert storage: NO principal-seat / score / standing / node-state column, no trigger — a chime marker feeds display subordination + the seat count, NEVER a third principal voice, NEVER node structural state, NEVER factual standing (anti-amplification). Retract = retracted_at timestamp; never hard-deleted. Never writes debate_participants.side (chime_in stays a derived role there).';
