-- OPS-MCP-OBSERVABILITY — Q9: Duplicate successful runs.
--
-- Detects multiple successful runs for the same
-- (argument_id, family, run_mode, schema_version, provider_key, model_name)
-- tuple. Family attribution joins through results because family lives on
-- results (D5 resolution). A duplicate successful run with positives is an
-- idempotency-hardening candidate per `OPS-MCP-IDEMPOTENCY-HARDENING`.
--
-- Expected today: zero rows (Family A auto-trigger idempotency is
-- per-arg; Family B+C admin_validation smokes used distinct argument
-- sets). Non-zero rows surface as a follow-on card candidate per
-- intent brief §15.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q9.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/09-duplicate-runs.sql
--
-- Doctrine: aggregate counts only; no body content; no evidence span.
with run_to_family as (
  -- For each successful run, distinct (run, family) tuples where the
  -- run produced at least one positive. A LEFT JOIN preserves runs
  -- with zero positives (family = NULL — filtered below).
  select distinct r.id as run_id, r.argument_id, r.run_mode,
                  r.schema_version, r.provider_key, r.model_name,
                  res.family,
                  r.status
  from public.argument_machine_observation_runs r
  left join public.argument_machine_observation_results res on res.run_id = r.id
  where r.status = 'success'
)
select
  argument_id,
  family,
  run_mode,
  schema_version,
  provider_key,
  model_name,
  count(distinct run_id) as duplicate_successful_runs
from run_to_family
where family is not null
group by argument_id, family, run_mode, schema_version, provider_key, model_name
having count(distinct run_id) > 1
order by duplicate_successful_runs desc, argument_id, family;
