-- OPS-MCP-OBSERVABILITY — Q6: Top positive raw_keys by family.
--
-- Aggregates positive result rows by (family, run_mode, raw_key) so the
-- operator can identify the concentration of positive signal across the
-- 47 supported raw_keys (Family A=16, B=14, C=17).
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q6.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/06-top-positive-raw-keys-by-family.sql
--
-- Doctrine: aggregate counts + machine-taxonomy raw_key values only;
-- no body content; no evidence span (evidence_span is excluded from
-- SELECT — see SQL-safety test).
select
  res.family,
  r.run_mode,
  res.raw_key,
  count(*) as positive_count,
  count(distinct res.argument_id) as distinct_arguments,
  count(*) filter (where res.confidence = 'high') as high_confidence
from public.argument_machine_observation_results res
inner join public.argument_machine_observation_runs r on r.id = res.run_id
group by res.family, r.run_mode, res.raw_key
order by res.family, r.run_mode, positive_count desc, res.raw_key
limit 100;
