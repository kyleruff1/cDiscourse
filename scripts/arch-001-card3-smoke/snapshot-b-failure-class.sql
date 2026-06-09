-- ARCH-001 Card 3 smoke — Snapshot B: failure-class breakdown (read-only).
-- Read AFTER settle to triage any non-succeeded cell. Scoped to smoke-tagged
-- rooms. No write, no service-role, no secret.
--
-- For PASS-LOAD the dead_letter count MUST be 0. A single-family cluster of
-- >=2 provider_* terminal failures is a FAIL (gate doc §B(iv)).
WITH smoke_runs AS (
  SELECT r.*
    FROM public.argument_machine_observation_runs r
    JOIN public.arguments a ON a.id = r.argument_id
    JOIN public.debates    d ON d.id = a.debate_id
   WHERE d.title LIKE '[arch-001-queue-smoke]%'
     AND r.family IS NOT NULL
)
SELECT
  state,
  family,
  failure_sub_reason,
  dead_letter_reason,
  count(*) AS n
FROM smoke_runs
WHERE state IN ('dead_letter', 'failed_terminal', 'retry_scheduled')
GROUP BY state, family, failure_sub_reason, dead_letter_reason
ORDER BY state, n DESC;
