/**
 * ARG-ROOM-002 (#613) — roomCapacityModel pure-TS twin tests.
 *
 * 100% on the public functions + parity against (a) publicSeatModel's reconciled
 * 6 -> 5 cap and (b) the ARG-ROOM-001 creation matrix for every binding row, so
 * the server enforcement and the client preview can never disagree.
 */
import {
  roomActiveSeatCap,
  isCreationValid,
  openSlotsAfterCreate,
  canJoinActive,
} from '../src/features/debates/roomCapacityModel';
import {
  PUBLIC_ROOM_SEAT_CAP,
  PRIMARY_SEAT_COUNT,
} from '../src/features/debates/publicSeatModel';
import { deriveArgumentRoomCreation } from '../src/features/debates/argumentRoomCreationMatrix';

describe('roomActiveSeatCap', () => {
  it('returns 5 for public, 2 for private (the derived SQL cap twin)', () => {
    expect(roomActiveSeatCap('public')).toBe(5);
    expect(roomActiveSeatCap('private')).toBe(2);
  });
});

describe('isCreationValid (structural matrix rule)', () => {
  it('private requires exactly one invite', () => {
    expect(isCreationValid('private', 0)).toBe(false);
    expect(isCreationValid('private', 1)).toBe(true);
  });

  it('public is valid with zero or one invite', () => {
    expect(isCreationValid('public', 0)).toBe(true);
    expect(isCreationValid('public', 1)).toBe(true);
  });

  it('any visibility with more than one invite is invalid (max one direct invite)', () => {
    expect(isCreationValid('public', 2)).toBe(false);
    expect(isCreationValid('private', 2)).toBe(false);
  });

  it('rejects negative / non-integer invite counts defensively', () => {
    expect(isCreationValid('public', -1)).toBe(false);
    expect(isCreationValid('public', 1.5)).toBe(false);
    expect(isCreationValid('private', Number.NaN)).toBe(false);
  });
});

describe('openSlotsAfterCreate', () => {
  it('matches the four valid matrix rows (public 4/3, private 0)', () => {
    expect(openSlotsAfterCreate('public', 0)).toBe(4);
    expect(openSlotsAfterCreate('public', 1)).toBe(3);
    expect(openSlotsAfterCreate('private', 1)).toBe(0);
  });

  it('returns 0 for any invalid creation', () => {
    expect(openSlotsAfterCreate('private', 0)).toBe(0); // private requires invite
    expect(openSlotsAfterCreate('public', 2)).toBe(0); // too many invites
  });
});

describe('canJoinActive (pure twin of the SQL trigger join check)', () => {
  it('public cap 5: boundary at active + reserved + 1 <= 5', () => {
    expect(canJoinActive(4, 0, 5)).toBe(true); // 4+0+1 = 5
    expect(canJoinActive(4, 1, 5)).toBe(false); // 4+1+1 = 6
    expect(canJoinActive(3, 1, 5)).toBe(true); // 3+1+1 = 5
    expect(canJoinActive(5, 0, 5)).toBe(false); // 5+0+1 = 6 (the 6th active join)
  });

  it('private cap 2: boundary at active + reserved + 1 <= 2', () => {
    expect(canJoinActive(1, 0, 2)).toBe(true); // 1+0+1 = 2
    expect(canJoinActive(1, 1, 2)).toBe(false); // 1+1+1 = 3 (reserved seat held)
    expect(canJoinActive(0, 1, 2)).toBe(true); // 0+1+1 = 2 (the invitee can take their seat)
  });

  it('treats negative / non-finite counts as 0 defensively', () => {
    expect(canJoinActive(-3, -2, 5)).toBe(true); // 0+0+1 = 1
    expect(canJoinActive(Number.NaN, Number.POSITIVE_INFINITY, 2)).toBe(true);
  });
});

describe('parity — cap twin matches publicSeatModel (6 -> 5 cannot half-land)', () => {
  it('roomActiveSeatCap("public") === PUBLIC_ROOM_SEAT_CAP === 5', () => {
    expect(roomActiveSeatCap('public')).toBe(PUBLIC_ROOM_SEAT_CAP);
    expect(PUBLIC_ROOM_SEAT_CAP).toBe(5);
  });

  it('roomActiveSeatCap("private") === PRIMARY_SEAT_COUNT === 2', () => {
    expect(roomActiveSeatCap('private')).toBe(PRIMARY_SEAT_COUNT);
    expect(PRIMARY_SEAT_COUNT).toBe(2);
  });
});

describe('parity — server seat math agrees with the ARG-ROOM-001 matrix on every row', () => {
  const ROWS: Array<{
    visibility: 'public' | 'private';
    emails: string[];
    invites: number;
  }> = [
    { visibility: 'private', emails: [], invites: 0 },
    { visibility: 'private', emails: ['respondent@example.com'], invites: 1 },
    { visibility: 'public', emails: [], invites: 0 },
    { visibility: 'public', emails: ['respondent@example.com'], invites: 1 },
    { visibility: 'public', emails: ['a@example.com', 'b@example.com'], invites: 2 },
  ];

  it('isCreationValid + openSlotsAfterCreate match deriveArgumentRoomCreation for each row', () => {
    for (const row of ROWS) {
      const matrix = deriveArgumentRoomCreation({
        visibility: row.visibility,
        directInviteEmails: row.emails,
      });
      expect(isCreationValid(row.visibility, row.invites)).toBe(matrix.valid);
      expect(openSlotsAfterCreate(row.visibility, row.invites)).toBe(matrix.openSlots);
      // The cap twin matches the matrix's derived capacity.
      expect(roomActiveSeatCap(row.visibility)).toBe(matrix.capacity);
    }
  });

  it('after a valid creation, the next active join check matches the open-slot count', () => {
    for (const row of ROWS) {
      const matrix = deriveArgumentRoomCreation({
        visibility: row.visibility,
        directInviteEmails: row.emails,
      });
      if (!matrix.valid) continue;
      const cap = roomActiveSeatCap(row.visibility);
      // After creation: 1 active (creator) + reservedInviteSeats reserved.
      const canAnotherJoin = canJoinActive(1, matrix.reservedInviteSeats, cap);
      expect(canAnotherJoin).toBe(matrix.openSlots > 0);
    }
  });
});
