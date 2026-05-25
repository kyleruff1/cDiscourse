/**
 * UX-001.5 — `AnnotationEdgeHighlight` — parent-child edge emphasis.
 *
 * A thin colored line that highlights a parent-child relationship
 * between two timeline nodes. The line geometry is owned by the caller
 * (the Timeline knows where the edges live); this primitive renders the
 * line itself.
 *
 * Doctrine:
 *   - `pointerEvents="none"` — visual only.
 *   - Line thickness is a geometric signal (carries meaning beyond
 *     color).
 *   - Default color is `GLOW.activePath.color` — the active-path indigo
 *     that already encodes "this edge is part of the active path".
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { GLOW } from '../../lib/designTokens';

export interface AnnotationEdgeHighlightProps {
  /**
   * Edge direction. `'from'` = highlight the line leaving the parent;
   * `'to'` = highlight the line arriving at the child; `'between'` =
   * the inline span linking both. The primitive treats every direction
   * identically (a thin line); the prop is preserved as a hook for
   * future arrow-cap rendering.
   */
  direction: 'from' | 'to' | 'between';
  /** Line thickness. Defaults to 2 px (matches GLOW.activePath strokeWidthPx). */
  thicknessPx?: number;
  /**
   * Override color. Defaults to `GLOW.activePath.color`. Callers SHOULD
   * pass a designToken value; the primitive does not validate.
   */
  color?: string;
  /** Caller-supplied position style (the Timeline owns geometry). */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

/**
 * Thin colored line. The caller supplies position; the primitive ships
 * the visual.
 */
export function AnnotationEdgeHighlight({
  direction,
  thicknessPx,
  color,
  style,
  testID,
}: AnnotationEdgeHighlightProps) {
  // Direction is a forward-compatibility hook; render is uniform.
  void direction;
  const thickness = typeof thicknessPx === 'number' && thicknessPx > 0 ? thicknessPx : 2;
  const lineColor = typeof color === 'string' && color.length > 0 ? color : GLOW.activePath.color;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.edge,
        {
          backgroundColor: lineColor,
          height: thickness,
          minHeight: thickness,
        },
        style,
      ]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  edge: {
    // No `position`, `top`, `left`, `right`, `bottom`, `width` defaults
    // here — the Timeline supplies them via `style`. Avoids layout
    // displacement when mounted as an overlay (UX-001.2 regression
    // preservation).
  },
});
