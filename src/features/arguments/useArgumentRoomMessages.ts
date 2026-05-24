/**
 * Stage 6.2 — Full-room message loader for Stack + Timeline modes.
 *
 * Distinct from `useArgumentViewport`: this hook does NOT depend on
 * expanded/collapsed tree state. It loads every posted argument visible
 * to RLS in the debate room, plus its tag/flag relations, so the game
 * surface and the timeline map always see the full conversation.
 *
 *  - No service-role.
 *  - No `visibleArgumentIds` filtering.
 *  - Soft-deleted rows are excluded (`status === 'posted'` only).
 *  - Refresh re-pulls everything and tells the caller what the latest id is.
 *
 * META-1B — Owns the realtime `point_tags` channel for the open room when
 * `enableRealtime !== false`. The realtime layer updates the same
 * `pointTagsByArgumentId` map this loader already exposes; the downstream
 * `ArgumentGameSurface` metadata-ledger memo therefore picks up live tag
 * changes from other participants without a refresh. Subscription
 * teardown is automatic on room exit (effect cleanup) and on debateId
 * change. Echo suppression markers are exposed for the surface's write
 * path callbacks so own-writes do not double-apply.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listArgumentsForDebate,
  fetchArgumentRelations,
  fetchPointTagsForArguments,
} from './argumentsApi';
import type {
  ArgumentRow,
  ArgumentTag,
  ArgumentFlag,
  TopicSatisfactionCheck,
  PersistedPointTag,
} from './types';
import {
  mergeRealtimeEvent,
  mergeReconcileResult,
  type PointTagSubscriptionStatus,
} from '../metadata/pointTagsRealtime';
import {
  usePointTagsRealtime,
  type RemoveEchoPredicate,
} from '../metadata/usePointTagsRealtime';

export interface ArgumentRoomMessagesResult {
  /** All posted messages in the room, chronological. */
  messages: ArgumentRow[];
  /** Per-message tag codes from `argument_tags`. */
  tagsByArgumentId: Record<string, ArgumentTag[]>;
  /** Per-message non-dismissed flags from `argument_flags`. */
  flagsByArgumentId: Record<string, ArgumentFlag[]>;
  /** Per-message topic-satisfaction-check rows. */
  checksByArgumentId: Record<string, TopicSatisfactionCheck[]>;
  /** META-1A — Per-message persisted manual-tag rows (active only).
   *  META-1B keeps this map live by merging realtime events into it. */
  pointTagsByArgumentId: Record<string, PersistedPointTag[]>;
  /** Whether the initial load is still pending. */
  loading: boolean;
  /** Last fetch error, if any. */
  error: string | null;
  /** Latest message id (chronologically last). */
  latestId: string | null;
  /** Force a re-fetch. */
  refresh: () => void;
  /** Set after a successful submit. The hook reloads + selects the latest. */
  noteSubmittedAt: (timestamp: string) => void;
  /** Timestamp of the most recent fetch (ISO). */
  loadedAt: string | null;
  /** True when the initial fetch has completed once. */
  initialized: boolean;
  /** META-1B — Current realtime channel subscription status. `'idle'`
   *  while not connected or when realtime is disabled. */
  realtimeStatus: PointTagSubscriptionStatus;
  /** META-1B — Mark a just-applied point-tag row id as a local write so the
   *  echo from the realtime channel is suppressed. One-shot consumption. */
  markLocalPointTagApply: (rowId: string) => void;
  /** META-1B — Mark a remove by predicate. The Edge Function does NOT
   *  return the soft-deleted row id, so the next matching realtime UPDATE
   *  within the TTL is consumed exactly once. */
  markLocalPointTagRemoveByPredicate: (predicate: RemoveEchoPredicate) => void;
}

const DEFAULT_LIMIT = 1000;

export function useArgumentRoomMessages(
  debateId: string,
  options: { limit?: number; enableRealtime?: boolean } = {},
): ArgumentRoomMessagesResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const enableRealtime = options.enableRealtime !== false;
  const [messages, setMessages] = useState<ArgumentRow[]>([]);
  const [tagsByArgumentId, setTags] = useState<Record<string, ArgumentTag[]>>({});
  const [flagsByArgumentId, setFlags] = useState<Record<string, ArgumentFlag[]>>({});
  const [checksByArgumentId, setChecks] = useState<Record<string, TopicSatisfactionCheck[]>>({});
  const [pointTagsByArgumentId, setPointTags] = useState<Record<string, PersistedPointTag[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const inflightRef = useRef(false);
  // META-1B — keep a ref to the latest loaded argument ids for the
  // reconcile callback (avoids re-creating the callback on every render).
  const argumentIdsRef = useRef<string[]>([]);

  const refresh = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  const noteSubmittedAt = useCallback((_timestamp: string) => {
    refresh();
  }, [refresh]);

  // ── META-1B — realtime merge + reconcile callbacks ──────────
  const onMergeEvent = useCallback((event: { kind: 'apply' | 'remove'; row: PersistedPointTag }) => {
    setPointTags((prev) => mergeRealtimeEvent(prev, event));
  }, []);

  const onReconcileNeeded = useCallback(async () => {
    const ids = argumentIdsRef.current;
    if (!ids || ids.length === 0) {
      // Empty room — reset the map idempotently. mergeReconcileResult
      // returns reference-equal when nothing changes.
      setPointTags((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const result = await fetchPointTagsForArguments(ids);
    if (!result.ok) {
      // Scoped reconcile failed — fall back to a full refresh which
      // re-runs the loader (heavy but safe). The realtime channel
      // keeps running; no further action required here.
      refresh();
      return;
    }
    const grouped: Record<string, PersistedPointTag[]> = {};
    for (const row of result.data) {
      if (row.removedAt != null) continue;
      const list = grouped[row.argumentId];
      if (list) list.push(row);
      else grouped[row.argumentId] = [row];
    }
    setPointTags((prev) => mergeReconcileResult(prev, grouped, ids));
  }, [refresh]);

  const {
    status: realtimeStatus,
    markLocalApply: markLocalPointTagApply,
    markLocalRemoveByPredicate: markLocalPointTagRemoveByPredicate,
  } = usePointTagsRealtime(enableRealtime && debateId ? debateId : null, {
    onMergeEvent,
    onReconcileNeeded,
  });

  useEffect(() => {
    let cancelled = false;
    if (!debateId) return;
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await listArgumentsForDebate(debateId, limit);
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          setLoading(false);
          inflightRef.current = false;
          setInitialized(true);
          return;
        }
        const rows = result.data;
        const ids = rows.map((r) => r.id);
        const rel = await fetchArgumentRelations(ids);
        if (cancelled) return;
        const tagMap: Record<string, ArgumentTag[]> = {};
        const flagMap: Record<string, ArgumentFlag[]> = {};
        const checkMap: Record<string, TopicSatisfactionCheck[]> = {};
        const pointTagMap: Record<string, PersistedPointTag[]> = {};
        if (rel.ok) {
          for (const t of rel.data.tags) {
            (tagMap[t.argumentId] = tagMap[t.argumentId] || []).push(t);
          }
          for (const f of rel.data.flags) {
            (flagMap[f.argumentId] = flagMap[f.argumentId] || []).push(f);
          }
          for (const c of rel.data.checks) {
            (checkMap[c.argumentId] = checkMap[c.argumentId] || []).push(c);
          }
          for (const pt of rel.data.pointTags) {
            (pointTagMap[pt.argumentId] = pointTagMap[pt.argumentId] || []).push(pt);
          }
        }
        setMessages(rows);
        setTags(tagMap);
        setFlags(flagMap);
        setChecks(checkMap);
        setPointTags(pointTagMap);
        // META-1B — record the latest argument id set so the realtime
        // reconcile callback can re-fetch tags for the right scope after
        // a (re)subscribe. Stored in a ref to avoid re-creating the
        // reconcile callback on every load.
        argumentIdsRef.current = ids;
        setLoadedAt(new Date().toISOString());
        setInitialized(true);
        setLoading(false);
      } finally {
        inflightRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [debateId, limit, reloadToken]);

  const latestId = useMemo(() => {
    if (messages.length === 0) return null;
    // Messages already arrive ordered by created_at asc.
    return messages[messages.length - 1].id;
  }, [messages]);

  return {
    messages,
    tagsByArgumentId,
    flagsByArgumentId,
    checksByArgumentId,
    pointTagsByArgumentId,
    loading,
    error,
    latestId,
    refresh,
    noteSubmittedAt,
    loadedAt,
    initialized,
    realtimeStatus,
    markLocalPointTagApply,
    markLocalPointTagRemoveByPredicate,
  };
}
