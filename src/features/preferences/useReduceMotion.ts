/**
 * A11Y-693 — shared reduce-motion hook.
 *
 * Effective reduce-motion for a component:
 *   - `reduceMotionOverride` boolean wins (a test seam + a parent-threaded value).
 *   - else the live OS AccessibilityInfo value, subscribed to reduceMotionChanged.
 *   - default-safe: false until the async read resolves; false when the API
 *     rejects or is unavailable (web shim / jest). Motion is treated as allowed
 *     only when we KNOW the OS does not ask to reduce it, and every surface that
 *     consumes this hook is static-by-construction, so static stays the safe
 *     visual either way.
 *
 * This lifts the inline AccessibilityInfo.isReduceMotionEnabled() +
 * addEventListener reduceMotionChanged pattern (verbatim from
 * useUserPreferences.ts, which stays) into ONE reusable hook with the override
 * precedence. The default value stays `false` to match every existing inline
 * copy byte-for-byte: flipping it to true would make shipped surfaces flash
 * static-then-animate on mount.
 *
 * Pure hook. No Supabase, no fetch, no network. Comments are apostrophe-free for
 * the naive quote-parity doctrine scanner.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Effective reduce-motion for a component. When `reduceMotionOverride` is a
 * boolean it wins in both directions; otherwise the live OS value is used.
 */
export function useReduceMotion(reduceMotionOverride?: boolean): boolean {
  const [osReduceMotion, setOsReduceMotion] = useState(false);

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
            // Some platforms reject — keep the default.
          });
      }
    } catch {
      // API unavailable — keep osReduceMotion false.
    }
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        if (!cancelled) setOsReduceMotion(enabled === true);
      });
    } catch {
      // Listener API unavailable — the one-shot read above still applies.
    }
    return () => {
      cancelled = true;
      try {
        subscription?.remove();
      } catch {
        // Swallow — the listener may already be torn down.
      }
    };
  }, []);

  return typeof reduceMotionOverride === 'boolean' ? reduceMotionOverride : osReduceMotion;
}
