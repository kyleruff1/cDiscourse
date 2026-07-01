/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2) — CardDetailPanel hub-zone rendering.
 *
 * Covers (asks i / ii / iii / v + doctrine):
 *   - the italic parent-quote zone renders + degrades to a neutral placeholder
 *   - the Standing / Tone / Heat strip renders plain-language (no raw tokens)
 *   - the all-families family-grouped classifier renders with PIPS + a NEUTRAL
 *     heading ("Classifier observations", never "Add Classifier")
 *   - the full-tags block renders doctrine-grouped labels
 *   - all new zones are visible BY DEFAULT (no expand / no disclosure) and
 *     every new element is display-only (no button role)
 *
 * Slice 2 renders the zones display-only + visible by default; the responsive
 * multi-column LAYOUT polish + the formal #14 disclosure-regression test are
 * Slice 3.
 *
 * Uses @testing-library/react-native.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CardDetailPanel } from '../src/features/arguments/cardView/CardDetailPanel';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import { buildSectionSemanticFlags } from '../src/features/arguments/detail/argumentDetailModel';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import type { CardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type {
  ClusterMetadataSummary,
  ManualTagCode,
  AutoMetadataCode,
  MoveLinkageRecord,
  MoveMetadataLedger,
} from '../src/features/metadata';
import type { PointLifecycleState } from '../src/features/lifecycle';

const ACTIVE = 'msg-active';
const CLUSTER = 'cluster-1';

function persistedRow(over: Partial<MachineObservationResultRow> = {}): MachineObservationResultRow {
  return {
    id: 'res-1',
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: ACTIVE,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal', // Family A — passes the A–G gate
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-05-26T00:00:00.000Z',
    ...over,
  };
}

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: ACTIVE,
    parentId: 'msg-parent',
    ordinal: 4,
    createdAt: '2026-05-26T12:00:00.000Z',
    createdAtLabel: '2026-05-26 12:00',
    relativeLabel: '2h ago',
    actorLabel: 'Other side',
    kindLabel: 'rebuttal',
    sideLabel: 'Neg',
    bodyPreview: 'rebuttal body preview',
    badges: [],
    droppedTags: [],
    depth: 1,
    lane: 1,
    siblingIndex: 0,
    replyCount: 0,
    descendantCount: 0,
    branchId: 'branch-1',
    branchRootMessageId: CLUSTER,
    junctionGroupId: null,
    isJunction: false,
    junctionChildCount: 0,
    isActive: true,
    isLatest: true,
    isDetached: false,
    isActivePath: true,
    isRoot: false,
    isFirstRebuttal: false,
    standingBand: 'pretty_right' as TimelineStandingBand,
    toneBand: 'heated' as TimelineToneBand,
    temperatureBand: 'hot' as TimelineTemperatureBand,
    kindColor: '#f97316',
    kindColorFamily: 'challenge' as TimelineKindColorFamily,
    x: 0,
    y: 0,
    accessibilityLabel: 'rebuttal',
    ...over,
  };
}

function fakeViewModel(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  return {
    messageId: ACTIVE,
    ordinal: 4,
    createdAtLabel: '2026-05-26 12:00',
    relativeLabel: '2h ago',
    body: 'Bike lanes do not improve safety in every district.',
    kindLabel: 'rebuttal',
    actor: 'other',
    sideLabel: 'Neg',
    isLatest: true,
    isActive: true,
    parentHint: null,
    qualifierBadges: ['Scope challenge'],
    pointStandingHint: 'Needs work',
    allowedControls: [],
    deletionRequested: false,
    ...over,
  };
}

function semanticSection() {
  const meta: ClusterMetadataSummary = {
    clusterId: CLUSTER,
    manualTagCodes: ['needs_source'] as ManualTagCode[],
    autoMetadataCodes: ['has_evidence'] as AutoMetadataCode[],
    lifecycleState: 'open' as PointLifecycleState,
    lastManualTagAt: null,
    taggingParticipantCount: 0,
  };
  const move: MoveLinkageRecord = {
    messageId: CLUSTER,
    parentMessageId: null,
    rootPointId: CLUSTER,
    pointClusterId: CLUSTER,
    branchId: 'branch-1',
    targetExcerpt: null,
    disagreementAxis: null,
    semanticFlags: [],
    userAppliedTags: [],
    autoDerivedMetadata: [],
    lifecycleEventsCausedByMove: [],
  };
  const ledger: MoveMetadataLedger = {
    byMessage: new Map([[CLUSTER, move]]),
    byCluster: new Map([[CLUSTER, meta]]),
    metadataEvents: [],
    messageOrder: [CLUSTER],
    inputHash: 'hub-panel-test',
  };
  return buildSectionSemanticFlags(ledger, CLUSTER, 'No lifecycle decision yet.', 'stack');
}

function hubModel(over: { parentBodyPreview?: string | null } = {}): CardDetailViewModel {
  return buildCardDetailViewModel({
    activeMessageId: ACTIVE,
    chronologicalIds: ['msg-parent', ACTIVE],
    ordinalOf: (id) => (id === ACTIVE ? 4 : 3),
    kindLabelOf: (id) => (id === ACTIVE ? 'rebuttal' : 'claim'),
    parentIdOf: (id) => (id === ACTIVE ? 'msg-parent' : null),
    categoryLabel: 'Rebuttal',
    qualifierLabels: ['Scope challenge'],
    persistedClassifierRows: [persistedRow()],
    manualTagEntries: [],
    autoMetadataCodes: ['has_evidence'],
    clusterState: 'rebutted',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: null,
    standingHint: 'Needs work',
    lifecycleState: 'sourced',
    flagLabels: ['Scope challenge'],
    parentBodyPreview:
      'parentBodyPreview' in over ? over.parentBodyPreview : 'We should narrow the scope.',
    standingToneHeatNode: fakeNode(),
    standingToneHeatViewModel: fakeViewModel(),
    structuralTagLabels: ['Side branch'],
    semanticFlagsSection: semanticSection(),
  });
}

function roleOf(node: { props: { accessibilityRole?: string } }): string | undefined {
  return node.props.accessibilityRole;
}

describe('CVDH-001 Slice 2 — hub zones render visible by default', () => {
  it('renders the parent-comparison bubble (default) + S/T/H strip, hub classifier, and full-tags zones (in the expansion)', () => {
    // CVDH-001 Slice 3 — the inline parent-quote zone is upgraded into the
    // off-center colored comparison bubble; assert the bubble, not the zone.
    // VISUAL-SIMPLIFY-001 — the parent bubble stays in the collapsed default;
    // the S/T/H strip + classifier + full-tags zones move behind the toggle.
    const { getByTestId } = render(<CardDetailPanel model={hubModel()} />);
    expect(getByTestId('card-detail-parent-bubble')).toBeTruthy();
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    expect(getByTestId('card-detail-sth-zone')).toBeTruthy();
    expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
    expect(getByTestId('card-detail-full-tags-zone')).toBeTruthy();
  });

  it('ask i — the parent text renders as an italic display-only quote inside the comparison bubble', () => {
    // CVDH-001 Slice 3 — the quote now lives inside the comparison bubble,
    // wrapped in quote marks + italic. Display-only (the only button in the
    // bubble is the reference).
    const { getByTestId } = render(<CardDetailPanel model={hubModel()} />);
    const quote = getByTestId('card-detail-parent-bubble-quote');
    expect(quote.props.children).toBe('“We should narrow the scope.”');
    expect(roleOf(quote)).toBe('text');
    expect(roleOf(quote)).not.toBe('button');
    expect(quote.props.style).toEqual(
      expect.objectContaining({ fontStyle: 'italic' }),
    );
  });

  it('ask i — degrades to NO comparison bubble when the parent is unresolvable', () => {
    // CVDH-001 Slice 3 — root / unresolvable parent → no bubble at all (the
    // absence is the signal; never a "hidden because…" reason).
    const { queryByTestId } = render(
      <CardDetailPanel model={hubModel({ parentBodyPreview: null })} />,
    );
    expect(queryByTestId('card-detail-parent-bubble')).toBeNull();
    expect(queryByTestId('card-detail-parent-bubble-quote')).toBeNull();
    expect(queryByTestId('card-detail-parent-bubble-reference')).toBeNull();
  });

  it('ask v — the S/T/H strip renders plain-language band labels (no raw tokens)', () => {
    const { getByText, queryByText, getByTestId } = render(<CardDetailPanel model={hubModel()} />);
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    // Plain-language band lines render.
    expect(getByText('Standing: Well supported')).toBeTruthy();
    expect(getByText('Tone: Heated')).toBeTruthy();
    expect(getByText('Heat: Hot')).toBeTruthy();
    // No raw snake_case band token leaks.
    expect(queryByText(/pretty_right/)).toBeNull();
    expect(queryByText('Tone: heated')).toBeNull();
    expect(queryByText('Heat: hot')).toBeNull();
    // The caption frames the strip as a reading of the TEXT.
    expect(getByText('How this message reads')).toBeTruthy();
  });

  it('ask iii — the classifier heading is NEUTRAL (never "Add Classifier")', () => {
    const { getAllByText, queryAllByText, getByTestId } = render(<CardDetailPanel model={hubModel()} />);
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    expect(getAllByText('Classifier observations').length).toBeGreaterThan(0);
    expect(queryAllByText(/Add Classifier/i)).toHaveLength(0);
  });

  it('ask iii — the classifier renders a family-grouped chip with PIPS, display-only', () => {
    const { getByTestId } = render(<CardDetailPanel model={hubModel()} />);
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    // Family A (parent_relation) group renders.
    const groupA = getByTestId('card-detail-classifier-group-parent_relation');
    expect(groupA).toBeTruthy();
    const familyHeading = getByTestId('card-detail-classifier-family-parent_relation');
    expect(roleOf(familyHeading)).toBe('text');
    // The persisted has_rebuttal chip renders display-only (no button).
    const chip = getByTestId(
      'card-detail-classifier-machine_observation:persisted:res-1:msg-active',
    );
    expect(roleOf(chip)).toBe('text');
    expect(roleOf(chip)).not.toBe('button');
    // Confidence is PIPS.
    expect(getByTestId('card-detail-classifier-pips')).toBeTruthy();
  });

  it('ask ii — the full-tags block renders doctrine-grouped labels (display-only)', () => {
    const { getByTestId } = render(<CardDetailPanel model={hubModel()} />);
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    expect(getByTestId('card-detail-tags-group-observations')).toBeTruthy();
    expect(getByTestId('card-detail-tags-group-allegations')).toBeTruthy();
    expect(getByTestId('card-detail-tags-group-structural')).toBeTruthy();
    expect(getByTestId('card-detail-tags-group-status')).toBeTruthy();
    const heading = getByTestId('card-detail-tags-group-heading-observations');
    expect(roleOf(heading)).toBe('text');
  });

  it('every new hub zone is display-only (no button role anywhere in the panel except navigation)', () => {
    const { getByTestId } = render(<CardDetailPanel model={hubModel()} />);
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    // Spot-check the zones carry no onPress / button role. The comparison-bubble
    // ACTOR + QUOTE are display-only; only the bubble REFERENCE is a button
    // (navigation), which is asserted separately in the Slice 3 nav tests.
    for (const id of [
      'card-detail-parent-bubble-actor',
      'card-detail-parent-bubble-quote',
      'card-detail-standing-band',
      'card-detail-tone-band',
      'card-detail-heat-band',
      'card-detail-classifier-family-parent_relation',
      'card-detail-tags-group-heading-status',
    ]) {
      const node = getByTestId(id);
      expect(node.props.onPress).toBeUndefined();
      expect(roleOf(node)).not.toBe('button');
    }
  });
});

describe('CVDH-001 Slice 2 — Family I renders on the hub panel; J gated (family gate)', () => {
  it('a seeded Family I auto-metadata code (no_response_after_n_turns) NOW renders (PR #562)', () => {
    const model = buildCardDetailViewModel({
      activeMessageId: ACTIVE,
      chronologicalIds: [ACTIVE],
      ordinalOf: () => 1,
      kindLabelOf: () => 'claim',
      parentIdOf: () => null,
      categoryLabel: null,
      qualifierLabels: [],
      persistedClassifierRows: [],
      manualTagEntries: [],
      autoMetadataCodes: ['no_response_after_n_turns'], // Family I, rendered_now
      clusterState: 'open',
      messageContribution: null,
      evidenceSources: [],
      evidenceDebtSummary: null,
      standingHint: null,
      lifecycleState: null,
      flagLabels: [],
      standingToneHeatNode: fakeNode({ parentId: null }),
      standingToneHeatViewModel: fakeViewModel(),
    });
    const { queryByText, queryByTestId, getByTestId } = render(<CardDetailPanel model={model} />);
    fireEvent.press(getByTestId('card-detail-more-toggle'));
    // OPS-FROZEN-SET-RESCOPE {H,I,J} → {J}: Family I (thread_topology) is now
    // production-enabled, so the mark renders — the zone is no longer empty.
    expect(queryByTestId('card-detail-classifier-empty')).toBeNull();
    expect(queryByTestId('card-detail-classifier-group-thread_topology')).not.toBeNull();
    expect(queryByText('No follow-up')).not.toBeNull();
  });
});
