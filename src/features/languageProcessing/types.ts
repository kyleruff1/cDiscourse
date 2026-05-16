/**
 * Provider-neutral types for the language-processing scaffold.
 * Pure TypeScript — no runtime imports.
 *
 * MIRROR: supabase/functions/_shared/languageProcessing/types.ts
 * Only difference from the _shared mirror: no .ts extensions (Node.js / Jest compatible).
 * Keep both files in sync.
 */

export type LanguageProcessingProviderName = 'anthropic' | 'openai' | 'mock';

export type ArgumentTypeSuggestion =
  | 'thesis'
  | 'claim'
  | 'rebuttal'
  | 'counter_rebuttal'
  | 'evidence'
  | 'clarification_request'
  | 'concession'
  | 'synthesis';

export type DisagreementAxisSuggestion =
  | 'fact'
  | 'definition'
  | 'causal'
  | 'value'
  | 'evidence'
  | 'logic'
  | 'scope';

export type SegmentType =
  | 'claim'
  | 'evidence'
  | 'question'
  | 'concession'
  | 'rebuttal'
  | 'filler'
  | 'unclear';

export type UncertaintyLevel = 'low' | 'medium' | 'high';

export type LanguageProcessingFlagCode =
  | 'weak_topic_satisfaction'
  | 'off_topic'
  | 'scope_challenge'
  | 'tangent_shift_possible'
  | 'loaded_clarification_possible'
  | 'civility_risk'
  | 'ad_hominem_possible'
  | 'fact_confusion_possible'
  | 'unclear_claim'
  | 'needs_moderator_review';

export type TranscriptIssueCode =
  | 'filler_words'
  | 'incomplete_sentence'
  | 'unclear_reference'
  | 'missing_context'
  | 'possible_transcription_error'
  | 'multiple_arguments_detected'
  | 'unsupported_factual_claim_possible'
  | 'source_needed';

export interface LanguageProcessingInput {
  debateId: string;
  debateResolution: string;
  debateDescription?: string;
  parentArgumentId?: string | null;
  parentArgumentBody?: string | null;
  sourceKind: 'typed_draft' | 'transcript';
  rawText: string;
  userSide?: 'affirmative' | 'negative' | 'neutral';
  currentDraft?: {
    argumentType?: string | null;
    selectedTagCodes?: string[];
    targetExcerpt?: string | null;
    disagreementAxis?: string | null;
  };
  deterministicTopicCheck?: unknown;
  deterministicFlags?: unknown[];
}

export interface LanguageProcessingSegment {
  text: string;
  segmentType: SegmentType;
  confidence: number;
}

export interface LanguageProcessingResult {
  cleanedText: string;
  segments: LanguageProcessingSegment[];
  suggestedArgumentType: ArgumentTypeSuggestion | null;
  suggestedTagCodes: string[];
  suggestedDisagreementAxis: DisagreementAxisSuggestion | null;
  targetExcerptCandidates: string[];
  possibleFlags: LanguageProcessingFlagCode[];
  transcriptIssues: TranscriptIssueCode[];
  topicRelation: {
    respondsToResolution: boolean;
    respondsToParent: boolean | null;
    score: number;
    shortExplanation: string;
  };
  tone: {
    civilityRisk: boolean;
    loadedLanguagePossible: boolean;
    shortExplanation: string;
  };
  uncertaintyLevel: UncertaintyLevel;
  userReviewRequired: true;
  provider: LanguageProcessingProviderName;
  model: string;
  rawPayloadSanitized?: unknown;
}

export interface LanguageProcessingDisabledResult {
  enabled: false;
  reason: 'disabled' | 'not_configured' | 'not_implemented' | 'key_missing';
}

export type LanguageProcessingOutcome =
  | ({ enabled: true } & LanguageProcessingResult)
  | LanguageProcessingDisabledResult;
