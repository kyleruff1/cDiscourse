/**
 * QOL-040 ships notification delivery WITHOUT consuming any user
 * preference. The existing userPreferencesModel.notificationsOptInStub
 * remains a stub: the hook always polls and renders. Per-trigger
 * opt-out, quiet hours, global on/off, and email unsubscribe are
 * deferred to a follow-up card (working name QOL-040.1).
 */

/**
 * QOL-040 — notification list + badge hook.
 *
 * Loads the current user's notifications via `notificationsApi`,
 * exposes the unread count for the badge, and refreshes on focus
 * (no realtime subscription in v1 — design §17). The hook
 * tolerates a signed-out state (null userId) by returning an
 * empty list without firing a network call.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadNotifications,
  loadUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationsApi';
import type { RoomNotification } from './notificationModel';

export interface UseNotificationsResult {
  notifications: RoomNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * @param userId — the signed-in user's id, or null when
 *   signed out. The hook returns an empty list without firing
 *   any network call when null.
 */
export function useNotifications(userId: string | null | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<RoomNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // The latest load's sequence number. We discard responses out
  // of order so a stale request can't overwrite a newer one.
  const loadSeqRef = useRef(0);

  const signedIn = typeof userId === 'string' && userId.length > 0;

  const refresh = useCallback(async (): Promise<void> => {
    if (!signedIn) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const [rows, count] = await Promise.all([
        loadNotifications({ limit: 100 }),
        loadUnreadCount(),
      ]);
      if (seq !== loadSeqRef.current) return;
      setNotifications(rows);
      setUnreadCount(count);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setError(err instanceof Error ? err.message : 'notifications_load_failed');
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [signedIn]);

  // Load once when the userId changes (signed in / out / switch).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markOneRead = useCallback(
    async (id: string): Promise<void> => {
      if (!signedIn) return;
      // Optimistic: stamp the row locally before the network round-trip.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id && n.readAt === null ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await markNotificationRead(id);
      } catch (err) {
        // Roll back unread count on failure; the next refresh
        // resolves the row state.
        setUnreadCount((c) => c + 1);
        setError(err instanceof Error ? err.message : 'notifications_mark_read_failed');
      }
    },
    [signedIn],
  );

  const markAllRead = useCallback(async (): Promise<void> => {
    if (!signedIn) return;
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt === null ? { ...n, readAt: nowIso } : n)));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'notifications_mark_all_read_failed');
      // Next refresh corrects the unread count.
      void refresh();
    }
  }, [refresh, signedIn]);

  return useMemo(
    () => ({ notifications, unreadCount, loading, error, refresh, markOneRead, markAllRead }),
    [notifications, unreadCount, loading, error, refresh, markOneRead, markAllRead],
  );
}
