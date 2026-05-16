/**
 * Zod validation schemas for language-processing input and result.
 * Node.js-compatible: uses regular zod import (for Jest tests and client-side use).
 *
 * MIRROR: supabase/functions/_shared/languageProcessing/schema.ts
 * Only difference: uses regular zod instead of npm:zod@4.
 * Keep both files in sync.
 */
import { z } from 'zod';

// ── Constants ─────────────────────────────────────────────────

export const ALLOWED_FLAGS = [
  'weak_topic_satisfaction',
  'off_topic',
  'scope_challenge',
  'tangent_shift_possible',
  'loaded_clarification_possible',
  'civility_risk',
  'ad_hominem_possible',
  'fact_confusion_possible',
  'unclear_claim',
  'needs_moderator_review',
] as const;

export const ALLOWED_TRANSCRIPT_ISSUES = [
  'filler_words',
  'incomplete_sentence',
  'unclear_reference',
  'missing_context',
  'possible_transcription_error',
  'multiple_arguments_detected',
  'unsupported_factual_claim_possible',
  'source_needed',
] as const;

export const ARGUMENT_TYPES = [
  'thesis',
  'claim',
  'rebuttal',
  'counter_rebuttal',
  'evidence',
  'clarification_request',
  'concession',
  'synthesis',
] as const;

export const DISAGREEMENT_AXES = [
  'fact',
  'definition',
  'causal',
  'value',
  'evidence',
  'logic',
  'scope',
] as const;

const RAW_TEXT_MAX = 8_000;
const CLEANED_TEXT_MAX = 8_000;
const MAX_SEGMENTS = 20;
const MAX_EXCERPT_CANDIDATES = 5;

// ── Input schema ──────────────────────────────────────────────

export const LanguageProcessingInputSchema = z.object({
  debateId: z.string().min(1),
  debateResolution: z.string().min(1),
  debateDescription: z.string().optional(),
  parentArgumentId: z.string().nullable().optional(),
  parentArgumentBody: z.string().nullable().optional(),
  sourceKind: z.enum(['typed_draft', 'transcript']),
  rawText: z.string().min(1, 'rawText must not be empty').max(RAW_TEXT_MAX),
  userSide: z.enum(['affirmative', 'negative', 'neutral']).optional(),
  currentDraft: z
    .object({
      argumentType: z.string().nullable().optional(),
      selectedTagCodes: z.array(z.string()).optional(),
      targetExcerpt: z.string().nullable().optional(),
      disagreementAxis: z.string().nullable().optional(),
    })
    .optional(),
  deterministicTopicCheck: z.unknown().optional(),
  deterministicFlags: z.array(z.unknown()).optional(),
});

// ── Segment sub-schema ────────────────────────────────────────

const SegmentSchema = z.object({
  text: z.string(),
  segmentType: z.enum(['claim', 'evidence', 'question', 'concession', 'rebuttal', 'filler', 'unclear']),
  confidence: z.number().min(0).max(1),
});

// ── Result schema ─────────────────────────────────────────────

export const LanguageProcessingResultSchema = z.object({
  cleanedText: z.string().max(CLEANED_TEXT_MAX),
  segments: z.array(SegmentSchema).max(MAX_SEGMENTS),
  suggestedArgumentType: z.enum(ARGUMENT_TYPES).nullable(),
  suggestedTagCodes: z.array(z.string()),
  suggestedDisagreementAxis: z.enum(DISAGREEMENT_AXES).nullable(),
  targetExcerptCandidates: z.array(z.string()).max(MAX_EXCERPT_CANDIDATES),
  possibleFlags: z.array(z.enum(ALLOWED_FLAGS)),
  transcriptIssues: z.array(z.enum(ALLOWED_TRANSCRIPT_ISSUES)),
  topicRelation: z.object({
    respondsToResolution: z.boolean(),
    respondsToParent: z.boolean().nullable(),
    score: z.number().min(0).max(1),
    shortExplanation: z.string(),
  }),
  tone: z.object({
    civilityRisk: z.boolean(),
    loadedLanguagePossible: z.boolean(),
    shortExplanation: z.string(),
  }),
  uncertaintyLevel: z.enum(['low', 'medium', 'high']),
  userReviewRequired: z.literal(true),
  provider: z.enum(['anthropic', 'openai', 'mock']),
  model: z.string(),
  rawPayloadSanitized: z.unknown().optional(),
});

export type LanguageProcessingInputParsed = z.infer<typeof LanguageProcessingInputSchema>;
export type LanguageProcessingResultParsed = z.infer<typeof LanguageProcessingResultSchema>;
