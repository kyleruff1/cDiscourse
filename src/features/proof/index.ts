/**
 * PROOF-002 (#889) — source drawer feature barrel.
 *
 * NO featureFlags import (App is the sole flag consumer). Pure re-exports.
 */
export {
  PROOF_DRAWER_KINDS,
  buildProofKindTiles,
  proofItemRowToEvidenceArtifact,
  isProofDraftPostable,
  type ProofDrawerKind,
  type ProofDrawerInputMode,
  type ProofKindTile,
  type ProofDrawerScope,
  type ProofDraftInput,
  type ProofItemRow,
} from './proofDrawerModel';
export { PROOF_DRAWER_COPY, ATTACH_ERROR_COPY } from './proofDrawerCopy';
export {
  attachProof,
  detachProof,
  type AttachProofInput,
  type AttachProofResult,
  type AttachProofErrorCode,
  type DetachProofInput,
} from './attachProofApi';
export { useProofItems, type UseProofItemsResult } from './useProofItems';
export { ProofChip, type ProofChipProps } from './ProofChip';
export { ProofDrawer, type ProofDrawerProps } from './ProofDrawer';
