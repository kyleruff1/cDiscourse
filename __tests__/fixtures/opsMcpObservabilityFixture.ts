/**
 * OPS-MCP-OBSERVABILITY — Test fixture.
 *
 * A complete `sectionsData`-shaped object covering the 5 Subset-backfilled
 * families (parent_relation, disagreement_axis, misunderstanding_repair,
 * evidence_source_chain, resolution_progress) and both run_modes
 * (production, admin_validation). Drives the stitcher unit tests without
 * invoking `npx supabase db query`.
 *
 * Row shapes mirror the SQL files under `scripts/ops/sql/`. Values are
 * synthetic but consistent (Q1 sums reconcile with Q3; Q5 distinct
 * counts reconcile with Q6 raw_key list).
 *
 * The Q11 key is `q11-per-family-per-mode-coverage` after the
 * OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE rename (was
 * `q11-family-bc-admin-validation-check`). New keys
 * `q14-per-family-per-mode-signal-density`,
 * `q15-family-d-subset-coverage`, and
 * `q16-family-g-subset-coverage` (added by
 * OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE) ship alongside.
 *
 * Doctrine:
 *   - No body content; no evidence span values; no secrets.
 *   - No banned doctrine tokens in any field.
 *   - All raw_key values are from the registered taxonomy.
 */

export const FIXTURE_GENERATED_AT = '2026-05-27T18:00:00.000Z';

export const FIXTURE_SOURCE_SIX_CHECK = Object.freeze({
  ok: true,
  present: true,
  adminPresent: false,
  filePath: 'src/features/nodeLabels/machineObservationPersistenceQuery.ts',
});

export const FIXTURE_EDGE_REGISTRY = Object.freeze({
  ok: true,
  productionEnabled: ['parent_relation'],
  adminValidationEnabled: [
    'parent_relation',
    'disagreement_axis',
    'misunderstanding_repair',
    'evidence_source_chain',
    'argument_scheme',
    'critical_question',
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ],
  filePath:
    'supabase/functions/_shared/booleanObservations/familyRegistry.ts',
});

export const FIXTURE_SECTIONS_DATA: Record<string, ReadonlyArray<Record<string, unknown>>> = Object.freeze({
  'q01-runs-by-run-mode': Object.freeze([
    Object.freeze({
      run_mode: 'admin_validation',
      run_count: 23,
      success_count: 12,
      failed_count: 11,
      fallback_count: 0,
    }),
    Object.freeze({
      run_mode: 'production',
      run_count: 7,
      success_count: 7,
      failed_count: 0,
      fallback_count: 0,
    }),
  ]),
  'q02-runs-by-family': Object.freeze([
    Object.freeze({
      family: 'disagreement_axis',
      run_mode: 'admin_validation',
      runs_with_positives: 3,
    }),
    Object.freeze({
      family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      runs_with_positives: 3,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'admin_validation',
      runs_with_positives: 6,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'production',
      runs_with_positives: 7,
    }),
  ]),
  'q02b-runs-by-requested-family': Object.freeze([
    Object.freeze({
      requested_family: 'argument_scheme',
      run_mode: 'admin_validation',
      total_runs: 1,
    }),
    Object.freeze({
      requested_family: 'claim_clarity',
      run_mode: 'admin_validation',
      total_runs: 1,
    }),
    Object.freeze({
      requested_family: 'critical_question',
      run_mode: 'admin_validation',
      total_runs: 1,
    }),
    Object.freeze({
      requested_family: 'disagreement_axis',
      run_mode: 'admin_validation',
      total_runs: 4,
    }),
    Object.freeze({
      requested_family: 'evidence_source_chain',
      run_mode: 'admin_validation',
      total_runs: 1,
    }),
    Object.freeze({
      requested_family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      total_runs: 4,
    }),
    Object.freeze({
      requested_family: 'parent_relation',
      run_mode: 'admin_validation',
      total_runs: 7,
    }),
    Object.freeze({
      requested_family: 'parent_relation',
      run_mode: 'production',
      total_runs: 7,
    }),
    Object.freeze({
      requested_family: 'resolution_progress',
      run_mode: 'admin_validation',
      total_runs: 1,
    }),
    Object.freeze({
      requested_family: 'sensitive_composer',
      run_mode: 'admin_validation',
      total_runs: 1,
    }),
    Object.freeze({
      requested_family: 'thread_topology',
      run_mode: 'admin_validation',
      total_runs: 1,
    }),
  ]),
  'q03-runs-by-family-and-status': Object.freeze([
    Object.freeze({
      requested_family: 'disagreement_axis',
      run_mode: 'admin_validation',
      status: 'success',
      run_count: 3,
    }),
    Object.freeze({
      requested_family: 'disagreement_axis',
      run_mode: 'admin_validation',
      status: 'failed',
      run_count: 1,
    }),
    Object.freeze({
      requested_family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      status: 'success',
      run_count: 3,
    }),
    Object.freeze({
      requested_family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      status: 'failed',
      run_count: 1,
    }),
    Object.freeze({
      requested_family: 'parent_relation',
      run_mode: 'admin_validation',
      status: 'success',
      run_count: 6,
    }),
    Object.freeze({
      requested_family: 'parent_relation',
      run_mode: 'admin_validation',
      status: 'failed',
      run_count: 1,
    }),
    Object.freeze({
      requested_family: 'parent_relation',
      run_mode: 'production',
      status: 'success',
      run_count: 7,
    }),
  ]),
  'q04-failure-reasons-by-family': Object.freeze([
    Object.freeze({
      requested_family: 'argument_scheme',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'claim_clarity',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'critical_question',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'disagreement_axis',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'evidence_source_chain',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'parent_relation',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'resolution_progress',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'sensitive_composer',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
    Object.freeze({
      requested_family: 'thread_topology',
      run_mode: 'admin_validation',
      failure_reason: 'mcp_validation_failed',
      occurrences: 1,
    }),
  ]),
  'q05-positive-results-by-family': Object.freeze([
    Object.freeze({
      family: 'disagreement_axis',
      run_mode: 'admin_validation',
      positive_count: 9,
      distinct_raw_keys: 5,
      distinct_arguments: 3,
      high_confidence_count: 3,
      medium_confidence_count: 4,
      low_confidence_count: 2,
    }),
    Object.freeze({
      family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      positive_count: 3,
      distinct_raw_keys: 3,
      distinct_arguments: 3,
      high_confidence_count: 1,
      medium_confidence_count: 1,
      low_confidence_count: 1,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'admin_validation',
      positive_count: 24,
      distinct_raw_keys: 8,
      distinct_arguments: 6,
      high_confidence_count: 10,
      medium_confidence_count: 10,
      low_confidence_count: 4,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'production',
      positive_count: 7,
      distinct_raw_keys: 4,
      distinct_arguments: 7,
      high_confidence_count: 5,
      medium_confidence_count: 1,
      low_confidence_count: 1,
    }),
  ]),
  'q06-top-positive-raw-keys-by-family': Object.freeze([
    Object.freeze({
      family: 'disagreement_axis',
      run_mode: 'admin_validation',
      raw_key: 'disputes_evidence_applicability',
      positive_count: 3,
      distinct_arguments: 1,
      high_confidence: 1,
    }),
    Object.freeze({
      family: 'disagreement_axis',
      run_mode: 'admin_validation',
      raw_key: 'disputes_scope',
      positive_count: 2,
      distinct_arguments: 1,
      high_confidence: 1,
    }),
    Object.freeze({
      family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      raw_key: 'acknowledges_misread',
      positive_count: 1,
      distinct_arguments: 1,
      high_confidence: 1,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'admin_validation',
      raw_key: 'supports_parent',
      positive_count: 8,
      distinct_arguments: 4,
      high_confidence: 5,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'admin_validation',
      raw_key: 'challenges_parent',
      positive_count: 6,
      distinct_arguments: 3,
      high_confidence: 4,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'production',
      raw_key: 'supports_parent',
      positive_count: 3,
      distinct_arguments: 3,
      high_confidence: 2,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'production',
      raw_key: 'has_rebuttal',
      positive_count: 2,
      distinct_arguments: 2,
      high_confidence: 2,
    }),
  ]),
  'q07-positive-density-7d': Object.freeze([
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'production',
      recent_runs: 5,
      recent_positives: 12,
      positives_per_run: 2.4,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'admin_validation',
      recent_runs: 3,
      recent_positives: 8,
      positives_per_run: 2.667,
    }),
  ]),
  'q08-source-six-safety': Object.freeze([
    Object.freeze({
      run_mode: 'admin_validation',
      runs: 23,
      results_that_would_render_if_filter_absent: 36,
    }),
    Object.freeze({
      run_mode: 'production',
      runs: 7,
      results_that_would_render_if_filter_absent: 7,
    }),
  ]),
  'q09-duplicate-runs': Object.freeze([]),
  'q10-family-a-auto-trigger-recent': Object.freeze([
    Object.freeze({
      day: '2026-05-25T00:00:00.000Z',
      production_runs: 3,
      success_count: 3,
      failed_count: 0,
    }),
    Object.freeze({
      day: '2026-05-24T00:00:00.000Z',
      production_runs: 2,
      success_count: 2,
      failed_count: 0,
    }),
  ]),
  'q11-per-family-per-mode-coverage': Object.freeze([
    Object.freeze({
      requested_family: 'disagreement_axis',
      run_mode: 'admin_validation',
      run_count: 4,
      success_count: 3,
      failed_count: 1,
      fallback_count: 0,
    }),
    Object.freeze({
      requested_family: 'disagreement_axis',
      run_mode: 'production',
      run_count: 1,
      success_count: 1,
      failed_count: 0,
      fallback_count: 0,
    }),
    Object.freeze({
      requested_family: 'evidence_source_chain',
      run_mode: 'admin_validation',
      run_count: 14,
      success_count: 3,
      failed_count: 11,
      fallback_count: 0,
    }),
    Object.freeze({
      requested_family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      run_count: 4,
      success_count: 3,
      failed_count: 1,
      fallback_count: 0,
    }),
    Object.freeze({
      requested_family: 'misunderstanding_repair',
      run_mode: 'production',
      run_count: 1,
      success_count: 1,
      failed_count: 0,
      fallback_count: 0,
    }),
    Object.freeze({
      requested_family: 'parent_relation',
      run_mode: 'admin_validation',
      run_count: 6,
      success_count: 6,
      failed_count: 0,
      fallback_count: 0,
    }),
    Object.freeze({
      requested_family: 'parent_relation',
      run_mode: 'production',
      run_count: 6,
      success_count: 6,
      failed_count: 0,
      fallback_count: 0,
    }),
  ]),
  'q12-unsupported-family-attempts': Object.freeze([
    Object.freeze({
      unsupported_family_attempted: 'argument_scheme',
      attempts: 1,
      failed_attempts: 1,
      mcp_validation_failed_attempts: 1,
      positives_observed: 0,
    }),
    Object.freeze({
      unsupported_family_attempted: 'claim_clarity',
      attempts: 1,
      failed_attempts: 1,
      mcp_validation_failed_attempts: 1,
      positives_observed: 0,
    }),
    Object.freeze({
      unsupported_family_attempted: 'critical_question',
      attempts: 1,
      failed_attempts: 1,
      mcp_validation_failed_attempts: 1,
      positives_observed: 0,
    }),
    Object.freeze({
      unsupported_family_attempted: 'evidence_source_chain',
      attempts: 1,
      failed_attempts: 1,
      mcp_validation_failed_attempts: 1,
      positives_observed: 0,
    }),
    Object.freeze({
      unsupported_family_attempted: 'resolution_progress',
      attempts: 1,
      failed_attempts: 1,
      mcp_validation_failed_attempts: 1,
      positives_observed: 0,
    }),
    Object.freeze({
      unsupported_family_attempted: 'sensitive_composer',
      attempts: 1,
      failed_attempts: 1,
      mcp_validation_failed_attempts: 1,
      positives_observed: 0,
    }),
    Object.freeze({
      unsupported_family_attempted: 'thread_topology',
      attempts: 1,
      failed_attempts: 1,
      mcp_validation_failed_attempts: 1,
      positives_observed: 0,
    }),
  ]),
  'q13-over-under-firing-summary': Object.freeze([
    Object.freeze({
      family: 'disagreement_axis',
      run_mode: 'admin_validation',
      completed_runs: 3,
      arguments_with_positives: 3,
      raw_keys_observed: 5,
      total_positives: 9,
      avg_positives_per_run: 3.0,
      fraction_of_runs_with_any_positive: 1.0,
    }),
    Object.freeze({
      family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      completed_runs: 3,
      arguments_with_positives: 3,
      raw_keys_observed: 3,
      total_positives: 3,
      avg_positives_per_run: 1.0,
      fraction_of_runs_with_any_positive: 1.0,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'admin_validation',
      completed_runs: 6,
      arguments_with_positives: 6,
      raw_keys_observed: 8,
      total_positives: 24,
      avg_positives_per_run: 4.0,
      fraction_of_runs_with_any_positive: 1.0,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'production',
      completed_runs: 7,
      arguments_with_positives: 7,
      raw_keys_observed: 4,
      total_positives: 7,
      avg_positives_per_run: 1.0,
      fraction_of_runs_with_any_positive: 1.0,
    }),
  ]),
  'q14-per-family-per-mode-signal-density': Object.freeze([
    Object.freeze({
      family: 'disagreement_axis',
      run_mode: 'admin_validation',
      runs: 2,
      positives: 7,
      raw_keys_observed: 4,
      // MCP-BUILD2a: disagreement_axis 14 → 17 booleans. Density recomputed:
      // 7 / (2 runs × 17 keys) = 0.2059.
      family_key_count: 17,
      positives_per_run_key_cell: 0.2059,
    }),
    Object.freeze({
      family: 'evidence_source_chain',
      run_mode: 'admin_validation',
      runs: 2,
      positives: 4,
      raw_keys_observed: 2,
      family_key_count: 19,
      positives_per_run_key_cell: 0.1053,
    }),
    Object.freeze({
      family: 'misunderstanding_repair',
      run_mode: 'admin_validation',
      runs: 2,
      positives: 3,
      raw_keys_observed: 2,
      family_key_count: 17,
      positives_per_run_key_cell: 0.0882,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'admin_validation',
      runs: 4,
      positives: 12,
      raw_keys_observed: 3,
      // MCP-BUILD2b: parent_relation 16 → 19 booleans. Density recomputed:
      // 12 / (4 runs × 19 keys) = 0.1579.
      family_key_count: 19,
      positives_per_run_key_cell: 0.1579,
    }),
    Object.freeze({
      family: 'parent_relation',
      run_mode: 'production',
      runs: 4,
      positives: 12,
      raw_keys_observed: 4,
      // MCP-BUILD2b: parent_relation 16 → 19 booleans. Density recomputed:
      // 12 / (4 runs × 19 keys) = 0.1579.
      family_key_count: 19,
      positives_per_run_key_cell: 0.1579,
    }),
  ]),
  'q15-family-d-subset-coverage': Object.freeze([
    Object.freeze({
      raw_key: 'evidence_gap_present',
      run_mode: 'admin_validation',
      positive_count: 2,
      distinct_arguments: 2,
      subset_membership: 'ai_classifier_subset',
    }),
    Object.freeze({
      raw_key: 'opens_evidence_debt_marker',
      run_mode: 'admin_validation',
      positive_count: 2,
      distinct_arguments: 2,
      subset_membership: 'ai_classifier_subset',
    }),
  ]),
  'q16-family-g-subset-coverage': Object.freeze([
    Object.freeze({
      raw_key: 'narrows_claim',
      run_mode: 'admin_validation',
      positive_count: 2,
      distinct_arguments: 2,
      subset_membership: 'ai_classifier_subset',
    }),
    Object.freeze({
      raw_key: 'synthesis_proposed',
      run_mode: 'production',
      positive_count: 1,
      distinct_arguments: 1,
      subset_membership: 'ai_classifier_subset',
    }),
  ]),
});

/**
 * An "empty DB" variant — every section returns zero rows. Drives the
 * empty-DB safety test.
 */
export const FIXTURE_EMPTY_SECTIONS_DATA: Record<string, ReadonlyArray<Record<string, unknown>>> = Object.freeze({
  'q01-runs-by-run-mode': Object.freeze([]),
  'q02-runs-by-family': Object.freeze([]),
  'q02b-runs-by-requested-family': Object.freeze([]),
  'q03-runs-by-family-and-status': Object.freeze([]),
  'q04-failure-reasons-by-family': Object.freeze([]),
  'q05-positive-results-by-family': Object.freeze([]),
  'q06-top-positive-raw-keys-by-family': Object.freeze([]),
  'q07-positive-density-7d': Object.freeze([]),
  'q08-source-six-safety': Object.freeze([]),
  'q09-duplicate-runs': Object.freeze([]),
  'q10-family-a-auto-trigger-recent': Object.freeze([]),
  'q11-per-family-per-mode-coverage': Object.freeze([]),
  'q12-unsupported-family-attempts': Object.freeze([]),
  'q13-over-under-firing-summary': Object.freeze([]),
  'q14-per-family-per-mode-signal-density': Object.freeze([]),
  'q15-family-d-subset-coverage': Object.freeze([]),
  'q16-family-g-subset-coverage': Object.freeze([]),
});
