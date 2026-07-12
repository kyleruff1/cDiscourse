/**
 * A11Y-PR0 (#913) — useOverlayA11y: web-only overlay accessibility hook.
 *
 * Gives an RN-web overlay the keyboard/focus grammar it lacks today:
 *   1. captures the trigger element so focus can be restored on close,
 *   2. registers the overlay on the shared LIFO `overlayLayerStack`,
 *   3. pulls initial focus into the panel (unless focus is already inside),
 *   4. traps Tab / Shift+Tab within the panel while this layer is topmost,
 *   5. optionally dismisses on Escape while this layer is topmost,
 *   6. restores focus to the trigger on teardown.
 *
 * `isTopmost` is the single arbiter shared with the composer dock: the
 * dock reads it to suppress its own shortcuts whenever an overlay is
 * stacked above, so exactly one layer responds to Escape or Tab.
 *
 * Native (`Platform.OS !== 'web'`) or no-DOM environments are a stable
 * NO-OP passthrough: zero focus calls, zero listeners, `registerContainer`
 * is inert, `isTopmost()` returns false. This is a pinned invariant —
 * VoiceOver / TalkBack navigate via the rotor, not Tab, so native behavior
 * stays byte-unchanged. It mirrors `useComposerFocusContext`.
 *
 * Doctrine: no new dependency, no console, no network, SSR-safe.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { FOCUSABLE_SELECTOR, resolveFocusTrapEffect } from './overlayFocusTrapModel';
import {
  isTopmost as stackIsTopmost,
  registerLayer,
  unregisterLayer,
} from './overlayLayerStack';

/** Monotonic counter for auto-generated layer ids (stable per hook instance). */
let layerSeq = 0;

export interface UseOverlayA11yOptions {
  /** Overlay is mounted and shown. When false the hook tears down and no-ops. */
  visible: boolean;
  /** Called on Escape ONLY when this layer is topmost (skipped if manageEsc is false). */
  onDismiss?: () => void;
  /**
   * Own Escape dismissal. Default true. The composer dock passes false —
   * its composer keydown handler owns Escape semantics and reads
   * `isTopmost()` to gate them.
   */
  manageEsc?: boolean;
  /** Trap Tab, set initial focus, and restore focus on unmount. Default true. */
  manageFocus?: boolean;
  /** Stable id for the layer stack. Default: an auto-generated per-hook id. */
  layerId?: string;
}

export interface UseOverlayA11yResult {
  /** Attach to the overlay panel via a ref-callback; `el` is the DOM node on web. */
  registerContainer: (el: HTMLElement | null) => void;
  /** Live read: is this layer the topmost overlay? (Dock reads this in its keydown guard.) */
  isTopmost: () => boolean;
}

/** Duck-type an element that carries the DOM methods the hook needs. */
function isDomElement(el: unknown): el is HTMLElement {
  return (
    !!el &&
    typeof (el as HTMLElement).querySelectorAll === 'function' &&
    typeof (el as HTMLElement).contains === 'function' &&
    typeof (el as HTMLElement).focus === 'function'
  );
}

export function useOverlayA11y(options: UseOverlayA11yOptions): UseOverlayA11yResult {
  const {
    visible,
    onDismiss,
    manageEsc = true,
    manageFocus = true,
    layerId: providedLayerId,
  } = options;

  // A stable per-hook layer id. An explicit `layerId` wins; otherwise mint
  // one once and keep it for the life of the hook.
  const layerIdRef = useRef<string | null>(null);
  if (layerIdRef.current === null) {
    layerIdRef.current = providedLayerId ?? `overlay-layer-${(layerSeq += 1)}`;
  } else if (providedLayerId && providedLayerId !== layerIdRef.current) {
    layerIdRef.current = providedLayerId;
  }
  const layerId = layerIdRef.current;

  const containerRef = useRef<HTMLElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const isTopmost = useCallback((): boolean => {
    if (Platform.OS !== 'web') return false;
    return stackIsTopmost(layerId);
  }, [layerId]);

  const registerContainer = useCallback((el: HTMLElement | null) => {
    containerRef.current = isDomElement(el) ? el : null;
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Native and no-DOM: complete no-op. This is the byte-unchanged-native
    // invariant — no listener, no focus call, nothing registered.
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined' || !document.addEventListener) return;

    const listFocusables = (): HTMLElement[] => {
      const container = containerRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll(FOCUSABLE_SELECTOR),
      ) as HTMLElement[];
    };

    // 1. Capture the trigger so focus can be restored on close.
    const activeAtOpen = document.activeElement;
    previouslyFocusedRef.current = isDomElement(activeAtOpen)
      ? (activeAtOpen as HTMLElement)
      : null;

    // 2. Register on the shared stack (push -> becomes topmost).
    registerLayer(layerId);

    // 3. Initial focus. Only pull focus in when it is not already inside
    // the panel (respects any existing autoFocus and standard trap
    // behavior). Focus the first focusable; if there is none, focus the
    // container itself via tabindex=-1 so focus still leaves the
    // background.
    if (manageFocus) {
      const container = containerRef.current;
      const activeEl = document.activeElement;
      const alreadyInside =
        !!container && !!activeEl && container.contains(activeEl);
      if (!alreadyInside) {
        const focusables = listFocusables();
        if (focusables.length > 0) {
          try {
            focusables[0].focus();
          } catch {
            // jsdom / detached node — ignore.
          }
        } else if (container) {
          try {
            container.setAttribute('tabindex', '-1');
            container.focus();
          } catch {
            // ignore.
          }
        }
      }
    }

    // 4 + 5. Capture-phase keydown listener. Active only when this layer
    // is topmost (nested-overlay correctness — only the top layer traps
    // Tab and owns Escape).
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!stackIsTopmost(layerId)) return;

      if (manageEsc && event.key === 'Escape') {
        event.preventDefault();
        onDismissRef.current?.();
        return;
      }

      if (manageFocus && event.key === 'Tab') {
        const focusables = listFocusables();
        if (focusables.length === 0) {
          // Nothing to cycle — keep focus on the container.
          event.preventDefault();
          const container = containerRef.current;
          if (container) {
            try {
              container.focus();
            } catch {
              // ignore.
            }
          }
          return;
        }
        const activeEl = document.activeElement as HTMLElement | null;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const effect = resolveFocusTrapEffect({
          key: 'Tab',
          shiftKey: event.shiftKey,
          atFirst: activeEl === first,
          atLast: activeEl === last,
        });
        if (effect.type === 'wrap_to_first') {
          event.preventDefault();
          try {
            first.focus();
          } catch {
            // ignore.
          }
        } else if (effect.type === 'wrap_to_last') {
          event.preventDefault();
          try {
            last.focus();
          } catch {
            // ignore.
          }
        }
        // 'pass' -> interior Tab: let the browser move focus naturally.
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      // 6. Deregister and restore focus to the trigger if it is still
      // connected. A detached trigger (its node was removed while the
      // overlay was open) is skipped; focus lands on document.body.
      unregisterLayer(layerId);
      const previous = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (manageFocus && previous && previous.isConnected) {
        try {
          previous.focus();
        } catch {
          // ignore.
        }
      }
    };
  }, [visible, layerId, manageEsc, manageFocus]);

  return useMemo(
    () => ({ registerContainer, isTopmost }),
    [registerContainer, isTopmost],
  );
}
