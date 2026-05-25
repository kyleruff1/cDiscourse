/**
 * UX-001.5A — Public exports for the node labels module.
 *
 * Five layered concerns:
 *   - Type contracts (`nodeLabelTypes`)
 *   - Registries (`machineObservationRegistry`, `userAllegationRegistry`)
 *   - Source adapters (`nodeLabelSourceAdapters`)
 *   - Presentation model + priority (`nodeLabelPresentationModel`,
 *     `nodeLabelPriorityModel`)
 *   - Descriptor adapter (`nodeLabelDescriptorAdapter`)
 *
 * RN components:
 *   - `NodeLabelStrip` — Timeline-node consumer
 *   - `NodeLabelInspectGroups` — Inspect-popout consumer
 *
 * Pure-TS modules carry no React / Supabase / network imports.
 */

// ── Pure-TS exports — types ─────────────────────────────────────
export {
  ALL_NODE_LABEL_DISPOSITIONS,
  ALL_NODE_LABEL_KINDS,
  ALL_NODE_LABEL_SOURCES,
  ALL_NODE_LABEL_SURFACES,
  type MachineObservationSource,
  type NodeLabelDisposition,
  type NodeLabelKind,
  type NodeLabelMark,
  type NodeLabelSource,
  type NodeLabelSurface,
  type UserAllegationSource,
} from './nodeLabelTypes';

// ── Pure-TS exports — Machine Observation registry ──────────────
export {
  ALL_MACHINE_OBSERVATION_KEYS,
  ALL_MACHINE_OBSERVATION_RAW_KEYS,
  MACHINE_OBSERVATION_BY_RAW_KEY,
  MACHINE_OBSERVATION_REGISTRY,
  getMachineObservationByRawKey,
  isKnownMachineObservationRawKey,
  lookupMachineObservation,
  makeMachineObservationKey,
} from './machineObservationRegistry';

// ── Pure-TS exports — User Allegation registry ──────────────────
export {
  ALL_USER_ALLEGATION_RAW_KEYS,
  USER_ALLEGATION_REGISTRY,
  getUserAllegationByRawKey,
  isKnownUserAllegationRawKey,
} from './userAllegationRegistry';

// ── Pure-TS exports — source adapters ───────────────────────────
export {
  adaptAllSourcesForNode,
  adaptAutoMetadataSource,
  adaptCompositionMutationSource,
  adaptLifecycleSource,
  adaptManualTagSource,
  adaptRawClassifierBinarySource,
  adaptSemanticRefereeSourceComposer,
  adaptSemanticRefereeSourceNodeMount,
  type AutoMetadataAdapterInput,
  type CompositionMutationAdapterInput,
  type LifecycleAdapterInput,
  type ManualTagAdapterInput,
  type PerNodeMarkInput,
  type RawClassifierBinaryAdapterInput,
  type SemanticRefereeComposerAdapterInput,
  type SemanticRefereeNodeMountAdapterInput,
} from './nodeLabelSourceAdapters';

// ── Pure-TS exports — priority model ────────────────────────────
export {
  PRIORITY_BY_SOURCE,
  comparePriorityThenAlphabetical,
  resolveSourceForDuplicateText,
} from './nodeLabelPriorityModel';

// ── Pure-TS exports — presentation model ────────────────────────
export {
  combinePerNodeMarks,
  dedupePerNodeMarks,
  enforceInspectGroupedView,
  enforceSelectedContextDisplayCap,
  enforceTimelineNodeDisplayCap,
  filterMarksBySurface,
  isDispositionEligible,
  type InspectGroupedView,
  type SelectedContextDisplayResult,
  type TimelineDisplayResult,
} from './nodeLabelPresentationModel';

// ── Pure-TS exports — descriptor adapter ────────────────────────
export {
  toAnnotationChipDescriptor,
  toAnnotationChipDescriptors,
} from './nodeLabelDescriptorAdapter';

// ── RN component exports ────────────────────────────────────────
export {
  NodeLabelStrip,
  computeNodeLabelStripDescriptors,
  type NodeLabelStripProps,
} from './NodeLabelStrip';
export {
  NodeLabelInspectGroups,
  computeNodeLabelInspectGroups,
  type NodeLabelInspectGroupsProps,
} from './NodeLabelInspectGroups';
