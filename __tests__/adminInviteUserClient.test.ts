/**
 * QOL-024 — adminInviteUser client wrapper.
 *
 * The wrapper is tested with a mocked transport (`adminUsers`) so we can
 * capture the exact request payload it builds, and a mocked runtime-origin
 * boundary so the derived `redirectTo` is deterministic. No real Supabase
 * call, no real email.
 *
 * `buildAuthRedirectUrl` itself is NOT mocked — it is a pure helper and we
 * want to verify the real derived URL. Determinism comes from controlling
 * its inputs (`resolveRuntimeOrigin` / `getIsDev`).
 */
import { adminErrorMessage } from '../src/features/admin/adminHelpers';

// ── Mocks ──────────────────────────────────────────────────────
// The jest.mock factory may not reference out-of-scope variables, so the
// jest.fn()s are created inside the factory and retrieved via requireMock.

jest.mock('../src/lib/edgeFunctions', () => ({
  adminUsers: jest.fn(),
}));

jest.mock('../src/lib/auth/resolveRuntimeOrigin', () => ({
  resolveRuntimeOrigin: jest.fn(),
  getIsDev: jest.fn(),
}));

import { adminInviteUser } from '../src/features/admin/adminApi';

const adminUsersMock = jest.requireMock('../src/lib/edgeFunctions').adminUsers as jest.Mock;
const resolveRuntimeOriginMock = jest.requireMock('../src/lib/auth/resolveRuntimeOrigin')
  .resolveRuntimeOrigin as jest.Mock;
const getIsDevMock = jest.requireMock('../src/lib/auth/resolveRuntimeOrigin').getIsDev as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────

function lastPayload(): Record<string, unknown> {
  expect(adminUsersMock).toHaveBeenCalled();
  return adminUsersMock.mock.calls[adminUsersMock.mock.calls.length - 1][0] as Record<string, unknown>;
}

beforeEach(() => {
  adminUsersMock.mockReset();
  resolveRuntimeOriginMock.mockReset();
  getIsDevMock.mockReset();
  // Default: a hosted https origin, non-dev build => deterministic redirectTo.
  resolveRuntimeOriginMock.mockReturnValue('https://dev.cdiscourse.com');
  getIsDevMock.mockReturnValue(false);
  adminUsersMock.mockResolvedValue({
    ok: true,
    data: { ok: true, invited: true, notification: 'sent' },
  });
});

describe('adminInviteUser — wrapper happy path', () => {
  it('sends the invite_user action with the typed email and resolves the result', async () => {
    const r = await adminInviteUser({ email: 'a@b.com' });
    const payload = lastPayload();
    expect(payload.action).toBe('invite_user');
    expect(payload.email).toBe('a@b.com');
    expect(r).toEqual({ ok: true, data: { ok: true, invited: true, notification: 'sent' } });
  });
});

describe('adminInviteUser — role handling', () => {
  it('passes an explicit role through', async () => {
    await adminInviteUser({ email: 'a@b.com', role: 'moderator' });
    expect(lastPayload().role).toBe('moderator');
  });

  it('defaults role to user when omitted', async () => {
    await adminInviteUser({ email: 'a@b.com' });
    expect(lastPayload().role).toBe('user');
  });
});

describe('adminInviteUser — displayName handling', () => {
  it('passes displayName through when present', async () => {
    await adminInviteUser({ email: 'a@b.com', displayName: 'Test User' });
    expect(lastPayload().displayName).toBe('Test User');
  });

  it('leaves displayName undefined (not empty string) when omitted', async () => {
    await adminInviteUser({ email: 'a@b.com' });
    const payload = lastPayload();
    expect(payload.displayName).toBeUndefined();
  });
});

describe('adminInviteUser — redirectTo derivation', () => {
  it('derives a https redirectTo ending /auth/callback when none is supplied', async () => {
    await adminInviteUser({ email: 'a@b.com' });
    const redirectTo = lastPayload().redirectTo as string;
    expect(typeof redirectTo).toBe('string');
    expect(redirectTo.startsWith('https://')).toBe(true);
    expect(redirectTo.endsWith('/auth/callback')).toBe(true);
    expect(redirectTo).not.toMatch(/localhost/);
  });

  it('preserves an explicit redirectTo and does not derive the default', async () => {
    const explicit = 'https://staging.cdiscourse.com/auth/callback';
    await adminInviteUser({ email: 'a@b.com', redirectTo: explicit });
    expect(lastPayload().redirectTo).toBe(explicit);
  });

  it('fails soft to redirectTo=undefined when the origin is bad — still calls', async () => {
    // A non-https origin in a non-dev build makes buildAuthRedirectUrl throw.
    resolveRuntimeOriginMock.mockReturnValue('javascript:alert(1)');
    getIsDevMock.mockReturnValue(false);
    await adminInviteUser({ email: 'a@b.com' });
    const payload = lastPayload();
    expect(payload.redirectTo).toBeUndefined();
    // The invite call still happened — a redirect defect must not block it.
    expect(adminUsersMock).toHaveBeenCalledTimes(1);
  });
});

describe('adminInviteUser — failure passthrough', () => {
  it('surfaces a validation_failed result and yields a non-empty message', async () => {
    adminUsersMock.mockResolvedValue({
      ok: false,
      error: { error: 'validation_failed', issues: [{ message: 'bad email' }] },
      status: 422,
    });
    const r = await adminInviteUser({ email: 'bad' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(adminErrorMessage(r.error, r.status).length).toBeGreaterThan(0);
    }
  });

  it('surfaces a 403 forbidden result mapped to "Admin access required."', async () => {
    adminUsersMock.mockResolvedValue({
      ok: false,
      error: { error: 'forbidden', reason: 'admin_required' },
      status: 403,
    });
    const r = await adminInviteUser({ email: 'a@b.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(adminErrorMessage(r.error, r.status)).toBe('Admin access required.');
    }
  });

  it('surfaces a duplicate-email / invite_user_failed result with a non-empty detail', async () => {
    adminUsersMock.mockResolvedValue({
      ok: false,
      error: { error: 'invite_user_failed', detail: 'A user with this email already exists' },
      status: 422,
    });
    const r = await adminInviteUser({ email: 'dup@b.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(adminErrorMessage(r.error, r.status).length).toBeGreaterThan(0);
    }
  });
});

describe('adminInviteUser — request body is doctrine-clean', () => {
  it('carries no service-role / token / password substrings', async () => {
    await adminInviteUser({ email: 'a@b.com', displayName: 'Test User', role: 'moderator' });
    const serialized = JSON.stringify(lastPayload());
    for (const banned of ['SERVICE_ROLE', 'service_role', 'sb_secret_', 'Bearer ', 'eyJ', 'password']) {
      expect(serialized).not.toContain(banned);
    }
  });
});
