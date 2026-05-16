-- ============================================================
-- Migration: 20260516000003_seed_data
-- Description: Production reference data — constitution v1,
--              tag definitions, flag definitions, and rules.
--              This data must exist in all environments (local, staging, prod).
--              Test-only data belongs in supabase/seed.sql.
-- ============================================================

-- Fixed UUID for constitution v1 (used in rules foreign keys below).
-- Using a recognizable sentinel: c1d0-0001 = "constitution, version 1".
DO $$
DECLARE
  v_constitution_id uuid := 'c1d00001-0000-0000-0000-000000000001';
BEGIN

-- ──────────────────────────────────────────────────────────────
-- Constitution v1
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.constitution_versions (id, slug, version, title, body_md, active)
VALUES (
  v_constitution_id,
  'constitution-v1',
  '1.0.0',
  'CDiscourse Constitution v1',
  $body$# CDiscourse Constitution v1.0.0

## Preamble

The purpose of a debate Constitution is to ensure that discourse remains structured, navigable, and fair without requiring a central authority to adjudicate truth. The Constitution governs **form**, not **content**. It defines what kinds of moves are valid in response to what, not which arguments are correct.

## Argument Types

| Code | Name | Description |
|---|---|---|
| thesis | Thesis | Opening position statement for a debate side. |
| claim | Claim | A substantive, falsifiable assertion. |
| rebuttal | Rebuttal | Direct challenge to a parent claim or rebuttal. |
| counter_rebuttal | Counter-Rebuttal | Defense of original claim against a rebuttal. |
| evidence | Evidence | Factual support with at least one cited source. |
| clarification_request | Clarification Request | Question asking for definition or scope clarity. Must end with ?. |
| concession | Concession | Acknowledgment that the parent argument has merit. |
| synthesis | Synthesis | Summary of a completed subtree. Terminal node. |

## Transition Matrix

| From | Allowed Replies |
|---|---|
| thesis | claim, rebuttal, evidence |
| claim | rebuttal, evidence, clarification_request, concession |
| rebuttal | counter_rebuttal, evidence, clarification_request, concession |
| counter_rebuttal | rebuttal, evidence, clarification_request |
| evidence | clarification_request, rebuttal |
| clarification_request | claim |
| concession | synthesis |
| synthesis | (terminal — no replies) |
$body$,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Tag definitions
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.tag_definitions (code, label, description, category, allowed_argument_types, enabled)
VALUES
  ('claim',
   'Claim',
   'Marks an argument that advances a substantive position.',
   'argument_type',
   ARRAY['thesis', 'claim'],
   true),

  ('rebuttal',
   'Rebuttal',
   'Marks an argument that directly challenges a parent argument.',
   'argument_type',
   ARRAY['rebuttal'],
   true),

  ('counter_rebuttal',
   'Counter-Rebuttal',
   'Marks an argument defending the original claim against a rebuttal.',
   'argument_type',
   ARRAY['counter_rebuttal'],
   true),

  ('evidence',
   'Evidence',
   'Marks an argument that provides factual support with a cited source.',
   'argument_type',
   ARRAY['evidence'],
   true),

  ('source_request',
   'Source Request',
   'A clarification request specifically asking for a citation or source.',
   'epistemic',
   ARRAY['clarification_request'],
   true),

  ('clarification',
   'Clarification',
   'A general request to define a term, scope, or assumption.',
   'epistemic',
   ARRAY['clarification_request'],
   true),

  ('concession',
   'Concession',
   'Marks an acknowledgment that the parent argument has merit.',
   'argument_type',
   ARRAY['concession'],
   true),

  ('synthesis',
   'Synthesis',
   'Marks a summary note on a completed subtree.',
   'argument_type',
   ARRAY['synthesis'],
   true),

  ('scope_challenge',
   'Scope Challenge',
   'Challenges whether the argument or the debate topic is within the agreed scope.',
   'procedural',
   ARRAY[]::text[],   -- unrestricted; can be applied to any argument type
   true)
ON CONFLICT (code) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Flag definitions
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.flag_definitions
  (code, label, description, severity, default_status, auto_review_threshold, enabled)
VALUES
  ('off_topic',
   'Off Topic',
   'The argument does not appear to address the debate resolution.',
   'warning',
   'open',
   0.9,
   true),

  ('weak_topic_satisfaction',
   'Weak Topic Satisfaction',
   'The argument is marginally related to the resolution but may not engage substantively.',
   'info',
   'open',
   NULL,
   true),

  ('missing_parent',
   'Missing Parent Argument',
   'This argument type requires a parent argument (e.g. a rebuttal must reply to something).',
   'blocking',
   'open',
   NULL,
   true),

  ('invalid_transition',
   'Invalid Argument Transition',
   'This argument type is not an allowed reply to the parent argument type per the constitution.',
   'blocking',
   'open',
   NULL,
   true),

  ('unsupported_factual_claim',
   'Unsupported Factual Claim',
   'The argument makes a specific factual assertion without citing evidence.',
   'warning',
   'open',
   0.85,
   true),

  ('evidence_required',
   'Evidence Required',
   'Evidence-type arguments must include at least one cited source URL.',
   'blocking',
   'open',
   NULL,
   true),

  ('civility_risk',
   'Civility Risk',
   'The argument may contain language that violates civility norms.',
   'review',
   'needs_review',
   0.8,
   true),

  ('ad_hominem_possible',
   'Possible Ad Hominem',
   'The argument may be directed at the person rather than the argument.',
   'warning',
   'open',
   0.8,
   true),

  ('duplicate_argument_possible',
   'Possible Duplicate Argument',
   'A semantically similar argument may already exist in this debate.',
   'info',
   'open',
   NULL,
   true),

  ('excessive_length',
   'Excessive Length',
   'The argument body exceeds the maximum character limit.',
   'blocking',
   'open',
   NULL,
   true),

  ('unclear_claim',
   'Unclear Claim',
   'The claim is not stated clearly or lacks a falsifiable assertion.',
   'warning',
   'open',
   0.75,
   true),

  ('needs_moderator_review',
   'Needs Moderator Review',
   'This argument has been escalated for human moderator review.',
   'review',
   'needs_review',
   NULL,
   true)
ON CONFLICT (code) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Constitution rules (v1)
-- ──────────────────────────────────────────────────────────────

-- ── Transition rules (one per "from" argument type) ──────────

INSERT INTO public.constitution_rules
  (constitution_id, code, title, description, rule_type, severity, params, enabled)
VALUES

-- thesis
(v_constitution_id,
 'transition_thesis',
 'Thesis Transition',
 'Allowed reply types for a thesis argument.',
 'transition', 'blocking',
 '{"from_type": "thesis", "allowed_reply_types": ["claim", "rebuttal", "evidence"], "flag_code": "invalid_transition"}'::jsonb,
 true),

-- claim
(v_constitution_id,
 'transition_claim',
 'Claim Transition',
 'Allowed reply types for a claim argument.',
 'transition', 'blocking',
 '{"from_type": "claim", "allowed_reply_types": ["rebuttal", "evidence", "clarification_request", "concession"], "flag_code": "invalid_transition"}'::jsonb,
 true),

-- rebuttal
(v_constitution_id,
 'transition_rebuttal',
 'Rebuttal Transition',
 'Allowed reply types for a rebuttal argument.',
 'transition', 'blocking',
 '{"from_type": "rebuttal", "allowed_reply_types": ["counter_rebuttal", "evidence", "clarification_request", "concession"], "flag_code": "invalid_transition"}'::jsonb,
 true),

-- counter_rebuttal
(v_constitution_id,
 'transition_counter_rebuttal',
 'Counter-Rebuttal Transition',
 'Allowed reply types for a counter_rebuttal argument.',
 'transition', 'blocking',
 '{"from_type": "counter_rebuttal", "allowed_reply_types": ["rebuttal", "evidence", "clarification_request"], "flag_code": "invalid_transition"}'::jsonb,
 true),

-- evidence
(v_constitution_id,
 'transition_evidence',
 'Evidence Transition',
 'Allowed reply types for an evidence argument.',
 'transition', 'blocking',
 '{"from_type": "evidence", "allowed_reply_types": ["clarification_request", "rebuttal"], "flag_code": "invalid_transition"}'::jsonb,
 true),

-- clarification_request
(v_constitution_id,
 'transition_clarification_request',
 'Clarification Request Transition',
 'Allowed reply types for a clarification_request argument. Answers must be claims.',
 'transition', 'blocking',
 '{"from_type": "clarification_request", "allowed_reply_types": ["claim"], "flag_code": "invalid_transition"}'::jsonb,
 true),

-- concession
(v_constitution_id,
 'transition_concession',
 'Concession Transition',
 'Allowed reply types for a concession argument. Only synthesis notes may follow.',
 'transition', 'blocking',
 '{"from_type": "concession", "allowed_reply_types": ["synthesis"], "flag_code": "invalid_transition"}'::jsonb,
 true),

-- synthesis (terminal)
(v_constitution_id,
 'transition_synthesis',
 'Synthesis Terminal',
 'Synthesis arguments are terminal nodes — no replies allowed.',
 'transition', 'blocking',
 '{"from_type": "synthesis", "allowed_reply_types": [], "flag_code": "invalid_transition"}'::jsonb,
 true),

-- ── Parent requirement rule ───────────────────────────────────
(v_constitution_id,
 'parent_required',
 'Parent Argument Required',
 'Certain argument types must be replies to an existing argument and cannot appear at the root.',
 'structure', 'blocking',
 '{
   "types_requiring_parent": ["rebuttal", "counter_rebuttal", "evidence", "clarification_request", "concession", "synthesis"],
   "flag_code": "missing_parent"
 }'::jsonb,
 true),

-- ── Root type restriction ─────────────────────────────────────
(v_constitution_id,
 'root_type_allowed',
 'Root Argument Type',
 'Only thesis and claim arguments may appear at depth 0 (no parent).',
 'structure', 'blocking',
 '{
   "allowed_root_types": ["thesis", "claim"],
   "flag_code": "invalid_transition"
 }'::jsonb,
 true),

-- ── Evidence requirement ──────────────────────────────────────
(v_constitution_id,
 'evidence_source_required',
 'Evidence Requires Citation',
 'An evidence argument must include at least one cited source URL in its evidence_links.',
 'evidence', 'blocking',
 '{
   "applies_to_types": ["evidence"],
   "min_links": 1,
   "flag_code": "evidence_required"
 }'::jsonb,
 true),

-- ── Body length ───────────────────────────────────────────────
(v_constitution_id,
 'length_body',
 'Argument Body Length',
 'Minimum and maximum character counts for argument bodies.',
 'length', 'blocking',
 '{
   "min_chars": 20,
   "max_chars": 2000,
   "short_flag_code": "unclear_claim",
   "long_flag_code": "excessive_length",
   "short_severity": "warning",
   "long_severity": "blocking"
 }'::jsonb,
 true),

-- ── Civility heuristic ────────────────────────────────────────
(v_constitution_id,
 'civility_heuristic',
 'Civility Heuristic',
 'Basic keyword heuristic for potentially uncivil language. AI adapter provides richer checking.',
 'civility', 'review',
 '{
   "flag_code": "civility_risk",
   "note": "Heuristic only — pattern list is intentionally minimal. Extend via constitution update or AI adapter.",
   "patterns": []
 }'::jsonb,
 true),

-- ── Topic satisfaction ────────────────────────────────────────
(v_constitution_id,
 'topic_satisfaction_lexical',
 'Topic Satisfaction (Lexical)',
 'Lexical overlap check between argument body and debate resolution. Score below threshold triggers a weak_topic_satisfaction flag.',
 'topic_satisfaction', 'info',
 '{
   "method": "lexical",
   "threshold": 0.25,
   "flag_code": "weak_topic_satisfaction",
   "off_topic_threshold": 0.05,
   "off_topic_flag_code": "off_topic"
 }'::jsonb,
 true),

-- ── Rate limit ────────────────────────────────────────────────
(v_constitution_id,
 'rate_limit_per_hour',
 'Argument Rate Limit',
 'Maximum number of posted arguments a user may submit per debate per hour.',
 'rate_limit', 'blocking',
 '{
   "max_per_hour": 10,
   "per_debate": true,
   "flag_code": "needs_moderator_review"
 }'::jsonb,
 true)

ON CONFLICT (code) DO NOTHING;

END $$;
