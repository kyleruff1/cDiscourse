-- OPS-MCP-OBSERVABILITY — Q2b: Runs by requested family (all attempts).
--
-- Counts every run that requested a given family, INCLUDING runs that
-- produced zero positives (failed, fallback, or success-with-no-positives).
-- Family attribution comes from unnest(runs.requested_families) — the
-- array column that records what the caller asked for, regardless of
-- whether any positives fired.
--
-- Pair this with `02-runs-by-family.sql` to compare positive-firing runs
-- against attempted runs.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q2 (D5 = both).
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/02b-runs-by-requested-family.sql
--
-- Doctrine: aggregate counts only; no body content; no evidence span.
select
  requested_family,
  run_mode,
  count(*) as total_runs
from (
  select
    unnest(requested_families) as requested_family,
    run_mode
  from public.argument_machine_observation_runs
) t
group by requested_family, run_mode
order by requested_family, run_mode;
