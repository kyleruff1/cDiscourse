/**
 * ARG-ROOM-005 (#616) — integration-mocked wiring (Supabase mocked).
 *
 * The integration-mocked legs of the seven invariants:
 *   - invariant 4: joinDebate classifies the 002 capacity refusal as room_full.
 *   - invariant 5: an observer join succeeds even when the room is full.
 *   - invariant 7: joinDebate writes ONLY debate_participants — never
 *     argument_room_invites — so a public claim can't steal the reserved seat.
 * Plus the already_active / already_observer / unavailable branches and the
 * useActiveParticipantCount count read (side <> observer, head:true).
 */
import { renderHook, waitFor } from '@testing-library/react-native';

type QueryResult = {
  data?: unknown;
  error?: { message?: string; code?: string } | null;
  count?: number | null;
};

interface PendingCall {
  table: string;
  op: 'select' | 'insert';
  selectCols?: string;
  selectOpts?: { count?: string; head?: boolean };
  insertPayload?: Record<string, unknown>;
  eqArgs: Array<[string, unknown]>;
  neqArgs: Array<[string, unknown]>;
}

interface MockState {
  insertError: { message?: string; code?: string } | null;
  existingRow: { side?: string } | null;
  count: number | null;
  countError: { message?: string } | null;
  calls: PendingCall[];
}

const mockState: MockState = {
  insertError: null,
  existingRow: null,
  count: null,
  countError: null,
  calls: [],
};

jest.mock('../src/lib/supabase', () => {
  return {
    SUPABASE_CONFIGURED: true,
    supabase: {
      from: (table: string) => {
        const call: PendingCall = { table, op: 'select', eqArgs: [], neqArgs: [] };
        mockState.calls.push(call);
        const builder: Record<string, unknown> = {};
        const settleSelect = (): QueryResult => {
          if (call.selectOpts && call.selectOpts.head) {
            return { count: mockState.count, error: mockState.countError };
          }
          return { data: mockState.existingRow, error: null };
        };
        builder.select = (cols?: string, opts?: { count?: string; head?: boolean }) => {
          call.op = 'select';
          if (typeof cols === 'string') call.selectCols = cols;
          if (opts) call.selectOpts = opts;
          return builder;
        };
        builder.insert = (payload: Record<string, unknown>) => {
          call.op = 'insert';
          call.insertPayload = payload;
          return builder;
        };
        builder.eq = (c: string, v: unknown) => {
          call.eqArgs.push([c, v]);
          return builder;
        };
        builder.neq = (c: string, v: unknown) => {
          call.neqArgs.push([c, v]);
          return builder;
        };
        builder.single = () => Promise.resolve({ data: mockState.existingRow, error: null });
        (builder as { then?: unknown }).then = (resolve: (r: QueryResult) => unknown) => {
          if (call.op === 'insert') return resolve({ error: mockState.insertError });
          return resolve(settleSelect());
        };
        return builder;
      },
    },
  };
});

import { joinDebate } from '../src/features/debates/debatesApi';
import { useActiveParticipantCount } from '../src/features/debates/useActiveParticipantCount';

beforeEach(() => {
  mockState.insertError = null;
  mockState.existingRow = null;
  mockState.count = null;
  mockState.countError = null;
  mockState.calls = [];
});

// ── joinDebate — outcome classification ─────────────────────────

describe('joinDebate — invariant 4: the capacity refusal classifies to room_full', () => {
  it('returns ok:false, outcome room_full and surfaces NO count/DETAIL', async () => {
    mockState.insertError = {
      code: '23514',
      message: 'room_capacity_reached',
    };
    const res = await joinDebate('d1', 'affirmative', 'u1');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.outcome).toBe('room_full');
      // The error string never carries a cap=/active=/reserved= DETAIL.
      expect(res.error).not.toContain('cap=');
      expect(res.error).not.toContain('active=');
      expect(res.error).not.toContain('reserved=');
    }
  });
});

describe('joinDebate — invariant 5: an observer join succeeds at a full room', () => {
  it('the observer INSERT is not capacity-gated (trigger pass-through)', async () => {
    mockState.insertError = null; // trigger allows observers regardless of cap
    const res = await joinDebate('d1', 'observer', 'u1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outcome).toBe('claimed');
      expect(res.data.side).toBe('observer');
    }
    const insert = mockState.calls.find(
      (c) => c.table === 'debate_participants' && c.op === 'insert',
    );
    expect(insert?.insertPayload).toMatchObject({ side: 'observer' });
  });
});

describe('joinDebate — invariant 7: writes ONLY debate_participants (never the invite table)', () => {
  it('a successful claim never touches argument_room_invites', async () => {
    mockState.insertError = null;
    await joinDebate('d1', 'affirmative', 'u1');
    expect(
      mockState.calls.some((c) => c.table === 'debate_participants' && c.op === 'insert'),
    ).toBe(true);
    expect(mockState.calls.every((c) => c.table !== 'argument_room_invites')).toBe(true);
  });

  it('even a refused (full) claim never touches argument_room_invites', async () => {
    mockState.insertError = { code: '23514', message: 'room_capacity_reached' };
    await joinDebate('d1', 'negative', 'u1');
    expect(mockState.calls.every((c) => c.table !== 'argument_room_invites')).toBe(true);
  });
});

describe('joinDebate — already-seated + unavailable branches', () => {
  it('23505 with an active existing side ⇒ already_active', async () => {
    mockState.insertError = { code: '23505' };
    mockState.existingRow = { side: 'affirmative' };
    const res = await joinDebate('d1', 'affirmative', 'u1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outcome).toBe('already_active');
      expect(res.data.side).toBe('affirmative');
      expect(res.data.alreadyJoined).toBe(true);
    }
  });

  it('23505 with an observer existing side ⇒ already_observer (no promotion)', async () => {
    mockState.insertError = { code: '23505' };
    mockState.existingRow = { side: 'observer' };
    const res = await joinDebate('d1', 'affirmative', 'u1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.outcome).toBe('already_observer');
  });

  it('an unrelated coded error ⇒ unavailable (never silently claimed)', async () => {
    mockState.insertError = { code: '42501', message: 'permission denied' };
    const res = await joinDebate('d1', 'affirmative', 'u1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.outcome).toBe('unavailable');
  });
});

// ── useActiveParticipantCount — count read shape ────────────────

describe('useActiveParticipantCount', () => {
  it('reads a head:true count of debate_participants where side <> observer', async () => {
    mockState.count = 3;
    const { result } = renderHook(() => useActiveParticipantCount('d1'));
    await waitFor(() => expect(result.current.activeParticipantCount).toBe(3));

    const countCall = mockState.calls.find(
      (c) => c.table === 'debate_participants' && c.op === 'select' && c.selectOpts?.head === true,
    );
    expect(countCall).toBeTruthy();
    expect(countCall?.selectOpts).toMatchObject({ count: 'exact', head: true });
    // Filtered to the room and to active participants only.
    expect(countCall?.eqArgs).toContainEqual(['debate_id', 'd1']);
    expect(countCall?.neqArgs).toContainEqual(['side', 'observer']);
  });

  it('does not read when there is no debate id', async () => {
    const { result } = renderHook(() => useActiveParticipantCount(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeParticipantCount).toBe(0);
    expect(mockState.calls.length).toBe(0);
  });
});
