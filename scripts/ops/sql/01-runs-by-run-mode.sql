-- OPS-MCP-OBSERVABILITY — Q1: How many runs exist by run_mode?
--
-- Read-only aggregate over `argument_machine_observation_runs`.
-- Index used: `argument_machine_observation_runs_run_mode_idx` (direct on run_mode).
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q1.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/01-runs-by-run-mode.sql
--
-- Doctrine: counts only; no body content, no evidence span, no secrets.
select
  run_mode,
  count(*) as run_count,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'failed') as failed_count,
  count(*) filter (where status = 'fallback') as fallback_count
from public.argument_machine_observation_runs
group by run_mode
order by run_mode;
