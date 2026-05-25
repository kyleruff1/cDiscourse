/**
 * UX-001.5 — `InspectGroupHeader` — group divider with optional count.
 *
 * A small group-level header used inside Inspect sections to divide
 * grouped chip clusters (e.g. UX-001.5A's "Observations" vs
 * "Allegations" dividers inside §6 flags).
 *
 * v1 ships the primitive ready; no live consumer mounts it yet.
 * UX-001.5A is the first expected consumer.
 *
 * Doctrine:
 *   - Plain language only — `label` is the user-facing prose.
 *   - 11px uppercase secondary text — visually distinct from section
 *     titles without competing for emphasis.
 *   - `accessibilityRole="header"` so AT users hear the divider.
 *   - All colors token-derived; no hex literals.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SPACING, SURFACE_TOKENS } from '../../lib/designTokens';

export interface InspectGroupHeaderProps {
  /** Plain-language group label. */
  label: string;
  /** Optional item count appended as `· N`. */
  count?: number;
  /** Caller-supplied container style. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

/**
 * Build the screen-reader label for the group header. Exposed for unit
 * tests so the singular/plural noun is verified.
 */
export function buildInspectGroupHeaderAriaLabel(label: string, count?: number): string {
  const safeLabel = typeof label === 'string' ? label.trim() : '';
  if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
    const safeCount = Math.floor(count);
    const noun = safeCount === 1 ? 'item' : 'items';
    return safeLabel.length > 0
      ? `${safeLabel}, ${safeCount} ${noun}`
      : `${safeCount} ${noun}`;
  }
  return safeLabel;
}

/**
 * Group divider header — thin top border + uppercase label + optional
 * count suffix.
 */
export function InspectGroupHeader({ label, count, style, testID }: InspectGroupHeaderProps) {
  const safeLabel = typeof label === 'string' ? label.trim() : '';
  const ariaLabel = buildInspectGroupHeaderAriaLabel(label, count);
  const showCount = typeof count === 'number' && Number.isFinite(count) && count >= 0;
  const safeCount = showCount ? Math.floor(count as number) : 0;

  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={ariaLabel}
      style={[styles.container, style]}
      testID={testID}
    >
      <Text style={styles.label} numberOfLines={1}>
        {safeLabel}
      </Text>
      {showCount ? (
        <Text style={styles.count} numberOfLines={1}>
          {`· ${safeCount}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.divider,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  count: {
    fontSize: 11,
    color: SURFACE_TOKENS.textSecondary,
    letterSpacing: 0.4,
  },
});
