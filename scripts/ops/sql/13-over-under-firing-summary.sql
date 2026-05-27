-- OPS-MCP-OBSERVABILITY — Q13: Over/under-firing summary (operator-interpretive).
--
-- Surfaces ratios so the operator can compare expected vs observed
-- raw_key coverage per family. The report does NOT label any family as
-- "over-firing" or "under-firing" — those terms appear in the section
-- title (mirroring the operator's §6 question wording) but no specific
-- family is tagged with a verdict. The script computes:
--   - completed_runs            (successful only)
--   - arguments_with_positives  (distinct argument coverage)
--   - raw_keys_observed         (distinct raw_keys per family — compare
--                                to expected: A=16, B=14, C=17)
--   - total_positives
--   - avg_positives_per_run     (density)
--   - fraction_of_runs_with_any_positive
--
-- The static expected-rawKeys reference comes from the report's
-- Appendix A (parsed from `mcp-server/lib/familyAKeys.ts` etc.).
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q13.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/13-over-under-firing-summary.sql
--
-- Doctrine: aggregate counts and ratios only; no body content; no
-- evidence span; no verdict on any family — the operator interprets.
select
  res.family,
  r.run_mode,
  count(distinct r.id) as completed_runs,
  count(distinct res.argument_id) as arguments_with_positives,
  count(distinct res.raw_key) as raw_keys_observed,
  count(res.id) as total_positives,
  round(count(res.id)::numeric / nullif(count(distinct r.id), 0), 3) as avg_positives_per_run,
  round(
    count(distinct res.argument_id)::numeric / nullif(count(distinct r.id), 0),
    3
  ) as fraction_of_runs_with_any_positive
from public.argument_machine_observation_runs r
left join public.argument_machine_observation_results res on res.run_id = r.id
where r.status = 'success'
group by res.family, r.run_mode
order by res.family nulls last, r.run_mode;
