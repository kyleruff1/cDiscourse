/**
 * Stage 6.1.5.1 — Anthropic argument-intelligence annotation schema.
 *
 * Pure types. The Anthropic annotator returns this shape per argument move;
 * the deterministic fallback annotator produces the same shape. Every output
 * carries `userReviewRequired: true`. The schema MUST not include any
 * "verdict" fields (truth / winner / loser / liar / dishonest / bad faith /
 * manipulative / extremist / propagandist).
 */

import type { AgreementDisagreementVector } from './types';

// ── Top-level enums ────────────────────────────────────────────

export type RhetoricalArchetype =
  | 'receipt_demander'
  | 'quote_anchor_demander'
  | 'definition_challenger'
  | 'scope_narrower'
  | 'evidence_challenger'
  | 'causal_challenger'
  | 'value_challenger'
  | 'logic_challenger'
  | 'framing_challenger'
  | 'counterexample_dropper'
  | 'broad_agree_narrow_disagree'
  | 'narrow_agree_broad_disagree'
  | 'concession_repairer'
  | 'performative_concession_possible'
  | 'unresolved_debt_creator'
  | 'tangent_brancher'
  | 'synthesis_closer'
  | 'evasion_possible'
  | 'low_effort_agreement'
  | 'low_effort_rebuttal'
  | 'playful_pressure'
  | 'receipts_backed_claim'
  | 'quote_supported_claim'
  | 'unsupported_bold_claim'
  | 'topic_drift_possible'
  | 'branch_required_possible'
  | 'unclear';

export type MessageCategory =
  | 'root_claim'
  | 'supporting_claim'
  | 'challenge'
  | 'counter_challenge'
  | 'evidence'
  | 'clarification'
  | 'concession'
  | 'synthesis'
  | 'tangent'
  | 'repair'
  | 'unclear';

export type IssueDebtAxis =
  | 'fact'
  | 'definition'
  | 'causal'
  | 'value'
  | 'evidence'
  | 'logic'
  | 'scope'
  | 'framing'
  | 'quote'
  | 'source'
  | 'none';

export type RepairSuggestion =
  | 'provide_receipt'
  | 'quote_exact_bit'
  | 'define_term'
  | 'narrow_scope'
  | 'concede_small_point'
  | 'branch_thread'
  | 'synthesize'
  | 'none';

export type AnnotationSource = 'anthropic' | 'anthropic_retry' | 'deterministic_fallback';

// ── Anti-amplification doctrine (Stage 6.1.5.2) ────────────────
//
// Core doctrine encoded across the schema:
//   - Popularity is not evidence.
//   - Repetition is not evidence.
//   - Engagement velocity is not evidence.
//   - Political identity is not evidence.
//   - The app MAY identify political frame / issue family / rhetorical
//     camp for research and gameplay context.
//   - The app MUST NOT treat political alignment, crowd agreement, or
//     viral repetition as factual support.
//
// Safety rules baked into the schema:
//   - `politicalValence` describes the rhetorical frame of the TEXT, not
//     the user.
//   - Do NOT infer party registration, ideology, protected traits,
//     religion, race, ethnicity, sexuality, health, or demographic
//     identity.
//   - Never label a user as extremist, propagandist, troll, bot,
//     bad-faith, dishonest, liar, or manipulative.
//   - Use "coordination risk" / "amplification risk" for content-pattern
//     signals, not person labels.

export type PoliticalIssueFrame =
  | 'election_process'
  | 'governance'
  | 'foreign_policy'
  | 'economic_policy'
  | 'civil_rights'
  | 'public_safety'
  | 'institutional_trust'
  | 'culture_war'
  | 'climate_energy'
  | 'health_policy'
  | 'labor_business'
  | 'technology_platforms'
  | 'unclear'
  | 'non_political';

export type PoliticalValence =
  | 'pro_institutional'
  | 'anti_institutional'
  | 'left_leaning_frame'
  | 'right_leaning_frame'
  | 'populist_frame'
  | 'establishment_frame'
  | 'anti_media_frame'
  | 'pro_media_frame'
  | 'anti_platform_frame'
  | 'pro_platform_frame'
  | 'unclear'
  | 'not_applicable';

export type EvidentiaryRisk = 'low' | 'medium' | 'high' | 'unknown';

export type AmplificationRisk = 'none_observed' | 'low' | 'medium' | 'high';

export type RecommendedGameTreatment =
  | 'allow_as_opinion_no_factual_credit'
  | 'ask_for_receipt'
  | 'ask_for_quote_anchor'
  | 'ask_for_scope_narrowing'
  | 'ask_for_primary_source'
  | 'suggest_branch_to_context_thread'
  | 'mark_as_unresolved_issue_debt'
  | 'allow_point_standing_after_evidence'
  | 'suppress_score_gain_for_amplification_only';

export interface AmplificationSignals {
  repeated_claim_language: boolean;
  high_engagement_low_evidence: boolean;
  slogan_or_chant_like: boolean;
  copy_paste_risk: boolean;
  outrage_hook: boolean;
  link_without_receipt_context: boolean;
  screenshot_without_primary_source: boolean;
  appeal_to_crowd_size: boolean;
  appeal_to_virality: boolean;
  unknown_source_chain: boolean;
}

export type EmotionalValence = 'positive' | 'neutral' | 'negative' | 'mixed' | 'unclear';

export type HeatLevel = 'cold' | 'warm' | 'hot' | 'too_hot_possible';

export type EvidenceSpecificity = 'none' | 'vague' | 'specific' | 'receipts_backed';

export type ChainRole = 'root' | 'pressure' | 'repair' | 'branch' | 'closure' | 'unclear';

// ── Sub-shapes ─────────────────────────────────────────────────

export interface OpinionVector {
  broadAgreement: number;     // 0..1
  narrowAgreement: number;    // 0..1
  broadDisagreement: number;  // 0..1
  narrowDisagreement: number; // 0..1
  coexistenceScore: number;   // 0..1 = min of broad/narrow agreement/disagreement family
  uncertaintyScore: number;   // 0..1
  emotionalValence: EmotionalValence;
  heatLevel: HeatLevel;
}

export interface IssueDebtSignal {
  axis: IssueDebtAxis;
  created: boolean;
  repaired: boolean;
  unresolved: boolean;
  repairSuggestion: RepairSuggestion;
}

export interface GameImplication {
  pressureCreated: boolean;
  pressureAxis: IssueDebtAxis;
  responderCanRecover: boolean;
  concessionWouldHelp: boolean;
  branchRecommended: boolean;
  playableTensionScore: number;   // 0..1
  suggestedUiNudge: string | null;
  suggestedQualifierCode: string | null;
}

export interface EvidenceSignals {
  asksForSource: boolean;
  providesSource: boolean;
  asksForQuote: boolean;
  providesQuote: boolean;
  evidenceSpecificity: EvidenceSpecificity;
}

export interface ThreadSignals {
  parentResponsive: boolean;
  topicDriftPossible: boolean;
  branchCandidate: boolean;
  depth: number;
  chainRole: ChainRole;
}

export interface ModelJustification {
  /** One sentence in the model/fallback's own voice describing WHY this label. */
  shortReason: string;
  /** Concrete features the labeler observed in the body / thread. */
  observableTextFeatures: string[];
  /** Notes describing the labeler's uncertainty. */
  uncertaintyNotes: string[];
}

export interface DeterministicRuleCandidate {
  shouldCreateRule: boolean;
  ruleName: string | null;
  ruleCondition: string | null;
  uiNudge: string | null;

  // Anti-amplification doctrine flags. Each is independently true/false
  // and is read by the point-standing engine + composer nudge picker.
  shouldSuppressScoreGainForAmplificationOnly: boolean;
  shouldAskForPrimarySource: boolean;
  shouldMarkEvidenceRiskHigh: boolean;
  shouldShowAmplificationRiskBadge: boolean;
  shouldTreatAsOpinionNoFactualCredit: boolean;
  shouldCreateIssueDebtForUnsupportedClaim: boolean;
  shouldOfferScopeNarrowingForPoliticalGeneralization: boolean;
  shouldOfferQuoteAnchorForAllegation: boolean;
  shouldBranchContextIfClaimNeedsBackground: boolean;
}

// ── Top-level annotation ───────────────────────────────────────

export interface AnthropicArgumentAnnotation {
  schemaVersion: 2;
  moveId: string;
  roomId: string | null;
  scenarioId: string;
  parentMoveId: string | null;
  argumentType: string;
  side: string;
  messageCategory: MessageCategory;
  primaryRhetoricalArchetype: RhetoricalArchetype;
  secondaryRhetoricalArchetypes: RhetoricalArchetype[];
  opinionVector: OpinionVector;
  agreementDisagreementVector: AgreementDisagreementVector;
  issueDebtSignal: IssueDebtSignal;
  gameImplication: GameImplication;
  qualifierCodes: string[];
  categoryCodes: string[];
  evidenceSignals: EvidenceSignals;
  threadSignals: ThreadSignals;
  modelJustification: ModelJustification;
  deterministicRuleCandidate: DeterministicRuleCandidate;

  // Political frame + amplification (Stage 6.1.5.2). All advisory.
  // `politicalValence` is a frame description of the TEXT, never the
  // user. See the "Anti-amplification doctrine" comment above.
  politicalIssueFrame: PoliticalIssueFrame;
  politicalValence: PoliticalValence;
  amplificationSignals: AmplificationSignals;
  evidentiaryRisk: EvidentiaryRisk;
  amplificationRisk: AmplificationRisk;
  /**
   * `true` when the claim should NOT receive point-standing credit
   * without additional evidence. The point-standing engine reads this.
   */
  platformSupportWarning: boolean;
  recommendedGameTreatment: RecommendedGameTreatment;
  /** One to three sentences. Observable text features only. */
  justification: string;

  annotationSource: AnnotationSource;
  /** Always true. Outputs are advisory. */
  userReviewRequired: true;
}

// ── Constants reused by prompt + validator ─────────────────────

export const ALL_RHETORICAL_ARCHETYPES: RhetoricalArchetype[] = [
  'receipt_demander', 'quote_anchor_demander', 'definition_challenger',
  'scope_narrower', 'evidence_challenger', 'causal_challenger',
  'value_challenger', 'logic_challenger', 'framing_challenger',
  'counterexample_dropper', 'broad_agree_narrow_disagree',
  'narrow_agree_broad_disagree', 'concession_repairer',
  'performative_concession_possible', 'unresolved_debt_creator',
  'tangent_brancher', 'synthesis_closer', 'evasion_possible',
  'low_effort_agreement', 'low_effort_rebuttal', 'playful_pressure',
  'receipts_backed_claim', 'quote_supported_claim',
  'unsupported_bold_claim', 'topic_drift_possible',
  'branch_required_possible', 'unclear',
];

export const ALL_MESSAGE_CATEGORIES: MessageCategory[] = [
  'root_claim', 'supporting_claim', 'challenge', 'counter_challenge',
  'evidence', 'clarification', 'concession', 'synthesis', 'tangent',
  'repair', 'unclear',
];

export const ALL_ISSUE_DEBT_AXES: IssueDebtAxis[] = [
  'fact', 'definition', 'causal', 'value', 'evidence', 'logic',
  'scope', 'framing', 'quote', 'source', 'none',
];

export const ALL_REPAIR_SUGGESTIONS: RepairSuggestion[] = [
  'provide_receipt', 'quote_exact_bit', 'define_term',
  'narrow_scope', 'concede_small_point', 'branch_thread',
  'synthesize', 'none',
];

export const ALL_POLITICAL_ISSUE_FRAMES: PoliticalIssueFrame[] = [
  'election_process', 'governance', 'foreign_policy', 'economic_policy',
  'civil_rights', 'public_safety', 'institutional_trust', 'culture_war',
  'climate_energy', 'health_policy', 'labor_business',
  'technology_platforms', 'unclear', 'non_political',
];

export const ALL_POLITICAL_VALENCES: PoliticalValence[] = [
  'pro_institutional', 'anti_institutional', 'left_leaning_frame',
  'right_leaning_frame', 'populist_frame', 'establishment_frame',
  'anti_media_frame', 'pro_media_frame', 'anti_platform_frame',
  'pro_platform_frame', 'unclear', 'not_applicable',
];

export const ALL_EVIDENTIARY_RISKS: EvidentiaryRisk[] = [
  'low', 'medium', 'high', 'unknown',
];

export const ALL_AMPLIFICATION_RISKS: AmplificationRisk[] = [
  'none_observed', 'low', 'medium', 'high',
];

export const ALL_RECOMMENDED_GAME_TREATMENTS: RecommendedGameTreatment[] = [
  'allow_as_opinion_no_factual_credit', 'ask_for_receipt',
  'ask_for_quote_anchor', 'ask_for_scope_narrowing',
  'ask_for_primary_source', 'suggest_branch_to_context_thread',
  'mark_as_unresolved_issue_debt', 'allow_point_standing_after_evidence',
  'suppress_score_gain_for_amplification_only',
];

export const AMPLIFICATION_SIGNAL_KEYS: ReadonlyArray<keyof AmplificationSignals> = [
  'repeated_claim_language', 'high_engagement_low_evidence',
  'slogan_or_chant_like', 'copy_paste_risk', 'outrage_hook',
  'link_without_receipt_context', 'screenshot_without_primary_source',
  'appeal_to_crowd_size', 'appeal_to_virality', 'unknown_source_chain',
];

/**
 * Tokens we must NEVER apply as a user label. The annotator + fallback
 * + report layers all enforce this. Use coordination-risk /
 * amplification-risk content-pattern signals instead.
 */
export const FORBIDDEN_USER_LABELS: string[] = [
  'troll', 'bot', 'astroturf', 'astroturfer',
  'extremist', 'propagandist',
  'liar', 'dishonest', 'bad faith', 'manipulative', 'manipulator',
];

/**
 * Tokens that MUST NOT appear in any annotation field. The annotator and
 * fallback both refuse to emit these; tests assert their absence in
 * committed reports.
 */
export const FORBIDDEN_ANNOTATION_TOKENS: string[] = [
  'liar', 'dishonest', 'bad faith', 'manipulative', 'manipulation',
  'extremist', 'propagandist', 'winner', 'loser', 'truth verdict',
  'is true', 'is false', 'stupid', 'idiot', 'moron',
];
