import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Debate, ParticipantSide } from './types';
import { RoomContractSeatStrip } from './RoomContractSeatStrip';
import type { RoomContractViewModel } from './roomContractModel';

interface Props {
  debate: Debate;
  participantSide: ParticipantSide | string | null;
  onLeave: () => void;
  /**
   * GAME-004 — the derived 1v1 room contract projection. Optional: when
   * absent the header renders exactly as before (zero behavior change for any
   * caller that does not pass it).
   */
  roomContract?: RoomContractViewModel;
}

const SIDE_COLORS: Record<string, { bg: string; text: string }> = {
  affirmative: { bg: '#dcfce7', text: '#166534' },
  negative: { bg: '#fee2e2', text: '#991b1b' },
  observer: { bg: '#f3f4f6', text: '#374151' },
  moderator: { bg: '#ede9fe', text: '#5b21b6' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#d1fae5', text: '#065f46' },
  draft: { bg: '#fef3c7', text: '#92400e' },
  locked: { bg: '#fee2e2', text: '#991b1b' },
  archived: { bg: '#f3f4f6', text: '#6b7280' },
};

export function DebateDetailHeader({ debate, participantSide, onLeave, roomContract }: Props) {
  const sideColor = participantSide ? (SIDE_COLORS[participantSide] ?? SIDE_COLORS.observer) : null;
  const statusColor = STATUS_COLORS[debate.status] ?? STATUS_COLORS.open;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.badgeText, { color: statusColor.text }]}>
              {debate.status.toUpperCase()}
            </Text>
          </View>
          {sideColor && participantSide ? (
            <View style={[styles.badge, { backgroundColor: sideColor.bg }]}>
              <Text style={[styles.badgeText, { color: sideColor.text }]}>
                {participantSide.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={onLeave}
          style={styles.leaveButton}
          accessibilityRole="button"
          accessibilityLabel="Leave debate"
        >
          <Text style={styles.leaveText}>Leave</Text>
        </Pressable>
      </View>
      <Text style={styles.title} numberOfLines={2}>{debate.title}</Text>
      <Text style={styles.resolution} numberOfLines={3}>{debate.resolution}</Text>
      {/* GAME-004 — 1v1 PvP seat strip. Renders only when the contract
          projection is supplied; absent → header is unchanged. */}
      {roomContract ? <RoomContractSeatStrip viewModel={roomContract} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  meta: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  leaveButton: { paddingHorizontal: 12, paddingVertical: 6 },
  leaveText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  resolution: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
});
