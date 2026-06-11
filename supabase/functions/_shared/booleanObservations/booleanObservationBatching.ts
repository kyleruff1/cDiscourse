/**
 * MCP-BOOLEAN-BATCHING-INFRA-001 — Pure request-batching core for the
 * Boolean Observation classifier.
 *
 * The boolean-observation classifier validates each MCP response with the
 * per-response cap `MAX_FLAGS_PER_RESPONSE = 20` — counted over EVERY
 * checked key (true and false). A family whose source-filtered classified
 * rawKey set exceeds 20 (Build-2 Family D = 22, Family G = 21) cannot be
 * served by a single MCP request: the 22/21-entry `observations` map trips
 * `flag_count_too_high` on the Edge parser and `validation_failed` on the
 * mcp-server mirror.
 *
 * This module is the deterministic CHUNKING + MERGE layer. It splits a
 * family's full rawKey set into batches of <= BATCH_SIZE keys (each batch a
 * normal <= 20-key request that passes the UNCHANGED validators), and merges
 * the N batch responses into one logical family-level response before the
 * existing sanitize/persist tail runs. The split is applied ONLY when the
 * family's key count EXCEEDS the per-response cap (the split threshold), so a
 * family that already fits (A/B/C/E/F) produces EXACTLY ONE batch whose
 * request is byte-identical to the pre-batching builder output.
 *
 * Doctrine (per design §"Doctrine self-check"):
 *   - cdiscourse-doctrine §1 — transport only; introduces no label, verdict,
 *     or score. Observations stay advisory, post-storage / display-only.
 *   - cdiscourse-doctrine §3 / evidence-doctrine — batch count is a PURE
 *     function of the family's STATIC rawKey-set size + BATCH_SIZE. It NEVER
 *     depends on heat / engagement / popularity / argument content. The cap
 *     is a transport guard, never a semantic input.
 *   - cdiscourse-doctrine §6 — pure TS; no Deno, no fetch, no service-role,
 *     no secret. The partial-failure detail carries only structural integers
 *     / enums (batchIndex, batchTotal, reason) — never a body / prompt / key.
 *   - No-schema-bump invariant — `batchIndex` / `batchTotal` are OUT-OF-BAND
 *     orchestration only; they NEVER serialize to the wire. Each batch
 *     request/response is a normal McpBooleanObservationRequest/Response.
 *
 * Pure TypeScript — no Deno-specific call, no I/O, no Date, no randomness.
 * Same input -> byte-identical output (important for idempotent re-runs).
 */

import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchema.ts';
import type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
} from './mcpBooleanObservationSchema.ts';
import type { MachineObservationDefinition } from './nodeLabelTypes.ts';

/**
 * BATCH_SIZE — the maximum number of rawKeys per batch WHEN a split is
 * needed. 16 leaves 4 entries of headroom under the per-response cap (20):
 * defensive against a model that emits one extra spurious key (the sanitizer
 * drops it, but it still counts toward the cap at the mcp-server validator
 * step BEFORE sanitization). With BATCH_SIZE = 16:
 *   - Family D (22 keys) -> 2 batches (16 + 6)
 *   - Family G (21 keys) -> 2 batches (16 + 5)
 *
 * MUST keep headroom >= 2 under BATCH_SPLIT_THRESHOLD (design §1, Q3).
 */
export const BATCH_SIZE = 16;

/**
 * BATCH_SPLIT_THRESHOLD — the per-response cap (20). A family whose rawKey
 * count is <= this produces EXACTLY ONE batch (byte-identical to today). Only
 * a family that EXCEEDS this is split. This is the load-bearing design choice:
 * split-threshold = the cap (20); batch-size = 16 only for the split itself.
 *
 * This is a VERBATIM mirror of `MAX_FLAGS_PER_RESPONSE = 20` in
 * `mcpBooleanObservationSchema.ts` (and the mcp-server mirror). The cap
 * constant itself is NOT changed by this card; this constant exists so the
 * chunker never produces a batch the unchanged validator would reject.
 */
export const BATCH_SPLIT_THRESHOLD = 20;

/**
 * One batch of a family's rawKey list. Orchestration-internal: NEVER
 * serialized to the wire (the request `inputSchema` is `additionalProperties:
 * false` and carries no batchIndex/batchTotal — see the no-schema-bump
 * invariant in the design).
 */
export interface RawKeyBatch {
  /** 0-based index of this batch within the family's batch list. */
  readonly batchIndex: number;
  /** Total batches for the family this call. */
  readonly batchTotal: number;
  /** The rawKeys assigned to this batch (<= BATCH_SIZE; stable order). */
  readonly rawKeys: readonly string[];
}

/**
 * Per-batch outcome carried through the merge step (orchestration-internal).
 * The `unavailable` arm mirrors the adapter's `unavailable` discriminant so
 * the orchestrators can thread the existing failure-reason vocabulary.
 */
export interface BatchClassifyOutcome {
  readonly batchIndex: number;
  readonly batchTotal: number;
  readonly rawKeys: readonly string[];
  readonly result:
    | { kind: 'success'; response: McpBooleanObservationResponse }
    | { kind: 'unavailable'; reason: string; subReason?: string; detail?: { path?: string } };
}

/**
 * Deterministically split a family's rawKey list into batches.
 *
 *   - L <= BATCH_SPLIT_THRESHOLD (20)  -> EXACTLY ONE batch holding all keys,
 *     in the caller's input order, byte-identical to the no-batching path.
 *   - L >  BATCH_SPLIT_THRESHOLD (20)  -> ceil(L / batchSize) batches of
 *     <= batchSize keys each, assigned from a LEXICOGRAPHICALLY pre-sorted
 *     copy so a given rawKey always lands in the same batch regardless of
 *     upstream registry-iteration order (idempotent re-runs).
 *   - L === 0                          -> [] (no batch; caller skips the call).
 *
 * Pure + total: same input -> byte-identical batches. Never throws.
 */
export function chunkRawKeys(
  rawKeys: readonly string[],
  batchSize: number = BATCH_SIZE,
): RawKeyBatch[] {
  const safeBatchSize = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : BATCH_SIZE;

  if (!Array.isArray(rawKeys) || rawKeys.length === 0) {
    // Empty family for this mode -> no batch. The caller preserves today's
    // "empty requestedRawKeys, caller decides whether to skip" behavior.
    return [];
  }

  // <= cap: exactly one batch, byte-identical to today (input order preserved).
  if (rawKeys.length <= BATCH_SPLIT_THRESHOLD) {
    return [{ batchIndex: 0, batchTotal: 1, rawKeys: [...rawKeys] }];
  }

  // > cap: split. Lexicographic pre-sort makes batch membership a pure
  // function of the family's key SET (not its iteration order).
  const sorted = [...rawKeys].sort();
  const batchTotal = Math.ceil(sorted.length / safeBatchSize);
  const batches: RawKeyBatch[] = [];
  for (let i = 0; i < batchTotal; i += 1) {
    const start = i * safeBatchSize;
    batches.push({
      batchIndex: i,
      batchTotal,
      rawKeys: sorted.slice(start, start + safeBatchSize),
    });
  }
  return batches;
}

/**
 * Build a per-batch McpBooleanObservationRequest from the full family
 * request. Overrides `requestedRawKeys` with the batch slice and narrows
 * `definitions` to the batch's keys. Every other field (schemaVersion,
 * nodeId, parentNodeId, currentText, parentText, threadContextExcerpt,
 * requestedFamilies, timeoutMs) is copied VERBATIM from the base.
 *
 * NO batchIndex / batchTotal is added to the returned request — the wire
 * shape is byte-identical to a normal single-family request (no-schema-bump
 * invariant). Pure; never mutates the base.
 *
 * Single-batch byte-identity: when there is exactly one batch holding all
 * keys, the returned request's `requestedRawKeys` equals `base.requestedRawKeys`
 * and `definitions` equals `base.definitions` (narrowed to all keys =
 * unchanged) — reproducing today's exact request.
 */
export function buildBatchRequestFromFull(
  base: McpBooleanObservationRequest,
  batch: RawKeyBatch,
): McpBooleanObservationRequest {
  const narrowedDefinitions: Record<string, MachineObservationDefinition> = {};
  for (const rawKey of batch.rawKeys) {
    const def = base.definitions[rawKey];
    if (def) narrowedDefinitions[rawKey] = def;
  }

  return {
    schemaVersion: base.schemaVersion,
    nodeId: base.nodeId,
    parentNodeId: base.parentNodeId,
    currentText: base.currentText,
    parentText: base.parentText,
    threadContextExcerpt: base.threadContextExcerpt,
    requestedFamilies: base.requestedFamilies,
    requestedRawKeys: Object.freeze([...batch.rawKeys]),
    definitions: narrowedDefinitions,
    timeoutMs: base.timeoutMs,
  };
}

/** Outcome of merging N batch responses. */
export interface MergeBatchResult {
  /** The merged logical family-level response. */
  readonly merged: McpBooleanObservationResponse;
  /**
   * rawKeys that appeared in MORE THAN ONE successful batch (must not happen
   * given disjoint chunks; defensive). First-wins is applied; the collision
   * is recorded here for the run's failure_detail.
   */
  readonly collisions: string[];
  /** The number of successful batches that contributed to the merge. */
  readonly successfulBatchCount: number;
}

/**
 * Merge N batch outcomes into ONE logical family-level response.
 *
 *   - nodeId + modelInfo taken from the FIRST successful batch (all batches
 *     share the same argument -> same nodeId; modelInfo is per-server,
 *     identical across batches).
 *   - checkedRawKeys concatenated across successful batches.
 *   - observations / confidence / evidenceSpan maps unioned. Chunks are
 *     disjoint so there is no real collision; if a misbehaving model echoes a
 *     rawKey already seen in an earlier batch, the FIRST occurrence wins and
 *     the rawKey is recorded in `collisions`.
 *   - unavailable batches contribute nothing (their keys simply have no rows;
 *     the partial-failure policy lives in the orchestrator).
 *
 * Throws NEVER. When there is no successful batch, returns an empty merged
 * response keyed to `fallbackNodeId` (the orchestrator decides the failed-run
 * disposition).
 */
export function mergeBatchResponses(
  outcomes: readonly BatchClassifyOutcome[],
  fallbackNodeId: string,
): MergeBatchResult {
  const observations: Record<string, boolean> = {};
  const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
  const evidenceSpan: Record<string, string | null> = {};
  const checkedRawKeys: string[] = [];
  const seen = new Set<string>();
  const collisions: string[] = [];

  let nodeId: string | null = null;
  let modelInfo: McpBooleanObservationResponse['modelInfo'] | null = null;
  let successfulBatchCount = 0;
  // OPS-MCP-KEY-LEVEL-FAIL-CLOSED — UNION of each successful batch's
  // server-sourced unclean-span drop list. Chunks are disjoint, so the union is
  // a concatenation (first-wins is moot). Absent in every batch ⇒ absent in the
  // merged response (byte-identical to a pre-card merge).
  const droppedUncleanSpanKeys: string[] = [];

  for (const outcome of outcomes) {
    if (outcome.result.kind !== 'success') continue;
    const response = outcome.result.response;
    successfulBatchCount += 1;

    if (nodeId === null) nodeId = response.nodeId;
    if (modelInfo === null) modelInfo = { ...response.modelInfo };

    if (Array.isArray(response.keysDroppedForUncleanSpan)) {
      for (const k of response.keysDroppedForUncleanSpan) {
        if (!droppedUncleanSpanKeys.includes(k)) droppedUncleanSpanKeys.push(k);
      }
    }

    for (const rawKey of response.checkedRawKeys) {
      if (seen.has(rawKey)) {
        // Disjoint chunks should make this unreachable; first-wins + record.
        collisions.push(rawKey);
        continue;
      }
      seen.add(rawKey);
      checkedRawKeys.push(rawKey);

      if (rawKey in response.observations) {
        observations[rawKey] = response.observations[rawKey];
      }
      if (rawKey in response.confidence) {
        confidence[rawKey] = response.confidence[rawKey];
      }
      if (rawKey in response.evidenceSpan) {
        evidenceSpan[rawKey] = response.evidenceSpan[rawKey];
      }
    }
  }

  const merged: McpBooleanObservationResponse = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: nodeId ?? fallbackNodeId,
    checkedRawKeys: Object.freeze(checkedRawKeys),
    observations,
    confidence,
    evidenceSpan,
    modelInfo: modelInfo ?? {
      provider: 'mcp',
      serverName: '',
      classifierSetVersion: '',
    },
    // Absent ⇔ no batch dropped a key (byte-identical to a pre-card merge).
    ...(droppedUncleanSpanKeys.length > 0
      ? { keysDroppedForUncleanSpan: Object.freeze([...droppedUncleanSpanKeys].sort()) }
      : {}),
  };

  return { merged, collisions, successfulBatchCount };
}

/**
 * Leak-safe partial-failure projection for the run's `failure_detail`. Carries
 * ONLY structural integers / enums — the failed batch's index, the family's
 * batch total, and the controlled failure-reason string. NEVER a body, prompt,
 * evidenceSpan value, rawKey, Authorization header, or any secret.
 *
 * Returns the FIRST failed batch (lowest batchIndex) — the orchestrator marks
 * the run `status:'failed'`. Per the reconcile/545 CONCERN resolution BOTH
 * orchestrators are now ALL-OR-NOTHING: on any batch failure NO positive rows
 * are persisted (the drainer never had partial-persist; the direct path was
 * aligned to match — see classifyArgumentCore.ts). This projection is the only
 * batch-level diagnostic written to the failed run's `failure_detail`.
 */
export interface BatchFailureDetail {
  readonly batchIndex: number;
  readonly batchTotal: number;
  readonly reason: string;
}

/**
 * Find the first failed batch outcome and project it into the leak-safe
 * failure-detail shape. Returns null when every batch succeeded.
 */
export function firstBatchFailureDetail(
  outcomes: readonly BatchClassifyOutcome[],
): BatchFailureDetail | null {
  const failed = outcomes
    .filter((o) => o.result.kind === 'unavailable')
    .sort((a, b) => a.batchIndex - b.batchIndex);
  if (failed.length === 0) return null;
  const first = failed[0];
  // The unavailable arm is narrowed by the filter above.
  const reason =
    first.result.kind === 'unavailable' ? first.result.reason : 'unknown';
  return {
    batchIndex: first.batchIndex,
    batchTotal: first.batchTotal,
    reason,
  };
}

/** True when at least one batch failed (any `unavailable` outcome). */
export function hasFailedBatch(outcomes: readonly BatchClassifyOutcome[]): boolean {
  return outcomes.some((o) => o.result.kind === 'unavailable');
}

/** True when at least one batch succeeded. */
export function hasSuccessfulBatch(outcomes: readonly BatchClassifyOutcome[]): boolean {
  return outcomes.some((o) => o.result.kind === 'success');
}
