/**
 * UX-001.5 — `AnnotationChip` — the base pill chip primitive.
 *
 * One labeled chip. Pressable when `onPress` is provided; otherwise a
 * plain text chip. Visually consistent with UX-001.3's
 * `ComposerValidationPanel.ValidationActionChip` (pill radius, padding,
 * label cap) but independent — UX-001.5 does NOT refactor the composer
 * chip.
 *
 * Doctrine + accessibility:
 *   - 44×44 tap target on pressable chips via `hitSlop`.
 *   - `accessibilityRole = 'button' | 'text'` per pressable state.
 *   - `accessibilityLabel` composed via `buildAnnotationAriaLabel` unless
 *     the descriptor supplies its own override.
 *   - Color is supplementary — every chip carries a `<Text>` label and
 *     an optional glyph; meaning survives a grayscale render.
 *   - All colors token-derived via `resolveChipColorsForDescriptor`;
 *     this file contains no hex literals.
 *
 * Presentational only. The rendering decisions are deterministic; the
 * descriptor + band drive everything.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { RADIUS, SPACING } from '../../lib/designTokens';
import { buildAnnotationAriaLabel } from './annotationAriaLabel';
import type {
  AnnotationChipDescriptor,
  AnnotationChipIconHint,
} from './annotationChipDescriptor';
import {
  ANNOTATION_CHIP_HEIGHT_BY_BAND,
  resolveBandValue,
  resolveChipColorsForDescriptor,
  type AnnotationBand,
} from './annotationKindTokens';

/**
 * Geometric glyph for an icon hint. Glyphs are non-color carriers of
 * meaning (accessibility-targets §"Color contrast targets"). Returns
 * empty string when no hint is supplied — the chip renders label-only.
 */
function glyphFor(iconHint: AnnotationChipIconHint | undefined): string {
  switch (iconHint) {
    case 'info':
      return 'ⓘ';
    case 'warn':
      return '⚑';
    case 'check':
      return '✓';
    case 'time':
      return '⏱';
    case 'evidence':
      return '◆';
    case 'flag':
      return '⚑';
    case 'cluster':
      return '◦';
    default:
      return '';
  }
}

export interface AnnotationChipProps {
  /** The chip's content descriptor. */
  descriptor: AnnotationChipDescriptor;
  /** Fires when pressed; absent → chip renders as `<View>` with role text. */
  onPress?: (descriptor: AnnotationChipDescriptor) => void;
  /**
   * Chip outer height intent. Resolved from `ANNOTATION_CHIP_HEIGHT_BY_BAND`
   * — `'phone'` 28px, `'tablet' | 'wide'` 32px. Defaults to `'tablet'`.
   */
  band?: AnnotationBand;
  /** Override style for embedding in custom containers. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

/**
 * Base pill chip. Pressable when `onPress` is provided.
 *
 * Doctrine:
 *   - Color is supplementary — the label is always present.
 *   - 44×44 tap target via `hitSlop` on pressable chips.
 *   - `accessibilityRole` flips between `'button'` / `'text'` based on
 *     pressability.
 */
export function AnnotationChip({
  descriptor,
  onPress,
  band,
  style,
  testID,
}: AnnotationChipProps) {
  const colors = useMemo(() => resolveChipColorsForDescriptor(descriptor), [descriptor]);
  const height = resolveBandValue(ANNOTATION_CHIP_HEIGHT_BY_BAND, band);
  const isPressable = typeof onPress === 'function';

  const containerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [
      styles.chip,
      {
        backgroundColor: colors.bg,
        borderColor: colors.borderColor,
        height,
        paddingHorizontal: band === 'phone' ? 8 : band === 'wide' ? 12 : 10,
        paddingVertical: band === 'wide' ? SPACING.xs + 2 : SPACING.xs,
      },
      style,
    ],
    [colors.bg, colors.borderColor, height, band, style],
  );

  const ariaLabel = useMemo(() => buildAnnotationAriaLabel(descriptor), [descriptor]);
  const glyph = glyphFor(descriptor.iconHint);

  const handlePress = React.useCallback(() => {
    if (typeof onPress === 'function') onPress(descriptor);
  }, [onPress, descriptor]);

  const body = (
    <>
      {glyph.length > 0 ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.glyph, { color: colors.fg }]}
        >
          {glyph}
        </Text>
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: colors.fg,
            fontSize: band === 'phone' ? 11 : 12,
          },
        ]}
      >
        {descriptor.label}
      </Text>
    </>
  );

  if (isPressable) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={ariaLabel}
        accessibilityState={{ disabled: false }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={containerStyle}
        testID={testID}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={ariaLabel}
      style={containerStyle}
      testID={testID}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  glyph: {
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    fontWeight: '600',
  },
});
