/**
 * UX-MEDIATOR-001 — Mediator board state (pure-TS projection) public surface.
 *
 * A read-only projection that turns the point-lifecycle map + evidence-debt
 * list + persisted machine observations into a JSON-serializable
 * `MediatorBoardState`. Never a submission gate, never a truth oracle. See
 * `mediatorBoardTypes.ts` for the full doctrine.
 */
export * from './mediatorBoardTypes';
export {
  MEDIATOR_STATE_COPY,
  MEDIATOR_STATE_HELPER,
  PATHWAY_STEP_COPY,
  plainLanguageForMediatorState,
  helperForMediatorState,
  plainLanguageForPathwayStep,
  _forbiddenMediatorTokens,
} from './mediatorPlainLanguage';
export {
  deriveMediatorBoardState,
  deriveOpenDisagreementPoints,
  deriveEvidenceDebt,
  deriveImpasseMarkers,
  deriveResolutionPathways,
  v4DisplayStateFor,
} from './deriveMediatorBoardState';
export {
  buildDisagreementDistribution,
  totalDistributionCount,
  type DisagreementDistributionSegment,
} from './mediatorDistribution';
