-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 H/I/J leakage check.
--
-- Read-only. Counts routed queue rows since the 1% arm
-- (2026-06-02T07:50:54Z) whose family is one of the NON-production families
-- H/I/J — claim_clarity, thread_topology, sensitive_composer. These three
-- are productionEnabled:false in the family registry, so the 1% routing path
-- must never enqueue them. Expected result: 0. A non-zero count means a
-- non-production family leaked into the live routing path and is a signal to
-- investigate (this script only reports; it changes nothing).
--
-- Aggregate count only; no body content; no per-row text.
-- Doctrine (cdiscourse): an operational leakage gauge, never a verdict.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/stage1-hij-leakage.sql
SELECT
  COUNT(*) AS hij_routed_rows_since_arm
FROM public.argument_machine_observation_runs r
WHERE r.family IN ('claim_clarity', 'thread_topology', 'sensitive_composer')
  AND r.created_at >= '2026-06-02T07:50:54Z'::timestamptz;
