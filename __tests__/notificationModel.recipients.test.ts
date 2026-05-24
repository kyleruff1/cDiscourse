/**
 * QOL-040 — resolveRecipients tests. Author never self-notifies;
 * recipient sets match the design's §5 trigger catalogue.
 */
import {
  resolveRecipients,
  type ResolveRecipientsContext,
} from '../src/features/notifications/notificationModel';

const AUTHOR = 'user-author';
const PRIMARY_A = 'user-primary-a';
const PRIMARY_B = 'user-primary-b';
const OBSERVER = 'user-observer';
const INVITER = 'user-inviter';
const INVITEE = 'user-invitee';

function ctx(overrides: Partial<ResolveRecipientsContext> = {}): ResolveRecipientsContext {
  return {
    authorId: AUTHOR,
    primaryIds: [PRIMARY_A, PRIMARY_B],
    observerIds: [OBSERVER],
    ...overrides,
  };
}

describe('resolveRecipients — author never self-notifies', () => {
  it('new_response → all primaries except author', () => {
    const recipients = resolveRecipients(
      'new_response',
      ctx({ authorId: PRIMARY_A }),
    );
    expect(recipients).toEqual([PRIMARY_B]);
  });

  it('argument_settled → all primaries except author', () => {
    const recipients = resolveRecipients(
      'argument_settled',
      ctx({ authorId: PRIMARY_A }),
    );
    expect(recipients).toEqual([PRIMARY_B]);
  });

  it('chime_in_posted → both primaries; observer-author stripped', () => {
    const recipients = resolveRecipients(
      'chime_in_posted',
      ctx({ authorId: OBSERVER }),
    );
    expect(recipients.sort()).toEqual([PRIMARY_A, PRIMARY_B].sort());
  });

  it('concession_challenged → the challenged-concession author', () => {
    const recipients = resolveRecipients(
      'concession_challenged',
      ctx({
        authorId: PRIMARY_B, // the challenger
        challengedConcessionAuthorId: PRIMARY_A,
      }),
    );
    expect(recipients).toEqual([PRIMARY_A]);
  });

  it('concession_challenged → empty if author is the challenged concession author (self-loop)', () => {
    const recipients = resolveRecipients(
      'concession_challenged',
      ctx({
        authorId: PRIMARY_A,
        challengedConcessionAuthorId: PRIMARY_A,
      }),
    );
    expect(recipients).toEqual([]);
  });

  it('source_requested → the source target', () => {
    const recipients = resolveRecipients(
      'source_requested',
      ctx({
        authorId: PRIMARY_A,
        sourceRequestTargetId: PRIMARY_B,
      }),
    );
    expect(recipients).toEqual([PRIMARY_B]);
  });

  it('evidence_supplied → the source requester', () => {
    const recipients = resolveRecipients(
      'evidence_supplied',
      ctx({
        authorId: PRIMARY_B,
        sourceRequesterId: PRIMARY_A,
      }),
    );
    expect(recipients).toEqual([PRIMARY_A]);
  });

  it('chime_in_rejected → the chime-in author only', () => {
    const recipients = resolveRecipients(
      'chime_in_rejected',
      ctx({
        authorId: PRIMARY_A, // the rejecter
        chimeInAuthorId: OBSERVER,
      }),
    );
    expect(recipients).toEqual([OBSERVER]);
  });

  it('room_made_private → prior-access set minus current participants', () => {
    const removed = 'user-removed-observer';
    const recipients = resolveRecipients(
      'room_made_private',
      ctx({
        authorId: PRIMARY_A, // the room creator who transitioned
        priorReadAccessIds: [PRIMARY_A, PRIMARY_B, OBSERVER, removed],
      }),
    );
    // Strips current primaries + observers; keeps the removed
    // user. Author is also stripped by dedupe.
    expect(recipients).toEqual([removed]);
  });

  it('invite → only the existing-account invitee, if any', () => {
    const recipients = resolveRecipients(
      'invite',
      ctx({
        authorId: INVITER,
        inviteeUserId: INVITEE,
      }),
    );
    expect(recipients).toEqual([INVITEE]);
  });

  it('invite → empty when invitee has no account (no inviteeUserId)', () => {
    const recipients = resolveRecipients('invite', ctx({ authorId: INVITER }));
    expect(recipients).toEqual([]);
  });

  it('invite_accepted_by_invitee → the inviter only', () => {
    const recipients = resolveRecipients(
      'invite_accepted_by_invitee',
      ctx({
        authorId: INVITEE,
        inviterId: INVITER,
      }),
    );
    expect(recipients).toEqual([INVITER]);
  });

  it('invite_accepted_by_invitee → empty when invitee accepted their own invite (self-loop)', () => {
    const recipients = resolveRecipients(
      'invite_accepted_by_invitee',
      ctx({
        authorId: INVITER,
        inviterId: INVITER,
      }),
    );
    expect(recipients).toEqual([]);
  });

  it('handles wrong-shape input safely (returns [], never throws)', () => {
    expect(resolveRecipients('new_response', null as unknown as ResolveRecipientsContext)).toEqual([]);
    expect(resolveRecipients('new_response', undefined as unknown as ResolveRecipientsContext)).toEqual([]);
  });

  it('dedupes the recipient list', () => {
    const recipients = resolveRecipients(
      'new_response',
      ctx({
        authorId: 'someone-else',
        primaryIds: [PRIMARY_A, PRIMARY_A, PRIMARY_B, PRIMARY_B],
      }),
    );
    expect(recipients).toHaveLength(2);
    expect(recipients.sort()).toEqual([PRIMARY_A, PRIMARY_B].sort());
  });
});
