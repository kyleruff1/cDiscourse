/**
 * MARK-002 (#894) — useMarkers hook.
 *
 * Fetches non-deleted timestamp_markers rows for a rooms arguments (RLS-scoped
 * anon-key + JWT read; the MARK-001 SELECT policy) and returns them grouped both
 * by the quoted (target) argument id AND by the reply that consumed each marker.
 * Returns empty maps and performs NO fetch when enabled === false (the flag-off
 * path), so a flag-off room is byte-identical to today. Exposes refetch() for
 * post-mint convergence.
 *
 * No featureFlags import (App.tsx is the sole flag consumer; the mount decision
 * arrives as the enabled prop). No service role. No write. Comments are
 * apostrophe-free for scanner safety.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../../../lib/supabase';
import {
  groupMarkersByReply,
  groupMarkersByTarget,
  type MarkerRow,
} from './timestampMarkerModel';

const MARKER_COLUMNS =
  'id, debate_id, target_argument_id, reply_argument_id, created_by, kind, span_start, span_end, span_unit, quoted_text, created_at, deleted_at';

export interface UseMarkersResult {
  markersByTargetId: Record<string, ReadonlyArray<MarkerRow>>;
  markersByReplyId: Record<string, ReadonlyArray<MarkerRow>>;
  loading: boolean;
  refetch: () => Promise<void>;
}

const EMPTY: Record<string, ReadonlyArray<MarkerRow>> = {};

export function useMarkers(
  debateId: string | null | undefined,
  argumentIds: ReadonlyArray<string>,
  enabled: boolean,
): UseMarkersResult {
  const [rows, setRows] = useState<ReadonlyArray<MarkerRow>>([]);
  const [loading, setLoading] = useState(false);
  // Sorted-join key so the effect re-runs only when the id SET changes.
  const idsKey = useMemo(() => [...argumentIds].sort().join(','), [argumentIds]);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!enabled || !SUPABASE_CONFIGURED || !debateId || argumentIds.length === 0) {
      if (mountedRef.current) setRows([]);
      return;
    }
    if (mountedRef.current) setLoading(true);
    try {
      // A marker is visible iff its target_argument_id is room-visible (the
      // shipped SELECT policy). We scope the read to the loaded moves so the
      // reply-side chips and source-span highlights only cover on-screen cards.
      const { data, error } = await supabase
        .from('timestamp_markers')
        .select(MARKER_COLUMNS)
        .eq('debate_id', debateId)
        .in('target_argument_id', [...argumentIds])
        .is('deleted_at', null);
      if (error) {
        if (mountedRef.current) setRows([]);
        return;
      }
      if (mountedRef.current) setRows((data ?? []) as unknown as MarkerRow[]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // idsKey stands in for argumentIds; debateId + enabled complete the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debateId, idsKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const markersByTargetId = useMemo(
    () => (enabled ? groupMarkersByTarget(rows) : EMPTY),
    [enabled, rows],
  );
  const markersByReplyId = useMemo(
    () => (enabled ? groupMarkersByReply(rows) : EMPTY),
    [enabled, rows],
  );

  return { markersByTargetId, markersByReplyId, loading, refetch };
}
