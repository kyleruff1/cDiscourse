/**
 * GAME-006 — Jump Branch marker.
 *
 * Read-time, presentation-only RN component — renders ONE `JumpMarkerViewModel`:
 * the old-branch "departed" badge (`kind: 'departed_from'`) or the destination
 * "arrival" badge (`kind: 'arrived_at'`). Non-interactive, informational —
 * it is not a touchable, so the 44px tap-target rule does not apply.
 *
 * Doctrine:
 *  - A marker describes structural MOVEMENT — never the person, never a
 *    verdict, never a quality signal on either branch. The old branch is
 *    never deleted or hidden; the marker is purely additive.
 *  - The departed/arrived distinction is shape + glyph + text, not color
 *    alone — color-independence (accessibility-targets).
 *  - Every visible string is inside a <Text>; the marker root carries an
 *    accessibilityLabel. Copy comes from `JUMP_BRANCH_COPY` via the model.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { JumpMarkerViewModel } from './jumpBranchModel';

interface JumpBranchMarkerProps {
  viewModel: JumpMarkerViewModel;
}

/** The glyph per marker kind — a shape signal, not color. */
function markerGlyph(kind: JumpMarkerViewModel['kind']): string {
  return kind === 'departed_from' ? '↗' : '↘';
}

export function JumpBranchMarker({ viewModel }: JumpBranchMarkerProps) {
  const isDeparted = viewModel.kind === 'departed_from';
  return (
    <View
      style={[styles.marker, isDeparted ? styles.markerDeparted : styles.markerArrived]}
      accessibilityLabel={viewModel.accessibilityLabel}
      testID={`jump-branch-marker-${viewModel.kind}`}
    >
      <Text style={styles.markerGlyph} accessibilityElementsHidden>
        {markerGlyph(viewModel.kind)}
      </Text>
      <View style={styles.markerBody}>
        <Text style={styles.markerLabel}>{viewModel.markerLabel}</Text>
        <Text style={styles.markerWhen}>{viewModel.whenLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
  },
  // departed_from — dashed border (shape signal for "moved away from here").
  markerDeparted: {
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
  },
  // arrived_at — solid border (shape signal for "joined here").
  markerArrived: {
    borderColor: '#bfdbfe',
    borderStyle: 'solid',
    backgroundColor: '#eff6ff',
  },
  markerGlyph: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    lineHeight: 16,
  },
  markerBody: {
    gap: 1,
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  markerWhen: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
  },
});
