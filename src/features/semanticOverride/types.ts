/**
 * MCP-015 — Semantic override UX model: type contract.
 *
 * Implements MCP-010 §5.2 — the override / appeal state model. This file is
 * the pure-TypeScript shape layer that lets a participant reverse an uncertain
 * or conflicting semantic routing suggestion without ever feeling caged.
 *
 * This file is PURE TYPESCRIPT — type declarations + `const` arrays of known
 * values only. It has NO runtime import except a type-only import of
 * `SemanticRouteSuggestion`. Same constraint as `src/lib/constitution/engine.ts`,
 * `src/features/refereeLedger/types.ts`, and the META-001 ledger.
 *
 * Doctrine (cdiscourse-doctrine §1, §4; MCP-010 §3):
 *   - A semantic suggestion is never a hard gate — the move is already posted.
 *   - Overriding is NEVER a penalty: no score cost, no flag, no "you were
 *     warned" copy. `SemanticOverrideRecord` / `SemanticOverridePrompt` /
 *     `RepeatedOverrideSignal` carry NO `delta` / `score` / `penalty` /
 *     `block` / `flag` field. Enforced by
 *     `__tests__/semanticOverrideNoPenalty.test.ts`.
 *   - Observers are NEVER offered the override surface.
 *   - The override is recorded as visible, append-only, META-001-style
 *     metadata — never hidden state.
 */

import type { SemanticRouteSuggestion } from '../semanticReferee/semanticRefereeTypes';

// ── Lane vocabulary ────────────────────────────────────────────────

/**
 * The lane the user chose. These values feed BR-003 / BR-004's branch
 * grammar as an ADVISORY input — MCP-015 records the choice; BR-003 / BR-004
 * route it. Deliberately a small named union so a future card can widen it
 * without a contract break (MCP-010 §13 risk).
 */
export type SemanticOverrideLane = 'mainline' | 'branch' | 'tangent';

/** Frozen array — tests + the copy-coverage scan iterate this. */
export const ALL_SEMANTIC_OVERRIDE_LANES: readonly SemanticOverrideLane[] = Object.freeze([
  'mainline',
  'branch',
  'tangent',
]);

// ── Trigger reason ────────────────────────────────────────────────

/** Why the override surface was offered in the first place. */
export type SemanticOverrideTriggerReason =
  | 'low_confidence' // a routing-relevant binary in the packet has confidence 'low'
  | 'l1_l2_conflict'; // MCP-013 reconciliation produced a conflict_routed routing reading

export const ALL_SEMANTIC_OVERRIDE_TRIGGER_REASONS: readonly SemanticOverrideTriggerReason[] =
  Object.freeze(['low_confidence', 'l1_l2_conflict']);

// ── Actor role ────────────────────────────────────────────────────

/**
 * The viewer's role on the room. Mirrors META-001's `ManualTagActorRole`
 * verbatim so the override layer and the manual-tag layer agree on roles.
 * Observers are NEVER offered the override surface (see the Actor rule in the
 * trigger model).
 */
export type SemanticOverrideActorRole =
  | 'participant_affirmative'
  | 'participant_negative'
  | 'observer'
  | 'admin';

// ── The per-move append-only record ───────────────────────────────

/**
 * One append-only override record attached to one move. Visible metadata —
 * never hidden state. The `MetadataEvent` (META-001) is the log entry; this is
 * the fuller record the sidecar renders.
 *
 * DOCTRINE — has NO `delta`, NO `score`, NO `penalty`, NO `block`, NO `flag`
 * field. Overriding is never a penalty. Enforced by
 * `__tests__/semanticOverrideNoPenalty.test.ts`.
 */
export interface SemanticOverrideRecord {
  /** Stable id — `semantic_override:${messageId}:${at}`. */
  overrideId: string;
  messageId: string;
  clusterId: string;
  /** The lane the user picked. */
  chosenLane: SemanticOverrideLane;
  /**
   * True when the user explicitly asserted "this answers the parent" to
   * overturn a `responds_to_parent: 0`. Independent of `chosenLane` — a user
   * can assert "answers the parent" AND keep the move on the mainline.
   */
  assertsAnswersParent: boolean;
  /**
   * What the referee suggested before the override — recorded so the audit
   * trail shows what was reversed. Plain-language-mapped before render.
   */
  originalRouteSuggestion: SemanticRouteSuggestion;
  /** Why the choice was offered. */
  triggerReason: SemanticOverrideTriggerReason;
  /**
   * The classifier id family that was contested (e.g. 'responds_to_parent',
   * 'suggests_side_branch'). Internal — mapped through gameCopy before render;
   * never echoed raw to a user surface.
   */
  contestedClassifierId: string;
  /** ISO-8601 — caller-supplied tap time. */
  at: string;
  /** The viewer who made the override (current viewer id, caller-supplied). */
  overriddenByUserId: string;
  /** Actor role of the overrider. */
  overriddenByActorRole: SemanticOverrideActorRole;
}

// ── The trigger model output ──────────────────────────────────────

/**
 * Output of the pure trigger model — decides whether the choice surface
 * appears and what it should offer. Computed from a packet + a `LedgerResult`
 * + the viewer role + the in-memory `RepeatedOverrideSignal`.
 */
export interface SemanticOverridePrompt {
  /** True when the choice surface should be shown for this move. */
  shouldOffer: boolean;
  /**
   * Why — drives the produced record's `triggerReason` + the prompt copy.
   * Null when `shouldOffer` is false.
   */
  triggerReason: SemanticOverrideTriggerReason | null;
  /** The referee's current routing suggestion the user may reverse. */
  suggestedLane: SemanticOverrideLane;
  /**
   * True when a `responds_to_parent: 0` binary (or its conflict) is in play,
   * so the "this answers the parent" toggle is offered.
   */
  offersAnswersParentToggle: boolean;
  /**
   * The contested classifier id — recorded onto the record, mapped for copy.
   * Null when `shouldOffer` is false.
   */
  contestedClassifierId: string | null;
  /**
   * Plain-language code for the prompt headline — a key of
   * `PLAIN_LANGUAGE_COPY`. One of `semantic_override_prompt_low_conf` /
   * `semantic_override_prompt_conflict` / `semantic_override_prompt_soft`.
   * Empty string when `shouldOffer` is false.
   */
  promptCopyCode: string;
}

// ── The in-memory repeated-override signal ────────────────────────

/**
 * Per-room, in-memory, per-render. NOT persisted. NOT a user-level score.
 * NOT sent anywhere. NOT a model-training input. It exists ONLY so the prompt
 * copy can soften after a user has reversed several suggestions in one room.
 *
 * DOCTRINE — this shape MUST NOT gain a persistence field, a profile field,
 * a cross-room aggregate, or any score field. Enforced by
 * `__tests__/semanticOverrideNoPenalty.test.ts`.
 */
export interface RepeatedOverrideSignal {
  roomId: string;
  /** Count of override records in this room this session. */
  overrideCountThisRoom: number;
  /**
   * True once the count crosses `SOFTEN_COPY_THRESHOLD`. When true the trigger
   * model picks the quieter `semantic_override_prompt_soft` copy code. A UX
   * constant, not a gate — the surface is never suppressed.
   */
  softenCopy: boolean;
}

/** The count at which the prompt copy softens. A UX constant, not a gate. */
export const SOFTEN_COPY_THRESHOLD = 3;
