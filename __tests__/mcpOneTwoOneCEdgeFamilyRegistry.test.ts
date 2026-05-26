/**
 * MCP-021C-EDGE — Test: family registry enablement matrix.
 *
 * Per design §3.2 + Decision 4: at MCP-021C-EDGE ship, ONLY
 * `parent_relation` is `productionEnabled: true`; all 10 families are
 * `adminValidationEnabled: true`.
 *
 * Future family enablement is a flip of the boolean — no Edge Function
 * code changes. This test is the binding gate that catches accidental
 * widening of the production posture.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeFilterFamiliesForMode,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
} from './_helpers/booleanObservationEdgeDeno';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../src/features/nodeLabels/nodeLabelTypes';
import type { MachineObservationFamily } from '../src/features/nodeLabels/nodeLabelTypes';

describe('MCP-021C-EDGE — FAMILY_REGISTRY shape', () => {
  it('FR-1 — contains exactly 10 entries', () => {
    expect(EDGE_FAMILY_REGISTRY).toHaveLength(10);
  });

  it('FR-2 — every entry has the {family, productionEnabled, adminValidationEnabled} shape', () => {
    for (const entry of EDGE_FAMILY_REGISTRY) {
      expect(typeof entry.family).toBe('string');
      expect(typeof entry.productionEnabled).toBe('boolean');
      expect(typeof entry.adminValidationEnabled).toBe('boolean');
    }
  });

  it('FR-3 — every entry references a known MachineObservationFamily', () => {
    for (const entry of EDGE_FAMILY_REGISTRY) {
      expect(ALL_MACHINE_OBSERVATION_FAMILIES).toContain(entry.family);
    }
  });

  it('FR-4 — entries are listed in MCP-021A Family A→J order', () => {
    const order = EDGE_FAMILY_REGISTRY.map((e) => e.family);
    expect(order).toEqual([
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
    ]);
  });
});

describe('MCP-021C-EDGE — production enablement is parent_relation ONLY', () => {
  it('FR-5 — only parent_relation has productionEnabled: true', () => {
    const productionFamilies = EDGE_FAMILY_REGISTRY.filter((e) => e.productionEnabled).map(
      (e) => e.family,
    );
    expect(productionFamilies).toEqual(['parent_relation']);
  });

  it('FR-6 — productionEnabledFamilies() returns exactly [parent_relation]', () => {
    expect(edgeProductionEnabledFamilies()).toEqual(['parent_relation']);
  });

  it('FR-7 — every NON-parent_relation family is productionEnabled: false', () => {
    for (const entry of EDGE_FAMILY_REGISTRY) {
      if (entry.family !== 'parent_relation') {
        expect(entry.productionEnabled).toBe(false);
      }
    }
  });
});

describe('MCP-021C-EDGE — admin validation enablement is ALL families', () => {
  it('FR-8 — all 10 families have adminValidationEnabled: true', () => {
    for (const entry of EDGE_FAMILY_REGISTRY) {
      expect(entry.adminValidationEnabled).toBe(true);
    }
  });

  it('FR-9 — adminValidationEnabledFamilies() returns all 10 families', () => {
    expect(edgeAdminValidationEnabledFamilies()).toEqual([
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
    ]);
  });
});

describe('MCP-021C-EDGE — lookupFamilyRegistryEntry', () => {
  it('FR-10 — returns the entry for parent_relation', () => {
    const entry = edgeLookupFamilyRegistryEntry('parent_relation');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('parent_relation');
    expect(entry!.productionEnabled).toBe(true);
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FR-11 — returns the entry for disagreement_axis (admin-only)', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('disagreement_axis');
    expect(entry!.productionEnabled).toBe(false);
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FR-12 — returns null for unknown family', () => {
    expect(edgeLookupFamilyRegistryEntry('unknown_family' as unknown as MachineObservationFamily)).toBeNull();
  });

  it('FR-13 — returns null for non-string input', () => {
    expect(edgeLookupFamilyRegistryEntry('' as unknown as MachineObservationFamily)).toBeNull();
  });
});

describe('MCP-021C-EDGE — filterFamiliesForMode (production)', () => {
  it('FR-14 — filter([parent_relation], production) keeps parent_relation', () => {
    expect(edgeFilterFamiliesForMode(['parent_relation'], 'production')).toEqual(['parent_relation']);
  });

  it('FR-15 — filter([parent_relation, disagreement_axis], production) drops disagreement_axis', () => {
    expect(
      edgeFilterFamiliesForMode(['parent_relation', 'disagreement_axis'], 'production'),
    ).toEqual(['parent_relation']);
  });

  it('FR-16 — filter(allFamilies, production) keeps only parent_relation', () => {
    expect(edgeFilterFamiliesForMode(ALL_MACHINE_OBSERVATION_FAMILIES, 'production')).toEqual([
      'parent_relation',
    ]);
  });
});

describe('MCP-021C-EDGE — filterFamiliesForMode (admin_validation)', () => {
  it('FR-17 — filter([parent_relation], admin_validation) keeps parent_relation', () => {
    expect(edgeFilterFamiliesForMode(['parent_relation'], 'admin_validation')).toEqual([
      'parent_relation',
    ]);
  });

  it('FR-18 — filter(allFamilies, admin_validation) keeps all 10', () => {
    expect(edgeFilterFamiliesForMode(ALL_MACHINE_OBSERVATION_FAMILIES, 'admin_validation')).toEqual(
      ALL_MACHINE_OBSERVATION_FAMILIES,
    );
  });

  it('FR-19 — filter([disagreement_axis], admin_validation) keeps disagreement_axis', () => {
    expect(edgeFilterFamiliesForMode(['disagreement_axis'], 'admin_validation')).toEqual([
      'disagreement_axis',
    ]);
  });

  it('FR-20 — filter([sensitive_composer], admin_validation) keeps sensitive_composer', () => {
    expect(edgeFilterFamiliesForMode(['sensitive_composer'], 'admin_validation')).toEqual([
      'sensitive_composer',
    ]);
  });
});

describe('MCP-021C-EDGE — filterFamiliesForMode returns frozen array', () => {
  it('FR-21 — filter result is Object.frozen', () => {
    const result = edgeFilterFamiliesForMode(['parent_relation'], 'production');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('FR-22 — input is not mutated', () => {
    const input: ReadonlyArray<MachineObservationFamily> = ['parent_relation', 'disagreement_axis'];
    const inputBefore = [...input];
    edgeFilterFamiliesForMode(input, 'production');
    expect([...input]).toEqual(inputBefore);
  });
});

describe('MCP-021C-EDGE — defensive: registry is immutable', () => {
  it('FR-23 — FAMILY_REGISTRY is Object.frozen', () => {
    expect(Object.isFrozen(EDGE_FAMILY_REGISTRY)).toBe(true);
  });
});
