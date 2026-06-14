/**
 * UX-MEDIATOR-005 — Room → mediator board adapter tests.
 *
 * Verifies the thin adapter narrows in-room data into MediatorGraphInput and
 * DELEGATES to deriveMediatorBoardState (no duplicated derivation logic) —
 * observations + evidence debts + lifecycle flow through, node fields map 1:1,
 * and output is deterministic.
 */
import { deriveRoomMediatorBoardState } from '../src/features/mediator/roomMediatorAdapter';
import { deriveMediatorBoardState } from '../src/features/mediator';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
} from '../src/features/lifecycle/pointLifecycleModel';
import type { EvidenceDebt } from '../src/features/evidence/evidenceDebtModel';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';

function makeTimelineNode(
  p: Partial<ArgumentTimelineMapNode> & { messageId: string },
): ArgumentTimelineMapNode {
  return {
    messageId: p.messageId,
    parentId: p.parentId ?? null,
    ordinal: p.ordinal ?? 0,
    createdAt: p.createdAt ?? '2009-02-13T23:31:30.000Z',
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
    inputHash: 'lc-hash-1',
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
    requestedAt: p.requestedAt ?? '2009-02-13T23:31:30.000Z',
    status: p.status ?? 'requested',
    ageDays: p.ageDays ?? 0,
    isStale: p.isStale ?? false,
  };
}

function makeObsRow(
  argumentId: string,
  family: string,
  rawKey: string,
): MachineObservationResultRow {
  // The adapter reads argumentId/family/rawKey/confidence; other persisted
  // fields are filled with inert defaults.
  return {
    id: `${argumentId}:${rawKey}`,
    runId: 'run-1',
    debateId: 'debate-1',
    argumentId,
    schemaVersion: '2',
    rawKey,
    family,
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2009-02-13T23:31:30.000Z',
  } as MachineObservationResultRow;
}

describe('UX-MEDIATOR-005 deriveRoomMediatorBoardState', () => {
  it('returns an empty board for an empty room', () => {
    const board = deriveRoomMediatorBoardState({
      debateId: 'debate-1',
      timelineMap: makeTimelineMap([]),
      lifecycle: makeLifecycle([]),
      evidenceDebts: [],
    });
    expect(board.debateId).toBe('debate-1');
    expect(board.points).toEqual([]);
  });

  it('maps timeline nodes (incl. targetExcerpt) and produces one open point', () => {
    const board = deriveRoomMediatorBoardState({
      debateId: 'debate-1',
      timelineMap: makeTimelineMap([makeTimelineNode({ messageId: 'n1', ordinal: 1, isRoot: true })]),
      lifecycle: makeLifecycle([makeCluster({ clusterId: 'n1', state: 'open' })]),
      evidenceDebts: [],
      targetExcerptByMessageId: new Map([['n1', 'the contested phrase']]),
    });
    expect(board.points).toHaveLength(1);
    expect(board.points[0].state).toBe('open');
    expect(board.points[0].anchor.nodeId).toBe('n1');
    expect(board.points[0].anchor.targetExcerpt).toBe('the contested phrase');
  });

  it('flows persisted observations through (disputes_scope → scope_mismatch)', () => {
    const board = deriveRoomMediatorBoardState({
      debateId: 'debate-1',
      timelineMap: makeTimelineMap([
        makeTimelineNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeTimelineNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ]),
      lifecycle: makeLifecycle([makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })]),
      evidenceDebts: [],
      persistedObservationsByArgumentId: {
        n2: [makeObsRow('n2', 'disagreement_axis', 'disputes_scope')],
      },
    });
    expect(board.points[0].state).toBe('scope_mismatch');
    expect(board.scopeMismatches).toHaveLength(1);
  });

  it('flows evidence debts through (open debt → needs_evidence)', () => {
    const board = deriveRoomMediatorBoardState({
      debateId: 'debate-1',
      timelineMap: makeTimelineMap([makeTimelineNode({ messageId: 'n1', ordinal: 1, isRoot: true })]),
      lifecycle: makeLifecycle([makeCluster({ clusterId: 'n1', state: 'answered' })]),
      evidenceDebts: [makeDebt({ id: 'd1', nodeId: 'n1', status: 'requested' })],
    });
    expect(board.points[0].state).toBe('needs_evidence');
    expect(board.points[0].openEvidenceDebtIds).toEqual(['d1']);
  });

  it('delegates to deriveMediatorBoardState (no duplicated logic)', () => {
    const nodes = [makeTimelineNode({ messageId: 'n1', ordinal: 1, isRoot: true })];
    const lifecycle = makeLifecycle([makeCluster({ clusterId: 'n1', state: 'answered' })]);
    const evidenceDebts = [makeDebt({ id: 'd1', nodeId: 'n1', status: 'requested' })];
    const viaAdapter = deriveRoomMediatorBoardState({
      debateId: 'debate-1',
      timelineMap: makeTimelineMap(nodes),
      lifecycle,
      evidenceDebts,
    });
    const viaDirect = deriveMediatorBoardState(
      {
        debateId: 'debate-1',
        nodes: [
          {
            messageId: 'n1',
            parentId: null,
            ordinal: 1,
            branchRootMessageId: 'n1',
            kindLabel: 'Claim',
            sideLabel: 'Aff',
            isRoot: true,
            replyCount: 0,
            descendantCount: 0,
            targetExcerpt: null,
          },
        ],
        lifecycle,
        evidenceDebts,
      },
      [],
      { activeNodeId: null },
    );
    expect(JSON.stringify(viaAdapter)).toBe(JSON.stringify(viaDirect));
  });

  it('is deterministic across repeated runs', () => {
    const build = () =>
      deriveRoomMediatorBoardState({
        debateId: 'debate-1',
        timelineMap: makeTimelineMap([makeTimelineNode({ messageId: 'n1', ordinal: 1, isRoot: true })]),
        lifecycle: makeLifecycle([makeCluster({ clusterId: 'n1', state: 'exhausted' })]),
        evidenceDebts: [],
      });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });
});
