/**
 * GAME-005 — canApplyGovernanceReaction full actor matrix.
 *
 * Permutes actor role x target role x primary-seat-filled state and asserts
 * every GovernanceDenyReason plus the allowed paths. The actor matrix is
 * doctrine, not advice — a pure function the UI gates on.
 */
import {
  buildPublicRoomSeatMap,
  canApplyGovernanceReaction,
  type GovernanceDenyReason,
} from '../src/features/debates/publicSeatModel';
import {
  buildRoomContract,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';

const INITIATOR = 'u-init';
const OPPONENT = 'u-opp';
const CHIME_A = 'u-chime-a';
const CHIME_B = 'u-chime-b';
const OBSERVER = 'u-observer';
const NOW = Date.parse('2026-05-20T12:00:00.000Z');

const ROOT: RoomArgumentInput = {
  id: 'root',
  parentId: null,
  authorId: INITIATOR,
  argumentType: 'thesis',
  body: 'Opening claim long enough to count as a real opening move here.',
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

function contractFrom(args: RoomArgumentInput[]) {
  const input: BuildRoomContractInput = {
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: args,
  };
  return buildRoomContract(input);
}

/** Full room: OP + Primary Opponent + two chime-ins. */
function fullRoom() {
  const args = [
    ROOT,
    move({ id: 'opp', authorId: OPPONENT, argumentType: 'rebuttal' }),
    move({
      id: 'ca',
      authorId: CHIME_A,
      argumentType: 'claim',
      createdAt: '2026-05-20T02:00:00.000Z',
    }),
    move({
      id: 'cb',
      authorId: CHIME_B,
      argumentType: 'claim',
      createdAt: '2026-05-20T03:00:00.000Z',
    }),
  ];
  const contract = contractFrom(args);
  const seatMap = buildPublicRoomSeatMap({
    roomContract: contract,
    arguments: args,
    participants: [],
    nowMs: NOW,
  });
  return { contract, seatMap };
}

/** Open-seat room: OP only, no qualifying reply -> opponent seat open. */
function openSeatRoom() {
  const args = [ROOT];
  const contract = contractFrom(args);
  const seatMap = buildPublicRoomSeatMap({
    roomContract: contract,
    arguments: args,
    participants: [],
    nowMs: NOW,
  });
  return { contract, seatMap };
}

interface MatrixCase {
  name: string;
  actor: string;
  target: string;
  room: 'full' | 'open_seat';
  expectAllowed: boolean;
  expectReason: GovernanceDenyReason | null;
}

const CASES: MatrixCase[] = [
  {
    name: 'Initiator -> chime-in A (full room)',
    actor: INITIATOR,
    target: CHIME_A,
    room: 'full',
    expectAllowed: true,
    expectReason: null,
  },
  {
    name: 'Primary Opponent -> chime-in B (full room)',
    actor: OPPONENT,
    target: CHIME_B,
    room: 'full',
    expectAllowed: true,
    expectReason: null,
  },
  {
    name: 'chime-in A -> chime-in B (full room) — not_a_primary_party',
    actor: CHIME_A,
    target: CHIME_B,
    room: 'full',
    expectAllowed: false,
    expectReason: 'not_a_primary_party',
  },
  {
    name: 'observer -> chime-in A (full room) — not_a_primary_party',
    actor: OBSERVER,
    target: CHIME_A,
    room: 'full',
    expectAllowed: false,
    expectReason: 'not_a_primary_party',
  },
  {
    name: 'Initiator -> Initiator (full room) — self_target',
    actor: INITIATOR,
    target: INITIATOR,
    room: 'full',
    expectAllowed: false,
    expectReason: 'self_target',
  },
  {
    name: 'Initiator -> Primary Opponent (full room) — target_not_chime_in',
    actor: INITIATOR,
    target: OPPONENT,
    room: 'full',
    expectAllowed: false,
    expectReason: 'target_not_chime_in',
  },
  {
    name: 'Primary Opponent -> Initiator (full room) — target_not_chime_in',
    actor: OPPONENT,
    target: INITIATOR,
    room: 'full',
    expectAllowed: false,
    expectReason: 'target_not_chime_in',
  },
  {
    name: 'Initiator -> a non-seated user (full room) — target_not_chime_in',
    actor: INITIATOR,
    target: 'u-nobody',
    room: 'full',
    expectAllowed: false,
    expectReason: 'target_not_chime_in',
  },
  {
    name: 'Initiator -> chime-in A (open opponent seat) — primary_seat_open',
    actor: INITIATOR,
    target: CHIME_A,
    room: 'open_seat',
    expectAllowed: false,
    expectReason: 'primary_seat_open',
  },
  {
    name: 'observer -> chime-in A (open opponent seat) — not_a_primary_party wins first',
    actor: OBSERVER,
    target: CHIME_A,
    room: 'open_seat',
    expectAllowed: false,
    expectReason: 'not_a_primary_party',
  },
];

describe('canApplyGovernanceReaction — actor matrix', () => {
  for (const testCase of CASES) {
    it(testCase.name, () => {
      const { contract, seatMap } =
        testCase.room === 'full' ? fullRoom() : openSeatRoom();
      const result = canApplyGovernanceReaction(testCase.actor, {
        roomContract: contract,
        targetChimeInUserId: testCase.target,
        seatMap,
      });
      expect(result.allowed).toBe(testCase.expectAllowed);
      expect(result.reason).toBe(testCase.expectReason);
    });
  }

  it('a chime-in moved to observer by governance is still a governable chime-in', () => {
    // After a both-parties off_track, the chime-in is in movedToObserver. A
    // primary may still target it (e.g. to apply `useful` or to retract).
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT, argumentType: 'rebuttal' }),
      move({
        id: 'ca',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
    ];
    const contract = contractFrom(args);
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      governanceReactions: [
        {
          byPrimarySeat: 'initiator',
          byUserId: INITIATOR,
          targetBranchOrMessageId: 'b',
          targetChimeInUserId: CHIME_A,
          kind: 'off_track',
          at: '2026-05-20T05:00:00.000Z',
          retracted: false,
        },
        {
          byPrimarySeat: 'primary_opponent',
          byUserId: OPPONENT,
          targetBranchOrMessageId: 'b',
          targetChimeInUserId: CHIME_A,
          kind: 'off_track',
          at: '2026-05-20T06:00:00.000Z',
          retracted: false,
        },
      ],
      nowMs: NOW,
    });
    expect(seatMap.movedToObserver.some((r) => r.userId === CHIME_A)).toBe(true);
    const result = canApplyGovernanceReaction(INITIATOR, {
      roomContract: contract,
      targetChimeInUserId: CHIME_A,
      seatMap,
    });
    expect(result.allowed).toBe(true);
  });
});
