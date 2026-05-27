-- OPS-MCP-OBSERVABILITY — Q7: Positive density per family (last 7 days).
--
-- A LEFT JOIN keeps runs with zero positives visible (family = NULL row
-- in that case). The time window is fixed at 7 days here; the script's
-- `--time-window-days <int>` flag is a script-level cap that wraps this
-- file with a parameter substitution if the operator runs it via the
-- entry script (when this file is run standalone, the 7-day default
-- applies).
--
-- Index used: `amor_runs_argument_version_completed_idx` on the
-- `started_at` predicate; results joined via `amor_results_run_idx`.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q7.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/07-positive-density-7d.sql
--
-- Doctrine: aggregate counts only; no body content; no evidence span.
with recent_runs as (
  select id, run_mode, started_at, completed_at
  from public.argument_machine_observation_runs
  where started_at >= now() - interval '7 days'
)
select
  res.family,
  r.run_mode,
  count(distinct r.id) as recent_runs,
  count(res.id) as recent_positives,
  case
    when count(distinct r.id) = 0 then null
    else round(count(res.id)::numeric / count(distinct r.id), 3)
  end as positives_per_run
from recent_runs r
left join public.argument_machine_observation_results res on res.run_id = r.id
group by res.family, r.run_mode
order by res.family nulls last, r.run_mode;
