/**
 * UX-PR-B (#918) — RoomLoadErrorStrip.
 *
 * The ONE room-level notice that makes a swallowed read failure honest. It
 * renders NULL when nothing failed (so a healthy / flag-off room is
 * byte-identical), and otherwise a single non-blocking, live-region notice with
 * a retry control. Mounted ONCE in the room topBanner: even when all four room
 * reads fail at once (the expired-session cascade) there is exactly one strip,
 * one announcement, one retry — never four stacked banners.
 *
 * Presentational only: the parent owns the refetch closures and maps the pure
 * models failedSources onto them in onRetry. Muted tone (a failed LOAD is
 * recoverable, not fatal); it never covers or gates the room content below it.
 *
 * DOCTRINE (cdiscourse-doctrine sections 1 / 9): the message is a neutral load
 * fact, never a verdict / heat / popularity token, never a person attribution.
 * Comments are apostrophe-free for scanner safety.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ROOM_LOAD_ERROR_COPY } from '../gameCopy';
import type { RoomLoadErrorStripState } from './roomLoadErrorModel';

export interface RoomLoadErrorStripProps {
  state: RoomLoadErrorStripState;
  /** The parent maps failedSources -> the matching refetch closures. */
  onRetry: () => void;
  testID?: string;
}

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

export function RoomLoadErrorStrip({
  state,
  onRetry,
  testID,
}: RoomLoadErrorStripProps): React.ReactElement | null {
  if (!state.visible) return null;
  const base = testID ?? 'room-load-error-strip';
  return (
    <View style={styles.strip} accessibilityLiveRegion="polite" testID={base}>
      <Text style={styles.message} testID={`${base}-message`}>
        {state.message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={ROOM_LOAD_ERROR_COPY.retryA11y}
        hitSlop={HIT_SLOP}
        style={styles.retryButton}
        testID={`${base}-retry`}
      >
        <Text style={styles.retryText}>{ROOM_LOAD_ERROR_COPY.retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Muted, non-blocking. Mirrors the callbackRetryBanner tone rather than the
  // red danger banner: a failed load is recoverable, not fatal.
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    marginBottom: 6,
  },
  message: { flex: 1, color: '#cbd5e1', fontSize: 13 },
  retryButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  retryText: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
});
