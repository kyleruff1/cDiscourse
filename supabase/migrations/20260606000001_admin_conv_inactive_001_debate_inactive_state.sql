-- ============================================================
-- Migration: 20260606000001_admin_conv_inactive_001_debate_inactive_state
-- Card:        ADMIN-CONV-INACTIVE-001 (issue #502)
-- Doctrine:    "fresh start = filtered view, not erasure."
--
-- The debate-level mirror of ADMIN-ARGS-INACTIVE-001 (#480). Adds a
-- reversible, admin-only per-debate inactive visibility state. A debate row
-- stays in `public.debates` exactly where it was; what changes is whether
-- non-admin SELECT policies return it AND (the cascade) whether non-admin
-- SELECT policies return its arguments.
--
-- This migration is strictly ADDITIVE:
--   1. Three nullable columns on `public.debates`
--      (`inactive_at`, `inactive_by`, `inactive_reason`).
--   2. Two partial indexes on `public.debates`.
--   3. A new audit table `public.debate_inactive_audit` (append-only).
--   4. A new `is_debate_inactive(uuid)` SECURITY DEFINER helper (the cascade
--      chokepoint, recursion-safe like `is_debate_open_or_locked_public`).
--   5. A successor SELECT policy on `public.debates` (qol_039 DROP+CREATE).
--   6. A successor SELECT policy on `public.arguments` that ANDs the cascade
--      gate `NOT public.is_debate_inactive(debate_id)` into every non-admin
--      arm (composing with the per-argument `inactive_at IS NULL` gate from
--      #480; neither gate overrides the other).
--
-- The migration:
--   - DOES NOT widen the existing `status` CHECK on `public.debates`
--     (the pre-existing terminal `status` lifecycle value only gates joining
--     — it does NOT hide a debate from non-admin SELECT; the orthogonal
--     `inactive_at` axis is what hides it).
--   - DOES NOT edit any prior migration file.
--   - DOES NOT hard-erase any row.
--   - DOES NOT touch INSERT / UPDATE policies on `public.debates`.
--   - DOES NOT modify the shared `is_debate_open_or_locked_public` /
--     `is_debate_participant` helpers (narrow-new-helper precedent).
--   - DOES NOT store the debate title/resolution or any argument body.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. Three additive columns on public.debates (all NULLABLE).
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.debates
  ADD COLUMN inactive_at     timestamptz NULL,
  ADD COLUMN inactive_by     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN inactive_reason text        NULL;

COMMENT ON COLUMN public.debates.inactive_at IS
  'Lifecycle visibility state. NULL = active (default views include it). NOT NULL = inactive (default views exclude the debate AND its arguments for non-admins; admin-only via Show inactives). Reversible; never widens the existing status CHECK.';

COMMENT ON COLUMN public.debates.inactive_by IS
  'Admin profile id that performed the most recent inactivation transition. ON DELETE SET NULL preserves audit history when an admin profile is purged.';

COMMENT ON COLUMN public.debates.inactive_reason IS
  'Optional admin-authored free text. Admin-only surfaces (audit log only). NEVER renders on any public / author / participant surface (doctrine 10a).';

-- ─────────────────────────────────────────────────────────────────
-- 2. Two partial indexes for the dominant predicate split.
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX debates_inactive_at_null_idx
  ON public.debates (created_at DESC)
  WHERE inactive_at IS NULL;

CREATE INDEX debates_inactive_at_set_idx
  ON public.debates (inactive_at DESC)
  WHERE inactive_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 3. debate_inactive_audit — append-only audit table.
--    Mirrors argument_inactive_audit (subs debate_id for argument_id).
--    NO UPDATE policy. NO DELETE policy. History is immutable. Body /
--    title / resolution are NEVER stored here — only the transition
--    timestamps, optional admin reason, and actor.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.debate_inactive_audit (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id        uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  debate_id            uuid        NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  previous_inactive_at timestamptz NULL,
  new_inactive_at      timestamptz NULL,
  reason               text        NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.debate_inactive_audit IS
  'Append-only audit log of debate inactive/active transitions performed by admins. Read-only for non-admins; no UPDATE / no DELETE policy; admins cannot modify history. Debate title/resolution and argument bodies are never stored here — only the transition timestamps, optional admin reason, and actor.';

CREATE INDEX debate_inactive_audit_actor_created_idx
  ON public.debate_inactive_audit (actor_user_id, created_at DESC);
CREATE INDEX debate_inactive_audit_debate_created_idx
  ON public.debate_inactive_audit (debate_id, created_at DESC);

ALTER TABLE public.debate_inactive_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read; service_role bypasses RLS for Edge Function writes.
CREATE POLICY "debate_inactive_audit: admins can select"
  ON public.debate_inactive_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can insert via direct client only if they pass is_admin (defense in
-- depth); in practice all inserts go through the admin-users Edge Function
-- with service_role.
CREATE POLICY "debate_inactive_audit: admins can insert"
  ON public.debate_inactive_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- No UPDATE / DELETE policy → admins (non-service-role) cannot rewrite history.

-- ─────────────────────────────────────────────────────────────────
-- 4. is_debate_inactive(uuid) — the cascade helper.
--
--    SECURITY DEFINER bypasses RLS on `debates` to avoid the
--    arguments<->debates policy recursion that 20260516000006 was written
--    to fix. The arguments SELECT policy already calls SECURITY DEFINER
--    helpers (is_debate_open_or_locked_public / is_debate_participant) to
--    read debates/debate_participants without triggering their RLS; a raw
--    EXISTS (SELECT 1 FROM public.debates ...) inside the arguments policy
--    would re-introduce that recursion risk. This helper keeps the policy
--    a flat boolean expression.
--
--    Sibling-helper precedent (qol_039 added is_debate_open_or_locked_public
--    rather than mutating is_debate_open_or_locked): a narrow new helper,
--    composed in exactly the two policies below, has a surgical blast radius.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_debate_inactive(p_debate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.debates d
    WHERE d.id = p_debate_id AND d.inactive_at IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.is_debate_inactive(uuid) IS
  'Returns true if the debate is inactive (inactive_at IS NOT NULL). SECURITY DEFINER bypasses RLS on debates to avoid arguments<->debates policy recursion (same pattern as is_debate_open_or_locked_public).';

REVOKE ALL ON FUNCTION public.is_debate_inactive(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_debate_inactive(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 5. debates SELECT — qol_039 DROP+CREATE successor.
--
--    The current canonical policy
--      "debates: select public-open, own, or participant"
--    (from 20260524000015_qol_039_room_visibility.sql:189-198) is replaced
--    by a successor that gates every NON-admin arm on `inactive_at IS NULL`.
--    The admin/moderator arm intentionally has NO `inactive_at` predicate
--    (admins always read all rows; that is the entire point of Show inactives).
--
--    Conservative posture (operator-decision #1, mirrors the argument card's
--    op-decision #4): the creator arm AND the participant arm are BOTH gated
--    on `inactive_at IS NULL` — a creator/participant of an inactive room
--    cannot see it by default; they get a not-found experience. The "public"
--    arm preserves the live policy's inline form
--    (visibility = 'public' AND status IN ('open','locked')) verbatim and
--    only appends `AND inactive_at IS NULL`.
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "debates: select public-open, own, or participant" ON public.debates;
DROP POLICY IF EXISTS "debates: select active public-open, own, or participant; admins read all" ON public.debates;

CREATE POLICY "debates: select active public-open, own, or participant; admins read all"
ON public.debates
FOR SELECT
TO authenticated
USING (
  -- Admin / moderator arm — unrestricted (the entire point of Show inactives).
  is_moderator_or_admin()
  -- Creator's own ACTIVE rooms. Conservative posture (mirrors argument
  -- card op-decision #4): a creator cannot see their own inactive room.
  OR (created_by = auth.uid() AND inactive_at IS NULL)
  -- Participant of an ACTIVE room (covers private rooms the participant joined).
  OR (public.is_debate_participant(id, auth.uid()) AND inactive_at IS NULL)
  -- Public open/locked ACTIVE room — any authenticated user.
  OR (visibility = 'public' AND status IN ('open', 'locked') AND inactive_at IS NULL)
);

COMMENT ON POLICY "debates: select active public-open, own, or participant; admins read all"
  ON public.debates IS
  'Successor of qol_039 debates SELECT policy. Same arms, every non-admin arm gated on inactive_at IS NULL (conservative posture: creator/participant cannot see their own inactive room). Admin/moderator arm unrestricted.';

-- ─────────────────────────────────────────────────────────────────
-- 6. arguments SELECT — THE CASCADE.
--
--    The current canonical policy is the per-argument inactive successor
--      "arguments: select active for own/participant/public; admins read all"
--    (from 20260604000001:114-133). This card replaces it with a successor
--    that ANDs `NOT public.is_debate_inactive(debate_id)` into EVERY
--    non-admin arm. The per-argument `inactive_at IS NULL` gate from #480 is
--    preserved verbatim on each non-admin arm. Both gates compose with AND —
--    neither overrides the other.
--
--    Composition (non-admin caller who otherwise satisfies an arm):
--      arg.inactive_at NULL  + debate.inactive_at NULL     -> readable
--      arg.inactive_at SET   + debate.inactive_at NULL     -> hidden (arg gate)
--      arg.inactive_at NULL  + debate.inactive_at SET      -> hidden (cascade)
--      arg.inactive_at SET   + debate.inactive_at SET      -> hidden (both)
--    Admin/moderator: readable in all four cells (no predicate on the admin arm).
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "arguments: select active for own/participant/public; admins read all" ON public.arguments;
DROP POLICY IF EXISTS "arguments: select active for own/participant/public; active debate; admins read all" ON public.arguments;

CREATE POLICY "arguments: select active for own/participant/public; active debate; admins read all"
ON public.arguments
FOR SELECT
TO authenticated
USING (
  -- Admin / moderator arm — unrestricted. Admins read every argument of
  -- every debate, inactive debate or not, inactive argument or not.
  is_moderator_or_admin()
  -- Author's own active argument in an ACTIVE debate. Conservative posture:
  -- an author cannot see their own inactive row, nor any row of an inactive
  -- debate, by default.
  OR (
    author_id = auth.uid()
    AND inactive_at IS NULL
    AND NOT public.is_debate_inactive(debate_id)
  )
  -- Posted public-room / participant arms — argument active AND parent
  -- debate active (THE CASCADE).
  OR (
    status = 'posted'
    AND inactive_at IS NULL
    AND NOT public.is_debate_inactive(debate_id)
    AND (
      public.is_debate_open_or_locked_public(debate_id)
      OR public.is_debate_participant(debate_id, auth.uid())
    )
  )
);

COMMENT ON POLICY "arguments: select active for own/participant/public; active debate; admins read all"
  ON public.arguments IS
  'Successor of the #480 arguments SELECT policy. Same three arms; every non-admin arm gated on BOTH the per-argument inactive_at IS NULL AND the cascade gate NOT is_debate_inactive(debate_id). Both gates compose with AND. Admin/moderator arm unrestricted (admins always read all rows).';
