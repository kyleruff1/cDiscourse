-- CORPUS-30 Phase 7 — Step 6: per-argument family-coverage gap.
-- Surface arguments where one or more of the 7 production-enabled
-- families A-G is MISSING a runs row entirely (auto-trigger never
-- persisted a row for that family). This catches the case where the
-- bounded-parallel dispatcher (limit 2) was racing against
-- EdgeRuntime.waitUntil shutdown and a family promise was cut off.
--
-- Distinct from Step 2 (which groups by status — but a missing row
-- has no status to count).
--
-- Production-enabled families on main as of 2026-06-03 (familyRegistry.ts:68-103):
--   A parent_relation
--   B disagreement_axis
--   C misunderstanding_repair
--   D evidence_source_chain
--   E argument_scheme
--   F critical_question
--   G resolution_progress
WITH corpus_args AS (
  SELECT a.id AS argument_id
    FROM public.arguments a
    JOIN public.debates d ON a.debate_id = d.id
   WHERE d.title LIKE '%corpus-prod-synthetic-20260603-1924-d49e04cd%'
),
expected_families(family) AS (
  VALUES
    ('parent_relation'),
    ('disagreement_axis'),
    ('misunderstanding_repair'),
    ('evidence_source_chain'),
    ('argument_scheme'),
    ('critical_question'),
    ('resolution_progress')
),
expected AS (
  SELECT ca.argument_id, ef.family
    FROM corpus_args ca
   CROSS JOIN expected_families ef
),
present AS (
  SELECT
    r.argument_id,
    COALESCE(r.family, r.requested_families[1]) AS family
    FROM public.argument_machine_observation_runs r
   WHERE r.argument_id IN (SELECT argument_id FROM corpus_args)
)
SELECT
  e.family,
  COUNT(*) AS missing_run_rows
  FROM expected e
  LEFT JOIN present p
    ON p.argument_id = e.argument_id
   AND p.family      = e.family
 WHERE p.argument_id IS NULL
 GROUP BY e.family
 ORDER BY e.family;
-- Expected (clean run): zero rows returned (every family has a row for
-- every argument).
