/**
 * MCP-SERVER-008-FAMILY-G — Family G boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family G-specific prompt
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
 * Per design §A.2: MAX_TOKENS=1500 (matches Family A/B/C/E/F; NO bump). The
 * conservative-positives bias keeps the realistic positive-sparse output far
 * under budget on 18 keys (Family D already ships 19 ai_classifier keys at
 * 1500 with no truncation).
 */
import { callAnthropic } from './anthropicCall.ts';
import type { AnthropicCallResult } from './anthropicCall.ts';
import {
  FAMILY_G_SYSTEM_PROMPT,
  FAMILY_G_MAX_TOKENS,
  FAMILY_G_TEMPERATURE,
  buildFamilyGUserPrompt,
} from './familyGPrompt.ts';
import type { ValidatedFamilyGRequest } from './familyGPrompt.ts';

/**
 * Run the Family G boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family G request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyGClassifier(
  request: ValidatedFamilyGRequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyGUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_G_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_G_MAX_TOKENS,
    temperature: FAMILY_G_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
