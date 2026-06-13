/**
 * ARG-ROOM-005 — useActiveParticipantCount.
 *
 * Tiny READ-ONLY hook: a single caller-scoped COUNT read of the EXISTING
 * `debate_participants` table, filtered `side <> 'observer'` (the SQL definition
 * of "active" — migration `count_active_participants` :124-127). `head: true`
 * transfers no rows, only the count. This is a client read of an existing
 * RLS-readable table (any authed user may read participant rows for an
 * open/locked room, migration `20260516000006` :147-155) — NOT a new server
 * object, NO insert/update, NO service-role, NO Edge Function.
 *
 * The count feeds `deriveSeatAvailability` so the room shell can preview
 * "N open seats" / "Room full — observe". The deployed ARG-ROOM-002 trigger
 * stays authoritative for enforcement; this is preview only.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';

export interface UseActiveParticipantCountResult {
  /** Active participants (`side <> 'observer'`), clamped >= 0. */
  activeParticipantCount: number;
  loading: boolean;
  /** Re-read the count (e.g. after a refused full-room claim). */
  refresh: () => void;
}

export function useActiveParticipantCount(
  debateId: string | null | undefined,
): UseActiveParticipantCountResult {
  const [activeParticipantCount, setActiveParticipantCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!SUPABASE_CONFIGURED || !debateId) {
      setActiveParticipantCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { count, error } = await supabase
        .from('debate_participants')
        .select('user_id', { count: 'exact', head: true })
        .eq('debate_id', debateId)
        .neq('side', 'observer');
      if (cancelled) return;
      setLoading(false);
      if (!error && typeof count === 'number') {
        setActiveParticipantCount(Math.max(0, count));
      }
    })().catch(() => {
      // Read-only preview: a failed count degrades to the last value (no crash,
      // no error banner — the 002 trigger remains authoritative on claim).
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debateId, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return { activeParticipantCount, loading, refresh };
}
