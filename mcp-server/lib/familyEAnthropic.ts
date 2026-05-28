/**
 * MCP-SERVER-006-FAMILY-E — Family E boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family E-specific prompt
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
 * Per design §2: MAX_TOKENS=1500 (matches Family A/B/C; NO bump). ~60 token
 * headroom on 16 keys × ~85 tokens per key.
 */
import { callAnthropic } from './anthropicCall.ts';
import type { AnthropicCallResult } from './anthropicCall.ts';
import {
  FAMILY_E_SYSTEM_PROMPT,
  FAMILY_E_MAX_TOKENS,
  FAMILY_E_TEMPERATURE,
  buildFamilyEUserPrompt,
} from './familyEPrompt.ts';
import type { ValidatedFamilyERequest } from './familyEPrompt.ts';

/**
 * Run the Family E boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family E request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyEClassifier(
  request: ValidatedFamilyERequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyEUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_E_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_E_MAX_TOKENS,
    temperature: FAMILY_E_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
