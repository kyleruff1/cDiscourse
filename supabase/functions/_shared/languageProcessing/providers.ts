/**
 * Provider registry for the language-processing scaffold.
 * Reads AI_LANGUAGE_PROCESSING_ENABLED and AI_LANGUAGE_PROCESSING_PROVIDER
 * from Deno.env to select the active provider.
 *
 * Disabled by default (AI_LANGUAGE_PROCESSING_ENABLED must be explicitly 'true').
 */
import type {
  LanguageProcessingInput,
  LanguageProcessingResult,
  LanguageProcessingOutcome,
} from './types.ts';
import { runMockLanguageProcessing } from './mockProvider.ts';
import { processWithAnthropic } from './anthropicProvider.ts';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function unavailableFallback(
  input: LanguageProcessingInput,
  model: string,
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
      shortExplanation: 'Provider encountered an error.',
    },
    tone: {
      civilityRisk: false,
      loadedLanguagePossible: false,
      shortExplanation: 'Provider error — review manually.',
    },
    uncertaintyLevel: 'high',
    userReviewRequired: true,
    provider: 'anthropic',
    model,
  };
}

export async function processWithConfiguredProvider(
  input: LanguageProcessingInput,
): Promise<LanguageProcessingOutcome> {
  const enabled = Deno.env.get('AI_LANGUAGE_PROCESSING_ENABLED');
  if (enabled !== 'true') {
    return { enabled: false, reason: 'disabled' };
  }

  const providerName = Deno.env.get('AI_LANGUAGE_PROCESSING_PROVIDER') ?? 'anthropic';

  if (providerName === 'mock') {
    return { enabled: true, ...runMockLanguageProcessing(input) };
  }

  if (providerName === 'anthropic') {
    const model = Deno.env.get('AI_LANGUAGE_PROCESSING_MODEL') ?? DEFAULT_MODEL;
    const result = await processWithAnthropic(input);
    if ('type' in result && result.type === 'unavailable') {
      if (result.reason === 'key_missing') {
        return { enabled: false, reason: 'key_missing' };
      }
      return { enabled: true, ...unavailableFallback(input, model) };
    }
    return { enabled: true, ...(result as LanguageProcessingResult) };
  }

  if (providerName === 'openai') {
    return { enabled: false, reason: 'not_implemented' };
  }

  return { enabled: false, reason: 'not_configured' };
}
