/**
 * UX-001.5 — `AnnotationOverflowChip` — the "+N" indicator.
 *
 * Renders the overflow chip that an `AnnotationChipStrip` mounts when it
 * has more chips than `maxVisible`. Visually consistent with
 * `AnnotationChip` (same pill geometry) but uses the kind=`'context'`
 * token defaults and renders a `+N` label.
 *
 * Doctrine + accessibility:
 *   - 44×44 tap target via `hitSlop` regardless of visual size.
 *   - `accessibilityRole = 'button'`.
 *   - `accessibilityLabel` reads "N more annotation(s)" — plural
 *     grammar handled.
 *   - All colors token-derived; this file contains no hex literals.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { RADIUS, SPACING } from '../../lib/designTokens';
import {
  ANNOTATION_CHIP_HEIGHT_BY_BAND,
  ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND,
  resolveBandValue,
  resolveChipColors,
  type AnnotationBand,
} from './annotationKindTokens';

export interface AnnotationOverflowChipProps {
  /** Overflow count — rendered as `+N`. Must be ≥ 1 to render. */
  count: number;
  /** Fires when pressed; absent → chip renders disabled (no expand). */
  onPress?: () => void;
  /** Resolved band; defaults to `'tablet'`. */
  band?: AnnotationBand;
  /** testID passthrough. */
  testID?: string;
}

/**
 * Build the plain-English screen-reader label for the overflow chip.
 *
 * Pure helper, exported for unit-test reuse.
 */
export function buildAnnotationOverflowAriaLabel(count: number): string {
  const safeCount = Math.max(0, Math.floor(count));
  const noun = safeCount === 1 ? 'annotation' : 'annotations';
  return `${safeCount} more ${noun}.`;
}

/**
 * The overflow chip — a `+N` Pressable styled like the base chip but
 * keyed by the kind=`'context'` token defaults.
 */
export function AnnotationOverflowChip({
  count,
  onPress,
  band,
  testID,
}: AnnotationOverflowChipProps) {
  // Hooks must be called unconditionally — guards live below.
  const colors = useMemo(() => resolveChipColors('context'), []);
  const safeCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  const height = resolveBandValue(ANNOTATION_CHIP_HEIGHT_BY_BAND, band);
  const minWidth = resolveBandValue(ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND, band);
  const ariaLabel = buildAnnotationOverflowAriaLabel(safeCount);

  const isEnabled = typeof onPress === 'function';

  // Render nothing for non-positive counts (no chip, no a11y noise).
  if (safeCount <= 0) return null;

  return (
    <Pressable
      onPress={isEnabled ? onPress : undefined}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      accessibilityHint={isEnabled ? 'Expands the list.' : undefined}
      accessibilityState={{ disabled: !isEnabled }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      disabled={!isEnabled}
      style={[
        styles.chip,
        {
          backgroundColor: colors.bg,
          borderColor: colors.borderColor,
          height,
          minWidth,
        },
        !isEnabled && styles.chipDisabled,
      ]}
      testID={testID}
    >
      <Text
        numberOfLines={1}
        style={[styles.label, { color: colors.fg, fontSize: band === 'phone' ? 11 : 12 }]}
      >
        {`+${safeCount}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.s,
  },
  chipDisabled: {
    opacity: 0.55,
  },
  label: {
    fontWeight: '700',
  },
});
