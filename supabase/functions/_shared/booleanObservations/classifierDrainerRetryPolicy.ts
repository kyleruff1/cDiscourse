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
 *
 * The ARCH-001 retry-budget fix (2026-06-21) added a `provider_server_error`-
 * SPECIFIC cap (`DRAINER_PROVIDER_SERVER_ERROR_MAX_ATTEMPTS = 5`, schedule
 * `[60, 180, 360, 600]`) on top of the unchanged default cap (4). Trigger: the
 * Family-I D3 production smoke reproduced provider_server_error dead-letters
 * (a retryable Anthropic-overload transient that out-lasted the 4-attempt
 * budget) — NOT a per-family defect. See the two constants' doc-comments below.
 */

import type { BooleanObservationUnavailableReason } from './booleanObservationMcpAdapterCore.ts';
import type { BooleanObservationFailureSubreason } from './booleanObservationFailureSubreason.ts';

/**
 * Total attempts allowed for a retryable failure class (including the
 * first). Card 3 raised this from 3 → 4 in response to the Card-2 smoke's
 * C-calibration signal: 2.9% of cells dead-lettered on `provider_server_error`
 * (Anthropic {isError} overload) after MAX_ATTEMPTS=3 burned through the
 * 30s/120s backoff schedule in ~300s.
 *
 * SCOPE (ARCH-001 retry-budget fix, 2026-06-21): this cap now governs the
 * `network_error`, `rate_limited`, and generic `api_error` retryable classes
 * ONLY. The `provider_server_error` sub-reason (the Anthropic {isError}
 * overload class) has its own, higher cap —
 * `DRAINER_PROVIDER_SERVER_ERROR_MAX_ATTEMPTS` — because the Family-I D3
 * production smoke (2026-06-21) reproduced a 3-cell dead-letter cluster
 * (argument_scheme / resolution_progress / thread_topology) where a genuine
 * ~13–15 min Anthropic overload transient out-lasted this 4-attempt (~10 min)
 * budget. All three families recover on retry historically (and G/I had zero
 * prior dead-letters), so the failure is a retryable transient that needs a
 * longer budget — NOT a per-family defect. Extending ONLY the
 * provider_server_error class keeps the proven-fine default budget for every
 * other class. See docs/designs/ARCH-001-MCP-RETRY-BUDGET-FIX-2026-06-21.md.
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
 * ~300s under the default [30, 120] schedule. The [60, 180, 360] schedule
 * (Card 3) lifted the worst-case backoff budget to 600s ≈ 10 min.
 *
 * ARCH-001 retry-budget fix (2026-06-21): extended to [60, 180, 360, 600].
 * The Family-I D3 production smoke reproduced provider_server_error
 * dead-letters whose transients ran ~13–15 min — exceeding the 600s budget.
 * The fourth tier (+600s) takes the worst-case backoff to 60+180+360+600 =
 * 1200s (~20 min backoff; realized lifetime ~26 min once per-attempt call +
 * cron re-claim latency are added), giving ~2× margin over the observed
 * transient. The +600s tail (vs a minimal +360s) is sized for the WIDER
 * 06-21 event — a 3-cell cluster across two windows, each exhausting the
 * budget edge — rather than the single ~899s cell of the 2026-06-14 PARTIAL.
 *
 * Cardinality is DRAINER_PROVIDER_SERVER_ERROR_MAX_ATTEMPTS-1 = 4 retry
 * transitions (attempts 1→2, 2→3, 3→4, 4→5); no clamping needed for the
 * documented path.
 */
export const DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS: ReadonlyArray<number> = Object.freeze([60, 180, 360, 600]);

/**
 * Provider-server-error-SPECIFIC max attempts (including the first). The
 * `provider_server_error` sub-reason — the Anthropic {isError} overload class —
 * gets a higher live-retry cap than the default DRAINER_MAX_ATTEMPTS (4) so a
 * single long overload transient can clear before the cell dead-letters. Every
 * other retryable class (network_error, rate_limited, generic api_error) keeps
 * DRAINER_MAX_ATTEMPTS. Calibrated by the 2026-06-21 Family-I D3 smoke (see the
 * backoff doc-comment above and
 * docs/designs/ARCH-001-MCP-RETRY-BUDGET-FIX-2026-06-21.md).
 *
 * Still bounded: a genuinely-dead provider terminates — a 5th failed attempt →
 * dead_letter. The Card-1 `reclaim_stale_leases` cap (3) is independent and
 * unchanged (the slower lease-expiry backstop).
 */
export const DRAINER_PROVIDER_SERVER_ERROR_MAX_ATTEMPTS = 5;

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
    // ARCH-001 retry-budget fix: `provider_server_error` (Anthropic {isError}
    // overload) gets BOTH its own higher attempt cap AND its own longer backoff
    // schedule [60, 180, 360, 600]; every other retryable class keeps
    // DRAINER_MAX_ATTEMPTS and the default [30, 120] schedule. Selection is by
    // typed sub-reason — never by raw provider body.
    const isProviderServerError =
      reason === 'api_error' && subReason === 'provider_server_error';
    const maxAttempts = isProviderServerError
      ? DRAINER_PROVIDER_SERVER_ERROR_MAX_ATTEMPTS
      : DRAINER_MAX_ATTEMPTS;
    if (attemptCount < maxAttempts) {
      const schedule = isProviderServerError
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
