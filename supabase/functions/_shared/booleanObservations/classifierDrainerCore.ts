/**
 * ARCH-001 Card 2 — Drainer orchestration core.
 *
 * The single-flight, bounded-batch drain loop (parent design §A.4/§A.5/§A.9).
 * Deno-light: it touches the Supabase service-role client + the injected MCP
 * adapter + a clock, all passed in, so the loop logic is unit-testable via
 * the Jest bridge with stubs. The `Deno.serve` wrapper + secret validation
 * + real adapter/clock live in `supabase/functions/classifier-drainer/index.ts`.
 *
 * Flow (one invocation):
 *   1. acquire_drain_lease(owner, ttl) — single-flight. NULL / not-self →
 *      write a 'skipped_single_flight' audit row and EXIT (no claim, no
 *      provider call). A live lease held by another drainer is respected.
 *   2. reclaim_stale_leases() FIRST — recover jobs whose drainer died
 *      mid-batch (back to retry_scheduled, or dead_letter at the cap).
 *   3. Bounded loop until the budget trips:
 *        claim_classifier_jobs(batchSize, owner, lease) → for each claimed
 *        cell, classify (>=30s timeout) with bounded provider concurrency C,
 *        then:
 *          - success           → finalize_classifier_job(runId, owner,
 *                                  'succeeded','success', null,null,null, obs)
 *          - retryable failure  → run-row-only UPDATE to state='retry_scheduled',
 *                                  available_at=now()+backoff (NOT finalize,
 *                                  NOT an in-request wait)
 *          - terminal failure   → finalize_classifier_job(runId, owner,
 *                                  'failed_terminal'|'dead_letter','failed',
 *                                  reason, sub_reason, dl_reason, null)
 *        The loop stops when: a claim returns 0 rows (queue drained for now),
 *        OR the elapsed wall-clock reaches T, OR the per-invocation processed
 *        cap is reached. It NEVER drains to empty in one invocation by force.
 *   4. release_drain_lease(owner) in a `finally`.
 *   5. Write a per-drain audit row (no secret).
 *
 * LOCKED carry-forward honored:
 *   #1 finalize_classifier_job returning FALSE = lost lease (reclaimed /
 *      expired / wrong owner). The drainer does NOT record success, does NOT
 *      retry-as-succeeded, does NOT double-count — it logs (jobs_lost++) and
 *      moves on; the job is correctly re-claimed + re-run by a later drain.
 *   #2 Per-job work is sized well within the 120s job lease (30s call cap).
 *   #6 The (terminal_state, status) pairs passed to finalize are CONSISTENT:
 *      'succeeded'↔'success'; 'failed_terminal'/'dead_letter'↔'failed'.
 *
 * Doctrine: pure transport scheduling — no verdict, no truth value, no
 * popularity/heat input (claim order is arrival FIFO, set in the Card-1
 * claim SQL). No secret / raw body / prompt is logged or returned anywhere
 * here (cdiscourse-doctrine §1/§3/§6).
 *
 * NEVER throws to the caller — the loop body wraps each job; the outer body
 * wraps acquire/reclaim/release; the audit write is best-effort.
 */

import type { createServiceClient } from '../supabaseClients.ts';
import type { DrainerClassifyAdapter } from './classifierDrainerClassify.ts';
import { classifyJobForFinalize } from './classifierDrainerClassify.ts';
import {
  classifyDrainerFailure,
} from './classifierDrainerRetryPolicy.ts';
import { runWithBoundedConcurrency } from './boundedConcurrencyRunner.ts';
import type { MachineObservationFamily } from './nodeLabelTypes.ts';
import type { MachineObservationRunMode } from './runModeConstants.ts';
import {
  buildRunRowFailureDetail,
  type RunRowFailureDetail,
} from './classifierRunRowFailureDetail.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchema.ts';

// ── LOCKED operating parameters (design §A.5 / §A.7 / operator-confirmed) ──

/** Drainer global provider concurrency C (Tier-1 Anthropic; C <= MCP cap=5). */
export const DRAINER_PROVIDER_CONCURRENCY = 3;

/** Drain wall-clock budget T (ms). 90s < 150s Edge ceiling with margin. */
export const DRAINER_WALL_CLOCK_BUDGET_MS = 90_000;

/** Per-claim batch size (rows pulled per claim_classifier_jobs call). */
export const DRAINER_CLAIM_BATCH_SIZE = 20;

/**
 * Hard cap on jobs processed in ONE invocation (defence-in-depth bound so a
 * pathological queue cannot keep the loop claiming past the budget). The
 * wall-clock budget T is the primary stop; this caps the worst case.
 */
export const DRAINER_MAX_JOBS_PER_INVOCATION = 60;

/** Per-job lease (Card-1 claim sets lease_expires_at = now()+this). 120s. */
export const DRAINER_JOB_LEASE_SECONDS = 120;

/**
 * Drain-level single-flight lease TTL L (seconds). MUST satisfy
 * L >= T(90) + max_call_timeout(30) + margin(10) = 130 (design §A.4 binding
 * rule), so a drainer's lease cannot expire while it still has an open
 * provider call → steady-state in-flight provider calls <= C.
 */
export const DRAINER_LEASE_TTL_SECONDS = 130;

/** The outcome value an audit row carries (mirrors the Card-1 CHECK). */
export type DrainAuditOutcome = 'completed' | 'partial' | 'failed' | 'skipped_single_flight';

/** Injected clock so tests can drive the wall-clock budget deterministically. */
export interface DrainerClock {
  /** Monotonic-ish millisecond timestamp (Date.now() in production). */
  nowMs(): number;
}

/** The drainer's dependency bundle (all injected for testability). */
export interface DrainerDeps {
  serviceClient: ReturnType<typeof createServiceClient>;
  adapter: DrainerClassifyAdapter;
  clock: DrainerClock;
  /** Opaque drainer invocation id (no secret). */
  owner: string;
}

/** A claimed job row as returned by claim_classifier_jobs. */
interface ClaimedJob {
  id: string;
  argument_id: string;
  family: MachineObservationFamily;
  run_mode: MachineObservationRunMode;
}

/** The per-invocation drain summary (returned + written to the audit row). */
export interface DrainSummary {
  outcome: DrainAuditOutcome;
  owner: string;
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  jobsRetried: number;
  jobsDeadLettered: number;
  /** Carry-forward #1: finalize returned FALSE (lost lease) — not double-counted. */
  jobsLostLease: number;
  staleLeasesRecovered: number;
}

/**
 * Run ONE drain invocation. Single-flight; bounded by C, T, and the
 * per-invocation cap; releases the lease in a finally; writes one audit row.
 * Never throws.
 */
export async function runClassifierDrain(deps: DrainerDeps): Promise<DrainSummary> {
  // `adapter` is consumed by processOneJob(job, deps) below; only these
  // three are used directly in the orchestration body.
  const { serviceClient, clock, owner } = deps;
  const startedAtMs = clock.nowMs();

  const summary: DrainSummary = {
    outcome: 'completed',
    owner,
    jobsProcessed: 0,
    jobsSucceeded: 0,
    jobsFailed: 0,
    jobsRetried: 0,
    jobsDeadLettered: 0,
    jobsLostLease: 0,
    staleLeasesRecovered: 0,
  };

  // ── 1. Single-flight: acquire the drain lease ──────────────────
  let acquiredOwner: string | null = null;
  try {
    const { data, error } = await serviceClient.rpc('acquire_drain_lease', {
      owner,
      ttl: `${DRAINER_LEASE_TTL_SECONDS} seconds`,
    });
    if (!error) {
      // The RPC RETURNS the owner now holding the lease (text), or NULL when
      // a live lease is held by someone else.
      acquiredOwner = typeof data === 'string' ? data : null;
    }
  } catch {
    acquiredOwner = null;
  }

  if (acquiredOwner !== owner) {
    // A live lease is held by another drainer (or the acquire failed).
    // Single-flight: do NOT claim, do NOT make any provider call. Record the
    // skip and exit. (NOT releasing — we never held it.)
    summary.outcome = 'skipped_single_flight';
    await writeDrainAudit(serviceClient, summary, startedAtMs, clock);
    return summary;
  }

  try {
    // ── 2. Reclaim stale leases FIRST (recover dead-drainer jobs) ──
    try {
      const { data, error } = await serviceClient.rpc('reclaim_stale_leases');
      if (!error && typeof data === 'number') {
        summary.staleLeasesRecovered = data;
      }
    } catch {
      // best-effort; a reclaim failure must not abort the drain.
    }

    // ── 3. Bounded-batch loop ──────────────────────────────────
    // Stop when: a claim returns 0 rows, OR elapsed >= T, OR the
    // per-invocation processed cap is hit. NEVER drains to empty by force.
    let budgetTripped = false;
    while (
      summary.jobsProcessed < DRAINER_MAX_JOBS_PER_INVOCATION &&
      clock.nowMs() - startedAtMs < DRAINER_WALL_CLOCK_BUDGET_MS
    ) {
      const claimed = await claimJobs(serviceClient, owner);
      if (claimed.length === 0) break; // queue drained for now.

      // Process the claimed batch with BOUNDED provider concurrency C. The
      // worker pool is allSettled-style: one job's failure never aborts a
      // sibling. processOneJob never throws (it returns a typed disposition).
      const settled = await runWithBoundedConcurrency(
        claimed,
        DRAINER_PROVIDER_CONCURRENCY,
        (job) => processOneJob(job, deps),
      );

      for (const result of settled) {
        summary.jobsProcessed += 1;
        const disposition = result.status === 'fulfilled' ? result.value : 'failed_terminal';
        switch (disposition) {
          case 'succeeded':
            summary.jobsSucceeded += 1;
            break;
          case 'retry':
            summary.jobsRetried += 1;
            break;
          case 'dead_letter':
            summary.jobsDeadLettered += 1;
            summary.jobsFailed += 1;
            break;
          case 'lost_lease':
            // Carry-forward #1: finalize returned FALSE. Do NOT count as
            // success or retry; the job re-runs on a later drain.
            summary.jobsLostLease += 1;
            break;
          case 'failed_terminal':
          default:
            summary.jobsFailed += 1;
            break;
        }
      }

      // If the budget tripped DURING this batch, stop claiming new batches.
      if (clock.nowMs() - startedAtMs >= DRAINER_WALL_CLOCK_BUDGET_MS) {
        budgetTripped = true;
        break;
      }
    }

    if (budgetTripped || summary.jobsProcessed >= DRAINER_MAX_JOBS_PER_INVOCATION) {
      // The drain stopped on its budget, not because the queue emptied —
      // 'partial' tells monitoring the next tick should continue.
      summary.outcome = 'partial';
    } else {
      summary.outcome = 'completed';
    }
  } finally {
    // ── 4. Release the lease (best-effort; the TTL is the backstop) ──
    try {
      await serviceClient.rpc('release_drain_lease', { owner });
    } catch {
      // The lease self-expires after the TTL; a missed release is benign.
    }
  }

  // ── 5. Per-drain audit row (no secret) ─────────────────────────
  await writeDrainAudit(serviceClient, summary, startedAtMs, clock);
  return summary;
}

/** The disposition of processing one claimed job. */
type ProcessJobDisposition =
  | 'succeeded'
  | 'retry'
  | 'failed_terminal'
  | 'dead_letter'
  | 'lost_lease';

/**
 * Process ONE claimed job: classify, then finalize / retry-schedule. Never
 * throws — any unexpected condition surfaces as a terminal failure (which
 * is a finalize, so the cell does not loop). Carry-forward #1 + #6 honored.
 */
async function processOneJob(
  job: ClaimedJob,
  deps: DrainerDeps,
): Promise<ProcessJobDisposition> {
  const { serviceClient, adapter, owner } = deps;
  try {
    const classify = await classifyJobForFinalize(
      job.argument_id,
      job.family,
      job.run_mode,
      serviceClient,
      adapter,
    );

    // ── Success ──────────────────────────────────────────────────
    if (classify.kind === 'classified') {
      const finalized = await finalizeJob(serviceClient, {
        runId: job.id,
        owner,
        terminalState: 'succeeded',
        status: 'success',
        failureReason: null,
        failureSubReason: null,
        deadLetterReason: null,
        observations: classify.observations,
        // OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING: the success-only audit list
        // (rawKey NAMES, or NULL on zero drops). Written to
        // dropped_unclean_span_keys on the SUCCESS branch of the finalizer.
        droppedUncleanSpanKeys: classify.keysDroppedForUncleanSpan,
      });
      // Carry-forward #1: a FALSE return = lost lease → NOT a success.
      return finalized ? 'succeeded' : 'lost_lease';
    }

    // ── Argument gone / soft-deleted → terminal (never recoverable) ─
    if (classify.kind === 'argument_missing') {
      const finalized = await finalizeJob(serviceClient, {
        runId: job.id,
        owner,
        terminalState: 'failed_terminal',
        status: 'failed',
        failureReason: 'argument_not_found',
        failureSubReason: null,
        deadLetterReason: null,
        observations: null,
        // No adapter result exists on this branch; minimal self-describing
        // detail (no validator_path / attempt_count). Leak-safe by construction.
        failureDetail: buildRunRowFailureDetail({
          reason: 'argument_not_found',
          family: job.family,
          correlationId: job.id,
          runMode: job.run_mode,
        }),
      });
      return finalized ? 'failed_terminal' : 'lost_lease';
    }

    // ── Adapter unavailable → route through the retry policy ───────
    // The job's attempt_count was bumped by claim_classifier_jobs; we read
    // it back so the retry/terminal/dead_letter decision honors the cap.
    const attemptCount = await readAttemptCount(serviceClient, job.id);
    const decision = classifyDrainerFailure(
      classify.adapterResult.reason,
      attemptCount,
      classify.adapterResult.subReason,
    );

    // Leak-safe diagnostic detail for this failure, built ONCE from the
    // allow-list helper and reused by both the retry and terminal branches.
    // `detail?.path` is the structural validator path (already allow-listed
    // upstream by the adapter); the helper re-scrubs + caps. No body / prompt /
    // evidenceSpan value / payload has an entry point (structural deny-list).
    const failureDetail = buildRunRowFailureDetail({
      validatorPath: classify.adapterResult.detail?.path,
      reason: decision.failureReason,
      family: job.family,
      correlationId: job.id,
      attemptCount,
      runMode: job.run_mode,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    });

    if (decision.disposition === 'retry') {
      // Run-row-ONLY UPDATE to retry_scheduled (NOT a finalize, NOT an
      // in-request wait): set available_at = now()+backoff, record the typed
      // failure fields, and CLEAR the lease so the next claim can pick it up.
      // Guarded on lease_owner = owner AND state = 'leased' so a reclaimed /
      // wrong-owner row is a no-op (carry-forward #1 parity for the retry path).
      const rescheduled = await scheduleRetry(serviceClient, {
        runId: job.id,
        owner,
        backoffSeconds: decision.backoffSeconds,
        failureReason: decision.failureReason,
        failureSubReason: decision.failureSubReason ?? null,
        failureDetail,
      });
      return rescheduled ? 'retry' : 'lost_lease';
    }

    // Terminal failure (failed_terminal | dead_letter) — consistent pair
    // (carry-forward #6): both map status='failed'.
    const finalized = await finalizeJob(serviceClient, {
      runId: job.id,
      owner,
      terminalState: decision.disposition, // 'failed_terminal' | 'dead_letter'
      status: 'failed',
      failureReason: decision.failureReason,
      failureSubReason: decision.failureSubReason ?? null,
      deadLetterReason: decision.deadLetterReason,
      observations: null,
      failureDetail,
    });
    if (!finalized) return 'lost_lease';
    return decision.disposition === 'dead_letter' ? 'dead_letter' : 'failed_terminal';
  } catch {
    // Defensive: an unexpected condition → terminal finalize (no retry loop).
    // Still honor the lease guard via finalizeJob's FALSE return.
    try {
      const finalized = await finalizeJob(serviceClient, {
        runId: job.id,
        owner,
        terminalState: 'failed_terminal',
        status: 'failed',
        failureReason: 'drainer_unexpected_error',
        failureSubReason: null,
        deadLetterReason: null,
        observations: null,
        // No adapter result here (we are in the defensive catch); minimal
        // self-describing detail. Leak-safe by construction.
        failureDetail: buildRunRowFailureDetail({
          reason: 'drainer_unexpected_error',
          family: job.family,
          correlationId: job.id,
          runMode: job.run_mode,
        }),
      });
      return finalized ? 'failed_terminal' : 'lost_lease';
    } catch {
      return 'failed_terminal';
    }
  }
}

/** Claim a batch via the Card-1 claim function. Returns [] on any error. */
async function claimJobs(
  serviceClient: ReturnType<typeof createServiceClient>,
  owner: string,
): Promise<ClaimedJob[]> {
  try {
    const { data, error } = await serviceClient.rpc('claim_classifier_jobs', {
      batch_size: DRAINER_CLAIM_BATCH_SIZE,
      owner,
      lease: `${DRAINER_JOB_LEASE_SECONDS} seconds`,
    });
    if (error || !Array.isArray(data)) return [];
    return data.filter(
      (r): r is ClaimedJob =>
        r !== null &&
        typeof r === 'object' &&
        typeof (r as { id?: unknown }).id === 'string' &&
        typeof (r as { argument_id?: unknown }).argument_id === 'string' &&
        typeof (r as { family?: unknown }).family === 'string' &&
        typeof (r as { run_mode?: unknown }).run_mode === 'string',
    );
  } catch {
    return [];
  }
}

/** Read a job row's current attempt_count (for the retry-cap decision). */
async function readAttemptCount(
  serviceClient: ReturnType<typeof createServiceClient>,
  runId: string,
): Promise<number> {
  try {
    const { data, error } = await serviceClient
      .from('argument_machine_observation_runs')
      .select('attempt_count')
      .eq('id', runId)
      .maybeSingle();
    if (error || !data || typeof data.attempt_count !== 'number') return 1;
    return data.attempt_count;
  } catch {
    return 1;
  }
}

/** Input to the atomic finalizer call. */
interface FinalizeJobInput {
  runId: string;
  owner: string;
  terminalState: 'succeeded' | 'failed_terminal' | 'dead_letter';
  status: 'success' | 'failed';
  failureReason: string | null;
  failureSubReason: string | null;
  deadLetterReason: string | null;
  observations: ReadonlyArray<{
    raw_key: string;
    family: string;
    confidence: string;
    evidence_span: string | null;
  }> | null;
  /**
   * OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE: the leak-safe diagnostic
   * object for a terminal-failure finalize. ADDITIVE; absent/undefined on
   * success (→ the RPC receives NULL and the success branch never assigns it,
   * so a succeeded row's failure_detail stays NULL).
   */
  failureDetail?: RunRowFailureDetail | null;
  /**
   * OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING: the leak-safe rawKey NAMES the MCP
   * server dropped by key-level fail-closed on a SUCCESS classify. ADDITIVE;
   * passed ONLY on the success finalize (→ written to dropped_unclean_span_keys
   * on the SUCCESS branch). NULL/absent on terminal-failure + zero-drop success
   * (→ the column stays NULL). NAMES only — never a span / body / verdict.
   */
  droppedUncleanSpanKeys?: string[] | null;
}

/**
 * Call finalize_classifier_job (Card 2A — atomic result-INSERT + run-row
 * terminal flip). Returns the function's boolean: TRUE = finalized; FALSE =
 * lost lease (carry-forward #1). Returns FALSE on any RPC error too (so the
 * caller treats it as "did not finalize" — the job re-runs later rather than
 * being mis-counted as success).
 */
async function finalizeJob(
  serviceClient: ReturnType<typeof createServiceClient>,
  input: FinalizeJobInput,
): Promise<boolean> {
  try {
    const { data, error } = await serviceClient.rpc('finalize_classifier_job', {
      p_run_id: input.runId,
      p_owner: input.owner,
      p_terminal_state: input.terminalState,
      p_status: input.status,
      p_failure_reason: input.failureReason,
      p_failure_sub_reason: input.failureSubReason,
      p_dead_letter_reason: input.deadLetterReason,
      p_observations: input.observations ?? [],
      p_failure_detail: input.failureDetail ?? null,
      p_dropped_unclean_span_keys: input.droppedUncleanSpanKeys ?? null,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/** Input to the retry-schedule run-row UPDATE. */
interface ScheduleRetryInput {
  runId: string;
  owner: string;
  backoffSeconds: number;
  failureReason: string;
  failureSubReason: string | null;
  /** OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE: leak-safe diagnostic object (ADDITIVE). */
  failureDetail?: RunRowFailureDetail | null;
}

/**
 * Run-row-ONLY UPDATE to schedule a retry (design §A.9): state =
 * 'retry_scheduled', available_at = now()+backoff, record the typed failure
 * fields, CLEAR the lease. This is NOT a finalize and NOT an in-request wait.
 *
 * Guarded on (lease_owner = owner AND state = 'leased') so a row reclaimed /
 * stolen / wrong-owner is a no-op — the carry-forward #1 lost-lease guarantee
 * for the retry path (a drainer that lost the lease must not reschedule a job
 * another drainer may already be finalizing). Returns true when this drainer
 * still owned the lease and the row was rescheduled; false otherwise.
 *
 * Backoff is expressed as an ISO timestamp computed via the DB clock would be
 * ideal, but the supabase-js builder cannot do `now() + interval` inline; we
 * pass the absolute target time computed from the request clock. The drainer
 * runs well within the lease, so a small clock skew is immaterial (the claim
 * query gates on available_at <= now() and a few ms of skew only shifts the
 * retry by that amount).
 */
async function scheduleRetry(
  serviceClient: ReturnType<typeof createServiceClient>,
  input: ScheduleRetryInput,
): Promise<boolean> {
  try {
    const availableAt = new Date(Date.now() + input.backoffSeconds * 1000).toISOString();
    const { data, error } = await serviceClient
      .from('argument_machine_observation_runs')
      .update({
        state: 'retry_scheduled',
        available_at: availableAt,
        failure_reason: input.failureReason,
        failure_sub_reason: input.failureSubReason,
        failure_detail: input.failureDetail ?? null,
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq('id', input.runId)
      .eq('lease_owner', input.owner)
      .eq('state', 'leased')
      .select('id');
    if (error || !Array.isArray(data)) return false;
    // A guarded UPDATE that matched no row (reclaimed / wrong owner) returns
    // an empty array → treat as lost lease (no reschedule happened).
    return data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Write the per-drain audit row (design §A.10). Best-effort — an audit
 * failure never affects the drain outcome. Carries ONLY operational
 * counters; NO secret, owner is the opaque invocation id.
 */
async function writeDrainAudit(
  serviceClient: ReturnType<typeof createServiceClient>,
  summary: DrainSummary,
  startedAtMs: number,
  clock: DrainerClock,
): Promise<void> {
  try {
    const startedAt = new Date(startedAtMs).toISOString();
    const completedAt =
      summary.outcome === 'skipped_single_flight'
        ? null
        : new Date(clock.nowMs()).toISOString();
    await serviceClient.from('classifier_drain_audit').insert({
      owner: summary.owner,
      started_at: startedAt,
      completed_at: completedAt,
      outcome: summary.outcome,
      jobs_processed: summary.jobsProcessed,
      jobs_succeeded: summary.jobsSucceeded,
      jobs_failed: summary.jobsFailed,
      stale_leases_recovered: summary.staleLeasesRecovered,
      dead_letters: summary.jobsDeadLettered,
    });
  } catch {
    // Best-effort; the run rows themselves are the durable trail.
  }
}
