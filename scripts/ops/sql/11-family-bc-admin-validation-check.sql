-- OPS-MCP-OBSERVABILITY — Q11: Family B + C admin-validation-only check.
--
-- DB observation that complements the script-level registry assertion:
-- counts successful runs for Family B (disagreement_axis) and Family C
-- (misunderstanding_repair) by run_mode. If any production-mode row
-- appears for B or C, the script flags it as a registry-vs-DB
-- inconsistency.
--
-- The script reads `supabase/functions/_shared/booleanObservations/familyRegistry.ts`
-- and asserts `productionEnabled: false` for both families; this SQL
-- confirms the DB matches the registry.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q11 Part B.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/11-family-bc-admin-validation-check.sql
--
-- Doctrine: aggregate counts only; family names are taxonomy values.
select
  requested_family,
  run_mode,
  count(*) as run_count
from (
  select unnest(requested_families) as requested_family, run_mode
  from public.argument_machine_observation_runs
  where status = 'success'
) t
where requested_family in ('disagreement_axis', 'misunderstanding_repair')
group by requested_family, run_mode
order by requested_family, run_mode;
