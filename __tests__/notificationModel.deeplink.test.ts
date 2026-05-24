/**
 * QOL-040 — resolveDeepLink returns null for notifications the
 * recipient can no longer act on; returns a target for the
 * navigable types.
 */
import {
  resolveDeepLink,
  type RoomNotification,
} from '../src/features/notifications/notificationModel';

function row(overrides: Partial<RoomNotification> = {}): RoomNotification {
  return {
    id: 'rn-1',
    recipientId: 'user-recipient',
    debateId: 'deb-1',
    argumentId: 'arg-1',
    type: 'new_response',
    roomTitle: 'A reasonable disagreement',
    meta: {},
    readAt: null,
    createdAt: '2026-05-24T12:00:00.000Z',
    ...overrides,
  };
}

describe('resolveDeepLink', () => {
  it('new_response → { debateId, activeArgumentId }', () => {
    const link = resolveDeepLink(row({ type: 'new_response', argumentId: 'arg-2' }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: 'arg-2' });
  });

  it('concession_challenged → opens the challenging argument', () => {
    const link = resolveDeepLink(row({ type: 'concession_challenged', argumentId: 'arg-3' }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: 'arg-3' });
  });

  it('source_requested → opens the argument carrying the debt marker', () => {
    const link = resolveDeepLink(row({ type: 'source_requested', argumentId: 'arg-4' }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: 'arg-4' });
  });

  it('evidence_supplied → opens the argument the evidence is attached to', () => {
    const link = resolveDeepLink(row({ type: 'evidence_supplied', argumentId: 'arg-5' }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: 'arg-5' });
  });

  it('chime_in_posted → opens the chime-in node', () => {
    const link = resolveDeepLink(row({ type: 'chime_in_posted', argumentId: 'arg-6' }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: 'arg-6' });
  });

  it('argument_settled → opens the room root (null argumentId)', () => {
    const link = resolveDeepLink(row({ type: 'argument_settled', argumentId: null }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: null });
  });

  it('invite → opens the room root', () => {
    const link = resolveDeepLink(row({ type: 'invite', argumentId: null }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: null });
  });

  it('invite_accepted_by_invitee → opens the room root', () => {
    const link = resolveDeepLink(row({ type: 'invite_accepted_by_invitee', argumentId: null }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: null });
  });

  it('room_made_private → null (recipient has no access)', () => {
    const link = resolveDeepLink(row({ type: 'room_made_private', argumentId: null }));
    expect(link).toBeNull();
  });

  it('chime_in_rejected without revocation → opens the (retained) chime-in node', () => {
    const link = resolveDeepLink(row({ type: 'chime_in_rejected', argumentId: 'arg-7' }));
    expect(link).toEqual({ debateId: 'deb-1', activeArgumentId: 'arg-7' });
  });

  it('chime_in_rejected with concurrent made-private revocation → null', () => {
    const link = resolveDeepLink(
      row({
        type: 'chime_in_rejected',
        argumentId: 'arg-7',
        meta: { roomIsPrivate: true },
      }),
    );
    expect(link).toBeNull();
  });
});
