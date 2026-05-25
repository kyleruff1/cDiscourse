/**
 * PR-004 — ContactInfoSection tests (Q1, Q6).
 *
 * Follows the repo's source-scan discipline (see
 * ConcessionListSection.test.tsx, RespondToEvidenceForm.test.tsx). The
 * component's pure-helper layer (validateEmail, messageForContactError,
 * requestEmailChange) is covered in contactApi.test.ts. This file
 * asserts the component's contract via static source-scan:
 *   - testID prefix conventions (`contact-*`).
 *   - actor-aware control set (no <TextInput> for non-edit fields).
 *   - accessibility primitives on every Pressable.
 *   - inline error placement with accessibilityLiveRegion.
 *   - doctrine source-scan (no AI provider import, no service-role,
 *     no console.log, no raw email logging, no profiles.email write).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SECTION_PATH = join(
  __dirname,
  '..',
  'src',
  'features',
  'account',
  'ContactInfoSection.tsx',
);
const SRC = readFileSync(SECTION_PATH, 'utf8');

/**
 * Strip block + line comments. The component's docblock intentionally
 * uses doctrine keywords (`service-role`, `console.log`, etc.) as
 * teaching annotations; doctrine scans only forbid them in code.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
const CODE = stripComments(SRC);

// ── testID conventions (Q1 — PR-003 pattern preserved) ─────────

describe('ContactInfoSection — testID conventions (Q1)', () => {
  const REQUIRED_TEST_IDS = [
    'contact-info-section',
    'contact-initials-avatar',
    'contact-display-name-value',
    'contact-display-name-edit-button',
    'contact-display-name-input',
    'contact-display-name-save-button',
    'contact-display-name-cancel-button',
    'contact-email-value',
    'contact-email-change-button',
    'contact-email-input',
    'contact-email-submit-button',
    'contact-email-cancel-button',
    'contact-email-verify-pending',
  ];

  it.each(REQUIRED_TEST_IDS)('exposes %s testID', (id) => {
    expect(SRC).toContain(`testID="${id}"`);
  });

  it('all testIDs use the contact-* prefix', () => {
    const matches = SRC.match(/testID="([^"]+)"/g) ?? [];
    for (const m of matches) {
      const id = m.slice(8, -1);
      expect(id.startsWith('contact-')).toBe(true);
    }
  });
});

// ── Actor-aware control set ────────────────────────────────────

describe('ContactInfoSection — control surface', () => {
  it('only inputs the contact-display-name-input and contact-email-input fields', () => {
    // <TextInput> count should equal exactly 2 (display name + email).
    // No raw input for user_id, role, or non-editable email. Use the
    // comment-stripped source so the docblock's `<TextInput>` mention
    // is not counted.
    const textInputs = CODE.match(/<TextInput\b/g) ?? [];
    expect(textInputs.length).toBe(2);
  });

  it('does NOT import expo-image-picker', () => {
    expect(SRC).not.toMatch(/from\s+['"]expo-image-picker['"]/);
  });

  it('does NOT import the deleted avatarApi module', () => {
    expect(SRC).not.toMatch(/avatarApi/);
  });

  it('does NOT import the deleted AvatarUploadSection', () => {
    expect(SRC).not.toMatch(/AvatarUploadSection/);
  });

  it('imports the InitialsAvatar identity-facing alias', () => {
    expect(SRC).toMatch(/import\s+\{[^}]*InitialsAvatar[^}]*\}\s+from\s+['"]\.\/InitialsAvatar['"]/);
  });

  it('imports requestEmailChange + validateEmail + messageForContactError from contactApi', () => {
    expect(SRC).toMatch(/from\s+['"]\.\/contactApi['"]/);
    expect(SRC).toContain('requestEmailChange');
    expect(SRC).toContain('validateEmail');
    expect(SRC).toContain('messageForContactError');
  });
});

// ── Accessibility primitives ───────────────────────────────────

describe('ContactInfoSection — accessibility (a11y targets)', () => {
  it('every Pressable has accessibilityRole="button"', () => {
    // Find each <Pressable ...> block and assert role is present.
    // Stagger by `>` so multi-line Pressables match.
    const pressableBlocks = SRC.match(/<Pressable\b[\s\S]*?>/g) ?? [];
    expect(pressableBlocks.length).toBeGreaterThan(0);
    for (const block of pressableBlocks) {
      expect(block).toContain('accessibilityRole="button"');
    }
  });

  it('every Pressable has accessibilityLabel', () => {
    const pressableBlocks = SRC.match(/<Pressable\b[\s\S]*?>/g) ?? [];
    for (const block of pressableBlocks) {
      expect(block).toMatch(/accessibilityLabel=/);
    }
  });

  it('every Pressable uses hitSlop or has minHeight 44px in a referenced style', () => {
    // Each Pressable should set hitSlop (covers the visual <44 px case)
    // or rely on a button style that sets minHeight: 44. Both patterns
    // are valid per accessibility-targets.
    const pressableBlocks = SRC.match(/<Pressable\b[\s\S]*?>/g) ?? [];
    for (const block of pressableBlocks) {
      const hasHitSlop = /hitSlop/.test(block);
      // The block references styles like styles.primaryBtn etc. — those
      // are defined below with minHeight: 44.
      const usesButtonStyle = /styles\.(primaryBtn|secondaryBtn|editBtn|input)/.test(block);
      expect(hasHitSlop || usesButtonStyle).toBe(true);
    }

    // Each named button style must define minHeight: 44 OR receive
    // hitSlop at the use site (the editBtn pattern relies on hitSlop).
    expect(SRC).toMatch(/primaryBtn:[\s\S]*?minHeight:\s*44/);
    expect(SRC).toMatch(/secondaryBtn:[\s\S]*?minHeight:\s*44/);
    expect(SRC).toMatch(/editBtn:[\s\S]*?minHeight:\s*44/);
  });

  it('TextInput fields have accessibilityLabel', () => {
    const inputBlocks = CODE.match(/<TextInput\b[\s\S]*?\/>/g) ?? [];
    expect(inputBlocks.length).toBe(2);
    for (const block of inputBlocks) {
      expect(block).toMatch(/accessibilityLabel=/);
    }
  });

  it('inline error <Text> uses accessibilityLiveRegion="polite"', () => {
    // Every Text marked with testID="contact-*-error" must have the
    // accessibilityLiveRegion attribute set to polite.
    const errorTextBlocks =
      SRC.match(/<Text[^>]*testID="contact-[\w-]*error[\w-]*"[^>]*>/g) ?? [];
    expect(errorTextBlocks.length).toBeGreaterThan(0);
    for (const block of errorTextBlocks) {
      expect(block).toContain('accessibilityLiveRegion="polite"');
    }
  });

  it('the verification-pending <Text> uses accessibilityLiveRegion="polite"', () => {
    const pendingBlock = SRC.match(/<Text[^>]*testID="contact-email-verify-pending"[^>]*>/g);
    expect(pendingBlock).not.toBeNull();
    expect(pendingBlock![0]).toContain('accessibilityLiveRegion="polite"');
  });
});

// ── Doctrine source-scan ───────────────────────────────────────

describe('ContactInfoSection — doctrine source-scan', () => {
  it('contains no service-role import or literal', () => {
    expect(CODE).not.toContain('SERVICE_ROLE');
    expect(CODE).not.toContain('service_role');
    expect(CODE).not.toContain('serviceRoleKey');
  });

  it('contains no AI provider import or literal', () => {
    const lower = CODE.toLowerCase();
    expect(lower).not.toContain('anthropic');
    expect(lower).not.toContain('xai');
    expect(lower).not.toContain('openai');
  });

  it('contains no console.log', () => {
    expect(CODE).not.toMatch(/\bconsole\.log\b/);
  });

  it('does not log Authorization headers or Bearer tokens', () => {
    expect(CODE).not.toContain('Authorization');
    expect(CODE).not.toContain('Bearer ');
  });

  it('does not write to public.profiles.email (no such column)', () => {
    expect(CODE).not.toMatch(/from\(['"]profiles['"]\)\.update/);
    expect(CODE).not.toMatch(/profiles\.email/);
  });

  it('does not render internal codes as user-facing text', () => {
    // The component should render the result of messageForContactError
    // (plain English) — never the raw enum code. Sample: scan visible
    // string literals between >text< boundaries in JSX for snake_case
    // tokens reserved for internal use.
    const internalCodes = [
      'invalid_email',
      'same_as_current',
      'email_already_used',
      'rate_limited',
      'network_error',
      'no_session',
      'config_missing',
      'verification_pending',
    ];
    for (const code of internalCodes) {
      // Internal codes must not appear inside a <Text>...</Text> body.
      const re = new RegExp(`<Text[^>]*>\\s*[^<]*${code}[^<]*\\s*<`);
      expect(CODE).not.toMatch(re);
    }
  });

  it('no banned verdict phrase appears in source', () => {
    const banned = [
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
    ];
    const lower = CODE.toLowerCase();
    for (const b of banned) {
      expect(lower).not.toContain(b);
    }
  });
});

// ── Accountscreen wiring ───────────────────────────────────────

describe('AccountScreen — PR-004 wiring', () => {
  const SCREEN_SRC = readFileSync(
    join(__dirname, '..', 'src', 'features', 'account', 'AccountScreen.tsx'),
    'utf8',
  );

  it('AccountScreen imports and mounts ContactInfoSection', () => {
    expect(SCREEN_SRC).toMatch(/from\s+['"]\.\/ContactInfoSection['"]/);
    expect(SCREEN_SRC).toContain('<ContactInfoSection');
  });

  it('AccountScreen no longer imports AvatarUploadSection', () => {
    expect(SCREEN_SRC).not.toMatch(/AvatarUploadSection/);
  });

  it('AccountScreen no longer renders an inline Email row (now owned by ContactInfoSection)', () => {
    // The prior pattern was: <Row label="Email" ... />. Replaced.
    expect(SCREEN_SRC).not.toMatch(/Row\s+label=["']Email["']/);
  });

  it('AccountScreen no longer renders an inline display-name edit machinery', () => {
    // The prior inline edit had editingName / draftName state; those
    // are now removed (ContactInfoSection owns the edit flow).
    expect(SCREEN_SRC).not.toContain('editingName');
    expect(SCREEN_SRC).not.toContain('draftName');
  });
});
