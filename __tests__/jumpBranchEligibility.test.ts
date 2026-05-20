/**
 * GAME-006 — `canJump` eligibility matrix.
 *
 * Exercises every `JumpDenyReason` plus the allowed path, the fixed
 * reason-precedence order, and the "no clock" determinism guarantee.
 */
import {
  canJump,
  type BranchEngagementState,
} from '../src/features/debates/jumpBranchModel';
import {
  buildRoomContract,
  type RoomArgumentInput,
  type RoomContract,
} from '../src/features/debates/roomContractModel';
import {
  buildPublicRoomSeatMap,
  type PublicRoomSeatMap,
  type GovernanceReaction,
} from '../src/features/debates/publicSeatModel';

const INITIATOR = 'u-init';
const OPPONENT = 'u-opp';
const CHIME_A = 'u-chime-a';
const NOW = Date.parse('2026-05-20T12:00:00.000Z');

const ROOT: RoomArgumentInput = {
  id: 'root',
  parentId: null,
  authorId: INITIATOR,
  argumentType: 'thesis',
  body: 'Opening claim long enough to count as a real opening move here today.',
  status: 'posted',
  createdAt: '2026-05-20T00:30:00.000Z',
};

function move(over: Partial<RoomArgumentInput>): RoomArgumentInput {
  return {
    id: 'm',
    parentId: 'root',
    authorId: 'u',
    argumentType: 'rebuttal',
    body: 'A real argumentative move long enough to clear the qualifying gate.',
    status: 'posted',
    createdAt: '2026-05-20T01:00:00.000Z',
    ...over,
  };
}

function contractFor(args: RoomArgumentInput[]): RoomContract {
  return buildRoomContract({
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: args,
  });
}

/** A room with the OP, the Primary Opponent, and CHIME_A as a seated chime-in. */
function publicRoom(
  governanceReactions: GovernanceReaction[] = [],
  chimeInBranchIdByUserId?: Map<string, string>,
): { seatMap: PublicRoomSeatMap } {
  const args = [
    ROOT,
    move({ id: 'opp', authorId: OPPONENT, createdAt: '2026-05-20T01:00:00.000Z' }),
    move({
      id: 'ca1',
      authorId: CHIME_A,
      argumentType: 'claim',
      createdAt: '2026-05-20T02:00:00.000Z',
    }),
  ];
  const seatMap = buildPublicRoomSeatMap({
    roomContract: contractFor(args),
    arguments: args,
    participants: [],
    governanceReactions,
    chimeInBranchIdByUserId,
    nowMs: NOW,
  });
  return { seatMap };
}

const OPEN_DEST: BranchEngagementState = Object.freeze({
  branchId: 'branch-b',
  direction: 'chime_in_vertical',
  openToEngagement: true,
  isMainline: false,
});

const MAINLINE_DEST: BranchEngagementState = Object.freeze({
  branchId: 'branch-main',
  direction: 'mainline',
  openToEngagement: true,
  isMainline: true,
});

const CLOSED_DEST: BranchEngagementState = Object.freeze({
  branchId: 'branch-closed',
  direction: 'chime_in_vertical',
  openToEngagement: false,
  isMainline: false,
});

const EVIDENCE_DEST: BranchEngagementState = Object.freeze({
  branchId: 'branch-ev',
  direction: 'evidence_passthrough',
  openToEngagement: false,
  isMainline: false,
});

const UNKNOWN_DEST: BranchEngagementState = Object.freeze({
  branchId: '',
  direction: 'chime_in_vertical',
  openToEngagement: true,
  isMainline: false,
});

// ── The allowed path ───────────────────────────────────────────

describe('canJump — the allowed path', () => {
  it('a seated chime-in with an unused jump and an open destination may jump', () => {
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 0,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      OPEN_DEST,
    );
    expect(result).toEqual({ ok: true, reason: null });
  });

  it('a chime-in may jump INTO the mainline (seat role unchanged)', () => {
    // §7 edge case 7 — a jump never makes a chime-in a primary seat.
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 0,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      MAINLINE_DEST,
    );
    expect(result).toEqual({ ok: true, reason: null });
    // The seat role on the seat map is still chime_in — a jump changes the
    // branch a chime-in engages, never the seat they hold.
    const seat = seatMap.activeSeats.find((s) => s.userId === CHIME_A);
    expect(seat?.role).toBe('chime_in');
  });
});

// ── Each JumpDenyReason ────────────────────────────────────────

describe('canJump — not_a_chime_in', () => {
  it('the OP cannot jump', () => {
    const { seatMap } = publicRoom();
    const result = canJump(
      { userId: INITIATOR, seatRole: 'initiator', usedJumps: 0, homeBranchId: null },
      { seatMap },
      OPEN_DEST,
    );
    expect(result).toEqual({ ok: false, reason: 'not_a_chime_in' });
  });

  it('the Primary Opponent cannot jump', () => {
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: OPPONENT,
        seatRole: 'primary_opponent',
        usedJumps: 0,
        homeBranchId: null,
      },
      { seatMap },
      OPEN_DEST,
    );
    expect(result).toEqual({ ok: false, reason: 'not_a_chime_in' });
  });

  it('an observer who never claimed a seat cannot jump', () => {
    const { seatMap } = publicRoom();
    const result = canJump(
      { userId: 'u-watcher', seatRole: 'observer', usedJumps: 0, homeBranchId: null },
      { seatMap },
      OPEN_DEST,
    );
    expect(result).toEqual({ ok: false, reason: 'not_a_chime_in' });
  });
});

describe('canJump — no_active_seat', () => {
  it('a chime-in moved to observer by governance cannot jump', () => {
    // §7 edge case 3 — moved-to-observer participant holds no active seat.
    const reactions = [
      {
        byPrimarySeat: 'initiator' as const,
        byUserId: INITIATOR,
        targetBranchOrMessageId: 'branch-a',
        targetChimeInUserId: CHIME_A,
        kind: 'off_track' as const,
        at: '2026-05-20T05:00:00.000Z',
        retracted: false,
      },
      {
        byPrimarySeat: 'primary_opponent' as const,
        byUserId: OPPONENT,
        targetBranchOrMessageId: 'branch-a',
        targetChimeInUserId: CHIME_A,
        kind: 'off_track' as const,
        at: '2026-05-20T06:00:00.000Z',
        retracted: false,
      },
    ];
    const { seatMap } = publicRoom(reactions, new Map([[CHIME_A, 'branch-a']]));
    // The participant still passes themselves as a chime_in (a stale UI
    // handle); the seat map is the authority and shows them moved to observer.
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 0,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      OPEN_DEST,
    );
    expect(result).toEqual({ ok: false, reason: 'no_active_seat' });
  });
});

describe('canJump — jump_already_used', () => {
  it('a chime-in who has used their one jump cannot jump again', () => {
    // §7 edge case 1.
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 1,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      OPEN_DEST,
    );
    expect(result).toEqual({ ok: false, reason: 'jump_already_used' });
  });
});

describe('canJump — destination_unknown', () => {
  it('an empty destination branchId is rejected without crashing', () => {
    // §7 edge case 6.
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 0,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      UNKNOWN_DEST,
    );
    expect(result).toEqual({ ok: false, reason: 'destination_unknown' });
  });
});

describe('canJump — destination_is_home', () => {
  it('jumping to the participant own home branch is rejected', () => {
    // §7 edge case 5 — you cannot "jump" to where you already are.
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 0,
        homeBranchId: 'branch-b',
      },
      { seatMap },
      OPEN_DEST, // OPEN_DEST.branchId === 'branch-b'
    );
    expect(result).toEqual({ ok: false, reason: 'destination_is_home' });
  });
});

describe('canJump — destination_closed', () => {
  it('a collapsed branch is rejected', () => {
    // §7 edge case 2.
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 0,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      CLOSED_DEST,
    );
    expect(result).toEqual({ ok: false, reason: 'destination_closed' });
  });

  it('an evidence_passthrough branch is rejected', () => {
    // §7 edge case 2 — evidence threads are not a chime-in engagement target.
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 0,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      EVIDENCE_DEST,
    );
    expect(result).toEqual({ ok: false, reason: 'destination_closed' });
  });
});

// ── Fixed reason-precedence order ──────────────────────────────

describe('canJump — fixed reason precedence', () => {
  it('a non-chime-in with a closed destination reports not_a_chime_in (earlier rule)', () => {
    const { seatMap } = publicRoom();
    const result = canJump(
      { userId: INITIATOR, seatRole: 'initiator', usedJumps: 5, homeBranchId: null },
      { seatMap },
      CLOSED_DEST,
    );
    expect(result.reason).toBe('not_a_chime_in');
  });

  it('a used-up chime-in with an unknown destination reports jump_already_used (earlier rule)', () => {
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 1,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      UNKNOWN_DEST,
    );
    expect(result.reason).toBe('jump_already_used');
  });
});

// ── No clock / no-reset guarantee ──────────────────────────────

describe('canJump — deterministic, no clock', () => {
  it('identical inputs yield an identical result regardless of wall time', () => {
    const { seatMap } = publicRoom();
    const participant = {
      userId: CHIME_A,
      seatRole: 'chime_in' as const,
      usedJumps: 0,
      homeBranchId: 'branch-a',
    };
    const a = canJump(participant, { seatMap }, OPEN_DEST);
    const b = canJump(participant, { seatMap }, OPEN_DEST);
    expect(a).toEqual(b);
  });

  it('a participant who used their jump stays jump_already_used — no reset (OD-1)', () => {
    // §7 edge case 14 — MAX_JUMPS_PER_ROOM is a flat cap, nothing resets it.
    const { seatMap } = publicRoom();
    const result = canJump(
      {
        userId: CHIME_A,
        seatRole: 'chime_in',
        usedJumps: 1,
        homeBranchId: 'branch-a',
      },
      { seatMap },
      OPEN_DEST,
    );
    expect(result.reason).toBe('jump_already_used');
  });
});
