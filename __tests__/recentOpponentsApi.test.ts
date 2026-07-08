/**
 * START-001 (#827) — recentOpponentsApi read tests (mocked supabase client).
 *
 * Proves the single RLS-scoped read:
 *   - is gated on SUPABASE_CONFIGURED and a present userId (returns [] otherwise);
 *   - queries `argument_room_invites` filtered by `invited_by = userId`
 *     (mirroring RLS `ari_select_inviter_own`), newest-first, capped at 50;
 *   - resolves to [] on any PostgREST error (recents never block the sheet);
 *   - returns the raw rows unchanged on success (the pure model dedupes/masks).
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockState: {
  result: { data: unknown; error: unknown };
  captured: {
    table?: string;
    select?: string;
    eqArgs?: [string, unknown];
    orderArgs?: [string, unknown];
    limitArg?: number;
  };
} = { result: { data: [], error: null }, captured: {} };

interface MockBuilder {
  select: (cols: string) => MockBuilder;
  eq: (col: string, val: unknown) => MockBuilder;
  order: (col: string, opts: unknown) => MockBuilder;
  limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
}

jest.mock('../src/lib/supabase', () => {
  const builder: MockBuilder = {
    select: jest.fn((cols: string) => {
      mockState.captured.select = cols;
      return builder;
    }),
    eq: jest.fn((col: string, val: unknown) => {
      mockState.captured.eqArgs = [col, val];
      return builder;
    }),
    order: jest.fn((col: string, opts: unknown) => {
      mockState.captured.orderArgs = [col, opts];
      return builder;
    }),
    limit: jest.fn((n: number) => {
      mockState.captured.limitArg = n;
      return Promise.resolve(mockState.result);
    }),
  };
  return {
    SUPABASE_CONFIGURED: true,
    supabase: {
      from: jest.fn((table: string) => {
        mockState.captured.table = table;
        return builder;
      }),
    },
  };
});

import {
  listRecentOpponentInvites,
  RECENT_OPPONENT_INVITE_READ_LIMIT,
} from '../src/features/arguments/startArgument/recentOpponentsApi';

beforeEach(() => {
  mockState.result = { data: [], error: null };
  mockState.captured = {};
  jest.clearAllMocks();
});

describe('listRecentOpponentInvites', () => {
  it('returns [] without querying when userId is missing', async () => {
    expect(await listRecentOpponentInvites(null)).toEqual([]);
    expect(await listRecentOpponentInvites(undefined)).toEqual([]);
    expect(await listRecentOpponentInvites('')).toEqual([]);
    expect(mockState.captured.table).toBeUndefined();
  });

  it('queries argument_room_invites scoped to invited_by = userId, newest-first, capped', async () => {
    mockState.result = {
      data: [
        { invitee_email_lower: 'a@example.com', debate_id: 'd1', created_at: '2026-01-01T00:00:00Z', status: 'pending' },
      ],
      error: null,
    };
    const rows = await listRecentOpponentInvites('user-123');
    expect(mockState.captured.table).toBe('argument_room_invites');
    expect(mockState.captured.select).toContain('invitee_email_lower');
    expect(mockState.captured.eqArgs).toEqual(['invited_by', 'user-123']);
    expect(mockState.captured.orderArgs).toEqual(['created_at', { ascending: false }]);
    expect(mockState.captured.limitArg).toBe(RECENT_OPPONENT_INVITE_READ_LIMIT);
    expect(mockState.captured.limitArg).toBe(50);
    expect(rows).toHaveLength(1);
    expect(rows[0].invitee_email_lower).toBe('a@example.com');
  });

  it('resolves to [] on a PostgREST error (recents never block the sheet)', async () => {
    mockState.result = { data: null, error: { message: 'boom' } };
    expect(await listRecentOpponentInvites('user-123')).toEqual([]);
  });

  it('resolves to [] when data is null but no error', async () => {
    mockState.result = { data: null, error: null };
    expect(await listRecentOpponentInvites('user-123')).toEqual([]);
  });
});
