/**
 * AUTH-CALLBACK-CONSUMER-001 — set-password wrapper tests.
 *
 * Mirrors the authApiRedirect.test.ts mock discipline: `../src/lib/supabase`
 * and async-storage are mocked so no network call is made. Asserts the
 * password is sent ONLY into updateUser and never appears in a returned
 * diagnostic or a console call; plus a source-scan for secrets.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockUpdateUser = jest.fn();
const mockSupabaseConfigured = { value: true };

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
  get SUPABASE_CONFIGURED() {
    return mockSupabaseConfigured.value;
  },
  readRuntimeEnv: () => ({}),
}));

import fs from 'fs';
import path from 'path';
import { setInvitedUserPassword, validateNewPassword } from '../src/features/auth/authApi';

const PASSWORD = 'super-secret-123';

beforeEach(() => {
  mockUpdateUser.mockReset();
  mockSupabaseConfigured.value = true;
});

describe('validateNewPassword', () => {
  it('rejects an empty password', () => {
    expect(validateNewPassword('')).toBe('Password must be at least 6 characters.');
  });
  it('rejects a 5-character password (boundary)', () => {
    expect(validateNewPassword('12345')).toBe('Password must be at least 6 characters.');
  });
  it('accepts a 6-character password (boundary)', () => {
    expect(validateNewPassword('123456')).toBeNull();
  });
  it('accepts a longer password', () => {
    expect(validateNewPassword(PASSWORD)).toBeNull();
  });
  it('rejects a non-string defensively', () => {
    expect(validateNewPassword(undefined as unknown as string)).toBe(
      'Password must be at least 6 characters.',
    );
  });
});

describe('setInvitedUserPassword', () => {
  it('returns config_missing and makes NO client call when unconfigured', async () => {
    mockSupabaseConfigured.value = false;
    const result = await setInvitedUserPassword(PASSWORD);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('config_missing');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser with exactly { password } and returns { ok: true }', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const result = await setInvitedUserPassword(PASSWORD);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: PASSWORD });
    expect(result).toEqual({ ok: true });
  });

  it('maps a weak-password error', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Password should be at least 6 characters' },
    });
    const result = await setInvitedUserPassword('123456');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('weak_password');
  });

  it('maps a network error', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Network request failed to fetch' },
    });
    const result = await setInvitedUserPassword(PASSWORD);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network_error');
  });

  it('maps an unrecognised error to unknown', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'totally unexpected boom' },
    });
    const result = await setInvitedUserPassword(PASSWORD);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('unknown');
  });

  it('never returns the password in the result (success or error)', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const ok = await setInvitedUserPassword(PASSWORD);
    expect(JSON.stringify(ok)).not.toContain(PASSWORD);

    mockUpdateUser.mockResolvedValue({ data: { user: null }, error: { message: 'boom' } });
    const err = await setInvitedUserPassword(PASSWORD);
    expect(JSON.stringify(err)).not.toContain(PASSWORD);
  });

  it('never logs the password to the console', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
    ];
    await setInvitedUserPassword(PASSWORD);
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
  });
});

describe('authApi.ts — no secret literals', () => {
  it('contains no SERVICE_ROLE / service_role / ANTHROPIC_API_KEY', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'features', 'auth', 'authApi.ts'),
      'utf8',
    );
    expect(src).not.toContain('SERVICE_ROLE');
    expect(src).not.toContain('service_role');
    expect(src).not.toContain('ANTHROPIC_API_KEY');
  });
});
