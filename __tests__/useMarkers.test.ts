/**
 * MARK-002 (#894) — useMarkers hook tests.
 *
 * enabled=false performs NO fetch and returns empty maps (the flag-off,
 * byte-identical path). enabled=true fetches the RLS-scoped rows and returns
 * them grouped by target AND by reply. A read error degrades to empty maps.
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

import { useMarkers } from '../src/features/arguments/markers/useMarkers';

const ROWS = [
  {
    id: 'm1',
    debate_id: 'd1',
    target_argument_id: 't1',
    reply_argument_id: 'r1',
    created_by: 'u1',
    kind: 'rebuttal_anchor',
    span_start: 0,
    span_end: 4,
    span_unit: 'chars',
    quoted_text: 'Cars',
    created_at: '2026-07-11T00:00:00.000Z',
    deleted_at: null,
  },
  {
    id: 'm2',
    debate_id: 'd1',
    target_argument_id: 't1',
    reply_argument_id: null,
    created_by: 'u1',
    kind: 'note',
    span_start: 5,
    span_end: 8,
    span_unit: 'chars',
    quoted_text: 'bad',
    created_at: '2026-07-11T00:01:00.000Z',
    deleted_at: null,
  },
];

beforeEach(() => {
  mockFrom.mockClear();
  builder.select.mockClear();
  builder.eq.mockClear();
  builder.in.mockClear();
  builder.is.mockClear();
  mockThen.mockReset();
});

describe('useMarkers — flag-off (byte-identical)', () => {
  it('performs no fetch and returns empty maps when enabled is false', async () => {
    const { result } = renderHook(() => useMarkers('d1', ['t1'], false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.markersByTargetId).toEqual({});
    expect(result.current.markersByReplyId).toEqual({});
  });

  it('performs no fetch when there are no argument ids', async () => {
    mockThen.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useMarkers('d1', [], true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.markersByTargetId).toEqual({});
  });
});

describe('useMarkers — enabled', () => {
  it('fetches and groups rows by target and by reply', async () => {
    mockThen.mockResolvedValue({ data: ROWS, error: null });
    const { result } = renderHook(() => useMarkers('d1', ['t1'], true));
    await waitFor(() => expect(result.current.markersByTargetId.t1?.length).toBe(2));
    expect(mockFrom).toHaveBeenCalledWith('timestamp_markers');
    expect(result.current.markersByTargetId.t1.map((r) => r.id)).toEqual(['m1', 'm2']);
    // Only the marker with a reply id is in the reply map.
    expect(result.current.markersByReplyId.r1.map((r) => r.id)).toEqual(['m1']);
    expect(Object.keys(result.current.markersByReplyId)).toEqual(['r1']);
  });

  it('degrades to empty maps on a read error', async () => {
    mockThen.mockResolvedValue({ data: null, error: { message: 'rls' } });
    const { result } = renderHook(() => useMarkers('d1', ['t1'], true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.markersByTargetId).toEqual({});
    expect(result.current.markersByReplyId).toEqual({});
  });
});
