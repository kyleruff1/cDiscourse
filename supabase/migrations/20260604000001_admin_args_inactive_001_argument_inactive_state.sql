-- ============================================================
-- Migration: 20260604000001_admin_args_inactive_001_argument_inactive_state
-- Card:        ADMIN-ARGS-INACTIVE-001 (issue #464)
-- Doctrine:    "fresh start = filtered view, not erasure."
--
-- Adds a reversible per-argument inactive visibility state for admin
-- moderation. The row stays in `public.arguments` exactly where it was;
-- what changes is whether non-admin SELECT policies return it.
--
-- This migration is strictly ADDITIVE:
--   1. Three nullable columns on `public.arguments`
--      (`inactive_at`, `inactive_by`, `inactive_reason`).
--   2. Two partial indexes on `public.arguments`.
--   3. A new audit table `public.argument_inactive_audit` (append-only).
--   4. A successor SELECT policy on `public.arguments` using the
--      qol_039 DROP+CREATE precedent.
--
-- The migration:
--   - DOES NOT widen the existing `status` CHECK on `public.arguments`.
--   - DOES NOT edit any prior migration file.
--   - DOES NOT hard-erase any row.
--   - DOES NOT touch INSERT / UPDATE policies on `public.arguments`.
--   - DOES NOT store the argument body anywhere new.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. Three additive columns on public.arguments (all NULLABLE).
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.arguments
  ADD COLUMN inactive_at     timestamptz NULL,
  ADD COLUMN inactive_by     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN inactive_reason text        NULL;

COMMENT ON COLUMN public.arguments.inactive_at IS
  'Lifecycle visibility state. NULL = active (default views include it). NOT NULL = inactive (default views exclude it; admin-only with Show inactives toggle). Reversible; never widens the existing status CHECK.';

COMMENT ON COLUMN public.arguments.inactive_by IS
  'Admin profile id that performed the most recent inactivation transition. ON DELETE SET NULL preserves audit history when an admin profile is purged.';

COMMENT ON COLUMN public.arguments.inactive_reason IS
  'Optional admin-authored free text. Admin-only surfaces (audit log, row detail). NEVER renders on the target argument''s public-facing node (doctrine 10a sensitive composer-only).';

-- ─────────────────────────────────────────────────────────────────
-- 2. Two partial indexes for the dominant predicate split.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX arguments_inactive_at_null_idx
  ON public.arguments (created_at DESC)
  WHERE inactive_at IS NULL;

CREATE INDEX arguments_inactive_at_set_idx
  ON public.arguments (inactive_at DESC)
  WHERE inactive_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 3. argument_inactive_audit — append-only audit table.
--    Mirrors admin_audit_events shape (subs argument_id for target_user_id).
--    NO UPDATE policy. NO DELETE policy. History is immutable.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.argument_inactive_audit (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id        uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  argument_id          uuid        NOT NULL REFERENCES public.arguments(id) ON DELETE CASCADE,
  previous_inactive_at timestamptz NULL,
  new_inactive_at      timestamptz NULL,
  reason               text        NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.argument_inactive_audit IS
  'Append-only audit log of argument inactive/active transitions performed by admins. Read-only for non-admins; no UPDATE / no DELETE policy; admins cannot modify history. Body is never stored here — only the transition timestamps, optional admin reason, and actor.';

CREATE INDEX argument_inactive_audit_actor_created_idx
  ON public.argument_inactive_audit (actor_user_id, created_at DESC);
CREATE INDEX argument_inactive_audit_argument_created_idx
  ON public.argument_inactive_audit (argument_id, created_at DESC);

ALTER TABLE public.argument_inactive_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read; service_role bypasses RLS for Edge Function writes.
CREATE POLICY "argument_inactive_audit: admins can select"
  ON public.argument_inactive_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can insert via direct client only if they pass is_admin (defense in depth);
-- in practice all inserts go through the admin-users Edge Function with service_role.
CREATE POLICY "argument_inactive_audit: admins can insert"
  ON public.argument_inactive_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- No UPDATE / DELETE policy → admins (non-service-role) cannot rewrite history.

-- ─────────────────────────────────────────────────────────────────
-- 4. arguments SELECT — qol_039 DROP+CREATE successor.
--
--    The existing SELECT policy
--      "arguments: select own, participant-private, or posted-public"
--    (from 20260524000015_qol_039_room_visibility.sql:236-252) is replaced
--    by a successor that wraps every NON-admin arm with `inactive_at IS NULL`.
--    The admin/moderator arm intentionally has NO `inactive_at` predicate
--    (admins always read all rows; that is the entire point of Show inactives).
--
--    Per operator-decision #4 (conservative default): the author arm is
--    ALSO gated on `inactive_at IS NULL` — an author cannot see their own
--    inactive row by default. They only see it via the admin Show-inactives
--    toggle (if they are an admin), otherwise it is invisible.
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "arguments: select own, participant-private, or posted-public" ON public.arguments;
DROP POLICY IF EXISTS "arguments: select active for own/participant/public; admins read all" ON public.arguments;

CREATE POLICY "arguments: select active for own/participant/public; admins read all"
ON public.arguments
FOR SELECT
TO authenticated
USING (
  -- Admin / moderator arm — unrestricted. (This is the existing arm preserved.)
  is_moderator_or_admin()
  -- Author's own active rows (drafts + posted). Conservative posture: an
  -- author cannot see their own inactive row by default.
  OR (author_id = auth.uid() AND inactive_at IS NULL)
  -- Posted public-room / participant arms — both gated on inactive_at IS NULL.
  OR (
    status = 'posted'
    AND inactive_at IS NULL
    AND (
      public.is_debate_open_or_locked_public(debate_id)
      OR public.is_debate_participant(debate_id, auth.uid())
    )
  )
);

COMMENT ON POLICY "arguments: select active for own/participant/public; admins read all"
  ON public.arguments IS
  'Successor of qol_039 arguments SELECT policy. Same three arms, every non-admin arm gated on inactive_at IS NULL. Admin/moderator arm unrestricted (admins always read all rows).';
