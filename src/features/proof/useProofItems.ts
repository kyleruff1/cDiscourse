/**
 * PROOF-002 (#889) — useProofItems hook.
 *
 * Fetches non-deleted proof_items rows for a rooms arguments (RLS-scoped
 * anon-key + JWT read; the PROOF-001 SELECT policy) and returns them grouped by
 * argument id. Returns {} and performs NO fetch when enabled === false (the
 * flag-off path), so a flag-off room reads JSONB exactly as today. Exposes
 * refetch() for post-attach convergence.
 *
 * No featureFlags import (App.tsx is the sole flag consumer; the mount decision
 * arrives as the `enabled` prop). No service role. No write. Comments are
 * apostrophe-free for scanner safety.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { ProofItemRow } from './proofDrawerModel';

const PROOF_ITEM_COLUMNS =
  'id, debate_id, argument_id, added_by, kind, label, url, source_text, quote, referenced_argument_id, source_chain_status, risk, created_at, deleted_at';

export interface UseProofItemsResult {
  proofItemsByMessageId: Record<string, ReadonlyArray<ProofItemRow>>;
  loading: boolean;
  refetch: () => Promise<void>;
}

function groupByArgument(rows: ReadonlyArray<ProofItemRow>): Record<string, ProofItemRow[]> {
  const out: Record<string, ProofItemRow[]> = {};
  for (const row of rows) {
    const key = row.argument_id;
    if (!out[key]) out[key] = [];
    out[key].push(row);
  }
  return out;
}

export function useProofItems(
  debateId: string | null | undefined,
  argumentIds: ReadonlyArray<string>,
  enabled: boolean,
): UseProofItemsResult {
  const [map, setMap] = useState<Record<string, ReadonlyArray<ProofItemRow>>>({});
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
      if (mountedRef.current) setMap({});
      return;
    }
    if (mountedRef.current) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proof_items')
        .select(PROOF_ITEM_COLUMNS)
        .in('argument_id', [...argumentIds])
        .is('deleted_at', null);
      if (error) {
        if (mountedRef.current) setMap({});
        return;
      }
      const rows = (data ?? []) as unknown as ProofItemRow[];
      if (mountedRef.current) setMap(groupByArgument(rows));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // idsKey stands in for argumentIds; debateId + enabled complete the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debateId, idsKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    proofItemsByMessageId: enabled ? map : {},
    loading,
    refetch,
  };
}
