-- OPS-MCP-OBSERVABILITY — Q5: Positive result rows by family.
--
-- Aggregates the `argument_machine_observation_results` table by family
-- AND run_mode. Per the operator-visibility rule, BOTH production and
-- admin_validation rows are surfaced (operator sees the full picture;
-- only Source 6 rendering enforces production-only).
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q5.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/05-positive-results-by-family.sql
--
-- Doctrine: aggregate counts only; raw_key + family + confidence are
-- machine-taxonomy values (per cdiscourse-doctrine §10a, not verdicts).
select
  res.family,
  r.run_mode,
  count(*) as positive_count,
  count(distinct res.raw_key) as distinct_raw_keys,
  count(distinct res.argument_id) as distinct_arguments,
  count(*) filter (where res.confidence = 'high') as high_confidence_count,
  count(*) filter (where res.confidence = 'medium') as medium_confidence_count,
  count(*) filter (where res.confidence = 'low') as low_confidence_count
from public.argument_machine_observation_results res
inner join public.argument_machine_observation_runs r on r.id = res.run_id
group by res.family, r.run_mode
order by res.family, r.run_mode;
