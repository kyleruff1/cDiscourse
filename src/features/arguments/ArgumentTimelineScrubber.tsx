/**
 * Stage 6.1.8 — ArgumentTimelineScrubber
 *
 * Horizontal DAW/sleep-map-style scrubber. One marker per message in
 * chronological order. Beginning / middle / end timestamps render
 * underneath the rail. Markers are color-coded by actor (self vs other vs
 * bot vs admin). The active marker is enlarged and outlined.
 *
 * Never collapses into a vertical thread.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ArgumentTimelineSegment } from './argumentGameSurface';

interface Props {
  segments: ArgumentTimelineSegment[];
  onActivate: (messageId: string) => void;
  onToggleMode?: () => void;
}

function actorTone(actor: ArgumentTimelineSegment['actor']): string {
  switch (actor) {
    case 'self': return '#22d3ee';
    case 'other': return '#818cf8';
    case 'bot': return '#a855f7';
    case 'admin': return '#facc15';
    default: return '#475569';
  }
}

export function ArgumentTimelineScrubber({ segments, onActivate, onToggleMode }: Props) {
  if (!segments || segments.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Timeline appears here once any argument is posted.</Text>
      </View>
    );
  }

  const first = segments[0];
  const last = segments[segments.length - 1];
  const middleIdx = Math.floor((segments.length - 1) / 2);
  const middle = segments[middleIdx];

  return (
    <View style={styles.container} accessibilityLabel="argument-timeline-scrubber" testID="argument-timeline-scrubber">
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Timeline</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch to stack mode"
          style={styles.modeBtn}
          onPress={() => onToggleMode?.()}
          testID="timeline-toggle-mode"
        >
          <Text style={styles.modeBtnText}>↕ Stack</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        accessibilityLabel="argument-timeline-rail"
      >
        <View style={styles.rail} accessibilityRole="adjustable">
          {segments.map((seg) => (
            <Pressable
              key={seg.messageId}
              style={[styles.marker, seg.isActive && styles.markerActive]}
              onPress={() => onActivate(seg.messageId)}
              accessibilityRole="button"
              accessibilityLabel={seg.accessibilityLabel}
              accessibilityState={{ selected: seg.isActive }}
              testID={`timeline-marker-${seg.messageId}`}
            >
              <View style={[styles.markerDot, { backgroundColor: actorTone(seg.actor) }]} />
              <Text style={[styles.markerKind, seg.isActive && styles.markerKindActive]} numberOfLines={1}>
                {seg.kindLabel}
              </Text>
              <Text style={styles.markerOrdinal}>#{seg.ordinal}</Text>
              {seg.badges.length > 0 && (
                <Text style={styles.markerBadges} numberOfLines={1}>
                  {seg.badges.slice(0, 2).join(' · ')}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>Beginning</Text>
          <Text style={styles.timeAbsolute}>{first.createdAtLabel}</Text>
          <Text style={styles.timeRelative}>{first.relativeLabel}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>Middle</Text>
          <Text style={styles.timeAbsolute}>{middle.createdAtLabel}</Text>
          <Text style={styles.timeRelative}>{middle.relativeLabel}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>End</Text>
          <Text style={styles.timeAbsolute}>{last.createdAtLabel}</Text>
          <Text style={styles.timeRelative}>{last.relativeLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0b1220', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, borderRadius: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLabel: { color: '#e2e8f0', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  modeBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minHeight: 32 },
  modeBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  railContent: { paddingVertical: 6 },
  rail: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 64 },
  marker: {
    width: 86,
    minHeight: 56,
    backgroundColor: '#111c39',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  markerActive: { borderColor: '#818cf8', backgroundColor: '#1e1b4b' },
  markerDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  markerKind: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  markerKindActive: { color: '#e0e7ff' },
  markerOrdinal: { color: '#64748b', fontSize: 10 },
  markerBadges: { color: '#94a3b8', fontSize: 9, marginTop: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 6 },
  timeBlock: { alignItems: 'flex-start' },
  timeLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.6 },
  timeAbsolute: { color: '#e2e8f0', fontSize: 11, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  timeRelative: { color: '#94a3b8', fontSize: 10 },
  empty: { padding: 16, backgroundColor: '#0b1220', borderRadius: 14 },
  emptyText: { color: '#94a3b8', fontSize: 12 },
});
