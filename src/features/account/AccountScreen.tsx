import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAppSession } from '../session/useAppSession';
import { useAccountProfile } from './useAccountProfile';
import { formatProfileRole } from './accountApi';
import { ContactInfoSection } from './ContactInfoSection';
import { SUPABASE_CONFIGURED } from '../../lib/supabase';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

interface Props {
  onSignOut: () => Promise<void>;
  signOutLoading: boolean;
}

export function AccountScreen({ onSignOut, signOutLoading }: Props) {
  const { state } = useAppSession();
  const userId = state.snapshot.userId;

  const { profile, loading, error, saving, saveError, updateDisplayName } =
    useAccountProfile(userId);

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
        <ActivityIndicator style={{ marginTop: 24 }} color={CONTROL.primary.bg} />
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
            <ContactInfoSection
              userId={userId}
              displayName={profile.displayName}
              saving={saving}
              saveError={saveError}
              onSaveDisplayName={updateDisplayName}
            />
            <Row label="User ID" value={`…${userId?.slice(-8) ?? '—'}`} />
            <Row label="Role" value={formatProfileRole(profile.role)} />
            <Row label="ADMIN?" value={profile.role === 'admin' ? 'true' : 'false'} />
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
  scroll: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: SURFACE_TOKENS.base },
  title: { fontSize: 22, fontWeight: '700', color: SURFACE_TOKENS.textPrimary, marginBottom: 20 },
  card: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
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
    borderBottomColor: SURFACE_TOKENS.divider,
  },
  rowLabel: { fontSize: 13, color: SURFACE_TOKENS.textSecondary, fontWeight: '500' },
  rowValue: { fontSize: 13, color: SURFACE_TOKENS.textPrimary, fontWeight: '600', maxWidth: '65%', textAlign: 'right' },
  noteCard: {
    backgroundColor: STATUS.success.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STATUS.success.fg,
    padding: 12,
    marginBottom: 24,
  },
  noteText: { fontSize: 12, color: STATUS.success.fg, lineHeight: 18 },
  noteCode: { fontFamily: 'monospace', fontSize: 11 },
  errorBox: {
    backgroundColor: STATUS.danger.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STATUS.danger.fg,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: STATUS.danger.fg, fontWeight: '600', marginBottom: 4 },
  errorHint: { fontSize: 12, color: STATUS.danger.fg, lineHeight: 18 },
  // Sign Out — destructive, bordered (not a full-bleed red flood) per BRAND-002.
  signOutButton: {
    backgroundColor: CONTROL.danger.bg,
    borderWidth: 1,
    borderColor: CONTROL.danger.borderColor,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutDisabled: { opacity: 0.45 },
  signOutLabel: { color: CONTROL.danger.fg, fontSize: 15, fontWeight: '700' },
});
