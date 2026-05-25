/**
 * PR-004 — contactApi tests (Q1, Q2, Q4).
 *
 * Pure helper coverage + Supabase-mocked wrapper paths. The mock layer
 * stubs `supabase.auth.getSession`, `supabase.auth.getUser`, and
 * `supabase.auth.updateUser` so the email-change wrapper is testable
 * without a live Supabase. The static source-scan tests guard the
 * doctrine boundary (no service-role, no AI provider, no profiles.email
 * write).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Supabase mock ───────────────────────────────────────────────

const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  SUPABASE_CONFIGURED: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

import {
  messageForContactError,
  requestEmailChange,
  validateEmail,
  type ContactEmailChangeError,
} from '../src/features/account/contactApi';

beforeEach(() => {
  mockGetSession.mockReset();
  mockGetUser.mockReset();
  mockUpdateUser.mockReset();
});

// ── validateEmail (Q2) ──────────────────────────────────────────

describe('validateEmail — Q2', () => {
  it('accepts a typical email address', () => {
    expect(validateEmail('alice@example.com')).toEqual({ ok: true });
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('rejects a too-short shape', () => {
    // length < 5
    expect(validateEmail('a@b')).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('accepts a 5-char minimum shape', () => {
    expect(validateEmail('a@b.c')).toEqual({ ok: true });
  });

  it('rejects a double-@ shape', () => {
    expect(validateEmail('alice@@example.com')).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('rejects an address with no TLD', () => {
    expect(validateEmail('alice@example')).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('rejects an address with internal whitespace', () => {
    expect(validateEmail('alice example@x.com')).toEqual({
      ok: false,
      error: 'invalid_email',
    });
  });

  it('rejects an address exceeding RFC 5321 (254 chars)', () => {
    const long = 'a'.repeat(255) + '@x.com';
    expect(validateEmail(long)).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('rejects a non-string input defensively', () => {
    expect(validateEmail(null)).toEqual({ ok: false, error: 'invalid_email' });
    expect(validateEmail(undefined)).toEqual({ ok: false, error: 'invalid_email' });
    expect(validateEmail(42)).toEqual({ ok: false, error: 'invalid_email' });
    expect(validateEmail({})).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('trims leading and trailing whitespace before validating', () => {
    expect(validateEmail('  alice@example.com  ')).toEqual({ ok: true });
  });
});

// ── messageForContactError (Q9 doctrine — plain language) ──────

describe('messageForContactError — plain language only', () => {
  const ALL_CODES: ContactEmailChangeError[] = [
    'invalid_email',
    'same_as_current',
    'email_already_used',
    'rate_limited',
    'network_error',
    'no_session',
    'config_missing',
    'unknown',
  ];

  it('returns a non-empty plain English message for every error code', () => {
    for (const code of ALL_CODES) {
      const msg = messageForContactError(code);
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('never includes a snake_case internal code in the user-facing message', () => {
    for (const code of ALL_CODES) {
      const msg = messageForContactError(code);
      expect(msg).not.toMatch(/_/);
    }
  });

  it('never includes a verdict token in the user-facing message', () => {
    const verdicts = [
      'winner',
      'loser',
      'liar',
      'dishonest',
      'manipulative',
      'extremist',
      'propagandist',
      'inappropriate',
      'violation',
      'banned',
      'spam',
    ];
    for (const code of ALL_CODES) {
      const msg = messageForContactError(code).toLowerCase();
      for (const v of verdicts) {
        expect(msg).not.toContain(v);
      }
    }
  });
});

// ── requestEmailChange — short-circuits + mappings ─────────────

describe('requestEmailChange — short-circuits', () => {
  it('returns invalid_email when the email shape fails (no Supabase call)', async () => {
    const result = await requestEmailChange('not-an-email');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_email');
    }
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns no_session when no active session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await requestEmailChange('alice@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('no_session');
    }
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns same_as_current when the new email matches the current one', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u', email: 'alice@example.com' } },
    });
    const result = await requestEmailChange('alice@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('same_as_current');
    }
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('treats same_as_current case-insensitively', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u', email: 'alice@example.com' } },
    });
    const result = await requestEmailChange('Alice@Example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('same_as_current');
    }
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe('requestEmailChange — Supabase error mappings (Q2)', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u', email: 'alice@example.com' } },
    });
  });

  it('maps "already registered" to email_already_used', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    });
    const result = await requestEmailChange('bob@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('email_already_used');
    }
  });

  it('maps "already in use" to email_already_used', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email is already in use.' },
    });
    const result = await requestEmailChange('bob@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('email_already_used');
    }
  });

  it('maps "rate limit" to rate_limited', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'rate limit exceeded' },
    });
    const result = await requestEmailChange('bob@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('rate_limited');
    }
  });

  it('maps "failed to fetch" to network_error', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Failed to fetch' },
    });
    const result = await requestEmailChange('bob@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('network_error');
    }
  });

  it('maps thrown network error to network_error', async () => {
    mockUpdateUser.mockRejectedValue(new Error('network down'));
    const result = await requestEmailChange('bob@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('network_error');
    }
  });

  it('maps an unrecognized auth-error message to unknown', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Something else' },
    });
    const result = await requestEmailChange('bob@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('unknown');
    }
  });

  it('returns success with PendingEmailChange data on a clean updateUser', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'u', email: 'alice@example.com' } }, // session still has OLD email until verify
      error: null,
    });
    const result = await requestEmailChange('bob@example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.newEmail).toBe('bob@example.com');
      expect(typeof result.data.submittedAt).toBe('string');
      expect(result.data.submittedAt.length).toBeGreaterThan(0);
    }
  });

  it('trims whitespace from the submitted email before write + return', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'u', email: 'alice@example.com' } },
      error: null,
    });
    const result = await requestEmailChange('  bob@example.com  ');
    expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'bob@example.com' });
    if (result.ok) {
      expect(result.data.newEmail).toBe('bob@example.com');
    }
  });
});

// ── Source-scan safety (doctrine guards) ───────────────────────

describe('contactApi source-scan — doctrine guards', () => {
  const PATH = join(__dirname, '..', 'src', 'features', 'account', 'contactApi.ts');
  const SRC = readFileSync(PATH, 'utf8');

  /**
   * Strip block and line comments. The wrapper's header / inline notes
   * intentionally mention forbidden patterns (`console.log`,
   * `profiles.email`, etc.) as teaching annotations; the doctrine
   * scan only forbids them in executable code.
   */
  const stripComments = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const CODE = stripComments(SRC);

  it('contains no service-role import or literal', () => {
    expect(CODE).not.toContain('SERVICE_ROLE');
    expect(CODE).not.toContain('service_role');
    expect(CODE).not.toContain('serviceRoleKey');
  });

  it('contains no AI provider import or literal', () => {
    const lower = CODE.toLowerCase();
    expect(lower).not.toContain('anthropic');
    expect(lower).not.toContain('xai');
    expect(lower).not.toContain('openai');
  });

  it('contains no console.log', () => {
    expect(CODE).not.toMatch(/\bconsole\.log\b/);
  });

  it('never writes to public.profiles.email (no such column)', () => {
    expect(CODE).not.toMatch(/from\(['"]profiles['"]\)\.update/);
    expect(CODE).not.toMatch(/from\(['"]profiles['"]\)\.insert/);
    expect(CODE).not.toMatch(/profiles\.email/);
  });

  it('uses only the auth SDK (no direct database writes)', () => {
    expect(CODE).not.toMatch(/\.from\([^)]+\)\s*\.update/);
    expect(CODE).not.toMatch(/\.from\([^)]+\)\s*\.insert/);
    expect(CODE).not.toMatch(/\.from\([^)]+\)\s*\.delete/);
  });

  it('does not log Authorization or Bearer tokens', () => {
    expect(CODE).not.toContain('Authorization');
    expect(CODE).not.toContain('Bearer ');
  });
});
