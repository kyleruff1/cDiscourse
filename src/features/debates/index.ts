export { DebateListScreen } from './DebateListScreen';
export { DebateDetailHeader } from './DebateDetailHeader';
export { useDebates } from './useDebates';
export { useCurrentDebate } from './useCurrentDebate';
export type {
  Debate,
  DebateStatus,
  ParticipantSide,
  CreateDebateInput,
  RoomVisibility,
} from './types';

// QOL-039 — room visibility model + transition.
export {
  canTransitionToPrivate,
  buildTransitionConsequences,
  countChimeInBranchesFromSeatMap,
  summarizeRejectedChimeInBranches,
  ALL_ROOM_VISIBILITIES,
  ALL_TRANSITION_REASONS,
  ALL_TRANSITION_EFFECTS,
  ROOM_VISIBILITY_COPY,
} from './roomVisibilityModel';
export type {
  TransitionReason,
  TransitionEffect,
  VisibilityTransitionContext,
  TransitionEligibility,
  TransitionConsequences,
  RoomVisibilityChangeEvent,
  RejectedChimeInBranchSummary,
} from './roomVisibilityModel';
export { transitionRoomToPrivate } from './debatesApi';
export type { RoomVisibilityTransitionResult } from './debatesApi';

// SETTLE-001 (#911) — host settle / re-open room lifecycle model + surfaces.
export {
  canSettleRoom,
  canReopenRoom,
  buildSettleConsequences,
  ALL_SETTLE_MODES,
  ALL_SETTLE_REASONS,
  ALL_SETTLE_CONSEQUENCES,
  ROOM_SETTLE_COPY,
} from './settleRoomModel';
export type {
  SettleMode,
  SettleReason,
  SettleContext,
  SettleEligibility,
  SettleConsequence,
  SettleConsequences,
} from './settleRoomModel';
export { RoomSettleConfirmation } from './RoomSettleConfirmation';
export { RoomSettledNotice } from './RoomSettledNotice';

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

// UX-ROOM-1V1-CHIMEIN-001A — 1:1-first room display-state pure model (Layer A).
export {
  deriveRoomOneToOneDisplayState,
  buildRoomOneToOneViewModel,
  buildOneToOneSeatLineViewModel,
  chimeInAllowed,
  ALL_ROOM_ONE_TO_ONE_DISPLAY_STATES,
  ROOM_ONE_TO_ONE_COPY,
  POINT_SCOPED_CHIME_IN_COPY,
  _forbiddenOneToOneTokens,
} from './oneToOneRoomModel';
export type {
  RoomOneToOneDisplayState,
  RoomOneToOneDisplayInput,
  RoomOneToOneViewModel,
  OneToOneSeatLineViewModel,
} from './oneToOneRoomModel';

// P8-CHIMEIN-ARC Round 1 (#680) — 1:1-first room LIFECYCLE transition machine.
// Additive over the shipped snapshot classifier; dormant-safe (author now, wire
// later). The chime-in CONTRIBUTION path is Round 2 (#761), operator-gated.
export {
  initialRoomLifecycleState,
  applyRoomLifecycleEvent,
  projectToDisplayState,
  CHIME_IN_CAP_PUBLIC,
  ALL_ROOM_LIFECYCLE_PHASES,
  ALL_ROOM_LIFECYCLE_EVENT_KINDS,
  _forbiddenRoomLifecycleTokens,
} from './oneToOneRoomLifecycle';
export type {
  RoomLifecyclePhase,
  RoomLifecycleEvent,
  RoomLifecycleState,
} from './oneToOneRoomLifecycle';

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

// GAME-008 — bot public-room policy + public argument seeding.
export { BotParticipantMarker } from './BotParticipantMarker';
export { BotRoomMarker } from './BotRoomMarker';
export {
  BOT_ROOM_POLICY,
  ALL_BOT_POLICY_DENY_REASONS,
  isBotSeededRoom,
  looksLikeBotSeedTag,
  buildBotMarkingViewModel,
  assertBotRoomEligibility,
  _forbiddenBotMarkerTokens,
} from './botRoomPolicyModel';
export type {
  BotRoomPolicy,
  BotParticipantHint,
  BotRoomInputs,
  BotParticipantMarking,
  BotMarkingViewModel,
  BotRoomAction,
  BotPolicyDenyReason,
  BotRoomEligibilityResult,
  AssertBotRoomEligibilityInput,
} from './botRoomPolicyModel';

// ARG-ROOM-001 — argument-room creation matrix (pure shared validator).
export {
  deriveArgumentRoomCreation,
  fitsPublicCapacity,
  fitsPrivateCapacity,
  plainLanguageForCreationReason,
  ARGUMENT_ROOM_CREATION_COPY,
  ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS,
  PUBLIC_ACTIVE_PARTICIPANT_CAP,
  PRIVATE_ACTIVE_PARTICIPANT_CAP,
  MAX_DIRECT_INVITES_AT_CREATION,
  _forbiddenArgumentRoomCreationTokens,
} from './argumentRoomCreationMatrix';
export type {
  ArgumentRoomVisibility,
  ArgumentRoomCapacity,
  ArgumentRoomCreationRejectReason,
  ArgumentRoomCreationIntent,
  DeriveArgumentRoomCreationOptions,
  ArgumentRoomCreationDerived,
} from './argumentRoomCreationMatrix';

// ARG-ROOM-002 — pure capacity twin of the SQL enforcement.
export {
  roomActiveSeatCap,
  isCreationValid,
  openSlotsAfterCreate,
  canJoinActive,
  openActiveSlots,
} from './roomCapacityModel';

// ARG-ROOM-005 — public participant seat-claim model + the live-room
// active-participant count read.
export {
  isActiveParticipantSide,
  deriveSeatAvailability,
  classifyJoinOutcome,
  buildSeatAvailabilityViewModel,
  resolveJoinSideEffect,
  _forbiddenSeatClaimTokens,
} from './seatClaimModel';
export type {
  SeatAvailabilityInput,
  SeatAvailability,
  SeatAvailabilityViewModel,
  JoinOutcomeKind,
  JoinSuccessOutcome,
  JoinSideEffect,
} from './seatClaimModel';
export { useActiveParticipantCount } from './useActiveParticipantCount';
export type { UseActiveParticipantCountResult } from './useActiveParticipantCount';
export type { JoinAttemptResult } from './useDebates';
export type { JoinDebateResult } from './debatesApi';
