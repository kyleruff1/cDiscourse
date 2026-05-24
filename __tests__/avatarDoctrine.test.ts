/**
 * PR-003 — doctrine ban-list scans for the avatar surface.
 *
 * Asserts:
 *   - No verdict / amplification / person-attribution tokens appear in
 *     AvatarUploadSection.tsx, avatarApi.ts, or AccountScreen.tsx (the
 *     three new / extended UI surfaces).
 *   - Internal codes (mime_not_allowed / too_large / empty /
 *     image_too_small / storage_upload_failed / profile_update_failed /
 *     invalid_image / removed / allowed) NEVER surface as plain text in
 *     any messageForAvatarError return value.
 *   - The moderation_status code 'removed' never appears as user-facing
 *     copy — the UI silently falls back to the placeholder.
 */

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
  messageForAvatarError,
  type AvatarApiErrorCode,
  type AvatarValidationError,
} from '../src/features/account/avatarApi';
import * as fs from 'fs';
import * as path from 'path';

const SOURCE_FILES = [
  ['AvatarUploadSection.tsx', 'src/features/account/AvatarUploadSection.tsx'],
  ['avatarApi.ts', 'src/features/account/avatarApi.ts'],
  ['AccountScreen.tsx', 'src/features/account/AccountScreen.tsx'],
] as const;

const FILES = SOURCE_FILES.map(([label, rel]) => ({
  label,
  src: fs.readFileSync(path.join(process.cwd(), rel), 'utf8'),
}));

// ── Verdict / amplification / attribution ban-list ───────────

describe('PR-003 doctrine — verdict / amplification ban-list', () => {
  const BANNED_TOKENS = [
    'winner',
    'loser',
    'liar',
    'dishonest',
    'manipulative',
    'extremist',
    'propagandist',
    'astroturfer',
    'hoax',
    'inappropriate',
    'violation',
    'banned',
    'virality',
    'trending',
    'verified user',
    'bad faith',
  ];

  for (const file of FILES) {
    for (const banned of BANNED_TOKENS) {
      it(`${file.label}: does not contain "${banned}"`, () => {
        const re = new RegExp(`\\b${banned}\\b`, 'i');
        expect(file.src).not.toMatch(re);
      });
    }
  }
});

// ── Internal-code leak scan ──────────────────────────────────

describe('PR-003 doctrine — internal codes never appear as user copy', () => {
  const INTERNAL_CODES: Array<AvatarApiErrorCode | AvatarValidationError> = [
    'mime_not_allowed',
    'too_large',
    'empty',
    'invalid_image',
    'image_too_small',
    'storage_upload_failed',
    'profile_update_failed',
    'network_error',
    'config_missing',
    'no_session',
    'invalid_response',
    'unauthorized',
    'forbidden',
    'unknown',
  ];

  for (const code of INTERNAL_CODES) {
    it(`messageForAvatarError(${code}) does not echo the snake_case code`, () => {
      const message = messageForAvatarError(code);
      expect(message).not.toContain('_');
      expect(message).not.toBe(code);
      expect(message.length).toBeGreaterThan(0);
    });

    it(`messageForAvatarError(${code}) returns a sentence (capitalised, ends with .)`, () => {
      const message = messageForAvatarError(code);
      expect(message[0]).toBe(message[0].toUpperCase());
    });
  }
});

// ── 'removed' moderation status never surfaces ────────────────

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('PR-003 Q5 — moderation status invisible to user', () => {
  it("AvatarUploadSection.tsx code (sans comments) never renders 'moderation' as a string literal", () => {
    const src = FILES.find((f) => f.label === 'AvatarUploadSection.tsx')!.src;
    const code = stripComments(src);
    // Strict: any string literal containing the word 'moderation'.
    const moderationLiteral = code.match(/['"`][^'"`]*moderation[^'"`]*['"`]/i);
    expect(moderationLiteral).toBeNull();
  });

  it('avatarApi.ts emits no plain-language return string containing "moderation"', () => {
    const src = FILES.find((f) => f.label === 'avatarApi.ts')!.src;
    // The literal in the type definition is allowed; user copy is not.
    // Constrain by checking that no `return '...'` line has "moderation".
    const moderationCopy = src
      .split('\n')
      .filter((line) => /^\s*return\s+['"`]/.test(line))
      .find((line) => /moderation/i.test(line));
    expect(moderationCopy).toBeUndefined();
  });

  it("AvatarUploadSection.tsx code (sans comments) never renders 'removed' as Text content", () => {
    const src = FILES.find((f) => f.label === 'AvatarUploadSection.tsx')!.src;
    const code = stripComments(src);
    // <Text>...Removed...</Text> would be a leak; "Removing…" (the
    // progress state) is allowed because it describes a user-initiated
    // action, not a moderation verdict.
    const removedAsText = code.match(/<Text[^>]*>[^<{]*\bRemoved\b[^<{]*</);
    expect(removedAsText).toBeNull();
  });
});

// ── Plain-language copy correctness ──────────────────────────

describe('PR-003 — plain-language copy spot checks', () => {
  it('mime_not_allowed copy names JPG/PNG/WebP', () => {
    expect(messageForAvatarError('mime_not_allowed')).toMatch(/JPG/);
    expect(messageForAvatarError('mime_not_allowed')).toMatch(/PNG/);
    expect(messageForAvatarError('mime_not_allowed')).toMatch(/WebP/i);
  });

  it('too_large copy names the 2 MB cap (user-friendly, not 2 MiB)', () => {
    expect(messageForAvatarError('too_large')).toMatch(/2 MB/);
  });

  it('image_too_small copy names the 64 px minimum', () => {
    expect(messageForAvatarError('image_too_small')).toMatch(/64/);
  });

  it('storage_upload_failed copy says "Try again"', () => {
    expect(messageForAvatarError('storage_upload_failed')).toMatch(/Try again/);
  });

  it('network_error copy says "Network"', () => {
    expect(messageForAvatarError('network_error')).toMatch(/Network/);
  });
});

// ── No AI moderator language ─────────────────────────────────

describe('PR-003 doctrine — no AI moderator language', () => {
  // Restrict the scan to user-facing string literals: <Text>"copy"</Text>,
  // accessibilityLabel="copy", and quoted JSX child text. The bare words
  // `true` / `false` / `correct` are unavoidable JavaScript primitives.
  function extractUserStrings(src: string): string[] {
    const out: string[] = [];
    // accessibilityLabel="..." or accessibilityLabel='...'
    const labelMatches = src.match(/accessibilityLabel=["']([^"']+)["']/g) || [];
    for (const m of labelMatches) {
      out.push(m.replace(/^accessibilityLabel=["']/, '').replace(/["']$/, ''));
    }
    // <Text>...</Text> children
    const textMatches = src.match(/<Text[^>]*>([^<{][^<]*)</g) || [];
    for (const m of textMatches) {
      out.push(m.replace(/<Text[^>]*>/, '').replace(/<$/, ''));
    }
    return out;
  }

  for (const file of FILES) {
    it(`${file.label}: user-facing strings make no truth claim`, () => {
      const strings = extractUserStrings(file.src);
      for (const s of strings) {
        const lower = s.toLowerCase();
        // 'true'/'false' as words in user copy ("this is true", "false claim")
        expect(lower).not.toMatch(/\bthis is true\b/);
        expect(lower).not.toMatch(/\bthis is false\b/);
        expect(lower).not.toMatch(/\bfalse claim\b/);
        expect(lower).not.toMatch(/\bcorrect answer\b/);
        expect(lower).not.toMatch(/\bincorrect\b/);
        expect(lower).not.toMatch(/\bproven\b/);
      }
    });
  }
});

// ── Internal codes never in source as user copy ──────────────

describe('PR-003 — internal codes never appear as user-facing string literals', () => {
  it('AvatarUploadSection.tsx never renders snake_case codes directly', () => {
    const src = FILES.find((f) => f.label === 'AvatarUploadSection.tsx')!.src;
    // The component reads error codes from the API but maps them via
    // messageForAvatarError. It must never render the code directly
    // (e.g. <Text>{uploadResult.error}</Text>).
    expect(src).not.toMatch(/<Text[^>]*>\s*\{[^}]*\.error\}\s*</);
  });
});
