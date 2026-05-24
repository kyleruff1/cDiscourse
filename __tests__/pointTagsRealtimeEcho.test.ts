/**
 * META-1B — Echo-suppression regression suite.
 *
 * Verifies that own-writes do not echo back via the realtime channel into
 * the local merge callback. The hook's `markLocalApply` and
 * `markLocalRemoveByPredicate` are the wires the room shell uses to
 * register intent before posting via the apply-manual-tag Edge Function.
 */
type Binding = {
  type: string;
  filter: Record<string, unknown>;
  cb: (payload: unknown) => void;
};

interface MockChannel {
  bindings: Binding[];
  subscribeCb: ((status: string, err?: Error) => void) | null;
  on: jest.Mock;
  subscribe: jest.Mock;
  __topic: string;
}

const channels: MockChannel[] = [];

function makeMockChannel(topic: string): MockChannel {
  const ch = {
    bindings: [] as Binding[],
    subscribeCb: null as ((status: string, err?: Error) => void) | null,
    on: jest.fn(),
    subscribe: jest.fn(),
    __topic: topic,
  } satisfies MockChannel;
  ch.on.mockImplementation((type: string, filter: Record<string, unknown>, cb: (p: unknown) => void) => {
    ch.bindings.push({ type, filter, cb });
    return ch;
  });
  ch.subscribe.mockImplementation((cb?: (status: string, err?: Error) => void) => {
    ch.subscribeCb = cb ?? null;
    return ch;
  });
  return ch;
}

const mockChannel = jest.fn((topic: string) => {
  const ch = makeMockChannel(topic);
  channels.push(ch);
  return ch;
});

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    channel: (topic: string) => mockChannel(topic),
    removeChannel: jest.fn(),
    functions: { invoke: jest.fn() },
  },
  SUPABASE_CONFIGURED: true,
}));

import { renderHook, act } from '@testing-library/react-native';
import { usePointTagsRealtime } from '../src/features/metadata/usePointTagsRealtime';
import type { PointTagRealtimeEvent } from '../src/features/metadata/pointTagsRealtime';

function lastChannel(): MockChannel {
  return channels[channels.length - 1];
}

function insertBinding(ch: MockChannel): Binding {
  return ch.bindings.find((b) => (b.filter as { event?: string }).event === 'INSERT')!;
}

function updateBinding(ch: MockChannel): Binding {
  return ch.bindings.find((b) => (b.filter as { event?: string }).event === 'UPDATE')!;
}

beforeEach(() => {
  channels.length = 0;
  mockChannel.mockClear();
});

// ── Apply-path echo suppression ───────────────────────────────

describe('echo suppression — apply path', () => {
  it('suppresses an INSERT whose row id was marked as a local apply', () => {
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    act(() => {
      hook.result.current.markLocalApply('t-own');
    });
    insertBinding(lastChannel()).cb({
      new: {
        id: 't-own',
        debate_id: 'abc',
        argument_id: 'a-1',
        tag_code: 'needs_source',
        tagged_by: 'u-me',
        created_at: '2026-05-20T10:00:00.000Z',
        removed_at: null,
      },
    });
    expect(onMergeEvent).not.toHaveBeenCalled();
  });

  it('one-shot consumes the local marker (second matching INSERT is NOT suppressed)', () => {
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    act(() => {
      hook.result.current.markLocalApply('t-own');
    });
    // First INSERT — suppressed.
    insertBinding(lastChannel()).cb({
      new: {
        id: 't-own', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-me', created_at: '2026-05-20T10:00:00.000Z', removed_at: null,
      },
    });
    expect(onMergeEvent).not.toHaveBeenCalled();
    // Second INSERT with same id (shouldn't happen in practice but the
    // suppression is one-shot and the merger is idempotent on duplicate
    // ids; the hook still emits the event so the reducer can return its
    // reference-equal no-op).
    insertBinding(lastChannel()).cb({
      new: {
        id: 't-own', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-me', created_at: '2026-05-20T10:00:00.000Z', removed_at: null,
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
  });

  it('does NOT suppress an INSERT for a different row id (another participant)', () => {
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    act(() => {
      hook.result.current.markLocalApply('t-own');
    });
    insertBinding(lastChannel()).cb({
      new: {
        id: 't-other',
        debate_id: 'abc',
        argument_id: 'a-1',
        tag_code: 'needs_source',
        tagged_by: 'u-other',
        created_at: '2026-05-20T10:01:00.000Z',
        removed_at: null,
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
    expect((onMergeEvent.mock.calls[0][0] as PointTagRealtimeEvent).row.id).toBe('t-other');
  });

  it('two participants applying the same tag code see both events', () => {
    const onMergeEvent = jest.fn();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    // No local marker registered — these are both "other people's" writes.
    insertBinding(lastChannel()).cb({
      new: {
        id: 't-alice', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-alice', created_at: '2026-05-20T10:00:00.000Z', removed_at: null,
      },
    });
    insertBinding(lastChannel()).cb({
      new: {
        id: 't-bob', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-bob', created_at: '2026-05-20T10:00:01.000Z', removed_at: null,
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(2);
    const ids = (onMergeEvent.mock.calls as [PointTagRealtimeEvent][]).map((c) => c[0].row.id).sort();
    expect(ids).toEqual(['t-alice', 't-bob']);
  });
});

// ── Remove-path echo suppression ──────────────────────────────

describe('echo suppression — remove path', () => {
  it('suppresses an UPDATE with removed_at=set when the predicate matches', () => {
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    act(() => {
      hook.result.current.markLocalRemoveByPredicate({
        argumentId: 'a-1',
        tagCode: 'needs_source',
        taggedByUserId: 'u-me',
      });
    });
    updateBinding(lastChannel()).cb({
      new: {
        id: 't-1',
        debate_id: 'abc',
        argument_id: 'a-1',
        tag_code: 'needs_source',
        tagged_by: 'u-me',
        created_at: '2026-05-20T10:00:00.000Z',
        removed_at: '2026-05-20T10:01:00.000Z',
      },
    });
    expect(onMergeEvent).not.toHaveBeenCalled();
  });

  it('one-shot consumes the predicate (second matching UPDATE flows through)', () => {
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    act(() => {
      hook.result.current.markLocalRemoveByPredicate({
        argumentId: 'a-1', tagCode: 'needs_source', taggedByUserId: 'u-me',
      });
    });
    // First matching UPDATE — suppressed.
    updateBinding(lastChannel()).cb({
      new: {
        id: 't-1', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-me', created_at: '2026-05-20T10:00:00.000Z',
        removed_at: '2026-05-20T10:01:00.000Z',
      },
    });
    // Second UPDATE with same predicate — predicate consumed, so this
    // event flows through to the merger.
    updateBinding(lastChannel()).cb({
      new: {
        id: 't-2', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-me', created_at: '2026-05-20T10:02:00.000Z',
        removed_at: '2026-05-20T10:03:00.000Z',
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
    expect((onMergeEvent.mock.calls[0][0] as PointTagRealtimeEvent).row.id).toBe('t-2');
  });

  it('does NOT suppress when the predicate matches argumentId but not tagCode', () => {
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    act(() => {
      hook.result.current.markLocalRemoveByPredicate({
        argumentId: 'a-1', tagCode: 'needs_source', taggedByUserId: 'u-me',
      });
    });
    updateBinding(lastChannel()).cb({
      new: {
        id: 't-1', debate_id: 'abc', argument_id: 'a-1', tag_code: 'tangent',
        tagged_by: 'u-me', created_at: '2026-05-20T10:00:00.000Z',
        removed_at: '2026-05-20T10:01:00.000Z',
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
  });

  it('does NOT suppress when the predicate matches tagCode but a different tagger removed the row', () => {
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    act(() => {
      hook.result.current.markLocalRemoveByPredicate({
        argumentId: 'a-1', tagCode: 'needs_source', taggedByUserId: 'u-me',
      });
    });
    updateBinding(lastChannel()).cb({
      new: {
        id: 't-1', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-admin', created_at: '2026-05-20T10:00:00.000Z',
        removed_at: '2026-05-20T10:01:00.000Z',
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
  });

  it('markLocalRemove (id-keyed) suppresses an UPDATE with matching row id', () => {
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    act(() => {
      hook.result.current.markLocalRemove('t-1');
    });
    updateBinding(lastChannel()).cb({
      new: {
        id: 't-1', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-me', created_at: '2026-05-20T10:00:00.000Z',
        removed_at: '2026-05-20T10:01:00.000Z',
      },
    });
    expect(onMergeEvent).not.toHaveBeenCalled();
  });
});

// ── Concurrent two-user — neither suppressed ──────────────────

describe('concurrent two-user apply within 100 ms — both events flow through', () => {
  it('two participants tagging the same node produce two events with both row ids visible', () => {
    const onMergeEvent = jest.fn();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    const insert = insertBinding(lastChannel());
    // No local marker — both writes are "other people's" from this
    // client's perspective.
    insert.cb({
      new: {
        id: 't-alice', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-alice', created_at: '2026-05-20T10:00:00.000Z', removed_at: null,
      },
    });
    insert.cb({
      new: {
        id: 't-bob', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-bob', created_at: '2026-05-20T10:00:00.050Z', removed_at: null,
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(2);
    const ids = (onMergeEvent.mock.calls as [PointTagRealtimeEvent][]).map((c) => c[0].row.id).sort();
    expect(ids).toEqual(['t-alice', 't-bob']);
  });
});

// ── TTL expiry ────────────────────────────────────────────────

describe('echo TTL expiry', () => {
  it('TTL expiry releases the marker; a subsequent INSERT for the same id flows through', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-20T10:00:00.000Z'));
    const onMergeEvent = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime(
      'abc',
      { onMergeEvent, onReconcileNeeded: () => undefined, echoTtlMs: 1_000 },
    ));
    act(() => {
      hook.result.current.markLocalApply('t-own');
    });
    // Advance past the TTL.
    jest.setSystemTime(new Date('2026-05-20T10:00:02.000Z'));
    insertBinding(lastChannel()).cb({
      new: {
        id: 't-own', debate_id: 'abc', argument_id: 'a-1', tag_code: 'needs_source',
        tagged_by: 'u-me', created_at: '2026-05-20T10:00:00.000Z', removed_at: null,
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
