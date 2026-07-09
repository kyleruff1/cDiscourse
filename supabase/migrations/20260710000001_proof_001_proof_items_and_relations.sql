-- ============================================================
-- Migration: 20260710000001_proof_001_proof_items_and_relations
-- Card: PROOF-001 (#888) — proof_items + proof_relations tables + RLS.
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-3, Phase P3).
-- Canonical spec: Design Pass Output 8 (data model) + docs/evidence-object-model.md
--   Follow-up (path c). Design: docs/designs/PROOF-001.md.
--
-- Write posture: MAXIMALLY-CONSERVATIVE / SELECT-only (orchestrator ruling
--   2026-07-09, recorded in docs/designs/PROOF-001.md "Orchestrator ruling
--   applied"). Both tables ship SELECT-only RLS. ALL writes — insert,
--   relation-insert, soft-delete/detach, and privileged (broken/primary_present)
--   status — are performed by the PROOF-003 Edge Function (service-role, Round 2),
--   matching the circles (#859) SELECT-only precedent. This migration therefore
--   ships NO authenticated write policy, NO write-gate helper, and NO write-guard
--   trigger (a trigger would fire for the service-role writer too and block the
--   PROOF-003 soft-delete / status writes the ruling routes there).
--
-- Sequential after 20260709000001_asp_circles_rls_001_circle_read_arm.sql
--   (highest applied timestamp at build time).
--
-- ── What this migration does (strictly additive) ────────────
--   Creates TWO new, RLS-enabled, EMPTY tables: proof_items (the evidence
--   path-c artifact table, a strict superset of EvidenceArtifactKind) and
--   proof_relations (the claim<->proof graph). Adds ONE SELECT policy per
--   table. ZERO existing rows are touched; ZERO existing objects are dropped
--   or edited. No read-path flips (the evidence adapter keeps reading JSONB
--   until PROOF-002). Both tables are empty until PROOF-003 (the service-role
--   attach Edge) or the operator-gated back-fill writes them, so behaviour for
--   every existing room is bit-for-bit unchanged.
--
-- ── Attribution FK target (PROOF-001 design R2, verified) ───
--   added_by / created_by reference public.profiles(id) — the house convention
--   (profiles.id = auth.users.id 1:1 in this repo). Confirmed against the
--   initial schema: public.arguments.author_id references public.profiles(id)
--   (20260516000001_initial_schema.sql:185) and
--   public.concession_items.author_id references public.profiles(id)
--   (20260522000012_qol_041_concession_acceptance.sql:86).
--
-- ── Extension dependency (OPS-001 Class 4) ──────────────────
--   gen_random_uuid() requires pgcrypto. Supabase enables pgcrypto by default
--   in the public schema; every prior migration in this repo relies on the
--   same default (circles, argument_room_invites, concession_items). Per
--   OPS-001 Class 4 the dependency is DOCUMENTED here, not asserted with a
--   create-extension statement (the #859 precedent).
--
-- ── Doctrine encoded by this migration ──────────────────────
--   - Evidence is never proof-of-truth (evidence-doctrine). A proof_items row
--     carries a source-chain STATUS, never a verdict. The status CHECK omits
--     'no_source' (aggregate-only). 'broken' / 'primary_present' remain valid
--     stored values but there is NO authenticated write path this card: only
--     the PROOF-003 / future set-source-chain-status service-role Edge may set
--     any status, matching "only an admin can mark a chain primary_source".
--   - Anti-amplification separation preserved: these tables are INERT storage.
--     No point-standing / engagement-credit column, no trigger that writes any
--     score. Standing moves only when a later MOVE does something the
--     point-standing engine already grades (untouched here).
--   - RLS is ENABLED on both tables; nothing is disabled (cdiscourse-doctrine
--     section 8 / supabase-edge-contract section 4). The SELECT policy bodies
--     read cross-table state ONLY through a SECURITY DEFINER STABLE helper (no
--     raw cross-table subquery in any policy) — the COV-004 / circles
--     anti-recursion pattern.
--   - Room-visible SELECT composes through is_argument_visible_in_circle, which
--     itself OR-composes the canonical is_argument_visible (never re-inlined) +
--     the #882 circle arm. So visibility exactly inherits the arguments policy,
--     circle arm included.
--   - Soft-delete only (deleted_at) is the intended lifecycle; there is no
--     hard-delete path and no DELETE policy on either table. Detach + soft-delete
--     are performed by the PROOF-003 service-role Edge.
--   - kind / relation / status vocabularies contain no verdict or person
--     token (ban-list asserted by the scan suite). Table/column names carry
--     'proof' (internal, exempt from the box-copy ban-list); user-facing copy
--     is unchanged and still says Source / Receipts.
--
-- ── OPS-001 four-class compliance (Docker-less heightened review) ──
--   Class 1 (ambiguous column): NO policy body contains a subquery — the only
--     cross-table read lives inside the pre-applied SECURITY DEFINER helper
--     is_argument_visible_in_circle. Every column in every USING body is
--     table-qualified (proof_items.* / proof_relations.*). No same-name column
--     is referenced bare.
--   Class 2 (type mismatch): every FK column is uuid, referencing a uuid PK
--     (debates.id / arguments.id / profiles.id / proof_items.id). All CHECK
--     comparisons are text<->text literal. auth.uid() is uuid. No text<->uuid,
--     no int<->bigint.
--   Class 3 (statement order): proof_items CREATE TABLE -> ENABLE RLS ->
--     indexes -> proof_items SELECT policy; THEN proof_relations CREATE TABLE
--     (its FK to proof_items now exists) -> ENABLE RLS -> indexes ->
--     proof_relations SELECT policy. Every object exists before it is
--     referenced; RLS is enabled before any policy is created on its table.
--   Class 4 (function/extension deps): pgcrypto documented above. Referenced
--     pre-applied helper: is_argument_visible_in_circle (20260702000001, granted
--     to authenticated, wired live by 20260709000001). auth.uid() from the
--     Supabase auth schema (present by default). This migration CREATES no new
--     function and no new grant. No COMMENT ON ... ON storage.* (all COMMENT
--     targets are public.* objects this migration role owns).
-- ============================================================

-- ============================================================
-- 1. public.proof_items — the evidence path-c artifact record
-- ============================================================
create table if not exists public.proof_items (
  id                      uuid        primary key default gen_random_uuid(),
  debate_id               uuid        not null references public.debates(id)   on delete cascade,
  argument_id             uuid        not null references public.arguments(id) on delete cascade,
  added_by                uuid        not null references public.profiles(id)  on delete cascade,
  -- Narrowed kind vocabulary (Design Decision 2): storage kinds
  -- (screenshot/file) are deferred to SEC-PROOF-001 with the proof-files bucket
  -- + EXIF/size hardening; marker kinds (voice_excerpt/timestamp) are deferred
  -- to MARK-001 with the timestamp_markers table. Each defers WITH the column it
  -- needs (storage_path / marker_id), widening this CHECK in its own migration.
  kind                    text        not null
                            check (kind in ('url','quote','source_text','note','prior_move','external_ref')),
  label                   text        not null default '',
  url                     text,
  source_text             text,
  quote                   text,
  -- Present for kind='prior_move'. FK exists now (arguments); no producer until
  -- PROOF-003, but it needs no new infrastructure so it ships with integrity.
  referenced_argument_id  uuid        references public.arguments(id) on delete set null,
  -- Per-artifact source-chain status. 'no_source' is OMITTED (aggregate-only,
  -- never a per-artifact value). All five stored statuses are valid at the
  -- column, but there is NO authenticated write path this card: only the
  -- PROOF-003 service-role Edge writes rows, so a client can never mint any
  -- status (let alone 'broken'/'primary_present') directly.
  source_chain_status     text        not null default 'unverified'
                            check (source_chain_status in
                              ('unverified','source_no_quote','source_and_quote','broken','primary_present')),
  risk                    text        not null default 'unknown'
                            check (risk in ('low','medium','high','unknown')),
  created_at              timestamptz not null default now(),
  -- Soft-delete only. Never hard-deleted by the app; set by the PROOF-003 Edge.
  deleted_at              timestamptz
);

alter table public.proof_items enable row level security;

create index if not exists proof_items_argument
  on public.proof_items (argument_id) where deleted_at is null;
create index if not exists proof_items_debate_created
  on public.proof_items (debate_id, created_at);

comment on table public.proof_items is
  'PROOF-001 (#888): the evidence path-c artifact table (Design Pass Output 8; supersedes the client_validation->attachedEvidence JSONB snapshot per docs/evidence-object-model.md Follow-up). A per-artifact record; kind is a strict superset of EvidenceArtifactKind (storage + marker kinds deferred to SEC-PROOF-001 / MARK-001). RLS enabled. SELECT-only posture (orchestrator ruling 2026-07-09): SELECT room-visible via is_argument_visible_in_circle (canonical + #882 circle arm). ALL writes (insert, soft-delete/detach, any status) are performed by the PROOF-003 service-role Edge; there is no authenticated write policy, no write-gate helper, no write-guard trigger. Inert storage: emits no point-standing delta.';
comment on column public.proof_items.source_chain_status is
  'PROOF-001: per-artifact source-chain status (advisory, never a truth label). Excludes no_source (aggregate-only). broken/primary_present are set only by the PROOF-003 / future set-source-chain-status service-role Edge; there is no authenticated write path this card.';
comment on column public.proof_items.deleted_at is
  'PROOF-001: soft-delete tombstone. Set by the PROOF-003 service-role Edge (there is no authenticated UPDATE path this card). Rows with deleted_at not null are hidden by the SELECT policy. Never hard-deleted.';

-- ── proof_items SELECT — room-visible (canonical + #882 circle arm) ──
drop policy if exists proof_items_select_room_visible on public.proof_items;
create policy proof_items_select_room_visible
  on public.proof_items
  for select
  to authenticated
  using (
    proof_items.deleted_at is null
    and public.is_argument_visible_in_circle(proof_items.argument_id, auth.uid())
  );

-- proof_items INSERT / UPDATE / DELETE: no policy. SELECT-only posture — all
-- writes go through the PROOF-003 service-role Edge (Round 2). PostgREST cannot
-- insert, update, or delete a proof_items row for an authenticated caller.

-- ============================================================
-- 2. public.proof_relations — the claim<->proof graph
-- ============================================================
create table if not exists public.proof_relations (
  id                 uuid        primary key default gen_random_uuid(),
  debate_id          uuid        not null references public.debates(id)      on delete cascade,
  proof_item_id      uuid        not null references public.proof_items(id)  on delete cascade,
  claim_argument_id  uuid        not null references public.arguments(id)    on delete cascade,
  relation           text        not null
                       check (relation in ('supports','contradicts','contextualizes','answers_request')),
  created_by         uuid        not null references public.profiles(id)     on delete cascade,
  created_at         timestamptz not null default now(),
  unique (proof_item_id, claim_argument_id, relation)
);

alter table public.proof_relations enable row level security;

create index if not exists proof_relations_proof_item
  on public.proof_relations (proof_item_id);
create index if not exists proof_relations_claim_argument
  on public.proof_relations (claim_argument_id);

comment on table public.proof_relations is
  'PROOF-001 (#888): the claim<->proof graph (Design Pass Output 8) — one receipt can back several claims; the answers_request relation powers evidence-debt auto-resolution (EV-003 / PROOF-003). RLS enabled. SELECT-only posture (orchestrator ruling 2026-07-09): SELECT visible iff the claim argument is room-visible (is_argument_visible_in_circle). The relation-insert is performed by the PROOF-003 service-role Edge. Additive-only: no deleted_at (a relation is inert when its proof_item is soft-deleted); no UPDATE/DELETE policy.';

-- ── proof_relations SELECT — visible iff the claim argument is room-visible ──
drop policy if exists proof_relations_select_room_visible on public.proof_relations;
create policy proof_relations_select_room_visible
  on public.proof_relations
  for select
  to authenticated
  using (
    public.is_argument_visible_in_circle(proof_relations.claim_argument_id, auth.uid())
  );

-- proof_relations INSERT / UPDATE / DELETE: no policy. SELECT-only posture —
-- the relation-insert (an additive fact) is performed by the PROOF-003
-- service-role Edge. PostgREST cannot write a proof_relations row for an
-- authenticated caller.
