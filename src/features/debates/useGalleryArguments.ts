/**
 * Stage 6.3 — Batched gallery loader hook.
 *
 * For a given set of debate ids, fetches posted arguments in ONE
 * `.in('debate_id', ids)` query (no N+1) and groups them by debateId.
 * Used by the Conversation Gallery to compute first-post/latest-move
 * excerpts and per-card stats without loading whole rooms.
 *
 * - No service-role.
 * - RLS still gates row visibility.
 * - No xAI, no Anthropic, no Supabase write.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { listArgumentsForDebateIds } from '../arguments/argumentsApi';
import type { ArgumentRow } from '../arguments/types';
import type { GalleryArgumentInput } from './conversationGalleryModel';

interface State {
  argumentsByDebateId: Record<string, GalleryArgumentInput[]>;
  loading: boolean;
  error: string | null;
  loadedAt: string | null;
}

export function useGalleryArguments(debateIds: string[]): State & { refresh: () => void } {
  const [state, setState] = useState<State>({
    argumentsByDebateId: {},
    loading: false,
    error: null,
    loadedAt: null,
  });
  const [reloadToken, setReloadToken] = useState(0);
  const inflightRef = useRef(false);

  // Sort the ids for a stable cache-key signature so we don't refetch on
  // every render when only ordering changes.
  const idsKey = useMemo(() => debateIds.slice().sort().join(','), [debateIds]);

  useEffect(() => {
    let cancelled = false;
    if (!idsKey) {
      setState({ argumentsByDebateId: {}, loading: false, error: null, loadedAt: null });
      return;
    }
    if (inflightRef.current) return;
    inflightRef.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      const ids = idsKey.split(',').filter(Boolean);
      const result = await listArgumentsForDebateIds(ids);
      if (cancelled) return;
      if (!result.ok) {
        setState({ argumentsByDebateId: {}, loading: false, error: result.error, loadedAt: null });
        inflightRef.current = false;
        return;
      }
      const map: Record<string, GalleryArgumentInput[]> = {};
      for (const row of result.data as ArgumentRow[]) {
        const projection: GalleryArgumentInput = {
          id: row.id,
          debateId: row.debateId,
          parentId: row.parentId,
          authorId: row.authorId,
          argumentType: row.argumentType,
          side: row.side,
          body: row.body,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
        (map[row.debateId] = map[row.debateId] || []).push(projection);
      }
      setState({ argumentsByDebateId: map, loading: false, error: null, loadedAt: new Date().toISOString() });
      inflightRef.current = false;
    })();
    return () => { cancelled = true; };
  }, [idsKey, reloadToken]);

  return { ...state, refresh: () => setReloadToken((n) => n + 1) };
}
