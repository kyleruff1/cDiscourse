-- OPS-MCP-OBSERVABILITY — Q12: Unsupported-family attempts (D-J) visibility.
--
-- For each unsupported family (D-J: 7 families), counts:
--   - attempts (any run that requested the family)
--   - failed_attempts
--   - mcp_validation_failed (the specific failure_reason most expected
--     for unsupported families per the registry rejection path)
--   - positives_observed (BINDING ASSERTION: must be 0 for every
--     unsupported family — any non-zero is a security-adjacent finding)
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q12.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/12-unsupported-family-attempts.sql
--
-- Doctrine: aggregate counts only; failure_reason values are
-- server-controlled enums. Binding: positives_observed = 0 for every
-- unsupported family.
with unsupported as (
  select unnest(array[
    'evidence_source_chain', 'argument_scheme', 'critical_question',
    'resolution_progress', 'claim_clarity', 'thread_topology',
    'sensitive_composer'
  ]) as family_name
)
select
  u.family_name as unsupported_family_attempted,
  count(r.id) as attempts,
  count(r.id) filter (where r.status = 'failed') as failed_attempts,
  count(r.id) filter (where r.failure_reason = 'mcp_validation_failed') as mcp_validation_failed_attempts,
  -- Binding assertion: zero positives for unsupported families.
  (
    select count(res.id)
    from public.argument_machine_observation_results res
    inner join public.argument_machine_observation_runs r2 on r2.id = res.run_id
    where res.family = u.family_name
       or u.family_name = any(r2.requested_families)
  ) as positives_observed
from unsupported u
left join public.argument_machine_observation_runs r
  on u.family_name = any(r.requested_families)
group by u.family_name
order by u.family_name;
