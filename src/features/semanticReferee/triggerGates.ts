/**
 * MCP-012 — Semantic call router: trigger gates.
 *
 * Pure decision logic. `evaluateTrigger(input)` is the single chokepoint that
 * answers ONE question: "should a semantic-referee classifier call be made,
 * and at what moment?" — it NEVER answers "should this post be allowed?".
 *
 * Doctrine (MCP-012 design §"doctrine self-check"; cdiscourse-doctrine §1, §4):
 *   - The router is ADVISORY. A refused trigger does not block a post.
 *     `submit-argument` never imports or calls `evaluateTrigger`.
 *   - Every "no call" path degrades silently to deterministic layer 1.
 *   - Forbidden events (`keystroke`, `hover`, etc.) are refused UNCONDITIONALLY,
 *     before any flag / mode / role check — see `evaluateTrigger`.
 *   - `TriggerEvaluationInput` carries NO engagement / heat / popularity field;
 *     triggers fire only on structural completed actions.
 *
 * This file is PURE TYPESCRIPT — no network import, no Supabase, no React, no
 * `Deno`, no `process` / `.env` read, no provider SDK, no `async`. The only
 * thing that ever fires a provider call is MCP-009's Edge Function (built by
 * MCP-016). `evaluateTrigger` is total: every input yields one `TriggerDecision`.
 */

// ── Trigger / forbidden / mode / role enums ───────────────────────

/** The six moments at which a semantic call MAY originate (MCP-004 §"API contracts" #1). */
export type SemanticTriggerMoment =
  | 'post_submit' //          after a move is successfully posted (the trigger of record)
  | 'pre_send_review' //      strict-mode only, room-creator opt-in
  | 'evidence_inspection' //  on evidence attach / challenge
  | 'branch_routing' //       when deterministic layer-1 reply-target is ambiguous
  | 'synthesis_readiness' //  once enough lifecycle events accumulate on a cluster
  | 'referee_feedback'; //    banner generation from ALREADY-classified metadata only

/**
 * Events the gate sees but MUST refuse — present so the gate enum is exhaustive
 * (MCP-004 §"API contracts" #2; card acceptance criterion). A forbidden event
 * can never reach a code path that fires a provider call.
 */
export type SemanticForbiddenEvent =
  | 'keystroke'
  | 'hover'
  | 'timeline_selection'
  | 'observer_browsing'
  | 'scroll'
  | 'focus'
  | 'blur'
  | 'gallery_browsing';

/**
 * Advisory mode a room is in — sourced from GAME-003's room-mode field.
 * Reproduced here as the input the gate reads; GAME-003 owns the canonical
 * type. If GAME-003's final values differ, this card's input type follows it;
 * the gate LOGIC (off → no call) is stable regardless.
 */
export type SemanticClassificationMode = 'off' | 'metadata_only' | 'metadata_and_chip';

/** Actor role — observers and moderators never originate a semantic call. */
export type SemanticActorRole =
  | 'initiator'
  | 'primary_opponent'
  | 'chime_in'
  | 'observer'
  | 'moderator';

// ── Input ─────────────────────────────────────────────────────────

/**
 * What the gate is asked about. Pure input — NO body text, NO engagement /
 * like-count / view-count / heat field. Triggers fire only on structural
 * completed actions (cdiscourse-doctrine §3).
 */
export interface TriggerEvaluationInput {
  event:
    | { kind: 'trigger'; moment: SemanticTriggerMoment }
    | { kind: 'forbidden'; event: SemanticForbiddenEvent };
  roomId: string;
  parentId?: string;
  moveId?: string;
  /** GAME-003 room mode — when absent, treated as 'off' (fail-closed). */
  semanticClassificationMode?: SemanticClassificationMode;
  /** True only if the room creator explicitly opted into pre-send review. */
  preSendReviewOptIn: boolean;
  /** Layer feature-flag mirror (MCP-009 SEMANTIC_REFEREE_ENABLED). First line of defense. */
  featureLayerEnabled: boolean;
  /** Actor role — observers / moderators never trigger. */
  actorRole: SemanticActorRole;
  /** Deterministic layer-1 ambiguity flag — `branch_routing` fires only when true. */
  branchRouteAmbiguous?: boolean;
  /** Lifecycle-event count on the cluster — `synthesis_readiness` threshold gate. */
  clusterLifecycleEventCount?: number;
}

// ── Reason codes + decision ───────────────────────────────────────

/**
 * A bounded reason code — `snake_case`, mapped to plain language by a downstream
 * render card (MCP-013 / MCP-014) via `gameCopy.toPlainLanguage` before any UI.
 * This is the ONLY user-reachable string family the card produces. The
 * `semanticRouterBanList` test guarantees no code carries a verdict / person
 * token.
 */
export type TriggerReasonCode =
  // allowed
  | 'trigger_post_submit_allowed'
  | 'trigger_pre_send_review_allowed'
  | 'trigger_evidence_inspection_allowed'
  | 'trigger_branch_routing_allowed'
  | 'trigger_synthesis_readiness_allowed'
  | 'trigger_referee_feedback_allowed'
  // refused
  | 'trigger_forbidden_event'
  | 'trigger_layer_disabled'
  | 'trigger_room_mode_off'
  | 'trigger_role_not_participant'
  | 'trigger_pre_send_not_opted_in'
  | 'trigger_pre_send_mode_not_strict'
  | 'trigger_branch_route_not_ambiguous'
  | 'trigger_synthesis_below_threshold';

export type TriggerDecision =
  | { allowed: true; moment: SemanticTriggerMoment; reasonCode: TriggerReasonCode }
  | { allowed: false; reasonCode: TriggerReasonCode };

// ── Constants ─────────────────────────────────────────────────────

/**
 * The minimum lifecycle-event count on a cluster before `synthesis_readiness`
 * may fire. Operator-tunable (MCP-004 §"operator decisions" #3) — a single
 * `const` edit with no behavioral redesign.
 */
export const SYNTHESIS_TRIGGER_MIN_EVENTS = 6 as const;

/** Every `SemanticTriggerMoment` — fixed evaluation order is documented inline. */
export const ALL_SEMANTIC_TRIGGER_MOMENTS: readonly SemanticTriggerMoment[] = [
  'post_submit',
  'pre_send_review',
  'evidence_inspection',
  'branch_routing',
  'synthesis_readiness',
  'referee_feedback',
];

/** Every `SemanticForbiddenEvent` — the exhaustive refused-event enum. */
export const ALL_SEMANTIC_FORBIDDEN_EVENTS: readonly SemanticForbiddenEvent[] = [
  'keystroke',
  'hover',
  'timeline_selection',
  'observer_browsing',
  'scroll',
  'focus',
  'blur',
  'gallery_browsing',
];

/** Every `SemanticActorRole`. */
export const ALL_SEMANTIC_ACTOR_ROLES: readonly SemanticActorRole[] = [
  'initiator',
  'primary_opponent',
  'chime_in',
  'observer',
  'moderator',
];

/** Per-moment allowed reason code. */
const ALLOWED_REASON_CODE: Readonly<Record<SemanticTriggerMoment, TriggerReasonCode>> = {
  post_submit: 'trigger_post_submit_allowed',
  pre_send_review: 'trigger_pre_send_review_allowed',
  evidence_inspection: 'trigger_evidence_inspection_allowed',
  branch_routing: 'trigger_branch_routing_allowed',
  synthesis_readiness: 'trigger_synthesis_readiness_allowed',
  referee_feedback: 'trigger_referee_feedback_allowed',
};

// ── evaluateTrigger ───────────────────────────────────────────────

/** True for the two roles that never originate a semantic call. */
function isNonParticipantRole(role: SemanticActorRole): boolean {
  return role === 'observer' || role === 'moderator';
}

/** True when the mode permits any classification at all (not 'off' / absent). */
function modePermitsClassification(mode: SemanticClassificationMode | undefined): boolean {
  return mode === 'metadata_only' || mode === 'metadata_and_chip';
}

/**
 * The single chokepoint. Returns a `TriggerDecision` — never a post decision.
 *
 * Forbidden events are refused as the VERY FIRST statement, before any
 * `featureLayerEnabled` / `semanticClassificationMode` / `actorRole` read. This
 * ordering is load-bearing: a forbidden event cannot reach a code path that
 * fires a call even when the flag and mode are permissive.
 *
 * For a trigger event the evaluation order is fixed so the most general
 * refusals are checked first:
 *   1. feature layer disabled
 *   2. room mode off / absent (fail-closed)
 *   3. actor is an observer / moderator
 *   4. per-moment precondition
 *   5. allowed
 *
 * `evaluateTrigger` is total — every `(event × mode × flag × role ×
 * precondition)` combination yields exactly one decision; it never throws and
 * never returns `undefined`.
 */
export function evaluateTrigger(input: TriggerEvaluationInput): TriggerDecision {
  // 0. Forbidden events — refused UNCONDITIONALLY, before any other check.
  if (input.event.kind === 'forbidden') {
    return { allowed: false, reasonCode: 'trigger_forbidden_event' };
  }

  const { moment } = input.event;

  // 1. Feature layer disabled → no call for any moment.
  if (input.featureLayerEnabled === false) {
    return { allowed: false, reasonCode: 'trigger_layer_disabled' };
  }

  // 2. Room mode off or absent → fail-closed, no call for any moment.
  if (!modePermitsClassification(input.semanticClassificationMode)) {
    return { allowed: false, reasonCode: 'trigger_room_mode_off' };
  }

  // 3. Observers / moderators never originate a semantic call.
  if (isNonParticipantRole(input.actorRole)) {
    return { allowed: false, reasonCode: 'trigger_role_not_participant' };
  }

  // 4. Per-moment precondition.
  switch (moment) {
    case 'post_submit':
    case 'evidence_inspection':
      // No precondition beyond steps 1-3.
      break;

    case 'pre_send_review': {
      // Mode check BEFORE opt-in check, so a non-strict room and a
      // strict-but-not-opted-in room produce two distinct, testable codes.
      if (input.semanticClassificationMode !== 'metadata_and_chip') {
        return { allowed: false, reasonCode: 'trigger_pre_send_mode_not_strict' };
      }
      if (input.preSendReviewOptIn !== true) {
        return { allowed: false, reasonCode: 'trigger_pre_send_not_opted_in' };
      }
      break;
    }

    case 'branch_routing':
      if (input.branchRouteAmbiguous !== true) {
        return { allowed: false, reasonCode: 'trigger_branch_route_not_ambiguous' };
      }
      break;

    case 'synthesis_readiness': {
      // Absent count is treated as 0.
      const count = input.clusterLifecycleEventCount ?? 0;
      if (count < SYNTHESIS_TRIGGER_MIN_EVENTS) {
        return { allowed: false, reasonCode: 'trigger_synthesis_below_threshold' };
      }
      break;
    }

    case 'referee_feedback':
      // `referee_feedback` is a DERIVED trigger: `allowed: true` means
      // "read existing cached / ledger metadata", never "fire a provider
      // call". The consuming code shows no banner if nothing is cached. It
      // must NEVER originate a provider call. No precondition here.
      break;

    default: {
      // Exhaustiveness guard — keeps `evaluateTrigger` total if the
      // `SemanticTriggerMoment` union ever widens without a code update.
      const _exhaustive: never = moment;
      return _exhaustive;
    }
  }

  // 5. All checks passed → allowed.
  return { allowed: true, moment, reasonCode: ALLOWED_REASON_CODE[moment] };
}
