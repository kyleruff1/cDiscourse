/**
 * GAME-008 — Bot participant marker.
 *
 * Read-time, presentation-only RN component — renders the individual
 * "Test bot" marker on a bot participant in-room. Pure presentation over
 * ONE `BotParticipantMarking`. Renders NOTHING for a non-bot
 * (`marking.isBot === false`).
 *
 * Doctrine:
 *  - The marker describes the ACCOUNT TYPE ("Test bot"), never a verdict,
 *    never alarming, never a "this is a human" framing. Copy comes from
 *    `BOT_MARKER_COPY` via the model — this component authors no copy.
 *  - The marker is identified by SHAPE + the literal word "Test bot", not
 *    color alone — color-independence (accessibility-targets).
 *  - The marker is informational, NOT interactive — no `Pressable`, so the
 *    44px tap-target rule does not apply (a future tappable-filter card
 *    must add `hitSlop`).
 *  - Every visible string is inside a <Text>; the marker root carries a
 *    verbose `accessibilityLabel`.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BotParticipantMarking } from './botRoomPolicyModel';

interface BotParticipantMarkerProps {
  /**
   * One `BotParticipantMarking` from the view-model. Renders nothing when
   * `marking.isBot === false`.
   */
  marking: BotParticipantMarking;
}

export function BotParticipantMarker({ marking }: BotParticipantMarkerProps) {
  // The UI renders a marker ONLY for a positive bot hint (fail-safe-human).
  if (!marking.isBot) return null;

  return (
    <View
      style={styles.marker}
      accessibilityLabel={marking.accessibilityLabel}
      testID={`bot-participant-marker-${marking.userId}`}
    >
      {/* A small shape glyph — recognisable in grayscale, not color-only. */}
      <Text style={styles.markerGlyph} accessibilityElementsHidden>
        ◇
      </Text>
      <Text style={styles.markerLabel}>{marking.markerLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    // Dashed border — a shape signal for "test surface", legible without color.
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    backgroundColor: '#f1f5f9',
  },
  markerGlyph: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    lineHeight: 14,
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
});
