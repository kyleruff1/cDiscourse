/**
 * PR-002 — useProfileTags hook.
 *
 * Loads the device-local profile-tag blob once per `userId` and exposes
 * an optimistic `toggleTag` / `clearTags`. Mirrors PR-001's
 * `useUserPreferences` structure, minus the OS `AccessibilityInfo`
 * plumbing — profile tags have no OS coupling.
 *
 * A profile tag is inert social context: this hook reads and writes
 * `AsyncStorage` only. It never imports a scoring / engine / validation
 * module — see `profileTagValidationImmutability.test.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadProfileTags, saveProfileTags } from './profileTagsStorage';
import {
  DEFAULT_PROFILE_TAG_SELECTION,
  MAX_PROFILE_TAGS,
  toggleTag as toggleTagPure,
  type ProfileTagSelection,
} from './profileTagModel';
import { PROFILE_TAG_VOCABULARY } from './profileTagVocabulary';

export interface UseProfileTagsResult {
  /** `DEFAULT_PROFILE_TAG_SELECTION` until the AsyncStorage load resolves. */
  selection: ProfileTagSelection;
  loading: boolean;
  /** `selection.selectedTagIds.length`. */
  count: number;
  /** `count >= MAX_PROFILE_TAGS`. */
  atLimit: boolean;
  /** Optimistic toggle — applies to state and fires a save. Cap-respecting. */
  toggleTag: (tagId: string) => void;
  /** Resets to the empty default and fires a save. */
  clearTags: () => void;
}

const EMPTY_SELECTION: ProfileTagSelection = {
  schemaVersion: 1,
  selectedTagIds: [],
};

export function useProfileTags(userId: string | null): UseProfileTagsResult {
  const [selection, setSelection] = useState<ProfileTagSelection>(
    DEFAULT_PROFILE_TAG_SELECTION,
  );
  const [loading, setLoading] = useState(true);

  // Load the blob once per userId.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadProfileTags(userId)
      .then((loaded) => {
        if (!cancelled) {
          setSelection(loaded);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelection({ ...EMPTY_SELECTION });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleTag = useCallback(
    (tagId: string) => {
      setSelection((prev) => {
        const next = toggleTagPure(prev, tagId, PROFILE_TAG_VOCABULARY);
        // A no-op toggle (e.g. adding past the cap) returns the same
        // object — skip the redundant save.
        if (next !== prev) {
          void saveProfileTags(userId, next);
        }
        return next;
      });
    },
    [userId],
  );

  const clearTags = useCallback(() => {
    const next: ProfileTagSelection = { ...EMPTY_SELECTION };
    setSelection(next);
    void saveProfileTags(userId, next);
  }, [userId]);

  const count = selection.selectedTagIds.length;

  return useMemo(
    () => ({
      selection,
      loading,
      count,
      atLimit: count >= MAX_PROFILE_TAGS,
      toggleTag,
      clearTags,
    }),
    [selection, loading, count, toggleTag, clearTags],
  );
}
