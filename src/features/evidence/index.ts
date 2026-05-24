/**
 * EV-001 + EV-002 — Evidence object model + source-chain popover barrel.
 *
 * Pure-TS public surface (types + helpers) plus the EV-002 popover
 * components. No Supabase, no network. EV-003 / EV-004 read from here.
 */

export type {
  EvidenceArtifact,
  EvidenceArtifactKind,
  SourceChainStatus,
  EvidenceRisk,
  EvidenceAttachmentInput,
  BuildEvidenceArtifactsInput,
  ReceiptChipContract,
  TimelineEvidenceContract,
} from './evidenceModel';

export {
  ALL_EVIDENCE_ARTIFACT_KINDS,
  ALL_SOURCE_CHAIN_STATUSES,
  ALL_EVIDENCE_RISKS,
  classifyEvidenceKind,
  deriveSourceChainStatus,
  buildEvidenceArtifacts,
  summarizeArtifactsForReceiptChip,
  getTimelineEvidenceContract,
} from './evidenceModel';

// QOL-036 — Payment / screenshot evidence metadata object.
export type {
  EvidenceConfidence,
  EvidenceAmount,
  PaymentParty,
  ClaimedApplicability,
  PaymentEvidenceMetadata,
} from './evidenceModel';

export {
  ALL_EVIDENCE_CONFIDENCES,
  PINNED_PAYMENT_CONFIDENCE,
  detectRawAccountData,
  findRawAccountDataFields,
  redactPaymentParty,
  getPaymentEvidenceLabel,
  summarizePaymentEvidence,
} from './evidenceModel';

// EV-005 — Evidence-to-evidence interaction (annotations on evidence).
export type {
  EvidenceAnnotation,
  EvidenceAnnotationKind,
  EvidenceAnnotationStatusChip,
  EvidenceAnnotationSummary,
  EvidenceAnnotationActorRole,
  EvidenceAnnotationEligibilityContext,
  AnnotationDepthCapResult,
} from './evidenceModel';

export {
  ALL_EVIDENCE_ANNOTATION_KINDS,
  OWN_BUBBLE_ANNOTATION_KINDS,
  EVIDENCE_ANNOTATION_ELIGIBILITY,
  ANNOTATION_SYNTHESIS_PROMPT_LABEL,
  buildEvidenceAnnotation,
  buildEvidenceAnnotations,
  summariseAnnotations,
  enforceAnnotationDepthCap,
  isAnnotationAllowed,
  isEvidenceAnnotationKind,
  eligibleAnnotationKinds,
  getEvidenceAnnotationLabel,
  getEvidenceAnnotationHelper,
} from './evidenceModel';

// EV-005 — the write-path wrapper is NOT re-exported here: it imports the
// Supabase client, and this barrel is consumed by pure-model tests that do
// not mock Supabase (consistent with how metadata/pointTagsApi.ts is kept
// out of the metadata barrel). Import `addEvidenceAnnotation` /
// `evidenceAnnotationsFromMeta` directly from './evidenceAnnotationApi'.

export {
  EvidenceAnnotationChip,
  EvidenceAnnotationStream,
  EVIDENCE_ANNOTATION_OBSERVER_HELPER,
} from './EvidenceAnnotationChip';
export type {
  EvidenceAnnotationChipProps,
  EvidenceAnnotationStreamProps,
} from './EvidenceAnnotationChip';

export { AddAnnotationSheet, ADD_ANNOTATION_NOTE_HINT } from './AddAnnotationSheet';
export type { AddAnnotationSheetProps } from './AddAnnotationSheet';

// EV-002 — Source-chain popover dispatch model.
export type {
  SourceChainPopoverAction,
  SourceChainPopoverModel,
} from './sourceChainPopoverModel';

export {
  ALL_SOURCE_CHAIN_POPOVER_ACTIONS,
  buildSourceChainPopoverModel,
  buildSourceChainPopoverModelFromChip,
  buildSourceChainPopoverModelFromArtifacts,
  attachAnnotationSummary,
} from './sourceChainPopoverModel';

// EV-002 — Composer preset bodies (frozen plain English).
export {
  ASK_SOURCE_PRESET_BODY,
  ASK_QUOTE_PRESET_BODY,
  ASK_STRONGER_SOURCE_PRESET_BODY,
  ALL_SOURCE_CHAIN_PRESET_BODIES,
} from './sourceChainPresetCopy';

// EV-002 — React Native components.
export { ReceiptChip, RECEIPT_CHIP_RING_COLOR } from './ReceiptChip';
export type { ReceiptChipProps } from './ReceiptChip';
export { SourceChainPopover } from './SourceChainPopover';
export type { SourceChainPopoverProps } from './SourceChainPopover';

// EV-003 — Evidence debt tracker (render-time-derived obligation model).
export type {
  EvidenceDebt,
  EvidenceDebtKind,
  EvidenceDebtStatus,
  EvidenceDebtChipContract,
  NodeEvidenceDebtSummary,
  RoomEvidenceDebtSummary,
  EvidenceDebtArgumentInput,
  EvidenceResponseLite,
  DeriveEvidenceDebtsInput,
} from './evidenceDebtModel';

export {
  ALL_EVIDENCE_DEBT_KINDS,
  ALL_EVIDENCE_DEBT_STATUSES,
  OPEN_EVIDENCE_DEBT_STATUSES,
  STALE_DEBT_THRESHOLD_DAYS,
  deriveEvidenceDebts,
  getNodeEvidenceDebtSummary,
  getRoomEvidenceDebtSummary,
  summarizeEvidenceDebtChip,
  getNodeEvidenceDebtChip,
  evidenceDebtKindWord,
} from './evidenceDebtModel';

// EV-003 — React Native obligation-axis status chip.
export { EvidenceDebtChip, EVIDENCE_DEBT_CHIP_HIT_SLOP } from './EvidenceDebtChip';
export type { EvidenceDebtChipProps } from './EvidenceDebtChip';

// QOL-037 — Evidence applicability dispute flow (the applicability axis).
export type {
  EvidenceResponseChoice,
  ApplicabilityStatus,
  EvidenceResponseRecord,
  EvidenceResponseChoiceDescriptor,
  EvidenceResponseValidation,
  ApplicabilityChipContract,
  RespondToEvidenceViewModel,
  DeriveApplicabilityStatusOptions,
} from './evidenceApplicabilityModel';

export {
  ALL_EVIDENCE_RESPONSE_CHOICES,
  ALL_APPLICABILITY_STATUSES,
  EVIDENCE_RESPONSE_CHOICES,
  MIN_CLARIFICATION_CHARS,
  validateEvidenceResponseDraft,
  deriveApplicabilityStatus,
  previewApplicabilityTransition,
  summarizeApplicabilityChip,
  buildRespondToEvidenceViewModel,
} from './evidenceApplicabilityModel';

// QOL-037 — locked plain-language copy (exported for ban-list tests).
export {
  EVIDENCE_RESPONSE_CHOICE_LABELS,
  EVIDENCE_RESPONSE_CHOICE_HELPERS,
  APPLICABILITY_CHIP_LABELS,
  APPLICABILITY_CHIP_HELPERS,
  ALL_EVIDENCE_APPLICABILITY_STRINGS,
} from './evidenceApplicabilityCopy';

// QOL-037 — React Native applicability-axis status chip.
export { ApplicabilityChip, APPLICABILITY_CHIP_HIT_SLOP } from './ApplicabilityChip';
export type { ApplicabilityChipProps } from './ApplicabilityChip';

// QOL-037 — React Native respond-to-evidence structured form.
export { RespondToEvidenceForm, composeApplicabilityPreviewLine } from './RespondToEvidenceForm';
export type {
  RespondToEvidenceFormProps,
  RespondToEvidenceViewerRole,
  EvidenceResponseDraft,
} from './RespondToEvidenceForm';

// QOL-036.1 — Payment-evidence pill state derivation (composition-layer consumer).
export type {
  PaymentEvidencePillState,
  PaymentEvidencePillProvenance,
  DerivePaymentEvidencePillStateInput,
} from './paymentEvidencePillState';

export {
  MUTATION_TO_PILL_STATE,
  PILL_STATE_CONFLICT_RULE,
  derivePaymentEvidencePillState,
} from './paymentEvidencePillState';
