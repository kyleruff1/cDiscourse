/**
 * UX-MEDIATOR-002 — node-level mediator marker selection tests.
 *
 * Pure-model tests over the selection helper: priority ordering, one marker per
 * node, suppression of non-actionable states, deviation handling, and
 * determinism. No derivation logic is re-implemented here — the helper only
 * selects from a pre-built MediatorBoardState.markupByNodeId.
 */
import {
  NODE_MARKER_PRIORITY,
  deriveNodeMediatorMarkers,
  getNodeMediatorMarker,
  isShowableNodeMarker,
} from '../src/features/mediator/nodeMediatorMarkers';
import type {
  MediatorBoardState,
  MediatorMarkup,
  MediatorStateCode,
  NodeDeviation,
} from '../src/features/mediator';

function makeDeviation(kind: 'off_point' | 'scope_mismatch'): NodeDeviation {
  return { kind, plainLabel: kind === 'off_point' ? 'Off-point response' : 'Scope mismatch', postAnywayAlwaysAvailable: true };
}

function makeMarkup(
  p: Partial<MediatorMarkup> & { nodeId: string; primaryState: MediatorStateCode },
): MediatorMarkup {
  return {
    nodeId: p.nodeId,
    pointId: p.pointId ?? p.nodeId,
    primaryState: p.primaryState,
    deviation: p.deviation ?? null,
    evidenceDebtChipStatus: p.evidenceDebtChipStatus ?? null,
    confidence: p.confidence ?? 'medium',
  };
}

function makeBoard(markups: MediatorMarkup[]): MediatorBoardState {
  const markupByNodeId: Record<string, MediatorMarkup> = {};
  for (const m of markups) markupByNodeId[m.nodeId] = m;
  return {
    debateId: 'debate-1',
    points: [],
    markupByNodeId,
    evidenceDebts: [],
    blockedEvidencePaths: [],
    definitionMismatches: [],
    scopeMismatches: [],
    recollectionConflicts: [],
    nonProvableKeyDetails: [],
    impasses: [],
    pathwaysByPointId: {},
    nextAction: null,
    inputHash: 'h1',
  };
}

describe('UX-MEDIATOR-002 getNodeMediatorMarker', () => {
  it('returns null for an ordinary open node (suppressed)', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'open' })]);
    expect(getNodeMediatorMarker(board, 'n1')).toBeNull();
  });

  it('returns null for a resolved/settled node and for accounts_differ', () => {
    const board = makeBoard([
      makeMarkup({ nodeId: 'r', primaryState: 'resolved_or_settled' }),
      makeMarkup({ nodeId: 'a', primaryState: 'accounts_differ' }),
    ]);
    expect(getNodeMediatorMarker(board, 'r')).toBeNull();
    expect(getNodeMediatorMarker(board, 'a')).toBeNull();
  });

  it('returns a Needs evidence marker for an evidence-debt node', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'needs_evidence' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    expect(marker).not.toBeNull();
    expect(marker?.code).toBe('needs_evidence');
    expect(marker?.label).toBe('Needs evidence');
    expect(marker?.isImpasse).toBe(false);
  });

  it('flags structured impasse', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'structured_impasse' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    expect(marker?.code).toBe('structured_impasse');
    expect(marker?.label).toBe('Structured impasse');
    expect(marker?.isImpasse).toBe(true);
  });

  it('shows a node deviation even when the point state is suppressed (open)', () => {
    // UX-MEDIATOR-002 O-1: selection still considers the internal `off_point`
    // deviation, but the chip is projected onto the v4 display vocabulary —
    // `off_point` collapses to the "Scope mismatch" display state.
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'open', deviation: makeDeviation('off_point') })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    expect(marker?.code).toBe('scope_mismatch');
    expect(marker?.label).toBe('Scope mismatch');
  });

  it('projects the v4 display vocabulary on the chip (O-1)', () => {
    // key_detail_unavailable → evidence_blocked ("Blocked evidence path").
    const blocked = makeBoard([makeMarkup({ nodeId: 'k', primaryState: 'key_detail_unavailable' })]);
    const blockedMarker = getNodeMediatorMarker(blocked, 'k');
    expect(blockedMarker?.code).toBe('evidence_blocked');
    expect(blockedMarker?.label).toBe('Blocked evidence path');

    // missing_mechanism is unchanged by the projection — keeps "Missing link".
    const link = makeBoard([makeMarkup({ nodeId: 'm', primaryState: 'missing_mechanism' })]);
    const linkMarker = getNodeMediatorMarker(link, 'm');
    expect(linkMarker?.code).toBe('missing_mechanism');
    expect(linkMarker?.label).toBe('Missing link');

    // definition_not_shared renders the v4 "Definition not shared" label
    // (renamed by UX-MEDIATOR-004; the internal code is unchanged).
    const def = makeBoard([makeMarkup({ nodeId: 'd', primaryState: 'definition_not_shared' })]);
    const defMarker = getNodeMediatorMarker(def, 'd');
    expect(defMarker?.code).toBe('definition_not_shared');
    expect(defMarker?.label).toBe('Definition not shared');
  });

  it('display-suppresses value_tradeoff (projects to open → no chip)', () => {
    // UX-MEDIATOR-002 O-1: value_tradeoff collapses to the display `open`
    // state, which is non-actionable — the node carries NO chip.
    const board = makeBoard([makeMarkup({ nodeId: 'vt', primaryState: 'value_tradeoff' })]);
    expect(getNodeMediatorMarker(board, 'vt')).toBeNull();
  });

  it('keeps the highest-priority candidate when point state and deviation both apply', () => {
    // needs_evidence outranks scope_mismatch in NODE_MARKER_PRIORITY.
    const board = makeBoard([
      makeMarkup({ nodeId: 'n1', primaryState: 'needs_evidence', deviation: makeDeviation('scope_mismatch') }),
    ]);
    expect(getNodeMediatorMarker(board, 'n1')?.code).toBe('needs_evidence');
    // structured_impasse outranks an off_point deviation.
    const board2 = makeBoard([
      makeMarkup({ nodeId: 'n2', primaryState: 'structured_impasse', deviation: makeDeviation('off_point') }),
    ]);
    expect(getNodeMediatorMarker(board2, 'n2')?.code).toBe('structured_impasse');
  });

  it('returns null for unknown node ids / null inputs', () => {
    const board = makeBoard([makeMarkup({ nodeId: 'n1', primaryState: 'needs_evidence' })]);
    expect(getNodeMediatorMarker(board, 'missing')).toBeNull();
    expect(getNodeMediatorMarker(board, null)).toBeNull();
    expect(getNodeMediatorMarker(null, 'n1')).toBeNull();
  });

  it('isShowableNodeMarker rejects open/resolved/accounts_differ and accepts actionable states', () => {
    expect(isShowableNodeMarker('open')).toBe(false);
    expect(isShowableNodeMarker('resolved_or_settled')).toBe(false);
    expect(isShowableNodeMarker('accounts_differ')).toBe(false);
    expect(isShowableNodeMarker('needs_evidence')).toBe(true);
    expect(isShowableNodeMarker('structured_impasse')).toBe(true);
    expect(NODE_MARKER_PRIORITY[0]).toBe('structured_impasse');
  });
});

describe('UX-MEDIATOR-002 deriveNodeMediatorMarkers', () => {
  it('indexes only nodes with actionable markers (open/resolved omitted)', () => {
    const board = makeBoard([
      makeMarkup({ nodeId: 'open1', primaryState: 'open' }),
      makeMarkup({ nodeId: 'ev', primaryState: 'needs_evidence' }),
      makeMarkup({ nodeId: 'imp', primaryState: 'structured_impasse' }),
      makeMarkup({ nodeId: 'done', primaryState: 'resolved_or_settled' }),
    ]);
    const map = deriveNodeMediatorMarkers(board);
    expect(Object.keys(map).sort()).toEqual(['ev', 'imp']);
    expect(map.ev.code).toBe('needs_evidence');
    expect(map.imp.isImpasse).toBe(true);
  });

  it('is deterministic across repeated runs', () => {
    const board = makeBoard([
      makeMarkup({ nodeId: 'n1', primaryState: 'needs_evidence' }),
      makeMarkup({ nodeId: 'n2', primaryState: 'scope_mismatch' }),
    ]);
    expect(JSON.stringify(deriveNodeMediatorMarkers(board))).toBe(
      JSON.stringify(deriveNodeMediatorMarkers(board)),
    );
  });

  it('returns an empty map for a null board', () => {
    expect(deriveNodeMediatorMarkers(null)).toEqual({});
  });
});
