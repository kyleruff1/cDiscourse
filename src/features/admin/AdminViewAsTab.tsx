import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { adminViewAsSnapshot, adminErrorMessage } from './adminApi';
import type { AdminViewAsSnapshot } from './types';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

export function AdminViewAsTab() {
  const [targetUserId, setTargetUserId] = useState('');
  const [snapshot, setSnapshot] = useState<AdminViewAsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSnapshot = async () => {
    setError(null);
    setSnapshot(null);
    if (!targetUserId.trim()) {
      setError('Enter a user ID.');
      return;
    }
    setLoading(true);
    const r = await adminViewAsSnapshot({ targetUserId: targetUserId.trim() });
    setLoading(false);
    if (r.ok) setSnapshot(r.data);
    else setError(adminErrorMessage(r.error, r.status));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Read-only admin snapshot. You are NOT signed in as this user. Posting as them is not possible from this view.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Target user ID (uuid)"
        placeholderTextColor={SURFACE_TOKENS.placeholder}
        value={targetUserId}
        onChangeText={setTargetUserId}
        autoCapitalize="none"
        accessibilityLabel="view-as-target-id"
      />
      <Pressable style={styles.btn} onPress={handleSnapshot} disabled={loading} accessibilityLabel="view-as-snapshot-btn">
        <Text style={styles.btnText}>{loading ? 'Loading…' : 'View as snapshot'}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {snapshot && (
        <View style={styles.snapshot}>
          <Text style={styles.snapshotNote}>{snapshot.note}</Text>
          <Text style={styles.section}>Target</Text>
          <Text style={styles.row}>
            <Text style={styles.label}>Email: </Text>{snapshot.target.email ?? '(none)'}
          </Text>
          <Text style={styles.row}>
            <Text style={styles.label}>Display: </Text>{snapshot.target.profile?.display_name ?? '(none)'}
          </Text>
          <Text style={styles.row}>
            <Text style={styles.label}>Role: </Text>{snapshot.target.profile?.role ?? 'user'}
          </Text>
          {snapshot.target.bot && (
            <Text style={styles.row}>
              <Text style={styles.label}>Bot label: </Text>{snapshot.target.bot.label}
            </Text>
          )}

          <Text style={styles.section}>Recent arguments ({snapshot.recentArguments.length})</Text>
          {snapshot.recentArguments.slice(0, 10).map((a) => (
            <View key={a.id} style={styles.subRow}>
              <Text style={styles.subRowLabel}>{a.argument_type} • {a.side} • {a.created_at}</Text>
              <Text style={styles.subRowBody} numberOfLines={3}>{a.body}</Text>
            </View>
          ))}

          <Text style={styles.section}>Recent rooms ({snapshot.recentParticipations.length})</Text>
          {snapshot.recentParticipations.slice(0, 10).map((p, idx) => (
            <View key={`${p.debate_id}-${idx}`} style={styles.subRow}>
              <Text style={styles.subRowLabel}>{p.role} • {p.created_at}</Text>
              <Text style={styles.subRowBody}>{p.debate_id}</Text>
            </View>
          ))}

          <Text style={styles.section}>Recent audit events ({snapshot.recentAuditEvents.length})</Text>
          {snapshot.recentAuditEvents.slice(0, 10).map((e) => (
            <View key={e.id} style={styles.subRow}>
              <Text style={styles.subRowLabel}>{e.action} • {e.created_at}</Text>
              {e.reason && <Text style={styles.subRowBody}>{e.reason}</Text>}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  content: { padding: 10 },
  banner: { backgroundColor: STATUS.warning.bg, padding: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: STATUS.warning.fg },
  bannerText: { fontSize: 12, color: STATUS.warning.fg },
  input: { borderWidth: 1, borderColor: SURFACE_TOKENS.inputBorder, borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 8, backgroundColor: SURFACE_TOKENS.inputBg, color: SURFACE_TOKENS.textPrimary },
  btn: { backgroundColor: CONTROL.primary.bg, borderRadius: 6, paddingVertical: 8, alignItems: 'center', marginBottom: 8 },
  btnText: { color: CONTROL.primary.fg, fontWeight: '700', fontSize: 13 },
  error: { color: STATUS.danger.fg, fontSize: 12, padding: 6, backgroundColor: STATUS.danger.bg, borderRadius: 6 },
  snapshot: { marginTop: 8 },
  snapshotNote: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, fontStyle: 'italic', marginBottom: 8 },
  section: { fontSize: 11, fontWeight: '700', color: SURFACE_TOKENS.textSecondary, marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  row: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, marginBottom: 2 },
  label: { color: SURFACE_TOKENS.textSecondary, fontWeight: '600' },
  subRow: { padding: 6, backgroundColor: SURFACE_TOKENS.elevated, borderRadius: 6, marginBottom: 4 },
  subRowLabel: { fontSize: 10, color: SURFACE_TOKENS.textSecondary, fontWeight: '600' },
  subRowBody: { fontSize: 12, color: SURFACE_TOKENS.textPrimary },
});
