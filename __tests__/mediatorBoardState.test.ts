/**
 * UX-MEDIATOR-001 — Mediator board state derivation tests.
 *
 * Pure-model tests. The mediator core is a PROJECTION over a pre-built
 * point-lifecycle map + evidence-debt list + persisted observations, so the
 * fixtures construct those inputs directly (a `PointLifecycleMap`, an
 * `EvidenceDebt[]`, observation rows) rather than re-running
 * `buildPointLifecycleMap` — that keeps each test focused on the projection
 * and independent of the lifecycle model's own derivation rules.
 *
 * Doctrine coverage: determinism, no input mutation, JSON-serializability,
 * plain-language coverage, and a ban-list scan over every produced label.
 */
import {
  ALL_MEDIATOR_STATE_CODES,
  ALL_V4_MEDIATOR_STATE_CODES,
  MEDIATOR_STATE_COPY,
  MEDIATOR_STATE_HELPER,
  PATHWAY_STEP_COPY,
  V4_DISPLAY_STATE_BY_CODE,
  V4_PRIMARY_STATE_PRIORITY,
  _forbiddenMediatorTokens,
  deriveEvidenceDebt,
  deriveImpasseMarkers,
  deriveMediatorBoardState,
  deriveOpenDisagreementPoints,
  deriveResolutionPathways,
  plainLanguageForMediatorState,
  v4DisplayStateFor,
} from '../src/features/mediator';
import type {
  MediatorBoardState,
  MediatorGraphInput,
  MediatorGraphNode,
  MediatorObservationInput,
} from '../src/features/mediator';
import type { EvidenceDebt } from '../src/features/evidence/evidenceDebtModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
} from '../src/features/lifecycle/pointLifecycleModel';
import type { MachineObservationFamily } from '../src/features/nodeLabels/nodeLabelTypes';

// ── Fixture builders ──────────────────────────────────────────

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

function makeLifecycle(
  clusters: PointLifecycleClusterSummary[],
  inputHash = 'lc-hash-1',
): PointLifecycleMap {
  const byCluster = new Map<string, PointLifecycleClusterSummary>();
  for (const c of clusters) byCluster.set(c.clusterId, c);
  return {
    byCluster,
    byMessage: new Map(),
    clusterOrder: clusters.map((c) => c.clusterId),
    cumulativeStateSequence: clusters.map((c) => c.state),
    inputHash,
  };
}

function makeDebt(p: Partial<EvidenceDebt> & { id: string; nodeId: string }): EvidenceDebt {
  return {
    id: p.id,
    debateId: p.debateId ?? 'debate-1',
    nodeId: p.nodeId,
    requestArgumentId: p.requestArgumentId ?? p.id.replace(':debt', ''),
    debtKind: p.debtKind ?? 'source',
    requestedByUserId: p.requestedByUserId ?? 'user-1',
    requestedAt: p.requestedAt ?? '2009-02-13T23:31:30.000Z',
    status: p.status ?? 'requested',
    ageDays: p.ageDays ?? 0,
    isStale: p.isStale ?? false,
  };
}

function makeObs(
  argumentId: string,
  family: MachineObservationFamily,
  rawKey: string,
  confidence: MediatorObservationInput['confidence'] = 'high',
): MediatorObservationInput {
  return { argumentId, family, rawKey, confidence };
}

function makeGraph(p: {
  nodes: MediatorGraphNode[];
  clusters: PointLifecycleClusterSummary[];
  debts?: EvidenceDebt[];
  debateId?: string;
}): MediatorGraphInput {
  return {
    debateId: p.debateId ?? 'debate-1',
    nodes: p.nodes,
    lifecycle: makeLifecycle(p.clusters),
    evidenceDebts: p.debts ?? [],
  };
}

/** Collect every user-facing string a board can render, for the ban-list scan. */
function collectLabels(board: MediatorBoardState): string[] {
  const out: string[] = [];
  for (const p of board.points) out.push(p.plainLabel);
  for (const id of Object.keys(board.markupByNodeId)) {
    const m = board.markupByNodeId[id];
    if (m.deviation) out.push(m.deviation.plainLabel);
  }
  for (const v of board.evidenceDebts) out.push(v.plainLabel);
  for (const b of board.blockedEvidencePaths) out.push(b.plainLabel);
  for (const i of board.impasses) out.push(i.plainLabel);
  for (const id of Object.keys(board.pathwaysByPointId)) {
    for (const s of board.pathwaysByPointId[id].steps) out.push(s.plainLabel);
  }
  if (board.nextAction) out.push(board.nextAction.plainPrompt);
  return out;
}

// ── 1. Empty graph ────────────────────────────────────────────

describe('UX-MEDIATOR-001 deriveMediatorBoardState — empty graph', () => {
  it('returns an empty, well-formed board state', () => {
    const board = deriveMediatorBoardState(makeGraph({ nodes: [], clusters: [] }), []);
    expect(board.debateId).toBe('debate-1');
    expect(board.points).toEqual([]);
    expect(board.markupByNodeId).toEqual({});
    expect(board.evidenceDebts).toEqual([]);
    expect(board.blockedEvidencePaths).toEqual([]);
    expect(board.impasses).toEqual([]);
    expect(board.pathwaysByPointId).toEqual({});
    expect(board.recollectionConflicts).toEqual([]);
    expect(board.nextAction).toEqual({
      pointId: null,
      code: 'none',
      plainPrompt: 'No open pathway at the moment.',
    });
    expect(typeof board.inputHash).toBe('string');
    expect(board.inputHash.length).toBeGreaterThan(0);
  });
});

// ── 2. One open claim ─────────────────────────────────────────

describe('UX-MEDIATOR-001 — one open claim', () => {
  it('produces one DisagreementPoint in state "open" with unknown confidence (no observations)', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'root-1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'root-1', state: 'open' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points).toHaveLength(1);
    const p = board.points[0];
    expect(p.id).toBe('root-1');
    expect(p.state).toBe('open');
    expect(p.plainLabel).toBe('Open');
    expect(p.confidence).toBe('unknown'); // doctrine: preserve uncertainty
    expect(p.memberNodeIds).toEqual(['root-1']);
    expect(p.anchor.nodeId).toBe('root-1');
    expect(board.markupByNodeId['root-1'].primaryState).toBe('open');
  });
});

// ── 3. Parent/child grouping ──────────────────────────────────

describe('UX-MEDIATOR-001 — parent claim + child challenge', () => {
  it('groups both nodes under one point', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true, replyCount: 1 }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1', kindLabel: 'Rebuttal', sideLabel: 'Neg' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points).toHaveLength(1);
    expect(board.points[0].memberNodeIds).toEqual(['n1', 'n2']);
    expect(board.markupByNodeId['n1'].pointId).toBe('n1');
    expect(board.markupByNodeId['n2'].pointId).toBe('n1');
  });
});

// ── 4. Evidence debt → needs_evidence ─────────────────────────

describe('UX-MEDIATOR-001 — open evidence debt', () => {
  it('derives needs_evidence and surfaces the debt id + chip status', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })],
      debts: [makeDebt({ id: 'n2:debt', nodeId: 'n1', status: 'requested' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('needs_evidence');
    expect(board.points[0].openEvidenceDebtIds).toEqual(['n2:debt']);
    expect(board.markupByNodeId['n1'].evidenceDebtChipStatus).toBe('requested');
    expect(board.pathwaysByPointId['n1'].steps.some((s) => s.code === 'provide_source' && s.available)).toBe(true);
    expect(deriveEvidenceDebt(graph, [])[0].isOpen).toBe(true);
  });
});

// ── 5. Blocked evidence path (data-supported only) ────────────

describe('UX-MEDIATOR-001 — blocked / unavailable evidence', () => {
  it('A: an unresolved (declined) debt → evidence_blocked + a blocked path', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
      debts: [makeDebt({ id: 'r:debt', nodeId: 'n1', status: 'unresolved' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('evidence_blocked');
    expect(board.blockedEvidencePaths).toHaveLength(1);
    expect(board.blockedEvidencePaths[0].debtId).toBe('r:debt');
  });

  it('B: a flags_context_limit observation (no debt) → key_detail_unavailable + non-provable detail', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
    });
    const board = deriveMediatorBoardState(graph, [
      makeObs('n1', 'evidence_source_chain', 'flags_context_limit', 'medium'),
    ]);
    expect(board.points[0].state).toBe('key_detail_unavailable');
    expect(board.nonProvableKeyDetails).toHaveLength(1);
    expect(board.blockedEvidencePaths).toHaveLength(1);
  });

  it('C: a plain requested debt with no blocking signal stays needs_evidence (not invented)', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
      debts: [makeDebt({ id: 'r:debt', nodeId: 'n1', status: 'requested' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('needs_evidence');
    expect(board.blockedEvidencePaths).toEqual([]);
  });
});

// ── 6. Definition mismatch (observation-driven only) ──────────

describe('UX-MEDIATOR-001 — definition mismatch', () => {
  it('A: proposes_shared_definition without confirms → definition_not_shared', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })],
    });
    const board = deriveMediatorBoardState(graph, [
      makeObs('n2', 'misunderstanding_repair', 'proposes_shared_definition'),
    ]);
    expect(board.points[0].state).toBe('definition_not_shared');
    expect(board.definitionMismatches).toHaveLength(1);
    expect(board.definitionMismatches[0].proposedButNotConfirmed).toBe(true);
  });

  it('B: confirms_shared_definition present → NOT definition_not_shared (falls back to open)', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })],
    });
    const board = deriveMediatorBoardState(graph, [
      makeObs('n2', 'misunderstanding_repair', 'proposes_shared_definition'),
      makeObs('n2', 'misunderstanding_repair', 'confirms_shared_definition'),
    ]);
    expect(board.points[0].state).toBe('open');
    expect(board.definitionMismatches).toEqual([]);
  });
});

// ── 7. Scope mismatch (observation- or lifecycle-driven) ──────

describe('UX-MEDIATOR-001 — scope mismatch', () => {
  it('A: a disputes_scope observation → scope_mismatch', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })],
    });
    const board = deriveMediatorBoardState(graph, [
      makeObs('n2', 'disagreement_axis', 'disputes_scope'),
    ]);
    expect(board.points[0].state).toBe('scope_mismatch');
    expect(board.scopeMismatches).toHaveLength(1);
  });

  it('B: lifecycle branch_recommended → scope_mismatch with low confidence', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'branch_recommended' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('scope_mismatch');
    expect(board.points[0].confidence).toBe('low');
  });

  it('C: no scope signal → not scope_mismatch', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
    });
    expect(deriveMediatorBoardState(graph, []).points[0].state).not.toBe('scope_mismatch');
  });
});

// ── 8. Node deviation (off-point) ─────────────────────────────

describe('UX-MEDIATOR-001 — node deviation', () => {
  it('marks the deviating node off_point with post-anyway preserved', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })],
    });
    const board = deriveMediatorBoardState(graph, [
      makeObs('n2', 'misunderstanding_repair', 'question_answer_mismatch'),
    ]);
    const dev = board.markupByNodeId['n2'].deviation;
    expect(dev).not.toBeNull();
    expect(dev?.kind).toBe('off_point');
    expect(dev?.postAnywayAlwaysAvailable).toBe(true);
    expect(board.points[0].state).toBe('off_point');
  });
});

// ── 9. Partial narrowing ──────────────────────────────────────

describe('UX-MEDIATOR-001 — partial narrowing / concession', () => {
  it('lifecycle narrowed → narrowed (a repair, not a defeat)', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'narrowed' })],
    });
    expect(deriveMediatorBoardState(graph, []).points[0].state).toBe('narrowed');
  });

  it('lifecycle conceded → narrowed', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'conceded' })],
    });
    expect(deriveMediatorBoardState(graph, []).points[0].state).toBe('narrowed');
  });
});

// ── 10. Structured impasse (exhausted + no pathway) ───────────

describe('UX-MEDIATOR-001 — structured impasse', () => {
  it('lifecycle exhausted with nothing actionable → structured_impasse + marker, no available pathway', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'exhausted', messageIds: ['n1', 'n2'] })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('structured_impasse');
    expect(board.impasses).toHaveLength(1);
    expect(board.impasses[0].followedForm).toBe(true);
    expect(board.impasses[0].openPathwayExists).toBe(false);
    expect(board.pathwaysByPointId['n1'].anyAvailable).toBe(false);
    expect(deriveImpasseMarkers(graph, [])).toHaveLength(1);
  });
});

// ── 11. Determinism / stable sorting ──────────────────────────

describe('UX-MEDIATOR-001 — determinism', () => {
  it('produces identical output (and inputHash) across repeated runs', () => {
    const build = (): MediatorGraphInput =>
      makeGraph({
        nodes: [
          makeNode({ messageId: 'a', ordinal: 1, isRoot: true }),
          makeNode({ messageId: 'b', ordinal: 2, isRoot: true }),
          makeNode({ messageId: 'c', ordinal: 3, parentId: 'b', branchRootMessageId: 'b' }),
        ],
        clusters: [
          makeCluster({ clusterId: 'a', state: 'open' }),
          makeCluster({ clusterId: 'b', state: 'answered', messageIds: ['b', 'c'] }),
        ],
        debts: [makeDebt({ id: 'c:debt', nodeId: 'b', status: 'requested' })],
      });
    const obs = [makeObs('c', 'disagreement_axis', 'disputes_scope')];
    const first = deriveMediatorBoardState(build(), obs);
    const second = deriveMediatorBoardState(build(), obs);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.inputHash).toBe(second.inputHash);
    // Points follow lifecycle cluster order.
    expect(first.points.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

// ── 12. No input mutation ─────────────────────────────────────

describe('UX-MEDIATOR-001 — does not mutate inputs', () => {
  it('leaves nodes, debts, and observations untouched', () => {
    const nodes = [
      makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
      makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
    ];
    const debts = [makeDebt({ id: 'n2:debt', nodeId: 'n1', status: 'requested' })];
    const obs = [makeObs('n2', 'disagreement_axis', 'disputes_scope')];
    const graph = makeGraph({ nodes, clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })], debts });

    const nodesSnap = JSON.stringify(nodes);
    const debtsSnap = JSON.stringify(debts);
    const obsSnap = JSON.stringify(obs);
    Object.freeze(nodes);
    Object.freeze(debts);
    Object.freeze(obs);

    expect(() => deriveMediatorBoardState(graph, obs)).not.toThrow();
    expect(JSON.stringify(nodes)).toBe(nodesSnap);
    expect(JSON.stringify(debts)).toBe(debtsSnap);
    expect(JSON.stringify(obs)).toBe(obsSnap);
  });
});

// ── 13. JSON-serializable ─────────────────────────────────────

describe('UX-MEDIATOR-001 — JSON-serializable', () => {
  it('round-trips through JSON without loss (no Maps in the output)', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })],
      debts: [makeDebt({ id: 'n2:debt', nodeId: 'n1', status: 'requested' })],
    });
    const board = deriveMediatorBoardState(graph, [makeObs('n2', 'disagreement_axis', 'disputes_scope')]);
    const roundTrip = JSON.parse(JSON.stringify(board));
    expect(roundTrip).toEqual(board);
  });
});

// ── 14. plainLanguage coverage ────────────────────────────────

describe('UX-MEDIATOR-001 — plain-language coverage', () => {
  it('maps every state code to safe, non-empty, non-snake_case copy', () => {
    for (const code of ALL_MEDIATOR_STATE_CODES) {
      const label = plainLanguageForMediatorState(code);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/_/); // no snake_case leak
      expect(label).not.toBe(code); // actually mapped to prose
    }
  });
});

// ── 15. Ban-list scan over every produced label ───────────────

describe('UX-MEDIATOR-001 — ban-list (doctrine safety)', () => {
  const BANNED = _forbiddenMediatorTokens();

  function scan(labels: string[]): void {
    for (const label of labels) {
      const lower = label.toLowerCase();
      for (const token of BANNED) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  }

  it('emits no verdict / person / amplification tokens in any static copy', () => {
    scan(Object.values(MEDIATOR_STATE_COPY));
    scan(Object.values(MEDIATOR_STATE_HELPER));
    scan(Object.values(PATHWAY_STEP_COPY));
  });

  it('emits no banned tokens in derived board labels across many scenarios', () => {
    const scenarios: Array<{ graph: MediatorGraphInput; obs: MediatorObservationInput[] }> = [
      { graph: makeGraph({ nodes: [makeNode({ messageId: 'a', isRoot: true })], clusters: [makeCluster({ clusterId: 'a', state: 'exhausted' })] }), obs: [] },
      { graph: makeGraph({ nodes: [makeNode({ messageId: 'a', isRoot: true })], clusters: [makeCluster({ clusterId: 'a', state: 'answered' })], debts: [makeDebt({ id: 'x:debt', nodeId: 'a', status: 'unresolved' })] }), obs: [] },
      { graph: makeGraph({ nodes: [makeNode({ messageId: 'a', isRoot: true }), makeNode({ messageId: 'b', parentId: 'a', branchRootMessageId: 'a' })], clusters: [makeCluster({ clusterId: 'a', state: 'answered', messageIds: ['a', 'b'] })] }), obs: [makeObs('b', 'misunderstanding_repair', 'question_answer_mismatch')] },
      { graph: makeGraph({ nodes: [makeNode({ messageId: 'a', isRoot: true })], clusters: [makeCluster({ clusterId: 'a', state: 'narrowed' })] }), obs: [] },
      { graph: makeGraph({ nodes: [makeNode({ messageId: 'a', isRoot: true })], clusters: [makeCluster({ clusterId: 'a', state: 'answered', primaryAxis: 'value' })] }), obs: [] },
    ];
    for (const s of scenarios) {
      const board = deriveMediatorBoardState(s.graph, s.obs);
      scan(collectLabels(board));
    }
  });
});

// ── Sub-function parity (the (graph, observations) contract) ──

describe('UX-MEDIATOR-001 — public sub-functions', () => {
  it('deriveOpenDisagreementPoints / deriveResolutionPathways are consistent with the board', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
      debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })],
    });
    const points = deriveOpenDisagreementPoints(graph, []);
    const pathways = deriveResolutionPathways(graph, []);
    const board = deriveMediatorBoardState(graph, []);
    expect(points.map((p) => p.state)).toEqual(board.points.map((p) => p.state));
    expect(Object.keys(pathways)).toEqual(Object.keys(board.pathwaysByPointId));
  });
});

// ── 16. v4 13→9 display mapping is total + documented ──────────

describe('UX-MEDIATOR-001 — v4 display mapping (13→9)', () => {
  it('V4_DISPLAY_STATE_BY_CODE has a value for every one of the 13 internal codes', () => {
    for (const code of ALL_MEDIATOR_STATE_CODES) {
      expect(Object.prototype.hasOwnProperty.call(V4_DISPLAY_STATE_BY_CODE, code)).toBe(true);
    }
    // No extra keys beyond the 13.
    expect(Object.keys(V4_DISPLAY_STATE_BY_CODE).sort()).toEqual(
      [...ALL_MEDIATOR_STATE_CODES].sort(),
    );
  });

  it('every display value is one of the nine v4 states or the terminal resolved atom', () => {
    const allowed = new Set<string>([...ALL_V4_MEDIATOR_STATE_CODES, 'resolved_or_settled']);
    for (const code of ALL_MEDIATOR_STATE_CODES) {
      expect(allowed.has(v4DisplayStateFor(code))).toBe(true);
    }
  });

  it('collapses the four superset codes exactly as the design specifies', () => {
    expect(v4DisplayStateFor('key_detail_unavailable')).toBe('evidence_blocked');
    expect(v4DisplayStateFor('value_tradeoff')).toBe('open'); // O-2
    expect(v4DisplayStateFor('off_point')).toBe('scope_mismatch');
    expect(v4DisplayStateFor('resolved_or_settled')).toBe('resolved_or_settled'); // terminal
  });

  it('keeps the nine live states as themselves (identity for the v4 vocabulary)', () => {
    for (const code of ALL_V4_MEDIATOR_STATE_CODES) {
      expect(v4DisplayStateFor(code)).toBe(code);
    }
  });

  it('the v4 priority list is exactly the nine live states (no resolved_or_settled)', () => {
    expect([...V4_PRIMARY_STATE_PRIORITY]).toEqual([...ALL_V4_MEDIATOR_STATE_CODES]);
    expect(V4_PRIMARY_STATE_PRIORITY).not.toContain('resolved_or_settled');
  });
});

// ── 17. missing_mechanism → "Missing link" label (O-1 rename) ──

describe('UX-MEDIATOR-001 — missing_mechanism label rename', () => {
  it('renders the v4 "Missing link" label (ban-list clean, no fallacy term)', () => {
    const label = plainLanguageForMediatorState('missing_mechanism');
    expect(label).toBe('Missing link');
    const lower = label.toLowerCase();
    for (const token of _forbiddenMediatorTokens()) {
      expect(lower.includes(token)).toBe(false);
    }
    expect(lower).not.toContain('fallacy');
    expect(label).not.toMatch(/_/);
  });

  it('surfaces "Missing link" on a causal point in the board (not a verdict)', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'rebutted', primaryAxis: 'causal' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('missing_mechanism');
    expect(board.points[0].plainLabel).toBe('Missing link');
  });
});

// ── 18. one primary state per node (the v4 display projection) ──

describe('UX-MEDIATOR-001 — one primary state per node', () => {
  it('each markup carries exactly one primaryState that maps to exactly one v4 display state', () => {
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered', messageIds: ['n1', 'n2'] })],
      debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })],
    });
    const board = deriveMediatorBoardState(graph, [
      makeObs('n2', 'disagreement_axis', 'disputes_scope'),
    ]);
    for (const id of Object.keys(board.markupByNodeId)) {
      const code = board.markupByNodeId[id].primaryState;
      expect(typeof code).toBe('string');
      // a single code; its v4 projection is a single display atom
      const display = v4DisplayStateFor(code);
      expect(typeof display).toBe('string');
      const allowed = new Set<string>([...ALL_V4_MEDIATOR_STATE_CODES, 'resolved_or_settled']);
      expect(allowed.has(display)).toBe(true);
    }
  });
});
