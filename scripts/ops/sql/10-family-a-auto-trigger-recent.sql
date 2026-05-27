-- OPS-MCP-OBSERVABILITY — Q10: Family A auto-trigger production heartbeat.
--
-- Checks whether Family A (parent_relation) production-mode runs are
-- happening recently. The `'parent_relation' = any(requested_families)`
-- predicate scopes to Family A; the `run_mode = 'production'` predicate
-- scopes to production traffic (admin_validation B+C smokes are
-- excluded). Last 7 days only.
--
-- Index used: `argument_machine_observation_runs_run_mode_idx` for the
-- mode predicate; `amor_runs_argument_version_completed_idx` for the
-- `completed_at` predicate.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q10.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/10-family-a-auto-trigger-recent.sql
--
-- Doctrine: aggregate counts only; no body content; no evidence span.
select
  date_trunc('day', completed_at) as day,
  count(*) as production_runs,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'failed') as failed_count
from public.argument_machine_observation_runs
where run_mode = 'production'
  and 'parent_relation' = any(requested_families)
  and completed_at >= now() - interval '7 days'
group by date_trunc('day', completed_at)
order by day desc;
