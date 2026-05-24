/**
 * QOL-040 — buildNotificationCopy produces the expected neutral
 * string for all ten triggers (public + private variants where
 * applicable). Pure-model unit test — no React, no Supabase, no
 * fetch.
 */
import {
  buildNotificationCopy,
  ALL_ROOM_NOTIFICATION_TYPES,
  type RoomNotificationType,
} from '../src/features/notifications/notificationModel';

describe('buildNotificationCopy — per-trigger neutral strings', () => {
  const ROOM = 'A reasonable disagreement';

  it('invite — public room copy mentions the room title and uses neutral framing', () => {
    const { title, body } = buildNotificationCopy('invite', ROOM, {});
    expect(title).toBe('You were invited to respond to an argument');
    expect(body).toBe(ROOM);
    expect(body).not.toMatch(/challenge/i);
    expect(body).not.toMatch(/game/i);
  });

  it('invite — private room copy says private + the room title', () => {
    const { title, body } = buildNotificationCopy('invite', ROOM, { roomIsPrivate: true });
    expect(title).toBe('You were invited to a private argument');
    expect(body).toBe(ROOM);
  });

  it('new_response — title is "New response", body is just the room title', () => {
    const { title, body } = buildNotificationCopy('new_response', ROOM, {});
    expect(title).toBe('New response');
    expect(body).toBe(ROOM);
    expect(body).not.toMatch(/debate/i);
  });

  it('concession_challenged — uses neutral classification noun when present', () => {
    const { title, body } = buildNotificationCopy('concession_challenged', ROOM, { classification: 'fact' });
    expect(title).toBe('Your concession was challenged');
    expect(body).toBe(`${ROOM} — on fact.`);
  });

  it('concession_challenged — omits classification when absent', () => {
    const { title, body } = buildNotificationCopy('concession_challenged', ROOM, {});
    expect(title).toBe('Your concession was challenged');
    expect(body).toBe(ROOM);
  });

  it('concession_challenged — classification supports framing / context / fact only', () => {
    for (const c of ['framing', 'context', 'fact'] as const) {
      const { body } = buildNotificationCopy('concession_challenged', ROOM, { classification: c });
      expect(body).toContain(`on ${c}`);
    }
  });

  it('source_requested — neutral framing, no demand language', () => {
    const { title, body } = buildNotificationCopy('source_requested', ROOM, {});
    expect(title).toBe('A source was requested');
    expect(body).toBe(ROOM);
    expect(title).not.toMatch(/demand/i);
  });

  it('evidence_supplied — neutral framing, no truth claim', () => {
    const { title, body } = buildNotificationCopy('evidence_supplied', ROOM, {});
    expect(title).toBe('Evidence was supplied');
    expect(body).toBe(ROOM);
    expect(title).not.toMatch(/proven/i);
    expect(title).not.toMatch(/correct/i);
  });

  it('chime_in_posted — uses actor display name when visibility allows', () => {
    const { title, body } = buildNotificationCopy('chime_in_posted', ROOM, {
      actorNameVisible: true,
      actorDisplayName: 'Cara',
    });
    expect(title).toBe('Cara chimed in');
    expect(body).toBe(ROOM);
  });

  it('chime_in_posted — falls back to "Someone" when actor name visibility is off', () => {
    const { title } = buildNotificationCopy('chime_in_posted', ROOM, {
      actorNameVisible: false,
      actorDisplayName: 'Cara',
    });
    expect(title).toBe('Someone chimed in');
  });

  it('chime_in_posted — falls back to "Someone" when display name is absent', () => {
    const { title } = buildNotificationCopy('chime_in_posted', ROOM, {
      actorNameVisible: true,
    });
    expect(title).toBe('Someone chimed in');
  });

  it('room_made_private — neutral fact statement; no cause assigned', () => {
    const { title, body } = buildNotificationCopy('room_made_private', ROOM, {});
    expect(title).toBe('This argument was made private');
    expect(body).toBe(ROOM);
    expect(body).not.toMatch(/because/i);
  });

  it('chime_in_rejected — neutral, non-shaming framing per design §9 rule 5', () => {
    const { title, body } = buildNotificationCopy('chime_in_rejected', ROOM, {});
    expect(title).toBe('Your chime-in was marked unwanted');
    expect(body).toContain(ROOM);
    // The body describes the move's FIT to the room, NEVER the
    // person. Never says "rejected you", never names a rejecter.
    expect(body).not.toMatch(/rejected you/i);
    expect(body).not.toMatch(/wrong/i);
    expect(body).not.toMatch(/bad/i);
  });

  it('argument_settled — neutral; says "settled" never "case closed" / winner / loser', () => {
    const { title, body } = buildNotificationCopy('argument_settled', ROOM, {});
    expect(title).toBe('This argument is settled');
    expect(body).toBe(ROOM);
    expect(title).not.toMatch(/closed/i);
    expect(title).not.toMatch(/winner/i);
    expect(title).not.toMatch(/loser/i);
  });

  it('invite_accepted_by_invitee — uses actor display name when visible', () => {
    const { title, body } = buildNotificationCopy('invite_accepted_by_invitee', ROOM, {
      actorNameVisible: true,
      actorDisplayName: 'Bob',
    });
    expect(title).toBe('Bob joined');
    expect(body).toBe(ROOM);
  });

  it('invite_accepted_by_invitee — falls back to "Someone" when name not visible', () => {
    const { title } = buildNotificationCopy('invite_accepted_by_invitee', ROOM, {
      actorDisplayName: 'Bob',
    });
    expect(title).toBe('Someone joined');
  });

  it('empty room title falls back to "an argument" — never the root body', () => {
    for (const type of ALL_ROOM_NOTIFICATION_TYPES) {
      const { body } = buildNotificationCopy(type, '', {});
      expect(body).toContain('an argument');
    }
  });

  it('whitespace-only room title falls back to "an argument"', () => {
    for (const type of ALL_ROOM_NOTIFICATION_TYPES) {
      const { body } = buildNotificationCopy(type, '   ', {});
      expect(body).toContain('an argument');
    }
  });

  it('produces a non-empty title for every trigger type', () => {
    for (const type of ALL_ROOM_NOTIFICATION_TYPES) {
      const { title } = buildNotificationCopy(type as RoomNotificationType, ROOM, {});
      expect(title.length).toBeGreaterThan(0);
    }
  });

  it('produces a non-empty body for every trigger type', () => {
    for (const type of ALL_ROOM_NOTIFICATION_TYPES) {
      const { body } = buildNotificationCopy(type as RoomNotificationType, ROOM, {});
      expect(body.length).toBeGreaterThan(0);
    }
  });
});
