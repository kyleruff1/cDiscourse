/**
 * PR-003 — Q2 + Q4 pure validation coverage.
 *
 * Exercises validateAvatarSelection (MIME allowlist + size cap) and the
 * exported constants (AVATAR_MAX_BYTES, AVATAR_ALLOWED_MIME_TYPES,
 * AVATAR_BUCKET). All assertions are pure — no picker, no network.
 */

// avatarApi.ts imports supabase which depends on AsyncStorage; mock both
// since these tests only exercise pure helpers.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/lib/supabase', () => ({
  SUPABASE_CONFIGURED: true,
  supabase: {
    supabaseUrl: 'https://test.supabase.co',
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: null } }) }) },
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  validateAvatarSelection,
} from '../src/features/account/avatarApi';

describe('PR-003 Q4 — constants', () => {
  it('exposes the canonical bucket name', () => {
    expect(AVATAR_BUCKET).toBe('profile-avatars');
  });

  it('caps file size at exactly 2 MiB', () => {
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(AVATAR_MAX_BYTES).toBe(2097152);
  });

  it('allows exactly JPG / PNG / WebP (no HEIC, no GIF, no AVIF in v1)', () => {
    expect(AVATAR_ALLOWED_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});

describe('PR-003 Q2 — validateAvatarSelection MIME allowlist', () => {
  it('accepts image/jpeg under the size cap', () => {
    expect(validateAvatarSelection({ mimeType: 'image/jpeg', byteLength: 1024 })).toEqual({
      ok: true,
    });
  });

  it('accepts image/png under the size cap', () => {
    expect(validateAvatarSelection({ mimeType: 'image/png', byteLength: 1024 })).toEqual({
      ok: true,
    });
  });

  it('accepts image/webp under the size cap', () => {
    expect(validateAvatarSelection({ mimeType: 'image/webp', byteLength: 1024 })).toEqual({
      ok: true,
    });
  });

  it('rejects HEIC', () => {
    expect(validateAvatarSelection({ mimeType: 'image/heic', byteLength: 1024 })).toEqual({
      ok: false,
      error: 'mime_not_allowed',
    });
  });

  it('rejects GIF', () => {
    expect(validateAvatarSelection({ mimeType: 'image/gif', byteLength: 1024 })).toEqual({
      ok: false,
      error: 'mime_not_allowed',
    });
  });

  it('rejects AVIF', () => {
    expect(validateAvatarSelection({ mimeType: 'image/avif', byteLength: 1024 })).toEqual({
      ok: false,
      error: 'mime_not_allowed',
    });
  });

  it('rejects video/mp4', () => {
    expect(validateAvatarSelection({ mimeType: 'video/mp4', byteLength: 1024 })).toEqual({
      ok: false,
      error: 'mime_not_allowed',
    });
  });

  it('rejects text/plain', () => {
    expect(validateAvatarSelection({ mimeType: 'text/plain', byteLength: 1024 })).toEqual({
      ok: false,
      error: 'mime_not_allowed',
    });
  });

  it('rejects empty string MIME', () => {
    expect(validateAvatarSelection({ mimeType: '', byteLength: 1024 })).toEqual({
      ok: false,
      error: 'mime_not_allowed',
    });
  });

  it('rejects parameter-suffixed MIME (no parser; pure equality)', () => {
    expect(
      validateAvatarSelection({ mimeType: 'image/jpeg; charset=utf-8', byteLength: 1024 }),
    ).toEqual({ ok: false, error: 'mime_not_allowed' });
  });

  it('rejects an uppercased MIME (pure equality, no normalization)', () => {
    expect(validateAvatarSelection({ mimeType: 'IMAGE/JPEG', byteLength: 1024 })).toEqual({
      ok: false,
      error: 'mime_not_allowed',
    });
  });
});

describe('PR-003 Q2 — validateAvatarSelection size cap', () => {
  it('rejects 0 bytes as empty', () => {
    expect(validateAvatarSelection({ mimeType: 'image/jpeg', byteLength: 0 })).toEqual({
      ok: false,
      error: 'empty',
    });
  });

  it('rejects negative byteLength as empty', () => {
    expect(validateAvatarSelection({ mimeType: 'image/jpeg', byteLength: -1 })).toEqual({
      ok: false,
      error: 'empty',
    });
  });

  it('accepts exactly 1 byte (smallest non-empty)', () => {
    expect(validateAvatarSelection({ mimeType: 'image/jpeg', byteLength: 1 })).toEqual({
      ok: true,
    });
  });

  it('accepts exactly the cap (2 MiB)', () => {
    expect(validateAvatarSelection({ mimeType: 'image/jpeg', byteLength: AVATAR_MAX_BYTES })).toEqual({
      ok: true,
    });
  });

  it('rejects cap + 1 byte as too_large', () => {
    expect(
      validateAvatarSelection({ mimeType: 'image/jpeg', byteLength: AVATAR_MAX_BYTES + 1 }),
    ).toEqual({ ok: false, error: 'too_large' });
  });

  it('rejects 5 MiB as too_large', () => {
    expect(
      validateAvatarSelection({ mimeType: 'image/jpeg', byteLength: 5 * 1024 * 1024 }),
    ).toEqual({ ok: false, error: 'too_large' });
  });
});

describe('PR-003 Q2 — defensive input handling', () => {
  it('treats a non-string mimeType as not allowed', () => {
    expect(
      validateAvatarSelection({ mimeType: 123 as unknown as string, byteLength: 1024 }),
    ).toEqual({ ok: false, error: 'mime_not_allowed' });
  });

  it('treats a non-number byteLength as empty', () => {
    expect(
      validateAvatarSelection({
        mimeType: 'image/jpeg',
        byteLength: 'big' as unknown as number,
      }),
    ).toEqual({ ok: false, error: 'empty' });
  });
});
