import { useState, useCallback, useEffect } from 'react';
import { useAppSession } from '../session/useAppSession';
import { listDebates, createDebate, joinDebate, settleDebate, reopenDebate } from './debatesApi';
import type { JoinOutcomeKind } from './seatClaimModel';
import type { Debate, CreateDebateInput, CreatedRoom, ParticipantSide } from './types';
import { ROOM_SETTLE_COPY } from '../arguments/gameCopy';

/**
 * ARG-ROOM-005 — the result of a claim attempt. `side` is the side the viewer
 * ends up on (null when no seat was taken); `outcome` carries the classified
 * seat outcome so the room shell can degrade `room_full` to the observe
 * affordance instead of dead-ending or showing a generic error.
 */
export interface JoinAttemptResult {
  side: ParticipantSide | null;
  outcome: JoinOutcomeKind;
}

export interface UseDebatesResult {
  debates: Debate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * ARG-ROOM-008 — resolves to a `CreatedRoom` (the new `Debate` plus the
   * one-time create-time `inviteLink`) so the create surface can render the
   * invite-link box once. `null` on failure / no session. The raw link is
   * passed through untouched — never logged or persisted by the hook.
   */
  create: (input: CreateDebateInput) => Promise<CreatedRoom | null>;
  join: (debateId: string, side: ParticipantSide) => Promise<JoinAttemptResult>;
  /**
   * SETTLE-001 (#911) — settle (lock) a room, then optimistically patch the
   * local list so the derived currentDebate re-renders as settled with no
   * refetch flicker. On failure a neutral error is surfaced and refresh()
   * reconciles the list. Creator-gated at the call sites (App wires it only
   * for the room owner); RLS is the authoritative gate underneath.
   */
  settle: (debateId: string) => Promise<{ ok: boolean; error?: string }>;
  /** SETTLE-001 (#911) — re-open (unlock) a settled room; same optimistic patch. */
  reopen: (debateId: string) => Promise<{ ok: boolean; error?: string }>;
}

export function useDebates(): UseDebatesResult {
  const { state } = useAppSession();
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = state.snapshot.userId;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const result = await listDebates(userId);
    setLoading(false);
    if (result.ok) {
      setDebates(result.data);
    } else {
      setError(result.error);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateDebateInput): Promise<CreatedRoom | null> => {
      if (!userId) return null;
      const result = await createDebate(input, userId);
      if (result.ok) {
        // ARG-ROOM-008 — prepend the new room for the list; pass the whole
        // `CreatedRoom` (debate + one-time inviteLink) back to the caller.
        setDebates((prev) => [result.data.debate, ...prev]);
        return result.data;
      }
      setError(result.error);
      return null;
    },
    [userId],
  );

  const join = useCallback(
    async (debateId: string, side: ParticipantSide): Promise<JoinAttemptResult> => {
      if (!userId) return { side: null, outcome: 'unavailable' };
      const result = await joinDebate(debateId, side, userId);
      if (result.ok) {
        setDebates((prev) =>
          prev.map((d) =>
            d.id === debateId ? { ...d, myParticipantSide: result.data.side } : d,
          ),
        );
        return { side: result.data.side, outcome: result.outcome };
      }
      // ARG-ROOM-005 — a full room is NOT an error; it degrades to the observe
      // affordance (the room shell handles `room_full`). Only genuine failures
      // raise the generic error banner.
      if (result.outcome !== 'room_full') {
        setError(result.error);
      }
      return { side: null, outcome: result.outcome };
    },
    [userId],
  );

  const settle = useCallback(
    async (debateId: string): Promise<{ ok: boolean; error?: string }> => {
      const result = await settleDebate(debateId);
      if (result.ok) {
        // Optimistic local patch — mirrors join. The derived currentDebate
        // re-renders as settled immediately (App suppresses the composer and
        // shows the read-only notice) with no refetch flicker.
        setDebates((prev) =>
          prev.map((d): Debate => (d.id === debateId ? { ...d, status: 'locked' } : d)),
        );
        return { ok: true };
      }
      // Mirror join: surface a neutral banner on genuine failure. No optimistic
      // patch was applied (patch only on ok), so the list already matches the
      // server and needs no refetch reconcile — and a refetch would clear this
      // neutral banner. The raw error is returned to the caller, never shown raw.
      setError(ROOM_SETTLE_COPY.error_network);
      return { ok: false, error: result.error };
    },
    [],
  );

  const reopen = useCallback(
    async (debateId: string): Promise<{ ok: boolean; error?: string }> => {
      const result = await reopenDebate(debateId);
      if (result.ok) {
        setDebates((prev) =>
          prev.map((d): Debate => (d.id === debateId ? { ...d, status: 'open' } : d)),
        );
        return { ok: true };
      }
      // Same as settle: neutral banner, no refetch (mirror join). No optimistic
      // patch was applied on failure, so the list already matches the server and
      // a refetch would only clear this neutral banner.
      setError(ROOM_SETTLE_COPY.error_network);
      return { ok: false, error: result.error };
    },
    [],
  );

  return { debates, loading, error, refresh, create, join, settle, reopen };
}
