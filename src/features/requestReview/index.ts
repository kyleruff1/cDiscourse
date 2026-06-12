/**
 * REF-005 — Request review / Mark concern. Barrel export.
 *
 * Exposes the pure model (types, vocabularies, validation, routing,
 * visibility derivation, copy maps) and the composer component + its copy.
 * No `NodeLabelMark` is re-exported here — the wall (§7) keeps the
 * moderation concern object separate from machine Observations and gameplay
 * Allegations.
 */
export type {
  ReviewConcernType,
  ReviewRequestedRemedy,
  StructuredConcernDraft,
  ConcernVisibility,
  ConcernRemedyRouting,
} from './requestReviewModel';
export {
  ALL_REVIEW_CONCERN_TYPES,
  ALL_REVIEW_REQUESTED_REMEDIES,
  PERSON_DIRECTED_CONCERN_TYPES,
  CONCERN_TYPE_LABELS,
  CONCERN_TYPE_DESCRIPTIONS,
  REMEDY_LABELS,
  canSubmitConcern,
  routeRemedy,
  deriveConcernVisibility,
  buildSubmittableConcern,
} from './requestReviewModel';
export { RequestReviewComposer, REQUEST_REVIEW_COMPOSER_COPY } from './RequestReviewComposer';
export type { RequestReviewComposerProps } from './RequestReviewComposer';
