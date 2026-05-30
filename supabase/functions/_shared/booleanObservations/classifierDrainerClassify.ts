/**
 * ARCH-001 Card 2 — Drainer per-job classify (no persistence).
 *
 * The drainer's classify step. UNLIKE `classifyOneArgumentCore` (the
 * direct-dispatch path, which INSERTs its OWN run row via persistRun and
 * its result rows via persistResults), this helper does NOT persist
 * anything. The queue job IS the run row (parent design §A.3 "extend the
 * run table"); it was already created by `enqueue_classifier_job` and
 * claimed by `claim_classifier_jobs`. The drainer therefore:
 *
 *   1. loadArgumentContext(...)   — reuse the existing context loader.
 *   2. buildBooleanObservationRequestForArgument({ ... timeoutMs: 30000 })
 *      — reuse the existing family-agnostic request builder, scoped to the
 *      job's SINGLE family, with the corrected drainer timeout.
 *   3. adapter(request, { timeoutMs: DRAINER_MCP_REQUEST_TIMEOUT_MS })
 *      — reuse the existing MCP adapter with the >=30s caller-side abort
 *      (design §A.6), NOT the 15s submit-path value.
 *   4. on success: extract the POSITIVE observations into the
 *      finalize_classifier_job `p_observations` jsonb shape
 *      ([{ raw_key, family, confidence, evidence_span }]) — the SAME
 *      extraction logic classifyArgumentCore uses for persistResults, but
 *      returned as data for the atomic finalizer instead of written here.
 *
 * The finalize (result-INSERT + run-row terminal flip) happens ATOMICALLY
 * in `finalize_classifier_job` (Card 2A) — the drainer never writes result
 * rows or flips the run row itself. This is what makes a retried finalize
 * duplicate-safe and the (terminal_state, status) pair consistent.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §7 — server-only; under supabase/functions/.
 *   - cdiscourse-doctrine §10a — every observation emitted is a Machine
 *     Observation; rawKey membership is verified by the definitions
 *     registry (same guard as the direct path).
 *   - cdiscourse-doctrine §1/§6 — no verdict, no truth label; no raw
 *     provider body / prompt / secret is returned (only the validated,
 *     sanitized positive rawKeys + confidence + evidence span).
 *
 * NEVER throws — every failure path returns a typed result the drainer
 * routes through the retry policy.
 */

import type { createServiceClient } from '../supabaseClients.ts';
import type { BooleanObservationAdapterResult } from './booleanObservationMcpAdapterCore.ts';
import { DRAINER_MCP_REQUEST_TIMEOUT_MS } from './booleanObservationMcpAdapterCore.ts';
import {
  loadArgumentContext,
} from './classifyArgumentCore.ts';
import { buildBooleanObservationRequestForArgument } from './booleanObservationRequestBuilder.ts';
import { sanitizeMcpBooleanObservationResponse } from './mcpBooleanObservationSchema.ts';
import type { McpBooleanObservationRequest } from './mcpBooleanObservationSchema.ts';
import { MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY } from './machineObservationDefinitions.ts';
import type { MachineObservationFamily } from './nodeLabelTypes.ts';
import type { MachineObservationRunMode } from './runModeConstants.ts';

/**
 * One positive observation in the shape `finalize_classifier_job`'s
 * `p_observations` jsonb expects: `[{ raw_key, family, confidence,
 * evidence_span }]`. Keys are snake_case to match the SQL
 * `jsonb_to_recordset(... AS obs(raw_key text, family text, confidence
 * text, evidence_span text))` column names EXACTLY.
 */
export interface DrainerFinalizeObservation {
  raw_key: string;
  family: MachineObservationFamily;
  confidence: 'low' | 'medium' | 'high';
  evidence_span: string | null;
}

/**
 * The result of a drainer classify. Discriminated:
 *   - 'classified'      → success; `observations` is the (possibly empty)
 *                          positive-observation array for the finalizer.
 *   - 'argument_missing'→ the argument is gone/soft-deleted; the drainer
 *                          finalizes the job terminal (no point retrying).
 *   - 'unavailable'     → the adapter failed; `adapterResult` carries the
 *                          typed reason the drainer routes through the
 *                          retry policy.
 */
export type DrainerClassifyResult =
  | { kind: 'classified'; observations: DrainerFinalizeObservation[] }
  | { kind: 'argument_missing' }
  | { kind: 'unavailable'; adapterResult: Extract<BooleanObservationAdapterResult, { kind: 'unavailable' }> };

/**
 * Adapter signature the drainer injects. The drainer passes the real
 * `runBooleanObservationMcpAdapter`; tests inject a mock. The OPTIONS arg
 * carries the drainer's >=30s timeout (design §A.6).
 */
export type DrainerClassifyAdapter = (
  request: McpBooleanObservationRequest,
  options?: { timeoutMs?: number },
) => Promise<BooleanObservationAdapterResult>;

/**
 * Classify ONE claimed job's (argument, family) cell WITHOUT persisting.
 * Returns the positive observations for the atomic finalizer, or a typed
 * failure for the retry policy. Never throws.
 *
 * @param argumentId   the claimed job's argument_id.
 * @param family       the claimed job's single family.
 * @param runMode      the claimed job's run_mode ('production' for the queue).
 * @param serviceClient the drainer's service-role client.
 * @param adapter      the MCP adapter (injected for testability).
 */
export async function classifyJobForFinalize(
  argumentId: string,
  family: MachineObservationFamily,
  runMode: MachineObservationRunMode,
  serviceClient: ReturnType<typeof createServiceClient>,
  adapter: DrainerClassifyAdapter,
): Promise<DrainerClassifyResult> {
  // 1. Load context (reuse the direct path's loader). Missing / soft-deleted
  //    argument → terminal (no retry would ever recover it).
  const context = await loadArgumentContext(argumentId, serviceClient);
  if (!context) {
    return { kind: 'argument_missing' };
  }

  // 2. Build the MCP request for this SINGLE family with the drainer's
  //    corrected timeout on the wire. The builder filters the family
  //    against the registry for the mode (so a non-production family would
  //    yield an empty rawKey set — but the enqueue path only ever enqueues
  //    productionEnabledFamilies(), so this is A-G only by construction).
  const mcpRequest = buildBooleanObservationRequestForArgument({
    argumentId,
    parentArgumentId: context.parentArgumentId,
    currentText: context.currentText,
    parentText: context.parentText,
    threadContextExcerpt: context.threadContextExcerpt,
    requestedFamilies: [family],
    mode: runMode,
    timeoutMs: DRAINER_MCP_REQUEST_TIMEOUT_MS,
  });

  // 3. Invoke the adapter with the >=30s caller-side abort (design §A.6) —
  //    NOT the 15s submit-path default.
  const adapterResult = await adapter(mcpRequest, {
    timeoutMs: DRAINER_MCP_REQUEST_TIMEOUT_MS,
  });

  if (adapterResult.kind === 'unavailable') {
    return { kind: 'unavailable', adapterResult };
  }

  // 4. Success — sanitize at the inspect floor (same as the direct path) and
  //    extract the POSITIVE observations into the finalizer jsonb shape.
  //    This loop mirrors classifyArgumentCore's persistResults assembly
  //    (the SAME registry guard + confidence guard + evidence-span passthrough),
  //    but returns the data instead of writing it — finalize_classifier_job
  //    performs the atomic result-INSERT.
  const sanitized = sanitizeMcpBooleanObservationResponse(adapterResult.response, {
    surface: 'inspect',
  });

  const observations: DrainerFinalizeObservation[] = [];
  for (const rawKey of sanitized.checkedRawKeys) {
    if (sanitized.observations[rawKey] !== true) continue;
    const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey];
    if (!def) continue;
    const confidence = sanitized.confidence[rawKey];
    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') continue;
    const evidenceSpan = sanitized.evidenceSpan[rawKey] ?? null;
    observations.push({
      raw_key: rawKey,
      family: def.family,
      confidence,
      evidence_span: evidenceSpan,
    });
  }

  // A succeeded classify with zero positive observations is valid (Source 6
  // renders nothing) — the finalizer writes zero result rows + flips the run
  // row to succeeded, exactly as the direct path allows. (schema_version is
  // carried by the run row, set at enqueue; the finalizer reads it off the
  // locked run row, so the drainer never re-supplies it.)
  return { kind: 'classified', observations };
}
