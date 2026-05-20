/**
 * MCP-015 — Semantic override UX model: the record-builder + projectors.
 *
 * `buildSemanticOverrideRecord` is a pure projection of a confirmed user
 * choice into a `SemanticOverrideRecord`. `toSemanticOverrideMetadataEvent` /
 * `toAnswersParentMetadataEvent` project that record onto META-001
 * `MetadataEvent`s (`kind: 'add'`, `codeFamily: 'semantic_override'`).
 * `bumpRepeatedOverrideSignal` / `emptyRepeatedOverrideSignal` manage the
 * in-memory, per-room, UX-only repeated-override count.
 *
 * Pure TypeScript. No network, no React, no Supabase, no mutation, no
 * `Date.now()` in the model — the `at` is caller-supplied, and `overrideId` /
 * `eventId` are derived from `messageId` + `at`.
 *
 * DOCTRINE — overriding is NEVER a penalty. The produced `SemanticOverrideRecord`
 * and `MetadataEvent`s carry NO `delta` / `score` / `penalty` / `block` /
 * `flag` field. There is no "you ignored the suggestion" field, no negative
 * marker, no moderation linkage. Override records are append-only — a user who
 * changes their mind appends a NEW record; nothing is deleted or mutated.
 */

import type { MetadataEvent } from '../metadata/moveMetadataLedger';
import type { SemanticRouteSuggestion } from '../semanticReferee/semanticRefereeTypes';
import type {
  RepeatedOverrideSignal,
  SemanticOverrideActorRole,
  SemanticOverrideLane,
  SemanticOverridePrompt,
  SemanticOverrideRecord,
} from './types';
import { SOFTEN_COPY_THRESHOLD } from './types';

// ── Record builder ────────────────────────────────────────────────

/**
 * Pure. Builds the append-only override record from a confirmed user choice.
 * `prompt` is the `SemanticOverridePrompt` that offered the surface — its
 * `triggerReason` / `contestedClassifierId` are copied onto the record.
 *
 * `contestedClassifierId` falls back to `''` if the prompt's was `null` — a
 * defensive guard; in practice a confirmed override always came from a
 * `shouldOffer: true` prompt. `triggerReason` falls back to `'low_confidence'`
 * for the same defensive reason.
 */
export function buildSemanticOverrideRecord(input: {
  prompt: SemanticOverridePrompt;
  messageId: string;
  clusterId: string;
  chosenLane: SemanticOverrideLane;
  assertsAnswersParent: boolean;
  originalRouteSuggestion: SemanticRouteSuggestion;
  overriddenByUserId: string;
  overriddenByActorRole: SemanticOverrideActorRole;
  at: string; // ISO-8601, caller-supplied
}): SemanticOverrideRecord {
  const {
    prompt,
    messageId,
    clusterId,
    chosenLane,
    assertsAnswersParent,
    originalRouteSuggestion,
    overriddenByUserId,
    overriddenByActorRole,
    at,
  } = input;

  return {
    overrideId: `semantic_override:${messageId}:${at}`,
    messageId,
    clusterId,
    chosenLane,
    assertsAnswersParent,
    originalRouteSuggestion,
    // Copied from the prompt that offered the surface — defensive fallbacks
    // for the never-in-practice null path.
    triggerReason: prompt.triggerReason ?? 'low_confidence',
    contestedClassifierId: prompt.contestedClassifierId ?? '',
    at,
    overriddenByUserId,
    overriddenByActorRole,
  };
}

// ── MetadataEvent projectors ──────────────────────────────────────

/**
 * Pure. Projects a `SemanticOverrideRecord` to a META-001 `MetadataEvent`.
 * ALWAYS returns `kind: 'add'` and `codeFamily: 'semantic_override'` — an
 * override is an additive, append-only record; there is no remove path. `code`
 * is the chosen lane. The override is VISIBLE metadata, not hidden state.
 *
 * `cause` carries an internal debug string (`override_low_confidence` /
 * `override_l1_l2_conflict`) — never rendered (META-001's `cause` convention).
 */
export function toSemanticOverrideMetadataEvent(
  record: SemanticOverrideRecord,
): MetadataEvent {
  const code = record.chosenLane;
  return {
    eventId: `add:semantic_override:${code}:${record.messageId}:${record.at}`,
    kind: 'add',
    codeFamily: 'semantic_override',
    code,
    messageId: record.messageId,
    clusterId: record.clusterId,
    at: record.at,
    cause: causeForTriggerReason(record),
  };
}

/**
 * Pure. When `record.assertsAnswersParent` is true, returns the companion
 * `answers_parent` `MetadataEvent` (`kind: 'add'`,
 * `codeFamily: 'semantic_override'`). Returns `null` when the record does not
 * assert it. The two events share the same `at`; their `eventId`s differ by
 * `code`, so both are append-only and distinct in the log.
 *
 * This keeps each `MetadataEvent` one-`code`-per-event (META-001's shape)
 * while still recording both facts a single override can carry — a lane AND an
 * "answers the parent" assertion.
 */
export function toAnswersParentMetadataEvent(
  record: SemanticOverrideRecord,
): MetadataEvent | null {
  if (!record.assertsAnswersParent) {
    return null;
  }
  const code = 'answers_parent';
  return {
    eventId: `add:semantic_override:${code}:${record.messageId}:${record.at}`,
    kind: 'add',
    codeFamily: 'semantic_override',
    code,
    messageId: record.messageId,
    clusterId: record.clusterId,
    at: record.at,
    cause: causeForTriggerReason(record),
  };
}

/** Internal — the never-rendered debug `cause` string for an override event. */
function causeForTriggerReason(record: SemanticOverrideRecord): string {
  return record.triggerReason === 'l1_l2_conflict'
    ? 'override_l1_l2_conflict'
    : 'override_low_confidence';
}

// ── Repeated-override signal ───────────────────────────────────────

/**
 * Pure factory — a fresh zeroed signal for a room. In-memory, per-room,
 * per-session. NOT persisted.
 */
export function emptyRepeatedOverrideSignal(
  roomId: string,
): RepeatedOverrideSignal {
  return {
    roomId,
    overrideCountThisRoom: 0,
    softenCopy: false,
  };
}

/**
 * Pure. Returns a NEW signal with `overrideCountThisRoom + 1` and `softenCopy`
 * recomputed against `SOFTEN_COPY_THRESHOLD`. Never mutates the input.
 *
 * Produces NO persisted value, NO profile field, NO score, NO cross-room
 * aggregate. It is in-memory, per-room, per-session, and only feeds the
 * prompt copy code. `softenCopy` only swaps copy — it never suppresses the
 * surface.
 */
export function bumpRepeatedOverrideSignal(
  signal: RepeatedOverrideSignal,
): RepeatedOverrideSignal {
  const nextCount = signal.overrideCountThisRoom + 1;
  return {
    roomId: signal.roomId,
    overrideCountThisRoom: nextCount,
    softenCopy: nextCount >= SOFTEN_COPY_THRESHOLD,
  };
}

// ── Doctrine ban-list source ──────────────────────────────────────

/**
 * The ban-list source the doctrine test scans. NOT a content filter.
 *
 * The list pulls together verdict / person-attribution / penalty-framing
 * tokens that must never appear in any override copy string, any produced
 * `code`, or anywhere else in the override model's output.
 */
export function _forbiddenOverrideTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'won',
    'lost',
    'right',
    'wrong',
    'true',
    'false',
    'correct',
    'incorrect',
    'proven',
    'disproven',
    'defeated',
    'verdict',
    // Person-attribution tokens
    'liar',
    'lying',
    'dishonest',
    'bad faith',
    'manipulative',
    'troll',
    'bot',
    'propagandist',
    'extremist',
    'stupid',
    'idiot',
    'dumb',
    'smart',
    // Penalty / "you were warned" framing — overriding is never a penalty
    'you were warned',
    'penalty',
    'penalized',
    'rejected',
    'off-topic',
    'off topic',
    'blocked',
    'mistake',
  ];
}
