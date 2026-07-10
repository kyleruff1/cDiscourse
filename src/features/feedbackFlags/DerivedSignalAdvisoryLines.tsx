/**
 * FEEDBACK-002 (#899) — DerivedSignalAdvisoryLines.
 *
 * A small calm presentational strip that renders the derived-signal advisory
 * lines for the active node inside the Inspect disclosure (next to
 * PointFeedbackFlagsRow). Renders `null` for an empty list, so a flag-off room
 * (empty lines) is byte-identical. Copy is supplied pre-cleaned by
 * derivedSignalConsumerModel (ban-list scanned there); this component never
 * hardcodes any signal copy.
 *
 * Doctrine + accessibility:
 *  - Lines are non-interactive (`accessibilityRole="text"`); the words carry the
 *    meaning (never color-only). All text inside <Text>.
 *  - Advisory only — no submit, no mutation, no callback, no verdict.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SPACING, SURFACE_TOKENS, TYPOGRAPHY } from '../../lib/designTokens';
import type { DerivedSignalLine } from './derivedSignalConsumerModel';

export interface DerivedSignalAdvisoryLinesProps {
  lines: ReadonlyArray<DerivedSignalLine>;
  testID?: string;
}

export function DerivedSignalAdvisoryLines({
  lines,
  testID,
}: DerivedSignalAdvisoryLinesProps): React.ReactElement | null {
  if (!lines || lines.length === 0) return null;
  return (
    <View style={styles.wrap} testID={testID ?? 'derived-signal-advisory-lines'}>
      {lines.map((line) => (
        <Text
          key={line.code}
          style={styles.line}
          accessibilityRole="text"
          accessibilityLabel={line.accessibilityLabel}
          testID={`derived-signal-advisory-${line.code}`}
        >
          {line.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.xs,
    gap: 2,
  },
  line: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 3,
  },
});
