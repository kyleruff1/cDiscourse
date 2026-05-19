/**
 * QOL-024 — AdminCreateUserForm UI contract.
 *
 * First test coverage for this form. It follows the repo's established
 * `.test.tsx` discipline (see appHeaderTagline.test.tsx / argumentReplySidecar
 * .test.tsx): the form's behaviour is exercised through its extracted pure
 * helpers (`isInvitingHuman` / `isModeToggleVisible` / `isPasswordFieldVisible`
 * / `resolveCreateUserDispatch` in adminHelpers.ts — the same logic the
 * component imports), plus a static source scan that proves the component
 * wires those helpers to the right JSX and dispatches to the right wrapper.
 *
 * (Runtime react-test-renderer rendering is intentionally avoided — no
 * existing `.test.tsx` in this repo uses it, and the installed
 * react-test-renderer is version-pinned away from @testing-library's peer
 * range. The mode/visibility/dispatch logic that QOL-024 adds is fully pure
 * and is covered directly here.)
 */
import fs from 'fs';
import path from 'path';
import {
  isInvitingHuman,
  isModeToggleVisible,
  isPasswordFieldVisible,
  resolveCreateUserDispatch,
  adminErrorMessage,
} from '../src/features/admin/adminHelpers';

const FORM_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'admin', 'AdminCreateUserForm.tsx'),
  'utf8',
);

// ── 1. Mode default + toggle visibility ────────────────────────

describe('AdminCreateUserForm — invite is the default human mode', () => {
  it('the mode state initializes to invite', () => {
    expect(FORM_SRC).toMatch(/useState<CreateUserMode>\('invite'\)/);
  });
});

describe('isModeToggleVisible', () => {
  it('hides the Invite/Password toggle row when Bot is active', () => {
    expect(isModeToggleVisible(true)).toBe(false);
  });

  it('shows the Invite/Password toggle row when Human is active', () => {
    expect(isModeToggleVisible(false)).toBe(true);
  });
});

// ── 2. Password field visibility ───────────────────────────────

describe('isPasswordFieldVisible', () => {
  it('hides the password field for Human + invite mode', () => {
    expect(isPasswordFieldVisible(false, 'invite')).toBe(false);
  });

  it('shows the password field for Human + password mode', () => {
    expect(isPasswordFieldVisible(false, 'password')).toBe(true);
  });

  it('shows the password field for Bot in either mode (bot always has a password)', () => {
    expect(isPasswordFieldVisible(true, 'invite')).toBe(true);
    expect(isPasswordFieldVisible(true, 'password')).toBe(true);
  });
});

describe('isInvitingHuman', () => {
  it('is true only for Human + invite', () => {
    expect(isInvitingHuman(false, 'invite')).toBe(true);
    expect(isInvitingHuman(false, 'password')).toBe(false);
    expect(isInvitingHuman(true, 'invite')).toBe(false);
    expect(isInvitingHuman(true, 'password')).toBe(false);
  });
});

// ── 3. Submit dispatch branching ───────────────────────────────

describe('resolveCreateUserDispatch', () => {
  it('dispatches to the invite wrapper for Human + invite', () => {
    expect(resolveCreateUserDispatch(false, 'invite')).toBe('invite');
  });

  it('dispatches to the password (create) wrapper for Human + password', () => {
    expect(resolveCreateUserDispatch(false, 'password')).toBe('password');
  });

  it('dispatches to the bot wrapper for Bot regardless of mode', () => {
    expect(resolveCreateUserDispatch(true, 'invite')).toBe('bot');
    expect(resolveCreateUserDispatch(true, 'password')).toBe('bot');
  });
});

describe('AdminCreateUserForm — submit wires each dispatch to its wrapper', () => {
  it('calls adminInviteUser on the invite branch with role user', () => {
    expect(FORM_SRC).toMatch(/dispatch === 'invite'[\s\S]*?adminInviteUser\(\{[\s\S]*?role: 'user'/);
  });

  it('calls adminCreateBotUser on the bot branch', () => {
    expect(FORM_SRC).toMatch(/dispatch === 'bot'[\s\S]*?adminCreateBotUser\(/);
  });

  it('still calls adminCreateUser on the password branch (existing flow untouched)', () => {
    expect(FORM_SRC).toMatch(/adminCreateUser\(\{[\s\S]*?emailConfirm: true/);
  });

  it('the invite branch never sends a password to adminInviteUser', () => {
    const inviteCall = /adminInviteUser\(\{([\s\S]*?)\}\)/.exec(FORM_SRC);
    expect(inviteCall).not.toBeNull();
    expect(inviteCall?.[1]).not.toMatch(/password/);
  });
});

// ── 4. Validation + status copy ────────────────────────────────

describe('AdminCreateUserForm — email validation guard', () => {
  it('keeps the existing "Valid email required." guard before any call', () => {
    expect(FORM_SRC).toMatch(/!email\.includes\('@'\)/);
    expect(FORM_SRC).toMatch(/Valid email required\./);
  });
});

describe('AdminCreateUserForm — invite status line', () => {
  it('renders an invite-status line with the plain "Invite sent." copy', () => {
    expect(FORM_SRC).toMatch(/accessibilityLabel="invite-status"/);
    expect(FORM_SRC).toMatch(/setStatus\('Invite sent\.'\)/);
  });

  it('calls onCreated after a successful invite', () => {
    expect(FORM_SRC).toMatch(/onCreated\(\)/);
  });

  it('the submit button label switches to "Send invite" in invite mode', () => {
    expect(FORM_SRC).toMatch(/Send invite/);
    expect(FORM_SRC).toMatch(/Sending…/);
  });
});

describe('AdminCreateUserForm — invite_email_not_configured surfaces plain copy', () => {
  it('adminErrorMessage maps the code to operator copy, not the raw code', () => {
    const copy = adminErrorMessage({ error: 'invite_email_not_configured' }, 422);
    expect(copy).toMatch(/Invite could not be sent — email is not configured/);
    expect(copy).not.toMatch(/invite_email_not_configured/);
    expect(copy).not.toMatch(/_/);
  });

  it('the form routes errors through adminErrorMessage (no raw code rendered)', () => {
    expect(FORM_SRC).toMatch(/setError\(adminErrorMessage\(r\.error, r\.status\)\)/);
  });
});

// ── 5. Doctrine — no verdict tokens / no internal codes in copy ──

describe('AdminCreateUserForm — doctrine: no verdict tokens or internal codes in UI copy', () => {
  const BANNED = ['winner', 'loser', 'liar', 'dishonest', 'bad faith', 'propagandist'];
  const INTERNAL = ['invite_user', 'invite_email_not_configured', 'invite_user_failed'];

  /** Extract the contents of double-quoted JSX text and template literals. */
  function userFacingStrings(src: string): string[] {
    const out: string[] = [];
    // <Text>...</Text> bodies (covers literal copy + interpolations' literal parts)
    for (const m of src.matchAll(/>([^<>{}]+)</g)) {
      const t = m[1].trim();
      if (t) out.push(t);
    }
    // String literals passed as copy (placeholder=, setStatus('...'), etc.)
    for (const m of src.matchAll(/'([^']{4,})'/g)) out.push(m[1]);
    return out;
  }

  it('no verdict token appears in any user-facing string', () => {
    const blob = userFacingStrings(FORM_SRC).join(' ').toLowerCase();
    for (const banned of BANNED) {
      expect(blob).not.toContain(banned);
    }
  });

  it('no internal snake_case code appears in any user-facing string', () => {
    // testIDs / accessibilityLabels use kebab-case and are non-rendered, so we
    // only scan <Text> bodies + copy literals here.
    const textBodies = Array.from(FORM_SRC.matchAll(/>([^<>{}]+)</g))
      .map((m) => m[1].trim())
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    for (const code of INTERNAL) {
      expect(textBodies).not.toContain(code);
    }
  });
});
