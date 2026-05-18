/**
 * Stage 6.2 — ArgumentScoreTracker (Milestone 6 UI).
 *
 * Compact game-scoreboard readout that sits above the timeline map.
 * NEVER renders winner / loser / truth verdicts. Frames the bands
 * as gameplay analysis, not objective truth.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  standingBandColor,
  type ParticipantTrend,
} from './argumentScoreModel';
import { formatStandingBandShort } from './standingBandCopy';

interface Props {
  trends: ParticipantTrend[];
}

function dirArrow(direction: ParticipantTrend['trendDirection']): string {
  switch (direction) {
    case 'up': return '▲';
    case 'down': return '▼';
    case 'flat': return '→';
    default: return '·';
  }
}

export function ArgumentScoreTracker({ trends }: Props) {
  if (trends.length === 0) {
    return (
      <View style={styles.root} testID="argument-score-tracker">
        <Text style={styles.note}>Score tracker appears once messages exist.</Text>
      </View>
    );
  }
  return (
    <View style={styles.root} testID="argument-score-tracker">
      <Text style={styles.title} accessibilityLabel="score-tracker-title">Standings · gameplay analysis</Text>
      <View style={styles.row}>
        {trends.map((t) => {
          const color = standingBandColor(t.currentBand);
          return (
            <View
              key={`trend-${t.participantId}`}
              testID={`participant-trend-${t.participantId}`}
              style={styles.card}
            >
              <View style={[styles.colorBar, { backgroundColor: color }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.actor} numberOfLines={1}>{t.participantLabel}</Text>
                  <Text style={styles.count}>· {t.messageCount}</Text>
                </View>
                <Text style={[styles.band, { color }]} numberOfLines={1}>{formatStandingBandShort(t.currentBand)}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.arrow}>{dirArrow(t.trendDirection)}</Text>
                  <Text style={styles.meta} numberOfLines={1}>last: {t.lastMoveLabel}</Text>
                </View>
                <View style={styles.sparkRow} accessibilityLabel={`sparkline ${t.sparkline.length}`}>
                  {t.sparkline.map((s, i) => {
                    const h = Math.max(2, Math.round((s + 1) * 6));
                    const c = s >= 0.4 ? '#10b981' : s >= 0 ? '#22d3ee' : s >= -0.4 ? '#f97316' : '#b91c1c';
                    return <View key={`spark-${t.participantId}-${i}`} style={[styles.sparkBar, { height: h, backgroundColor: c }]} />;
                  })}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#0b1220', padding: 8, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  title: { color: '#94a3b8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' as const, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden', minWidth: 160, flexGrow: 1 },
  colorBar: { width: 4 },
  cardBody: { padding: 8, flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  actor: { color: '#f8fafc', fontWeight: '800', fontSize: 12 },
  count: { color: '#64748b', fontSize: 11 },
  band: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  arrow: { color: '#a5b4fc', fontSize: 12, fontWeight: '800' },
  meta: { color: '#94a3b8', fontSize: 11 },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, marginTop: 4, height: 14 },
  sparkBar: { width: 4, borderRadius: 2 },
  note: { color: '#64748b', fontSize: 12, padding: 8 },
});
