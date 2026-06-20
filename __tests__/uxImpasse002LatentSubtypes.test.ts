/**
 * UX-IMPASSE-002 (#710) — surface the two latent structured-impasse subtypes
 * `value_tradeoff → "Different priorities"` and
 * `key_detail_unavailable → "Key detail unavailable"`.
 *
 * This is a DISPLAY-MAPPING + COPY card: it flips the two states' entries in the
 * v4 display projection (`V4_DISPLAY_STATE_BY_CODE`) to identity, supplies the
 * operator-locked copy, and adds two next-move specs. It changes NO derivation
 * logic — `point.state` and the 13-code `MediatorStateCode` are unchanged.
 *
 * Pure-model test: imports the mediator barrel + one pure-model display helper.
 * No React, no Supabase, no fetch, no clock, no randomness.
 *
 * Proof structure (design §9):
 *   - identity mapping for both surfaced states;
 *   - exactly-one v4 display state per code; `V4_DISPLAY_STATE_BY_CODE` total
 *     over all 13 internal codes; `V4_PRIMARY_STATE_PRIORITY` 11 entries at the
 *     documented indices == `ALL_V4_MEDIATOR_STATE_CODES`;
 *   - end-to-end producer → display (value-axis cluster → 'value_tradeoff';
 *     flags_context_limit no-debt → 'key_detail_unavailable');
 *   - deferred subtypes never surface (accounts_differ never produced;
 *     no_current_pathway not a state / not a distinct chip);
 *   - label parity (node chip == rail badge == distribution segment label);
 *   - no chip soup; Inspect / next-move ban-list clean;
 *   - evidence_blocked byte-identical regression;
 *   - fallback (no signal → open; exhausted no-pathway → structured_impasse);
 *   - next-move dominant labels.
 */
import {
  ALL_MEDIATOR_STATE_CODES,
  ALL_V4_MEDIATOR_STATE_CODES,
  V4_DISPLAY_STATE_BY_CODE,
  V4_PRIMARY_STATE_PRIORITY,
  MEDIATOR_STATE_COPY,
  VALUE_TRADEOFF_DISPLAY_COPY,
  KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY,
  ACCOUNTS_DIFFER_DISPLAY_COPY,
  IMPASSE_SUBTYPE_COPY,
  buildDisagreementDistribution,
  totalDistributionCount,
  deriveMediatorBoardState,
  v4DisplayStateFor,
  plainLanguageForMediatorState,
  helperForMediatorState,
  nextMovesForState,
  _forbiddenMediatorTokens,
  _forbiddenNextMoveTokens,
} from '../src/features/mediator';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';
import { getNodeMediatorMarker, NODE_MARKER_PRIORITY } from '../src/features/mediator/nodeMediatorMarkers';
import { getEvidenceDebtForPoint } from '../src/features/mediator/evidenceDebtDisplay';
import type {
  DisagreementPoint,
  MediatorBoardState,
  MediatorGraphInput,
  MediatorGraphNode,
  MediatorObservationInput,
  MediatorStateCode,
  V4MediatorStateCode,
} from '../src/features/mediator';
import type { EvidenceDebt } from '../src/features/evidence/evidenceDebtModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleState,
} from '../src/features/lifecycle/pointLifecycleModel';
import type { MachineObservationFamily } from '../src/features/nodeLabels/nodeLabelTypes';

// ── Fixture builders (mirror mediatorBoardState/Precedence tests) ──

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
    inputHash: 'lc-hash-impasse002',
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
}): MediatorGraphInput {
  return {
    debateId: 'debate-1',
    nodes: p.nodes,
    lifecycle: makeLifecycle(p.clusters),
    evidenceDebts: p.debts ?? [],
  };
}

/** A single-cluster graph + its derived board. */
function boardFor(opts: {
  lifecycle?: PointLifecycleState;
  primaryAxis?: PointLifecycleClusterSummary['primaryAxis'];
  debts?: EvidenceDebt[];
  obs?: MediatorObservationInput[];
}): MediatorBoardState {
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
  return deriveMediatorBoardState(graph, opts.obs ?? []);
}

/** The "live" spine = every point that is not resolved/settled (mirrors the rail). */
function selectLivePoints(board: MediatorBoardState): ReadonlyArray<DisagreementPoint> {
  return board.points.filter((p) => p.state !== 'resolved_or_settled');
}

// The shipped (LOCKED) evidence_blocked copy — must stay byte-identical.
const EVIDENCE_BLOCKED_HELPER =
  'The evidence path is not available right now. ' +
  'Name what kind of record would test this point, without demanding private access. ' +
  'Mark evidence unavailable, branch the provable part, or ask what kind of record would test this.';

// ── 1. Identity mapping for both surfaced states ───────────────

describe('UX-IMPASSE-002 — surfaced display mapping (identity)', () => {
  it('value_tradeoff projects to itself', () => {
    expect(v4DisplayStateFor('value_tradeoff')).toBe('value_tradeoff');
    expect(V4_DISPLAY_STATE_BY_CODE.value_tradeoff).toBe('value_tradeoff');
  });

  it('key_detail_unavailable projects to itself', () => {
    expect(v4DisplayStateFor('key_detail_unavailable')).toBe('key_detail_unavailable');
    expect(V4_DISPLAY_STATE_BY_CODE.key_detail_unavailable).toBe('key_detail_unavailable');
  });

  it('both surfaced codes are members of the v4 display vocabulary', () => {
    expect(ALL_V4_MEDIATOR_STATE_CODES).toContain('value_tradeoff');
    expect(ALL_V4_MEDIATOR_STATE_CODES).toContain('key_detail_unavailable');
  });
});

// ── 2. Exactly one v4 display state per code; map totality ──────

describe('UX-IMPASSE-002 — display-map integrity', () => {
  it('every internal code maps to exactly one v4 display state (or terminal)', () => {
    const allowed = new Set<string>([...ALL_V4_MEDIATOR_STATE_CODES, 'resolved_or_settled']);
    for (const code of ALL_MEDIATOR_STATE_CODES) {
      const display = v4DisplayStateFor(code);
      expect(typeof display).toBe('string');
      expect(allowed.has(display)).toBe(true);
    }
  });

  it('V4_DISPLAY_STATE_BY_CODE is still total over all 13 internal codes', () => {
    for (const code of ALL_MEDIATOR_STATE_CODES) {
      expect(Object.prototype.hasOwnProperty.call(V4_DISPLAY_STATE_BY_CODE, code)).toBe(true);
    }
    expect(Object.keys(V4_DISPLAY_STATE_BY_CODE).sort()).toEqual([...ALL_MEDIATOR_STATE_CODES].sort());
    expect(ALL_MEDIATOR_STATE_CODES).toHaveLength(13);
  });

  it('only off_point (plus terminal resolved_or_settled) still collapses', () => {
    const collapsed = ALL_MEDIATOR_STATE_CODES.filter(
      (code) => v4DisplayStateFor(code) !== code && v4DisplayStateFor(code) !== 'resolved_or_settled',
    );
    expect(collapsed).toEqual(['off_point']);
    expect(v4DisplayStateFor('off_point')).toBe('scope_mismatch');
    expect(v4DisplayStateFor('resolved_or_settled')).toBe('resolved_or_settled');
  });
});

// ── 3. V4_PRIMARY_STATE_PRIORITY — 11 entries at documented ranks ──

describe('UX-IMPASSE-002 — v4 priority order', () => {
  it('has eleven entries in the documented order', () => {
    expect([...V4_PRIMARY_STATE_PRIORITY]).toEqual([
      'structured_impasse',
      'evidence_blocked',
      'key_detail_unavailable',
      'accounts_differ',
      'definition_not_shared',
      'scope_mismatch',
      'missing_mechanism',
      'needs_evidence',
      'narrowed',
      'value_tradeoff',
      'open',
    ]);
    expect(V4_PRIMARY_STATE_PRIORITY).toHaveLength(11);
  });

  it('key_detail_unavailable is at index 2 (just below a declined evidence_blocked)', () => {
    expect(V4_PRIMARY_STATE_PRIORITY.indexOf('key_detail_unavailable')).toBe(2);
    expect(V4_PRIMARY_STATE_PRIORITY.indexOf('key_detail_unavailable')).toBeGreaterThan(
      V4_PRIMARY_STATE_PRIORITY.indexOf('evidence_blocked'),
    );
  });

  it('value_tradeoff is at index 9 (just above open)', () => {
    expect(V4_PRIMARY_STATE_PRIORITY.indexOf('value_tradeoff')).toBe(9);
    expect(V4_PRIMARY_STATE_PRIORITY.indexOf('value_tradeoff')).toBe(
      V4_PRIMARY_STATE_PRIORITY.indexOf('open') - 1,
    );
  });

  it('equals ALL_V4_MEDIATOR_STATE_CODES (self-consistency)', () => {
    expect([...V4_PRIMARY_STATE_PRIORITY]).toEqual([...ALL_V4_MEDIATOR_STATE_CODES]);
    expect(V4_PRIMARY_STATE_PRIORITY).not.toContain('resolved_or_settled');
  });
});

// ── 4. End-to-end producer → display ───────────────────────────

describe('UX-IMPASSE-002 — end-to-end producer → surfaced display', () => {
  it('a primaryAxis: value cluster yields a value_tradeoff display point', () => {
    const board = boardFor({ primaryAxis: 'value' });
    expect(board.points[0].state).toBe('value_tradeoff'); // internal unchanged
    expect(v4DisplayStateFor(board.points[0].state)).toBe('value_tradeoff');
  });

  it('a flags_context_limit (no debt) cluster yields a key_detail_unavailable display point', () => {
    const board = boardFor({
      obs: [makeObs('n2', 'evidence_source_chain', 'flags_context_limit', 'medium')],
    });
    expect(board.points[0].state).toBe('key_detail_unavailable'); // internal unchanged
    expect(v4DisplayStateFor(board.points[0].state)).toBe('key_detail_unavailable');
  });

  it('a declined evidence debt still wins evidence_blocked over a co-occurring context-limit signal', () => {
    const board = boardFor({
      debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'unresolved' })],
      obs: [makeObs('n2', 'evidence_source_chain', 'flags_context_limit', 'medium')],
    });
    expect(board.points[0].state).toBe('evidence_blocked');
    expect(v4DisplayStateFor(board.points[0].state)).toBe('evidence_blocked');
  });
});

// ── 5. Deferred subtypes never surface ─────────────────────────

describe('UX-IMPASSE-002 — deferred subtypes stay dormant', () => {
  it('accounts_differ is never produced from any observation set (empty key set in v1)', () => {
    const tries: Array<Parameters<typeof boardFor>[0]> = [
      { lifecycle: 'open' },
      { lifecycle: 'exhausted' },
      { obs: [makeObs('n2', 'disagreement_axis', 'disputes_scope')] },
      { obs: [makeObs('n2', 'disagreement_axis', 'disputes_definition')] },
      { primaryAxis: 'value' },
    ];
    for (const t of tries) {
      expect(boardFor(t).points[0]?.state ?? 'open').not.toBe('accounts_differ');
    }
  });

  it('no_current_pathway is not a MediatorStateCode / v4 display state / node-marker / dedicated move spec', () => {
    expect(ALL_MEDIATOR_STATE_CODES).not.toContain('no_current_pathway' as MediatorStateCode);
    expect(ALL_V4_MEDIATOR_STATE_CODES).not.toContain('no_current_pathway' as V4MediatorStateCode);
    expect(NODE_MARKER_PRIORITY).not.toContain('no_current_pathway' as MediatorStateCode);
    // It is not a V4MediatorStateCode, so it has no dedicated STATE_MOVE_SPECS
    // entry — nextMovesForState falls back to the neutral Open set for it.
    const moves = nextMovesForState('no_current_pathway' as unknown as V4MediatorStateCode);
    expect(moves[0].label).toBe('Respond to the exact point');
    // It remains the reserved alternate copy that folds into the impasse chip.
    expect(IMPASSE_SUBTYPE_COPY.no_current_pathway.chip).toBe('Structured impasse');
  });

  it('the deferred copy constants are authored but not used as display-map values', () => {
    const displayValues = Object.values(V4_DISPLAY_STATE_BY_CODE);
    // accounts_differ chip is the dormant constant; the display value is the
    // CODE 'accounts_differ', never the human chip string.
    expect(displayValues).not.toContain(ACCOUNTS_DIFFER_DISPLAY_COPY.chip);
    expect(ACCOUNTS_DIFFER_DISPLAY_COPY.lead).toBe('The accounts do not line up.');
  });
});

// ── 6. Label parity — node chip == rail badge == distribution ──

describe('UX-IMPASSE-002 — label parity across surfaces', () => {
  it('value_tradeoff label is "Different priorities" everywhere', () => {
    expect(plainLanguageForMediatorState('value_tradeoff')).toBe('Different priorities');
    expect(MEDIATOR_STATE_COPY.value_tradeoff).toBe('Different priorities');
    expect(VALUE_TRADEOFF_DISPLAY_COPY.chip).toBe('Different priorities');
  });

  it('key_detail_unavailable label is "Key detail unavailable" everywhere', () => {
    expect(plainLanguageForMediatorState('key_detail_unavailable')).toBe('Key detail unavailable');
    expect(MEDIATOR_STATE_COPY.key_detail_unavailable).toBe('Key detail unavailable');
    expect(KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.chip).toBe('Key detail unavailable');
  });

  it('node chip label == distribution segment label for a value-axis point', () => {
    const board = boardFor({ primaryAxis: 'value' });
    const marker = getNodeMediatorMarker(board, 'n1');
    const dist = buildDisagreementDistribution(selectLivePoints(board));
    const segment = dist.find((s) => s.displayState === 'value_tradeoff');
    expect(marker?.label).toBe('Different priorities');
    expect(segment?.plainLabel).toBe('Different priorities');
    expect(marker?.label).toBe(segment?.plainLabel);
  });

  it('node chip label == distribution segment label for a context-limit point', () => {
    const board = boardFor({
      obs: [makeObs('n2', 'evidence_source_chain', 'flags_context_limit', 'medium')],
    });
    const marker = getNodeMediatorMarker(board, 'n1');
    const dist = buildDisagreementDistribution(selectLivePoints(board));
    const segment = dist.find((s) => s.displayState === 'key_detail_unavailable');
    expect(marker?.label).toBe('Key detail unavailable');
    expect(segment?.plainLabel).toBe('Key detail unavailable');
    expect(marker?.label).toBe(segment?.plainLabel);
  });
});

// ── 7. No chip soup ────────────────────────────────────────────

describe('UX-IMPASSE-002 — no chip soup', () => {
  it('a single value-axis point produces exactly one node marker and one distribution segment', () => {
    const board = boardFor({ primaryAxis: 'value' });
    const live = selectLivePoints(board);
    expect(live).toHaveLength(1);
    const dist = buildDisagreementDistribution(live);
    expect(dist).toHaveLength(1);
    expect(dist[0].displayState).toBe('value_tradeoff');
    expect(dist[0].count).toBe(1);
    expect(totalDistributionCount(dist)).toBe(1);
    expect(getNodeMediatorMarker(board, 'n1')?.code).toBe('value_tradeoff');
  });

  it('a key_detail_unavailable point with NO open evidence debt shows the chip and no rail evidence line', () => {
    const board = boardFor({
      obs: [makeObs('n2', 'evidence_source_chain', 'flags_context_limit', 'medium')],
    });
    expect(board.points[0].state).toBe('key_detail_unavailable');
    expect(getNodeMediatorMarker(board, 'n1')?.label).toBe('Key detail unavailable');
    // getEvidenceDebtForPoint returns null when there is no OPEN evidence debt,
    // so the rail never renders an "Evidence blocked" evidence line for it.
    expect(getEvidenceDebtForPoint(board, board.points[0].id)).toBeNull();
  });
});

// ── 8. Inspect copy + next-move ban-list ───────────────────────

describe('UX-IMPASSE-002 — Inspect + next-move ban-list clean', () => {
  const mediatorBan = _forbiddenMediatorTokens();
  const nextMoveBan = _forbiddenNextMoveTokens();

  function assertClean(label: string, value: string, ban: string[]): void {
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
    const lower = value.toLowerCase().split('right now').join('');
    for (const token of ban) {
      expect(`${label} :: ${lower}`).not.toContain(token);
    }
    expect(value).not.toMatch(/[a-z]+_[a-z]+/);
  }

  it('helperForMediatorState is non-empty + ban-list clean for both surfaced states', () => {
    assertClean('value_tradeoff.helper', helperForMediatorState('value_tradeoff'), mediatorBan);
    assertClean('key_detail.helper', helperForMediatorState('key_detail_unavailable'), mediatorBan);
  });

  it('the helper carries the operator Lead + Help wording', () => {
    expect(helperForMediatorState('value_tradeoff')).toContain('This point turns on a value tradeoff.');
    expect(helperForMediatorState('value_tradeoff')).toContain(
      'Name the priority being weighed, then decide whether the factual part can be narrowed.',
    );
    expect(helperForMediatorState('key_detail_unavailable')).toContain(
      'A key detail is not available to test here.',
    );
    expect(helperForMediatorState('key_detail_unavailable')).toContain(
      'Branch the part that can be checked, or preserve this point as unresolved.',
    );
  });

  it('every new next-move label + rationale passes the next-move ban-list', () => {
    for (const state of ['value_tradeoff', 'key_detail_unavailable'] as V4MediatorStateCode[]) {
      for (const move of nextMovesForState(state)) {
        assertClean(`${state}.label`, move.label, nextMoveBan);
        assertClean(`${state}.rationale`, move.rationale, nextMoveBan);
      }
    }
  });
});

// ── 9. evidence_blocked byte-identical regression (LOCKED) ─────

describe('UX-IMPASSE-002 — evidence_blocked stays byte-identical', () => {
  it('the evidence_blocked helper is byte-identical to the shipped string', () => {
    expect(helperForMediatorState('evidence_blocked')).toBe(EVIDENCE_BLOCKED_HELPER);
  });

  it('the evidence_blocked chip + rail labels are unchanged', () => {
    expect(MEDIATOR_STATE_COPY.evidence_blocked).toBe('Evidence blocked');
    expect(DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath).toBe('Evidence blocked');
    expect(IMPASSE_SUBTYPE_COPY.evidence_blocked.lead).toBe(
      'The evidence path is not available right now.',
    );
    expect(IMPASSE_SUBTYPE_COPY.evidence_blocked.help).toBe(
      'Name what kind of record would test this point, without demanding private access.',
    );
  });

  it('a TRUE evidence_blocked point (declined debt) still maps to evidence_blocked', () => {
    const board = boardFor({ debts: [makeDebt({ id: 'd', nodeId: 'n1', status: 'unresolved' })] });
    expect(board.points[0].state).toBe('evidence_blocked');
    expect(v4DisplayStateFor(board.points[0].state)).toBe('evidence_blocked');
    expect(plainLanguageForMediatorState(board.points[0].state)).toBe('Evidence blocked');
  });
});

// ── 10. Fallback — insufficient signal never escalates ─────────

describe('UX-IMPASSE-002 — fallback never escalates', () => {
  it('a no-signal cluster falls back to open (never value_tradeoff)', () => {
    const board = boardFor({ lifecycle: 'open' });
    expect(board.points[0].state).toBe('open');
    expect(v4DisplayStateFor(board.points[0].state)).toBe('open');
  });

  it('an exhausted cluster with no available pathway stays structured_impasse', () => {
    const board = boardFor({ lifecycle: 'exhausted' });
    expect(board.points[0].state).toBe('structured_impasse');
    expect(v4DisplayStateFor(board.points[0].state)).toBe('structured_impasse');
  });

  it('an unknown display state collapses to the Open move set (totality)', () => {
    const moves = nextMovesForState('not_a_state' as unknown as V4MediatorStateCode);
    expect(moves[0].label).toBe('Respond to the exact point');
  });
});

// ── 11. Next-move dominant labels ──────────────────────────────

describe('UX-IMPASSE-002 — next-move dominant labels', () => {
  it('value_tradeoff dominant is "Name the tradeoff" (single move, available)', () => {
    const moves = nextMovesForState('value_tradeoff');
    expect(moves[0].label).toBe('Name the tradeoff');
    expect(moves[0].isDominant).toBe(true);
    expect(moves[0].stepCode).toBe('name_tradeoff');
    expect(moves[0].available).toBe(true);
    expect(moves).toHaveLength(1);
  });

  it('key_detail_unavailable dominant is "Branch the provable part" (reuses the evidence shape)', () => {
    const moves = nextMovesForState('key_detail_unavailable');
    expect(moves[0].label).toBe('Branch the provable part');
    expect(moves[0].isDominant).toBe(true);
    expect(moves[0].stepCode).toBe('narrow_or_branch');
    expect(moves[0].available).toBe(true);
    expect(moves.map((m) => m.label)).toEqual([
      'Branch the provable part',
      'Name what kind of record would test this point',
    ]);
  });

  it('every dominant stepCode is an existing ResolutionPathwayStepCode', () => {
    const KNOWN_STEPS = new Set([
      'provide_source',
      'define_term',
      'narrow_or_branch',
      'respond_to_point',
      'name_tradeoff',
      'supply_mechanism',
      'await_record',
    ]);
    for (const state of ['value_tradeoff', 'key_detail_unavailable'] as V4MediatorStateCode[]) {
      for (const move of nextMovesForState(state)) {
        expect(KNOWN_STEPS.has(move.stepCode)).toBe(true);
      }
    }
  });
});
