/**
 * GAME-002 — PacingChip.
 *
 * A small, non-interactive status display mounted in the COMPOSER-002 dock
 * header. It shows the participant where they stand under the room's pacing
 * rule: moves remaining today, and a live countdown to when they may next
 * send.
 *
 * Doctrine:
 *  - The chip is a STATUS display, not a button. It never disables the
 *    composer or the Post button — `canSendNow` only tints the chip.
 *  - All copy is plain language, built in `buildPacingChipViewModel`. This
 *    component renders the view model verbatim; it carries no business
 *    logic.
 *  - Color is supplementary: a non-color glyph (`⏳` for an active
 *    countdown, `•` for the remaining-count line) carries meaning so the
 *    chip stays legible in grayscale.
 *  - `remainingLabel` and `countdownLabel` render as separate `<Text>`
 *    children — never concatenated into one prose blob.
 *
 * Accessibility:
 *  - `accessibilityRole="text"` (it is not interactive — the 44×44
 *    tap-target rule does not apply because there is nothing to tap).
 *  - `accessibilityLiveRegion="polite"` so countdown / remaining-count
 *    updates are announced without being chatty.
 *  - `accessibilityLabel` is the one-line plain summary from the model.
 *
 * Reduce-motion: the chip has no decorative animation. The countdown text
 * updating is information, not motion, so it keeps ticking under
 * reduce-motion. `reduceMotionOverride` is threaded for consistency with
 * the rest of the dock but suppresses nothing here.
 */
import React, { type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PacingChipViewModel } from './pacingModel';

export interface PacingChipProps {
  /** Render-ready view model from `buildPacingChipViewModel`. */
  viewModel: PacingChipViewModel;
  /**
   * PR-001 effective reduce-motion, threaded from the dock. The chip has
   * no decorative animation, so this currently suppresses nothing — it is
   * accepted for consistency and forward-compatibility.
   */
  reduceMotionOverride?: boolean;
}

/** Non-color glyph for an active countdown line. */
const COUNTDOWN_GLYPH = '⏳';
/** Non-color glyph for the remaining-count line. */
const REMAINING_GLYPH = '•';

export function PacingChip({ viewModel }: PacingChipProps): ReactElement | null {
  if (!viewModel || viewModel.visible !== true) {
    return null;
  }

  const { remainingLabel, countdownLabel, accessibilityLabel, canSendNow } =
    viewModel;

  // Tone is supplementary: a countdown line tints amber, otherwise neutral.
  // The glyphs above carry the same information without color.
  const isWaiting = countdownLabel !== null || canSendNow === false;
  const containerStyle = [
    styles.container,
    isWaiting ? styles.containerWaiting : styles.containerReady,
  ];
  const textColor = isWaiting ? styles.textWaiting : styles.textReady;

  return (
    <View
      style={containerStyle}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibilityLabel}
      testID="pacing-chip"
    >
      {remainingLabel !== null ? (
        <Text style={[styles.line, textColor]} numberOfLines={1} testID="pacing-chip-remaining">
          {`${REMAINING_GLYPH} ${remainingLabel}`}
        </Text>
      ) : null}
      {countdownLabel !== null ? (
        <Text style={[styles.line, textColor]} numberOfLines={1} testID="pacing-chip-countdown">
          {`${COUNTDOWN_GLYPH} ${countdownLabel}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 1,
  },
  containerReady: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  containerWaiting: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  line: {
    fontSize: 11,
    fontWeight: '600',
  },
  textReady: {
    color: '#065f46',
  },
  textWaiting: {
    color: '#92400e',
  },
});
