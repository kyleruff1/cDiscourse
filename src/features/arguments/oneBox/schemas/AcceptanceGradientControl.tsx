/**
 * QOL-041 — AcceptanceGradientControl.
 *
 * The 5-segment gradient control that sits on one row of the
 * `respond_to_concession` box (QOL-041 design §7.2). The receiver
 * picks one of:
 *
 *   Agree · Agree with caveat · Disagree based on framing ·
 *   Disagree based on context · Disagree based on fact
 *
 * Doctrine (QOL-041 §7.2, §11; accessibility-targets):
 *
 *   1. **Color independence.** The gradient is NOT a red→green ramp.
 *      Each segment carries a TEXT LABEL; the selected segment is marked
 *      by a filled state + a "✓" prefix, not by hue alone. The visual
 *      hierarchy is structural, not color-coded.
 *   2. **44px targets.** Every segment is at least 44dp tall, per
 *      accessibility-targets minimum tap target.
 *   3. **Screen reader.** Each segment is a `Pressable` with
 *      `accessibilityRole="radio"`, `accessibilityState={{ selected }}`,
 *      and an `accessibilityLabel` that includes the level's helper
 *      line. The group carries `accessibilityRole="radiogroup"`.
 *   4. **Reduce-motion.** The selection change is instant — no
 *      `LayoutAnimation`, no transition. The transform is purely a
 *      style swap.
 *   5. **No verdict copy.** Labels are the receiver's STATED STANCE,
 *      never a truth ruling. The label is the design §7.2 text
 *      verbatim from `ACCEPTANCE_LEVEL_COPY` — no extra copy here.
 *
 * Pure presentation. No Supabase, no network. The parent owns the
 * draft state.
 */
import React, { useCallback, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ALL_ACCEPTANCE_LEVELS,
  ACCEPTANCE_LEVEL_COPY,
  type AcceptanceLevel,
} from '../../../concessions/acceptanceGradient';
import { SURFACE_TOKENS, RADIUS, SPACING, CONTROL } from '../../../../lib/designTokens';

// ── Props ─────────────────────────────────────────────────────

export interface AcceptanceGradientControlProps {
  /** The currently selected level. `null` until the receiver picks. */
  selectedLevel: AcceptanceLevel | null;
  /** Receiver picks a level. The parent updates its mirrored-list draft. */
  onSelectLevel: (level: AcceptanceLevel) => void;
  /** Disabled in read-only / submitting states. */
  disabled?: boolean;
  /** Test id prefix to disambiguate multiple rows on one screen. */
  testIDPrefix?: string;
}

// ── Component ─────────────────────────────────────────────────

/**
 * One 5-segment row. Renders each level as a separate `Pressable`. The
 * selected segment uses a filled background + a "✓" prefix; the
 * unselected segments use the elevated-surface fill. Hue is never the
 * only signal.
 */
export function AcceptanceGradientControl({
  selectedLevel,
  onSelectLevel,
  disabled = false,
  testIDPrefix = 'acceptance-gradient',
}: AcceptanceGradientControlProps): ReactElement {
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      testID={`${testIDPrefix}-group`}
    >
      {ALL_ACCEPTANCE_LEVELS.map((level) => (
        <GradientSegment
          key={level}
          level={level}
          isSelected={selectedLevel === level}
          disabled={disabled}
          onPress={onSelectLevel}
          testID={`${testIDPrefix}-segment-${level}`}
        />
      ))}
    </View>
  );
}

interface GradientSegmentProps {
  level: AcceptanceLevel;
  isSelected: boolean;
  disabled: boolean;
  onPress: (level: AcceptanceLevel) => void;
  testID: string;
}

function GradientSegment({
  level,
  isSelected,
  disabled,
  onPress,
  testID,
}: GradientSegmentProps): ReactElement {
  const copy = ACCEPTANCE_LEVEL_COPY[level];
  const handlePress = useCallback(() => {
    if (!disabled) onPress(level);
  }, [disabled, onPress, level]);

  // Screen-reader label = "Selected. <label>. <helper>." when picked;
  // otherwise "<label>. <helper>." — the SR contract is the receiver
  // hears both the label and the helper line so they understand what
  // the segment means before tapping.
  const a11yLabel = isSelected
    ? `Selected. ${copy.label}. ${copy.helper}`
    : `${copy.label}. ${copy.helper}`;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled }}
      accessibilityLabel={a11yLabel}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={[
        styles.segment,
        isSelected && styles.segmentSelected,
        disabled && styles.segmentDisabled,
      ]}
      testID={testID}
    >
      {isSelected && (
        <Text
          style={styles.segmentCheck}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {'✓ '}
        </Text>
      )}
      <Text
        style={[
          styles.segmentLabel,
          isSelected && styles.segmentLabelSelected,
        ]}
        numberOfLines={2}
      >
        {copy.label}
      </Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────

const SEGMENT_MIN_HEIGHT = 44; // a11y-targets minimum tap target

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    flexBasis: 0,
    minHeight: SEGMENT_MIN_HEIGHT,
    minWidth: 96, // wraps cleanly on narrow screens
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  segmentSelected: {
    backgroundColor: CONTROL.primary.bg,
    borderColor: CONTROL.primary.bg,
  },
  segmentDisabled: {
    opacity: 0.6,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
    textAlign: 'center',
  },
  segmentLabelSelected: {
    color: CONTROL.primary.fg,
  },
  segmentCheck: {
    fontSize: 13,
    fontWeight: '700',
    color: CONTROL.primary.fg,
    marginRight: 0,
  },
});
