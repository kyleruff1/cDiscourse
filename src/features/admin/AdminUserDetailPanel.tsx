import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  adminGetUserDetail,
  adminUpdateRole,
  adminSendPasswordReset,
  adminSetTemporaryPassword,
  adminDisableUser,
  adminEnableUser,
  adminSoftDeleteUser,
  adminErrorMessage,
} from './adminApi';
import type { AdminUserDetail, AdminUserSummary } from './types';
import type { ProfileRole } from '../account/types';

interface Props {
  userId: string;
  summary: AdminUserSummary;
  onClose: () => void;
  onAction: () => void;
}

export function AdminUserDetailPanel({ userId, summary, onClose, onAction }: Props) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmAdminGrant, setConfirmAdminGrant] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const r = await adminGetUserDetail(userId);
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setDetail(r.data);
      else setError(adminErrorMessage(r.error, r.status));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const runAction = async <T,>(
    fn: () => Promise<{ ok: true; data: T } | { ok: false; error: { error: string; reason?: string; detail?: string }; status: number }>,
    successLabel: string,
  ) => {
    setActionMsg(null);
    setError(null);
    const r = await fn();
    if (r.ok) {
      setActionMsg(successLabel);
      onAction();
    } else {
      setError(adminErrorMessage(r.error, r.status));
    }
  };

  const handleToggleAdmin = async () => {
    if (!reason.trim()) {
      setError('Reason required.');
      return;
    }
    const newRole: ProfileRole = summary.admin ? 'user' : 'admin';
    if (newRole === 'admin' && !confirmAdminGrant) {
      setError('Confirm admin grant first.');
      return;
    }
    await runAction(
      () => adminUpdateRole({ userId, role: newRole, reason, confirmAdminGrant }),
      `Role updated to ${newRole}.`,
    );
  };

  const handlePasswordReset = async () => {
    await runAction(
      () => adminSendPasswordReset({ userId }),
      'Password reset link generated (check Auth logs).',
    );
  };

  const handleTempPassword = async () => {
    if (!reason.trim() || tempPassword.length < 8) {
      setError('Reason and 8+ char password required.');
      return;
    }
    await runAction(
      () => adminSetTemporaryPassword({ userId, temporaryPassword: tempPassword, reason, botOnly: true }),
      'Temporary password set (bot-only).',
    );
    setTempPassword('');
  };

  const handleDisable = async () => {
    if (!reason.trim()) {
      setError('Reason required.');
      return;
    }
    await runAction(() => adminDisableUser({ userId, reason }), 'User disabled.');
  };

  const handleEnable = async () => {
    if (!reason.trim()) {
      setError('Reason required.');
      return;
    }
    await runAction(() => adminEnableUser({ userId, reason }), 'User enabled.');
  };

  const handleSoftDelete = async () => {
    if (!reason.trim()) {
      setError('Reason required.');
      return;
    }
    await runAction(() => adminSoftDeleteUser({ userId, reason }), 'User soft-deleted.');
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{summary.email ?? summary.id}</Text>
        <Pressable onPress={onClose} accessibilityLabel="close-user-detail">
          <Text style={styles.closeBtn}>✕</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {loading && <Text style={styles.muted}>Loading detail…</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {actionMsg && <Text style={styles.success}>{actionMsg}</Text>}

        <Text style={styles.row}>
          <Text style={styles.label}>ADMIN? </Text>
          <Text style={styles.value}>{summary.admin ? 'true' : 'false'}</Text>
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>BOT? </Text>
          <Text style={styles.value}>{summary.isBot ? 'true' : 'false'}</Text>
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Role: </Text>
          <Text style={styles.value}>{summary.role}</Text>
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Display: </Text>
          <Text style={styles.value}>{summary.displayName ?? '(none)'}</Text>
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Created: </Text>
          <Text style={styles.value}>{summary.createdAt ?? '(unknown)'}</Text>
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Last sign-in: </Text>
          <Text style={styles.value}>{summary.lastSignInAt ?? '(never)'}</Text>
        </Text>
        {summary.bannedUntil && (
          <Text style={styles.row}>
            <Text style={styles.label}>Banned until: </Text>
            <Text style={styles.value}>{summary.bannedUntil}</Text>
          </Text>
        )}
        {detail?.bot && (
          <Text style={styles.row}>
            <Text style={styles.label}>Bot label: </Text>
            <Text style={styles.value}>{detail.bot.label}</Text>
          </Text>
        )}
        {detail && (
          <Text style={styles.row}>
            <Text style={styles.label}>Argument count: </Text>
            <Text style={styles.value}>{detail.argumentCount}</Text>
          </Text>
        )}

        <Text style={styles.section}>Action reason</Text>
        <TextInput
          style={styles.input}
          placeholder="Reason for action (required)"
          value={reason}
          onChangeText={setReason}
          accessibilityLabel="action-reason"
        />

        <Text style={styles.section}>Role</Text>
        <View style={styles.actionRow}>
          {!summary.admin && (
            <Pressable
              style={[styles.checkbox, confirmAdminGrant && styles.checkboxOn]}
              onPress={() => setConfirmAdminGrant((v) => !v)}
              accessibilityLabel="confirm-admin-grant"
            >
              <Text style={styles.checkboxText}>
                {confirmAdminGrant ? '☑' : '☐'} Confirm admin grant
              </Text>
            </Pressable>
          )}
          <Pressable
            style={styles.btn}
            onPress={handleToggleAdmin}
            accessibilityLabel="toggle-admin-role"
          >
            <Text style={styles.btnText}>
              {summary.admin ? 'Demote to user' : 'Promote to admin'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Password</Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.btn} onPress={handlePasswordReset} accessibilityLabel="send-password-reset">
            <Text style={styles.btnText}>Send password reset</Text>
          </Pressable>
        </View>
        {summary.isBot && (
          <View style={styles.actionRow}>
            <TextInput
              style={[styles.input, styles.inlineInput]}
              placeholder="Temp password (bot only)"
              value={tempPassword}
              onChangeText={setTempPassword}
              secureTextEntry
              accessibilityLabel="temp-password"
            />
            <Pressable
              style={styles.btn}
              onPress={handleTempPassword}
              accessibilityLabel="set-temp-password"
            >
              <Text style={styles.btnText}>Set temp password</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.section}>Account state</Text>
        <View style={styles.actionRow}>
          {summary.bannedUntil ? (
            <Pressable style={styles.btn} onPress={handleEnable} accessibilityLabel="enable-user">
              <Text style={styles.btnText}>Enable user</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.btnDanger} onPress={handleDisable} accessibilityLabel="disable-user">
              <Text style={styles.btnText}>Disable user</Text>
            </Pressable>
          )}
          <Pressable style={styles.btnDanger} onPress={handleSoftDelete} accessibilityLabel="soft-delete-user">
            <Text style={styles.btnText}>Soft delete</Text>
          </Pressable>
        </View>

        {detail && detail.recentArguments.length > 0 && (
          <>
            <Text style={styles.section}>Recent arguments ({detail.recentArguments.length})</Text>
            {detail.recentArguments.slice(0, 5).map((a) => (
              <View key={a.id} style={styles.subRow}>
                <Text style={styles.subRowLabel}>{a.argument_type} • {a.side}</Text>
                <Text style={styles.subRowBody} numberOfLines={2}>{a.body}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    maxHeight: 460,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  closeBtn: { fontSize: 16, color: '#6b7280', padding: 4 },
  body: { flex: 1 },
  bodyContent: { padding: 10 },
  muted: { color: '#6b7280', fontSize: 12 },
  error: { color: '#dc2626', fontSize: 12, padding: 6, backgroundColor: '#fef2f2', borderRadius: 6, marginBottom: 6 },
  success: { color: '#16a34a', fontSize: 12, padding: 6, backgroundColor: '#f0fdf4', borderRadius: 6, marginBottom: 6 },
  row: { fontSize: 12, color: '#374151', marginBottom: 2 },
  label: { color: '#6b7280', fontWeight: '600' },
  value: { color: '#111827' },
  section: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 6, fontSize: 12, marginBottom: 6 },
  inlineInput: { flex: 1, marginRight: 6, marginBottom: 0 },
  actionRow: { flexDirection: 'row', gap: 6, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' },
  btn: { backgroundColor: '#6366f1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnDanger: { backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  checkbox: { paddingHorizontal: 8, paddingVertical: 6 },
  checkboxOn: {},
  checkboxText: { fontSize: 12, color: '#374151' },
  subRow: { padding: 6, backgroundColor: '#f9fafb', borderRadius: 6, marginBottom: 4 },
  subRowLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  subRowBody: { fontSize: 12, color: '#111827' },
});
