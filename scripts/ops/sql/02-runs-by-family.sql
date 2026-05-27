-- OPS-MCP-OBSERVABILITY — Q2a: Runs by family (positive-firing).
--
-- Counts ONLY runs that produced at least one positive result row. Family
-- attribution comes from `results.family` (denormalized at write time).
-- Pair this with `02b-runs-by-requested-family.sql` to see runs that were
-- attempted regardless of outcome.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q2 (D5 = both
-- join-through-results AND unnest(requested_families)).
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/02-runs-by-family.sql
--
-- Doctrine: aggregate counts only; no body content; no evidence span.
select
  res.family,
  r.run_mode,
  count(distinct r.id) as runs_with_positives
from public.argument_machine_observation_runs r
inner join public.argument_machine_observation_results res
  on res.run_id = r.id
group by res.family, r.run_mode
order by res.family, r.run_mode;
