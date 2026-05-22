/**
 * MCP-019 — Room-state → MCP-012 trigger-input adapter.
 *
 * Turns the argument room's own state (room id, move id, participant side)
 * into the `TriggerEvaluationInput` MCP-012's `evaluateTrigger` consumes, and
 * declares the curated `post_submit` classifier set. The room component does
 * NOT hand-assemble MCP-012 inputs — it calls these pure helpers.
 *
 * This module is PURE TYPESCRIPT — no network, no React, no Supabase, no
 * `Deno`, no env, no `async`. It imports types only from MCP-011/MCP-012.
 *
 * Doctrine (MCP-019 §2, §4, §6):
 *   - MCP-019 wires exactly ONE moment: `post_submit`. `preSendReviewOptIn`
 *     is hard-coded `false` — MCP-019 never originates a pre-send review.
 *   - `featureLayerEnabled` here is a CLIENT INTENT flag, not the server's
 *     `SEMANTIC_REFEREE_ENABLED` secret (that lives only in the Edge
 *     Function). The server is the real gate.
 *   - Observers / moderators map to the non-participant roles so
 *     `evaluateTrigger` refuses their (impossible) post_submit triggers.
 */

import type {
  SemanticActorRole,
  SemanticClassificationMode,
  TriggerEvaluationInput,
} from './triggerGates';
import type { SemanticClassifierId } from './semanticRefereeTypes';

/**
 * Client-side intent flag for the semantic-referee layer. This is NOT the
 * server's `SEMANTIC_REFEREE_ENABLED` secret (that lives only in the Edge
 * Function). It defaults to `true` so the client WILL attempt a `classifyMove`
 * — and the SERVER is the real gate: when the operator has not enabled the
 * layer, the Edge Function returns `{ enabled: false }` and the client falls
 * back silently. Set to `false` only to disable the client attempt entirely
 * (a kill-switch for the room-wiring itself, independent of the server).
 */
export const SEMANTIC_REFEREE_CLIENT_ATTEMPT_DEFAULT = true;

/**
 * Client-side default for MCP-012's room classification mode. GAME-003 (the
 * room-mode card) is not merged, so there is no per-room source yet — MCP-019
 * defaults to `'metadata_and_chip'` so the trigger gate's mode check passes
 * and the banner can render. The *server* `{ enabled: false }` gate is still
 * the real off-switch, so this default turns nothing on by itself. When
 * GAME-003 lands, the room reads the real per-room mode here. (MCP-019 §6.1,
 * operator decision OD-1.)
 */
export const SEMANTIC_CLASSIFICATION_MODE_DEFAULT: SemanticClassificationMode =
  'metadata_and_chip';

/**
 * The curated classifier set a `post_submit` moment requests. Drawn from
 * MCP-012's `SEMANTIC_BATCH_GROUPS` group A (parent continuity) and group C
 * (evidence pressure) — the two groups most relevant to "did this just-posted
 * move tie to its parent, and is its evidence hygiene OK?". 9 ids spanning 2
 * groups; `planClassifierBatches` partitions it into exactly 2 batches of
 * ≤ 5. (MCP-019 §4.3, operator decision OD-3.)
 */
export const POST_SUBMIT_CLASSIFIER_SET: readonly SemanticClassifierId[] = Object.freeze([
  // group A — parent continuity
  'responds_to_parent',
  'quote_anchors_parent',
  'answers_clarification',
  'introduces_new_issue',
  // group C — evidence pressure
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'creates_source_chain_gap',
  'uses_popularity_as_evidence',
]);

/**
 * Map the room's `ParticipantSide`-shaped value onto MCP-012's
 * `SemanticActorRole`. The two participant sides become the two primary
 * participant roles; `observer` / `moderator` map to the non-participant
 * roles so `evaluateTrigger` refuses them. An unknown / null side fails
 * closed to `observer` (the safest non-triggering role).
 *
 * `affirmative → initiator` and `negative → primary_opponent` is a stable,
 * deterministic mapping — MCP-019 does not have a per-room "who opened the
 * room" fact, and the actor-role distinction only matters to `evaluateTrigger`
 * as participant-vs-non-participant. Both participant roles pass the gate.
 */
export function mapParticipantSideToActorRole(
  side: string | null | undefined,
): SemanticActorRole {
  switch (side) {
    case 'affirmative':
      return 'initiator';
    case 'negative':
      return 'primary_opponent';
    case 'moderator':
      return 'moderator';
    case 'observer':
    default:
      return 'observer';
  }
}

/**
 * Build the `post_submit` `TriggerEvaluationInput` for one just-posted move.
 * `preSendReviewOptIn` is always `false` — MCP-019 wires only `post_submit`.
 */
export function buildPostSubmitTriggerInput(args: {
  roomId: string;
  moveId: string;
  parentId?: string;
  /** Client intent flag — NOT the server secret. See the constant above. */
  featureLayerEnabled: boolean;
  /** Client default until GAME-003 lands. See the constant above. */
  semanticClassificationMode: SemanticClassificationMode;
  /** Mapped from the room's participant side via `mapParticipantSideToActorRole`. */
  actorRole: SemanticActorRole;
}): TriggerEvaluationInput {
  return {
    event: { kind: 'trigger', moment: 'post_submit' },
    roomId: args.roomId,
    moveId: args.moveId,
    parentId: args.parentId,
    semanticClassificationMode: args.semanticClassificationMode,
    // MCP-019 never originates a pre-send review.
    preSendReviewOptIn: false,
    featureLayerEnabled: args.featureLayerEnabled,
    actorRole: args.actorRole,
  };
}
