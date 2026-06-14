/**
 * EMAIL-TRANSPORT-002 (Option B) — the app-owned "Create your account"
 * step rendered INSIDE the /invite/<token> redemption flow for a
 * signed-out invitee who chooses to create an account in place.
 *
 * Option B flow (the chosen pivot — hosted email confirmations are ON):
 *   1) The invitee types the email the invite was sent to + a password.
 *   2) `provisionAndAcceptInvite({ token, email, password })` →
 *      manage-room-invite `provision_and_accept` enforces email-binding
 *      BEFORE provisioning, mints the confirmed account, enrols the seat,
 *      and returns NO session/token.
 *   3) The step then signs in normally with the just-set password
 *      (`signInWithEmailPassword`) to establish its own session.
 *   4) On success → `onCredentialsEstablished()`. The parent gate already
 *      holds the token and re-runs accept off the live session
 *      (idempotent server-side).
 *
 * The "I already have an account" affordance switches to a sign-in
 * sub-mode that calls `signInWithEmailPassword` directly.
 *
 * Doctrine:
 *  - No service-role anywhere (the wrappers route through
 *    supabase.functions.invoke / supabase.auth — anon key only).
 *  - No console.* anywhere (this screen handles a password + the room
 *    token via the gate).
 *  - The password is held in state only until submit completes, then
 *    cleared. The token is NOT held here — the gate owns it; this step
 *    receives it only to forward to the provision wrapper.
 *  - Every error maps through inviteCredentialModel to a plain-language
 *    state; no raw provider/Edge message is rendered.
 *  - NO heat / score / standing / verdict is shown — only room title +
 *    inviter + the account fields.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { INVITE_CREDENTIAL_COPY } from './inviteCopy';
import {
  credentialCopyForMode,
  mapProvisionOutcomeToStep,
  mapSignInOutcomeToStep,
  validateInviteCredentialForm,
  type InviteCredentialMode,
  type InviteCredentialStepState,
} from './inviteCredentialModel';
import { provisionAndAcceptInvite } from './inviteApi';
import { signInWithEmailPassword } from '../auth/authApi';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

export interface InviteCredentialStepProps {
  /** The raw invite token (held by the gate; forwarded to provision). */
  token: string;
  /** From the lookup — display-safe. */
  roomTitle: string;
  /** From the lookup — display-safe. */
  inviterDisplayName: string | null;
  /**
   * Fired once a live session is established (provision+sign-in, or
   * sign-in in the sub-mode). The parent gate re-runs accept off the
   * live session.
   */
  onCredentialsEstablished: () => void;
  /** Universal escape hatch — parent clears intent + drops to gallery. */
  onExit: () => void;
  /** Optional initial mode (defaults to 'create'). */
  initialMode?: InviteCredentialMode;
}

export function InviteCredentialStep(props: InviteCredentialStepProps) {
  const { token, roomTitle, inviterDisplayName, onCredentialsEstablished, onExit } = props;
  const [mode, setMode] = useState<InviteCredentialMode>(props.initialMode ?? 'create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<InviteCredentialStepState>({ kind: 'idle' });

  const inviter =
    typeof inviterDisplayName === 'string' && inviterDisplayName.trim().length > 0
      ? inviterDisplayName.trim()
      : 'A CDiscourse user';
  const title = roomTitle && roomTitle.trim().length > 0 ? roomTitle : '(this argument)';
  const copy = credentialCopyForMode(mode);
  const submitting = step.kind === 'submitting';

  const switchMode = useCallback(() => {
    setStep({ kind: 'idle' });
    setMode((m) => (m === 'create' ? 'signin' : 'create'));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    // Inline validation first (pure model). Blocks the wire call.
    const valid = validateInviteCredentialForm({ email, password });
    if (!valid.ok) {
      setStep({ kind: 'inline_error', field: valid.field, message: valid.message });
      return;
    }

    setStep({ kind: 'submitting' });

    if (mode === 'create') {
      const result = await provisionAndAcceptInvite({ token, email, password });
      if (!result.ok) {
        setStep(mapProvisionOutcomeToStep({ ok: false, errorCode: result.error.error }));
        return;
      }
      // Account provisioned + seat enrolled server-side; now establish a
      // session by signing in with the just-set password.
      const signIn = await signInWithEmailPassword(email, password);
      // Clear the password from memory once it has been used.
      setPassword('');
      if (!signIn.ok) {
        setStep(mapSignInOutcomeToStep({ ok: false, errorCode: signIn.error }));
        return;
      }
      onCredentialsEstablished();
      return;
    }

    // sign-in sub-mode
    const signIn = await signInWithEmailPassword(email, password);
    setPassword('');
    if (!signIn.ok) {
      setStep(mapSignInOutcomeToStep({ ok: false, errorCode: signIn.error }));
      return;
    }
    onCredentialsEstablished();
  }, [submitting, email, password, mode, token, onCredentialsEstablished]);

  const emailError = step.kind === 'inline_error' && step.field === 'email' ? step.message : undefined;
  const passwordError =
    step.kind === 'inline_error' && step.field === 'password' ? step.message : undefined;
  const banner =
    step.kind === 'offer_signin' ||
    step.kind === 'email_mismatch' ||
    step.kind === 'retryable' ||
    step.kind === 'blocked'
      ? step.message
      : undefined;

  return (
    <Screen title="">
      <ScrollView contentContainerStyle={styles.body} testID="invite-credential-step">
        <Text style={styles.heading}>{copy.heading}</Text>
        <Text style={styles.context}>
          {mode === 'create'
            ? INVITE_CREDENTIAL_COPY.body(title, inviter)
            : INVITE_CREDENTIAL_COPY.signInBody(title, inviter)}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>{INVITE_CREDENTIAL_COPY.emailLabel}</Text>
          <TextInput
            testID="invite-credential-email"
            value={email}
            onChangeText={setEmail}
            placeholder={INVITE_CREDENTIAL_COPY.emailPlaceholder}
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!submitting}
            style={[styles.input, emailError ? styles.inputError : null]}
            accessibilityLabel={INVITE_CREDENTIAL_COPY.emailLabel}
          />
          <Text style={styles.help}>{INVITE_CREDENTIAL_COPY.emailHelp}</Text>
          {emailError ? <Text style={styles.inlineError}>{emailError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{INVITE_CREDENTIAL_COPY.passwordLabel}</Text>
          <TextInput
            testID="invite-credential-password"
            value={password}
            onChangeText={setPassword}
            placeholder={INVITE_CREDENTIAL_COPY.passwordPlaceholder}
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoCapitalize="none"
            editable={!submitting}
            style={[styles.input, passwordError ? styles.inputError : null]}
            accessibilityLabel={INVITE_CREDENTIAL_COPY.passwordLabel}
          />
          {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
        </View>

        {banner ? (
          <Text testID="invite-credential-banner" style={styles.banner}>
            {banner}
          </Text>
        ) : null}

        <Pressable
          testID="invite-credential-submit"
          style={[styles.btnPrimary, submitting ? styles.btnDisabled : null]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={submitting ? copy.submittingLabel : copy.submitLabel}
          accessibilityState={{ disabled: submitting }}
        >
          <Text style={styles.btnPrimaryText}>
            {submitting ? copy.submittingLabel : copy.submitLabel}
          </Text>
        </Pressable>

        <Pressable
          testID="invite-credential-switch-mode"
          style={styles.btnLink}
          onPress={switchMode}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={copy.switchLabel}
        >
          <Text style={styles.btnLinkText}>{copy.switchLabel}</Text>
        </Pressable>

        <Pressable
          testID="invite-credential-exit"
          style={styles.btnSecondary}
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel={INVITE_CREDENTIAL_COPY.exitButton}
        >
          <Text style={styles.btnSecondaryText}>{INVITE_CREDENTIAL_COPY.exitButton}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 24,
    gap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
    textAlign: 'center',
  },
  context: {
    fontSize: 15,
    color: SURFACE_TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textPrimary },
  help: { fontSize: 12, color: SURFACE_TOKENS.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    minHeight: 44,
  },
  inputError: { borderColor: STATUS.danger.fg },
  inlineError: { fontSize: 12, color: STATUS.danger.fg },
  banner: {
    fontSize: 14,
    color: STATUS.danger.fg,
    textAlign: 'center',
    lineHeight: 20,
  },
  btnPrimary: {
    backgroundColor: CONTROL.primary.bg,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: CONTROL.primary.fg, fontWeight: '700', fontSize: 14 },
  btnLink: { padding: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnLinkText: { color: CONTROL.primary.bg, fontWeight: '600', fontSize: 14 },
  btnSecondary: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnSecondaryText: { color: SURFACE_TOKENS.textSecondary, fontWeight: '600', fontSize: 14 },
});
