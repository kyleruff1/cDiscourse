/**
 * QOL-038 — inviteCopy unit tests.
 *
 * Supersedes the Stage 6.1.0 placeholder test (which asserted the
 * presence of legacy `INVITE_ROLE_LABELS` + the placeholder text). The
 * QOL-035 + QOL-038 framing has removed those exports; this test
 * covers:
 *   - the rewrite's email subject + body template
 *   - the plainLanguageForInviteError mapping
 *   - validateInviteEmailInput
 *
 * The full doctrine ban-list scan lives in
 * `__tests__/inviteCopyDoctrine.test.ts`.
 */
import {
  INVITE_PANEL_COPY,
  INVITE_REDEEM_COPY,
  INVITE_EMAIL_SUBJECT,
  buildInviteEmailBody,
  plainLanguageForInviteError,
  validateInviteEmailInput,
} from '../src/features/invites/inviteCopy';

describe('INVITE_PANEL_COPY — shape', () => {
  it('exposes the new post-QOL-038 title (no challenger framing)', () => {
    expect(INVITE_PANEL_COPY.title).toBe('Invite someone to this argument');
    expect(INVITE_PANEL_COPY.title.toLowerCase()).not.toContain('challenger');
  });

  it('has the send / sending button labels', () => {
    expect(INVITE_PANEL_COPY.sendButton).toBeTruthy();
    expect(INVITE_PANEL_COPY.sendingButton).toBeTruthy();
  });

  it('has the toolbar accessibility label (post-QOL-035 framing)', () => {
    expect(INVITE_PANEL_COPY.toolbarChipAccessibility).toBe('Invite someone to this argument');
  });
});

describe('INVITE_REDEEM_COPY — covers every state in the §7.2 + §17 table', () => {
  it('contains the §17 room-archived copy block', () => {
    expect(INVITE_REDEEM_COPY.roomArchivedTitle).toBe('Argument archived');
    const body = INVITE_REDEEM_COPY.roomArchivedBody('Sam');
    expect(body).toContain('archived');
    expect(body).toContain('Sam');
  });

  it('has copy for all primary states', () => {
    for (const key of [
      'resolvingTitle',
      'joiningTitle',
      'emailMismatchTitle',
      'expiredTitle',
      'revokedTitle',
      'alreadyUsedTitle',
      'notFoundTitle',
      'roomArchivedTitle',
      'roomClosedTitle',
      'networkErrorTitle',
      'retryButton',
      'goHomeButton',
    ] as const) {
      const value = INVITE_REDEEM_COPY[key];
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});

describe('INVITE_EMAIL_SUBJECT + buildInviteEmailBody', () => {
  it('uses the "respond to an argument" framing (not "argue about" / "challenge")', () => {
    expect(INVITE_EMAIL_SUBJECT).toBe('You were invited to respond to an argument');
    expect(INVITE_EMAIL_SUBJECT.toLowerCase()).not.toContain('challenge');
    expect(INVITE_EMAIL_SUBJECT.toLowerCase()).not.toContain('argue about');
  });

  it('embeds the room title and the invite link', () => {
    const body = buildInviteEmailBody({
      roomTitle: 'Garbage disposal duty',
      inviteLink: 'https://dev.cdiscourse.com/invite/abcdef',
      invitedByDisplayName: 'Alex',
    });
    expect(body).toContain('Garbage disposal duty');
    expect(body).toContain('https://dev.cdiscourse.com/invite/abcdef');
    expect(body).toContain('Alex');
  });

  it('falls back to "A CDiscourse user" when no inviter name', () => {
    const body = buildInviteEmailBody({
      roomTitle: 'Room 1',
      inviteLink: 'https://dev.cdiscourse.com/invite/xyz',
    });
    expect(body).toContain('A CDiscourse user');
  });

  it('falls back to "(this argument)" for empty title', () => {
    const body = buildInviteEmailBody({
      roomTitle: '',
      inviteLink: 'https://dev.cdiscourse.com/invite/xyz',
      invitedByDisplayName: 'Sam',
    });
    expect(body).toContain('(this argument)');
  });

  it('mentions the 14-day expiry hint', () => {
    const body = buildInviteEmailBody({
      roomTitle: 'A',
      inviteLink: 'https://dev.cdiscourse.com/invite/xyz',
    });
    expect(body).toContain('14 days');
  });
});

describe('plainLanguageForInviteError', () => {
  it('maps known codes to a no-snake-case string', () => {
    for (const code of [
      'cannot_invite_self',
      'room_not_visible',
      'not_allowed_to_invite',
      'room_archived',
      'room_closed',
      'invite_revoked',
      'invite_expired',
      'invite_already_accepted',
      'invite_email_mismatch',
      'invite_not_found',
      'unauthorized',
      'network_error',
    ]) {
      const msg = plainLanguageForInviteError(code);
      expect(msg).toBeTruthy();
      // Doctrine §9: no snake_case leak.
      expect(msg).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('returns the generic fallback for an unknown code (never echoes the raw code)', () => {
    const msg = plainLanguageForInviteError('my_custom_error_code_xyz');
    expect(msg).not.toContain('my_custom_error_code_xyz');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns the generic fallback for null / empty / non-string', () => {
    expect(plainLanguageForInviteError(null)).toBeTruthy();
    expect(plainLanguageForInviteError(undefined)).toBeTruthy();
    expect(plainLanguageForInviteError('')).toBeTruthy();
  });

  // ── ARG-ROOM-006 item (g): per-room one-live-invite collision relabel ──
  describe('room_already_has_invite (item g)', () => {
    it('maps to neutral plain-language copy, never the raw code', () => {
      const msg = plainLanguageForInviteError('room_already_has_invite');
      expect(msg).toBe('This argument already has an invite waiting.');
      // The raw code never reaches the user (doctrine §9).
      expect(msg).not.toContain('room_already_has_invite');
      // No snake_case leak.
      expect(msg).not.toMatch(/[a-z]+_[a-z]+/);
    });

    it('is NOT the generic insert-failed fallback (the relabel is distinct copy)', () => {
      const collision = plainLanguageForInviteError('room_already_has_invite');
      const genericInsertFail = plainLanguageForInviteError('invite_insert_failed');
      const unknownFallback = plainLanguageForInviteError('totally_unknown_code');
      expect(collision).not.toBe(genericInsertFail);
      expect(collision).not.toBe(unknownFallback);
    });

    it('does NOT reveal who was invited (no enumeration) — names no email/address', () => {
      const msg = plainLanguageForInviteError('room_already_has_invite').toLowerCase();
      // The pre-002 mislabel said "you already invited THIS address"; the
      // relabel must not reference a specific invitee, address, or email.
      expect(msg).not.toContain('@');
      expect(msg).not.toContain('address');
      expect(msg).not.toContain('email');
      expect(msg).not.toContain('this person');
    });
  });
});

describe('validateInviteEmailInput', () => {
  it('returns null for a valid email', () => {
    expect(validateInviteEmailInput('alice@example.com')).toBeNull();
  });

  it('returns an error for empty / whitespace', () => {
    expect(validateInviteEmailInput('')).toBeTruthy();
    expect(validateInviteEmailInput('   ')).toBeTruthy();
  });

  it('returns an error for an over-length address', () => {
    expect(validateInviteEmailInput(`${'a'.repeat(320)}@example.com`)).toBeTruthy();
  });

  it('returns an error for an obviously malformed address', () => {
    expect(validateInviteEmailInput('not-an-email')).toBeTruthy();
    expect(validateInviteEmailInput('user@')).toBeTruthy();
    expect(validateInviteEmailInput('@example.com')).toBeTruthy();
  });
});
