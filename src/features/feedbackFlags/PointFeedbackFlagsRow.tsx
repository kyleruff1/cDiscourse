/**
 * UX-FLAGS-002 — PointFeedbackFlagsRow.
 *
 * A small, calm row/section of point-level feedback-flag pills for the active
 * point. Renders `null` for an empty flag list (the default room stays visually
 * calm). The ONLY interactive element is an optional "why?" disclosure toggle
 * that reveals the per-flag helper lines; it reveals text only — no submit, no
 * mutation, no callback.
 *
 * Doctrine + accessibility:
 *  - Pills are non-interactive (`accessibilityRole="text"`); tone is carried by
 *    glyph + text, never color-only.
 *  - The "why?" toggle is a Pressable with `accessibilityRole="button"`,
 *    `accessibilityState={{ expanded }}`, and a `hitSlop` that clears 44×44.
 *  - Reduce-motion safe by construction: the helper section snaps open/closed,
 *    no animation.
 *  - All text lives inside `<Text>`; no raw strings in `<View>`.
 */
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  FOCUS_RING,
  SPACING,
  SPACING_PRESETS,
  SURFACE_TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../../lib/designTokens';
import { PointFeedbackFlagPill } from './PointFeedbackFlagPill';
import type { PointFeedbackFlagViewModel } from './pointFeedbackFlagsModel';
import { flagIntentForKey } from './flagComposerIntentMap';

export interface PointFeedbackFlagsRowProps {
  flags: ReadonlyArray<PointFeedbackFlagViewModel>;
  /** Optional section heading. Ban-list clean copy only. */
  heading?: string;
  /**
   * UX-FLAGS-003 — how many flags the #835 priority/cap module suppressed to
   * keep this row at <= 3. Renders a quiet, NON-interactive "+N more" count when
   * > 0 AND `flags` is non-empty. Reveals nothing; not a control. Default 0.
   */
  suppressedCount?: number;
  /**
   * UX-FLAGS-004 (#836) — when present, actionable pills become tappable and
   * fire this with the flag key. Absent => every pill renders inert exactly as
   * UX-FLAGS-002 shipped (flag off / observer / own move / legacy surface). The
   * "why?" toggle path is untouched.
   */
  onFlagIntent?: (flagKey: string) => void;
  testID?: string;
}

/**
 * Whether the row has any helper text worth revealing behind the "why?" toggle.
 */
function hasAnyHelper(flags: ReadonlyArray<PointFeedbackFlagViewModel>): boolean {
  for (const f of flags) {
    if (typeof f.helper === 'string' && f.helper.length > 0) return true;
  }
  return false;
}

export function PointFeedbackFlagsRow({
  flags,
  heading = 'On this point',
  suppressedCount = 0,
  onFlagIntent,
  testID,
}: PointFeedbackFlagsRowProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);

  // Calm default: nothing to show → render nothing at all. The "+N more" count
  // never resurrects an empty row — an empty flag list renders null regardless
  // of suppressedCount.
  if (!Array.isArray(flags) || flags.length === 0) return null;

  const showWhyToggle = hasAnyHelper(flags);
  const showMoreCount = typeof suppressedCount === 'number' && suppressedCount > 0;

  return (
    <View style={styles.wrap} testID={testID ?? 'point-feedback-flags-row'}>
      <View style={styles.headerRow}>
        <Text style={styles.heading} accessibilityRole="header">
          {heading}
        </Text>
        {showWhyToggle ? (
          <Pressable
            onPress={() => setExpanded((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Hide why' : 'Show why'}
            accessibilityState={{ expanded }}
            hitSlop={TOUCH_TARGET.hitSlopAll}
            style={(state) => [
              styles.whyToggle,
              // Web keyboard focus ring (reduce-motion safe: width, no
              // animation). `focused` is a react-native-web-only state field
              // that the shared RN Pressable type does not declare, so read it
              // through a narrow local shape rather than widening the callback.
              Platform.OS === 'web' && (state as { focused?: boolean }).focused
                ? styles.whyToggleFocused
                : null,
            ]}
            testID="point-feedback-flags-why-toggle"
          >
            <Text style={styles.whyToggleText}>{expanded ? 'Hide why' : 'why?'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.pillRow}>
        {flags.map((flag) => (
          <PointFeedbackFlagPill
            key={flag.id}
            flag={flag}
            // UX-FLAGS-004 — onFlagIntent absent => onPress undefined + actionable
            // false => inert pill (byte-identical to today). Present => the pill
            // becomes a button ONLY for flags that resolve to a composer intent;
            // non-actionable flags stay inert (actionable false).
            onPress={onFlagIntent}
            actionable={onFlagIntent ? flagIntentForKey(flag.id) !== null : false}
          />
        ))}
      </View>

      {/* UX-FLAGS-003 — quiet, non-interactive suppressed-count. Reveals
          nothing; not a Pressable. Plain, calm copy: no severity / importance /
          priority / score framing. */}
      {showMoreCount ? (
        <Text
          style={styles.moreCount}
          accessibilityRole="text"
          accessibilityLabel={`${suppressedCount} more on this point`}
          testID="point-feedback-flags-more"
        >
          +{suppressedCount} more
        </Text>
      ) : null}

      {expanded && showWhyToggle ? (
        <View style={styles.helperBlock} testID="point-feedback-flags-helpers">
          {flags
            .filter((f) => typeof f.helper === 'string' && f.helper.length > 0)
            .map((f) => (
              <Text key={f.id} style={styles.helperLine} testID={`point-feedback-flag-helper-${f.id}`}>
                {f.label}: {f.helper}
              </Text>
            ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.s,
    rowGap: SPACING_PRESETS.compactRowGap,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
  },
  whyToggle: {
    // Visual is small; hitSlop lifts it to >= 44×44 (accessibility-targets).
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  whyToggleFocused: {
    borderWidth: FOCUS_RING.widthPx,
    borderColor: FOCUS_RING.color,
  },
  whyToggleText: {
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: SPACING_PRESETS.chipGap,
    rowGap: SPACING_PRESETS.chipGap,
  },
  moreCount: {
    // Quiet count, not a CTA: same secondary text token + chipLabel size as the
    // rest of the row so it reads as a footnote, not an action.
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    color: SURFACE_TOKENS.textSecondary,
  },
  helperBlock: {
    rowGap: SPACING_PRESETS.compactRowGap,
    paddingTop: SPACING.xs,
  },
  helperLine: {
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    color: SURFACE_TOKENS.textSecondary,
  },
});
