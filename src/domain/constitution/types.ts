// ─────────────────────────────────────────────────────────────
// Stage 1 types — preserved for backward compatibility.
// engine.ts and v1.ts depend on these.
// ─────────────────────────────────────────────────────────────

export type ArgumentTypeCode = 'CLM' | 'RBT' | 'CRB' | 'EVD' | 'CLR' | 'CON' | 'SYN';
export type Severity = 'info' | 'warning' | 'violation';
export type Side = 'affirmative' | 'negative' | 'neutral';
export type FlagSource = 'deterministic' | 'ai';

export interface ArgumentTypeDefinition {
  code: ArgumentTypeCode;
  name: string;
  description: string;
}

export interface TagDefinition {
  id: string;
  label: string;
  category: string;
}

export interface AiCheckConfig {
  enabled: boolean;
  ruleId: string;
  severity: Severity;
  confidenceThreshold?: number;
}

export interface StructuralLimits {
  maxDepth: number;
  maxBodyLength: number;
  maxTagsPerArgument: number;
  maxEvidenceLinksPerArgument: number;
}

export interface ConstitutionSchema {
  version: string;
  argumentTypes: ArgumentTypeDefinition[];
  /** Maps parent argument type code → allowed child type codes */
  transitionMatrix: Partial<Record<ArgumentTypeCode, ArgumentTypeCode[]>>;
  tags: TagDefinition[];
  structuralLimits: StructuralLimits;
  aiChecks: {
    enabled: boolean;
    checks: {
      topicRelevance: AiCheckConfig;
      typeFit: AiCheckConfig;
      tagSuggestion: AiCheckConfig;
    };
  };
}

export interface Flag {
  ruleId: string;
  severity: Severity;
  message: string;
  source: FlagSource;
  authoritative: boolean;
  payload?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  flags: Flag[];
}

export interface EvidenceLink {
  url: string;
  label: string;
  accessedAt?: string;
}

/** Minimal argument shape required by the rules engine. No DB ids needed. */
export interface ArgumentInput {
  type: ArgumentTypeCode;
  side: Side;
  body: string;
  tags: string[];
  evidenceLinks: EvidenceLink[];
  depth: number;
  /** null for root-level arguments */
  parentType: ArgumentTypeCode | null;
  /** Required to enforce SYN_THREAD_OPEN rule; undefined = unknown (check skipped) */
  parentThreadClosed?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Stage 3 types — deterministic constitution rules engine.
// evaluateArgumentDraft.ts depends on these.
// ─────────────────────────────────────────────────────────────

/** Full argument types used in the Stage 3 DB schema. */
export type ArgumentType =
  | 'thesis'
  | 'claim'
  | 'rebuttal'
  | 'counter_rebuttal'
  | 'evidence'
  | 'clarification_request'
  | 'concession'
  | 'synthesis';

export type ArgumentSide = 'affirmative' | 'negative' | 'neutral';
export type EvaluationSeverity = 'info' | 'warning' | 'review' | 'blocking';
export type FlagStatus = 'open' | 'needs_review' | 'confirmed' | 'dismissed';
export type FlagPersistSource = 'client_rules' | 'server_rules';
export type RuleType =
  | 'transition'
  | 'topic_satisfaction'
  | 'evidence'
  | 'civility'
  | 'structure'
  | 'rate_limit'
  | 'length'
  | 'review'
  | 'rails';

export type DisagreementAxis =
  | 'fact'
  | 'definition'
  | 'causal'
  | 'value'
  | 'evidence'
  | 'logic'
  | 'scope';

// ── Centralized string-constant registries ────────────────────
// Use these everywhere instead of inline string literals.
// C-STRUCT-001, C-TRANSITION-001 etc. are the logical rule groups
// documented in docs/constitution-v1.md. The values are the DB codes
// from constitution_rules.code (used in FlagToPersist.ruleCode).

export const RULE_CODES = {
  // C-STRUCT-001 — parent/root structure
  PARENT_REQUIRED: 'parent_required',
  ROOT_TYPE_ALLOWED: 'root_type_allowed',
  // C-TRANSITION-001 — transition matrix (one code per "from" type)
  TRANSITION_THESIS: 'transition_thesis',
  TRANSITION_CLAIM: 'transition_claim',
  TRANSITION_REBUTTAL: 'transition_rebuttal',
  TRANSITION_COUNTER_REBUTTAL: 'transition_counter_rebuttal',
  TRANSITION_EVIDENCE: 'transition_evidence',
  TRANSITION_CLARIFICATION_REQUEST: 'transition_clarification_request',
  TRANSITION_CONCESSION: 'transition_concession',
  TRANSITION_SYNTHESIS: 'transition_synthesis',
  // C-TOPIC-001 — lexical topic satisfaction
  TOPIC_SATISFACTION_LEXICAL: 'topic_satisfaction_lexical',
  // C-EVIDENCE-001 — evidence citation requirement
  EVIDENCE_SOURCE_REQUIRED: 'evidence_source_required',
  // C-LENGTH-001 — body length bounds
  LENGTH_BODY: 'length_body',
  // C-CIVILITY-001 — civility heuristic
  CIVILITY_HEURISTIC: 'civility_heuristic',
  // C-DUPLICATE-001 — sibling similarity (engine-only; no DB rule)
  DUPLICATE_SIBLING: 'duplicate_sibling_heuristic',
  // C-RAIL-001–005 — discourse rails
  PARENT_RESPONSIVENESS_LEXICAL: 'parent_responsiveness_lexical',
  DISAGREEMENT_AXIS_REQUIRED: 'disagreement_axis_required',
  CONCESSION_INTEGRITY: 'concession_integrity',
  CLARIFICATION_PURITY: 'clarification_purity',
  FACT_CONFUSION_CHANNEL: 'fact_confusion_channel',
} as const;

export type RuleCode = (typeof RULE_CODES)[keyof typeof RULE_CODES];

export const FLAG_CODES = {
  OFF_TOPIC: 'off_topic',
  WEAK_TOPIC: 'weak_topic_satisfaction',
  MISSING_PARENT: 'missing_parent',
  INVALID_TRANSITION: 'invalid_transition',
  EVIDENCE_REQUIRED: 'evidence_required',
  CIVILITY_RISK: 'civility_risk',
  AD_HOMINEM: 'ad_hominem_possible',
  DUPLICATE: 'duplicate_argument_possible',
  EXCESSIVE_LENGTH: 'excessive_length',
  UNCLEAR_CLAIM: 'unclear_claim',
  MOD_REVIEW: 'needs_moderator_review',
  // Rails flags (C-RAIL-001–005)
  PARENT_NONRESPONSIVE: 'parent_nonresponsive',
  TANGENT_SHIFT: 'tangent_shift_possible',
  CONCESSION_EVASION: 'concession_evasion_possible',
  LOADED_CLARIFICATION: 'loaded_clarification_possible',
  FACT_CONFUSION: 'fact_confusion_possible',
} as const;

export type FlagCode = (typeof FLAG_CODES)[keyof typeof FLAG_CODES];

export const TAG_CODES = {
  CLAIM: 'claim',
  REBUTTAL: 'rebuttal',
  COUNTER_REBUTTAL: 'counter_rebuttal',
  EVIDENCE: 'evidence',
  SOURCE_REQUEST: 'source_request',
  CLARIFICATION: 'clarification',
  CONCESSION: 'concession',
  SYNTHESIS: 'synthesis',
  SCOPE_CHALLENGE: 'scope_challenge',
  // Disagreement-axis tags (C-RAIL-002)
  FACT_DISAGREEMENT: 'fact_disagreement',
  DEFINITION_DISAGREEMENT: 'definition_disagreement',
  CAUSAL_DISAGREEMENT: 'causal_disagreement',
  VALUE_DISAGREEMENT: 'value_disagreement',
  EVIDENCE_CHALLENGE: 'evidence_challenge',
  LOGIC_CHALLENGE: 'logic_challenge',
} as const;

export type TagCode = (typeof TAG_CODES)[keyof typeof TAG_CODES];

// ── DB-mirrored types ─────────────────────────────────────────

export interface ConstitutionVersion {
  id: string;
  slug: string;
  version: string;
  title: string;
  active: boolean;
}

export interface ConstitutionRule {
  id: string;
  constitutionId: string;
  code: string;
  title: string;
  description: string;
  ruleType: RuleType;
  severity: EvaluationSeverity;
  params: Record<string, unknown>;
  enabled: boolean;
}

/** DB-backed tag definition (Stage 3). Distinguished from Stage 1's TagDefinition. */
export interface ConstitutionTagDef {
  code: string;
  label: string;
  description: string;
  category: string;
  allowedArgumentTypes: string[];
  enabled: boolean;
}

/** DB-backed flag definition (Stage 3). */
export interface ConstitutionFlagDef {
  code: string;
  label: string;
  description: string;
  severity: EvaluationSeverity;
  defaultStatus: FlagStatus;
  autoReviewThreshold: number | null;
  enabled: boolean;
}

// ── Engine input ──────────────────────────────────────────────

export interface EvidenceAttachment {
  url?: string;
  label?: string;
  sourceText?: string;
}

export interface ParentArgument {
  id: string;
  argumentType: ArgumentType;
  side: ArgumentSide;
  body: string;
  depth: number;
}

export interface SiblingArgument {
  id: string;
  argumentType: ArgumentType;
  side: ArgumentSide;
  body: string;
}

export interface ArgumentTarget {
  targetExcerpt?: string;
  disagreementAxis?: DisagreementAxis;
  concessionScope?: string;
  userStatedUncertainty?: boolean;
}

export interface ArgumentDraftEvaluationInput {
  debateId: string;
  debateResolution: string;
  debateDescription?: string;
  parentArgument?: ParentArgument;
  existingSiblingArguments?: SiblingArgument[];
  argumentType: ArgumentType;
  side: ArgumentSide;
  body: string;
  selectedTagCodes: string[];
  attachedEvidence?: EvidenceAttachment[];
  activeConstitution: ConstitutionVersion;
  activeRules: ConstitutionRule[];
  tagDefinitions: ConstitutionTagDef[];
  flagDefinitions: ConstitutionFlagDef[];
  /** Optional target/framing data from the client. Used by rails checks. */
  target?: ArgumentTarget;
  /** 'client' emits source:'client_rules'; 'server' emits source:'server_rules'. Default: 'client'. */
  evaluationContext?: 'client' | 'server';
}

// ── Engine output ─────────────────────────────────────────────

export interface EvaluationFlagDetail {
  /** DB code from constitution_rules.code; or synthetic for engine-only rules. */
  ruleCode: string;
  flagCode: FlagCode;
  severity: EvaluationSeverity;
  message: string;
  payload: Record<string, unknown>;
}

export interface FlagToPersist {
  flagCode: FlagCode;
  /** DB code matching constitution_rules.code (nullable FK in argument_flags). */
  ruleCode: string;
  source: FlagPersistSource;
  severity: EvaluationSeverity;
  defaultStatus: FlagStatus;
  confidence: number | null;
  payload: Record<string, unknown>;
  message: string;
}

export interface TopicSatisfactionResult {
  method: 'lexical';
  /** combinedScore when extended; resolutionScore otherwise */
  score: number;
  threshold: number;
  offTopicThreshold: number;
  status: 'satisfied' | 'weak' | 'failed' | 'not_applicable';
  /** = matchedResolutionTerms when extended */
  matchedTerms: string[];
  /** = missingResolutionTerms when extended */
  missingTerms: string[];
  // Extended fields — populated by computeExtendedTopicSatisfaction
  resolutionScore?: number;
  parentScore?: number | null;
  combinedScore?: number;
  matchedResolutionTerms?: string[];
  missingResolutionTerms?: string[];
  matchedParentTerms?: string[];
  missingParentTerms?: string[];
  railMode?: 'root' | 'reply';
  payload: Record<string, unknown>;
}

export interface ValidationPayload {
  checkedAt: string;
  constitutionVersion: string;
  ruleCodesChecked: string[];
  flagCount: number;
  blockingCount: number;
}

export interface EvaluationResult {
  /** False if any blockingErrors exist. */
  allowPost: boolean;
  blockingErrors: EvaluationFlagDetail[];
  warnings: EvaluationFlagDetail[];
  flagsToPersist: FlagToPersist[];
  topicSatisfactionCheck?: TopicSatisfactionResult;
  normalizedTags: string[];
  clientValidationPayload: ValidationPayload;
  serverValidationPayload: ValidationPayload;
}
