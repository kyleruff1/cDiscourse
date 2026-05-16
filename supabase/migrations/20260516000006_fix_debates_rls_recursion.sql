-- ============================================================
-- Migration: 20260516000006_fix_debates_rls_recursion
-- Description: Fix infinite RLS recursion between debates and
--   debate_participants discovered during browser smoke test.
--
-- Root cause (Stage 5.5.6.1, 2026-05-16):
--   The "debates: select open, own, or participant" policy contained
--   an EXISTS subquery into debate_participants. That triggered the
--   "debate_participants: select own or open debate" policy, which
--   contained an EXISTS subquery back into debates — causing infinite
--   recursion on every GET /rest/v1/debates request.
--
-- Fix: Replace cross-table subqueries in both policies with narrow
--   SECURITY DEFINER helper functions. SECURITY DEFINER functions run
--   as the function owner (postgres superuser in Supabase) and thus
--   bypass RLS on the tables they read. This breaks the loop without
--   weakening policy intent.
--
-- Helpers are:
--   - Narrow: each returns only a boolean, no user data.
--   - Stable: no writes, safe to cache within a query.
--   - Fixed search_path: prevents search_path injection.
--   - Revoked from public: only authenticated role can call them.
--
-- Client cannot bypass RLS for writes — only the SELECT policies
-- are affected by this change. INSERT/UPDATE policies are unchanged
-- except for debate_participants INSERT, which also referenced debates
-- directly and caused the same recursion path.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Helper 1: check if a user is a participant in a debate.
-- Queries debate_participants as definer (no RLS on that table),
-- breaking the debates → debate_participants → debates recursion.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_debate_participant(
  p_debate_id uuid,
  p_user_id   uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.debate_participants dp
    WHERE dp.debate_id = p_debate_id
      AND dp.user_id   = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_debate_participant(uuid, uuid) IS
  'Returns true if p_user_id is a participant in p_debate_id. '
  'SECURITY DEFINER: bypasses RLS on debate_participants to avoid '
  'debates <-> debate_participants policy recursion.';

REVOKE ALL ON FUNCTION public.is_debate_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_debate_participant(uuid, uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- Helper 2: check if a debate is open or locked (readable state).
-- Queries debates as definer (no RLS on debates), breaking the
-- debate_participants → debates → debate_participants recursion.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_debate_open_or_locked(
  p_debate_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.debates d
    WHERE d.id     = p_debate_id
      AND d.status IN ('open', 'locked')
  );
$$;

COMMENT ON FUNCTION public.is_debate_open_or_locked(uuid) IS
  'Returns true if the debate exists with status open or locked. '
  'SECURITY DEFINER: bypasses RLS on debates to avoid policy recursion.';

REVOKE ALL ON FUNCTION public.is_debate_open_or_locked(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_debate_open_or_locked(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- Helper 3: check if a debate is joinable (draft or open).
-- Used in debate_participants INSERT WITH CHECK to avoid querying
-- debates under RLS (which would recurse back to debate_participants).
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_debate_joinable(
  p_debate_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.debates d
    WHERE d.id     = p_debate_id
      AND d.status IN ('draft', 'open')
  );
$$;

COMMENT ON FUNCTION public.is_debate_joinable(uuid) IS
  'Returns true if the debate exists with status draft or open (joinable). '
  'SECURITY DEFINER: bypasses RLS on debates to avoid policy recursion.';

REVOKE ALL ON FUNCTION public.is_debate_joinable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_debate_joinable(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- Drop and recreate the three recursive policies.
--
-- Policy names may vary slightly between the migration file and the
-- live DB if a prior session renamed them. Drop by both known names.
-- ──────────────────────────────────────────────────────────────

-- 1. debates SELECT: was querying debate_participants directly.
DROP POLICY IF EXISTS "debates: select open, own, or participant" ON public.debates;
DROP POLICY IF EXISTS "debates: select"                           ON public.debates;

CREATE POLICY "debates: select open, own, or participant"
ON public.debates
FOR SELECT
TO authenticated
USING (
  status = 'open'
  OR status = 'locked'
  OR created_by = auth.uid()
  OR is_moderator_or_admin()
  OR public.is_debate_participant(id, auth.uid())
);

-- 2. debate_participants SELECT: was querying debates directly.
DROP POLICY IF EXISTS "debate_participants: select own or open debate"    ON public.debate_participants;
DROP POLICY IF EXISTS "debate_participants: select"                       ON public.debate_participants;

CREATE POLICY "debate_participants: select own or open debate"
ON public.debate_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_moderator_or_admin()
  OR public.is_debate_open_or_locked(debate_id)
);

-- 3. debate_participants INSERT: was querying debates directly.
DROP POLICY IF EXISTS "debate_participants: users join as themselves" ON public.debate_participants;
DROP POLICY IF EXISTS "debate_participants: insert"                   ON public.debate_participants;

CREATE POLICY "debate_participants: users join as themselves"
ON public.debate_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_debate_joinable(debate_id)
);
