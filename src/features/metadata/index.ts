/**
 * META-001 — Move tag / flag / metadata event ledger barrel.
 *
 * Public re-exports. Single import surface for consumers (SC-004, ST-002,
 * GAME-001, RULE-003, GAL-002, AN-003, EV-003, HIST-001 in later cards).
 *
 * Pure TS. No React, no Supabase, no network.
 */

export type {
  ManualTagCode,
  AutoMetadataCode,
  ManualTagActorRole,
  ManualTagEligibilityRecord,
  ManualTagEntry,
  AutoMetadataEntry,
  LifecycleCausationEntry,
  MoveLinkageRecord,
  ClusterMetadataSummary,
  MetadataEvent,
  MoveMetadataLedger,
  BuildMoveMetadataLedgerInput,
  ApplyManualTagInput,
  EligibilityContext,
  AutoMetadataConfig,
} from './moveMetadataLedger';

export {
  ALL_MANUAL_TAG_CODES,
  ALL_AUTO_METADATA_CODES,
  MANUAL_TAG_ELIGIBILITY,
  DEFAULT_AUTO_METADATA_CONFIG,
  buildMoveMetadataLedger,
  applyManualTag,
  removeManualTag,
  getManualTagPlainLabel,
  getAutoMetadataPlainLabel,
  _forbiddenMetadataTokens,
} from './moveMetadataLedger';

// Internal helpers re-exported for unit tests + advanced consumers.
export {
  getManualTagEligibility,
  isApplyAllowed,
  makeManualTagDedupeKey,
  MANUAL_TAG_ELIGIBILITY_TABLE,
} from './manualTagModel';

export {
  deriveAutoMetadataForMessage,
} from './autoMetadataModel';

export type {
  DeriveAutoMetadataForMessageInput,
} from './autoMetadataModel';

export {
  diffLedgers,
  computeLifecycleCausationForMove,
} from './metadataEvents';

export type {
  ComputeLifecycleCausationForMoveInput,
  DiffLedgersInput,
} from './metadataEvents';
