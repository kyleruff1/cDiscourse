/**
 * EMAIL-TRANSPORT-002 (Option B) — the pure decision/validation model the
 * in-place "Create your account" step renders from. Keeping the logic
 * here (no React, no network, no token, no secret) makes it unit-testable
 * and keeps `InviteCredentialStep.tsx` a thin presentation layer.
 *
 * Doctrine:
 *  - NO raw Supabase / Edge Function message is ever surfaced. Every
 *    outcome maps to a plain-language UI state (cdiscourse-doctrine §9).
 *  - NO verdict / truth tokens in any returned message (the
 *    inviteCopyDoctrine ban-list scan covers the copy bundle this model
 *    pulls from).
 *  - This module never sees a JWT, a session, or the raw invite token —
 *    it only maps result *codes* to UI states.
 */
import { INVITE_CREDENTIAL_COPY, plainLanguageForInviteError, validateInviteEmailInput } from './inviteCopy';
import { validateNewPassword } from '../auth/authApi';

/** Whether the step is creating a new account or signing into an existing one. */
export type InviteCredentialMode = 'create' | 'signin';

/**
 * The UI states the step can be in after a submit. `idle` / `submitting`
 * are pre/in-flight; the rest are terminal-until-retry outcomes. None of
 * the `message` strings is a raw provider message.
 */
export type InviteCredentialStepState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'inline_error'; field: 'email' | 'password'; message: string }
  /** The address already has an account → offer the sign-in sub-mode. */
  | { kind: 'offer_signin'; message: string }
  /** Wrong email (server-side email-binding) → guide to the invited address. */
  | { kind: 'email_mismatch'; message: string }
  /** Transient (network / provider hiccup) → retry. */
  | { kind: 'retryable'; message: string }
  /** Non-retryable from the user's seat (expired / revoked / closed / config). */
  | { kind: 'blocked'; message: string };

/**
 * A minimal structural view of the wire result the step hands to the
 * mapper. Both `provisionAndAcceptInvite` (InviteApiResult) and
 * `signInWithEmailPassword` (AuthResult) reduce to this shape: an `ok`
 * flag and, on failure, an error *code* string. We deliberately accept
 * only the code, never the raw message, so a raw message cannot leak
 * through this model.
 */
export interface CredentialOutcomeInput {
  ok: boolean;
  /** The stable error code (Edge code or AuthError) — NOT the raw message. */
  errorCode?: string | null;
}

/**
 * Validate the create/sign-in form. Composes the existing email validator
 * and the shared `validateNewPassword` (min 6, matching the server). The
 * email field is checked first so the most actionable error surfaces.
 */
export function validateInviteCredentialForm(input: {
  email: string;
  password: string;
}):
  | { ok: true }
  | { ok: false; field: 'email' | 'password'; message: string } {
  const emailError = validateInviteEmailInput(input.email);
  if (emailError) return { ok: false, field: 'email', message: emailError };
  const passwordError = validateNewPassword(input.password);
  if (passwordError) return { ok: false, field: 'password', message: passwordError };
  return { ok: true };
}

/**
 * Map a `provision_and_accept` outcome (or any wire result reduced to
 * `{ ok, errorCode }`) to a plain-language step state. Used for the
 * `create` mode.
 *
 * The mapping NEVER surfaces a raw message: known codes route through the
 * curated copy; unknown codes fall to the generic retryable message via
 * `plainLanguageForInviteError`.
 */
export function mapProvisionOutcomeToStep(result: CredentialOutcomeInput): InviteCredentialStepState {
  if (result.ok) return { kind: 'submitting' };
  const code = typeof result.errorCode === 'string' ? result.errorCode : '';

  switch (code) {
    case 'account_exists':
    case 'email_already_used':
      return { kind: 'offer_signin', message: plainLanguageForInviteError('account_exists') };
    case 'invite_email_mismatch':
      return { kind: 'email_mismatch', message: plainLanguageForInviteError('invite_email_mismatch') };
    case 'weak_password':
      return { kind: 'inline_error', field: 'password', message: plainLanguageForInviteError('weak_password') };
    case 'invite_expired':
    case 'invite_revoked':
    case 'invite_already_accepted':
    case 'room_archived':
    case 'room_closed':
    case 'invite_not_found':
    case 'config_missing':
      return { kind: 'blocked', message: plainLanguageForInviteError(code) };
    case 'network_error':
    case 'empty_response':
    case 'provision_failed':
      return { kind: 'retryable', message: plainLanguageForInviteError(code) };
    default:
      // Unknown code — never echo it; generic retryable fallback.
      return { kind: 'retryable', message: plainLanguageForInviteError(code || 'provision_failed') };
  }
}

/**
 * Map a sign-in outcome (the `signin` sub-mode) to a step state. The
 * caller passes `signInWithEmailPassword`'s AuthResult reduced to
 * `{ ok, errorCode }`. Invalid credentials map to an inline password
 * error (so the user can retry the password); the rest mirror the
 * provision mapping.
 */
export function mapSignInOutcomeToStep(result: CredentialOutcomeInput): InviteCredentialStepState {
  if (result.ok) return { kind: 'submitting' };
  const code = typeof result.errorCode === 'string' ? result.errorCode : '';

  switch (code) {
    case 'invalid_credentials':
      return {
        kind: 'inline_error',
        field: 'password',
        message: 'That email and password did not match. Check them and try again.',
      };
    case 'email_not_confirmed':
      return {
        kind: 'blocked',
        message: 'Your account is not ready to sign in yet. Try again shortly.',
      };
    case 'weak_password':
      return { kind: 'inline_error', field: 'password', message: plainLanguageForInviteError('weak_password') };
    case 'config_missing':
    case 'redirect_invalid':
      return { kind: 'blocked', message: plainLanguageForInviteError('invite_action_failed') };
    case 'network_error':
      return { kind: 'retryable', message: plainLanguageForInviteError('network_error') };
    default:
      return { kind: 'retryable', message: plainLanguageForInviteError(code || 'invite_action_failed') };
  }
}

/**
 * The heading/body/labels the step renders for a given mode. Pure passthrough
 * to the copy bundle — kept here so the component never branches on mode for
 * copy selection.
 */
export function credentialCopyForMode(mode: InviteCredentialMode): {
  heading: string;
  submitLabel: string;
  submittingLabel: string;
  switchLabel: string;
} {
  if (mode === 'signin') {
    return {
      heading: INVITE_CREDENTIAL_COPY.signInHeading,
      submitLabel: INVITE_CREDENTIAL_COPY.signInButton,
      submittingLabel: INVITE_CREDENTIAL_COPY.submittingButton,
      switchLabel: INVITE_CREDENTIAL_COPY.useNewAccountLabel,
    };
  }
  return {
    heading: INVITE_CREDENTIAL_COPY.heading,
    submitLabel: INVITE_CREDENTIAL_COPY.submitButton,
    submittingLabel: INVITE_CREDENTIAL_COPY.submittingButton,
    switchLabel: INVITE_CREDENTIAL_COPY.haveAccountLabel,
  };
}
