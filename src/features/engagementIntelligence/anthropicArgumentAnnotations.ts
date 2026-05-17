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
}

// ── Top-level annotation ───────────────────────────────────────

export interface AnthropicArgumentAnnotation {
  schemaVersion: 1;
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
