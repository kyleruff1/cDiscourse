/**
 * INTEL-001 (#900) — the mediator weighting pin (T-MW), with a firing negative
 * control.
 *
 * deriveMediatorBoardState with options.weightingSignals absent/empty is
 * byte-identical to the no-options board (incl. inputHash). Present, it re-orders
 * `nextAction` toward a pressured point among equal-lifecycle-priority points; it
 * changes NO point.state / plainLabel / field.
 */
import { deriveMediatorBoardState } from '../src/features/mediator/deriveMediatorBoardState';
import type {
  MediatorGraphInput,
  MediatorGraphNode,
} from '../src/features/mediator/mediatorBoardTypes';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
} from '../src/features/lifecycle/pointLifecycleModel';

function makeNode(p: Partial<MediatorGraphNode> & { messageId: string }): MediatorGraphNode {
  return {
    messageId: p.messageId,
    parentId: p.parentId ?? null,
    ordinal: p.ordinal ?? 0,
    branchRootMessageId: p.branchRootMessageId ?? p.messageId,
    kindLabel: p.kindLabel ?? 'Claim',
    sideLabel: p.sideLabel ?? 'Aff',
    isRoot: p.isRoot ?? p.parentId == null,
    replyCount: p.replyCount ?? 0,
    descendantCount: p.descendantCount ?? 0,
    targetExcerpt: p.targetExcerpt ?? null,
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
    affirmativeMoveCount: p.affirmativeMoveCount ?? 0,
    negativeMoveCount: p.negativeMoveCount ?? 0,
    observerMoveCount: p.observerMoveCount ?? 0,
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

// Two OPEN clusters => two actionable points of equal lifecycle priority.
const GRAPH: MediatorGraphInput = {
  debateId: 'debate-1',
  nodes: [
    makeNode({ messageId: 'p1', branchRootMessageId: 'p1', ordinal: 0 }),
    makeNode({ messageId: 'p2', branchRootMessageId: 'p2', ordinal: 1 }),
  ],
  lifecycle: makeLifecycle([
    makeCluster({ clusterId: 'p1', state: 'open' }),
    makeCluster({ clusterId: 'p2', state: 'open' }),
  ]),
  evidenceDebts: [],
};

describe('INTEL-001 — T-MW: byte-identity when weightingSignals absent', () => {
  it('no options vs empty weightingSignals => JSON-equal board', () => {
    const base = deriveMediatorBoardState(GRAPH, []);
    const withEmpty = deriveMediatorBoardState(GRAPH, [], { weightingSignals: {} });
    expect(JSON.stringify(withEmpty)).toBe(JSON.stringify(base));
  });

  it('empty pressuredNodeIds array => JSON-equal board (incl. inputHash)', () => {
    const base = deriveMediatorBoardState(GRAPH, []);
    const withEmptyArr = deriveMediatorBoardState(GRAPH, [], {
      weightingSignals: { pressuredNodeIds: [], unresolvedDebtPressure: 0 },
    });
    expect(JSON.stringify(withEmptyArr)).toBe(JSON.stringify(base));
    expect(withEmptyArr.inputHash).toBe(base.inputHash);
  });
});

describe('INTEL-001 — T-MW: present weighting re-orders nextAction only', () => {
  it('without weighting, nextAction names the earliest-id point (p1)', () => {
    const board = deriveMediatorBoardState(GRAPH, []);
    expect(board.nextAction?.pointId).toBe('p1');
  });

  it('with pressure on p2 members, nextAction names p2 instead', () => {
    const board = deriveMediatorBoardState(GRAPH, [], {
      weightingSignals: { pressuredNodeIds: ['p2'] },
    });
    expect(board.nextAction?.pointId).toBe('p2');
  });

  it('re-ordering changes no point.state / plainLabel', () => {
    const base = deriveMediatorBoardState(GRAPH, []);
    const weighted = deriveMediatorBoardState(GRAPH, [], {
      weightingSignals: { pressuredNodeIds: ['p2'] },
    });
    const baseById = new Map(base.points.map((p) => [p.id, p]));
    for (const p of weighted.points) {
      const b = baseById.get(p.id);
      expect(b).toBeDefined();
      expect(p.state).toBe(b!.state);
      expect(p.plainLabel).toBe(b!.plainLabel);
    }
    // The point set + inputHash are unchanged; only nextAction differs.
    expect(weighted.inputHash).toBe(base.inputHash);
    expect(weighted.points.map((p) => p.id).sort()).toEqual(base.points.map((p) => p.id).sort());
  });

  it('FIRING NEGATIVE CONTROL — unresolvedDebtPressure alone (no dodge) can bias toward a debt-bearing point', () => {
    const graphWithDebt: MediatorGraphInput = {
      ...GRAPH,
      evidenceDebts: [
        {
          id: 'p2:debt',
          debateId: 'debate-1',
          nodeId: 'p2',
          requestArgumentId: 'p2',
          debtKind: 'source',
          requestedByUserId: null,
          requestedAt: '2026-07-01T00:00:00.000Z',
          status: 'requested',
          ageDays: 0,
          isStale: false,
        },
      ],
    };
    const base = deriveMediatorBoardState(graphWithDebt, []);
    const weighted = deriveMediatorBoardState(graphWithDebt, [], {
      weightingSignals: { unresolvedDebtPressure: 0.9 },
    });
    // The debt is on p2; with debt pressure on, p2 is at least as preferred as
    // the unweighted choice (the control demonstrates the seam is live).
    expect(['p1', 'p2']).toContain(base.nextAction?.pointId);
    expect(weighted.nextAction?.pointId).toBe('p2');
  });
});
