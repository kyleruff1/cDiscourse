/**
 * REF-002 — shared test fixtures for the Open Issue model.
 *
 * NOT a test file (no `.test.` suffix) — pure factory helpers imported by
 * the openIssueModel.* suites. Every factory returns a fully-typed,
 * complete object so the suites can override just the load-bearing fields.
 */

import type { ConstitutionRule, ArgumentType } from '../../src/domain/constitution/types';
import { RULE_CODES } from '../../src/domain/constitution/types';
import type {
  PointLifecycleState,
  PointLifecycleClusterSummary,
} from '../../src/features/lifecycle';
import type { SuggestionDerivationInput } from '../../src/features/arguments/suggestedMovesModel';
import type { EvidenceDebt } from '../../src/features/evidence/evidenceDebtModel';
import type { NodeLabelMark } from '../../src/features/nodeLabels/nodeLabelTypes';
import type { RefereeBanner, BannerSelectionResult } from '../../src/features/refereeBanners/types';
import type { BuildOpenIssueInput } from '../../src/features/refereeLoop';

const TRANSITION_CODE: Readonly<Record<ArgumentType, string>> = {
  thesis: RULE_CODES.TRANSITION_THESIS,
  claim: RULE_CODES.TRANSITION_CLAIM,
  rebuttal: RULE_CODES.TRANSITION_REBUTTAL,
  counter_rebuttal: RULE_CODES.TRANSITION_COUNTER_REBUTTAL,
  evidence: RULE_CODES.TRANSITION_EVIDENCE,
  clarification_request: RULE_CODES.TRANSITION_CLARIFICATION_REQUEST,
  concession: RULE_CODES.TRANSITION_CONCESSION,
  synthesis: RULE_CODES.TRANSITION_SYNTHESIS,
};

const ALL_ARGUMENT_TYPES: ReadonlyArray<ArgumentType> = [
  'thesis',
  'claim',
  'rebuttal',
  'counter_rebuttal',
  'evidence',
  'clarification_request',
  'concession',
  'synthesis',
];

/**
 * A generous transition rule set: every parent allows every child type, so
 * every typed Act entry survives the engine gate (the suites then narrow
 * via `parentType` / `viewerRole` / per-parent `allowedChildren` overrides).
 */
export function makeRules(
  perParentAllowed: Partial<Record<ArgumentType, ArgumentType[]>> = {},
): ConstitutionRule[] {
  return ALL_ARGUMENT_TYPES.map((parent) => ({
    id: `rule-${parent}`,
    constitutionId: 'constitution-test',
    code: TRANSITION_CODE[parent],
    title: `Transition from ${parent}`,
    description: `Allowed children of ${parent}`,
    ruleType: 'transition' as const,
    severity: 'info' as const,
    params: {
      allowedChildren: perParentAllowed[parent] ?? [...ALL_ARGUMENT_TYPES],
    },
    enabled: true,
  }));
}

export function makeClusterSummary(
  state: PointLifecycleState,
  overrides: Partial<PointLifecycleClusterSummary> = {},
): PointLifecycleClusterSummary {
  return {
    clusterId: 'cluster-1',
    rootMessageId: 'node-1',
    state,
    plainLabel: 'Open for response',
    messageIds: ['node-1'],
    memberCount: 1,
    affirmativeMoveCount: 1,
    negativeMoveCount: 1,
    observerMoveCount: 0,
    hasOpenSourceOrQuoteRequest: false,
    hasConcessionOrSynthesisMove: false,
    worstEvidenceStatus: 'source_and_quote',
    primaryAxis: null,
    isAdvisory: false,
    ...overrides,
  };
}

export function makeSuggestionInput(
  overrides: Partial<SuggestionDerivationInput> = {},
): SuggestionDerivationInput {
  return {
    clusterSummary: null,
    clusterMetadata: null,
    moveLinkage: null,
    sourceChainStatus: null,
    evidentiaryRisk: null,
    latestMoveType: null,
    activePathDepth: 0,
    isNoRebuttal: false,
    stopReason: null,
    isOnSideBranch: false,
    isTangent: false,
    standingBand: null,
    ...overrides,
  };
}

export function makeDebt(overrides: Partial<EvidenceDebt> = {}): EvidenceDebt {
  return {
    id: 'node-1:debt',
    debateId: 'room-1',
    nodeId: 'node-1',
    requestArgumentId: 'req-1',
    debtKind: 'source',
    requestedByUserId: 'user-1',
    requestedAt: '2026-06-12T00:00:00.000Z',
    status: 'requested',
    ageDays: 0,
    isStale: false,
    ...overrides,
  };
}

export function makeMark(overrides: Partial<NodeLabelMark> = {}): NodeLabelMark {
  return {
    id: 'machine_observation:ai_classifier:disputes_definition:node-1',
    rawKey: 'disputes_definition',
    kind: 'machine_observation',
    source: 'ai_classifier',
    label: 'Definition disputed',
    shortLabel: 'Definition',
    description: 'The move disputes the definition of a term.',
    defaultSurface: 'selected_context',
    disposition: 'rendered_now',
    priority: 20,
    visibleByDefault: true,
    ...overrides,
  };
}

export function makeBanner(overrides: Partial<RefereeBanner> = {}): RefereeBanner {
  return {
    bannerCode: 'source_chain_gap',
    category: 'source_chain_gap',
    tone: 'routing_hint',
    headline: 'This move asks for a source.',
    toneGlyph: 'arrow',
    accessibilityLabel: 'Routing hint. This move asks for a source.',
    minConfidence: 'low',
    softenedSiblingCode: null,
    ...overrides,
  };
}

export function makeBannerSelection(
  banner: RefereeBanner | null,
): BannerSelectionResult {
  return { banner, selectionTrace: 'test' };
}

export function makeInput(overrides: Partial<BuildOpenIssueInput> = {}): BuildOpenIssueInput {
  return {
    roomId: 'room-1',
    targetNodeId: 'node-1',
    selectedActEntryId: null,
    selectedChannel: null,
    storedArgumentType: null,
    sameSideAsParent: false,
    carriesSupportEvidence: false,
    parentType: 'claim',
    viewerRole: 'participant_other',
    rules: makeRules(),
    lifecycleState: null,
    lifecycleAxis: null,
    openEvidenceDebts: [],
    sourceChainStatus: null,
    manualTags: [],
    autoMetadata: [],
    activeDisagreementKind: null,
    machineObservations: [],
    bannerSelection: null,
    categoryReadings: [],
    userAllegations: [],
    targetExcerpt: null,
    quoteAnchor: null,
    suggestionInput: makeSuggestionInput(),
    ...overrides,
  };
}
