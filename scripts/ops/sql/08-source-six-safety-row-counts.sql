-- OPS-MCP-OBSERVABILITY — Q8 supporting data: rows that WOULD render if
-- the Source 6 production-only filter were absent.
--
-- The actual Source 6 safety assertion is script-level (re-reads the
-- literal `.eq('argument_machine_observation_runs.run_mode', 'production')`
-- substring in `src/features/nodeLabels/machineObservationPersistenceQuery.ts`).
-- This SQL provides the supporting evidence: how many admin_validation
-- result rows are being excluded by that filter today.
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q8 Part B.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/08-source-six-safety-row-counts.sql
--
-- Doctrine: aggregate counts only; no body content; no evidence span.
-- The Source 6 filter is the binding constraint at
-- machineObservationPersistenceQuery.ts:127 — this query never weakens
-- it (read-only SELECT against the same table from a different surface).
select
  r.run_mode,
  count(distinct r.id) as runs,
  count(res.id) as results_that_would_render_if_filter_absent
from public.argument_machine_observation_runs r
left join public.argument_machine_observation_results res on res.run_id = r.id
group by r.run_mode
order by r.run_mode;
