/**
 * QOL-039 — debatesApi visibility round-trip tests (mocked Supabase).
 *
 * Asserts:
 *   - listDebates includes `visibility` in the SELECT column list.
 *   - mapDebateRow round-trips visibility 'public' / 'private'.
 *   - createDebate threads `input.visibility` into the INSERT payload;
 *     default omits / writes 'public'.
 *   - transitionRoomToPrivate calls the `record-visibility-transition`
 *     Edge Function (NOT a direct `update().eq()` on `debates`).
 *
 * Doctrine surface:
 *   - The client never issues a privileged `UPDATE` for the visibility
 *     transition — that path runs through the Edge Function (OD-3).
 */

type QueryResult = { data: unknown; error: { message?: string; code?: string } | null };

interface PendingCall {
  table: string;
  op: 'select' | 'insert' | 'update';
  payload?: unknown;
  columns?: string;
  eqArgs: Array<[string, unknown]>;
}

interface PendingInvoke {
  fn: string;
  body: unknown;
}

interface MockState {
  results: Record<string, QueryResult>;
  invokeResult: { data: unknown; error: { message?: string } | null };
  calls: PendingCall[];
  invokes: PendingInvoke[];
}

const mockState: MockState = {
  results: {},
  invokeResult: { data: null, error: null },
  calls: [],
  invokes: [],
};

jest.mock('../src/lib/supabase', () => {
  const resolveResult = (table: string, op: string): QueryResult =>
    mockState.results[`${table}:${op}`] ??
    mockState.results[table] ?? { data: null, error: null };
  return {
    supabase: {
      from: (table: string) => {
        const call: PendingCall = { table, op: 'select', eqArgs: [] };
        mockState.calls.push(call);
        const builder: Record<string, unknown> = {};
        const settle = () => Promise.resolve(resolveResult(call.table, call.op));
        builder.select = (cols?: string) => {
          if (typeof cols === 'string') call.columns = cols;
          return builder;
        };
        builder.insert = (payload: unknown) => {
          call.op = 'insert';
          call.payload = payload;
          return builder;
        };
        builder.update = (payload: unknown) => {
          call.op = 'update';
          call.payload = payload;
          return builder;
        };
        builder.eq = (col: string, val: unknown) => {
          call.eqArgs.push([col, val]);
          return builder;
        };
        builder.in = () => builder;
        builder.order = () => builder;
        builder.single = () => settle();
        builder.maybeSingle = () => settle();
        (builder as { then?: unknown }).then = (resolve: (r: QueryResult) => unknown) =>
          resolve(resolveResult(call.table, call.op));
        return builder;
      },
      functions: {
        invoke: (fn: string, opts: { body?: unknown }) => {
          mockState.invokes.push({ fn, body: opts?.body });
          return Promise.resolve(mockState.invokeResult);
        },
      },
    },
    SUPABASE_CONFIGURED: true,
  };
});

import {
  listDebates,
  createDebate,
  transitionRoomToPrivate,
  isAlreadyJoinedError,
} from '../src/features/debates/debatesApi';

beforeEach(() => {
  mockState.results = {};
  mockState.invokeResult = { data: null, error: null };
  mockState.calls = [];
  mockState.invokes = [];
});

// ── listDebates ───────────────────────────────────────────────

describe('listDebates — visibility round-trip', () => {
  it('selects the visibility column from public.debates', async () => {
    mockState.results['debates'] = {
      data: [
        {
          id: 'd1',
          created_by: 'u1',
          title: 'A',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-05-24T00:00:00Z',
          updated_at: '2026-05-24T00:00:00Z',
          visibility: 'public',
        },
        {
          id: 'd2',
          created_by: 'u2',
          title: 'B',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-05-24T00:00:00Z',
          updated_at: '2026-05-24T00:00:00Z',
          visibility: 'private',
        },
      ],
      error: null,
    };
    mockState.results['debate_participants'] = { data: [], error: null };

    const res = await listDebates('u1');
    expect(res.ok).toBe(true);

    const debatesCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'select');
    expect(debatesCall?.columns).toContain('visibility');

    if (res.ok) {
      expect(res.data[0].visibility).toBe('public');
      expect(res.data[1].visibility).toBe('private');
    }
  });

  it('coerces unknown visibility values to "public" defensively', async () => {
    mockState.results['debates'] = {
      data: [
        {
          id: 'd1',
          created_by: 'u1',
          title: 'A',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-05-24T00:00:00Z',
          updated_at: '2026-05-24T00:00:00Z',
          visibility: 'unexpected_value',
        },
      ],
      error: null,
    };
    mockState.results['debate_participants'] = { data: [], error: null };
    const res = await listDebates('u1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data[0].visibility).toBe('public');
  });

  it('does not add a visibility WHERE filter — RLS is the boundary', async () => {
    mockState.results['debates'] = { data: [], error: null };
    mockState.results['debate_participants'] = { data: [], error: null };
    await listDebates('u1');
    const debatesCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'select');
    const visibilityFilter = (debatesCall?.eqArgs || []).find(([col]) => col === 'visibility');
    expect(visibilityFilter).toBeUndefined();
  });
});

// ── createDebate ──────────────────────────────────────────────

describe('createDebate — visibility on insert', () => {
  beforeEach(() => {
    mockState.results['constitution_versions'] = {
      data: { id: 'const-1' },
      error: null,
    };
    mockState.results['debate_participants'] = { data: null, error: null };
  });

  it('passes visibility="public" by default on the insert payload', async () => {
    mockState.results['debates'] = {
      data: {
        id: 'd1',
        created_by: 'u1',
        title: 'T',
        resolution: 'R',
        description: '',
        status: 'open',
        constitution_id: 'const-1',
        created_at: '2026-05-24T00:00:00Z',
        updated_at: '2026-05-24T00:00:00Z',
        visibility: 'public',
      },
      error: null,
    };
    const res = await createDebate({ title: 'T', resolution: 'R', description: '' }, 'u1');
    expect(res.ok).toBe(true);
    const insertCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'insert');
    expect((insertCall?.payload as { visibility: string }).visibility).toBe('public');
    if (res.ok) expect(res.data.visibility).toBe('public');
  });

  it('passes visibility="private" when the input requests private', async () => {
    mockState.results['debates'] = {
      data: {
        id: 'd1',
        created_by: 'u1',
        title: 'T',
        resolution: 'R',
        description: '',
        status: 'open',
        constitution_id: 'const-1',
        created_at: '2026-05-24T00:00:00Z',
        updated_at: '2026-05-24T00:00:00Z',
        visibility: 'private',
      },
      error: null,
    };
    const res = await createDebate(
      { title: 'T', resolution: 'R', description: '', visibility: 'private' },
      'u1',
    );
    expect(res.ok).toBe(true);
    const insertCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'insert');
    expect((insertCall?.payload as { visibility: string }).visibility).toBe('private');
    if (res.ok) expect(res.data.visibility).toBe('private');
  });

  it('coerces unexpected visibility input back to "public" defensively', async () => {
    mockState.results['debates'] = {
      data: {
        id: 'd1',
        created_by: 'u1',
        title: 'T',
        resolution: 'R',
        description: '',
        status: 'open',
        constitution_id: 'const-1',
        created_at: '2026-05-24T00:00:00Z',
        updated_at: '2026-05-24T00:00:00Z',
        visibility: 'public',
      },
      error: null,
    };
    const res = await createDebate(
      // @ts-expect-error — intentionally bad input
      { title: 'T', resolution: 'R', description: '', visibility: 'totally_invalid' },
      'u1',
    );
    expect(res.ok).toBe(true);
    const insertCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'insert');
    expect((insertCall?.payload as { visibility: string }).visibility).toBe('public');
  });

  it('selects visibility in the returning columns', async () => {
    mockState.results['debates'] = {
      data: {
        id: 'd1',
        created_by: 'u1',
        title: 'T',
        resolution: 'R',
        description: '',
        status: 'open',
        constitution_id: 'const-1',
        created_at: '2026-05-24T00:00:00Z',
        updated_at: '2026-05-24T00:00:00Z',
        visibility: 'public',
      },
      error: null,
    };
    await createDebate({ title: 'T', resolution: 'R', description: '' }, 'u1');
    const insertCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'insert');
    expect(insertCall?.columns).toContain('visibility');
  });
});

// ── transitionRoomToPrivate (Edge Function path per OD-3) ─────

describe('transitionRoomToPrivate — Edge Function path', () => {
  it('calls the record-visibility-transition Edge Function (NOT a direct UPDATE)', async () => {
    mockState.invokeResult = {
      data: {
        transitionId: 't-1',
        retainedParticipantCount: 2,
        droppedParticipantCount: 1,
        rejectedChimeInCount: 0,
        auditWritten: true,
        notificationsDispatched: {
          roomMadePrivate: 'sent',
          chimeInRejected: [],
        },
      },
      error: null,
    };
    const res = await transitionRoomToPrivate('d-1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.transitionId).toBe('t-1');
      expect(res.data.notificationsDispatched.roomMadePrivate).toBe('sent');
    }

    // The function-invoke path was used.
    expect(mockState.invokes.length).toBe(1);
    expect(mockState.invokes[0].fn).toBe('record-visibility-transition');
    expect(mockState.invokes[0].body).toEqual({
      debateId: 'd-1',
      triggerKind: 'manual_creator_action',
    });

    // No `update()` call on `debates` was issued from the client.
    const directUpdate = mockState.calls.find(
      (c) => c.table === 'debates' && c.op === 'update',
    );
    expect(directUpdate).toBeUndefined();
  });

  it('returns the per-chime-in dispatch statuses verbatim', async () => {
    mockState.invokeResult = {
      data: {
        transitionId: 't-2',
        retainedParticipantCount: 2,
        droppedParticipantCount: 0,
        rejectedChimeInCount: 2,
        auditWritten: true,
        notificationsDispatched: {
          roomMadePrivate: 'sent',
          chimeInRejected: [
            { argumentId: 'arg-1', status: 'sent' },
            { argumentId: 'arg-2', status: 'queued' },
          ],
        },
      },
      error: null,
    };
    const res = await transitionRoomToPrivate('d-2');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.notificationsDispatched.chimeInRejected).toEqual([
        { argumentId: 'arg-1', status: 'sent' },
        { argumentId: 'arg-2', status: 'queued' },
      ]);
    }
  });

  it('surfaces a neutral error when the Edge Function returns an error', async () => {
    mockState.invokeResult = {
      data: null,
      error: { message: 'forbidden' },
    };
    const res = await transitionRoomToPrivate('d-3');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('forbidden');
    }
  });

  it('surfaces a neutral default error when the Edge Function returns null with no message', async () => {
    mockState.invokeResult = { data: null, error: null };
    const res = await transitionRoomToPrivate('d-4');
    expect(res.ok).toBe(false);
  });

  it('reports auditWritten: false when the audit insert failed but transition succeeded', async () => {
    mockState.invokeResult = {
      data: {
        transitionId: '',
        retainedParticipantCount: 1,
        droppedParticipantCount: 0,
        rejectedChimeInCount: 0,
        auditWritten: false,
        notificationsDispatched: {
          roomMadePrivate: 'sent',
          chimeInRejected: [],
        },
      },
      error: null,
    };
    const res = await transitionRoomToPrivate('d-5');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.auditWritten).toBe(false);
      expect(res.data.notificationsDispatched.roomMadePrivate).toBe('sent');
    }
  });
});

// ── unrelated helper still works ──────────────────────────────

describe('isAlreadyJoinedError — unchanged', () => {
  it('returns true for code 23505', () => {
    expect(isAlreadyJoinedError({ code: '23505' })).toBe(true);
  });
  it('returns false for other codes', () => {
    expect(isAlreadyJoinedError({ code: '23000' })).toBe(false);
    expect(isAlreadyJoinedError(null)).toBe(false);
  });
});
