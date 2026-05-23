/**
 * Mock language-processing provider.
 * Pure TypeScript — no network calls, no env reads, deterministic output.
 *
 * MIRROR: supabase/functions/_shared/languageProcessing/mockProvider.ts
 * Only difference: import paths have no .ts extensions (Node.js / Jest compatible).
 * Keep both files in sync.
 */
import type {
  LanguageProcessingInput,
  LanguageProcessingResult,
  LanguageProcessingSegment,
  LanguageProcessingFlagCode,
  TranscriptIssueCode,
  ArgumentTypeSuggestion,
} from './types';

const FILLER_PATTERN = /\b(um+|uh+|like|you know|basically|literally|right\?|so+|well|kind of|sort of|i mean)\b/gi;

const CIVILITY_RISK_WORDS = [
  'idiot', 'stupid', 'moron', 'fool', 'liar',
  'ridiculous', 'absurd', 'dumb', 'ignorant',
];

const EVIDENCE_TRIGGERS = [
  'according to', 'study shows', 'research shows', 'data shows',
  'statistics', 'survey', 'report', 'cited', 'source:', 'see:',
];

const CONCESSION_TRIGGERS = [
  'i admit', 'i concede', 'you are right', 'you\'re right',
  'that is a fair point', 'that\'s a fair point', 'granted',
  'i acknowledge',
];

const REBUTTAL_TRIGGERS = [
  'however', 'on the contrary', 'that is wrong', 'that\'s wrong',
  'i disagree', 'this is incorrect', 'actually,',
];

function removeFillers(raw: string): string {
  return raw.replace(FILLER_PATTERN, ' ').replace(/\s{2,}/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function classifySegment(sentence: string): LanguageProcessingSegment {
  const lower = sentence.toLowerCase();
  if (sentence.trim().endsWith('?')) {
    return { text: sentence, segmentType: 'question', confidence: 0.85 };
  }
  if (EVIDENCE_TRIGGERS.some((t) => lower.includes(t))) {
    return { text: sentence, segmentType: 'evidence', confidence: 0.65 };
  }
  if (CONCESSION_TRIGGERS.some((t) => lower.includes(t))) {
    return { text: sentence, segmentType: 'concession', confidence: 0.75 };
  }
  if (REBUTTAL_TRIGGERS.some((t) => lower.includes(t))) {
    return { text: sentence, segmentType: 'rebuttal', confidence: 0.6 };
  }
  if (sentence.length < 8) {
    return { text: sentence, segmentType: 'filler', confidence: 0.8 };
  }
  return { text: sentence, segmentType: 'claim', confidence: 0.5 };
}

function lexicalOverlap(text: string, reference: string): number {
  const textWords = new Set(
    text.toLowerCase().split(/\W+/).filter((w) => w.length > 3),
  );
  const refWords = reference
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  if (refWords.length === 0) return 0;
  const matched = refWords.filter((w) => textWords.has(w)).length;
  return Math.min(1, matched / refWords.length);
}

export function runMockLanguageProcessing(
  input: LanguageProcessingInput,
): LanguageProcessingResult {
  const { rawText, debateResolution, parentArgumentBody, parentArgumentId, sourceKind } = input;

  const cleanedText = removeFillers(rawText);
  const sentences = splitSentences(rawText);
  const segments: LanguageProcessingSegment[] = sentences.slice(0, 20).map(classifySegment);

  const hasFillers = FILLER_PATTERN.test(rawText);
  FILLER_PATTERN.lastIndex = 0;

  const hasIncomplete = sentences.some((s) => s.length < 8 && !s.match(/[.!?]$/));
  const claimCount = segments.filter((s) => s.segmentType === 'claim').length;
  const hasMultipleArgs = claimCount > 2;

  const transcriptIssues: TranscriptIssueCode[] = [];
  if (hasFillers && sourceKind === 'transcript') transcriptIssues.push('filler_words');
  if (hasIncomplete) transcriptIssues.push('incomplete_sentence');
  if (hasMultipleArgs) transcriptIssues.push('multiple_arguments_detected');

  const topicScore = lexicalOverlap(rawText, debateResolution);
  const respondsToParent = parentArgumentBody
    ? lexicalOverlap(rawText, parentArgumentBody) > 0.1
    : null;

  const possibleFlags: LanguageProcessingFlagCode[] = [];
  if (topicScore < 0.05) possibleFlags.push('off_topic');
  else if (topicScore < 0.25) possibleFlags.push('weak_topic_satisfaction');

  const hasCivilityRisk = CIVILITY_RISK_WORDS.some((w) =>
    rawText.toLowerCase().includes(w),
  );
  if (hasCivilityRisk) possibleFlags.push('civility_risk');

  const questionCount = segments.filter((s) => s.segmentType === 'question').length;
  const evidenceCount = segments.filter((s) => s.segmentType === 'evidence').length;
  const rebuttalCount = segments.filter((s) => s.segmentType === 'rebuttal').length;
  const concessionCount = segments.filter((s) => s.segmentType === 'concession').length;

  let suggestedArgumentType: ArgumentTypeSuggestion | null = null;
  if (parentArgumentId) {
    if (rebuttalCount > 0) suggestedArgumentType = 'rebuttal';
    else if (concessionCount > 0) suggestedArgumentType = 'concession';
    else if (questionCount > 0) suggestedArgumentType = 'clarification_request';
    else if (evidenceCount > 0) suggestedArgumentType = 'evidence';
    else suggestedArgumentType = 'claim';
  } else {
    suggestedArgumentType = evidenceCount > 0 ? 'evidence' : 'claim';
  }

  const uncertaintyLevel =
    topicScore < 0.1 ? 'high' : topicScore < 0.3 ? 'medium' : 'low';

  const topicExplanation =
    topicScore < 0.05
      ? 'Low lexical overlap with argument resolution.'
      : topicScore < 0.25
      ? 'Moderate lexical overlap with argument resolution.'
      : 'Good lexical overlap with argument resolution.';

  return {
    cleanedText,
    segments,
    suggestedArgumentType,
    suggestedTagCodes: [],
    suggestedDisagreementAxis: null,
    targetExcerptCandidates: [],
    possibleFlags,
    transcriptIssues,
    topicRelation: {
      respondsToResolution: topicScore >= 0.05,
      respondsToParent,
      score: topicScore,
      shortExplanation: topicExplanation,
    },
    tone: {
      civilityRisk: hasCivilityRisk,
      loadedLanguagePossible: false,
      shortExplanation: hasCivilityRisk
        ? 'Possible civility risk detected by keyword heuristic. Review before submitting.'
        : 'No obvious tone concerns detected.',
    },
    uncertaintyLevel,
    userReviewRequired: true,
    provider: 'mock',
    model: 'mock-lexical-v1',
  };
}
