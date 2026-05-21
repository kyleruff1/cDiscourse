import React from 'react';
import { Text, View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAdminUsers } from './useAdminUsers';
import { AdminCreateUserForm } from './AdminCreateUserForm';
import { useState } from 'react';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

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
          <Text style={[styles.btnText, styles.btnCreateText]}>{creating ? 'Cancel' : '+ New bot'}</Text>
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
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  toolbar: { flexDirection: 'row', padding: 8, gap: 6, alignItems: 'center', backgroundColor: SURFACE_TOKENS.raised, borderBottomWidth: 1, borderBottomColor: SURFACE_TOKENS.border },
  title: { flex: 1, fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  btn: { backgroundColor: CONTROL.primary.bg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnCreate: { backgroundColor: STATUS.success.bg },
  btnText: { color: CONTROL.primary.fg, fontSize: 12, fontWeight: '700' },
  btnCreateText: { color: STATUS.success.fg },
  error: { color: STATUS.danger.fg, fontSize: 12, padding: 6, backgroundColor: STATUS.danger.bg },
  list: { flex: 1 },
  listContent: { padding: 8 },
  row: { backgroundColor: SURFACE_TOKENS.elevated, padding: 10, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: SURFACE_TOKENS.border },
  botLabel: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  botMeta: { fontSize: 12, color: SURFACE_TOKENS.textSecondary },
  botPersona: { fontSize: 11, color: CONTROL.primary.bg, fontStyle: 'italic', marginTop: 2 },
  botId: { fontSize: 10, color: SURFACE_TOKENS.textMuted, marginTop: 2 },
  muted: { color: SURFACE_TOKENS.textSecondary, fontSize: 12, padding: 12, textAlign: 'center' },
  footerNote: { padding: 10, fontSize: 11, color: SURFACE_TOKENS.textMuted, fontStyle: 'italic', textAlign: 'center', borderTopWidth: 1, borderTopColor: SURFACE_TOKENS.border },
});
