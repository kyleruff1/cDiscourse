-- CORPUS-30 Phase 7 — Step 4: positive-observation density per family.
-- For each family, count the number of result rows
-- (argument_machine_observation_results) that the MCP returned
-- positive — i.e. the family's keys that the classifier asserted true
-- for at least one argument in this corpus.
--
-- This is the "what did the model actually observe?" signal — distinct
-- from Step 2's "did the call succeed?" structural signal.
--
-- Interpretation hints:
--   * Very low density (e.g. 0-3 positive observations per family
--     across 300 args) likely means the classifier is being
--     conservative or the corpus's voice/spine mix is staying on a
--     narrow band of keys.
--   * Very high density (e.g. >900 positive observations per family
--     across 300 args, i.e. >3 keys/arg) likely means the classifier
--     is firing many keys per argument — useful to spot-check for
--     spurious positives.
WITH corpus_args AS (
  SELECT a.id
    FROM public.arguments a
    JOIN public.debates d ON a.debate_id = d.id
   WHERE d.title LIKE '%corpus-prod-synthetic-20260603-1924-d49e04cd%'
)
SELECT
  r.family,
  COUNT(*) AS positive_observations,
  COUNT(DISTINCT run.argument_id) AS arguments_with_at_least_one_positive
  FROM public.argument_machine_observation_results r
  JOIN public.argument_machine_observation_runs run ON r.run_id = run.id
 WHERE run.argument_id IN (SELECT id FROM corpus_args)
 GROUP BY r.family
 ORDER BY r.family;
