/**
 * MCP-021C-EDGE — Test: family registry enablement matrix.
 *
 * Post `MCP-021C-EDGE-FAMILY-H-ENABLE` (Card 3 of the FAMILY-H chain):
 * `parent_relation` (A), `disagreement_axis` (B), `misunderstanding_repair`
 * (C), `evidence_source_chain` (D), `argument_scheme` (E),
 * `critical_question` (F), `resolution_progress` (G), and `claim_clarity`
 * (H) are `productionEnabled: true`; I–J remain `productionEnabled: false`.
 * All 10 families are `adminValidationEnabled: true`.
 *
 * Future family enablement is a flip of the boolean — no Edge Function
 * code changes (the auto-trigger dispatcher derives from this registry
 * via `productionEnabledFamilies()`). This test is the binding gate
 * that catches accidental widening of the production posture.
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

describe('MCP-021C-EDGE — production enablement is A+B+C+D+E+F+G+H (post MCP-021C-EDGE-FAMILY-H-ENABLE flip)', () => {
  it('FR-5 — only parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, resolution_progress, and claim_clarity have productionEnabled: true', () => {
    const productionFamilies = EDGE_FAMILY_REGISTRY.filter((e) => e.productionEnabled).map(
      (e) => e.family,
    );
    expect(productionFamilies).toEqual([
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

  it('FR-6 — productionEnabledFamilies() returns exactly [parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, resolution_progress, claim_clarity]', () => {
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

  it('FR-7 — every I–J family is productionEnabled: false', () => {
    const PRODUCTION_ENABLED_FAMILIES = new Set([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
    ]);
    for (const entry of EDGE_FAMILY_REGISTRY) {
      if (!PRODUCTION_ENABLED_FAMILIES.has(entry.family)) {
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

  it('FR-11 — returns the entry for disagreement_axis (production + admin enabled post Stage 2B)', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('disagreement_axis');
    expect(entry!.productionEnabled).toBe(true);
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

  it('FR-15 — filter([parent_relation, disagreement_axis], production) keeps BOTH post Stage 2B', () => {
    expect(
      edgeFilterFamiliesForMode(['parent_relation', 'disagreement_axis'], 'production'),
    ).toEqual(['parent_relation', 'disagreement_axis']);
  });

  it('FR-16 — filter(allFamilies, production) keeps exactly A+B+C+D+E+F+G+H', () => {
    expect(edgeFilterFamiliesForMode(ALL_MACHINE_OBSERVATION_FAMILIES, 'production')).toEqual([
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

describe('MCP-021C-EDGE-FAMILY-H-ENABLE — eight-family production posture', () => {
  it('FR-24 — filter([disagreement_axis], production) keeps disagreement_axis', () => {
    expect(edgeFilterFamiliesForMode(['disagreement_axis'], 'production')).toEqual([
      'disagreement_axis',
    ]);
  });

  it('FR-25 — filter([misunderstanding_repair], production) keeps misunderstanding_repair', () => {
    expect(edgeFilterFamiliesForMode(['misunderstanding_repair'], 'production')).toEqual([
      'misunderstanding_repair',
    ]);
  });

  it('FR-26 — filter([evidence_source_chain], production) keeps evidence_source_chain', () => {
    expect(edgeFilterFamiliesForMode(['evidence_source_chain'], 'production')).toEqual([
      'evidence_source_chain',
    ]);
  });

  it('FR-26b — filter([argument_scheme], production) keeps argument_scheme (post Card 2 flip)', () => {
    expect(edgeFilterFamiliesForMode(['argument_scheme'], 'production')).toEqual([
      'argument_scheme',
    ]);
  });

  it('FR-26c — filter([critical_question], production) keeps critical_question (post Card 3 flip)', () => {
    expect(edgeFilterFamiliesForMode(['critical_question'], 'production')).toEqual([
      'critical_question',
    ]);
  });

  it('FR-26d — filter([resolution_progress], production) keeps resolution_progress (post Card 3 of FAMILY-G chain)', () => {
    expect(edgeFilterFamiliesForMode(['resolution_progress'], 'production')).toEqual([
      'resolution_progress',
    ]);
  });

  it('FR-26e — filter([claim_clarity], production) keeps claim_clarity (post Card 3 of FAMILY-H chain)', () => {
    expect(edgeFilterFamiliesForMode(['claim_clarity'], 'production')).toEqual([
      'claim_clarity',
    ]);
  });

  it('FR-27 — lookupFamilyRegistryEntry(misunderstanding_repair) shows productionEnabled true post Stage 2B', () => {
    const entry = edgeLookupFamilyRegistryEntry('misunderstanding_repair');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('misunderstanding_repair');
    expect(entry!.productionEnabled).toBe(true);
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FR-28 — every I–J family in productionEnabledFamilies() output is absent', () => {
    const productionList = edgeProductionEnabledFamilies();
    const IJ_FAMILIES: ReadonlyArray<MachineObservationFamily> = [
      'thread_topology',
      'sensitive_composer',
    ];
    for (const family of IJ_FAMILIES) {
      expect(productionList).not.toContain(family);
    }
  });

  it('FR-29 — registry iteration order is unchanged (A→J) post-flip', () => {
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

  it('FR-30 — productionEnabledFamilies() preserves A→H iteration order (Family A first)', () => {
    // Stage 2B operator-named invariant: Family A must remain first in
    // productionEnabledFamilies() output so the auto-trigger
    // dispatcher preserves Family A's byte-equal iteration #1 behavior
    // (under bounded-parallel runWithBoundedConcurrency the runner
    // returns results in INPUT order, so registry order is preserved
    // even though families may start concurrently). Post Card 3 of
    // FAMILY-H chain, Family H follows G as iteration #8.
    const productionList = edgeProductionEnabledFamilies();
    expect(productionList[0]).toBe('parent_relation');
    expect(productionList[1]).toBe('disagreement_axis');
    expect(productionList[2]).toBe('misunderstanding_repair');
    expect(productionList[3]).toBe('evidence_source_chain');
    expect(productionList[4]).toBe('argument_scheme');
    expect(productionList[5]).toBe('critical_question');
    expect(productionList[6]).toBe('resolution_progress');
    expect(productionList[7]).toBe('claim_clarity');
  });

  it('FR-31 — productionEnabledFamilies() returns a frozen array (no mutation)', () => {
    const list = edgeProductionEnabledFamilies();
    expect(Object.isFrozen(list)).toBe(true);
  });

  it('FR-32 — no family literal beyond A/B/C/D/E/F/G/H is productionEnabled post Card 3 of FAMILY-H chain flip', () => {
    // Doctrine guard: I-J are explicitly admin_validation-only. This
    // test catches accidental widening (a future card flipping an
    // unintended boolean).
    const PRODUCTION_ENABLED_NAMES = new Set([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
    ]);
    const offenders = EDGE_FAMILY_REGISTRY.filter(
      (e) => e.productionEnabled && !PRODUCTION_ENABLED_NAMES.has(e.family),
    );
    expect(offenders).toEqual([]);
  });
});
