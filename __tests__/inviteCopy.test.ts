import {
  INVITE_PANEL_COPY,
  INVITE_ROLE_LABELS,
  buildInviteText,
} from '../src/features/invites/inviteCopy';
import {
  validateInviteInput,
  emptyInviteForm,
} from '../src/features/invites/inviteTypes';

describe('inviteCopy', () => {
  it('has title and subtitle', () => {
    expect(INVITE_PANEL_COPY.title).toBeTruthy();
    expect(INVITE_PANEL_COPY.subtitle).toBeTruthy();
  });

  it('includes self-directed framing (not mocking opponent)', () => {
    const values = Object.values(INVITE_PANEL_COPY).filter((v) => typeof v === 'string');
    for (const v of values) {
      expect((v as string).toLowerCase()).not.toContain('loser');
      expect((v as string).toLowerCase()).not.toContain('winner');
    }
  });

  it('buildInviteText includes room title and claim', () => {
    const text = buildInviteText('NBA Play-In Debate', 'The play-in format should be abolished.');
    expect(text).toContain('NBA Play-In Debate');
    expect(text).toContain('The play-in format should be abolished.');
  });

  it('has role labels for all expected roles', () => {
    expect(INVITE_ROLE_LABELS['challenger']).toBeTruthy();
    expect(INVITE_ROLE_LABELS['supporter']).toBeTruthy();
    expect(INVITE_ROLE_LABELS['any']).toBeTruthy();
  });

  it('backend coming soon notice is present', () => {
    expect(INVITE_PANEL_COPY.inviteBackendNotice).toBeTruthy();
    expect(INVITE_PANEL_COPY.inviteBackendNotice.toLowerCase()).toContain('later');
  });
});

describe('inviteTypes', () => {
  describe('validateInviteInput', () => {
    it('returns null for valid email', () => {
      expect(validateInviteInput('test@example.com')).toBeNull();
    });

    it('returns null for display name', () => {
      expect(validateInviteInput('someuser')).toBeNull();
    });

    it('returns error for empty input', () => {
      expect(validateInviteInput('')).toBeTruthy();
    });

    it('returns error for whitespace-only input', () => {
      expect(validateInviteInput('   ')).toBeTruthy();
    });

    it('returns error for too-long input', () => {
      expect(validateInviteInput('A'.repeat(201))).toBeTruthy();
    });
  });

  describe('emptyInviteForm', () => {
    it('returns empty form state', () => {
      const form = emptyInviteForm();
      expect(form.emailOrName).toBe('');
      expect(form.submitted).toBe(false);
      expect(form.error).toBeNull();
    });
  });
});
