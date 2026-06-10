/**
 * MCP-021C-EDGE-FAMILY-H-ENABLE — Family H production-mode flip binding.
 *
 * This file is the dedicated card-scoped binding that locks in the
 * POST-flip state of `familyRegistry.ts`. It mirrors the FFE-* pattern
 * from `edgeFamilyFProductionEnable.test.ts` (NOT the GGE-* pattern from
 * `edgeFamilyGProductionEnable.test.ts`) because Family H is
 * uniform-source like Family F, not mixed-source like Family G: every
 * assertion here asserts that Family H is now production-enabled and
 * that A/B/C/D/E/F/G remain production-enabled while I/J remain
 * admin-only.
 *
 * If a future card accidentally reverts the Family H production flag,
 * this file fails the build with a Family-H-specific error message.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1, §10a — Machine Observations are
 *     structural; production enablement is gameplay-routing, never a
 *     verdict on the family's quality. Family H's keys are STRUCTURAL
 *     clarity / specificity / hedging markers (a measurable property of
 *     the text), NEVER a quality judgment on the writer or the claim.
 *   - cdiscourse-doctrine §7 — Pure TS; no Deno-specific runtime call.
 *
 * DIV-1 (the principal divergence from G-ENABLE): Family H is a
 * UNIFORM-source family (12 ai_classifier keys; 0 auto_metadata; 0
 * lifecycle). Unlike mixed-source Family G (which carries a subset
 * entry filtering production-mode requests to the 18 ai_classifier
 * keys), Family H MUST NOT carry an entry in
 * `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` — absence = full passthrough.
 * HHE-17 + HHE-18 assert that ABSENCE and the 12-key full passthrough
 * result — the same posture as F (FFE-15/16, 14 keys), NOT G's
 * presence + 18-key result (GGE-16/17).
 *
 * HALT trigger 13 (subset filter entry added for H) is guarded by
 * HHE-17 + HHE-18 below. This card does NOT touch the subset filter
 * block at booleanObservationRequestBuilder.ts:68-78.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';

// The 12 ai_classifier keys the MCP server supports for Family H
// (operator-approved at Card 1; mirrored from mcp-server/lib/familyHKeys.ts:86-99).
// Family H is UNIFORM-source: every key is ai_classifier. No deterministic
// (auto_metadata or lifecycle) keys exist for this family, so unlike Family
// G there is no subset filter and no deterministic-exclusion check.
const FAMILY_H_AI_CLASSIFIER_KEYS = [
  'provides_temporal_constraint',
  'claim_present',
  'reason_present',
  'conclusion_missing',
  'reason_missing',
  'multiple_claims_present',
  'claim_specificity_high',
  'claim_specificity_low',
  'quantifier_present',
  'modal_language_present',
  'hedging_present',
  'unclear_reference_present',
] as const;

describe('MCP-021C-EDGE-FAMILY-H-ENABLE — Family H production-mode flip binding', () => {
  it('HHE-1 — Family H entry has productionEnabled: true (post Card 3 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('claim_clarity');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('HHE-2 — Family H entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('claim_clarity');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('HHE-3 — edgeProductionEnabledFamilies() includes claim_clarity', () => {
    expect(edgeProductionEnabledFamilies()).toContain('claim_clarity');
  });

  it('HHE-4 — edgeProductionEnabledFamilies() has length 9 (post MCP-021C-EDGE-FAMILY-I-ENABLE flip)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(9);
  });

  it('HHE-5 — edgeProductionEnabledFamilies() preserves registry A→I order', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
      'thread_topology',
    ]);
  });

  it('HHE-6 — edgeFilterFamiliesForMode([claim_clarity], production) keeps claim_clarity', () => {
    expect(edgeFilterFamiliesForMode(['claim_clarity'], 'production')).toEqual([
      'claim_clarity',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-H-ENABLE — J remains admin-only (no widening past I; I flipped in MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2)', () => {
  const J_ADMIN_ONLY = [
    'sensitive_composer',
  ] as const;

  for (const family of J_ADMIN_ONLY) {
    it(`HHE-7:${family} — productionEnabled is false (awaits its own card)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-H-ENABLE — Family H is the 8th entry; registry order preserved', () => {
  it('HHE-8 — Family H occupies index 7 in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    expect(EDGE_FAMILY_REGISTRY[7].family).toBe('claim_clarity');
    expect(EDGE_FAMILY_REGISTRY[7].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[7].adminValidationEnabled).toBe(true);
  });

  it('HHE-9 — Family A is still first (preserves Family A iteration #1 behavior)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-H-ENABLE — A/B/C/D/E/F/G production posture unchanged', () => {
  // HALT trigger 4: A/B/C/D/E/F/G productionEnabled flipped (already true; do not touch).
  // These assertions catch any accidental drift on the now-7 prior
  // production families during the Family H flip.
  it('HHE-10 — Family A (parent_relation) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('parent_relation');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('HHE-11 — Family B (disagreement_axis) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('HHE-12 — Family C (misunderstanding_repair) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('misunderstanding_repair');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('HHE-13 — Family D (evidence_source_chain) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('HHE-14 — Family E (argument_scheme) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('HHE-15 — Family F (critical_question) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('critical_question');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('HHE-16 — Family G (resolution_progress) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('resolution_progress');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-H-ENABLE — subset filter NOT applied to Family H (defensive guard for HALT trigger 13; DIV-1)', () => {
  it('HHE-17 — MCP_SERVER_SUPPORTED_FAMILY_SOURCES has NO entry for claim_clarity', () => {
    // DIV-1: Family H is UNIFORM-source ai_classifier (all 12 keys; zero
    // auto_metadata; zero lifecycle). Unlike mixed-source Family G (which
    // carries a subset entry filtering production-mode to the 18
    // ai_classifier keys), Family H MUST NOT carry an entry — absence =
    // full passthrough. The intent brief HALT trigger 13 binds this: any
    // edit that adds an H entry to the
    // `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block fails the card. The
    // map currently holds D + G only. This assertion mirrors FFE-15
    // (F is also uniform-source; same posture), NOT GGE-16 (G is
    // mixed-source; entry must be present).
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
    expect(constantBlock![0]).not.toContain('claim_clarity');
  });

  it('HHE-18 — production-mode Family H request contains all 12 ai_classifier rawKeys (no subset filter; mode-agnostic byte-equal to admin_validation)', () => {
    // Defensive: confirms the production-mode builder returns the full
    // 12-key Family H set, identical to admin_validation-mode. The
    // subset filter is absent for H → full passthrough. Mirrors FFE-16
    // (14 keys for F → 12 keys for H), NOT GGE-17 (which asserts G's
    // 18-key subset result and the 12-key deterministic-exclusion).
    const reqProd = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-h-prod-1',
      parentArgumentId: 'arg-h-prod-0',
      currentText: 'a reply with possible clarity / specificity / hedging content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['claim_clarity'],
      mode: 'production',
    });
    expect(reqProd.requestedRawKeys.length).toBe(12);

    // Every key sent is one of the 12 ai_classifier keys.
    const sent = new Set(reqProd.requestedRawKeys);
    for (const expected of FAMILY_H_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }

    // Mode-agnostic: byte-equal vs admin_validation-mode (no subset filter
    // applies in either mode for H).
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-h-prod-1',
      parentArgumentId: 'arg-h-prod-0',
      currentText: 'a reply with possible clarity / specificity / hedging content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['claim_clarity'],
      mode: 'admin_validation',
    });
    expect([...reqProd.requestedRawKeys].sort()).toEqual(
      [...reqAdmin.requestedRawKeys].sort(),
    );
  });
});
