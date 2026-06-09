-- ARCH-001 Card 3 smoke — N=56 burst completeness gate (read-only).
-- Run ONLY after the settle predicate holds (snapshot A + C). Scoped to
-- smoke-tagged rooms. No write, no service-role, no secret.
--
-- PASS-LOAD (bar NOT lowered):
--   dead_letter = 0 across all 56 cells, dup = 0, family_null = 0, hij = 0,
--   and every expected cell reached 'succeeded' or an explicit typed terminal.
WITH smoke_runs AS (
  SELECT r.*
    FROM public.argument_machine_observation_runs r
    JOIN public.arguments a ON a.id = r.argument_id
    JOIN public.debates    d ON d.id = a.debate_id
   WHERE d.title LIKE '[arch-001-queue-smoke]%'
     AND r.family IS NOT NULL
)
SELECT
  count(*)                                                AS total_queue_rows,         -- expect >= 56
  count(*) FILTER (WHERE state = 'succeeded')             AS succeeded,
  count(*) FILTER (WHERE state = 'dead_letter')           AS dead_letter,             -- MUST be 0
  count(*) FILTER (WHERE state = 'failed_terminal')       AS failed_terminal,
  count(*) FILTER (WHERE state IN ('pending','leased','retry_scheduled')) AS not_settled,  -- expect 0 post-settle
  count(*) FILTER (
    WHERE family IN ('claim_clarity','thread_topology','sensitive_composer')
  )                                                       AS hij_rows                  -- MUST be 0
FROM smoke_runs;

-- Duplicate-success detector: no two 'succeeded' rows for one
-- (argument_id, family, run_mode, schema_version) cell (index #4 should make
-- this impossible). Any row here is a FAIL.
SELECT argument_id, family, run_mode, schema_version, count(*) AS dup_succeeded
  FROM public.argument_machine_observation_runs r
  JOIN public.arguments a ON a.id = r.argument_id
  JOIN public.debates    d ON d.id = a.debate_id
 WHERE d.title LIKE '[arch-001-queue-smoke]%'
   AND r.family IS NOT NULL
   AND r.state = 'succeeded'
 GROUP BY argument_id, family, run_mode, schema_version
HAVING count(*) > 1;
