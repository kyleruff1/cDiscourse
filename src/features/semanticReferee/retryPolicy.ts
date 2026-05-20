/**
 * MCP-012 — Semantic call router: retry policy descriptor.
 *
 * A PURE POLICY DESCRIPTOR. This file ships the `SEMANTIC_RETRY_POLICY`
 * descriptor and the `shouldRetry` predicate. It performs NO retry, sets NO
 * timer, makes NO call, declares NO `async` function. The retry *executor* —
 * the actual loop, the backoff timer, the per-attempt timeout — lives in
 * MCP-016's Edge Function, which reads this descriptor (MCP-012 design
 * §"API contracts" #5; §"Risks" — async creep).
 *
 * Doctrine: a terminal error class goes straight to the deterministic
 * fallback; `shouldRetry` returns `true` only for transient classes, so the
 * retry loop can never spin (`maxAttempts` is the literal `2`).
 *
 * Pure TypeScript — no network, no Supabase, no React, no `Deno`, no env,
 * no `async`, no `setTimeout`.
 */

/**
 * The retry POLICY. The executor lives in MCP-016's Edge Function — this is a
 * descriptor only.
 */
export interface SemanticRetryPolicy {
  /** One initial attempt plus at most one retry. */
  maxAttempts: 2;
  /** Backoff before each retry, in ms. Length is `maxAttempts - 1`. */
  backoffMs: readonly number[];
  /** Per-attempt wall-clock timeout, in ms. */
  attemptTimeoutMs: number;
}

/**
 * The shipped retry policy: one initial attempt + at most one retry, a single
 * short 250 ms backoff, an 8 s per-attempt wall-clock timeout (MCP-004 §"retry"
 * recommends 8 s). `maxAttempts` is the literal `2` — bounded and total; the
 * retry loop (executed later in MCP-016) can never spin.
 */
export const SEMANTIC_RETRY_POLICY: SemanticRetryPolicy = Object.freeze({
  maxAttempts: 2,
  backoffMs: Object.freeze([250]),
  attemptTimeoutMs: 8000,
});

/**
 * Error classes the boundary can hand the policy. Transient classes are
 * retryable; terminal classes are never retried — they go straight to the
 * deterministic fallback.
 */
export type SemanticErrorClass =
  // transient — retryable
  | 'network_timeout'
  | 'provider_5xx'
  | 'provider_rate_limited'
  // terminal — never retried
  | 'key_missing'
  | 'validation_failed'
  | 'parse_failure'
  | 'disabled'
  | 'over_budget';

/** The transient error classes — a retry may succeed. */
export const RETRYABLE_ERROR_CLASSES: readonly SemanticErrorClass[] = Object.freeze([
  'network_timeout',
  'provider_5xx',
  'provider_rate_limited',
]);

/** The terminal error classes — a retry cannot succeed; fall back immediately. */
export const TERMINAL_ERROR_CLASSES: readonly SemanticErrorClass[] = Object.freeze([
  'key_missing',
  'validation_failed',
  'parse_failure',
  'disabled',
  'over_budget',
]);

/**
 * Decide whether an error class should be retried. Returns `true` only for the
 * three transient classes; `false` for the five terminal classes.
 * `RETRYABLE_ERROR_CLASSES` ∪ `TERMINAL_ERROR_CLASSES` covers every
 * `SemanticErrorClass` member with no overlap — `semanticRetryPolicy.test.ts`
 * asserts the partition.
 */
export function shouldRetry(errorClass: SemanticErrorClass): boolean {
  return RETRYABLE_ERROR_CLASSES.includes(errorClass);
}
