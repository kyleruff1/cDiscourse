/**
 * GAME-005 — Public-room metrics strip.
 *
 * Read-time, presentation-only RN component — the non-correctness metrics
 * strip (seat count, chime-in count, branch states). Pure presentation over
 * a `PublicRoomMetricsViewModel`. No `Pressable` — it is informational, so
 * the 44px tap-target rule does not apply.
 *
 * Doctrine:
 *  - Seat count is a CAPACITY readout, chime-in count is a COUNT — never a
 *    leaderboard, never ranked. Branch states come straight from BR-004's
 *    CollapsedBranchSummary; this strip re-derives nothing.
 *  - None of these is a truth or quality signal. A high seat count does not
 *    mean the room is "right".
 *  - Every visible string is inside a <Text>; the strip root carries an
 *    accessibilityLabel.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PublicRoomMetricsViewModel } from './publicSeatModel';

interface PublicRoomMetricsStripProps {
  viewModel: PublicRoomMetricsViewModel;
}

export function PublicRoomMetricsStrip({ viewModel }: PublicRoomMetricsStripProps) {
  return (
    <View
      style={styles.strip}
      accessibilityLabel={viewModel.accessibilityLabel}
      testID="public-room-metrics-strip"
    >
      {/* Seat count — a capacity readout. */}
      <View style={styles.metricChip} testID="public-room-metrics-seat-count">
        <Text style={styles.metricGlyph} accessibilityElementsHidden>
          {'▦'}
        </Text>
        <Text style={styles.metricText}>{viewModel.seatCountLabel}</Text>
      </View>

      {/* Chime-in count — a count, never ranked. */}
      <View style={styles.metricChip} testID="public-room-metrics-chime-in-count">
        <Text style={styles.metricGlyph} accessibilityElementsHidden>
          {'◇'}
        </Text>
        <Text style={styles.metricText}>{viewModel.chimeInCountLabel}</Text>
      </View>

      {/* Branch-state chips — sourced from BR-004 CollapsedBranchSummary. */}
      {viewModel.branchStateLabels.map((label, index) => (
        <View
          key={`${index}-${label}`}
          style={styles.branchChip}
          testID={`public-room-metrics-branch-${index}`}
        >
          <Text style={styles.branchText}>{label}</Text>
        </View>
      ))}

      {/* Side-branches heading — only when a moved-to-observer branch exists. */}
      {viewModel.hasSideBranches ? (
        <View
          style={styles.sideBranchesChip}
          testID="public-room-metrics-side-branches"
        >
          <Text style={styles.sideBranchesText}>
            {viewModel.sideBranchesHeading}
          </Text>
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
  metricChip: {
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
  metricGlyph: { fontSize: 11, color: '#6b7280' },
  metricText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  branchChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  branchText: { fontSize: 10, fontWeight: '500', color: '#4b5563' },
  sideBranchesChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  sideBranchesText: { fontSize: 10, fontWeight: '700', color: '#4b5563' },
});
