import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppSession } from '../session/useAppSession';
import { saveDraft, deleteDraft } from '../session/sessionStorage';
import { createEmptyDraft, updateDraftField, shouldRestoreDraft } from './composerHelpers';
import { draftToSession, sessionToDraft } from './composerState';
import type { ComposerDraft } from './composerState';

export interface UseArgumentComposerResult {
  /** Current draft, or null while initializing. */
  draft: ComposerDraft | null;
  /**
   * True when an existing dirty draft was found on mount and restored,
   * rather than a fresh draft being created. Used to show a recovery notice.
   */
  isRecovered: boolean;
  /** Update one or more mutable draft fields. Marks the draft dirty and debounce-saves. */
  updateField: (patch: Partial<Omit<ComposerDraft, 'draftId' | 'debateId' | 'dirty' | 'updatedAt'>>) => void;
  /** Discard the current draft. Clears session state and removes from AsyncStorage. */
  discardDraft: () => void;
}

const SAVE_DEBOUNCE_MS = 400;

export function useArgumentComposer(
  debateId: string,
  selectedParentId: string | null,
): UseArgumentComposerResult {
  const { state, dispatch } = useAppSession();
  const userId = state.snapshot.userId;

  // Detect on mount whether a recoverable dirty draft already exists.
  const [isRecovered] = useState<boolean>(() => {
    const existing = state.snapshot.activeDraft;
    return !!(existing?.debateId === debateId && existing.dirty);
  });

  // Guard so the init effect runs exactly once regardless of dep changes.
  const initRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref to the latest draft so callbacks always read current data
  // without needing draft in their own deps (avoids re-creating on every render).
  const draftRef = useRef<ComposerDraft | null>(null);

  // ── Initialization ──────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (shouldRestoreDraft(state.snapshot.activeDraft, debateId)) {
      // Existing draft for this debate — already in session, nothing to dispatch.
      return;
    }

    // No matching draft — create a fresh one.
    const draft = createEmptyDraft({ debateId, parentId: selectedParentId });
    dispatch({ type: 'DRAFT_STARTED', draft: draftToSession(draft) });
  }, [debateId, dispatch, selectedParentId, state.snapshot.activeDraft]);

  // ── Derive current draft ────────────────────────────────────
  const draft: ComposerDraft | null =
    state.snapshot.activeDraft?.debateId === debateId
      ? sessionToDraft(state.snapshot.activeDraft)
      : null;

  draftRef.current = draft;

  // ── updateField ─────────────────────────────────────────────
  const updateField = useCallback(
    (patch: Partial<Omit<ComposerDraft, 'draftId' | 'debateId' | 'dirty' | 'updatedAt'>>) => {
      if (!draftRef.current) return;
      const updated = updateDraftField(draftRef.current, patch);
      dispatch({ type: 'DRAFT_UPDATED', patch: draftToSession(updated) });

      if (userId) {
        const capturedUserId = userId;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          if (draftRef.current) {
            void saveDraft(capturedUserId, draftToSession(draftRef.current));
          }
        }, SAVE_DEBOUNCE_MS);
      }
    },
    [dispatch, userId],
  );

  // ── discardDraft ─────────────────────────────────────────────
  const discardDraft = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (draftRef.current && userId) {
      void deleteDraft(userId, draftRef.current.draftId, draftRef.current.debateId);
    }
    dispatch({ type: 'DRAFT_CLEARED' });
  }, [dispatch, userId]);

  // ── Cleanup ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return { draft, isRecovered, updateField, discardDraft };
}
