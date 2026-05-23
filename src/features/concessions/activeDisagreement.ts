/**
 * QOL-041 — Active-disagreement classification (pure TypeScript).
 *
 * The room's "active disagreement is fact-based" metadata (storyboard
 * Step 8 / Step 10) is DERIVED from the most-recent `concession_acceptances`
 * rows attached to the most-recent `respond_to_concession` argument in
 * the room. No new DB column; the derivation is pure (QOL-041 design
 * §5.3, §1 finding F4).
 *
 * Doctrine anchors — read before changing anything (QOL-041 §11):
 *
 *   1. The kind is the RECEIVER'S STATED STANCE, never a truth ruling.
 *      "Unresolved: fact" describes "the receiver disputes the point on
 *      fact-grounds"; it never asserts the point is false.
 *   2. `fact > context > framing` is a UI-FOCUS materiality ordering, not
 *      a truth rank. It picks which open axis the room status should
 *      foreground (the most concrete one), not a winner.
 *   3. `agree_with_caveat` is a RIDER, not a dispute (§5.3 rule 2). A set
 *      where every row is `agree` or `agree_with_caveat` derives to
 *      `none` — the caveat is on the record (the clarification is
 *      required), but the receiver did not open a framing/context/fact
 *      axis.
 *   4. Newest-argument wins. A receiver who replaces their stance posts
 *      a NEW `respond_to_concession` move (acceptances are immutable);
 *      the derivation reads the newest argument's rows.
 *   5. Pure. Deterministic. No AI. No network.
 */

import type { AcceptanceLevel } from './acceptanceGradient';

// ── The kind ───────────────────────────────────────────────────

/**
 * Coarse classification of the room's live disagreement, derived from
 * the receiver's most-recent acceptance set. The four values:
 *
 *   - `framing` — the receiver disputes the FRAMING of at least one
 *                 conceded point (none more concrete is open).
 *   - `context` — the receiver disputes the CONTEXT of at least one
 *                 conceded point (no fact-axis is open).
 *   - `fact`    — the receiver disputes the FACT of at least one
 *                 conceded point. Most concrete open axis.
 *   - `none`    — every row is `agree` or `agree_with_caveat`, OR no
 *                 acceptance set exists yet. No active fact/context/
 *                 framing disagreement.
 */
export type ActiveDisagreementKind = 'framing' | 'context' | 'fact' | 'none';

/** Frozen array of every kind — tests + UI iterate this. */
export const ALL_ACTIVE_DISAGREEMENT_KINDS: ReadonlyArray<ActiveDisagreementKind> = Object.freeze([
  'none',
  'framing',
  'context',
  'fact',
]);

// ── Plain-language copy ───────────────────────────────────────

/**
 * The room status strip text the UI surfaces for each kind. PLAIN
 * LANGUAGE, never internal codes. Scanned by
 * `__tests__/qol041-doctrine.test.ts`.
 *
 * "Unresolved" describes the gameplay state of the room (the receiver
 * has raised an axis the conceding party has not yet repaired); it does
 * NOT assert the conceded point is wrong. The room status is GAMEPLAY
 * ANALYSIS, not a truth ruling (QOL-041 §11).
 */
export const ACTIVE_DISAGREEMENT_LABEL: Readonly<Record<ActiveDisagreementKind, string>> =
  Object.freeze({
    none: 'No active disagreement on the conceded points.',
    framing: 'Active disagreement: framing.',
    context: 'Active disagreement: context.',
    fact: 'Active disagreement: fact.',
  });

// ── Input shape ────────────────────────────────────────────────

/**
 * One `concession_acceptances` row as the derivation sees it. The
 * derivation reads only the level + which argument the row belongs to
 * (to pick the newest argument's rows).
 *
 * The caller pre-fetches the rows from the database and passes them
 * NEWEST-FIRST by `created_at` of the parent `respond_to_concession`
 * argument; the derivation respects that order (and the model never
 * fetches anything itself).
 */
export interface ConcessionAcceptanceRow {
  /** The receiving argument id (the `respond_to_concession` move). */
  argumentId: string;
  /** The receiver's pick on this row. */
  acceptanceLevel: AcceptanceLevel;
}

// ── Derivation (§5.3) ─────────────────────────────────────────

/**
 * Per QOL-041 §5.3 rule 3, the precedence among non-`agree` levels.
 * Module-private so the precedence cannot be re-ordered by a consumer.
 */
const PRECEDENCE: Readonly<Record<AcceptanceLevel, number>> = Object.freeze({
  agree: -1,
  agree_with_caveat: -1, // riders never raise an axis (§5.3 rule 2)
  disagree_framing: 1,
  disagree_context: 2,
  disagree_fact: 3, // most material — surfaced first when present
});

const LEVEL_TO_KIND: Readonly<Record<AcceptanceLevel, ActiveDisagreementKind>> = Object.freeze({
  agree: 'none',
  agree_with_caveat: 'none',
  disagree_framing: 'framing',
  disagree_context: 'context',
  disagree_fact: 'fact',
});

/**
 * Derives the room's active-disagreement kind from a list of acceptance
 * rows. Per QOL-041 §5.3:
 *
 *   1. Look at the acceptances attached to the NEWEST
 *      `respond_to_concession` argument in the room — the caller passes
 *      rows newest-first, so the derivation walks the prefix sharing
 *      the first row's `argumentId`.
 *   2. If every level is `agree` or `agree_with_caveat` → `none`.
 *   3. Otherwise pick the MOST MATERIAL non-`agree` level using
 *      `fact > context > framing`.
 *
 * An empty input array → `none` (no acceptance set yet exists in the
 * room — derivation rule 2 is unreachable; this is the
 * no-set-at-all case the derivation must handle separately).
 *
 * Pure. Total. Returns the same kind for the same input.
 */
export function deriveActiveDisagreement(
  acceptancesNewestFirst: ReadonlyArray<ConcessionAcceptanceRow>,
): ActiveDisagreementKind {
  if (acceptancesNewestFirst.length === 0) return 'none';
  const newestArgumentId = acceptancesNewestFirst[0].argumentId;
  // Only consider rows that belong to the newest receiving argument.
  // Older `respond_to_concession` moves are stale — the receiver
  // restated their stance by posting a new move (acceptances are
  // immutable; see §5.5 — no UPDATE / DELETE policy).
  let bestPrecedence = -1;
  let bestKind: ActiveDisagreementKind = 'none';
  for (const row of acceptancesNewestFirst) {
    if (row.argumentId !== newestArgumentId) break;
    const p = PRECEDENCE[row.acceptanceLevel];
    if (p > bestPrecedence) {
      bestPrecedence = p;
      bestKind = LEVEL_TO_KIND[row.acceptanceLevel];
    }
  }
  return bestKind;
}

/**
 * Convenience: the plain-language room-status line for a kind. Pure.
 * Total. Returns the same string for the same input.
 */
export function activeDisagreementLabel(kind: ActiveDisagreementKind): string {
  return ACTIVE_DISAGREEMENT_LABEL[kind];
}
