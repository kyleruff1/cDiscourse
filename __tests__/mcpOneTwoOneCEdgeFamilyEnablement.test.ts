/**
 * MCP-021C-EDGE — Test: family enablement flag (post Stage 2B is A+B+C).
 *
 * Per Stage 2B operator decision in `MCP-021C-EDGE-FAMILIES-B-C-ENABLE`:
 * three families have `productionEnabled: true` — `parent_relation` (A),
 * `disagreement_axis` (B), and `misunderstanding_repair` (C). This
 * focused test catches any future widening of the production posture
 * that doesn't go through a documented family-enablement card.
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

describe('MCP-021C-EDGE — production enablement is binding (Stage 2B: A+B+C)', () => {
  it('FE-1 — exactly THREE entries have productionEnabled: true (post Stage 2B flip)', () => {
    const productionEntries = EDGE_FAMILY_REGISTRY.filter((e) => e.productionEnabled);
    expect(productionEntries).toHaveLength(3);
  });

  it('FE-2 — the production-enabled families are A+B+C (parent_relation, disagreement_axis, misunderstanding_repair)', () => {
    const productionEntries = EDGE_FAMILY_REGISTRY.filter((e) => e.productionEnabled).map(
      (e) => e.family,
    );
    expect(productionEntries).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
    ]);
  });

  it('FE-3 — productionEnabledFamilies() returns exactly ["parent_relation", "disagreement_axis", "misunderstanding_repair"]', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
    ]);
  });

  it('FE-4 — productionEnabledFamilies() has length 3 (post Stage 2B)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(3);
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

describe('MCP-021C-EDGE — every D–J family is production-disabled (B/C now production-enabled)', () => {
  // Post Stage 2B: B (disagreement_axis) and C (misunderstanding_repair)
  // are PRODUCTION-ENABLED. D–J remain admin-only.
  const NON_PRODUCTION_FAMILIES = [
    'evidence_source_chain',
    'argument_scheme',
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
