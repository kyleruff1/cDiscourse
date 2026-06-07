-- OPS-MCP-OBSERVABILITY — Q14: Per-family per-mode signal density.
--
-- For each (family, run_mode) pair, computes the per-(run, possible_key)
-- signal density: the fraction of (run × key) cells that fired positive.
--
-- Density = total_positive_observations / (run_count × family_key_count)
--
-- family_key_count is hardcoded per family from the binding contract
-- in mcp-server/lib/family[ABCDG]Keys.ts (Subset path for Family D + G per
-- operator Stage 2B decision):
--   - parent_relation         19   mcp-server/lib/familyAKeys.ts:49 (16 + 3 MCP-BUILD2b)
--   - disagreement_axis       17   mcp-server/lib/familyBKeys.ts:53 (14 + 3 MCP-BUILD2a)
--   - misunderstanding_repair 20   mcp-server/lib/familyCKeys.ts:61 (17 + 3 MCP-BUILD2c)
--   - evidence_source_chain   19   mcp-server/lib/familyDKeys.ts:85 (Subset; 8 deterministic excluded)
--   - argument_scheme         19   mcp-server/lib/familyEKeys.ts:68 (16 + 3 MCP-BUILD2e)
--   - resolution_progress     18   mcp-server/lib/familyGKeys.ts:99 (Subset; 12 deterministic excluded)
--   - others (F, H-J)          0   not yet backfilled (F coverage card queued; H Card-1 landed 2026-05-30; I, J no MCP support)
--
-- Use cases:
--   - Compare Family D's 19-key admin_validation density to Family A's
--     16-key production density
--   - Compare production vs admin_validation per family
--   - Spot over- or under-firing patterns (operator interprets; no verdict label)
--
-- The query includes failed runs in the denominator on purpose: a failed
-- run consumed (run × key) attempt cells. Q13 already provides the
-- success-only density signal (avg_positives_per_run); Q14 complements
-- it by giving the all-runs density.
--
-- Doctrine: aggregate ratios only; raw_key + family + run_mode are
-- machine-taxonomy values; the report does NOT label a family as
-- "over-firing" or "under-firing" (per cdiscourse-doctrine §1).
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §3;
--                  docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md §4.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/14-per-family-per-mode-signal-density.sql
with run_to_family as (
  -- One row per (run, result) — LEFT JOIN so zero-positive runs are
  -- preserved. status filter excluded so failed runs count as runs in
  -- the denominator (a failed run still consumed a (run × key) cell
  -- attempt; the density measures attempt-to-positive ratio).
  select
    r.id as run_id,
    r.run_mode,
    res.family,
    res.id as result_id,
    res.raw_key
  from public.argument_machine_observation_runs r
  left join public.argument_machine_observation_results res on res.run_id = r.id
),
keyed as (
  select
    family,
    run_mode,
    count(distinct run_id) as runs,
    count(result_id) as positives,
    count(distinct raw_key) as raw_keys_observed,
    case family
      when 'parent_relation' then 19
      when 'disagreement_axis' then 17
      when 'misunderstanding_repair' then 20
      when 'evidence_source_chain' then 19
      when 'argument_scheme' then 19
      when 'resolution_progress' then 18
      else 0
    end as family_key_count
  from run_to_family
  group by family, run_mode
)
select
  family,
  run_mode,
  runs,
  positives,
  raw_keys_observed,
  family_key_count,
  round(
    positives::numeric / nullif(runs * family_key_count, 0),
    4
  ) as positives_per_run_key_cell
from keyed
order by family nulls last, run_mode;
