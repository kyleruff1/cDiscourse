-- OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — Stage-1 routed volume (smoke vs non-smoke).
--
-- Read-only. Counts the DISTINCT arguments routed through the classifier
-- queue since the Stage-1 1% arm (2026-06-02T07:50:54Z), split by whether
-- the owning debate carries the synthetic smoke-tag prefix
-- '[arch-001-queue-smoke]' in its title. Routing rows are identified by
-- family IS NOT NULL (legacy direct-dispatch rows leave family = NULL and
-- are excluded). Aggregate counts only; no body content; no per-row text.
--
-- Doctrine (cdiscourse): volume is an operational activity metric, never a
-- verdict about any participant, post, or claim.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops-stage1-sql/stage1-routed-volume.sql
SELECT
  COUNT(DISTINCT r.argument_id)                                                       AS routed_args_since_arm_total,
  COUNT(DISTINCT r.argument_id) FILTER (WHERE d.title NOT LIKE '[arch-001-queue-smoke]%') AS non_smoke_routed_args,
  COUNT(DISTINCT r.argument_id) FILTER (WHERE d.title LIKE '[arch-001-queue-smoke]%')     AS smoke_routed_args
FROM public.argument_machine_observation_runs r
JOIN public.debates d ON d.id = r.debate_id
WHERE r.family IS NOT NULL
  AND r.created_at >= '2026-06-02T07:50:54Z'::timestamptz;
