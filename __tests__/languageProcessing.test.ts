/**
 * Language-processing scaffold tests.
 * No network calls. No live Supabase. No Anthropic key required.
 */
import {
  LanguageProcessingInputSchema,
  LanguageProcessingResultSchema,
  ALLOWED_FLAGS,
  ALLOWED_TRANSCRIPT_ISSUES,
} from '../src/features/languageProcessing/schema';
import { runMockLanguageProcessing } from '../src/features/languageProcessing/mockProvider';
import { processWithConfiguredProviderSync } from '../src/features/languageProcessing/providers';
import {
  buildAnthropicRequestBody,
  extractAnthropicContent,
  parseJsonFromContent,
  DEFAULT_LP_MODEL,
  LANGUAGE_PROCESSING_SYSTEM_PROMPT,
} from '../src/features/languageProcessing/buildAnthropicRequest';
import type { LanguageProcessingInput } from '../src/features/languageProcessing/types';
import type { ProcessLanguageDraftPayload } from '../src/lib/edgeFunctions';

// ── Fixtures ──────────────────────────────────────────────────

function makeInput(overrides: Partial<LanguageProcessingInput> = {}): LanguageProcessingInput {
  return {
    debateId: 'debate-uuid-1',
    debateResolution: 'Cats are better pets than dogs.',
    sourceKind: 'typed_draft',
    rawText: 'Cats are independent and require less maintenance than dogs.',
    ...overrides,
  };
}

// ── Input schema ──────────────────────────────────────────────

describe('LanguageProcessingInputSchema', () => {
  it('accepts valid typed_draft input', () => {
    const result = LanguageProcessingInputSchema.safeParse(makeInput());
    expect(result.success).toBe(true);
  });

  it('accepts valid transcript input with all optional fields', () => {
    const result = LanguageProcessingInputSchema.safeParse(
      makeInput({
        sourceKind: 'transcript',
        rawText: 'um so like cats are you know basically better',
        debateDescription: 'A debate about pet ownership.',
        parentArgumentId: 'parent-uuid',
        parentArgumentBody: 'Dogs are more loyal companions.',
        userSide: 'affirmative',
        currentDraft: {
          argumentType: 'rebuttal',
          selectedTagCodes: ['rebuttal'],
          targetExcerpt: 'Dogs are more loyal',
          disagreementAxis: 'value',
        },
        deterministicTopicCheck: { score: 0.8 },
        deterministicFlags: [],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects empty rawText', () => {
    const result = LanguageProcessingInputSchema.safeParse(makeInput({ rawText: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects rawText over 8 000 characters', () => {
    const result = LanguageProcessingInputSchema.safeParse(
      makeInput({ rawText: 'a'.repeat(8_001) }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects missing debateResolution', () => {
    const result = LanguageProcessingInputSchema.safeParse({
      debateId: 'x',
      sourceKind: 'typed_draft',
      rawText: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sourceKind', () => {
    const result = LanguageProcessingInputSchema.safeParse(
      makeInput({ sourceKind: 'audio' as 'typed_draft' }),
    );
    expect(result.success).toBe(false);
  });
});

// ── Result schema ─────────────────────────────────────────────

function makeValidResult(): Record<string, unknown> {
  return {
    cleanedText: 'Cats are independent and require less maintenance.',
    segments: [{ text: 'Cats are independent.', segmentType: 'claim', confidence: 0.8 }],
    suggestedArgumentType: 'claim',
    suggestedTagCodes: [],
    suggestedDisagreementAxis: null,
    targetExcerptCandidates: [],
    possibleFlags: [],
    transcriptIssues: [],
    topicRelation: { respondsToResolution: true, respondsToParent: null, score: 0.6, shortExplanation: 'Good overlap.' },
    tone: { civilityRisk: false, loadedLanguagePossible: false, shortExplanation: 'No concerns.' },
    uncertaintyLevel: 'low',
    userReviewRequired: true,
    provider: 'mock',
    model: 'mock-lexical-v1',
  };
}

describe('LanguageProcessingResultSchema', () => {
  it('accepts a valid result', () => {
    const result = LanguageProcessingResultSchema.safeParse(makeValidResult());
    expect(result.success).toBe(true);
  });

  it('rejects topicRelation.score outside 0..1', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      topicRelation: { respondsToResolution: true, respondsToParent: null, score: 1.5, shortExplanation: 'x' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects segment confidence outside 0..1', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      segments: [{ text: 'foo', segmentType: 'claim', confidence: -0.1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects forbidden flag codes not in allowed list', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      possibleFlags: ['user_is_manipulating'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects forbidden transcript issue codes not in allowed list', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      transcriptIssues: ['bad_faith_detected'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects userReviewRequired: false', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      userReviewRequired: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects cleanedText over 8 000 chars', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      cleanedText: 'x'.repeat(8_001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 targetExcerptCandidates', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      targetExcerptCandidates: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(result.success).toBe(false);
  });

  it('allows all values in ALLOWED_FLAGS', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      possibleFlags: [...ALLOWED_FLAGS],
    });
    expect(result.success).toBe(true);
  });

  it('allows all values in ALLOWED_TRANSCRIPT_ISSUES', () => {
    const result = LanguageProcessingResultSchema.safeParse({
      ...makeValidResult(),
      transcriptIssues: [...ALLOWED_TRANSCRIPT_ISSUES],
    });
    expect(result.success).toBe(true);
  });
});

// ── Mock provider ─────────────────────────────────────────────

describe('runMockLanguageProcessing', () => {
  it('returns a deterministic result for the same input', () => {
    const input = makeInput();
    const r1 = runMockLanguageProcessing(input);
    const r2 = runMockLanguageProcessing(input);
    expect(r1.cleanedText).toBe(r2.cleanedText);
    expect(r1.suggestedArgumentType).toBe(r2.suggestedArgumentType);
    expect(r1.topicRelation.score).toBe(r2.topicRelation.score);
  });

  it('always sets userReviewRequired to true', () => {
    expect(runMockLanguageProcessing(makeInput()).userReviewRequired).toBe(true);
  });

  it('sets provider to mock and model to mock-lexical-v1', () => {
    const result = runMockLanguageProcessing(makeInput());
    expect(result.provider).toBe('mock');
    expect(result.model).toBe('mock-lexical-v1');
  });

  it('detects filler words in a transcript and emits filler_words issue', () => {
    const result = runMockLanguageProcessing(
      makeInput({
        sourceKind: 'transcript',
        rawText: 'um so like cats are you know basically better than dogs because they are independent',
      }),
    );
    expect(result.transcriptIssues).toContain('filler_words');
  });

  it('cleans filler words from cleanedText', () => {
    const result = runMockLanguageProcessing(
      makeInput({ rawText: 'um cats are basically better' }),
    );
    expect(result.cleanedText).not.toMatch(/\bum\b/i);
    expect(result.cleanedText).not.toMatch(/\bbasically\b/i);
  });

  it('does not emit filler_words issue for typed_draft source', () => {
    const result = runMockLanguageProcessing(
      makeInput({ sourceKind: 'typed_draft', rawText: 'um so like cats are better' }),
    );
    expect(result.transcriptIssues).not.toContain('filler_words');
  });

  it('emits off_topic flag when text has no overlap with resolution', () => {
    const result = runMockLanguageProcessing(
      makeInput({ rawText: 'The weather today is very sunny and warm.' }),
    );
    expect(result.possibleFlags).toContain('off_topic');
  });

  it('emits civility_risk flag when civility risk words are present', () => {
    const result = runMockLanguageProcessing(
      makeInput({ rawText: 'That argument is completely stupid and idiotic.' }),
    );
    expect(result.possibleFlags).toContain('civility_risk');
    expect(result.tone.civilityRisk).toBe(true);
  });

  it('does not set any blocking action fields', () => {
    const result = runMockLanguageProcessing(makeInput()) as unknown as Record<string, unknown>;
    expect(result['blockPost']).toBeUndefined();
    expect(result['isBlocked']).toBeUndefined();
    expect(result['banUser']).toBeUndefined();
    expect(result['hideContent']).toBeUndefined();
  });

  it('detects multiple arguments and emits multiple_arguments_detected', () => {
    const result = runMockLanguageProcessing(
      makeInput({
        rawText:
          'Cats are independent. Cats are quiet. Cats are clean. Cats are affectionate too.',
      }),
    );
    expect(result.transcriptIssues).toContain('multiple_arguments_detected');
  });

  it('suggests rebuttal when text has rebuttal language and parent exists', () => {
    const result = runMockLanguageProcessing(
      makeInput({
        parentArgumentId: 'parent-1',
        parentArgumentBody: 'Dogs are loyal.',
        rawText: 'However, cats are equally loyal when raised properly.',
      }),
    );
    expect(result.suggestedArgumentType).toBe('rebuttal');
  });

  it('suggests clarification_request for a question to parent', () => {
    const result = runMockLanguageProcessing(
      makeInput({
        parentArgumentId: 'parent-1',
        parentArgumentBody: 'Dogs are loyal companions.',
        rawText: 'What evidence supports the claim that dogs are more loyal?',
      }),
    );
    expect(result.suggestedArgumentType).toBe('clarification_request');
  });

  it('returns segments array with max 20 entries', () => {
    const manySentences = Array.from({ length: 25 }, (_, i) => `Sentence ${i + 1}.`).join(' ');
    const result = runMockLanguageProcessing(makeInput({ rawText: manySentences }));
    expect(result.segments.length).toBeLessThanOrEqual(20);
  });

  it('validates mock result against LanguageProcessingResultSchema', () => {
    const result = runMockLanguageProcessing(makeInput());
    const validation = LanguageProcessingResultSchema.safeParse(result);
    expect(validation.success).toBe(true);
  });
});

// ── Provider registry ─────────────────────────────────────────

describe('processWithConfiguredProviderSync (disabled path)', () => {
  const input = makeInput();

  it('returns { enabled: false, reason: disabled } when env flag is not set', () => {
    const outcome = processWithConfiguredProviderSync(input, {});
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('disabled');
  });

  it('returns { enabled: false, reason: disabled } when flag is "false"', () => {
    const outcome = processWithConfiguredProviderSync(input, {
      AI_LANGUAGE_PROCESSING_ENABLED: 'false',
    });
    expect(outcome.enabled).toBe(false);
  });

  it('does not call Anthropic when disabled (mock provider runs cleanly)', () => {
    // Verify disabled path returns immediately without reaching any provider
    const outcome = processWithConfiguredProviderSync(input, {
      AI_LANGUAGE_PROCESSING_ENABLED: 'false',
      AI_LANGUAGE_PROCESSING_PROVIDER: 'anthropic',
    });
    expect(outcome.enabled).toBe(false);
  });

  it('runs mock provider when enabled and provider=mock', () => {
    const outcome = processWithConfiguredProviderSync(input, {
      AI_LANGUAGE_PROCESSING_ENABLED: 'true',
      AI_LANGUAGE_PROCESSING_PROVIDER: 'mock',
    });
    expect(outcome.enabled).toBe(true);
    if (outcome.enabled) {
      expect(outcome.provider).toBe('mock');
      expect(outcome.userReviewRequired).toBe(true);
    }
  });

  it('returns not_configured for anthropic (requires Edge Function in Node.js context)', () => {
    const outcome = processWithConfiguredProviderSync(input, {
      AI_LANGUAGE_PROCESSING_ENABLED: 'true',
      AI_LANGUAGE_PROCESSING_PROVIDER: 'anthropic',
    });
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_configured');
  });

  it('returns not_implemented for openai', () => {
    const outcome = processWithConfiguredProviderSync(input, {
      AI_LANGUAGE_PROCESSING_ENABLED: 'true',
      AI_LANGUAGE_PROCESSING_PROVIDER: 'openai',
    });
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_implemented');
  });

  it('returns not_configured for an unknown provider name', () => {
    const outcome = processWithConfiguredProviderSync(input, {
      AI_LANGUAGE_PROCESSING_ENABLED: 'true',
      AI_LANGUAGE_PROCESSING_PROVIDER: 'some_unknown_provider',
    });
    expect(outcome.enabled).toBe(false);
    if (!outcome.enabled) expect(outcome.reason).toBe('not_configured');
  });
});

// ── Anthropic request builder ─────────────────────────────────

describe('buildAnthropicRequestBody', () => {
  const input = makeInput();

  it('builds a request with the correct model', () => {
    const body = buildAnthropicRequestBody(input, DEFAULT_LP_MODEL);
    expect(body.model).toBe(DEFAULT_LP_MODEL);
  });

  it('uses temperature 0', () => {
    const body = buildAnthropicRequestBody(input);
    expect(body.temperature).toBe(0);
  });

  it('includes the system prompt', () => {
    const body = buildAnthropicRequestBody(input);
    expect(body.system).toBe(LANGUAGE_PROCESSING_SYSTEM_PROMPT);
  });

  it('includes debate resolution in the user message', () => {
    const body = buildAnthropicRequestBody(input);
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('Cats are better pets than dogs.');
  });

  it('includes rawText in the user message', () => {
    const body = buildAnthropicRequestBody(input);
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain(input.rawText);
  });

  it('does NOT include any API key in the request body', () => {
    const body = buildAnthropicRequestBody(input);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toMatch(/sk-ant/);
    expect(bodyStr).not.toMatch(/api_key/i);
    expect(bodyStr).not.toMatch(/ANTHROPIC_API_KEY/);
  });

  it('uses max_tokens of 900 or less', () => {
    const body = buildAnthropicRequestBody(input);
    expect(body.max_tokens).toBeLessThanOrEqual(900);
  });
});

// ── Anthropic response parser ─────────────────────────────────

describe('extractAnthropicContent', () => {
  it('extracts text from a valid Anthropic response', () => {
    const response = {
      content: [{ type: 'text', text: 'Hello world' }],
    };
    expect(extractAnthropicContent(response)).toBe('Hello world');
  });

  it('returns null for empty content array', () => {
    expect(extractAnthropicContent({ content: [] })).toBeNull();
  });

  it('returns null for malformed response', () => {
    expect(extractAnthropicContent(null)).toBeNull();
    expect(extractAnthropicContent({ no_content: true })).toBeNull();
  });
});

describe('parseJsonFromContent', () => {
  it('parses valid JSON object from content string', () => {
    const content = 'Here is the result: {"foo": "bar", "baz": 42}';
    const parsed = parseJsonFromContent(content);
    expect(parsed).toEqual({ foo: 'bar', baz: 42 });
  });

  it('returns null for content with no JSON object', () => {
    expect(parseJsonFromContent('no json here')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseJsonFromContent('{invalid json}')).toBeNull();
  });

  it('handles multiline JSON', () => {
    const content = `Result:\n{\n  "a": 1,\n  "b": "two"\n}`;
    const parsed = parseJsonFromContent(content);
    expect(parsed).toEqual({ a: 1, b: 'two' });
  });
});

// ── Result invariants ─────────────────────────────────────────

describe('Result invariants', () => {
  it('mock result always has userReviewRequired: true', () => {
    const result = runMockLanguageProcessing(makeInput());
    expect(result.userReviewRequired).toBe(true);
  });

  it('mock result schema enforces userReviewRequired: true', () => {
    const validated = LanguageProcessingResultSchema.safeParse({
      ...runMockLanguageProcessing(makeInput()),
      userReviewRequired: true,
    });
    expect(validated.success).toBe(true);
  });

  it('result schema cannot accept userReviewRequired: false', () => {
    const validated = LanguageProcessingResultSchema.safeParse({
      ...runMockLanguageProcessing(makeInput()),
      userReviewRequired: false,
    });
    expect(validated.success).toBe(false);
  });

  it('result has no field that represents a blocking action', () => {
    const result = runMockLanguageProcessing(makeInput()) as unknown as Record<string, unknown>;
    const forbiddenFields = [
      'blockPost', 'isBlocked', 'banUser', 'hideContent',
      'deleteContent', 'debate_winner', 'bad_faith_detected',
      'argument_is_true', 'argument_is_false', 'user_should_be_banned',
    ];
    for (const field of forbiddenFields) {
      expect(result[field]).toBeUndefined();
    }
  });
});

// ── processLanguageDraft client wrapper ───────────────────────

describe('processLanguageDraft payload type', () => {
  it('ProcessLanguageDraftPayload maps required fields correctly', () => {
    const payload: ProcessLanguageDraftPayload = {
      debateId: 'debate-uuid-1',
      debateResolution: 'Cats are better pets than dogs.',
      sourceKind: 'typed_draft',
      rawText: 'Cats are more independent.',
    };
    expect(payload.debateId).toBe('debate-uuid-1');
    expect(payload.sourceKind).toBe('typed_draft');
    expect(payload.rawText).toBeTruthy();
  });

  it('ProcessLanguageDraftPayload accepts all optional fields', () => {
    const payload: ProcessLanguageDraftPayload = {
      debateId: 'debate-uuid-1',
      debateResolution: 'Cats are better pets.',
      sourceKind: 'transcript',
      rawText: 'um cats are better',
      debateDescription: 'A pet debate.',
      parentArgumentId: 'parent-1',
      parentArgumentBody: 'Dogs are loyal.',
      userSide: 'affirmative',
      currentDraft: {
        argumentType: 'rebuttal',
        selectedTagCodes: ['rebuttal'],
        targetExcerpt: 'Dogs are loyal',
        disagreementAxis: 'value',
      },
      deterministicTopicCheck: { score: 0.5 },
      deterministicFlags: [],
    };
    expect(payload.sourceKind).toBe('transcript');
    expect(payload.currentDraft?.argumentType).toBe('rebuttal');
  });
});
