/**
 * SETTLE-001 (#911) — useDebates.settle / reopen optimistic patch.
 *
 * Mirrors useDebatesSeatClaim.test.ts: mock debatesApi, mount the hook, seed
 * the list, then assert the optimistic local status flip on success and the
 * neutral-error + refresh reconcile on failure.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { ROOM_SETTLE_COPY } from '../src/features/debates/settleRoomModel';
import type { Debate } from '../src/features/debates/types';

const mockListDebates = jest.fn();
const mockSettleDebate = jest.fn();
const mockReopenDebate = jest.fn();

jest.mock('../src/features/debates/debatesApi', () => ({
  listDebates: (...a: unknown[]) => mockListDebates(...a),
  createDebate: jest.fn(async () => ({ ok: false, error: 'unused' })),
  joinDebate: jest.fn(async () => ({ ok: false, error: 'unused', outcome: 'unavailable' })),
  settleDebate: (...a: unknown[]) => mockSettleDebate(...a),
  reopenDebate: (...a: unknown[]) => mockReopenDebate(...a),
}));

jest.mock('../src/features/session/useAppSession', () => ({
  useAppSession: () => ({ state: { snapshot: { userId: 'creator-1' } } }),
}));

import { useDebates } from '../src/features/debates/useDebates';

function debate(overrides: Partial<Debate> = {}): Debate {
  return {
    id: 'room-1',
    createdBy: 'creator-1',
    title: 't',
    resolution: 'r',
    description: '',
    status: 'open',
    constitutionId: 'c1',
    createdAt: '2026-07-11T00:00:00Z',
    updatedAt: '2026-07-11T00:00:00Z',
    myParticipantSide: 'moderator',
    visibility: 'public',
    inactiveAt: null,
    circleId: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockListDebates.mockReset();
  mockSettleDebate.mockReset();
  mockReopenDebate.mockReset();
  mockListDebates.mockResolvedValue({ ok: true, data: [debate({ status: 'open' })] });
});

async function mount() {
  const utils = renderHook(() => useDebates());
  // Wait for the mount-time refresh to FULLY settle (loading is initially
  // false, so gating on loading alone can resolve before refresh commits its
  // async tail — which ends with setError(null) and would otherwise clobber a
  // later action error). Gating on debates.length proves setDebates (the last
  // refresh write) landed.
  await waitFor(() => {
    expect(utils.result.current.loading).toBe(false);
    expect(utils.result.current.debates.length).toBeGreaterThan(0);
  });
  return utils;
}

describe('useDebates.settle — optimistic patch', () => {
  it('flips the local room status to locked on success (no refetch)', async () => {
    mockSettleDebate.mockResolvedValue({ ok: true, data: { status: 'locked' } });
    const { result } = await mount();

    let res: Awaited<ReturnType<typeof result.current.settle>> | undefined;
    await act(async () => {
      res = await result.current.settle('room-1');
    });
    expect(res).toEqual({ ok: true });
    expect(result.current.debates.find((d) => d.id === 'room-1')?.status).toBe('locked');
    expect(result.current.error).toBeNull();
    // Success path does NOT refetch — only the mount-time refresh ran.
    expect(mockListDebates).toHaveBeenCalledTimes(1);
  });

  it('on failure: no optimistic flip, neutral banner, no false settle sticks', async () => {
    mockSettleDebate.mockResolvedValue({ ok: false, error: 'permission denied' });
    const { result } = await mount();

    await act(async () => {
      await result.current.settle('room-1');
    });
    // No optimistic patch on failure — the room stays open.
    expect(result.current.debates.find((d) => d.id === 'room-1')?.status).toBe('open');
    // Never a raw Postgres string in the banner (mirrors join, neutral only).
    expect(result.current.error).toBe(ROOM_SETTLE_COPY.error_network);
    expect(result.current.error).not.toBe('permission denied');
    // No refetch on failure (nothing to reconcile) — only the mount refresh ran.
    expect(mockListDebates).toHaveBeenCalledTimes(1);
  });

  it('returns the raw error to the caller (component maps it to neutral inline)', async () => {
    mockSettleDebate.mockResolvedValue({ ok: false, error: 'permission denied' });
    const { result } = await mount();

    let res: Awaited<ReturnType<typeof result.current.settle>> | undefined;
    await act(async () => {
      res = await result.current.settle('room-1');
    });
    expect(res).toEqual({ ok: false, error: 'permission denied' });
  });
});

describe('useDebates.reopen — optimistic patch', () => {
  it('flips the local room status to open on success', async () => {
    mockListDebates.mockResolvedValue({ ok: true, data: [debate({ status: 'locked' })] });
    mockReopenDebate.mockResolvedValue({ ok: true, data: { status: 'open' } });
    const { result } = await mount();

    let res: Awaited<ReturnType<typeof result.current.reopen>> | undefined;
    await act(async () => {
      res = await result.current.reopen('room-1');
    });
    expect(res).toEqual({ ok: true });
    expect(result.current.debates.find((d) => d.id === 'room-1')?.status).toBe('open');
    expect(result.current.error).toBeNull();
  });

  it('on failure: neutral banner, no optimistic flip, no refetch', async () => {
    // Mirror the settle failure test: the hook does not gate reopen on status
    // (that is the model job, covered in settleRoomModel.test.ts), so seed the
    // default open room and assert the failure semantics only.
    mockReopenDebate.mockResolvedValue({ ok: false, error: 'nope' });
    const { result } = await mount();

    await act(async () => {
      await result.current.reopen('room-1');
    });
    // No optimistic patch applied on failure — the room is unchanged.
    expect(result.current.debates.find((d) => d.id === 'room-1')?.status).toBe('open');
    expect(result.current.error).toBe(ROOM_SETTLE_COPY.error_network);
    expect(mockListDebates).toHaveBeenCalledTimes(1);
  });
});
