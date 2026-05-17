import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminViewAsTab } from './AdminViewAsTab';
import { AdminHistoryTab } from './AdminHistoryTab';
import { AdminBlocksTab } from './AdminBlocksTab';
import { AdminBotUsersTab } from './AdminBotUsersTab';
import { AdminArgumentsTab } from './AdminArgumentsTab';
import type { AdminTab } from './types';
import { ADMIN_TAB_LABELS } from './types';

const TABS: AdminTab[] = ['users', 'view_as', 'history', 'blocks', 'bot_users', 'arguments'];

export function AdminScreen() {
  const [tab, setTab] = useState<AdminTab>('users');

  return (
    <View style={styles.container}>
      <View style={styles.subtabs}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            style={[styles.subtab, tab === t && styles.subtabActive]}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityLabel={`admin-tab-${t}`}
          >
            <Text style={[styles.subtabText, tab === t && styles.subtabTextActive]}>
              {ADMIN_TAB_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.body}>
        {tab === 'users' && <AdminUsersTab />}
        {tab === 'view_as' && <AdminViewAsTab />}
        {tab === 'history' && <AdminHistoryTab />}
        {tab === 'blocks' && <AdminBlocksTab />}
        {tab === 'bot_users' && <AdminBotUsersTab />}
        {tab === 'arguments' && <AdminArgumentsTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subtabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  subtab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  subtabActive: { borderBottomWidth: 2, borderBottomColor: '#dc2626' },
  subtabText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  subtabTextActive: { color: '#dc2626', fontWeight: '700' },
  body: { flex: 1 },
});
