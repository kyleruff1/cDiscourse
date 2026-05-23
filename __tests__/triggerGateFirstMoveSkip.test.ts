/**
 * MCP-MOD-008 — `evaluateTrigger` first-move-skip rule.
 *
 * Asserts that when the caller supplies `authorId` + `priorMoves` and the
 * move-position helper returns `'first'`, the gate refuses with
 * `{ allowed: false, reasonCode: 'first_move_by_author' }` BEFORE the
 * per-moment precondition is consulted. The rule is participant-scoped (a
 * chime-in's first contribution is exempt too) and degrades to the
 * pre-MCP-MOD-008 behavior when either input is absent.
 *
 * This is the BEHAVIOR-CHANGING test for the slate's final card. Companion
 * tests (movePositionThreadBudget, seedPromptThreadContextBlock,
 * classifyMoveRequestPriorMovesParity, movePositionRoomHookIntegration) pin
 * the rest of the contract.
 */
import {
  evaluateTrigger,
  type TriggerEvaluationInput,
  type SemanticTriggerMoment,
} from '../src/features/semanticReferee/triggerGates';

/** Build a trigger input that passes every gate EXCEPT the new first-move check. */
function baseTrigger(
  moment: SemanticTriggerMoment,
  overrides: Partial<TriggerEvaluationInput> = {},
): TriggerEvaluationInput {
  return {
    event: { kind: 'trigger', moment },
    roomId: 'room-1',
    semanticClassificationMode: 'metadata_and_chip',
    preSendReviewOptIn: true,
    featureLayerEnabled: true,
    actorRole: 'initiator',
    branchRouteAmbiguous: true,
    clusterLifecycleEventCount: 99,
    ...overrides,
  };
}

describe('MCP-MOD-008 evaluateTrigger — first-move-skip', () => {
  it('refuses with first_move_by_author when the author has no prior moves (root move)', () => {
    const decision = evaluateTrigger(
      baseTrigger('post_submit', {
        moveId: 'root',
        authorId: 'user-A',
        priorMoves: [],
      }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'first_move_by_author',
    });
  });

  it('refuses with first_move_by_author when the opponent posts their first move', () => {
    // Room state: A posted the root. B is now posting their first move.
    const decision = evaluateTrigger(
      baseTrigger('post_submit', {
        moveId: 'm-2',
        authorId: 'user-B',
        actorRole: 'primary_opponent',
        priorMoves: [{ id: 'root', authorId: 'user-A' }],
      }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'first_move_by_author',
    });
  });

  it('refuses with first_move_by_author when a chime-in posts their first contribution', () => {
    // Room state: A and B have posted 5 moves between them. C joins.
    const decision = evaluateTrigger(
      baseTrigger('post_submit', {
        moveId: 'm-6',
        authorId: 'user-C',
        actorRole: 'chime_in',
        priorMoves: [
          { id: 'root', authorId: 'user-A' },
          { id: 'm-2', authorId: 'user-B' },
          { id: 'm-3', authorId: 'user-A' },
          { id: 'm-4', authorId: 'user-B' },
          { id: 'm-5', authorId: 'user-A' },
        ],
      }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'first_move_by_author',
    });
  });

  it('allows the author\'s SECOND move with the normal allowed reason', () => {
    const decision = evaluateTrigger(
      baseTrigger('post_submit', {
        moveId: 'm-3',
        authorId: 'user-A',
        priorMoves: [
          { id: 'root', authorId: 'user-A' },
          { id: 'm-2', authorId: 'user-B' },
        ],
      }),
    );
    expect(decision).toEqual({
      allowed: true,
      moment: 'post_submit',
      reasonCode: 'trigger_post_submit_allowed',
    });
  });

  it('allows the author\'s LATER moves with the normal allowed reason', () => {
    const decision = evaluateTrigger(
      baseTrigger('post_submit', {
        moveId: 'm-5',
        authorId: 'user-A',
        priorMoves: [
          { id: 'root', authorId: 'user-A' },
          { id: 'm-2', authorId: 'user-B' },
          { id: 'm-3', authorId: 'user-A' },
          { id: 'm-4', authorId: 'user-B' },
        ],
      }),
    );
    expect(decision).toEqual({
      allowed: true,
      moment: 'post_submit',
      reasonCode: 'trigger_post_submit_allowed',
    });
  });
});

describe('MCP-MOD-008 evaluateTrigger — first-move-skip ordering', () => {
  it('refuses first_move_by_author BEFORE per-moment preconditions (branch routing)', () => {
    // A `branch_routing` trigger normally needs `branchRouteAmbiguous: true`.
    // Even with that flag SATISFIED, an author's first move must refuse with
    // `first_move_by_author` rather than `trigger_branch_routing_allowed`.
    const decision = evaluateTrigger(
      baseTrigger('branch_routing', {
        moveId: 'root',
        authorId: 'user-A',
        priorMoves: [],
        branchRouteAmbiguous: true,
      }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'first_move_by_author',
    });
  });

  it('refuses first_move_by_author BEFORE the synthesis threshold', () => {
    const decision = evaluateTrigger(
      baseTrigger('synthesis_readiness', {
        moveId: 'root',
        authorId: 'user-A',
        priorMoves: [],
        clusterLifecycleEventCount: 999, // well above threshold
      }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'first_move_by_author',
    });
  });

  it('still refuses with trigger_layer_disabled when the feature is off (layer check runs FIRST)', () => {
    // The first-move check runs AFTER the feature layer check, so a disabled
    // layer wins. Documents the precedence order.
    const decision = evaluateTrigger(
      baseTrigger('post_submit', {
        featureLayerEnabled: false,
        moveId: 'root',
        authorId: 'user-A',
        priorMoves: [],
      }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'trigger_layer_disabled',
    });
  });

  it('still refuses with trigger_room_mode_off when the mode is off (mode check runs FIRST)', () => {
    const decision = evaluateTrigger(
      baseTrigger('post_submit', {
        semanticClassificationMode: 'off',
        moveId: 'root',
        authorId: 'user-A',
        priorMoves: [],
      }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'trigger_room_mode_off',
    });
  });

  it('still refuses with trigger_role_not_participant when actor is observer (role check runs FIRST)', () => {
    const decision = evaluateTrigger(
      baseTrigger('post_submit', {
        actorRole: 'observer',
        moveId: 'root',
        authorId: 'user-A',
        priorMoves: [],
      }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasonCode: 'trigger_role_not_participant',
    });
  });
});

describe('MCP-MOD-008 evaluateTrigger — backward compatibility', () => {
  it('keeps the pre-MCP-MOD-008 behavior when authorId is absent', () => {
    // A trigger without authorId / priorMoves — every existing call site that
    // does not yet supply them must keep the prior behavior. The gate must NOT
    // refuse with first_move_by_author.
    const decision = evaluateTrigger(baseTrigger('post_submit'));
    expect(decision).toEqual({
      allowed: true,
      moment: 'post_submit',
      reasonCode: 'trigger_post_submit_allowed',
    });
  });

  it('keeps the pre-MCP-MOD-008 behavior when priorMoves is absent', () => {
    const decision = evaluateTrigger(
      baseTrigger('post_submit', { authorId: 'user-A' }),
    );
    expect(decision.allowed).toBe(true);
  });

  it('keeps the pre-MCP-MOD-008 behavior when authorId is the empty string', () => {
    // Defensive: an empty authorId is not enough to engage the first-move
    // rule. Backward-compatible with the pre-MCP-MOD-008 behavior.
    const decision = evaluateTrigger(
      baseTrigger('post_submit', { authorId: '', priorMoves: [] }),
    );
    expect(decision.allowed).toBe(true);
  });
});
