/**
 * EMAIL-TRANSPORT-002 (Option B) — pure-model tests for the in-place
 * credential step decision/validation logic.
 *
 * Covers:
 *   - validateInviteCredentialForm: happy path + each invalid field.
 *   - mapProvisionOutcomeToStep: every provision_and_accept error code.
 *   - mapSignInOutcomeToStep: every sign-in (AuthError) code.
 *   - No raw provider / Edge message ever surfaces in a returned message.
 *   - No banned verdict / framing token in any returned message.
 *   - credentialCopyForMode returns the right bundle per mode.
 */
// The model re-uses `validateNewPassword` from `authApi`, which imports the
// supabase client → async-storage at module load. Mock the native module so
// the pure model loads in the Node test environment (the established repo
// pattern; the model itself makes NO network/auth call at runtime).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  validateInviteCredentialForm,
  mapProvisionOutcomeToStep,
  mapSignInOutcomeToStep,
  credentialCopyForMode,
} from '../src/features/invites/inviteCredentialModel';
import { INVITE_CREDENTIAL_COPY } from '../src/features/invites/inviteCopy';

const BANNED = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'challenger',
  'opponent',
];

function assertClean(message: string) {
  const lower = message.toLowerCase();
  for (const token of BANNED) {
    expect(lower).not.toContain(token);
  }
  // No raw snake_case internal code leaked into user copy.
  expect(/[a-z]+_[a-z]+/.test(message)).toBe(false);
}

describe('validateInviteCredentialForm', () => {
  it('passes a well-formed email + password', () => {
    expect(validateInviteCredentialForm({ email: 'a@b.com', password: 'secret1' })).toEqual({
      ok: true,
    });
  });

  it('flags an empty email first (email is checked before password)', () => {
    const r = validateInviteCredentialForm({ email: '', password: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe('email');
      assertClean(r.message);
    }
  });

  it('flags an invalid email', () => {
    const r = validateInviteCredentialForm({ email: 'not-an-email', password: 'secret1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe('email');
  });

  it('flags a too-short password when the email is valid', () => {
    const r = validateInviteCredentialForm({ email: 'a@b.com', password: '123' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe('password');
      assertClean(r.message);
    }
  });
});

describe('mapProvisionOutcomeToStep', () => {
  it('ok → submitting', () => {
    expect(mapProvisionOutcomeToStep({ ok: true })).toEqual({ kind: 'submitting' });
  });

  it('account_exists → offer_signin', () => {
    const s = mapProvisionOutcomeToStep({ ok: false, errorCode: 'account_exists' });
    expect(s.kind).toBe('offer_signin');
    if (s.kind === 'offer_signin') assertClean(s.message);
  });

  it('email_already_used (defensive alias) → offer_signin', () => {
    expect(mapProvisionOutcomeToStep({ ok: false, errorCode: 'email_already_used' }).kind).toBe(
      'offer_signin',
    );
  });

  it('invite_email_mismatch → email_mismatch', () => {
    const s = mapProvisionOutcomeToStep({ ok: false, errorCode: 'invite_email_mismatch' });
    expect(s.kind).toBe('email_mismatch');
    if (s.kind === 'email_mismatch') assertClean(s.message);
  });

  it('weak_password → inline_error on the password field', () => {
    const s = mapProvisionOutcomeToStep({ ok: false, errorCode: 'weak_password' });
    expect(s.kind).toBe('inline_error');
    if (s.kind === 'inline_error') expect(s.field).toBe('password');
  });

  it.each([
    'invite_expired',
    'invite_revoked',
    'invite_already_accepted',
    'room_archived',
    'room_closed',
    'invite_not_found',
    'config_missing',
  ])('%s → blocked', (code) => {
    const s = mapProvisionOutcomeToStep({ ok: false, errorCode: code });
    expect(s.kind).toBe('blocked');
    if (s.kind === 'blocked') assertClean(s.message);
  });

  it.each(['network_error', 'empty_response', 'provision_failed'])(
    '%s → retryable',
    (code) => {
      const s = mapProvisionOutcomeToStep({ ok: false, errorCode: code });
      expect(s.kind).toBe('retryable');
      if (s.kind === 'retryable') assertClean(s.message);
    },
  );

  it('an unknown code → retryable with a generic (non-raw) message', () => {
    const s = mapProvisionOutcomeToStep({ ok: false, errorCode: 'totally_made_up_code_xyz' });
    expect(s.kind).toBe('retryable');
    if (s.kind === 'retryable') {
      // The raw code must NOT be echoed.
      expect(s.message).not.toContain('totally_made_up_code_xyz');
      assertClean(s.message);
    }
  });

  it('a null/missing code → retryable (never throws, never echoes)', () => {
    const s = mapProvisionOutcomeToStep({ ok: false, errorCode: null });
    expect(s.kind).toBe('retryable');
  });
});

describe('mapSignInOutcomeToStep', () => {
  it('ok → submitting', () => {
    expect(mapSignInOutcomeToStep({ ok: true })).toEqual({ kind: 'submitting' });
  });

  it('invalid_credentials → inline password error (retry the password)', () => {
    const s = mapSignInOutcomeToStep({ ok: false, errorCode: 'invalid_credentials' });
    expect(s.kind).toBe('inline_error');
    if (s.kind === 'inline_error') {
      expect(s.field).toBe('password');
      assertClean(s.message);
    }
  });

  it('email_not_confirmed → blocked', () => {
    const s = mapSignInOutcomeToStep({ ok: false, errorCode: 'email_not_confirmed' });
    expect(s.kind).toBe('blocked');
    if (s.kind === 'blocked') assertClean(s.message);
  });

  it.each(['config_missing', 'redirect_invalid'])('%s → blocked', (code) => {
    expect(mapSignInOutcomeToStep({ ok: false, errorCode: code }).kind).toBe('blocked');
  });

  it('network_error → retryable', () => {
    expect(mapSignInOutcomeToStep({ ok: false, errorCode: 'network_error' }).kind).toBe('retryable');
  });

  it('an unknown sign-in code → retryable, never echoing the raw code', () => {
    const s = mapSignInOutcomeToStep({ ok: false, errorCode: 'unknown' });
    expect(s.kind).toBe('retryable');
    if (s.kind === 'retryable') expect(s.message).not.toContain('unknown');
  });
});

describe('credentialCopyForMode', () => {
  it('create mode returns the create heading + submit + switch labels', () => {
    const c = credentialCopyForMode('create');
    expect(c.heading).toBe(INVITE_CREDENTIAL_COPY.heading);
    expect(c.submitLabel).toBe(INVITE_CREDENTIAL_COPY.submitButton);
    expect(c.switchLabel).toBe(INVITE_CREDENTIAL_COPY.haveAccountLabel);
  });

  it('signin mode returns the sign-in heading + submit + switch labels', () => {
    const c = credentialCopyForMode('signin');
    expect(c.heading).toBe(INVITE_CREDENTIAL_COPY.signInHeading);
    expect(c.submitLabel).toBe(INVITE_CREDENTIAL_COPY.signInButton);
    expect(c.switchLabel).toBe(INVITE_CREDENTIAL_COPY.useNewAccountLabel);
  });
});
