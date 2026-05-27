/**
 * MCP-SERVER-003-FAMILY-B — Family B boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family B-specific prompt
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
  FAMILY_B_SYSTEM_PROMPT,
  FAMILY_B_MAX_TOKENS,
  FAMILY_B_TEMPERATURE,
  buildFamilyBUserPrompt,
} from './familyBPrompt.ts';
import type { ValidatedFamilyBRequest } from './familyBPrompt.ts';

/**
 * Run the Family B boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family B request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyBClassifier(
  request: ValidatedFamilyBRequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyBUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_B_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_B_MAX_TOKENS,
    temperature: FAMILY_B_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
