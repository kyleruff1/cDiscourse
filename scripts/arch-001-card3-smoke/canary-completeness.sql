-- ARCH-001 Card 3 smoke — Canary completeness gate (read-only).
-- Run AFTER posting ONE [arch-001-queue-smoke] canary submit. This is a
-- ROUTING-PATH gate, not load evidence. Scoped to that one canary argument's
-- rows. No write, no service-role, no secret.
--
-- PASS = 7 A–G rows, family IS NOT NULL, run_mode='production', 0 H/I/J rows,
-- all state='succeeded'. HALT on any family=NULL queue row.
--
-- Replace :canary_argument_id with the canary submit's argument id.
WITH canary_runs AS (
  SELECT *
    FROM public.argument_machine_observation_runs
   WHERE argument_id = :'canary_argument_id'
)
SELECT
  count(*)                                                         AS total_rows,
  count(*) FILTER (WHERE family IS NOT NULL)                       AS queue_rows,
  count(*) FILTER (WHERE family IS NULL)                           AS family_null_rows,  -- must be 0
  count(*) FILTER (WHERE state = 'succeeded')                      AS succeeded,
  count(*) FILTER (
    WHERE family IN (
      'parent_relation','disagreement_axis','misunderstanding_repair',
      'evidence_source_chain','argument_scheme','critical_question','resolution_progress'
    )
  )                                                                AS ag_rows,          -- expect 7
  count(*) FILTER (
    WHERE family IN ('claim_clarity','thread_topology','sensitive_composer')
  )                                                                AS hij_rows          -- must be 0
FROM canary_runs;

-- Detail: one row per family with its terminal state (eyeball the 7 A–G).
SELECT family, state, run_mode
  FROM public.argument_machine_observation_runs
 WHERE argument_id = :'canary_argument_id'
   AND family IS NOT NULL
 ORDER BY family;
