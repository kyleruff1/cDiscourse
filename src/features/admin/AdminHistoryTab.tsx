import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { adminGetUserDetail, adminErrorMessage, summarizeAuditPayload } from './adminApi';
import type { AdminAuditEvent } from './types';
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';

/**
 * AdminHistoryTab — shows recent admin actions for a queried user.
 *
 * Note: a dedicated list_history action can be added later. For now we
 * route through get_user_detail which returns recent audit events on
 * the target user.
 */
export function AdminHistoryTab() {
  const [targetUserId, setTargetUserId] = useState('');
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUserId.trim()) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const r = await adminGetUserDetail(targetUserId.trim());
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setEvents(r.data.recentAuditEvents);
      else setError(adminErrorMessage(r.error, r.status));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.help}>
        Enter a user ID to load audit events targeting that user. A global history view is a future stage.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Target user ID (uuid)"
        value={targetUserId}
        onChangeText={setTargetUserId}
        autoCapitalize="none"
        accessibilityLabel="history-target-id"
      />
      {loading && <Text style={styles.muted} accessibilityLabel="history-loading">Loading audit events…</Text>}
      {error && (
        <Text style={styles.error} accessibilityLabel="history-error">
          Could not load events: {error}.
        </Text>
      )}
      {events.length > 0 && (
        <Text style={styles.sortStatus} accessibilityLabel="history-sort-status">
          Sorted by: Created ↓ (Newest first — admin-users Edge Function default)
        </Text>
      )}
      {events.map((e) => (
        <View key={e.id} style={styles.event}>
          <Text style={styles.eventAction}>{e.action}</Text>
          <Text style={styles.eventMeta}>
            Created {formatDateTime(e.created_at)} ({formatRelativeShort(e.created_at)})
          </Text>
          {e.reason && <Text style={styles.eventReason}>Reason: {e.reason}</Text>}
          {Object.keys(e.payload ?? {}).length > 0 && (
            <Text style={styles.eventPayload}>{summarizeAuditPayload(e.payload)}</Text>
          )}
        </View>
      ))}
      {!loading && targetUserId.trim() && events.length === 0 && !error && (
        <Text style={styles.muted} accessibilityLabel="history-empty">
          No events for this user. Newer admin actions on this user will appear here, newest first.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 10 },
  help: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 8 },
  muted: { color: '#6b7280', fontSize: 12, padding: 6 },
  error: { color: '#dc2626', fontSize: 12, padding: 6, backgroundColor: '#fef2f2', borderRadius: 6 },
  event: { padding: 8, backgroundColor: '#fff', borderRadius: 6, marginBottom: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  eventAction: { fontSize: 12, fontWeight: '700', color: '#111827' },
  eventMeta: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  eventReason: { fontSize: 11, color: '#374151', marginTop: 2 },
  eventPayload: { fontSize: 10, color: '#6b7280', marginTop: 2, fontFamily: 'monospace' as 'monospace' },
  sortStatus: { fontSize: 11, color: '#374151', fontWeight: '600', marginBottom: 6 },
});
