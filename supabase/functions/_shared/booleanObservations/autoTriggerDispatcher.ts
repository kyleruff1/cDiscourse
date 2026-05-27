/**
 * MCP-021C-AUTO-TRIGGER-FAMILY-A — Auto-trigger dispatcher for Family A
 * Boolean Observation classification.
 *
 * Wired into `submit-argument`'s post-insert tail as a fire-and-forget
 * promise. Returns a typed outcome; NEVER throws. The submit-argument
 * response is returned BEFORE this dispatcher's promise settles —
 * argument submission is structurally unblocked by the design (§2.4).
 *
 * Workflow:
 *   1. Read `semantic_referee_runtime_config.enabled` via the existing
 *      SECURITY DEFINER RPC. If `false` → outcome `'skipped'` with
 *      reason `'config_disabled'`; no MCP call, no DB row written.
 *   2. Filter requested families for production mode via
 *      `filterFamiliesForMode(['parent_relation'], 'production')`. If
 *      empty → outcome `'skipped'` with reason `'family_not_enabled'`.
 *   3. Idempotency pre-check (Option A): query
 *      `argument_machine_observation_runs` for an existing canonical
 *      run for this argument. If `status='success'` → outcome
 *      `'already_classified'`; no MCP call, no new run row.
 *   4. Invoke `classifyOneArgumentCore(...)` with the shared service
 *      client. Bounded retry per design §4 (transient classes only).
 *   5. Emit a structured log entry per intent brief Decision 9.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §7 — server-only file; never imported by
 *     `src/` or `app/`. The classifier core handles the MCP boundary.
 *   - cdiscourse-doctrine §10a — every persisted row is a Machine
 *     Observation (kind preserved by the classifier core).
 *   - cdiscourse-doctrine §1 — outcomes are structural; no
 *     verdict-style labels.
 *   - cdiscourse-doctrine §3 — no popularity / engagement input.
 *
 * Auth posture (per design §8): the dispatcher receives the service-role
 * client by function argument from `submit-argument`'s already-
 * authenticated isolate. It NEVER creates a new service-role client.
 * It NEVER does its own admin check — the submit-argument JWT-verified
 * auth chain is the gate. The classifier Edge Function's `requireAdmin`
 * gate is UNCHANGED for its HTTP endpoint.
 *
 * Race-tolerance documentation: Option A's "two run rows for the same
 * argument" failure mode is benign because Source 6 dedupes by `raw_key`
 * per argument (per the
 * `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
 * production filter and the
 * `MCP-021C-EDGE-SMOKE` 2026-05-26 Phase 4.1 observation: "every
 * `raw_key` is distinct" across multiple production runs of the same
 * argument).
 */

import { runBooleanObservationMcpAdapter } from './booleanObservationMcpAdapter.ts';
import {
  classifyOneArgumentCore,
  PROVIDER_KEY,
} from './classifyArgumentCore.ts';
import type { PerArgumentSummary } from './classifyArgumentCore.ts';
import { filterFamiliesForMode } from './familyRegistry.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchema.ts';
import type { MachineObservationFamily } from './nodeLabelTypes.ts';
import type { createServiceClient } from '../supabaseClients.ts';
import { emitAutoTriggerLog } from './autoTriggerLog.ts';

/** The dispatcher always invokes the classifier with this family list. */
const AUTO_TRIGGER_FAMILIES: ReadonlyArray<MachineObservationFamily> = Object.freeze([
  'parent_relation',
]);

/** Production-mode literal. The dispatcher never runs admin_validation. */
const AUTO_TRIGGER_MODE = 'production' as const;

/** Maximum total attempts (including the first call). Per design §4.3. */
const MAX_ATTEMPTS = 2;

/**
 * Failure-reason strings that are RETRYABLE per design §4.1. Matches
 * the persisted `failure_reason` strings written by
 * `classifyOneArgumentCore`'s adapter-unavailable branch.
 */
const RETRYABLE_FAILURE_REASONS: ReadonlySet<string> = new Set([
  'mcp_network_error',
  'mcp_api_error',
  'mcp_rate_limited',
]);

/**
 * Backoff schedule in milliseconds between attempts. Index `i` is the
 * wait BEFORE attempt `i+1`. Design §4.3: 2s then 8s.
 */
const RETRY_BACKOFF_MS: ReadonlyArray<number> = Object.freeze([2_000, 8_000]);

/**
 * Outcome of the dispatcher. Always typed; never throws.
 */
export interface AutoTriggerOutcome {
  outcome: 'triggered' | 'skipped' | 'already_classified' | 'failed';
  runId: string | null;
  skipReason?: 'config_disabled' | 'family_not_enabled' | 'argument_not_found';
  failureReason?: string;
}

/**
 * Read the `enabled` flag from the singleton runtime-config row via the
 * existing SECURITY DEFINER RPC. Returns `null` when the read fails (RPC
 * error, empty result, unexpected shape) — caller treats `null` as
 * "config unavailable" and proceeds (DEFENSIVE: a corrupt config never
 * silently stops auto-trigger; only an explicit `enabled: false` does).
 *
 * Per design §5.3: the dispatcher respects ONLY the `enabled` boolean,
 * NOT `provider_mode`. The classifier path is MCP-mode-only.
 */
async function readEnabledFlag(
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<boolean | null> {
  try {
    const { data, error } = await serviceClient.rpc('get_semantic_referee_runtime_config');
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return null;
    const row = rows[0] as { enabled?: unknown };
    if (typeof row.enabled !== 'boolean') return null;
    return row.enabled;
  } catch {
    return null;
  }
}

/**
 * Idempotency pre-check (Option A — query-before-create).
 *
 * Returns the most-recent canonical run row, or `null` when none exists.
 * Defensive: any RPC / SELECT failure returns `null` so the dispatcher
 * proceeds (the worst case is a duplicate run row, which is benign per
 * §3.6 — Source 6 dedupes by `raw_key`).
 */
async function findExistingRun(
  argumentId: string,
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<{ id: string; status: string; run_mode: string } | null> {
  try {
    const { data, error } = await serviceClient
      .from('argument_machine_observation_runs')
      .select('id, status, run_mode')
      .eq('argument_id', argumentId)
      .eq('schema_version', MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION)
      .eq('run_mode', 'production')
      .eq('provider_key', PROVIDER_KEY)
      .contains('requested_families', ['parent_relation'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as { id: string; status: string; run_mode: string };
  } catch {
    return null;
  }
}

/**
 * Determine whether a failed summary is retryable per design §4.1.
 */
function isSummaryRetryable(summary: PerArgumentSummary): boolean {
  if (summary.status !== 'failed') return false;
  if (!summary.failureReason) return false;
  return RETRYABLE_FAILURE_REASONS.has(summary.failureReason);
}

/**
 * Sleep helper. Tests can stub `setTimeout` via Jest fake timers if
 * they want to assert the backoff schedule without waiting.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The fire-and-forget dispatcher entry point. Called from
 * `submit-argument`'s post-insert tail (after the QOL-040 notification
 * block, before `return created(...)`). The returned promise is
 * intentionally NOT awaited at the call site.
 *
 * Per design §2.3 the call site uses `EdgeRuntime.waitUntil(...)` to
 * keep the isolate alive for the background promise.
 *
 * Returns the outcome; NEVER throws — every internal failure is wrapped
 * in try/catch and surfaced via the `outcome: 'failed'` branch.
 */
export async function dispatchAutoTriggerForArgument(
  argumentId: string,
  _debateId: string,
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<AutoTriggerOutcome> {
  const startMs = Date.now();
  try {
    // ── Guard 1: runtime config enabled flag ─────────────────────
    const enabled = await readEnabledFlag(serviceClient);
    if (enabled === false) {
      const outcome: AutoTriggerOutcome = {
        outcome: 'skipped',
        runId: null,
        skipReason: 'config_disabled',
      };
      emitAutoTriggerLog({
        timestamp: new Date().toISOString(),
        argument_id: argumentId,
        trigger_source: 'submit_argument_auto_trigger',
        outcome: 'skipped',
        skip_reason: 'config_disabled',
        latency_ms: Date.now() - startMs,
      });
      return outcome;
    }

    // ── Guard 2: family registry enablement ──────────────────────
    const eligibleFamilies = filterFamiliesForMode(AUTO_TRIGGER_FAMILIES, AUTO_TRIGGER_MODE);
    if (eligibleFamilies.length === 0) {
      const outcome: AutoTriggerOutcome = {
        outcome: 'skipped',
        runId: null,
        skipReason: 'family_not_enabled',
      };
      emitAutoTriggerLog({
        timestamp: new Date().toISOString(),
        argument_id: argumentId,
        trigger_source: 'submit_argument_auto_trigger',
        outcome: 'skipped',
        skip_reason: 'family_not_enabled',
        latency_ms: Date.now() - startMs,
      });
      return outcome;
    }

    // ── Guard 3: idempotency pre-check (Option A) ────────────────
    const existing = await findExistingRun(argumentId, serviceClient);
    if (existing && existing.status === 'success') {
      const outcome: AutoTriggerOutcome = {
        outcome: 'already_classified',
        runId: existing.id,
      };
      emitAutoTriggerLog({
        timestamp: new Date().toISOString(),
        argument_id: argumentId,
        trigger_source: 'submit_argument_auto_trigger',
        outcome: 'already_classified',
        run_id: existing.id,
        latency_ms: Date.now() - startMs,
      });
      return outcome;
    }
    // If `existing` is failed (or null), proceed.
    // Rationale: a failed run does not count as classified; the retry
    // loop below will attempt fresh on this path.

    // ── Bounded retry loop (design §4) ───────────────────────────
    let lastSummary: PerArgumentSummary | null = null;
    let attemptNumber = 0;
    for (attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber += 1) {
      lastSummary = await classifyOneArgumentCore(
        argumentId,
        AUTO_TRIGGER_FAMILIES,
        AUTO_TRIGGER_MODE,
        serviceClient,
        runBooleanObservationMcpAdapter,
      );

      if (lastSummary.status === 'success') {
        emitAutoTriggerLog({
          timestamp: new Date().toISOString(),
          argument_id: argumentId,
          trigger_source: 'submit_argument_auto_trigger',
          outcome: 'triggered',
          run_id: lastSummary.runId ?? undefined,
          attempt_number: attemptNumber,
          latency_ms: Date.now() - startMs,
        });
        return {
          outcome: 'triggered',
          runId: lastSummary.runId,
        };
      }

      // status === 'failed' — check for the argument_not_found skip.
      if (lastSummary.failureReason === 'argument_not_found') {
        emitAutoTriggerLog({
          timestamp: new Date().toISOString(),
          argument_id: argumentId,
          trigger_source: 'submit_argument_auto_trigger',
          outcome: 'skipped',
          skip_reason: 'argument_not_found',
          attempt_number: attemptNumber,
          latency_ms: Date.now() - startMs,
        });
        return {
          outcome: 'skipped',
          runId: null,
          skipReason: 'argument_not_found',
        };
      }

      // Should we retry?
      if (!isSummaryRetryable(lastSummary)) break;
      if (attemptNumber >= MAX_ATTEMPTS) break;

      // Bounded backoff before next attempt.
      const waitMs = RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      await sleep(waitMs);
    }

    // After the loop, lastSummary is the terminal attempt's summary.
    const terminal = lastSummary;
    emitAutoTriggerLog({
      timestamp: new Date().toISOString(),
      argument_id: argumentId,
      trigger_source: 'submit_argument_auto_trigger',
      outcome: 'failed',
      run_id: terminal?.runId ?? undefined,
      failure_reason: terminal?.failureReason ?? 'unexpected_no_summary',
      attempt_number: attemptNumber > MAX_ATTEMPTS ? MAX_ATTEMPTS : attemptNumber,
      latency_ms: Date.now() - startMs,
    });
    return {
      outcome: 'failed',
      runId: terminal?.runId ?? null,
      failureReason: terminal?.failureReason ?? 'unexpected_no_summary',
    };
  } catch {
    // Defensive: any uncaught condition surfaces as a clean failed outcome.
    // No raw error body, no message — the audit row (if any) is the trail.
    emitAutoTriggerLog({
      timestamp: new Date().toISOString(),
      argument_id: argumentId,
      trigger_source: 'submit_argument_auto_trigger',
      outcome: 'failed',
      failure_reason: 'unexpected_error',
      latency_ms: Date.now() - startMs,
    });
    return {
      outcome: 'failed',
      runId: null,
      failureReason: 'unexpected_error',
    };
  }
}
