/**
 * Stage 6.1.4 — Point-standing economy.
 *
 * Doctrine: "A point earns standing by surviving pressure. A player earns
 * strategic value by either creating unresolved pressure or by conceding /
 * narrowing in a way that preserves the broader opinion."
 *
 * Concession is a scoring REPAIR, not a scoring defeat. The engine never
 * declares a winner or a loser — it tracks how a point's standing changes
 * after pressure is applied and how that pressure is enveloped, conceded,
 * or evaded.
 *
 * This module is pure TypeScript. No network. No Supabase. No xAI. No
 * Anthropic. No auto-wiring into the existing argument room — the operator
 * opts the engine in via a later stage.
 */

import type {
  AgreementDisagreementVector,
  DisagreementType,
  GradingFlags,
  MixedAgreementClass,
} from '../engagementIntelligence/types';

export type { MixedAgreementClass };

/** Re-export of `DisagreementType` under the name used by the doctrine doc. */
export type IssueAxis = DisagreementType;

// ── Stance flags re-export ────────────────────────────────────

/**
 * `GradingFlags` is defined in the engagement-intelligence module
 * (Stage 6.1.3.3). Point-standing consumes it as the stance-shape input.
 * Re-exported here so the production grading code only needs to import from
 * `features/pointStanding`.
 */
export type { GradingFlags };

// ── Point identity ────────────────────────────────────────────

/**
 * A debate "point" is a coarser concept than an `arguments.id` row — multiple
 * arguments can refine, narrow, or rebut the same underlying point. The
 * caller decides how to mint `pointId`s (e.g., the root thesis id, or a
 * canonical slug). Point-standing does not invent them.
 */
export type PointId = string;
export type ArgumentId = string;

// ── Ledger entries ────────────────────────────────────────────

/**
 * The delta produced by one argument's effect on one point's standing.
 * Append-only: a later argument that addresses the same debt emits ANOTHER
 * delta, it does not mutate this one.
 */
export interface PointStandingDelta {
  pointId: PointId;
  causedByArgumentId: ArgumentId;
  /** Change in broad-opinion weight (thesis / value frame / conclusion). */
  broadStandingDelta: number;
  /** Change in narrow-claim weight (scope / evidence / definition / etc.). */
  narrowStandingDelta: number;
  /** Credit accrued by creating valid pressure. Award to the challenger. */
  challengerPressureGain: number;
  /** Credit accrued by enveloping pressure via repair / narrowing. Award to the responder. */
  responderRecoveryGain: number;
  /** Explicit concession marker present + actually narrows / abandons. */
  concessionIntegrityGain: number;
  /** Penalty for implied-but-unacknowledged concession (shift without flagging it). */
  impliedConcessionPenalty: number;
  /** Penalty for ignoring open issue debts. */
  unresolvedDebtPenalty: number;
  /** 0..1 — flag for grading-system auditors. High when the move looks like point-farming. */
  exploitRiskScore: number;
}

// ── Issue debt ────────────────────────────────────────────────

/**
 * An "issue debt" is what gets opened when a reply creates pressure on a
 * point along a specific axis. The debt is closed by a repair move
 * (concession / narrowing / synthesis) or accrues penalties when ignored.
 */
export interface OpenIssueDebt {
  debtId: string;
  pointId: PointId;
  /** The reply that created the debt. */
  createdByArgumentId: ArgumentId;
  axis: IssueAxis;
  /** From `MixedAgreementFlags.playableTensionScore`. */
  intensity: number;
  /** Set true once an explicit concession lands. */
  explicitConcessionAwarded: boolean;
  /** Set true once an implied concession lands (e.g., the responder silently shifts). */
  impliedConcessionRecorded: boolean;
  /** Set true once `responderRecoveryGain` has been credited. */
  recoveryCreditAwarded: boolean;
  /** Set true if the debt is closed (concession landed or synthesized). */
  closed: boolean;
}

/**
 * Single-debt concession-credit bookkeeping. Concession-related credit is
 * awarded **at most once per debt** to prevent farming.
 */
export interface ConcessionCreditState {
  debtId: string;
  explicitConcessionAwarded: boolean;
  impliedConcessionRecorded: boolean;
  recoveryCreditAwarded: boolean;
}

// ── Eligibility gates ─────────────────────────────────────────

/**
 * `ScoringEligibility` is the anti-exploit gate. A move that fails the gate
 * gets neither credit nor penalty — it is a no-op for the ledger.
 *
 * Gamification can be drilled, but it must not be farmed.
 */
export interface ScoringEligibility {
  hasLiveIssueDebt: boolean;
  isNovelPressure: boolean;
  isSpecificToParent: boolean;
  isAxisIdentified: boolean;
  isNearDuplicate: boolean;
  isSelfConcessionLoop: boolean;
  isLowEffortAgreement: boolean;
  isTangent: boolean;
}

// ── Concession effects ────────────────────────────────────────

export type ConcessionEffect =
  | 'explicit_narrow_concession_preserves_broad_point'
  | 'explicit_broad_concession_abandons_point'
  | 'implied_narrow_concession_preserves_broad_point'
  | 'implied_broad_concession_abandons_point'
  | 'performative_concession_no_repair'
  | 'no_concession';

export interface ConcessionEffectWeights {
  responderRecoveryGain: number;
  concessionIntegrityGain: number;
  challengerPressureGain: number;
  unresolvedDebtPenalty: number;
}

// ── Mixed-class weight + UI nudges ────────────────────────────

export interface MixedClassWeights {
  /** Floor for `playableTensionScore` when this class is in play. The classifier may exceed it. */
  playableTensionScore: number;
  createsIssueDebt: boolean;
  preferredUiNudge: string;
}

// ── Grading orientation ───────────────────────────────────────

/**
 * What the engine asks BEFORE it asks "did this reply agree or disagree?"
 *
 * The engine returns one of these per graded argument so the grading code
 * can pick a UI nudge, a Constitution prompt, or a fixture-generator hint.
 */
export interface GradingQuestionSet {
  whatBroadPointWasAccepted: string | null;
  whatBroadPointWasDeclined: string | null;
  whatNarrowPointWasAccepted: string | null;
  whatNarrowPointWasDeclined: string | null;
  whatIssueDebtWasCreated: IssueAxis | null;
  whatConcessionWouldRepairIt: ConcessionEffect | null;
  canTheOriginalOpinionRecoverWeight: boolean;
  shouldThisBecomeAPlayablePrompt: boolean;
}

// ── Inputs / outputs of the public engine API ─────────────────

/**
 * The minimum context an engine call needs. The engine never reads from a
 * database — the caller fetches and passes everything in.
 */
export interface GradingContext {
  pointId: PointId;
  parentArgumentId: ArgumentId;
  parentFlags: GradingFlags;
  parentVector: AgreementDisagreementVector;
  /** Open debts on this point at the time of grading. */
  openDebts: OpenIssueDebt[];
}

export interface ChallengeGradingInput extends GradingContext {
  replyArgumentId: ArgumentId;
  replyFlags: GradingFlags;
  replyVector: AgreementDisagreementVector;
  replyText: string;
}

export interface RepairGradingInput extends GradingContext {
  repairArgumentId: ArgumentId;
  repairFlags: GradingFlags;
  repairVector: AgreementDisagreementVector;
  repairText: string;
  /** Which open debt the repair is attempting to close. */
  targetDebtId: string;
}

/**
 * The result of grading a single move. The engine returns `eligible: false`
 * with `delta: null` when the eligibility gate refuses the move — that path
 * neither credits nor penalizes.
 */
export interface ChallengeGradingResult {
  eligible: boolean;
  ineligibilityReasons: string[];
  delta: PointStandingDelta | null;
  /** A new debt produced by this challenge, if any. The caller appends it to its ledger. */
  newDebt: OpenIssueDebt | null;
  questionSet: GradingQuestionSet;
  /** Always true. Outputs are advisory; the production app retains the final say. */
  userReviewRequired: true;
}

export interface RepairGradingResult {
  eligible: boolean;
  ineligibilityReasons: string[];
  delta: PointStandingDelta | null;
  /** The debt with closed/credit fields updated. The caller writes it back to its ledger. */
  updatedDebt: OpenIssueDebt | null;
  effect: ConcessionEffect;
  questionSet: GradingQuestionSet;
  userReviewRequired: true;
}

// ── Helper aliases for callers ────────────────────────────────

export type MixedClass = MixedAgreementClass;
