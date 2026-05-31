/**
 * ARCH-001 Card 2 — Drainer retry policy (pure, Jest-importable).
 *
 * Encodes the parent design §A.9 retry table: given a classify failure
 * (the adapter's typed `unavailable` reason + optional sub-reason) and the
 * job's current `attempt_count`, decide the next lifecycle transition:
 *
 *   - 'retry'           → run-row-only UPDATE to state='retry_scheduled',
 *                          available_at = now()+backoff (NOT a finalize).
 *   - 'failed_terminal' → finalize_classifier_job(..., 'failed_terminal',
 *                          'failed', ...). A bounded-retry class that
 *                          exhausted its allowance, or a never-retried
 *                          deterministic/contract failure.
 *   - 'dead_letter'     → finalize_classifier_job(..., 'dead_letter',
 *                          'failed', ..., dead_letter_reason).
 *                          A retryable class that hit MAX_ATTEMPTS.
 *
 * Doctrine (cdiscourse-doctrine §1/§6/§10a): every value here is a
 * structural transport/contract/capacity classification — NO verdict, NO
 * truth value, NO popularity/heat input, NO raw provider body. A ban-list
 * test asserts none of the reason/sub-reason strings carries a verdict
 * token. This module is pure TS (no Deno, no fetch, no console, no npm:)
 * so it gets real behavioral unit tests via the Jest bridge.
 *
 * Card 3 raised MAX_ATTEMPTS from 3 → 4 in response to the Card-2 smoke's
 * C-calibration signal (2.9% provider_server_error dead-letter rate under
 * the original 30s/120s schedule that exhausted in ~300s). The Card-1
 * substrate's `reclaim_stale_leases` cap (`max_attempts CONSTANT int := 3`)
 * is unchanged and operates independently as the lease-expiry backstop —
 * the drainer's live-retry cap (this constant) and the reclaim cap have
 * different ceilings by design. See the DRAINER_MAX_ATTEMPTS doc-comment
 * for the full rationale.
 */

import type { BooleanObservationUnavailableReason } from './booleanObservationMcpAdapterCore.ts';
import type { BooleanObservationFailureSubreason } from './booleanObservationFailureSubreason.ts';

/**
 * Total attempts allowed for a retryable failure class (including the
 * first). Card 3 raised this from 3 → 4 in response to the Card-2 smoke's
 * C-calibration signal: 2.9% of cells dead-lettered on `provider_server_error`
 * (Anthropic {isError} overload) after MAX_ATTEMPTS=3 burned through the
 * 30s/120s backoff schedule in ~300s. The fourth attempt gives the
 * provider-server-error retry budget a longer tail; combined with the
 * `[60, 180, 360]` schedule below this brings worst-case retry budget to
 * ~10 min, ~2× the Anthropic overload-recovery window observed in Card 2.
 *
 * Card 1 substrate's `reclaim_stale_leases` cap (3) is its own ceiling — a
 * lease-expiry reclaim still dead-letters at 3. So the drainer's retry path
 * and the reclaim path have different caps by design (the reclaim path is
 * the slower, stuck-row backstop; the drainer is the live retry).
 */
export const DRAINER_MAX_ATTEMPTS = 4;

/**
 * DEFAULT backoff (seconds) added to `available_at` when scheduling a
 * retry, used for every retryable failure class EXCEPT
 * `provider_server_error` (see below). Index `i` is the backoff applied
 * when transitioning AFTER attempt `i+1` (1-based attempt). design §A.9
 * preserved exactly: attempt 1→2 +30s; 2→3 +120s. With Card 3's
 * MAX_ATTEMPTS=4, attempt 3→4 reuses the last entry (+120s) via clamping —
 * the array stays length 2 to keep the default schedule literally
 * unchanged from Card 2.
 */
export const DRAINER_RETRY_BACKOFF_SECONDS: ReadonlyArray<number> = Object.freeze([30, 120]);

/**
 * Failure-reason-SPECIFIC backoff (seconds) for `provider_server_error`
 * (the Anthropic {isError} overload class). Card-2 smoke evidence: all 3
 * dead-letters in the 105-cell burst were this sub-reason, exhausted in
 * ~300s under the default [30, 120] schedule. The longer [60, 180, 360]
 * schedule lets the burst window pass before retry attempt 4, giving the
 * upstream more recovery time. Total worst-case retry budget: 60+180+360
 * = 600s ≈ 10 min.
 *
 * Cardinality matches MAX_ATTEMPTS-1 = 3 retry transitions; no clamping
 * needed for the documented path.
 */
export const DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS: ReadonlyArray<number> = Object.freeze([60, 180, 360]);

/** The lifecycle decision for a failed classify. */
export type DrainerFailureDisposition = 'retry' | 'failed_terminal' | 'dead_letter';

/**
 * The full classified outcome for a failed classify: the disposition plus
 * the typed reason fields the drainer threads into either the run-row
 * retry UPDATE or `finalize_classifier_job`.
 */
export interface DrainerFailureDecision {
  disposition: DrainerFailureDisposition;
  /** The persisted `failure_reason` string (mcp_* family; existing vocabulary). */
  failureReason: string;
  /** The typed sub-reason (mirrors BooleanObservationFailureSubreason). */
  failureSubReason: BooleanObservationFailureSubreason | undefined;
  /** Backoff seconds for a 'retry' disposition; 0 for terminal/dead_letter. */
  backoffSeconds: number;
  /** Set ONLY for 'dead_letter' — a typed operational reason, never a verdict. */
  deadLetterReason: string | null;
}

/**
 * RETRYABLE adapter reasons per §A.9 (provider/transport transients that
 * may heal on a later drain): network, rate-limit, generic api_error
 * (which covers the {isError} provider_server_error envelope), and the
 * drainer's own timeout abort. url_missing / token_missing are operator
 * CONFIG failures (won't heal by retry) → terminal. validation_failed /
 * parse_failure are deterministic CONTRACT failures → bounded (handled
 * separately below).
 */
const RETRYABLE_REASONS: ReadonlySet<BooleanObservationUnavailableReason> = new Set([
  'network_error',
  'rate_limited',
  'api_error',
]);

/**
 * Map the adapter's `unavailable.reason` to the persisted `failure_reason`
 * string. Mirrors `unavailableReasonToFailureReason` in classifyArgumentCore
 * (kept local so this pure module has no Deno dependency); the strings are
 * byte-identical so the drainer's persisted failure_reason matches the
 * direct-dispatch path's vocabulary.
 */
export function drainerUnavailableReasonToFailureReason(
  reason: BooleanObservationUnavailableReason,
): string {
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
    default: {
      // Forward-compatible: an unmapped reason still produces a stable string.
      return `mcp_${reason as string}`;
    }
  }
}

/**
 * Decide the next lifecycle transition for a failed classify. Pure, total,
 * never throws.
 *
 * @param reason         the adapter's typed unavailable reason.
 * @param attemptCount   the job's CURRENT attempt_count (already bumped by
 *                       claim_classifier_jobs to include this attempt).
 * @param subReason      the adapter's optional typed sub-reason.
 *
 * Rules (design §A.9 retry table):
 *   - url_missing / token_missing  → 'failed_terminal' (config; never heals).
 *   - validation_failed / parse_failure (deterministic contract failure) →
 *       at most ONE retry (a single transient truncation is allowed), then
 *       'failed_terminal'. NEVER dead_letter (it is not a capacity/transport
 *       outage).
 *   - network / rate-limit / api_error (incl. provider_server_error) →
 *       'retry' while attempt_count < MAX_ATTEMPTS, else 'dead_letter'.
 *   - any unknown reason → treated as bounded (1 retry) like a contract
 *       failure (conservative; never loops forever).
 *
 * Doctrine: a doctrine/ban-list failure is NOT a separate adapter reason
 * here — the adapter never emits one for these families (the ban-list is a
 * content property enforced upstream in the sanitizer/registry, not a
 * provider failure). If a future sub-reason surfaces one, it maps through
 * the validation_failed (contract) branch → bounded, NEVER retried broadly,
 * exactly as §A.9 requires.
 */
export function classifyDrainerFailure(
  reason: BooleanObservationUnavailableReason,
  attemptCount: number,
  subReason?: BooleanObservationFailureSubreason,
): DrainerFailureDecision {
  const failureReason = drainerUnavailableReasonToFailureReason(reason);

  // Operator-config failures: never heal by retry → terminal immediately.
  if (reason === 'url_missing' || reason === 'token_missing') {
    return {
      disposition: 'failed_terminal',
      failureReason,
      failureSubReason: subReason,
      backoffSeconds: 0,
      deadLetterReason: null,
    };
  }

  // Retryable provider/transport transients.
  if (RETRYABLE_REASONS.has(reason)) {
    if (attemptCount < DRAINER_MAX_ATTEMPTS) {
      // Card 3: `provider_server_error` (Anthropic {isError} overload) gets
      // its own longer schedule [60, 180, 360]; every other retryable
      // sub-reason preserves the default [30, 120] schedule exactly. The
      // selection is by typed sub-reason — never by raw provider body.
      const schedule = reason === 'api_error' && subReason === 'provider_server_error'
        ? DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS
        : DRAINER_RETRY_BACKOFF_SECONDS;
      // Index by the just-completed attempt (1-based): attempt 1 → schedule[0];
      // attempt N → schedule[N-1]. Clamp to the last entry (the default
      // schedule reuses +120s for attempt 3→4 since its array stays length 2).
      const idx = Math.min(attemptCount - 1, schedule.length - 1);
      const backoffSeconds = schedule[Math.max(0, idx)];
      return {
        disposition: 'retry',
        failureReason,
        failureSubReason: subReason,
        backoffSeconds,
        deadLetterReason: null,
      };
    }
    // Exhausted the retry allowance for a retryable class → dead_letter.
    return {
      disposition: 'dead_letter',
      failureReason,
      failureSubReason: subReason,
      backoffSeconds: 0,
      deadLetterReason: 'retry_attempts_exhausted',
    };
  }

  // Deterministic CONTRACT failures (validation_failed / parse_failure) +
  // any unknown reason: allow exactly ONE retry (a single transient
  // truncation), then terminal. NEVER dead_letter (not a capacity/transport
  // outage), NEVER the full retry schedule.
  if (attemptCount < 2) {
    const backoffSeconds = DRAINER_RETRY_BACKOFF_SECONDS[0];
    return {
      disposition: 'retry',
      failureReason,
      failureSubReason: subReason,
      backoffSeconds,
      deadLetterReason: null,
    };
  }
  return {
    disposition: 'failed_terminal',
    failureReason,
    failureSubReason: subReason,
    backoffSeconds: 0,
    deadLetterReason: null,
  };
}
