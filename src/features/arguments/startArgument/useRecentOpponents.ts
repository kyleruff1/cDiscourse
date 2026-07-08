/**
 * START-001 (#827) — useRecentOpponents hook.
 *
 * Wraps the RLS-scoped `listRecentOpponentInvites` read + the pure
 * `deriveRecentOpponents` projection so the StartArgumentSheet mount receives
 * a ready `RecentOpponent[]`. Mirrors the `useGalleryArguments` shape.
 *
 * Recents are an accelerator, never a gate: the read resolves to `[]` on any
 * failure (offline, unconfigured, empty RLS result), so the hook never surfaces
 * a blocking error — `error` stays `null` by construction. No service-role, no
 * write, no AI call.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listRecentOpponentInvites } from './recentOpponentsApi';
import {
  deriveRecentOpponents,
  type RecentOpponent,
} from './personArgumentPickerModel';

interface State {
  recents: RecentOpponent[];
  loading: boolean;
  error: string | null;
}

export function useRecentOpponents(
  userId: string | null | undefined,
): State & { refresh: () => void } {
  const [state, setState] = useState<State>({ recents: [], loading: false, error: null });
  const [reloadToken, setReloadToken] = useState(0);
  const inflightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof userId !== 'string' || userId.length === 0) {
      setState({ recents: [], loading: false, error: null });
      return;
    }
    inflightRef.current = true;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const rows = await listRecentOpponentInvites(userId);
      if (cancelled) return;
      setState({ recents: deriveRecentOpponents(rows), loading: false, error: null });
      inflightRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return { ...state, refresh };
}
