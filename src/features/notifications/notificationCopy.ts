/**
 * QOL-040 — static UI strings for the notification list screen.
 *
 * Pure TypeScript. Per-row title/body strings live in
 * `notificationModel.buildNotificationCopy`; this file owns the
 * screen-level chrome (header, empty / error states, the
 * "Mark all read" affordance).
 *
 * Doctrine (cdiscourse-doctrine §1/§9):
 *   - No verdict / truth / popularity language.
 *   - No raw codes. Every string is plain English.
 *   - Honest copy for loading / empty / error states. No
 *     "something went wrong" prose that the user cannot act on.
 */

export const NOTIFICATION_LIST_COPY = {
  screenTitle: 'Notifications',
  headerLabel: 'Notifications',
  /** Empty-state copy — calm, not an error. */
  emptyTitle: 'No notifications yet',
  emptyBody:
    "You'll see invites and replies to your arguments here.",
  /** Loading-state copy. */
  loadingLabel: 'Loading your notifications…',
  /** Error-state copy — actionable. */
  errorTitle: "Couldn't load notifications",
  errorBody: 'Pull to retry.',
  /** Action: mark every row read. */
  markAllRead: 'Mark all read',
  markAllReadAccessibilityLabel: 'Mark every notification as read',
  /** Per-row accessibility labels for unread + read. */
  rowUnreadAccessibilityLabel: 'Unread notification',
  rowReadAccessibilityLabel: 'Notification',
  /** Per-row open hint. */
  rowOpenHint: 'Opens the argument.',
  /** Per-row "no longer accessible" hint for null deep links. */
  rowNoAccessHint: "You no longer have access to this argument.",
  /** Badge label (e.g. "3 unread notifications"). */
  badgeAccessibilityLabel: (count: number): string =>
    `${count} unread notification${count === 1 ? '' : 's'}`,
} as const;
