/**
 * QOL-041 — Acceptance gradient vocabulary (pure TypeScript).
 *
 * The 5-level gradient the receiver picks on every mirrored concession-item
 * row in the `respond_to_concession` box (QOL-041 design §1, §4, §7.2).
 *
 *   Agree · Agree with caveat · Disagree based on framing ·
 *   Disagree based on context · Disagree based on fact
 *
 * Doctrine anchors — read before changing anything (QOL-041 §4, §11):
 *
 *   1. The gradient is GAMEPLAY ANALYSIS, never a truth ruling. "Disagree
 *      based on fact" describes the RECEIVER'S STATED STANCE toward a
 *      point, never a verdict that the point is false (§7.2, §11).
 *      `fact > context > framing` is a UI-FOCUS materiality ordering, not a
 *      truth rank (§5.3 rule 3, encoded in `activeDisagreement.ts`).
 *   2. The gradient is a VOCABULARY BRIDGE to the point-standing economy,
 *      not a parallel scoring path (§4). This module owns level + plain-
 *      language copy + the `ACCEPTANCE_TO_CONCESSION_EFFECT` family map.
 *      It NEVER produces a `PointStandingDelta`. A future stage routes the
 *      stored level through `gradeRepair` — QOL-041 only stores the level
 *      and the clarification (`docs/point-standing-economy.md`).
 *   3. A non-`agree` level REQUIRES a clarification (§1 finding F3, §7.2).
 *      This is enforced THREE times: in `respondToConcessionModel.isPostable()`
 *      (client), in `submit-argument` (authoritative), and in the
 *      `clarification_required_unless_agree` CHECK on
 *      `concession_acceptances` (defense-in-depth). This file owns the
 *      pure predicate `acceptanceRequiresClarification`.
 *   4. Plain-language only — no internal codes leak (`cdiscourse-doctrine` §9).
 *      The labels and helper lines are scanned by
 *      `__tests__/qol041-doctrine.test.ts` for verdict / amplification tokens
 *      and snake_case leaks.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import type { ConcessionEffect } from '../pointStanding/types';

// ── The 5-level vocabulary ─────────────────────────────────────

/**
 * The 5 levels the receiver picks on each mirrored concession-item row.
 * Vocabulary verbatim from the QOL-041 design §1 / §7.2 table and the
 * interaction-taxonomy "Concession acceptance" row.
 */
export type AcceptanceLevel =
  | 'agree'
  | 'agree_with_caveat'
  | 'disagree_framing'
  | 'disagree_context'
  | 'disagree_fact';

/** Frozen array of every level — tests + UI iterate this. */
export const ALL_ACCEPTANCE_LEVELS: ReadonlyArray<AcceptanceLevel> = Object.freeze([
  'agree',
  'agree_with_caveat',
  'disagree_framing',
  'disagree_context',
  'disagree_fact',
]);

// ── Plain-language copy (§7.2) ────────────────────────────────

/**
 * One row of plain-language copy for one `AcceptanceLevel`. The label is
 * the segment label on the gradient control (≤ 32 chars); the helper line
 * is the row's secondary text shown when the segment is selected.
 *
 * Doctrine: no verdict tokens, no internal codes. The labels describe the
 * receiver's stated stance, never a truth claim about the conceded point.
 */
export interface AcceptanceLevelCopy {
  /** Short label for the segment (≤ 32 chars; scanned by the ban-list). */
  label: string;
  /** One-line helper text shown when the segment is selected (≤ 80 chars). */
  helper: string;
}

/**
 * The plain-language copy map. Wholly authored here (QOL-041 §7.2). Every
 * string is scanned by `__tests__/qol041-doctrine.test.ts` for the
 * `_forbiddenAcceptanceGradientTokens` list — winner / loser / truth /
 * verdict / correct / false / liar / dishonest / bad faith / game.
 */
export const ACCEPTANCE_LEVEL_COPY: Readonly<Record<AcceptanceLevel, AcceptanceLevelCopy>> =
  Object.freeze({
    agree: Object.freeze({
      label: 'Agree',
      helper: 'You accept this point.',
    }),
    agree_with_caveat: Object.freeze({
      label: 'Agree with caveat',
      helper: 'You accept it, with one rider.',
    }),
    disagree_framing: Object.freeze({
      label: 'Disagree based on framing',
      helper: "The point is framed in a way you don't accept.",
    }),
    disagree_context: Object.freeze({
      label: 'Disagree based on context',
      helper: 'The point misses context you want to add.',
    }),
    disagree_fact: Object.freeze({
      label: 'Disagree based on fact',
      helper: 'The point rests on a fact you dispute.',
    }),
  });

// ── Clarification-required predicate (§7.2 finding F3) ────────

/**
 * Returns true when the given acceptance level requires a clarification
 * body. Per design §7.2 / §11, every non-`agree` level requires a
 * clarification — `agree_with_caveat` requires the caveat be stated to
 * be on the record; the three `disagree_*` levels require the dispute be
 * explained.
 *
 * This is the pure predicate the box's `isPostable()`, the Edge
 * Function's payload check, and the table's CHECK constraint all derive
 * from. Pure. Total over the union.
 */
export function acceptanceRequiresClarification(level: AcceptanceLevel): boolean {
  return level !== 'agree';
}

// ── Vocabulary bridge → point-standing `ConcessionEffect` (§4) ─

/**
 * Per QOL-041 §4 doctrine binding: the gradient maps to *families* of
 * `ConcessionEffect` for a FUTURE wiring stage. This card stores only the
 * level + the clarification — it does NOT call `gradeRepair`, does NOT
 * compute any delta, does NOT produce a `PointStandingDelta`. The mapping
 * is a label correspondence so the future grader knows which
 * `gradeRepair` path each level corresponds to.
 *
 * Per design §4, the map uses the SHIPPED `ConcessionEffect` enum
 * (`explicit_narrow_concession_preserves_broad_point`,
 * `explicit_broad_concession_abandons_point`,
 * `implied_narrow_concession_preserves_broad_point`,
 * `implied_broad_concession_abandons_point`,
 * `performative_concession_no_repair`, `no_concession`). The acceptance
 * gradient is the RECEIVER'S response to a concession, so the mapping
 * answers: "if the receiver picks this level, which gradeRepair outcome
 * family is the relevant one?"
 *
 *   - `agree`              → the concession LANDS — the future grader runs
 *                            the explicit-concession path for whichever
 *                            shape the conceding party actually offered.
 *                            Defaults to `explicit_narrow_concession_preserves_broad_point`
 *                            (the most common / charitable interpretation).
 *   - `agree_with_caveat`  → the concession lands with a rider; the same
 *                            explicit path applies — the caveat is stored
 *                            as the clarification, not as a fresh effect.
 *   - `disagree_framing`   → the concession DID NOT land; the receiver
 *                            challenges the frame. The future grader maps
 *                            this to `performative_concession_no_repair`
 *                            (the offered concession did not actually
 *                            repair the open issue).
 *   - `disagree_context`   → same family as `disagree_framing`: the
 *                            concession did not actually repair the issue
 *                            the receiver sees as live.
 *   - `disagree_fact`      → same family: the offered concession is built
 *                            on a fact the receiver disputes, so it does
 *                            not function as a repair.
 *
 * This is a VOCABULARY BRIDGE, not a scoreboard. The future wiring stage
 * may refine the per-level mapping (e.g., distinguish `disagree_fact`
 * from `disagree_framing` for issue-debt opening); the point of the
 * bridge here is that every level has a known counterpart in the shipped
 * `ConcessionEffect` enum so the future card has nothing to invent.
 */
export const ACCEPTANCE_TO_CONCESSION_EFFECT: Readonly<Record<AcceptanceLevel, ConcessionEffect>> =
  Object.freeze({
    agree: 'explicit_narrow_concession_preserves_broad_point',
    agree_with_caveat: 'explicit_narrow_concession_preserves_broad_point',
    disagree_framing: 'performative_concession_no_repair',
    disagree_context: 'performative_concession_no_repair',
    disagree_fact: 'performative_concession_no_repair',
  });

// ── Ban-list support ───────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/qol041-doctrine.test.ts`. NOT a
 * content filter — a regression guard on the QOL-041 user-facing strings
 * authored in this module + `respondToConcessionModel`, `activeDisagreement`,
 * and the UI component label tables.
 *
 * Mirrors `_forbiddenBoxTokens` (QOL-030 `boxModel.ts`) with the QOL-041
 * §10 / §11 additions specific to this card: `verdict`, `truth`, `game`.
 * The list is intentionally narrower than the QOL-030 list (it excludes
 * everyday English verbs that already appear in operational prose like
 * "right" / "wrong" / "shares") because the QOL-041 surface is small,
 * tightly authored, and never includes operational prose.
 */
export function _forbiddenAcceptanceGradientTokens(): string[] {
  return [
    // Verdict tokens (QOL-041 §10 explicit ban-list).
    'winner',
    'loser',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'verdict',
    'correct',
    'incorrect',
    'truth',
    'troll',
    'astroturfer',
    // Amplification tokens (cdiscourse-doctrine §3).
    'likes',
    'retweets',
    'shares',
    'followers',
    'engagement',
    'amplification',
    'trending',
    'virality',
    'viral',
    // Repo-vocabulary scrubs (QOL-035 — argument over debate, no "game").
    'game',
  ];
}
