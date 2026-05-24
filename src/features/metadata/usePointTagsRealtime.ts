/**
 * META-1B — React hook that owns the Supabase Realtime channel lifecycle
 * for `public.point_tags` rows scoped to one debate.
 *
 * Owns:
 *   - Channel creation (`point_tags:debate:${debateId}`).
 *   - postgres_changes subscriptions for INSERT + UPDATE on `point_tags`
 *     filtered by `debate_id`.
 *   - Subscribe-state machine (`subscribing` → `subscribed` →
 *     `reconnecting` → `failed`) with exponential backoff (max 6 attempts,
 *     capped 30 s).
 *   - Initial + post-reconnect reconcile via the caller-supplied
 *     `onReconcileNeeded` callback.
 *   - Echo suppression by row id (apply path) and by predicate (remove
 *     path — Edge Function does not return the soft-deleted row id).
 *   - Teardown on unmount AND on `debateId` change.
 *   - Cleanup of echo-tracker entries past their TTL.
 *
 * Doctrine:
 *   - JWT-only auth: the shared `supabase` client carries the authed JWT
 *     from `AsyncStorage`-backed sessions. Realtime inherits the same
 *     auth context. NO service-role key is touched.
 *   - No AI inference; no remote call other than the realtime channel
 *     itself (whose payload is read-only postgres changes).
 *   - No user content in any log; only topic + status + error message.
 *   - All user-facing copy is routed through `ROOM_REALTIME_COPY` in
 *     `gameCopy.ts` by the consumer; this hook produces no strings.
 *   - Tagger identity is preserved in the row payload but never logged
 *     and never composed into a string here.
 *
 * Pre-implementer survey confirms META-1B is the first card to introduce a
 * Supabase Realtime postgres-changes subscription in the production app.
 * This file therefore establishes the patterns the repo will reuse: topic
 * naming, JWT-only auth, teardown on unmount, reconcile on SUBSCRIBED,
 * echo suppression by row id.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  mapPointTagsRealtimeRow,
  pruneExpiredLocalIds,
  shouldSuppressEcho,
  type PointTagRealtimeEvent,
  type PointTagSubscriptionStatus,
  DEFAULT_ECHO_TTL_MS,
} from './pointTagsRealtime';
import type { ManualTagCode } from './moveMetadataLedger';

// ── Public hook API ───────────────────────────────────────────

/** Predicate used to suppress the echo of a local remove (the Edge
 *  Function does not return the soft-deleted row id; the next matching
 *  UPDATE inside the TTL is consumed). */
export interface RemoveEchoPredicate {
  argumentId: string;
  tagCode: ManualTagCode;
  taggedByUserId: string;
}

export interface UsePointTagsRealtimeOptions {
  /** Called for every merged inbound event (apply / remove) AFTER echo
   *  suppression. The consumer wires this to its `setPointTags` updater. */
  onMergeEvent: (event: PointTagRealtimeEvent) => void;
  /** Called when the channel just subscribed (initial join + each reconnect)
   *  so the consumer can run a scoped reconcile against the server. */
  onReconcileNeeded: () => void | Promise<void>;
  /** Override the echo TTL (default `DEFAULT_ECHO_TTL_MS` = 60 s). */
  echoTtlMs?: number;
}

export interface UsePointTagsRealtimeResult {
  status: PointTagSubscriptionStatus;
  /** Mark a just-applied row id as local so the inbound INSERT for the same
   *  row is suppressed. One-shot consumption. */
  markLocalApply: (rowId: string) => void;
  /** Mark a just-applied row's id as local for a remove flow (when the
   *  caller already knows the row id, e.g., during testing). One-shot. */
  markLocalRemove: (rowId: string) => void;
  /**
   * Mark a remove by predicate — the Edge Function does NOT return the
   * soft-deleted row id in `activeTags`, so the apply-path id trick does
   * not work for removes. The next matching UPDATE within the TTL window
   * is consumed exactly once.
   */
  markLocalRemoveByPredicate: (predicate: RemoveEchoPredicate) => void;
  /** Force a reconcile pass (also runs automatically on SUBSCRIBED). */
  reconcileNow: () => void;
}

// ── Hook ──────────────────────────────────────────────────────

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const MAX_BACKOFF_ATTEMPTS = 6;

export function usePointTagsRealtime(
  debateId: string | null,
  options: UsePointTagsRealtimeOptions,
): UsePointTagsRealtimeResult {
  const [status, setStatus] = useState<PointTagSubscriptionStatus>('idle');
  // Channel + connection state stored as refs so re-renders don't churn.
  const channelRef = useRef<RealtimeChannel | null>(null);
  const attemptRef = useRef(0);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  // Echo trackers — maps stored as refs (mutable across event callbacks).
  const recentlyAppliedRef = useRef<Map<string, number>>(new Map());
  const recentlyRemovedRef = useRef<Map<string, number>>(new Map());
  const removePredicatesRef = useRef<RemoveEchoPredicate[]>([]);
  // Keep latest callbacks in refs so the effect can read them without
  // re-running on every render.
  const onMergeRef = useRef(options.onMergeEvent);
  const onReconcileRef = useRef(options.onReconcileNeeded);
  const ttlMsRef = useRef<number>(options.echoTtlMs ?? DEFAULT_ECHO_TTL_MS);
  useEffect(() => {
    onMergeRef.current = options.onMergeEvent;
    onReconcileRef.current = options.onReconcileNeeded;
    ttlMsRef.current = options.echoTtlMs ?? DEFAULT_ECHO_TTL_MS;
  }, [options.onMergeEvent, options.onReconcileNeeded, options.echoTtlMs]);

  // ── Echo-tracker helpers ──────────────────────────────────
  const pruneTrackers = useCallback(() => {
    const now = Date.now();
    recentlyAppliedRef.current = pruneExpiredLocalIds(recentlyAppliedRef.current, now, ttlMsRef.current);
    recentlyRemovedRef.current = pruneExpiredLocalIds(recentlyRemovedRef.current, now, ttlMsRef.current);
    // Remove-predicates do not carry their own timestamps in v1; they are
    // consumed on the next matching event or cleared on debateId change /
    // unmount. To avoid unbounded growth we cap the list at 32 entries
    // (well above any realistic concurrent-remove load).
    if (removePredicatesRef.current.length > 32) {
      removePredicatesRef.current = removePredicatesRef.current.slice(-32);
    }
  }, []);

  const markLocalApply = useCallback((rowId: string) => {
    if (!rowId) return;
    pruneTrackers();
    recentlyAppliedRef.current.set(rowId, Date.now());
  }, [pruneTrackers]);

  const markLocalRemove = useCallback((rowId: string) => {
    if (!rowId) return;
    pruneTrackers();
    recentlyRemovedRef.current.set(rowId, Date.now());
  }, [pruneTrackers]);

  const markLocalRemoveByPredicate = useCallback((predicate: RemoveEchoPredicate) => {
    if (!predicate) return;
    pruneTrackers();
    removePredicatesRef.current.push(predicate);
  }, [pruneTrackers]);

  const reconcileNow = useCallback(() => {
    try {
      const result = onReconcileRef.current();
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(() => {
          // Reconcile failures are surfaced via the caller's fallback path
          // (full refresh()); never log payload bodies here.
        });
      }
    } catch {
      // Defensive: a synchronous throw in the consumer's reconcile must not
      // crash the channel callback.
    }
  }, []);

  // ── Channel callbacks ─────────────────────────────────────
  const handleInsert = useCallback((rawRow: unknown) => {
    const row = mapPointTagsRealtimeRow(rawRow);
    if (!row) {
      // Missing required field — drop the event. The reconcile on the next
      // SUBSCRIBED will pick up the row from the server.
      logRealtimeError('point_tags_invalid_payload', null);
      return;
    }
    pruneTrackers();
    if (shouldSuppressEcho(row.id, recentlyAppliedRef.current)) {
      recentlyAppliedRef.current.delete(row.id);
      return;
    }
    onMergeRef.current({ kind: 'apply', row });
  }, [pruneTrackers]);

  const handleUpdate = useCallback((rawRow: unknown) => {
    const row = mapPointTagsRealtimeRow(rawRow);
    if (!row) {
      logRealtimeError('point_tags_invalid_payload', null);
      return;
    }
    pruneTrackers();
    if (row.removedAt != null) {
      // Remove flow — by id OR by predicate.
      if (shouldSuppressEcho(row.id, recentlyRemovedRef.current)) {
        recentlyRemovedRef.current.delete(row.id);
        return;
      }
      const matchIdx = removePredicatesRef.current.findIndex(
        (p) => p.argumentId === row.argumentId &&
               p.tagCode === row.tagCode &&
               p.taggedByUserId === row.taggedBy,
      );
      if (matchIdx >= 0) {
        removePredicatesRef.current.splice(matchIdx, 1);
        return;
      }
      onMergeRef.current({ kind: 'remove', row });
      return;
    }
    // Rare: UPDATE that does not set removed_at (future admin tool, etc.).
    // Treat as apply / reapply.
    if (shouldSuppressEcho(row.id, recentlyAppliedRef.current)) {
      recentlyAppliedRef.current.delete(row.id);
      return;
    }
    onMergeRef.current({ kind: 'apply', row });
  }, [pruneTrackers]);

  // ── Subscribe lifecycle ───────────────────────────────────
  useEffect(() => {
    unmountedRef.current = false;
    if (!debateId) {
      setStatus('idle');
      return;
    }
    setStatus('subscribing');

    // Local closure captures so the cleanup uses the exact channel we
    // subscribed (avoids the captured-stale-channel leak in strict mode).
    let cancelled = false;
    let localChannel: RealtimeChannel | null = null;

    const scheduleReconnect = () => {
      if (cancelled || unmountedRef.current) return;
      if (attemptRef.current >= MAX_BACKOFF_ATTEMPTS) {
        setStatus('failed');
        return;
      }
      const attempt = attemptRef.current;
      const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, attempt));
      attemptRef.current = attempt + 1;
      if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = setTimeout(() => {
        if (cancelled || unmountedRef.current) return;
        // Tear down the prior channel and re-subscribe with a fresh one.
        if (localChannel) {
          try {
            void supabase.removeChannel(localChannel);
          } catch {
            // Ignore teardown errors; the new subscribe will replace it.
          }
        }
        subscribe();
      }, delay);
    };

    const subscribe = () => {
      const channel = supabase
        .channel(`point_tags:debate:${debateId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'point_tags', filter: `debate_id=eq.${debateId}` },
          (payload) => handleInsert((payload as { new?: unknown }).new),
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'point_tags', filter: `debate_id=eq.${debateId}` },
          (payload) => handleUpdate((payload as { new?: unknown }).new),
        )
        .subscribe((subStatus, err) => {
          if (cancelled || unmountedRef.current) return;
          if (subStatus === 'SUBSCRIBED') {
            attemptRef.current = 0;
            setStatus('subscribed');
            reconcileNow();
            return;
          }
          if (subStatus === 'CHANNEL_ERROR' || subStatus === 'CLOSED') {
            setStatus('reconnecting');
            if (err) logRealtimeError(`point_tags_channel_${subStatus.toLowerCase()}`, err);
            scheduleReconnect();
            return;
          }
          if (subStatus === 'TIMED_OUT') {
            setStatus('reconnecting');
            if (err) logRealtimeError('point_tags_channel_timed_out', err);
            // One immediate retry, not counted toward attempt budget.
            if (localChannel) {
              try {
                void supabase.removeChannel(localChannel);
              } catch {
                // Ignore teardown errors.
              }
            }
            subscribe();
          }
        });
      localChannel = channel;
      channelRef.current = channel;
    };

    subscribe();

    return () => {
      cancelled = true;
      unmountedRef.current = true;
      if (backoffTimerRef.current) {
        clearTimeout(backoffTimerRef.current);
        backoffTimerRef.current = null;
      }
      if (localChannel) {
        try {
          void supabase.removeChannel(localChannel);
        } catch {
          // Tolerate teardown failure (e.g., already removed).
        }
      }
      channelRef.current = null;
      attemptRef.current = 0;
      // Reset echo trackers + remove-predicates — they belong to the prior
      // session and would be stale for any subsequent room.
      recentlyAppliedRef.current = new Map();
      recentlyRemovedRef.current = new Map();
      removePredicatesRef.current = [];
      setStatus('idle');
    };
    // We intentionally omit handleInsert / handleUpdate / reconcileNow —
    // they read live values via refs and are stable; their stable identity
    // is preserved by useCallback above. The effect only re-runs on
    // debateId change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId]);

  return {
    status,
    markLocalApply,
    markLocalRemove,
    markLocalRemoveByPredicate,
    reconcileNow,
  };
}

// ── Structured error logger ───────────────────────────────────

/**
 * Log a realtime error with topic + error message only. NEVER logs payload
 * bodies, the Authorization header, JWTs, or any user content. The
 * `console.warn` shape is the repo's documented fallback while a
 * structured-logger utility is not yet introduced; only this single token
 * + the error's `.name` / `.message` (if present) are emitted.
 *
 * The function is exported only for tests; production callers use it via
 * the hook.
 */
export function logRealtimeError(token: string, err: unknown): void {
  const safeMessage =
    err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : null;
  const safeName =
    err && typeof err === 'object' && typeof (err as { name?: unknown }).name === 'string'
      ? (err as { name: string }).name
      : null;
  // eslint-disable-next-line no-console
  console.warn(`[META-1B] ${token}`, { name: safeName, message: safeMessage });
}
