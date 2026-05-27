-- OPS-MCP-OBSERVABILITY — Q4: Top failure_reason values by family.
--
-- `failure_reason` is a server-controlled enum-like string (e.g.,
-- 'mcp_validation_failed') — NOT user content. Safe to aggregate
-- verbatim. Family attribution via unnest(requested_families) because
-- failed runs typically have no results rows.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q4.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/04-failure-reasons-by-family.sql
--
-- Doctrine: aggregate counts only; failure_reason values are
-- server-controlled enums (no user content).
select
  requested_family,
  run_mode,
  failure_reason,
  count(*) as occurrences
from (
  select
    unnest(requested_families) as requested_family,
    run_mode,
    failure_reason
  from public.argument_machine_observation_runs
  where status = 'failed'
    and failure_reason is not null
) t
group by requested_family, run_mode, failure_reason
order by occurrences desc, requested_family, run_mode, failure_reason
limit 100;
