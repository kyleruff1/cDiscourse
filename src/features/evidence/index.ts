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
