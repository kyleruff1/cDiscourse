import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { adminGetUserDetail, adminErrorMessage, summarizeAuditPayload } from './adminApi';
import type { AdminAuditEvent } from './types';
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';
import { SURFACE_TOKENS, STATUS } from '../../lib/designTokens';

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
        placeholderTextColor={SURFACE_TOKENS.placeholder}
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
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  content: { padding: 10 },
  help: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: SURFACE_TOKENS.inputBorder, borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 8, backgroundColor: SURFACE_TOKENS.inputBg, color: SURFACE_TOKENS.textPrimary },
  muted: { color: SURFACE_TOKENS.textSecondary, fontSize: 12, padding: 6 },
  error: { color: STATUS.danger.fg, fontSize: 12, padding: 6, backgroundColor: STATUS.danger.bg, borderRadius: 6 },
  event: { padding: 8, backgroundColor: SURFACE_TOKENS.elevated, borderRadius: 6, marginBottom: 4, borderWidth: 1, borderColor: SURFACE_TOKENS.border },
  eventAction: { fontSize: 12, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  eventMeta: { fontSize: 10, color: SURFACE_TOKENS.textSecondary, marginTop: 2 },
  eventReason: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, marginTop: 2 },
  eventPayload: { fontSize: 10, color: SURFACE_TOKENS.textSecondary, marginTop: 2, fontFamily: 'monospace' as 'monospace' },
  sortStatus: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, fontWeight: '600', marginBottom: 6 },
});
