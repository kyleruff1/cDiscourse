/**
 * PR-003 — Q3 + Q5 + Q6 client wrapper tests.
 *
 * Exercises resolveAvatarPublicUrl (pure), buildAvatarUploadPayload
 * (mocked fetch + Blob), the three Edge Function callers
 * (uploadAvatar / removeAvatar / readAvatarUrlsForUser) with a mocked
 * fetch + mocked supabase auth surface, and the error-mapping table.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// jest.mock factories cannot close over local variables — they are hoisted.
// Stash the mocks on globalThis so the factory can read them at runtime.
const _getPublicUrlMock = jest.fn();
const _getSessionMock = jest.fn();
(globalThis as unknown as { __avatarMocks: { getPublicUrl: typeof _getPublicUrlMock; getSession: typeof _getSessionMock } }).__avatarMocks = {
  getPublicUrl: _getPublicUrlMock,
  getSession: _getSessionMock,
};
const getPublicUrlMock = _getPublicUrlMock;
const getSessionMock = _getSessionMock;

jest.mock('../src/lib/supabase', () => ({
  SUPABASE_CONFIGURED: true,
  supabase: {
    supabaseUrl: 'https://test.supabase.co',
    storage: {
      from: () => ({
        getPublicUrl: (...args: unknown[]) =>
          (globalThis as unknown as { __avatarMocks: { getPublicUrl: jest.Mock } }).__avatarMocks.getPublicUrl(...args),
      }),
    },
    auth: {
      getSession: (...args: unknown[]) =>
        (globalThis as unknown as { __avatarMocks: { getSession: jest.Mock } }).__avatarMocks.getSession(...args),
    },
  },
}));

import {
  buildAvatarUploadPayload,
  messageForAvatarError,
  readAvatarUrlsForUser,
  removeAvatar,
  resolveAvatarPublicUrl,
  uploadAvatar,
} from '../src/features/account/avatarApi';

const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
(global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  fetchMock.mockReset();
  getPublicUrlMock.mockReset();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: 'jwt-token-12345' } } });
  getPublicUrlMock.mockReturnValue({
    data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/profile-avatars/uid/avatar-256.webp' },
  });
});

// ── resolveAvatarPublicUrl (pure) ─────────────────────────────

describe('PR-003 — resolveAvatarPublicUrl', () => {
  it('returns null for a null path', () => {
    expect(resolveAvatarPublicUrl(null)).toBeNull();
  });

  it('returns null for an empty path', () => {
    expect(resolveAvatarPublicUrl('')).toBeNull();
  });

  it('returns the public URL for a valid path', () => {
    const url = resolveAvatarPublicUrl('uid/avatar-256.webp');
    expect(url).toContain('https://');
    expect(getPublicUrlMock).toHaveBeenCalledWith('uid/avatar-256.webp');
  });

  it('appends ?v=<token> when a cacheBustToken is supplied', () => {
    const url = resolveAvatarPublicUrl('uid/avatar-256.webp', {
      cacheBustToken: '2026-05-25T00:00:00Z',
    });
    expect(url).toContain('?v=');
    expect(url).toContain(encodeURIComponent('2026-05-25T00:00:00Z'));
  });

  it('uses & when the URL already has a query string', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://test.supabase.co/x?token=abc' },
    });
    const url = resolveAvatarPublicUrl('uid/avatar-256.webp', { cacheBustToken: 't1' });
    expect(url).toContain('?token=abc&v=t1');
  });

  it('does not append when token is null', () => {
    const url = resolveAvatarPublicUrl('uid/avatar-256.webp', { cacheBustToken: null });
    expect(url).not.toContain('?v=');
  });

  it('does not append when token is undefined', () => {
    const url = resolveAvatarPublicUrl('uid/avatar-256.webp');
    expect(url).not.toContain('?v=');
  });
});

// ── messageForAvatarError mapping (Q5 doctrine — plain language) ─

describe('PR-003 Q5 — messageForAvatarError (plain language)', () => {
  it('maps mime_not_allowed to user-readable copy', () => {
    expect(messageForAvatarError('mime_not_allowed')).toBe('Use a JPG, PNG, or WebP photo.');
  });

  it('maps too_large to user-readable copy', () => {
    expect(messageForAvatarError('too_large')).toBe('That photo is too large (max 2 MB).');
  });

  it('maps empty to user-readable copy', () => {
    expect(messageForAvatarError('empty')).toContain("couldn't read");
  });

  it('maps invalid_image to user-readable copy', () => {
    expect(messageForAvatarError('invalid_image')).toContain("couldn't read");
  });

  it('maps image_too_small to user-readable copy', () => {
    expect(messageForAvatarError('image_too_small')).toContain('64');
  });

  it('maps storage_upload_failed to a retry message', () => {
    expect(messageForAvatarError('storage_upload_failed')).toContain('Try again');
  });

  it('maps profile_update_failed to a retry message', () => {
    expect(messageForAvatarError('profile_update_failed')).toContain('Try again');
  });

  it('maps network_error to a retry message', () => {
    expect(messageForAvatarError('network_error')).toContain('Network');
  });

  it('maps unknown to a fallback message', () => {
    expect(messageForAvatarError('unknown')).toContain('wrong');
  });
});

// ── buildAvatarUploadPayload ──────────────────────────────────

describe('PR-003 Q3 — buildAvatarUploadPayload', () => {
  it('fetches the URI, reads bytes, and returns base64 + mime + length', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    fetchMock.mockResolvedValue({
      blob: async () => ({
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      }),
    } as unknown as Response);

    const payload = await buildAvatarUploadPayload({
      uri: 'file:///tmp/avatar.png',
      mimeType: 'image/png',
    });

    expect(payload.mimeType).toBe('image/png');
    expect(payload.originalByteLength).toBe(4);
    expect(payload.imageBase64).toBe(btoa('\x89PNG'));
  });
});

// ── uploadAvatar Edge Function caller ─────────────────────────

describe('PR-003 Q3 — uploadAvatar', () => {
  it('returns ok on a 200 response with the expected shape', async () => {
    const bytes = new Uint8Array(10);
    fetchMock
      .mockResolvedValueOnce({
        blob: async () => ({
          arrayBuffer: async () => bytes.buffer,
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          avatarPath: 'uid/avatar-256.webp',
          avatarThumbPath: 'uid/avatar-64.webp',
          avatarUpdatedAt: '2026-05-25T00:00:00Z',
          publicUrl: 'https://x/y',
          publicThumbUrl: 'https://x/z',
        }),
      } as unknown as Response);

    const result = await uploadAvatar({ uri: 'file:///x.jpg', mimeType: 'image/jpeg' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.avatarPath).toBe('uid/avatar-256.webp');
      expect(result.data.publicUrl).toBe('https://x/y');
    }
  });

  it('sends Authorization header with the session access token', async () => {
    const bytes = new Uint8Array(10);
    fetchMock
      .mockResolvedValueOnce({
        blob: async () => ({ arrayBuffer: async () => bytes.buffer }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          avatarPath: 'p',
          avatarThumbPath: 't',
          avatarUpdatedAt: 'now',
          publicUrl: null,
          publicThumbUrl: null,
        }),
      } as unknown as Response);

    await uploadAvatar({ uri: 'file:///x.jpg', mimeType: 'image/jpeg' });
    const callArgs = fetchMock.mock.calls[1];
    expect(callArgs[0]).toContain('/functions/v1/upload-avatar');
    const init = callArgs[1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer jwt-token-12345');
  });

  it('returns no_session when there is no JWT', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    const bytes = new Uint8Array(10);
    // The first fetch reads the picker URI (success) so we reach the
    // Edge Function caller. The second fetch (the Edge Function call) is
    // skipped because the session is null — the function returns
    // no_session before issuing the request.
    fetchMock.mockResolvedValueOnce({
      blob: async () => ({ arrayBuffer: async () => bytes.buffer }),
    } as unknown as Response);
    const result = await uploadAvatar({ uri: 'file:///x.jpg', mimeType: 'image/jpeg' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('no_session');
    }
  });

  it('maps a server error mime_not_allowed to the same client code', async () => {
    const bytes = new Uint8Array(10);
    fetchMock
      .mockResolvedValueOnce({
        blob: async () => ({ arrayBuffer: async () => bytes.buffer }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'bad_request', detail: 'mime_not_allowed' }),
      } as unknown as Response);

    const result = await uploadAvatar({ uri: 'file:///x.jpg', mimeType: 'image/jpeg' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('mime_not_allowed');
    }
  });

  it('maps a server error too_large to the same client code', async () => {
    const bytes = new Uint8Array(10);
    fetchMock
      .mockResolvedValueOnce({
        blob: async () => ({ arrayBuffer: async () => bytes.buffer }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'bad_request', detail: 'too_large' }),
      } as unknown as Response);

    const result = await uploadAvatar({ uri: 'file:///x.jpg', mimeType: 'image/jpeg' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('too_large');
  });

  it('maps a 500 storage_upload_failed', async () => {
    const bytes = new Uint8Array(10);
    fetchMock
      .mockResolvedValueOnce({
        blob: async () => ({ arrayBuffer: async () => bytes.buffer }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal_error', detail: 'storage_upload_failed' }),
      } as unknown as Response);

    const result = await uploadAvatar({ uri: 'file:///x.jpg', mimeType: 'image/jpeg' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('storage_upload_failed');
  });

  it('rejects an unsupported MIME at the client before any network call', async () => {
    const result = await uploadAvatar({
      uri: 'file:///x.heic',
      mimeType: 'image/heic' as unknown as 'image/jpeg',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('mime_not_allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns network_error when fetch throws', async () => {
    const bytes = new Uint8Array(10);
    fetchMock
      .mockResolvedValueOnce({
        blob: async () => ({ arrayBuffer: async () => bytes.buffer }),
      } as unknown as Response)
      .mockRejectedValueOnce(new Error('socket'));

    const result = await uploadAvatar({ uri: 'file:///x.jpg', mimeType: 'image/jpeg' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network_error');
  });
});

// ── removeAvatar ──────────────────────────────────────────────

describe('PR-003 — removeAvatar', () => {
  it('returns ok on success with avatarUpdatedAt echoed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ removed: true, avatarUpdatedAt: '2026-05-25T00:00:01Z' }),
    } as unknown as Response);

    const result = await removeAvatar();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.avatarUpdatedAt).toBe('2026-05-25T00:00:01Z');
  });

  it('returns network_error when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const result = await removeAvatar();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network_error');
  });
});

// ── readAvatarUrlsForUser (Q5 moderation gating) ──────────────

describe('PR-003 Q5 — readAvatarUrlsForUser', () => {
  it('returns publicUrl + publicThumbUrl when moderationStatus is allowed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        publicUrl: 'https://a',
        publicThumbUrl: 'https://b',
        moderationStatus: 'allowed',
      }),
    } as unknown as Response);

    const result = await readAvatarUrlsForUser('11111111-1111-1111-1111-111111111111');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.publicUrl).toBe('https://a');
      expect(result.data.publicThumbUrl).toBe('https://b');
      expect(result.data.moderationStatus).toBe('allowed');
    }
  });

  it('returns null URLs + removed status when the user has been moderated out', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        publicUrl: null,
        publicThumbUrl: null,
        moderationStatus: 'removed',
      }),
    } as unknown as Response);

    const result = await readAvatarUrlsForUser('11111111-1111-1111-1111-111111111111');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.publicUrl).toBeNull();
      expect(result.data.publicThumbUrl).toBeNull();
      expect(result.data.moderationStatus).toBe('removed');
    }
  });

  it('returns null URLs + allowed status when the user has no avatar', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        publicUrl: null,
        publicThumbUrl: null,
        moderationStatus: 'allowed',
      }),
    } as unknown as Response);

    const result = await readAvatarUrlsForUser('11111111-1111-1111-1111-111111111111');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.publicUrl).toBeNull();
      expect(result.data.moderationStatus).toBe('allowed');
    }
  });

  it('coerces an unknown moderation value to allowed (defensive default)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ publicUrl: null, publicThumbUrl: null, moderationStatus: 'mystery' }),
    } as unknown as Response);

    const result = await readAvatarUrlsForUser('11111111-1111-1111-1111-111111111111');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.moderationStatus).toBe('allowed');
  });
});

// ── Source-scan safety ────────────────────────────────────────

import type * as FsModule from 'fs';
import type * as PathModule from 'path';

describe('PR-003 — avatarApi source-scan safety', () => {
  const fs = jest.requireActual('fs') as typeof FsModule;
  const path = jest.requireActual('path') as typeof PathModule;
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'account', 'avatarApi.ts'),
    'utf8',
  );

  it('does not import any service-role key or AI provider', () => {
    expect(src).not.toMatch(/SERVICE_ROLE/);
    expect(src).not.toMatch(/anthropic/i);
    expect(src).not.toMatch(/openai/i);
    expect(src).not.toMatch(/api\.x\.ai/i);
  });

  it('contains no console.log / console.error / console.warn', () => {
    expect(src).not.toMatch(/console\.\w+\(/);
  });

  it('never echoes the access token in any error path', () => {
    expect(src).not.toMatch(/\bjwt-token\b/);
    expect(src).not.toMatch(/Bearer \$\{token\}.*log/i);
  });
});
