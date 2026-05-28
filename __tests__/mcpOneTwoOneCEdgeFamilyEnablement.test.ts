/**
 * MCP-021C-EDGE — Test: family enablement flag (post MCP-021C-EDGE-FAMILY-E-ENABLE is A+B+C+D+E).
 *
 * Post `MCP-021C-EDGE-FAMILY-E-ENABLE` (Card 2 of the FAMILY-E chain):
 * five families have `productionEnabled: true` — `parent_relation` (A),
 * `disagreement_axis` (B), `misunderstanding_repair` (C),
 * `evidence_source_chain` (D), and `argument_scheme` (E). This focused
 * test catches any future widening of the production posture that
 * doesn't go through a documented family-enablement card.
 *
 * Future family enablement requires:
 *   1. Operator-driven admin validation cycle for the candidate family.
 *   2. Per-family enablement card flipping `productionEnabled: false →
 *      true` in `familyRegistry.ts`.
 *   3. Test re-baseline: this file's binding expectations widen with
 *      the new family.
 *
 * Doctrine: production enablement is a deliberate, audited, per-family
 * decision — never a side effect.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-021C-EDGE — production enablement is binding (post Card 2 flip: A+B+C+D+E)', () => {
  it('FE-1 — exactly FIVE entries have productionEnabled: true (post Card 2 flip)', () => {
    const productionEntries = EDGE_FAMILY_REGISTRY.filter((e) => e.productionEnabled);
    expect(productionEntries).toHaveLength(5);
  });

  it('FE-2 — the production-enabled families are A+B+C+D+E (parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme)', () => {
    const productionEntries = EDGE_FAMILY_REGISTRY.filter((e) => e.productionEnabled).map(
      (e) => e.family,
    );
    expect(productionEntries).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
    ]);
  });

  it('FE-3 — productionEnabledFamilies() returns exactly ["parent_relation", "disagreement_axis", "misunderstanding_repair", "evidence_source_chain", "argument_scheme"]', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
    ]);
  });

  it('FE-4 — productionEnabledFamilies() has length 5 (post Card 2 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(5);
  });
});

describe('MCP-021C-EDGE — admin validation enablement is all 10 (unchanged)', () => {
  it('FE-5 — every entry has adminValidationEnabled: true', () => {
    for (const entry of EDGE_FAMILY_REGISTRY) {
      expect(entry.adminValidationEnabled).toBe(true);
    }
  });

  it('FE-6 — adminValidationEnabledFamilies() returns all 10 families', () => {
    expect(edgeAdminValidationEnabledFamilies()).toHaveLength(10);
  });
});

describe('MCP-021C-EDGE — every F–J family is production-disabled (E now production-enabled)', () => {
  // Post Card 2 (MCP-021C-EDGE-FAMILY-E-ENABLE): E (argument_scheme) is
  // PRODUCTION-ENABLED. F–J remain admin-only.
  const NON_PRODUCTION_FAMILIES = [
    'critical_question',
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ] as const;

  for (const family of NON_PRODUCTION_FAMILIES) {
    it(`FE-7:${family} — productionEnabled is false (admin-only, awaits its own card)`, () => {
      const entry = EDGE_FAMILY_REGISTRY.find((e) => e.family === family);
      expect(entry).toBeDefined();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE — every family is admin-validation-enabled', () => {
  const ALL_FAMILIES = [
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
  ] as const;

  for (const family of ALL_FAMILIES) {
    it(`FE-8:${family} — adminValidationEnabled is true`, () => {
      const entry = EDGE_FAMILY_REGISTRY.find((e) => e.family === family);
      expect(entry).toBeDefined();
      expect(entry!.adminValidationEnabled).toBe(true);
    });
  }
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — B/C explicit production flip assertions (Stage 2B)', () => {
  // These tests are added by MCP-021C-EDGE-FAMILIES-B-C-ENABLE to make
  // the B/C flip visible in this binding-gate file.

  it('FE-9 — disagreement_axis (B) is productionEnabled: true (Stage 2B flip)', () => {
    const entry = EDGE_FAMILY_REGISTRY.find((e) => e.family === 'disagreement_axis');
    expect(entry).toBeDefined();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FE-10 — misunderstanding_repair (C) is productionEnabled: true (Stage 2B flip)', () => {
    const entry = EDGE_FAMILY_REGISTRY.find((e) => e.family === 'misunderstanding_repair');
    expect(entry).toBeDefined();
    expect(entry!.productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — D explicit production flip assertion (Card 2)', () => {
  // This test is added by MCP-021C-EDGE-FAMILY-D-ENABLE to make the D
  // flip visible in this binding-gate file. If a future card accidentally
  // reverts the Family D production flag, this assertion fails with a
  // Family-D-specific message.

  it('FE-11 — evidence_source_chain (D) is productionEnabled: true (Card 2 flip)', () => {
    const entry = EDGE_FAMILY_REGISTRY.find((e) => e.family === 'evidence_source_chain');
    expect(entry).toBeDefined();
    expect(entry!.productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — E explicit production flip assertion (Card 2)', () => {
  // This test is added by MCP-021C-EDGE-FAMILY-E-ENABLE to make the E
  // flip visible in this binding-gate file. If a future card accidentally
  // reverts the Family E production flag, this assertion fails with a
  // Family-E-specific message.

  it('FE-12 — argument_scheme (E) is productionEnabled: true (Card 2 flip)', () => {
    const entry = EDGE_FAMILY_REGISTRY.find((e) => e.family === 'argument_scheme');
    expect(entry).toBeDefined();
    expect(entry!.productionEnabled).toBe(true);
  });
});
