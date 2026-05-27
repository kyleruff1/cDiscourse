-- OPS-MCP-OBSERVABILITY — Q12: Unsupported-family attempts visibility.
--
-- Per intent brief OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING:
-- the unsupported-family list is data-derived (not hardcoded), and
-- positives_observed is computed by strict per-row family= match.
--
-- supported_families: DISTINCT family from result rows produced by a
-- real (non-synthetic) provider. provider_key lives on runs, so this
-- CTE JOINs results to runs and excludes provider_key LIKE 'smoke-%'
-- (synthetic test seeds) plus NULL provider_key (unverified rows).
--
-- unsupported_families: DISTINCT family from all result rows MINUS
-- the supported set. A family appears here only if every result row
-- bearing it was produced by a synthetic (smoke) provider — i.e., no
-- real provider has ever ratified the family.
--
-- For each unsupported family, counts:
--   - attempts (any run that requested the family)
--   - failed_attempts
--   - mcp_validation_failed (the specific failure_reason most expected
--     for unsupported families per the registry rejection path)
--   - positives_observed (strict res.family = u.family_name; the
--     previous OR-on-requested_families clause has been removed; in a
--     multi-family run, a positive row counts only against its own
--     persisted family)
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING.md.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/12-unsupported-family-attempts.sql
--
-- Doctrine: aggregate counts only; failure_reason values are
-- server-controlled enums; family names are machine taxonomy values
-- (not verdicts).
with supported_families as (
  select distinct res.family as family_name
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r_sf
    on r_sf.id = res.run_id
  where res.family is not null
    and r_sf.provider_key is not null
    and r_sf.provider_key not like 'smoke-%'
),
unsupported_families as (
  select distinct res.family as family_name
  from public.argument_machine_observation_results res
  where res.family is not null
    and res.family not in (select family_name from supported_families)
)
select
  u.family_name as unsupported_family_attempted,
  count(r.id) as attempts,
  count(r.id) filter (where r.status = 'failed') as failed_attempts,
  count(r.id) filter (where r.failure_reason = 'mcp_validation_failed') as mcp_validation_failed_attempts,
  -- Strict per-row family= match; OR-on-requested_families removed.
  (
    select count(res.id)
    from public.argument_machine_observation_results res
    where res.family = u.family_name
  ) as positives_observed
from unsupported_families u
left join public.argument_machine_observation_runs r
  on u.family_name = any(r.requested_families)
group by u.family_name
order by u.family_name;
