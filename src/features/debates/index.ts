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
