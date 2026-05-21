import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  adminListBlocks,
  adminAddBlock,
  adminRemoveBlock,
  adminErrorMessage,
} from './adminApi';
import type { AdminBlockRule } from './types';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

type BlockType = 'email' | 'email_domain' | 'ip' | 'ip_cidr' | 'profile';

const TYPE_OPTIONS: BlockType[] = ['email', 'email_domain', 'ip', 'ip_cidr', 'profile'];

export function AdminBlocksTab() {
  const [blocks, setBlocks] = useState<AdminBlockRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [newType, setNewType] = useState<BlockType>('email');
  const [newValue, setNewValue] = useState('');
  const [newReason, setNewReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    const r = await adminListBlocks({});
    setLoading(false);
    if (r.ok) setBlocks(r.data.blocks);
    else setError(adminErrorMessage(r.error, r.status));
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAdd = async () => {
    setActionMsg(null);
    setError(null);
    if (!newValue.trim() || !newReason.trim()) {
      setError('Value and reason required.');
      return;
    }
    const r = await adminAddBlock({ blockType: newType, value: newValue, reason: newReason });
    if (r.ok) {
      setActionMsg('Block rule added.');
      setNewValue('');
      setNewReason('');
      await load();
    } else {
      setError(adminErrorMessage(r.error, r.status));
    }
  };

  const handleRemove = async (id: string) => {
    setActionMsg(null);
    setError(null);
    const r = await adminRemoveBlock({ blockRuleId: id, reason: 'Removed via admin UI' });
    if (r.ok) {
      setActionMsg('Block lifted.');
      await load();
    } else {
      setError(adminErrorMessage(r.error, r.status));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          App-level block rules. Full Supabase Auth pre-login enforcement is a later stage.
        </Text>
      </View>

      <Text style={styles.section}>Add block rule</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((t) => (
          <Pressable
            key={t}
            style={[styles.typeChip, newType === t && styles.typeChipActive]}
            onPress={() => setNewType(t)}
            accessibilityLabel={`block-type-${t}`}
          >
            <Text style={[styles.typeChipText, newType === t && styles.typeChipTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder={blockTypePlaceholder(newType)}
        placeholderTextColor={SURFACE_TOKENS.placeholder}
        value={newValue}
        onChangeText={setNewValue}
        autoCapitalize="none"
        accessibilityLabel="block-value"
      />
      <TextInput
        style={styles.input}
        placeholder="Reason (required)"
        placeholderTextColor={SURFACE_TOKENS.placeholder}
        value={newReason}
        onChangeText={setNewReason}
        accessibilityLabel="block-reason"
      />
      <Pressable style={styles.btn} onPress={handleAdd} accessibilityLabel="add-block-rule">
        <Text style={styles.btnText}>Add block</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {actionMsg && <Text style={styles.success}>{actionMsg}</Text>}

      <Text style={styles.section}>Current rules ({blocks.length})</Text>
      {loading && <Text style={styles.muted}>Loading…</Text>}
      {blocks.map((b) => (
        <View key={b.id} style={[styles.rule, !b.active && styles.ruleInactive]}>
          <View style={styles.ruleHeader}>
            <Text style={styles.ruleType}>{b.block_type}</Text>
            {!b.active && <Text style={styles.ruleInactiveBadge}>LIFTED</Text>}
          </View>
          <Text style={styles.ruleValue}>{b.normalized_value}</Text>
          {b.reason && <Text style={styles.ruleReason}>{b.reason}</Text>}
          {b.active && (
            <Pressable style={styles.unblockBtn} onPress={() => handleRemove(b.id)} accessibilityLabel={`unblock-${b.id}`}>
              <Text style={styles.unblockText}>Unblock</Text>
            </Pressable>
          )}
        </View>
      ))}
      {!loading && blocks.length === 0 && <Text style={styles.muted}>No block rules.</Text>}
    </ScrollView>
  );
}

function blockTypePlaceholder(t: BlockType): string {
  switch (t) {
    case 'email': return 'user@example.com';
    case 'email_domain': return 'example.com';
    case 'ip': return '203.0.113.1';
    case 'ip_cidr': return '203.0.113.0/24';
    case 'profile': return 'profile UUID';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  content: { padding: 10 },
  notice: { backgroundColor: STATUS.warning.bg, padding: 8, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: STATUS.warning.fg },
  noticeText: { fontSize: 11, color: STATUS.warning.fg },
  section: { fontSize: 11, fontWeight: '700', color: SURFACE_TOKENS.textSecondary, marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: SURFACE_TOKENS.raised },
  typeChipActive: { backgroundColor: STATUS.info.bg },
  typeChipText: { fontSize: 11, color: SURFACE_TOKENS.textSecondary },
  typeChipTextActive: { color: STATUS.info.fg, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: SURFACE_TOKENS.inputBorder, borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 6, backgroundColor: SURFACE_TOKENS.inputBg, color: SURFACE_TOKENS.textPrimary },
  btn: { backgroundColor: CONTROL.primary.bg, borderRadius: 6, paddingVertical: 8, alignItems: 'center', marginBottom: 8 },
  btnText: { color: CONTROL.primary.fg, fontWeight: '700', fontSize: 13 },
  error: { color: STATUS.danger.fg, fontSize: 12, padding: 6, backgroundColor: STATUS.danger.bg, borderRadius: 6, marginBottom: 4 },
  success: { color: STATUS.success.fg, fontSize: 12, padding: 6, backgroundColor: STATUS.success.bg, borderRadius: 6, marginBottom: 4 },
  muted: { color: SURFACE_TOKENS.textSecondary, fontSize: 12, padding: 6 },
  rule: { backgroundColor: SURFACE_TOKENS.elevated, padding: 8, borderRadius: 6, marginBottom: 4, borderWidth: 1, borderColor: SURFACE_TOKENS.border },
  ruleInactive: { opacity: 0.6 },
  ruleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleType: { fontSize: 10, fontWeight: '700', color: SURFACE_TOKENS.textSecondary, textTransform: 'uppercase' },
  ruleInactiveBadge: { fontSize: 10, fontWeight: '700', color: STATUS.warning.fg, backgroundColor: STATUS.warning.bg, paddingHorizontal: 4, borderRadius: 4 },
  ruleValue: { fontSize: 13, color: SURFACE_TOKENS.textPrimary, marginTop: 2 },
  ruleReason: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, marginTop: 2 },
  unblockBtn: { marginTop: 4, alignSelf: 'flex-start', backgroundColor: SURFACE_TOKENS.raised, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  unblockText: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, fontWeight: '600' },
});
