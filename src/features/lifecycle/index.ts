/**
 * LIFE-001 — Point lifecycle model barrel.
 *
 * Public re-exports. Single import surface for consumers.
 *
 * Pure TS. No React, no Supabase, no network. SC-004 / ST-002 / GAME-001
 * / RULE-003 / GAL-002 / AN-003 / META-001 consume this surface.
 */

export type {
  PointLifecycleState,
  PointLifecycleSnapshot,
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleAxis,
  LifecycleAdvisoryConfig,
  DerivePointLifecycleSnapshotInput,
  DeriveClusterSummaryInput,
  BuildPointLifecycleMapInput,
} from './pointLifecycleModel';

export {
  ALL_POINT_LIFECYCLE_STATES,
  ALL_POINT_LIFECYCLE_AXES,
  LIFECYCLE_PRIORITY,
  DEFAULT_LIFECYCLE_ADVISORY_CONFIG,
  derivePointLifecycleSnapshot,
  deriveClusterLifecycleSummary,
  buildPointLifecycleMap,
  getPointLifecyclePlainLabel,
  _forbiddenLifecycleTokens,
} from './pointLifecycleModel';

// Internal helpers (re-exported for unit tests + advanced consumers).
export {
  groupNodesByCluster,
  findSameAxisAncestor,
  buildSideTurnSequence,
  deriveAxis,
  nodeHasQualifierCode,
} from './pointLifecycleClusters';

export {
  countSameAxisPressure,
  hasAdditiveAxisInformation,
  turnsSinceSideEngagedCluster,
  countOffAxisPressure,
} from './pointLifecycleAdvisoryInputs';

// GAME-001 — sibling exhaustion / timeout advisory deriver.
export type {
  ExhaustionTimeoutAdvisoryState,
  ExhaustionTimeoutInput,
  ExhaustionTimeoutConfig,
  ExhaustionTimeoutAdvisory,
  BuildExhaustionTimeoutInputFromLifecycleInput,
} from './exhaustionTimeoutModel';

export {
  ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES,
  DEFAULT_EXHAUSTION_TIMEOUT_CONFIG,
  deriveExhaustionTimeoutAdvisory,
  buildExhaustionTimeoutInputFromLifecycle,
  _forbiddenExhaustionTimeoutTokens,
} from './exhaustionTimeoutModel';
