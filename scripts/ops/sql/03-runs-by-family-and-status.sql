-- OPS-MCP-OBSERVABILITY — Q3: Runs by family AND status (success/failed/fallback).
--
-- Family attribution comes from unnest(runs.requested_families) because
-- failed runs may have NO results rows (no positives ever fired), so the
-- join-through-results approach would miss them.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q3.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/03-runs-by-family-and-status.sql
--
-- Doctrine: aggregate counts only; no body content; no evidence span.
select
  requested_family,
  run_mode,
  status,
  count(*) as run_count
from (
  select
    unnest(requested_families) as requested_family,
    run_mode,
    status
  from public.argument_machine_observation_runs
) t
group by requested_family, run_mode, status
order by requested_family, run_mode, status;
