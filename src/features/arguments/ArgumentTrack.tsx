/**
 * Single lane/track within the timeline view.
 * Renders a labeled section with its argument nodes.
 * Stage 6.1.0
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArgumentTimelineNode } from './ArgumentTimelineNode';
import type { ArgumentTimelineItem, ArgumentTrackKind } from './argumentTimeline';
import { TRACK_LANE_LABELS } from './argumentTimeline';

interface Props {
  kind: ArgumentTrackKind;
  items: ArgumentTimelineItem[];
  defaultExpanded?: boolean;
  onSelectArgument?: (argumentId: string) => void;
}

const TRACK_ACCENT: Record<ArgumentTrackKind, string> = {
  core: '#6366f1',
  counter: '#ef4444',
  receipts: '#10b981',
  clarification: '#f59e0b',
  concession: '#8b5cf6',
  tangent: '#6b7280',
};

export function ArgumentTrack({ kind, items, defaultExpanded = true, onSelectArgument }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (items.length === 0) return null;

  const accent = TRACK_ACCENT[kind];
  const label = TRACK_LANE_LABELS[kind];

  return (
    <View
      style={styles.track}
      accessibilityLabel={`timeline-${kind}-lane`}
    >
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label} track — ${items.length} item${items.length !== 1 ? 's' : ''}`}
      >
        <View style={[styles.accent, { backgroundColor: accent }]} />
        <Text style={styles.headerLabel}>{label}</Text>
        <Text style={styles.count}>{items.length}</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.nodes}>
          {items.map((item) => (
            <ArgumentTimelineNode
              key={item.argumentId}
              item={item}
              onPress={onSelectArgument}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    gap: 8,
  },
  accent: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  headerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  count: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  chevron: {
    fontSize: 10,
    color: '#9ca3af',
  },
  nodes: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
});
