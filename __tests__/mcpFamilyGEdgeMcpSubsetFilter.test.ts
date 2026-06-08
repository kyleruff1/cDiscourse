/**
 * MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET — Edge → MCP subset filter regression.
 *
 * Family G (`resolution_progress`) is a mixed-source family: 5 auto_metadata
 * + 7 lifecycle + 21 ai_classifier (33 total; 18 + 3 MCP-BUILD2g). Per the
 * MCP-SERVER-008-FAMILY-G Stage 2B operator decision, the MCP server supports
 * ONLY the ai_classifier
 * keys; the 12 deterministic keys are excluded.
 *
 * The Card 1 ship registered the 18-key subset on the MCP server but the Edge
 * request builder had no `resolution_progress` entry in
 * `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`. Absence = full registry passthrough,
 * so the Edge sent all 30 Family G keys; the MCP server rejected the 12
 * deterministic keys (`unsupported_rawKey`) → Edge mapped to
 * `mcp_validation_failed` for EVERY Family G admin_validation request (caught
 * by Card 1 Phase 4b live smoke).
 *
 * This fix adds `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['resolution_progress'] =
 * {'ai_classifier'}`, byte-mirroring the Family D entry. The filter is
 * mode-agnostic, so admin_validation and production request paths share it.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §10a — structural observations only
 *   - Stage 2B operator binding — 18-key ai_classifier subset only; no
 *     mcp-server change; no compound-key shape; no schema mirror change.
 */

import {
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';

const FAMILY_G_AI_CLASSIFIER_KEYS = [
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
  'followup_question_proposed',
  // MCP-BUILD2g (Build-2 manifest §6) — Subset 18 → 21.
  'records_remaining_disagreement',
  'defines_next_evidence_needed',
  'separates_normative_from_empirical',
] as const;

const FAMILY_G_DETERMINISTIC_EXCLUDED_KEYS = [
  // auto_metadata (5)
  'branch_suggested',
  'branch_created',
  'point_stalled',
  'point_exhausted',
  'synthesis_candidate',
  // lifecycle (7)
  'narrowed',
  'conceded',
  'confirmed',
  'synthesis_ready',
  'exhausted',
  'branch_recommended',
  'archived_or_resolved',
] as const;

const FAMILY_G_BASE_INPUT = {
  argumentId: 'arg-g-1',
  parentArgumentId: 'arg-g-0',
  currentText: 'a reply that narrows a claim or concedes a narrow point',
  parentText: 'a broad claim under discussion',
  threadContextExcerpt: 'thread context',
  requestedFamilies: ['resolution_progress' as const],
  mode: 'admin_validation' as const,
};

describe('MCP-SERVER-008A-FAMILY-G Edge → MCP subset filter (Stage 2B fix)', () => {
  it('SFG-1 — Family G admin_validation request contains exactly 21 ai_classifier rawKeys (post MCP-BUILD2g)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_G_BASE_INPUT);
    expect(req.requestedRawKeys.length).toBe(21);
  });

  it('SFG-2 — every Family G rawKey sent matches the operator-approved 21-key ai_classifier set', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_G_BASE_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const expected of FAMILY_G_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }
    expect(sent.size).toBe(21);
  });

  it('SFG-3 — Family G request does NOT include any of the 12 excluded deterministic rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_G_BASE_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const excluded of FAMILY_G_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });

  it('SFG-4 — Family G definitions map size matches the 21 rawKeys (no orphan keys)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_G_BASE_INPUT);
    expect(Object.keys(req.definitions).length).toBe(21);
    for (const key of Object.keys(req.definitions)) {
      expect(FAMILY_G_AI_CLASSIFIER_KEYS.includes(key as never)).toBe(true);
    }
  });

  it('SFG-5 — every Family G definition emitted has source=ai_classifier', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_G_BASE_INPUT);
    for (const def of Object.values(req.definitions)) {
      expect(def.source).toBe('ai_classifier');
    }
  });

  it('SFG-6 — production-mode Family G request also returns ai_classifier rawKeys only (subset filter is mode-agnostic; admin + production share the path)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_G_BASE_INPUT,
      mode: 'production',
    });
    // Family G production-mode behavior is unchanged by MCP-BUILD2g: production
    // mode may filter it out entirely (0 keys) OR return the 21 ai_classifier
    // keys. This asserts the subset filter does not
    // LEAK deterministic keys in either case — the requested keys are always
    // a subset of the 18 ai_classifier set, never the 12 deterministic.
    const sent = new Set(req.requestedRawKeys);
    for (const excluded of FAMILY_G_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
    for (const key of req.requestedRawKeys) {
      expect(FAMILY_G_AI_CLASSIFIER_KEYS.includes(key as never)).toBe(true);
    }
  });

  it('SFG-7 — Family D subset is the 22-key ai_classifier set (post MCP-BUILD2d; source filter still applies)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_G_BASE_INPUT,
      requestedFamilies: ['evidence_source_chain'],
    });
    // MCP-BUILD2d: Family D Subset 19 → 22 (the source filter still excludes the
    // 8 deterministic keys; the 3 new keys are ai_classifier). 22 > the 20-key
    // cap, so the chunker downstream splits it into 2 batches.
    expect(req.requestedRawKeys.length).toBe(22);
  });

  it('SFG-8 — E/F uniform ai_classifier families remain full passthrough (no filter entry needed; unaffected)', () => {
    const reqE = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_G_BASE_INPUT,
      requestedFamilies: ['argument_scheme'],
    });
    // MCP-BUILD2e: Family E 16 → 19 ai_classifier rawKeys (uniform passthrough,
    // no subset filter — the 3 new structure booleans are ai_classifier).
    expect(reqE.requestedRawKeys.length).toBe(19);
    const reqF = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_G_BASE_INPUT,
      requestedFamilies: ['critical_question'],
    });
    // MCP-BUILD2f: Family F 14 → 17 ai_classifier rawKeys (uniform passthrough,
    // no subset filter — the 3 new question-quality booleans are ai_classifier).
    expect(reqF.requestedRawKeys.length).toBe(17);
  });

  it('SFG-9 — multi-family request (G + A) sends Family A all-source + Family G ai_classifier only', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_G_BASE_INPUT,
      requestedFamilies: ['resolution_progress', 'parent_relation'],
    });
    // 21 Family G ai_classifier (post MCP-BUILD2g) + 19 Family A (post
    // MCP-BUILD2b) = 40 total (no overlap).
    expect(req.requestedRawKeys.length).toBe(40);
    const sent = new Set(req.requestedRawKeys);
    for (const key of FAMILY_G_AI_CLASSIFIER_KEYS) {
      expect(sent.has(key)).toBe(true);
    }
    for (const excluded of FAMILY_G_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });
});
