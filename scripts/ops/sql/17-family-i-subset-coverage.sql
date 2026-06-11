-- OPS-MCP-OBSERVABILITY — Q17: Family I subset coverage.
--
-- ------------------------------------------------------------
-- The 6-vs-21 distinction (binding context)
-- ------------------------------------------------------------
--
-- Family I (thread_topology) has 21 entries in the upstream Edge
-- taxonomy registry (src/features/nodeLabels/machineObservationDefinitions/familyI.ts):
--   - 6 ai_classifier-source rawKeys (the "Subset") — the text-derivable
--     thread-graph relations routed to the MCP server.
--   - 15 deterministic rawKeys split across auto_metadata + lifecycle:
--       * auto_metadata (8): has_reply, participant_skipped_node,
--         no_response_after_n_turns, repeated_axis_pressure, splits_thread,
--         merges_thread, references_sibling_node, references_ancestor_node
--       * lifecycle (7): open, answered, moved_on_by_affirmative,
--         moved_on_by_negative, ignored_by_affirmative, ignored_by_negative,
--         ignored_by_both
--
-- Per operator Stage 2B decision (MCP-SERVER-010-FAMILY-I), only the 6
-- ai_classifier keys are routed to the MCP server. The 15 deterministic
-- keys are NOT LLM-classified — the 8 auto_metadata keys are derivable
-- from argument-tree structure and the 7 lifecycle keys are
-- cluster/temporal-derived; both are intentionally excluded
-- (FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS). The Edge subset entry that
-- enforces this at the request boundary is a separate follow-up card.
--
-- Q17 verifies the binding contract holds in the persisted data:
--   1. All observed Family I raw_keys must be in the 6-key ai_classifier
--      Subset.
--   2. If any of the 15 deterministic-key strings appears in result rows,
--      it indicates a leak from somewhere outside the MCP path (which
--      this card does NOT expect — but a non-zero leak count is a
--      security-adjacent finding worth surfacing).
--
-- Minority-subset asymmetry (observability-relevant): unlike Family D
-- (22 of 30 routed) and Family G (21 of 33 routed), Family I routes only
-- the MINORITY of its keys (6 of 21); 15 keys are deterministic-excluded.
-- A misrouted deterministic key has a 15/21 chance of being one of the
-- excluded set, so this leak-detection query is MORE load-bearing for I
-- than for D or G. All 21 Family I strings are unique within the family
-- (no name-pair collision, unlike Family G), so the included(6) and
-- excluded(15) sets are disjoint and union to 21.
--
-- Source-of-truth:
--   - docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-HI-COVERAGE.md §4
--   - docs/designs/MCP-SERVER-010-FAMILY-I.md (Subset path operator decision)
--   - mcp-server/lib/familyIKeys.ts:92-99 (6-key list; FAMILY_I_RAW_KEYS)
--   - mcp-server/lib/familyIKeys.ts:117-135 (deterministic exclusion list;
--     FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS — 8 auto_metadata + 7 lifecycle)
--
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/17-family-i-subset-coverage.sql
--
-- Doctrine: aggregate counts; no body content; no evidence span;
-- machine-taxonomy raw_key strings only (per cdiscourse-doctrine §10a).
-- Family I thread-topology keys are DESCRIPTIVE STRUCTURE per
-- cdiscourse-doctrine §1 — introducing a new issue is not a derailment,
-- returning to a prior issue is not repetition, and comparing options
-- never adjudicates between the options. The references_external_context
-- key records only the structural fact of an external reference and
-- NEVER grants factual standing (cdiscourse-doctrine §3 — popularity is
-- not evidence; the query has no engagement/virality column to leak
-- through). Per point-standing-economy, Family I emits no standing delta;
-- topology positives never lower a move's factual-standing eligibility.
with family_i_observed as (
  select
    res.raw_key,
    r.run_mode,
    count(*) as positive_count,
    count(distinct res.argument_id) as distinct_arguments
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r on r.id = res.run_id
  where res.family = 'thread_topology'
  group by res.raw_key, r.run_mode
),
classification as (
  select
    raw_key,
    run_mode,
    positive_count,
    distinct_arguments,
    case
      when raw_key in (
        -- 6-key ai_classifier Subset (FAMILY_I_RAW_KEYS at
        -- mcp-server/lib/familyIKeys.ts:92-99). Verbatim, in declaration
        -- order:
        'introduces_new_issue',
        'references_prior_agreement',
        'introduces_sub_axis',
        'returns_to_prior_issue',
        'references_external_context',
        'compares_options'
      ) then 'ai_classifier_subset'
      when raw_key in (
        -- 15 deterministic keys explicitly excluded from the Subset.
        -- A non-zero positive count here is a leak indicator.
        -- FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS at
        -- mcp-server/lib/familyIKeys.ts:117-135.
        -- auto_metadata (8):
        'has_reply',
        'participant_skipped_node',
        'no_response_after_n_turns',
        'repeated_axis_pressure',
        'splits_thread',
        'merges_thread',
        'references_sibling_node',
        'references_ancestor_node',
        -- lifecycle (7):
        'open',
        'answered',
        'moved_on_by_affirmative',
        'moved_on_by_negative',
        'ignored_by_affirmative',
        'ignored_by_negative',
        'ignored_by_both'
      ) then 'deterministic_excluded_leak'
      else 'unknown_key_outside_taxonomy'
    end as subset_membership
  from family_i_observed
)
select
  raw_key,
  run_mode,
  positive_count,
  distinct_arguments,
  subset_membership
from classification
order by
  -- Surface leaks first if any (defensive ordering so the operator
  -- sees the most-urgent classification at the top of the section).
  case subset_membership
    when 'deterministic_excluded_leak' then 1
    when 'unknown_key_outside_taxonomy' then 2
    when 'ai_classifier_subset' then 3
    else 4
  end,
  positive_count desc,
  raw_key;
