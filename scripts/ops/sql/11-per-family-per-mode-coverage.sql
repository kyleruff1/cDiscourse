-- OPS-MCP-OBSERVABILITY — Q11: Per-family per-mode coverage.
--
-- Surfaces run counts and status breakdown across ALL registered families
-- and both run_modes, providing a single coverage table that captures the
-- 4-family operational state:
--   - Family A (parent_relation): production + auto-trigger live + admin_validation
--   - Family B (disagreement_axis): production + auto-trigger live + admin_validation
--   - Family C (misunderstanding_repair): production + auto-trigger live + admin_validation
--   - Family D (evidence_source_chain): admin_validation only (19-key ai_classifier Subset)
--   - Families E-J: unsupported (failed attempts only if any)
--
-- Family attribution: unnest(requested_families) so failed runs (which may
-- have no `results` rows) are still counted under their requested family.
-- This is the same attribution Q2b + Q3 + Q4 use.
--
-- The query makes NO assumption that any family is mode-restricted; it
-- reports the actual observed state. The operator interprets per the
-- Edge registry (Appendix A in the report).
--
-- Preservation property: the original Q11 (Family B + C admin-validation
-- success counts) is a strict subset of this output — filter to
--   requested_family in ('disagreement_axis', 'misunderstanding_repair')
--   and run_mode = 'admin_validation'
-- and read the success_count column.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §2.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/11-per-family-per-mode-coverage.sql
--
-- Doctrine: aggregate counts only; family names are taxonomy values.
select
  requested_family,
  run_mode,
  count(*) as run_count,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'failed') as failed_count,
  count(*) filter (where status = 'fallback') as fallback_count
from (
  select
    unnest(requested_families) as requested_family,
    run_mode,
    status
  from public.argument_machine_observation_runs
) t
group by requested_family, run_mode
order by requested_family, run_mode;
