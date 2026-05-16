-- ============================================================
-- Migration: 20260516000002_rls_policies
-- Description: Row Level Security policies for all user-facing tables.
--
-- Security model summary:
--   - authenticated role = any logged-in Supabase user
--   - service_role = Supabase server (Edge Functions using service key)
--     bypasses RLS entirely; no explicit policies needed for it
--   - anon role = unauthenticated; blocked from all tables
--   - Moderator/admin check via is_moderator_or_admin() helper
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Helper: check if the calling user is a moderator or admin.
-- SECURITY DEFINER + fixed search_path prevents privilege escalation.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
  )
$$;

COMMENT ON FUNCTION public.is_moderator_or_admin() IS 'Returns true if the calling user has role moderator or admin. Used in RLS policies.';

-- ──────────────────────────────────────────────────────────────
-- Enable RLS on every user-facing table.
-- service_role bypasses RLS; anon is blocked by default.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_definitions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flag_definitions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debates                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_participants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arguments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argument_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.argument_flags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_satisfaction_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_submissions         ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────────────────────

-- All authenticated users can read all profiles (display names, roles needed for UI).
CREATE POLICY "profiles: authenticated can read all"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- The auth trigger inserts profile rows, but users may also upsert their own.
CREATE POLICY "profiles: users can insert own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Users update their own display_name; mods/admins can update any row.
-- Role escalation by users is prevented at the application layer and Edge Function level.
CREATE POLICY "profiles: users update own; mods update any"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() OR is_moderator_or_admin())
WITH CHECK (id = auth.uid() OR is_moderator_or_admin());

-- ──────────────────────────────────────────────────────────────
-- constitution_versions + constitution_rules
-- Read-only for all authenticated users. Write requires admin.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "constitution_versions: authenticated read"
ON public.constitution_versions FOR SELECT
TO authenticated
USING (true);

-- Admins can insert new versions; no UPDATE/DELETE (append-only).
CREATE POLICY "constitution_versions: admin insert"
ON public.constitution_versions FOR INSERT
TO authenticated
WITH CHECK (is_moderator_or_admin());

CREATE POLICY "constitution_rules: authenticated read"
ON public.constitution_rules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "constitution_rules: admin insert"
ON public.constitution_rules FOR INSERT
TO authenticated
WITH CHECK (is_moderator_or_admin());

CREATE POLICY "constitution_rules: admin update"
ON public.constitution_rules FOR UPDATE
TO authenticated
USING (is_moderator_or_admin())
WITH CHECK (is_moderator_or_admin());

-- ──────────────────────────────────────────────────────────────
-- tag_definitions + flag_definitions
-- Reference tables: read for all, write for admins.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "tag_definitions: authenticated read"
ON public.tag_definitions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "tag_definitions: admin write"
ON public.tag_definitions FOR ALL
TO authenticated
USING (is_moderator_or_admin())
WITH CHECK (is_moderator_or_admin());

CREATE POLICY "flag_definitions: authenticated read"
ON public.flag_definitions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "flag_definitions: admin write"
ON public.flag_definitions FOR ALL
TO authenticated
USING (is_moderator_or_admin())
WITH CHECK (is_moderator_or_admin());

-- ──────────────────────────────────────────────────────────────
-- debates
-- SELECT: open debates visible to all authenticated users.
--         Draft debates visible only to creator or mods.
--         Participants can see debates they're part of.
-- INSERT: any authenticated user can create a debate.
-- UPDATE: creator or moderator/admin.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "debates: select open, own, or participant"
ON public.debates FOR SELECT
TO authenticated
USING (
  status = 'open'
  OR status = 'locked'  -- locked debates remain readable
  OR created_by = auth.uid()
  OR is_moderator_or_admin()
  OR EXISTS (
    SELECT 1 FROM public.debate_participants
    WHERE debate_id = id AND user_id = auth.uid()
  )
);

CREATE POLICY "debates: authenticated can create"
ON public.debates FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "debates: creator or mod can update"
ON public.debates FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR is_moderator_or_admin())
WITH CHECK (created_by = auth.uid() OR is_moderator_or_admin());

-- ──────────────────────────────────────────────────────────────
-- debate_participants
-- SELECT: own membership always visible; others visible in open debates.
-- INSERT: users join debates as themselves.
-- DELETE: users can leave; mods can remove anyone.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "debate_participants: select own or open debate"
ON public.debate_participants FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_moderator_or_admin()
  OR EXISTS (
    SELECT 1 FROM public.debates
    WHERE id = debate_id AND status IN ('open', 'locked')
  )
);

-- Users may only join debates that are open or draft (not locked/archived).
CREATE POLICY "debate_participants: users join as themselves"
ON public.debate_participants FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.debates
    WHERE id = debate_id AND status IN ('draft', 'open')
  )
);

CREATE POLICY "debate_participants: users leave; mods remove"
ON public.debate_participants FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR is_moderator_or_admin());

-- ──────────────────────────────────────────────────────────────
-- arguments
-- SELECT: posted arguments in open/locked debates.
--         Authors always see their own (including drafts).
-- INSERT: authenticated users insert as themselves.
-- UPDATE: authors update their own (e.g. draft → posted, body edit).
--         Mods can update status on any argument.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "arguments: select posted in readable debates or own"
ON public.arguments FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR is_moderator_or_admin()
  OR (
    status = 'posted'
    AND EXISTS (
      SELECT 1 FROM public.debates
      WHERE id = debate_id AND status IN ('open', 'locked')
    )
  )
);

CREATE POLICY "arguments: insert as self"
ON public.arguments FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

CREATE POLICY "arguments: authors update own; mods update any"
ON public.arguments FOR UPDATE
TO authenticated
USING (author_id = auth.uid() OR is_moderator_or_admin())
WITH CHECK (author_id = auth.uid() OR is_moderator_or_admin());

-- ──────────────────────────────────────────────────────────────
-- argument_tags
-- Mirrors argument visibility + authorship.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "argument_tags: select with argument"
ON public.argument_tags FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.arguments a
    WHERE a.id = argument_id
      AND (
        a.author_id = auth.uid()
        OR is_moderator_or_admin()
        OR (a.status = 'posted' AND EXISTS (
          SELECT 1 FROM public.debates d
          WHERE d.id = a.debate_id AND d.status IN ('open', 'locked')
        ))
      )
  )
);

CREATE POLICY "argument_tags: insert by argument author or mod"
ON public.argument_tags FOR INSERT
TO authenticated
WITH CHECK (
  (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.arguments
      WHERE id = argument_id AND author_id = auth.uid()
    )
  )
  OR is_moderator_or_admin()
);

CREATE POLICY "argument_tags: delete by argument author or mod"
ON public.argument_tags FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR is_moderator_or_admin()
);

-- ──────────────────────────────────────────────────────────────
-- argument_flags
-- SELECT: authors see flags on their own arguments; mods see all.
-- INSERT:
--   - user_report flags: any authenticated user can file (created_by = auth.uid()).
--   - server_rules / semantic_adapter / moderator: service_role bypasses RLS; handled by Edge Functions.
--   - client_rules flags: same as user_report (client-submitted, non-authoritative).
-- UPDATE: mods can update status/resolved_at; users cannot.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "argument_flags: authors and mods can read"
ON public.argument_flags FOR SELECT
TO authenticated
USING (
  is_moderator_or_admin()
  OR EXISTS (
    SELECT 1 FROM public.arguments
    WHERE id = argument_id AND author_id = auth.uid()
  )
  -- Participants can see flags on arguments in debates they joined
  OR EXISTS (
    SELECT 1 FROM public.debate_participants
    WHERE debate_id = argument_flags.debate_id AND user_id = auth.uid()
  )
);

-- Users may only insert user_report or client_rules flags as themselves.
-- server_rules / semantic_adapter flags come from Edge Functions (service role, bypasses RLS).
CREATE POLICY "argument_flags: users insert reports and client flags"
ON public.argument_flags FOR INSERT
TO authenticated
WITH CHECK (
  source IN ('user_report', 'client_rules')
  AND created_by = auth.uid()
);

-- Only moderators/admins update flags (e.g. promote to needs_review, dismiss).
CREATE POLICY "argument_flags: mods can update"
ON public.argument_flags FOR UPDATE
TO authenticated
USING (is_moderator_or_admin())
WITH CHECK (is_moderator_or_admin());

-- ──────────────────────────────────────────────────────────────
-- topic_satisfaction_checks
-- Inserted by Edge Functions (service role, bypasses RLS).
-- Read by debate participants and mods.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "topic_checks: participants and mods can read"
ON public.topic_satisfaction_checks FOR SELECT
TO authenticated
USING (
  is_moderator_or_admin()
  OR EXISTS (
    SELECT 1 FROM public.debate_participants
    WHERE debate_id = topic_satisfaction_checks.debate_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.arguments
    WHERE id = topic_satisfaction_checks.argument_id AND author_id = auth.uid()
  )
);

-- Edge Functions use service_role → bypasses RLS. No authenticated INSERT policy needed.
-- Adding a safety policy in case of misconfigured client:
CREATE POLICY "topic_checks: no direct authenticated insert"
ON public.topic_satisfaction_checks FOR INSERT
TO authenticated
WITH CHECK (false);

-- ──────────────────────────────────────────────────────────────
-- moderation_reviews
-- Only moderators/admins can read and write.
-- Rows are never updated or deleted (audit trail).
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "moderation_reviews: mods read"
ON public.moderation_reviews FOR SELECT
TO authenticated
USING (is_moderator_or_admin());

CREATE POLICY "moderation_reviews: mods insert"
ON public.moderation_reviews FOR INSERT
TO authenticated
WITH CHECK (
  is_moderator_or_admin()
  AND reviewer_id = auth.uid()
);

-- ──────────────────────────────────────────────────────────────
-- audio_submissions
-- Users can see their own submissions. Mods can see all.
-- Users insert their own. Service_role updates transcript status.
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "audio_submissions: own or mod"
ON public.audio_submissions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_moderator_or_admin());

CREATE POLICY "audio_submissions: users insert own"
ON public.audio_submissions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Transcript status updates come from Edge Functions (service_role, bypasses RLS).
-- Users can update storage_path or other metadata on their own uploaded rows (before processing).
CREATE POLICY "audio_submissions: users update own pre-processing"
ON public.audio_submissions FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND transcript_status = 'uploaded')
WITH CHECK (user_id = auth.uid());
