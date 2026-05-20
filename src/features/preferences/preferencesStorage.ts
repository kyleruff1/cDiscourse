/**
 * PR-001 — User preferences AsyncStorage glue.
 *
 * One JSON blob per user, keyed `cdiscourse:preferences:<userId>`.
 * Mirrors `sessionStorage.ts`: both calls are best-effort and never
 * throw — `load` falls back to `DEFAULT_USER_PREFERENCES` on any error
 * (missing key, corrupt JSON, storage error); `save` swallows failures.
 *
 * No migration, no Supabase, no Edge Function — preferences are
 * device-scoped UI state. The display name is the one exception and is
 * NOT handled here (it writes to `profiles` via `updateOwnDisplayName`).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { userPreferencesKey } from '../session/sessionKeys';
import {
  DEFAULT_USER_PREFERENCES,
  mergeWithDefaults,
  type UserPreferences,
} from './userPreferencesModel';

/** `userId === null` → keyed under `anon`, identical to sessionStorage. */
function keyFor(userId: string | null): string {
  return userPreferencesKey(userId ?? 'anon');
}

/**
 * Always resolves. Returns `DEFAULT_USER_PREFERENCES` on a missing key,
 * corrupt JSON, or any storage error. A partial / garbage blob is
 * defensively rebuilt by `mergeWithDefaults`.
 */
export async function loadUserPreferences(
  userId: string | null,
): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return { ...DEFAULT_USER_PREFERENCES };
    const parsed: unknown = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

/** Best-effort write. Swallows storage failure — non-fatal. */
export async function saveUserPreferences(
  userId: string | null,
  prefs: UserPreferences,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(prefs));
  } catch {
    // Storage failure is non-fatal — the in-memory state still reflects
    // the change for this session.
  }
}
