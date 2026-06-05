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
  const mcpRequest = buildBooleanObservationRequestForArgument({
    argumentId,
    parentArgumentId: context.parentArgumentId,
    currentText: context.currentText,
    parentText: context.parentText,
    threadContextExcerpt: context.threadContextExcerpt,
    requestedFamilies: eligibleFamilies,
    mode,
  });

  // Compute the audit input hash.
  const inputHash = buildBooleanObservationInputHash({
    argumentId,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    runMode: mode,
    families: eligibleFamilies as ReadonlyArray<string>,
  });

  // Invoke the adapter.
  const adapterResult = await adapter(mcpRequest);
  const completedAt = new Date().toISOString();

  // Branch on adapter result.
  if (adapterResult.kind === 'unavailable') {
    const failureReason = unavailableReasonToFailureReason(adapterResult.reason);
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
      validatorPath: adapterResult.detail?.path,
      reason: failureReason,
      family: eligibleFamilies[0],
      runMode: mode,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
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
      failureSubReason: adapterResult.subReason ?? null,
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
      failureSubReason: adapterResult.subReason,
      failureDetail: adapterResult.detail,
    };
  }

  // Success path — sanitize at inspect floor.
  const sanitized: McpBooleanObservationResponse = sanitizeMcpBooleanObservationResponse(
    adapterResult.response,
    { surface: 'inspect' },
  );

  const runWrite = await persistRun({
    debateId: context.debateId,
    argumentId,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    requestedFamilies: eligibleFamilies,
    providerKey: PROVIDER_KEY,
    modelName: DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME,
    inputHash,
    runMode: mode,
    status: 'success',
    failureReason: null,
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

  return {
    argumentId,
    runId: runWrite.runId,
    status: 'success',
    failureReason: null,
    positiveObservationCount: actualPositiveCount,
    rawKeysWithPositive: actualRawKeys,
  };
}
