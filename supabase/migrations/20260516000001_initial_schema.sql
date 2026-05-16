-- ============================================================
-- Migration: 20260516000001_initial_schema
-- Description: All core tables, triggers, and helper functions.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Helper: updated_at auto-stamp
-- Reused by any table that has an updated_at column.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- profiles
-- Extended user data keyed to Supabase auth.users.
-- One row per authenticated user; created automatically on signup.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  role         text        NOT NULL DEFAULT 'user'
                           CHECK (role IN ('user', 'moderator', 'admin')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles              IS 'Extended user data keyed to auth.users. One row per user.';
COMMENT ON COLUMN public.profiles.role         IS 'user = regular participant; moderator = can review flags; admin = full access.';

-- Auto-create profile when auth.users row is inserted (e.g. after email confirm).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name', 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- constitution_versions
-- Versioned debate constitutions. Rooms (debates) pin to one version
-- at creation time and are never retroactively affected by upgrades.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.constitution_versions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text        NOT NULL UNIQUE,
  version    text        NOT NULL,
  title      text        NOT NULL,
  body_md    text        NOT NULL DEFAULT '',
  active     boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.constitution_versions        IS 'Versioned constitution documents. Rows are immutable once published; create a new version instead of editing.';
COMMENT ON COLUMN public.constitution_versions.slug   IS 'URL-safe identifier, e.g. constitution-v1.';
COMMENT ON COLUMN public.constitution_versions.active IS 'Only one constitution should be active at a time. New debates use the active version.';

-- ──────────────────────────────────────────────────────────────
-- constitution_rules
-- Individual rules within a constitution. The deterministic rules
-- engine and Edge Functions reference these by code.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.constitution_rules (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  constitution_id uuid    NOT NULL REFERENCES public.constitution_versions(id) ON DELETE CASCADE,
  code            text    NOT NULL UNIQUE,
  title           text    NOT NULL,
  description     text    NOT NULL DEFAULT '',
  rule_type       text    NOT NULL CHECK (rule_type IN (
                            'transition', 'topic_satisfaction', 'evidence',
                            'civility', 'structure', 'rate_limit', 'length', 'review'
                          )),
  severity        text    NOT NULL CHECK (severity IN ('info', 'warning', 'review', 'blocking')),
  params          jsonb   NOT NULL DEFAULT '{}',
  enabled         boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE  public.constitution_rules           IS 'Rules belonging to a constitution version. code is the stable identifier used by the rules engine.';
COMMENT ON COLUMN public.constitution_rules.rule_type IS 'transition = argument type transitions; length = body size; evidence = citation requirement; etc.';
COMMENT ON COLUMN public.constitution_rules.params    IS 'Rule-specific config (thresholds, allowed types). Parsed by the rules engine.';

-- ──────────────────────────────────────────────────────────────
-- tag_definitions
-- Registry of argument tags. Governed by the constitution.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.tag_definitions (
  code                   text    PRIMARY KEY,
  label                  text    NOT NULL,
  description            text    NOT NULL DEFAULT '',
  category               text    NOT NULL DEFAULT 'general',
  allowed_argument_types text[]  NOT NULL DEFAULT '{}',
  enabled                boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE  public.tag_definitions                        IS 'Global tag registry. Tags can be restricted to specific argument types via allowed_argument_types.';
COMMENT ON COLUMN public.tag_definitions.allowed_argument_types IS 'Empty array means unrestricted. Non-empty limits which argument types may carry this tag.';

-- ──────────────────────────────────────────────────────────────
-- flag_definitions
-- Registry of flag types that can be raised on arguments.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.flag_definitions (
  code                  text    PRIMARY KEY,
  label                 text    NOT NULL,
  description           text    NOT NULL DEFAULT '',
  severity              text    NOT NULL CHECK (severity IN ('info', 'warning', 'review', 'blocking')),
  default_status        text    NOT NULL DEFAULT 'open'
                                CHECK (default_status IN ('open', 'needs_review', 'confirmed', 'dismissed')),
  auto_review_threshold numeric CHECK (auto_review_threshold BETWEEN 0 AND 1),
  enabled               boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE  public.flag_definitions                       IS 'Global flag registry. All argument_flags rows must reference a code defined here.';
COMMENT ON COLUMN public.flag_definitions.auto_review_threshold IS 'When an AI confidence score exceeds this value the flag is auto-promoted to needs_review.';

-- ──────────────────────────────────────────────────────────────
-- debates
-- A debate room anchored to a resolution. Pins a constitution
-- version at creation; the pinned version governs all arguments
-- submitted to this debate for its lifetime.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.debates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title           text        NOT NULL,
  resolution      text        NOT NULL,
  description     text        NOT NULL DEFAULT '',
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'open', 'locked', 'archived')),
  constitution_id uuid        NOT NULL REFERENCES public.constitution_versions(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.debates                 IS 'Debate rooms. resolution is the falsifiable proposition being debated.';
COMMENT ON COLUMN public.debates.constitution_id IS 'Pinned at creation. Never changes after the first argument is posted.';
COMMENT ON COLUMN public.debates.status          IS 'draft → open → locked → archived. Only open debates accept new arguments.';

CREATE TRIGGER debates_set_updated_at
  BEFORE UPDATE ON public.debates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- debate_participants
-- Tracks which users have joined a debate and on which side.
-- A user may only have one side per debate.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.debate_participants (
  debate_id uuid        NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  side      text        NOT NULL CHECK (side IN ('affirmative', 'negative', 'observer', 'moderator')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (debate_id, user_id)
);

COMMENT ON TABLE  public.debate_participants      IS 'Debate membership. Side is immutable after the user submits their first argument.';
COMMENT ON COLUMN public.debate_participants.side IS 'affirmative/negative = active debater; observer = read-only; moderator = can review flags.';

-- ──────────────────────────────────────────────────────────────
-- arguments
-- Nodes in the recursive debate tree. parent_id = NULL for root
-- arguments (thesis/claim at depth 0). The tree depth is bounded
-- by the constitution rule max_depth.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.arguments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id         uuid        NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  parent_id         uuid        REFERENCES public.arguments(id) ON DELETE SET NULL,
  author_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  argument_type     text        NOT NULL CHECK (argument_type IN (
                                  'thesis', 'claim', 'rebuttal', 'counter_rebuttal',
                                  'evidence', 'clarification_request', 'concession', 'synthesis'
                                )),
  side              text        NOT NULL CHECK (side IN ('affirmative', 'negative', 'neutral')),
  body              text        NOT NULL DEFAULT '',
  depth             int         NOT NULL DEFAULT 0 CHECK (depth >= 0),
  status            text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'posted', 'hidden', 'deleted')),
  -- Snapshot of client-side deterministic validation at submit time.
  -- Shape: { checked_at, constitution_version, flags: Flag[], valid: boolean }
  client_validation jsonb       NOT NULL DEFAULT '{}',
  -- Snapshot of server-side authoritative validation (set by Edge Function).
  -- Same shape. authoritative = true flags live in argument_flags; this is a summary cache.
  server_validation jsonb       NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.arguments                    IS 'Debate argument nodes. Recursive tree via parent_id. Soft-delete via status = deleted.';
COMMENT ON COLUMN public.arguments.parent_id          IS 'NULL for root-level arguments. ON DELETE SET NULL preserves children when parent is soft-deleted.';
COMMENT ON COLUMN public.arguments.client_validation  IS 'Snapshot of client rules engine result at submit time. Not authoritative.';
COMMENT ON COLUMN public.arguments.server_validation  IS 'Result of server-side rules check (Edge Function). Cache; canonical flags are in argument_flags.';

CREATE TRIGGER arguments_set_updated_at
  BEFORE UPDATE ON public.arguments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_arguments_debate_id  ON public.arguments(debate_id);
CREATE INDEX idx_arguments_parent_id  ON public.arguments(parent_id);
CREATE INDEX idx_arguments_author_id  ON public.arguments(author_id);
CREATE INDEX idx_arguments_status     ON public.arguments(status) WHERE status = 'posted';

-- ──────────────────────────────────────────────────────────────
-- argument_tags
-- Tags applied to arguments, drawn from tag_definitions.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.argument_tags (
  argument_id uuid        NOT NULL REFERENCES public.arguments(id) ON DELETE CASCADE,
  tag_code    text        NOT NULL REFERENCES public.tag_definitions(code) ON DELETE RESTRICT,
  created_by  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (argument_id, tag_code)
);

COMMENT ON TABLE public.argument_tags IS 'Many-to-many between arguments and tag_definitions.';

-- ──────────────────────────────────────────────────────────────
-- argument_flags
-- Flags raised on arguments. Source column distinguishes:
--   client_rules     — deterministic check on the client (not authoritative)
--   server_rules     — deterministic check by Edge Function (authoritative)
--   semantic_adapter — AI provider assessment (not authoritative; confidence attached)
--   user_report      — end-user report (requires moderator review)
--   moderator        — manually raised by a moderator/admin
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.argument_flags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   uuid        NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  argument_id uuid        NOT NULL REFERENCES public.arguments(id) ON DELETE CASCADE,
  flag_code   text        NOT NULL REFERENCES public.flag_definitions(code) ON DELETE RESTRICT,
  rule_code   text        REFERENCES public.constitution_rules(code) ON DELETE SET NULL,
  source      text        NOT NULL CHECK (source IN (
                            'client_rules', 'server_rules', 'semantic_adapter',
                            'user_report', 'moderator'
                          )),
  -- 0–1 confidence from AI adapter; NULL for deterministic sources
  confidence  numeric     CHECK (confidence BETWEEN 0 AND 1),
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'needs_review', 'confirmed', 'dismissed')),
  payload     jsonb       NOT NULL DEFAULT '{}',
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

COMMENT ON TABLE  public.argument_flags            IS 'Flags raised on arguments. Rows are never deleted; use status = dismissed.';
COMMENT ON COLUMN public.argument_flags.rule_code  IS 'Which constitution rule triggered this flag. NULL for user_report and manual moderator flags.';
COMMENT ON COLUMN public.argument_flags.confidence IS '0–1 score from AI adapter. NULL for deterministic sources.';

CREATE INDEX idx_argument_flags_argument_id ON public.argument_flags(argument_id);
CREATE INDEX idx_argument_flags_debate_id   ON public.argument_flags(debate_id);
CREATE INDEX idx_argument_flags_status      ON public.argument_flags(status) WHERE status IN ('open', 'needs_review');

-- ──────────────────────────────────────────────────────────────
-- topic_satisfaction_checks
-- Records of topic-relevance checks run against arguments.
-- May be lexical (deterministic), semantic (AI adapter), or manual.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.topic_satisfaction_checks (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id          uuid        NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  argument_id        uuid        NOT NULL REFERENCES public.arguments(id) ON DELETE CASCADE,
  parent_argument_id uuid        REFERENCES public.arguments(id) ON DELETE SET NULL,
  method             text        NOT NULL CHECK (method IN ('lexical', 'semantic_adapter', 'manual')),
  score              numeric     NOT NULL CHECK (score BETWEEN 0 AND 1),
  threshold          numeric     NOT NULL CHECK (threshold BETWEEN 0 AND 1),
  status             text        NOT NULL CHECK (status IN ('satisfied', 'weak', 'failed', 'not_applicable')),
  matched_terms      text[]      NOT NULL DEFAULT '{}',
  missing_terms      text[]      NOT NULL DEFAULT '{}',
  payload            jsonb       NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.topic_satisfaction_checks        IS 'Topic relevance assessments. Non-authoritative AI scores live here; authoritative lexical checks too.';
COMMENT ON COLUMN public.topic_satisfaction_checks.score IS '0 = completely off-topic; 1 = fully on-topic.';

CREATE INDEX idx_topic_checks_argument_id ON public.topic_satisfaction_checks(argument_id);

-- ──────────────────────────────────────────────────────────────
-- moderation_reviews
-- Human moderation decisions on flags. Append-only; never update
-- or delete. Decision trail for auditing.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.moderation_reviews (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id     uuid        NOT NULL REFERENCES public.argument_flags(id) ON DELETE CASCADE,
  reviewer_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  decision    text        NOT NULL CHECK (decision IN ('confirm', 'dismiss', 'escalate')),
  notes       text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.moderation_reviews IS 'Immutable log of moderator decisions. For audit trail — never update rows.';

-- ──────────────────────────────────────────────────────────────
-- audio_submissions
-- Audio recordings with transcript lifecycle. Storage path points
-- to a Supabase Storage object. Argument link is set after transcript
-- review.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.audio_submissions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id         uuid        NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  argument_id       uuid        REFERENCES public.arguments(id) ON DELETE SET NULL,
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  storage_path      text        NOT NULL,
  transcript_text   text,
  transcript_status text        NOT NULL DEFAULT 'uploaded'
                                CHECK (transcript_status IN (
                                  'uploaded', 'transcribing', 'ready_for_review',
                                  'accepted', 'rejected', 'failed'
                                )),
  provider_payload  jsonb       NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.audio_submissions                   IS 'Audio argument recordings. Lifecycle: uploaded → transcribing → ready_for_review → accepted/rejected.';
COMMENT ON COLUMN public.audio_submissions.storage_path      IS 'Path inside Supabase Storage bucket (e.g. audio/{user_id}/{id}.webm).';
COMMENT ON COLUMN public.audio_submissions.provider_payload  IS 'Raw JSON from the transcription provider (Whisper, etc.) for debugging.';
