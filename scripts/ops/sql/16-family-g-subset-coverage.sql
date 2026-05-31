-- OPS-MCP-OBSERVABILITY — Q16: Family G subset coverage.
--
-- ------------------------------------------------------------
-- The 18-vs-30 distinction (binding context)
-- ------------------------------------------------------------
--
-- Family G (resolution_progress) has 30 entries in the upstream Edge
-- taxonomy registry (src/features/nodeLabels/machineObservationDefinitions/familyG.ts):
--   - 18 ai_classifier-source rawKeys (the "Subset")
--   - 12 deterministic rawKeys split across auto_metadata + lifecycle:
--       * auto_metadata (5): branch_suggested, branch_created,
--         point_stalled, point_exhausted, synthesis_candidate
--       * lifecycle (7): narrowed, conceded, confirmed, synthesis_ready,
--         exhausted, branch_recommended, archived_or_resolved
--
-- Per operator Stage 2B decision (MCP-SERVER-008-FAMILY-G), only the 18
-- ai_classifier keys are routed to the MCP server. The 12 deterministic
-- keys are intentionally excluded by the Edge subset filter at
-- supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts
-- (MCP_SERVER_SUPPORTED_FAMILY_SOURCES). A future Edge / app-side card
-- will compute the 12 deterministic keys app-side without an Anthropic
-- call.
--
-- Q16 verifies the binding contract holds in the persisted data:
--   1. All observed Family G raw_keys must be ∈ the 18-key ai_classifier Subset.
--   2. If any of the 12 deterministic-key strings appears in result rows,
--      it indicates a leak from somewhere outside the MCP path (which
--      this card does NOT expect to happen — but a non-zero leak count
--      is a security-adjacent finding worth surfacing).
--
-- Disambiguation footnote (from familyGKeys.ts:127-134 upstream Decision 5):
-- there are intentional name-pairs across sources. `narrows_claim`
-- (ai_classifier) ≠ `narrowed` (lifecycle). `concedes_narrow_point`
-- (ai_classifier) ≠ `conceded` (lifecycle). `ready_for_synthesis`
-- (ai_classifier) ≠ `synthesis_ready` (lifecycle) ≠ `synthesis_candidate`
-- (auto_metadata). The MCP subset takes ONLY the ai_classifier member of
-- each pair; this Q16 query asserts the lifecycle / auto_metadata members
-- are absent from the persisted result rows.
--
-- Source-of-truth:
--   - docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md §5
--   - docs/designs/MCP-SERVER-008-FAMILY-G.md (Subset path operator decision)
--   - mcp-server/lib/familyGKeys.ts:99-118 (18-key list; FAMILY_G_RAW_KEYS)
--   - mcp-server/lib/familyGKeys.ts:136-151 (deterministic exclusion list;
--     FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS — 12 unique strings)
--
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/16-family-g-subset-coverage.sql
--
-- Doctrine: aggregate counts; no body content; no evidence span;
-- machine-taxonomy raw_key strings only (per cdiscourse-doctrine §10a).
-- Family G concession / synthesis / settlement keys are SCORING REPAIRS
-- per point-standing-economy; positive counts NEVER imply who-lost
-- (per cdiscourse-doctrine §1).
with family_g_observed as (
  select
    res.raw_key,
    r.run_mode,
    count(*) as positive_count,
    count(distinct res.argument_id) as distinct_arguments
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r on r.id = res.run_id
  where res.family = 'resolution_progress'
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
        -- 18-key ai_classifier Subset (FAMILY_G_RAW_KEYS at
        -- mcp-server/lib/familyGKeys.ts:99-118). Verbatim, in
        -- declaration order:
        'narrows_claim',
        'concedes_narrow_point',
        'ready_for_synthesis',
        'suggests_side_branch',
        'suggests_diagonal_tangent',
        'accepts_partial_with_caveat',
        'concedes_with_new_dispute',
        'proposes_settlement_terms',
        'accepts_settlement_terms',
        'concedes_broader_point',
        'common_ground_identified',
        'unresolved_point_isolated',
        'synthesis_proposed',
        'move_on_requested',
        'issue_closed_by_participant',
        'decision_criterion_proposed',
        'action_item_proposed',
        'followup_question_proposed'
      ) then 'ai_classifier_subset'
      when raw_key in (
        -- 12 deterministic keys explicitly excluded from the Subset.
        -- A non-zero positive count here is a leak indicator.
        -- FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS at
        -- mcp-server/lib/familyGKeys.ts:136-151.
        -- auto_metadata (5):
        'branch_suggested',
        'branch_created',
        'point_stalled',
        'point_exhausted',
        'synthesis_candidate',
        -- lifecycle (7):
        'narrowed',
        'conceded',
        'confirmed',
        'synthesis_ready',
        'exhausted',
        'branch_recommended',
        'archived_or_resolved'
      ) then 'deterministic_excluded_leak'
      else 'unknown_key_outside_taxonomy'
    end as subset_membership
  from family_g_observed
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
