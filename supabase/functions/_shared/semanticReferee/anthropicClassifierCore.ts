/**
 * MCP-017 — Semantic referee Anthropic classifier core (zod-free).
 *
 * The pure, Jest-importable logic for the live Anthropic provider: prompt
 * assembly, Anthropic-response-text extraction, JSON-from-content parse, and
 * the raw-payload sanitizer. NONE of this touches `Deno`, `fetch`, `npm:zod`,
 * or any I/O — so the `_helpers/semanticRefereeDeno.ts` Jest bridge can
 * `require()` it directly and unit-test every function.
 *
 * The zod-coupled orchestration (the `fetch`, the `Deno.env.get`, the schema +
 * content validation dispatch) lives in `anthropicProvider.ts`, which imports
 * this file. That split is what makes the live provider unit-testable — see
 * MCP-017 design §"Test reality".
 *
 * This file MIRRORS the sibling `_shared/languageProcessing/anthropicProvider.ts`
 * step-for-step (request-body shape, `sanitizeRawPayload`, content extraction).
 * It does NOT import or re-export the sibling — the semantic referee gets its
 * own model-id constant and its own system prompt.
 *
 * DOCTRINE: the system prompt asks for STRUCTURAL yes/no answers only — no
 * verdict, no truth, no winner, no popularity reading. See `seedPrompt.ts`.
 */
import { buildClassifierPrompt } from './seedPrompt.ts';
import type { ClassifyMoveRequest, SemanticRefereePacket } from './types.ts';

/**
 * The default Haiku-class model id (MCP-017 Open item 1 / OQ-1). This is the
 * current Anthropic Haiku 4.5 ALIAS — the dated snapshot form is
 * `claude-haiku-4-5-20251001`. The sibling language-processing provider pins
 * the dated form; MCP-017 deliberately defaults to the alias so an operator who
 * does not pin gets the latest Haiku 4.5 snapshot, and exposes
 * `SEMANTIC_REFEREE_MODEL` so an operator who wants a frozen snapshot pins the
 * dated id. The operator confirms the id in the Anthropic console before the
 * first live deploy.
 */
export const DEFAULT_SEMANTIC_REFEREE_MODEL = 'claude-haiku-4-5';

/** Output token bound — matches the sibling provider's small cap. */
export const MAX_TOKENS = 900;

/** Deterministic decoding — no sampling. Same input → same request body. */
export const TEMPERATURE = 0;

/**
 * The system-prompt boilerplate. Mirrors the MCP-002 seed bank's
 * "System-prompt boilerplate (every call)" verbatim in intent: the model
 * classifies one structural property of game play, returns strict JSON, does
 * NOT decide who is right, does NOT assign truth, does NOT label the person,
 * and its output is advisory metadata that never blocks an ordinary post.
 */
export const SEMANTIC_REFEREE_SYSTEM_PROMPT = `You are a CDiscourse semantic classifier for a structured debate application.
Return strict JSON only.

Absolute rules:
- You do NOT decide who is right in a debate.
- You do NOT decide the winner of any debate.
- You do NOT assign a truth value to any claim.
- You do NOT treat popularity, engagement, or virality as evidence.
- You do NOT describe, judge, or label the person — only the move's structure.
- You do NOT recommend hiding, deleting, or modifying any content.
- You do NOT block an ordinary post — your output is advisory metadata only.

You classify whether an argument MOVE has bounded structural properties of game
play: parent continuity, evidence hygiene, branch hygiene, constructive
movement, debate-mode fit, and friction. For each requested classifier you
answer 0 or 1 with a short confidence and a lowercase snake_case reason code.

Every value you return must be 0 or 1. Never include a blocking field, a truth
field, a verdict field, or a winner field. Return ONLY the JSON object the user
prompt describes — no prose, no markdown, no chain-of-thought.`;

/**
 * Build the Anthropic Messages API request body. Pure — exported so tests can
 * assert its shape without a network call. Same `request` + `model` →
 * byte-identical output (no `Date.now()`, no randomness).
 */
export function buildAnthropicRequestBody(
  request: ClassifyMoveRequest,
  model: string,
): Record<string, unknown> {
  return {
    model,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SEMANTIC_REFEREE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildClassifierPrompt(request) }],
  };
}

/**
 * Pull the first `content[].type === 'text'` text out of an Anthropic Messages
 * API response object. Returns `undefined` for an empty / malformed `content`
 * array or a non-object input. Never throws. Mirrors the sibling provider's
 * `contentText` block.
 */
export function extractAnthropicContentText(responseJson: unknown): string | undefined {
  if (typeof responseJson !== 'object' || responseJson === null) return undefined;
  const content = (responseJson as { content?: unknown }).content;
  if (!Array.isArray(content)) return undefined;
  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: unknown }).type === 'text' &&
      typeof (block as { text?: unknown }).text === 'string'
    ) {
      return (block as { text: string }).text;
    }
  }
  return undefined;
}

/**
 * Extract and `JSON.parse` the first `{...}` object from a response text.
 * Returns the parsed value, or `null` on ANY failure — non-JSON, a JSON array,
 * empty input, a malformed object. NEVER throws. Mirrors the sibling provider's
 * `JSON.parse(match[0])` block.
 */
export function parseJsonFromContent(text: unknown): unknown | null {
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    // A `{...}` match always parses to an object on success; guard anyway so a
    // caller never receives an array / primitive.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Keep ONLY `{ model, stop_reason, usage }` from a raw Anthropic response —
 * never the raw body, never the response text, never request headers, never
 * the `content` array. Copied verbatim from the sibling provider so the two
 * stay parallel. Used for the (sanitized) log line only.
 */
export function sanitizeRawPayload(raw: unknown): {
  model: unknown;
  stop_reason: unknown;
  usage: unknown;
} {
  if (typeof raw !== 'object' || raw === null) {
    return { model: undefined, stop_reason: undefined, usage: undefined };
  }
  const r = raw as Record<string, unknown>;
  return { model: r['model'], stop_reason: r['stop_reason'], usage: r['usage'] };
}

/**
 * The live provider's own failure vocabulary — a BOUNDARY-INTERNAL type, NOT a
 * `ClassifyMoveDisabledReason` value (those are widened separately in
 * `types.ts`). `runAnthropicClassifier` returns one of these on every
 * non-success path; `providerRoutingCore.ts` translates it into the outbound
 * `ClassifyMoveOutcome`.
 */
export type ProviderUnavailableReason =
  | 'key_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

/**
 * The result of one live-provider call. `success` carries a fully validated
 * packet; `unavailable` carries a typed reason. The provider NEVER throws — a
 * thrown `fetch`, an API error, a parse miss, and a validation failure all map
 * to an `unavailable` result.
 */
export type ProviderResult =
  | { kind: 'success'; packet: SemanticRefereePacket }
  | { kind: 'unavailable'; reason: ProviderUnavailableReason };
