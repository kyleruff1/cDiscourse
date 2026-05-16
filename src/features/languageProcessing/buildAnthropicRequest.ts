/**
 * Pure request-builder for the Anthropic language-processing API call.
 * No network calls. No Deno.env. Testable in Node.js / Jest.
 *
 * Mirrors the logic in supabase/functions/_shared/languageProcessing/anthropicProvider.ts
 * (buildAnthropicRequestBody). Keep in sync if the prompt changes.
 */
import type { LanguageProcessingInput } from './types';

export const DEFAULT_LP_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 900;

export const LANGUAGE_PROCESSING_SYSTEM_PROMPT = `You are a transcript language-processing assistant for a structured debate application.
Your task is to analyze rough spoken or typed text and return structured draft suggestions.

Absolute rules:
- You do NOT decide who is right or wrong in a debate.
- You do NOT decide the winner of any debate.
- You do NOT infer user intent as fact.
- You do NOT recommend banning users.
- You do NOT recommend hiding, deleting, or modifying user content.
- You do NOT submit content on behalf of users.
- You do NOT override deterministic Constitution rules.
- You ONLY classify observable language features.

The user MUST review all suggestions before anything is submitted.
userReviewRequired must always be true in your response.

Forbidden labels — never include these concepts in your response:
user_is_manipulating, argument_is_true, argument_is_false, user_should_be_banned,
content_should_be_hidden, debate_winner, bad_faith_detected.`;

function buildUserPrompt(input: LanguageProcessingInput): string {
  const lines: string[] = [`Debate resolution: ${input.debateResolution}`];
  if (input.debateDescription) lines.push(`Debate description: ${input.debateDescription}`);
  if (input.parentArgumentBody) {
    lines.push(`Parent argument:\n${input.parentArgumentBody}`);
  }
  lines.push(`Source kind: ${input.sourceKind}`);
  if (input.userSide) lines.push(`User's debate side: ${input.userSide}`);
  lines.push(`Text to process:\n${input.rawText}`);
  return lines.join('\n\n');
}

/**
 * Build the JSON body for an Anthropic Messages API request.
 * Does not include the API key — caller adds that to request headers.
 */
export function buildAnthropicRequestBody(
  input: LanguageProcessingInput,
  model: string = DEFAULT_LP_MODEL,
): Record<string, unknown> {
  return {
    model,
    max_tokens: MAX_TOKENS,
    temperature: 0,
    system: LANGUAGE_PROCESSING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  };
}

/**
 * Extract the text content from an Anthropic API response object.
 * Returns null if the response structure is unexpected.
 * Pure — no network calls.
 */
export function extractAnthropicContent(
  responseJson: unknown,
): string | null {
  try {
    const content = (responseJson as { content?: Array<{ type: string; text: string }> }).content;
    return content?.find((c) => c.type === 'text')?.text ?? null;
  } catch {
    return null;
  }
}

/**
 * Parse a JSON object from Anthropic text content.
 * Returns the parsed object or null on failure.
 * Pure — no network calls.
 */
export function parseJsonFromContent(contentText: string): unknown | null {
  try {
    const match = contentText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
