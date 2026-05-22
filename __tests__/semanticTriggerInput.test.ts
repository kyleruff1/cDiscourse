/**
 * MCP-019 — `semanticTriggerInput` tests.
 *
 * Covers `buildPostSubmitTriggerInput` (shape + the hard-coded
 * `preSendReviewOptIn: false`), `mapParticipantSideToActorRole`, and the
 * `POST_SUBMIT_CLASSIFIER_SET` (≤ 10 ids, every id in the catalog, exactly 2
 * planned batches each ≤ BATCH_CAP).
 */
import {
  POST_SUBMIT_CLASSIFIER_SET,
  SEMANTIC_CLASSIFICATION_MODE_DEFAULT,
  SEMANTIC_REFEREE_CLIENT_ATTEMPT_DEFAULT,
  buildPostSubmitTriggerInput,
  mapParticipantSideToActorRole,
} from '../src/features/semanticReferee/semanticTriggerInput';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee/semanticRefereeTypes';
import { BATCH_CAP, planClassifierBatches } from '../src/features/semanticReferee/classifierBatching';
import { evaluateTrigger } from '../src/features/semanticReferee/triggerGates';

describe('buildPostSubmitTriggerInput', () => {
  it('returns a post_submit trigger event with preSendReviewOptIn false', () => {
    const input = buildPostSubmitTriggerInput({
      roomId: 'room-1',
      moveId: 'move-1',
      featureLayerEnabled: true,
      semanticClassificationMode: 'metadata_and_chip',
      actorRole: 'initiator',
    });
    expect(input.event).toEqual({ kind: 'trigger', moment: 'post_submit' });
    expect(input.preSendReviewOptIn).toBe(false);
    expect(input.roomId).toBe('room-1');
    expect(input.moveId).toBe('move-1');
  });

  it('carries the parentId through when supplied', () => {
    const input = buildPostSubmitTriggerInput({
      roomId: 'room-1',
      moveId: 'move-1',
      parentId: 'parent-1',
      featureLayerEnabled: true,
      semanticClassificationMode: 'metadata_and_chip',
      actorRole: 'primary_opponent',
    });
    expect(input.parentId).toBe('parent-1');
  });

  it('produces an input evaluateTrigger ALLOWS for a participant + layer on', () => {
    const input = buildPostSubmitTriggerInput({
      roomId: 'r',
      moveId: 'm',
      featureLayerEnabled: true,
      semanticClassificationMode: 'metadata_and_chip',
      actorRole: 'initiator',
    });
    expect(evaluateTrigger(input).allowed).toBe(true);
  });

  it('produces an input evaluateTrigger REFUSES when the client flag is off', () => {
    const input = buildPostSubmitTriggerInput({
      roomId: 'r',
      moveId: 'm',
      featureLayerEnabled: false,
      semanticClassificationMode: 'metadata_and_chip',
      actorRole: 'initiator',
    });
    expect(evaluateTrigger(input).allowed).toBe(false);
  });

  it('produces an input evaluateTrigger REFUSES when the mode is off', () => {
    const input = buildPostSubmitTriggerInput({
      roomId: 'r',
      moveId: 'm',
      featureLayerEnabled: true,
      semanticClassificationMode: 'off',
      actorRole: 'initiator',
    });
    expect(evaluateTrigger(input).allowed).toBe(false);
  });
});

describe('mapParticipantSideToActorRole', () => {
  it('maps affirmative to a participant role', () => {
    expect(mapParticipantSideToActorRole('affirmative')).toBe('initiator');
  });

  it('maps negative to a participant role', () => {
    expect(mapParticipantSideToActorRole('negative')).toBe('primary_opponent');
  });

  it('maps observer to observer (a non-participant role)', () => {
    expect(mapParticipantSideToActorRole('observer')).toBe('observer');
  });

  it('maps moderator to moderator (a non-participant role)', () => {
    expect(mapParticipantSideToActorRole('moderator')).toBe('moderator');
  });

  it('fails closed to observer for null / unknown side', () => {
    expect(mapParticipantSideToActorRole(null)).toBe('observer');
    expect(mapParticipantSideToActorRole(undefined)).toBe('observer');
    expect(mapParticipantSideToActorRole('something-else')).toBe('observer');
  });
});

describe('POST_SUBMIT_CLASSIFIER_SET', () => {
  it('has at most 10 ids', () => {
    expect(POST_SUBMIT_CLASSIFIER_SET.length).toBeLessThanOrEqual(10);
    expect(POST_SUBMIT_CLASSIFIER_SET.length).toBeGreaterThan(0);
  });

  it('every id is a real catalog classifier id', () => {
    const catalog = new Set<string>(ALL_SEMANTIC_CLASSIFIER_IDS);
    for (const id of POST_SUBMIT_CLASSIFIER_SET) {
      expect(catalog.has(id)).toBe(true);
    }
  });

  it('plans into exactly 2 batches, each <= BATCH_CAP', () => {
    const batches = planClassifierBatches(POST_SUBMIT_CLASSIFIER_SET);
    expect(batches.length).toBe(2);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(BATCH_CAP);
      expect(batch.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(POST_SUBMIT_CLASSIFIER_SET).size).toBe(POST_SUBMIT_CLASSIFIER_SET.length);
  });
});

describe('semanticTriggerInput — defaults', () => {
  it('the client attempt flag defaults to true (server is the real gate)', () => {
    expect(SEMANTIC_REFEREE_CLIENT_ATTEMPT_DEFAULT).toBe(true);
  });

  it('the classification mode defaults to metadata_and_chip', () => {
    expect(SEMANTIC_CLASSIFICATION_MODE_DEFAULT).toBe('metadata_and_chip');
  });
});
