/**
 * UX-001.5 — `AnnotationOutline` — selected / active / dimmed outline.
 *
 * State-driven outline overlay, distinct from focus. Selection and
 * active state are object-level concerns; focus is a transient
 * keyboard/screen-reader concern handled by `AnnotationFocusRing`.
 *
 * Doctrine:
 *   - `pointerEvents="none"` — visual only.
 *   - Border thickness + alpha carry meaning beyond color (a grayscale
 *     render still reads "selected" vs "active" vs "dimmed").
 *   - All colors token-derived; uses `BRAND.accent.cream` for selected
 *     (mirrors VG-004 `selectedHalo`) and `GLOW.activePath.color` for
 *     active. No new hex literals.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { BRAND, GLOW, RADIUS, SURFACE_TOKENS } from '../../lib/designTokens';

export type AnnotationOutlineState = 'selected' | 'active' | 'dimmed' | 'none';

export interface AnnotationOutlineProps {
  /** State drives the overlay style. `'none'` renders null. */
  state: AnnotationOutlineState;
  /** Shape — drives borderRadius. Defaults to `'rounded'`. */
  shape?: 'pill' | 'circle' | 'rounded';
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

interface StatePresentation {
  borderWidth: number;
  borderColor: string;
  opacity: number;
}

const STATE_PRESENTATION: Readonly<Record<Exclude<AnnotationOutlineState, 'none'>, StatePresentation>> =
  Object.freeze({
    selected: {
      borderWidth: 2,
      borderColor: BRAND.accent.cream,
      opacity: 1,
    },
    active: {
      borderWidth: 1,
      borderColor: GLOW.activePath.color,
      opacity: 1,
    },
    dimmed: {
      borderWidth: 1,
      borderColor: SURFACE_TOKENS.border,
      opacity: 0.5,
    },
  });

/**
 * State-driven outline overlay.
 *
 * Render rules (design §2 #7):
 *   - selected: 2px cream border (mirrors VG-004 selectedHalo)
 *   - active:   1px indigo border (mirrors GLOW.activePath)
 *   - dimmed:   1px subtle border, opacity 0.5
 *   - none:     null
 */
export function AnnotationOutline({ state, shape, style, testID }: AnnotationOutlineProps) {
  if (state === 'none') return null;
  const presentation = STATE_PRESENTATION[state];
  const borderRadius = SHAPE_RADIUS[shape ?? 'rounded'];

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.outline,
        {
          borderRadius,
          borderWidth: presentation.borderWidth,
          borderColor: presentation.borderColor,
          opacity: presentation.opacity,
        },
        style,
      ]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  outline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
