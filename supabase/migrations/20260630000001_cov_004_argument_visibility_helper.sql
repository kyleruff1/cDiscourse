-- COV-004: argument-visibility helper + concession/move_reactions SELECT rewrite
--
-- Addresses the 2026-06-30 coverage audit's gap #4
-- (docs/audits/COVERAGE-AUDIT-2026-06-30.md, commit 00554af), tracking issue #808.
--
-- Hazard (pre-this-migration):
--   The SELECT policies for public.concession_items, public.concession_acceptances,
--   and public.move_reactions each used a bare
--     EXISTS (SELECT 1 FROM public.arguments a WHERE a.id = argument_id)
--   These pass today only because the arguments SELECT policy still includes the
--   author / public / participant / admin visibility arms; a future refactor that
--   loosens any arm of the arguments policy would silently leak concession +
--   reaction data on those rows to non-participants in private debates.
--
-- Fix:
--   1. Introduce a SECURITY DEFINER helper public.is_argument_visible(arg_id, viewer_id)
--      that explicitly mirrors the canonical arguments SELECT arms (admin /
--      author-of-active-arg-in-active-debate / posted-active-arg-in-active-public-
--      or-participant-debate). Mirrors the is_moderator_or_admin() precedent
--      (LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public).
--   2. Drop + recreate the 3 SELECT policies to call the helper, making the
--      dependency on the arguments-visibility shape explicit.
--
-- This is paired with a Jest source-scan test
-- (__tests__/concessionAccessibilityRlsScan.test.ts) that flags any future
-- arguments SELECT policy edit that is NOT accompanied by a coordinated edit
-- to is_argument_visible.

-- ── helper ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER + fixed search_path prevents privilege escalation.
-- STABLE so the planner can fold/cache within a statement.
CREATE OR REPLACE FUNCTION public.is_argument_visible(arg_id uuid, viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.arguments a
    WHERE a.id = arg_id
      AND (
        public.is_moderator_or_admin()
        OR (
          a.author_id = viewer_id
          AND a.inactive_at IS NULL
          AND NOT public.is_debate_inactive(a.debate_id)
        )
        OR (
          a.status = 'posted'
          AND a.inactive_at IS NULL
          AND NOT public.is_debate_inactive(a.debate_id)
          AND (
            public.is_debate_open_or_locked_public(a.debate_id)
            OR public.is_debate_participant(a.debate_id, viewer_id)
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.is_argument_visible(uuid, uuid) IS
  'COV-004: returns true iff viewer_id can SELECT public.arguments.id = arg_id under the canonical arguments SELECT policy. Used by concession_items / concession_acceptances / move_reactions SELECT policies to make their visibility inheritance from public.arguments explicit. Update in lockstep with the arguments SELECT policy.';

-- ── concession_items SELECT — rewrite to use the helper ───────────────────
DROP POLICY IF EXISTS ci_select_read_access ON public.concession_items;
CREATE POLICY ci_select_read_access
  ON public.concession_items
  FOR SELECT
  USING ( public.is_argument_visible(argument_id, auth.uid()) );

-- ── concession_acceptances SELECT — rewrite to use the helper ─────────────
DROP POLICY IF EXISTS ca_select_read_access ON public.concession_acceptances;
CREATE POLICY ca_select_read_access
  ON public.concession_acceptances
  FOR SELECT
  USING ( public.is_argument_visible(argument_id, auth.uid()) );

-- ── move_reactions SELECT — rewrite to use the helper ─────────────────────
DROP POLICY IF EXISTS mr_select_read_access ON public.move_reactions;
CREATE POLICY mr_select_read_access
  ON public.move_reactions
  FOR SELECT
  USING ( public.is_argument_visible(argument_id, auth.uid()) );
