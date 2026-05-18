/**
 * Stage 6.3 — ConversationMiniTimeline
 *
 * Compact horizontal rail for a Conversation Gallery card. One dot per
 * posted move, all on the SAME y position (no diagonal scatter). Bands
 * are color-tinted underlays behind the relevant dot range.
 *
 * No React Native animation deps. Pure View primitives.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ConversationTimelinePreviewSegment } from './conversationGalleryModel';

/**
 * Pure helper: groups contiguous segments by their `bandHighlight` so the
 * UI can render a single tinted underlay per run. Exported for tests.
 */
export interface MiniTimelineBandRun {
  startIdx: number;
  endIdx: number;
  kind: NonNullable<ConversationTimelinePreviewSegment['bandHighlight']>;
}
export function groupSegmentsIntoBands(segments: ConversationTimelinePreviewSegment[]): MiniTimelineBandRun[] {
  const out: MiniTimelineBandRun[] = [];
  let cur: MiniTimelineBandRun | null = null;
  for (let i = 0; i < segments.length; i++) {
    const b = segments[i].bandHighlight;
    if (!b) { if (cur) { out.push(cur); cur = null; } continue; }
    if (!cur || cur.kind !== b) {
      if (cur) out.push(cur);
      cur = { startIdx: i, endIdx: i, kind: b };
    } else {
      cur.endIdx = i;
    }
  }
  if (cur) out.push(cur);
  return out;
}

interface Props {
  segments: ConversationTimelinePreviewSegment[];
  /** Optional unresolved marker — adds a small red flag at the trailing edge. */
  unresolved?: boolean;
  /** Optional resolved marker — adds a small purple star. */
  resolved?: boolean;
  /** Optional accessibility prefix (e.g., the room title). */
  accessibilityPrefix?: string;
  /** Optional override of the rendered height. Default 32px. */
  height?: number;
}

const BAND_COLOR: Record<string, string> = {
  first_clash: 'rgba(249,115,22,0.20)',
  evidence_run: 'rgba(6,182,212,0.20)',
  hot_zone: 'rgba(220,38,38,0.22)',
  source_chain_run: 'rgba(14,165,233,0.22)',
};

export function ConversationMiniTimeline({
  segments,
  unresolved,
  resolved,
  accessibilityPrefix,
  height = 32,
}: Props) {
  const total = segments.length;

  // Group contiguous band segments to draw a single tinted underlay per run.
  const bands = useMemo(() => groupSegmentsIntoBands(segments), [segments]);

  if (total === 0) {
    return (
      <View
        style={[styles.empty, { height }]}
        testID="conversation-mini-timeline-empty"
        accessibilityLabel={accessibilityPrefix ? `${accessibilityPrefix} — no moves yet` : 'no moves yet'}
      >
        <Text style={styles.emptyText}>No moves yet</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { height }]}
      testID="conversation-mini-timeline"
      accessibilityRole="image"
      accessibilityLabel={accessibilityPrefix
        ? `${accessibilityPrefix} — ${total} moves on a horizontal rail`
        : `${total} moves on a horizontal rail`}
    >
      {/* Center horizontal rail */}
      <View style={styles.rail} />

      {/* Band underlays — each band spans from its start to its end ordinal,
          all on the SAME horizontal baseline. */}
      {bands.map((b, idx) => {
        const startPct = (b.startIdx / Math.max(1, total - 1)) * 100;
        const endPct = (b.endIdx / Math.max(1, total - 1)) * 100;
        const widthPct = Math.max(2, endPct - startPct + 6);
        return (
          <View
            key={`band-${idx}-${b.kind}`}
            testID={`mini-band-${b.kind}-${idx}`}
            style={{
              position: 'absolute',
              left: `${startPct - 1}%`,
              top: '20%',
              height: '60%',
              width: `${widthPct}%`,
              backgroundColor: BAND_COLOR[b.kind] || 'rgba(148,163,184,0.18)',
              borderRadius: 4,
            }}
            accessibilityLabel={`band ${b.kind}`}
          />
        );
      })}

      {/* Dots — one per segment, evenly spaced on the rail */}
      {segments.map((s, i) => {
        const pct = total <= 1 ? 50 : (i / (total - 1)) * 100;
        const isLatest = s.isLatest || i === total - 1;
        return (
          <View
            key={`mini-dot-${i}`}
            testID={`mini-dot-${i}`}
            accessibilityLabel={`move ${s.ordinal} · ${s.kindFamily}${s.bandHighlight ? ' · ' + s.bandHighlight : ''}${isLatest ? ' · latest' : ''}`}
            style={[
              styles.dot,
              {
                left: `${pct}%`,
                backgroundColor: s.color,
                width: isLatest ? 10 : 7,
                height: isLatest ? 10 : 7,
                marginLeft: isLatest ? -5 : -3.5,
                marginTop: isLatest ? -5 : -3.5,
                borderWidth: isLatest ? 1.5 : 0,
                borderColor: '#f8fafc',
              },
            ]}
          />
        );
      })}

      {/* End-of-rail markers */}
      {unresolved ? (
        <View style={styles.unresolvedMarker} accessibilityLabel="unresolved" testID="mini-unresolved">
          <Text style={styles.unresolvedMarkerText}>!</Text>
        </View>
      ) : null}
      {resolved ? (
        <View style={styles.resolvedMarker} accessibilityLabel="resolved" testID="mini-resolved">
          <Text style={styles.resolvedMarkerText}>★</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', backgroundColor: '#0b1220', borderRadius: 6, paddingHorizontal: 8, justifyContent: 'center', overflow: 'hidden' },
  empty: { backgroundColor: '#0b1220', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#475569', fontSize: 10, fontStyle: 'italic' as const },
  rail: { position: 'absolute', left: 8, right: 8, top: '50%', height: 2, marginTop: -1, backgroundColor: '#1f2937', borderRadius: 2 },
  dot: { position: 'absolute', top: '50%', borderRadius: 999 },
  unresolvedMarker: { position: 'absolute', right: 4, top: '50%', marginTop: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  unresolvedMarkerText: { color: '#fff', fontSize: 10, fontWeight: '800' as const },
  resolvedMarker: { position: 'absolute', right: 4, top: '50%', marginTop: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#a855f7', alignItems: 'center', justifyContent: 'center' },
  resolvedMarkerText: { color: '#fff', fontSize: 10, fontWeight: '800' as const },
});
