/**
 * MCP-021C-EDGE-FAMILY-G-ENABLE — Family G production-mode flip binding.
 *
 * This file is the dedicated card-scoped binding that locks in the
 * POST-flip state of `familyRegistry.ts`. It mirrors the FFE-* pattern
 * from `edgeFamilyFProductionEnable.test.ts` but for Family G
 * (`resolution_progress`): every assertion here asserts that Family G is
 * now production-enabled and that A/B/C/D/E/F remain production-enabled
 * while H–J remain admin-only.
 *
 * If a future card accidentally reverts the Family G production flag,
 * this file fails the build with a Family-G-specific error message.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1, §10a — Machine Observations are
 *     structural; production enablement is gameplay-routing, never a
 *     verdict on the family's quality. A concession
 *     (`concedes_broader_point` / `concedes_narrow_point`) is a scoring
 *     REPAIR, never a "loss".
 *   - cdiscourse-doctrine §7 — Pure TS; no Deno-specific runtime call.
 *
 * DIV-1 (the principal divergence from F-ENABLE): Family G is a
 * MIXED-source family (5 auto_metadata + 7 lifecycle + 18 ai_classifier
 * = 30 total). The Edge subset filter
 * `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['resolution_progress'] =
 * {'ai_classifier'}` is ALREADY PRESENT (added at Card 1A
 * `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET`) and is mode-agnostic. So the
 * subset-filter guards below assert the entry is PRESENT (GGE-16) and
 * that production-mode G returns exactly the 18 ai_classifier keys with
 * NO deterministic leak (GGE-17) — the INVERSE of F's FFE-15/16, which
 * asserted absence + a 14-key full passthrough.
 *
 * HALT trigger #7 (subset filter for G must STAY PRESENT) is guarded by
 * GGE-16 + GGE-17 below. This card does NOT touch the subset filter.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';

// The 18 ai_classifier keys the MCP server supports for Family G
// (operator-approved at Card 1; mirrored from the Card 1A SFG-* binding
// in mcpFamilyGEdgeMcpSubsetFilter.test.ts).
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
] as const;

// The 12 deterministic keys (5 auto_metadata + 7 lifecycle) that the MCP
// server does NOT support and that the subset filter MUST exclude from a
// Family G request in EITHER mode (no deterministic leak).
const FAMILY_G_DETERMINISTIC_EXCLUDED = [
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

describe('MCP-021C-EDGE-FAMILY-G-ENABLE — Family G production-mode flip binding', () => {
  it('GGE-1 — Family G entry has productionEnabled: true (post Card 3 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('resolution_progress');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('GGE-2 — Family G entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('resolution_progress');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('GGE-3 — edgeProductionEnabledFamilies() includes resolution_progress', () => {
    expect(edgeProductionEnabledFamilies()).toContain('resolution_progress');
  });

  it('GGE-4 — edgeProductionEnabledFamilies() has length 8 (post Card 3 of FAMILY-H chain flip)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(8);
  });

  it('GGE-5 — edgeProductionEnabledFamilies() preserves registry A→H order', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
    ]);
  });

  it('GGE-6 — edgeFilterFamiliesForMode([resolution_progress], production) keeps resolution_progress', () => {
    expect(edgeFilterFamiliesForMode(['resolution_progress'], 'production')).toEqual([
      'resolution_progress',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-G-ENABLE — I–J remain admin-only (no widening past H; H flipped in MCP-021C-EDGE-FAMILY-H-ENABLE)', () => {
  const IJ_ADMIN_ONLY = [
    'thread_topology',
    'sensitive_composer',
  ] as const;

  for (const family of IJ_ADMIN_ONLY) {
    it(`GGE-7:${family} — productionEnabled is false (awaits its own card)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-G-ENABLE — Family G is the 7th entry; registry order preserved', () => {
  it('GGE-8 — Family G occupies index 6 in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    expect(EDGE_FAMILY_REGISTRY[6].family).toBe('resolution_progress');
    expect(EDGE_FAMILY_REGISTRY[6].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[6].adminValidationEnabled).toBe(true);
  });

  it('GGE-9 — Family A is still first (preserves Family A iteration #1 behavior)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-G-ENABLE — A/B/C/D/E/F production posture unchanged', () => {
  // HALT trigger #2: A/B/C/D/E/F productionEnabled flipped (already true; do not touch).
  // These assertions catch any accidental drift on the now-6 prior
  // production families during the Family G flip.
  it('GGE-10 — Family A (parent_relation) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('parent_relation');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('GGE-11 — Family B (disagreement_axis) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('GGE-12 — Family C (misunderstanding_repair) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('misunderstanding_repair');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('GGE-13 — Family D (evidence_source_chain) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('GGE-14 — Family E (argument_scheme) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('GGE-15 — Family F (critical_question) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('critical_question');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-G-ENABLE — subset filter PRESENT for Family G (defensive guard for HALT trigger #7; DIV-1)', () => {
  it('GGE-16 — MCP_SERVER_SUPPORTED_FAMILY_SOURCES HAS an entry for resolution_progress', () => {
    // DIV-1: Family G is MIXED-source (5 auto_metadata + 7 lifecycle + 18
    // ai_classifier). Unlike uniform Family F (no entry → full
    // passthrough), Family G MUST carry a subset entry so production-mode
    // requests filter to the 18 ai_classifier keys and the 12
    // deterministic keys are never sent to the MCP server (sending them
    // triggers unsupported_rawKey → mcp_validation_failed). The entry was
    // added at Card 1A (MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET); this card
    // MUST NOT add, remove, or modify it. HALT trigger #7 binds: the
    // subset filter for G must STAY PRESENT (the INVERSE of F's FFE-15,
    // which asserts absence).
    const fs = require('fs');
    const path = require('path');
    const builderPath = path.join(
      process.cwd(),
      'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
    );
    const builderText = fs.readFileSync(builderPath, 'utf8');
    // Anchor to the `const` declaration and match the full Object.freeze
    // block regardless of its size.
    const constantBlock = builderText.match(
      /const MCP_SERVER_SUPPORTED_FAMILY_SOURCES[\s\S]*?\n\}\);/,
    );
    expect(constantBlock).not.toBeNull();
    expect(constantBlock![0]).toContain('resolution_progress');
  });

  it('GGE-17 — production-mode Family G request contains exactly 18 ai_classifier rawKeys, byte-equal to admin_validation-mode, with NO deterministic leak', () => {
    // DIV-1: the INVERSE of F's FFE-16. Family G's subset filter is
    // mode-agnostic, so the production-mode builder returns exactly the
    // 18 ai_classifier keys (never the 12 deterministic keys) and the
    // result is byte-equal to the admin_validation-mode request.
    const reqProd = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-g-prod-1',
      parentArgumentId: 'arg-g-prod-0',
      currentText: 'a reply that narrows a claim or concedes a narrow point',
      parentText: 'a broad claim under discussion',
      threadContextExcerpt: '',
      requestedFamilies: ['resolution_progress'],
      mode: 'production',
    });
    expect(reqProd.requestedRawKeys.length).toBe(18);

    // Every key sent is one of the 18 ai_classifier keys.
    const sent = new Set(reqProd.requestedRawKeys);
    for (const expected of FAMILY_G_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }
    // No deterministic leak: none of the 12 excluded keys appear.
    for (const excluded of FAMILY_G_DETERMINISTIC_EXCLUDED) {
      expect(sent.has(excluded)).toBe(false);
    }

    // Mode-agnostic: byte-equal vs admin_validation-mode.
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-g-prod-1',
      parentArgumentId: 'arg-g-prod-0',
      currentText: 'a reply that narrows a claim or concedes a narrow point',
      parentText: 'a broad claim under discussion',
      threadContextExcerpt: '',
      requestedFamilies: ['resolution_progress'],
      mode: 'admin_validation',
    });
    expect([...reqProd.requestedRawKeys].sort()).toEqual(
      [...reqAdmin.requestedRawKeys].sort(),
    );
  });
});
