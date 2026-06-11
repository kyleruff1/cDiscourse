/**
 * MCP-SERVER-011-FAMILY-J — Family J boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family J-specific prompt
 * construction and `tool: 'classify_argument_boolean_observations'`
 * logging. Returns the parsed JSON packet for the tool handler to validate.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §7 — server-side Deno only.
 *   - cdiscourse-doctrine §6 — ANTHROPIC_API_KEY never logged; reaches
 *     network via x-api-key inside callAnthropic.
 *   - The structural validation + ban-list scan happen in the tool handler,
 *     NOT here.
 *
 * Per design §4: MAX_TOKENS=1500 (matches Family A/B/C/E/F/G/H/I; NO bump). The
 * conservative-positives bias keeps the realistic positive-sparse output far
 * under budget on 5 keys — J has the largest absolute headroom of any family.
 */
import { callAnthropic } from './anthropicCall.ts';
import type { AnthropicCallResult } from './anthropicCall.ts';
import {
  FAMILY_J_SYSTEM_PROMPT,
  FAMILY_J_MAX_TOKENS,
  FAMILY_J_TEMPERATURE,
  buildFamilyJUserPrompt,
} from './familyJPrompt.ts';
import type { ValidatedFamilyJRequest } from './familyJPrompt.ts';

/**
 * Run the Family J boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family J request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyJClassifier(
  request: ValidatedFamilyJRequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyJUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_J_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_J_MAX_TOKENS,
    temperature: FAMILY_J_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
