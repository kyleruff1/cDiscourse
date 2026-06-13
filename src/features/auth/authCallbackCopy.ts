/**
 * AUTH-CALLBACK-CONSUMER-001 — plain-language copy for the auth-callback
 * screen. Pure constants + one pure mapper; no network, no React, no Supabase.
 *
 * Doctrine (cdiscourse-doctrine §1, §9): every user-visible string is
 * link-state language. It assigns no winner/loser/truth/verdict to any person
 * or claim, surfaces no internal validation code, and never echoes a raw
 * Supabase error message. A ban-list test scans every exported string.
 *
 * Centralising the strings here (mirroring `inviteCopy.ts`, `gameCopy.ts`,
 * `preferencesCopy.ts`) makes that ban-list test trivial and keeps the screen
 * free of literal copy.
 */

/** One key per derived UI state + the form fields + the two buttons. */
export const AUTH_CALLBACK_COPY = {
  // checking — the parse + consume is running on mount.
  checkingTitle: 'Finishing sign-in…',
  checkingBody: 'One moment while we open your account.',

  // accepted — a session was established (success) OR already existed
  // (already_session). One state covers both per the design.
  acceptedTitle: 'You are signed in',
  acceptedBody: 'Your account is ready. Continue to CivilDiscourse to get started.',

  // set_password — an invited (passwordless) user must choose a password.
  setPasswordTitle: 'Set a password',
  setPasswordBody: 'Choose a password so you can sign in again next time.',
  setPasswordFieldLabel: 'Password',
  setPasswordPlaceholder: 'At least 6 characters',
  setPasswordSubmit: 'Save password and continue',
  setPasswordSaving: 'Saving…',

  // password_set — the password saved; the user can continue.
  passwordSetTitle: 'Password saved',
  passwordSetBody: 'Your password is set. Continue to CivilDiscourse.',

  // error_expired — recoverable link state (expired / denied).
  errorExpiredTitle: 'This link may have expired',
  errorExpiredBody:
    'Invite links work for a limited time. Ask an admin to send a new one, then try again.',

  // error_generic — link_invalid / unknown / config_missing.
  errorGenericTitle: 'This link could not be completed',
  errorGenericBody:
    'Something stopped this link from opening. Return to sign in, or ask an admin for help.',

  // Buttons.
  continueButton: 'Continue to CivilDiscourse',
  returnToSignInButton: 'Return to sign in',

  // Inline set-password form errors (plain; never the raw Supabase message).
  setPasswordErrorWeak: 'Choose a password with at least 6 characters.',
  setPasswordErrorNetwork: 'Check your connection and try again.',
  setPasswordErrorConfig: 'We could not finish this. Ask an admin for help.',
  setPasswordErrorGeneric: 'That did not save. Try again, or ask an admin for help.',
} as const;

/**
 * Map an authApi error code to plain set-password copy. The raw code is NEVER
 * echoed (doctrine §9) — an unknown code degrades to the generic line.
 */
export function plainLanguageForSetPasswordError(code: string | null | undefined): string {
  switch (code) {
    case 'weak_password':
      return AUTH_CALLBACK_COPY.setPasswordErrorWeak;
    case 'network_error':
      return AUTH_CALLBACK_COPY.setPasswordErrorNetwork;
    case 'config_missing':
      return AUTH_CALLBACK_COPY.setPasswordErrorConfig;
    default:
      return AUTH_CALLBACK_COPY.setPasswordErrorGeneric;
  }
}
