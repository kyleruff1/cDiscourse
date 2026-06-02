-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 one-row observation snapshot.
--
-- Read-only. Returns a single row of the Stage-1 health gauges, all derived
-- from the classifier queue table since the 1% arm (2026-06-02T07:50:54Z):
--   routed_args_since_arm  — DISTINCT routed args (family IS NOT NULL) since arm.
--   non_smoke_routed_args  — of those, the ones whose debate title does NOT
--                            carry the '[arch-001-queue-smoke]' smoke-tag prefix
--                            (i.e. organic 1% traffic; expect 0 during smoke-only
--                            observation).
--   hij_rows_since_arm     — routed rows since arm in a NON-production family
--                            (claim_clarity/thread_topology/sensitive_composer);
--                            H/I/J are productionEnabled:false, so expect 0.
--   m1_seconds_since_drain — seconds since the most recent succeeded run
--                            completed (drainer freshness gauge). NULL if no
--                            succeeded run exists.
--   m2_non_terminal        — count of queue rows in a non-terminal state
--                            (pending/leased/retry_scheduled); the live backlog.
--
-- M1 staleness is an alert ONLY when paired with M2 > 0; an idle/empty queue
-- (M2 = 0) with a stale M1 is expected, not stuck.
--
-- Doctrine (cdiscourse): these are operational gauges, never a verdict about
-- any participant. No body content; no per-row text.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/stage1-snapshot.sql
WITH arm AS (
  SELECT TIMESTAMPTZ '2026-06-02T07:50:54Z' AS armed_at
),
routed AS (
  SELECT r.argument_id, r.family
  FROM public.argument_machine_observation_runs r
  JOIN public.debates d ON d.id = r.debate_id
  JOIN arm ON true
  WHERE r.family IS NOT NULL
    AND r.created_at >= arm.armed_at
),
routed_nonsmoke AS (
  SELECT r.argument_id
  FROM public.argument_machine_observation_runs r
  JOIN public.debates d ON d.id = r.debate_id
  JOIN arm ON true
  WHERE r.family IS NOT NULL
    AND r.created_at >= arm.armed_at
    AND d.title NOT LIKE '[arch-001-queue-smoke]%'
),
m1 AS (
  SELECT EXTRACT(EPOCH FROM (now() - MAX(completed_at)))::numeric(12, 1) AS m1_sec
  FROM public.argument_machine_observation_runs
  WHERE state = 'succeeded'
)
SELECT
  (SELECT COUNT(DISTINCT argument_id) FROM routed)                          AS routed_args_since_arm,
  (SELECT COUNT(DISTINCT argument_id) FROM routed_nonsmoke)                 AS non_smoke_routed_args,
  (SELECT COUNT(*) FROM routed
     WHERE family IN ('claim_clarity', 'thread_topology', 'sensitive_composer')) AS hij_rows_since_arm,
  (SELECT m1_sec FROM m1)                                                   AS m1_seconds_since_drain,
  (SELECT COUNT(*) FROM public.argument_machine_observation_runs
     WHERE state IN ('pending', 'leased', 'retry_scheduled'))              AS m2_non_terminal;
