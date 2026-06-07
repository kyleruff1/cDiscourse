/**
 * MCP-021C-EDGE — Test: request builder (family-agnostic plumbing).
 *
 * Tests `booleanObservationRequestBuilder.ts` — the family-agnostic
 * plumbing that combines the family registry's mode filter with the
 * MCP-021A definitions registry to produce one McpBooleanObservationRequest
 * per argument.
 *
 * Doctrine:
 *   - In production mode, only `parent_relation` keys are sent to the
 *     MCP server (Family A's 16 keys).
 *   - In admin_validation mode, all eligible family keys are sent.
 *   - The schema version is pinned to the MCP-021A constant.
 *   - The input hash is deterministic for the same input tuple.
 */

import {
  edgeBuildBooleanObservationRequestForArgument,
  edgeBuildBooleanObservationInputHash,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from './_helpers/booleanObservationEdgeDeno';

const BASE_INPUT_PRODUCTION = {
  argumentId: 'arg-1',
  parentArgumentId: 'arg-0',
  currentText: 'my reply text',
  parentText: 'the parent thesis text',
  threadContextExcerpt: 'ancestor context here',
  requestedFamilies: ['parent_relation' as const],
  mode: 'production' as const,
};

const BASE_INPUT_ADMIN = {
  ...BASE_INPUT_PRODUCTION,
  mode: 'admin_validation' as const,
};

describe('MCP-021C-EDGE — buildBooleanObservationRequestForArgument (production mode)', () => {
  it('RB-1 — schemaVersion is pinned to MCP-021A constant', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    expect(req.schemaVersion).toBe(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
  });

  it('RB-2 — nodeId is the argumentId', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    expect(req.nodeId).toBe('arg-1');
  });

  it('RB-3 — parentNodeId is the parentArgumentId', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    expect(req.parentNodeId).toBe('arg-0');
  });

  it('RB-4 — currentText / parentText / threadContextExcerpt are passed through', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    expect(req.currentText).toBe('my reply text');
    expect(req.parentText).toBe('the parent thesis text');
    expect(req.threadContextExcerpt).toBe('ancestor context here');
  });

  it('RB-5 — requestedFamilies in production contains only parent_relation', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    expect(req.requestedFamilies).toEqual(['parent_relation']);
  });

  it('RB-6 — requestedRawKeys contains exactly the 16 Family A keys (in production)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    expect(req.requestedRawKeys).toHaveLength(16);
  });

  it('RB-7 — requestedRawKeys includes the binding 16 Family A keys verbatim', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    const expectedKeys = [
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
    ];
    const sortedActual = [...req.requestedRawKeys].sort();
    const sortedExpected = [...expectedKeys].sort();
    expect(sortedActual).toEqual(sortedExpected);
  });

  it('RB-8 — definitions map carries one entry per requested rawKey', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    expect(Object.keys(req.definitions)).toHaveLength(req.requestedRawKeys.length);
  });

  it('RB-9 — each definition has family === parent_relation in production', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    for (const def of Object.values(req.definitions)) {
      expect(def.family).toBe('parent_relation');
    }
  });
});

describe('MCP-021C-EDGE — production mode filters out D–J families (post Stage 2B: A+B+C kept)', () => {
  it('RB-10 — disagreement_axis (B) requested in production → KEPT (17 keys post MCP-BUILD2a)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_PRODUCTION,
      requestedFamilies: ['disagreement_axis'],
    });
    expect(req.requestedFamilies).toEqual(['disagreement_axis']);
    // MCP-BUILD2a added 3 disagreement_axis booleans (14 → 17). All Family B
    // entries are ai_classifier, so no subset filter excludes the new keys.
    expect(req.requestedRawKeys.length).toBe(17);
  });

  it('RB-11 — mixed [parent_relation, disagreement_axis] in production → BOTH kept (16 + 17 = 33 keys)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_PRODUCTION,
      requestedFamilies: ['parent_relation', 'disagreement_axis'],
    });
    expect(req.requestedFamilies).toEqual(['parent_relation', 'disagreement_axis']);
    expect(req.requestedRawKeys.length).toBe(33); // 16 (Family A) + 17 (Family B post MCP-BUILD2a)
  });

  it('RB-12 — sensitive_composer in production → dropped (zero keys)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_PRODUCTION,
      requestedFamilies: ['sensitive_composer'],
    });
    expect(req.requestedFamilies).toEqual([]);
    expect(req.requestedRawKeys).toHaveLength(0);
  });
});

describe('MCP-021C-EDGE — admin_validation mode allows all 10 families', () => {
  it('RB-13 — admin_validation + parent_relation keeps parent_relation', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_ADMIN,
      requestedFamilies: ['parent_relation'],
    });
    expect(req.requestedFamilies).toEqual(['parent_relation']);
    expect(req.requestedRawKeys.length).toBe(16);
  });

  it('RB-14 — admin_validation + disagreement_axis keeps it (and yields >0 rawKeys)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_ADMIN,
      requestedFamilies: ['disagreement_axis'],
    });
    expect(req.requestedFamilies).toEqual(['disagreement_axis']);
    expect(req.requestedRawKeys.length).toBeGreaterThan(0);
    for (const def of Object.values(req.definitions)) {
      expect(def.family).toBe('disagreement_axis');
    }
  });

  it('RB-15 — admin_validation + sensitive_composer keeps it', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_ADMIN,
      requestedFamilies: ['sensitive_composer'],
    });
    expect(req.requestedFamilies).toEqual(['sensitive_composer']);
    expect(req.requestedRawKeys.length).toBeGreaterThan(0);
  });
});

describe('MCP-021C-EDGE — root arguments (null parent)', () => {
  it('RB-16 — root argument (parentArgumentId: null) is allowed', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_PRODUCTION,
      parentArgumentId: null,
      parentText: null,
    });
    expect(req.parentNodeId).toBeNull();
    expect(req.parentText).toBeNull();
  });
});

describe('MCP-021C-EDGE — threadContextExcerpt truncation', () => {
  it('RB-17 — threadContextExcerpt is truncated to 2000 chars', () => {
    const longExcerpt = 'x'.repeat(5000);
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_PRODUCTION,
      threadContextExcerpt: longExcerpt,
    });
    expect(req.threadContextExcerpt.length).toBeLessThanOrEqual(2000);
  });

  it('RB-18 — short threadContextExcerpt passes through unchanged', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_PRODUCTION,
      threadContextExcerpt: 'short context',
    });
    expect(req.threadContextExcerpt).toBe('short context');
  });
});

describe('MCP-021C-EDGE — buildBooleanObservationInputHash', () => {
  it('RB-19 — hash is deterministic for the same input', () => {
    const a = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-1',
      schemaVersion: 'v1',
      runMode: 'production',
      families: ['parent_relation'],
    });
    const b = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-1',
      schemaVersion: 'v1',
      runMode: 'production',
      families: ['parent_relation'],
    });
    expect(a).toBe(b);
  });

  it('RB-20 — hash differs when argumentId changes', () => {
    const a = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-1',
      schemaVersion: 'v1',
      runMode: 'production',
      families: ['parent_relation'],
    });
    const b = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-2',
      schemaVersion: 'v1',
      runMode: 'production',
      families: ['parent_relation'],
    });
    expect(a).not.toBe(b);
  });

  it('RB-21 — hash differs when runMode changes', () => {
    const a = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-1',
      schemaVersion: 'v1',
      runMode: 'production',
      families: ['parent_relation'],
    });
    const b = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-1',
      schemaVersion: 'v1',
      runMode: 'admin_validation',
      families: ['parent_relation'],
    });
    expect(a).not.toBe(b);
  });

  it('RB-22 — hash is stable across family ordering (alphabetical sort)', () => {
    const a = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-1',
      schemaVersion: 'v1',
      runMode: 'production',
      families: ['parent_relation', 'disagreement_axis'],
    });
    const b = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-1',
      schemaVersion: 'v1',
      runMode: 'production',
      families: ['disagreement_axis', 'parent_relation'],
    });
    expect(a).toBe(b);
  });

  it('RB-23 — hash has the mcp- prefix + 8 hex chars', () => {
    const a = edgeBuildBooleanObservationInputHash({
      argumentId: 'arg-1',
      schemaVersion: 'v1',
      runMode: 'production',
      families: ['parent_relation'],
    });
    expect(/^mcp-[0-9a-f]{8}$/.test(a)).toBe(true);
  });
});

describe('MCP-021C-EDGE — timeoutMs handling', () => {
  it('RB-24 — default timeoutMs is 12_000', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(BASE_INPUT_PRODUCTION);
    expect(req.timeoutMs).toBe(12_000);
  });

  it('RB-25 — explicit timeoutMs overrides default', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_PRODUCTION,
      timeoutMs: 30_000,
    });
    expect(req.timeoutMs).toBe(30_000);
  });

  it('RB-26 — zero / negative timeoutMs falls back to default', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...BASE_INPUT_PRODUCTION,
      timeoutMs: 0,
    });
    expect(req.timeoutMs).toBe(12_000);
  });
});
