/**
 * MCP-BOOLEAN-BATCHING-INFRA-001 — Backward-compat + per-batch validation +
 * no-schema-bump regression.
 *
 * These tests bind the batching core against the REAL Edge request builder
 * (`buildBooleanObservationRequestForArgument`) and the REAL Edge response
 * parser (`parseMcpBooleanObservationResponse` with its UNCHANGED
 * MAX_FLAGS_PER_RESPONSE = 20 cap) to prove:
 *
 *   - Every family that fits the 20-key cap (A=19, B=17, C=20, E=19, F=17 in
 *     production; admin_validation may differ) chunks to EXACTLY ONE batch
 *     whose per-batch request is byte-identical to the full request (the
 *     pre-batching builder output). This regression-locks A/B/C/E/F unchanged.
 *   - Each batch response (<= 20 keys) passes the UNCHANGED parser; a 21-entry
 *     single response still rejects with `flag_count_too_high` (cap intact).
 *   - The schema version constant is byte-equal (no schema bump).
 */

import {
  edgeBuildBooleanObservationRequestForArgument,
  edgeChunkRawKeys,
  edgeBuildBatchRequestFromFull,
  edgeParseMcpBooleanObservationResponse,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from './_helpers/booleanObservationEdgeDeno';
import type { McpBooleanObservationResponse } from '../src/features/nodeLabels/mcpBooleanObservationSchema';

const BASE = {
  argumentId: 'arg-1',
  parentArgumentId: 'arg-0',
  currentText: 'reply text',
  parentText: 'parent thesis',
  threadContextExcerpt: 'context',
};

// ── Backward-compat: every <=20 family -> 1 byte-identical batch ────

describe('MCP-BATCHING — backward-compat: <=20 families chunk to 1 byte-identical batch', () => {
  // Production families that are all <= 20 keys post Build-2 (A=19, B=17, C=20,
  // E=19, F=17). The header docstring claims A/B/C/E/F; this list now iterates
  // ALL FIVE so the byte-identity regression covers every shipped production
  // family (E + F added in the reconcile/545 bar-raising pass).
  const PRODUCTION_FAMILIES: ReadonlyArray<{ family: string; expectedLen: number }> = [
    { family: 'parent_relation', expectedLen: 19 }, // A
    { family: 'disagreement_axis', expectedLen: 17 }, // B
    { family: 'misunderstanding_repair', expectedLen: 20 }, // C
    { family: 'argument_scheme', expectedLen: 19 }, // E
    { family: 'critical_question', expectedLen: 17 }, // F
  ];

  for (const { family, expectedLen } of PRODUCTION_FAMILIES) {
    it(`BWC-${family} — full request has ${expectedLen} keys and chunks to exactly 1 batch`, () => {
      const full = edgeBuildBooleanObservationRequestForArgument({
        ...BASE,
        requestedFamilies: [family as never],
        mode: 'production',
      });
      expect(full.requestedRawKeys.length).toBe(expectedLen);
      const batches = edgeChunkRawKeys(full.requestedRawKeys);
      expect(batches).toHaveLength(1);
      expect(batches[0].batchTotal).toBe(1);
    });

    it(`BWC-${family}-identity — the 1-batch request is byte-identical to the full request`, () => {
      const full = edgeBuildBooleanObservationRequestForArgument({
        ...BASE,
        requestedFamilies: [family as never],
        mode: 'production',
      });
      const [oneBatch] = edgeChunkRawKeys(full.requestedRawKeys);
      const batchReq = edgeBuildBatchRequestFromFull(full, oneBatch);
      // requestedRawKeys identical (same membership; 1 batch holds all keys).
      expect([...batchReq.requestedRawKeys].sort()).toEqual([...full.requestedRawKeys].sort());
      // definitions identical (narrowed to all keys == unchanged).
      expect(Object.keys(batchReq.definitions).sort()).toEqual(
        Object.keys(full.definitions).sort(),
      );
      // All carried fields identical.
      expect(batchReq.nodeId).toBe(full.nodeId);
      expect(batchReq.parentNodeId).toBe(full.parentNodeId);
      expect(batchReq.currentText).toBe(full.currentText);
      expect(batchReq.parentText).toBe(full.parentText);
      expect(batchReq.threadContextExcerpt).toBe(full.threadContextExcerpt);
      expect(batchReq.requestedFamilies).toEqual(full.requestedFamilies);
      expect(batchReq.schemaVersion).toBe(full.schemaVersion);
      expect(batchReq.timeoutMs).toBe(full.timeoutMs);
    });
  }

  it('BWC-snapshot — full request serialized JSON is byte-equal to the 1-batch request JSON (sorted keys)', () => {
    const full = edgeBuildBooleanObservationRequestForArgument({
      ...BASE,
      requestedFamilies: ['parent_relation' as never],
      mode: 'production',
    });
    const [oneBatch] = edgeChunkRawKeys(full.requestedRawKeys);
    const batchReq = edgeBuildBatchRequestFromFull(full, oneBatch);
    const stable = (o: unknown) =>
      JSON.stringify(o, Object.keys(JSON.parse(JSON.stringify(o))).sort());
    // requestedRawKeys order is registry-iteration order in the full request and
    // input-order-preserved in the 1-batch path (no sort below threshold), so
    // they are the same array -> the serialized request bodies match.
    expect(stable(batchReq)).toBe(stable(full));
  });
});

// ── Family-I (#550) thread_topology 6-key subset -> 1 batch, no wire meta ──

describe('MCP-BATCHING — Family-I (#550) thread_topology 6-key subset chunks to 1 batch', () => {
  // The Family-I (thread_topology) ai_classifier subset is 6 keys — well under
  // the BATCH_SPLIT_THRESHOLD (20) — so it MUST produce EXACTLY ONE batch with
  // input order preserved (no lexicographic sort below threshold), and the
  // on-the-wire request MUST carry NO batchIndex/batchTotal (those are
  // out-of-band orchestration only; the no-schema-bump invariant).
  const FAMILY_I_SUBSET_6 = [
    'thread_topology_k1',
    'thread_topology_k2',
    'thread_topology_k3',
    'thread_topology_k4',
    'thread_topology_k5',
    'thread_topology_k6',
  ] as const;

  it('FAMILY-I-6 — chunkRawKeys(6 keys) -> exactly 1 batch, batchTotal 1, input order preserved', () => {
    const batches = edgeChunkRawKeys([...FAMILY_I_SUBSET_6]);
    expect(batches).toHaveLength(1);
    expect(batches[0].batchIndex).toBe(0);
    expect(batches[0].batchTotal).toBe(1);
    // <= threshold: input order preserved verbatim (no lexicographic sort).
    expect([...batches[0].rawKeys]).toEqual([...FAMILY_I_SUBSET_6]);
  });

  it('FAMILY-I-6 — the 1-batch request carries NO batchIndex/batchTotal wire metadata', () => {
    const base = {
      schemaVersion: EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      nodeId: 'arg-1',
      parentNodeId: 'arg-0',
      currentText: 'reply text',
      parentText: 'parent thesis',
      threadContextExcerpt: 'context',
      requestedFamilies: ['thread_topology'],
      requestedRawKeys: [...FAMILY_I_SUBSET_6],
      definitions: {},
      timeoutMs: 15000,
    } as unknown as Parameters<typeof edgeBuildBatchRequestFromFull>[0];
    const [oneBatch] = edgeChunkRawKeys([...FAMILY_I_SUBSET_6]);
    const batchReq = edgeBuildBatchRequestFromFull(base, oneBatch) as unknown as Record<
      string,
      unknown
    >;
    expect('batchIndex' in batchReq).toBe(false);
    expect('batchTotal' in batchReq).toBe(false);
    // requestedRawKeys still the 6 keys, order preserved.
    expect(batchReq.requestedRawKeys).toEqual([...FAMILY_I_SUBSET_6]);
  });
});

// ── Per-batch validation against the UNCHANGED parser ───────────────

function makeResponse(n: number): McpBooleanObservationResponse {
  const keys = Array.from({ length: n }, (_, i) => `pk_${i}`);
  const observations: Record<string, boolean> = {};
  const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
  const evidenceSpan: Record<string, string | null> = {};
  for (const k of keys) {
    observations[k] = false;
    confidence[k] = 'low';
    evidenceSpan[k] = null;
  }
  return {
    schemaVersion: EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as McpBooleanObservationResponse['schemaVersion'],
    nodeId: 'arg-1',
    checkedRawKeys: keys,
    observations,
    confidence,
    evidenceSpan,
    modelInfo: { provider: 'mcp', serverName: 's', classifierSetVersion: 'v' },
  };
}

describe('MCP-BATCHING — per-batch response passes the UNCHANGED validator; cap intact', () => {
  it('PBV-1 — a 16-key batch response parses ok', () => {
    const result = edgeParseMcpBooleanObservationResponse(makeResponse(16));
    expect(result.ok).toBe(true);
  });

  it('PBV-2 — a 20-key (at the cap) response parses ok', () => {
    const result = edgeParseMcpBooleanObservationResponse(makeResponse(20));
    expect(result.ok).toBe(true);
  });

  it('PBV-3 — a 21-key single response STILL rejects (cap unchanged)', () => {
    const result = edgeParseMcpBooleanObservationResponse(makeResponse(21));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('flag_count_too_high');
    }
  });

  it('PBV-4 — a 22-key single response STILL rejects (D would fail without batching)', () => {
    const result = edgeParseMcpBooleanObservationResponse(makeResponse(22));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('flag_count_too_high');
  });
});

// ── No-schema-bump regression ──────────────────────────────────────

describe('MCP-BATCHING — no-schema-bump regression', () => {
  it('NSB-1 — schema version constant is byte-equal (NOT bumped by batching)', () => {
    expect(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION).toBe(
      'mcp-021.machine-observations.boolean.v1',
    );
  });
});
