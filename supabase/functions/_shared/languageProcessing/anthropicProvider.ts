/**
 * Anthropic language-processing provider.
 * Server-only — runs inside the process-language-draft Edge Function.
 * Never called from client code. Never logs API keys.
 *
 * Reads from Deno.env:
 *   ANTHROPIC_API_KEY           — required; returns unavailable if missing
 *   AI_LANGUAGE_PROCESSING_MODEL — optional; defaults to claude-haiku-4-5-20251001
 */
import type { LanguageProcessingInput, LanguageProcessingResult } from './types.ts';
import { LanguageProcessingResultSchema } from './schema.ts';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 900;

// ── System prompt ─────────────────────────────────────────────

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

You may assess:
- Claim structure (is there a clear, falsifiable assertion?)
- Evidence need (does it make factual claims without citing a source?)
- Parent responsiveness (does this text respond to the parent argument?)
- Topic relation to the debate resolution
- Disagreement axis (fact, definition, causal, value, evidence, logic, or scope)
- Possible clarification need (unclear references, ambiguous terms)
- Possible transcription ambiguity (filler words, incomplete sentences, multiple claims)
- Possible tone or civility risk (loaded language, possible ad hominem phrasing)

The user MUST review all suggestions before anything is submitted.
userReviewRequired must always be true in your response.

Forbidden labels — never include these concepts in your response:
user_is_manipulating, argument_is_true, argument_is_false, user_should_be_banned,
content_should_be_hidden, debate_winner, bad_faith_detected.

Return ONLY a valid JSON object matching the schema described in the user prompt.`;

// ── Request builder ───────────────────────────────────────────

function buildUserPrompt(input: LanguageProcessingInput): string {
  const lines: string[] = [
    `Argument resolution: ${input.debateResolution}`,
  ];
  if (input.debateDescription) {
    lines.push(`Argument description: ${input.debateDescription}`);
  }
  if (input.parentArgumentBody) {
    lines.push(`Parent argument (the argument being replied to):\n${input.parentArgumentBody}`);
  }
  lines.push(`Source kind: ${input.sourceKind}`);
  if (input.userSide) lines.push(`User's argument side: ${input.userSide}`);
  if (input.currentDraft?.argumentType) {
    lines.push(`User's current argument type selection: ${input.currentDraft.argumentType}`);
  }
  lines.push(`Text to process:\n${input.rawText}`);
  lines.push(`
Return a JSON object with exactly these fields:
{
  "cleanedText": string (max 8000 chars — remove filler words, fix obvious grammar; do not alter meaning),
  "segments": array max 20 of { "text": string, "segmentType": "claim"|"evidence"|"question"|"concession"|"rebuttal"|"filler"|"unclear", "confidence": number 0..1 },
  "suggestedArgumentType": "thesis"|"claim"|"rebuttal"|"counter_rebuttal"|"evidence"|"clarification_request"|"concession"|"synthesis"|null,
  "suggestedTagCodes": string[] (use only known tag codes from the app; empty array if unsure),
  "suggestedDisagreementAxis": "fact"|"definition"|"causal"|"value"|"evidence"|"logic"|"scope"|null,
  "targetExcerptCandidates": string[] max 5 (exact quoted phrases from the parent argument that this text may be targeting; empty array if no parent),
  "possibleFlags": string[] — only from: "weak_topic_satisfaction","off_topic","scope_challenge","tangent_shift_possible","loaded_clarification_possible","civility_risk","ad_hominem_possible","fact_confusion_possible","unclear_claim","needs_moderator_review",
  "transcriptIssues": string[] — only from: "filler_words","incomplete_sentence","unclear_reference","missing_context","possible_transcription_error","multiple_arguments_detected","unsupported_factual_claim_possible","source_needed",
  "topicRelation": { "respondsToResolution": boolean, "respondsToParent": boolean|null, "score": number 0..1, "shortExplanation": string },
  "tone": { "civilityRisk": boolean, "loadedLanguagePossible": boolean, "shortExplanation": string },
  "uncertaintyLevel": "low"|"medium"|"high",
  "userReviewRequired": true
}`);
  return lines.join('\n\n');
}

/** Build the Anthropic API request body. Exported for testability without network calls. */
export function buildAnthropicRequestBody(
  input: LanguageProcessingInput,
  model: string,
): Record<string, unknown> {
  return {
    model,
    max_tokens: MAX_TOKENS,
    temperature: 0,
    system: LANGUAGE_PROCESSING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  };
}

// ── Response sanitizer ────────────────────────────────────────

function sanitizeRawPayload(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return { model: r['model'], stop_reason: r['stop_reason'], usage: r['usage'] };
}

// ── Safe fallback result ──────────────────────────────────────

function highUncertaintyFallback(
  input: LanguageProcessingInput,
  model: string,
  rawPayloadSanitized?: unknown,
): LanguageProcessingResult {
  return {
    cleanedText: input.rawText,
    segments: [],
    suggestedArgumentType: null,
    suggestedTagCodes: [],
    suggestedDisagreementAxis: null,
    targetExcerptCandidates: [],
    possibleFlags: ['needs_moderator_review'],
    transcriptIssues: [],
    topicRelation: {
      respondsToResolution: false,
      respondsToParent: null,
      score: 0,
      shortExplanation: 'Provider returned unexpected format — manual review required.',
    },
    tone: {
      civilityRisk: false,
      loadedLanguagePossible: false,
      shortExplanation: 'Could not parse provider response — review manually.',
    },
    uncertaintyLevel: 'high',
    userReviewRequired: true,
    provider: 'anthropic',
    model,
    ...(rawPayloadSanitized !== undefined ? { rawPayloadSanitized } : {}),
  };
}

// ── Error type ────────────────────────────────────────────────

export interface AnthropicUnavailableError {
  type: 'unavailable';
  reason: 'key_missing' | 'api_error' | 'invalid_response';
  detail?: string;
}

// ── Main export ───────────────────────────────────────────────

export async function processWithAnthropic(
  input: LanguageProcessingInput,
): Promise<LanguageProcessingResult | AnthropicUnavailableError> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return { type: 'unavailable', reason: 'key_missing' };
  }

  const model = Deno.env.get('AI_LANGUAGE_PROCESSING_MODEL') ?? DEFAULT_MODEL;
  const requestBody = buildAnthropicRequestBody(input, model);

  let rawResponse: Response;
  try {
    rawResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    return { type: 'unavailable', reason: 'api_error', detail: String(err) };
  }

  if (!rawResponse.ok) {
    return { type: 'unavailable', reason: 'api_error', detail: `HTTP ${rawResponse.status}` };
  }

  let responseJson: unknown;
  try {
    responseJson = await rawResponse.json();
  } catch {
    return { type: 'unavailable', reason: 'invalid_response', detail: 'Failed to parse API response JSON' };
  }

  const sanitized = sanitizeRawPayload(responseJson);

  let contentText: string | undefined;
  try {
    const content = (responseJson as { content?: Array<{ type: string; text: string }> }).content;
    contentText = content?.find((c) => c.type === 'text')?.text;
  } catch {
    return highUncertaintyFallback(input, model, sanitized);
  }

  if (!contentText) {
    return highUncertaintyFallback(input, model, sanitized);
  }

  let parsed: unknown;
  try {
    const match = contentText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    parsed = JSON.parse(match[0]);
  } catch {
    // Parse failure — return safe fallback, not an error
    return highUncertaintyFallback(input, model, sanitized);
  }

  const validation = LanguageProcessingResultSchema.safeParse({
    ...(parsed as Record<string, unknown>),
    provider: 'anthropic',
    model,
    rawPayloadSanitized: sanitized,
  });

  if (!validation.success) {
    return highUncertaintyFallback(input, model, sanitized);
  }

  return validation.data;
}
