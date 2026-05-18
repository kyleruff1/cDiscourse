/**
 * EV-001 — Evidence object model v1 barrel.
 *
 * Pure-TS public surface. No React, no Supabase, no network. Re-exports the
 * types + helpers EV-002 / EV-003 / EV-004 will consume.
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
