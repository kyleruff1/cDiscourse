/**
 * Stage 6.2 — ArgumentScoreTracker (Milestone 6 UI).
 *
 * UX-ROOM-CHROME-001 — compact mediator-readout strip that sits above
 * the timeline map. It reports each participant's current point
 * standing band + trend; the visible title is "Mediator readout" (the
 * prior "Where the points stand · gameplay analysis" framing is
 * retired so the room reads as a neutral mediator surface, not a game
 * scoreboard). NEVER renders winner / loser / truth verdicts. The
 * standing bands describe a point's standing in the conversation, not
 * objective truth. Component name + model are intentionally unchanged
 * (rename deferred).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  standingBandColor,
  STANDING_BAND_COLOR,
  type ParticipantTrend,
} from './argumentScoreModel';
import { formatStandingBandShort } from './standingBandCopy';
import { SURFACE_TOKENS } from '../../lib/designTokens';

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
        <Text style={styles.note}>This appears once messages exist.</Text>
      </View>
    );
  }
  return (
    <View style={styles.root} testID="argument-score-tracker">
      <Text style={styles.title} accessibilityLabel="mediator readout">Mediator readout</Text>
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
                <Text style={styles.band} numberOfLines={1}>{formatStandingBandShort(t.currentBand)}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.arrow}>{dirArrow(t.trendDirection)}</Text>
                  <Text style={styles.meta} numberOfLines={1}>last: {t.lastMoveLabel}</Text>
                </View>
                <View style={styles.sparkRow} accessibilityLabel={`sparkline ${t.sparkline.length}`}>
                  {t.sparkline.map((s, i) => {
                    const h = Math.max(2, Math.round((s + 1) * 6));
                    const c =
                      s >= 0.4 ? STANDING_BAND_COLOR.completely_right
                      : s >= 0 ? STANDING_BAND_COLOR.slightly_right
                      : s >= -0.4 ? STANDING_BAND_COLOR.slightly_wrong
                      : STANDING_BAND_COLOR.pretty_wrong;
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
  // UX-BOARD-READABILITY-001 (2026-06-19): de-game the readout chrome and loosen
  // the tiles. root padding 8 -> 10; title 10px UPPERCASE -> 11px sentence-case
  // (visible string 'Mediator readout' + aria 'mediator readout' UNCHANGED, only
  // the textTransform style is dropped); tiles minWidth 160 -> 180, cardBody
  // padding 8 -> 10, row gap 6 -> 8, band/meta gain explicit leading. Same
  // content, more air — no new signals, no scoreboard copy.
  root: { backgroundColor: '#0b1220', padding: 10, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  title: { color: '#94a3b8', fontSize: 11, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden', minWidth: 180, flexGrow: 1 },
  colorBar: { width: 4 },
  cardBody: { padding: 10, flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  actor: { color: '#f8fafc', fontWeight: '800', fontSize: 12 },
  count: { color: '#64748b', fontSize: 11 },
  band: { color: SURFACE_TOKENS.textPrimary, fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  arrow: { color: '#a5b4fc', fontSize: 12, fontWeight: '800' },
  meta: { color: '#94a3b8', fontSize: 11, lineHeight: 15 },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, marginTop: 4, height: 14 },
  sparkBar: { width: 4, borderRadius: 2 },
  note: { color: '#64748b', fontSize: 12, padding: 8 },
});
