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

interface UnaddressedDbRow {
  debate_id: string;
  argument_id: string;
}

interface State {
  unaddressedMoveIdsByDebateId: Record<string, string[]>;
  loading: boolean;
}

const EMPTY: Record<string, string[]> = {};

export function useGalleryMoveMarks(
  debateIds: string[],
  enabled: boolean,
): State & { refresh: () => void } {
  const [state, setState] = useState<State>({ unaddressedMoveIdsByDebateId: {}, loading: false });
  const [reloadToken, setReloadToken] = useState(0);
  const inflightRef = useRef(false);

  const idsKey = useMemo(() => debateIds.slice().sort().join(','), [debateIds]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !SUPABASE_CONFIGURED || !idsKey) {
      setState({ unaddressedMoveIdsByDebateId: {}, loading: false });
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
        setState({ unaddressedMoveIdsByDebateId: {}, loading: false });
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
      setState({ unaddressedMoveIdsByDebateId: map, loading: false });
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
    refresh: () => setReloadToken((n) => n + 1),
  };
}
