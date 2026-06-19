import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { TextInputField } from '../../components/TextInputField';
import { ErrorNotice } from '../../components/ErrorNotice';
import { SUPABASE_CONFIGURED } from '../../lib/supabase';
import { validateAuthInput } from './authApi';
import { useAuthSession } from './useAuthSession';
import {
  resolveSignInLockupWidthPx,
  resolveSignInLockupHeightPx,
} from './signInLockupModel';
import { SURFACE_TOKENS, CONTROL, BRAND } from '../../lib/designTokens';
import { AUTH_FIRST_RUN_COPY } from '../../lib/brandCopy';

// UX-BRAND-ASSETS-001 — the cream "CivilDiscourse" horizontal lockup
// (swan-on-rock outline + wordmark) rendered on the Sign In hero ONLY.
// The masthead/header logo (`civic-discourse-logo.png` wired into
// AppHeader) is a SEPARATE asset and is untouched by this card.
const SIGNIN_LOCKUP = require('../../../assets/branding/lockup-horizontal.png');

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const { loading, error: authError, signIn, signUp } = useAuthSession();
  // UX-BRAND-ASSETS-001 — responsive lockup width: clamped to the card's
  // available width and capped so the cream mark never overflows or
  // creates a mobile edge gutter at any viewport.
  const { width: viewportWidth } = useWindowDimensions();
  const lockupWidthPx = resolveSignInLockupWidthPx(viewportWidth);
  const lockupHeightPx = resolveSignInLockupHeightPx(viewportWidth);

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
          QUICK-COPY-001 — the value-prop card is now the brand lockup + the v4
          primary tagline ("A high-trust room for hard conversations.") only.
          The three-beat sub-explanation and the mediator-not-a-judge footer
          were removed and their reserved vertical space collapsed. No voice
          copy (voice is not shipped).
          UX-BRAND-001 — presented as a restrained premium card: a soft gold
          surface tint + gold hairline, a small gold accent rule, and the lead
          in antique gold (contrast-safe at 8.3:1 on the dark backdrop).
          UX-BRAND-ASSETS-001 — the visible TEXT brand wordmark is replaced by
          the cream horizontal lockup IMAGE (swan-on-rock + "CivilDiscourse"
          wordmark) on a dark brand-field backing band so the cream art reads
          like the on-black reference. The image carries the brand name via
          accessibilityLabel so screen readers still announce it; there is NO
          duplicate visible text wordmark. The header logo is untouched. */}
      <View style={styles.valueProp} testID="auth-value-prop">
        <View style={styles.lockupBacking} testID="auth-brand-lockup-backing">
          <Image
            source={SIGNIN_LOCKUP}
            // Responsive: width is clamped to the card's available width and
            // capped (resolveSignInLockupWidthPx). The height is set EXPLICITLY
            // from the width (resolveSignInLockupHeightPx = width / aspect)
            // because React Native Web does NOT honor an `aspectRatio` style to
            // derive an Image's height from its width — relying on it strands
            // the cream art in a box sized to the PNG's intrinsic 388px height.
            // `contain` still guards against any sub-pixel drift; maxWidth caps
            // the Image so it can never exceed its container.
            style={{
              width: lockupWidthPx,
              height: lockupHeightPx,
              maxWidth: '100%',
            }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={AUTH_FIRST_RUN_COPY.brand}
            accessible
            testID="auth-brand-lockup"
          />
        </View>
        <View style={styles.valuePropAccent} testID="auth-value-prop-accent" />
        <Text style={styles.valuePropLead} testID="auth-value-prop-lead">
          {AUTH_FIRST_RUN_COPY.tagline}
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
  // UX-BRAND-ASSETS-001 — dark backing band for the cream lockup. The
  // value-prop card sits on a 10%-opacity gold tint over the near-black
  // app field; this explicit `BRAND.surface.app.bg` band guarantees the
  // cream art reads like the on-black reference regardless of the card
  // tint. Self-stretch + flex-start so the contained mark sits middle-left
  // on its own dark plate. The lockup art is the cream `BRAND.text.primary`
  // tone on the `surface.app` field, which clears AA by a wide margin
  // (>14:1).
  lockupBacking: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: BRAND.surface.app.bg,
    marginBottom: 2,
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
});
