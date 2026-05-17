/**
 * Stage 6.2 — ArgumentTimelineMap (Milestone 4).
 *
 * Horizontally scrollable graphical map of the conversation.
 *   - One node per message, earliest left → latest right.
 *   - Visible parent-child connectors (segmented gradient).
 *   - Active node ring + glow.
 *   - Junction markers ("3 routes").
 *   - Detached markers.
 *   - High-level bands above the rail (Opening / First clash / etc.).
 *   - Beginning / middle / end timestamp legend.
 *   - Prev / Next / Latest controls.
 *   - Compact color legend.
 *
 * No new dependencies. Edges are rendered as 6-segment gradient strips
 * built from <View>s so we never need react-native-svg.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  mixHex,
  TIMELINE_NODE_SIZE,
  TIMELINE_KIND_COLORS,
  type ArgumentTimelineMapEdge,
  type ArgumentTimelineMapModel,
  type ArgumentTimelineMapNode,
} from './argumentGameSurfaceModel';

interface Props {
  map: ArgumentTimelineMapModel;
  onActivate: (messageId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpLatest: () => void;
  onToggleMode?: () => void;
}

const RAIL_THICKNESS = 4;
const EDGE_SEGMENTS = 6;

function EdgeStrip({ edge }: { edge: ArgumentTimelineMapEdge }) {
  // 6 segments, each colored by interpolating along edge.gradientStops.
  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;
  const length = Math.max(2, Math.sqrt(dx * dx + dy * dy));
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const segmentLen = length / EDGE_SEGMENTS;
  const stops = edge.gradientStops;
  const segs = Array.from({ length: EDGE_SEGMENTS }, (_, i) => {
    const t = i / Math.max(1, EDGE_SEGMENTS - 1);
    const idx = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
    const localT = t * (stops.length - 1) - idx;
    return mixHex(stops[idx], stops[idx + 1], localT);
  });
  return (
    <View
      pointerEvents="none"
      testID={`timeline-edge-${edge.fromMessageId}-${edge.toMessageId}`}
      style={{
        position: 'absolute',
        left: edge.x1 + TIMELINE_NODE_SIZE / 2,
        top: edge.y1 + TIMELINE_NODE_SIZE / 2 - RAIL_THICKNESS / 2,
        width: length,
        height: RAIL_THICKNESS,
        transform: [{ rotateZ: `${angle}deg` }],
        transformOrigin: '0% 50%',
        flexDirection: 'row',
        opacity: edge.isActivePath ? 1 : 0.55,
        borderRadius: RAIL_THICKNESS,
        overflow: 'hidden',
      } as object}
    >
      {segs.map((c, i) => (
        <View key={`${edge.edgeId}-seg-${i}`} style={{ width: segmentLen, height: RAIL_THICKNESS, backgroundColor: c }} />
      ))}
    </View>
  );
}

function NodeDot({
  node,
  onActivate,
}: {
  node: ArgumentTimelineMapNode;
  onActivate: (id: string) => void;
}) {
  const ring = node.isActive ? styles.nodeRingActive : node.isLatest ? styles.nodeRingLatest : null;
  return (
    <View
      style={[styles.nodeWrap, { left: node.x, top: node.y }]}
      testID={`timeline-node-${node.messageId}`}
    >
      {ring ? <View style={[styles.nodeRing, ring]} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={node.accessibilityLabel}
        accessibilityState={{ selected: node.isActive }}
        onPress={() => onActivate(node.messageId)}
        style={[
          styles.node,
          { backgroundColor: node.kindColor },
          node.isActive && styles.nodeActive,
          node.isDetached && styles.nodeDetached,
        ]}
      >
        <Text style={styles.nodeOrdinal} numberOfLines={1}>{node.ordinal}</Text>
      </Pressable>
      {node.isJunction ? (
        <View testID={`timeline-junction-${node.messageId}`} style={styles.junctionPill}>
          <Text style={styles.junctionPillText}>{node.junctionChildCount} routes</Text>
        </View>
      ) : null}
      {node.isDetached ? (
        <View style={styles.detachedPill}>
          <Text style={styles.detachedPillText}>detached</Text>
        </View>
      ) : null}
      {node.droppedTags.length > 0 ? (
        <View style={styles.chipRow} accessibilityLabel="dropped-tags">
          {node.droppedTags.slice(0, 3).map((t) => (
            <View key={`${node.messageId}-tag-${t.code}`} style={[styles.chip, { backgroundColor: t.color }]}>
              <Text style={styles.chipText} numberOfLines={1}>{t.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ArgumentTimelineMap({ map, onActivate, onPrev, onNext, onJumpLatest, onToggleMode }: Props) {
  const scrollRef = useRef<ScrollView | null>(null);

  // Auto-scroll toward the active node.
  useEffect(() => {
    if (!scrollRef.current || !map.activeNode) return;
    const x = Math.max(0, map.activeNode.x - 120);
    try {
      scrollRef.current.scrollTo({ x, animated: true });
    } catch { /* swallow — not all platforms support imperative scroll */ }
  }, [map.activeNode]);

  const handleJumpLatest = useCallback(() => onJumpLatest(), [onJumpLatest]);

  if (map.nodes.length === 0) {
    return (
      <View style={styles.empty} testID="argument-timeline-map">
        <Text style={styles.emptyText}>Timeline appears once any argument is posted.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="argument-timeline-map">
      <View style={styles.controlsRow}>
        <Pressable
          style={styles.controlChip}
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel="Previous message"
          testID="timeline-prev"
        >
          <Text style={styles.controlChipText}>‹ Prev</Text>
        </Pressable>
        <Pressable
          style={styles.controlChip}
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="Next message"
          testID="timeline-next"
        >
          <Text style={styles.controlChipText}>Next ›</Text>
        </Pressable>
        <Pressable
          style={[styles.controlChip, styles.controlChipPrimary]}
          onPress={handleJumpLatest}
          accessibilityRole="button"
          accessibilityLabel="Jump to latest message"
          testID="timeline-jump-latest"
        >
          <Text style={styles.controlChipText}>Latest ⏭</Text>
        </Pressable>
        {onToggleMode ? (
          <Pressable
            style={styles.controlChip}
            onPress={onToggleMode}
            accessibilityRole="button"
            accessibilityLabel="Switch to stack mode"
            testID="timeline-toggle-mode"
          >
            <Text style={styles.controlChipText}>Stack ↺</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator
        style={styles.scroll}
        contentContainerStyle={{ width: map.scrollWidth, minHeight: map.height }}
        accessibilityLabel="timeline-map-scroll"
      >
        <View style={{ width: map.scrollWidth, height: map.height }}>
          {/* Center rail */}
          <View style={[styles.rail, { width: map.scrollWidth - 32, top: 120 + TIMELINE_NODE_SIZE / 2 - 1 }]} />

          {/* Bands */}
          {map.bands.map((band) => (
            <View
              key={band.bandId}
              testID={`timeline-band-${band.bandId}`}
              style={{
                position: 'absolute',
                left: band.xStart,
                top: 8,
                width: Math.max(60, band.xEnd - band.xStart + TIMELINE_NODE_SIZE),
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: '#1e293b',
                borderWidth: 1,
                borderColor: '#334155',
              }}
            >
              <Text style={styles.bandLabel} numberOfLines={1}>
                {band.label} · {band.messageCount}
              </Text>
            </View>
          ))}

          {/* Edges */}
          {map.edges.map((e) => <EdgeStrip key={e.edgeId} edge={e} />)}

          {/* Nodes */}
          {map.nodes.map((n) => <NodeDot key={n.messageId} node={n} onActivate={onActivate} />)}
        </View>
      </ScrollView>

      <View style={styles.legendRow}>
        <Text style={styles.timestampLabel} numberOfLines={1}>{map.beginningLabel}</Text>
        <Text style={styles.timestampLabel} numberOfLines={1}>{map.middleLabel}</Text>
        <Text style={styles.timestampLabel} numberOfLines={1}>{map.endLabel}</Text>
      </View>

      <View style={styles.legendChips}>
        {map.legend.map((entry) => (
          <View key={`legend-${entry.family}`} style={styles.legendChip} accessibilityLabel={`legend-${entry.family}`}>
            <View style={[styles.legendDot, { backgroundColor: entry.color }]} />
            <Text style={styles.legendText}>{entry.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#020617' },
  scroll: { backgroundColor: '#020617', minHeight: 240 },
  empty: { padding: 24, alignItems: 'center', backgroundColor: '#020617' },
  emptyText: { color: '#64748b' },
  rail: {
    position: 'absolute',
    left: 16,
    height: RAIL_THICKNESS,
    backgroundColor: '#1f2937',
    borderRadius: RAIL_THICKNESS,
  },
  nodeWrap: { position: 'absolute', alignItems: 'center' },
  nodeRing: { position: 'absolute', width: TIMELINE_NODE_SIZE + 14, height: TIMELINE_NODE_SIZE + 14, top: -7, left: -7, borderRadius: (TIMELINE_NODE_SIZE + 14) / 2 },
  nodeRingActive: { backgroundColor: 'rgba(99,102,241,0.25)', borderWidth: 2, borderColor: '#a5b4fc' },
  nodeRingLatest: { borderWidth: 2, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.12)' },
  node: {
    width: TIMELINE_NODE_SIZE,
    height: TIMELINE_NODE_SIZE,
    borderRadius: TIMELINE_NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  nodeActive: { borderColor: '#f8fafc', borderWidth: 2 },
  nodeDetached: { backgroundColor: '#475569', borderStyle: 'dashed' as const },
  nodeOrdinal: { color: '#0b1220', fontWeight: '800', fontSize: 13 },
  junctionPill: { marginTop: 4, backgroundColor: '#a855f7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  junctionPillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  detachedPill: { marginTop: 4, backgroundColor: '#475569', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  detachedPillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: 2, marginTop: 4, maxWidth: TIMELINE_NODE_SIZE + 36 },
  chip: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6 },
  chipText: { color: '#0b1220', fontWeight: '700', fontSize: 8 },
  controlsRow: { flexDirection: 'row', gap: 6, padding: 8, alignItems: 'center', backgroundColor: '#0b1220', borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  controlChip: { backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, minHeight: 28 },
  controlChipPrimary: { backgroundColor: '#312e81' },
  controlChipText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 },
  timestampLabel: { color: '#64748b', fontSize: 10 },
  bandLabel: { color: '#cbd5e1', fontSize: 10, fontWeight: '700' },
  legendChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8 },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0b1220', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#94a3b8', fontSize: 10 },
});

// keep TIMELINE_KIND_COLORS imported so accidental tree-shaking doesn't break tests.
void TIMELINE_KIND_COLORS;
