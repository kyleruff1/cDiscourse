/**
 * MCP-021C-EDGE-FAMILY-D-ENABLE — Family D production-mode subset filter binding.
 *
 * This file is the CRITICAL test of HALT trigger #14 (Family D production
 * runs send all 27 keys). It mirrors `mcpFamilyDEdgeMcpSubsetFilter.test.ts`
 * SF-1..SF-5 (admin_validation-mode) and SF-10 (multi-family) but with
 * `mode: 'production'` — proving the subset filter holds under production
 * mode now that Family D is productionEnabled.
 *
 * The Edge subset filter at `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain']
 * = {'ai_classifier'}` lives in `booleanObservationRequestBuilder.ts` and
 * is **mode-agnostic** — it applies the source allowlist AFTER the
 * `filterFamiliesForMode` gate but WITHOUT any reference to `input.mode`.
 * Therefore any Family D request — production or admin_validation — sends
 * only the 19 ai_classifier keys, never the 8 deterministic keys.
 *
 * Pre-flip, mode='production' + requestedFamilies=['evidence_source_chain']
 * → eligibleFamilies=[] → empty rawKeys (the SF-9 admin-only assertion).
 * Post-flip, the same input → eligibleFamilies=['evidence_source_chain']
 * → 19 ai_classifier rawKeys. This file makes that post-flip behavior
 * a binding gate.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — structural observations only; the subset
 *     filter is a routing decision, never a verdict.
 *   - cdiscourse-doctrine §7 — pure TS; no Deno-specific calls.
 *   - Stage 2B operator binding (preserved): Subset path only; no compound
 *     key response; no Anthropic inference of deterministic facts.
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

const FAMILY_D_PRODUCTION_INPUT = {
  argumentId: 'arg-d-prod-1',
  parentArgumentId: 'arg-d-prod-0',
  currentText: 'a reply that may or may not provide evidence',
  parentText: 'a claim being evaluated for evidence chain',
  threadContextExcerpt: 'thread context',
  requestedFamilies: ['evidence_source_chain' as const],
  mode: 'production' as const,
};

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — production-mode subset filter (HALT trigger #14)', () => {
  it('SFP-1 — production-mode Family D request contains exactly 19 ai_classifier rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    expect(req.requestedRawKeys.length).toBe(19);
  });

  it('SFP-2 — every production-mode Family D rawKey matches the 19-key ai_classifier set', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const expected of FAMILY_D_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }
    expect(sent.size).toBe(19);
  });

  it('SFP-3 — production-mode Family D request does NOT include any of the 6 excluded deterministic rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const excluded of FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });

  it('SFP-4 — production-mode Family D definitions map has exactly 19 entries (no orphan keys)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    expect(Object.keys(req.definitions).length).toBe(19);
    for (const key of Object.keys(req.definitions)) {
      expect(FAMILY_D_AI_CLASSIFIER_KEYS.includes(key as never)).toBe(true);
    }
  });

  it('SFP-5 — every production-mode Family D definition emitted has source=ai_classifier', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    for (const def of Object.values(req.definitions)) {
      expect(def.source).toBe('ai_classifier');
    }
  });

  it('SFP-6 — production-mode + admin_validation-mode emit BYTE-EQUAL rawKey sets for Family D', () => {
    // Doctrine: the subset filter is mode-agnostic. Production and
    // admin_validation modes both go through the same
    // MCP_SERVER_SUPPORTED_FAMILY_SOURCES gate; therefore the rawKey set
    // is identical.
    const reqProd = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_PRODUCTION_INPUT,
      mode: 'admin_validation',
    });
    const prodKeys = [...reqProd.requestedRawKeys].sort();
    const adminKeys = [...reqAdmin.requestedRawKeys].sort();
    expect(prodKeys).toEqual(adminKeys);
  });

  it('SFP-7 — production-mode multi-family request (D + A) sends 19 D ai_classifier + 16 A full = 35 (composes correctly)', () => {
    // Mirror of SF-10 (admin_validation) with mode='production'. Verifies
    // the subset filter composes correctly under production-mode for
    // mixed-family requests: Family D contributes 19 ai_classifier keys
    // (filtered); Family A contributes its full 16-key set (no filter).
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_PRODUCTION_INPUT,
      requestedFamilies: ['evidence_source_chain', 'parent_relation'],
    });
    expect(req.requestedRawKeys.length).toBe(35);
    const sent = new Set(req.requestedRawKeys);
    for (const key of FAMILY_D_AI_CLASSIFIER_KEYS) {
      expect(sent.has(key)).toBe(true);
    }
    for (const excluded of FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });
});
