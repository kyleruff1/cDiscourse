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
 *
 * UX-PR-C (issue 923) — visible provenance. Each line leads with a fixed,
 * visible "Advisory" affix so sighted users see the machine-Observation
 * provenance the screen reader already announces (the accessibilityLabel starts
 * "Advisory:"). The affix is a SEPARATE, accessibility-hidden sibling Text so
 * the reader announces the sentence label ONCE (no "Advisory. Advisory:"
 * double). The affix is chrome (an exported constant), never signal copy — the
 * ban-list-scanned sentence copy in derivedSignalConsumerModel stays untouched.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SPACING, SURFACE_TOKENS, TYPOGRAPHY } from '../../lib/designTokens';
import type { DerivedSignalLine } from './derivedSignalConsumerModel';

/** Visible provenance affix leading every advisory line. Chrome, not signal copy. */
export const DERIVED_SIGNAL_PROVENANCE_AFFIX = 'Advisory';

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
        <View key={line.code} style={styles.row}>
          <Text
            style={styles.affix}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
            testID={`derived-signal-advisory-affix-${line.code}`}
          >
            {DERIVED_SIGNAL_PROVENANCE_AFFIX}
          </Text>
          <Text
            style={styles.line}
            accessibilityRole="text"
            accessibilityLabel={line.accessibilityLabel}
            testID={`derived-signal-advisory-${line.code}`}
          >
            {line.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.xs,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  affix: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 3,
    fontWeight: '700',
  },
  line: {
    flex: 1,
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 3,
  },
});
