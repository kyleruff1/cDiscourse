/**
 * UX-MEDIATOR-001 — mediator-state precedence tests.
 *
 * Pure-model tests for the precedence delta: a single primary state per node
 * even when MULTIPLE candidate signals are present, the full v4 priority order,
 * every v4 conflict-resolution row, Gate A (impasse demotion), the uncertainty
 * fallback, idempotence, and the doctrine guards (no gate-shaped export, no
 * verdict-like state for insufficient input, role/seat/voice/transcript-shaped
 * inputs never become a stronger state).
 *
 * Fixtures construct the lifecycle map + evidence-debt list + observation rows
 * directly (the mediator core is a PROJECTION over already-derived state), so
 * each test isolates the precedence logic from the lifecycle deriver.
 */
import {
  ALL_V4_MEDIATOR_STATE_CODES,
  V4_PRIMARY_STATE_PRIORITY,
  deriveMediatorBoardState,
  deriveOpenDisagreementPoints,
  v4DisplayStateFor,
} from '../src/features/mediator';
import * as mediatorModule from '../src/features/mediator';
import type {
  MediatorGraphInput,
  MediatorGraphNode,
  MediatorObservationInput,
  MediatorStateCode,
} from '../src/features/mediator';
import type { EvidenceDebt } from '../src/features/evidence/evidenceDebtModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleState,
} from '../src/features/lifecycle/pointLifecycleModel';
import type { MachineObservationFamily } from '../src/features/nodeLabels/nodeLabelTypes';

// ── Fixture builders (mirror mediatorBoardState.test.ts) ──────

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

/** Build a single-cluster graph and return the one derived point's state. */
function stateFor(opts: {
  lifecycle?: PointLifecycleState;
  primaryAxis?: PointLifecycleClusterSummary['primaryAxis'];
  debts?: EvidenceDebt[];
  obs?: MediatorObservationInput[];
}): MediatorStateCode {
  const graph = makeGraph({
    nodes: [
      makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
      makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
    ],
    clusters: [
      makeCluster({
        clusterId: 'n1',
        state: opts.lifecycle ?? 'answered',
        messageIds: ['n1', 'n2'],
        primaryAxis: opts.primaryAxis ?? null,
      }),
    ],
    debts: opts.debts ?? [],
  });
  const board = deriveMediatorBoardState(graph, opts.obs ?? []);
  return board.points[0].state;
}

// ── Multiple candidates resolve to ONE primary state ──────────

describe('UX-MEDIATOR-001 precedence — one primary state from many candidates', () => {
  it('a cluster with definition + scope + needs-evidence + narrowed signals yields exactly one state', () => {
    // narrowed lifecycle + an open debt + definition obs + scope obs all at once.
    const graph = makeGraph({
      nodes: [
        makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
        makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
      ],
      clusters: [makeCluster({ clusterId: 'n1', state: 'narrowed', messageIds: ['n1', 'n2'] })],
      debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })],
    });
    const board = deriveMediatorBoardState(graph, [
      makeObs('n2', 'disagreement_axis', 'disputes_definition'),
      makeObs('n2', 'disagreement_axis', 'disputes_scope'),
    ]);
    // Definition (4) outranks scope (5), needs_evidence (7), narrowed (8).
    expect(board.points[0].state).toBe('definition_not_shared');
    expect(board.points).toHaveLength(1);
    expect(Object.keys(board.markupByNodeId)).toHaveLength(2);
    expect(board.markupByNodeId['n1'].primaryState).toBe('definition_not_shared');
    expect(board.markupByNodeId['n2'].primaryState).toBe('definition_not_shared');
  });
});

// ── The full v4 priority order (highest wins) ─────────────────

describe('UX-MEDIATOR-001 precedence — full priority order', () => {
  it('V4_PRIMARY_STATE_PRIORITY ranks impasse first and open last', () => {
    expect(V4_PRIMARY_STATE_PRIORITY[0]).toBe('structured_impasse');
    expect(V4_PRIMARY_STATE_PRIORITY[V4_PRIMARY_STATE_PRIORITY.length - 1]).toBe('open');
    expect([...V4_PRIMARY_STATE_PRIORITY]).toEqual([
      'structured_impasse',
      'evidence_blocked',
      'key_detail_unavailable', // #710 — just below a declined evidence_blocked
      'accounts_differ',
      'definition_not_shared',
      'scope_mismatch',
      'missing_mechanism',
      'needs_evidence',
      'narrowed',
      'value_tradeoff', // #710 — just above open
      'open',
    ]);
  });

  it('each single-signal cluster picks the state at its priority rank', () => {
    // evidence_blocked (declined debt)
    expect(stateFor({ debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'unresolved' })] })).toBe(
      'evidence_blocked',
    );
    // definition_not_shared
    expect(stateFor({ obs: [makeObs('n2', 'disagreement_axis', 'disputes_definition')] })).toBe(
      'definition_not_shared',
    );
    // scope_mismatch
    expect(stateFor({ obs: [makeObs('n2', 'disagreement_axis', 'disputes_scope')] })).toBe(
      'scope_mismatch',
    );
    // missing_mechanism
    expect(stateFor({ lifecycle: 'rebutted', primaryAxis: 'causal' })).toBe('missing_mechanism');
    // needs_evidence
    expect(stateFor({ debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })] })).toBe(
      'needs_evidence',
    );
    // narrowed
    expect(stateFor({ lifecycle: 'narrowed' })).toBe('narrowed');
    // open (default)
    expect(stateFor({})).toBe('open');
  });
});

// ── Conflict-resolution rows (design L863-870) ────────────────

describe('UX-MEDIATOR-001 precedence — conflict rows', () => {
  it('Needs evidence + Narrowed → Needs evidence (fixes D2: narrowed was too high)', () => {
    // narrowed lifecycle AND an open (requested) debt → needs_evidence wins.
    expect(
      stateFor({ lifecycle: 'narrowed', debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })] }),
    ).toBe('needs_evidence');
  });

  it('Definition + Scope → Definition not shared (definition outranks scope)', () => {
    expect(
      stateFor({
        obs: [
          makeObs('n2', 'disagreement_axis', 'disputes_definition'),
          makeObs('n2', 'disagreement_axis', 'disputes_scope'),
        ],
      }),
    ).toBe('definition_not_shared');
  });

  it('Evidence blocked + Needs evidence → Evidence blocked (declined wins over requested)', () => {
    expect(
      stateFor({
        debts: [
          makeDebt({ id: 'd1', nodeId: 'n1', status: 'unresolved' }),
          makeDebt({ id: 'd2', nodeId: 'n1', status: 'requested' }),
        ],
      }),
    ).toBe('evidence_blocked');
  });

  it('Evidence blocked (declined debt) + a context-limit signal → Evidence blocked (declined wins)', () => {
    // A declined debt AND a flags_context_limit observation co-occur; the
    // declined debt suppresses key_detail_unavailable so evidence_blocked stands.
    expect(
      stateFor({
        debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'unresolved' })],
        obs: [makeObs('n2', 'evidence_source_chain', 'flags_context_limit', 'medium')],
      }),
    ).toBe('evidence_blocked');
  });

  it('missing_mechanism fires for a causal axis across answered / open lifecycles too', () => {
    expect(stateFor({ lifecycle: 'answered', primaryAxis: 'causal' })).toBe('missing_mechanism');
    expect(stateFor({ lifecycle: 'open', primaryAxis: 'causal' })).toBe('missing_mechanism');
  });

  it('Impasse + any path remains → NOT impasse (Gate A demotes; next-highest wins) — fixes D1', () => {
    // Exhausted lifecycle BUT a definition pathway is available → definition wins.
    expect(
      stateFor({ lifecycle: 'exhausted', obs: [makeObs('n2', 'disagreement_axis', 'disputes_definition')] }),
    ).toBe('definition_not_shared');
    // Exhausted lifecycle BUT an open debt (needs_evidence pathway) is available.
    expect(
      stateFor({ lifecycle: 'exhausted', debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })] }),
    ).toBe('needs_evidence');
  });

  it('Impasse + NO other pathway → structured_impasse stands (Gate A both branches)', () => {
    // Exhausted with nothing actionable (only the open fallback) → impasse.
    expect(stateFor({ lifecycle: 'exhausted' })).toBe('structured_impasse');
  });

  it('chime-in resolves the source → state recomputes (purity over new inputs)', () => {
    const withDebt = stateFor({
      lifecycle: 'answered',
      debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })],
    });
    const withoutDebt = stateFor({ lifecycle: 'answered', debts: [] });
    expect(withDebt).toBe('needs_evidence');
    expect(withoutDebt).toBe('open'); // removing the debt recomputes to open
    expect(withDebt).not.toBe(withoutDebt);
  });

  it('voice transcript used → no state change (transcript text is not a decision input)', () => {
    const base = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
      debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })],
    });
    const before = deriveMediatorBoardState(base, []);
    // Add a transcript-shaped extra field to the node — must be ignored.
    const withTranscript: MediatorGraphInput = {
      ...base,
      nodes: base.nodes.map((n) => ({ ...n, voiceTranscript: 'spoken words here' } as MediatorGraphNode)),
    };
    const after = deriveMediatorBoardState(withTranscript, []);
    expect(after.points.map((p) => p.state)).toEqual(before.points.map((p) => p.state));
    expect(JSON.stringify(after.points)).toBe(JSON.stringify(before.points));
  });
});

// ── Gate A subtlety (R3): impasse pathway is never the demoter ──

describe('UX-MEDIATOR-001 precedence — Gate A correctness', () => {
  it('a context-limit signal (key_detail_unavailable display — #710) demotes impasse', () => {
    // Exhausted + context-limit (key_detail_unavailable; pathway narrow_or_branch available).
    expect(
      stateFor({ lifecycle: 'exhausted', obs: [makeObs('n2', 'evidence_source_chain', 'flags_context_limit', 'medium')] }),
    ).toBe('key_detail_unavailable');
  });

  it('off_point (scope_mismatch display) demotes impasse', () => {
    expect(
      stateFor({ lifecycle: 'exhausted', obs: [makeObs('n2', 'misunderstanding_repair', 'question_answer_mismatch')] }),
    ).toBe('off_point');
  });

  it('value_tradeoff (value_tradeoff display — #710) demotes impasse via its name_tradeoff pathway', () => {
    expect(stateFor({ lifecycle: 'exhausted', primaryAxis: 'value' })).toBe('value_tradeoff');
  });
});

// ── Uncertainty / non-accusatory fallback (doctrine) ──────────

describe('UX-MEDIATOR-001 precedence — uncertainty fallback', () => {
  it('a no-signal cluster → open with unknown confidence', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'open' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('open');
    expect(board.points[0].confidence).toBe('unknown');
  });

  it('an empty graph never produces a verdict-like / accusatory state', () => {
    const board = deriveMediatorBoardState(makeGraph({ nodes: [], clusters: [] }), []);
    for (const p of board.points) {
      expect(['structured_impasse', 'evidence_blocked', 'accounts_differ']).not.toContain(p.state);
    }
    expect(board.points).toEqual([]);
  });

  it('insufficient input never synthesizes accounts_differ (detector deferred in v1)', () => {
    // No observation can produce accounts_differ in v1 (empty key set).
    expect(stateFor({ lifecycle: 'open' })).not.toBe('accounts_differ');
    expect(stateFor({ lifecycle: 'exhausted' })).not.toBe('accounts_differ');
    expect(stateFor({ obs: [makeObs('n2', 'disagreement_axis', 'disputes_scope')] })).not.toBe(
      'accounts_differ',
    );
  });
});

// ── Role / seat / chime-in / voice inputs never strengthen state ──

describe('UX-MEDIATOR-001 precedence — irrelevant inputs stay weak', () => {
  it('role/seat/voice-shaped observation keys never become a stronger state', () => {
    // Keys the projection does NOT consume must leave the state at the weakest level.
    const irrelevant = [
      makeObs('n2', 'disagreement_axis', 'role_observer'),
      makeObs('n2', 'disagreement_axis', 'seat_changed'),
      makeObs('n2', 'disagreement_axis', 'chime_in_started'),
      makeObs('n2', 'disagreement_axis', 'voice_transcript_attached'),
    ];
    const state = stateFor({ lifecycle: 'answered', obs: irrelevant });
    const stronger: MediatorStateCode[] = [
      'structured_impasse',
      'evidence_blocked',
      'key_detail_unavailable',
      'accounts_differ',
      'definition_not_shared',
      'scope_mismatch',
      'missing_mechanism',
      'needs_evidence',
    ];
    expect(stronger).not.toContain(state);
    expect(state).toBe('open');
  });
});

// ── Idempotence (same input → deep-equal output) ──────────────

describe('UX-MEDIATOR-001 precedence — idempotence', () => {
  it('the same input deep-equals the same output across runs', () => {
    const build = (): MediatorGraphInput =>
      makeGraph({
        nodes: [
          makeNode({ messageId: 'n1', ordinal: 1, isRoot: true }),
          makeNode({ messageId: 'n2', ordinal: 2, parentId: 'n1', branchRootMessageId: 'n1' }),
        ],
        clusters: [makeCluster({ clusterId: 'n1', state: 'narrowed', messageIds: ['n1', 'n2'] })],
        debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })],
      });
    const obs = [makeObs('n2', 'disagreement_axis', 'disputes_definition')];
    const a = deriveMediatorBoardState(build(), obs);
    const b = deriveMediatorBoardState(build(), obs);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(deriveOpenDisagreementPoints(build(), obs)).toEqual(
      deriveOpenDisagreementPoints(build(), obs),
    );
  });
});

// ── Doctrine: no gate-shaped export ───────────────────────────

describe('UX-MEDIATOR-001 precedence — no submission-gate export (doctrine §1/§5)', () => {
  it('the module exports no function whose result reads like a posting gate', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
    });
    for (const [name, value] of Object.entries(mediatorModule)) {
      if (typeof value !== 'function') continue;
      // Never name a gate.
      expect(name.toLowerCase()).not.toMatch(/canpost|cansubmit|isallowed|gate|block|reject/);
      let result: unknown;
      try {
        result = (value as (...args: unknown[]) => unknown)(graph, []);
      } catch {
        // Functions with a different arity are not gates; skip.
        continue;
      }
      // No callable returns a bare boolean / { canPost } gate shape.
      expect(typeof result).not.toBe('boolean');
      if (result && typeof result === 'object') {
        expect('canPost' in result).toBe(false);
        expect('canSubmit' in result).toBe(false);
        expect('allowed' in result).toBe(false);
      }
    }
  });
});

// ── v4 display projection is exactly one of the nine (or terminal) ──

describe('UX-MEDIATOR-001 precedence — v4 display projection per node', () => {
  it('v4DisplayStateFor(point.state) returns exactly one v4 atom for every point', () => {
    const allowed = new Set<string>([...ALL_V4_MEDIATOR_STATE_CODES, 'resolved_or_settled']);
    const scenarios: Array<Parameters<typeof stateFor>[0]> = [
      {},
      { debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'requested' })] },
      { debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'unresolved' })] },
      { obs: [makeObs('n2', 'disagreement_axis', 'disputes_definition')] },
      { obs: [makeObs('n2', 'disagreement_axis', 'disputes_scope')] },
      { obs: [makeObs('n2', 'misunderstanding_repair', 'question_answer_mismatch')] },
      { lifecycle: 'exhausted' },
      { lifecycle: 'narrowed' },
      { lifecycle: 'rebutted', primaryAxis: 'causal' },
      { primaryAxis: 'value' },
      { lifecycle: 'confirmed' },
    ];
    for (const s of scenarios) {
      const state = stateFor(s);
      const display = v4DisplayStateFor(state);
      expect(allowed.has(display)).toBe(true);
    }
  });
});
