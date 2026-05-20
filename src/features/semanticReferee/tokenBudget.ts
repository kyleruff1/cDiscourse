/**
 * MCP-012 — Semantic call router: token budget.
 *
 * A conservative, tokenizer-free token estimate per packet call. `isWithinBudget`
 * decides whether a payload may be sent to the provider — over-budget means
 * "no call; fall back to deterministic layer 1". Refusing an over-budget packet
 * NEVER blocks a post (`post_submit` already happened; `pre_send_review` is
 * advisory) — the budget functions return DATA only, there is no post path here
 * to block (MCP-012 design §"API contracts" #4).
 *
 * The estimator deliberately OVER-counts (3.5 chars/token vs ~4 real English) so
 * `isWithinBudget` refuses slightly before the true ceiling, never after — a
 * doctrine-aligned fail-safe. The implementer must NOT truncate the body to fit:
 * truncation classifies a different text, a false-positive risk (MCP-004
 * §"token budget").
 *
 * Pure TypeScript — no tokenizer dependency (dependency policy: no speculative
 * deps), no network, no Supabase, no React, no `Deno`, no env, no `async`.
 */

/**
 * The combined input+output token ceiling per packet call. Operator-confirmable
 * (MCP-004 §"operator decisions" #1) — ships the recommended 1,500. The
 * mechanism (refuse over-budget, fall back to layer 1, never block the post)
 * does not change with the number.
 */
export const SEMANTIC_PACKET_TOKEN_BUDGET = 1500 as const;

/** Fixed reserve for the bounded JSON response — added to every estimate. */
export const OUTPUT_TOKEN_RESERVE = 450 as const;

/** Deliberately pessimistic chars-per-token divisor (real English ≈ 4). */
export const CHARS_PER_TOKEN = 3.5 as const;

/**
 * Per-classifier-id prompt footprint, in characters. A small heuristic — each
 * requested classifier id adds id text plus prompt scaffolding. Tunable; a
 * heuristic, not an operator decision.
 */
export const PER_CLASSIFIER_ID_CHARS = 32 as const;

/** Inputs to the estimate — character counts; no body text is retained. */
export interface TokenBudgetPayload {
  moveBodyRedacted: string;
  parentBodyRedacted?: string;
  /** Requested classifier ids — counted as a small fixed per-id overhead. */
  requestedClassifiers: readonly string[];
  /** Optional extra prompt context length (room mode, selected action, etc.). */
  extraContextChars?: number;
}

export interface TokenBudgetVerdict {
  ok: boolean;
  estimated: number;
  ceiling: number;
}

/**
 * Estimate the combined input+output token count for a packet call.
 * Conservative and tokenizer-free — it over-estimates so it fails SAFE.
 *
 *   inputChars  = moveBodyRedacted.length
 *               + (parentBodyRedacted?.length ?? 0)
 *               + (extraContextChars ?? 0)
 *               + requestedClassifiers.length * PER_CLASSIFIER_ID_CHARS
 *   inputTokens = ceil(inputChars / CHARS_PER_TOKEN)
 *   return        inputTokens + OUTPUT_TOKEN_RESERVE
 */
export function estimatePacketTokens(payload: TokenBudgetPayload): number {
  const moveChars = payload.moveBodyRedacted.length;
  const parentChars = payload.parentBodyRedacted?.length ?? 0;
  const extraChars = payload.extraContextChars ?? 0;
  const classifierChars = payload.requestedClassifiers.length * PER_CLASSIFIER_ID_CHARS;

  const inputChars = moveChars + parentChars + extraChars + classifierChars;
  const inputTokens = Math.ceil(inputChars / CHARS_PER_TOKEN);
  return inputTokens + OUTPUT_TOKEN_RESERVE;
}

/**
 * Decide whether a payload is within the per-packet token budget. The boundary
 * is inclusive — an estimate exactly equal to `SEMANTIC_PACKET_TOKEN_BUDGET`
 * yields `ok: true`. An over-budget payload yields `ok: false`; the caller
 * skips the call and falls back to layer 1 — the post is unaffected.
 */
export function isWithinBudget(payload: TokenBudgetPayload): TokenBudgetVerdict {
  const estimated = estimatePacketTokens(payload);
  return {
    ok: estimated <= SEMANTIC_PACKET_TOKEN_BUDGET,
    estimated,
    ceiling: SEMANTIC_PACKET_TOKEN_BUDGET,
  };
}
