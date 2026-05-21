import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { adminCreateUser, adminCreateBotUser, adminInviteUser, adminErrorMessage } from './adminApi';
import {
  isInvitingHuman,
  isModeToggleVisible,
  isPasswordFieldVisible,
  resolveCreateUserDispatch,
} from './adminHelpers';
import type { CreateUserMode } from './adminHelpers';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export function AdminCreateUserForm({ onCreated, onCancel }: Props) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isBot, setIsBot] = useState(true);
  const [mode, setMode] = useState<CreateUserMode>('invite');
  const [persona, setPersona] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // The invite branch applies only to a human account; a bot always gets a
  // password (auto-generated if blank), so invite is meaningless for a bot.
  const invitingHuman = isInvitingHuman(isBot, mode);
  const showModeToggle = isModeToggleVisible(isBot);
  const showPassword = isPasswordFieldVisible(isBot, mode);

  const handleCreate = async () => {
    setError(null);
    setStatus(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Valid email required.');
      return;
    }
    setBusy(true);
    const dispatch = resolveCreateUserDispatch(isBot, mode);
    const fn =
      dispatch === 'bot'
        ? () => adminCreateBotUser({
            label: label.trim() || displayName.trim() || email.trim(),
            email: email.trim(),
            password: password || undefined,
            persona: persona.trim() || undefined,
            displayName: displayName.trim() || undefined,
            enabled: true,
          })
        : dispatch === 'invite'
          ? () => adminInviteUser({
              email: email.trim(),
              displayName: displayName.trim() || undefined,
              role: 'user',
            })
          : () => adminCreateUser({
              email: email.trim(),
              password: password || undefined,
              displayName: displayName.trim() || undefined,
              role: 'user',
              isBot: false,
              emailConfirm: true,
            });
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      setEmail(''); setDisplayName(''); setPassword(''); setPersona(''); setLabel('');
      if (invitingHuman) setStatus('Invite sent.');
      onCreated();
    } else {
      setError(adminErrorMessage(r.error, r.status));
    }
  };

  return (
    <View style={styles.form} accessibilityLabel="create-user-form">
      <Text style={styles.title}>Create {isBot ? 'bot' : 'user'}</Text>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, !isBot && styles.toggleActive]}
          onPress={() => setIsBot(false)}
          accessibilityLabel="create-human-toggle"
        >
          <Text style={[styles.toggleText, !isBot && styles.toggleTextActive]}>Human</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, isBot && styles.toggleActive]}
          onPress={() => setIsBot(true)}
          accessibilityLabel="create-bot-toggle"
        >
          <Text style={[styles.toggleText, isBot && styles.toggleTextActive]}>Bot / Test</Text>
        </Pressable>
      </View>
      {showModeToggle && (
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggle, mode === 'invite' && styles.toggleActive]}
            onPress={() => setMode('invite')}
            accessibilityLabel="invite-mode-toggle"
          >
            <Text style={[styles.toggleText, mode === 'invite' && styles.toggleTextActive]}>Invite by email</Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, mode === 'password' && styles.toggleActive]}
            onPress={() => setMode('password')}
            accessibilityLabel="password-mode-toggle"
          >
            <Text style={[styles.toggleText, mode === 'password' && styles.toggleTextActive]}>Create with password</Text>
          </Pressable>
        </View>
      )}
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={SURFACE_TOKENS.placeholder} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" accessibilityLabel="new-user-email" />
      <TextInput style={styles.input} placeholder="Display name (optional)" placeholderTextColor={SURFACE_TOKENS.placeholder} value={displayName} onChangeText={setDisplayName} accessibilityLabel="new-user-display-name" />
      {isBot && (
        <>
          <TextInput style={styles.input} placeholder="Bot label" placeholderTextColor={SURFACE_TOKENS.placeholder} value={label} onChangeText={setLabel} accessibilityLabel="new-bot-label" />
          <TextInput style={styles.input} placeholder="Bot persona (optional)" placeholderTextColor={SURFACE_TOKENS.placeholder} value={persona} onChangeText={setPersona} accessibilityLabel="new-bot-persona" />
        </>
      )}
      {showPassword && (
        <TextInput
          style={styles.input}
          placeholder={isBot ? 'Password (optional — auto-generated if blank)' : 'Password (optional — recovery email if blank)'}
          placeholderTextColor={SURFACE_TOKENS.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          accessibilityLabel="new-user-password"
        />
      )}
      <Text style={styles.notice}>
        {invitingHuman
          ? 'An invite email will be sent. The new user sets their own password.'
          : `Passwords are never logged. ${isBot ? 'Bot accounts are test/dev only.' : 'Human accounts should use recovery email when possible.'}`}
      </Text>
      {status && <Text style={styles.status} accessibilityLabel="invite-status">{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleCreate} disabled={busy} accessibilityLabel="submit-create-user">
          <Text style={styles.btnPrimaryText}>
            {invitingHuman ? (busy ? 'Sending…' : 'Send invite') : (busy ? 'Creating…' : 'Create')}
          </Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onCancel} accessibilityLabel="cancel-create-user">
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { backgroundColor: SURFACE_TOKENS.base, padding: 10, borderBottomWidth: 1, borderBottomColor: SURFACE_TOKENS.border },
  title: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textPrimary, marginBottom: 6 },
  toggleRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  toggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: SURFACE_TOKENS.elevated, borderWidth: 1, borderColor: SURFACE_TOKENS.inputBorder },
  toggleActive: { backgroundColor: STATUS.info.bg, borderColor: CONTROL.primary.bg },
  toggleText: { fontSize: 11, color: SURFACE_TOKENS.textSecondary },
  toggleTextActive: { color: STATUS.info.fg, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: SURFACE_TOKENS.inputBorder, borderRadius: 6, padding: 6, fontSize: 12, marginBottom: 6, backgroundColor: SURFACE_TOKENS.inputBg, color: SURFACE_TOKENS.textPrimary },
  notice: { fontSize: 10, color: SURFACE_TOKENS.textSecondary, marginBottom: 6, fontStyle: 'italic' },
  status: { color: STATUS.success.fg, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  error: { color: STATUS.danger.fg, fontSize: 12, marginBottom: 6 },
  actions: { flexDirection: 'row', gap: 6 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, backgroundColor: SURFACE_TOKENS.raised },
  btnPrimary: { backgroundColor: CONTROL.primary.bg },
  btnText: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, fontWeight: '600' },
  btnPrimaryText: { fontSize: 12, color: CONTROL.primary.fg, fontWeight: '700' },
});
