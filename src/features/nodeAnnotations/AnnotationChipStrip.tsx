/**
 * UX-001.5 — `AnnotationChipStrip` — horizontal chip container with
 * overflow + focus boundary.
 *
 * Renders up to `maxVisible` chips inline, with an `AnnotationOverflowChip`
 * appearing when there are more chips than the band cap allows. The
 * strip wraps to multiple rows (no horizontal ScrollView — predictable
 * cross-viewport layout).
 *
 * On web (`Platform.OS === 'web'`) the strip wraps its chips in an
 * `AnnotationFocusBoundary` that translates Arrow / Home / End / Escape
 * into focus moves between chips. On native the system's accessibility
 * focus rotor handles per-chip focus directly.
 *
 * Doctrine + accessibility:
 *   - Container `accessibilityRole="list"` — RN renders this as
 *     `'none'` on native (safe degradation); web exposes a `<ul>`-like
 *     role to AT.
 *   - Strip-level `accessibilityLabel` composed via
 *     `buildAnnotationStripAriaLabel`.
 *   - The focus boundary is web-only; native users rely on the rotor.
 *   - All colors token-derived (no hex literals in this file).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SPACING } from '../../lib/designTokens';
import { AnnotationChip } from './AnnotationChip';
import { AnnotationOverflowChip } from './AnnotationOverflowChip';
import { AnnotationFocusBoundary } from './AnnotationFocusBoundaryView';
import { buildAnnotationStripAriaLabel } from './annotationAriaLabel';
import type { AnnotationChipDescriptor } from './annotationChipDescriptor';
import {
  ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND,
  resolveBandValue,
  type AnnotationBand,
} from './annotationKindTokens';

export interface AnnotationChipStripProps {
  /** Chip descriptors to render. */
  descriptors: ReadonlyArray<AnnotationChipDescriptor>;
  /**
   * Optional explicit visible-chip cap. When unset, the band's table
   * value applies (phone 3 / tablet 4 / wide 6).
   */
  maxVisible?: number;
  /** Optional per-chip press handler — chips become pressable when set. */
  onChipPress?: (descriptor: AnnotationChipDescriptor) => void;
  /**
   * Optional overflow chip press handler. When omitted, the strip
   * toggles an internal `expanded` flag (renders all chips inline).
   */
  onOverflowPress?: () => void;
  /** Resolved band; defaults to `'tablet'`. */
  band?: AnnotationBand;
  /**
   * Stable section identifier — drives the strip-level aria label.
   * Defaults to `'flags'` (the v1 consumer).
   */
  sectionId?: string;
  /** Override style for embedding in custom containers. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

/**
 * Horizontal chip container with overflow handling.
 *
 * When `descriptors.length <= maxVisible`, renders every chip. When the
 * count exceeds `maxVisible`, renders `maxVisible - 1` chips + one
 * overflow `+N` chip. Tapping the overflow chip expands the strip
 * (internal state) unless `onOverflowPress` overrides.
 */
export function AnnotationChipStrip({
  descriptors,
  maxVisible,
  onChipPress,
  onOverflowPress,
  band,
  sectionId,
  style,
  testID,
}: AnnotationChipStripProps) {
  const resolvedMax = useMemo(() => {
    if (typeof maxVisible === 'number' && maxVisible > 0) return Math.floor(maxVisible);
    return resolveBandValue(ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND, band);
  }, [maxVisible, band]);

  const [internalExpanded, setInternalExpanded] = useState(false);
  const externallyControlled = typeof onOverflowPress === 'function';
  const expanded = externallyControlled ? false : internalExpanded;

  const safeDescriptors = useMemo(
    () => (Array.isArray(descriptors) ? descriptors : []),
    [descriptors],
  );

  const overflowCount = Math.max(0, safeDescriptors.length - resolvedMax);
  const shouldShowOverflow = !expanded && overflowCount > 0;

  // When overflow chip is present, we render (maxVisible - 1) descriptors so
  // the chip + overflow chip together stay at maxVisible items.
  const visibleDescriptors = useMemo(() => {
    if (expanded) return safeDescriptors;
    if (shouldShowOverflow && resolvedMax >= 1) {
      return safeDescriptors.slice(0, Math.max(0, resolvedMax - 1));
    }
    return safeDescriptors.slice(0, resolvedMax);
  }, [safeDescriptors, expanded, shouldShowOverflow, resolvedMax]);

  // Overflow count reported to the chip — includes any descriptors hidden
  // by the (resolvedMax - 1) slice when overflow is on.
  const overflowCountForChip = expanded
    ? 0
    : Math.max(0, safeDescriptors.length - visibleDescriptors.length);

  const handleOverflowPress = useCallback(() => {
    if (externallyControlled && onOverflowPress) {
      onOverflowPress();
      return;
    }
    setInternalExpanded(true);
  }, [externallyControlled, onOverflowPress]);

  const stripAriaLabel = useMemo(
    () => buildAnnotationStripAriaLabel(safeDescriptors, sectionId ?? 'flags'),
    [safeDescriptors, sectionId],
  );

  // Render nothing for an empty descriptor list so the section host can
  // fall back to its own empty-state copy.
  if (safeDescriptors.length === 0) return null;

  const totalFocusable =
    visibleDescriptors.length + (shouldShowOverflow && overflowCountForChip > 0 ? 1 : 0);

  const stripBody = (
    <View
      accessibilityRole="list"
      accessibilityLabel={stripAriaLabel}
      style={[styles.strip, style]}
      testID={testID}
    >
      {visibleDescriptors.map((descriptor) => (
        <AnnotationChip
          key={descriptor.id}
          descriptor={descriptor}
          onPress={onChipPress}
          band={band}
          testID={`${testID ?? 'annotation-chip-strip'}-chip-${descriptor.id}`}
        />
      ))}
      {shouldShowOverflow && overflowCountForChip > 0 ? (
        <AnnotationOverflowChip
          count={overflowCountForChip}
          onPress={handleOverflowPress}
          band={band}
          testID={`${testID ?? 'annotation-chip-strip'}-overflow`}
        />
      ) : null}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <AnnotationFocusBoundary
        total={totalFocusable}
        testID={`${testID ?? 'annotation-chip-strip'}-focus-boundary`}
      >
        {stripBody}
      </AnnotationFocusBoundary>
    );
  }
  return stripBody;
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
    rowGap: SPACING.xs,
  },
});
