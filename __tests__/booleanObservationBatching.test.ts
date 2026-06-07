/**
 * MCP-BOOLEAN-BATCHING-INFRA-001 — Pure chunker / merge core tests.
 *
 * Exercises the Deno-free batching core
 * (`supabase/functions/_shared/booleanObservations/booleanObservationBatching.ts`)
 * via the established Edge Deno test bridge. The proof of the >20-key path is a
 * SYNTHETIC fixture — the infra card adds NO family keys (D/G consume this
 * later), so the >20 path is proven against test-only synthetic key sets.
 *
 * Coverage (design §"Test plan" / card §4):
 *   - Chunk determinism + lexicographic stability.
 *   - Split threshold: L <= 20 -> 1 batch (A/B/C/E/F backward-compat); L = 21
 *     -> 16+5; L = 22 -> 16+6; L = 33 (synthetic) -> 3 batches.
 *   - Disjointness + per-batch <= 20.
 *   - buildBatchRequestFromFull byte-identity for the 1-batch case + narrowing
 *     for split batches + NO batchIndex/batchTotal on the wire.
 *   - Merge correctness (union of observations/confidence/evidenceSpan),
 *     duplicate-key first-wins guard, partial-failure outcome list.
 *   - firstBatchFailureDetail leak-safe projection (integers/enums only).
 */

import {
  EDGE_BATCH_SIZE,
  EDGE_BATCH_SPLIT_THRESHOLD,
  edgeChunkRawKeys,
  edgeBuildBatchRequestFromFull,
  edgeMergeBatchResponses,
  edgeFirstBatchFailureDetail,
  edgeHasFailedBatch,
  edgeHasSuccessfulBatch,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  type EdgeBatchClassifyOutcome,
  type EdgeRawKeyBatch,
} from './_helpers/booleanObservationEdgeDeno';
import type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
} from '../src/features/nodeLabels/mcpBooleanObservationSchema';

// ── Helpers ────────────────────────────────────────────────────────

function makeKeys(n: number, prefix = 'k'): string[] {
  // Zero-padded so lexicographic sort == numeric order for readability.
  return Array.from({ length: n }, (_, i) => `${prefix}_${String(i).padStart(3, '0')}`);
}

function makeFullRequest(rawKeys: string[]): McpBooleanObservationRequest {
  const definitions: Record<string, never> = {};
  // The batching helpers only read `base.definitions[rawKey]`; an empty map is
  // fine for the chunk tests. The byte-identity test uses a populated map.
  return {
    schemaVersion: EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as McpBooleanObservationRequest['schemaVersion'],
    nodeId: 'arg-1',
    parentNodeId: 'arg-0',
    currentText: 'current move text',
    parentText: 'parent thesis',
    threadContextExcerpt: 'ancestor excerpt',
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: Object.freeze([...rawKeys]),
    definitions: definitions as McpBooleanObservationRequest['definitions'],
    timeoutMs: 12_000,
  };
}

function makeBatchResponse(
  rawKeys: string[],
  positives: ReadonlyArray<string> = [],
): McpBooleanObservationResponse {
  const observations: Record<string, boolean> = {};
  const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
  const evidenceSpan: Record<string, string | null> = {};
  for (const k of rawKeys) {
    const isPositive = positives.includes(k);
    observations[k] = isPositive;
    confidence[k] = isPositive ? 'high' : 'low';
    evidenceSpan[k] = isPositive ? `span for ${k}` : null;
  }
  return {
    schemaVersion: EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as McpBooleanObservationResponse['schemaVersion'],
    nodeId: 'arg-1',
    checkedRawKeys: [...rawKeys],
    observations,
    confidence,
    evidenceSpan,
    modelInfo: { provider: 'mcp', serverName: 'cdiscourse-mcp', classifierSetVersion: 'cs-1' },
  };
}

function successOutcome(batch: EdgeRawKeyBatch, positives: string[] = []): EdgeBatchClassifyOutcome {
  return {
    batchIndex: batch.batchIndex,
    batchTotal: batch.batchTotal,
    rawKeys: batch.rawKeys,
    result: { kind: 'success', response: makeBatchResponse([...batch.rawKeys], positives) },
  };
}

function unavailableOutcome(
  batch: EdgeRawKeyBatch,
  reason = 'network_error',
): EdgeBatchClassifyOutcome {
  return {
    batchIndex: batch.batchIndex,
    batchTotal: batch.batchTotal,
    rawKeys: batch.rawKeys,
    result: { kind: 'unavailable', reason },
  };
}

// ── Constants ──────────────────────────────────────────────────────

describe('MCP-BATCHING — constants (BATCH_SIZE=16, threshold=20)', () => {
  it('BC-1 — BATCH_SIZE is 16 (headroom 4 under the 20 cap)', () => {
    expect(EDGE_BATCH_SIZE).toBe(16);
  });

  it('BC-2 — BATCH_SPLIT_THRESHOLD mirrors the per-response cap (20)', () => {
    expect(EDGE_BATCH_SPLIT_THRESHOLD).toBe(20);
  });

  it('BC-3 — BATCH_SIZE keeps headroom >= 2 under the threshold', () => {
    expect(EDGE_BATCH_SPLIT_THRESHOLD - EDGE_BATCH_SIZE).toBeGreaterThanOrEqual(2);
  });
});

// ── Split threshold + backward-compat ──────────────────────────────

describe('MCP-BATCHING — split threshold + backward-compat (1-batch families)', () => {
  it('BC-4 — empty key set -> [] (caller skips the call)', () => {
    expect(edgeChunkRawKeys([])).toEqual([]);
  });

  it('BC-5 — Family A (19) -> exactly 1 batch (byte-identical path)', () => {
    const batches = edgeChunkRawKeys(makeKeys(19));
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({ batchIndex: 0, batchTotal: 1 });
    expect(batches[0].rawKeys).toHaveLength(19);
  });

  it('BC-6 — Family C (20, exactly at the cap) -> exactly 1 batch', () => {
    const batches = edgeChunkRawKeys(makeKeys(20));
    expect(batches).toHaveLength(1);
    expect(batches[0].rawKeys).toHaveLength(20);
  });

  it('BC-7 — B(17) / E(19) / F(17) all -> 1 batch', () => {
    for (const n of [17, 19, 17]) {
      const batches = edgeChunkRawKeys(makeKeys(n));
      expect(batches).toHaveLength(1);
      expect(batches[0].batchTotal).toBe(1);
    }
  });

  it('BC-8 — 1-batch preserves the caller input order (no sort below threshold)', () => {
    const keys = ['z', 'a', 'm', 'b'];
    const batches = edgeChunkRawKeys(keys);
    expect(batches).toHaveLength(1);
    expect(batches[0].rawKeys).toEqual(keys); // input order, unsorted
  });

  it('BC-9 — Family G (21) -> 2 batches (16 + 5)', () => {
    const batches = edgeChunkRawKeys(makeKeys(21));
    expect(batches).toHaveLength(2);
    expect(batches[0].rawKeys).toHaveLength(16);
    expect(batches[1].rawKeys).toHaveLength(5);
    expect(batches.every((b) => b.batchTotal === 2)).toBe(true);
  });

  it('BC-10 — Family D (22) -> 2 batches (16 + 6)', () => {
    const batches = edgeChunkRawKeys(makeKeys(22));
    expect(batches).toHaveLength(2);
    expect(batches[0].rawKeys).toHaveLength(16);
    expect(batches[1].rawKeys).toHaveLength(6);
  });

  it('BC-11 — synthetic 33 keys -> 3 batches (16 + 16 + 1)', () => {
    const batches = edgeChunkRawKeys(makeKeys(33));
    expect(batches).toHaveLength(3);
    expect(batches.map((b) => b.rawKeys.length)).toEqual([16, 16, 1]);
    expect(batches.map((b) => b.batchIndex)).toEqual([0, 1, 2]);
  });

  it('BC-12 — 21 keys with a custom batchSize=11 -> 2 batches (11 + 10)', () => {
    const batches = edgeChunkRawKeys(makeKeys(21), 11);
    expect(batches.map((b) => b.rawKeys.length)).toEqual([11, 10]);
  });
});

// ── Determinism + lexicographic stability ──────────────────────────

describe('MCP-BATCHING — determinism + lexicographic stability', () => {
  it('BC-13 — same input -> byte-identical batches', () => {
    const keys = makeKeys(22);
    expect(edgeChunkRawKeys(keys)).toEqual(edgeChunkRawKeys(keys));
  });

  it('BC-14 — split batches lexicographically pre-sorted (stable assignment)', () => {
    const shuffled = [...makeKeys(22)].reverse();
    const batches = edgeChunkRawKeys(shuffled);
    const flat = batches.flatMap((b) => [...b.rawKeys]);
    expect(flat).toEqual([...makeKeys(22)].sort());
  });

  it('BC-15 — a given rawKey lands in the same batch regardless of input order', () => {
    const a = edgeChunkRawKeys(makeKeys(22));
    const b = edgeChunkRawKeys([...makeKeys(22)].reverse());
    const findBatch = (batches: EdgeRawKeyBatch[], key: string) =>
      batches.findIndex((batch) => batch.rawKeys.includes(key));
    for (const key of makeKeys(22)) {
      expect(findBatch(a, key)).toBe(findBatch(b, key));
    }
  });
});

// ── Disjointness + per-batch <= 20 ─────────────────────────────────

describe('MCP-BATCHING — disjointness + per-batch cap', () => {
  it('BC-16 — every rawKey appears in exactly one batch; union = input set', () => {
    const keys = makeKeys(33);
    const batches = edgeChunkRawKeys(keys);
    const flat = batches.flatMap((b) => [...b.rawKeys]);
    expect(new Set(flat).size).toBe(flat.length); // no dupes
    expect(new Set(flat)).toEqual(new Set(keys)); // same set
  });

  it('BC-17 — every batch has <= BATCH_SPLIT_THRESHOLD (20) keys', () => {
    for (const n of [21, 22, 33, 40, 100]) {
      const batches = edgeChunkRawKeys(makeKeys(n));
      for (const batch of batches) {
        expect(batch.rawKeys.length).toBeLessThanOrEqual(EDGE_BATCH_SPLIT_THRESHOLD);
      }
    }
  });

  it('BC-18 — split batches have <= BATCH_SIZE (16) keys', () => {
    const batches = edgeChunkRawKeys(makeKeys(40));
    for (const batch of batches) {
      expect(batch.rawKeys.length).toBeLessThanOrEqual(EDGE_BATCH_SIZE);
    }
  });
});

// ── buildBatchRequestFromFull ──────────────────────────────────────

describe('MCP-BATCHING — buildBatchRequestFromFull', () => {
  it('BC-19 — 1-batch request is byte-identical to the base (backward-compat)', () => {
    const keys = makeKeys(19);
    const base = makeFullRequest(keys);
    const [oneBatch] = edgeChunkRawKeys(keys);
    const req = edgeBuildBatchRequestFromFull(base, oneBatch);
    expect([...req.requestedRawKeys]).toEqual([...base.requestedRawKeys]);
    expect(req.nodeId).toBe(base.nodeId);
    expect(req.parentNodeId).toBe(base.parentNodeId);
    expect(req.currentText).toBe(base.currentText);
    expect(req.parentText).toBe(base.parentText);
    expect(req.threadContextExcerpt).toBe(base.threadContextExcerpt);
    expect(req.requestedFamilies).toEqual(base.requestedFamilies);
    expect(req.schemaVersion).toBe(base.schemaVersion);
    expect(req.timeoutMs).toBe(base.timeoutMs);
  });

  it('BC-20 — split batch narrows requestedRawKeys to the batch slice', () => {
    const keys = makeKeys(22);
    const base = makeFullRequest(keys);
    const batches = edgeChunkRawKeys(keys);
    const req0 = edgeBuildBatchRequestFromFull(base, batches[0]);
    const req1 = edgeBuildBatchRequestFromFull(base, batches[1]);
    expect([...req0.requestedRawKeys]).toEqual([...batches[0].rawKeys]);
    expect([...req1.requestedRawKeys]).toEqual([...batches[1].rawKeys]);
    expect(req0.requestedRawKeys.length).toBe(16);
    expect(req1.requestedRawKeys.length).toBe(6);
  });

  it('BC-21 — batch metadata is NEVER on the wire (no batchIndex/batchTotal field)', () => {
    const keys = makeKeys(22);
    const base = makeFullRequest(keys);
    const batches = edgeChunkRawKeys(keys);
    const req = edgeBuildBatchRequestFromFull(base, batches[1]);
    const serialized = JSON.stringify(req);
    expect(serialized).not.toContain('batchIndex');
    expect(serialized).not.toContain('batchTotal');
    expect(Object.keys(req)).not.toContain('batchIndex');
    expect(Object.keys(req)).not.toContain('batchTotal');
  });

  it('BC-22 — definitions narrowed to the batch keys only', () => {
    const keys = makeKeys(22);
    const base = makeFullRequest(keys);
    // Populate definitions for every key so narrowing is observable.
    const populated = {
      ...base,
      definitions: Object.fromEntries(keys.map((k) => [k, { rawKey: k } as never])),
    } as McpBooleanObservationRequest;
    const batches = edgeChunkRawKeys(keys);
    const req0 = edgeBuildBatchRequestFromFull(populated, batches[0]);
    expect(Object.keys(req0.definitions).sort()).toEqual([...batches[0].rawKeys].sort());
  });
});

// ── Merge correctness ──────────────────────────────────────────────

describe('MCP-BATCHING — mergeBatchResponses', () => {
  it('BC-23 — 2 batch responses merge into one 22-key family result', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const outcomes = [
      successOutcome(batches[0], [batches[0].rawKeys[0], batches[0].rawKeys[3]]),
      successOutcome(batches[1], [batches[1].rawKeys[1]]),
    ];
    const { merged, collisions, successfulBatchCount } = edgeMergeBatchResponses(outcomes, 'arg-1');
    expect(successfulBatchCount).toBe(2);
    expect(collisions).toEqual([]);
    expect(merged.checkedRawKeys).toHaveLength(22);
    expect(new Set(merged.checkedRawKeys)).toEqual(new Set(keys));
    expect(Object.keys(merged.observations)).toHaveLength(22);
  });

  it('BC-24 — positives union correctly across batches', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const p0 = batches[0].rawKeys[2];
    const p1 = batches[1].rawKeys[4];
    const outcomes = [successOutcome(batches[0], [p0]), successOutcome(batches[1], [p1])];
    const { merged } = edgeMergeBatchResponses(outcomes, 'arg-1');
    const positives = Object.entries(merged.observations)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
      .sort();
    expect(positives).toEqual([p0, p1].sort());
    expect(merged.confidence[p0]).toBe('high');
    expect(merged.evidenceSpan[p1]).toBe(`span for ${p1}`);
  });

  it('BC-25 — nodeId + modelInfo taken from the first successful batch', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const { merged } = edgeMergeBatchResponses(
      [successOutcome(batches[0]), successOutcome(batches[1])],
      'arg-1',
    );
    expect(merged.nodeId).toBe('arg-1');
    expect(merged.modelInfo.provider).toBe('mcp');
    expect(merged.modelInfo.serverName).toBe('cdiscourse-mcp');
  });

  it('BC-26 — merged schemaVersion is pinned to the unchanged constant', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const { merged } = edgeMergeBatchResponses([successOutcome(batches[0])], 'arg-1');
    expect(merged.schemaVersion).toBe(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
  });

  it('BC-27 — duplicate rawKey across batches -> first-wins + collision recorded', () => {
    // Defensive: two batches echo the same rawKey (must not happen given
    // disjoint chunks). The merge keeps the FIRST and records the collision.
    const shared = 'dup_key';
    const r0 = makeBatchResponse([shared, 'a'], [shared]); // first: positive
    const r1 = makeBatchResponse([shared, 'b'], []); // second: negative echo
    const outcomes: EdgeBatchClassifyOutcome[] = [
      { batchIndex: 0, batchTotal: 2, rawKeys: [shared, 'a'], result: { kind: 'success', response: r0 } },
      { batchIndex: 1, batchTotal: 2, rawKeys: [shared, 'b'], result: { kind: 'success', response: r1 } },
    ];
    const { merged, collisions } = edgeMergeBatchResponses(outcomes, 'arg-1');
    expect(collisions).toContain(shared);
    expect(merged.observations[shared]).toBe(true); // first-wins (positive)
    expect(merged.checkedRawKeys.filter((k) => k === shared)).toHaveLength(1); // no dup
  });

  it('BC-28 — no positives -> zero positive entries (but checkedRawKeys preserved)', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const { merged } = edgeMergeBatchResponses(
      [successOutcome(batches[0]), successOutcome(batches[1])],
      'arg-1',
    );
    expect(Object.values(merged.observations).every((v) => v === false)).toBe(true);
    expect(merged.checkedRawKeys).toHaveLength(22);
  });
});

// ── Partial-failure semantics ──────────────────────────────────────

describe('MCP-BATCHING — partial-failure merge + failure detail', () => {
  it('BC-29 — [success, unavailable] -> merged carries the success keys only', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const outcomes = [
      successOutcome(batches[0], [batches[0].rawKeys[0]]),
      unavailableOutcome(batches[1], 'api_error'),
    ];
    const { merged, successfulBatchCount } = edgeMergeBatchResponses(outcomes, 'arg-1');
    expect(successfulBatchCount).toBe(1);
    expect(merged.checkedRawKeys).toHaveLength(16); // only batch 0's keys
    expect(edgeHasFailedBatch(outcomes)).toBe(true);
    expect(edgeHasSuccessfulBatch(outcomes)).toBe(true);
  });

  it('BC-30 — firstBatchFailureDetail projects {batchIndex, batchTotal, reason}', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const outcomes = [
      successOutcome(batches[0]),
      unavailableOutcome(batches[1], 'rate_limited'),
    ];
    const detail = edgeFirstBatchFailureDetail(outcomes);
    expect(detail).toEqual({ batchIndex: 1, batchTotal: 2, reason: 'rate_limited' });
  });

  it('BC-31 — failure detail carries ONLY structural integers/enums (no leak)', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const detail = edgeFirstBatchFailureDetail([
      successOutcome(batches[0]),
      unavailableOutcome(batches[1], 'network_error'),
    ]);
    const serialized = JSON.stringify(detail);
    // No body / prompt / rawKey / span / secret-shaped content.
    expect(Object.keys(detail!).sort()).toEqual(['batchIndex', 'batchTotal', 'reason']);
    expect(typeof detail!.batchIndex).toBe('number');
    expect(typeof detail!.batchTotal).toBe('number');
    expect(serialized).not.toContain('span for');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('current move text');
  });

  it('BC-32 — firstBatchFailureDetail picks the LOWEST failed batchIndex', () => {
    const keys = makeKeys(33);
    const batches = edgeChunkRawKeys(keys);
    const outcomes = [
      successOutcome(batches[0]),
      unavailableOutcome(batches[1], 'api_error'),
      unavailableOutcome(batches[2], 'network_error'),
    ];
    expect(edgeFirstBatchFailureDetail(outcomes)?.batchIndex).toBe(1);
  });

  it('BC-33 — all-success -> firstBatchFailureDetail is null', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    expect(
      edgeFirstBatchFailureDetail([successOutcome(batches[0]), successOutcome(batches[1])]),
    ).toBeNull();
  });

  it('BC-34 — all-unavailable -> hasSuccessfulBatch false, merged falls back to nodeId', () => {
    const keys = makeKeys(22);
    const batches = edgeChunkRawKeys(keys);
    const outcomes = [unavailableOutcome(batches[0]), unavailableOutcome(batches[1])];
    expect(edgeHasSuccessfulBatch(outcomes)).toBe(false);
    const { merged, successfulBatchCount } = edgeMergeBatchResponses(outcomes, 'fallback-arg');
    expect(successfulBatchCount).toBe(0);
    expect(merged.nodeId).toBe('fallback-arg');
    expect(merged.checkedRawKeys).toHaveLength(0);
  });
});
