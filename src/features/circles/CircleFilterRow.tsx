/**
 * HOME-003 (#840) — CircleFilterRow.
 *
 * A horizontal, non-color-only chip selector that narrows the ArgumentHome
 * "Your table" lane to a circle. An "All" chip clears the filter; one chip per
 * circle applies it. Presentational + controlled — it emits the selected circle
 * id (or null for "All") via `onSelect`.
 *
 * Doctrine: a chip is a NAME + a SIZE (member count), never a rating / heat /
 * verdict (cdiscourse-doctrine §1-§3). Circle names are user content, scanned in
 * rendered UI by the circles ban-list test — this component authors no name.
 *
 * A11y (accessibility-targets): every chip is a >=44px Pressable with
 * accessibilityRole="button" + accessibilityLabel + accessibilityState; the
 * selection carries a NON-color signal (a leading check glyph + filled style) so
 * it is legible in grayscale. Renders null when there are no circles (no empty
 * shell). Selection is a static style swap (reduce-motion safe).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SURFACE_TOKENS, SPACING, RADIUS, TOUCH_TARGET } from '../../lib/designTokens';
import { HOME_COPY } from '../arguments/gameCopy';
import type { CircleLens } from './circleHomeFilter';

export interface CircleFilterRowProps {
  circles: CircleLens[];
  selectedCircleId: string | null;
  onSelect: (circleId: string | null) => void; // null = "All" (clear)
}

export function CircleFilterRow({
  circles,
  selectedCircleId,
  onSelect,
}: CircleFilterRowProps): React.ReactElement | null {
  // AC: no chip row, no empty shell when the caller has no circles.
  if (!Array.isArray(circles) || circles.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={HOME_COPY.circleFilterRowA11yLabel}
      contentContainerStyle={styles.row}
      testID="home-circle-filter-row"
    >
      <Chip
        label={HOME_COPY.circleFilterAllLabel}
        a11yLabel={HOME_COPY.circleFilterAllA11yLabel}
        selected={selectedCircleId === null}
        onPress={() => onSelect(null)}
        testID="home-circle-chip-all"
      />
      {circles.map((circle) => {
        const count = Math.max(0, Math.floor(circle.memberCount || 0));
        const countLabel = `${count} ${count === 1 ? 'member' : 'members'}`;
        return (
          <Chip
            key={circle.id}
            label={circle.name}
            sizeLabel={countLabel}
            a11yLabel={`${circle.name}, ${countLabel}`}
            selected={selectedCircleId === circle.id}
            onPress={() => onSelect(circle.id)}
            testID={`home-circle-chip-${circle.id}`}
          />
        );
      })}
    </ScrollView>
  );
}

function Chip({
  label,
  sizeLabel,
  a11yLabel,
  selected,
  onPress,
  testID,
}: {
  label: string;
  sizeLabel?: string;
  a11yLabel: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected }}
      hitSlop={TOUCH_TARGET.hitSlopCompact}
      style={[styles.chip, selected && styles.chipSelected]}
      testID={testID}
    >
      {/* Non-color selection signal: a leading check glyph (grayscale-legible). */}
      {selected ? (
        <Text style={styles.checkGlyph} accessibilityElementsHidden>
          {'✓ '}
        </Text>
      ) : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {sizeLabel ? (
        <Text style={[styles.chipSize, selected && styles.chipSizeSelected]}>{sizeLabel}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACING.s, paddingVertical: SPACING.xs, paddingRight: SPACING.s },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: TOUCH_TARGET.minSizePx,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  // Non-color selection: a FILLED background AND a bolder label AND the leading
  // check glyph above — three signals so grayscale still reads the selection.
  chipSelected: {
    borderWidth: 2,
    borderColor: SURFACE_TOKENS.focusRing,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  checkGlyph: { fontSize: 13, fontWeight: '800', color: SURFACE_TOKENS.textPrimary },
  chipLabel: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textSecondary, maxWidth: 160 },
  chipLabelSelected: { fontWeight: '800', color: SURFACE_TOKENS.textPrimary },
  chipSize: { fontSize: 11, color: SURFACE_TOKENS.textMuted },
  chipSizeSelected: { color: SURFACE_TOKENS.textSecondary },
});
