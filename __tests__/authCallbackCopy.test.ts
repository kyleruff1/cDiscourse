/**
 * AUTH-CALLBACK-CONSUMER-001 — copy doctrine ban-list.
 *
 * Every user-visible string in AUTH_CALLBACK_COPY must be plain link-state
 * language: no verdict / truth vocabulary, no snake_case leak, no internal
 * code / raw error token. The set-password error mapper must never echo the
 * raw code.
 */
import {
  AUTH_CALLBACK_COPY,
  plainLanguageForSetPasswordError,
} from '../src/features/auth/authCallbackCopy';

// Verdict / truth vocabulary that must never appear in a user-facing string.
const BANNED = [
  'winner',
  'loser',
  'true',
  'false',
  'correct',
  'liar',
  'dishonest',
  'bad faith',
  'verdict',
  'guilty',
  'wrong',
  'stupid',
];

const ALL_STRINGS = Object.values(AUTH_CALLBACK_COPY);

describe('AUTH_CALLBACK_COPY — verdict / truth ban-list', () => {
  it('contains no banned verdict vocabulary in any string', () => {
    for (const s of ALL_STRINGS) {
      const lower = s.toLowerCase();
      for (const banned of BANNED) {
        expect(lower).not.toContain(banned);
      }
    }
  });

  it('leaks no snake_case internal code (no underscore) in any string', () => {
    for (const s of ALL_STRINGS) {
      expect(s).not.toMatch(/_/);
    }
  });

  it('surfaces no raw error / code / stack token in any string', () => {
    for (const s of ALL_STRINGS) {
      const lower = s.toLowerCase();
      expect(lower).not.toContain('error:');
      expect(lower).not.toContain('code');
      expect(lower).not.toContain('stack');
      expect(s).not.toContain('Error');
    }
  });
});

describe('AUTH_CALLBACK_COPY — completeness', () => {
  it('every key maps to a non-empty string', () => {
    for (const [key, value] of Object.entries(AUTH_CALLBACK_COPY)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      // Defensive: a key whose value is empty would slip a blank UI state.
      expect(`${key}:${value}`.length).toBeGreaterThan(key.length + 1);
    }
  });

  it('has copy for every derived UI state + both buttons + the form', () => {
    expect(AUTH_CALLBACK_COPY.checkingBody.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.acceptedTitle.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.setPasswordTitle.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.setPasswordFieldLabel.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.setPasswordSubmit.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.passwordSetTitle.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.errorExpiredTitle.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.errorGenericTitle.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.continueButton.length).toBeGreaterThan(0);
    expect(AUTH_CALLBACK_COPY.returnToSignInButton.length).toBeGreaterThan(0);
  });
});

describe('plainLanguageForSetPasswordError', () => {
  it('maps known codes to distinct plain copy', () => {
    expect(plainLanguageForSetPasswordError('weak_password')).toBe(
      AUTH_CALLBACK_COPY.setPasswordErrorWeak,
    );
    expect(plainLanguageForSetPasswordError('network_error')).toBe(
      AUTH_CALLBACK_COPY.setPasswordErrorNetwork,
    );
    expect(plainLanguageForSetPasswordError('config_missing')).toBe(
      AUTH_CALLBACK_COPY.setPasswordErrorConfig,
    );
  });

  it('degrades an unknown code to the generic line (never echoes the code)', () => {
    const out = plainLanguageForSetPasswordError('some_internal_code_42');
    expect(out).toBe(AUTH_CALLBACK_COPY.setPasswordErrorGeneric);
    expect(out).not.toContain('some_internal_code_42');
  });

  it('degrades null / undefined to the generic line', () => {
    expect(plainLanguageForSetPasswordError(null)).toBe(AUTH_CALLBACK_COPY.setPasswordErrorGeneric);
    expect(plainLanguageForSetPasswordError(undefined)).toBe(
      AUTH_CALLBACK_COPY.setPasswordErrorGeneric,
    );
  });

  it('returns a string that itself passes the ban-list', () => {
    for (const code of ['weak_password', 'network_error', 'config_missing', 'x']) {
      const out = plainLanguageForSetPasswordError(code).toLowerCase();
      for (const banned of BANNED) expect(out).not.toContain(banned);
      expect(out).not.toMatch(/_/);
    }
  });
});
