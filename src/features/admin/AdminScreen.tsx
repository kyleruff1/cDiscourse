import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminViewAsTab } from './AdminViewAsTab';
import { AdminHistoryTab } from './AdminHistoryTab';
import { AdminBlocksTab } from './AdminBlocksTab';
import { AdminBotUsersTab } from './AdminBotUsersTab';
import { AdminArgumentsTab } from './AdminArgumentsTab';
import { AdminDebatesTab } from './AdminDebatesTab';
import { AdminMetadataEventsTab } from './AdminMetadataEventsTab';
import { AdminSemanticRefereeTab } from './AdminSemanticRefereeTab';
import { AdminClassifierHealthTab } from './AdminClassifierHealthTab';
import type { AdminTab } from './types';
import { ADMIN_TAB_LABELS } from './types';
import { SURFACE_TOKENS, CONTROL } from '../../lib/designTokens';

const TABS: AdminTab[] = [
  'users',
  'view_as',
  'history',
  'blocks',
  'bot_users',
  'arguments',
  'debates',
  'metadata_events',
  'semantic_referee',
  'classifier_health',
];

export interface AdminScreenProps {
  /**
   * Optional callback fired when an admin clicks "Open timeline" inside
   * the Arguments tab. Forwarded down to `AdminArgumentsTab`. The host
   * (App.tsx) is responsible for switching the outer tab to Arguments,
   * setting the room view mode to 'timeline', and pre-activating the
   * argument via the entry-hint mechanism.
   */
  onOpenArgumentTimeline?: (debateId: string, argumentId: string) => void;
}

export function AdminScreen({ onOpenArgumentTimeline }: AdminScreenProps = {}) {
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
        {tab === 'arguments' && (
          <AdminArgumentsTab onOpenArgumentTimeline={onOpenArgumentTimeline} />
        )}
        {tab === 'debates' && <AdminDebatesTab />}
        {tab === 'metadata_events' && <AdminMetadataEventsTab />}
        {tab === 'semantic_referee' && <AdminSemanticRefereeTab />}
        {tab === 'classifier_health' && <AdminClassifierHealthTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  subtabs: {
    flexDirection: 'row',
    backgroundColor: SURFACE_TOKENS.raised,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
  },
  subtab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  subtabActive: { borderBottomWidth: 2, borderBottomColor: CONTROL.primary.bg },
  subtabText: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, fontWeight: '500' },
  subtabTextActive: { color: CONTROL.primary.bg, fontWeight: '700' },
  body: { flex: 1 },
});
