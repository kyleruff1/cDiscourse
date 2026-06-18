import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { TextInputField } from '../../components/TextInputField';
import { ErrorNotice } from '../../components/ErrorNotice';
import { SUPABASE_CONFIGURED } from '../../lib/supabase';
import { validateAuthInput } from './authApi';
import { useAuthSession } from './useAuthSession';
import { SURFACE_TOKENS, CONTROL, BRAND } from '../../lib/designTokens';
import { AUTH_FIRST_RUN_COPY } from '../../lib/brandCopy';

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

      {/* UX-COPY-001 — first-run / sign-in clarity (folds UX-FIRST-RUN-001).
          Explains the product at a glance before sign-up: the brand, the v4
          primary tagline, the three-beat value line, and the mediator-not-a-
          judge framing. No voice copy (voice is not shipped).
          UX-BRAND-001 — presented as a restrained premium card: a soft gold
          surface tint + gold hairline, a small gold accent rule, and the lead
          in antique gold (contrast-safe at 8.3:1 on the dark backdrop). */}
      <View style={styles.valueProp} testID="auth-value-prop">
        <View style={styles.valuePropAccent} testID="auth-value-prop-accent" />
        <Text style={styles.valuePropBrand} testID="auth-value-prop-brand">
          {AUTH_FIRST_RUN_COPY.brand}
        </Text>
        <Text style={styles.valuePropLead} testID="auth-value-prop-lead">
          {AUTH_FIRST_RUN_COPY.tagline}
        </Text>
        <Text style={styles.valuePropBody} testID="auth-value-prop-subline">
          {AUTH_FIRST_RUN_COPY.subline}
        </Text>
        <Text style={styles.valuePropBody} testID="auth-value-prop-footer">
          {AUTH_FIRST_RUN_COPY.mediatorFooter}
        </Text>
      </View>

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
  confirmTitle: { fontSize: 20, fontWeight: '700', color: SURFACE_TOKENS.textPrimary, marginBottom: 12 },
  confirmBody: { fontSize: 15, color: SURFACE_TOKENS.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  emailHighlight: { color: CONTROL.primary.bg, fontWeight: '600' },
  // UX-BRAND-001 — premium value-prop card: soft gold surface tint + gold
  // hairline border, generous padding, with a small gold accent rule above the
  // lead. Restrained — gold is the lead + the thin rule + the card edge only.
  valueProp: {
    marginBottom: 20,
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: BRAND.accent.goldSoft,
    borderWidth: 1,
    borderColor: BRAND.accent.goldBorder,
  },
  valuePropAccent: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: BRAND.accent.gold,
  },
  // Product wordmark on the first-run card — cream, editorial weight,
  // so the brand reads first. Cream (text.primary) clears AA on the
  // dark backdrop (>14:1).
  valuePropBrand: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: BRAND.text.primary,
  },
  // Antique-gold lead, editorial weight + letter-spacing. Contrast-safe
  // (~8.3:1 on the dark backdrop — clears AA + AAA for normal text).
  valuePropLead: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.accent.gold,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  // Body stays the readable neutral secondary tone — legibility over color.
  valuePropBody: { fontSize: 14, color: SURFACE_TOKENS.textSecondary, lineHeight: 21 },
});
