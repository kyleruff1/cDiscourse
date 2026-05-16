/**
 * Compact node card for the timeline/track view.
 * Stage 6.1.0
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ArgumentTimelineItem, ArgumentTrackKind } from './argumentTimeline';

interface Props {
  item: ArgumentTimelineItem;
  onPress?: (argumentId: string) => void;
}

const TRACK_COLORS: Record<ArgumentTrackKind, string> = {
  core: '#6366f1',
  counter: '#ef4444',
  receipts: '#10b981',
  clarification: '#f59e0b',
  concession: '#8b5cf6',
  tangent: '#6b7280',
};

export function ArgumentTimelineNode({ item, onPress }: Props) {
  const color = TRACK_COLORS[item.trackKind];

  return (
    <Pressable
      style={[
        styles.card,
        item.isSelected && styles.cardSelected,
        { borderLeftColor: color },
      ]}
      onPress={() => onPress?.(item.argumentId)}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.isSelected }}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.label} numberOfLines={2}>
          {item.label}
        </Text>
        {item.isBranchRecommended && (
          <Text style={styles.branchBadge}>Branch</Text>
        )}
      </View>
      {item.isSelected && (
        <Text style={styles.statusText}>{item.status}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    marginVertical: 3,
    marginHorizontal: 4,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: '#f0f0ff',
    shadowOpacity: 0.12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
  },
  branchBadge: {
    fontSize: 10,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusText: {
    marginTop: 4,
    fontSize: 11,
    color: '#6b7280',
  },
});
