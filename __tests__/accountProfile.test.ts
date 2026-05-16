/**
 * Account profile — pure helper unit tests.
 * No Supabase calls, no network, no React.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/lib/supabase', () => ({
  supabase: {},
  SUPABASE_CONFIGURED: false,
}));

import {
  buildProfileUpdatePayload,
  formatProfileRole,
  normalizeProfileError,
  ROLE_LABELS,
} from '../src/features/account/accountApi';
import type { ProfileRole } from '../src/features/account/types';

// ── buildProfileUpdatePayload ─────────────────────────────────

describe('buildProfileUpdatePayload', () => {
  it('returns only display_name key', () => {
    const result = buildProfileUpdatePayload({ displayName: 'Alice' });
    expect(Object.keys(result)).toEqual(['display_name']);
  });

  it('trims whitespace from display name', () => {
    const result = buildProfileUpdatePayload({ displayName: '  Alice  ' });
    expect(result.display_name).toBe('Alice');
  });

  it('does NOT include role in the payload', () => {
    const result = buildProfileUpdatePayload({ displayName: 'Alice' });
    expect(result).not.toHaveProperty('role');
  });

  it('does NOT include id in the payload', () => {
    const result = buildProfileUpdatePayload({ displayName: 'Alice' });
    expect(result).not.toHaveProperty('id');
  });

  it('does NOT include email in the payload', () => {
    const result = buildProfileUpdatePayload({ displayName: 'Alice' });
    expect(result).not.toHaveProperty('email');
  });

  it('preserves an empty string after trim (caller should validate before calling)', () => {
    const result = buildProfileUpdatePayload({ displayName: '   ' });
    expect(result.display_name).toBe('');
  });
});

// ── formatProfileRole ─────────────────────────────────────────

describe('formatProfileRole', () => {
  it('returns Participant for user role', () => {
    expect(formatProfileRole('user')).toBe('Participant');
  });

  it('returns Moderator for moderator role', () => {
    expect(formatProfileRole('moderator')).toBe('Moderator');
  });

  it('returns Admin for admin role', () => {
    expect(formatProfileRole('admin')).toBe('Admin');
  });

  it('returns unknown role string for unrecognized values', () => {
    expect(formatProfileRole('superuser')).toBe('superuser');
  });

  it('covers all ProfileRole values', () => {
    const roles: ProfileRole[] = ['user', 'moderator', 'admin'];
    for (const role of roles) {
      expect(formatProfileRole(role)).toBeTruthy();
      expect(typeof formatProfileRole(role)).toBe('string');
    }
  });

  it('ROLE_LABELS has exactly 3 entries', () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(3);
  });
});

// ── normalizeProfileError ─────────────────────────────────────

describe('normalizeProfileError', () => {
  it('returns a non-empty string for every known error code', () => {
    const codes = ['not_found', 'config_missing', 'unauthorized', 'network_error', 'unknown'];
    for (const code of codes) {
      const msg = normalizeProfileError(code);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('not_found message mentions profile or account', () => {
    const msg = normalizeProfileError('not_found');
    expect(msg.toLowerCase()).toMatch(/profile|account/);
  });

  it('config_missing message mentions configuration', () => {
    const msg = normalizeProfileError('config_missing');
    expect(msg.toLowerCase()).toMatch(/configur|\.env/i);
  });

  it('unauthorized message mentions permission', () => {
    const msg = normalizeProfileError('unauthorized');
    expect(msg.toLowerCase()).toMatch(/permission/);
  });

  it('network_error message mentions network or connection', () => {
    const msg = normalizeProfileError('network_error');
    expect(msg.toLowerCase()).toMatch(/network|connection/);
  });

  it('returns fallback for undefined', () => {
    const msg = normalizeProfileError(undefined);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns fallback for unknown code', () => {
    const msg = normalizeProfileError('totally_new_error_code');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('missing profile error does NOT suggest role changes or admin access', () => {
    const msg = normalizeProfileError('not_found');
    expect(msg.toLowerCase()).not.toMatch(/role|admin|grant|escalat/);
  });
});
