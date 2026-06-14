/**
 * UX-MEDIATOR-004 — definition/scope bridge display selector tests.
 *
 * Pure-model tests over the display selector: it SELECTS from a pre-built
 * MediatorBoardState (no derivation), is deterministic, JSON-serializable, and
 * never mutates the input board. Primary choice respects board priority.
 */
import {
  deriveDefinitionScopeBridgeDisplay,
  getDefinitionMismatchesForPoint,
  getDefinitionScopeBridgeForPoint,
  getScopeMismatchesForPoint,
} from '../src/features/mediator/definitionScopeBridgeDisplay';
import { plainLanguageForMediatorState } from '../src/features/mediator';
import type {
  DefinitionMismatch,
  DisagreementPoint,
  MediatorBoardState,
  MediatorStateCode,
  ScopeMismatch,
} from '../src/features/mediator';

function makePoint(
  p: Partial<DisagreementPoint> & { id: string; state: MediatorStateCode },
): DisagreementPoint {
  return {
    id: p.id,
    anchor: p.anchor ?? { nodeId: p.id, parentNodeId: null, targetExcerpt: null },
    kind: p.kind ?? 'unaxed',
    state: p.state,
    plainLabel: p.plainLabel ?? plainLanguageForMediatorState(p.state),
    lifecycleState: p.lifecycleState ?? 'open',
    confidence: p.confidence ?? 'medium',
    openEvidenceDebtIds: p.openEvidenceDebtIds ?? [],
    memberNodeIds: p.memberNodeIds ?? [p.id],
    isAdvisory: p.isAdvisory ?? false,
  };
}

function makeBoard(opts: {
  points?: DisagreementPoint[];
  definitionMismatches?: DefinitionMismatch[];
  scopeMismatches?: ScopeMismatch[];
}): MediatorBoardState {
  return {
    debateId: 'debate-1',
    points: opts.points ?? [],
    markupByNodeId: {},
    evidenceDebts: [],
    blockedEvidencePaths: [],
    definitionMismatches: opts.definitionMismatches ?? [],
    scopeMismatches: opts.scopeMismatches ?? [],
    recollectionConflicts: [],
    nonProvableKeyDetails: [],
    impasses: [],
    pathwaysByPointId: {},
    nextAction: null,
    inputHash: 'h1',
  };
}

describe('UX-MEDIATOR-004 getDefinitionScopeBridgeForPoint', () => {
  it('returns null for an ordinary point with no definition/scope marker', () => {
    const board = makeBoard({ points: [makePoint({ id: 'p1', state: 'open' })] });
    expect(getDefinitionScopeBridgeForPoint(board, 'p1')).toBeNull();
    expect(getDefinitionScopeBridgeForPoint(board, 'missing')).toBeNull();
  });

  it('returns a definition bridge when the point state is definition_not_shared', () => {
    const board = makeBoard({ points: [makePoint({ id: 'p1', state: 'definition_not_shared' })] });
    const b = getDefinitionScopeBridgeForPoint(board, 'p1');
    expect(b).not.toBeNull();
    expect(b?.hasDefinition).toBe(true);
    expect(b?.hasScope).toBe(false);
    expect(b?.primary).toBe('definition');
    expect(b?.secondary).toBeNull();
  });

  it('returns a scope bridge when the point state is scope_mismatch', () => {
    const board = makeBoard({ points: [makePoint({ id: 'p1', state: 'scope_mismatch' })] });
    const b = getDefinitionScopeBridgeForPoint(board, 'p1');
    expect(b?.hasScope).toBe(true);
    expect(b?.hasDefinition).toBe(false);
    expect(b?.primary).toBe('scope');
    expect(b?.secondary).toBeNull();
  });

  it('detects a definition bridge from a mismatch row even when state differs', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'open' })],
      definitionMismatches: [{ pointId: 'p1', nodeId: 'p1', proposedButNotConfirmed: false, confidence: 'medium' }],
    });
    const b = getDefinitionScopeBridgeForPoint(board, 'p1');
    expect(b?.hasDefinition).toBe(true);
    expect(b?.primary).toBe('definition');
  });

  it('when both are present, picks one primary deterministically and respects board priority', () => {
    // State says scope -> scope leads even though definition is also present (defensive both-signal board).
    const scopePriority = makeBoard({
      points: [makePoint({ id: 'p1', state: 'scope_mismatch' })],
      definitionMismatches: [{ pointId: 'p1', nodeId: 'p1', proposedButNotConfirmed: false, confidence: 'low' }],
      scopeMismatches: [{ pointId: 'p1', nodeId: 'p1', confidence: 'medium' }],
    });
    const sb = getDefinitionScopeBridgeForPoint(scopePriority, 'p1');
    expect(sb?.hasDefinition).toBe(true);
    expect(sb?.hasScope).toBe(true);
    expect(sb?.primary).toBe('scope');
    expect(sb?.secondary).toBe('definition');

    // No definitive state -> default preference is definition, scope summarised.
    const noStatePriority = makeBoard({
      points: [makePoint({ id: 'p1', state: 'open' })],
      definitionMismatches: [{ pointId: 'p1', nodeId: 'p1', proposedButNotConfirmed: false, confidence: 'low' }],
      scopeMismatches: [{ pointId: 'p1', nodeId: 'p1', confidence: 'low' }],
    });
    const nb = getDefinitionScopeBridgeForPoint(noStatePriority, 'p1');
    expect(nb?.primary).toBe('definition');
    expect(nb?.secondary).toBe('scope');
  });

  it('getDefinitionMismatchesForPoint / getScopeMismatchesForPoint filter by point', () => {
    const board = makeBoard({
      definitionMismatches: [
        { pointId: 'p1', nodeId: 'n1', proposedButNotConfirmed: false, confidence: 'medium' },
        { pointId: 'p2', nodeId: 'n2', proposedButNotConfirmed: true, confidence: 'low' },
      ],
      scopeMismatches: [{ pointId: 'p1', nodeId: 'n1', confidence: 'medium' }],
    });
    expect(getDefinitionMismatchesForPoint(board, 'p1')).toHaveLength(1);
    expect(getDefinitionMismatchesForPoint(board, 'p1')[0].pointId).toBe('p1');
    expect(getScopeMismatchesForPoint(board, 'p1')).toHaveLength(1);
    expect(getScopeMismatchesForPoint(board, 'p2')).toHaveLength(0);
  });

  it('is deterministic and does not mutate the input board', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'definition_not_shared' }), makePoint({ id: 'p2', state: 'scope_mismatch' })],
    });
    const snapshot = JSON.stringify(board);
    Object.freeze(board.points);
    Object.freeze(board.definitionMismatches);
    Object.freeze(board.scopeMismatches);
    const first = getDefinitionScopeBridgeForPoint(board, 'p1');
    const second = getDefinitionScopeBridgeForPoint(board, 'p1');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it('output is JSON-serializable', () => {
    const board = makeBoard({ points: [makePoint({ id: 'p1', state: 'definition_not_shared' })] });
    const b = getDefinitionScopeBridgeForPoint(board, 'p1');
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
  });

  it('handles null/empty board inputs', () => {
    expect(getDefinitionScopeBridgeForPoint(null, 'p1')).toBeNull();
    expect(getDefinitionMismatchesForPoint(null, 'p1')).toEqual([]);
    expect(getScopeMismatchesForPoint(null, 'p1')).toEqual([]);
    expect(deriveDefinitionScopeBridgeDisplay(null)).toEqual({});
  });
});

describe('UX-MEDIATOR-004 deriveDefinitionScopeBridgeDisplay', () => {
  it('indexes only points with a definition/scope marker', () => {
    const board = makeBoard({
      points: [
        makePoint({ id: 'p1', state: 'definition_not_shared' }),
        makePoint({ id: 'p2', state: 'open' }),
        makePoint({ id: 'p3', state: 'scope_mismatch' }),
        makePoint({ id: 'p4', state: 'needs_evidence' }),
      ],
    });
    const map = deriveDefinitionScopeBridgeDisplay(board);
    expect(Object.keys(map).sort()).toEqual(['p1', 'p3']);
    expect(map.p1.primary).toBe('definition');
    expect(map.p3.primary).toBe('scope');
  });

  it('is deterministic', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'definition_not_shared' }), makePoint({ id: 'p2', state: 'scope_mismatch' })],
    });
    expect(JSON.stringify(deriveDefinitionScopeBridgeDisplay(board))).toBe(
      JSON.stringify(deriveDefinitionScopeBridgeDisplay(board)),
    );
  });
});
