/**
 * MCP-SERVER-005-FAMILY-D — Family D boolean-observation Anthropic orchestrator.
 *
 * Wraps the shared `callAnthropic` skeleton with Family D-specific prompt
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
 * Per Stage 2B operator decision: MAX_TOKENS=1800 (300-token bump from the
 * Family A/B/C 1500 baseline). HALT if 1800 proves insufficient — do not
 * silently bump further; this is the operator-bound budget for the Subset.
 */
import { callAnthropic } from './anthropicCall.ts';
import type { AnthropicCallResult } from './anthropicCall.ts';
import {
  FAMILY_D_SYSTEM_PROMPT,
  FAMILY_D_MAX_TOKENS,
  FAMILY_D_TEMPERATURE,
  buildFamilyDUserPrompt,
} from './familyDPrompt.ts';
import type { ValidatedFamilyDRequest } from './familyDPrompt.ts';

/**
 * Run the Family D boolean-observation classifier call against Anthropic.
 *
 * @param request Validated Family D request.
 * @param requestId Server-generated correlation id.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicFamilyDClassifier(
  request: ValidatedFamilyDRequest,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicCallResult> {
  const userPrompt = buildFamilyDUserPrompt(request);
  return await callAnthropic({
    system: FAMILY_D_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: FAMILY_D_MAX_TOKENS,
    temperature: FAMILY_D_TEMPERATURE,
    toolNameForLogging: 'classify_argument_boolean_observations',
    requestId,
    perToolTimeoutMs: request.timeoutMs,
    fetchImpl,
  });
}
