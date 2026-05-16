import { useState, useCallback, useEffect } from 'react';
import { useAppSession } from '../session/useAppSession';
import { listDebates, createDebate, joinDebate } from './debatesApi';
import type { Debate, CreateDebateInput, ParticipantSide } from './types';

export interface UseDebatesResult {
  debates: Debate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreateDebateInput) => Promise<Debate | null>;
  join: (debateId: string, side: ParticipantSide) => Promise<ParticipantSide | null>;
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
    async (debateId: string, side: ParticipantSide): Promise<ParticipantSide | null> => {
      if (!userId) return null;
      const result = await joinDebate(debateId, side, userId);
      if (result.ok) {
        setDebates((prev) =>
          prev.map((d) =>
            d.id === debateId ? { ...d, myParticipantSide: result.data.side } : d,
          ),
        );
        return result.data.side;
      }
      setError(result.error);
      return null;
    },
    [userId],
  );

  return { debates, loading, error, refresh, create, join };
}
