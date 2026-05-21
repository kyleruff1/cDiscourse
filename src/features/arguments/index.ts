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
// IX-001 — timeline density + focus-lens model (pure model + thin session hook).
export {
  ALL_GALLERY_DENSITY_MODES,
  DEFAULT_GALLERY_DENSITY,
  GALLERY_DENSITY_SPECS,
  resolveGalleryDensitySpec,
  toTimelineDensityMode,
  densityChangePreservesActive,
  ALL_FOCUS_LENSES,
  TIMELINE_LENS_IDS,
  DEFAULT_FOCUS_LENS,
  FOCUS_LENS_COPY,
  GALLERY_LENS_PREDICATES,
  TIMELINE_LENS_PREDICATES,
  activePathLens,
  applyGalleryLens,
  applyTimelineLens,
  ALL_GALLERY_SORT_AXES,
  toConversationSortMode,
  DEFAULT_DENSITY_LENS_VIEW_CONFIG,
  applyViewConfigChange,
  RECENTLY_UPDATED_WINDOW_MS,
} from './timelineDensityLensModel';
export type {
  GalleryDensityMode,
  GalleryDensitySpec,
  FocusLensId,
  FocusLensCopy,
  LensContext,
  TimelineLensContext,
  TimelineLensNode,
  GalleryLensPredicate,
  TimelineLensPredicate,
  LensEmphasis,
  LensedItem,
  LensApplication,
  GallerySortAxis,
  DensityLensViewConfig,
} from './timelineDensityLensModel';
export { useDensityLens } from './useDensityLens';
export type { UseDensityLensResult } from './useDensityLens';
