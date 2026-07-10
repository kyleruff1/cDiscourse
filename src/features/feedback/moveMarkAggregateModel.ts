/**
 * FEEDBACK-001 (#898) — the ONE move-mark aggregate derivation (pure TypeScript).
 *
 * Both room-level aggregate surfaces (the ArgumentStateRail input fold + the Map
 * legend line) consume THIS output and nothing else derives marks. The aggregate
 * is a room-level ambient reading, NEVER a per-message counter and NEVER a
 * per-person tally.
 *
 * Doctrine (point-standing-economy / anti-amplification): this is the load-bearing
 * boundary. The aggregate feeds the mediator projection + heat inputs only. It
 * carries NO score, NO standing delta, NO weight, NO percentage — a pile of
 * did_not_address marks can NEVER lower a claim's factual standing. This module
 * imports no pointStanding. `feedbackMoveMarksNoStanding.test.ts` pins both the
 * no-import rule and the no-score-field shape.
 *
 * Pure. Total. No Date.now(), no AI, no async, no network, no mutation.
 */
import type { MoveMarkRow } from './moveMarksModel';

/** Distinct-count of receipts_requested that turns into a proof-prompt nudge. */
export const RECEIPTS_PROMPT_THRESHOLD = 2;

export interface MoveMarkAggregate {
  /**
   * Argument ids with at least one ACTIVE did_not_address mark. These chains
   * weight the mediator "what remains unresolved" reading (never a verdict).
   * Sorted for determinism.
   */
  unaddressedMoveIds: readonly string[];
  /**
   * Active receipts_requested count per argument id. 2+ on one claim is the
   * proof-prompt nudge (Output 9: "ProofButton goes gold on that move"). A count,
   * never a score. Only ids with at least one active request appear.
   */
  receiptsRequestedByArgumentId: Readonly<Record<string, number>>;
  /**
   * Argument ids with at least one ACTIVE off_the_point mark. Sorted for
   * determinism. (No UI entry point writes this code in this card; the field is
   * derived for the future branch-nudge surface.)
   */
  offThePointMoveIds: readonly string[];
}

/**
 * Derive the room-level move-mark aggregate from the ACTIVE move_marks rows. Any
 * retracted row (retractedAt !== null) is defensively ignored. The output is
 * deterministic (id lists sorted) and carries NO score / standing / weight field.
 */
export function deriveMoveMarkAggregate(activeRows: readonly MoveMarkRow[]): MoveMarkAggregate {
  const unaddressed = new Set<string>();
  const offThePoint = new Set<string>();
  const receipts: Record<string, number> = {};

  for (const row of activeRows) {
    if (row.retractedAt !== null) continue;
    if (row.markCode === 'did_not_address') {
      unaddressed.add(row.argumentId);
    } else if (row.markCode === 'off_the_point') {
      offThePoint.add(row.argumentId);
    } else if (row.markCode === 'receipts_requested') {
      receipts[row.argumentId] = (receipts[row.argumentId] ?? 0) + 1;
    }
  }

  return {
    unaddressedMoveIds: Object.freeze([...unaddressed].sort()),
    receiptsRequestedByArgumentId: Object.freeze({ ...receipts }),
    offThePointMoveIds: Object.freeze([...offThePoint].sort()),
  };
}

/** Argument ids whose active receipts_requested count reaches the prompt threshold. */
export function receiptsPromptMoveIds(aggregate: MoveMarkAggregate): readonly string[] {
  return Object.entries(aggregate.receiptsRequestedByArgumentId)
    .filter(([, count]) => count >= RECEIPTS_PROMPT_THRESHOLD)
    .map(([id]) => id)
    .sort();
}
