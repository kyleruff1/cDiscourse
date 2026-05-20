/**
 * MCP-012 — Semantic call router: no-call-on-draft-edit spy test.
 *
 * THE ACCEPTANCE-CRITERION PROOF (issue #179): forbidden events produce ZERO
 * provider calls.
 *
 * A `jest.fn()` provider spy wraps MCP-011's `mockFixtureProvider`. The
 * documented router compose — `evaluateTrigger` → on `allowed: true` call the
 * provider, on `allowed: false` do nothing — is run for each forbidden event.
 * The spy must record zero calls. Belt-and-suspenders: an observer-role actor
 * through a `post_submit`-shaped trigger also yields zero calls.
 */

import { evaluateTrigger } from '../src/features/semanticReferee/triggerGates';
import type {
  TriggerEvaluationInput,
  SemanticForbiddenEvent,
} from '../src/features/semanticReferee/triggerGates';
import {
  mockFixtureProvider,
} from '../src/features/semanticReferee/semanticRefereeFixtures';
import type {
  MockClassifyRequest,
} from '../src/features/semanticReferee/semanticRefereeFixtures';
import type { SemanticRefereePacket } from '../src/features/semanticReferee/semanticRefereeTypes';

/**
 * The documented router-seam compose (MCP-012 design §"API contracts" #6):
 * evaluate the trigger; only on `allowed: true` is the provider invoked. On any
 * `allowed: false` path the router does nothing — degrade silently to layer 1.
 * Returns the packet when a call was made, or `undefined` when it was not.
 */
function routeAndMaybeClassify(
  input: TriggerEvaluationInput,
  provider: (req: MockClassifyRequest) => SemanticRefereePacket,
): SemanticRefereePacket | undefined {
  const decision = evaluateTrigger(input);
  if (!decision.allowed) {
    // No provider call — fall back to deterministic layer 1.
    return undefined;
  }
  return provider({
    roomId: input.roomId,
    classifierIds: ['responds_to_parent'],
    contentHash: 'content-hash-spy',
  });
}

const ALL_FORBIDDEN: readonly SemanticForbiddenEvent[] = [
  'keystroke',
  'hover',
  'timeline_selection',
  'observer_browsing',
  'scroll',
  'focus',
  'blur',
  'gallery_browsing',
];

describe('MCP-012 semanticNoCallOnDraftEdit — forbidden events fire zero provider calls', () => {
  it('every forbidden event produces zero provider-spy calls', () => {
    const providerSpy = jest.fn(mockFixtureProvider);
    for (const event of ALL_FORBIDDEN) {
      const result = routeAndMaybeClassify(
        {
          // A permissive flag/mode/role — the forbidden event must still
          // produce no call regardless.
          event: { kind: 'forbidden', event },
          roomId: 'room-draft',
          semanticClassificationMode: 'metadata_and_chip',
          preSendReviewOptIn: true,
          featureLayerEnabled: true,
          actorRole: 'initiator',
          branchRouteAmbiguous: true,
          clusterLifecycleEventCount: 999,
        },
        providerSpy,
      );
      expect(result).toBeUndefined();
    }
    expect(providerSpy).toHaveBeenCalledTimes(0);
  });

  it('a keystroke event individually fires zero provider calls', () => {
    const providerSpy = jest.fn(mockFixtureProvider);
    routeAndMaybeClassify(
      {
        event: { kind: 'forbidden', event: 'keystroke' },
        roomId: 'room-draft',
        semanticClassificationMode: 'metadata_and_chip',
        preSendReviewOptIn: true,
        featureLayerEnabled: true,
        actorRole: 'initiator',
      },
      providerSpy,
    );
    expect(providerSpy).not.toHaveBeenCalled();
  });

  it('an observer-role actor through a post_submit trigger fires zero provider calls', () => {
    const providerSpy = jest.fn(mockFixtureProvider);
    const result = routeAndMaybeClassify(
      {
        event: { kind: 'trigger', moment: 'post_submit' },
        roomId: 'room-draft',
        semanticClassificationMode: 'metadata_and_chip',
        preSendReviewOptIn: true,
        featureLayerEnabled: true,
        actorRole: 'observer',
      },
      providerSpy,
    );
    expect(result).toBeUndefined();
    expect(providerSpy).toHaveBeenCalledTimes(0);
  });

  it('a disabled feature layer fires zero provider calls even for an allowed-shaped moment', () => {
    const providerSpy = jest.fn(mockFixtureProvider);
    routeAndMaybeClassify(
      {
        event: { kind: 'trigger', moment: 'post_submit' },
        roomId: 'room-draft',
        semanticClassificationMode: 'metadata_and_chip',
        preSendReviewOptIn: true,
        featureLayerEnabled: false,
        actorRole: 'initiator',
      },
      providerSpy,
    );
    expect(providerSpy).toHaveBeenCalledTimes(0);
  });

  it('a room in off mode fires zero provider calls', () => {
    const providerSpy = jest.fn(mockFixtureProvider);
    routeAndMaybeClassify(
      {
        event: { kind: 'trigger', moment: 'post_submit' },
        roomId: 'room-draft',
        semanticClassificationMode: 'off',
        preSendReviewOptIn: true,
        featureLayerEnabled: true,
        actorRole: 'initiator',
      },
      providerSpy,
    );
    expect(providerSpy).toHaveBeenCalledTimes(0);
  });

  it('control — an allowed post_submit trigger DOES invoke the provider exactly once', () => {
    // Confirms the spy seam is real: when the gate allows, the provider runs.
    const providerSpy = jest.fn(mockFixtureProvider);
    const result = routeAndMaybeClassify(
      {
        event: { kind: 'trigger', moment: 'post_submit' },
        roomId: 'room-draft',
        semanticClassificationMode: 'metadata_and_chip',
        preSendReviewOptIn: true,
        featureLayerEnabled: true,
        actorRole: 'initiator',
      },
      providerSpy,
    );
    expect(result).toBeDefined();
    expect(providerSpy).toHaveBeenCalledTimes(1);
  });
});
