-- ============================================================
-- Migration: 20260522000011_admin_ai_001_semantic_referee_runtime_config
-- Card: ADMIN-AI-001 — Admin runtime provider-mode switch for the
--       semantic referee (Epic 12 — Rules UX; builds on MCP-016 / MCP-017).
--
-- Description:
--   Moves the semantic-referee provider mode from a function env var
--   (`SEMANTIC_REFEREE_PROVIDER`) to a persisted admin-controlled runtime
--   setting. An authenticated admin can switch the effective provider mode
--   (anthropic / mock / fixture; mcp reserved-but-disabled) with no env-var
--   edit and no redeploy.
--
--   Provider resolution hierarchy (first non-null wins):
--     1. This DB config (the singleton row below).
--     2. SEMANTIC_REFEREE_PROVIDER env var (the existing MCP-016 lookup,
--        with its `?? 'mock'` code fallback — UNCHANGED).
--     3. Code fallback `mock`.
--
--   The Edge Function reads this config via the SECURITY DEFINER function
--   `get_semantic_referee_runtime_config()` (three safe fields only — never
--   `updated_by`, never audit history, never any secret).
--
-- Doctrine:
--   - Both tables have RLS enabled (cdiscourse-doctrine §8).
--   - The audit table is append-only — no UPDATE, no DELETE policy at all.
--   - The runtime-config row is a permanent singleton — no DELETE policy.
--   - SECURITY DEFINER functions use a locked `search_path` (no escalation).
--   - This migration is append-only; no existing migration is edited.
--   - service_role bypasses RLS for the admin-users Edge Function write.
--
-- Source of truth for `provider_mode` values: the registry slots in
-- supabase/functions/_shared/semanticReferee/types.ts (`ALL_SEMANTIC_PROVIDERS`).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- semantic_referee_runtime_config — the strongly-typed singleton.
--
-- Singleton guard: the primary key is pinned to a single literal value
-- (`id = true`). A second insert collides on the PK, so the table holds
-- exactly one row. The Edge Function always reads "the" row.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.semantic_referee_runtime_config (
  id              boolean     PRIMARY KEY DEFAULT true CHECK (id = true),
  provider_mode   text        NOT NULL DEFAULT 'anthropic'
                              CHECK (provider_mode IN ('anthropic', 'mock', 'fixture', 'mcp')),
  enabled         boolean     NOT NULL DEFAULT true,
  updated_by      uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.semantic_referee_runtime_config IS 'Singleton runtime config for the semantic-referee provider mode (ADMIN-AI-001). Exactly one row, id = true. The DB layer of the DB > env > code-fallback resolution hierarchy.';
COMMENT ON COLUMN public.semantic_referee_runtime_config.provider_mode IS 'Effective provider slot: anthropic | mock | fixture | mcp. Mirrors ALL_SEMANTIC_PROVIDERS in supabase/functions/_shared/semanticReferee/types.ts. mcp is reserved (MCP-018) — not settable from the admin UI.';
COMMENT ON COLUMN public.semantic_referee_runtime_config.enabled IS 'Runtime off-switch. false → the semantic referee layer is disabled regardless of provider_mode or the SEMANTIC_REFEREE_ENABLED env var.';
COMMENT ON COLUMN public.semantic_referee_runtime_config.updated_by IS 'The admin who last changed the config. Resolved to a display name in the UI — never an email.';

ALTER TABLE public.semantic_referee_runtime_config ENABLE ROW LEVEL SECURITY;

-- Admin read. The singleton is the only row; service_role bypasses RLS for
-- the Edge Function update.
CREATE POLICY "semantic_referee_runtime_config: admins can select"
  ON public.semantic_referee_runtime_config
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "semantic_referee_runtime_config: admins can update"
  ON public.semantic_referee_runtime_config
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- No INSERT policy: the singleton row is created by the migration seed only.
-- No DELETE policy: the row is permanent.

-- ──────────────────────────────────────────────────────────────
-- semantic_referee_config_audit — append-only provider-mode change history.
--
-- A dedicated audit table (not admin_audit_events): a provider-mode change
-- has no target user and a distinct shape (old → new mode). Stores codes,
-- never prose, never secrets, never any API-key state.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.semantic_referee_config_audit (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id    uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_mode    text        NULL,        -- null on the very first change
  new_mode         text        NOT NULL,
  previous_enabled boolean     NULL,
  new_enabled      boolean     NOT NULL,
  reason           text        NULL,        -- optional admin-supplied note
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.semantic_referee_config_audit IS 'Append-only audit of semantic-referee provider-mode changes (ADMIN-AI-001). Records which mode, never whether a provider key is present. No UPDATE / DELETE policy — history is immutable.';

CREATE INDEX semantic_referee_config_audit_created_idx
  ON public.semantic_referee_config_audit (created_at DESC);

ALTER TABLE public.semantic_referee_config_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "semantic_referee_config_audit: admins can select"
  ON public.semantic_referee_config_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin INSERT (defense-in-depth); real inserts go through the admin-users
-- Edge Function with service_role.
CREATE POLICY "semantic_referee_config_audit: admins can insert"
  ON public.semantic_referee_config_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- No UPDATE, no DELETE policy at all — audit history is immutable.

-- ──────────────────────────────────────────────────────────────
-- get_semantic_referee_runtime_config() — the narrow read surface the
-- semantic-referee Edge Function calls.
--
-- Returns ONLY the three safe runtime fields — never updated_by, never
-- audit history, never anything secret. SECURITY DEFINER so the
-- caller-scoped (non-admin-context) client can read the singleton row even
-- though the table's RLS restricts direct SELECT to admins; this is the
-- single controlled read path and exposes only non-sensitive state.
-- The locked search_path blocks the privilege-escalation footgun.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_semantic_referee_runtime_config()
RETURNS TABLE (provider_mode text, enabled boolean, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT provider_mode, enabled, updated_at
  FROM public.semantic_referee_runtime_config
  WHERE id = true
$$;

REVOKE ALL ON FUNCTION public.get_semantic_referee_runtime_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_semantic_referee_runtime_config() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_semantic_referee_runtime_config() IS 'Returns the three safe runtime fields of the semantic-referee config singleton (provider_mode, enabled, updated_at). SECURITY DEFINER read path for the semantic-referee Edge Function — never exposes updated_by, audit history, or any secret.';

-- ──────────────────────────────────────────────────────────────
-- Seed the singleton row.
--
-- provider_mode = 'anthropic', enabled = true (ADMIN-AI-001 decision #3):
-- MCP-017's live anthropic provider is already merged + deployed on the
-- dev/test project, so seeding 'anthropic' makes the desired runtime state
-- live immediately with zero extra operator action. The *code* fallback
-- stays 'mock' (in providerRoutingCore.ts, UNCHANGED) — only this seed row
-- is 'anthropic'. A conservative production project flips the row to 'mock'
-- via the admin UI (one click) after deploy.
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.semantic_referee_runtime_config (id, provider_mode, enabled)
VALUES (true, 'anthropic', true);

-- ──────────────────────────────────────────────────────────────
-- End of migration.
-- ──────────────────────────────────────────────────────────────
