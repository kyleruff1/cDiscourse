-- OPS-MCP-OBSERVABILITY — Q15: Family D subset coverage.
--
-- ------------------------------------------------------------
-- The 19-vs-27 distinction (binding context)
-- ------------------------------------------------------------
--
-- Family D (evidence_source_chain) has 27 entries in the upstream Edge
-- taxonomy registry (src/features/nodeLabels/machineObservationDefinitions/familyD.ts):
--   - 19 ai_classifier-source rawKeys (the "Subset")
--   - 8 deterministic rawKeys split across auto_metadata + lifecycle:
--       * auto_metadata: has_evidence, source_requested, quote_requested,
--         source_attached, quote_attached (5)
--       * lifecycle: sourced, source_requested, quote_requested (3; 2
--         share string names with auto_metadata so the unique string
--         count is 6)
--
-- Per operator Stage 2B decision (MCP-SERVER-005-FAMILY-D), only the 19
-- ai_classifier keys are routed to the MCP server. The 8 deterministic
-- keys are intentionally excluded by the Edge subset filter at
-- supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts
-- (MCP_SERVER_SUPPORTED_FAMILY_SOURCES). A future Edge / app-side card
-- (MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS) will compute the 8
-- deterministic keys app-side without an Anthropic call.
--
-- Q15 verifies the binding contract holds in the persisted data:
--   1. All observed Family D raw_keys must be ∈ the 19-key ai_classifier Subset.
--   2. If any of the 6 deterministic-key strings appears in result rows,
--      it indicates a leak from somewhere outside the MCP path (which
--      this card does NOT expect to happen — but a non-zero leak count
--      is a security-adjacent finding worth surfacing).
--
-- Source-of-truth:
--   - docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §4
--   - docs/designs/MCP-SERVER-005-FAMILY-D.md (Subset path operator decision)
--   - mcp-server/lib/familyDKeys.ts:85-105 (19-key list; FAMILY_D_RAW_KEYS)
--   - mcp-server/lib/familyDKeys.ts:119-129 (deterministic exclusion list;
--     FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS — 6 unique strings)
--
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/15-family-d-subset-coverage.sql
--
-- Doctrine: aggregate counts; no body content; no evidence span;
-- machine-taxonomy raw_key strings only (per cdiscourse-doctrine §10a).
with family_d_observed as (
  select
    res.raw_key,
    r.run_mode,
    count(*) as positive_count,
    count(distinct res.argument_id) as distinct_arguments
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r on r.id = res.run_id
  where res.family = 'evidence_source_chain'
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
        -- 19-key ai_classifier Subset (FAMILY_D_RAW_KEYS at
        -- mcp-server/lib/familyDKeys.ts:85-105). Verbatim, in
        -- declaration order:
        'asks_for_evidence',
        'provides_evidence',
        'evidence_supports_claim',
        'creates_source_chain_gap',
        'opens_evidence_debt_marker',
        'closes_evidence_debt_marker',
        'supplies_corroborating_document',
        'source_provided',
        'quote_provided',
        'concrete_example_requested',
        'concrete_example_provided',
        'evidence_claim_present',
        'evidence_gap_present',
        'source_chain_repair',
        'anecdote_used',
        'statistic_used',
        'external_authority_used',
        'evidence_quality_questioned',
        'burden_request_present'
      ) then 'ai_classifier_subset'
      when raw_key in (
        -- 6 deterministic keys explicitly excluded from the Subset.
        -- A non-zero positive count here is a leak indicator.
        -- FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS at
        -- mcp-server/lib/familyDKeys.ts:119-129 (unique strings).
        'has_evidence',
        'source_requested',
        'quote_requested',
        'source_attached',
        'quote_attached',
        'sourced'
      ) then 'deterministic_excluded_leak'
      else 'unknown_key_outside_taxonomy'
    end as subset_membership
  from family_d_observed
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
