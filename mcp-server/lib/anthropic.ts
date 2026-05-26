/**
 * MCP-SERVER-001 — Anthropic Messages API client (server-side).
 *
 * Refactored for MCP-SERVER-002: the HTTP / timeout / fetch / status-code
 * mapping / response-parsing skeleton lives in `anthropicCall.ts`. This
 * file remains the semantic-move-specific orchestrator:
 *   - builds the semantic-referee system + user prompts (from seedPrompt.ts)
 *   - wraps `callAnthropic` with `tool: 'classify_semantic_move'` logging
 *
 * Public exports stay byte-equal for the caller — the constants, the
 * helper functions (`extractAnthropicContentText`, `parseJsonFromContent`),
 * and `runAnthropicSemanticReferee` all keep the same signatures and
 * behavior. Tests in `anthropicNoLogging.test.ts` and the smoke script
 * Check 4 + 8 remain byte-equal regressions.
 *
 * The single point where the Anthropic API key reaches the network is
 * inside `callAnthropic`. The key is read via Deno.env at call time and
 * NEVER logged, NEVER returned in any response body. The key reaches the
 * request as the `x-api-key` header — the sanitizer scrubs the
 * Authorization variant elsewhere as a defensive defence-in-depth.
 *
 * Timeouts are governed by `MCP_SERVER_MODEL_TIMEOUT_MS` (default 25_000ms).
 * The outer per-request timeout is enforced at the server level
 * (`MCP_SERVER_REQUEST_TIMEOUT_MS`, default 30_000ms).
 *
 * Mirrors the request body construction from
 * `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts`
 * (`buildAnthropicRequestBody`).
 */
import {
  SEMANTIC_REFEREE_SYSTEM_PROMPT,
  MAX_TOKENS,
  TEMPERATURE,
  buildClassifierPrompt,
} from './seedPrompt.ts';
import type { ClassifyMoveRequestValue } from './semanticRefereePacketSchema.ts';
import {
  callAnthropic,
  extractAnthropicContentText,
  parseJsonFromContent,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_MODEL_TIMEOUT_MS,
} from './anthropicCall.ts';
import type {
  AnthropicCallResult,
  AnthropicCallFailure,
  AnthropicCallSuccess,
  AnthropicFailureReason,
} from './anthropicCall.ts';

/**
 * BACKWARD-COMPAT alias. Existing callers and tests reference
 * `AnthropicResult` / `AnthropicFailure` from this module. The underlying
 * types are now defined in anthropicCall.ts (`AnthropicCallSuccess` /
 * `AnthropicCallFailure`); we re-export the original names as aliases.
 */
export type AnthropicResult = AnthropicCallSuccess;
export type AnthropicFailure = AnthropicCallFailure;
export type { AnthropicFailureReason };

/**
 * Run the semantic-referee call against Anthropic. Public for the tool
 * handler and for unit tests via a fetch override. SIGNATURE BYTE-EQUAL to
 * MCP-SERVER-001 baseline (Trigger 14 regression gate).
 *
 * @param request Validated `ClassifyMoveRequest`.
 * @param requestId Server-generated correlation id for log lines.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicSemanticReferee(
  request: ClassifyMoveRequestValue,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildClassifierPrompt(request);
  return await callAnthropic({
    system: SEMANTIC_REFEREE_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    toolNameForLogging: 'classify_semantic_move',
    requestId,
    fetchImpl,
  });
}

/** Helpers re-exported for callers that imported them from this module. */
export { extractAnthropicContentText, parseJsonFromContent };

/** Constants re-exported for tests / parity check. */
export {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_MODEL_TIMEOUT_MS,
};
