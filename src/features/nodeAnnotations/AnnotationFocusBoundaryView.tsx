/**
 * UX-001.5 — `AnnotationFocusBoundary` — RN wrapper for the pure-TS
 * keyboard focus model.
 *
 * Web-only: on `Platform.OS === 'web'` the wrapper attaches an
 * `onKeyDown` handler at the strip wrapper. On native the wrapper is a
 * pass-through `<View>` (no custom keydown — the system rotor handles
 * focus).
 *
 * The keyboard logic is delegated to the pure-TS
 * `resolveFocusBoundaryKeyEffect` / `applyFocusBoundaryEffect` so the
 * interpreter has its own unit-test coverage.
 *
 * Doctrine:
 *   - No new keyboard shortcut allocations — Arrow / Home / End /
 *     Escape are the only keys handled, and a modifier key forces the
 *     boundary to noop so OS-level Shift+Tab + accelerators still work.
 *   - The wrapper does NOT render any visible UI of its own; it's a
 *     focus + keydown delegate.
 */
import React, { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';
import type { ViewProps } from 'react-native';
import {
  applyFocusBoundaryEffect,
  resolveFocusBoundaryKeyEffect,
} from './annotationFocusBoundary';

export interface AnnotationFocusBoundaryProps extends ViewProps {
  /**
   * Total number of focusable children. The boundary tracks an internal
   * focused index in `[0, total - 1]`; the strip's children carry their
   * own focus / tabindex management.
   */
  total: number;
  /**
   * Optional callback fired when the boundary computes a focus move.
   * The caller may use this to imperatively focus the matching child.
   * Defaults to a no-op; the boundary's primary job is to absorb arrow
   * keys so the document's default focus-shift behavior does not fire.
   */
  onFocusMove?: (nextIndex: number | null) => void;
  /** testID passthrough for the wrapper view. */
  testID?: string;
  children?: React.ReactNode;
}

/**
 * The focus boundary wrapper.
 *
 * Web: a `<div>`-like RN `<View>` with `tabIndex={0}` and an `onKeyDown`
 * that consumes Arrow / Home / End / Escape. The boundary returns
 * after the effect is applied — the host strip's children remain
 * responsible for actually receiving focus.
 *
 * Native: a pass-through `<View>`; the rotor handles per-chip focus.
 */
export function AnnotationFocusBoundary({
  total,
  onFocusMove,
  testID,
  children,
  style,
  ...rest
}: AnnotationFocusBoundaryProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleKeyDown = useCallback(
    (event: { key: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; preventDefault?: () => void }) => {
      const effect = resolveFocusBoundaryKeyEffect(event.key, {
        shift: event.shiftKey,
        alt: event.altKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
      });
      if (effect.type === 'noop') return;
      const nextIndex = applyFocusBoundaryEffect(effect, focusedIndex, total);
      setFocusedIndex(nextIndex);
      if (onFocusMove) onFocusMove(nextIndex);
      // Prevent the page from scrolling when the boundary consumes Arrow
      // keys at the strip level.
      if (event.preventDefault && effect.type !== 'exit_boundary') {
        event.preventDefault();
      }
    },
    [focusedIndex, total, onFocusMove],
  );

  if (Platform.OS !== 'web') {
    // Native: pass-through. Rotor handles per-chip focus.
    return (
      <View style={style} testID={testID} {...rest}>
        {children}
      </View>
    );
  }

  // Web-only: tabIndex=0 + onKeyDown. RN's web renderer forwards both
  // to the DOM, so the boundary participates in tab order and consumes
  // arrow keys when focused.
  // Cast through unknown because RN's ViewProps lacks tabIndex / onKeyDown
  // typings; the react-native-web runtime accepts both.
  const webPropsCast = {
    tabIndex: 0,
    onKeyDown: handleKeyDown,
  } as unknown as ViewProps;
  return (
    <View style={style} testID={testID} {...rest} {...webPropsCast}>
      {children}
    </View>
  );
}
