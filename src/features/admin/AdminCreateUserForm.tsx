import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { adminCreateUser, adminCreateBotUser, adminErrorMessage } from './adminApi';

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export function AdminCreateUserForm({ onCreated, onCancel }: Props) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isBot, setIsBot] = useState(true);
  const [persona, setPersona] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Valid email required.');
      return;
    }
    setBusy(true);
    const fn = isBot
      ? () => adminCreateBotUser({
          label: label.trim() || displayName.trim() || email.trim(),
          email: email.trim(),
          password: password || undefined,
          persona: persona.trim() || undefined,
          displayName: displayName.trim() || undefined,
          enabled: true,
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
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" accessibilityLabel="new-user-email" />
      <TextInput style={styles.input} placeholder="Display name (optional)" value={displayName} onChangeText={setDisplayName} accessibilityLabel="new-user-display-name" />
      {isBot && (
        <>
          <TextInput style={styles.input} placeholder="Bot label" value={label} onChangeText={setLabel} accessibilityLabel="new-bot-label" />
          <TextInput style={styles.input} placeholder="Bot persona (optional)" value={persona} onChangeText={setPersona} accessibilityLabel="new-bot-persona" />
        </>
      )}
      <TextInput
        style={styles.input}
        placeholder={isBot ? 'Password (optional — auto-generated if blank)' : 'Password (optional — recovery email if blank)'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        accessibilityLabel="new-user-password"
      />
      <Text style={styles.notice}>
        Passwords are never logged. {isBot ? 'Bot accounts are test/dev only.' : 'Human accounts should use recovery email when possible.'}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleCreate} disabled={busy} accessibilityLabel="submit-create-user">
          <Text style={styles.btnPrimaryText}>{busy ? 'Creating…' : 'Create'}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onCancel} accessibilityLabel="cancel-create-user">
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { backgroundColor: '#f9fafb', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 6 },
  toggleRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  toggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  toggleActive: { backgroundColor: '#ede9fe', borderColor: '#6366f1' },
  toggleText: { fontSize: 11, color: '#374151' },
  toggleTextActive: { color: '#6366f1', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 6, fontSize: 12, marginBottom: 6, backgroundColor: '#fff' },
  notice: { fontSize: 10, color: '#6b7280', marginBottom: 6, fontStyle: 'italic' },
  error: { color: '#dc2626', fontSize: 12, marginBottom: 6 },
  actions: { flexDirection: 'row', gap: 6 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, backgroundColor: '#e5e7eb' },
  btnPrimary: { backgroundColor: '#6366f1' },
  btnText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  btnPrimaryText: { fontSize: 12, color: '#fff', fontWeight: '700' },
});
