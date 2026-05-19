/**
 * QOL-023 — mocked-Supabase suite asserting emailRedirectTo / redirectTo
 * pass-through for signup, password reset, and admin-triggered reset.
 *
 * resolveRuntimeOrigin is mocked so each test controls the resolved origin
 * without touching `window` / `process.env`. The Supabase client and the
 * admin-users edge wrapper are mocked so no network call is made.
 *
 * Mock fn names are prefixed `mock*` so Jest permits them inside the hoisted
 * jest.mock() factories.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockSignUp = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockResolveRuntimeOrigin = jest.fn<string | null, []>();
const mockGetIsDev = jest.fn<boolean, []>();
const mockAdminUsers = jest.fn();
// Mutable flag — SUPABASE_CONFIGURED is a module-level const in the real
// module, so the mock exposes it via a getter that reads this. Tests flip it
// to exercise the config-missing branch.
const mockSupabaseConfigured = { value: true };

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
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

jest.mock('../src/lib/edgeFunctions', () => ({
  adminUsers: (...args: unknown[]) => mockAdminUsers(...args),
}));

import {
  signUpWithEmailPassword,
  sendPasswordResetEmail,
} from '../src/features/auth/authApi';
import { adminSendPasswordReset } from '../src/features/admin/adminApi';

beforeEach(() => {
  mockSignUp.mockReset();
  mockResetPasswordForEmail.mockReset();
  mockAdminUsers.mockReset();
  mockResolveRuntimeOrigin.mockReset();
  mockGetIsDev.mockReset();
  mockSupabaseConfigured.value = true;
  // Default: a valid hosted origin, non-dev build.
  mockResolveRuntimeOrigin.mockReturnValue('https://dev.cdiscourse.com');
  mockGetIsDev.mockReturnValue(false);
});

describe('signUpWithEmailPassword — emailRedirectTo', () => {
  it('passes options.emailRedirectTo ending /auth/callback over https', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null });

    const result = await signUpWithEmailPassword('a@b.com', 'password1', 'Ada');

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    const arg = mockSignUp.mock.calls[0][0] as {
      options: { emailRedirectTo?: string; data: { display_name: string } };
    };
    expect(arg.options.emailRedirectTo).toBe('https://dev.cdiscourse.com/auth/callback');
    expect(arg.options.emailRedirectTo!.startsWith('https://')).toBe(true);
    expect(arg.options.data.display_name).toBe('Ada');
    expect(result.ok).toBe(true);
  });

  it('still calls signUp with emailRedirectTo undefined when the origin is invalid', async () => {
    // A forbidden scheme makes buildAuthRedirectUrl throw; safeBuildRedirect
    // catches it and the signup proceeds without emailRedirectTo.
    mockResolveRuntimeOrigin.mockReturnValue('file:///etc/passwd');
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null });

    const result = await signUpWithEmailPassword('a@b.com', 'password1');

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    const arg = mockSignUp.mock.calls[0][0] as { options: { emailRedirectTo?: string } };
    expect(arg.options.emailRedirectTo).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('happy path still returns { ok: true, data: { id, email } } (regression guard)', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-xyz', email: 'who@example.com' } },
      error: null,
    });

    const result = await signUpWithEmailPassword('who@example.com', 'password1');

    expect(result).toEqual({ ok: true, data: { id: 'user-xyz', email: 'who@example.com' } });
  });
});

describe('sendPasswordResetEmail', () => {
  it('passes redirectTo ending /auth/reset', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await sendPasswordResetEmail('a@b.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [email, opts] = mockResetPasswordForEmail.mock.calls[0] as [string, { redirectTo: string }];
    expect(email).toBe('a@b.com');
    expect(opts.redirectTo).toBe('https://dev.cdiscourse.com/auth/reset');
    expect(result.ok).toBe(true);
  });

  it('omits the options arg when the resolved origin is invalid', async () => {
    mockResolveRuntimeOrigin.mockReturnValue('file:///etc/passwd');
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await sendPasswordResetEmail('a@b.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(mockResetPasswordForEmail.mock.calls[0][1]).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('surfaces a Supabase error through mapAuthError', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'Network request failed to fetch' },
    });

    const result = await sendPasswordResetEmail('a@b.com');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('network_error');
  });

  it('maps an invalid_auth_redirect_origin error message to redirect_invalid', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'invalid_auth_redirect_origin somewhere' },
    });

    const result = await sendPasswordResetEmail('a@b.com');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('redirect_invalid');
  });

  it('returns config_missing and makes no Supabase call when SUPABASE_CONFIGURED is false', async () => {
    mockSupabaseConfigured.value = false;

    const result = await sendPasswordResetEmail('a@b.com');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('config_missing');
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('adminSendPasswordReset — derived redirectTo', () => {
  it('forwards a derived redirectTo ending /auth/reset when none is given', async () => {
    mockAdminUsers.mockResolvedValue({ ok: true, data: { sent: true } });

    await adminSendPasswordReset({ userId: 'admin-target-1' });

    expect(mockAdminUsers).toHaveBeenCalledTimes(1);
    const payload = mockAdminUsers.mock.calls[0][0] as { redirectTo?: string; action: string };
    expect(payload.action).toBe('send_password_reset');
    expect(payload.redirectTo).toBe('https://dev.cdiscourse.com/auth/reset');
  });

  it('preserves an explicit redirectTo (the default does not override it)', async () => {
    mockAdminUsers.mockResolvedValue({ ok: true, data: { sent: true } });

    await adminSendPasswordReset({
      userId: 'admin-target-1',
      redirectTo: 'https://custom.example.com/path',
    });

    const payload = mockAdminUsers.mock.calls[0][0] as { redirectTo?: string };
    expect(payload.redirectTo).toBe('https://custom.example.com/path');
  });

  it('forwards redirectTo undefined when buildAuthRedirectUrl throws', async () => {
    mockResolveRuntimeOrigin.mockReturnValue('file:///etc/passwd');
    mockAdminUsers.mockResolvedValue({ ok: true, data: { sent: true } });

    await adminSendPasswordReset({ userId: 'admin-target-1' });

    expect(mockAdminUsers).toHaveBeenCalledTimes(1);
    const payload = mockAdminUsers.mock.calls[0][0] as { redirectTo?: string };
    expect(payload.redirectTo).toBeUndefined();
  });
});
