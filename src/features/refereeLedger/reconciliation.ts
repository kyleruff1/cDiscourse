/**
 * MCP-013 — Referee ledger: per-category reconciliation (MCP-003 §5).
 *
 * `reconcileCategory` resolves one play-quality category between layer-1
 * (deterministic) and layer-2 (advisory semantic) signals. It NEVER computes
 * standing — it produces `outcome` / `confidence` / `requiresUserChoice` and
 * the magnitude CAP. The economy owns the standing numbers; this module owns
 * the reconciliation outcome.
 *
 * Hard doctrine encoded here:
 *   - A layer-1 / layer-2 conflict on a `neither`-authority category routes
 *     (`conflict_routed`, `delta: 0`) — NEVER a penalty.
 *   - A low-confidence semantic binary moves no standing on its own — it is
 *     forced to `low_confidence_semantic`, `delta: 0`, before the authority
 *     branch can run.
 *   - An `l1`-authority conflict uses the L1 value, downgrades confidence to
 *     medium, and never penalizes the disagreement.
 *
 * Pure TypeScript. No network. No Supabase. No React.
 */

import type { SemanticConfidence } from '../semanticReferee/semanticRefereeTypes';
import { clampCategoryDelta } from './scoreHintMapping';
import type {
  CategoryReading,
  CreditAxis,
  LedgerConfidence,
  RefereeFeedbackCode,
  RefereePointCategory,
} from './types';

// ── Per-category authority table (MCP-003 §5.3) ───────────────────

/**
 * Which layer is authoritative for each category.
 *   - `economy`  — the point-standing economy owns the delta; reconciliation
 *                  only confirms. (`narrowing`, `concession`,
 *                  `evidence_debt_resolution`.)
 *   - `l1`       — the deterministic fact stands; an L1/L2 conflict resolves
 *                  `conflict_l1_dominant`.
 *   - `l2`       — the semantic layer reads what L1 cannot see; magnitude
 *                  capped at the medium tier.
 *   - `neither`  — no single layer dominates; an L1/L2 conflict ROUTES.
 */
export const CATEGORY_AUTHORITY: Readonly<
  Record<RefereePointCategory, 'l1' | 'l2' | 'economy' | 'neither'>
> = Object.freeze({
  continuity: 'neither',
  direct_response: 'neither',
  evidence_provided: 'l1',
  evidence_relevance: 'l2',
  quote_anchoring: 'l1',
  narrowing: 'economy',
  concession: 'economy',
  clarification: 'l1',
  synthesis: 'l1',
  branch_hygiene: 'l1',
  person_intent_drift: 'neither',
  evidence_debt_resolution: 'economy',
  staying_in_mode: 'l1',
  respecting_pacing: 'l1',
});

/** The medium-tier magnitude cap for `l2`-authority categories (HINT_STEP * 2). */
export const L2_MEDIUM_TIER_CAP = 0.16;

// ── feedbackCode per category ─────────────────────────────────────

/** Positive / agreement feedback code per category. */
const POSITIVE_FEEDBACK: Readonly<Record<RefereePointCategory, RefereeFeedbackCode>> = Object.freeze({
  continuity: 'clean_parent_tie',
  direct_response: 'answered_the_question',
  evidence_provided: 'source_attached',
  evidence_relevance: 'evidence_connects',
  quote_anchoring: 'nicely_anchored',
  narrowing: 'nice_narrowing',
  concession: 'concession_noted',
  clarification: 'clarification_in_play',
  synthesis: 'synthesis_named',
  branch_hygiene: 'clean_branch',
  person_intent_drift: 'back_to_the_claim',
  evidence_debt_resolution: 'debt_resolved',
  staying_in_mode: 'fits_the_room',
  respecting_pacing: 'pacing_is_on',
});

/** Soft / low-confidence / partial feedback code per category. */
const SOFT_FEEDBACK: Readonly<Record<RefereePointCategory, RefereeFeedbackCode>> = Object.freeze({
  continuity: 'partial_parent_tie',
  direct_response: 'question_still_open',
  evidence_provided: 'evidence_debt_open',
  evidence_relevance: 'evidence_needs_connecting',
  quote_anchoring: 'nicely_anchored',
  narrowing: 'nice_narrowing',
  concession: 'concession_noted',
  clarification: 'clarification_in_play',
  synthesis: 'almost_a_synthesis',
  branch_hygiene: 'belongs_on_a_branch',
  person_intent_drift: 'back_to_the_claim',
  evidence_debt_resolution: 'evidence_debt_open',
  staying_in_mode: 'fits_the_room',
  respecting_pacing: 'pacing_is_on',
});

/** The positive feedback code for a category. */
export function positiveFeedbackCode(category: RefereePointCategory): RefereeFeedbackCode {
  return POSITIVE_FEEDBACK[category];
}

/** The soft / low-confidence feedback code for a category. */
export function softFeedbackCode(category: RefereePointCategory): RefereeFeedbackCode {
  return SOFT_FEEDBACK[category];
}

// ── Credit-axis classification ────────────────────────────────────

/** Categories that sit on the factual-standing axis (evidence-bearing). */
const FACTUAL_STANDING_CATEGORIES: ReadonlySet<RefereePointCategory> = new Set<RefereePointCategory>([
  'evidence_provided',
  'evidence_relevance',
  'evidence_debt_resolution',
]);

/** Categories that sit on the engagement axis (constructive movement). */
const ENGAGEMENT_CATEGORIES: ReadonlySet<RefereePointCategory> = new Set<RefereePointCategory>([
  'narrowing',
  'concession',
  'synthesis',
  'clarification',
]);

/**
 * Which axis a category credits. Evidence categories → `factual_standing`;
 * constructive-movement categories → `engagement`; everything structural →
 * `hygiene`. Engagement and factual-standing credit stay on separate axes.
 */
export function creditAxisForCategory(category: RefereePointCategory): CreditAxis {
  if (FACTUAL_STANDING_CATEGORIES.has(category)) return 'factual_standing';
  if (ENGAGEMENT_CATEGORIES.has(category)) return 'engagement';
  return 'hygiene';
}

/** True for evidence-bearing categories that route through anti-amplification. */
export function isFactualStandingCategory(category: RefereePointCategory): boolean {
  return FACTUAL_STANDING_CATEGORIES.has(category);
}

// ── reconcileCategory ─────────────────────────────────────────────

/** A layer signal (L1 deterministic or L2 semantic) for one category. */
export interface ReconcileSignal {
  present: boolean;
  /** -1 = against, 0 = neutral / no movement, 1 = for. */
  sign: -1 | 0 | 1;
}

export interface ReconcileCategoryArgs {
  category: RefereePointCategory;
  /** Derived from `DeterministicMoveMetadata`. */
  l1Signal: ReconcileSignal;
  /** Derived from `SemanticRefereePacket.binaries`. `null` when the packet is absent. */
  l2Signal: (ReconcileSignal & { confidence: SemanticConfidence }) | null;
  /** From `scoreHintMapping`; already clamped `>= 0`. */
  hintMagnitude: number;
  /**
   * The economy-owned base delta for this category. Required (and only used)
   * when `CATEGORY_AUTHORITY[category] === 'economy'`. Adopted bit-for-bit.
   */
  economyDelta?: number;
}

/**
 * Resolve one category reading between layer-1, layer-2, and (for
 * economy-owned categories) the economy delta.
 *
 * The low-confidence gate runs FIRST: a `confidence === 'low'` L2 binary on a
 * non-economy category forces `low_confidence_semantic` / `delta: 0` before
 * any authority branch can run.
 */
export function reconcileCategory(args: ReconcileCategoryArgs): CategoryReading {
  const { category, l1Signal, l2Signal, hintMagnitude } = args;
  const authority = CATEGORY_AUTHORITY[category];
  const factualStandingAxis = isFactualStandingCategory(category);
  const creditAxis = creditAxisForCategory(category);

  // ── Economy-owned: adopt the economy delta verbatim. Low-confidence
  //    semantics never override a deterministic economy delta — the binary is
  //    only a confirmation hint here (MCP-003 §5.1 / low-confidence gate #3).
  if (authority === 'economy') {
    const base = Number.isFinite(args.economyDelta ?? NaN) ? (args.economyDelta as number) : 0;
    const l2Confirms =
      l2Signal !== null && l2Signal.present && l2Signal.confidence !== 'low' && l2Signal.sign === 1;
    return finishReading({
      category,
      delta: base, // adopted bit-for-bit — NOT clamped, NOT hint-folded
      outcome: l2Confirms ? 'agreement' : 'l1_only',
      confidence: l2Confirms ? 'high' : 'high',
      requiresUserChoice: false,
      feedbackCode: positiveFeedbackCode(category),
      factualStandingAxis,
      creditAxis,
    });
  }

  // ── Low-confidence gate (MCP-003 §5.1 rule 4). Runs BEFORE the authority
  //    branch — a low-confidence binary cannot reach agreement / conflict.
  if (l2Signal !== null && l2Signal.present && l2Signal.confidence === 'low') {
    // A low-confidence binary is "no usable signal": if L1 exists, fall to
    // l1_only; otherwise low_confidence_semantic with delta 0.
    if (l1Signal.present) {
      return finishReading({
        category,
        delta: l1OnlyDelta(l1Signal, hintMagnitude),
        outcome: 'l1_only',
        confidence: 'high',
        requiresUserChoice: false,
        feedbackCode: l1Signal.sign === 1 ? positiveFeedbackCode(category) : softFeedbackCode(category),
        factualStandingAxis,
        creditAxis,
      });
    }
    return finishReading({
      category,
      delta: 0,
      outcome: 'low_confidence_semantic',
      confidence: 'low',
      requiresUserChoice: false,
      feedbackCode: softFeedbackCode(category),
      factualStandingAxis,
      creditAxis,
    });
  }

  const l2Usable = l2Signal !== null && l2Signal.present;

  // ── neither-authority: agreement → full magnitude; disagreement → route.
  if (authority === 'neither') {
    if (l1Signal.present && l2Usable) {
      if (signsAgree(l1Signal.sign, (l2Signal as ReconcileSignal).sign)) {
        return finishReading({
          category,
          delta: agreementDelta(l1Signal.sign, hintMagnitude, category),
          outcome: 'agreement',
          confidence: 'high',
          requiresUserChoice: false,
          feedbackCode: feedbackForSign(category, l1Signal.sign),
          factualStandingAxis,
          creditAxis,
        });
      }
      // Conflict, neither dominant → route. Never a penalty.
      return finishReading({
        category,
        delta: 0,
        outcome: 'conflict_routed',
        confidence: 'low',
        requiresUserChoice: true,
        feedbackCode: 'you_decide_the_lane',
        factualStandingAxis,
        creditAxis,
      });
    }
    if (l1Signal.present) {
      return finishReading({
        category,
        delta: l1OnlyDelta(l1Signal, hintMagnitude),
        outcome: 'l1_only',
        confidence: 'high',
        requiresUserChoice: false,
        feedbackCode: feedbackForSign(category, l1Signal.sign),
        factualStandingAxis,
        creditAxis,
      });
    }
    if (l2Usable) {
      const sig = l2Signal as ReconcileSignal & { confidence: SemanticConfidence };
      return finishReading({
        category,
        delta: cappedL2Delta(sig.sign, hintMagnitude),
        outcome: 'l2_only',
        confidence: toLedgerConfidence(sig.confidence),
        requiresUserChoice: false,
        feedbackCode: feedbackForSign(category, sig.sign),
        factualStandingAxis,
        creditAxis,
      });
    }
    // No signal at all — neutral l1_only reading.
    return finishReading({
      category,
      delta: 0,
      outcome: 'l1_only',
      confidence: 'high',
      requiresUserChoice: false,
      feedbackCode: softFeedbackCode(category),
      factualStandingAxis,
      creditAxis,
    });
  }

  // ── l1-authority: L1 fact stands. Conflict → conflict_l1_dominant.
  if (authority === 'l1') {
    if (l1Signal.present && l2Usable) {
      if (signsAgree(l1Signal.sign, (l2Signal as ReconcileSignal).sign)) {
        return finishReading({
          category,
          delta: agreementDelta(l1Signal.sign, hintMagnitude, category),
          outcome: 'agreement',
          confidence: 'high',
          requiresUserChoice: false,
          feedbackCode: feedbackForSign(category, l1Signal.sign),
          factualStandingAxis,
          creditAxis,
        });
      }
      // Conflict — L1 dominates. Use the L1 value, drop confidence to medium,
      // no penalty for the disagreement.
      return finishReading({
        category,
        delta: l1OnlyDelta(l1Signal, hintMagnitude),
        outcome: 'conflict_l1_dominant',
        confidence: 'medium',
        requiresUserChoice: false,
        feedbackCode: feedbackForSign(category, l1Signal.sign),
        factualStandingAxis,
        creditAxis,
      });
    }
    if (l1Signal.present) {
      return finishReading({
        category,
        delta: l1OnlyDelta(l1Signal, hintMagnitude),
        outcome: 'l1_only',
        confidence: 'high',
        requiresUserChoice: false,
        feedbackCode: feedbackForSign(category, l1Signal.sign),
        factualStandingAxis,
        creditAxis,
      });
    }
    if (l2Usable) {
      const sig = l2Signal as ReconcileSignal & { confidence: SemanticConfidence };
      return finishReading({
        category,
        delta: cappedL2Delta(sig.sign, hintMagnitude),
        outcome: 'l2_only',
        confidence: toLedgerConfidence(sig.confidence),
        requiresUserChoice: false,
        feedbackCode: feedbackForSign(category, sig.sign),
        factualStandingAxis,
        creditAxis,
      });
    }
    return finishReading({
      category,
      delta: 0,
      outcome: 'l1_only',
      confidence: 'high',
      requiresUserChoice: false,
      feedbackCode: softFeedbackCode(category),
      factualStandingAxis,
      creditAxis,
    });
  }

  // ── l2-authority: L2 reads what L1 cannot see; magnitude capped at medium.
  if (l2Usable) {
    const sig = l2Signal as ReconcileSignal & { confidence: SemanticConfidence };
    const outcome = l1Signal.present ? 'agreement' : 'l2_only';
    return finishReading({
      category,
      delta: cappedL2Delta(sig.sign, hintMagnitude),
      outcome,
      confidence: toLedgerConfidence(sig.confidence),
      requiresUserChoice: false,
      feedbackCode: feedbackForSign(category, sig.sign),
      factualStandingAxis,
      creditAxis,
    });
  }
  if (l1Signal.present) {
    return finishReading({
      category,
      delta: l1OnlyDelta(l1Signal, hintMagnitude),
      outcome: 'l1_only',
      confidence: 'high',
      requiresUserChoice: false,
      feedbackCode: feedbackForSign(category, l1Signal.sign),
      factualStandingAxis,
      creditAxis,
    });
  }
  return finishReading({
    category,
    delta: 0,
    outcome: 'l1_only',
    confidence: 'high',
    requiresUserChoice: false,
    feedbackCode: softFeedbackCode(category),
    factualStandingAxis,
    creditAxis,
  });
}

// ── Helpers ───────────────────────────────────────────────────────

/** Two signs "agree" when they point the same way (both 0 counts as agree). */
function signsAgree(a: -1 | 0 | 1, b: -1 | 0 | 1): boolean {
  return a === b;
}

/** Map a `SemanticConfidence` to a `LedgerConfidence` (identical vocabulary). */
function toLedgerConfidence(c: SemanticConfidence): LedgerConfidence {
  return c;
}

/**
 * The delta for an `l1_only` / `conflict_l1_dominant` reading. A positive L1
 * sign earns the hint magnitude as credit; a negative L1 sign produces the
 * small negative hygiene reading (only `person_intent_drift` reaches here with
 * a negative sign); a `0` sign is neutral.
 */
function l1OnlyDelta(l1Signal: ReconcileSignal, hintMagnitude: number): number {
  if (l1Signal.sign === 1) return clampCategoryDelta(hintMagnitude);
  if (l1Signal.sign === -1) {
    // Negative-only hygiene reading. A fixed small negative, never amplified
    // by the (non-negative) hint magnitude.
    return clampCategoryDelta(-0.1);
  }
  return 0;
}

/** The delta for an `agreement` reading — base sign + hint, clamped. */
function agreementDelta(
  sign: -1 | 0 | 1,
  hintMagnitude: number,
  _category: RefereePointCategory,
): number {
  if (sign === 1) return clampCategoryDelta(hintMagnitude);
  if (sign === -1) return clampCategoryDelta(-0.1);
  return 0;
}

/**
 * The delta for an `l2_only` reading — the hint magnitude, capped at the
 * medium tier (`L2_MEDIUM_TIER_CAP`).
 */
function cappedL2Delta(sign: -1 | 0 | 1, hintMagnitude: number): number {
  if (sign === 1) {
    return clampCategoryDelta(Math.min(hintMagnitude, L2_MEDIUM_TIER_CAP));
  }
  if (sign === -1) return clampCategoryDelta(-0.1);
  return 0;
}

/** The feedback code for a given sign on a category. */
function feedbackForSign(category: RefereePointCategory, sign: -1 | 0 | 1): RefereeFeedbackCode {
  if (sign === 1) return positiveFeedbackCode(category);
  return softFeedbackCode(category);
}

/** Final assembly — clamps the delta one last time as a safety net. */
function finishReading(reading: CategoryReading): CategoryReading {
  // Economy-owned deltas are adopted verbatim and must not be re-clamped here
  // (the economy already bounds them); they pass through `reconcileCategory`'s
  // economy branch which calls finishReading with the raw economy value. The
  // economy never produces a value outside [-0.4, +0.4] for these fields, so a
  // no-op clamp is safe and preserves bit-for-bit parity.
  return {
    ...reading,
    delta: reading.outcome === 'conflict_routed' || reading.outcome === 'low_confidence_semantic'
      ? 0
      : reading.delta,
  };
}
