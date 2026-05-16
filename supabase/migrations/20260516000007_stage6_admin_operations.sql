-- ============================================================
-- Migration: 20260516000007_stage6_admin_operations
-- Description: Admin operations foundation — audit, block rules, bot registry,
--              and the is_admin() helper. RLS enforces admin-only access.
--
-- Notes:
--   - profiles.role = 'admin' is the authoritative app-level admin flag.
--   - This migration does NOT hard-code any personal email.
--     Promote your dev admin manually via SQL Editor; see
--     docs/admin-bootstrap.md and scripts/admin/bootstrap-admin.sql.template.
--   - service_role bypasses RLS on these tables for Edge Function operations.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- is_admin() — narrow admin-only check, complements is_moderator_or_admin().
-- SECURITY DEFINER + fixed search_path prevents privilege escalation.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Returns true if the given user (default auth.uid()) has profiles.role = admin. Used in admin-only RLS and Edge Functions.';

-- ──────────────────────────────────────────────────────────────
-- admin_audit_events — every admin action records a row here.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.admin_audit_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id       uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id      uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_auth_user_id uuid        NULL,
  action              text        NOT NULL,
  reason              text        NULL,
  source              text        NOT NULL CHECK (source IN ('admin_ui', 'edge_function', 'sql_editor', 'system')),
  payload             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_audit_events IS 'Audit log of admin actions. Read-only for non-admins; admins can select but never delete.';
COMMENT ON COLUMN public.admin_audit_events.action IS 'Whitelisted action code (e.g. update_role, view_as_snapshot, add_block, etc.). Validated client-side and in Edge Function.';
COMMENT ON COLUMN public.admin_audit_events.source IS 'Where the action originated: admin_ui (via Edge Function), edge_function (internal), sql_editor (manual), system (automated).';

CREATE INDEX admin_audit_events_actor_created_idx
  ON public.admin_audit_events (actor_user_id, created_at DESC);
CREATE INDEX admin_audit_events_target_created_idx
  ON public.admin_audit_events (target_user_id, created_at DESC);
CREATE INDEX admin_audit_events_action_created_idx
  ON public.admin_audit_events (action, created_at DESC);

ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read; service_role bypasses RLS.
CREATE POLICY "admin_audit_events: admins can select"
  ON public.admin_audit_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can insert via direct client only if they pass is_admin (defense in depth);
-- in practice all inserts go through the admin-users Edge Function with service_role.
CREATE POLICY "admin_audit_events: admins can insert"
  ON public.admin_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- No update/delete policies → admins (non-service-role) cannot modify history.

-- ──────────────────────────────────────────────────────────────
-- admin_block_rules — app-level block rules for email/domain/IP/profile.
-- NOTE: Full Supabase Auth pre-login enforcement is a later stage.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.admin_block_rules (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type       text        NOT NULL CHECK (block_type IN ('email', 'email_domain', 'ip', 'ip_cidr', 'profile')),
  value            text        NOT NULL,
  normalized_value text        NOT NULL,
  reason           text        NULL,
  active           boolean     NOT NULL DEFAULT true,
  created_by       uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  lifted_by        uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  lifted_at        timestamptz NULL,
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.admin_block_rules IS 'App-level block rules. Email/domain/IP/profile. Unblock by setting active=false; rows are never deleted.';
COMMENT ON COLUMN public.admin_block_rules.normalized_value IS 'Lower-cased email/domain, trimmed IP, or canonicalized CIDR for uniqueness/lookup.';

CREATE INDEX admin_block_rules_type_value_idx
  ON public.admin_block_rules (block_type, normalized_value);
CREATE INDEX admin_block_rules_active_created_idx
  ON public.admin_block_rules (active, created_at DESC);

-- Unique active rule per (type, value) — partial unique index prevents duplicate active blocks.
CREATE UNIQUE INDEX admin_block_rules_unique_active_idx
  ON public.admin_block_rules (block_type, normalized_value)
  WHERE active = true;

ALTER TABLE public.admin_block_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_block_rules: admins can select"
  ON public.admin_block_rules
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_block_rules: admins can insert"
  ON public.admin_block_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_block_rules: admins can update"
  ON public.admin_block_rules
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- No delete policy by design — preserve history.

-- ──────────────────────────────────────────────────────────────
-- bot_user_registry — registry of bot/test users for dev/staging.
-- The auth.users row is created via Supabase Admin API in the Edge Function.
-- This table records the bot label/persona alongside the auth user.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.bot_user_registry (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  label        text        NOT NULL,
  persona      text        NULL,
  enabled      boolean     NOT NULL DEFAULT true,
  created_by   uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.bot_user_registry IS 'Registry of bot/test users. The actual auth identity lives in auth.users; this table tracks bot metadata.';
COMMENT ON COLUMN public.bot_user_registry.enabled IS 'Whether the bot account is currently enabled for use. Disabling here does not disable auth — that requires Auth admin update.';

CREATE INDEX bot_user_registry_label_idx ON public.bot_user_registry (lower(label));
CREATE INDEX bot_user_registry_auth_user_idx ON public.bot_user_registry (auth_user_id);

ALTER TABLE public.bot_user_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_user_registry: admins can select"
  ON public.bot_user_registry
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "bot_user_registry: admins can insert"
  ON public.bot_user_registry
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "bot_user_registry: admins can update"
  ON public.bot_user_registry
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- No delete policy by design.

-- ──────────────────────────────────────────────────────────────
-- End of migration.
-- ──────────────────────────────────────────────────────────────
