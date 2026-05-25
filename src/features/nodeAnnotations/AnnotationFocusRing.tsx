/**
 * UX-001.5 — `AnnotationFocusRing` — focus state ring overlay.
 *
 * A purely visual overlay that mounts around an annotated object to
 * show the keyboard / selection focus state. The ring uses
 * `SURFACE_TOKENS.focusRing` (the shared indigo ring) so the focus
 * treatment matches every other focused control in the app.
 *
 * Doctrine + accessibility:
 *   - `pointerEvents="none"` — the ring is visual only; the parent
 *     element owns role + state.
 *   - 2px border carries a non-color geometric signal (focus survives a
 *     grayscale render).
 *   - All colors token-derived; no hex literals in this file.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { RADIUS, SURFACE_TOKENS } from '../../lib/designTokens';

export interface AnnotationFocusRingProps {
  /** True when the ring should render at full opacity (2 px border). */
  isFocused: boolean;
  /**
   * True when the underlying object is selected. Selection is independent
   * of focus; both may be true (focus AND selected) but a selected-only
   * state stays subtle.
   */
  isSelected?: boolean;
  /** Shape — drives borderRadius. Defaults to `'pill'`. */
  shape?: 'pill' | 'circle' | 'rounded';
  /** Overlay distance from the parent edge. Defaults to 3 px. */
  padding?: number;
  /** Caller-supplied overlay style. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

const SHAPE_RADIUS: Readonly<Record<'pill' | 'circle' | 'rounded', number>> = Object.freeze({
  pill: RADIUS.pill,
  circle: RADIUS.pill,
  rounded: RADIUS.md,
});

/**
 * Focus ring overlay. Renders an absolute-positioned `<View>` with a
 * 2 px focus-ring border when `isFocused`, a 1 px subtle border when
 * `isSelected`, and renders null when neither is true.
 */
export function AnnotationFocusRing({
  isFocused,
  isSelected,
  shape,
  padding,
  style,
  testID,
}: AnnotationFocusRingProps) {
  if (!isFocused && !isSelected) return null;
  const pad = typeof padding === 'number' ? padding : 3;
  const borderRadius = SHAPE_RADIUS[shape ?? 'pill'];

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.ring,
        {
          top: -pad,
          left: -pad,
          right: -pad,
          bottom: -pad,
          borderRadius,
          borderWidth: isFocused ? 2 : 1,
          borderColor: SURFACE_TOKENS.focusRing,
          opacity: isFocused ? 1 : 0.55,
        },
        style,
      ]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
  },
});
