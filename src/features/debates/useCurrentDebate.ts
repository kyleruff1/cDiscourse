import { useCallback } from 'react';
import { useAppSession } from '../session/useAppSession';
import type { Debate, ParticipantSide } from './types';

export interface UseCurrentDebateResult {
  currentDebate: Debate | null;
  selectedId: string | null;
  selectDebate: (debate: Debate, side: ParticipantSide) => void;
  deselectDebate: () => void;
}

export function useCurrentDebate(debates: Debate[]): UseCurrentDebateResult {
  const { state, dispatch } = useAppSession();
  const selectedId = state.snapshot.selectedDebateId;
  const userId = state.snapshot.userId;

  const currentDebate = debates.find((d) => d.id === selectedId) ?? null;

  const selectDebate = useCallback(
    (debate: Debate, side: ParticipantSide) => {
      dispatch({ type: 'DEBATE_SELECTED', debateId: debate.id, participantSide: side });
    },
    [dispatch],
  );

  const deselectDebate = useCallback(() => {
    if (userId) {
      dispatch({ type: 'SIGNED_IN', userId });
    }
  }, [dispatch, userId]);

  return { currentDebate, selectedId, selectDebate, deselectDebate };
}
