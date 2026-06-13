import { useState, useCallback, useEffect } from 'react';
import { useAppSession } from '../session/useAppSession';
import { listDebates, createDebate, joinDebate } from './debatesApi';
import type { JoinOutcomeKind } from './seatClaimModel';
import type { Debate, CreateDebateInput, CreatedRoom, ParticipantSide } from './types';

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

  return { debates, loading, error, refresh, create, join };
}
