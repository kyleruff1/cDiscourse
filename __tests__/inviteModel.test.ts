/**
 * QOL-038 — pure-model unit tests for `src/features/invites/inviteModel.ts`.
 *
 * Covers the status machine, the live-status (TTL) compute, the
 * redeemability predicate, the email-masking helper, the inviter summary
 * projection, and the email normaliser. No React, no Supabase, no fetch.
 */
import {
  INVITE_TRANSITIONS,
  computeLiveStatus,
  isInviteRedeemable,
  isLegalInviteTransition,
  maskInviteeEmail,
  normaliseInviteeEmail,
  summariseInviteForInviter,
  type RoomInvite,
} from '../src/features/invites/inviteModel';

const NOW = '2026-05-24T12:00:00.000Z';
const EARLIER = '2026-05-20T12:00:00.000Z';
const PAST = '2026-05-10T12:00:00.000Z';
const FUTURE = '2026-06-07T12:00:00.000Z';

function invite(overrides: Partial<RoomInvite> = {}): RoomInvite {
  return {
    inviteId: 'inv-1',
    debateId: 'deb-1',
    invitedBy: 'user-inviter',
    inviteeEmailLower: 'alice@example.com',
    inviteeProfileId: null,
    intendedSeat: 'respondent',
    status: 'pending',
    tokenHash: 'a'.repeat(64),
    createdAt: EARLIER,
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

// ── Status machine ─────────────────────────────────────────────

describe('INVITE_TRANSITIONS — status machine shape', () => {
  it('pending may transition to accepted, revoked, or expired', () => {
    expect(INVITE_TRANSITIONS.pending).toEqual(
      expect.arrayContaining(['accepted', 'revoked', 'expired']),
    );
    expect(INVITE_TRANSITIONS.pending.length).toBe(3);
  });

  it('every terminal status has no outgoing transitions', () => {
    expect(INVITE_TRANSITIONS.accepted).toEqual([]);
    expect(INVITE_TRANSITIONS.revoked).toEqual([]);
    expect(INVITE_TRANSITIONS.expired).toEqual([]);
  });
});

describe('isLegalInviteTransition', () => {
  it.each([
    ['pending', 'accepted', true],
    ['pending', 'revoked', true],
    ['pending', 'expired', true],
    ['pending', 'pending', false],
    ['accepted', 'pending', false],
    ['accepted', 'revoked', false],
    ['revoked', 'accepted', false],
    ['expired', 'pending', false],
  ] as const)('%s → %s is %s', (from, to, expected) => {
    expect(isLegalInviteTransition(from, to)).toBe(expected);
  });

  it('rejects unknown statuses on either side', () => {
    expect(isLegalInviteTransition('bogus' as never, 'accepted')).toBe(false);
    expect(isLegalInviteTransition('pending', 'bogus' as never)).toBe(false);
  });
});

// ── Live-status / TTL ──────────────────────────────────────────

describe('computeLiveStatus — TTL honouring', () => {
  it('a pending row whose expiresAt is in the future stays pending', () => {
    const inv = invite({ status: 'pending', expiresAt: FUTURE });
    expect(computeLiveStatus(inv, NOW)).toBe('pending');
  });

  it('a pending row whose expiresAt is in the past resolves to expired', () => {
    const inv = invite({ status: 'pending', expiresAt: PAST });
    expect(computeLiveStatus(inv, NOW)).toBe('expired');
  });

  it('a non-pending status is returned unchanged regardless of TTL', () => {
    expect(computeLiveStatus({ status: 'accepted', expiresAt: PAST }, NOW)).toBe('accepted');
    expect(computeLiveStatus({ status: 'revoked', expiresAt: FUTURE }, NOW)).toBe('revoked');
    expect(computeLiveStatus({ status: 'expired', expiresAt: FUTURE }, NOW)).toBe('expired');
  });

  it('a malformed expiresAt is treated as expired (fail-closed)', () => {
    const inv = invite({ status: 'pending', expiresAt: 'not-a-date' });
    expect(computeLiveStatus(inv, NOW)).toBe('expired');
  });

  it('a malformed nowIso is treated as expired (fail-closed)', () => {
    const inv = invite({ status: 'pending', expiresAt: FUTURE });
    expect(computeLiveStatus(inv, 'also-not-a-date')).toBe('expired');
  });
});

describe('isInviteRedeemable', () => {
  it('returns true only for live-pending', () => {
    expect(isInviteRedeemable({ status: 'pending', expiresAt: FUTURE }, NOW)).toBe(true);
    expect(isInviteRedeemable({ status: 'pending', expiresAt: PAST }, NOW)).toBe(false);
    expect(isInviteRedeemable({ status: 'accepted', expiresAt: FUTURE }, NOW)).toBe(false);
    expect(isInviteRedeemable({ status: 'revoked', expiresAt: FUTURE }, NOW)).toBe(false);
    expect(isInviteRedeemable({ status: 'expired', expiresAt: FUTURE }, NOW)).toBe(false);
  });
});

// ── Email masking ──────────────────────────────────────────────

describe('maskInviteeEmail', () => {
  it('preserves the first local-part char + domain, masks the rest', () => {
    expect(maskInviteeEmail('alice@example.com')).toBe('a•••@example.com');
    expect(maskInviteeEmail('bob.smith@dev.cdiscourse.com')).toBe('b•••@dev.cdiscourse.com');
  });

  it('handles a single-char local part', () => {
    expect(maskInviteeEmail('x@y.io')).toBe('x•••@y.io');
  });

  it('returns an empty string for empty input', () => {
    expect(maskInviteeEmail('')).toBe('');
    expect(maskInviteeEmail('   ')).toBe('');
  });

  it('still masks (does not crash) on input with no @', () => {
    expect(maskInviteeEmail('not-an-email')).toBe('n•••');
  });

  it('never echoes the full email in its output', () => {
    const email = 'alice.private@example.com';
    const masked = maskInviteeEmail(email);
    // Tail of the local part must NOT appear in the output.
    expect(masked).not.toContain('lice.private');
    expect(masked).not.toContain(email);
  });
});

// ── Inviter summary projection ─────────────────────────────────

describe('summariseInviteForInviter', () => {
  it('strips tokenHash, inviteeProfileId, invitedBy, and revokedAt', () => {
    const full = invite({
      inviteeProfileId: 'profile-id-secret',
      tokenHash: 'b'.repeat(64),
      revokedAt: NOW,
    });
    const summary = summariseInviteForInviter(full);
    const keys = Object.keys(summary);
    expect(keys).not.toContain('tokenHash');
    expect(keys).not.toContain('inviteeProfileId');
    expect(keys).not.toContain('invitedBy');
    expect(keys).not.toContain('revokedAt');
  });

  it('masks the invitee email and copies the other fields verbatim', () => {
    const full = invite({
      inviteeEmailLower: 'carol@example.com',
      status: 'pending',
      acceptedAt: null,
    });
    const summary = summariseInviteForInviter(full);
    expect(summary.inviteeEmailMasked).toBe('c•••@example.com');
    expect(summary.intendedSeat).toBe('respondent');
    expect(summary.status).toBe('pending');
    expect(summary.acceptedAt).toBeNull();
  });

  it('serialises without containing the original full email or the token hash', () => {
    const full = invite({
      inviteeEmailLower: 'forwarded.address@example.org',
      tokenHash: 'c'.repeat(64),
    });
    const serialized = JSON.stringify(summariseInviteForInviter(full));
    expect(serialized).not.toContain('forwarded.address@example.org');
    expect(serialized).not.toContain('forwarded.address');
    expect(serialized).not.toContain(full.tokenHash);
  });
});

// ── Email normaliser ───────────────────────────────────────────

describe('normaliseInviteeEmail', () => {
  it('returns lowercased trimmed email for valid input', () => {
    expect(normaliseInviteeEmail('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('rejects empty, whitespace, and over-length input', () => {
    expect(normaliseInviteeEmail('')).toBeNull();
    expect(normaliseInviteeEmail('   ')).toBeNull();
    expect(normaliseInviteeEmail(`${'a'.repeat(310)}@example.com`)).toBeNull();
  });

  it('rejects no-@, multiple-@-with-no-domain-dot, and trailing-@', () => {
    expect(normaliseInviteeEmail('not-an-email')).toBeNull();
    expect(normaliseInviteeEmail('user@')).toBeNull();
    expect(normaliseInviteeEmail('user@nodot')).toBeNull();
  });

  it('rejects emails with whitespace', () => {
    expect(normaliseInviteeEmail('a b@example.com')).toBeNull();
    expect(normaliseInviteeEmail('a@exa mple.com')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(normaliseInviteeEmail(undefined as never)).toBeNull();
    expect(normaliseInviteeEmail(null as never)).toBeNull();
  });
});
