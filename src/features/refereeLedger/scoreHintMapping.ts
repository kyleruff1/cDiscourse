/**
 * MCP-013 — Referee ledger: scoreHints → category mapping (MCP-003 §6).
 *
 * Translates the six advisory `SemanticScoreHints` integers (each 0..3, pinned
 * by the MCP-011 validator) into a bounded ledger contribution per category.
 *
 * The crucial direction rule (MCP-003 §6.1 — encoded here as a hard
 * invariant): a hint may only ADD CREDIT, OPEN / SIZE A DEBT, or RAISE A
 * ROUTING PROMPT. A hint function can NEVER return a negative magnitude. The
 * only negative deltas in the whole ledger come from the economy's own
 * reviewed `gradeRepair` evasion path (adopted verbatim) and the negative-only
 * `person_intent_drift` hygiene reading.
 *
 * Pure TypeScript. No network. No Supabase. No React.
 */

import type { SemanticScoreHints } from '../semanticReferee/semanticRefereeTypes';
import type { RefereePointCategory } from './types';

// ── Constants (MCP-003 §6.2) ──────────────────────────────────────

/**
 * One hint step. A max hint of 3 contributes `0.24` — comparable to the
 * economy's `+0.25` broad-lift, deliberately not larger (MCP-011 confirmed
 * `SCORE_HINT_MAX = 3`).
 */
export const HINT_STEP = 0.08;

/** Per-category delta clamp bounds (MCP-003 §6.2). */
export const CATEGORY_DELTA_MIN = -0.4;
export const CATEGORY_DELTA_MAX = 0.4;

/** Clamp a category delta to `[-0.4, +0.4]`. Non-finite input clamps to 0. */
export function clampCategoryDelta(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < CATEGORY_DELTA_MIN) return CATEGORY_DELTA_MIN;
  if (n > CATEGORY_DELTA_MAX) return CATEGORY_DELTA_MAX;
  return n;
}

// ── Hint contribution shape ───────────────────────────────────────

/** How a hint mode behaves — credit, open/size a debt, or raise a routing prompt. */
export type HintMode = 'credit' | 'opens_debt' | 'routes';

/**
 * One hint's contribution. `magnitude` is ALWAYS `>= 0` — a hint never
 * subtracts standing (MCP-003 §6.1).
 */
export interface HintContribution {
  contributesTo: RefereePointCategory[];
  mode: HintMode;
  /** Always >= 0. */
  magnitude: number;
}

/** Coerce a raw hint integer to a non-negative finite number. */
function safeHint(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// ── Six pure functions, one per hint field (MCP-003 §6) ───────────

/**
 * `continuityCredit` → `continuity` + `direct_response`. Credit only; `0`
 * means no credit, never a penalty.
 */
export function continuityCreditContribution(hints: SemanticScoreHints): HintContribution {
  return {
    contributesTo: ['continuity', 'direct_response'],
    mode: 'credit',
    magnitude: HINT_STEP * safeHint(hints.continuityCredit),
  };
}

/**
 * `evidencePressure` → `evidence_provided` + `evidence_relevance`. A `> 0`
 * value means the move NEEDS evidence — it opens a debt; it never subtracts
 * standing. A prompt, not a penalty.
 */
export function evidencePressureContribution(hints: SemanticScoreHints): HintContribution {
  return {
    contributesTo: ['evidence_provided', 'evidence_relevance'],
    mode: 'opens_debt',
    magnitude: HINT_STEP * safeHint(hints.evidencePressure),
  };
}

/**
 * `branchHygiene` → `branch_hygiene`. Credit, reconciled against the BR-001
 * `branchKind` (L1-dominant).
 */
export function branchHygieneContribution(hints: SemanticScoreHints): HintContribution {
  return {
    contributesTo: ['branch_hygiene'],
    mode: 'credit',
    magnitude: HINT_STEP * safeHint(hints.branchHygiene),
  };
}

/**
 * `synthesisReadiness` → `synthesis`. Gated credit: contributes credit only
 * when `lifecycleSynthesisReady` is true (the caller passes that through);
 * otherwise the magnitude still flows but the reconciler produces the
 * `almost_a_synthesis` prompt instead of a credit.
 */
export function synthesisReadinessContribution(hints: SemanticScoreHints): HintContribution {
  return {
    contributesTo: ['synthesis'],
    mode: 'credit',
    magnitude: HINT_STEP * safeHint(hints.synthesisReadiness),
  };
}

/**
 * `sourceChainDebt` → `evidence_debt_resolution`. A `> 0` value SIZES the
 * evidence debt the economy tracks; a later move that closes it earns
 * `evidence_debt_resolution` credit. Opens a debt — never a penalty.
 */
export function sourceChainDebtContribution(hints: SemanticScoreHints): HintContribution {
  return {
    contributesTo: ['evidence_debt_resolution'],
    mode: 'opens_debt',
    magnitude: HINT_STEP * safeHint(hints.sourceChainDebt),
  };
}

/**
 * `unresolvedRedirectRisk` → `branch_hygiene` (route) + `person_intent_drift`
 * (drift). High redirect risk raises a reversible routing prompt; it never
 * subtracts standing.
 */
export function unresolvedRedirectRiskContribution(hints: SemanticScoreHints): HintContribution {
  return {
    contributesTo: ['branch_hygiene', 'person_intent_drift'],
    mode: 'routes',
    magnitude: HINT_STEP * safeHint(hints.unresolvedRedirectRisk),
  };
}

// ── Aggregate lookup: hint magnitude per category ─────────────────

/**
 * Build the full set of hint contributions for a packet's `scoreHints`.
 * Returns one entry per hint field. The caller folds the relevant magnitude
 * into a category reading before clamping.
 */
export function allHintContributions(hints: SemanticScoreHints): HintContribution[] {
  return [
    continuityCreditContribution(hints),
    evidencePressureContribution(hints),
    branchHygieneContribution(hints),
    synthesisReadinessContribution(hints),
    sourceChainDebtContribution(hints),
    unresolvedRedirectRiskContribution(hints),
  ];
}

/**
 * The total hint magnitude (always `>= 0`) that feeds one category. Sums
 * across every hint contribution whose `contributesTo` includes the category.
 * Returns `0` when no hint touches the category or `hints` is absent.
 */
export function hintMagnitudeForCategory(
  category: RefereePointCategory,
  hints: SemanticScoreHints | undefined,
): number {
  if (!hints) return 0;
  let total = 0;
  for (const contribution of allHintContributions(hints)) {
    if (contribution.contributesTo.includes(category)) {
      total += contribution.magnitude;
    }
  }
  return total;
}
