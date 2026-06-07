/**
 * OPS-MCP-OBSERVABILITY-002 — admin classifier-health pure-TS model barrel.
 *
 * Counts-only aggregation + plain-language mapping + CSV builder + RunTagSource
 * for the admin classifier-health diagnostic panel. NO write path, NO control
 * surface, NO raw-content reader. See the per-module headers for doctrine.
 */
export type {
  ClassifierHealthFailureDetail,
  ClassifierHealthRunRow,
  ClassifierHealthGroupKey,
  ClassifierHealthCountBucket,
  ClassifierHealthTimeWindow,
  ClassifierHealthFilter,
  ProviderErrorClusterVerdict,
  FrozenFamilyTripwireVerdict,
  ClassifierHealthVerdict,
} from './types';

export {
  aggregateClassifierHealth,
  FROZEN_NON_PRODUCTION_FAMILIES,
  PROVIDER_ERROR_CLUSTER_REASONS,
} from './classifierHealthModel';

export {
  classifierHealthPlainLanguage,
  CLASSIFIER_TRANSPORT_CODES,
  CLASSIFIER_TRANSPORT_LABELS,
} from './classifierHealthPlainLanguage';

export { buildClassifierHealthCsv, CLASSIFIER_HEALTH_CSV_HEADER } from './classifierHealthCsv';

export {
  makeRunTagSource,
  runTagMatches,
  type RunTagSource,
  type RunTagSourceKind,
  type RunTagExtractContext,
} from './runTagSource';
