/**
 * MCP-021C-EDGE — Test: Family A exact 19-key binding + post-Stage-2B
 * production-mode A+B+C admission.
 *
 * Per Decision 3 (BINDING): Family A in the registry is exactly the 19
 * raw keys listed below (16 MCP-SERVER-002 + 3 MCP-BUILD2b); this is the
 * FOCUSED binding gate — if a future card adds a Family A key without
 * updating this list, the test fires.
 *
 * Per Stage 2B (`MCP-021C-EDGE-FAMILIES-B-C-ENABLE`): production mode
 * now admits Family A (19 keys post MCP-BUILD2b) + Family B
 * (disagreement_axis, 17 keys post MCP-BUILD2a) + Family C
 * (misunderstanding_repair, 17 keys) across the 3 productionEnabled
 * families. Families D–J are still dropped from production-mode requests
 * at the request-builder layer.
 *
 * The binding Family A list (Decision 3 + MCP-BUILD2b manifest §1):
 *   supports_parent, challenges_parent, refines_parent, extends_parent,
 *   distinguishes_parent, reframes_parent, questions_parent,
 *   summarizes_parent, acknowledges_parent, corrects_parent_detail,
 *   contrasts_with_parent, answers_parent_question, has_rebuttal,
 *   has_counter_rebuttal, rebutted, quote_anchors_parent,
 *   acknowledges_parent_strength, compares_parent_to_sibling_branch,
 *   identifies_parent_scope_limit.
 */

import {
  edgeBuildBooleanObservationRequestForArgument,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
  edgeGetDefinitionsForFamily,
} from './_helpers/booleanObservationEdgeDeno';

const BINDING_FAMILY_A_KEYS = [
  'supports_parent',
  'challenges_parent',
  'refines_parent',
  'extends_parent',
  'distinguishes_parent',
  'reframes_parent',
  'questions_parent',
  'summarizes_parent',
  'acknowledges_parent',
  'corrects_parent_detail',
  'contrasts_with_parent',
  'answers_parent_question',
  'has_rebuttal',
  'has_counter_rebuttal',
  'rebutted',
  'quote_anchors_parent',
  // MCP-BUILD2b (Build-2 manifest §1) — parent-relation quality booleans.
  'acknowledges_parent_strength',
  'compares_parent_to_sibling_branch',
  'identifies_parent_scope_limit',
] as const;

describe('MCP-021C-EDGE — Family A registry binding (Decision 3)', () => {
  it('FA-1 — Family A in the registry contains exactly 19 definitions', () => {
    const familyA = edgeGetDefinitionsForFamily('parent_relation');
    expect(familyA).toHaveLength(19);
  });

  it('FA-2 — every binding key has a definition in the registry', () => {
    for (const key of BINDING_FAMILY_A_KEYS) {
      const def = EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[key];
      expect(def).toBeDefined();
      expect(def.family).toBe('parent_relation');
    }
  });

  it('FA-3 — registry has NO extra parent_relation keys outside the binding list', () => {
    const familyA = edgeGetDefinitionsForFamily('parent_relation');
    const actualKeys = familyA.map((d) => d.rawKey).sort();
    const expectedKeys = [...BINDING_FAMILY_A_KEYS].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });
});

describe('MCP-021C-EDGE — production mode sends exactly the 19 Family A keys', () => {
  const PRODUCTION_INPUT = {
    argumentId: 'arg-1',
    parentArgumentId: 'arg-0',
    currentText: 'reply',
    parentText: 'parent thesis',
    threadContextExcerpt: '',
    requestedFamilies: ['parent_relation' as const],
    mode: 'production' as const,
  };

  it('FA-4 — request has exactly 19 requestedRawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(PRODUCTION_INPUT);
    expect(req.requestedRawKeys).toHaveLength(19);
  });

  it('FA-5 — requestedRawKeys set equals the binding list', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(PRODUCTION_INPUT);
    expect([...req.requestedRawKeys].sort()).toEqual([...BINDING_FAMILY_A_KEYS].sort());
  });

  it('FA-6 — each binding key is present in requestedRawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(PRODUCTION_INPUT);
    for (const key of BINDING_FAMILY_A_KEYS) {
      expect(req.requestedRawKeys).toContain(key);
    }
  });

  it('FA-7 — request carries definitions for every requestedRawKey', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(PRODUCTION_INPUT);
    for (const key of req.requestedRawKeys) {
      expect(req.definitions[key]).toBeDefined();
      expect(req.definitions[key].rawKey).toBe(key);
    }
  });

  it('FA-8 — every definition carries family === parent_relation', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(PRODUCTION_INPUT);
    for (const def of Object.values(req.definitions)) {
      expect(def.family).toBe('parent_relation');
    }
  });

  it('FA-9 — schemaVersion is pinned to MCP-021A constant', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(PRODUCTION_INPUT);
    expect(req.schemaVersion).toBe(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
  });

  it('FA-10 — requestedFamilies is exactly [parent_relation]', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(PRODUCTION_INPUT);
    expect(req.requestedFamilies).toEqual(['parent_relation']);
  });

  it('FA-11 — parent context is included (parentNodeId + parentText)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(PRODUCTION_INPUT);
    expect(req.parentNodeId).toBe('arg-0');
    expect(req.parentText).toBe('parent thesis');
  });
});

describe('MCP-021C-EDGE — production filters out E–J keys (post Card 2: A+B+C+D kept)', () => {
  it('FA-12 — requestedRawKeys CONTAINS Family B keys when B is requested (post Stage 2B)', () => {
    // Post Stage 2B (MCP-021C-EDGE-FAMILIES-B-C-ENABLE): disagreement_axis (B)
    // is productionEnabled, so production mode keeps its keys.
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-1',
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation', 'disagreement_axis'],
      mode: 'production',
    });
    const familyB = edgeGetDefinitionsForFamily('disagreement_axis').map((d) => d.rawKey);
    expect(familyB.length).toBeGreaterThan(0);
    for (const key of familyB) {
      expect(req.requestedRawKeys).toContain(key);
    }
  });

  it('FA-13 — requestedRawKeys contains NO Family J (sensitive_composer) keys (J remains admin-only)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-1',
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation', 'sensitive_composer'],
      mode: 'production',
    });
    const familyJ = edgeGetDefinitionsForFamily('sensitive_composer').map((d) => d.rawKey);
    for (const key of familyJ) {
      expect(req.requestedRawKeys).not.toContain(key);
    }
  });

  it('FA-14 — every definition in the request has family in {parent_relation, disagreement_axis, evidence_source_chain} (post Card 2 flip)', () => {
    // Post Card 2 (MCP-021C-EDGE-FAMILY-D-ENABLE): A (parent_relation),
    // B (disagreement_axis), and D (evidence_source_chain) are all
    // productionEnabled and pass the production-mode filter. Family D's
    // emitted definitions are limited to the 19 ai_classifier rawKeys
    // by the MCP_SERVER_SUPPORTED_FAMILY_SOURCES subset filter.
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-1',
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['parent_relation', 'disagreement_axis', 'evidence_source_chain'],
      mode: 'production',
    });
    const ALLOWED_PRODUCTION_FAMILIES = new Set([
      'parent_relation',
      'disagreement_axis',
      'evidence_source_chain',
    ]);
    for (const def of Object.values(req.definitions)) {
      expect(ALLOWED_PRODUCTION_FAMILIES.has(def.family)).toBe(true);
    }
    // Family C (misunderstanding_repair) was not requested; it must not
    // appear. E-J remain admin-only and would be filtered out by mode.
    for (const def of Object.values(req.definitions)) {
      expect(def.family).not.toBe('misunderstanding_repair');
    }
  });
});

describe('MCP-021C-EDGE — Family A keys carry verbose definition fields (Decision 5 audit)', () => {
  it('FA-15 — every Family A definition has booleanQuestion (non-empty string)', () => {
    const familyA = edgeGetDefinitionsForFamily('parent_relation');
    for (const def of familyA) {
      expect(typeof def.booleanQuestion).toBe('string');
      expect(def.booleanQuestion.length).toBeGreaterThan(20);
    }
  });

  it('FA-16 — every Family A definition has positiveDefinition + negativeDefinition', () => {
    const familyA = edgeGetDefinitionsForFamily('parent_relation');
    for (const def of familyA) {
      expect(typeof def.positiveDefinition).toBe('string');
      expect(def.positiveDefinition.length).toBeGreaterThan(0);
      expect(typeof def.negativeDefinition).toBe('string');
      expect(def.negativeDefinition.length).toBeGreaterThan(0);
    }
  });

  it('FA-17 — every Family A definition has positiveExamples + negativeExamples (>= 1 each)', () => {
    const familyA = edgeGetDefinitionsForFamily('parent_relation');
    for (const def of familyA) {
      expect(def.positiveExamples.length).toBeGreaterThanOrEqual(1);
      expect(def.negativeExamples.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('FA-18 — every Family A definition has confidenceEligibility (3 fields)', () => {
    const familyA = edgeGetDefinitionsForFamily('parent_relation');
    for (const def of familyA) {
      expect(def.confidenceEligibility).toBeDefined();
      expect(def.confidenceEligibility.timelineMinConfidence).toMatch(/^(low|medium|high)$/);
      expect(def.confidenceEligibility.selectedContextMinConfidence).toMatch(
        /^(low|medium|high)$/,
      );
      expect(def.confidenceEligibility.inspectMinConfidence).toMatch(/^(low|medium|high)$/);
    }
  });
});
