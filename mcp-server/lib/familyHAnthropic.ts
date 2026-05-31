/**
 * MCP-SERVER-009-FAMILY-H — Family H boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family H-specific prompt
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
 * Per design §A.2: MAX_TOKENS=1500 (matches Family A/B/C/E/F/G; NO bump). The
 * conservative-positives bias keeps the realistic positive-sparse output far
 * under budget on 12 keys — H has ~480 token headroom, the largest absolute
 * headroom of any family A-H to date.
 */
import { callAnthropic } from './anthropicCall.ts';
import type { AnthropicCallResult } from './anthropicCall.ts';
import {
  FAMILY_H_SYSTEM_PROMPT,
  FAMILY_H_MAX_TOKENS,
  FAMILY_H_TEMPERATURE,
  buildFamilyHUserPrompt,
} from './familyHPrompt.ts';
import type { ValidatedFamilyHRequest } from './familyHPrompt.ts';

/**
 * Run the Family H boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family H request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyHClassifier(
  request: ValidatedFamilyHRequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyHUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_H_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_H_MAX_TOKENS,
    temperature: FAMILY_H_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
