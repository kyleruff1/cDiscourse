/**
 * GAME-004 — Room contract seat strip.
 *
 * Read-time, presentation-only RN component. Renders the two primary seats +
 * a room-type chip + the turn label as a single horizontal strip that wraps
 * on narrow screens. It is a thin layer over a pure `RoomContractViewModel` —
 * no state, no network, no write path.
 *
 * Doctrine:
 *  - Seat pills show ROLES relative to the viewer ('You' / 'Initiator' /
 *    'Opponent' / 'Open seat …'), never a person's name, never a verdict word.
 *  - The room-type chip carries a shape/text glyph, NOT color alone
 *    (color-independence — accessibility-targets).
 *  - Heat / standing are not seat properties; the strip renders no score.
 *  - The strip is informational (no Pressable), so the 44px tap-target rule
 *    does not apply. Every visible string is inside a <Text>.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ROOM_CONTRACT_COPY, type RoomContractViewModel } from './roomContractModel';

interface RoomContractSeatStripProps {
  viewModel: RoomContractViewModel;
}

/**
 * Pure helper — the non-color glyph that marks the room-type chip. A lock for
 * a private 1:1, an open circle for a public 1:1. Shape/text carries the
 * meaning so the chip reads correctly without color.
 *
 * UX-ROOM-1V1-CHIMEIN-001A — compares against `ROOM_CONTRACT_COPY.privateRoom`
 * (the source of truth) rather than a hard-coded literal, so a future relabel
 * of the room-type copy cannot silently break the private glyph.
 */
export function roomTypeGlyph(roomTypeLabel: string): string {
  return roomTypeLabel === ROOM_CONTRACT_COPY.privateRoom ? '\u{1F512}' : '○';
}

export function RoomContractSeatStrip({ viewModel }: RoomContractSeatStripProps) {
  const { roomTypeLabel, initiatorSeat, opponentSeat, turnLabel } = viewModel;
  const glyph = roomTypeGlyph(roomTypeLabel);

  return (
    <View
      style={styles.strip}
      accessibilityLabel={viewModel.accessibilityLabel}
      testID="room-contract-seat-strip"
    >
      {/* Room-type chip — shape/text glyph, not color alone. */}
      <View style={styles.roomTypeChip} testID="room-contract-room-type">
        <Text style={styles.roomTypeGlyph} accessibilityElementsHidden>
          {glyph}
        </Text>
        <Text style={styles.roomTypeText}>{roomTypeLabel}</Text>
      </View>

      {/* Initiator seat pill. */}
      <View
        style={[styles.seatPill, initiatorSeat.isViewer && styles.seatPillViewer]}
        testID="room-contract-initiator-seat"
      >
        <Text
          style={[styles.seatText, initiatorSeat.isViewer && styles.seatTextViewer]}
        >
          {initiatorSeat.label}
        </Text>
      </View>

      {/* vs separator. */}
      <Text style={styles.vsSeparator} accessibilityElementsHidden>
        vs
      </Text>

      {/* Primary Opponent seat pill. */}
      <View
        style={[
          styles.seatPill,
          opponentSeat.isViewer && styles.seatPillViewer,
          opponentSeat.isOpen && styles.seatPillOpen,
        ]}
        testID="room-contract-opponent-seat"
      >
        <Text
          style={[
            styles.seatText,
            opponentSeat.isViewer && styles.seatTextViewer,
            opponentSeat.isOpen && styles.seatTextOpen,
          ]}
        >
          {opponentSeat.label}
        </Text>
      </View>

      {/* Turn label — only rendered when the model resolved one. */}
      {turnLabel !== null ? (
        <View style={styles.turnChip} testID="room-contract-turn">
          <Text style={styles.turnText}>{turnLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  roomTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  roomTypeGlyph: { fontSize: 11 },
  roomTypeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  seatPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  seatPillViewer: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  seatPillOpen: {
    borderStyle: 'dashed',
    borderColor: '#9ca3af',
    backgroundColor: '#f9fafb',
  },
  seatText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  seatTextViewer: { color: '#1d4ed8' },
  seatTextOpen: { fontWeight: '600', color: '#6b7280' },
  vsSeparator: { fontSize: 11, fontWeight: '600', color: '#9ca3af' },
  turnChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#fef3c7',
  },
  turnText: { fontSize: 11, fontWeight: '600', color: '#92400e' },
});
