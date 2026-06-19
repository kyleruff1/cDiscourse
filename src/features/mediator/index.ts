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
  // UX-IMPASSE-001 (#689) — dignified impasse-family copy + dormant subtype
  // constants (the latter intentionally unwired → UX-IMPASSE-002 #710).
  IMPASSE_SUBTYPE_COPY,
  VALUE_TRADEOFF_DISPLAY_COPY,
  KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY,
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
// UX-NEXT-MOVE-001 — "What would move this forward?" next-move guidance
// (display-only; pure derivation over the already-derived display state).
export {
  nextMovesForState,
  _forbiddenNextMoveTokens,
  type NextMove,
} from './nextMovesForState';
export {
  MediatorNextMovesCard,
  type MediatorNextMovesCardProps,
} from './MediatorNextMovesCard';
