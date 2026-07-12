import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
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
import {
  resolveAuthProviderSlotRegion,
  CONTINUE_WITH_GOOGLE_LABEL,
} from './authProviderSlotModel';
import { resolveGoogleAuthEnabled } from './googleAuthGate';
import { signInWithGoogle } from './signInWithGoogle';

// UX-BRAND-ASSETS-001 — the cream "CivilDiscourse" horizontal lockup
// (swan-on-rock outline + wordmark) rendered on the Sign In hero ONLY.
// The masthead/header logo (`civic-discourse-logo.png` wired into
// AppHeader) is a SEPARATE asset and is untouched by this card.
const SIGNIN_LOCKUP = require('../../../assets/branding/lockup-horizontal.png');

// AUTH-GOOGLE-SSO-BRAND-001 (#778) — the OFFICIAL Google sign-in web button
// asset (light theme, rounded, continue-with variant — the multicolor G mark +
// Roboto wordmark are baked into the image by Google; the visible label text is
// the CONTINUE_WITH_GOOGLE_LABEL constant rendered by Google into the art,
// unmodified, light_rd_ctn @4x, 756×160 px, aspect 4.725). Per Google's brand
// guidelines this asset must NOT be recolored, redrawn, or distorted. The
// require path MUST match the SIGNIN_LOCKUP form above (`../../../assets/
// branding/`) so Metro/Netlify resolves it in the real web bundle — getting it
// wrong passes jest (mocked) but breaks the bundle, so it is verified via
// `npm run web:build`.
const GOOGLE_CONTINUE_LIGHT = require('../../../assets/branding/google-continue-light.png');
// The official asset is 756×160 (aspect 4.725). React Native Web does NOT honor
// an `aspectRatio` style to derive an Image's height from its width, so width is
// set EXPLICITLY from the height to preserve the official proportions exactly:
// 48 × 4.725 ≈ 227. `contain` guards against any sub-pixel drift.
const GOOGLE_BUTTON_HEIGHT = 48;
const GOOGLE_BUTTON_ASPECT = 4.725;
const GOOGLE_BUTTON_WIDTH = Math.round(GOOGLE_BUTTON_HEIGHT * GOOGLE_BUTTON_ASPECT);

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  // UX-PR-B (#918) — a failed Google sign-in initiation was previously silent
  // (the unawaited promise had no in-screen consumer). We now await the wrapper
  // and surface its message through the SAME ErrorNotice as the email flow.
  const [providerError, setProviderError] = useState<string | null>(null);

  const { loading, error: authError, signIn, signUp } = useAuthSession();
  // UX-BRAND-ASSETS-001 — responsive lockup width: clamped to the card's
  // available width and capped so the cream mark never overflows or
  // creates a mobile edge gutter at any viewport.
  const { width: viewportWidth } = useWindowDimensions();
  const lockupWidthPx = resolveSignInLockupWidthPx(viewportWidth);
  const lockupHeightPx = resolveSignInLockupHeightPx(viewportWidth);
  // UX-COPY-BATCH-002 (#740/#760) + AUTH-GOOGLE-SSO-003 (#746) — provider-slot
  // region. The model owns the layout decision; the screen stays thin. The
  // Google slot is lit ONLY when resolveGoogleAuthEnabled() is true (default
  // OFF: requires SUPABASE_CONFIGURED + the public EXPO_PUBLIC_GOOGLE_AUTH_ENABLED
  // flag === 'true', set by the operator in Netlify env post-#745). Until then
  // the surface stays email-only with zero re-layout.
  const googleEnabled = resolveGoogleAuthEnabled();
  const providerRegion = resolveAuthProviderSlotRegion(
    googleEnabled ? { enabledSlots: [{ id: 'google', order: 0, enabled: true }] } : undefined,
  );

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

  // UX-PR-B (#918) — the provider (Google) error joins the existing display
  // channel; it shows the wrappers message with the SAME parity as the email
  // flow (which also renders result.message). null when no provider attempt failed.
  const displayError = validationError ?? authError ?? providerError;

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
          surface tint + gold hairline and the lead in antique gold
          (contrast-safe at 8.3:1 on the dark backdrop).
          AUTH-GOOGLE-SSO-LAYOUT-001 (#780) — the small 40px gold accent rule
          under the lockup was removed (purposeless/asymmetric per operator);
          the valueProp `gap` already spaces the lockup + tagline.
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

      {/* AUTH-GOOGLE-SSO-LAYOUT-001 (#780) — email-first order: the SSO
          provider region + its divider now render BELOW the email Sign In
          button and ABOVE the Sign-up toggle (they previously sat above the
          email form). The divider leads INTO the SSO options, so its label is
          "or continue with SSO" (PROVIDER_SSO_DIVIDER_LABEL). The divider is
          decorative — the rules carry importantForAccessibility="no" and the
          label is plain Text (role text), never a Pressable. */}
      <View style={styles.providerDivider} testID="auth-provider-divider">
        <View style={styles.providerDividerRule} importantForAccessibility="no" />
        <Text style={styles.providerDividerLabel} accessibilityRole="text">
          {providerRegion.dividerLabel}
        </Text>
        <View style={styles.providerDividerRule} importantForAccessibility="no" />
      </View>

      {/* UX-COPY-BATCH-002 (#740/#760) — provider-slot region. The v1 DEFAULT
          surface is EMAIL-ONLY: NO provider button is rendered (the
          future-reserved Google slot is disabled, so rendering a button would
          imply an unimplemented capability — doctrine-forbidden). Instead the
          default path shows a future-framed "coming soon" notice (a Text, NOT
          a Pressable / Button). The layout/order/enabled decision lives in
          resolveAuthProviderSlotRegion() (pure model). NO provider call is
          possible from this render path (the provider sign-in call appears
          nowhere in this file).
          #746 (AUTH-GOOGLE-SSO-003) flips a slot to enabled and renders the
          real, wired provider button inside the SAME region — zero re-layout. */}
      <View style={styles.providerRegion} testID="auth-provider-slot-region">
        {providerRegion.hasVisibleProvider ? (
          // AUTH-GOOGLE-SSO-003 (#746) — live Google sign-in affordance.
          // Gated by resolveGoogleAuthEnabled() (default OFF). onPress initiates
          // the Google sign-in via the signInWithGoogle wrapper (the only file
          // that may name the provider call). The wrapper never throws, so the
          // unawaited promise has no in-screen consumer and no floating
          // rejection. The email/password form above is unchanged.
          //
          // AUTH-GOOGLE-SSO-BRAND-001 (#778) — the affordance is now the OFFICIAL
          // Google web button IMAGE (multicolor G + wordmark baked in by Google)
          // wrapped in a Pressable, replacing the generic text Button. The
          // Pressable carries the button role + the accessible name from the
          // CONTINUE_WITH_GOOGLE_LABEL constant (NOT a literal — keeps this file's
          // "no provider-button literal" source guard green); the Image is
          // decorative (accessible={false}) since its text is visual only. Touch
          // target is ≥44px tall (48 visible + hitSlop).
          <View testID="auth-provider-region">
            <Pressable
              onPress={() => {
                // UX-PR-B (#918) — clear any prior provider error on a fresh
                // attempt, then surface the wrappers message on failure. On
                // success the browser redirects away, so there is nothing to show.
                setProviderError(null);
                void (async () => {
                  const result = await signInWithGoogle();
                  if (!result.ok) {
                    setProviderError(result.message ?? 'Sign-in could not be started.');
                  }
                })();
              }}
              accessibilityRole="button"
              accessibilityLabel={CONTINUE_WITH_GOOGLE_LABEL}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.googleButton}
              testID="auth-provider-google-button"
            >
              <Image
                source={GOOGLE_CONTINUE_LIGHT}
                style={styles.googleButtonImage}
                resizeMode="contain"
                accessible={false}
                testID="auth-provider-google-icon"
              />
            </Pressable>
          </View>
        ) : (
          <Text
            style={styles.providerUnavailable}
            testID="auth-provider-unavailable"
            accessibilityLiveRegion="polite"
          >
            {providerRegion.providerUnavailableCopy}
          </Text>
        )}
      </View>

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
  // hairline border, generous padding. Restrained — gold is the lead + the
  // card edge only. (AUTH-GOOGLE-SSO-LAYOUT-001 #780 removed the gold accent
  // rule that previously sat above the lead; the `gap` spaces the contents.)
  valueProp: {
    marginBottom: 20,
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: BRAND.accent.goldSoft,
    borderWidth: 1,
    borderColor: BRAND.accent.goldBorder,
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
  // UX-COPY-BATCH-002 (#740/#760) — provider-slot region (email-only default).
  providerRegion: { marginBottom: 8, gap: 4 },
  // AUTH-GOOGLE-SSO-BRAND-001 (#778) — Pressable wrapping the official Google
  // button image. Centered horizontally; minHeight keeps the touch target at
  // the 44px floor even though the visible image is 48 tall. No indigo primary
  // styling — the official asset IS the button surface and must not be re-skinned.
  googleButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 2,
  },
  // Explicit width + height preserve the official 4.725 aspect (RN Web ignores
  // aspectRatio); contain prevents any distortion.
  googleButtonImage: {
    width: GOOGLE_BUTTON_WIDTH,
    height: GOOGLE_BUTTON_HEIGHT,
  },
  providerUnavailable: {
    fontSize: 13,
    color: BRAND.text.muted,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  providerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  providerDividerRule: {
    flex: 1,
    height: 1,
    backgroundColor: BRAND.accent.goldBorder,
  },
  providerDividerLabel: {
    fontSize: 13,
    color: BRAND.text.muted,
  },
});
