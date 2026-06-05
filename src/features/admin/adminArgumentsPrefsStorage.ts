/**
 * ADMIN-ARGUMENTS-003 — Admin Arguments view-preferences AsyncStorage glue.
 *
 * One JSON blob per device scope, keyed `cdiscourse:admin-arguments-prefs:<scope>`.
 * Mirrors PR-001 `preferencesStorage.ts`: both calls are best-effort and never
 * throw — `load` falls back to `DEFAULT_ADMIN_ARGUMENTS_PREFS` on any error
 * (missing key, corrupt JSON, storage error); `save` swallows failures.
 *
 * No migration, no Supabase, no Edge Function — these are device-scoped table
 * VIEW prefs (pure-client). No server write.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminArgumentsPrefsKey } from '../session/sessionKeys';
import {
  DEFAULT_ADMIN_ARGUMENTS_PREFS,
  mergeWithDefaults,
  type AdminArgumentsPrefs,
} from './adminArgumentsPrefsModel';

/** Default scope is `admin` — device-local table-view prefs, not per-user. */
const DEFAULT_SCOPE = 'admin';

/**
 * Always resolves. Returns `DEFAULT_ADMIN_ARGUMENTS_PREFS` on a missing key,
 * corrupt JSON, or any storage error. A partial / garbage blob is defensively
 * rebuilt by `mergeWithDefaults`.
 */
export async function loadAdminArgumentsPrefs(
  scope: string = DEFAULT_SCOPE,
): Promise<AdminArgumentsPrefs> {
  try {
    const raw = await AsyncStorage.getItem(adminArgumentsPrefsKey(scope));
    if (!raw) return { ...DEFAULT_ADMIN_ARGUMENTS_PREFS };
    const parsed: unknown = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return { ...DEFAULT_ADMIN_ARGUMENTS_PREFS };
  }
}

/** Best-effort write. Swallows storage failure — non-fatal. */
export async function saveAdminArgumentsPrefs(
  prefs: AdminArgumentsPrefs,
  scope: string = DEFAULT_SCOPE,
): Promise<void> {
  try {
    await AsyncStorage.setItem(adminArgumentsPrefsKey(scope), JSON.stringify(prefs));
  } catch {
    // Storage failure is non-fatal — the in-memory state still reflects
    // the change for this session.
  }
}
