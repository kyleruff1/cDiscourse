import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { TextInputField } from '../../components/TextInputField';
import { ErrorNotice } from '../../components/ErrorNotice';
import { SUPABASE_CONFIGURED } from '../../lib/supabase';
import { validateAuthInput } from './authApi';
import { useAuthSession } from './useAuthSession';

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const { loading, error: authError, signIn, signUp } = useAuthSession();

  const handleSubmit = async () => {
    const vErr = validateAuthInput(email.trim(), password);
    if (vErr) {
      setValidationError(vErr);
      return;
    }
    setValidationError(null);

    if (mode === 'signin') {
      await signIn(email.trim(), password);
    } else {
      const result = await signUp(email.trim(), password, displayName.trim() || undefined);
      if (result.ok) setEmailSent(true);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setValidationError(null);
    setEmailSent(false);
  };

  if (emailSent) {
    return (
      <Screen title="Check your email">
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>Confirmation email sent</Text>
          <Text style={styles.confirmBody}>
            We sent a link to <Text style={styles.emailHighlight}>{email}</Text>.
            {'\n\n'}Open the link to activate your account, then return here to sign in.
          </Text>
          <Button label="Back to Sign In" onPress={() => { setEmailSent(false); setMode('signin'); }} />
        </View>
      </Screen>
    );
  }

  const displayError = validationError ?? authError;

  return (
    <Screen title={mode === 'signin' ? 'Sign In' : 'Create Account'}>
      {!SUPABASE_CONFIGURED && (
        <ErrorNotice message="Supabase is not configured. Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY." />
      )}

      <TextInputField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
      />

      <TextInputField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="At least 6 characters"
      />

      {mode === 'signup' && (
        <TextInputField
          label="Display name (optional)"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How others will see you"
        />
      )}

      {displayError ? <ErrorNotice message={displayError} /> : null}

      <Button
        label={mode === 'signin' ? 'Sign In' : 'Create Account'}
        onPress={handleSubmit}
        loading={loading}
        disabled={!email || !password}
      />

      <Button
        label={mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        variant="secondary"
        onPress={toggleMode}
        disabled={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  confirmBox: { alignItems: 'center', paddingTop: 20 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  confirmBody: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  emailHighlight: { color: '#6366f1', fontWeight: '600' },
});
