/**
 * QOL-040 — visibility-safe-copy tests. The actor display name
 * surfaces ONLY when meta.actorNameVisible === true, AND no
 * notification copy ever contains body-text content.
 */
import {
  buildNotificationCopy,
  ALL_ROOM_NOTIFICATION_TYPES,
  type RoomNotificationType,
  type NotificationMeta,
} from '../src/features/notifications/notificationModel';

describe('Visibility-safe copy — actor name gating', () => {
  it('chime_in_posted shows the name when actorNameVisible === true', () => {
    const { title } = buildNotificationCopy('chime_in_posted', 'X', {
      actorNameVisible: true,
      actorDisplayName: 'Cara',
    });
    expect(title).toBe('Cara chimed in');
  });

  it('chime_in_posted hides the name when actorNameVisible === false', () => {
    const { title } = buildNotificationCopy('chime_in_posted', 'X', {
      actorNameVisible: false,
      actorDisplayName: 'Cara',
    });
    expect(title).toBe('Someone chimed in');
  });

  it('chime_in_posted hides the name when actorNameVisible is undefined', () => {
    const { title } = buildNotificationCopy('chime_in_posted', 'X', { actorDisplayName: 'Cara' });
    expect(title).toBe('Someone chimed in');
  });

  it('invite_accepted_by_invitee shows the name when visibility is on', () => {
    const { title } = buildNotificationCopy('invite_accepted_by_invitee', 'X', {
      actorNameVisible: true,
      actorDisplayName: 'Bob',
    });
    expect(title).toBe('Bob joined');
  });

  it('invite_accepted_by_invitee hides the name when visibility is off', () => {
    const { title } = buildNotificationCopy('invite_accepted_by_invitee', 'X', {
      actorDisplayName: 'Bob',
    });
    expect(title).toBe('Someone joined');
  });
});

describe('Visibility-safe copy — never contains room body text', () => {
  /**
   * The copy builder receives only (type, roomTitle, meta). It
   * has no access to argument body text. This test confirms by
   * inspection that passing body-text strings through the meta
   * channel does NOT leak into copy.
   */
  const BODY_TEXT_FIXTURE = 'The detailed argument body that must never leak';

  it('no notification body contains the body-text fixture', () => {
    const ROOM = 'A reasonable disagreement';
    // We can only pass strings the API permits. Try every
    // string-shaped meta field; none should appear in the body
    // because the builder never reads them.
    const meta: NotificationMeta = {
      actorDisplayName: BODY_TEXT_FIXTURE, // the only string-shaped meta field
      actorNameVisible: true,
    };
    for (const type of ALL_ROOM_NOTIFICATION_TYPES) {
      const { body } = buildNotificationCopy(type as RoomNotificationType, ROOM, meta);
      // The actor name DOES appear in chime_in_posted +
      // invite_accepted_by_invitee titles by design. We assert
      // the BODY does not contain the fixture text.
      expect(body).not.toContain(BODY_TEXT_FIXTURE);
    }
  });
});
