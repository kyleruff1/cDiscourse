/**
 * MCP-SERVER-004-FAMILY-C — Family C boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family C-specific prompt
 * construction and `tool: 'classify_argument_boolean_observations'`
 * logging. Returns the parsed JSON packet for the tool handler to validate.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §7 — server-side Deno only.
 *   - cdiscourse-doctrine §6 — ANTHROPIC_API_KEY never logged; reaches
 *     network via x-api-key inside callAnthropic.
 *   - The structural validation + ban-list scan happen in the tool handler,
 *     NOT here.
 */
import { callAnthropic } from './anthropicCall.ts';
import type { AnthropicCallResult } from './anthropicCall.ts';
import {
  FAMILY_C_SYSTEM_PROMPT,
  FAMILY_C_MAX_TOKENS,
  FAMILY_C_TEMPERATURE,
  buildFamilyCUserPrompt,
} from './familyCPrompt.ts';
import type { ValidatedFamilyCRequest } from './familyCPrompt.ts';

/**
 * Run the Family C boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family C request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyCClassifier(
  request: ValidatedFamilyCRequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyCUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_C_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_C_MAX_TOKENS,
    temperature: FAMILY_C_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
