/**
 * MCP-013 — Referee ledger adapter: type contract.
 *
 * Layer 3 of the semantic-referee architecture. The referee ledger scores the
 * RULES OF PLAY (continuity, evidence hygiene, branch hygiene, constructive
 * movement) — never truth. It never declares a winner or loser, never blocks
 * a post, never assigns a truth value. Engagement credit and factual-standing
 * credit stay on separate axes.
 *
 * This file is PURE TYPESCRIPT — type declarations + `const` arrays of known
 * values only. It has NO runtime import. Same constraint as
 * `src/lib/constitution/engine.ts` and `src/features/pointStanding/`.
 *
 * Doctrine (MCP-003 §12, acceptance criterion):
 *   `LedgerResult` has NO `block`, NO `winner`, NO `truthValue`, NO `score`
 *   scalar, NO per-side aggregate field anywhere. Enforced by
 *   `__tests__/refereeLedgerBanList.test.ts`.
 */

import type {
  AntiAmplificationResult,
} from '../pointStanding/antiAmplification';
import type {
  ChallengeGradingInput,
  PointStandingDelta,
  RepairGradingInput,
} from '../pointStanding/types';
import type { RepairGradingOptions } from '../pointStanding/scoringEngine';
import type { IssueDebtLedger } from '../pointStanding/eligibility';
import type {
  SemanticRefereePacket,
} from '../semanticReferee/semanticRefereeTypes';

// ── Core unions (MCP-003 §4, §5) ──────────────────────────────────

/**
 * The 14 play-quality categories the ledger may move. None is a truth
 * category — every value describes how a MOVE plays, never whether a claim
 * is true.
 */
export type RefereePointCategory =
  | 'continuity'
  | 'direct_response'
  | 'evidence_provided'
  | 'evidence_relevance'
  | 'quote_anchoring'
  | 'narrowing'
  | 'concession'
  | 'clarification'
  | 'synthesis'
  | 'branch_hygiene'
  | 'person_intent_drift' // negative-only — reads 0 or a small negative; never positive
  | 'evidence_debt_resolution'
  | 'staying_in_mode'
  | 'respecting_pacing';

/** Every `RefereePointCategory` value — for the tests' coverage scans. */
export const ALL_REFEREE_POINT_CATEGORIES: readonly RefereePointCategory[] = [
  'continuity',
  'direct_response',
  'evidence_provided',
  'evidence_relevance',
  'quote_anchoring',
  'narrowing',
  'concession',
  'clarification',
  'synthesis',
  'branch_hygiene',
  'person_intent_drift',
  'evidence_debt_resolution',
  'staying_in_mode',
  'respecting_pacing',
];

/**
 * How a category reading was resolved between layer-1 (deterministic) and
 * layer-2 (advisory semantic). A layer-1 / layer-2 conflict NEVER produces a
 * penalty — it routes (`conflict_routed`, `delta: 0`) to a reversible choice.
 */
export type ReconciliationOutcome =
  | 'agreement' // L1 and L2 agree → full-confidence delta
  | 'l1_only' // no semantic signal for this category → L1 stands
  | 'l2_only' // no deterministic signal → L2 stands, magnitude capped at medium tier
  | 'conflict_l1_dominant' // L1 and L2 disagree AND L1 is authoritative → L1 value, confidence→medium, no penalty
  | 'conflict_routed' // L1 and L2 disagree, neither dominant → delta 0, reversible user choice
  | 'low_confidence_semantic'; // L2 confidence is 'low' → delta 0, soft feedback code

export const ALL_RECONCILIATION_OUTCOMES: readonly ReconciliationOutcome[] = [
  'agreement',
  'l1_only',
  'l2_only',
  'conflict_l1_dominant',
  'conflict_routed',
  'low_confidence_semantic',
];

export type LedgerConfidence = 'high' | 'medium' | 'low';

/** Which axis a reading credits. Engagement, factual standing, hygiene stay separate. */
export type CreditAxis = 'engagement' | 'factual_standing' | 'hygiene';

// ── RefereeFeedbackCode family (MCP-003 §8) ───────────────────────

/**
 * A closed union of bounded `snake_case` tokens — 22 codes: the 20 from
 * MCP-003 §8 plus the two the MCP-013 deviation note adds
 * (`broad_point_set_down`, `synthesis_named`). (MCP-013 design prose says
 * "21" — an arithmetic slip; the design's own union and gameCopy block both
 * list 22. 20 + 2 = 22.) Every member MUST have a matching entry in
 * `gameCopy.PLAIN_LANGUAGE_COPY` (the MCP-013 extension) or the
 * plain-language-coverage test fails. A feedbackCode is a gameplay signal
 * about the MOVE — never a verdict, never a person label.
 */
export type RefereeFeedbackCode =
  | 'clean_parent_tie' // continuity (positive)
  | 'partial_parent_tie' // continuity (low / partial)
  | 'answered_the_question' // direct_response (positive)
  | 'question_still_open' // direct_response (low / 0)
  | 'source_attached' // evidence_provided (positive)
  | 'evidence_debt_open' // evidence_provided (debt opened — a prompt, not a penalty)
  | 'evidence_connects' // evidence_relevance (positive)
  | 'evidence_needs_connecting' // evidence_relevance (low)
  | 'nicely_anchored' // quote_anchoring (positive)
  | 'nice_narrowing' // narrowing (positive)
  | 'concession_noted' // concession (narrow concession — the broad point stands)
  | 'broad_point_set_down' // concession (broad concession abandon — honest move)
  | 'clarification_in_play' // clarification (positive)
  | 'almost_a_synthesis' // synthesis (prompt — not yet a credit)
  | 'synthesis_named' // synthesis (positive — shared ground named, lifecycle ready)
  | 'clean_branch' // branch_hygiene (positive)
  | 'belongs_on_a_branch' // branch_hygiene (route prompt)
  | 'back_to_the_claim' // person_intent_drift (negative hygiene reading)
  | 'debt_resolved' // evidence_debt_resolution (positive)
  | 'fits_the_room' // staying_in_mode (positive)
  | 'pacing_is_on' // respecting_pacing (notice)
  | 'you_decide_the_lane'; // any conflict_routed outcome

/** Every `RefereeFeedbackCode` value — for the tests' coverage scans. */
export const ALL_REFEREE_FEEDBACK_CODES: readonly RefereeFeedbackCode[] = [
  'clean_parent_tie',
  'partial_parent_tie',
  'answered_the_question',
  'question_still_open',
  'source_attached',
  'evidence_debt_open',
  'evidence_connects',
  'evidence_needs_connecting',
  'nicely_anchored',
  'nice_narrowing',
  'concession_noted',
  'broad_point_set_down',
  'clarification_in_play',
  'almost_a_synthesis',
  'synthesis_named',
  'clean_branch',
  'belongs_on_a_branch',
  'back_to_the_claim',
  'debt_resolved',
  'fits_the_room',
  'pacing_is_on',
  'you_decide_the_lane',
];

// ── CategoryReading (MCP-003 §5.1) ────────────────────────────────

export interface CategoryReading {
  category: RefereePointCategory;
  /** Signed; clamped to [-0.4, +0.4] (MCP-003 §6.2). */
  delta: number;
  outcome: ReconciliationOutcome;
  confidence: LedgerConfidence;
  /** Set true only when outcome === 'conflict_routed'. Caller surfaces an MCP-010 reversible choice. */
  requiresUserChoice: boolean;
  /** A bounded snake_case token. Mapped through gameCopy.toPlainLanguage before any UI surface. Never raw. */
  feedbackCode: RefereeFeedbackCode;
  /** True only for evidence_* categories that passed / were suppressed by anti-amplification. */
  factualStandingAxis: boolean;
  /** Which axis this reading credits — engagement | factual_standing | hygiene. */
  creditAxis: CreditAxis;
}

// ── LedgerCreditState (MCP-003 §7.2) ──────────────────────────────

/**
 * Mirrors `ConcessionCreditState`. One entry per `debtId` — tracks which
 * ledger categories have already paid out against that debt (anti-farm: one
 * credit per debt). Keyed by the SAME `debtId` the economy's `IssueDebtLedger`
 * mints; the ledger does not invent a parallel debt store.
 */
export interface LedgerCreditState {
  debtId: string;
  awardedCategories: ReadonlySet<RefereePointCategory>;
}

// ── DeterministicMoveMetadata — the layer-1 fact bundle (MCP-003 §10) ──

/**
 * Layer-1 deterministic facts about one move. Button / artifact / topology /
 * clock truths only. No engagement count, no view count, no heat — those are
 * never inputs (doctrine).
 *
 * Documented deviation from MCP-003 §10: this card OWNS a flat, primitive-only
 * `DeterministicMoveMetadata` here and imports nothing from the not-yet-merged
 * layer-1 models (LIFE-001 / META-001 / EV-001 / BR-001 / GAME-002 /
 * GAME-003 / GAME-004). When those models land, the future room-wiring card
 * adapts their outputs into this bundle — `DeterministicMoveMetadata` is the
 * stable seam. Coordination resolution, not a doctrine change.
 */
export interface DeterministicMoveMetadata {
  /** Parent id presence — the continuity / direct_response layer-1 fact. */
  parentArgumentId: string | null;
  /** The composer action the author selected (reply | challenge | clarify | concede | narrow | …). */
  selectedAction: string;
  /** The declared move / argument type (Constitution transition target). */
  selectedMoveType: string;
  /** Author is the original speaker of the point — drives challenge vs repair classification. */
  authorIsOriginalSpeaker: boolean;
  /** An evidence artifact row exists on the move (button-and-artifact fact). */
  hasAttachedEvidence: boolean;
  /** An exact-quote anchor span exists on the move (button fact). */
  hasQuoteAnchor: boolean;
  /** A clarify action was explicitly selected (button fact). */
  selectedClarify: boolean;
  /** Point lifecycle state allows synthesis (LIFE-001 'synthesis_ready' or equivalent). */
  lifecycleSynthesisReady: boolean;
  /** BR-001 branch kind — deterministic topology fact. */
  branchKind: 'mainline' | 'chime_in_branch' | 'tangent_branch' | 'unknown';
  /** GAME-003 room mode id — drives staying_in_mode register-fit. */
  roomModeId: string;
  /** True when the move's declared register matched the room mode profile (mode-config-driven). */
  moveFitsRoomMode: boolean;
  /** GAME-002 pacing state — true when the move respected the room's pacing / turn rules. */
  respectsPacing: boolean;
}

// ── LedgerMoveInput / LedgerResult (MCP-003 §9.3) ─────────────────

export interface LedgerMoveInput {
  pointId: string;
  moveArgumentId: string;
  /**
   * MCP-001 layer 2 — advisory; ALWAYS a validated mock packet in this card.
   * May be omitted entirely; an absent packet runs the ledger l1_only.
   */
  semanticPacket?: SemanticRefereePacket;
  /** Layer-1 deterministic facts. */
  deterministicMetadata: DeterministicMoveMetadata;
  /** challenge | repair — decides which economy call fires. */
  moveRole: 'challenge' | 'repair';
  /** The economy grading input the caller already assembled. */
  economyInput: ChallengeGradingInput | RepairGradingInput;
  /** Required when moveRole === 'repair'. */
  repairOptions?: RepairGradingOptions;
  /** Shared with the economy — the ledger reads + writes the same debt store. */
  debtLedger: IssueDebtLedger;
  /** Per-debt category-credit bookkeeping carried across moves. Caller owns the lifetime. */
  creditStates?: readonly LedgerCreditState[];
}

export interface LedgerResult {
  pointId: string;
  moveArgumentId: string;
  /** One reading per category this move touched. Untouched categories omitted. */
  categoryReadings: readonly CategoryReading[];
  /** Verbatim from the economy — adopted, never re-derived. Null on the ineligible path. */
  economyDelta: PointStandingDelta | null;
  /** Verbatim from applyAntiAmplification. Null when no evidence-axis category was read. */
  antiAmplification: AntiAmplificationResult | null;
  /** Re-uses the ineligibilityReasons strings from the economy's grading results. Empty when eligible. */
  ineligibilityReasons: readonly string[];
  /** True when any reading is conflict_routed — the caller surfaces an MCP-010 choice. */
  needsUserChoice: boolean;
  /** 0..1 advisory audit signal, forwarded UNCHANGED from the economy. The ledger never acts on it. */
  exploitRiskScore: number;
  /** Updated per-debt credit bookkeeping — caller persists this for the next move. */
  creditStates: readonly LedgerCreditState[];
  /** Always the literal true — advisory output. Matches the economy's grading results. */
  userReviewRequired: true;
}
