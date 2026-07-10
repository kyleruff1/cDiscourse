-- ============================================================
-- Migration: 20260711000001_mark_001_timestamp_markers
-- Card: MARK-001 (#893) — timestamp_markers table + proof_items.marker_id.
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-4, Phase P3.5).
-- Canonical spec: Design Pass Output 8 (timestamp_markers) adapted TEXT-FIRST;
--   Output 6 (TimestampMarker component) + principle 7 ("Quote moments, not
--   messages"); pivot plan doc 13 P3.5. Design: docs/designs/MARK-001.md.
--
-- Write posture: MAXIMALLY-CONSERVATIVE / SELECT-only (the circles #859 +
--   PROOF-001 #888 precedent). The table ships SELECT-only RLS. ALL writes
--   (insert, soft-delete/retract) are performed by the MARK-002 Edge Function
--   (service-role), which snapshots quoted_text VERBATIM from arguments.body
--   server-side so the quote cannot be client-forged (the Output 13 Q5
--   misrepresentation mitigation). This migration therefore ships NO
--   authenticated write policy, NO write-gate helper, NO write-guard trigger.
--
-- Sequential after 20260710000001_proof_001_proof_items_and_relations.sql
--   (highest applied timestamp at build time).
--
-- -- What this migration does (strictly additive) --------------
--   1. Creates ONE new, RLS-enabled, EMPTY table: timestamp_markers -- a durable
--      quote-a-moment record. TEXT-FIRST: it carries CHAR-span markers against a
--      posted argument body now, and is shaped to carry VOICE (ms) spans in P5
--      by widening ONE check -- never a reshape.
--   2. ALTERs public.proof_items to ADD the deferred marker_id FK (PROOF-001
--      explicitly deferred this column to MARK-001 so the FK has a real referent
--      from day one). Nullable, indexed, on delete set null. NO proof_items.kind
--      widening (the voice-proof kinds stay deferred).
--   ZERO existing rows are touched; ZERO existing objects are dropped or edited.
--   No read-path change. The table is empty until MARK-002 writes it, and
--   proof_items.marker_id is all-NULL (no producer this card), so behaviour for
--   every existing room is bit-for-bit unchanged.
--
-- -- Span shape (the load-bearing delegated decision; design Decision 1) -------
--   span_start int / span_end int / span_unit text check ('chars'). One column
--   pair carries BOTH lanes with a discriminator: P5 widens the span_unit check
--   to add 'ms' (a one-line drop-constraint/add-constraint follow-up), never a
--   reshape and never a new column for the span itself. Nullable per-lane ms
--   columns now would be dead weight (a text marker has no ms) -- the same
--   dead-column logic PROOF-001 used to defer marker_id. check (span_end >
--   span_start) mirrors the Design Pass end_ms > start_ms and holds for both
--   lanes. quoted_text is NOT NULL -- the verbatim server snapshot is the DURABLE
--   artifact (see the durability audit in the design doc): self-sufficient after
--   any body edit, argument soft-delete, or (P5) audio deletion, so marker
--   correctness never depends on span-offset stability. recording_id is
--   deliberately ABSENT until P5 (the audio FK has no producer and the voice
--   columns do not exist yet -- the same "defer the column WITH the lane it
--   serves" logic PROOF-001 applied to marker_id).
--
-- -- Extension dependency (OPS-001 Class 4) --------------------
--   gen_random_uuid() requires pgcrypto. Supabase enables pgcrypto by default in
--   the public schema; every prior migration relies on the same default. Per
--   OPS-001 Class 4 the dependency is DOCUMENTED here, not asserted with a
--   create-extension statement (the #859 / PROOF-001 precedent).
--
-- -- Doctrine encoded by this migration ------------------------
--   - Quote the point, never judge it (cdiscourse-doctrine 1). A marker records a
--     span + a verbatim quoted_text snapshot; it carries NO verdict, NO score, NO
--     truth label. kind is 'rebuttal_anchor' | 'note' -- both verdict-free
--     (ban-list asserted by the scan suite).
--   - quoted_text is a verbatim snapshot, not editable (Output 13 Q5). The
--     SELECT-only posture routes the write to the MARK-002 Edge, which reads
--     arguments.body server-side and snapshots the exact span text -- a client
--     cannot forge quoted_text.
--   - Anti-amplification separation preserved: the table is INERT storage. No
--     point-standing / engagement column, no trigger that writes any score.
--   - RLS is ENABLED; nothing is disabled (cdiscourse-doctrine 8 /
--     supabase-edge-contract 4). The SELECT policy reads cross-table state ONLY
--     through the pre-applied SECURITY DEFINER STABLE helper
--     is_argument_visible_in_circle (no raw cross-table subquery) -- the COV-004 /
--     circles anti-recursion pattern.
--   - Room-visible SELECT composes through is_argument_visible_in_circle, which
--     OR-composes the canonical is_argument_visible (never re-inlined) + the #882
--     circle arm. A marker is visible iff its target argument is room-visible.
--   - Never hard-deleted (deleted_at). No hard-delete path, no DELETE policy.
--     Retract (if MARK-002 exposes it) is a service-role soft-delete.
--   - Table/column names carry no verdict or person token. 'timestamp_markers'
--     and 'marker' are internal; user-facing copy is MARK-002's concern.
--
-- -- OPS-001 four-class compliance (Docker-less heightened review) --
--   Class 1 (ambiguous column): the SELECT policy body contains NO subquery --
--     the only cross-table read is the pre-applied definer helper
--     is_argument_visible_in_circle. Every column in the USING body is
--     table-qualified (timestamp_markers.*). No bare same-name column.
--   Class 2 (type mismatch): every FK column is uuid referencing a uuid PK
--     (debates.id / arguments.id / profiles.id / timestamp_markers.id).
--     span_start/span_end are int, compared int>int in the check. span_unit/kind
--     checks are text literal. marker_id uuid -> timestamp_markers.id uuid. No
--     text<->uuid, no int<->bigint.
--   Class 3 (statement order): timestamp_markers CREATE TABLE -> ENABLE RLS ->
--     indexes -> comments -> SELECT policy; THEN alter proof_items ADD marker_id
--     (its FK target timestamp_markers now exists) -> index -> comment. Every
--     object exists before it is referenced; RLS is enabled before the policy.
--   Class 4 (function/extension deps): pgcrypto documented above. Referenced
--     pre-applied helper: is_argument_visible_in_circle (20260702000001, granted
--     authenticated, wired live 20260709000001). auth.uid() from the Supabase
--     auth schema (default). This migration CREATES no function and no grant. No
--     COMMENT ON ... ON storage.* (all COMMENT targets are public.* this role owns).
-- ============================================================

-- ============================================================
-- 1. public.timestamp_markers -- the quote-a-moment record (text-first)
-- ============================================================
create table if not exists public.timestamp_markers (
  id                  uuid        primary key default gen_random_uuid(),
  debate_id           uuid        not null references public.debates(id)   on delete cascade,
  -- The argument whose body this marker quotes. NOT NULL; on delete cascade is a
  -- referential safety net only -- arguments soft-delete (status='deleted'),
  -- never hard-delete, so this never fires in the normal lifecycle.
  target_argument_id  uuid        not null references public.arguments(id) on delete cascade,
  created_by          uuid        not null references public.profiles(id)  on delete cascade,
  -- Text-first marker kind. 'rebuttal_anchor' = the phrase a reply is aimed at
  -- (Design Pass principle 7); 'note' = a freeform highlight. 'proof_excerpt' is
  -- DEFERRED (no proof kind consumes a marker yet -- this card does not widen
  -- proof_items.kind); a later voice-proof card widens this check with the
  -- producing lane.
  kind                text        not null
                        check (kind in ('rebuttal_anchor','note')),
  -- Span into the target. TEXT-FIRST: span_unit is 'chars' now (char offsets into
  -- arguments.body). P5 widens the check to add 'ms' (voice/waveform lane) -- a
  -- one-line follow-up, never a reshape. span_start/span_end are int (covers both
  -- char offsets and ms). end must be strictly after start (non-empty span).
  span_start          int         not null,
  span_end            int         not null,
  span_unit           text        not null default 'chars'
                        check (span_unit in ('chars')),
  -- The verbatim snapshot of the quoted span, taken server-side by the MARK-002
  -- Edge at creation. This is the DURABLE artifact: self-sufficient after any
  -- body edit, argument soft-delete, or (P5) audio deletion -- marker correctness
  -- never depends on span-offset stability. NOT NULL: a marker with no quote is
  -- useless ("Quote moments, not messages").
  quoted_text         text        not null,
  created_at          timestamptz not null default now(),
  -- Never hard-deleted. Retract (if MARK-002 exposes it) sets deleted_at via the
  -- service-role Edge; rows with deleted_at not null are hidden by the SELECT
  -- policy. Consumed NOW by the SELECT policy's deleted_at-is-null filter.
  deleted_at          timestamptz,
  check (span_end > span_start)
);

alter table public.timestamp_markers enable row level security;

create index if not exists timestamp_markers_target_argument
  on public.timestamp_markers (target_argument_id) where deleted_at is null;
create index if not exists timestamp_markers_debate_created
  on public.timestamp_markers (debate_id, created_at);

comment on table public.timestamp_markers is
  'MARK-001 (#893): the quote-a-moment record (Design Pass Output 8, adapted TEXT-FIRST; principle 7 "Quote moments, not messages"). A durable char-span marker against a posted argument body (span_unit=chars); P5 widens span_unit to add ms for the voice/waveform lane without a reshape. quoted_text is a verbatim server snapshot (the durable artifact, self-sufficient after body edit / argument soft-delete / P5 audio deletion). RLS enabled. SELECT-only posture (circles #859 + PROOF-001 precedent): SELECT room-visible via is_argument_visible_in_circle (canonical + #882 circle arm). ALL writes are performed by the MARK-002 service-role Edge, which snapshots quoted_text server-side so the quote cannot be client-forged (Output 13 Q5). Never hard-deleted (deleted_at). Inert storage: emits no point-standing delta.';
comment on column public.timestamp_markers.span_unit is
  'MARK-001: span discriminator. chars now (char offsets into arguments.body). P5 widens this check to add ms (voice lane). One column pair (span_start/span_end) carries both lanes -- no reshape.';
comment on column public.timestamp_markers.quoted_text is
  'MARK-001: verbatim snapshot of the quoted span, taken server-side by the MARK-002 Edge at creation. The durable artifact -- marker correctness never depends on span-offset stability (arguments.body is treated as immutable but is not DB-guarded; quoted_text is the source of truth). Not editable (Output 13 Q5 misrepresentation mitigation).';
comment on column public.timestamp_markers.deleted_at is
  'MARK-001: soft-delete tombstone. Set only by the MARK-002 service-role Edge (there is no authenticated write path this card). Rows with deleted_at not null are hidden by the SELECT policy. Never hard-deleted.';

-- -- timestamp_markers SELECT -- room-visible (canonical + #882 circle arm) --
drop policy if exists timestamp_markers_select_room_visible on public.timestamp_markers;
create policy timestamp_markers_select_room_visible
  on public.timestamp_markers
  for select
  to authenticated
  using (
    timestamp_markers.deleted_at is null
    and public.is_argument_visible_in_circle(timestamp_markers.target_argument_id, auth.uid())
  );

-- timestamp_markers INSERT / UPDATE / DELETE: no policy. SELECT-only posture --
-- all writes go through the MARK-002 service-role Edge (server-side quote
-- snapshot). PostgREST cannot insert, update, or delete a marker row for an
-- authenticated caller.

-- ============================================================
-- 2. public.proof_items.marker_id -- the PROOF-001 deferred FK, now with a target
-- ============================================================
-- PROOF-001 (#888) explicitly deferred this column to MARK-001 "so the FK has a
-- real referent from day one" (docs/designs/PROOF-001.md Design Decision 1;
-- migration 20260710000001 header). timestamp_markers now exists (created above),
-- so the FK ships with referential integrity. Nullable: only the deferred
-- voice-proof kinds (voice_excerpt/timestamp) would ever populate it, and this
-- card does NOT widen proof_items.kind -- a text marker is a rebuttal anchor, not
-- a proof, so no shipped proof references a marker yet. on delete set null mirrors
-- proof_items.referenced_argument_id (a proof survives losing its marker link;
-- markers are never hard-deleted anyway).
alter table public.proof_items
  add column if not exists marker_id uuid references public.timestamp_markers(id) on delete set null;

create index if not exists proof_items_marker
  on public.proof_items (marker_id) where marker_id is not null;

comment on column public.proof_items.marker_id is
  'MARK-001 (#893): optional FK to the timestamp_markers row this proof excerpts (deferred by PROOF-001 to MARK-001 so the FK ships with integrity). Nullable; populated only by future voice-proof kinds (voice_excerpt/timestamp), which stay deferred -- this card does not widen proof_items.kind. on delete set null.';
