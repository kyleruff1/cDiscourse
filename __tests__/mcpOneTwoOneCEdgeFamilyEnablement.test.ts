/**
 * MCP-021C-EDGE — Test: family enablement flag is parent_relation ONLY.
 *
 * Per design §3.2 (BINDING per Decision 4): at MCP-021C-EDGE ship,
 * exactly ONE family has `productionEnabled: true` — `parent_relation`.
 * This focused test catches any future widening of the production
 * posture that doesn't go through a documented family-enablement card.
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

describe('MCP-021C-EDGE — production enablement is binding (Decision 4)', () => {
  it('FE-1 — exactly ONE entry has productionEnabled: true', () => {
    const productionEntries = EDGE_FAMILY_REGISTRY.filter((e) => e.productionEnabled);
    expect(productionEntries).toHaveLength(1);
  });

  it('FE-2 — the production-enabled family is parent_relation', () => {
    const productionEntries = EDGE_FAMILY_REGISTRY.filter((e) => e.productionEnabled);
    expect(productionEntries[0].family).toBe('parent_relation');
  });

  it('FE-3 — productionEnabledFamilies() returns exactly ["parent_relation"]', () => {
    expect(edgeProductionEnabledFamilies()).toEqual(['parent_relation']);
  });

  it('FE-4 — productionEnabledFamilies() has length 1', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(1);
  });
});

describe('MCP-021C-EDGE — admin validation enablement is all 10 (Decision 4)', () => {
  it('FE-5 — every entry has adminValidationEnabled: true', () => {
    for (const entry of EDGE_FAMILY_REGISTRY) {
      expect(entry.adminValidationEnabled).toBe(true);
    }
  });

  it('FE-6 — adminValidationEnabledFamilies() returns all 10 families', () => {
    expect(edgeAdminValidationEnabledFamilies()).toHaveLength(10);
  });
});

describe('MCP-021C-EDGE — every non-A family is production-disabled', () => {
  const NON_PRODUCTION_FAMILIES = [
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

  for (const family of NON_PRODUCTION_FAMILIES) {
    it(`FE-7:${family} — productionEnabled is false`, () => {
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
