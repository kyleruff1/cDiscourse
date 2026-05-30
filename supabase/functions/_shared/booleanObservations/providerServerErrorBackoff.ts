/**
 * OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — provider_server_error backoff.
 *
 * Pure, Jest-loadable backoff computation for the SINGLE retry of a
 * `provider_server_error` failure (the hosted MCP `{ isError }` overload
 * envelope, typed in #365 Phase 3). Used ONLY by the dispatcher's backoff
 * branch when `lastSummary.failureSubReason === 'provider_server_error'`;
 * all other retryable classes keep the shared RETRY_BACKOFF_MS.
 *
 * NO `Math.random` inside (HALT-6): the caller supplies `rand01` (the
 * dispatcher passes `Math.random()` at the call site, source-scanned).
 * NO `Deno.`, no `fetch`, no `console`, no `npm:` import. Zero imports —
 * mirrors autoTriggerConcurrency.ts so the Jest bridge can require() it.
 *
 * This file is NOT schema-mirrored — it has no `src/features/nodeLabels/`
 * twin and introduces no symbol any schema mirror references. It is a
 * fresh sibling (not an append to autoTriggerConcurrency.ts) so that
 * file's "exports ONLY the constant, exactly one export" test stays
 * byte-equal (HALT-7 / no audit-lint churn).
 */

/** Base wait (ms) before the single provider_server_error retry. */
export const PROVIDER_SERVER_ERROR_RETRY_BASE_MS = 7_000;

/** Bounded jitter span (ms) added on top of the base. */
export const PROVIDER_SERVER_ERROR_RETRY_JITTER_MS = 3_000;

/**
 * Backoff (ms) before the provider_server_error retry. Pure + total.
 *
 * @param attemptNumber 1-based attempt that just FAILED (the wait precedes
 *        attempt attemptNumber+1). Accepted for signature parity with the
 *        shared RETRY_BACKOFF_MS index and forward-compat; with MAX_ATTEMPTS
 *        = 2 the only retry is after attempt 1, so the value does not branch
 *        on attemptNumber today (documented; a future 2nd attempt would).
 * @param rand01 a number in [0, 1) — injected (Math.random() at the call
 *        site). Values outside [0,1) are CLAMPED so the result stays bounded
 *        even on a degenerate input (defense-in-depth; the real call site
 *        always passes Math.random()).
 * @returns BASE_MS + floor(clamp(rand01) * JITTER_MS), i.e. an integer in
 *          [BASE_MS, BASE_MS + JITTER_MS).
 */
export function providerServerErrorBackoffMs(
  attemptNumber: number,
  rand01: number,
): number {
  // Clamp rand01 into [0, 1) so the bound holds for any input. NaN -> 0.
  const r =
    Number.isFinite(rand01) && rand01 > 0
      ? Math.min(rand01, 0.999_999_999)
      : 0;
  void attemptNumber; // accepted for parity; constant schedule with MAX_ATTEMPTS=2
  return PROVIDER_SERVER_ERROR_RETRY_BASE_MS + Math.floor(r * PROVIDER_SERVER_ERROR_RETRY_JITTER_MS);
}
