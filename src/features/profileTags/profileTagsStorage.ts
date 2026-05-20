/**
 * PR-002 — Profile tag AsyncStorage glue.
 *
 * One JSON blob per user, keyed `cdiscourse:profile-tags:<userId>`.
 * Mirrors PR-001's `preferencesStorage.ts`: both calls are best-effort
 * and never throw — `load` falls back to `DEFAULT_PROFILE_TAG_SELECTION`
 * on any error (missing key, corrupt JSON, storage error) and runs the
 * loaded blob through `mergeTagSelectionWithDefaults` so an over-cap or
 * garbage blob is defensively repaired; `save` swallows failures.
 *
 * No migration, no Supabase, no Edge Function — profile tags are
 * device-scoped self-description state. Cross-device / other-user
 * visibility is an explicit v2 follow-up (see the PR-002 design).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileTagsKey } from '../session/sessionKeys';
import {
  DEFAULT_PROFILE_TAG_SELECTION,
  mergeTagSelectionWithDefaults,
  type ProfileTagSelection,
} from './profileTagModel';
import { PROFILE_TAG_VOCABULARY } from './profileTagVocabulary';

/** `userId === null` → keyed under `anon`, identical to preferencesStorage. */
function keyFor(userId: string | null): string {
  return profileTagsKey(userId ?? 'anon');
}

/**
 * Always resolves. Returns `DEFAULT_PROFILE_TAG_SELECTION` on a missing
 * key, corrupt JSON, or any storage error. A partial / garbage / over-cap
 * blob is defensively rebuilt by `mergeTagSelectionWithDefaults` (unknown
 * ids dropped, duplicates removed, list truncated to `MAX_PROFILE_TAGS`).
 */
export async function loadProfileTags(
  userId: string | null,
): Promise<ProfileTagSelection> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return { ...DEFAULT_PROFILE_TAG_SELECTION, selectedTagIds: [] };
    const parsed: unknown = JSON.parse(raw);
    return mergeTagSelectionWithDefaults(parsed, PROFILE_TAG_VOCABULARY);
  } catch {
    return { ...DEFAULT_PROFILE_TAG_SELECTION, selectedTagIds: [] };
  }
}

/** Best-effort write. Swallows storage failure — non-fatal. */
export async function saveProfileTags(
  userId: string | null,
  selection: ProfileTagSelection,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(selection));
  } catch {
    // Storage failure is non-fatal — the in-memory selection still
    // reflects the change for this session.
  }
}
