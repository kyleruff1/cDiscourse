/**
 * MCP-015 — Semantic override record-builder + projectors + counter tests.
 *
 * Covers `buildSemanticOverrideRecord`, `toSemanticOverrideMetadataEvent`,
 * `toAnswersParentMetadataEvent`, `bumpRepeatedOverrideSignal`, and
 * `emptyRepeatedOverrideSignal`. All pure-model — no live call.
 */

import {
  buildSemanticOverrideRecord,
  toSemanticOverrideMetadataEvent,
  toAnswersParentMetadataEvent,
  bumpRepeatedOverrideSignal,
  emptyRepeatedOverrideSignal,
} from '../src/features/semanticOverride';
import { SOFTEN_COPY_THRESHOLD } from '../src/features/semanticOverride';
import type {
  SemanticOverridePrompt,
  SemanticOverrideRecord,
} from '../src/features/semanticOverride';

// ── A confirmed-override fixture ──────────────────────────────────

function lowConfPrompt(): SemanticOverridePrompt {
  return {
    shouldOffer: true,
    triggerReason: 'low_confidence',
    suggestedLane: 'mainline',
    offersAnswersParentToggle: true,
    contestedClassifierId: 'responds_to_parent',
    promptCopyCode: 'semantic_override_prompt_low_conf',
  };
}

function buildSample(
  overrides: Partial<Parameters<typeof buildSemanticOverrideRecord>[0]> = {},
): SemanticOverrideRecord {
  return buildSemanticOverrideRecord({
    prompt: lowConfPrompt(),
    messageId: 'msg-1',
    clusterId: 'cluster-1',
    chosenLane: 'tangent',
    assertsAnswersParent: false,
    originalRouteSuggestion: 'mainline',
    overriddenByUserId: 'user-1',
    overriddenByActorRole: 'participant_affirmative',
    at: '2026-05-20T10:00:00.000Z',
    ...overrides,
  });
}

// ── buildSemanticOverrideRecord ───────────────────────────────────

describe('buildSemanticOverrideRecord', () => {
  it('produces a record carrying the chosen lane, assertion, and original suggestion', () => {
    const record = buildSample({ chosenLane: 'branch', assertsAnswersParent: true });
    expect(record.chosenLane).toBe('branch');
    expect(record.assertsAnswersParent).toBe(true);
    expect(record.originalRouteSuggestion).toBe('mainline');
  });

  it('derives a stable overrideId from messageId + at', () => {
    const record = buildSample();
    expect(record.overrideId).toBe(
      'semantic_override:msg-1:2026-05-20T10:00:00.000Z',
    );
  });

  it('copies triggerReason + contestedClassifierId from the prompt', () => {
    const record = buildSample();
    expect(record.triggerReason).toBe('low_confidence');
    expect(record.contestedClassifierId).toBe('responds_to_parent');
  });

  it('falls back to empty contestedClassifierId when the prompt had null', () => {
    const prompt: SemanticOverridePrompt = {
      ...lowConfPrompt(),
      triggerReason: 'l1_l2_conflict',
      contestedClassifierId: null,
    };
    const record = buildSample({ prompt });
    expect(record.contestedClassifierId).toBe('');
    expect(record.triggerReason).toBe('l1_l2_conflict');
  });

  it('carries the caller-supplied user id, actor role, and timestamp', () => {
    const record = buildSample({
      overriddenByUserId: 'user-99',
      overriddenByActorRole: 'admin',
      at: '2026-05-20T11:30:00.000Z',
    });
    expect(record.overriddenByUserId).toBe('user-99');
    expect(record.overriddenByActorRole).toBe('admin');
    expect(record.at).toBe('2026-05-20T11:30:00.000Z');
  });
});

// ── toSemanticOverrideMetadataEvent ───────────────────────────────

describe('toSemanticOverrideMetadataEvent', () => {
  it('projects a visible-metadata MetadataEvent — add / semantic_override / lane code', () => {
    const event = toSemanticOverrideMetadataEvent(buildSample({ chosenLane: 'branch' }));
    expect(event.kind).toBe('add');
    expect(event.codeFamily).toBe('semantic_override');
    expect(event.code).toBe('branch');
    expect(event.messageId).toBe('msg-1');
    expect(event.clusterId).toBe('cluster-1');
    expect(event.at).toBe('2026-05-20T10:00:00.000Z');
  });

  it('always emits kind add — there is no remove path for an override', () => {
    for (const lane of ['mainline', 'branch', 'tangent'] as const) {
      const event = toSemanticOverrideMetadataEvent(buildSample({ chosenLane: lane }));
      expect(event.kind).toBe('add');
    }
  });

  it('carries an internal debug cause string, never user-facing', () => {
    const lowConf = toSemanticOverrideMetadataEvent(buildSample());
    expect(lowConf.cause).toBe('override_low_confidence');
    const conflictRecord = buildSample({
      prompt: {
        ...lowConfPrompt(),
        triggerReason: 'l1_l2_conflict',
      },
    });
    expect(toSemanticOverrideMetadataEvent(conflictRecord).cause).toBe(
      'override_l1_l2_conflict',
    );
  });

  it('a second override on the same move appends a distinct add event', () => {
    const first = toSemanticOverrideMetadataEvent(
      buildSample({ at: '2026-05-20T10:00:00.000Z', chosenLane: 'tangent' }),
    );
    const second = toSemanticOverrideMetadataEvent(
      buildSample({ at: '2026-05-20T10:05:00.000Z', chosenLane: 'mainline' }),
    );
    expect(first.eventId).not.toBe(second.eventId);
    expect(first.kind).toBe('add');
    expect(second.kind).toBe('add');
  });
});

// ── toAnswersParentMetadataEvent ──────────────────────────────────

describe('toAnswersParentMetadataEvent', () => {
  it('returns the companion answers_parent event when assertsAnswersParent is true', () => {
    const event = toAnswersParentMetadataEvent(
      buildSample({ assertsAnswersParent: true }),
    );
    expect(event).not.toBeNull();
    expect(event?.code).toBe('answers_parent');
    expect(event?.kind).toBe('add');
    expect(event?.codeFamily).toBe('semantic_override');
  });

  it('returns null when assertsAnswersParent is false', () => {
    expect(
      toAnswersParentMetadataEvent(buildSample({ assertsAnswersParent: false })),
    ).toBeNull();
  });

  it('the lane event and the answers_parent event share the same at but differ by eventId', () => {
    const record = buildSample({ assertsAnswersParent: true, chosenLane: 'tangent' });
    const laneEvent = toSemanticOverrideMetadataEvent(record);
    const answersEvent = toAnswersParentMetadataEvent(record);
    expect(answersEvent).not.toBeNull();
    expect(laneEvent.at).toBe(answersEvent?.at);
    expect(laneEvent.eventId).not.toBe(answersEvent?.eventId);
  });
});

// ── emptyRepeatedOverrideSignal ───────────────────────────────────

describe('emptyRepeatedOverrideSignal', () => {
  it('returns a fresh zeroed signal for a room', () => {
    const signal = emptyRepeatedOverrideSignal('room-7');
    expect(signal.roomId).toBe('room-7');
    expect(signal.overrideCountThisRoom).toBe(0);
    expect(signal.softenCopy).toBe(false);
  });
});

// ── bumpRepeatedOverrideSignal ────────────────────────────────────

describe('bumpRepeatedOverrideSignal', () => {
  it('increments the count and does not mutate the input', () => {
    const original = emptyRepeatedOverrideSignal('room-7');
    const bumped = bumpRepeatedOverrideSignal(original);
    expect(bumped.overrideCountThisRoom).toBe(1);
    expect(original.overrideCountThisRoom).toBe(0);
    expect(bumped).not.toBe(original);
  });

  it('flips softenCopy once the count reaches SOFTEN_COPY_THRESHOLD', () => {
    let signal = emptyRepeatedOverrideSignal('room-7');
    for (let i = 1; i < SOFTEN_COPY_THRESHOLD; i += 1) {
      signal = bumpRepeatedOverrideSignal(signal);
      expect(signal.softenCopy).toBe(false);
    }
    signal = bumpRepeatedOverrideSignal(signal);
    expect(signal.overrideCountThisRoom).toBe(SOFTEN_COPY_THRESHOLD);
    expect(signal.softenCopy).toBe(true);
  });

  it('keeps softenCopy true and keeps counting past the threshold', () => {
    let signal = emptyRepeatedOverrideSignal('room-7');
    for (let i = 0; i < SOFTEN_COPY_THRESHOLD + 5; i += 1) {
      signal = bumpRepeatedOverrideSignal(signal);
    }
    expect(signal.softenCopy).toBe(true);
    expect(signal.overrideCountThisRoom).toBe(SOFTEN_COPY_THRESHOLD + 5);
  });

  it('preserves the roomId across bumps', () => {
    const bumped = bumpRepeatedOverrideSignal(emptyRepeatedOverrideSignal('room-xyz'));
    expect(bumped.roomId).toBe('room-xyz');
  });
});
