export { DebateListScreen } from './DebateListScreen';
export { DebateDetailHeader } from './DebateDetailHeader';
export { useDebates } from './useDebates';
export { useCurrentDebate } from './useCurrentDebate';
export type { Debate, DebateStatus, ParticipantSide, CreateDebateInput } from './types';

// GAME-004 — 1v1 PvP room contract + Primary Opponent model.
export { RoomContractSeatStrip, roomTypeGlyph } from './RoomContractSeatStrip';
export { useRoomContract } from './useRoomContract';
export {
  buildRoomContract,
  buildRoomContractViewModel,
  resolvePrimaryOpponent,
  isQualifyingResponse,
  explainQualifyingResponse,
  isPrimaryOpponentSeatStale,
  ROOM_TYPE_DEFAULT,
  ROOM_CONTRACT_COPY,
  PRIMARY_OPPONENT_INACTIVITY_MS,
  MIN_QUALIFYING_BODY_CHARS,
  MAINLINE_RESPONSE_TYPES,
  SEAT_BLOCKING_FLAG_CODES,
} from './roomContractModel';
export type {
  RoomType,
  PrimarySeat,
  RoomContract,
  RoomContractViewModel,
  SeatViewModel,
  BuildRoomContractInput,
  RoomArgumentInput,
  RoomParticipantInput,
  QualifyingResponseSignals,
  QualifyingResponseResult,
  DisqualifyReason,
  IsQualifyingResponseOptions,
} from './roomContractModel';
export type {
  UseRoomContractInput,
  UseRoomContractOptions,
  UseRoomContractResult,
} from './useRoomContract';

// GAME-005 — public-room participant seats + chime-in governance.
export { ChimeInGovernanceControl } from './ChimeInGovernanceControl';
export { PublicRoomMetricsStrip } from './PublicRoomMetricsStrip';
export { useChimeInGovernance } from './useChimeInGovernance';
export {
  buildPublicRoomSeatMap,
  evaluateChimeInStanding,
  canApplyGovernanceReaction,
  buildPublicRoomMetricsViewModel,
  buildGovernanceControlViewModel,
  governanceReactionLabel,
  ALL_GOVERNANCE_REACTION_KINDS,
  PUBLIC_ROOM_SEAT_CAP,
  PRIMARY_SEAT_COUNT,
  CHIME_IN_GOVERNANCE_WINDOW_MS,
  _forbiddenChimeInGovernanceTokens,
} from './publicSeatModel';
export type {
  SeatRole,
  PublicSeat,
  ChimeInStanding,
  PublicRoomSeatMap,
  MovedToObserverRecord,
  ObserverFallbackReason,
  GovernanceReaction,
  GovernanceReactionKind,
  GovernanceDenyReason,
  GovernanceActorResult,
  PublicRoomMetricsViewModel,
  GovernanceControlViewModel,
  BuildPublicRoomSeatMapInput,
  EvaluateChimeInStandingOptions,
} from './publicSeatModel';
export type {
  UseChimeInGovernanceResult,
  ApplyChimeInReactionInput,
} from './useChimeInGovernance';

// GAME-006 — Jump Branch: once-per-room cross-branch participation.
export { JumpBranchControl } from './JumpBranchControl';
export { JumpBranchMarker } from './JumpBranchMarker';
export {
  canJump,
  jumpsUsed,
  listJumpsForParticipant,
  deriveParticipantHomeBranch,
  buildBranchEngagementMap,
  buildJumpControlViewModel,
  buildJumpMarkers,
  jumpDenyReasonLabel,
  MAX_JUMPS_PER_ROOM,
  ALL_JUMP_DENY_REASONS,
  _forbiddenJumpBranchTokens,
} from './jumpBranchModel';
export type {
  JumpBranchRecord,
  JumpDenyReason,
  JumpEligibility,
  BranchEngagementState,
  JumpControlViewModel,
  JumpMarkerKind,
  JumpMarkerViewModel,
} from './jumpBranchModel';
