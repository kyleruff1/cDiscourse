/**
 * Stage 6.1.4 — Scoring engine.
 *
 * The two-call API:
 *  - `gradeChallenge(input)` records an attempt by a reply to create
 *    pressure on a point. May open a new `OpenIssueDebt`.
 *  - `gradeRepair(input, opts)` records an attempt by the original speaker
 *    to envelope / concede / narrow against an existing debt.
 *
 * No persistence. No network. No xAI. The caller manages the
 * `IssueDebtLedger`. Outputs always carry `userReviewRequired: true`.
 */

import { createHash } from 'crypto';
import {
  buildChallengeEligibility,
  buildRepairEligibility,
  IssueDebtLedger,
  isScoreEligible,
} from './eligibility';
import {
  classifyConcessionEffect,
  getConcessionEffectWeights,
} from './concessionEffects';
import { getMixedClassWeights } from './mixedClassWeights';
import type {
  ChallengeGradingInput,
  ChallengeGradingResult,
  GradingFlags,
  GradingQuestionSet,
  IssueAxis,
  OpenIssueDebt,
  PointStandingDelta,
  RepairGradingInput,
  RepairGradingResult,
} from './types';

function shortHash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function zeroDelta(pointId: string, argumentId: string): PointStandingDelta {
  return {
    pointId,
    causedByArgumentId: argumentId,
    broadStandingDelta: 0,
    narrowStandingDelta: 0,
    challengerPressureGain: 0,
    responderRecoveryGain: 0,
    concessionIntegrityGain: 0,
    impliedConcessionPenalty: 0,
    unresolvedDebtPenalty: 0,
    exploitRiskScore: 0,
  };
}

function reasonsFromEligibility(e: ReturnType<typeof buildChallengeEligibility>): string[] {
  const out: string[] = [];
  if (e.isTangent) out.push('is_tangent');
  if (e.isNearDuplicate) out.push('is_near_duplicate');
  if (!e.isSpecificToParent) out.push('not_specific_to_parent');
  if (e.isSelfConcessionLoop) out.push('self_concession_loop');
  if (!e.hasLiveIssueDebt) out.push('no_live_issue_debt');
  if (e.isLowEffortAgreement) out.push('low_effort_agreement');
  return out;
}

function describeAgreement(flags: GradingFlags): { broadAccept: string | null; narrowAccept: string | null } {
  return {
    broadAccept: flags.broadAcceptor
      ? `${flags.mixedAgreementClass}: broad acceptance (conclusion / value / framing / context)`
      : null,
    narrowAccept: flags.narrowAcceptor
      ? `${flags.mixedAgreementClass}: narrow acceptance (premise / evidence / context)`
      : null,
  };
}

function describeDecline(flags: GradingFlags): { broadDecline: string | null; narrowDecline: string | null } {
  return {
    broadDecline: flags.broadDecliner
      ? `${flags.mixedAgreementClass}: broad decline (value / framing / logic / scope)`
      : null,
    narrowDecline: flags.narrowDecliner
      ? `${flags.mixedAgreementClass}: narrow decline (scope / evidence / definition / causal / fact)`
      : null,
  };
}

// ── Public API: challenge ──────────────────────────────────────

export function gradeChallenge(input: ChallengeGradingInput): ChallengeGradingResult {
  const elig = buildChallengeEligibility(input);
  const classWeights = getMixedClassWeights(input.replyFlags.mixedAgreementClass);
  const accept = describeAgreement(input.replyFlags);
  const decline = describeDecline(input.replyFlags);

  const baseQuestion: GradingQuestionSet = {
    whatBroadPointWasAccepted: accept.broadAccept,
    whatBroadPointWasDeclined: decline.broadDecline,
    whatNarrowPointWasAccepted: accept.narrowAccept,
    whatNarrowPointWasDeclined: decline.narrowDecline,
    whatIssueDebtWasCreated: classWeights.createsIssueDebt ? input.replyVector.disagreementType : null,
    whatConcessionWouldRepairIt: null,
    canTheOriginalOpinionRecoverWeight: classWeights.createsIssueDebt,
    shouldThisBecomeAPlayablePrompt: classWeights.createsIssueDebt && input.replyFlags.playableTensionScore >= 0.5,
  };

  // ── Ineligible path: no credit, no penalty, but still return a question set
  //    so the UI can offer a nudge that gets the move BACK into eligibility.
  if (!isScoreEligible(elig)) {
    return {
      eligible: false,
      ineligibilityReasons: reasonsFromEligibility(elig),
      delta: null,
      newDebt: null,
      questionSet: baseQuestion,
      userReviewRequired: true,
    };
  }

  // ── Eligible: compute the delta + open the debt (if the class creates one).
  const delta = zeroDelta(input.pointId, input.replyArgumentId);

  // Stance-shape effects on the point's broad / narrow standing.
  if (input.replyFlags.broadDecliner) delta.broadStandingDelta -= 0.05;
  if (input.replyFlags.narrowDecliner) delta.narrowStandingDelta -= 0.1;

  // Pressure credit scales with the class's floor + the reply's actual tension.
  const tension = Math.max(classWeights.playableTensionScore, input.replyFlags.playableTensionScore);
  delta.challengerPressureGain = roundTo(0.1 + 0.2 * tension, 3); // 0.1..0.3

  // High-tension specific challenges register an exploit-risk audit signal
  // (advisory only — auditors decide if the user is farming).
  delta.exploitRiskScore = roundTo(input.replyFlags.playableTensionScore >= 0.9 ? 0.15 : 0.05, 3);

  let newDebt: OpenIssueDebt | null = null;
  if (classWeights.createsIssueDebt && input.replyVector.disagreementType !== 'none') {
    newDebt = {
      debtId: shortHash(`${input.pointId}::${input.replyArgumentId}::${input.replyVector.disagreementType}`),
      pointId: input.pointId,
      createdByArgumentId: input.replyArgumentId,
      axis: input.replyVector.disagreementType as IssueAxis,
      intensity: roundTo(input.replyFlags.playableTensionScore, 3),
      explicitConcessionAwarded: false,
      impliedConcessionRecorded: false,
      recoveryCreditAwarded: false,
      closed: false,
    };
  }

  return {
    eligible: true,
    ineligibilityReasons: [],
    delta,
    newDebt,
    questionSet: baseQuestion,
    userReviewRequired: true,
  };
}

// ── Public API: repair ──────────────────────────────────────

export interface RepairGradingOptions {
  repairAuthorIsOriginalSpeaker: boolean;
  /** Previous repair attempts by the same author on the same point — used by the self-concession-loop gate. */
  previousRepairsByAuthor: number;
}

export function gradeRepair(input: RepairGradingInput, opts: RepairGradingOptions): RepairGradingResult {
  const targetDebt = input.openDebts.find((d) => d.debtId === input.targetDebtId);
  const elig = buildRepairEligibility(input, opts);
  const effect = classifyConcessionEffect({
    repairText: input.repairText,
    repairFlags: input.repairFlags,
    repairAuthorIsOriginalSpeaker: opts.repairAuthorIsOriginalSpeaker,
  });

  const accept = describeAgreement(input.repairFlags);
  const decline = describeDecline(input.repairFlags);
  const questionSet: GradingQuestionSet = {
    whatBroadPointWasAccepted: accept.broadAccept,
    whatBroadPointWasDeclined: decline.broadDecline,
    whatNarrowPointWasAccepted: accept.narrowAccept,
    whatNarrowPointWasDeclined: decline.narrowDecline,
    whatIssueDebtWasCreated: null,
    whatConcessionWouldRepairIt: effect,
    canTheOriginalOpinionRecoverWeight:
      effect === 'explicit_narrow_concession_preserves_broad_point' ||
      effect === 'implied_narrow_concession_preserves_broad_point',
    shouldThisBecomeAPlayablePrompt: false,
  };

  if (!targetDebt) {
    return {
      eligible: false,
      ineligibilityReasons: ['target_debt_not_found'],
      delta: null,
      updatedDebt: null,
      effect,
      questionSet,
      userReviewRequired: true,
    };
  }

  // Eligibility decides whether CREDIT components fire. PENALTY components
  // always fire when the effect is no_concession / performative — otherwise
  // an evasive reply ("Cars are bad anyway.") would escape the cost of
  // ignoring a live debt. This is the core doctrine: concession is repair,
  // evasion is debt.
  const eligibleForCredit = isScoreEligible(elig);
  const ineligibilityReasons = reasonsFromEligibility(elig);

  const weights = getConcessionEffectWeights(effect);
  const delta = zeroDelta(input.pointId, input.repairArgumentId);

  const alreadyAwardedRecovery = targetDebt.recoveryCreditAwarded;
  const alreadyAwardedExplicit = targetDebt.explicitConcessionAwarded;
  const alreadyAwardedImplied = targetDebt.impliedConcessionRecorded;

  if (eligibleForCredit && !alreadyAwardedRecovery) {
    delta.responderRecoveryGain = weights.responderRecoveryGain;
  }
  if (eligibleForCredit) {
    if (effect === 'explicit_narrow_concession_preserves_broad_point' || effect === 'explicit_broad_concession_abandons_point') {
      if (!alreadyAwardedExplicit) delta.concessionIntegrityGain = weights.concessionIntegrityGain;
    } else if (effect === 'implied_narrow_concession_preserves_broad_point' || effect === 'implied_broad_concession_abandons_point') {
      if (!alreadyAwardedImplied) delta.concessionIntegrityGain = weights.concessionIntegrityGain;
    }
    // Challenger credit pays out of the responder's repair the FIRST time
    // the debt receives any acknowledgment — non-zero-sum.
    if (!alreadyAwardedRecovery) {
      delta.challengerPressureGain = weights.challengerPressureGain;
    }
  } else if (effect === 'no_concession' || effect === 'performative_concession_no_repair') {
    // Evasion still pays its share of pressure credit to the challenger.
    delta.challengerPressureGain = weights.challengerPressureGain;
  }
  delta.unresolvedDebtPenalty = weights.unresolvedDebtPenalty;

  // Doctrine: a narrow explicit concession that preserves the broad point
  // gives the broad point real recovery weight; a broad concession (abandon)
  // does not lift broad standing.
  if (effect === 'explicit_narrow_concession_preserves_broad_point' || effect === 'implied_narrow_concession_preserves_broad_point') {
    delta.broadStandingDelta = roundTo(0.25, 3);
    delta.narrowStandingDelta = roundTo(-0.15, 3);
  } else if (effect === 'explicit_broad_concession_abandons_point' || effect === 'implied_broad_concession_abandons_point') {
    delta.broadStandingDelta = roundTo(-0.25, 3);
    delta.narrowStandingDelta = roundTo(-0.05, 3);
  } else if (effect === 'performative_concession_no_repair') {
    // No standing change on a performative move — but the audit signal rises.
    delta.exploitRiskScore = roundTo(0.2, 3);
  } else if (effect === 'no_concession') {
    // Evasion: penalize the narrow defect, push some pressure to the challenger.
    delta.broadStandingDelta = roundTo(-0.05, 3);
    delta.narrowStandingDelta = roundTo(-0.3, 3);
  }

  // ── Update the debt with the awarded credits.
  const updatedDebt: OpenIssueDebt = {
    ...targetDebt,
    recoveryCreditAwarded: targetDebt.recoveryCreditAwarded || delta.responderRecoveryGain > 0,
    explicitConcessionAwarded:
      targetDebt.explicitConcessionAwarded ||
      effect === 'explicit_narrow_concession_preserves_broad_point' ||
      effect === 'explicit_broad_concession_abandons_point',
    impliedConcessionRecorded:
      targetDebt.impliedConcessionRecorded ||
      effect === 'implied_narrow_concession_preserves_broad_point' ||
      effect === 'implied_broad_concession_abandons_point',
    closed:
      targetDebt.closed ||
      effect === 'explicit_narrow_concession_preserves_broad_point' ||
      effect === 'explicit_broad_concession_abandons_point',
  };

  return {
    eligible: eligibleForCredit,
    ineligibilityReasons,
    delta,
    updatedDebt,
    effect,
    questionSet,
    userReviewRequired: true,
  };
}

// ── Helpers ────────────────────────────────────────────────────

function roundTo(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export { IssueDebtLedger };
