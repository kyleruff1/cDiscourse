-- ============================================================
-- Migration: 20260516000004_stage4_rails_and_edge
-- Description: Stage 4 — discourse rails, new columns, and
--              RLS updates to enforce Edge Function submission.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Extend constitution_rules.rule_type to allow 'rails'
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.constitution_rules
  DROP CONSTRAINT IF EXISTS constitution_rules_rule_type_check;

ALTER TABLE public.constitution_rules
  ADD CONSTRAINT constitution_rules_rule_type_check
  CHECK (rule_type IN (
    'transition', 'topic_satisfaction', 'evidence',
    'civility', 'structure', 'rate_limit', 'length', 'review', 'rails'
  ));

-- ──────────────────────────────────────────────────────────────
-- 2. Add new columns to public.arguments
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.arguments
  ADD COLUMN IF NOT EXISTS target_excerpt    text,
  ADD COLUMN IF NOT EXISTS disagreement_axis text
    CHECK (disagreement_axis IN ('fact', 'definition', 'causal', 'value', 'evidence', 'logic', 'scope')),
  ADD COLUMN IF NOT EXISTS rail_payload      jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.arguments.target_excerpt
  IS 'Optional: text from the parent argument that this argument is directly responding to.';
COMMENT ON COLUMN public.arguments.disagreement_axis
  IS 'What kind of disagreement is being made (rebuttal/counter_rebuttal). Declared by the author.';
COMMENT ON COLUMN public.arguments.rail_payload
  IS 'Output of discourse rails checks (C-RAIL-001–005). Stored for audit and moderator review.';

-- ──────────────────────────────────────────────────────────────
-- 3. New tag_definitions — disagreement-axis tags (C-RAIL-002)
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.tag_definitions (code, label, description, category, allowed_argument_types, enabled)
VALUES
  ('fact_disagreement',
   'Fact Disagreement',
   'Disputes a specific factual claim in the parent argument.',
   'disagreement_axis',
   ARRAY['rebuttal', 'counter_rebuttal'],
   true),

  ('definition_disagreement',
   'Definition Disagreement',
   'Disputes the meaning of a key term used in the parent argument.',
   'disagreement_axis',
   ARRAY['rebuttal', 'counter_rebuttal'],
   true),

  ('causal_disagreement',
   'Causal Disagreement',
   'Disputes the causal relationship asserted in the parent argument.',
   'disagreement_axis',
   ARRAY['rebuttal', 'counter_rebuttal'],
   true),

  ('value_disagreement',
   'Value Disagreement',
   'Disputes the normative premise or the weight given to a value in the parent argument.',
   'disagreement_axis',
   ARRAY['rebuttal', 'counter_rebuttal'],
   true),

  ('evidence_challenge',
   'Evidence Challenge',
   'Challenges the quality, relevance, or sourcing of evidence in the parent argument.',
   'disagreement_axis',
   ARRAY['rebuttal', 'counter_rebuttal', 'clarification_request'],
   true),

  ('logic_challenge',
   'Logic Challenge',
   'Challenges the inferential step from premise to conclusion in the parent argument.',
   'disagreement_axis',
   ARRAY['rebuttal', 'counter_rebuttal'],
   true)

ON CONFLICT (code) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 4. New flag_definitions — rails / discourse-structure flags
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.flag_definitions
  (code, label, description, severity, default_status, auto_review_threshold, enabled)
VALUES
  ('parent_nonresponsive',
   'Not Responsive to Parent',
   'Argument has no meaningful lexical connection to its parent. May indicate a tangent or accidental wrong-thread post.',
   'blocking',
   'open',
   NULL,
   true),

  ('tangent_shift_possible',
   'Possible Tangent Shift',
   'Argument has low lexical overlap with its parent and may be shifting to an unrelated topic.',
   'warning',
   'open',
   NULL,
   true),

  ('concession_evasion_possible',
   'Possible Concession Evasion',
   'Concession uses "but/however" to introduce a new unrelated dispute with low parent overlap. May narrow or dodge the original point.',
   'review',
   'needs_review',
   NULL,
   true),

  ('loaded_clarification_possible',
   'Possible Loaded Clarification',
   'Clarification request appears to use loaded or accusatory language rather than asking for a definition, source, or scope.',
   'review',
   'needs_review',
   NULL,
   true),

  ('fact_confusion_possible',
   'Possible Fact Confusion',
   'Argument disputes a factual premise while also expressing uncertainty or requesting sources. Advisory: may mean the disagreement is about missing evidence, not intent.',
   'info',
   'open',
   NULL,
   true)

ON CONFLICT (code) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 5. Update existing transition rules to match the spec matrix
-- ──────────────────────────────────────────────────────────────
-- thesis: add clarification_request
UPDATE public.constitution_rules
SET params = jsonb_set(
  params,
  '{allowed_reply_types}',
  '["claim", "rebuttal", "evidence", "clarification_request"]'::jsonb
)
WHERE code = 'transition_thesis';

-- counter_rebuttal: add evidence + concession
UPDATE public.constitution_rules
SET params = jsonb_set(
  params,
  '{allowed_reply_types}',
  '["rebuttal", "evidence", "clarification_request", "concession"]'::jsonb
)
WHERE code = 'transition_counter_rebuttal';

-- clarification_request: add evidence
UPDATE public.constitution_rules
SET params = jsonb_set(
  params,
  '{allowed_reply_types}',
  '["claim", "evidence"]'::jsonb
)
WHERE code = 'transition_clarification_request';

-- synthesis: add claim and clarification_request (make non-terminal)
UPDATE public.constitution_rules
SET params = jsonb_set(
  params,
  '{allowed_reply_types}',
  '["claim", "clarification_request"]'::jsonb
)
WHERE code = 'transition_synthesis';

-- root_type_allowed: add claim
UPDATE public.constitution_rules
SET params = jsonb_set(
  params,
  '{allowed_root_types}',
  '["thesis", "claim"]'::jsonb
)
WHERE code = 'root_type_allowed';

-- ──────────────────────────────────────────────────────────────
-- 6. New constitution_rules — discourse rails (C-RAIL-001–005)
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_constitution_id uuid := 'c1d00001-0000-0000-0000-000000000001';
BEGIN

INSERT INTO public.constitution_rules
  (constitution_id, code, title, description, rule_type, severity, params, enabled)
VALUES

-- C-RAIL-001: Parent responsiveness
(v_constitution_id,
 'parent_responsiveness_lexical',
 'Parent Responsiveness (Lexical)',
 'Reply arguments must have meaningful lexical overlap with the parent body or provide a target_excerpt. Hard-blocks at essentially zero overlap.',
 'rails', 'review',
 '{
   "applies_to": ["rebuttal", "counter_rebuttal", "evidence", "clarification_request", "concession", "synthesis"],
   "hard_block_threshold": 0.05,
   "warning_threshold": 0.15
 }'::jsonb,
 true),

-- C-RAIL-002: Disagreement axis required
(v_constitution_id,
 'disagreement_axis_required',
 'Disagreement Axis Required',
 'Rebuttals and counter-rebuttals must declare at least one disagreement-axis tag to make the nature of the dispute explicit.',
 'rails', 'warning',
 '{
   "applies_to": ["rebuttal", "counter_rebuttal"],
   "axis_tag_codes": [
     "fact_disagreement", "definition_disagreement", "causal_disagreement",
     "value_disagreement", "evidence_challenge", "logic_challenge", "scope_challenge"
   ]
 }'::jsonb,
 true),

-- C-RAIL-003: Concession integrity
(v_constitution_id,
 'concession_integrity',
 'Concession Integrity',
 'A concession must include an explicit concession marker. Introducing an unrelated dispute via "but/however" with low parent overlap creates a concession_evasion_possible flag.',
 'rails', 'review',
 '{
   "applies_to": ["concession", "synthesis"],
   "concession_markers": [
     "i concede", "i grant", "i agree with", "that point is valid",
     "you are right", "you''re right", "fair point", "i acknowledge"
   ],
   "evasion_patterns": ["\\bbut\\b", "\\bhowever\\b", "\\bthat said\\b", "\\bnevertheless\\b"],
   "evasion_parent_overlap_threshold": 0.1
 }'::jsonb,
 true),

-- C-RAIL-004: Clarification purity
(v_constitution_id,
 'clarification_purity',
 'Clarification Purity',
 'Clarification requests should ask for a definition, source, scope, or missing premise. Loaded or accusatory language creates a loaded_clarification_possible flag.',
 'rails', 'review',
 '{
   "applies_to": ["clarification_request"],
   "loaded_patterns": [
     "\\byou obviously\\b", "\\byou clearly\\b", "\\byou always\\b",
     "\\byou never\\b", "\\byou (are|were) wrong\\b", "\\byou (are|were) lying\\b"
   ]
 }'::jsonb,
 true),

-- C-RAIL-005: Fact confusion channel
(v_constitution_id,
 'fact_confusion_channel',
 'Fact Confusion Channel',
 'Advisory flag when an argument disputes a factual premise while also using uncertainty language or source-request tags. Not a misconduct flag.',
 'rails', 'info',
 '{
   "uncertainty_patterns": [
     "\\bmaybe\\b", "\\bperhaps\\b", "\\bi think\\b", "\\buncertain\\b",
     "\\bnot sure\\b", "\\bcould be\\b", "\\bwhat is the source\\b",
     "\\bdo you have evidence\\b", "\\bcan you cite\\b"
   ],
   "trigger_tags": ["evidence_challenge", "source_request"]
 }'::jsonb,
 true)

ON CONFLICT (code) DO NOTHING;

END $$;

-- ──────────────────────────────────────────────────────────────
-- 7. RLS updates — enforce Edge Function for posted arguments
-- ──────────────────────────────────────────────────────────────

-- Drop old permissive INSERT policy on arguments.
-- Authenticated users may now only insert DRAFT arguments directly.
-- POSTED arguments must go through the Edge Function (service_role, bypasses RLS).
DROP POLICY IF EXISTS "arguments: insert as self" ON public.arguments;

CREATE POLICY "arguments: insert draft as self"
ON public.arguments FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND status = 'draft'
);

COMMENT ON POLICY "arguments: insert draft as self" ON public.arguments
  IS 'Clients may only directly insert draft arguments. Posted arguments must be inserted by the submit-argument Edge Function using service_role.';

-- Drop old permissive INSERT policy on argument_tags.
-- Users may only insert tags on DRAFT arguments they own.
-- Tags on posted arguments are set by the Edge Function.
DROP POLICY IF EXISTS "argument_tags: insert by argument author or mod" ON public.argument_tags;

CREATE POLICY "argument_tags: insert on draft by author or mod"
ON public.argument_tags FOR INSERT
TO authenticated
WITH CHECK (
  (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.arguments
      WHERE id = argument_id
        AND author_id = auth.uid()
        AND status = 'draft'
    )
  )
  OR is_moderator_or_admin()
);

COMMENT ON POLICY "argument_tags: insert on draft by author or mod" ON public.argument_tags
  IS 'Users may only directly tag their own draft arguments. Tags on posted arguments are set by the Edge Function using service_role.';
