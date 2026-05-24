/**
 * QOL-040 — NotificationRow.tsx
 *
 * One notification row. Type-driven icon glyph, title + body from
 * `buildNotificationCopy`, relative timestamp via
 * `formatRelativeShort`, an unread dot for `readAt === null`.
 *
 * Doctrine (accessibility-targets + cdiscourse-doctrine §9):
 *   - ≥44 logical-px tap target via hitSlop.
 *   - `accessibilityRole="button"`, `accessibilityLabel`,
 *     `accessibilityState` populated.
 *   - The unread dot is NOT the only unread signal — the
 *     accessibility label / state expose "unread".
 *   - No internal code in any visible string (the type drives the
 *     icon glyph; the user-visible copy comes from
 *     `buildNotificationCopy`).
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  buildNotificationCopy,
  resolveDeepLink,
  type RoomNotification,
  type RoomNotificationType,
} from './notificationModel';
import { NOTIFICATION_LIST_COPY } from './notificationCopy';
import { formatRelativeShort } from '../../lib/formatDateTime';
import { BRAND, SURFACE_TOKENS } from '../../lib/designTokens';

export interface NotificationRowProps {
  notification: RoomNotification;
  onPress: (n: RoomNotification) => void;
  /** Optional explicit timestamp for relative formatting (tests). */
  nowMs?: number;
}

/**
 * A plain glyph per type. Shape carries the meaning (per
 * cdiscourse-doctrine: shape, stroke, texture first; color is
 * supplementary). One short glyph in `<Text>` is the lightweight
 * native-safe primitive — no icon library dependency.
 */
const TYPE_GLYPH: Record<RoomNotificationType, string> = {
  invite: '+',
  new_response: '>',
  concession_challenged: '!',
  source_requested: '?',
  evidence_supplied: '=',
  chime_in_posted: '*',
  room_made_private: 'P',
  chime_in_rejected: 'x',
  argument_settled: 'o',
  invite_accepted_by_invitee: '+',
};

export function NotificationRow({ notification, onPress, nowMs }: NotificationRowProps): React.ReactElement {
  const { title, body } = buildNotificationCopy(
    notification.type,
    notification.roomTitle,
    notification.meta,
  );
  const unread = notification.readAt === null;
  const deepLink = useMemo(() => resolveDeepLink(notification), [notification]);
  const navigable = deepLink !== null;
  const relative = formatRelativeShort(notification.createdAt, nowMs);
  const glyph = TYPE_GLYPH[notification.type];

  const a11yLabel = unread
    ? `${NOTIFICATION_LIST_COPY.rowUnreadAccessibilityLabel}. ${title}. ${body}.${relative ? ` ${relative}.` : ''}`
    : `${NOTIFICATION_LIST_COPY.rowReadAccessibilityLabel}. ${title}. ${body}.${relative ? ` ${relative}.` : ''}`;
  const a11yHint = navigable
    ? NOTIFICATION_LIST_COPY.rowOpenHint
    : NOTIFICATION_LIST_COPY.rowNoAccessHint;

  return (
    <Pressable
      onPress={() => onPress(notification)}
      style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
      accessibilityState={{ selected: !unread, disabled: false }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID={`notification-row-${notification.id}`}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.iconGlyph} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">
          {glyph}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
            {title}
          </Text>
          {unread ? (
            <View
              style={styles.unreadDot}
              testID={`notification-row-${notification.id}-unread-dot`}
              accessibilityElementsHidden={true}
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
        </View>
        <Text style={styles.bodyText} numberOfLines={2}>
          {body}
        </Text>
        <View style={styles.metaRow}>
          {relative ? <Text style={styles.metaText}>{relative}</Text> : null}
          {!navigable ? (
            <Text style={styles.metaTextMuted} testID={`notification-row-${notification.id}-no-access`}>
              {NOTIFICATION_LIST_COPY.rowNoAccessHint}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.divider,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  rowUnread: {
    backgroundColor: SURFACE_TOKENS.raised,
  },
  rowPressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  iconGlyph: {
    fontSize: 14,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  titleUnread: {
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
    marginRight: 8,
  },
  metaTextMuted: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
    fontStyle: 'italic',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.accent.cream,
    marginLeft: 8,
  },
});
