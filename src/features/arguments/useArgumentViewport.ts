import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { useAppSession } from '../session/useAppSession';
import {
  viewportReducer,
  buildInitialViewport,
  toSessionViewport,
} from './argumentViewport';
import { EMPTY_CACHE, ROOT_KEY, isParentLoaded } from './argumentCache';
import {
  listRootArguments,
  listChildArguments,
  fetchArgumentRelations,
} from './argumentsApi';
import type { ArgumentCache, ArgumentViewportState } from './types';

export interface UseArgumentViewportResult {
  cache: ArgumentCache;
  viewport: ArgumentViewportState;
  loading: boolean;
  error: string | null;
  expand: (argumentId: string) => void;
  collapse: (argumentId: string) => void;
  focus: (argumentId: string) => void;
  unfocus: () => void;
  refresh: () => void;
}

const DEFAULT_PAGE_SIZE = 25;

export function useArgumentViewport(debateId: string): UseArgumentViewportResult {
  const { state: sessionState, dispatch: sessionDispatch } = useAppSession();

  const [{ cache, viewport }, dispatch] = useReducer(viewportReducer, undefined, () => ({
    cache: EMPTY_CACHE,
    viewport: buildInitialViewport(debateId, sessionState.snapshot.viewport, DEFAULT_PAGE_SIZE),
  }));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced session sync: only fires on viewport state changes.
  const { expandedArgumentIds, collapsedArgumentIds, focusedArgumentId } = viewport;
  useEffect(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      sessionDispatch({
        type: 'VIEWPORT_UPDATED',
        viewport: toSessionViewport(viewport, cache.loadedAtByParentId[ROOT_KEY] ?? null),
      });
    }, 400);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [
    expandedArgumentIds,
    collapsedArgumentIds,
    focusedArgumentId,
    sessionDispatch,
    viewport,
    cache.loadedAtByParentId,
  ]);

  const loadRoots = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    setError(null);

    const result = await listRootArguments(debateId, DEFAULT_PAGE_SIZE);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      inflightRef.current = false;
      return;
    }
    const ids = result.data.map((a) => a.id);
    const relResult = await fetchArgumentRelations(ids);
    dispatch({
      type: 'ROOTS_LOADED',
      args: result.data,
      relations: relResult.ok ? relResult.data : { tags: [], flags: [], checks: [], pointTags: [] },
    });
    setLoading(false);
    inflightRef.current = false;
  }, [debateId]); // dispatch is stable; not listed to avoid redundant dep

  useEffect(() => {
    void loadRoots();
  }, [loadRoots]);

  const expand = useCallback(
    (argumentId: string) => {
      dispatch({ type: 'EXPAND', argumentId });
      if (isParentLoaded(cache, argumentId)) return;

      void (async () => {
        const result = await listChildArguments(debateId, argumentId, DEFAULT_PAGE_SIZE);
        if (!result.ok) return;
        const ids = result.data.map((a) => a.id);
        const relResult = await fetchArgumentRelations(ids);
        dispatch({
          type: 'CHILDREN_LOADED',
          parentId: argumentId,
          args: result.data,
          relations: relResult.ok ? relResult.data : { tags: [], flags: [], checks: [], pointTags: [] },
        });
      })();
    },
    [cache, debateId],
  );

  const collapse = useCallback((argumentId: string) => {
    dispatch({ type: 'COLLAPSE', argumentId });
  }, []);

  const focus = useCallback(
    (argumentId: string) => {
      dispatch({ type: 'FOCUS', argumentId });
      if (isParentLoaded(cache, argumentId)) return;

      void (async () => {
        const childResult = await listChildArguments(debateId, argumentId, DEFAULT_PAGE_SIZE);
        const childArgs = childResult.ok ? childResult.data : [];
        const ids = childArgs.map((a) => a.id);
        const relResult = ids.length > 0 ? await fetchArgumentRelations(ids) : null;
        dispatch({
          type: 'FOCUS_LOADED',
          focusedId: argumentId,
          pathArgs: [],
          childArgs,
          relations: relResult?.ok ? relResult.data : { tags: [], flags: [], checks: [], pointTags: [] },
        });
      })();
    },
    [cache, debateId],
  );

  const unfocus = useCallback(() => {
    dispatch({ type: 'UNFOCUS' });
  }, []);

  const refresh = useCallback(() => {
    void loadRoots();
  }, [loadRoots]);

  return { cache, viewport, loading, error, expand, collapse, focus, unfocus, refresh };
}
