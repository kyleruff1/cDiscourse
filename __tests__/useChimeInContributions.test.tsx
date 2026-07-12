/**
 * CHIMEIN-P8 Round 2 (#761) — useChimeInContributions hook tests.
 *
 * Proves the enabled-gated read: disabled (the default) => NO query, empty rows
 * (byte-identical); enabled => a caller-scoped SELECT of active chime rows mapped
 * to camelCase; an error or missing debate id degrades to empty without throwing.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

let mockRows: unknown[] = [];
let mockError: unknown = null;

const queryBuilder: Record<string, jest.Mock> = {};
queryBuilder.select = jest.fn(() => queryBuilder);
queryBuilder.eq = jest.fn(() => queryBuilder);
queryBuilder.is = jest.fn(() => Promise.resolve({ data: mockRows, error: mockError }));

const mockFrom = jest.fn((..._args: unknown[]) => queryBuilder);

jest.mock('../src/lib/supabase', () => ({
  SUPABASE_CONFIGURED: true,
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { useChimeInContributions } from '../src/features/debates/useChimeInContributions';
import { ROOM_LOAD_ERROR_COPY } from '../src/features/arguments/gameCopy';

const DB_ROW = {
  id: 'c-1',
  debate_id: 'debate-1',
  argument_id: 'arg-1',
  target_argument_id: 'point-1',
  author_id: 'user-1',
  seat_index: 2,
  retracted_at: null,
};

beforeEach(() => {
  mockRows = [];
  mockError = null;
  mockFrom.mockClear();
  queryBuilder.select.mockClear();
  queryBuilder.eq.mockClear();
  queryBuilder.is.mockClear();
});

describe('useChimeInContributions — disabled (byte-identical default)', () => {
  it('performs NO query and returns empty rows when disabled', async () => {
    const { result } = renderHook(() =>
      useChimeInContributions({ debateId: 'debate-1', enabled: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
    // UX-PR-B (#918) — disabled is absence, never an error.
    expect(result.current.error).toBeNull();
  });
});

describe('useChimeInContributions — enabled', () => {
  it('selects active chime rows for the debate and maps them to camelCase', async () => {
    mockRows = [DB_ROW];
    const { result } = renderHook(() =>
      useChimeInContributions({ debateId: 'debate-1', enabled: true }),
    );
    await waitFor(() => expect(result.current.rows.length).toBe(1));
    expect(mockFrom).toHaveBeenCalledWith('chime_in_contributions');
    expect(queryBuilder.eq).toHaveBeenCalledWith('debate_id', 'debate-1');
    expect(queryBuilder.is).toHaveBeenCalledWith('retracted_at', null);
    expect(result.current.rows[0]).toEqual({
      id: 'c-1',
      debateId: 'debate-1',
      argumentId: 'arg-1',
      targetArgumentId: 'point-1',
      authorId: 'user-1',
      seatIndex: 2,
      retractedAt: null,
    });
    // UX-PR-B (#918) — a successful load clears any prior error.
    expect(result.current.error).toBeNull();
  });

  it('degrades to empty rows on a query error (never throws)', async () => {
    mockRows = [DB_ROW];
    mockError = { message: 'boom' };
    const { result } = renderHook(() =>
      useChimeInContributions({ debateId: 'debate-1', enabled: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });

  it('UX-PR-B (#918) — surfaces the fixed sentinel (never the raw error) on a query error', async () => {
    mockRows = [DB_ROW];
    mockError = { message: 'boom', code: '42501' };
    const { result } = renderHook(() =>
      useChimeInContributions({ debateId: 'debate-1', enabled: true }),
    );
    await waitFor(() => expect(result.current.error).toBe(ROOM_LOAD_ERROR_COPY.hookError));
    expect(result.current.error).not.toContain('boom');
    expect(result.current.error).not.toContain('42501');
  });

  it('performs no query when the debate id is missing', async () => {
    const { result } = renderHook(() => useChimeInContributions({ debateId: null, enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
