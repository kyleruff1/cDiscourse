/**
 * MCP-SERVER-005-FAMILY-D fix + MCP-BUILD2d — Edge → MCP subset filter
 * regression coverage.
 *
 * Card 2 (MCP-SERVER-005-FAMILY-D) shipped the 19-key ai_classifier Subset
 * per operator Stage 2B decision; MCP-BUILD2d takes it to 22 (+3 evidence-
 * dynamic booleans). The MCP server supports those 22 keys only; requesting
 * any of the 8 deterministic Family D rawKeys (5 auto_metadata + 3 lifecycle,
 * 6 unique strings) triggers MCP's `unsupported_rawKey` validation → Edge maps
 * to `mcp_validation_failed`.
 *
 * `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain']
 * = {'ai_classifier'}` filters the request builder to only send the
 * 22 ai_classifier rawKeys. Other families (A/B/C) have no entry in the
 * map, so all of their sources pass through unchanged (current behavior
 * preserved byte-equal).
 *
 * NOTE (MCP-BUILD2d batching): this test exercises
 * `buildBooleanObservationRequestForArgument`, which builds the FULL
 * 22-key family request. The chunking into 2 batches (16 + 6) happens
 * downstream in `classifyOneArgumentCore`, AFTER this builder — so the full
 * request correctly carries all 22 keys here. The batching proof lives in
 * mcpBuild2dFamilyD.test.ts §0.5.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §10a — structural observations only
 *   - cdiscourse-doctrine §7 — pure TS; no Deno-specific calls
 *   - Stage 2B operator binding — Subset path only; no compound-key
 *     response shape; no schema mirror change; no Anthropic inference
 *     of deterministic facts
 */

import {
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';

const FAMILY_D_AI_CLASSIFIER_KEYS = [
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
  'burden_request_present',
  // MCP-BUILD2d additions (Subset 19 → 22).
  'names_method_difference',
  'separates_observation_from_inference',
  'flags_context_limit',
] as const;

const FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS = [
  // auto_metadata (5)
  'has_evidence',
  'source_requested',
  'quote_requested',
  'source_attached',
  'quote_attached',
  // lifecycle (3); source_requested + quote_requested are compound-key
  // collisions with auto_metadata and dedupe to one string each.
  'sourced',
] as const;

const FAMILY_D_BASE_INPUT = {
  argumentId: 'arg-d-1',
  parentArgumentId: 'arg-d-0',
  currentText: 'a reply that may or may not provide evidence',
  parentText: 'a claim being evaluated for evidence chain',
  threadContextExcerpt: 'thread context',
  requestedFamilies: ['evidence_source_chain' as const],
  mode: 'admin_validation' as const,
};

describe('MCP-SERVER-005-FAMILY-D Edge → MCP subset filter (Stage 2B fix)', () => {
  it('SF-1 — Family D admin_validation request contains exactly 22 ai_classifier rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_BASE_INPUT);
    expect(req.requestedRawKeys.length).toBe(22);
  });

  it('SF-2 — every Family D rawKey sent matches the operator-approved 22-key ai_classifier set', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_BASE_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const expected of FAMILY_D_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }
    expect(sent.size).toBe(22);
  });

  it('SF-3 — Family D request does NOT include any of the 8 excluded deterministic rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_BASE_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const excluded of FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });

  it('SF-4 — Family D definitions map size matches the 22 rawKeys (no orphan keys)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_BASE_INPUT);
    expect(Object.keys(req.definitions).length).toBe(22);
    for (const key of Object.keys(req.definitions)) {
      expect(FAMILY_D_AI_CLASSIFIER_KEYS.includes(key as never)).toBe(true);
    }
  });

  it('SF-5 — every Family D definition emitted has source=ai_classifier', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_BASE_INPUT);
    for (const def of Object.values(req.definitions)) {
      expect(def.source).toBe('ai_classifier');
    }
  });

  it('SF-6 — Family A admin_validation request is unaffected (all 19 rawKeys still sent; current behavior preserved)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_BASE_INPUT,
      requestedFamilies: ['parent_relation'],
    });
    // Family A has 19 rawKeys post MCP-BUILD2b (16 + 3) across auto_metadata +
    // lifecycle + ai_classifier; all must pass through (no source filter for
    // parent_relation — the 3 new keys are ai_classifier).
    expect(req.requestedRawKeys.length).toBe(19);
  });

  it('SF-7 — Family B admin_validation request is unaffected', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_BASE_INPUT,
      requestedFamilies: ['disagreement_axis'],
    });
    // Family B has 17 rawKeys post MCP-BUILD2a (all ai_classifier); none are
    // excluded by a source-subset filter, so all must pass through.
    expect(req.requestedRawKeys.length).toBe(17);
  });

  it('SF-8 — Family C admin_validation request is unaffected', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_BASE_INPUT,
      requestedFamilies: ['misunderstanding_repair'],
    });
    // Family C has 20 rawKeys post MCP-BUILD2c (17 + 3); all must pass through
    // (no source filter for misunderstanding_repair — the 3 new keys are
    // ai_classifier).
    expect(req.requestedRawKeys.length).toBe(20);
  });

  it('SF-9 — production-mode Family D request returns 22 ai_classifier rawKeys (post MCP-021C-EDGE-FAMILY-D-ENABLE Card 2 flip + MCP-BUILD2d)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_BASE_INPUT,
      mode: 'production',
    });
    // Post Card 2: Family D is productionEnabled; the subset filter is
    // mode-agnostic, so production mode emits the same 22 ai_classifier
    // rawKeys as admin_validation mode. See
    // mcpFamilyDSubsetFilterProductionMode.test.ts SFP-1..SFP-7 for the
    // dedicated production-mode subset filter binding.
    expect(req.requestedRawKeys.length).toBe(22);
    expect(req.requestedFamilies).toEqual(['evidence_source_chain']);
    const sent = new Set(req.requestedRawKeys);
    for (const expected of FAMILY_D_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }
    for (const excluded of FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });

  it('SF-10 — multi-family request (D + A) sends Family A all-source + Family D ai_classifier only', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_BASE_INPUT,
      requestedFamilies: ['evidence_source_chain', 'parent_relation'],
    });
    // 22 Family D ai_classifier (post MCP-BUILD2d) + 19 Family A (post
    // MCP-BUILD2b) = 41 total (no overlap between families).
    expect(req.requestedRawKeys.length).toBe(41);
    const sent = new Set(req.requestedRawKeys);
    for (const key of FAMILY_D_AI_CLASSIFIER_KEYS) {
      expect(sent.has(key)).toBe(true);
    }
    for (const excluded of FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });
});
