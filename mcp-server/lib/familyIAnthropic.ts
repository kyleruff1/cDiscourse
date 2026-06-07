/**
 * MCP-SERVER-010-FAMILY-I — Family I boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family I-specific prompt
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
 * Per design §A.2: MAX_TOKENS=1500 (matches Family A/B/C/E/F/G/H; NO bump). The
 * conservative-positives bias keeps the realistic positive-sparse output far
 * under budget on 6 keys — I has ~990 token headroom, the largest absolute
 * headroom of any family A-I to date.
 */
import { callAnthropic } from './anthropicCall.ts';
import type { AnthropicCallResult } from './anthropicCall.ts';
import {
  FAMILY_I_SYSTEM_PROMPT,
  FAMILY_I_MAX_TOKENS,
  FAMILY_I_TEMPERATURE,
  buildFamilyIUserPrompt,
} from './familyIPrompt.ts';
import type { ValidatedFamilyIRequest } from './familyIPrompt.ts';

/**
 * Run the Family I boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family I request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyIClassifier(
  request: ValidatedFamilyIRequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyIUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_I_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_I_MAX_TOKENS,
    temperature: FAMILY_I_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
