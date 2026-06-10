/**
 * CARD-VIEW-REFINE-001 — inline ActionsZone + denser per-node feedback
 * rendering tests (CardDetailPanel) + containment / nav source-scan.
 *
 * Covers the operator's four asks at the component level:
 *   (3) ActionsZone — renders on the active card with the getRailActions-derived
 *       set; actions are real Pressables that dispatch via onRailAction;
 *       classifier / category / tag chips stay NON-interactive; actor-aware
 *       (observer vs participant-other vs own-bubble); a11y (44×44 + hint).
 *   (4) Denser feedback — the source-provenance badge renders; family chip
 *       strips render horizontally (wrap); H/I/J never appear; pips not digits;
 *       ban-list / no-snake_case.
 *   (1) Containment + (2) nav — see cardViewRefineContainmentNav.test.ts
 *       (source-scan of the Stack + Surface wiring).
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CardDetailPanel } from '../src/features/arguments/cardView/CardDetailPanel';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
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

const ACTIVE = 'msg-active';

const BANNED = [
  'winner', 'loser', 'correct', 'incorrect', 'true', 'false',
  'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist',
  'propagandist', 'stupid', 'idiot',
];

function persistedRow(over: Partial<MachineObservationResultRow> = {}): MachineObservationResultRow {
  return {
    id: 'res-1',
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: ACTIVE,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal', // Family A (parent_relation), source auto_metadata
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: 'M has a child typed challenge.',
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
    branchRootMessageId: 'cluster-1',
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

function model(over: { evidenceSpan?: string | null } = {}): CardDetailViewModel {
  return buildCardDetailViewModel({
    activeMessageId: ACTIVE,
    chronologicalIds: ['msg-parent', ACTIVE],
    ordinalOf: (id) => (id === ACTIVE ? 4 : 3),
    kindLabelOf: (id) => (id === ACTIVE ? 'rebuttal' : 'claim'),
    parentIdOf: (id) => (id === ACTIVE ? 'msg-parent' : null),
    categoryLabel: 'Rebuttal',
    qualifierLabels: ['Scope challenge'],
    persistedClassifierRows: [
      persistedRow({ evidenceSpan: 'evidenceSpan' in over ? over.evidenceSpan ?? null : 'M has a child typed challenge.' }),
    ],
    manualTagEntries: [],
    autoMetadataCodes: [],
    clusterState: 'rebutted',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: 'Receipts owed: a source for this claim.',
    standingHint: 'Needs work',
    lifecycleState: 'sourced',
    flagLabels: ['Scope challenge'],
    parentBodyPreview: 'We should narrow the scope.',
    standingToneHeatNode: fakeNode(),
    standingToneHeatViewModel: fakeViewModel(),
  });
}

function roleOf(node: { props: { accessibilityRole?: string } }): string | undefined {
  return node.props.accessibilityRole;
}

/** Recursively collect every visible text string in a rendered RN node tree.
 *  Avoids JSON.stringify (the RN test tree has circular FiberNode refs). */
function collectText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  const n = node as { props?: { children?: unknown } };
  if (n.props && 'children' in n.props) return collectText(n.props.children);
  return '';
}

// ── (3) ActionsZone ─────────────────────────────────────────────────────

describe('CARD-VIEW-REFINE-001 — inline ActionsZone (USER MOVES, real buttons)', () => {
  it('renders nothing when viewerRole / onRailAction are absent (display-only callers)', () => {
    const { queryByTestId } = render(<CardDetailPanel model={model()} />);
    expect(queryByTestId('card-detail-actions-zone')).toBeNull();
  });

  it('OBSERVER — renders the getRailActions observer set as Pressables that dispatch codes', () => {
    const onRailAction = jest.fn();
    const { getByTestId } = render(
      <CardDetailPanel
        model={model()}
        viewerRole="observer"
        bubbleActor="other"
        onRailAction={onRailAction}
      />,
    );
    expect(getByTestId('card-detail-actions-zone')).toBeTruthy();
    // Observer set = watch · join_aff · join_neg · share (getRailActions).
    for (const code of ['watch', 'join_aff', 'join_neg', 'share']) {
      const chip = getByTestId(`card-detail-action-${code}`);
      expect(roleOf(chip)).toBe('button'); // USER MOVES are safe to be buttons
    }
    // Dispatch routes the rail action code (single source of truth).
    fireEvent.press(getByTestId('card-detail-action-join_aff'));
    expect(onRailAction).toHaveBeenCalledTimes(1);
    expect(onRailAction.mock.calls[0][0]).toBe('join_aff');
  });

  it('PARTICIPANT on another bubble — renders reply + disagree as Pressables', () => {
    const onRailAction = jest.fn();
    const { getByTestId } = render(
      <CardDetailPanel
        model={model()}
        viewerRole="participant"
        bubbleActor="other"
        onRailAction={onRailAction}
      />,
    );
    expect(getByTestId('card-detail-actions-zone')).toBeTruthy();
    expect(roleOf(getByTestId('card-detail-action-reply'))).toBe('button');
    expect(roleOf(getByTestId('card-detail-action-disagree'))).toBe('button');
    fireEvent.press(getByTestId('card-detail-action-disagree'));
    expect(onRailAction).toHaveBeenCalledWith('disagree', expect.anything());
  });

  it('OWN bubble (participant + self) — the inline set is empty (deep set stays in Act)', () => {
    const onRailAction = jest.fn();
    const { queryByTestId } = render(
      <CardDetailPanel
        model={model()}
        viewerRole="participant"
        bubbleActor="self"
        onRailAction={onRailAction}
      />,
    );
    // getRailActions(participant, self) === [] → the whole zone renders nothing.
    expect(queryByTestId('card-detail-actions-zone')).toBeNull();
  });

  it('action chips meet the 44×44 a11y bar (hitSlop) + carry a helper hint', () => {
    const { getByTestId } = render(
      <CardDetailPanel
        model={model()}
        viewerRole="observer"
        bubbleActor="other"
        onRailAction={jest.fn()}
      />,
    );
    const chip = getByTestId('card-detail-action-watch');
    // hitSlop present (the chip's visual min-height is 44; hitSlop is belt-and-braces).
    expect(chip.props.hitSlop).toBeTruthy();
    // helper demoted to accessibilityHint (not a second visible line).
    expect(typeof chip.props.accessibilityHint).toBe('string');
    expect((chip.props.accessibilityHint as string).length).toBeGreaterThan(0);
  });

  it('DOCTRINE — the display-only classifier / category / tag chips stay NON-interactive even with the ActionsZone present', () => {
    const { getByTestId } = render(
      <CardDetailPanel
        model={model()}
        viewerRole="observer"
        bubbleActor="other"
        onRailAction={jest.fn()}
      />,
    );
    // The viewer's MOVE set is interactive; the AI/classifier + label chips are NOT.
    const classifier = getByTestId(
      'card-detail-classifier-machine_observation:persisted:res-1:msg-active',
    );
    expect(roleOf(classifier)).toBe('text');
    expect(classifier.props.onPress).toBeUndefined();
    for (const id of ['card-detail-category', 'card-detail-qualifier-0', 'card-detail-lifecycle']) {
      const node = getByTestId(id);
      expect(roleOf(node)).not.toBe('button');
      expect(node.props.onPress).toBeUndefined();
    }
  });

  it('ActionsZone copy is ban-list clean + no snake_case leak', () => {
    const { getByTestId, getByText } = render(
      <CardDetailPanel
        model={model()}
        viewerRole="observer"
        bubbleActor="other"
        onRailAction={jest.fn()}
      />,
    );
    expect(getByText('Actions on this point')).toBeTruthy();
    const flat = collectText(getByTestId('card-detail-actions-zone')).toLowerCase();
    for (const b of BANNED) {
      expect(flat).not.toContain(b);
    }
    // No raw snake_case action code leaked as visible text.
    expect(flat).not.toMatch(/join_aff|join_neg|ask_source|split_branch|request_deletion/);
  });
});

// ── (4) Denser per-node feedback ─────────────────────────────────────────

describe('CARD-VIEW-REFINE-001 — denser per-node feedback (layout, not new eval)', () => {
  it('renders the plain-language source-provenance badge (never the raw code)', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const badge = getByTestId(
      'card-detail-classifier-provenance-machine_observation:persisted:res-1:msg-active',
    );
    expect(badge).toBeTruthy();
    // has_rebuttal → source auto_metadata → "From system metadata".
    const flat = collectText(badge);
    expect(flat).toContain('From system metadata');
    expect(flat).not.toContain('auto_metadata'); // never the raw code
  });

  it('family chip strips render in a HORIZONTAL wrapping strip', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const strip = getByTestId('card-detail-classifier-strip-parent_relation');
    expect(strip).toBeTruthy();
    const style = Array.isArray(strip.props.style)
      ? Object.assign({}, ...strip.props.style.filter(Boolean))
      : strip.props.style;
    expect(style.flexDirection).toBe('row');
    expect(style.flexWrap).toBe('wrap');
  });

  it('confidence is PIPS (3 dot Views), not a digit', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const pips = getByTestId('card-detail-classifier-pips');
    expect(pips.props.children).toHaveLength(3);
    // No numeric text node inside the pips row (pips are Views, not digits).
    expect(collectText(pips).trim()).toBe('');
  });

  it('the evidence span renders inline (≤240 chars carried by the model)', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const evidence = getByTestId(
      'card-detail-classifier-evidence-machine_observation:persisted:res-1:msg-active',
    );
    expect(collectText(evidence)).toContain('M has a child typed challenge.');
  });

  it('Family I NOW surfaces on the card classifier zone (PR #562); Family J never does', () => {
    // OPS-FROZEN-SET-RESCOPE {H,I,J} → {J}: Family I (thread_topology) is now
    // production-enabled, so a seeded Family I rendered_now mark surfaces under
    // its plain-language group. Family J (sensitive_composer) stays gated out.
    const m = buildCardDetailViewModel({
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
    const { queryByTestId } = render(<CardDetailPanel model={m} />);
    // Family I now renders → the zone is no longer empty and the
    // thread_topology group is present.
    expect(queryByTestId('card-detail-classifier-empty')).toBeNull();
    expect(queryByTestId('card-detail-classifier-group-thread_topology')).not.toBeNull();
    // Family J never surfaces on the card classifier zone (still frozen).
    expect(queryByTestId('card-detail-classifier-group-sensitive_composer')).toBeNull();
  });

  it('the classifier zone copy is ban-list clean', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const flat = collectText(getByTestId('card-detail-classifier-zone')).toLowerCase();
    for (const b of BANNED) {
      expect(flat).not.toContain(b);
    }
  });
});
