/**
 * MCP-MOD-008 — `useSemanticReferee.onMovePosted` end-to-end with the
 * move-position rule + full-thread context.
 *
 * Mocks `classifyMove` at the module boundary; drives the hook through a
 * synthetic 5-move room. Asserts:
 *
 *   1. The first move by each participant triggers NO classify call.
 *   2. From each participant's SECOND move onward, classify fires with the
 *      full thread context attached.
 *   3. Aliases are STABLE — author A is always 'A'; author B is always 'B';
 *      author C (chime-in) is always 'C', regardless of the move under
 *      classification.
 *   4. No raw user id / display name / email leaves the hook — only aliases.
 */
import { renderHook, act } from '@testing-library/react-native';

jest.mock('../src/lib/edgeFunctions', () => ({
  classifyMove: jest.fn(),
}));

import { classifyMove } from '../src/lib/edgeFunctions';
import type { ClassifyMoveFunctionResult } from '../src/lib/edgeFunctions';
import { useSemanticReferee } from '../src/features/arguments/useSemanticReferee';
import { VALID_FIXTURES } from '../src/features/semanticReferee/semanticRefereeFixtures';

const classifyMoveMock = classifyMove as jest.MockedFunction<typeof classifyMove>;

function mockEnabled(): void {
  classifyMoveMock.mockResolvedValue({
    ok: true,
    data: { enabled: true, packet: VALID_FIXTURES.validContinuity },
  } as ClassifyMoveFunctionResult);
}

beforeEach(() => {
  classifyMoveMock.mockReset();
});

/** The 5-move synthetic room used by every test in this file. */
const ROOM = {
  roomId: 'room-thread',
  authorA: 'user-affirmative',
  authorB: 'user-negative',
  authorC: 'user-chime',
};

const M1 = { id: 'm-1', authorId: ROOM.authorA, body: 'A1 opening statement.' };
const M2 = { id: 'm-2', authorId: ROOM.authorB, body: 'B1 first rebuttal.' };
const M3 = { id: 'm-3', authorId: ROOM.authorA, body: 'A2 second move by A.' };
const M4 = { id: 'm-4', authorId: ROOM.authorB, body: 'B2 second move by B.' };
const M5 = { id: 'm-5', authorId: ROOM.authorC, body: 'C1 chime-in first contribution.' };

describe('MCP-MOD-008 useSemanticReferee — first-move skip', () => {
  it("makes ZERO classifyMove calls for A's first move (the opening)", async () => {
    mockEnabled();
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M1.id,
        parentId: null,
        body: M1.body,
        parentBody: null,
        participantSide: 'affirmative',
        authorId: M1.authorId,
        priorMoves: [], // nothing posted yet
      });
    });
    expect(classifyMoveMock).not.toHaveBeenCalled();
  });

  it("makes ZERO classifyMove calls for B's first move (first rebuttal)", async () => {
    mockEnabled();
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M2.id,
        parentId: M1.id,
        body: M2.body,
        parentBody: M1.body,
        participantSide: 'negative',
        authorId: M2.authorId,
        priorMoves: [M1],
      });
    });
    expect(classifyMoveMock).not.toHaveBeenCalled();
  });

  it("makes ZERO classifyMove calls for C's first move (chime-in joins late)", async () => {
    mockEnabled();
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M5.id,
        parentId: M4.id,
        body: M5.body,
        parentBody: M4.body,
        participantSide: 'affirmative',
        authorId: M5.authorId,
        priorMoves: [M1, M2, M3, M4],
      });
    });
    expect(classifyMoveMock).not.toHaveBeenCalled();
  });
});

describe('MCP-MOD-008 useSemanticReferee — second-move-onward classification with thread context', () => {
  it("fires classify for A's SECOND move (m-3); payload carries M1 + M2 in priorMovesRedacted", async () => {
    mockEnabled();
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M3.id,
        parentId: M2.id,
        body: M3.body,
        parentBody: M2.body,
        participantSide: 'affirmative',
        authorId: M3.authorId,
        priorMoves: [M1, M2],
      });
    });
    expect(classifyMoveMock).toHaveBeenCalled();
    // Every call's payload carries the priorMovesRedacted field with M1 + M2.
    for (const call of classifyMoveMock.mock.calls) {
      const payload = call[0];
      expect(payload.priorMovesRedacted).toBeDefined();
      expect(payload.priorMovesRedacted).toHaveLength(2);
      // Aliases are derived chronologically: A = first distinct, B = second.
      expect(payload.priorMovesRedacted![0].authorAlias).toBe('A');
      expect(payload.priorMovesRedacted![1].authorAlias).toBe('B');
      // Bodies arrive redacted by the client first pass.
      expect(payload.priorMovesRedacted![0].bodyRedacted).toContain('A1 opening');
      expect(payload.priorMovesRedacted![1].bodyRedacted).toContain('B1 first');
    }
  });

  it("fires classify for B's SECOND move (m-4); payload carries M1 + M2 + M3 in priorMovesRedacted", async () => {
    mockEnabled();
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M4.id,
        parentId: M3.id,
        body: M4.body,
        parentBody: M3.body,
        participantSide: 'negative',
        authorId: M4.authorId,
        priorMoves: [M1, M2, M3],
      });
    });
    expect(classifyMoveMock).toHaveBeenCalled();
    for (const call of classifyMoveMock.mock.calls) {
      const payload = call[0];
      expect(payload.priorMovesRedacted).toHaveLength(3);
      expect(payload.priorMovesRedacted!.map((m) => m.authorAlias)).toEqual([
        'A',
        'B',
        'A',
      ]);
    }
  });
});

describe('MCP-MOD-008 useSemanticReferee — alias stability', () => {
  it('A is always A and B is always B, no matter which move triggered the call', async () => {
    mockEnabled();
    const { result } = renderHook(() => useSemanticReferee());

    // Drive A's second move first; record the alias map.
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M3.id,
        body: M3.body,
        parentBody: M2.body,
        participantSide: 'affirmative',
        authorId: M3.authorId,
        priorMoves: [M1, M2],
      });
    });
    const callsForM3 = classifyMoveMock.mock.calls.slice();
    classifyMoveMock.mockClear();

    // Now drive B's second move.
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M4.id,
        body: M4.body,
        parentBody: M3.body,
        participantSide: 'negative',
        authorId: M4.authorId,
        priorMoves: [M1, M2, M3],
      });
    });
    const callsForM4 = classifyMoveMock.mock.calls.slice();

    // The author of M1 (= A) must carry the same alias across both calls.
    const m3PriorM1Alias = callsForM3[0][0].priorMovesRedacted!.find((m) =>
      m.bodyRedacted.includes('A1 opening'),
    )!.authorAlias;
    const m4PriorM1Alias = callsForM4[0][0].priorMovesRedacted!.find((m) =>
      m.bodyRedacted.includes('A1 opening'),
    )!.authorAlias;
    expect(m3PriorM1Alias).toBe('A');
    expect(m4PriorM1Alias).toBe('A');

    // Same for B.
    const m3PriorM2Alias = callsForM3[0][0].priorMovesRedacted!.find((m) =>
      m.bodyRedacted.includes('B1 first'),
    )!.authorAlias;
    const m4PriorM2Alias = callsForM4[0][0].priorMovesRedacted!.find((m) =>
      m.bodyRedacted.includes('B1 first'),
    )!.authorAlias;
    expect(m3PriorM2Alias).toBe('B');
    expect(m4PriorM2Alias).toBe('B');
  });
});

describe('MCP-MOD-008 useSemanticReferee — privacy guarantee at the boundary', () => {
  it('no raw user id / display name / email enters the priorMovesRedacted entries', async () => {
    mockEnabled();
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M3.id,
        body: M3.body,
        parentBody: M2.body,
        participantSide: 'affirmative',
        authorId: M3.authorId,
        priorMoves: [M1, M2],
      });
    });
    expect(classifyMoveMock).toHaveBeenCalled();
    const payload = classifyMoveMock.mock.calls[0][0];
    for (const entry of payload.priorMovesRedacted!) {
      // Aliases are short, capital-letter strings; never a raw id.
      expect(entry.authorAlias).toMatch(/^[A-Z]+$/);
      expect(entry.authorAlias).not.toContain(ROOM.authorA);
      expect(entry.authorAlias).not.toContain(ROOM.authorB);
      expect(entry.authorAlias).not.toContain(ROOM.authorC);
      // The body NEVER contains a raw user id.
      expect(entry.bodyRedacted).not.toContain(ROOM.authorA);
      expect(entry.bodyRedacted).not.toContain(ROOM.authorB);
      expect(entry.bodyRedacted).not.toContain(ROOM.authorC);
    }
  });
});

describe('MCP-MOD-008 useSemanticReferee — backward compat path', () => {
  it('omits priorMovesRedacted from the payload when priorMoves is absent (existing call sites unchanged)', async () => {
    mockEnabled();
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        roomId: ROOM.roomId,
        moveId: M3.id,
        body: M3.body,
        parentBody: M2.body,
        participantSide: 'affirmative',
        // No authorId, no priorMoves — pre-MCP-MOD-008 caller.
      });
    });
    expect(classifyMoveMock).toHaveBeenCalled();
    for (const call of classifyMoveMock.mock.calls) {
      // The pre-MCP-MOD-008 payload shape: no priorMovesRedacted field at all.
      expect(call[0].priorMovesRedacted).toBeUndefined();
    }
  });
});
