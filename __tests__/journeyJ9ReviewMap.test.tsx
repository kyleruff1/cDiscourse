/**
 * QA-001 (#692) — J9 spine: review the argument map after several turns.
 *
 * The ordered-handoff spine for J9. It composes the REAL room models in
 * user-visible order and asserts the two things no single unit suite asserts:
 *   (a) the ordered handoff — the state-rail open_points chip carries the map
 *       deep-link, and its count is derived from the SAME board that drives the
 *       node markers; and
 *   (b) the cross-model identity — ONE frozen MediatorBoardState (the single
 *       derivation) flows to BOTH the rail count and the per-node markers, and
 *       the tapped node's id is exactly the answer-this scope target.
 *
 * It also pins the doctrine anchors: a plain open node yields NO marker
 * (one-state-per-node, no chip-soup), while a node that needs evidence yields
 * exactly one.
 *
 * No derivation logic or unit branch coverage is re-implemented here. Unit owners:
 *   - argumentStateRailModel.test.ts   (rail chip branches)
 *   - mapNodeActionSurfaceModel.test.ts (action surface copy + rows)
 *   - roomMediatorAdapter.test.ts       (adapter delegates to the single deriver)
 *   - nodeMediatorMarkers.test.ts       (marker selection / suppression)
 *   - roomCapabilityParityMatrix.test.ts, uxMediator002NodeMarkup.test.tsx,
 *     DisagreementPointsRail.test.tsx   (parity + node markup + rail render)
 *
 * Pure model; no RNTL render (the .tsx extension matches the manifest).
 */
import { deriveArgumentStateRail } from '../src/features/arguments/room/argumentStateRailModel';
import { deriveRoomMediatorBoardState } from '../src/features/mediator/roomMediatorAdapter';
import { getNodeMediatorMarker } from '../src/features/mediator/nodeMediatorMarkers';
import { buildMapNodeActionSurface } from '../src/features/arguments/room/mapNodeActionSurfaceModel';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
} from '../src/features/lifecycle/pointLifecycleModel';
import type { EvidenceDebt } from '../src/features/evidence/evidenceDebtModel';
import type { MediatorBoardState } from '../src/features/mediator';

// ── Fixture builders (mirror roomMediatorAdapter.test.ts; inert defaults) ──

function makeTimelineNode(
  p: Partial<ArgumentTimelineMapNode> & { messageId: string },
): ArgumentTimelineMapNode {
  return {
    messageId: p.messageId,
    parentId: p.parentId ?? null,
    ordinal: p.ordinal ?? 0,
    createdAt: p.createdAt ?? '2026-07-11T00:00:00.000Z',
    createdAtLabel: p.createdAtLabel ?? '',
    relativeLabel: p.relativeLabel ?? '',
    actorLabel: p.actorLabel ?? 'Aff',
    kindLabel: p.kindLabel ?? 'Claim',
    sideLabel: p.sideLabel ?? 'Aff',
    bodyPreview: p.bodyPreview ?? '',
    badges: p.badges ?? [],
    droppedTags: p.droppedTags ?? [],
    depth: p.depth ?? 0,
    lane: p.lane ?? 0,
    siblingIndex: p.siblingIndex ?? 0,
    replyCount: p.replyCount ?? 0,
    descendantCount: p.descendantCount ?? 0,
    branchId: p.branchId ?? p.messageId,
    branchRootMessageId: p.branchRootMessageId ?? p.messageId,
    junctionGroupId: p.junctionGroupId ?? null,
    isJunction: p.isJunction ?? false,
    junctionChildCount: p.junctionChildCount ?? 0,
    isActive: p.isActive ?? false,
    isLatest: p.isLatest ?? false,
    isDetached: p.isDetached ?? false,
    isActivePath: p.isActivePath ?? false,
    isRoot: p.isRoot ?? p.parentId == null,
    isFirstRebuttal: p.isFirstRebuttal ?? false,
    standingBand: p.standingBand ?? 'pretty_wrong',
    toneBand: p.toneBand ?? 'calm',
    temperatureBand: p.temperatureBand ?? 'cool',
    kindColor: p.kindColor ?? '#000000',
    kindColorFamily: p.kindColorFamily ?? 'claim',
    x: p.x ?? 0,
    y: p.y ?? 0,
    accessibilityLabel: p.accessibilityLabel ?? '',
  };
}

function makeTimelineMap(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapModel {
  return {
    nodes,
    edges: [],
    bands: [],
    activeNode: null,
    latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: [],
    width: 0,
    height: 0,
    scrollWidth: 0,
    beginningLabel: '',
    middleLabel: '',
    endLabel: '',
    participantTrends: [],
    legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false,
    rootOnboardingHint: null,
    showBackToRootControl: false,
  };
}

function makeCluster(
  p: Partial<PointLifecycleClusterSummary> & { clusterId: string },
): PointLifecycleClusterSummary {
  const messageIds = p.messageIds ?? [p.clusterId];
  return {
    clusterId: p.clusterId,
    rootMessageId: p.rootMessageId ?? p.clusterId,
    state: p.state ?? 'open',
    plainLabel: p.plainLabel ?? 'Open for response',
    messageIds,
    memberCount: p.memberCount ?? messageIds.length,
    affirmativeMoveCount: 0,
    negativeMoveCount: 0,
    observerMoveCount: 0,
    hasOpenSourceOrQuoteRequest: p.hasOpenSourceOrQuoteRequest ?? false,
    hasConcessionOrSynthesisMove: p.hasConcessionOrSynthesisMove ?? false,
    worstEvidenceStatus: p.worstEvidenceStatus ?? 'no_source',
    primaryAxis: p.primaryAxis ?? null,
    isAdvisory: p.isAdvisory ?? false,
  };
}

function makeLifecycle(clusters: PointLifecycleClusterSummary[]): PointLifecycleMap {
  const byCluster = new Map<string, PointLifecycleClusterSummary>();
  for (const c of clusters) byCluster.set(c.clusterId, c);
  return {
    byCluster,
    byMessage: new Map(),
    clusterOrder: clusters.map((c) => c.clusterId),
    cumulativeStateSequence: clusters.map((c) => c.state),
    inputHash: 'lc-hash-j9',
  };
}

function makeDebt(p: Partial<EvidenceDebt> & { id: string; nodeId: string }): EvidenceDebt {
  return {
    id: p.id,
    debateId: p.debateId ?? 'debate-1',
    nodeId: p.nodeId,
    requestArgumentId: p.requestArgumentId ?? p.id,
    debtKind: p.debtKind ?? 'source',
    requestedByUserId: p.requestedByUserId ?? 'user-1',
    requestedAt: p.requestedAt ?? '2026-07-11T00:00:00.000Z',
    status: p.status ?? 'requested',
    ageDays: p.ageDays ?? 0,
    isStale: p.isStale ?? false,
  };
}

/**
 * A room after several turns: node A (root) has an open source debt → an open
 * point that "needs evidence"; node B is a plain open child point. The single
 * board derivation is the ONE object the whole J9 surface reads.
 */
function deriveRoomBoard(): MediatorBoardState {
  return deriveRoomMediatorBoardState({
    debateId: 'debate-1',
    timelineMap: makeTimelineMap([
      makeTimelineNode({ messageId: 'A', ordinal: 1, isRoot: true }),
      // B opens its OWN disagreement point (its own branch root), so it stays a
      // plain open node rather than folding into A's needs-evidence point.
      makeTimelineNode({ messageId: 'B', ordinal: 2, parentId: 'A', branchRootMessageId: 'B' }),
    ]),
    lifecycle: makeLifecycle([
      makeCluster({ clusterId: 'A', state: 'answered' }),
      makeCluster({ clusterId: 'B', state: 'open' }),
    ]),
    evidenceDebts: [makeDebt({ id: 'd1', nodeId: 'A', status: 'requested' })],
  });
}

describe('QA-001 J9 — the strip → map → node ordered handoff', () => {
  it('the open_points chip carries the map deep-link, counted from the derived board', () => {
    const board = deriveRoomBoard();
    // The count the rail shows is derived from the SAME board's points.
    const openPointCount = board.points.length;
    expect(openPointCount).toBeGreaterThan(0);

    const rail = deriveArgumentStateRail({
      viewerRole: 'participant',
      participantSide: 'affirmative',
      turnLabel: "Other voice's move",
      visibility: 'public',
      opponentSeatIsOpen: false,
      openPointCount,
      receiptsOwedCount: 0,
    });
    const openPointsChip = rail.chips.find((c) => c.id === 'open_points');
    expect(openPointsChip).toBeDefined();
    expect(openPointsChip?.isVisible).toBe(true);
    expect(openPointsChip?.deepLink).toBe('map'); // tapping the chip opens Map mode
  });

  it('the same frozen board drives the node markers (single derivation, reused)', () => {
    const board = deriveRoomBoard();
    expect(Object.isFrozen(board)).toBe(true);

    // Node A needs evidence → exactly one marker; the SAME board object is read.
    const markerA = getNodeMediatorMarker(board, 'A');
    expect(markerA).not.toBeNull();
    expect(markerA?.code).toBe('needs_evidence');
    expect(markerA?.label).toBe('Needs evidence');

    // Node B is a plain open node → NO marker (one state per node, no chip-soup).
    const markerB = getNodeMediatorMarker(board, 'B');
    expect(markerB).toBeNull();
  });

  it('tapping a node opens an action surface scoped to that node id', () => {
    const board = deriveRoomBoard();
    const tappedNodeId = 'A';
    const isOpenPointMember = board.points.some((p) => p.memberNodeIds.includes(tappedNodeId));

    const surface = buildMapNodeActionSurface({
      activeMessageId: tappedNodeId,
      viewerRole: 'participant',
      actor: 'other',
      participantControls: [],
      observerActions: [],
      actingOnShortLabel: 'Message A',
      isOpenPointMember,
    });

    // Answer-this is scoped to the tapped node — the jump-back target is its id.
    expect(surface.messageId).toBe(tappedNodeId);
    expect(surface.answerThisLabel).toBe('Answer this ↗');
    expect(surface.sidecarLinks.map((l) => l.key)).toEqual(['answer_this', 'open_debts']);
    // The node belongs to an open point, so the membership line shows.
    expect(surface.openPointMembershipLine).toBe('Part of an open point');
  });
});

describe('QA-001 J9 — doctrine anchors', () => {
  it('is deterministic (the single derivation is pure)', () => {
    expect(JSON.stringify(deriveRoomBoard())).toBe(JSON.stringify(deriveRoomBoard()));
  });

  it('an empty room shows no open-points chip (no phantom map entry)', () => {
    const emptyBoard = deriveRoomMediatorBoardState({
      debateId: 'debate-1',
      timelineMap: makeTimelineMap([]),
      lifecycle: makeLifecycle([]),
      evidenceDebts: [],
    });
    const rail = deriveArgumentStateRail({
      viewerRole: 'participant',
      participantSide: 'affirmative',
      turnLabel: 'Your move',
      visibility: 'public',
      opponentSeatIsOpen: false,
      openPointCount: emptyBoard.points.length,
      receiptsOwedCount: 0,
    });
    const openPointsChip = rail.chips.find((c) => c.id === 'open_points');
    // With zero points the chip is suppressed — no deep-link to an empty map.
    expect(openPointsChip?.isVisible ?? false).toBe(false);
  });
});
