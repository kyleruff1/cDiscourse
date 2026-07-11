/**
 * UX-FLAGS-002 — PointFeedbackFlagPill.
 *
 * A single calm feedback-flag pill for a point. Tone is carried by a glyph
 * PREFIX + a muted token fill + the accessibility label — never by color alone,
 * so a grayscale snapshot stays legible (three distinct glyphs: `+` / `?` / `·`).
 *
 * UX-FLAGS-004 (#836): the pill is inert (a `<View accessibilityRole="text">`)
 * exactly as UX-FLAGS-002 shipped it, UNLESS the parent passes BOTH an `onPress`
 * and `actionable === true` — then it renders a calm `<Pressable
 * accessibilityRole="button">` that keeps the same muted visual and adds only
 * role + hint + 44x44 hitSlop + a web focus ring. No color-only CTA, no chevron.
 *
 * Doctrine: Family D (`neverGrantsStanding`) pills keep their descriptor tone
 * and add NO strength/credit/score glyph or color; the "receipt/source help"
 * framing lives only in the accessibility label (built by the adapter) and the
 * #850-authored helper. RN primitives only; existing design tokens only.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  FOCUS_RING,
  RADIUS,
  SPACING,
  STATUS,
  SURFACE_TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../../lib/designTokens';
import type { PointFeedbackFlagViewModel } from './pointFeedbackFlagsModel';
import type { FriendlyFlagTone } from './friendlyFlagMap';

export interface PointFeedbackFlagPillProps {
  flag: PointFeedbackFlagViewModel;
  /** UX-FLAGS-004 — present only when the parent authorizes an actionable pill. */
  onPress?: (flagKey: string) => void;
  /** UX-FLAGS-004 — true iff flagIntentForKey(flag.id) != null (parent-computed). */
  actionable?: boolean;
  testID?: string;
}

/**
 * Tone → glyph prefix. Three DISTINCT glyphs so the grayscale snapshot carries
 * meaning without color: `+` (positive), `?` (a prompt / invitation to move
 * next), `·` (a neutral descriptive note).
 */
const TONE_GLYPH: Readonly<Record<FriendlyFlagTone, string>> = Object.freeze({
  positive: '+',
  prompt: '?',
  descriptive: '·',
});

export function PointFeedbackFlagPill({
  flag,
  onPress,
  actionable,
  testID,
}: PointFeedbackFlagPillProps): React.ReactElement {
  const glyph = TONE_GLYPH[flag.tone];
  const resolvedTestID = testID ?? `point-feedback-flag-${flag.id}`;

  // The visible content is identical in both arms — the actionable pill keeps
  // the SAME muted fill, glyph prefix, and label as the inert pill (calm, never
  // color-only, no chevron affordance). Only role / hint / hitSlop / focus ring
  // change.
  const inner = (
    <Text style={[styles.label, TONE_TEXT[flag.tone]]} numberOfLines={1}>
      <Text style={styles.glyph}>{glyph} </Text>
      {flag.label}
    </Text>
  );

  // UX-FLAGS-004 — actionable arm ONLY when the parent authorizes the affordance
  // (onPress present) AND the flag resolves to a composer intent (actionable
  // true, parent-computed). A stray onPress without actionable never becomes a
  // button, so a non-actionable pill stays inert. Flag off / observer / own move
  // / non-actionable => this branch is skipped and the shipped inert View below
  // renders byte-identical to today.
  if (typeof onPress === 'function' && actionable === true) {
    return (
      <Pressable
        onPress={() => onPress(flag.id)}
        style={(state) => [
          styles.pill,
          TONE_STYLE[flag.tone],
          // Web keyboard focus ring on the actionable arm ONLY (reduce-motion
          // safe: width, no animation). `focused` is a react-native-web-only
          // state field the shared RN Pressable type does not declare, so read
          // it through a narrow local shape (same idiom as the row why-toggle).
          Platform.OS === 'web' && (state as { focused?: boolean }).focused
            ? styles.pillFocused
            : null,
        ]}
        testID={resolvedTestID}
        accessibilityRole="button"
        accessibilityLabel={flag.accessibilityLabel}
        // Names the RESULT, advisory: opening a draft is the user move, never a
        // claim that the machine flag is authoritative. No verdict / proof token.
        accessibilityHint="Opens a reply pre-filled with a suggested starting point you can edit before posting."
        // 44x44 clearance while the visual stays chip-sized (accessibility-targets).
        hitSlop={TOUCH_TARGET.hitSlopAll}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.pill, TONE_STYLE[flag.tone]]}
      testID={resolvedTestID}
      // Non-interactive: role "text" so the tone-word + label is spoken and the
      // tone is never color-only for a screen-reader user.
      accessibilityRole="text"
      accessibilityLabel={flag.accessibilityLabel}
    >
      {inner}
    </View>
  );
}

// ── Tone → style (muted fills; never alarm red/yellow) ────────────

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
  },
  // UX-FLAGS-004 — web keyboard focus ring for the actionable arm only. Same
  // FOCUS_RING preset the row why-toggle uses; width, not animation.
  pillFocused: {
    borderWidth: FOCUS_RING.widthPx,
    borderColor: FOCUS_RING.color,
  },
  label: {
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: TYPOGRAPHY.chipLabel.fontWeight,
  },
  // The glyph is intentionally the same weight/size as the label; its SHAPE is
  // the carrier, so it stays legible in grayscale.
  glyph: {
    fontWeight: '700',
  },
});

/** Fill styles per tone — all muted, none alarm red/yellow (doctrine calm). */
const TONE_STYLE: Readonly<Record<FriendlyFlagTone, object>> = Object.freeze({
  positive: { backgroundColor: STATUS.success.bg },
  // `prompt` invites the next move: an elevated surface + a hairline outline,
  // NOT warning-yellow.
  prompt: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SURFACE_TOKENS.inputBorder,
  },
  descriptive: { backgroundColor: STATUS.neutral.bg },
});

/** Foreground text color per tone. */
const TONE_TEXT: Readonly<Record<FriendlyFlagTone, object>> = Object.freeze({
  positive: { color: STATUS.success.fg },
  prompt: { color: SURFACE_TOKENS.textPrimary },
  descriptive: { color: STATUS.neutral.fg },
});
