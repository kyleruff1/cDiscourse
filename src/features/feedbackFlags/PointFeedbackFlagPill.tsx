/**
 * UX-FLAGS-002 — PointFeedbackFlagPill.
 *
 * A single calm, READ-ONLY feedback-flag pill for a point. Non-interactive by
 * default (no `onPress` in this card). Tone is carried by a glyph PREFIX + a
 * muted token fill + the accessibility label — never by color alone, so a
 * grayscale snapshot stays legible (three distinct glyphs: `+` / `?` / `·`).
 *
 * Doctrine: Family D (`neverGrantsStanding`) pills keep their descriptor tone
 * and add NO strength/credit/score glyph or color; the "receipt/source help"
 * framing lives only in the accessibility label (built by the adapter) and the
 * #850-authored helper. RN primitives only; existing design tokens only.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  RADIUS,
  SPACING,
  STATUS,
  SURFACE_TOKENS,
  TYPOGRAPHY,
} from '../../lib/designTokens';
import type { PointFeedbackFlagViewModel } from './pointFeedbackFlagsModel';
import type { FriendlyFlagTone } from './friendlyFlagMap';

export interface PointFeedbackFlagPillProps {
  flag: PointFeedbackFlagViewModel;
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
  testID,
}: PointFeedbackFlagPillProps): React.ReactElement {
  const glyph = TONE_GLYPH[flag.tone];
  return (
    <View
      style={[styles.pill, TONE_STYLE[flag.tone]]}
      testID={testID ?? `point-feedback-flag-${flag.id}`}
      // Non-interactive: role "text" so the tone-word + label is spoken and the
      // tone is never color-only for a screen-reader user.
      accessibilityRole="text"
      accessibilityLabel={flag.accessibilityLabel}
    >
      <Text style={[styles.label, TONE_TEXT[flag.tone]]} numberOfLines={1}>
        <Text style={styles.glyph}>{glyph} </Text>
        {flag.label}
      </Text>
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
