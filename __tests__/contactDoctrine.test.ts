/**
 * PR-004 — doctrine ban-list + safety source-scan for the contact
 * info surface (ContactInfoSection + contactApi + AccountScreen).
 *
 * Cross-file doctrine assertions that complement the per-file
 * source-scan blocks in contactApi.test.ts and contactInfoSection.test.tsx.
 *
 * Mandatory:
 *   - No verdict / truth tokens leak into ANY surface file copy.
 *   - No internal codes (snake_case) leak into rendered text.
 *   - accountApi.buildProfileUpdatePayload allowlist remains
 *     `display_name` only (no email / role / id escalation surface).
 *   - accountApi.fetchOwnProfile no longer references avatar columns.
 *   - No supabase.from('profiles').update({ email: ... }) anywhere.
 *   - No service-role import in any PR-004 source file.
 *   - No AI provider import in any PR-004 source file.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ACCOUNT_DIR = join(__dirname, '..', 'src', 'features', 'account');

function read(rel: string): string {
  return readFileSync(join(ACCOUNT_DIR, rel), 'utf8');
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const CONTACT_API = read('contactApi.ts');
const SECTION = read('ContactInfoSection.tsx');
const SCREEN = read('AccountScreen.tsx');
const ACCOUNT_API = read('accountApi.ts');
const TYPES = read('types.ts');

const ALL_SOURCES: Record<string, string> = {
  'contactApi.ts': CONTACT_API,
  'ContactInfoSection.tsx': SECTION,
  'AccountScreen.tsx': SCREEN,
  'accountApi.ts': ACCOUNT_API,
  'types.ts': TYPES,
};

const ALL_CODE = Object.fromEntries(
  Object.entries(ALL_SOURCES).map(([k, v]) => [k, stripComments(v)]),
);

// ── Verdict / truth ban-list ────────────────────────────────────

describe('verdict / truth ban-list (PR-004)', () => {
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'inappropriate',
    'violation',
    'banned',
    'spam',
    'verdict',
  ];

  it.each(Object.keys(ALL_SOURCES))(
    '%s contains no banned verdict token in code',
    (file) => {
      const code = ALL_CODE[file].toLowerCase();
      for (const b of BANNED) {
        expect({ file, token: b, present: code.includes(b) }).toEqual({
          file,
          token: b,
          present: false,
        });
      }
    },
  );
});

// ── No internal code in rendered text ──────────────────────────

describe('internal codes never leak into rendered text (PR-004)', () => {
  const INTERNAL_CODES = [
    'invalid_email',
    'same_as_current',
    'email_already_used',
    'rate_limited',
    'network_error',
    'no_session',
    'config_missing',
    'verification_pending',
    'avatar_path',
    'avatar_thumb_path',
    'avatar_updated_at',
    'avatar_moderation_status',
  ];

  it('ContactInfoSection: no internal code appears inside a <Text>...</Text> body', () => {
    const code = ALL_CODE['ContactInfoSection.tsx'];
    for (const c of INTERNAL_CODES) {
      const re = new RegExp(`<Text[^>]*>\\s*[^<]*${c}[^<]*\\s*<`);
      expect({ code: c, present: re.test(code) }).toEqual({ code: c, present: false });
    }
  });

  it('AccountScreen: no internal code appears inside a <Text>...</Text> body', () => {
    const code = ALL_CODE['AccountScreen.tsx'];
    for (const c of INTERNAL_CODES) {
      const re = new RegExp(`<Text[^>]*>\\s*[^<]*${c}[^<]*\\s*<`);
      expect({ code: c, present: re.test(code) }).toEqual({ code: c, present: false });
    }
  });
});

// ── No role / id / email escalation surface ────────────────────

describe('buildProfileUpdatePayload allowlist preserved (PR-004)', () => {
  it('accountApi.buildProfileUpdatePayload returns ONLY display_name', () => {
    const code = ALL_CODE['accountApi.ts'];
    // Find the function body and assert it only contains `display_name`.
    // The function shape is preserved from pre-PR-004.
    const fnMatch = code.match(
      /export function buildProfileUpdatePayload[\s\S]*?\{([\s\S]*?)\n\}/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('display_name');
    // No email / role / id / avatar field escapes the allowlist.
    expect(body).not.toMatch(/['"]email['"]\s*:/);
    expect(body).not.toMatch(/['"]role['"]\s*:/);
    expect(body).not.toMatch(/['"]id['"]\s*:/);
    expect(body).not.toMatch(/avatar_/);
  });
});

// ── No supabase.from('profiles').update({ email: ... }) ────────

describe('no email-on-profiles writes anywhere in PR-004 source (Q4)', () => {
  it.each(Object.keys(ALL_SOURCES))('%s does not update profiles with an email column', (file) => {
    const code = ALL_CODE[file];
    // Any direct write to profiles in this surface is suspicious. The
    // only place that should touch profiles is accountApi.updateOwnDisplayName,
    // and its payload is filtered through buildProfileUpdatePayload.
    expect(code).not.toMatch(/from\(['"]profiles['"]\)\.update\([^)]*email/);
    expect(code).not.toMatch(/from\(['"]profiles['"]\)\.upsert\([^)]*email/);
  });
});

// ── accountApi.fetchOwnProfile no longer references avatar columns ──

describe('accountApi.fetchOwnProfile narrowed (Q4)', () => {
  it('does not select any avatar column from profiles', () => {
    const code = ALL_CODE['accountApi.ts'];
    expect(code).not.toContain('avatar_path');
    expect(code).not.toContain('avatar_thumb_path');
    expect(code).not.toContain('avatar_updated_at');
    expect(code).not.toContain('avatar_moderation_status');
  });

  it('does not import AvatarModerationStatus from types', () => {
    const code = ALL_CODE['accountApi.ts'];
    expect(code).not.toContain('AvatarModerationStatus');
  });
});

// ── No service-role / AI provider in any PR-004 source ─────────

describe('no service-role / AI provider import in PR-004 source files', () => {
  it.each(Object.keys(ALL_SOURCES))('%s contains no SERVICE_ROLE literal', (file) => {
    expect(ALL_CODE[file]).not.toContain('SERVICE_ROLE');
    expect(ALL_CODE[file]).not.toContain('service_role');
  });

  it.each(Object.keys(ALL_SOURCES))(
    '%s contains no AI provider import (anthropic / xai / openai)',
    (file) => {
      const lower = ALL_CODE[file].toLowerCase();
      expect(lower).not.toContain('anthropic');
      expect(lower).not.toContain(' xai');
      expect(lower).not.toContain('openai');
    },
  );
});

// ── No raw console.log / log of Authorization or Bearer ────────

describe('no console.log / Authorization / Bearer in PR-004 source files', () => {
  it.each(Object.keys(ALL_SOURCES))('%s contains no console.log', (file) => {
    expect(ALL_CODE[file]).not.toMatch(/\bconsole\.log\b/);
  });

  it.each(Object.keys(ALL_SOURCES))(
    '%s does not log Authorization or Bearer tokens',
    (file) => {
      expect(ALL_CODE[file]).not.toContain('Authorization');
      expect(ALL_CODE[file]).not.toContain('Bearer ');
    },
  );
});

// ── UserProfile interface narrowed (Q4 / migration 17) ─────────

describe('UserProfile interface narrowed (PR-004 deprecation)', () => {
  it('types.ts UserProfile has no avatar fields', () => {
    const code = ALL_CODE['types.ts'];
    expect(code).not.toContain('avatarPath');
    expect(code).not.toContain('avatarThumbPath');
    expect(code).not.toContain('avatarUpdatedAt');
    expect(code).not.toContain('avatarModerationStatus');
  });

  it('types.ts does not export AvatarModerationStatus type', () => {
    const code = ALL_CODE['types.ts'];
    expect(code).not.toMatch(/export\s+type\s+AvatarModerationStatus/);
  });
});
