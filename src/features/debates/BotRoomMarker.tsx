/**
 * GAME-008 — Bot room marker.
 *
 * Read-time, presentation-only RN component — renders the non-alarming
 * room-level "test room" affordance for the gallery card + in-room header.
 * Pure presentation over a `BotMarkingViewModel`. Renders NOTHING when the
 * room has no bot at all (`roomMarkerLabel === ''`).
 *
 * Doctrine:
 *  - The marker describes the ROOM as a test surface ("Test room" /
 *    "Bot-seeded test room"), never a verdict, never alarming. Copy comes
 *    from `BOT_MARKER_COPY` via the model — this component authors no copy.
 *  - The marker is identified by SHAPE + the literal words, not color
 *    alone — color-independence (accessibility-targets).
 *  - The marker is informational, NOT interactive — no `Pressable`, so the
 *    44px tap-target rule does not apply (a future tappable "test rooms
 *    only" filter card must add `hitSlop`).
 *  - Every visible string is inside a <Text>; the marker root carries a
 *    verbose `accessibilityLabel`.
 *  - `context` only tweaks density — it never changes the copy.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BotMarkingViewModel } from './botRoomPolicyModel';
import { BOT_MARKER_COPY } from '../arguments/gameCopy';

interface BotRoomMarkerProps {
  viewModel: BotMarkingViewModel;
  /** 'gallery' tweaks density for the card; 'room' for the room header. */
  context: 'gallery' | 'room';
}

export function BotRoomMarker({ viewModel, context }: BotRoomMarkerProps) {
  // No bot anywhere in the room => no marker (fail-safe-human).
  if (viewModel.roomMarkerLabel.length === 0) return null;

  const isGallery = context === 'gallery';

  return (
    <View
      style={[styles.marker, isGallery ? styles.markerGallery : styles.markerRoom]}
      accessibilityLabel={viewModel.roomAccessibilityLabel}
      testID={`bot-room-marker-${context}`}
    >
      <View style={styles.markerHeaderRow}>
        {/* A small shape glyph — recognisable in grayscale, not color-only. */}
        <Text style={styles.markerGlyph} accessibilityElementsHidden>
          ◇
        </Text>
        <Text style={styles.markerLabel}>{viewModel.roomMarkerLabel}</Text>
      </View>
      {/*
        On the gallery card, a short helper line explains the marker. The
        in-room header keeps it tight — the a11y label carries the detail.
      */}
      {isGallery && viewModel.isBotSeededRoom ? (
        <Text style={styles.markerHelper}>{BOT_MARKER_COPY.gallery_helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    // Dashed border — a shape signal for "test surface", legible without color.
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    backgroundColor: '#f1f5f9',
  },
  markerGallery: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 3,
  },
  markerRoom: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  markerHelper: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
  },
});
