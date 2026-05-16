/**
 * Defense-in-depth tests:
 *  - getVisibleTabs gates the Admin tab correctly by role.
 *  - The client wrapper does not include service-role keys anywhere.
 *  - Account API never writes role.
 *  - PROTECTED_PROFILE_FIELDS is enforced in client payloads.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/lib/supabase', () => ({
  supabase: {},
  SUPABASE_CONFIGURED: false,
}));

import { getVisibleTabs, TAB_LABELS } from '../src/features/arguments/roomNavigation';
import { buildProfileUpdatePayload } from '../src/features/account/accountApi';
import { PROTECTED_PROFILE_FIELDS } from '../src/features/admin/adminHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('admin tab gating', () => {
  it('hides admin tab for role=user', () => {
    const tabs = getVisibleTabs('user', false);
    expect(tabs).not.toContain('admin');
  });

  it('hides admin tab for role=moderator', () => {
    const tabs = getVisibleTabs('moderator', false);
    expect(tabs).not.toContain('admin');
  });

  it('hides admin tab for null role', () => {
    const tabs = getVisibleTabs(null, false);
    expect(tabs).not.toContain('admin');
  });

  it('shows admin tab for role=admin', () => {
    const tabs = getVisibleTabs('admin', false);
    expect(tabs).toContain('admin');
  });

  it('shows debug tab only in dev', () => {
    expect(getVisibleTabs('admin', true)).toContain('debug');
    expect(getVisibleTabs('admin', false)).not.toContain('debug');
  });

  it('always includes arguments and account', () => {
    for (const role of [null, 'user', 'moderator', 'admin'] as const) {
      const tabs = getVisibleTabs(role, false);
      expect(tabs).toContain('arguments');
      expect(tabs).toContain('account');
    }
  });

  it('TAB_LABELS includes Admin', () => {
    expect(TAB_LABELS.admin).toBe('Admin');
  });
});

describe('account API cannot update role', () => {
  it('buildProfileUpdatePayload does not include role', () => {
    const p = buildProfileUpdatePayload({ displayName: 'Test User' });
    expect(p).not.toHaveProperty('role');
    expect(p).not.toHaveProperty('id');
    expect(p).not.toHaveProperty('email');
  });
});

describe('PROTECTED_PROFILE_FIELDS', () => {
  it('includes id, email, password', () => {
    expect(PROTECTED_PROFILE_FIELDS).toContain('id');
    expect(PROTECTED_PROFILE_FIELDS).toContain('email');
    expect(PROTECTED_PROFILE_FIELDS).toContain('password');
  });
});

describe('client never contains service-role/secret keys', () => {
  const BANNED = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEYS',
    'sb_secret_',
    'service_role_key',
    'serviceRoleKey',
  ];

  function readAllSources(dir: string): string {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) return '';
    if (fs.statSync(fullPath).isFile()) {
      return fs.readFileSync(fullPath, 'utf8');
    }
    let acc = '';
    function walk(d: string) {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile() && /\.(ts|tsx|js)$/.test(e.name)) {
          acc += '\n' + fs.readFileSync(p, 'utf8');
        }
      }
    }
    walk(fullPath);
    return acc;
  }

  it('no service-role key references in src/', () => {
    const blob = readAllSources('src');
    for (const banned of BANNED) {
      expect(blob).not.toContain(banned);
    }
  });

  it('no service-role key references in App.tsx', () => {
    const blob = readAllSources('App.tsx');
    for (const banned of BANNED) {
      expect(blob).not.toContain(banned);
    }
  });
});
