/**
 * MCP-012 — Semantic call router: trigger-gate tests.
 *
 * The allowed-vs-forbidden moment table. Asserts `evaluateTrigger` returns
 * `allowed: true` only when (flag on) × (mode permits) × (precondition holds),
 * and `allowed: false` with the SPECIFIC `reasonCode` for every disqualifying
 * combination. Asserts forbidden events are refused unconditionally and that
 * `evaluateTrigger` is total.
 */

import {
  evaluateTrigger,
  SYNTHESIS_TRIGGER_MIN_EVENTS,
  ALL_SEMANTIC_TRIGGER_MOMENTS,
  ALL_SEMANTIC_FORBIDDEN_EVENTS,
  ALL_SEMANTIC_ACTOR_ROLES,
} from '../src/features/semanticReferee/triggerGates';
import type {
  TriggerEvaluationInput,
  SemanticTriggerMoment,
  SemanticForbiddenEvent,
  SemanticClassificationMode,
  SemanticActorRole,
} from '../src/features/semanticReferee/triggerGates';

/** A base trigger input — flag on, strict mode, participant role, all preconditions met. */
function baseTrigger(moment: SemanticTriggerMoment): TriggerEvaluationInput {
  return {
    event: { kind: 'trigger', moment },
    roomId: 'room-1',
    semanticClassificationMode: 'metadata_and_chip',
    preSendReviewOptIn: true,
    featureLayerEnabled: true,
    actorRole: 'initiator',
    branchRouteAmbiguous: true,
    clusterLifecycleEventCount: SYNTHESIS_TRIGGER_MIN_EVENTS,
  };
}

function baseForbidden(event: SemanticForbiddenEvent): TriggerEvaluationInput {
  return {
    event: { kind: 'forbidden', event },
    roomId: 'room-1',
    semanticClassificationMode: 'metadata_and_chip',
    preSendReviewOptIn: true,
    featureLayerEnabled: true,
    actorRole: 'initiator',
    branchRouteAmbiguous: true,
    clusterLifecycleEventCount: SYNTHESIS_TRIGGER_MIN_EVENTS,
  };
}

describe('MCP-012 evaluateTrigger — forbidden events', () => {
  it('refuses every forbidden event with trigger_forbidden_event', () => {
    for (const event of ALL_SEMANTIC_FORBIDDEN_EVENTS) {
      const decision = evaluateTrigger(baseForbidden(event));
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe('trigger_forbidden_event');
    }
  });

  it('refuses a forbidden event even with flag on + strict mode + participant role', () => {
    // Proves the unconditional ordering — a permissive flag/mode/role cannot
    // un-refuse a forbidden event.
    for (const event of ALL_SEMANTIC_FORBIDDEN_EVENTS) {
      const decision = evaluateTrigger({
        event: { kind: 'forbidden', event },
        roomId: 'room-1',
        semanticClassificationMode: 'metadata_and_chip',
        preSendReviewOptIn: true,
        featureLayerEnabled: true,
        actorRole: 'initiator',
        branchRouteAmbiguous: true,
        clusterLifecycleEventCount: 999,
      });
      expect(decision).toEqual({ allowed: false, reasonCode: 'trigger_forbidden_event' });
    }
  });

  it('refuses a forbidden event even when the feature layer is OFF (no other code path reached)', () => {
    const decision = evaluateTrigger({
      event: { kind: 'forbidden', event: 'keystroke' },
      roomId: 'room-1',
      semanticClassificationMode: 'off',
      preSendReviewOptIn: false,
      featureLayerEnabled: false,
      actorRole: 'observer',
    });
    expect(decision).toEqual({ allowed: false, reasonCode: 'trigger_forbidden_event' });
  });

  it('covers all eight forbidden events', () => {
    expect(ALL_SEMANTIC_FORBIDDEN_EVENTS).toHaveLength(8);
    expect(new Set(ALL_SEMANTIC_FORBIDDEN_EVENTS).size).toBe(8);
  });
});

describe('MCP-012 evaluateTrigger — feature layer disabled', () => {
  it('refuses every trigger moment with trigger_layer_disabled when flag off', () => {
    for (const moment of ALL_SEMANTIC_TRIGGER_MOMENTS) {
      const decision = evaluateTrigger({ ...baseTrigger(moment), featureLayerEnabled: false });
      expect(decision).toEqual({ allowed: false, reasonCode: 'trigger_layer_disabled' });
    }
  });
});

describe('MCP-012 evaluateTrigger — room mode', () => {
  it('refuses every trigger moment with trigger_room_mode_off when mode is off', () => {
    for (const moment of ALL_SEMANTIC_TRIGGER_MOMENTS) {
      const decision = evaluateTrigger({
        ...baseTrigger(moment),
        semanticClassificationMode: 'off',
      });
      expect(decision).toEqual({ allowed: false, reasonCode: 'trigger_room_mode_off' });
    }
  });

  it('fails closed — an absent mode is treated as off', () => {
    for (const moment of ALL_SEMANTIC_TRIGGER_MOMENTS) {
      const input = baseTrigger(moment);
      delete input.semanticClassificationMode;
      const decision = evaluateTrigger(input);
      expect(decision).toEqual({ allowed: false, reasonCode: 'trigger_room_mode_off' });
    }
  });
});

describe('MCP-012 evaluateTrigger — actor role', () => {
  it('refuses every trigger moment for an observer with trigger_role_not_participant', () => {
    for (const moment of ALL_SEMANTIC_TRIGGER_MOMENTS) {
      const decision = evaluateTrigger({ ...baseTrigger(moment), actorRole: 'observer' });
      expect(decision).toEqual({ allowed: false, reasonCode: 'trigger_role_not_participant' });
    }
  });

  it('refuses every trigger moment for a moderator with trigger_role_not_participant', () => {
    for (const moment of ALL_SEMANTIC_TRIGGER_MOMENTS) {
      const decision = evaluateTrigger({ ...baseTrigger(moment), actorRole: 'moderator' });
      expect(decision).toEqual({ allowed: false, reasonCode: 'trigger_role_not_participant' });
    }
  });

  it('allows participant roles when every other condition is met', () => {
    const participantRoles: SemanticActorRole[] = ['initiator', 'primary_opponent', 'chime_in'];
    for (const actorRole of participantRoles) {
      const decision = evaluateTrigger({ ...baseTrigger('post_submit'), actorRole });
      expect(decision.allowed).toBe(true);
    }
  });

  it('covers all five actor roles', () => {
    expect(ALL_SEMANTIC_ACTOR_ROLES).toHaveLength(5);
  });
});

describe('MCP-012 evaluateTrigger — post_submit', () => {
  it('allows post_submit in metadata_only and metadata_and_chip modes', () => {
    const modes: SemanticClassificationMode[] = ['metadata_only', 'metadata_and_chip'];
    for (const mode of modes) {
      const decision = evaluateTrigger({
        ...baseTrigger('post_submit'),
        semanticClassificationMode: mode,
      });
      expect(decision).toEqual({
        allowed: true,
        moment: 'post_submit',
        reasonCode: 'trigger_post_submit_allowed',
      });
    }
  });
});

describe('MCP-012 evaluateTrigger — evidence_inspection', () => {
  it('allows evidence_inspection in both permitting modes', () => {
    const modes: SemanticClassificationMode[] = ['metadata_only', 'metadata_and_chip'];
    for (const mode of modes) {
      const decision = evaluateTrigger({
        ...baseTrigger('evidence_inspection'),
        semanticClassificationMode: mode,
      });
      expect(decision).toEqual({
        allowed: true,
        moment: 'evidence_inspection',
        reasonCode: 'trigger_evidence_inspection_allowed',
      });
    }
  });
});

describe('MCP-012 evaluateTrigger — pre_send_review', () => {
  it('allows pre_send_review in strict mode with opt-in', () => {
    const decision = evaluateTrigger(baseTrigger('pre_send_review'));
    expect(decision).toEqual({
      allowed: true,
      moment: 'pre_send_review',
      reasonCode: 'trigger_pre_send_review_allowed',
    });
  });

  it('refuses pre_send_review in metadata_only mode with trigger_pre_send_mode_not_strict', () => {
    const decision = evaluateTrigger({
      ...baseTrigger('pre_send_review'),
      semanticClassificationMode: 'metadata_only',
    });
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'trigger_pre_send_mode_not_strict',
    });
  });

  it('refuses pre_send_review in strict mode WITHOUT opt-in with trigger_pre_send_not_opted_in', () => {
    const decision = evaluateTrigger({
      ...baseTrigger('pre_send_review'),
      preSendReviewOptIn: false,
    });
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'trigger_pre_send_not_opted_in',
    });
  });

  it('checks mode BEFORE opt-in — non-strict + not-opted-in still reports mode-not-strict', () => {
    const decision = evaluateTrigger({
      ...baseTrigger('pre_send_review'),
      semanticClassificationMode: 'metadata_only',
      preSendReviewOptIn: false,
    });
    expect(decision.reasonCode).toBe('trigger_pre_send_mode_not_strict');
  });
});

describe('MCP-012 evaluateTrigger — branch_routing', () => {
  it('allows branch_routing when the route is ambiguous', () => {
    const decision = evaluateTrigger(baseTrigger('branch_routing'));
    expect(decision).toEqual({
      allowed: true,
      moment: 'branch_routing',
      reasonCode: 'trigger_branch_routing_allowed',
    });
  });

  it('refuses branch_routing when the route is NOT ambiguous', () => {
    const decision = evaluateTrigger({
      ...baseTrigger('branch_routing'),
      branchRouteAmbiguous: false,
    });
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'trigger_branch_route_not_ambiguous',
    });
  });

  it('refuses branch_routing when the ambiguity flag is absent', () => {
    const input = baseTrigger('branch_routing');
    delete input.branchRouteAmbiguous;
    const decision = evaluateTrigger(input);
    expect(decision.reasonCode).toBe('trigger_branch_route_not_ambiguous');
  });
});

describe('MCP-012 evaluateTrigger — synthesis_readiness', () => {
  it('allows synthesis_readiness at exactly the threshold', () => {
    const decision = evaluateTrigger({
      ...baseTrigger('synthesis_readiness'),
      clusterLifecycleEventCount: SYNTHESIS_TRIGGER_MIN_EVENTS,
    });
    expect(decision).toEqual({
      allowed: true,
      moment: 'synthesis_readiness',
      reasonCode: 'trigger_synthesis_readiness_allowed',
    });
  });

  it('allows synthesis_readiness above the threshold', () => {
    const decision = evaluateTrigger({
      ...baseTrigger('synthesis_readiness'),
      clusterLifecycleEventCount: SYNTHESIS_TRIGGER_MIN_EVENTS + 10,
    });
    expect(decision.allowed).toBe(true);
  });

  it('refuses synthesis_readiness below the threshold', () => {
    const decision = evaluateTrigger({
      ...baseTrigger('synthesis_readiness'),
      clusterLifecycleEventCount: SYNTHESIS_TRIGGER_MIN_EVENTS - 1,
    });
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'trigger_synthesis_below_threshold',
    });
  });

  it('refuses synthesis_readiness when the count is absent (treated as 0)', () => {
    const input = baseTrigger('synthesis_readiness');
    delete input.clusterLifecycleEventCount;
    const decision = evaluateTrigger(input);
    expect(decision.reasonCode).toBe('trigger_synthesis_below_threshold');
  });

  it('exports SYNTHESIS_TRIGGER_MIN_EVENTS as 6', () => {
    expect(SYNTHESIS_TRIGGER_MIN_EVENTS).toBe(6);
  });
});

describe('MCP-012 evaluateTrigger — referee_feedback (derived trigger)', () => {
  it('allows referee_feedback when flag + mode + role pass', () => {
    const decision = evaluateTrigger(baseTrigger('referee_feedback'));
    expect(decision).toEqual({
      allowed: true,
      moment: 'referee_feedback',
      reasonCode: 'trigger_referee_feedback_allowed',
    });
    // referee_feedback being `allowed: true` means "read existing cached
    // metadata" — it must never originate a provider call. That contract is
    // enforced by the consuming code (MCP-014), not by this card; this test
    // documents that the gate itself returns it allowed.
  });

  it('still refuses referee_feedback when the layer is disabled', () => {
    const decision = evaluateTrigger({
      ...baseTrigger('referee_feedback'),
      featureLayerEnabled: false,
    });
    expect(decision.reasonCode).toBe('trigger_layer_disabled');
  });
});

describe('MCP-012 evaluateTrigger — totality', () => {
  it('returns a TriggerDecision for every (moment × mode × flag × role) combination, never throws', () => {
    const modes: (SemanticClassificationMode | undefined)[] = [
      undefined,
      'off',
      'metadata_only',
      'metadata_and_chip',
    ];
    const flags = [true, false];
    for (const moment of ALL_SEMANTIC_TRIGGER_MOMENTS) {
      for (const mode of modes) {
        for (const flag of flags) {
          for (const role of ALL_SEMANTIC_ACTOR_ROLES) {
            for (const optIn of [true, false]) {
              for (const ambiguous of [true, false]) {
                for (const count of [0, SYNTHESIS_TRIGGER_MIN_EVENTS]) {
                  const decision = evaluateTrigger({
                    event: { kind: 'trigger', moment },
                    roomId: 'room-1',
                    semanticClassificationMode: mode,
                    preSendReviewOptIn: optIn,
                    featureLayerEnabled: flag,
                    actorRole: role,
                    branchRouteAmbiguous: ambiguous,
                    clusterLifecycleEventCount: count,
                  });
                  expect(typeof decision.allowed).toBe('boolean');
                  expect(typeof decision.reasonCode).toBe('string');
                }
              }
            }
          }
        }
      }
    }
  });

  it('returns a TriggerDecision for every forbidden event, never throws', () => {
    for (const event of ALL_SEMANTIC_FORBIDDEN_EVENTS) {
      const decision = evaluateTrigger(baseForbidden(event));
      expect(typeof decision.allowed).toBe('boolean');
      expect(typeof decision.reasonCode).toBe('string');
    }
  });
});
