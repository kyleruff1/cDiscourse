/**
 * META-1B — `usePointTagsRealtime` hook lifecycle tests.
 *
 * The Supabase Realtime channel is mocked. The mock channel exposes:
 *   - `on(type, filter, callback)` — records the binding.
 *   - `subscribe(cb, timeout?)` — records the subscribe callback so the
 *     test can drive state transitions (SUBSCRIBED / CHANNEL_ERROR /
 *     CLOSED / TIMED_OUT).
 *   - The test calls the recorded callbacks to simulate Realtime events.
 *
 * Establishes the realtime-mock pattern for the repo (META-1B is the
 * first card to introduce a Supabase Realtime postgres-changes
 * subscription).
 */
import * as fs from 'fs';
import * as path from 'path';

// ── Mock channel + supabase client ──────────────────────────

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
  // identifier used to assert removeChannel was called with the right channel
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

const mockRemoveChannel = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    channel: (topic: string) => mockChannel(topic),
    removeChannel: (ch: unknown) => mockRemoveChannel(ch),
    functions: { invoke: jest.fn() },
  },
  SUPABASE_CONFIGURED: true,
}));

// Now import the hook AFTER the mock is set up.
import { renderHook, act } from '@testing-library/react-native';
import { usePointTagsRealtime, logRealtimeError } from '../src/features/metadata/usePointTagsRealtime';
import type { PointTagRealtimeEvent } from '../src/features/metadata/pointTagsRealtime';

function lastChannel(): MockChannel {
  return channels[channels.length - 1];
}

// Suppress the hook's structured `console.warn` logger output for the
// intentional invalid-payload and channel-error tests below. The logger
// shape itself is asserted in the `logRealtimeError` describe block.
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  channels.length = 0;
  mockChannel.mockClear();
  mockRemoveChannel.mockClear();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

// ── Subscribe + binding shape ─────────────────────────────────

describe('usePointTagsRealtime — subscribe + binding shape', () => {
  it('creates a channel named point_tags:debate:<debateId> on mount', () => {
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel).toHaveBeenCalledWith('point_tags:debate:abc');
  });

  it('binds INSERT on point_tags filtered by debate_id', () => {
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    const ch = lastChannel();
    const insertBinding = ch.bindings.find(
      (b) => b.type === 'postgres_changes' && (b.filter as { event?: string }).event === 'INSERT',
    );
    expect(insertBinding).toBeDefined();
    expect(insertBinding!.filter).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'point_tags',
      filter: 'debate_id=eq.abc',
    });
  });

  it('binds UPDATE on point_tags filtered by debate_id', () => {
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    const ch = lastChannel();
    const updateBinding = ch.bindings.find(
      (b) => b.type === 'postgres_changes' && (b.filter as { event?: string }).event === 'UPDATE',
    );
    expect(updateBinding).toBeDefined();
    expect(updateBinding!.filter).toEqual({
      event: 'UPDATE',
      schema: 'public',
      table: 'point_tags',
      filter: 'debate_id=eq.abc',
    });
  });

  it('calls subscribe(cb) on mount', () => {
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    expect(lastChannel().subscribe).toHaveBeenCalledTimes(1);
    expect(typeof lastChannel().subscribeCb).toBe('function');
  });

  it('does not subscribe when debateId is null', () => {
    renderHook(() => usePointTagsRealtime(null, { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('does not subscribe when debateId is an empty string', () => {
    renderHook(() => usePointTagsRealtime('', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    expect(mockChannel).not.toHaveBeenCalled();
  });
});

// ── Subscribe-state transitions ───────────────────────────────

describe('usePointTagsRealtime — subscribe-state transitions', () => {
  it('SUBSCRIBED transitions status to subscribed', () => {
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    act(() => {
      lastChannel().subscribeCb!('SUBSCRIBED');
    });
    expect(hook.result.current.status).toBe('subscribed');
  });

  it('SUBSCRIBED triggers onReconcileNeeded exactly once per join', () => {
    const onReconcileNeeded = jest.fn();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded }));
    act(() => {
      lastChannel().subscribeCb!('SUBSCRIBED');
    });
    expect(onReconcileNeeded).toHaveBeenCalledTimes(1);
  });

  it('CHANNEL_ERROR transitions to reconnecting and schedules a retry', () => {
    jest.useFakeTimers();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    const firstChannel = lastChannel();
    act(() => {
      firstChannel.subscribeCb!('CHANNEL_ERROR', new Error('socket dropped'));
    });
    expect(hook.result.current.status).toBe('reconnecting');
    // Advance past the first backoff (1000 ms) to trigger the retry.
    act(() => {
      jest.advanceTimersByTime(1_500);
    });
    expect(mockRemoveChannel).toHaveBeenCalledWith(firstChannel);
    expect(mockChannel).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('CLOSED transitions to reconnecting and schedules a retry', () => {
    jest.useFakeTimers();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    act(() => {
      lastChannel().subscribeCb!('CLOSED');
    });
    expect(hook.result.current.status).toBe('reconnecting');
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(mockChannel).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('TIMED_OUT retries immediately (no backoff counter increment)', () => {
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    expect(mockChannel).toHaveBeenCalledTimes(1);
    act(() => {
      lastChannel().subscribeCb!('TIMED_OUT');
    });
    // One immediate retry.
    expect(mockChannel).toHaveBeenCalledTimes(2);
  });

  it('SUBSCRIBED after a CHANNEL_ERROR resets the backoff counter', () => {
    jest.useFakeTimers();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    // Cycle through one error + retry; SUBSCRIBED on the retry must reset.
    act(() => {
      lastChannel().subscribeCb!('CHANNEL_ERROR');
    });
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    act(() => {
      lastChannel().subscribeCb!('SUBSCRIBED');
    });
    // Now an error again should backoff with attempt=0 (1s base), not
    // attempt=2 (4s). Trigger and verify a retry fires before 4s.
    act(() => {
      lastChannel().subscribeCb!('CHANNEL_ERROR');
    });
    const channelCountBefore = channels.length;
    act(() => {
      jest.advanceTimersByTime(1_500);
    });
    expect(channels.length).toBeGreaterThan(channelCountBefore);
    jest.useRealTimers();
  });
});

// ── Teardown ──────────────────────────────────────────────────

describe('usePointTagsRealtime — teardown', () => {
  it('unmount calls removeChannel exactly once', () => {
    const { unmount } = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
    const ch = lastChannel();
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(ch);
  });

  it('debateId change tears down the old channel and creates a new one', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) =>
        usePointTagsRealtime(id, { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }),
      { initialProps: { id: 'abc' as string | null } },
    );
    const first = lastChannel();
    rerender({ id: 'xyz' });
    expect(mockRemoveChannel).toHaveBeenCalledWith(first);
    expect(mockChannel).toHaveBeenLastCalledWith('point_tags:debate:xyz');
  });

  it('100x mount/unmount loop leaves no leaked channels (every channel torn down)', () => {
    for (let i = 0; i < 100; i++) {
      const { unmount } = renderHook(() => usePointTagsRealtime(`debate-${i}`, { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }));
      unmount();
    }
    // Every channel created should have been removed.
    expect(mockChannel).toHaveBeenCalledTimes(100);
    expect(mockRemoveChannel).toHaveBeenCalledTimes(100);
  });

  it('transitioning debateId to null tears down without creating a new channel', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) =>
        usePointTagsRealtime(id, { onMergeEvent: () => undefined, onReconcileNeeded: () => undefined }),
      { initialProps: { id: 'abc' as string | null } },
    );
    const before = mockChannel.mock.calls.length;
    rerender({ id: null });
    expect(mockChannel).toHaveBeenCalledTimes(before);
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});

// ── Event handling — INSERT ───────────────────────────────────

describe('usePointTagsRealtime — INSERT handling', () => {
  it('calls onMergeEvent with kind=apply on a valid INSERT payload', () => {
    const onMergeEvent = jest.fn();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    const insertBinding = lastChannel().bindings.find(
      (b) => (b.filter as { event?: string }).event === 'INSERT',
    )!;
    insertBinding.cb({
      new: {
        id: 't-1',
        debate_id: 'abc',
        argument_id: 'a-1',
        tag_code: 'needs_source',
        tagged_by: 'u-2',
        created_at: '2026-05-20T10:00:00.000Z',
        removed_at: null,
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
    const event = onMergeEvent.mock.calls[0][0] as PointTagRealtimeEvent;
    expect(event.kind).toBe('apply');
    expect(event.row.id).toBe('t-1');
    expect(event.row.argumentId).toBe('a-1');
  });

  it('drops an INSERT with missing required fields', () => {
    const onMergeEvent = jest.fn();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    const insertBinding = lastChannel().bindings.find(
      (b) => (b.filter as { event?: string }).event === 'INSERT',
    )!;
    insertBinding.cb({ new: { id: 't-1' /* incomplete */ } });
    expect(onMergeEvent).not.toHaveBeenCalled();
  });
});

// ── Event handling — UPDATE ───────────────────────────────────

describe('usePointTagsRealtime — UPDATE handling', () => {
  it('emits kind=remove when removed_at is set', () => {
    const onMergeEvent = jest.fn();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    const updateBinding = lastChannel().bindings.find(
      (b) => (b.filter as { event?: string }).event === 'UPDATE',
    )!;
    updateBinding.cb({
      new: {
        id: 't-1',
        debate_id: 'abc',
        argument_id: 'a-1',
        tag_code: 'needs_source',
        tagged_by: 'u-2',
        created_at: '2026-05-20T10:00:00.000Z',
        removed_at: '2026-05-20T11:00:00.000Z',
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
    expect((onMergeEvent.mock.calls[0][0] as PointTagRealtimeEvent).kind).toBe('remove');
  });

  it('treats UPDATE with removed_at=null as a re-apply event', () => {
    const onMergeEvent = jest.fn();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent, onReconcileNeeded: () => undefined }));
    const updateBinding = lastChannel().bindings.find(
      (b) => (b.filter as { event?: string }).event === 'UPDATE',
    )!;
    updateBinding.cb({
      new: {
        id: 't-1',
        debate_id: 'abc',
        argument_id: 'a-1',
        tag_code: 'needs_source',
        tagged_by: 'u-2',
        created_at: '2026-05-20T10:00:00.000Z',
        removed_at: null,
      },
    });
    expect(onMergeEvent).toHaveBeenCalledTimes(1);
    expect((onMergeEvent.mock.calls[0][0] as PointTagRealtimeEvent).kind).toBe('apply');
  });
});

// ── Reconcile flow ────────────────────────────────────────────

describe('usePointTagsRealtime — reconcile', () => {
  it('does NOT call reconcile before SUBSCRIBED', () => {
    const onReconcileNeeded = jest.fn();
    renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded }));
    expect(onReconcileNeeded).not.toHaveBeenCalled();
  });

  it('reconcileNow can be invoked imperatively', () => {
    const onReconcileNeeded = jest.fn();
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded }));
    act(() => {
      hook.result.current.reconcileNow();
    });
    expect(onReconcileNeeded).toHaveBeenCalledTimes(1);
  });

  it('swallows a synchronous throw from the consumer reconcile callback', () => {
    const onReconcileNeeded = jest.fn(() => {
      throw new Error('boom');
    });
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded }));
    expect(() => act(() => {
      hook.result.current.reconcileNow();
    })).not.toThrow();
  });

  it('swallows an async rejection from the consumer reconcile callback', async () => {
    const onReconcileNeeded = jest.fn(() => Promise.reject(new Error('boom-async')));
    const hook = renderHook(() => usePointTagsRealtime('abc', { onMergeEvent: () => undefined, onReconcileNeeded }));
    await act(async () => {
      hook.result.current.reconcileNow();
    });
    // No throw observable to the caller.
  });
});

// ── logRealtimeError — never logs payload bodies ──────────────

describe('logRealtimeError', () => {
  it('logs only name + message, never the raw error object', () => {
    // The outer beforeEach already silences console.warn; assert against
    // that spy instead of installing a second one.
    const err = new Error('socket dropped at line 42 with body=secret');
    logRealtimeError('point_tags_channel_closed', err);
    expect(warnSpy).toHaveBeenCalled();
    const lastCall = warnSpy.mock.calls[warnSpy.mock.calls.length - 1];
    expect(lastCall[0]).toBe('[META-1B] point_tags_channel_closed');
    expect(lastCall[1]).toEqual({ name: 'Error', message: 'socket dropped at line 42 with body=secret' });
  });

  it('handles a missing error gracefully', () => {
    logRealtimeError('point_tags_invalid_payload', null);
    const lastCall = warnSpy.mock.calls[warnSpy.mock.calls.length - 1];
    expect(lastCall[0]).toBe('[META-1B] point_tags_invalid_payload');
    expect(lastCall[1]).toEqual({ name: null, message: null });
  });

  it('the hook source file never logs the Authorization header literal', () => {
    const abs = path.join(__dirname, '..', 'src/features/metadata/usePointTagsRealtime.ts');
    const raw = fs.readFileSync(abs, 'utf-8');
    expect(raw).not.toMatch(/console\.log\([^)]*authorization/i);
    expect(raw).not.toMatch(/console\.warn\([^)]*authorization/i);
    // The source must never console.log a JWT-shape string.
    expect(raw).not.toMatch(/console\.log\([^)]*Bearer\s/i);
  });
});
