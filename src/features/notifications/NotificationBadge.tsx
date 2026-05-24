/**
 * QOL-040 — unread-count badge for the Arguments tab.
 *
 * Pure presentational component. Reads `unreadCount` from props;
 * the parent owns the hook (`useNotifications`).
 *
 * Doctrine (accessibility-targets):
 *   - Zero unread → renders nothing (not a "0" badge).
 *   - Count capped at "9+" so the layout doesn't drift.
 *   - `accessibilityLabel` exposes the full count to the screen
 *     reader.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SURFACE_TOKENS } from '../../lib/designTokens';
import { NOTIFICATION_LIST_COPY } from './notificationCopy';

export interface NotificationBadgeProps {
  unreadCount: number;
  /** Optional testID — useful for in-app placement tests. */
  testID?: string;
}

export function NotificationBadge({
  unreadCount,
  testID = 'notification-badge',
}: NotificationBadgeProps): React.ReactElement | null {
  const safeCount = Math.max(0, Math.floor(unreadCount));
  if (safeCount <= 0) return null;
  const display = safeCount > 9 ? '9+' : String(safeCount);
  return (
    <View
      style={styles.badge}
      accessibilityLabel={NOTIFICATION_LIST_COPY.badgeAccessibilityLabel(safeCount)}
      accessibilityRole="text"
      testID={testID}
    >
      <Text style={styles.badgeText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
    letterSpacing: 0,
  },
});
