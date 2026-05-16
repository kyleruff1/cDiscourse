-- ============================================================
-- Migration: 20260516000005_stage5_session_scalability
-- Description: debate_user_state table for server-side viewport
--   persistence, client_submission_id for idempotent argument
--   submission, and scalability indexes for tree queries.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Idempotent submission support on arguments
-- ──────────────────────────────────────────────────────────────
-- client_submission_id is a client-generated UUID sent with each
-- submit-argument call. The unique index prevents duplicate inserts
-- after retry or reconnect. Always scoped to author_id so a UUID
-- cannot collide across users.
ALTER TABLE public.arguments
  ADD COLUMN IF NOT EXISTS client_submission_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_arguments_author_client_submission_id
  ON public.arguments (author_id, client_submission_id)
  WHERE client_submission_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 2. debate_user_state — per-user viewport state per debate
-- ──────────────────────────────────────────────────────────────
-- Stores the user's last known focused argument, expanded/collapsed
-- nodes, read cursor, and arbitrary viewport JSON. Synced from the
-- client on navigation events; used to resume the session after
-- reopening the app.
CREATE TABLE IF NOT EXISTS public.debate_user_state (
  debate_id              uuid          NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id                uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  focused_argument_id    uuid          NULL REFERENCES public.arguments(id) ON DELETE SET NULL,
  selected_parent_id     uuid          NULL REFERENCES public.arguments(id) ON DELETE SET NULL,
  participant_side       text          NULL
                         CHECK (participant_side IN ('affirmative', 'negative', 'observer', 'moderator')),
  expanded_argument_ids  uuid[]        NOT NULL DEFAULT '{}',
  collapsed_argument_ids uuid[]        NOT NULL DEFAULT '{}',
  last_seen_argument_id  uuid          NULL REFERENCES public.arguments(id) ON DELETE SET NULL,
  last_read_at           timestamptz   NULL,
  viewport_payload       jsonb         NOT NULL DEFAULT '{}',
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (debate_id, user_id)
);

COMMENT ON TABLE  public.debate_user_state IS
  'Per-user viewport state for a debate. Used for session recovery and argument tree navigation.';
COMMENT ON COLUMN public.debate_user_state.expanded_argument_ids IS
  'Arguments the user explicitly expanded; used to restore viewport without re-fetching all children.';
COMMENT ON COLUMN public.debate_user_state.viewport_payload IS
  'Catch-all JSONB for future viewport fields without schema migrations.';

-- Auto-stamp updated_at on change.
CREATE TRIGGER set_debate_user_state_updated_at
  BEFORE UPDATE ON public.debate_user_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 3. RLS — debate_user_state
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.debate_user_state ENABLE ROW LEVEL SECURITY;

-- Users manage their own state only.
CREATE POLICY "users_select_own_debate_state"
  ON public.debate_user_state
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_debate_state"
  ON public.debate_user_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_debate_state"
  ON public.debate_user_state
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 4. Scalability indexes
-- ──────────────────────────────────────────────────────────────
-- Tree loading: fetch direct children for a parent (or root) within
-- a debate, ordered by creation time.
CREATE INDEX IF NOT EXISTS idx_arguments_tree_window
  ON public.arguments (debate_id, parent_id, status, created_at);

-- Flat recent-arguments query (e.g. "new arguments" feed).
CREATE INDEX IF NOT EXISTS idx_arguments_debate_recent
  ON public.arguments (debate_id, status, created_at);

-- Argument tag lookup (used when rendering argument nodes).
CREATE INDEX IF NOT EXISTS idx_argument_tags_argument
  ON public.argument_tags (argument_id);

-- Flag lookup by argument (used in flags panel).
CREATE INDEX IF NOT EXISTS idx_argument_flags_argument_status
  ON public.argument_flags (argument_id, status);

-- Topic satisfaction latest check per argument.
CREATE INDEX IF NOT EXISTS idx_topic_checks_argument_recent
  ON public.topic_satisfaction_checks (argument_id, created_at DESC);

-- Participant lookup (used in Edge Function auth check).
CREATE INDEX IF NOT EXISTS idx_debate_participants_user
  ON public.debate_participants (user_id, debate_id);

-- User state lookup sorted by recency (used for "resume debate" list).
CREATE INDEX IF NOT EXISTS idx_debate_user_state_user_recent
  ON public.debate_user_state (user_id, updated_at DESC);
