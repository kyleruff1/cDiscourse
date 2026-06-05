/**
 * ADMIN-ARGUMENTS-003 — useAdminArgumentsPrefs hook.
 *
 * Loads the device-local Admin Arguments view-preference blob once per scope,
 * exposes the current prefs plus an optimistic `updatePref`, and persists every
 * change to AsyncStorage (pure-client; no server write). Mirrors PR-001
 * `useUserPreferences` 1:1: `DEFAULT_ADMIN_ARGUMENTS_PREFS` until the load
 * resolves, then the restored blob; each setter applies the immutable patch to
 * state AND fires a best-effort save.
 *
 * This is the ONLY new ADMIN-ARGUMENTS-003 file that imports React. The model
 * (`adminArgumentsPrefsModel.ts`) and the runTag classifier
 * (`adminArgumentsRunTagModel.ts`) stay pure TS.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  loadAdminArgumentsPrefs,
  saveAdminArgumentsPrefs,
} from './adminArgumentsPrefsStorage';
import {
  applyPrefsPatch,
  DEFAULT_ADMIN_ARGUMENTS_PREFS,
  type AdminArgumentsPrefs,
} from './adminArgumentsPrefsModel';

export interface UseAdminArgumentsPrefsResult {
  /** `DEFAULT_ADMIN_ARGUMENTS_PREFS` until the AsyncStorage load resolves. */
  prefs: AdminArgumentsPrefs;
  /** True until the first load resolves. */
  loading: boolean;
  /** Optimistic single-field update — applies to state and fires a save. */
  updatePref: <K extends keyof AdminArgumentsPrefs>(
    key: K,
    value: AdminArgumentsPrefs[K],
  ) => void;
}

export function useAdminArgumentsPrefs(scope = 'admin'): UseAdminArgumentsPrefsResult {
  const [prefs, setPrefs] = useState<AdminArgumentsPrefs>(
    DEFAULT_ADMIN_ARGUMENTS_PREFS,
  );
  const [loading, setLoading] = useState(true);

  // Load the blob once per scope.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAdminArgumentsPrefs(scope)
      .then((loaded) => {
        if (!cancelled) {
          setPrefs(loaded);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrefs({ ...DEFAULT_ADMIN_ARGUMENTS_PREFS });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const updatePref = useCallback(
    <K extends keyof AdminArgumentsPrefs>(key: K, value: AdminArgumentsPrefs[K]) => {
      setPrefs((prev) => {
        const next = applyPrefsPatch(prev, key, value);
        void saveAdminArgumentsPrefs(next, scope);
        return next;
      });
    },
    [scope],
  );

  return { prefs, loading, updatePref };
}
