/**
 * QOL-040 — client API wrapper for `public.room_notifications`.
 *
 * Performs ONLY:
 *   - SELECT of the current user's notifications (RLS scopes to
 *     `recipient_id = auth.uid()`).
 *   - SELECT-COUNT for the unread badge.
 *   - Single-column `read_at` UPDATE on the current user's rows
 *     (RLS scopes to `recipient_id = auth.uid()`).
 *
 * NEVER inserts — insertion is service-role-only inside the
 * `submit-argument` and `room-notifications` Edge Functions.
 * NEVER deletes — there is no DELETE policy.
 *
 * Doctrine (cdiscourse-doctrine §6/§8 + design §6.5):
 *   - No service-role key. The standard anon supabase-js client.
 *   - The shape conversion mirrors the table → model mapping in
 *     `notificationModel.ts` (snake_case row → camelCase model).
 */

import { supabase } from '../../lib/supabase';
import {
  ALL_ROOM_NOTIFICATION_TYPES,
  type NotificationMeta,
  type RoomNotification,
  type RoomNotificationType,
} from './notificationModel';

interface RoomNotificationRow {
  id: string;
  recipient_id: string;
  debate_id: string;
  argument_id: string | null;
  type: string;
  room_title: string | null;
  meta: unknown;
  read_at: string | null;
  created_at: string;
}

function isKnownType(t: string): t is RoomNotificationType {
  return (ALL_ROOM_NOTIFICATION_TYPES as ReadonlyArray<string>).includes(t);
}

function parseMeta(input: unknown): NotificationMeta {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const m = input as Record<string, unknown>;
  const out: NotificationMeta = {};
  if (m.classification === 'framing' || m.classification === 'context' || m.classification === 'fact') {
    out.classification = m.classification;
  }
  if (typeof m.roomIsPrivate === 'boolean') out.roomIsPrivate = m.roomIsPrivate;
  if (typeof m.actorNameVisible === 'boolean') out.actorNameVisible = m.actorNameVisible;
  if (typeof m.actorDisplayName === 'string') out.actorDisplayName = m.actorDisplayName;
  return out;
}

function adaptRow(row: RoomNotificationRow): RoomNotification | null {
  if (!isKnownType(row.type)) return null;
  return {
    id: row.id,
    recipientId: row.recipient_id,
    debateId: row.debate_id,
    argumentId: row.argument_id,
    type: row.type,
    roomTitle: row.room_title || '',
    meta: parseMeta(row.meta),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/**
 * Load the current user's notifications, newest first. The RLS
 * policy `room_notifications_select_own` scopes the result to
 * the caller.
 */
export async function loadNotifications(
  opts?: { unreadOnly?: boolean; limit?: number },
): Promise<RoomNotification[]> {
  const limit = Math.max(1, Math.min(opts?.limit ?? 100, 500));
  let query = supabase
    .from('room_notifications')
    .select('id, recipient_id, debate_id, argument_id, type, room_title, meta, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (opts?.unreadOnly === true) {
    query = query.is('read_at', null);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message || 'notifications_load_failed');
  const rows = Array.isArray(data) ? (data as RoomNotificationRow[]) : [];
  return rows
    .map(adaptRow)
    .filter((r): r is RoomNotification => r !== null);
}

/**
 * Unread count for the badge. Uses Postgres `count` so the query
 * stays cheap even when the user has thousands of rows.
 */
export async function loadUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('room_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw new Error(error.message || 'notifications_count_failed');
  return typeof count === 'number' ? count : 0;
}

/**
 * Mark ONE row read. The RLS UPDATE policy scopes the write to
 * the caller's own row; the explicit `.eq('id', id)` is the API
 * shape, not the security boundary.
 *
 * Idempotent: calling it twice on an already-read row is a no-op
 * because `read_at` is just overwritten with the new timestamp.
 */
export async function markNotificationRead(id: string): Promise<void> {
  if (!id || typeof id !== 'string') {
    throw new Error('notifications_mark_read_invalid_id');
  }
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('room_notifications')
    .update({ read_at: nowIso })
    .eq('id', id);
  if (error) throw new Error(error.message || 'notifications_mark_read_failed');
}

/**
 * Mark every unread notification of the current user read. RLS
 * scopes the write to the caller's own rows; the
 * `.is('read_at', null)` predicate avoids re-stamping rows that
 * already have a `read_at`.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('room_notifications')
    .update({ read_at: nowIso })
    .is('read_at', null);
  if (error) throw new Error(error.message || 'notifications_mark_all_read_failed');
}
