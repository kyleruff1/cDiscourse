/**
 * ARG-ROOM-005 — SeatAvailabilityStrip.
 *
 * A tiny READ-ONLY strip that surfaces the public-room seat state: the open-slot
 * count (or "No open seats" + the observe nudge when full) and the viewer's own
 * state line. It consumes a `SeatAvailabilityViewModel` from `seatClaimModel` —
 * it never derives seat math itself and renders NO Pressable (no claim verdict).
 *
 * Doctrine: counts only, never identities (who holds the reserved seat is never
 * shown). "Full" / "observe" are seat facts, never verdicts. Color is never the
 * only signal — the meaning lives in the WORDS ("No open seats", the nudge), so
 * the strip is legible in grayscale.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SeatAvailabilityViewModel } from '../debates/seatClaimModel';

interface Props {
  viewModel: SeatAvailabilityViewModel;
  /** testID for the strip root. Defaults to 'seat-availability-strip'. */
  testID?: string;
}

export function SeatAvailabilityStrip({ viewModel, testID }: Props) {
  const rootTestID = testID ?? 'seat-availability-strip';
  return (
    <View
      style={styles.strip}
      testID={rootTestID}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={viewModel.accessibilityLabel}
    >
      {/* UX-SIMPLIFY-002B — "N of M active seats": the capacity context the
          open-slot count alone lacks. Active = For / Against / Host. */}
      <Text style={styles.activeSeats} testID="seat-availability-active-label">
        {viewModel.activeSeatsLabel}
      </Text>
      <Text
        style={[styles.openSeats, viewModel.isFull && styles.openSeatsFull]}
        testID="seat-availability-open-label"
      >
        {viewModel.openSeatsLabel}
      </Text>
      {viewModel.fullRoomObserveNudge ? (
        <Text style={styles.nudge} testID="seat-availability-full-nudge">
          {viewModel.fullRoomObserveNudge}
        </Text>
      ) : null}
      {/* UX-SIMPLIFY-002B — readers/watchers are uncapped and never consume an
          active seat. Static clarity line; muted secondary cue. */}
      <Text style={styles.readersNote} testID="seat-availability-readers-note">
        {viewModel.readersNote}
      </Text>
      <Text style={styles.viewerState} testID="seat-availability-viewer-state">
        {viewModel.viewerStateLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    // A comfortable, read-only band — no tap target, but >= 44 keeps it
    // legible and consistent with the surrounding controls.
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  // UX-SIMPLIFY-002B — the active-seat capacity line leads the strip.
  activeSeats: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' as const },
  openSeats: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' as const },
  // Full state changes the TEXT ("No open seats" + the nudge), not just the
  // color; the muted color is a secondary cue only.
  openSeatsFull: { color: '#94a3b8' },
  nudge: { color: '#cbd5e1', fontSize: 12 },
  // UX-SIMPLIFY-002B — readers note: muted secondary clarity, never an alert.
  readersNote: { color: '#94a3b8', fontSize: 12 },
  viewerState: { color: '#94a3b8', fontSize: 12 },
});
