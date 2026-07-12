/**
 * INTEL-001 (#900) — gated batched gallery move-marks loader.
 *
 * For the loaded gallery debate ids, fetches the ACTIVE `did_not_address`
 * move_marks in ONE `.in('debate_id', ids)` query (RLS-scoped anon-key + JWT
 * read; SELECT-only) and groups the distinct unaddressed argument ids per debate
 * so the gallery deriver can fold dodge-chain hits into the engagement-lane heat
 * term. Performs NO fetch and returns {} when `enabled === false` (the flag-off
 * path) — so a flag-off gallery is byte-identical.
 *
 * No featureFlags import (App.tsx is the sole flag consumer; the mount decision
 * arrives as the `enabled` prop). No service role. No pointStanding — this feeds
 * the engagement-lane heat only, NEVER factual standing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import { ROOM_LOAD_ERROR_COPY } from '../arguments/gameCopy';

// UX-PR-B (#918) — the fixed plain-language read-error sentinel (never the raw
// supabase error object / message; no code leak, ban-list clean).
const READ_ERROR = ROOM_LOAD_ERROR_COPY.hookError;

interface UnaddressedDbRow {
  debate_id: string;
  argument_id: string;
}

interface State {
  unaddressedMoveIdsByDebateId: Record<string, string[]>;
  loading: boolean;
  /**
   * UX-PR-B (#918) — the read-error sentinel (never the raw supabase error), or
   * null on success / skip. Added for silent-hook FAMILY consistency; unlike the
   * four ROOM hooks this feeds only engagement-lane heat enrichment, so there is
   * no gallery-side visible error surface here.
   * // gallery-side surfacing deferred to PR-G (#918)
   */
  error: string | null;
}

const EMPTY: Record<string, string[]> = {};

export function useGalleryMoveMarks(
  debateIds: string[],
  enabled: boolean,
): State & { refresh: () => void } {
  const [state, setState] = useState<State>({
    unaddressedMoveIdsByDebateId: {},
    loading: false,
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);
  const inflightRef = useRef(false);

  const idsKey = useMemo(() => debateIds.slice().sort().join(','), [debateIds]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !SUPABASE_CONFIGURED || !idsKey) {
      // Disabled / unconfigured / no-ids is legitimate ABSENCE, never a failure.
      setState({ unaddressedMoveIdsByDebateId: {}, loading: false, error: null });
      return;
    }
    if (inflightRef.current) return;
    inflightRef.current = true;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const ids = idsKey.split(',').filter(Boolean);
      const { data, error } = await supabase
        .from('move_marks')
        .select('debate_id, argument_id')
        .in('debate_id', ids)
        .eq('mark_code', 'did_not_address')
        .is('retracted_at', null);
      if (cancelled) return;
      if (error) {
        setState({ unaddressedMoveIdsByDebateId: {}, loading: false, error: READ_ERROR });
        inflightRef.current = false;
        return;
      }
      const byDebate: Record<string, Set<string>> = {};
      for (const row of (data ?? []) as UnaddressedDbRow[]) {
        (byDebate[row.debate_id] = byDebate[row.debate_id] || new Set()).add(row.argument_id);
      }
      const map: Record<string, string[]> = {};
      for (const debateId of Object.keys(byDebate)) {
        map[debateId] = [...byDebate[debateId]].sort();
      }
      setState({ unaddressedMoveIdsByDebateId: map, loading: false, error: null });
      inflightRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, idsKey, reloadToken]);

  const value = enabled ? state.unaddressedMoveIdsByDebateId : EMPTY;
  return {
    unaddressedMoveIdsByDebateId: value,
    loading: state.loading,
    error: enabled ? state.error : null,
    refresh: () => setReloadToken((n) => n + 1),
  };
}
