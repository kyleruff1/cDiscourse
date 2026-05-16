/**
 * Provider-neutral types for the language-processing scaffold.
 * Pure TypeScript — no runtime imports.
 * Safe to run in Deno, Node.js, or any JS environment.
 *
 * MIRROR: src/features/languageProcessing/types.ts
 * Only difference from the src mirror: import paths use .ts extensions for Deno.
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

/** Allowed flag codes for language-processing results. Must use "possible" framing. */
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

/** Observable issues in transcript or rough-draft input. */
export type TranscriptIssueCode =
  | 'filler_words'
  | 'incomplete_sentence'
  | 'unclear_reference'
  | 'missing_context'
  | 'possible_transcription_error'
  | 'multiple_arguments_detected'
  | 'unsupported_factual_claim_possible'
  | 'source_needed';

/**
 * Input to the language-processing scaffold.
 * Carries debate context, parent context, and the raw text to be processed.
 */
export interface LanguageProcessingInput {
  debateId: string;
  debateResolution: string;
  debateDescription?: string;
  parentArgumentId?: string | null;
  parentArgumentBody?: string | null;
  /** 'transcript' = rough spoken text; 'typed_draft' = typed input */
  sourceKind: 'typed_draft' | 'transcript';
  /** The raw text to process. Max 8 000 chars. */
  rawText: string;
  userSide?: 'affirmative' | 'negative' | 'neutral';
  currentDraft?: {
    argumentType?: string | null;
    selectedTagCodes?: string[];
    targetExcerpt?: string | null;
    disagreementAxis?: string | null;
  };
  /** Output from the deterministic topic check (advisory context only). */
  deterministicTopicCheck?: unknown;
  /** Output from deterministic flag evaluation (advisory context only). */
  deterministicFlags?: unknown[];
}

export interface LanguageProcessingSegment {
  text: string;
  segmentType: SegmentType;
  /** Confidence in the classification. 0..1 */
  confidence: number;
}

/**
 * Structured draft suggestions returned by a language-processing provider.
 *
 * Security invariants:
 * - userReviewRequired is always true — AI is advisory only.
 * - No field represents a blocking action, ban, or content removal.
 * - "possibleFlags" uses "possible" framing; none are authoritative.
 * - Deterministic Constitution checks remain primary.
 */
export interface LanguageProcessingResult {
  /** Grammar-cleaned version of rawText. Filler words removed. No content altered. */
  cleanedText: string;
  /** Sentence-level classification. Max 20 segments. */
  segments: LanguageProcessingSegment[];
  /** Suggested argument type for the composer. Null = uncertain. */
  suggestedArgumentType: ArgumentTypeSuggestion | null;
  /** Suggested tag codes. User must confirm. */
  suggestedTagCodes: string[];
  /** Suggested disagreement axis. Null = not applicable. */
  suggestedDisagreementAxis: DisagreementAxisSuggestion | null;
  /** Excerpts from the parent argument that may match the draft's target. Max 5. */
  targetExcerptCandidates: string[];
  /** Possible advisory flags. Never blocking on their own. */
  possibleFlags: LanguageProcessingFlagCode[];
  /** Observable issues in the source text. */
  transcriptIssues: TranscriptIssueCode[];
  topicRelation: {
    respondsToResolution: boolean;
    respondsToParent: boolean | null;
    /** Lexical or semantic score. 0..1 */
    score: number;
    shortExplanation: string;
  };
  tone: {
    civilityRisk: boolean;
    loadedLanguagePossible: boolean;
    shortExplanation: string;
  };
  uncertaintyLevel: UncertaintyLevel;
  /** Always true. The user must review all suggestions before submitting. */
  userReviewRequired: true;
  provider: LanguageProcessingProviderName;
  model: string;
  /** Sanitized subset of the raw provider payload. No headers, no keys, no PII. */
  rawPayloadSanitized?: unknown;
}

/** Returned when language processing is disabled or unavailable. */
export interface LanguageProcessingDisabledResult {
  enabled: false;
  reason: 'disabled' | 'not_configured' | 'not_implemented' | 'key_missing';
}

export type LanguageProcessingOutcome =
  | ({ enabled: true } & LanguageProcessingResult)
  | LanguageProcessingDisabledResult;
