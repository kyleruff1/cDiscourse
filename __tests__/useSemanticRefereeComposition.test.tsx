/**
 * COMP-001 (review suggestion §1) — hook-level integration test for
 * `getMutationsForMove` / `getCompositionState`.
 *
 * Drives `useSemanticReferee` end-to-end with a mocked `classifyMove` and
 * asserts that across multiple posted moves, the composition layer
 * accumulates mutations and surfaces them via the new public methods.
 */

import { renderHook, act } from '@testing-library/react-native';

jest.mock('../src/lib/edgeFunctions', () => ({
  classifyMove: jest.fn(),
}));

import { classifyMove } from '../src/lib/edgeFunctions';
import type { ClassifyMoveFunctionResult } from '../src/lib/edgeFunctions';
import { useSemanticReferee } from '../src/features/arguments/useSemanticReferee';
import type {
  SemanticBinarySample,
  SemanticClassifierId,
  SemanticRefereePacket,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import { PACKET_VERSION } from '../src/features/semanticReferee/semanticRefereeTypes';

const classifyMoveMock = classifyMove as jest.MockedFunction<typeof classifyMove>;

function makePacket(
  binaries: Array<{ classifierId: SemanticClassifierId; value: 0 | 1 }>,
  overrides?: Partial<SemanticRefereePacket>,
): SemanticRefereePacket {
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: 'h',
    contentHash: 'h',
    roomId: 'r',
    binaries: binaries.map((b) => ({
      classifierId: b.classifierId,
      value: b.value,
      confidence: 'high',
      reasonCode: `${b.classifierId}_test`,
    })) as readonly SemanticBinarySample[],
    routeSuggestion: 'no_route_change',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 0,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
    ...overrides,
  };
}

beforeEach(() => {
  classifyMoveMock.mockReset();
});

describe('useSemanticReferee — COMP-001 composition surface', () => {
  it('exposes getMutationsForMove and getCompositionState additively', () => {
    const { result } = renderHook(() => useSemanticReferee());
    expect(typeof result.current.getMutationsForMove).toBe('function');
    expect(typeof result.current.getCompositionState).toBe('function');
  });

  it('returns an empty array for unknown move ids', () => {
    const { result } = renderHook(() => useSemanticReferee());
    expect(result.current.getMutationsForMove('unknown')).toEqual([]);
  });

  it('returns EMPTY_COMPOSITION_STATE before any move is posted', () => {
    const { result } = renderHook(() => useSemanticReferee());
    const state = result.current.getCompositionState();
    expect(state.evidenceDebts.size).toBe(0);
    expect(state.synthesisReadiness.ready).toBe(false);
  });

  it('after a successful classify, mutations land in getMutationsForMove keyed by targetMoveId', async () => {
    // Mock returns a packet that fires R-EV-01 (asks_for_evidence=1).
    classifyMoveMock.mockResolvedValue({
      ok: true,
      data: {
        enabled: true,
        packet: makePacket([
          { classifierId: 'asks_for_evidence', value: 1 },
          { classifierId: 'responds_to_parent', value: 1 },
        ]),
      },
    } as ClassifyMoveFunctionResult);

    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      // No authorId / priorMoves supplied — preserves the pre-MCP-MOD-008
      // gate behavior so the classify call fires (otherwise the first-move
      // skip would exempt this move).
      await result.current.onMovePosted({
        roomId: 'room-1',
        moveId: 'move-2',
        parentId: 'move-1',
        body: 'Where is your source?',
        parentBody: 'X is true.',
        participantSide: 'affirmative',
      });
    });

    // R-EV-01 emits evidence_debt_opened on parent (move-1).
    const onParent = result.current.getMutationsForMove('move-1');
    expect(onParent.some((m) => m.mutation === 'evidence_debt_opened')).toBe(true);
    const debtState = result.current.getCompositionState();
    expect(debtState.evidenceDebts.size).toBeGreaterThan(0);
  });

  it('accumulates state across multiple posted moves in the same session', async () => {
    // Move 1: open an evidence debt against parent.
    classifyMoveMock.mockResolvedValueOnce({
      ok: true,
      data: {
        enabled: true,
        packet: makePacket([
          { classifierId: 'asks_for_evidence', value: 1 },
        ]),
      },
    } as ClassifyMoveFunctionResult);
    classifyMoveMock.mockResolvedValueOnce({
      ok: true,
      data: {
        enabled: true,
        packet: makePacket([]),
      },
    } as ClassifyMoveFunctionResult);
    // Move 2: a different move id, popularity-as-evidence.
    classifyMoveMock.mockResolvedValueOnce({
      ok: true,
      data: {
        enabled: true,
        packet: makePacket([
          { classifierId: 'uses_popularity_as_evidence', value: 1 },
        ]),
      },
    } as ClassifyMoveFunctionResult);
    classifyMoveMock.mockResolvedValueOnce({
      ok: true,
      data: {
        enabled: true,
        packet: makePacket([]),
      },
    } as ClassifyMoveFunctionResult);

    const { result } = renderHook(() => useSemanticReferee());

    // Omit authorId / priorMoves on both calls so the pre-MCP-MOD-008
    // trigger-gate behavior fires the classifier on both moves.
    await act(async () => {
      await result.current.onMovePosted({
        roomId: 'room-1',
        moveId: 'm-debt',
        parentId: 'm-target',
        body: 'Source?',
        parentBody: 'Claim.',
        participantSide: 'affirmative',
      });
    });

    await act(async () => {
      await result.current.onMovePosted({
        roomId: 'room-1',
        moveId: 'm-pop',
        parentId: 'm-target',
        body: 'Many say so.',
        parentBody: 'Claim.',
        participantSide: 'affirmative',
      });
    });

    // Both mutations should be in the lookup.
    const onTarget = result.current.getMutationsForMove('m-target');
    expect(onTarget.some((m) => m.mutation === 'evidence_debt_opened')).toBe(true);
    const onPop = result.current.getMutationsForMove('m-pop');
    expect(onPop.some((m) => m.mutation === 'popularity_amplification_warning')).toBe(true);
  });

  it('a fallback (classify returned { enabled: false }) does NOT touch composition state', async () => {
    classifyMoveMock.mockResolvedValue({
      ok: true,
      data: { enabled: false, reason: 'disabled' },
    } as ClassifyMoveFunctionResult);

    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        roomId: 'room-1',
        moveId: 'm-1',
        body: 'hi',
        participantSide: 'affirmative',
      });
    });
    expect(result.current.getMutationsForMove('m-1')).toEqual([]);
    expect(result.current.getCompositionState().evidenceDebts.size).toBe(0);
  });
});
