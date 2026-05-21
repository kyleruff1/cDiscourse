export { ArgumentTreeScreen } from './ArgumentTreeScreen';
export type { ArgumentViewMode } from './ArgumentTreeScreen';
export { ArgumentComposer } from './ArgumentComposer';
export { ArgumentTimelineScreen } from './ArgumentTimelineScreen';
export { ArgumentTrack } from './ArgumentTrack';
export { ArgumentTimelineNode } from './ArgumentTimelineNode';
export { useArgumentViewport } from './useArgumentViewport';
export { useArgumentComposer } from './useArgumentComposer';
export { useConstitution } from './useConstitution';
export type { UseConstitutionResult } from './useConstitution';
export { buildEvaluationInput } from './composerValidation';
export type { ComposerConstitutionData } from './composerValidation';
export { ComposerDraftRecoveryNotice } from './ComposerDraftRecoveryNotice';
export { ComposerTargetPanel } from './ComposerTargetPanel';
export { ComposerValidationPanel } from './ComposerValidationPanel';
export {
  selectReplyTarget,
  clearReplyTarget,
  getAllowedReplyTypesForParent,
  getVisibleArgumentIds,
  getArgumentRelationsForDisplay,
  getParentArgumentForComposer,
} from './composerHandoff';
export {
  createDraftId,
  createClientSubmissionId,
  createEmptyDraft,
  updateDraftField,
  isDraftSubmittableShape,
  shouldReusePendingSubmission,
  shouldCreateNewClientSubmissionId,
  getDraftStorageKey,
  normalizeAttachedEvidence,
  shouldRestoreDraft,
  canClearParentWithoutConfirm,
  getAllowedArgumentTypesForParent,
  getTagDefsForArgumentType,
} from './composerHelpers';
export { draftToSession, sessionToDraft } from './composerState';
export type { ComposerDraft, EvidenceAttachmentLocal } from './composerState';
// IX-002 — timeline mini-map overview (pure model + thin RN component).
export { TimelineMiniMap } from './TimelineMiniMap';
export {
  buildTimelineMiniMapModel,
  buildViewportWindow,
  buildBranchClusters,
  buildMiniMapSummaryLine,
  findHotZone,
  mapTemperatureToHeatTier,
  resolveRegionJumpTarget,
  MINI_MAP_MIN_MOVES,
  MINI_MAP_HOT_ZONE_MIN_RUN,
  MINI_MAP_RAIL_HEIGHT,
  MINI_MAP_LANE_STEP_PX,
  MINI_MAP_MARKER_SIZE,
} from './timelineMiniMapModel';
export type {
  TimelineMiniMapModel,
  MiniMapMarker,
  MiniMapHeatTier,
  MiniMapHotZone,
  MiniMapBranchCluster,
  MiniMapViewportWindow,
  MiniMapJumpRequest,
  BuildTimelineMiniMapInput,
  BuildViewportWindowInput,
} from './timelineMiniMapModel';
export type { ArgumentRow, ArgumentCache, ArgumentViewportState, DisagreementAxis } from './types';
export {
  buildSubmitArgumentPayload,
  createSubmissionFingerprint,
  getOrCreateClientSubmissionId,
  shouldReuseClientSubmissionIdForRetry,
  extractServerValidationError,
  isIdempotentSuccess,
} from './composerSubmit';
