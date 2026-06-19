/**
 * UX-MEDIATOR-003 — evidence-debt display selector tests.
 *
 * Pure-model tests over the display selector: it SELECTS from a pre-built
 * MediatorBoardState (no derivation), is deterministic, JSON-serializable, and
 * never mutates the input board.
 */
import {
  deriveEvidenceDebtDisplay,
  getBlockedEvidencePathsForPoint,
  getEvidenceDebtForPoint,
} from '../src/features/mediator/evidenceDebtDisplay';
import type {
  BlockedEvidencePath,
  EvidenceDebtView,
  MediatorBoardState,
} from '../src/features/mediator';

function makeView(p: Partial<EvidenceDebtView> & { pointId: string }): EvidenceDebtView {
  return {
    debtId: p.debtId ?? `${p.pointId}:debt`,
    nodeId: p.nodeId ?? p.pointId,
    pointId: p.pointId,
    kind: p.kind ?? 'source',
    status: p.status ?? 'requested',
    isOpen: p.isOpen ?? true,
    isBlocked: p.isBlocked ?? false,
    plainLabel: p.plainLabel ?? 'Needs evidence',
  };
}

function makeBoard(opts: {
  evidenceDebts?: EvidenceDebtView[];
  blockedEvidencePaths?: BlockedEvidencePath[];
}): MediatorBoardState {
  return {
    debateId: 'debate-1',
    points: [],
    markupByNodeId: {},
    evidenceDebts: opts.evidenceDebts ?? [],
    blockedEvidencePaths: opts.blockedEvidencePaths ?? [],
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

describe('UX-MEDIATOR-003 getEvidenceDebtForPoint', () => {
  it('returns null when the point has no open evidence debt', () => {
    expect(getEvidenceDebtForPoint(makeBoard({}), 'p1')).toBeNull();
    const closedOnly = makeBoard({ evidenceDebts: [makeView({ pointId: 'p1', isOpen: false })] });
    expect(getEvidenceDebtForPoint(closedOnly, 'p1')).toBeNull();
  });

  it('returns one display item for an open source debt', () => {
    const board = makeBoard({ evidenceDebts: [makeView({ pointId: 'p1', kind: 'source' })] });
    const d = getEvidenceDebtForPoint(board, 'p1');
    expect(d).not.toBeNull();
    expect(d?.openCount).toBe(1);
    expect(d?.kindWords).toEqual(['source']);
    expect(d?.kindsLine).toBe('source');
    expect(d?.isBlocked).toBe(false);
  });

  it('dedupes + sorts kind words across multiple open debts', () => {
    const board = makeBoard({
      evidenceDebts: [
        makeView({ pointId: 'p1', debtId: 'a', kind: 'source' }),
        makeView({ pointId: 'p1', debtId: 'b', kind: 'quote' }),
        makeView({ pointId: 'p1', debtId: 'c', kind: 'source' }),
        makeView({ pointId: 'p1', debtId: 'd', kind: 'primary_record' }),
      ],
    });
    const d = getEvidenceDebtForPoint(board, 'p1');
    expect(d?.openCount).toBe(4);
    expect(d?.kindWords).toEqual(['primary record', 'quote', 'source']);
  });

  it('marks blocked when a debt is blocked OR a blocked path exists (only when supported)', () => {
    const viaDebt = makeBoard({ evidenceDebts: [makeView({ pointId: 'p1', isBlocked: true })] });
    expect(getEvidenceDebtForPoint(viaDebt, 'p1')?.isBlocked).toBe(true);

    const viaPath = makeBoard({
      evidenceDebts: [makeView({ pointId: 'p1' })],
      blockedEvidencePaths: [{ pointId: 'p1', nodeId: 'p1', debtId: null, artifactCategory: 'record', plainLabel: 'Evidence blocked' }],
    });
    expect(getEvidenceDebtForPoint(viaPath, 'p1')?.isBlocked).toBe(true);

    const notBlocked = makeBoard({ evidenceDebts: [makeView({ pointId: 'p1' })] });
    expect(getEvidenceDebtForPoint(notBlocked, 'p1')?.isBlocked).toBe(false);
  });

  it('getBlockedEvidencePathsForPoint filters by point', () => {
    const board = makeBoard({
      blockedEvidencePaths: [
        { pointId: 'p1', nodeId: 'n1', debtId: null, artifactCategory: null, plainLabel: 'Evidence blocked' },
        { pointId: 'p2', nodeId: 'n2', debtId: null, artifactCategory: null, plainLabel: 'Evidence blocked' },
      ],
    });
    expect(getBlockedEvidencePathsForPoint(board, 'p1')).toHaveLength(1);
    expect(getBlockedEvidencePathsForPoint(board, 'p1')[0].pointId).toBe('p1');
  });

  it('is deterministic and does not mutate the input board', () => {
    const debts = [makeView({ pointId: 'p1', kind: 'quote' }), makeView({ pointId: 'p1', debtId: 'x', kind: 'source' })];
    const board = makeBoard({ evidenceDebts: debts });
    const snapshot = JSON.stringify(board);
    Object.freeze(debts);
    Object.freeze(board.evidenceDebts);
    const first = getEvidenceDebtForPoint(board, 'p1');
    const second = getEvidenceDebtForPoint(board, 'p1');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it('output is JSON-serializable', () => {
    const board = makeBoard({ evidenceDebts: [makeView({ pointId: 'p1' })] });
    const d = getEvidenceDebtForPoint(board, 'p1');
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });

  it('handles null/empty board inputs', () => {
    expect(getEvidenceDebtForPoint(null, 'p1')).toBeNull();
    expect(getBlockedEvidencePathsForPoint(null, 'p1')).toEqual([]);
    expect(deriveEvidenceDebtDisplay(null)).toEqual({});
  });
});

describe('UX-MEDIATOR-003 deriveEvidenceDebtDisplay', () => {
  it('indexes only points with open evidence debt', () => {
    const board = makeBoard({
      evidenceDebts: [
        makeView({ pointId: 'p1', kind: 'source' }),
        makeView({ pointId: 'p2', isOpen: false }),
        makeView({ pointId: 'p3', kind: 'quote' }),
      ],
    });
    const map = deriveEvidenceDebtDisplay(board);
    expect(Object.keys(map).sort()).toEqual(['p1', 'p3']);
    expect(map.p1.kindsLine).toBe('source');
  });

  it('is deterministic', () => {
    const board = makeBoard({ evidenceDebts: [makeView({ pointId: 'p1' }), makeView({ pointId: 'p2', debtId: 'y' })] });
    expect(JSON.stringify(deriveEvidenceDebtDisplay(board))).toBe(
      JSON.stringify(deriveEvidenceDebtDisplay(board)),
    );
  });
});
