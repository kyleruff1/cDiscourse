/**
 * MCP-021C-AUTO-TRIGGER-FAMILY-A — Per-argument classifier core.
 *
 * Lifted byte-equivalent (semantically) from
 * `supabase/functions/classify-argument-boolean-observations/index.ts:305-489`.
 *
 * This module is the shared per-argument classifier orchestration. It is
 * invoked from two callers at v1:
 *   1. The classifier Edge Function HTTP handler (admin-gated; the
 *      pre-existing call site).
 *   2. The fire-and-forget auto-trigger dispatcher invoked from
 *      `submit-argument` after a new argument is inserted.
 *
 * The handler-side admin gate is UNCHANGED. The auto-trigger dispatcher
 * inherits submit-argument's already-authenticated isolate; there is no
 * second auth boundary at this call.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §7 (no AI calls from production app): server
 *     side only — this file is under `supabase/functions/`.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every row
 *     this module persists is a Machine Observation. The classifier
 *     never writes user-side Allegations.
 *   - cdiscourse-doctrine §1: this module produces no truth labels;
 *     positive Boolean Observations are advisory structural facts.
 *
 * NEVER throws — every failure path returns a sanitized
 * `PerArgumentSummary`. The caller (handler or dispatcher) decides what
 * to do with the summary.
 */

import type { createServiceClient } from '../supabaseClients.ts';
import type { BooleanObservationAdapterResult } from './booleanObservationMcpAdapterCore.ts';
import type {
  BooleanObservationFailureSubreason,
  BooleanObservationFailureDetail,
} from './booleanObservationFailureSubreason.ts';
import {
  buildBooleanObservationRequestForArgument,
  buildBooleanObservationInputHash,
} from './booleanObservationRequestBuilder.ts';
import {
  chunkRawKeys,
  buildBatchRequestFromFull,
  mergeBatchResponses,
  firstBatchFailureDetail,
  hasFailedBatch,
  hasSuccessfulBatch,
} from './booleanObservationBatching.ts';
import type { BatchClassifyOutcome } from './booleanObservationBatching.ts';
import { filterFamiliesForMode } from './familyRegistry.ts';
import { buildRunRowFailureDetail } from './classifierRunRowFailureDetail.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  sanitizeMcpBooleanObservationResponse,
} from './mcpBooleanObservationSchema.ts';
import type { McpBooleanObservationResponse } from './mcpBooleanObservationSchema.ts';
import { MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY } from './machineObservationDefinitions.ts';
import {
  persistRun,
  persistResults,
} from './persistenceWriter.ts';
import type {
  PersistResultInput,
} from './persistenceWriter.ts';
import {
  ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS,
  DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME,
  MCP_BOOLEAN_OBSERVATION_TOOL_NAME,
} from './booleanObservationMcpAdapterCore.ts';
import type { MachineObservationRunMode } from './runModeConstants.ts';
import type {
  MachineObservationFamily,
} from './nodeLabelTypes.ts';

/** Stable provider key, unchanged from the Edge Function handler. */
export const PROVIDER_KEY = `mcp:${MCP_BOOLEAN_OBSERVATION_TOOL_NAME}`;

/** Per-argument result summary. Mirrors the handler's existing shape. */
export interface PerArgumentSummary {
  argumentId: string;
  runId: string | null;
  status: 'success' | 'failed';
  failureReason: string | null;
  positiveObservationCount: number;
  rawKeysWithPositive: string[];
  /**
   * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 1): the typed
   * adapter-failure sub-reason, present ONLY on the adapter-unavailable
   * path. ADDITIVE — `failureReason` is unchanged (the validator path
   * still yields `'mcp_validation_failed'`). Read synchronously off the
   * RETURN by the Phase 2 reproduction harness. Never user-facing.
   */
  failureSubReason?: BooleanObservationFailureSubreason;
  /**
   * The bounded, sanitized adapter-failure detail (allowlisted structural
   * fields only — never a body/prompt/raw response/secret). Present only
   * on the adapter-unavailable path.
   */
  failureDetail?: BooleanObservationFailureDetail;
}

/** Loaded argument context (move body + parent + ancestors). */
export interface ArgumentContext {
  argumentId: string;
  parentArgumentId: string | null;
  currentText: string;
  parentText: string | null;
  threadContextExcerpt: string;
  debateId: string;
}

/**
 * Load the argument context (move body + parent body + thread excerpt)
 * via the service-role client. Returns null when the argument is missing
 * or soft-deleted.
 */
export async function loadArgumentContext(
  argumentId: string,
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<ArgumentContext | null> {
  const { data: arg, error: argError } = await serviceClient
    .from('arguments')
    .select('id, debate_id, body, parent_id, status')
    .eq('id', argumentId)
    .maybeSingle();
  if (argError || !arg || arg.status === 'deleted') return null;

  let parentText: string | null = null;
  if (arg.parent_id) {
    const { data: parent } = await serviceClient
      .from('arguments')
      .select('id, body, status')
      .eq('id', arg.parent_id)
      .maybeSingle();
    if (parent && parent.status !== 'deleted') {
      parentText = typeof parent.body === 'string' ? parent.body : null;
    }
  }

  // Thread context: up to 3 ancestor bodies above the parent, joined by ---.
  const ancestorBodies: string[] = [];
  let cursor = arg.parent_id as string | null;
  let depth = 0;
  while (cursor && depth < 3) {
    const { data: ancestor } = await serviceClient
      .from('arguments')
      .select('id, body, parent_id, status')
      .eq('id', cursor)
      .maybeSingle();
    if (!ancestor) break;
    if (ancestor.status !== 'deleted' && typeof ancestor.body === 'string') {
      ancestorBodies.push(ancestor.body);
    }
    cursor = (ancestor.parent_id as string | null) ?? null;
    depth += 1;
  }
  const threadContextExcerpt = ancestorBodies.join('\n---\n').slice(0, 2_000);

  return {
    argumentId,
    parentArgumentId: (arg.parent_id as string | null) ?? null,
    currentText: typeof arg.body === 'string' ? arg.body : '',
    parentText,
    threadContextExcerpt,
    debateId: arg.debate_id as string,
  };
}

/**
 * Map the adapter `unavailable` reason to the persisted `failure_reason`
 * column value. Stable strings; matches design §4.1.
 */
export function unavailableReasonToFailureReason(reason: string): string {
  switch (reason) {
    case 'url_missing':
      return 'mcp_url_missing';
    case 'token_missing':
      return 'mcp_token_missing';
    case 'network_error':
      return 'mcp_network_error';
    case 'api_error':
      return 'mcp_api_error';
    case 'rate_limited':
      return 'mcp_rate_limited';
    case 'parse_failure':
      return 'mcp_parse_failure';
    case 'validation_failed':
      return 'mcp_validation_failed';
    default:
      return `mcp_${reason}`;
  }
}

/**
 * Classify ONE argument: fetch context, build request, invoke adapter,
 * persist run + results. Returns the per-argument summary entry.
 *
 * Inner errors are caught and recorded — the function never throws.
 *
 * The adapter dependency is injected so tests can wire a mock without
 * making a real fetch.
 */
export async function classifyOneArgumentCore(
  argumentId: string,
  requestedFamilies: ReadonlyArray<MachineObservationFamily>,
  mode: MachineObservationRunMode,
  serviceClient: ReturnType<typeof createServiceClient>,
  adapter: (request: ReturnType<typeof buildBooleanObservationRequestForArgument>) => Promise<BooleanObservationAdapterResult>,
): Promise<PerArgumentSummary> {
  const startedAt = new Date().toISOString();

  // Load context.
  const context = await loadArgumentContext(argumentId, serviceClient);
  if (!context) {
    // No run row; the argument isn't visible. Return a sanitized
    // summary without writing — the database has no record because the
    // run never started.
    return {
      argumentId,
      runId: null,
      status: 'failed',
      failureReason: 'argument_not_found',
      positiveObservationCount: 0,
      rawKeysWithPositive: [],
    };
  }

  // Filter families per mode.
  const eligibleFamilies = filterFamiliesForMode(requestedFamilies, mode);

  // Build the MCP request.
  //
  // OPS-MCP-ADMIN-VALIDATION-BODY-BUDGET — the SECOND timeout lever. The
  // in-body `timeoutMs` is the MCP server's MODEL deliberation budget (read
  // server-side), distinct from the caller-side `AbortSignal.timeout` PR #570
  // widened to 30s for admin_validation. The 2026-06-11 byte-exact replay
  // isolated the body budget as the determinant: body `timeoutMs:12000`
  // (builder default) truncates deliberation on slur-adjacent inputs and emits
  // an unclean span → validation_failed; body `timeoutMs:30000` yields a clean
  // narrowed span → success (4/4 deterministic). The DRAINER already passes
  // `DRAINER_MCP_REQUEST_TIMEOUT_MS` (30s) in-body (classifierDrainerClassify.ts
  // header §2 / :138); this aligns admin_validation with the drainer on BOTH
  // levers. `undefined` → the builder's 12s default, keeping production /
  // auto-trigger / submit hot-path requests BYTE-EQUIVALENT (fast-fail by
  // design). Only the admin_validation branch of the ternary adds the field.
  const mcpRequest = buildBooleanObservationRequestForArgument({
    argumentId,
    parentArgumentId: context.parentArgumentId,
    currentText: context.currentText,
    parentText: context.parentText,
    threadContextExcerpt: context.threadContextExcerpt,
    requestedFamilies: eligibleFamilies,
    mode,
    timeoutMs:
      mode === 'admin_validation'
        ? ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS
        : undefined,
  });

  // Compute the audit input hash.
  const inputHash = buildBooleanObservationInputHash({
    argumentId,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    runMode: mode,
    families: eligibleFamilies as ReadonlyArray<string>,
  });

  // MCP-BOOLEAN-BATCHING-INFRA-001 — split the family's full rawKey set into
  // batches of <= BATCH_SIZE (each a normal <= 20-key request passing the
  // UNCHANGED validator) and invoke the adapter ONCE PER BATCH (sequential,
  // per design §4 — no concurrency-product increase). A family that fits the
  // per-response cap (A/B/C/E/F) produces EXACTLY ONE batch whose request is
  // byte-identical to the pre-batching call (single adapter call, single
  // persistRun, merge-of-one = the response itself). Only D (22) / G (21) —
  // the families that EXCEED the 20-key cap — split. batchIndex/batchTotal
  // are OUT-OF-BAND orchestration; they NEVER serialize to the wire.
  const batches = chunkRawKeys(mcpRequest.requestedRawKeys);
  const batchOutcomes: BatchClassifyOutcome[] = [];
  // The ORIGINAL typed adapter `unavailable` result of the first failed batch
  // (preserved so the fully-failed RETURN threads the typed subReason / detail
  // exactly as today's single-call path did). Null when every batch succeeded.
  let firstUnavailable: Extract<BooleanObservationAdapterResult, { kind: 'unavailable' }> | null =
    null;
  for (const batch of batches) {
    const batchRequest = buildBatchRequestFromFull(mcpRequest, batch);
    const adapterResult = await adapter(batchRequest);
    if (adapterResult.kind === 'unavailable') {
      if (firstUnavailable === null) firstUnavailable = adapterResult;
      batchOutcomes.push({
        batchIndex: batch.batchIndex,
        batchTotal: batch.batchTotal,
        rawKeys: batch.rawKeys,
        result: {
          kind: 'unavailable',
          reason: adapterResult.reason,
          subReason: adapterResult.subReason,
          detail: adapterResult.detail?.path !== undefined
            ? { path: adapterResult.detail.path }
            : undefined,
        },
      });
      // Sequential short-circuit: once a batch fails the run is already
      // doomed to `status:'failed'`. Stop issuing further provider calls for
      // this family (no point spending more provider budget on a run that
      // will be marked failed); on ANY batch failure the run is ALL-OR-NOTHING
      // — no positive rows are persisted (see the runStatus === 'failed' guard
      // below). A retry (drainer / auto-trigger) re-runs the WHOLE family
      // deterministically (idempotent chunk assignment).
      break;
    }
    batchOutcomes.push({
      batchIndex: batch.batchIndex,
      batchTotal: batch.batchTotal,
      rawKeys: batch.rawKeys,
      result: { kind: 'success', response: adapterResult.response },
    });
  }
  const completedAt = new Date().toISOString();

  const anySuccess = hasSuccessfulBatch(batchOutcomes);
  const anyFailure = hasFailedBatch(batchOutcomes);

  // ── Fully-failed run (no batch succeeded) — byte-identical to today's
  //    single-call unavailable branch (one batch, one failure). ──────────
  if (!anySuccess) {
    const unavailable: Extract<BooleanObservationAdapterResult, { kind: 'unavailable' }> =
      firstUnavailable ?? { kind: 'unavailable', reason: 'network_error' };
    const failureReason = unavailableReasonToFailureReason(unavailable.reason);
    // OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 — build the
    // leak-safe diagnostic projection for the direct-dispatch failed run row,
    // reusing the SAME builder the queue drainer uses. Inputs are
    // allow-listed structural strings only: the controlled `mcp_*` enum
    // (failureReason), the structural validator PATH (never the span text),
    // the single auto-trigger family, the run mode, and the schema-version
    // constant. correlation_id is omitted (Open Q1): the run row's own PK
    // already correlates and `runId` is not known until after the INSERT.
    // The PERSISTED `failure_detail` is the builder OUTPUT (matching the
    // drainer path); the raw `adapterResult.detail` rides the RETURN value
    // below unchanged.
    const failureDetail = buildRunRowFailureDetail({
      validatorPath: unavailable.detail?.path,
      reason: failureReason,
      family: eligibleFamilies[0],
      runMode: mode,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      // MCP-EGI-003 — mirror the drainer's persistence so the direct-dispatch
      // path (admin_validation + auto-trigger) also carries the hosted-MCP
      // discriminator on the row. Both fields are closed-enum allowlisted by
      // the builder; an unknown value is dropped silently (leak-safe).
      mcpToolReason: unavailable.detail?.serverReason,
      mcpToolDetailCategory: unavailable.detail?.detailCategory,
    }) ?? null;
    const runWrite = await persistRun({
      debateId: context.debateId,
      argumentId,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      requestedFamilies: eligibleFamilies,
      providerKey: PROVIDER_KEY,
      modelName: DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME,
      inputHash,
      runMode: mode,
      status: 'failed',
      failureReason,
      // Q2/Q3: pass the typed BooleanObservationFailureSubreason enum string
      // through to the text column; write null (no synthetic value) when the
      // adapter left it unset (e.g. url_missing / token_missing).
      failureSubReason: unavailable.subReason ?? null,
      failureDetail,
      startedAt,
      completedAt,
    });
    return {
      argumentId,
      runId: runWrite.ok ? runWrite.runId : null,
      status: 'failed',
      failureReason,
      positiveObservationCount: 0,
      rawKeysWithPositive: [],
      // OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 1): thread the
      // typed sub-reason + sanitized detail off the adapter result onto
      // the RETURN. ADDITIVE — `failureReason` above is unchanged. Both
      // are absent when the adapter did not populate them (e.g.
      // url_missing / token_missing leave subReason unset).
      failureSubReason: unavailable.subReason,
      failureDetail: unavailable.detail,
    };
  }

  // ── At least one batch succeeded — merge then run the SAME sanitize /
  //    persist tail off the MERGED response. When some (but not all) batches
  //    failed, the run is marked `status:'failed'` with a leak-safe
  //    `failure_detail {batchIndex, batchTotal, reason}` and NO positive rows
  //    are persisted (ALL-OR-NOTHING — see the runStatus === 'failed' guard
  //    below). Only the all-success path persists the merged positives. ─────
  const { merged } = mergeBatchResponses(batchOutcomes, argumentId);
  const batchFailure = anyFailure ? firstBatchFailureDetail(batchOutcomes) : null;
  // Leak-safe structural projection (batchIndex / batchTotal / reason — all
  // integers/enums; no body / prompt / rawKey / secret). Widened to the
  // persistRun failure_detail param type.
  const partialFailureDetail: Record<string, unknown> | null = batchFailure
    ? {
        batchIndex: batchFailure.batchIndex,
        batchTotal: batchFailure.batchTotal,
        reason: batchFailure.reason,
      }
    : null;
  const runStatus: 'success' | 'failed' = anyFailure ? 'failed' : 'success';
  const partialFailureReason = anyFailure ? 'mcp_batch_partial_failure' : null;

  // Success/partial path — sanitize at inspect floor.
  const sanitized: McpBooleanObservationResponse = sanitizeMcpBooleanObservationResponse(
    merged,
    { surface: 'inspect' },
  );

  // OPS-MCP-KEY-LEVEL-FAIL-CLOSED — the server-sourced unclean-span drop list
  // (rawKey NAMES only) rides through the merge + sanitize. Persist it ONLY on a
  // SUCCESS run that actually dropped ≥1 key; otherwise leave the column NULL
  // (the INSERT is byte-equal to today). This is the run-row audit signal that a
  // key-level fail-closed drop happened on a SUCCESS run.
  const droppedUncleanSpanKeys: string[] | null =
    runStatus === 'success' &&
    Array.isArray(sanitized.keysDroppedForUncleanSpan) &&
    sanitized.keysDroppedForUncleanSpan.length > 0
      ? [...sanitized.keysDroppedForUncleanSpan]
      : null;

  const runWrite = await persistRun({
    debateId: context.debateId,
    argumentId,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    requestedFamilies: eligibleFamilies,
    providerKey: PROVIDER_KEY,
    modelName: DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME,
    inputHash,
    runMode: mode,
    status: runStatus,
    failureReason: partialFailureReason,
    // Partial-failure: a leak-safe structural projection of the first failed
    // batch (batchIndex / batchTotal / reason). NULL on the all-success path
    // so a fully-successful run's INSERT is byte-equal to today.
    ...(partialFailureDetail !== null ? { failureDetail: partialFailureDetail } : {}),
    // Key-level fail-closed audit column — names only; only on a SUCCESS run
    // with ≥1 drop. Omitted otherwise (column stays NULL; INSERT byte-equal).
    ...(droppedUncleanSpanKeys !== null ? { droppedUncleanSpanKeys } : {}),
    startedAt,
    completedAt,
  });
  if (!runWrite.ok) {
    return {
      argumentId,
      runId: null,
      status: 'failed',
      failureReason: 'persist_run_failed',
      positiveObservationCount: 0,
      rawKeysWithPositive: [],
    };
  }

  // MCP-BOOLEAN-BATCHING-INFRA-001 — ALL-OR-NOTHING (aligned to the drainer):
  // when ANY batch failed, persist NO positive result rows. The failed run row
  // (written above by persistRun, carrying the leak-safe failure_detail
  // { batchIndex, batchTotal, reason }) is the ONLY thing written — matching
  // classifierDrainerClassify.ts, which has no partial-persist concept.
  //
  // RATIONALE (reconcile/545 CONCERN resolution): the production results-read
  // consumers filter run_mode but NOT run STATUS —
  //   • src/features/nodeLabels/machineObservationPersistenceQuery.ts:127
  //     (Source 6) filters `run_mode = 'production'` only, no status filter; and
  //   • src/features/arguments/argumentsApi.ts (fetchArgumentRelations) selects
  //     results by argument_id with no run join at all.
  // So a partial-persisted positive under a FAILED run would (a) surface in
  // Source 6 and (b) double-count against the retry's fresh success run. The
  // auto-trigger / drainer retry re-runs the WHOLE family deterministically
  // (idempotent chunk assignment); a fresh SUCCESS run then persists the FULL
  // positive set under a NEW run_id. On the all-success path this guard is a
  // no-op (runStatus === 'success') and the tail below is byte-equal to today.
  if (runStatus === 'failed') {
    return {
      argumentId,
      runId: runWrite.runId,
      status: 'failed',
      failureReason: partialFailureReason,
      positiveObservationCount: 0,
      rawKeysWithPositive: [],
    };
  }

  // Collect positive observations (in-memory aggregation from the
  // sanitized response). The actual response summary is built from the
  // post-persist SELECT below, NOT this in-memory state — see
  // MCP-021C-EDGE-RESPONSE-SUMMARY-FIX.
  const resultsToWrite: PersistResultInput[] = [];
  const inMemoryRawKeys: string[] = [];
  for (const rawKey of sanitized.checkedRawKeys) {
    if (sanitized.observations[rawKey] !== true) continue;
    const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey];
    if (!def) continue;
    const confidence = sanitized.confidence[rawKey];
    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') continue;
    const evidenceSpan = sanitized.evidenceSpan[rawKey] ?? null;
    resultsToWrite.push({
      runId: runWrite.runId,
      debateId: context.debateId,
      argumentId,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      rawKey,
      family: def.family,
      confidence,
      evidenceSpan,
    });
    inMemoryRawKeys.push(rawKey);
  }

  // Persist positives and capture the writer's outcome. A silent persist
  // failure (the pre-fix behavior) is now surfaced as a failed run.
  let persistFailureReason: string | null = null;
  if (resultsToWrite.length > 0) {
    const writeResult = await persistResults(resultsToWrite);
    if (!writeResult.ok) {
      persistFailureReason = `persist_results_failed:${writeResult.error}`;
    }
  }

  // MCP-021C-EDGE-RESPONSE-SUMMARY-FIX: the per-arg summary reflects what's
  // actually persisted, not what we attempted to write. A post-persist
  // SELECT against argument_machine_observation_results for this runId
  // is the authoritative source. This guarantees the response matches
  // persistence regardless of any in-memory state divergence (e.g., the
  // discrepancy surfaced by MCP-021C-EDGE-SMOKE 2026-05-26 where the
  // response reported `positiveObservationCount: 0` despite persistence
  // holding the actual positive rows).
  const { data: persistedRows, error: countError } = await serviceClient
    .from('argument_machine_observation_results')
    .select('raw_key')
    .eq('run_id', runWrite.runId);

  const actualPositiveCount = countError
    ? resultsToWrite.length
    : (persistedRows?.length ?? 0);
  const actualRawKeys = countError
    ? inMemoryRawKeys
    : (persistedRows ?? []).map((r: { raw_key: string }) => r.raw_key);

  if (persistFailureReason !== null) {
    return {
      argumentId,
      runId: runWrite.runId,
      status: 'failed',
      failureReason: persistFailureReason,
      positiveObservationCount: actualPositiveCount,
      rawKeysWithPositive: actualRawKeys,
    };
  }

  // MCP-BOOLEAN-BATCHING-INFRA-001 — by this point runStatus is necessarily
  // 'success': the partial-failure (some batches failed) case returned ALL-OR-
  // NOTHING above (no positive rows persisted). So the only run reaching this
  // tail is fully-successful, and the return is byte-equal to today.
  return {
    argumentId,
    runId: runWrite.runId,
    status: 'success',
    failureReason: null,
    positiveObservationCount: actualPositiveCount,
    rawKeysWithPositive: actualRawKeys,
  };
}
