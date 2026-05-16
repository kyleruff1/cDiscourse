import React from 'react';
import { Text, View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAdminUsers } from './useAdminUsers';
import { AdminCreateUserForm } from './AdminCreateUserForm';
import { useState } from 'react';

/**
 * AdminBotUsersTab — filters the user list to bots only and shows a
 * dedicated bot-creation form. Bot inspection is performed via View As.
 */
export function AdminBotUsersTab() {
  const { users, loading, error, refresh, setBotOnly } = useAdminUsers();
  const [creating, setCreating] = useState(false);

  // Auto-enable bot-only filter for this tab.
  React.useEffect(() => {
    setBotOnly(true);
  }, [setBotOnly]);

  const bots = users.filter((u) => u.isBot);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Bot users</Text>
        <Pressable style={styles.btn} onPress={refresh} accessibilityLabel="refresh-bots">
          <Text style={styles.btnText}>Refresh</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnCreate]}
          onPress={() => setCreating((v) => !v)}
          accessibilityLabel="open-create-bot-form"
        >
          <Text style={styles.btnText}>{creating ? 'Cancel' : '+ New bot'}</Text>
        </Pressable>
      </View>

      {creating && (
        <AdminCreateUserForm
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {loading && bots.length === 0 ? <Text style={styles.muted}>Loading…</Text> : null}
        {bots.map((b) => (
          <View key={b.id} style={styles.row}>
            <Text style={styles.botLabel}>{b.botLabel ?? b.displayName ?? '(unnamed)'}</Text>
            <Text style={styles.botMeta}>{b.email}</Text>
            {b.botPersona && <Text style={styles.botPersona}>{b.botPersona}</Text>}
            <Text style={styles.botId}>{b.id}</Text>
          </View>
        ))}
        {!loading && bots.length === 0 && !error && (
          <Text style={styles.muted}>No bot users yet. Tap “+ New bot.”</Text>
        )}
      </ScrollView>

      <Text style={styles.footerNote}>
        Bot automation is not enabled in this stage. Bots are dev/test accounts only.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: 'row', padding: 8, gap: 6, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { flex: 1, fontSize: 13, fontWeight: '700', color: '#111827' },
  btn: { backgroundColor: '#6366f1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnCreate: { backgroundColor: '#10b981' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  error: { color: '#dc2626', fontSize: 12, padding: 6, backgroundColor: '#fef2f2' },
  list: { flex: 1 },
  listContent: { padding: 8 },
  row: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  botLabel: { fontSize: 13, fontWeight: '700', color: '#111827' },
  botMeta: { fontSize: 12, color: '#6b7280' },
  botPersona: { fontSize: 11, color: '#6366f1', fontStyle: 'italic', marginTop: 2 },
  botId: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  muted: { color: '#6b7280', fontSize: 12, padding: 12, textAlign: 'center' },
  footerNote: { padding: 10, fontSize: 11, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
});
