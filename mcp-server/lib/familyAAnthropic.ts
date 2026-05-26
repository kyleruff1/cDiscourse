/**
 * MCP-SERVER-002 — Family A boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family A-specific prompt
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
  FAMILY_A_SYSTEM_PROMPT,
  FAMILY_A_MAX_TOKENS,
  FAMILY_A_TEMPERATURE,
  buildFamilyAUserPrompt,
} from './familyAPrompt.ts';
import type { ValidatedFamilyARequest } from './familyAPrompt.ts';

/**
 * Run the Family A boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family A request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyAClassifier(
  request: ValidatedFamilyARequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyAUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_A_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_A_MAX_TOKENS,
    temperature: FAMILY_A_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
