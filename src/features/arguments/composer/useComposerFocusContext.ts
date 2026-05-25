/**
 * UX-001.3 — useComposerFocusContext hook.
 *
 * Reports whether focus is meaningfully inside the composer. The dock's
 * `document`-level keyboard handler consults this boolean to gate
 * Cmd/Ctrl+Enter and Cmd/Ctrl+K — when focus is on the Timeline (or
 * any other board surface), composer shortcuts return `'none'` from
 * `resolveComposerKeyEffect` and the board's existing arrow-key
 * navigation runs uncontested.
 *
 * Platform behavior:
 *  - Web: subscribes to `document.focusin` / `focusout` and tracks
 *    whether `document.activeElement` is inside the registered
 *    container. Updates synchronously.
 *  - Native: returns `composerFocused: active` (the dock's visible
 *    state) — there is no equivalent focus-vs-board distinction for
 *    Cmd+Enter on a hardware keyboard, and the use case for
 *    keyboard shortcuts on native is practically nil. The hook still
 *    exposes a stable `registerContainer` callback so callers don't
 *    need a `Platform.OS` branch.
 *
 * Doctrine:
 *  - No new dependency.
 *  - No `console.log`.
 *  - SSR-safe: returns `false` when `document` is unavailable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export interface UseComposerFocusContextResult {
  /**
   * True when focus is inside the registered container. The dock reads
   * this in its keyboard handler. On native, equals `active` (the
   * dock's visible state).
   */
  composerFocused: boolean;
  /**
   * Pass a ref-callback target to the View / Pressable that wraps the
   * composer's interactive body. The hook will subscribe to focus
   * events bubbling through that subtree.
   *
   * On native, this is a no-op the caller can safely supply anyway.
   */
  registerContainer: (el: HTMLElement | null) => void;
}

/**
 * Returns whether the composer is currently focused. `active` is the
 * dock's visible state — when the dock is closed we never report
 * `true` (focus inside an unmounted dock is impossible).
 */
export function useComposerFocusContext(
  active: boolean,
): UseComposerFocusContextResult {
  const [composerFocused, setComposerFocused] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  // Web path: listen to focusin / focusout on `document`. The state
  // update is debounced via a microtask to avoid a focus-then-blur
  // flicker producing two state changes inside a single tab cycle.
  useEffect(() => {
    if (!active) {
      setComposerFocused(false);
      return;
    }
    // Native: there's no `document`; the composer is "focused" when
    // the dock is mounted (the brief explicitly notes Cmd+Enter on a
    // hardware keyboard is web-only in practice).
    if (Platform.OS !== 'web') {
      setComposerFocused(true);
      return;
    }
    if (typeof document === 'undefined' || !document.addEventListener) {
      return;
    }

    const recompute = () => {
      const container = containerRef.current;
      const activeEl = document.activeElement;
      if (!container || !activeEl) {
        setComposerFocused(false);
        return;
      }
      // The container itself counts as "focused" only if a descendant
      // is focused — the container View is typically non-interactive.
      // Using `contains` covers any focused TextInput / Pressable
      // nested in the subtree.
      setComposerFocused(container.contains(activeEl));
    };

    const onFocusIn = () => recompute();
    const onFocusOut = () => {
      // Defer to next microtask so document.activeElement reflects
      // the post-blur target (otherwise it momentarily reads as
      // document.body during the blur event).
      Promise.resolve().then(recompute);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    // Initial read.
    recompute();

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [active]);

  const registerContainer = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);

  return { composerFocused, registerContainer };
}
