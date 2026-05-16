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
          <Text style={styles.refreshText}>{creating ? 'Cancel' : '+ New'}</Text>
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
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    minWidth: 180,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#ede9fe' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#6366f1', fontWeight: '700' },
  refreshBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#6366f1',
  },
  createBtn: { backgroundColor: '#10b981' },
  refreshText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  error: { color: '#dc2626', fontSize: 13, padding: 10, backgroundColor: '#fef2f2' },
  loading: { color: '#6b7280', fontSize: 13, padding: 12, textAlign: 'center' },
  list: { flex: 1 },
  listContent: { padding: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 4,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  rowSelected: { borderColor: '#6366f1', backgroundColor: '#f0f0ff' },
  rowMain: { flex: 1, minWidth: 0 },
  email: { fontSize: 13, color: '#111827', fontWeight: '500' },
  displayName: { fontSize: 11, color: '#6b7280' },
  rowBadges: { flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeAdmin: { backgroundColor: '#ede9fe' },
  badgeBot: { backgroundColor: '#dbeafe' },
  badgeBanned: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#374151', letterSpacing: 0.5 },
});
