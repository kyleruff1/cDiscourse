/**
 * MCP-021A — Test category 1: Registry count + family assignment.
 *
 * Per design §8.1. Verifies the parallel definitions registry:
 *  - has between 100 and 200 entries (per intent brief + Trigger 11).
 *  - has exactly 171 entries per design §3.11 final reconciliation.
 *  - every entry has a family field assigned.
 *  - every family value is one of 10 valid MachineObservationFamily codes.
 *  - per-family counts match the design forecast within ±1.
 */

import {
  ALL_MACHINE_OBSERVATION_DEFINITION_KEYS,
  ALL_MACHINE_OBSERVATION_DEFINITION_RAW_KEYS,
  MACHINE_OBSERVATION_DEFINITIONS_REGISTRY,
  _INTERNAL_ALL_DEFINITIONS,
  getDefinitionsForFamily,
} from '../src/features/nodeLabels/machineObservationDefinitions';
import {
  ALL_MACHINE_OBSERVATION_FAMILIES,
  type MachineObservationFamily,
} from '../src/features/nodeLabels/nodeLabelTypes';

describe('MCP-021A — registry size + family assignment', () => {
  it('contains at least 100 entries (intent brief floor)', () => {
    expect(ALL_MACHINE_OBSERVATION_DEFINITION_KEYS.length).toBeGreaterThanOrEqual(100);
  });

  it('contains at most 200 entries (Trigger 11 ceiling)', () => {
    expect(ALL_MACHINE_OBSERVATION_DEFINITION_KEYS.length).toBeLessThanOrEqual(200);
  });

  it('contains exactly 187 entries (MCP-021A 172 + MCP-BUILD2a Family B +3 + MCP-BUILD2b Family A +3 + MCP-BUILD2c Family C +3 + MCP-BUILD2e Family E +3 + MCP-BUILD2f Family F +3)', () => {
    // Design §3.11: "Final registry count: 64 + 107 = 171, OR 65 + 107 = 172.
    // Resolved by implementer Phase A pass; both numbers respect Trigger 11."
    // Implementer Phase A: existing 65 + 107 new = 172. Family G includes 21
    // retroactive entries (5 auto + 7 lifecycle + 9 ai_classifier).
    // MCP-BUILD2a (Build-2 addendum §5): +3 disagreement_axis booleans → 175.
    // MCP-BUILD2b (Build-2 manifest §1): +3 parent_relation booleans
    // (acknowledges_parent_strength, compares_parent_to_sibling_branch,
    // identifies_parent_scope_limit) → 178.
    // MCP-BUILD2c (Build-2 manifest §2): +3 misunderstanding_repair booleans
    // (offers_repair_path, names_ambiguity_source, accepts_correction) → 181.
    // MCP-BUILD2e (Build-2 manifest §4): +3 argument_scheme booleans
    // (linked_premise_structure, convergent_premise_structure,
    // enthymeme_gap_detected) → 184.
    // MCP-BUILD2f (Build-2 manifest §5): +3 critical_question booleans
    // (question_names_uncertainty, question_separates_claim_evidence,
    // question_invites_revision) → 187.
    // Vocabulary expansion only; the schema version constant is byte-equal
    // (no wire-shape change).
    expect(ALL_MACHINE_OBSERVATION_DEFINITION_KEYS.length).toBe(187);
  });

  it('has every entry with a family field assigned', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(typeof def.family).toBe('string');
      expect(def.family.length).toBeGreaterThan(0);
    }
  });

  it('uses only valid MachineObservationFamily codes', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(ALL_MACHINE_OBSERVATION_FAMILIES).toContain(def.family);
    }
  });

  it('every entry has kind machine_observation', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(def.kind).toBe('machine_observation');
    }
  });
});

describe('MCP-021A — per-family count forecast (within ±1 of design §3.11)', () => {
  const expectedCounts: Record<MachineObservationFamily, number> = {
    parent_relation: 19, // 4 existing + 12 MCP-021A + 3 MCP-BUILD2b
    disagreement_axis: 17, // 1 existing + 13 MCP-021A + 3 MCP-BUILD2a
    misunderstanding_repair: 20, // 4 existing + 13 MCP-021A + 3 MCP-BUILD2c
    evidence_source_chain: 27, // 15 existing + 12 new
    argument_scheme: 19, // 0 existing + 16 MCP-021A + 3 MCP-BUILD2e
    critical_question: 17, // 0 existing + 14 MCP-021A + 3 MCP-BUILD2f
    resolution_progress: 30, // 21 existing (5 auto + 7 lifecycle + 9 ai_classifier) + 9 new — see design §3.7 self-correction
    claim_clarity: 12, // 1 existing + 11 new
    thread_topology: 21, // 14 existing + 7 new
    sensitive_composer: 5, // 5 existing + 0 new (Trigger 10)
  };

  for (const family of ALL_MACHINE_OBSERVATION_FAMILIES) {
    it(`family "${family}" count is exactly ${expectedCounts[family]}`, () => {
      const defs = getDefinitionsForFamily(family);
      expect(defs.length).toBe(expectedCounts[family]);
    });
  }

  it('per-family counts sum to 187', () => {
    const total = ALL_MACHINE_OBSERVATION_FAMILIES.reduce(
      (sum, fam) => sum + expectedCounts[fam],
      0,
    );
    expect(total).toBe(187);
  });
});

describe('MCP-021A — Family J: 5 sensitive entries unchanged (Trigger 10)', () => {
  it('contains exactly 5 sensitive_composer entries', () => {
    const j = getDefinitionsForFamily('sensitive_composer');
    expect(j.length).toBe(5);
  });

  const expectedSensitiveRawKeys = [
    'shifts_to_person_or_intent',
    'contains_unplayable_insult_only',
    'needs_pre_send_pause',
    'uses_popularity_as_evidence',
    'uses_satire_as_evidence',
  ];

  for (const rawKey of expectedSensitiveRawKeys) {
    it(`Family J contains existing sensitive entry "${rawKey}"`, () => {
      const j = getDefinitionsForFamily('sensitive_composer');
      const found = j.find((d) => d.rawKey === rawKey);
      expect(found).toBeDefined();
    });
  }
});

describe('MCP-021A — Decision 7 Family I source assignment', () => {
  const autoMetadataNewKeys = [
    'splits_thread',
    'merges_thread',
    'references_sibling_node',
    'references_ancestor_node',
  ];

  for (const rawKey of autoMetadataNewKeys) {
    it(`Family I new key "${rawKey}" has source auto_metadata (Decision 7)`, () => {
      const i = getDefinitionsForFamily('thread_topology');
      const found = i.find((d) => d.rawKey === rawKey);
      expect(found).toBeDefined();
      expect(found?.source).toBe('auto_metadata');
    });
  }

  const aiClassifierNewKeys = [
    'returns_to_prior_issue',
    'references_external_context',
    'compares_options',
  ];

  for (const rawKey of aiClassifierNewKeys) {
    it(`Family I new key "${rawKey}" has source ai_classifier (Decision 7)`, () => {
      const i = getDefinitionsForFamily('thread_topology');
      const found = i.find((d) => d.rawKey === rawKey);
      expect(found).toBeDefined();
      expect(found?.source).toBe('ai_classifier');
    });
  }
});

describe('MCP-021A — registry consistency', () => {
  it('compound-key registry has same size as ALL_KEYS', () => {
    expect(Object.keys(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY).length).toBe(
      ALL_MACHINE_OBSERVATION_DEFINITION_KEYS.length,
    );
  });

  it('byRawKey registry has size <= compound key registry (handles duplicate rawKeys)', () => {
    expect(ALL_MACHINE_OBSERVATION_DEFINITION_RAW_KEYS.length).toBeLessThanOrEqual(
      ALL_MACHINE_OBSERVATION_DEFINITION_KEYS.length,
    );
  });

  it('every definition is frozen', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(Object.isFrozen(def)).toBe(true);
    }
  });
});
