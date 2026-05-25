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
