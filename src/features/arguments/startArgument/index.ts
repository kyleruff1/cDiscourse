/**
 * NAV-START-ARGUMENT-001 Slice A — Start Argument public surface.
 */
export { StartArgumentPage } from './StartArgumentPage';
export {
  ARGUMENT_SCHEME_OPTIONS,
  DISAGREEMENT_CAUSE_OPTIONS,
  DISAGREEMENT_STRATEGY_OPTIONS,
  DISAGREEMENT_CLUSTER_LABELS,
  ALL_DISAGREEMENT_CLUSTERS,
  DISAGREEMENT_STRATEGY_LIST_IS_COMPLETE,
  HITODS_TOTAL_STRATEGY_COUNT,
  VERIFIED_DISAGREEMENT_STRATEGY_IDS,
  ALL_START_ARGUMENT_SURFACES,
  isStartArgumentDraftSubmittable,
  groupDisagreementStrategiesByCluster,
} from './startArgumentTaxonomy';
export type {
  StartArgumentSurface,
  StartArgumentDraft,
  ArgumentSchemeId,
  DisagreementCluster,
  DisagreementStrategyId,
  DisagreementStrategyOption,
  DisagreementCauseId,
  TaxonomyOption,
} from './startArgumentTaxonomy';
export {
  START_ARGUMENT_CANONICAL_ROUTE,
  START_ARGUMENT_ALIAS_ROUTES,
  START_ARGUMENT_ALL_ROUTES,
  START_ARGUMENT_ROUTE_TARGET,
  normalizeStartArgumentPath,
  isStartArgumentRoute,
  resolveStartArgumentRoute,
} from './startArgumentRoutes';
export type { StartArgumentRouteTarget } from './startArgumentRoutes';
