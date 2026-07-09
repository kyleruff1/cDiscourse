-- ============================================================
-- Migration: 20260709000001_asp_circles_rls_001_circle_read_arm
-- Card: ASP-CIRCLES-RLS-001 (#882) — wire the dormant circle read-arm into the
--   debates + arguments SELECT policies.
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-1).
-- Canonical spec: docs/designs/START-002.md §5 (companion migration design).
-- Closes START-002 (#839) deferred AC2 ("a second circle member reads the
--   room"). Pre-flip gate for home_v2.
--
-- Sequential after 20260702000001_private_groups_002_circles.sql (highest
--   applied timestamp at build time).
--
-- ── What this migration does (strictly additive) ────────────
--   Adds ONE new PERMISSIVE SELECT policy to public.debates and ONE new
--   PERMISSIVE SELECT policy to public.arguments. Each OR-composes with the
--   existing live SELECT policy (Postgres unions permissive policies with OR),
--   so the delta can only WIDEN read access, never narrow it. The existing
--   canonical policies are NOT dropped, NOT recreated, NOT edited — their text
--   is byte-identical after this migration.
--
--   The two new arms grant read access to LIVE CIRCLE MEMBERS of a
--   circle-scoped room (debates.circle_id IS NOT NULL) via the SECURITY
--   DEFINER helpers shipped (but wired to zero policies) in 20260702000001:
--   is_circle_member (debates arm) and is_argument_visible_in_circle
--   (arguments arm). No helper is created or edited here.
--
-- ── Non-narrowing invariance (the safety proof) ─────────────
--   * debates: for every row with circle_id IS NULL, the new arm's leading
--     conjunct `debates.circle_id IS NOT NULL` is FALSE => the arm is FALSE =>
--     the OR-union equals the existing policy result (byte-identical for all
--     existing non-circle rooms) and is_circle_member is never evaluated.
--   * arguments: for every arg whose debate has circle_id IS NULL, the new arm
--     calls is_argument_visible_in_circle, whose circle branch is guarded by
--     `d.circle_id is not null` (FALSE here) so is_circle_member never fires;
--     the helper's first branch is a CALL to the canonical is_argument_visible,
--     which returns exactly what the existing inline policy already grants — so
--     the union is unchanged for non-circle args. The ONLY net-new access is a
--     live circle member reading posted, active args in an active private
--     circle-scoped room (== AC2).
--
-- ── OPS-001 four-class compliance (Docker-less heightened review) ──
--   Class 1 (ambiguous column): NEITHER policy has a subquery in its text
--     (is_circle_member / is_argument_visible_in_circle are function calls; the
--     only join lives INSIDE the SECURITY DEFINER helper, already Class-1
--     audited by 20260702000001). Every column is table-qualified
--     (debates.circle_id / debates.visibility / debates.inactive_at;
--     arguments.status / arguments.inactive_at / arguments.debate_id /
--     arguments.id). `status` and `inactive_at` exist on BOTH tables — both are
--     qualified, so no ambiguity is possible.
--   Class 2 (type mismatch): no new column / FK / CHECK. All comparisons are
--     uuid<->uuid (circle_id / id / debate_id vs auth.uid()), text<->text
--     literal (status='posted', visibility='private'), or timestamptz null-check
--     (inactive_at IS NULL).
--   Class 3 (statement order): only two CREATE POLICY statements. debates /
--     arguments exist + RLS-enabled since the initial schema (applied). Each
--     `drop policy if exists <new-name>` precedes the `create policy <new-name>`
--     on the SAME table (targets ONLY the new names — a no-op on first apply).
--     No new table / column / index / trigger; no DROP of any object; no CREATE
--     POLICY before ENABLE RLS (RLS already on).
--   Class 4 (function/extension deps): references only objects created + granted
--     in EARLIER APPLIED migrations —
--       public.is_circle_member(uuid,uuid)              20260702000001 (grant -> authenticated, line 303)
--       public.is_argument_visible_in_circle(uuid,uuid) 20260702000001 (grant -> authenticated, line 369)
--       public.is_debate_inactive(uuid)                 20260606000001 (already used by the live arguments policy)
--     auth.uid() from the Supabase auth schema (present by default). No new
--     extension, no gen_random_uuid(), no new GRANT (all grants pre-exist), no
--     COMMENT ON ... ON storage.* (COMMENT targets are public.* tables the
--     migration role owns).
--
-- ── Doctrine ────────────────────────────────────────────────
--   RLS stays ENABLED on both tables (never disabled). A circle is an ACCESS
--   boundary, never a ranking or verdict (cdiscourse-doctrine 1-3) — these arms
--   grant READ access to members, nothing more. No write-path change, no
--   service-role, no client change, no helper edit. Append-only: no applied
--   migration file is edited (brand-new file); the existing policies are not
--   dropped.
-- ============================================================

-- ── debates SELECT — additive circle-member arm ─────────────
-- New PERMISSIVE policy; OR-composes with
-- "debates: select active public-open, own, or participant; admins read all"
-- (20260606000001), which is NOT touched. The drop-if-exists targets ONLY this
-- new policy name (a no-op on first apply; present for re-runnability).
drop policy if exists debates_select_circle_member on public.debates;
create policy debates_select_circle_member
  on public.debates
  for select
  to authenticated
  using (
    debates.circle_id is not null                        -- short-circuit: non-circle rooms exit here (is_circle_member never fires)
    and debates.visibility = 'private'                   -- defense-in-depth (debates_circle_requires_private already guarantees this)
    and debates.inactive_at is null                      -- conservative posture: members do not see an inactive circle room (mirrors the creator/participant arms)
    and public.is_circle_member(debates.circle_id, auth.uid())
  );

comment on policy debates_select_circle_member on public.debates is
  'ASP-CIRCLES-RLS-001 (#882): additive PERMISSIVE circle-member read arm for circle-scoped rooms. Grants SELECT to a live member (is_circle_member) of the room''s circle. OR-composes with the canonical debates SELECT policy (unchanged); provably non-narrowing (circle_id IS NULL => arm FALSE => existing result). Wires the dormant is_circle_member helper (20260702000001) per docs/designs/START-002.md section 5.';

-- ── arguments SELECT — additive circle-member arm ───────────
-- New PERMISSIVE policy; OR-composes with
-- "arguments: select active for own/participant/public; active debate; admins read all"
-- (20260606000001), which is NOT touched. Routes the circle read through the
-- shipped composite helper is_argument_visible_in_circle (the SINGLE
-- circle-visibility composition point — NEVER re-inlines the circle-visibility
-- logic; circleVisibilityCompositionRlsScan is the lockstep alarm bell). The
-- leading posted/inactive gates match START-002.md section 5 and are cheap
-- column predicates that filter before the STABLE helper call.
drop policy if exists arguments_select_circle_member on public.arguments;
create policy arguments_select_circle_member
  on public.arguments
  for select
  to authenticated
  using (
    arguments.status = 'posted'
    and arguments.inactive_at is null
    and not public.is_debate_inactive(arguments.debate_id)
    and public.is_argument_visible_in_circle(arguments.id, auth.uid())
  );

comment on policy arguments_select_circle_member on public.arguments is
  'ASP-CIRCLES-RLS-001 (#882): additive PERMISSIVE circle-member read arm for arguments in circle-scoped rooms. Calls the shipped composite helper is_argument_visible_in_circle (20260702000001) — the single circle-visibility composition point (never re-inlined; circleVisibilityCompositionRlsScan is the alarm bell). OR-composes with the canonical arguments SELECT policy (unchanged); provably non-narrowing. Wires the dormant helper per docs/designs/START-002.md section 5.';
