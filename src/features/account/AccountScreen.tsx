import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAppSession } from '../session/useAppSession';
import { useAccountProfile } from './useAccountProfile';
import { fetchCurrentAuthUser, formatProfileRole } from './accountApi';
import { SUPABASE_CONFIGURED } from '../../lib/supabase';

interface Props {
  onSignOut: () => Promise<void>;
  signOutLoading: boolean;
}

export function AccountScreen({ onSignOut, signOutLoading }: Props) {
  const { state } = useAppSession();
  const userId = state.snapshot.userId;

  const { profile, loading, error, saving, saveError, updateDisplayName } =
    useAccountProfile(userId);

  const [email, setEmail] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    void fetchCurrentAuthUser().then((u) => {
      if (u) setEmail(u.email);
    });
  }, []);

  const handleEditStart = () => {
    setDraftName(profile?.displayName ?? '');
    setEditingName(true);
    setSavedNotice(false);
  };

  const handleSave = async () => {
    if (!draftName.trim()) return;
    const ok = await updateDisplayName(draftName);
    if (ok) {
      setEditingName(false);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    }
  };

  const handleCancel = () => {
    setEditingName(false);
    setSavedNotice(false);
  };

  if (!SUPABASE_CONFIGURED) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Supabase not configured. Fill in .env to use account features.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Account</Text>

      {loading && !profile && (
        <ActivityIndicator style={{ marginTop: 24 }} color="#6366f1" />
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            If this persists, your profile row may be missing. Use the Supabase Dashboard to backfill it.
          </Text>
        </View>
      )}

      {profile && (
        <>
          <View style={styles.card}>
            <Row label="User ID" value={`…${userId?.slice(-8) ?? '—'}`} />
            <Row label="Email" value={email ?? 'Loading…'} />
            <Row label="Role" value={formatProfileRole(profile.role)} />
            <Row label="ADMIN?" value={profile.role === 'admin' ? 'true' : 'false'} />

            <View style={styles.nameRow}>
              <Text style={styles.rowLabel}>Display name</Text>
              {editingName ? (
                <View style={styles.nameEdit}>
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    style={styles.nameInput}
                    autoFocus
                    autoCapitalize="words"
                    maxLength={60}
                    accessibilityLabel="Display name"
                  />
                  <View style={styles.nameActions}>
                    <Pressable
                      onPress={handleSave}
                      disabled={saving || !draftName.trim()}
                      style={[styles.saveBtn, (saving || !draftName.trim()) && styles.saveBtnDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel="Save display name"
                    >
                      <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCancel}
                      style={styles.cancelBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel edit"
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                  {saveError && <Text style={styles.saveError}>{saveError}</Text>}
                </View>
              ) : (
                <View style={styles.nameDisplay}>
                  <Text style={styles.rowValue}>
                    {profile.displayName ?? <Text style={styles.placeholder}>Not set</Text>}
                  </Text>
                  <Pressable
                    onPress={handleEditStart}
                    style={styles.editBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Edit display name"
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {savedNotice && (
              <Text style={styles.savedNotice}>Display name saved.</Text>
            )}
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteText}>
              Role changes and account management are handled through the Supabase Dashboard. See{' '}
              <Text style={styles.noteCode}>docs/account-operations.md</Text> for backend ops.
            </Text>
          </View>
        </>
      )}

      <Pressable
        onPress={onSignOut}
        disabled={signOutLoading}
        style={[styles.signOutButton, signOutLoading && styles.signOutDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.signOutLabel}>{signOutLoading ? 'Signing out…' : 'Sign Out'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  rowValue: { fontSize: 13, color: '#111827', fontWeight: '600', maxWidth: '65%', textAlign: 'right' },
  placeholder: { color: '#9ca3af', fontStyle: 'italic' },
  nameRow: { paddingVertical: 4 },
  nameDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  nameEdit: { marginTop: 8, gap: 8 },
  nameInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  nameActions: { flexDirection: 'row', gap: 8 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#a5b4fc' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  saveError: { fontSize: 12, color: '#b91c1c', marginTop: 4 },
  savedNotice: { fontSize: 12, color: '#059669', textAlign: 'center', marginTop: 4 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f3f4f6' },
  editBtnText: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  noteCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    marginBottom: 24,
  },
  noteText: { fontSize: 12, color: '#166534', lineHeight: 18 },
  noteCode: { fontFamily: 'monospace', fontSize: 11 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#b91c1c', fontWeight: '600', marginBottom: 4 },
  errorHint: { fontSize: 12, color: '#991b1b', lineHeight: 18 },
  signOutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutDisabled: { opacity: 0.45 },
  signOutLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
