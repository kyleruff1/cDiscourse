// ── Stage 1 exports (preserved for backward compatibility) ────
export type {
  ArgumentInput,
  ArgumentTypeCode,
  ArgumentTypeDefinition,
  ConstitutionSchema,
  EvidenceLink,
  Flag,
  FlagSource,
  Severity,
  Side,
  TagDefinition,
  ValidationResult,
} from './types';

export {
  hasViolations,
  runDeterministicChecks,
  validateBodyLength,
  validateDepth,
  validateEvidenceLinks,
  validateTags,
  validateTransition,
} from './engine';

export { constitutionV1 } from './v1';

// ── Stage 3 exports ───────────────────────────────────────────
export type {
  ArgumentType,
  ArgumentSide,
  DisagreementAxis,
  EvaluationSeverity,
  FlagStatus,
  FlagPersistSource,
  RuleType,
  RuleCode,
  FlagCode,
  TagCode,
  ConstitutionVersion,
  ConstitutionRule,
  ConstitutionTagDef,
  ConstitutionFlagDef,
  EvidenceAttachment,
  ParentArgument,
  SiblingArgument,
  ArgumentTarget,
  ArgumentDraftEvaluationInput,
  EvaluationFlagDetail,
  FlagToPersist,
  TopicSatisfactionResult,
  ValidationPayload,
  EvaluationResult,
} from './types';

export { RULE_CODES, FLAG_CODES, TAG_CODES } from './types';

export {
  constitutionVersion,
  constitutionRules,
  tagDefinitions,
  flagDefinitions,
  CONSTITUTION_V1_ID,
} from './constitution.v1';

export {
  getAllowedReplies,
  isValidTransition,
  buildTransitionMatrix,
} from './allowedTransitions';

export { computeTopicSatisfaction, computeExtendedTopicSatisfaction } from './topicSatisfaction';

export { evaluateArgumentDraft } from './evaluateArgumentDraft';

export { runRailsChecks, railsEntryToFlagToPersist } from './railsChecks';
export type { RailsCheckInput, RailsCheckResult } from './railsChecks';

export {
  adaptDbConstitutionVersion,
  adaptDbRule,
  adaptDbTagDef,
  adaptDbFlagDef,
} from './dbAdapters';
export type {
  DbConstitutionVersion,
  DbConstitutionRule,
  DbConstitutionTagDef,
  DbConstitutionFlagDef,
} from './dbAdapters';
