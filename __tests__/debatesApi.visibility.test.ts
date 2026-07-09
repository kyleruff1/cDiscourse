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
  createArgumentRoom,
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

// ── listDebates — ADMIN-CONV-INACTIVE-VISIBILITY-001 inactive_at ──────

describe('listDebates — inactive_at round-trip (#514 / ADMIN-CONV-INACTIVE-VISIBILITY-001)', () => {
  it('selects inactive_at but NOT inactive_reason (§10a — WHAT only, never WHY)', async () => {
    mockState.results['debates'] = { data: [], error: null };
    mockState.results['debate_participants'] = { data: [], error: null };
    await listDebates('u1');
    const debatesCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'select');
    expect(debatesCall?.columns).toContain('inactive_at');
    expect(debatesCall?.columns).not.toContain('inactive_reason');
  });

  it('maps inactive_at → inactiveAt on each Debate', async () => {
    mockState.results['debates'] = {
      data: [
        {
          id: 'd-active',
          created_by: 'u1',
          title: 'A',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-06-06T00:00:00Z',
          updated_at: '2026-06-06T00:00:00Z',
          visibility: 'public',
          inactive_at: null,
        },
        {
          id: 'd-inactive',
          created_by: 'u2',
          title: 'B',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-06-06T00:00:00Z',
          updated_at: '2026-06-06T00:00:00Z',
          visibility: 'public',
          inactive_at: '2026-06-06T12:00:00Z',
        },
      ],
      error: null,
    };
    mockState.results['debate_participants'] = { data: [], error: null };
    const res = await listDebates('u1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data[0].inactiveAt).toBeNull();
      expect(res.data[1].inactiveAt).toBe('2026-06-06T12:00:00Z');
    }
  });

  it('defaults a missing inactive_at column to null (active)', async () => {
    mockState.results['debates'] = {
      data: [
        {
          id: 'd-legacy',
          created_by: 'u1',
          title: 'A',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-06-06T00:00:00Z',
          updated_at: '2026-06-06T00:00:00Z',
          visibility: 'public',
          // inactive_at intentionally absent (pre-migration row)
        },
      ],
      error: null,
    };
    mockState.results['debate_participants'] = { data: [], error: null };
    const res = await listDebates('u1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data[0].inactiveAt).toBeNull();
  });

  it('§10a — a row carrying inactive_reason never round-trips a reason onto the Debate', async () => {
    mockState.results['debates'] = {
      data: [
        {
          id: 'd-poison',
          created_by: 'u1',
          title: 'A',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-06-06T00:00:00Z',
          updated_at: '2026-06-06T00:00:00Z',
          visibility: 'public',
          inactive_at: '2026-06-06T12:00:00Z',
          inactive_reason: 'operator marked this room as spam',
        },
      ],
      error: null,
    };
    mockState.results['debate_participants'] = { data: [], error: null };
    const res = await listDebates('u1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      const serialized = JSON.stringify(res.data[0]);
      expect(serialized).not.toContain('inactive_reason');
      expect(serialized).not.toContain('inactiveReason');
      expect(serialized).not.toContain('marked this room as spam');
      // The WHAT still threads through.
      expect(res.data[0].inactiveAt).toBe('2026-06-06T12:00:00Z');
    }
  });
});

// ── listDebates — HOME-003 (#840) circle_id round-trip ──────────

describe('listDebates — circle_id round-trip (HOME-003 / #840)', () => {
  it('selects circle_id in the widened SELECT (additive; no pin fires)', async () => {
    mockState.results['debates'] = { data: [], error: null };
    mockState.results['debate_participants'] = { data: [], error: null };
    await listDebates('u1');
    const debatesCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'select');
    expect(debatesCall?.columns).toContain('circle_id');
    // Prior pins still hold — the widen is purely additive.
    expect(debatesCall?.columns).toContain('visibility');
    expect(debatesCall?.columns).toContain('inactive_at');
    expect(debatesCall?.columns).not.toContain('inactive_reason');
  });

  it('maps circle_id → circleId, defaulting a missing / null column to null', async () => {
    mockState.results['debates'] = {
      data: [
        {
          id: 'd-circle',
          created_by: 'u1',
          title: 'A',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-07-08T00:00:00Z',
          updated_at: '2026-07-08T00:00:00Z',
          visibility: 'private',
          inactive_at: null,
          circle_id: 'circle-abc',
        },
        {
          id: 'd-plain',
          created_by: 'u2',
          title: 'B',
          resolution: 'R',
          description: '',
          status: 'open',
          constitution_id: 'c1',
          created_at: '2026-07-08T00:00:00Z',
          updated_at: '2026-07-08T00:00:00Z',
          visibility: 'public',
          inactive_at: null,
          // circle_id intentionally absent (non-circle room).
        },
      ],
      error: null,
    };
    mockState.results['debate_participants'] = { data: [], error: null };
    const res = await listDebates('u1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data[0].circleId).toBe('circle-abc');
      expect(res.data[1].circleId).toBeNull();
    }
  });
});

// ── createArgumentRoom (ARG-ROOM-002 — server-authoritative Edge path) ──

function debateRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'd1',
    created_by: 'u1',
    title: 'T',
    resolution: 'R',
    description: '',
    status: 'open',
    constitution_id: 'const-1',
    created_at: '2026-06-13T00:00:00Z',
    updated_at: '2026-06-13T00:00:00Z',
    visibility: 'public',
    inactive_at: null,
    ...over,
  };
}

describe('createArgumentRoom — calls the create-argument-room Edge Function', () => {
  it('invokes create-argument-room with a public/no-invite body (NOT a direct insert)', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'public', inviteId: null, inviteLink: null },
      error: null,
    };
    const res = await createArgumentRoom({ title: ' T ', resolution: ' R ', description: '', visibility: 'public' });
    expect(res.ok).toBe(true);

    // Function-invoke path was used; no direct `debates` insert from the client.
    expect(mockState.invokes.length).toBe(1);
    expect(mockState.invokes[0].fn).toBe('create-argument-room');
    const body = mockState.invokes[0].body as { title: string; visibility: string; invite?: unknown };
    expect(body.title).toBe('T'); // trimmed
    expect(body.visibility).toBe('public');
    expect(body.invite).toBeUndefined();
    expect(mockState.calls.find((c) => c.table === 'debates' && c.op === 'insert')).toBeUndefined();

    if (res.ok) {
      expect(res.data.debateId).toBe('d1');
      expect(res.data.inviteLink).toBeNull();
    }
  });

  it('threads a single trimmed invite (default intendedSeat) for a private room', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd2', visibility: 'private', inviteId: 'inv-1', inviteLink: 'https://app.example/invite/tok' },
      error: null,
    };
    const res = await createArgumentRoom({
      title: 'T',
      resolution: 'R',
      visibility: 'private',
      invite: { email: '  Foo@Example.com  ' },
    });
    expect(res.ok).toBe(true);
    const body = mockState.invokes[0].body as { visibility: string; invite: { email: string; intendedSeat: string } };
    expect(body.visibility).toBe('private');
    // Trimmed but NOT lowercased on the client — the Edge function lowercases.
    expect(body.invite).toEqual({ email: 'Foo@Example.com', intendedSeat: 'respondent' });
    if (res.ok) {
      expect(res.data.inviteId).toBe('inv-1');
      expect(res.data.inviteLink).toContain('/invite/');
    }
  });

  it('surfaces a neutral error (no raw code) when the Edge Function errors', async () => {
    mockState.invokeResult = { data: null, error: { message: 'boom' } };
    const res = await createArgumentRoom({ title: 'T', resolution: 'R', visibility: 'public' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toMatch(/_/); // no snake_case internal code leak
  });
});

// ── createDebate (back-compat wrapper now routes through the Edge path) ──

describe('createDebate — routes through create-argument-room (no direct insert)', () => {
  it('passes visibility="public" by default and returns the loaded room', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'public', inviteId: null, inviteLink: null },
      error: null,
    };
    mockState.results['debates'] = { data: debateRow({ visibility: 'public' }), error: null };

    const res = await createDebate({ title: 'T', resolution: 'R', description: '' }, 'u1');
    expect(res.ok).toBe(true);
    expect(mockState.invokes[0].fn).toBe('create-argument-room');
    expect((mockState.invokes[0].body as { visibility: string }).visibility).toBe('public');
    // No direct `debates` insert from the client (the RPC does it under service-role).
    expect(mockState.calls.find((c) => c.table === 'debates' && c.op === 'insert')).toBeUndefined();
    // ARG-ROOM-008 — the success result is now a `CreatedRoom` (debate + the
    // one-time inviteLink). No invite here, so inviteLink is null.
    if (res.ok) {
      expect(res.data.debate.visibility).toBe('public');
      expect(res.data.inviteLink).toBeNull();
    }
  });

  it('passes visibility="private" when the input requests private', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'private', inviteId: null, inviteLink: null },
      error: null,
    };
    mockState.results['debates'] = { data: debateRow({ visibility: 'private' }), error: null };

    const res = await createDebate(
      { title: 'T', resolution: 'R', description: '', visibility: 'private' },
      'u1',
    );
    expect(res.ok).toBe(true);
    expect((mockState.invokes[0].body as { visibility: string }).visibility).toBe('private');
    if (res.ok) expect(res.data.debate.visibility).toBe('private');
  });

  // ── ARG-ROOM-003 — the live create surface threads its one optional invite
  //    through this wrapper into the SAME atomic Edge call. ──
  it('threads input.invite into the create-argument-room body (atomic, one call)', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd9', visibility: 'private', inviteId: 'inv-9', inviteLink: 'https://app.example/invite/tok' },
      error: null,
    };
    mockState.results['debates'] = { data: debateRow({ id: 'd9', visibility: 'private' }), error: null };

    const res = await createDebate(
      {
        title: 'T',
        resolution: 'R',
        description: '',
        visibility: 'private',
        invite: { email: 'guest@example.com' },
      },
      'u1',
    );
    expect(res.ok).toBe(true);
    // Exactly ONE Edge call — no separate invite call (no two-step sequence).
    expect(mockState.invokes.length).toBe(1);
    expect(mockState.invokes[0].fn).toBe('create-argument-room');
    const body = mockState.invokes[0].body as {
      visibility: string;
      invite?: { email: string; intendedSeat: string };
    };
    expect(body.visibility).toBe('private');
    // createArgumentRoom trims + defaults intendedSeat to 'respondent'.
    expect(body.invite).toEqual({ email: 'guest@example.com', intendedSeat: 'respondent' });
    // ARG-ROOM-008 — the raw one-time inviteLink rides through to the caller in
    // the `CreatedRoom` result (it is no longer discarded). The create surface
    // renders it once, inviter-only.
    if (res.ok) {
      expect(res.data.inviteLink).toBe('https://app.example/invite/tok');
      expect(res.data.debate.visibility).toBe('private');
    }
  });

  it('omits invite from the Edge body when no invite is supplied', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'public', inviteId: null, inviteLink: null },
      error: null,
    };
    mockState.results['debates'] = { data: debateRow({ visibility: 'public' }), error: null };

    await createDebate({ title: 'T', resolution: 'R', description: '', visibility: 'public' }, 'u1');
    const body = mockState.invokes[0].body as { invite?: unknown };
    expect(body.invite).toBeUndefined();
  });

  it('coerces unexpected visibility input back to "public" defensively', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'public', inviteId: null, inviteLink: null },
      error: null,
    };
    mockState.results['debates'] = { data: debateRow({ visibility: 'public' }), error: null };

    const res = await createDebate(
      // @ts-expect-error — intentionally bad input
      { title: 'T', resolution: 'R', description: '', visibility: 'totally_invalid' },
      'u1',
    );
    expect(res.ok).toBe(true);
    expect((mockState.invokes[0].body as { visibility: string }).visibility).toBe('public');
  });

  it('selects the visibility column when loading the created room', async () => {
    mockState.invokeResult = {
      data: { debateId: 'd1', visibility: 'public', inviteId: null, inviteLink: null },
      error: null,
    };
    mockState.results['debates'] = { data: debateRow(), error: null };

    await createDebate({ title: 'T', resolution: 'R', description: '' }, 'u1');
    const selectCall = mockState.calls.find((c) => c.table === 'debates' && c.op === 'select');
    expect(selectCall?.columns).toContain('visibility');
  });

  it('surfaces a neutral error when the Edge create fails', async () => {
    mockState.invokeResult = { data: null, error: { message: 'forbidden' } };
    const res = await createDebate({ title: 'T', resolution: 'R', description: '' }, 'u1');
    expect(res.ok).toBe(false);
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
