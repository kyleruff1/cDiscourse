/**
 * MCP-016 — Semantic referee boundary Zod validators (Deno-side).
 *
 * Deno-compatible: uses `npm:zod@4` — the exact specifier
 * `process-language-draft/_shared/languageProcessing/schema.ts` uses. Mixing
 * zod versions inside `_shared/` is a footgun (MCP-016 design §"Zod version").
 *
 * Exports two validators:
 *   - `ClassifyMoveRequestSchema`  — inbound request body.
 *   - `SemanticRefereePacketSchema` — outbound packet, validated before it
 *     leaves the function. This is the Deno twin of MCP-011's
 *     `semanticRefereeValidator.ts` STRUCTURAL layer.
 *
 * Doctrine the outbound schema enforces structurally (MCP-001 §7,
 * cdiscourse-doctrine §1):
 *   - `authoritative` is pinned to `z.literal(false)`.
 *   - every nested object is `.strict()` — a smuggled `block` field, a truth
 *     field, a `winner` field FAIL validation. The boundary cannot, by
 *     construction, return something that hard-gates a post.
 *   - `binaries[].value` is `z.union([z.literal(0), z.literal(1)])`.
 *   - `scoreHints` integers are pinned to `0..3`.
 */
import { z } from 'npm:zod@4';

import {
  ALL_FRICTION_SUGGESTIONS,
  ALL_ROUTE_SUGGESTIONS,
  ALL_SEMANTIC_CLASSIFIER_IDS,
  ALL_SEMANTIC_PROVIDERS,
  MAX_COPY_FIELD_LEN,
  MAX_STRING_FIELD_LEN,
  PACKET_VERSION,
  SCORE_HINT_MAX,
  SCORE_HINT_MIN,
} from './types.ts';

// ── Shared bounds ─────────────────────────────────────────────────

/** Body cap — matches process-language-draft's RAW_TEXT_MAX. */
export const MOVE_BODY_MAX = 8_000;

/** MCP-001 §9 caps a packet prompt at 5 classifiers. */
export const MAX_REQUESTED_CLASSIFIERS = 5;

const CLASSIFIER_ID_VALUES = ALL_SEMANTIC_CLASSIFIER_IDS as readonly [string, ...string[]];
const ROUTE_VALUES = ALL_ROUTE_SUGGESTIONS as readonly [string, ...string[]];
const FRICTION_VALUES = ALL_FRICTION_SUGGESTIONS as readonly [string, ...string[]];
const PROVIDER_VALUES = ALL_SEMANTIC_PROVIDERS as readonly [string, ...string[]];

// ── Inbound request schema ────────────────────────────────────────

/**
 * `ClassifyMoveRequestSchema` — `.strict()`, so any unknown top-level key
 * fails validation (`validation_failed`). Empty `moveBodyRedacted`, an
 * over-length body, an empty / over-5 / unknown-id `requestedClassifiers`
 * array all fail.
 */
export const ClassifyMoveRequestSchema = z
  .object({
    roomId: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    moveId: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    parentId: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    moveBodyRedacted: z.string().min(1, 'moveBodyRedacted must not be empty').max(MOVE_BODY_MAX),
    parentBodyRedacted: z.string().max(MOVE_BODY_MAX).optional(),
    roomContext: z
      .object({
        debateMode: z.string().max(MAX_STRING_FIELD_LEN).optional(),
        selectedAction: z.string().max(MAX_STRING_FIELD_LEN).optional(),
        selectedMoveType: z.string().max(MAX_STRING_FIELD_LEN).optional(),
        side: z.enum(['affirmative', 'negative', 'observer', 'moderator']).optional(),
        actorRole: z.enum(['initiator', 'primary_opponent', 'chime_in', 'observer']).optional(),
      })
      .strict(),
    requestedClassifiers: z
      .array(z.enum(CLASSIFIER_ID_VALUES))
      .min(1, 'requestedClassifiers must contain at least one classifier')
      .max(MAX_REQUESTED_CLASSIFIERS, 'requestedClassifiers caps at 5'),
    promptVersionHint: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    contentHash: z.string().min(1).max(MAX_STRING_FIELD_LEN),
  })
  .strict();

// ── Outbound packet schema ────────────────────────────────────────

/** One binary sample. `.strict()` — a smuggled field fails. */
const BinarySampleSchema = z
  .object({
    classifierId: z.enum(CLASSIFIER_ID_VALUES),
    value: z.union([z.literal(0), z.literal(1)]),
    confidence: z.enum(['low', 'medium', 'high']),
    reasonCode: z.string().min(1).max(MAX_COPY_FIELD_LEN),
    evidenceSpan: z.string().max(MAX_COPY_FIELD_LEN).optional(),
    parentSpan: z.string().max(MAX_COPY_FIELD_LEN).optional(),
  })
  .strict();

/** `scoreHints` — `.strict()` object of six integers, each `0..3`. */
const ScoreHintsSchema = z
  .object({
    continuityCredit: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    evidencePressure: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    branchHygiene: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    synthesisReadiness: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    sourceChainDebt: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    unresolvedRedirectRisk: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
  })
  .strict();

/**
 * `SemanticRefereePacketSchema` — the outbound contract wall. `.strict()`
 * everywhere; `authoritative` is `z.literal(false)`; `packetVersion` is the
 * exact contract version. Any widened packet — a `block` field, a truth field,
 * a `winner` — FAILS validation. The function then returns a deterministic
 * minimal fallback packet, never a thrown error.
 */
export const SemanticRefereePacketSchema = z
  .object({
    packetVersion: z.literal(PACKET_VERSION),
    promptVersion: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    modelVersion: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    provider: z.enum(PROVIDER_VALUES),
    authoritative: z.literal(false),
    inputHash: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    contentHash: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    roomId: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    moveId: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    parentId: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    selectedAction: z.string().max(MAX_STRING_FIELD_LEN).optional(),
    selectedMoveType: z.string().max(MAX_STRING_FIELD_LEN).optional(),
    debateMode: z.string().max(MAX_STRING_FIELD_LEN).optional(),
    binaries: z.array(BinarySampleSchema),
    routeSuggestion: z.enum(ROUTE_VALUES),
    frictionSuggestion: z.enum(FRICTION_VALUES),
    scoreHints: ScoreHintsSchema,
  })
  .strict();

export type ClassifyMoveRequestParsed = z.infer<typeof ClassifyMoveRequestSchema>;
export type SemanticRefereePacketParsed = z.infer<typeof SemanticRefereePacketSchema>;
