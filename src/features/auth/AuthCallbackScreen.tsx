import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { TextInputField } from '../../components/TextInputField';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingNotice } from '../../components/LoadingNotice';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import { parseAuthCallbackUrl } from '../../lib/auth/parseAuthCallbackUrl';
import { consumeAuthCallback } from './consumeAuthCallback';
import type { AuthCallbackOutcome } from './consumeAuthCallback';
import { setInvitedUserPassword, validateNewPassword } from './authApi';
import { AUTH_CALLBACK_COPY, plainLanguageForSetPasswordError } from './authCallbackCopy';
import { BRAND, SPACING } from '../../lib/designTokens';

// AUTH-CALLBACK-CONSUMER-001 — the `/auth/callback` consumer screen.
//
// On mount (guarded by a ref so it runs exactly once) the screen parses the
// URL captured at App boot and consumes it via the injected `supabase.auth`
// client. It renders six derived states and hosts the invited-user
// set-password form.
//
// Doctrine:
//  - No `console.*` anywhere (a token-bearing URL passes through here).
//  - The password is sent ONLY into `setInvitedUserPassword`; it is never
//    logged, and it is cleared from state once saved.
//  - `window` is touched only behind a `typeof window` guard, so native and
//    the Node test environment never reach it.

interface AuthCallbackScreenProps {
  /** Full callback URL captured at App boot (pathname + search + hash). */
  capturedUrl: string;
  /**
   * Called when the user taps Continue / Return to sign in — App flips the
   * in-memory authCallback flag so AppRoot routes normally afterward.
   */
  onDone: () => void;
}

type Phase =
  | 'checking'
  | 'accepted'
  | 'set_password'
  | 'password_set'
  | 'error_expired'
  | 'error_generic';

function outcomeToPhase(outcome: AuthCallbackOutcome): Phase {
  switch (outcome.status) {
    case 'success':
    case 'already_session':
      return 'accepted';
    case 'needs_password':
      return 'set_password';
    case 'error':
    default:
      return outcome.reason === 'expired' ? 'error_expired' : 'error_generic';
  }
}

export function AuthCallbackScreen({ capturedUrl, onDone }: AuthCallbackScreenProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const ranRef = useRef(false);

  // Run parse + consume exactly once on mount.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;
    void (async () => {
      // Env missing → plain "could not be completed" recovery (no env hint to
      // an invited end-user). No client call.
      if (!SUPABASE_CONFIGURED) {
        if (!cancelled) setPhase('error_generic');
        return;
      }
      const parsed = parseAuthCallbackUrl(capturedUrl);
      // supabase.auth is structurally assignable to AuthCallbackClient — only
      // getSession / setSession / exchangeCodeForSession are read.
      const outcome = await consumeAuthCallback({ client: supabase.auth, parsed });
      if (!cancelled) setPhase(outcomeToPhase(outcome));
    })();
    return () => {
      cancelled = true;
    };
  }, [capturedUrl]);

  // Continue / Return — strip the path + tokens from the address bar/history,
  // then hand control back to App. `window` is web-only and guarded.
  const finishAndExit = () => {
    if (
      typeof window !== 'undefined' &&
      window.history &&
      typeof window.history.replaceState === 'function'
    ) {
      window.history.replaceState(null, '', '/');
    }
    onDone();
  };

  const handleSubmitPassword = async () => {
    if (validateNewPassword(password) !== null || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await setInvitedUserPassword(password);
      if (result.ok) {
        // Do not hold the password in memory longer than necessary.
        setPassword('');
        setPhase('password_set');
      } else {
        setSubmitError(plainLanguageForSetPasswordError(result.error));
      }
    } finally {
      // The loading flag always resets — the form is never stuck spinning.
      setSubmitting(false);
    }
  };

  if (phase === 'checking') {
    return (
      <Screen scroll={false}>
        <View testID="auth-callback-checking" style={styles.center}>
          <LoadingNotice message={AUTH_CALLBACK_COPY.checkingBody} />
        </View>
      </Screen>
    );
  }

  if (phase === 'set_password') {
    const passwordValid = validateNewPassword(password) === null;
    return (
      <Screen title={AUTH_CALLBACK_COPY.setPasswordTitle}>
        <View testID="auth-callback-set-password" style={styles.block}>
          <Text style={styles.body}>{AUTH_CALLBACK_COPY.setPasswordBody}</Text>
          <TextInputField
            label={AUTH_CALLBACK_COPY.setPasswordFieldLabel}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder={AUTH_CALLBACK_COPY.setPasswordPlaceholder}
          />
          {submitError ? <ErrorNotice message={submitError} /> : null}
          <Button
            label={submitting ? AUTH_CALLBACK_COPY.setPasswordSaving : AUTH_CALLBACK_COPY.setPasswordSubmit}
            onPress={handleSubmitPassword}
            loading={submitting}
            disabled={!passwordValid}
          />
        </View>
      </Screen>
    );
  }

  if (phase === 'accepted' || phase === 'password_set') {
    const title =
      phase === 'accepted'
        ? AUTH_CALLBACK_COPY.acceptedTitle
        : AUTH_CALLBACK_COPY.passwordSetTitle;
    const body =
      phase === 'accepted'
        ? AUTH_CALLBACK_COPY.acceptedBody
        : AUTH_CALLBACK_COPY.passwordSetBody;
    const testID = phase === 'accepted' ? 'auth-callback-accepted' : 'auth-callback-password-set';
    return (
      <Screen title={title}>
        <View testID={testID} style={styles.block}>
          <Text style={styles.body}>{body}</Text>
          <Button label={AUTH_CALLBACK_COPY.continueButton} onPress={finishAndExit} />
        </View>
      </Screen>
    );
  }

  // error_expired / error_generic
  const isExpired = phase === 'error_expired';
  const title = isExpired
    ? AUTH_CALLBACK_COPY.errorExpiredTitle
    : AUTH_CALLBACK_COPY.errorGenericTitle;
  const body = isExpired
    ? AUTH_CALLBACK_COPY.errorExpiredBody
    : AUTH_CALLBACK_COPY.errorGenericBody;
  const testID = isExpired ? 'auth-callback-error-expired' : 'auth-callback-error-generic';
  return (
    <Screen title={title}>
      <View testID={testID} style={styles.block}>
        <ErrorNotice message={body} />
        <Button
          label={AUTH_CALLBACK_COPY.returnToSignInButton}
          variant="secondary"
          onPress={finishAndExit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  block: { paddingTop: SPACING.s },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: BRAND.text.primary,
    marginBottom: SPACING.m,
  },
});
