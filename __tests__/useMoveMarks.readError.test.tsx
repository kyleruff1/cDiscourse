/**
 * UX-PR-B (#918) — useMoveMarks READ-path error field.
 *
 * The hook already had an EXEMPLARY per-move WRITE note (moveMarkErrorFor). This
 * card adds the room-wide READ error (the fetch failing) as a SEPARATE channel:
 * a failed room fetch surfaces the fixed sentinel on `error`, while
 * `moveMarkErrorFor` stays reserved for a failed tap. The write path is NOT
 * touched by this card, so these tests exercise only the read seam.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

const mockThen = jest.fn();
interface MockBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  is: jest.Mock;
}
const builder: MockBuilder = {
  select: jest.fn((): MockBuilder => builder),
  eq: jest.fn((): MockBuilder => builder),
  in: jest.fn((): MockBuilder => builder),
  is: jest.fn(() => mockThen()),
};
const mockFrom = jest.fn((..._args: unknown[]): MockBuilder => builder);

jest.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  SUPABASE_CONFIGURED: true,
}));

import { useMoveMarks } from '../src/features/feedback/useMoveMarks';
import { ROOM_LOAD_ERROR_COPY } from '../src/features/arguments/gameCopy';

const DB_ROW = {
  argument_id: 'a1',
  mark_code: 'did_not_address',
  marked_by: 'u2',
  retracted_at: null,
};

beforeEach(() => {
  mockFrom.mockClear();
  builder.select.mockClear();
  builder.eq.mockClear();
  builder.in.mockClear();
  builder.is.mockClear();
  mockThen.mockReset();
});

describe('useMoveMarks — read error field (UX-PR-B #918)', () => {
  it('keeps error null and performs no fetch when disabled', async () => {
    const { result } = renderHook(() =>
      useMoveMarks({ debateId: 'd1', argumentIds: ['a1'], viewerId: 'u1', enabled: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('leaves error null on a successful fetch', async () => {
    mockThen.mockResolvedValue({ data: [DB_ROW], error: null });
    const { result } = renderHook(() =>
      useMoveMarks({ debateId: 'd1', argumentIds: ['a1'], viewerId: 'u1', enabled: true }),
    );
    await waitFor(() => expect(result.current.activeRows.length).toBe(1));
    expect(result.current.error).toBeNull();
  });

  it('surfaces the fixed sentinel (never the raw error) on a read error', async () => {
    mockThen.mockResolvedValue({ data: null, error: { message: 'boom', code: '42501' } });
    const { result } = renderHook(() =>
      useMoveMarks({ debateId: 'd1', argumentIds: ['a1'], viewerId: 'u1', enabled: true }),
    );
    await waitFor(() => expect(result.current.error).toBe(ROOM_LOAD_ERROR_COPY.hookError));
    expect(result.current.activeRows).toEqual([]);
    expect(result.current.error).not.toContain('boom');
    expect(result.current.error).not.toContain('42501');
  });

  it('the read error is SEPARATE from the per-move write note (moveMarkErrorFor stays clean)', async () => {
    mockThen.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() =>
      useMoveMarks({ debateId: 'd1', argumentIds: ['a1'], viewerId: 'u1', enabled: true }),
    );
    await waitFor(() => expect(result.current.error).toBe(ROOM_LOAD_ERROR_COPY.hookError));
    // A read failure must NOT populate the per-move write-error channel — that
    // stays reserved for a failed tap (the exemplary path this card leaves alone).
    expect(result.current.moveMarkErrorFor('a1')).toBeUndefined();
  });
});
