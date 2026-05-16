/**
 * Timeline/track view for an argument room.
 * Wraps the existing ArgumentTreeScreen as an alternate view.
 * Users can toggle between tree and timeline.
 * Stage 6.1.0
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArgumentTrack } from './ArgumentTrack';
import {
  buildArgumentTimeline,
  getTimelineLanes,
  TRACK_LANE_ORDER,
} from './argumentTimeline';
import type { ArgumentCache } from './types';
import { TIMELINE_COPY } from './gameCopy';

interface Props {
  cache: ArgumentCache;
  selectedArgumentId?: string | null;
  focusedArgumentId?: string | null;
  onSelectArgument?: (argumentId: string) => void;
}

export function ArgumentTimelineScreen({
  cache,
  selectedArgumentId,
  focusedArgumentId,
  onSelectArgument,
}: Props) {
  const [showAllLanes, setShowAllLanes] = useState(false);

  const items = useMemo(
    () =>
      buildArgumentTimeline({
        cache,
        selectedArgumentId,
        focusedArgumentId,
      }),
    [cache, selectedArgumentId, focusedArgumentId],
  );

  const lanes = useMemo(() => getTimelineLanes(items), [items]);

  const totalItems = items.length;

  if (totalItems === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{TIMELINE_COPY.noArguments}</Text>
      </View>
    );
  }

  const visibleLanes = showAllLanes
    ? TRACK_LANE_ORDER
    : TRACK_LANE_ORDER.filter((k) => lanes[k].length > 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      accessibilityLabel="Argument timeline"
    >
      <View style={styles.controls}>
        <Text style={styles.controlsLabel}>
          {totalItems} move{totalItems !== 1 ? 's' : ''}
        </Text>
        <Pressable
          onPress={() => setShowAllLanes((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showAllLanes ? 'Show active lanes only' : 'Show all lanes'}
        >
          <Text style={styles.toggleBtn}>
            {showAllLanes ? 'Active lanes only' : 'All lanes'}
          </Text>
        </Pressable>
      </View>

      {visibleLanes.map((kind) => (
        <ArgumentTrack
          key={kind}
          kind={kind}
          items={lanes[kind]}
          defaultExpanded={kind === 'core' || kind === 'counter'}
          onSelectArgument={onSelectArgument}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 12 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlsLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  toggleBtn: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
});
