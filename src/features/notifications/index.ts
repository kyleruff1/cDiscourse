/**
 * QOL-040 — notifications feature barrel.
 */

export type {
  NotificationDeepLink,
  NotificationMeta,
  RoomNotification,
  RoomNotificationType,
} from './notificationModel';
export {
  ALL_ROOM_NOTIFICATION_TYPES,
  buildNotificationCopy,
  classifyArgumentTrigger,
  resolveDeepLink,
  resolveRecipients,
} from './notificationModel';
export {
  loadNotifications,
  loadUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationsApi';
export { NOTIFICATION_LIST_COPY } from './notificationCopy';
export { useNotifications } from './useNotifications';
export type { UseNotificationsResult } from './useNotifications';
export { NotificationBadge } from './NotificationBadge';
export type { NotificationBadgeProps } from './NotificationBadge';
export { NotificationRow } from './NotificationRow';
export type { NotificationRowProps } from './NotificationRow';
export { NotificationListScreen } from './NotificationListScreen';
export type { NotificationListScreenProps } from './NotificationListScreen';
