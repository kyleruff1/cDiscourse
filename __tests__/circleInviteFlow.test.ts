/**
 * PRIVATE-GROUPS-002 (#859) — circle invite lifecycle flow test.
 *
 * Drives the pure-TS circleInviteLifecycle model (which mirrors the
 * manage-circle-invite Edge Function's refusal + enrol semantics) over an
 * in-memory "service client" store. Covers the full lifecycle the audit names:
 *   mint -> lookup pre-signup -> email-binding mismatch refusal ->
 *   accept enrolls member -> idempotent re-accept -> expired / revoked refusals.
 */
import {
  liveInviteStatus,
  projectLookup,
  decideAccept,
  applyEnrolment,
  type CircleInviteRecord,
  type CircleMemberRecord,
} from '../src/features/circles/circleInviteLifecycle';

const NOW = 1_700_000_000_000; // fixed deterministic clock
const DAY = 24 * 60 * 60 * 1000;

interface Store {
  invites: CircleInviteRecord[];
  members: CircleMemberRecord[];
  mint(circleId: string, email: string): CircleInviteRecord;
  liveMember(circleId: string, userId: string): CircleMemberRecord | null;
}

/** A tiny in-memory store mirroring circle_invites + circle_members. */
function makeStore(): Store {
  const store: Store = {
    invites: [],
    members: [],
    mint(circleId: string, email: string): CircleInviteRecord {
      const inv: CircleInviteRecord = {
        id: `inv-${store.invites.length + 1}`,
        circleId,
        inviteeEmailLower: email.toLowerCase(),
        status: 'pending',
        expiresAtMs: NOW + 14 * DAY,
        inviteeProfileId: null,
      };
      store.invites.push(inv);
      return inv;
    },
    // Reads store.members freshly so a `store.members = applyEnrolment(...)`
    // reassignment is visible (the model returns a NEW list, not a mutation).
    liveMember(circleId: string, userId: string): CircleMemberRecord | null {
      return (
        store.members.find((m) => m.circleId === circleId && m.userId === userId && !m.isRemoved) ??
        null
      );
    },
  };
  return store;
}

describe('circle invite flow — mint + pre-signup lookup', () => {
  it('mints a pending invite and a pre-signup lookup sees pending (never the member list)', () => {
    const store = makeStore();
    const inv = store.mint('circle-1', 'Friend@Example.com');
    expect(inv.status).toBe('pending');
    expect(inv.inviteeEmailLower).toBe('friend@example.com');

    const projected = projectLookup(inv, NOW);
    expect(projected).toEqual({ status: 'pending' });
    // The lookup projection carries ONLY the status — no members, no emails.
    expect(Object.keys(projected as object)).toEqual(['status']);
  });

  it('an unknown token maps to null (the caller returns invite_not_found)', () => {
    expect(projectLookup(null, NOW)).toBeNull();
  });
});

describe('circle invite flow — email-binding mismatch refusal', () => {
  it('refuses accept when the caller email does not match the invitee', () => {
    const store = makeStore();
    const inv = store.mint('circle-1', 'friend@example.com');
    const outcome = decideAccept({
      invite: inv,
      circleIsDeleted: false,
      callerUserId: 'user-wrong',
      callerEmailLower: 'someone.else@example.com',
      nowMs: NOW,
    });
    expect(outcome.refusal).toBe('invite_email_mismatch');
    expect(outcome.accepted).toBe(false);
    expect(outcome.enrolls).toBe(false);
    // No membership was created.
    expect(store.members).toHaveLength(0);
  });
});

describe('circle invite flow — accept enrolls the member', () => {
  it('accept with the bound email enrolls a member and flips the invite', () => {
    const store = makeStore();
    const inv = store.mint('circle-1', 'friend@example.com');

    const outcome = decideAccept({
      invite: inv,
      circleIsDeleted: false,
      callerUserId: 'user-friend',
      callerEmailLower: 'friend@example.com',
      nowMs: NOW,
    });
    expect(outcome.refusal).toBeNull();
    expect(outcome.accepted).toBe(true);
    expect(outcome.enrolls).toBe(true);

    // Apply the enrol + flip (the enrolAndFlipInvite effect).
    store.members = applyEnrolment(store.members, inv.circleId, 'user-friend');
    inv.status = 'accepted';
    inv.inviteeProfileId = 'user-friend';

    const member = store.liveMember('circle-1', 'user-friend');
    expect(member).not.toBeNull();
    expect(member!.role).toBe('member');
    expect(member!.isRemoved).toBe(false);
    expect(inv.status).toBe('accepted');
  });
});

describe('circle invite flow — idempotent re-accept', () => {
  it('the same redeemer re-accepting an accepted invite is an idempotent no-op enrol', () => {
    const store = makeStore();
    const inv = store.mint('circle-1', 'friend@example.com');
    // First accept.
    store.members = applyEnrolment(store.members, inv.circleId, 'user-friend');
    inv.status = 'accepted';
    inv.inviteeProfileId = 'user-friend';

    const second = decideAccept({
      invite: inv,
      circleIsDeleted: false,
      callerUserId: 'user-friend',
      callerEmailLower: 'friend@example.com',
      nowMs: NOW,
    });
    expect(second.refusal).toBeNull();
    expect(second.accepted).toBe(true);
    expect(second.enrolls).toBe(false); // no new enrol

    // applyEnrolment on an already-live member is a no-op (same list reference).
    const before = store.members;
    const after = applyEnrolment(store.members, inv.circleId, 'user-friend');
    expect(after).toBe(before);
    expect(store.members).toHaveLength(1);
  });

  it('a DIFFERENT user cannot re-accept an already-accepted invite', () => {
    const store = makeStore();
    const inv = store.mint('circle-1', 'friend@example.com');
    inv.status = 'accepted';
    inv.inviteeProfileId = 'user-friend';

    const other = decideAccept({
      invite: inv,
      circleIsDeleted: false,
      callerUserId: 'user-other',
      callerEmailLower: 'friend@example.com',
      nowMs: NOW,
    });
    expect(other.refusal).toBe('invite_already_accepted');
    expect(other.accepted).toBe(false);
  });
});

describe('circle invite flow — expired / revoked refusals', () => {
  it('a pending invite past its expiry is treated as expired and refused', () => {
    const store = makeStore();
    const inv = store.mint('circle-1', 'friend@example.com');
    const later = inv.expiresAtMs + DAY; // one day past expiry

    expect(liveInviteStatus(inv, later)).toBe('expired');
    const outcome = decideAccept({
      invite: inv,
      circleIsDeleted: false,
      callerUserId: 'user-friend',
      callerEmailLower: 'friend@example.com',
      nowMs: later,
    });
    expect(outcome.refusal).toBe('invite_expired');
    expect(store.members).toHaveLength(0);
  });

  it('a revoked invite is refused', () => {
    const store = makeStore();
    const inv = store.mint('circle-1', 'friend@example.com');
    inv.status = 'revoked';

    const outcome = decideAccept({
      invite: inv,
      circleIsDeleted: false,
      callerUserId: 'user-friend',
      callerEmailLower: 'friend@example.com',
      nowMs: NOW,
    });
    expect(outcome.refusal).toBe('invite_revoked');
    expect(store.members).toHaveLength(0);
  });

  it('a deleted circle refuses accept even for the bound email', () => {
    const store = makeStore();
    const inv = store.mint('circle-1', 'friend@example.com');
    const outcome = decideAccept({
      invite: inv,
      circleIsDeleted: true,
      callerUserId: 'user-friend',
      callerEmailLower: 'friend@example.com',
      nowMs: NOW,
    });
    expect(outcome.refusal).toBe('circle_deleted');
  });
});

describe('circle invite flow — re-add after removal reuses the row', () => {
  it('a previously-removed member is re-enrolled via row reuse (not a duplicate)', () => {
    const store = makeStore();
    store.members = [{ circleId: 'circle-1', userId: 'user-friend', role: 'member', isRemoved: true }];
    const after = applyEnrolment(store.members, 'circle-1', 'user-friend');
    expect(after).toHaveLength(1); // reused, not duplicated
    expect(after[0].isRemoved).toBe(false);
    expect(after[0].role).toBe('member');
  });
});
