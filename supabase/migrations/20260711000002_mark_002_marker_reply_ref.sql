-- ============================================================
-- Migration: 20260711000002_mark_002_marker_reply_ref
-- Card: MARK-002 (#894) — timestamp_markers.reply_argument_id (MARKER-SIDE reply link).
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-4, Phase P3.5).
-- Canonical spec: Design Pass Output 8 (rebuttal reference) adapted MARKER-SIDE because
--   submit-argument is pinned (cannot thread arguments.target_marker_id at insert) and
--   the issue prefers marker-side linkage / no arguments-table migration. Design:
--   docs/designs/MARK-002.md (Linkage reality audit).
--
-- Write posture: timestamp_markers stays SELECT-only (MARK-001). reply_argument_id is
--   written ONLY by the create-marker service-role Edge (#894), which mints the marker
--   and links it to the callers OWN reply atomically. This migration adds NO write
--   policy, NO trigger, NO function.
--
-- Sequential after 20260711000001_mark_001_timestamp_markers.sql (highest applied).
--
-- -- What this migration does (strictly additive) --------------
--   1. ALTERs public.timestamp_markers to ADD reply_argument_id uuid NULL references
--      public.arguments(id) on delete set null. Marker-side linkage: the marker row
--      optionally records WHICH reply consumed it. One marker row then serves BOTH
--      TimestampMarker placements -- target_argument_id drives the source-span
--      highlight, reply_argument_id drives the reply reference chip.
--   2. Adds a partial index on reply_argument_id (only the rare marker-bearing replies).
--   ZERO existing rows touched (timestamp_markers ships EMPTY from MARK-001); ZERO
--   objects dropped or edited; NO read-path change; NO RLS policy change.
--
-- -- Why no RLS change is safe --------------------------------
--   A marker is visible iff its target_argument_id is room-visible (the shipped
--   timestamp_markers_select_room_visible policy, via is_argument_visible_in_circle).
--   create-marker enforces that reply_argument_id is the callers OWN reply in the SAME
--   debate, so any viewer who can see the marker (target visible) can also see the reply
--   (same room). reply_argument_id introduces NO new leak surface -> the SELECT policy is
--   unchanged.
--
-- -- OPS-001 four-class compliance (Docker-less heightened review) --
--   Class 1 (ambiguous column): no policy body added/changed; no subquery. N/A.
--   Class 2 (type mismatch): reply_argument_id uuid -> arguments.id uuid. No text<->uuid.
--   Class 3 (statement order): single ALTER ADD COLUMN whose FK target (arguments)
--     pre-exists; index + comment reference the just-added column. No forward ref, no
--     drop, no RLS toggle.
--   Class 4 (function/extension deps): creates no function, no extension, no grant. The
--     FK target public.arguments pre-exists (initial_schema). No COMMENT on storage.*.
--
-- -- Doctrine encoded ----------------------------------------
--   - Quote the point, never judge it (cdiscourse-doctrine 1): reply_argument_id is a
--     pure structural reference; no verdict, no score, no popularity/engagement column.
--   - Never hard-deleted (MARK-001 deleted_at): on delete set null is a safety net only
--     (arguments soft-delete via status='deleted', never hard-delete), so it never fires
--     in the normal lifecycle; the marker + quoted_text survive regardless.
--   - RLS stays ENABLED; nothing disabled (cdiscourse-doctrine 8).
-- ============================================================

alter table public.timestamp_markers
  add column if not exists reply_argument_id uuid references public.arguments(id) on delete set null;

create index if not exists timestamp_markers_reply_argument
  on public.timestamp_markers (reply_argument_id)
  where reply_argument_id is not null and deleted_at is null;

comment on column public.timestamp_markers.reply_argument_id is
  'MARK-002 (#894): optional FK to the reply argument that consumed this marker (the callers OWN reply in the J6 text-half). Marker-side linkage: the reply carries the marker chip (grouped by reply_argument_id) while target_argument_id carries the source-span highlight -- one marker row, both placements. Written ONLY by the create-marker service-role Edge (timestamp_markers is SELECT-only). Nullable (a standalone note marker has no reply). on delete set null (arguments soft-delete, never hard-delete; safety net only). NO RLS change: visibility flows through target_argument_id via the shipped timestamp_markers_select_room_visible policy.';
