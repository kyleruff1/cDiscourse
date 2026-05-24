/**
 * QOL-040 — notification list screen.
 *
 * Renders the current user's notifications newest-first. Tap on a
 * navigable row resolves a deep link (debateId + activeArgumentId)
 * and routes the room screen. Tap on a non-navigable row
 * (`room_made_private`, or a `chime_in_rejected` whose access has
 * been revoked) expands a read-only confirmation; no navigation.
 *
 * Doctrine (accessibility-targets):
 *   - Empty / loading / error / populated states all rendered.
 *   - "Mark all read" affordance visible when any row is unread.
 *   - Every row is a ≥44-px tap target via `NotificationRow`.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NotificationRow } from './NotificationRow';
import { NOTIFICATION_LIST_COPY } from './notificationCopy';
import {
  buildNotificationCopy,
  resolveDeepLink,
  type NotificationDeepLink,
  type RoomNotification,
} from './notificationModel';
import { SURFACE_TOKENS } from '../../lib/designTokens';

export interface NotificationListScreenProps {
  notifications: RoomNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  onMarkOneRead: (id: string) => Promise<void> | void;
  onMarkAllRead: () => Promise<void> | void;
  /**
   * Called when the user taps a NAVIGABLE notification. The
   * parent (the app shell) decides how to route — typically by
   * setting the active debate + active argument id and switching
   * back to the Arguments tab.
   */
  onOpenDeepLink: (link: NotificationDeepLink, notification: RoomNotification) => void;
}

export function NotificationListScreen({
  notifications,
  unreadCount,
  loading,
  error,
  onRefresh,
  onMarkOneRead,
  onMarkAllRead,
  onOpenDeepLink,
}: NotificationListScreenProps): React.ReactElement {
  // Tracks which non-navigable rows have been expanded into the
  // inline confirmation card. Keyed by notification id.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRowPress = useCallback(
    (n: RoomNotification): void => {
      const link = resolveDeepLink(n);
      // Mark read regardless of navigability — the user has
      // engaged with the row.
      if (n.readAt === null) {
        void onMarkOneRead(n.id);
      }
      if (link === null) {
        setExpandedId((cur) => (cur === n.id ? null : n.id));
        return;
      }
      onOpenDeepLink(link, n);
    },
    [onMarkOneRead, onOpenDeepLink],
  );

  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleMarkAllRead = useCallback(() => {
    void onMarkAllRead();
  }, [onMarkAllRead]);

  const renderHeader = (): React.ReactElement => (
    <View style={styles.header} testID="notification-list-header">
      <Text style={styles.headerTitle} accessibilityRole="header">
        {NOTIFICATION_LIST_COPY.headerLabel}
      </Text>
      {unreadCount > 0 ? (
        <Pressable
          onPress={handleMarkAllRead}
          accessibilityRole="button"
          accessibilityLabel={NOTIFICATION_LIST_COPY.markAllReadAccessibilityLabel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="notification-list-mark-all-read"
          style={({ pressed }) => [styles.markAll, pressed && styles.markAllPressed]}
        >
          <Text style={styles.markAllText}>{NOTIFICATION_LIST_COPY.markAllRead}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderEmpty = (): React.ReactElement => {
    if (loading && notifications.length === 0) {
      return (
        <View style={styles.statePane} testID="notification-list-loading">
          <ActivityIndicator color={SURFACE_TOKENS.textPrimary} />
          <Text style={styles.stateLabel}>{NOTIFICATION_LIST_COPY.loadingLabel}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.statePane} testID="notification-list-error">
          <Text style={styles.stateTitle}>{NOTIFICATION_LIST_COPY.errorTitle}</Text>
          <Text style={styles.stateLabel}>{NOTIFICATION_LIST_COPY.errorBody}</Text>
        </View>
      );
    }
    return (
      <View style={styles.statePane} testID="notification-list-empty">
        <Text style={styles.stateTitle}>{NOTIFICATION_LIST_COPY.emptyTitle}</Text>
        <Text style={styles.stateLabel}>{NOTIFICATION_LIST_COPY.emptyBody}</Text>
      </View>
    );
  };

  return (
    <View style={styles.root} testID="notification-list-screen">
      {renderHeader()}
      <FlatList<RoomNotification>
        data={notifications}
        keyExtractor={(n) => n.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={SURFACE_TOKENS.textPrimary}
          />
        }
        renderItem={({ item }) => (
          <View>
            <NotificationRow notification={item} onPress={handleRowPress} />
            {expandedId === item.id ? (
              <View
                style={styles.confirmCard}
                testID={`notification-row-${item.id}-confirmation`}
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.confirmTitle}>
                  {buildNotificationCopy(item.type, item.roomTitle, item.meta).title}
                </Text>
                <Text style={styles.confirmBody}>
                  {buildNotificationCopy(item.type, item.roomTitle, item.meta).body}
                </Text>
                <Text style={styles.confirmHelp}>
                  {NOTIFICATION_LIST_COPY.rowNoAccessHint}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={renderEmpty()}
        contentContainerStyle={notifications.length === 0 ? styles.flatlistEmpty : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE_TOKENS.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  markAll: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: SURFACE_TOKENS.elevated,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    justifyContent: 'center',
  },
  markAllPressed: {
    opacity: 0.85,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  flatlistEmpty: {
    flex: 1,
  },
  statePane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
    marginBottom: 6,
  },
  stateLabel: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    textAlign: 'center',
  },
  confirmCard: {
    margin: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: SURFACE_TOKENS.overlay,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
  },
  confirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
    marginBottom: 4,
  },
  confirmBody: {
    fontSize: 12,
    color: SURFACE_TOKENS.textSecondary,
    marginBottom: 6,
  },
  confirmHelp: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
    fontStyle: 'italic',
  },
});
