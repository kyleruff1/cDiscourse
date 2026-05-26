/**
 * MCP-021A — Family type contracts.
 *
 * Verifies the MachineObservationFamily union and frozen array are
 * resolvable, complete (10 families), and stable. Each family is
 * a string literal so test enumeration is deterministic.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — Observations vs Allegations boundary
 *   - design doc §4 — MachineObservationFamily union
 */

import {
  ALL_MACHINE_OBSERVATION_FAMILIES,
  type MachineObservationFamily,
} from '../src/features/nodeLabels/nodeLabelTypes';

describe('MCP-021A — MachineObservationFamily contract', () => {
  it('exposes exactly 10 family codes', () => {
    expect(ALL_MACHINE_OBSERVATION_FAMILIES.length).toBe(10);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ALL_MACHINE_OBSERVATION_FAMILIES)).toBe(true);
  });

  const expectedFamilies: ReadonlyArray<MachineObservationFamily> = [
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
  ];

  for (const family of expectedFamilies) {
    it(`enumerates family "${family}"`, () => {
      expect(ALL_MACHINE_OBSERVATION_FAMILIES).toContain(family);
    });
  }

  it('has no duplicate family codes', () => {
    const set = new Set(ALL_MACHINE_OBSERVATION_FAMILIES);
    expect(set.size).toBe(ALL_MACHINE_OBSERVATION_FAMILIES.length);
  });

  it('uses only lower_snake_case family identifiers', () => {
    for (const family of ALL_MACHINE_OBSERVATION_FAMILIES) {
      expect(family).toMatch(/^[a-z][a-z_]*[a-z]$/);
    }
  });
});
