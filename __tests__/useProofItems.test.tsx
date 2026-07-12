/**
 * UX-PR-B (#918) — useProofItems hook tests (the worked-example worst case).
 *
 * The silent-hook template applied: a read error no longer degrades silently to
 * an empty map — it surfaces a FIXED plain-language sentinel (never the raw
 * supabase error). enabled=false / no-ids stays absence (error null); a
 * successful load clears the error back to null. The success payload
 * (proofItemsByMessageId) is byte-identical to before — only the error channel
 * is new.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

const mockThen = jest.fn();
interface MockBuilder {
  select: jest.Mock;
  in: jest.Mock;
  is: jest.Mock;
}
const builder: MockBuilder = {
  select: jest.fn((): MockBuilder => builder),
  in: jest.fn((): MockBuilder => builder),
  is: jest.fn(() => mockThen()),
};
const mockFrom = jest.fn((..._args: unknown[]): MockBuilder => builder);

jest.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  SUPABASE_CONFIGURED: true,
}));

import { useProofItems } from '../src/features/proof/useProofItems';
import { ROOM_LOAD_ERROR_COPY } from '../src/features/arguments/gameCopy';

const ROWS = [
  {
    id: 'p1',
    debate_id: 'd1',
    argument_id: 'a1',
    added_by: 'u1',
    kind: 'link',
    label: 'Source',
    url: 'https://example.test',
    source_text: null,
    quote: null,
    referenced_argument_id: null,
    source_chain_status: null,
    risk: null,
    created_at: '2026-07-11T00:00:00.000Z',
    deleted_at: null,
  },
];

beforeEach(() => {
  mockFrom.mockClear();
  builder.select.mockClear();
  builder.in.mockClear();
  builder.is.mockClear();
  mockThen.mockReset();
});

describe('useProofItems — flag-off / empty (byte-identical absence)', () => {
  it('performs no fetch and returns {} + null error when disabled', async () => {
    const { result } = renderHook(() => useProofItems('d1', ['a1'], false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.proofItemsByMessageId).toEqual({});
    expect(result.current.error).toBeNull();
  });

  it('performs no fetch and keeps error null when there are no argument ids', async () => {
    mockThen.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useProofItems('d1', [], true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.proofItemsByMessageId).toEqual({});
    expect(result.current.error).toBeNull();
  });
});

describe('useProofItems — enabled', () => {
  it('fetches, groups by argument, and leaves error null on success', async () => {
    mockThen.mockResolvedValue({ data: ROWS, error: null });
    const { result } = renderHook(() => useProofItems('d1', ['a1'], true));
    await waitFor(() => expect(result.current.proofItemsByMessageId.a1?.length).toBe(1));
    expect(mockFrom).toHaveBeenCalledWith('proof_items');
    expect(result.current.proofItemsByMessageId.a1[0].id).toBe('p1');
    expect(result.current.error).toBeNull();
  });

  it('surfaces the fixed sentinel (never the raw error) on a read error', async () => {
    mockThen.mockResolvedValue({ data: null, error: { message: 'rls-denied', code: '42501' } });
    const { result } = renderHook(() => useProofItems('d1', ['a1'], true));
    await waitFor(() => expect(result.current.error).toBe(ROOM_LOAD_ERROR_COPY.hookError));
    // The map still degrades to empty (no stale rows) but honestly, not silently.
    expect(result.current.proofItemsByMessageId).toEqual({});
    // The raw supabase message / code must NEVER leak into the surfaced string.
    expect(result.current.error).not.toContain('rls-denied');
    expect(result.current.error).not.toContain('42501');
  });
});
