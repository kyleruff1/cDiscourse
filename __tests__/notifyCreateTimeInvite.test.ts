/**
 * ARG-ROOM-004 (#615) — the client-side create-time invite trigger.
 *
 * `notifyCreateTimeInvite` fires `room-notifications` (`type: 'invite'`) after
 * the room + invite are minted, passing the raw token so the gated transports
 * can build a working link / bridge redirect. It is BEST-EFFORT: it never
 * throws, its result is discarded, and it does nothing when Supabase is
 * unconfigured.
 */
const mockInvoke = jest.fn();
const mockState = { configured: true };

jest.mock('../src/lib/supabase', () => ({
  get SUPABASE_CONFIGURED() {
    return mockState.configured;
  },
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import { notifyCreateTimeInvite } from '../src/features/debates/debatesApi';

const INPUT = {
  debateId: 'debdbdbd-0000-0000-0000-000000000001',
  inviteId: 'invinvin-0000-0000-0000-000000000002',
  inviteToken: 'A'.repeat(43),
  roomIsPrivate: true,
};

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue({ data: { delivered: 0, notification: 'not_configured' }, error: null });
  mockState.configured = true;
});

describe('notifyCreateTimeInvite — request shape', () => {
  it('invokes room-notifications with the invite trigger + token + roomIsPrivate', async () => {
    await notifyCreateTimeInvite(INPUT);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fnName, opts] = mockInvoke.mock.calls[0];
    expect(fnName).toBe('room-notifications');
    expect(opts).toEqual({
      body: {
        type: 'invite',
        debateId: INPUT.debateId,
        inviteId: INPUT.inviteId,
        inviteToken: INPUT.inviteToken,
        meta: { roomIsPrivate: true },
      },
    });
  });

  it('threads roomIsPrivate=false through for a public room invite', async () => {
    await notifyCreateTimeInvite({ ...INPUT, roomIsPrivate: false });
    const [, opts] = mockInvoke.mock.calls[0] as [string, { body: { meta: { roomIsPrivate: boolean } } }];
    expect(opts.body.meta.roomIsPrivate).toBe(false);
  });
});

describe('notifyCreateTimeInvite — best-effort (never throws, result discarded)', () => {
  it('resolves to void on success', async () => {
    await expect(notifyCreateTimeInvite(INPUT)).resolves.toBeUndefined();
  });

  it('swallows a rejected invoke (network/edge failure) without throwing', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('network down'));
    await expect(notifyCreateTimeInvite(INPUT)).resolves.toBeUndefined();
  });

  it('swallows an error-shaped invoke result without throwing', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(notifyCreateTimeInvite(INPUT)).resolves.toBeUndefined();
  });
});

describe('notifyCreateTimeInvite — unconfigured guard', () => {
  it('does not invoke when Supabase is unconfigured', async () => {
    mockState.configured = false;
    await notifyCreateTimeInvite(INPUT);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
