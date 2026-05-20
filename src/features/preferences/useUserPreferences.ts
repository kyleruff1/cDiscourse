/**
 * PR-001 — useUserPreferences hook.
 *
 * Loads the device-local preference blob once per `userId`, reads the
 * OS reduce-motion value, and exposes an optimistic `updatePreference`.
 *
 * The reduce-motion override (`preferences.reduceMotion`) is composed
 * on top of the live OS `AccessibilityInfo` read via
 * `resolveEffectiveReduceMotion`. `system` obeys the OS; `on`/`off`
 * win over it.
 */

import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { loadUserPreferences, saveUserPreferences } from './preferencesStorage';
import {
  applyPreferencePatch,
  DEFAULT_USER_PREFERENCES,
  resolveEffectiveReduceMotion,
  type UserPreferences,
} from './userPreferencesModel';

export interface UseUserPreferencesResult {
  /** `DEFAULT_USER_PREFERENCES` until the AsyncStorage load resolves. */
  preferences: UserPreferences;
  loading: boolean;
  /** Live OS reduce-motion value. */
  osReduceMotion: boolean;
  /** `resolveEffectiveReduceMotion(preferences.reduceMotion, osReduceMotion)`. */
  effectiveReduceMotion: boolean;
  /** Optimistic single-field update — applies to state and fires a save. */
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
}

export function useUserPreferences(userId: string | null): UseUserPreferencesResult {
  const [preferences, setPreferences] = useState<UserPreferences>(
    DEFAULT_USER_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);
  const [osReduceMotion, setOsReduceMotion] = useState(false);

  // Load the blob once per userId.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadUserPreferences(userId)
      .then((loaded) => {
        if (!cancelled) {
          setPreferences(loaded);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreferences({ ...DEFAULT_USER_PREFERENCES });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Read the OS reduce-motion value once and subscribe for mid-session
  // changes. Mirrors the defensive try/catch pattern used in
  // ArgumentTimelineMap (web shim / jest may reject or be unavailable).
  useEffect(() => {
    let cancelled = false;
    try {
      const result = AccessibilityInfo.isReduceMotionEnabled();
      if (result && typeof result.then === 'function') {
        result
          .then((enabled) => {
            if (!cancelled) setOsReduceMotion(enabled === true);
          })
          .catch(() => {
            // Keep the default — some platforms reject.
          });
      }
    } catch {
      // API unavailable — keep `osReduceMotion = false`.
    }
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (enabled) => {
          if (!cancelled) setOsReduceMotion(enabled === true);
        },
      );
    } catch {
      // Listener API unavailable — the one-shot read above still works.
    }
    return () => {
      cancelled = true;
      try {
        subscription?.remove();
      } catch {
        // Swallow — listener may already be torn down.
      }
    };
  }, []);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => {
        const next = applyPreferencePatch(prev, key, value);
        void saveUserPreferences(userId, next);
        return next;
      });
    },
    [userId],
  );

  return {
    preferences,
    loading,
    osReduceMotion,
    effectiveReduceMotion: resolveEffectiveReduceMotion(
      preferences.reduceMotion,
      osReduceMotion,
    ),
    updatePreference,
  };
}
