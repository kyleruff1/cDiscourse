/**
 * ARG-ROOM-005 (#616) — useDebates.join outcome forwarding (mocked debatesApi).
 *
 * The hook leg of invariant 4: a room_full result degrades to the observe
 * affordance — join returns { side: null, outcome: 'room_full' } WITHOUT raising
 * the generic error banner. Genuine failures (unavailable) still set the banner.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockJoinDebate = jest.fn();

jest.mock('../src/features/debates/debatesApi', () => ({
  listDebates: jest.fn(async () => ({ ok: true, data: [] })),
  createDebate: jest.fn(async () => ({ ok: false, error: 'unused' })),
  joinDebate: (...args: unknown[]) => mockJoinDebate(...args),
}));

jest.mock('../src/features/session/useAppSession', () => ({
  useAppSession: () => ({ state: { snapshot: { userId: 'u1' } } }),
}));

import { useDebates } from '../src/features/debates/useDebates';

beforeEach(() => {
  mockJoinDebate.mockReset();
});

async function mountUseDebates() {
  const utils = renderHook(() => useDebates());
  // Let the mount-time refresh() effect settle.
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
}

describe('useDebates.join — ARG-ROOM-005 outcome forwarding', () => {
  it('a full room degrades to observe: returns room_full and does NOT set the error banner', async () => {
    mockJoinDebate.mockResolvedValue({
      ok: false,
      error: 'room_capacity_reached',
      outcome: 'room_full',
    });
    const { result } = await mountUseDebates();

    let outcome: Awaited<ReturnType<typeof result.current.join>> | undefined;
    await act(async () => {
      outcome = await result.current.join('d1', 'affirmative');
    });
    expect(outcome).toEqual({ side: null, outcome: 'room_full' });
    // The generic error banner is NOT raised for a full room.
    expect(result.current.error).toBeNull();
  });

  it('a successful claim forwards { side, outcome: claimed }', async () => {
    mockJoinDebate.mockResolvedValue({
      ok: true,
      data: { side: 'affirmative', alreadyJoined: false },
      outcome: 'claimed',
    });
    const { result } = await mountUseDebates();

    let outcome: Awaited<ReturnType<typeof result.current.join>> | undefined;
    await act(async () => {
      outcome = await result.current.join('d1', 'affirmative');
    });
    expect(outcome).toEqual({ side: 'affirmative', outcome: 'claimed' });
    expect(result.current.error).toBeNull();
  });

  it('a genuine failure (unavailable) still raises the error banner', async () => {
    mockJoinDebate.mockResolvedValue({
      ok: false,
      error: 'permission denied',
      outcome: 'unavailable',
    });
    const { result } = await mountUseDebates();

    let outcome: Awaited<ReturnType<typeof result.current.join>> | undefined;
    await act(async () => {
      outcome = await result.current.join('d1', 'affirmative');
    });
    expect(outcome).toEqual({ side: null, outcome: 'unavailable' });
    expect(result.current.error).toBe('permission denied');
  });
});
