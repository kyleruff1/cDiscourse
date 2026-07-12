/**
 * UX-PR-B (#918) — useGalleryMoveMarks error field (FIELD-ONLY, per R1).
 *
 * This gallery loader feeds only the engagement-lane heat enrichment, so the
 * error field is added for silent-hook FAMILY consistency but has NO gallery-side
 * visible surface here (surfacing is deferred to PR-G). These tests prove the
 * field behaves like the room hooks: sentinel on error, null on success / skip,
 * and no raw-error leak — while the primary data payload stays byte-identical.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

const mockThen = jest.fn();
interface MockBuilder {
  select: jest.Mock;
  in: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
}
const builder: MockBuilder = {
  select: jest.fn((): MockBuilder => builder),
  in: jest.fn((): MockBuilder => builder),
  eq: jest.fn((): MockBuilder => builder),
  is: jest.fn(() => mockThen()),
};
const mockFrom = jest.fn((..._args: unknown[]): MockBuilder => builder);

jest.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  SUPABASE_CONFIGURED: true,
}));

import { useGalleryMoveMarks } from '../src/features/debates/useGalleryMoveMarks';
import { ROOM_LOAD_ERROR_COPY } from '../src/features/arguments/gameCopy';

const DB_ROWS = [
  { debate_id: 'd1', argument_id: 'a1' },
  { debate_id: 'd1', argument_id: 'a2' },
];

beforeEach(() => {
  mockFrom.mockClear();
  builder.select.mockClear();
  builder.in.mockClear();
  builder.eq.mockClear();
  builder.is.mockClear();
  mockThen.mockReset();
});

describe('useGalleryMoveMarks — error field (UX-PR-B #918)', () => {
  it('keeps error null and performs no fetch when disabled', async () => {
    const { result } = renderHook(() => useGalleryMoveMarks(['d1'], false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('keeps error null and performs no fetch when there are no ids', async () => {
    const { result } = renderHook(() => useGalleryMoveMarks([], true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('groups unaddressed ids and leaves error null on success', async () => {
    mockThen.mockResolvedValue({ data: DB_ROWS, error: null });
    const { result } = renderHook(() => useGalleryMoveMarks(['d1'], true));
    await waitFor(() => expect(result.current.unaddressedMoveIdsByDebateId.d1?.length).toBe(2));
    expect(mockFrom).toHaveBeenCalledWith('move_marks');
    expect(result.current.unaddressedMoveIdsByDebateId.d1).toEqual(['a1', 'a2']);
    expect(result.current.error).toBeNull();
  });

  it('surfaces the fixed sentinel (never the raw error) on a read error', async () => {
    mockThen.mockResolvedValue({ data: null, error: { message: 'boom', code: '42501' } });
    const { result } = renderHook(() => useGalleryMoveMarks(['d1'], true));
    await waitFor(() => expect(result.current.error).toBe(ROOM_LOAD_ERROR_COPY.hookError));
    // Primary payload still degrades to empty (byte-identical to today).
    expect(result.current.unaddressedMoveIdsByDebateId).toEqual({});
    expect(result.current.error).not.toContain('boom');
    expect(result.current.error).not.toContain('42501');
  });
});
