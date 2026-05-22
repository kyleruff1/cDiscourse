/**
 * MCP-019 — `useSemanticReferee` hook tests.
 *
 * The room hook is the only file that calls `classifyMove`. These tests mock
 * `classifyMove` at the module boundary and drive the hook through `onMovePosted`
 * / `confirmOverride` to verify the trigger gating, the cache-first order, the
 * ≤ 2-call batching, the §6.2 fallback matrix (every disabled reason + an
 * `ok:false` + a rejection), the success path, the low-confidence override, and
 * the in-memory override record.
 */
import { renderHook, act } from '@testing-library/react-native';

// classifyMove is mocked at the module boundary — no live call is ever made.
jest.mock('../src/lib/edgeFunctions', () => ({
  classifyMove: jest.fn(),
}));

import { classifyMove } from '../src/lib/edgeFunctions';
import type { ClassifyMoveFunctionResult } from '../src/lib/edgeFunctions';
import { useSemanticReferee } from '../src/features/arguments/useSemanticReferee';
import { VALID_FIXTURES } from '../src/features/semanticReferee/semanticRefereeFixtures';
import type { SemanticRefereePacket } from '../src/features/semanticReferee/semanticRefereeTypes';
import type { ClassifyMoveDisabledReason } from '../src/lib/edgeFunctions';

const classifyMoveMock = classifyMove as jest.MockedFunction<typeof classifyMove>;

/** Resolve every classifyMove call with a successful packet. */
function mockEnabled(packet: SemanticRefereePacket): void {
  classifyMoveMock.mockResolvedValue({
    ok: true,
    data: { enabled: true, packet },
  } as ClassifyMoveFunctionResult);
}

/** Resolve every classifyMove call with `{ enabled: false, reason }`. */
function mockDisabled(reason: ClassifyMoveDisabledReason): void {
  classifyMoveMock.mockResolvedValue({
    ok: true,
    data: { enabled: false, reason },
  } as ClassifyMoveFunctionResult);
}

const BASE_ARGS = {
  roomId: 'room-1',
  moveId: 'move-1',
  body: 'Bike lanes cut short car trips because cyclists replace them.',
  parentBody: 'Bike lanes are bad for the city.',
  participantSide: 'affirmative' as const,
};

beforeEach(() => {
  classifyMoveMock.mockReset();
});

describe('useSemanticReferee — trigger gating', () => {
  it('makes zero classifyMove calls when featureLayerEnabled is false', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() =>
      useSemanticReferee({ featureLayerEnabled: false }),
    );
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(classifyMoveMock).not.toHaveBeenCalled();
  });

  it('makes zero classifyMove calls when the room mode is off', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() =>
      useSemanticReferee({ semanticClassificationMode: 'off' }),
    );
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(classifyMoveMock).not.toHaveBeenCalled();
  });

  it('makes zero classifyMove calls for an observer actor', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({ ...BASE_ARGS, participantSide: 'observer' });
    });
    expect(classifyMoveMock).not.toHaveBeenCalled();
  });

  it('makes zero classifyMove calls for a moderator actor', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({ ...BASE_ARGS, participantSide: 'moderator' });
    });
    expect(classifyMoveMock).not.toHaveBeenCalled();
  });

  it('makes calls for a participant with the layer on', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(classifyMoveMock).toHaveBeenCalled();
  });
});

describe('useSemanticReferee — batching', () => {
  it('issues at most 2 classifyMove calls per post_submit', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(classifyMoveMock.mock.calls.length).toBeLessThanOrEqual(2);
    expect(classifyMoveMock.mock.calls.length).toBeGreaterThan(0);
  });

  it('never sends more than 5 requestedClassifiers in a single call', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    for (const call of classifyMoveMock.mock.calls) {
      expect(call[0].requestedClassifiers.length).toBeLessThanOrEqual(5);
      expect(call[0].requestedClassifiers.length).toBeGreaterThan(0);
    }
  });

  it('passes a redacted move body — a raw @handle never reaches classifyMove', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted({
        ...BASE_ARGS,
        body: 'I think @rawhandle is wrong about lanes.',
      });
    });
    for (const call of classifyMoveMock.mock.calls) {
      expect(call[0].moveBodyRedacted).not.toContain('@rawhandle');
    }
  });
});

describe('useSemanticReferee — cache-first', () => {
  it('a second onMovePosted for the same move makes zero additional calls', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    const callsAfterFirst = classifyMoveMock.mock.calls.length;
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(classifyMoveMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('a different move id is a cache miss — fresh calls fire', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    const callsAfterFirst = classifyMoveMock.mock.calls.length;
    await act(async () => {
      await result.current.onMovePosted({ ...BASE_ARGS, moveId: 'move-2' });
    });
    expect(classifyMoveMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});

describe('useSemanticReferee — fallback matrix (§6.2)', () => {
  const ALL_DISABLED_REASONS: ClassifyMoveDisabledReason[] = [
    'disabled',
    'not_configured',
    'not_implemented',
    'key_missing',
    'api_error',
    'rate_limited',
    'network_error',
    'parse_failure',
    'validation_failed',
  ];

  it.each(ALL_DISABLED_REASONS)(
    'an { enabled: false, reason: "%s" } result yields an inert fallback state',
    async (reason) => {
      mockDisabled(reason);
      const { result } = renderHook(() => useSemanticReferee());
      await act(async () => {
        await result.current.onMovePosted(BASE_ARGS);
      });
      const state = result.current.getMoveState('move-1');
      expect(state.status).toBe('fallback');
      expect(state.banner.banner).toBeNull();
      expect(state.overridePrompt.shouldOffer).toBe(false);
    },
  );

  it('an { ok: false } wrapper error yields an inert fallback state', async () => {
    classifyMoveMock.mockResolvedValue({
      ok: false,
      error: { error: 'network_error' },
      status: 503,
    } as ClassifyMoveFunctionResult);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(result.current.getMoveState('move-1').status).toBe('fallback');
  });

  it('a classifyMove promise rejection yields an inert fallback state', async () => {
    classifyMoveMock.mockRejectedValue(new Error('unexpected'));
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(result.current.getMoveState('move-1').status).toBe('fallback');
  });

  it('the hook surface exposes no error field', () => {
    const { result } = renderHook(() => useSemanticReferee());
    expect(result.current).not.toHaveProperty('error');
    expect(result.current).not.toHaveProperty('errorMessage');
  });

  it('an unknown move id returns an inert idle state', () => {
    const { result } = renderHook(() => useSemanticReferee());
    const state = result.current.getMoveState('never-classified');
    expect(state.status).toBe('idle');
    expect(state.banner.banner).toBeNull();
    expect(state.overridePrompt.shouldOffer).toBe(false);
  });
});

describe('useSemanticReferee — success path', () => {
  it('an { enabled: true, packet } yields a ready state with a deterministic banner', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    const state = result.current.getMoveState('move-1');
    expect(state.status).toBe('ready');
    expect(state.packet).toBeDefined();
    expect(state.banner).toHaveProperty('selectionTrace');
  });
});

describe('useSemanticReferee — low-confidence override', () => {
  it('a packet with a low-confidence routing binary offers the override prompt', async () => {
    // validConflictRouted has responds_to_parent at confidence 'low'.
    mockEnabled(VALID_FIXTURES.validConflictRouted);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    const prompt = result.current.getMoveState('move-1').overridePrompt;
    expect(prompt.shouldOffer).toBe(true);
    expect(prompt.triggerReason).toBe('low_confidence');
  });

  it('a confident packet does not offer the override prompt', async () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(result.current.getMoveState('move-1').overridePrompt.shouldOffer).toBe(false);
  });
});

describe('useSemanticReferee — confirmOverride', () => {
  it('records an in-memory override and bumps the repeated signal', async () => {
    mockEnabled(VALID_FIXTURES.validConflictRouted);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    expect(result.current.repeatedSignal.overrideCountThisRoom).toBe(0);
    act(() => {
      result.current.confirmOverride('move-1', {
        chosenLane: 'branch',
        assertsAnswersParent: false,
        overriddenByUserId: 'user-1',
        participantSide: 'affirmative',
      });
    });
    const records = result.current.getOverrideRecords('move-1');
    expect(records.length).toBe(1);
    expect(result.current.repeatedSignal.overrideCountThisRoom).toBe(1);
  });

  it('the produced record has no delta / score / penalty / block / flag key', async () => {
    mockEnabled(VALID_FIXTURES.validConflictRouted);
    const { result } = renderHook(() => useSemanticReferee());
    await act(async () => {
      await result.current.onMovePosted(BASE_ARGS);
    });
    act(() => {
      result.current.confirmOverride('move-1', {
        chosenLane: 'mainline',
        assertsAnswersParent: true,
        overriddenByUserId: 'user-1',
        participantSide: 'affirmative',
      });
    });
    const record = result.current.getOverrideRecords('move-1')[0];
    const keys = Object.keys(record);
    for (const banned of ['delta', 'score', 'penalty', 'block', 'flag']) {
      expect(keys).not.toContain(banned);
    }
  });

  it('confirmOverride is a no-op when the move has no offered prompt', () => {
    const { result } = renderHook(() => useSemanticReferee());
    act(() => {
      result.current.confirmOverride('never-classified', {
        chosenLane: 'branch',
        assertsAnswersParent: false,
        overriddenByUserId: 'user-1',
      });
    });
    expect(result.current.getOverrideRecords('never-classified')).toEqual([]);
  });
});

describe('useSemanticReferee — no call on a non-post interaction', () => {
  it('the hook has no API a draft-edit / node-tap / mode-toggle calls', () => {
    // The hook's public surface is onMovePosted / getMoveState /
    // confirmOverride / getOverrideRecords / repeatedSignal. There is no
    // keystroke / scroll / select method — a draft edit simply cannot
    // originate a classifyMove call.
    const { result } = renderHook(() => useSemanticReferee());
    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual(
      ['confirmOverride', 'getMoveState', 'getOverrideRecords', 'onMovePosted', 'repeatedSignal'].sort(),
    );
  });

  it('makes zero calls when no move is ever posted', () => {
    mockEnabled(VALID_FIXTURES.validContinuity);
    renderHook(() => useSemanticReferee());
    expect(classifyMoveMock).not.toHaveBeenCalled();
  });
});
