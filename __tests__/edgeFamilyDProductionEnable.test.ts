/**
 * MCP-021C-EDGE-FAMILY-D-ENABLE — Family D production-mode flip binding.
 *
 * This file is the dedicated card-scoped binding that locks in the
 * POST-flip state of `familyRegistry.ts`. It mirrors the FD-* pattern
 * from `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` but inverted:
 * every assertion here asserts that Family D is now production-enabled.
 *
 * If a future card accidentally reverts the Family D production flag,
 * this file fails the build with a Family-D-specific error message.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1, §10a — Machine Observations are
 *     structural; production enablement is gameplay-routing, never a
 *     verdict on the family's quality.
 *   - cdiscourse-doctrine §7 — Pure TS; no Deno-specific runtime call.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — Family D production-mode flip binding', () => {
  it('FDE-1 — Family D entry has productionEnabled: true (post Card 2 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FDE-2 — Family D entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FDE-3 — edgeProductionEnabledFamilies() includes evidence_source_chain', () => {
    expect(edgeProductionEnabledFamilies()).toContain('evidence_source_chain');
  });

  it('FDE-4 — edgeProductionEnabledFamilies() has length 7 (post MCP-021C-EDGE-FAMILY-G-ENABLE flip; D entry remains)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(7);
  });

  it('FDE-5 — edgeProductionEnabledFamilies() preserves registry A→G order (D remains at index 3)', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
    ]);
  });

  it('FDE-6 — edgeFilterFamiliesForMode([evidence_source_chain], production) keeps evidence_source_chain', () => {
    expect(edgeFilterFamiliesForMode(['evidence_source_chain'], 'production')).toEqual([
      'evidence_source_chain',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — H–J remain admin-only (no widening past G; E flipped in MCP-021C-EDGE-FAMILY-E-ENABLE; F flipped in MCP-021C-EDGE-FAMILY-F-ENABLE; G flipped in MCP-021C-EDGE-FAMILY-G-ENABLE)', () => {
  // Post Card 3 of FAMILY-G chain, G (resolution_progress) is
  // production-enabled; H–J remain admin-only. The describe block's
  // defensive guard narrows from "G–J admin-only" to "H–J admin-only"
  // while preserving the catch-accidental-widening property.
  const HJ_ADMIN_ONLY = [
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ] as const;

  for (const family of HJ_ADMIN_ONLY) {
    it(`FDE-7:${family} — productionEnabled is false (awaits its own card)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — Family D is the 4th entry; registry order preserved', () => {
  it('FDE-8 — Family D occupies index 3 in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    expect(EDGE_FAMILY_REGISTRY[3].family).toBe('evidence_source_chain');
    expect(EDGE_FAMILY_REGISTRY[3].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[3].adminValidationEnabled).toBe(true);
  });

  it('FDE-9 — Family A is still first (preserves Family A iteration #1 behavior)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — A/B/C production posture unchanged', () => {
  // HALT trigger #2: A/B/C productionEnabled flipped (already true; do not touch).
  // These assertions catch any accidental drift on A/B/C state during the
  // Family D flip.
  it('FDE-10 — Family A (parent_relation) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('parent_relation');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FDE-11 — Family B (disagreement_axis) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FDE-12 — Family C (misunderstanding_repair) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('misunderstanding_repair');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });
});
