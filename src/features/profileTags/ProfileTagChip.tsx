/**
 * PR-002 — ProfileTagChip.
 *
 * A small reusable presentational chip rendering one profile tag with a
 * selected / unselected / disabled visual state.
 *
 * Doctrine / accessibility (cdiscourse-doctrine, accessibility-targets):
 *   - The selected state carries a check glyph AND a filled style —
 *     shape + glyph carry the meaning, never colour alone.
 *   - `accessibilityRole="checkbox"` with
 *     `accessibilityState={{ checked, disabled }}` and a descriptive
 *     `accessibilityLabel` (built in `profileTagCopy.chipAccessibilityLabel`).
 *   - ≥ 44×44 effective hit target via `hitSlop`.
 *   - The chip is a `Pressable` only — there is no editable / free-text
 *     entry; a tag can only be selected from the closed vocabulary.
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { ProfileTagDefinition } from './profileTagModel';

export interface ProfileTagChipProps {
  definition: ProfileTagDefinition;
  selected: boolean;
  /** `true` when the cap is reached and this chip is not already selected. */
  disabled: boolean;
  onPress: () => void;
  /** Descriptive label, e.g. "Climate & environment, Topic interests, selected". */
  accessibilityLabel: string;
  testID: string;
}

export function ProfileTagChip({
  definition,
  selected,
  disabled,
  onPress,
  accessibilityLabel,
  testID,
}: ProfileTagChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected, disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
      ]}
    >
      {/* Glyph carries the selected meaning independent of colour. */}
      <Text
        style={[styles.glyph, selected ? styles.glyphSelected : styles.glyphUnselected]}
      >
        {selected ? '✓' : '+'}
      </Text>
      <Text
        style={[styles.label, selected && styles.labelSelected, disabled && styles.labelDisabled]}
        numberOfLines={2}
      >
        {definition.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1220',
    gap: 6,
  },
  // Selected: a filled style + a solid border + the check glyph. The
  // shape/stroke change keeps the state legible without colour.
  chipSelected: {
    backgroundColor: '#312e81',
    borderColor: '#a5b4fc',
    borderWidth: 2,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  glyph: {
    fontSize: 13,
    fontWeight: '800',
  },
  glyphSelected: {
    color: '#e0e7ff',
  },
  glyphUnselected: {
    color: '#64748b',
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  labelSelected: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  labelDisabled: {
    color: '#94a3b8',
  },
});
