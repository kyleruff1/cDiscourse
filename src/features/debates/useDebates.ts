import { useState, useCallback, useEffect } from 'react';
import { useAppSession } from '../session/useAppSession';
import { listDebates, createDebate, joinDebate } from './debatesApi';
import type { JoinOutcomeKind } from './seatClaimModel';
import type { Debate, CreateDebateInput, ParticipantSide } from './types';

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
  create: (input: CreateDebateInput) => Promise<Debate | null>;
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
    async (input: CreateDebateInput): Promise<Debate | null> => {
      if (!userId) return null;
      const result = await createDebate(input, userId);
      if (result.ok) {
        setDebates((prev) => [result.data, ...prev]);
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
