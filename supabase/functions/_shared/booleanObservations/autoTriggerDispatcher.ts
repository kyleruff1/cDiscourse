/**
 * MCP-021C-EDGE-FAMILIES-B-C-ENABLE — Registry-derived auto-trigger
 * dispatcher for Boolean Observation classification.
 *
 * Wired into `submit-argument`'s post-insert tail as a fire-and-forget
 * promise. Returns a typed outcome array (one per production-enabled
 * family); NEVER throws. The submit-argument response is returned BEFORE
 * this dispatcher's promise settles — argument submission is structurally
 * unblocked by the design (§2.4).
 *
 * Per the Stage 2B operator decision (MCP-021C-EDGE-FAMILIES-B-C-ENABLE
 * design §"STAGE 2B"), this dispatcher derives the production family
 * list from the Edge family registry (`familyRegistry.ts`) rather than
 * hard-coding `parent_relation`. Each production-enabled family is
 * classified in its own iteration, producing its own MCP request, run
 * row, and structured log entry. Per OPS-MCP-AUTO-TRIGGER-PARALLELIZATION
 * the iterations run with BOUNDED PARALLELISM (at most
 * `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` in flight) rather than strictly
 * one-at-a-time, to keep background wall-clock under budget before the
 * next production family is added.
 *
 * Workflow:
 *   1. Read `semantic_referee_runtime_config.enabled` via the existing
 *      SECURITY DEFINER RPC. If `false` → every outcome is `'skipped'`
 *      with reason `'config_disabled'`; no MCP call, no DB row written.
 *      The config check is ONCE per dispatch (not per family) — the kill
 *      switch governs all families uniformly.
 *   2. Resolve the production-enabled family list from the registry via
 *      `productionEnabledFamilies()`. If empty → no iterations run and
 *      an outer `'skipped'` summary is emitted.
 *   3. For each eligible family (dispatched with bounded parallelism —
 *      at most MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES concurrent):
 *      a. Idempotency pre-check (Option A): query
 *         `argument_machine_observation_runs` for an existing canonical
 *         run for this argument + family. If `status='success'` → outcome
 *         `'already_classified'`; no MCP call, no new run row for this
 *         family.
 *      b. Invoke `classifyOneArgumentCore(...)` with a single-element
 *         `[family]` array. The classifier core's existing
 *         `filterFamiliesForMode` keeps the family (it's
 *         productionEnabled), the MCP server resolves a single family
 *         per call, and one run row is persisted per call. Bounded retry
 *         per design §4 (transient classes only).
 *      c. Emit a structured log entry tagged with the family.
 *   4. Return the array of per-family outcomes.
 *
 * Family A behavior preservation: Family A is the first entry in
 * `productionEnabledFamilies()` (registry iteration order is A→J). Under
 * bounded parallelism it occupies `outcomes[0]` (the runner preserves
 * input order) and uses the same per-family idempotency pre-check +
 * bounded retry + log emission as before. Failures in one family
 * iteration do NOT abort other family iterations.
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
 * argument + family" failure mode is benign because Source 6 dedupes by
 * `raw_key` per argument (per the
 * `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
 * production filter and the
 * `MCP-021C-EDGE-SMOKE` 2026-05-26 Phase 4.1 observation: "every
 * `raw_key` is distinct" across multiple production runs of the same
 * argument). Across families the raw_keys are pairwise disjoint per the
 * MCP-021A registry, so cross-family contamination is impossible.
 *
 * Bounded-parallel dispatch choice (OPS-MCP-AUTO-TRIGGER-PARALLELIZATION):
 * the families are dispatched with bounded parallelism — at most
 * `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` (a code constant chosen for
 * SAFETY, not throughput) classifications in flight at once — via the
 * pure `runWithBoundedConcurrency` worker pool. This replaced the earlier
 * strictly-sequential `for-of` loop to keep the background
 * `wall_clock_background` p95 under budget as production families are
 * added, WITHOUT introducing unbounded fan-out (HALT-4). The dispatcher
 * still runs as a background task via EdgeRuntime.waitUntil, so it never
 * blocks the submit-argument response (fire-and-forget). Per-family run
 * rows, log lines, and outcome ORDER (registry order) are byte-equal to
 * the sequential design; only the dispatch TIMING changes.
 */

import { runBooleanObservationMcpAdapter } from './booleanObservationMcpAdapter.ts';
import {
  classifyOneArgumentCore,
  PROVIDER_KEY,
} from './classifyArgumentCore.ts';
import type { PerArgumentSummary } from './classifyArgumentCore.ts';
import { productionEnabledFamilies } from './familyRegistry.ts';
import { MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES } from './autoTriggerConcurrency.ts';
import { runWithBoundedConcurrency } from './boundedConcurrencyRunner.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchema.ts';
import type { MachineObservationFamily } from './nodeLabelTypes.ts';
import type { createServiceClient } from '../supabaseClients.ts';
import { emitAutoTriggerLog } from './autoTriggerLog.ts';

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
 * Outcome of a single per-family dispatcher iteration. Always typed;
 * never throws.
 *
 * The `family` field tags which family this outcome corresponds to —
 * present on every iteration so log consumers + smoke audits can
 * partition per-family.
 */
export interface AutoTriggerOutcome {
  outcome: 'triggered' | 'skipped' | 'already_classified' | 'failed';
  runId: string | null;
  /** The family this outcome describes (registry-derived). */
  family?: MachineObservationFamily;
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
 * Idempotency pre-check (Option A — query-before-create), parameterized
 * by family.
 *
 * Returns the most-recent canonical run row for this argument + family,
 * or `null` when none exists. Defensive: any RPC / SELECT failure
 * returns `null` so the dispatcher proceeds (the worst case is a
 * duplicate run row, which is benign per §3.6 — Source 6 dedupes by
 * `raw_key` per argument, and raw_keys are pairwise disjoint across
 * families).
 *
 * Per-family scoping: a successful Family A run for argument X does NOT
 * make Family B's first run for argument X skip — each family has its
 * own idempotency scope.
 */
async function findExistingRun(
  argumentId: string,
  family: MachineObservationFamily,
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
      .contains('requested_families', [family])
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
 * Per-family iteration body. Runs the idempotency pre-check + bounded
 * retry loop for a single family. Returns a single `AutoTriggerOutcome`.
 *
 * Extracted into its own function so the outer `for-of` loop in
 * `dispatchAutoTriggerForArgument` stays readable and so the
 * per-iteration try/catch isolates failures per family (one family's
 * crash does NOT abort other families' iterations).
 */
async function dispatchOneFamilyIteration(
  argumentId: string,
  family: MachineObservationFamily,
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<AutoTriggerOutcome> {
  const iterationStartMs = Date.now();
  // Single-element family array. The classifier core's
  // filterFamiliesForMode keeps it (it's productionEnabled by definition
  // — we sourced it from productionEnabledFamilies()), and the MCP
  // server resolves a single family per call.
  const singleFamilyArray: ReadonlyArray<MachineObservationFamily> = [family];

  try {
    // ── Idempotency pre-check (Option A, per-family) ─────────────
    const existing = await findExistingRun(argumentId, family, serviceClient);
    if (existing && existing.status === 'success') {
      const outcome: AutoTriggerOutcome = {
        outcome: 'already_classified',
        runId: existing.id,
        family,
      };
      emitAutoTriggerLog({
        timestamp: new Date().toISOString(),
        argument_id: argumentId,
        trigger_source: 'submit_argument_auto_trigger',
        outcome: 'already_classified',
        family,
        run_id: existing.id,
        latency_ms: Date.now() - iterationStartMs,
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
        singleFamilyArray,
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
          family,
          run_id: lastSummary.runId ?? undefined,
          attempt_number: attemptNumber,
          latency_ms: Date.now() - iterationStartMs,
        });
        return {
          outcome: 'triggered',
          runId: lastSummary.runId,
          family,
        };
      }

      // status === 'failed' — check for the argument_not_found skip.
      if (lastSummary.failureReason === 'argument_not_found') {
        emitAutoTriggerLog({
          timestamp: new Date().toISOString(),
          argument_id: argumentId,
          trigger_source: 'submit_argument_auto_trigger',
          outcome: 'skipped',
          family,
          skip_reason: 'argument_not_found',
          attempt_number: attemptNumber,
          latency_ms: Date.now() - iterationStartMs,
        });
        return {
          outcome: 'skipped',
          runId: null,
          family,
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
      family,
      run_id: terminal?.runId ?? undefined,
      failure_reason: terminal?.failureReason ?? 'unexpected_no_summary',
      attempt_number: attemptNumber > MAX_ATTEMPTS ? MAX_ATTEMPTS : attemptNumber,
      latency_ms: Date.now() - iterationStartMs,
    });
    return {
      outcome: 'failed',
      runId: terminal?.runId ?? null,
      family,
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
      family,
      failure_reason: 'unexpected_error',
      latency_ms: Date.now() - iterationStartMs,
    });
    return {
      outcome: 'failed',
      runId: null,
      family,
      failureReason: 'unexpected_error',
    };
  }
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
 * Returns an array of per-family outcomes; NEVER throws — every internal
 * failure is wrapped in try/catch and surfaced via per-family
 * `outcome: 'failed'` branches.
 */
export async function dispatchAutoTriggerForArgument(
  argumentId: string,
  _debateId: string,
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<AutoTriggerOutcome[]> {
  const startMs = Date.now();
  try {
    // ── Guard 1: runtime config enabled flag (once per dispatch) ─
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
      return [outcome];
    }

    // ── Guard 2: family registry enablement (registry-derived) ───
    // No hard-coded family literal here — the production family list is
    // the runtime registry's productionEnabledFamilies() output. Adding
    // or removing a production family is a 1-boolean flip in
    // familyRegistry.ts; no edit to this file is needed.
    const eligibleFamilies = productionEnabledFamilies();
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
      return [outcome];
    }

    // ── Per-family bounded-parallel dispatch ─────────────────────
    // OPS-MCP-AUTO-TRIGGER-PARALLELIZATION: the families are dispatched
    // with BOUNDED PARALLELISM (at most MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES
    // in flight at once) via the pure worker-pool runner — NOT an
    // unbounded Promise.all over the family list (HALT-4). The runner is
    // allSettled-style: a per-family rejection NEVER aborts a sibling
    // (HALT-6); each task's settle state is collected. `dispatchOneFamilyIteration`
    // already never throws (it returns a typed `'failed'` outcome), so in
    // practice every settled result is `'fulfilled'`; the rejected branch
    // below is defense-in-depth. Results are returned in INPUT
    // (registry) order, so Family A remains outcomes[0] and the
    // per-family run rows / log lines are byte-equal to before — only the
    // dispatch TIMING changes. The per-family idempotency pre-check +
    // retry backoff + try/catch inside dispatchOneFamilyIteration are
    // unchanged; each family is processed exactly once (the index-pull in
    // the runner guarantees no index is processed twice).
    const settled = await runWithBoundedConcurrency(
      eligibleFamilies,
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      (family) => dispatchOneFamilyIteration(argumentId, family, serviceClient),
    );
    const outcomes: AutoTriggerOutcome[] = settled.map((result, i) =>
      result.status === 'fulfilled' && result.value
        ? result.value
        : {
            outcome: 'failed',
            runId: null,
            family: eligibleFamilies[i],
            failureReason: 'unexpected_error',
          },
    );
    return outcomes;
  } catch {
    // Defensive outer catch: any uncaught condition surfaces as a single
    // failed outcome (no per-family tag because we don't know which
    // family we were on when this fired).
    emitAutoTriggerLog({
      timestamp: new Date().toISOString(),
      argument_id: argumentId,
      trigger_source: 'submit_argument_auto_trigger',
      outcome: 'failed',
      failure_reason: 'unexpected_error',
      latency_ms: Date.now() - startMs,
    });
    return [
      {
        outcome: 'failed',
        runId: null,
        failureReason: 'unexpected_error',
      },
    ];
  }
}
