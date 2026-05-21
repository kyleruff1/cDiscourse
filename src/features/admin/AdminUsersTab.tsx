import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAdminUsers } from './useAdminUsers';
import { AdminUserDetailPanel } from './AdminUserDetailPanel';
import { AdminCreateUserForm } from './AdminCreateUserForm';
import type { AdminUserSummary } from './types';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

export function AdminUsersTab() {
  const { users, loading, error, refresh, search, setSearch, role, setRole, botOnly, setBotOnly } =
    useAdminUsers();
  const [selected, setSelected] = useState<AdminUserSummary | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search email, name, or id…"
          placeholderTextColor={SURFACE_TOKENS.placeholder}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          accessibilityLabel="admin-users-search"
        />
        <Pressable
          style={[styles.chip, role === undefined && styles.chipActive]}
          onPress={() => setRole(undefined)}
          accessibilityLabel="filter-all-roles"
        >
          <Text style={[styles.chipText, role === undefined && styles.chipTextActive]}>All</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, role === 'admin' && styles.chipActive]}
          onPress={() => setRole('admin')}
          accessibilityLabel="filter-admins"
        >
          <Text style={[styles.chipText, role === 'admin' && styles.chipTextActive]}>Admins</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, botOnly && styles.chipActive]}
          onPress={() => setBotOnly(!botOnly)}
          accessibilityLabel="filter-bots"
        >
          <Text style={[styles.chipText, botOnly && styles.chipTextActive]}>Bots only</Text>
        </Pressable>
        <Pressable
          style={styles.refreshBtn}
          onPress={refresh}
          accessibilityLabel="refresh-users"
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
        <Pressable
          style={[styles.refreshBtn, styles.createBtn]}
          onPress={() => setCreating((v) => !v)}
          accessibilityLabel="open-create-user-form"
        >
          <Text style={[styles.refreshText, styles.createText]}>{creating ? 'Cancel' : '+ New'}</Text>
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
        {loading && users.length === 0 ? (
          <Text style={styles.loading}>Loading users…</Text>
        ) : null}
        {users.map((u) => (
          <Pressable
            key={u.id}
            style={[styles.row, selected?.id === u.id && styles.rowSelected]}
            onPress={() => setSelected(u)}
            accessibilityLabel={`user-row-${u.id}`}
          >
            <View style={styles.rowMain}>
              <Text style={styles.email} numberOfLines={1}>
                {u.email ?? '(no email)'}
              </Text>
              <Text style={styles.displayName} numberOfLines={1}>
                {u.displayName ?? '(no display name)'}
              </Text>
            </View>
            <View style={styles.rowBadges}>
              {u.admin && (
                <View style={[styles.badge, styles.badgeAdmin]}>
                  <Text style={styles.badgeText}>ADMIN</Text>
                </View>
              )}
              {u.isBot && (
                <View style={[styles.badge, styles.badgeBot]}>
                  <Text style={styles.badgeText}>BOT</Text>
                </View>
              )}
              {u.bannedUntil && (
                <View style={[styles.badge, styles.badgeBanned]}>
                  <Text style={styles.badgeText}>DISABLED</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
        {!loading && users.length === 0 && !error && (
          <Text style={styles.loading}>No users match.</Text>
        )}
      </ScrollView>

      {selected && (
        <AdminUserDetailPanel
          userId={selected.id}
          summary={selected}
          onClose={() => setSelected(null)}
          onAction={() => {
            refresh();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 6,
    backgroundColor: SURFACE_TOKENS.raised,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
  },
  searchInput: {
    flex: 1,
    minWidth: 180,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: SURFACE_TOKENS.textPrimary,
    backgroundColor: SURFACE_TOKENS.inputBg,
  },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: SURFACE_TOKENS.raised },
  chipActive: { backgroundColor: STATUS.info.bg },
  chipText: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, fontWeight: '500' },
  chipTextActive: { color: STATUS.info.fg, fontWeight: '700' },
  refreshBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: CONTROL.primary.bg,
  },
  createBtn: { backgroundColor: STATUS.success.bg },
  refreshText: { fontSize: 12, color: CONTROL.primary.fg, fontWeight: '700' },
  createText: { color: STATUS.success.fg },
  error: { color: STATUS.danger.fg, fontSize: 13, padding: 10, backgroundColor: STATUS.danger.bg },
  loading: { color: SURFACE_TOKENS.textSecondary, fontSize: 13, padding: 12, textAlign: 'center' },
  list: { flex: 1 },
  listContent: { padding: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SURFACE_TOKENS.elevated, padding: 10, borderRadius: 8, marginBottom: 4,
    borderWidth: 1, borderColor: SURFACE_TOKENS.border,
  },
  rowSelected: { borderColor: CONTROL.primary.bg, backgroundColor: SURFACE_TOKENS.raised },
  rowMain: { flex: 1, minWidth: 0 },
  email: { fontSize: 13, color: SURFACE_TOKENS.textPrimary, fontWeight: '500' },
  displayName: { fontSize: 11, color: SURFACE_TOKENS.textSecondary },
  rowBadges: { flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeAdmin: { backgroundColor: STATUS.info.bg },
  badgeBot: { backgroundColor: STATUS.neutral.bg },
  badgeBanned: { backgroundColor: STATUS.danger.bg },
  badgeText: { fontSize: 9, fontWeight: '700', color: SURFACE_TOKENS.textPrimary, letterSpacing: 0.5 },
});
