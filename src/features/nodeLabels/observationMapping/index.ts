/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — public exports for the
 * observation-mapping evaluator + reviewed existing-boolean registry.
 *
 * Slice A = the pure engine + the reconciled A-G registry only. Card-display
 * wiring (read-time composition after the persistence adapter) is Slice B and
 * is NOT exported/wired here.
 *
 * Pure TS. No React, no Supabase, no network.
 */

export {
  evaluateObservationMapping,
} from './observationMappingEvaluator';
export {
  OBSERVATION_MAPPING_REGISTRY,
  OBSERVATION_MAPPING_ADOPTION_MANIFEST,
} from './observationMappingRegistry';
export {
  DEPLOYED_AG_RAW_KEYS,
  FROZEN_HIJ_FAMILIES,
  PRODUCTION_AG_FAMILIES,
  familyForDeployedRawKey,
  isDeployedAgRawKey,
} from './deployedAgRawKeys';
export type {
  CardSurfaceVisibility,
  ConfidencePipLevel,
  CrossFamilyKey,
  EvaluateObservationMappingOptions,
  ObservationMappingResult,
  ObservationMappingRule,
  ObservationMappingRuleKind,
  ObservationMappingSurface,
  TimelineSurfaceVisibility,
} from './observationMappingTypes';
