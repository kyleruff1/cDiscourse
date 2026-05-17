/**
 * Stage 6.1.4 — Eligibility gates + in-memory issue-debt ledger.
 *
 * Anti-exploit rule: gamification can be drilled, but not farmed. A move
 * that fails the eligibility gate gets neither credit nor penalty — it is a
 * no-op for the ledger.
 */

import type {
  ChallengeGradingInput,
  ConcessionCreditState,
  OpenIssueDebt,
  RepairGradingInput,
  ScoringEligibility,
} from './types';
import { hasExplicitConcessionMarker } from './concessionEffects';

// ── Pure eligibility predicates ───────────────────────────────

export function isScoreEligible(e: ScoringEligibility): boolean {
  if (e.isTangent) return false;
  if (e.isNearDuplicate) return false;
  if (e.isSelfConcessionLoop) return false;
  if (!e.isSpecificToParent) return false;
  // hasLiveIssueDebt is required for REPAIR eligibility but the same predicate
  // is reused for challenge eligibility — the caller sets it to true for
  // challenges (a fresh challenge always creates the debt it needs).
  if (!e.hasLiveIssueDebt) return false;
  return true;
}

// ── Eligibility builders ──────────────────────────────────────

/**
 * Build a `ScoringEligibility` for a CHALLENGE move (a reply that may create
 * a new issue debt). Uses the reply's stance flags + the existing debts on
 * the point to decide novelty / duplicate / tangent.
 */
export function buildChallengeEligibility(input: ChallengeGradingInput): ScoringEligibility {
  const klass = input.replyFlags.mixedAgreementClass;
  const isTangent = klass === 'tangent_or_joke';
  const isLowEffortAgreement = klass === 'pure_accept' && input.replyVector.scalarRationale.length < 60;
  const axisIdentified = input.replyVector.disagreementType !== 'none' && input.replyVector.disagreementType !== 'framing';
  // "Specific to parent" — we need at least one of: a target excerpt-like
  // hook in the rationale, a coexistence score above 0.2, or a clear axis.
  const isSpecificToParent = axisIdentified || input.replyVector.coexistenceScore >= 0.2;
  // Near-duplicate: another open debt already exists on the SAME axis and
  // intensity. We refuse to credit the second hit on the same lane.
  const isNearDuplicate = input.openDebts.some(
    (d) => d.axis === input.replyVector.disagreementType && d.intensity >= 0.5 && !d.closed,
  );
  return {
    hasLiveIssueDebt: true, // a challenge creates its own debt
    isNovelPressure: !isNearDuplicate,
    isSpecificToParent,
    isAxisIdentified: axisIdentified,
    isNearDuplicate,
    isSelfConcessionLoop: false,
    isLowEffortAgreement,
    isTangent,
  };
}

/**
 * Build a `ScoringEligibility` for a REPAIR move (a follow-up by the
 * original speaker that narrows / concedes / synthesizes). The repair must
 * land on a live debt, must not be a self-concession loop, and must not be
 * a tangent.
 */
export function buildRepairEligibility(
  input: RepairGradingInput,
  options: { repairAuthorIsOriginalSpeaker: boolean; previousRepairsByAuthor: number },
): ScoringEligibility {
  const targetDebt = input.openDebts.find((d) => d.debtId === input.targetDebtId && !d.closed);
  const hasLiveIssueDebt = Boolean(targetDebt);
  // Self-concession loop: the same author has already produced two or more
  // concession-shaped repairs in a row without external pressure.
  const isSelfConcessionLoop =
    options.repairAuthorIsOriginalSpeaker &&
    options.previousRepairsByAuthor >= 2 &&
    hasExplicitConcessionMarker(input.repairText);
  const klass = input.repairFlags.mixedAgreementClass;
  const isTangent = klass === 'tangent_or_joke';
  const isNearDuplicate = targetDebt ? targetDebt.recoveryCreditAwarded : false;
  // The repair must speak to the debt's axis. We accept any move that uses
  // the axis lexicon OR an explicit concession marker.
  const axisIdentified = klass !== 'unclear_mixed';
  const isSpecificToParent = axisIdentified || hasExplicitConcessionMarker(input.repairText);
  return {
    hasLiveIssueDebt,
    isNovelPressure: false, // repairs are not pressure
    isSpecificToParent,
    isAxisIdentified: axisIdentified,
    isNearDuplicate,
    isSelfConcessionLoop,
    isLowEffortAgreement: false,
    isTangent,
  };
}

// ── In-memory ledger ──────────────────────────────────────────

/**
 * A small append-only debt ledger. Pure-TS, in-memory. The engine never owns
 * persistence; callers can serialize it if they want.
 */
export class IssueDebtLedger {
  private readonly debts = new Map<string, OpenIssueDebt>();

  appendDebt(debt: OpenIssueDebt): void {
    this.debts.set(debt.debtId, { ...debt });
  }

  getDebt(debtId: string): OpenIssueDebt | undefined {
    const d = this.debts.get(debtId);
    return d ? { ...d } : undefined;
  }

  /** Returns a snapshot — mutating the array does NOT mutate the ledger. */
  openDebtsForPoint(pointId: string): OpenIssueDebt[] {
    const out: OpenIssueDebt[] = [];
    for (const d of this.debts.values()) {
      if (d.pointId === pointId && !d.closed) out.push({ ...d });
    }
    return out;
  }

  updateDebt(debtId: string, mutate: (d: OpenIssueDebt) => OpenIssueDebt): OpenIssueDebt | undefined {
    const current = this.debts.get(debtId);
    if (!current) return undefined;
    const next = mutate({ ...current });
    this.debts.set(debtId, next);
    return { ...next };
  }

  /** For tests + diagnostics — returns a fresh array, not the internal map. */
  snapshot(): OpenIssueDebt[] {
    return Array.from(this.debts.values()).map((d) => ({ ...d }));
  }

  size(): number { return this.debts.size; }
}

/** Convenience: derive a credit-state snapshot from a debt. */
export function toConcessionCreditState(debt: OpenIssueDebt): ConcessionCreditState {
  return {
    debtId: debt.debtId,
    explicitConcessionAwarded: debt.explicitConcessionAwarded,
    impliedConcessionRecorded: debt.impliedConcessionRecorded,
    recoveryCreditAwarded: debt.recoveryCreditAwarded,
  };
}
