/**
 * START-002 (#839) — useMyCircles hook.
 *
 * Wraps the RLS-scoped `listMyCircles` read so the StartArgumentSheet mount
 * (circle audience) and the HOME-003 circle-home filter receive a ready
 * `MyCircleSummary[]`. Mirrors `useRecentOpponents` / `useGalleryArguments`.
 *
 * Circles are an accelerator, never a gate: the read resolves to `[]` on any
 * failure (offline, unconfigured, signed out, RLS empty), so the hook never
 * surfaces a blocking error — `error` stays `null` by construction and the
 * consuming surfaces simply render no circle chips / no picker circle rows. No
 * service-role, no write, no AI call. `userId` keys the reload effect (the read
 * itself resolves the caller from the JWT).
 */
import { useCallback, useEffect, useState } from 'react';
import { listMyCircles, type MyCircleSummary } from './circlesApi';

interface State {
  circles: MyCircleSummary[];
  loading: boolean;
  error: string | null;
}

export function useMyCircles(
  userId: string | null | undefined,
): State & { refresh: () => void } {
  const [state, setState] = useState<State>({ circles: [], loading: false, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (typeof userId !== 'string' || userId.length === 0) {
      setState({ circles: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const result = await listMyCircles();
      if (cancelled) return;
      // Never a blocking error: a failed read simply yields no circles.
      setState({
        circles: result.ok && result.data ? result.data : [],
        loading: false,
        error: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return { ...state, refresh };
}
