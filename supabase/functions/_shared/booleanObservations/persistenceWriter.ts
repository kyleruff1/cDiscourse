/**
 * MCP-021C-EDGE — Service-role persistence writer for Machine Observation
 * runs and results.
 *
 * Service-role-only. Imports `createServiceClient` from
 * `../supabaseClients.ts` — the existing factory (Edge-Function-only).
 * NEVER returns the service-role client to the caller; NEVER echoes the
 * service-role key. Errors are sanitized strings.
 *
 * Per design §6:
 *   - persistRun: INSERT into argument_machine_observation_runs (one row
 *     per per-argument classifier invocation). Carries run_mode.
 *   - persistResults: INSERT batch into argument_machine_observation_results
 *     (one row per POSITIVE observation). UNIQUE (run_id, raw_key)
 *     constraint prevents duplicates within a single run.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §6: service-role is server-only. The caller
 *     (Edge Function handler) imports this writer; the writer imports
 *     the factory.
 *   - cdiscourse-doctrine §8: append-only audit ledger. The writer
 *     never UPDATEs or DELETEs; rows are immutable once written.
 *   - cdiscourse-doctrine §10a: rawKey membership is verified by the
 *     MCP-021A definitions registry BEFORE the writer is called (the
 *     handler runs the sanitizer first). The writer is the defensive
 *     last line, not the primary guard.
 */

import { createServiceClient } from '../supabaseClients.ts';
import type {
  MachineObservationFamily,
} from './nodeLabelTypes.ts';
import type { MachineObservationRunMode } from './runModeConstants.ts';

export interface PersistRunInput {
  debateId: string;
  argumentId: string;
  schemaVersion: string;
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
  providerKey: string;
  modelName: string;
  inputHash: string;
  runMode: MachineObservationRunMode;
  status: 'success' | 'failed' | 'fallback';
  failureReason: string | null;
  /**
   * OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 — ADDITIVE,
   * optional direct-dispatch failed-branch diagnostics. Omitted on the
   * success path (and by any caller that does not set them) → the
   * conditional spread below leaves the columns absent from the INSERT
   * payload, so they stay NULL and the serialized INSERT is byte-equal to
   * today. The leak-safe `failureDetail` object is produced by
   * `buildRunRowFailureDetail` at the call site; the writer adds no
   * sanitization of its own (sanitization lives in the builder, exactly as
   * on the drainer path).
   */
  failureSubReason?: string | null; // → failure_sub_reason (text)
  failureDetail?: Record<string, unknown> | null; // → failure_detail (jsonb)
  /** ISO-8601 timestamp. */
  startedAt: string;
  /** ISO-8601 timestamp; nullable while run is in-flight. */
  completedAt: string | null;
}

export interface PersistResultInput {
  runId: string;
  debateId: string;
  argumentId: string;
  schemaVersion: string;
  rawKey: string;
  family: MachineObservationFamily;
  confidence: 'low' | 'medium' | 'high';
  /** Sanitized evidence span; <= 240 chars. Null when MCP omitted. */
  evidenceSpan: string | null;
}

export type PersistRunResult =
  | { ok: true; runId: string }
  | { ok: false; error: string };

export type PersistResultsResult =
  | { ok: true; written: number }
  | { ok: false; error: string };

/**
 * INSERT a run row. Returns the new runId on success; sanitized error
 * string on failure. NEVER returns the service-role client or any
 * privileged detail.
 *
 * Service-role bypasses RLS. The caller (Edge Function handler) has
 * already verified admin auth via `requireAdmin(req)` at the boundary.
 */
export async function persistRun(input: PersistRunInput): Promise<PersistRunResult> {
  const serviceClient = createServiceClient();

  const insertPayload = {
    debate_id: input.debateId,
    argument_id: input.argumentId,
    schema_version: input.schemaVersion,
    requested_families: [...input.requestedFamilies],
    provider_key: input.providerKey,
    model_name: input.modelName,
    input_hash: input.inputHash,
    run_mode: input.runMode,
    status: input.status,
    failure_reason: input.failureReason,
    // OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 — write the two
    // diagnostic columns ONLY WHEN the caller supplies them, so callers that
    // omit them (the success path; the queue path) produce a BYTE-EQUAL
    // INSERT payload to today and the columns stay at their NULL default.
    ...(input.failureSubReason !== undefined
      ? { failure_sub_reason: input.failureSubReason }
      : {}),
    ...(input.failureDetail !== undefined
      ? { failure_detail: input.failureDetail }
      : {}),
    started_at: input.startedAt,
    completed_at: input.completedAt,
  };

  const { data, error } = await serviceClient
    .from('argument_machine_observation_runs')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    // Sanitize the error — never echo service-role detail or table secrets.
    // The error code/class is safe; the message MAY contain table names
    // (which are public via the migration), so it is included.
    return {
      ok: false,
      error: `persistRun_failed:${typeof error.code === 'string' ? error.code : 'unknown'}`,
    };
  }

  if (!data || typeof data.id !== 'string') {
    return { ok: false, error: 'persistRun_failed:no_id' };
  }

  return { ok: true, runId: data.id };
}

/**
 * INSERT a batch of result rows. Returns the count written; sanitized
 * error string on failure.
 *
 * One INSERT statement carries all rows. If the UNIQUE (run_id, raw_key)
 * constraint fires (a defensive duplicate slipped through the sanitizer),
 * the whole INSERT fails — the writer reports the sanitized failure and
 * the caller's run row already records 'success' with this run as the
 * audit trail.
 */
export async function persistResults(
  results: ReadonlyArray<PersistResultInput>,
): Promise<PersistResultsResult> {
  if (!Array.isArray(results) || results.length === 0) {
    return { ok: true, written: 0 };
  }

  const serviceClient = createServiceClient();

  const insertPayload = results.map((r) => ({
    run_id: r.runId,
    debate_id: r.debateId,
    argument_id: r.argumentId,
    schema_version: r.schemaVersion,
    raw_key: r.rawKey,
    family: r.family,
    confidence: r.confidence,
    evidence_span: r.evidenceSpan,
  }));

  const { error } = await serviceClient
    .from('argument_machine_observation_results')
    .insert(insertPayload);

  if (error) {
    return {
      ok: false,
      error: `persistResults_failed:${typeof error.code === 'string' ? error.code : 'unknown'}`,
    };
  }

  return { ok: true, written: results.length };
}
