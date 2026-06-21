/**
 * AUTH-GOOGLE-SSO-003 (#746) — signInWithGoogle wrapper unit suite.
 *
 * Mirrors authApiRedirect.test.ts: the Supabase client, resolveRuntimeOrigin,
 * and getIsDev are mocked so no network call is made and each case controls the
 * resolved origin. SUPABASE_CONFIGURED is a mutable getter.
 *
 * Doctrine guards exercised here: the provider call appears with
 * provider:'google'; redirectTo resolves to <currentOrigin>/auth/callback (NOT
 * the dev.cdiscourse.com fallback); an invalid origin degrades to options
 * omitted (never blocks sign-in); a missing config is a safe no-op; errors map
 * to plain codes and the wrapper never throws; and NO token / provider detail is
 * ever logged.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockSignInWithOAuth = jest.fn();
const mockResolveRuntimeOrigin = jest.fn<string | null, []>();
const mockGetIsDev = jest.fn<boolean, []>();
const mockSupabaseConfigured = { value: true };

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
  get SUPABASE_CONFIGURED() {
    return mockSupabaseConfigured.value;
  },
  readRuntimeEnv: () => ({}),
}));

jest.mock('../src/lib/auth/resolveRuntimeOrigin', () => ({
  resolveRuntimeOrigin: () => mockResolveRuntimeOrigin(),
  getIsDev: () => mockGetIsDev(),
}));

import { signInWithGoogle } from '../src/features/auth/signInWithGoogle';

type OAuthCallArg = {
  provider: string;
  options?: { redirectTo?: string };
};

beforeEach(() => {
  mockSignInWithOAuth.mockReset();
  mockResolveRuntimeOrigin.mockReset();
  mockGetIsDev.mockReset();
  mockSupabaseConfigured.value = true;
  // Default: a real resolved current origin (the deployed dev host), non-dev.
  mockResolveRuntimeOrigin.mockReturnValue('https://dev-cdiscourse.netlify.app');
  mockGetIsDev.mockReturnValue(false);
});

describe('signInWithGoogle — provider initiation', () => {
  it('calls signInWithOAuth with provider "google" exactly once and returns { ok: true }', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

    const result = await signInWithGoogle();

    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
    const arg = mockSignInWithOAuth.mock.calls[0][0] as OAuthCallArg;
    expect(arg.provider).toBe('google');
    expect(result).toEqual({ ok: true });
  });

  it('passes redirectTo ending /auth/callback using the resolved current origin', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

    await signInWithGoogle();

    const arg = mockSignInWithOAuth.mock.calls[0][0] as OAuthCallArg;
    expect(arg.options?.redirectTo).toBe('https://dev-cdiscourse.netlify.app/auth/callback');
    expect(arg.options?.redirectTo?.endsWith('/auth/callback')).toBe(true);
  });

  it('does NOT use the dev.cdiscourse.com hosted fallback when a real origin resolves', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

    await signInWithGoogle();

    const arg = mockSignInWithOAuth.mock.calls[0][0] as OAuthCallArg;
    expect(arg.options?.redirectTo).not.toContain('dev.cdiscourse.com');
    expect(arg.options?.redirectTo).toContain('dev-cdiscourse.netlify.app');
  });
});

describe('signInWithGoogle — redirect degradation', () => {
  it('omits options (redirectTo undefined) when the resolved origin is invalid, but still initiates', async () => {
    // A forbidden scheme makes buildAuthRedirectUrl throw; the wrapper catches it
    // and proceeds without redirectTo rather than blocking sign-in.
    mockResolveRuntimeOrigin.mockReturnValue('file:///etc/passwd');
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

    const result = await signInWithGoogle();

    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
    const arg = mockSignInWithOAuth.mock.calls[0][0] as OAuthCallArg;
    expect(arg.options).toBeUndefined();
    expect(result).toEqual({ ok: true });
  });
});

describe('signInWithGoogle — config / error handling', () => {
  it('returns config_missing and makes NO provider call when SUPABASE_CONFIGURED is false', async () => {
    mockSupabaseConfigured.value = false;

    const result = await signInWithGoogle();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('config_missing');
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it('maps a Supabase error to a plain code and never throws', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: {},
      error: { message: 'Network request failed to fetch' },
    });

    const result = await signInWithGoogle();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('network_error');
    expect(result.message).toBe('Network request failed to fetch');
  });

  it('catches a rejection, maps it, and never throws', async () => {
    mockSignInWithOAuth.mockRejectedValue(new Error('boom failed to fetch'));

    const result = await signInWithGoogle();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('network_error');
  });

  it('returns a safe shape for a non-Error rejection', async () => {
    mockSignInWithOAuth.mockRejectedValue('weird');

    const result = await signInWithGoogle();

    expect(result.ok).toBe(false);
    expect(typeof result.message).toBe('string');
  });
});

describe('signInWithGoogle — doctrine: no token / provider detail logged', () => {
  it('logs nothing across the happy path and the error path', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    try {
      // Happy path returns a (fictional) provider URL + token-shaped fields that
      // must never be logged.
      mockSignInWithOAuth.mockResolvedValue({
        data: {
          provider: 'google',
          url: 'https://accounts.google.com/o/oauth2/v2/auth?access_token=SECRET_TOKEN_VALUE',
        },
        error: null,
      });
      await signInWithGoogle();

      // Error path with a token-shaped message.
      mockSignInWithOAuth.mockResolvedValue({
        data: {},
        error: { message: 'refresh_token=ANOTHER_SECRET network failure' },
      });
      await signInWithGoogle();

      expect(logSpy).not.toHaveBeenCalled();
      expect(errSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });
});
