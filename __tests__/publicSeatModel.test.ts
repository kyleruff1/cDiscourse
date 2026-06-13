/**
 * GAME-005 — pure-model tests for publicSeatModel.ts.
 *
 * Covers every public function: buildPublicRoomSeatMap (seat cap, claim
 * order, overflow, governance fallback), evaluateChimeInStanding (the full
 * both-parties + window table), canApplyGovernanceReaction (actor matrix),
 * buildPublicRoomMetricsViewModel, buildGovernanceControlViewModel,
 * determinism + no-mutation, and the §9 edge cases.
 */
import {
  buildPublicRoomSeatMap,
  evaluateChimeInStanding,
  canApplyGovernanceReaction,
  buildPublicRoomMetricsViewModel,
  buildGovernanceControlViewModel,
  governanceReactionLabel,
  ALL_GOVERNANCE_REACTION_KINDS,
  PUBLIC_ROOM_SEAT_CAP,
  PRIMARY_SEAT_COUNT,
  CHIME_IN_GOVERNANCE_WINDOW_MS,
  type GovernanceReaction,
} from '../src/features/debates/publicSeatModel';
import {
  buildRoomContract,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';
import type { CollapsedBranchSummary } from '../src/features/arguments/branchGrammarModel';

const INITIATOR = 'u-init';
const OPPONENT = 'u-opp';
const NOW = Date.parse('2026-05-20T12:00:00.000Z');

function arg(over: Partial<RoomArgumentInput>): RoomArgumentInput {
  return {
    id: 'x',
    parentId: 'root',
    authorId: 'u-someone',
    argumentType: 'rebuttal',
    body: 'A real argumentative move long enough to clear the qualifying gate.',
    status: 'posted',
    createdAt: '2026-05-20T01:00:00.000Z',
    ...over,
  };
}

const ROOT: RoomArgumentInput = {
  id: 'root',
  parentId: null,
  authorId: INITIATOR,
  argumentType: 'thesis',
  body: 'Opening claim long enough to count as a real opening move here.',
  status: 'posted',
  createdAt: '2026-05-20T00:30:00.000Z',
};

const OPP_REPLY: RoomArgumentInput = arg({
  id: 'opp-1',
  authorId: OPPONENT,
  argumentType: 'rebuttal',
  body: 'I disagree with the root claim because the cited mechanism fails here.',
  createdAt: '2026-05-20T01:00:00.000Z',
});

function contractFrom(argumentsList: RoomArgumentInput[]) {
  const input: BuildRoomContractInput = {
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: argumentsList,
  };
  return buildRoomContract(input);
}

function offTrack(
  byUserId: string,
  byPrimarySeat: 'initiator' | 'primary_opponent',
  targetChimeInUserId: string,
  at: string,
  retracted = false,
): GovernanceReaction {
  return {
    byPrimarySeat,
    byUserId,
    targetBranchOrMessageId: `branch-${targetChimeInUserId}`,
    targetChimeInUserId,
    kind: 'off_track',
    at,
    retracted,
  };
}

// ── buildPublicRoomSeatMap — seats 1/2 ──────────────────────────

describe('buildPublicRoomSeatMap — primary seats', () => {
  it('empty room: seat 1 = OP only, no chime-ins, cap not reached', () => {
    const contract = contractFrom([]);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: [],
      participants: [],
      nowMs: NOW,
    });
    expect(map.activeSeats).toHaveLength(1);
    expect(map.activeSeats[0].seatIndex).toBe(1);
    expect(map.activeSeats[0].role).toBe('initiator');
    expect(map.activeSeats[0].userId).toBe(INITIATOR);
    expect(map.movedToObserver).toHaveLength(0);
    expect(map.isCapReached).toBe(false);
  });

  it('root-only room: seat 1 filled, seat 2 open', () => {
    const contract = contractFrom([ROOT]);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: [ROOT],
      participants: [],
      nowMs: NOW,
    });
    expect(map.activeSeats).toHaveLength(1);
    expect(map.activeSeats.some((s) => s.role === 'primary_opponent')).toBe(false);
  });

  it('seat 2 = Primary Opponent once a qualifying reply lands', () => {
    const contract = contractFrom([ROOT, OPP_REPLY]);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: [ROOT, OPP_REPLY],
      participants: [],
      nowMs: NOW,
    });
    const seat2 = map.activeSeats.find((s) => s.seatIndex === 2);
    expect(seat2?.role).toBe('primary_opponent');
    expect(seat2?.userId).toBe(OPPONENT);
  });
});

// ── buildPublicRoomSeatMap — chime-in seats 3..5 ────────────────

describe('buildPublicRoomSeatMap — chime-in claim order', () => {
  function chimeIn(userId: string, createdAt: string): RoomArgumentInput {
    return arg({
      id: `c-${userId}`,
      authorId: userId,
      argumentType: 'claim',
      body: `Chime-in from ${userId}: a real argumentative move clearing the gate.`,
      createdAt,
    });
  }

  it('chime-ins fill seats 3..5 in first-qualifying-move chronological order', () => {
    const c1 = chimeIn('u-c1', '2026-05-20T02:00:00.000Z');
    const c2 = chimeIn('u-c2', '2026-05-20T03:00:00.000Z');
    const args = [ROOT, OPP_REPLY, c2, c1]; // pass out of order
    const contract = contractFrom(args);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    const seat3 = map.activeSeats.find((s) => s.seatIndex === 3);
    const seat4 = map.activeSeats.find((s) => s.seatIndex === 4);
    expect(seat3?.userId).toBe('u-c1');
    expect(seat4?.userId).toBe('u-c2');
    expect(seat3?.role).toBe('chime_in');
  });

  it('exactly 5 distinct qualifying participants: cap reached, 0 open seats', () => {
    const chimeIns = ['u-c1', 'u-c2', 'u-c3'].map((u, i) =>
      chimeIn(u, `2026-05-20T0${2 + i}:00:00.000Z`),
    );
    const args = [ROOT, OPP_REPLY, ...chimeIns];
    const contract = contractFrom(args);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    expect(map.activeSeats).toHaveLength(PUBLIC_ROOM_SEAT_CAP);
    expect(map.isCapReached).toBe(true);
    expect(map.openChimeInSeatCount).toBe(0);
  });

  it('7-chime-in swarm: seats 3-5 hold the first 3, the rest overflow', () => {
    const chimeIns = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((u, i) =>
      chimeIn(`u-${u}`, `2026-05-20T0${2 + i}:00:00.000Z`),
    );
    const args = [ROOT, OPP_REPLY, ...chimeIns];
    const contract = contractFrom(args);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    expect(map.activeSeats).toHaveLength(PUBLIC_ROOM_SEAT_CAP);
    const seatedChimeIns = map.activeSeats
      .filter((s) => s.role === 'chime_in')
      .map((s) => s.userId);
    expect(seatedChimeIns).toEqual(['u-c1', 'u-c2', 'u-c3']);
    const overflow = map.movedToObserver.filter((r) => r.reason === 'overflow');
    expect(overflow.map((r) => r.userId)).toEqual(['u-c4', 'u-c5', 'u-c6', 'u-c7']);
  });

  it('a non-qualifying first move (too short) never claims a seat', () => {
    const shortMove = arg({
      id: 'c-short',
      authorId: 'u-short',
      argumentType: 'claim',
      body: 'lol',
      createdAt: '2026-05-20T02:00:00.000Z',
    });
    const args = [ROOT, OPP_REPLY, shortMove];
    const contract = contractFrom(args);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    expect(map.activeSeats.some((s) => s.userId === 'u-short')).toBe(false);
    expect(map.movedToObserver.some((r) => r.userId === 'u-short')).toBe(false);
  });

  it('a bot author never claims a chime-in seat', () => {
    const botMove = arg({
      id: 'c-bot',
      authorId: 'u-bot',
      argumentType: 'claim',
      body: 'A bot fixture move long enough to clear the qualifying gate here.',
      createdAt: '2026-05-20T02:00:00.000Z',
      isBot: true,
    });
    const args = [ROOT, OPP_REPLY, botMove];
    const contract = contractFrom(args);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    expect(map.activeSeats.some((s) => s.userId === 'u-bot')).toBe(false);
  });

  it('doctrine — seat order is structural: an earlier chime-in holds a lower seat index than a later one regardless of reply volume', () => {
    // u-early posts first with ONE move; u-late posts later with MANY moves.
    const early = chimeIn('u-early', '2026-05-20T02:00:00.000Z');
    const late1 = chimeIn('u-late', '2026-05-20T03:00:00.000Z');
    const late2 = arg({
      id: 'c-late-2',
      authorId: 'u-late',
      argumentType: 'rebuttal',
      body: 'A second high-activity move from the later chime-in clearing the gate.',
      createdAt: '2026-05-20T03:30:00.000Z',
    });
    const late3 = arg({
      id: 'c-late-3',
      authorId: 'u-late',
      argumentType: 'rebuttal',
      body: 'A third high-activity move from the later chime-in clearing the gate.',
      createdAt: '2026-05-20T03:45:00.000Z',
    });
    const args = [ROOT, OPP_REPLY, early, late1, late2, late3];
    const contract = contractFrom(args);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    const earlySeat = map.activeSeats.find((s) => s.userId === 'u-early');
    const lateSeat = map.activeSeats.find((s) => s.userId === 'u-late');
    expect(earlySeat).toBeDefined();
    expect(lateSeat).toBeDefined();
    expect((earlySeat as { seatIndex: number }).seatIndex).toBeLessThan(
      (lateSeat as { seatIndex: number }).seatIndex,
    );
  });

  it('joins a BR-004 branchId per chime-in when the caller supplies the map', () => {
    const c1 = chimeIn('u-c1', '2026-05-20T02:00:00.000Z');
    const args = [ROOT, OPP_REPLY, c1];
    const contract = contractFrom(args);
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      chimeInBranchIdByUserId: new Map([['u-c1', 'branch-99']]),
      nowMs: NOW,
    });
    const seat = map.activeSeats.find((s) => s.userId === 'u-c1');
    expect(seat?.branchId).toBe('branch-99');
  });
});

// ── buildPublicRoomSeatMap — governance fallback ────────────────

describe('buildPublicRoomSeatMap — governance observer-fallback', () => {
  function chimeIn(userId: string, createdAt: string): RoomArgumentInput {
    return arg({
      id: `c-${userId}`,
      authorId: userId,
      argumentType: 'claim',
      body: `Chime-in from ${userId}: a real argumentative move clearing the gate.`,
      createdAt,
    });
  }

  it('both primaries off_track within window: chime-in moves to observer (governance)', () => {
    const c1 = chimeIn('u-c1', '2026-05-20T02:00:00.000Z');
    const args = [ROOT, OPP_REPLY, c1];
    const contract = contractFrom(args);
    const reactions: GovernanceReaction[] = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z'),
    ];
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      governanceReactions: reactions,
      nowMs: NOW,
    });
    expect(map.activeSeats.some((s) => s.userId === 'u-c1')).toBe(false);
    const record = map.movedToObserver.find((r) => r.userId === 'u-c1');
    expect(record?.reason).toBe('governance');
  });

  it('single primary off_track: chime-in keeps the seat', () => {
    const c1 = chimeIn('u-c1', '2026-05-20T02:00:00.000Z');
    const args = [ROOT, OPP_REPLY, c1];
    const contract = contractFrom(args);
    const reactions: GovernanceReaction[] = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
    ];
    const map = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      governanceReactions: reactions,
      nowMs: NOW,
    });
    expect(map.activeSeats.some((s) => s.userId === 'u-c1')).toBe(true);
  });
});

// ── evaluateChimeInStanding — the full table ────────────────────

describe('evaluateChimeInStanding', () => {
  const primaries = [INITIATOR, OPPONENT];

  it('single off_track from one primary -> active', () => {
    const reactions = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
    ];
    expect(
      evaluateChimeInStanding(reactions, { nowMs: NOW, primaryUserIds: primaries }),
    ).toBe('active');
  });

  it('two off_track from two distinct primaries within window -> observer_only', () => {
    const reactions = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z'),
    ];
    expect(
      evaluateChimeInStanding(reactions, { nowMs: NOW, primaryUserIds: primaries }),
    ).toBe('observer_only');
  });

  it('two off_track outside the window -> active', () => {
    const reactions = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-18T00:00:00.000Z'),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z'),
    ];
    expect(
      evaluateChimeInStanding(reactions, { nowMs: NOW, primaryUserIds: primaries }),
    ).toBe('active');
  });

  it('two off_track from the SAME primary -> active (needs two distinct parties)', () => {
    const reactions = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:30:00.000Z'),
    ];
    expect(
      evaluateChimeInStanding(reactions, { nowMs: NOW, primaryUserIds: primaries }),
    ).toBe('active');
  });

  it('a retracted off_track never counts', () => {
    const reactions = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z', true),
    ];
    expect(
      evaluateChimeInStanding(reactions, { nowMs: NOW, primaryUserIds: primaries }),
    ).toBe('active');
  });

  it('useful / needs_source / move_to_tangent never demote', () => {
    const advisory: GovernanceReaction[] = (
      ['useful', 'needs_source', 'move_to_tangent'] as const
    ).flatMap((kind) => [
      {
        byPrimarySeat: 'initiator' as const,
        byUserId: INITIATOR,
        targetBranchOrMessageId: 'b',
        targetChimeInUserId: 'u-c1',
        kind,
        at: '2026-05-20T05:00:00.000Z',
        retracted: false,
      },
      {
        byPrimarySeat: 'primary_opponent' as const,
        byUserId: OPPONENT,
        targetBranchOrMessageId: 'b',
        targetChimeInUserId: 'u-c1',
        kind,
        at: '2026-05-20T06:00:00.000Z',
        retracted: false,
      },
    ]);
    expect(
      evaluateChimeInStanding(advisory, { nowMs: NOW, primaryUserIds: primaries }),
    ).toBe('active');
  });

  it('primaryUserIds with a single entry can never return observer_only', () => {
    const reactions = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z'),
    ];
    expect(
      evaluateChimeInStanding(reactions, {
        nowMs: NOW,
        primaryUserIds: [INITIATOR],
      }),
    ).toBe('active');
  });

  it('a reaction from a non-primary user never counts toward the threshold', () => {
    const reactions = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack('u-observer', 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z'),
    ];
    expect(
      evaluateChimeInStanding(reactions, { nowMs: NOW, primaryUserIds: primaries }),
    ).toBe('active');
  });

  it('a custom windowMs is honored', () => {
    const reactions = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T05:30:00.000Z'),
    ];
    // 10-minute window — the reactions are 30 min apart -> active.
    expect(
      evaluateChimeInStanding(reactions, {
        nowMs: NOW,
        primaryUserIds: primaries,
        windowMs: 10 * 60 * 1000,
      }),
    ).toBe('active');
  });

  it('CHIME_IN_GOVERNANCE_WINDOW_MS is the documented 24h', () => {
    expect(CHIME_IN_GOVERNANCE_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

// ── Anti-abuse — retraction reverses a demotion ─────────────────

describe('GAME-005 anti-abuse — reversibility', () => {
  const primaries = [INITIATOR, OPPONENT];

  it('retracting an off_track restores the chime-in to active on recompute', () => {
    const demoted = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z'),
    ];
    expect(
      evaluateChimeInStanding(demoted, { nowMs: NOW, primaryUserIds: primaries }),
    ).toBe('observer_only');

    // The Initiator retracts.
    const afterRetract = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z', true),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z'),
    ];
    expect(
      evaluateChimeInStanding(afterRetract, {
        nowMs: NOW,
        primaryUserIds: primaries,
      }),
    ).toBe('active');
  });
});

// ── canApplyGovernanceReaction — actor matrix ───────────────────

describe('canApplyGovernanceReaction', () => {
  function chimeIn(userId: string): RoomArgumentInput {
    return arg({
      id: `c-${userId}`,
      authorId: userId,
      argumentType: 'claim',
      body: `Chime-in from ${userId}: a real argumentative move clearing the gate.`,
      createdAt: '2026-05-20T02:00:00.000Z',
    });
  }

  function fullRoom() {
    const c1 = chimeIn('u-c1');
    const c2 = chimeIn('u-c2');
    const args = [ROOT, OPP_REPLY, c1, c2];
    const contract = contractFrom(args);
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    return { contract, seatMap };
  }

  it('the Initiator may govern a chime-in', () => {
    const { contract, seatMap } = fullRoom();
    const result = canApplyGovernanceReaction(INITIATOR, {
      roomContract: contract,
      targetChimeInUserId: 'u-c1',
      seatMap,
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('the Primary Opponent may govern a chime-in', () => {
    const { contract, seatMap } = fullRoom();
    const result = canApplyGovernanceReaction(OPPONENT, {
      roomContract: contract,
      targetChimeInUserId: 'u-c1',
      seatMap,
    });
    expect(result.allowed).toBe(true);
  });

  it('a chime-in cannot govern another chime-in (not_a_primary_party)', () => {
    const { contract, seatMap } = fullRoom();
    const result = canApplyGovernanceReaction('u-c1', {
      roomContract: contract,
      targetChimeInUserId: 'u-c2',
      seatMap,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_a_primary_party');
  });

  it('an observer cannot govern (not_a_primary_party)', () => {
    const { contract, seatMap } = fullRoom();
    const result = canApplyGovernanceReaction('u-observer', {
      roomContract: contract,
      targetChimeInUserId: 'u-c1',
      seatMap,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_a_primary_party');
  });

  it('a primary cannot govern their own content (self_target)', () => {
    const { contract, seatMap } = fullRoom();
    const result = canApplyGovernanceReaction(INITIATOR, {
      roomContract: contract,
      targetChimeInUserId: INITIATOR,
      seatMap,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('self_target');
  });

  it('a primary cannot govern the other primary (target_not_chime_in)', () => {
    const { contract, seatMap } = fullRoom();
    const result = canApplyGovernanceReaction(INITIATOR, {
      roomContract: contract,
      targetChimeInUserId: OPPONENT,
      seatMap,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('target_not_chime_in');
  });

  it('governance pauses when the Primary Opponent seat is open (primary_seat_open)', () => {
    const args = [ROOT]; // no qualifying reply -> opponent seat open
    const contract = contractFrom(args);
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    const result = canApplyGovernanceReaction(INITIATOR, {
      roomContract: contract,
      targetChimeInUserId: 'u-c1',
      seatMap,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('primary_seat_open');
  });

  it('a target who holds no chime-in seat is target_not_chime_in', () => {
    const { contract, seatMap } = fullRoom();
    const result = canApplyGovernanceReaction(INITIATOR, {
      roomContract: contract,
      targetChimeInUserId: 'u-nobody',
      seatMap,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('target_not_chime_in');
  });
});

// ── buildPublicRoomMetricsViewModel ─────────────────────────────

describe('buildPublicRoomMetricsViewModel', () => {
  function summary(over: Partial<CollapsedBranchSummary>): CollapsedBranchSummary {
    return {
      branchId: 'b1',
      branchRootMessageId: 'm1',
      direction: 'chime_in_vertical',
      messageCount: 3,
      participantCount: 2,
      lastActivityAt: '2026-05-20T05:00:00.000Z',
      recencyLabel: 'active 1h ago',
      unresolvedCount: 0,
      primaryPartyEngaged: false,
      summaryLine: 'Chime-in · 3 replies · 2 people · active 1h ago',
      accessibilityLabel: 'Chime-in branch. 3 replies, 2 people. Tap to expand.',
      ...over,
    };
  }

  function chimeIn(userId: string, createdAt: string): RoomArgumentInput {
    return arg({
      id: `c-${userId}`,
      authorId: userId,
      argumentType: 'claim',
      body: `Chime-in from ${userId}: a real argumentative move clearing the gate.`,
      createdAt,
    });
  }

  it('seat count + chime-in count reflect the seat map', () => {
    const c1 = chimeIn('u-c1', '2026-05-20T02:00:00.000Z');
    const c2 = chimeIn('u-c2', '2026-05-20T03:00:00.000Z');
    const args = [ROOT, OPP_REPLY, c1, c2];
    const contract = contractFrom(args);
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    const vm = buildPublicRoomMetricsViewModel(seatMap, []);
    expect(vm.seatCountLabel).toBe('4 of 5 seats active');
    expect(vm.chimeInCountLabel).toBe('2 people chiming in');
  });

  it('pluralizes the chime-in count: 0 / 1 / N', () => {
    const empty = buildPublicRoomSeatMap({
      roomContract: contractFrom([]),
      arguments: [],
      participants: [],
      nowMs: NOW,
    });
    expect(buildPublicRoomMetricsViewModel(empty, []).chimeInCountLabel).toBe(
      'No chime-ins yet',
    );

    const c1 = chimeIn('u-c1', '2026-05-20T02:00:00.000Z');
    const oneArgs = [ROOT, OPP_REPLY, c1];
    const oneMap = buildPublicRoomSeatMap({
      roomContract: contractFrom(oneArgs),
      arguments: oneArgs,
      participants: [],
      nowMs: NOW,
    });
    expect(buildPublicRoomMetricsViewModel(oneMap, []).chimeInCountLabel).toBe(
      '1 person chiming in',
    );
  });

  it('branch-state labels are sourced from BR-004 CollapsedBranchSummary', () => {
    const empty = buildPublicRoomSeatMap({
      roomContract: contractFrom([]),
      arguments: [],
      participants: [],
      nowMs: NOW,
    });
    const vm = buildPublicRoomMetricsViewModel(empty, [
      summary({ summaryLine: 'Side issue · 2 replies · 1 person' }),
    ]);
    expect(vm.branchStateLabels).toEqual([
      'Side issue · 2 replies · 1 person',
    ]);
  });

  it('exposes a non-empty accessibility label', () => {
    const empty = buildPublicRoomSeatMap({
      roomContract: contractFrom([]),
      arguments: [],
      participants: [],
      nowMs: NOW,
    });
    const vm = buildPublicRoomMetricsViewModel(empty, []);
    expect(vm.accessibilityLabel.length).toBeGreaterThan(0);
  });
});

// ── buildGovernanceControlViewModel ─────────────────────────────

describe('buildGovernanceControlViewModel', () => {
  function chimeIn(userId: string): RoomArgumentInput {
    return arg({
      id: `c-${userId}`,
      authorId: userId,
      argumentType: 'claim',
      body: `Chime-in from ${userId}: a real argumentative move clearing the gate.`,
      createdAt: '2026-05-20T02:00:00.000Z',
    });
  }

  it('produces one entry per reaction kind', () => {
    const args = [ROOT, OPP_REPLY, chimeIn('u-c1')];
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contractFrom(args),
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    const vm = buildGovernanceControlViewModel({
      seatMap,
      targetChimeInUserId: 'u-c1',
      targetBranchId: 'branch-c1',
      viewerUserId: INITIATOR,
      governanceReactions: [],
    });
    expect(vm.reactions.map((r) => r.kind)).toEqual(
      ALL_GOVERNANCE_REACTION_KINDS.slice(),
    );
  });

  it('appliedByViewer reflects only the viewer own non-retracted reactions', () => {
    const args = [ROOT, OPP_REPLY, chimeIn('u-c1')];
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contractFrom(args),
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    const reactions: GovernanceReaction[] = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      // The OTHER primary applied useful — must NOT show as applied to INITIATOR.
      {
        byPrimarySeat: 'primary_opponent',
        byUserId: OPPONENT,
        targetBranchOrMessageId: 'branch-c1',
        targetChimeInUserId: 'u-c1',
        kind: 'useful',
        at: '2026-05-20T05:00:00.000Z',
        retracted: false,
      },
    ];
    const vm = buildGovernanceControlViewModel({
      seatMap,
      targetChimeInUserId: 'u-c1',
      targetBranchId: 'branch-c1',
      viewerUserId: INITIATOR,
      governanceReactions: reactions,
    });
    const offTrackEntry = vm.reactions.find((r) => r.kind === 'off_track');
    const usefulEntry = vm.reactions.find((r) => r.kind === 'useful');
    expect(offTrackEntry?.appliedByViewer).toBe(true);
    expect(usefulEntry?.appliedByViewer).toBe(false);
  });

  it('observerFallbackNotice is null while the chime-in is active', () => {
    const args = [ROOT, OPP_REPLY, chimeIn('u-c1')];
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contractFrom(args),
      arguments: args,
      participants: [],
      nowMs: NOW,
    });
    const vm = buildGovernanceControlViewModel({
      seatMap,
      targetChimeInUserId: 'u-c1',
      targetBranchId: 'branch-c1',
      viewerUserId: INITIATOR,
      governanceReactions: [],
    });
    expect(vm.observerFallbackNotice).toBeNull();
  });

  it('observerFallbackNotice is non-null when the chime-in is observer-only', () => {
    const args = [ROOT, OPP_REPLY, chimeIn('u-c1')];
    const reactions: GovernanceReaction[] = [
      offTrack(INITIATOR, 'initiator', 'u-c1', '2026-05-20T05:00:00.000Z'),
      offTrack(OPPONENT, 'primary_opponent', 'u-c1', '2026-05-20T06:00:00.000Z'),
    ];
    const seatMap = buildPublicRoomSeatMap({
      roomContract: contractFrom(args),
      arguments: args,
      participants: [],
      governanceReactions: reactions,
      nowMs: NOW,
    });
    const vm = buildGovernanceControlViewModel({
      seatMap,
      targetChimeInUserId: 'u-c1',
      targetBranchId: 'branch-c1',
      viewerUserId: INITIATOR,
      governanceReactions: reactions,
    });
    expect(vm.observerFallbackNotice).not.toBeNull();
  });
});

// ── governanceReactionLabel + constants ─────────────────────────

describe('governanceReactionLabel + constants', () => {
  it('every reaction kind maps to a non-empty plain-language label', () => {
    for (const kind of ALL_GOVERNANCE_REACTION_KINDS) {
      expect(governanceReactionLabel(kind).length).toBeGreaterThan(0);
    }
  });

  it('PUBLIC_ROOM_SEAT_CAP is 5 and PRIMARY_SEAT_COUNT is 2', () => {
    expect(PUBLIC_ROOM_SEAT_CAP).toBe(5);
    expect(PRIMARY_SEAT_COUNT).toBe(2);
  });
});

// ── Determinism + no-mutation ───────────────────────────────────

describe('GAME-005 determinism + no-mutation', () => {
  function chimeIn(userId: string, createdAt: string): RoomArgumentInput {
    return arg({
      id: `c-${userId}`,
      authorId: userId,
      argumentType: 'claim',
      body: `Chime-in from ${userId}: a real argumentative move clearing the gate.`,
      createdAt,
    });
  }

  it('buildPublicRoomSeatMap twice on the same input -> deeply-equal output', () => {
    const c1 = chimeIn('u-c1', '2026-05-20T02:00:00.000Z');
    const args = [ROOT, OPP_REPLY, c1];
    const contract = contractFrom(args);
    const input = {
      roomContract: contract,
      arguments: args,
      participants: [],
      nowMs: NOW,
    };
    expect(buildPublicRoomSeatMap(input)).toEqual(buildPublicRoomSeatMap(input));
  });

  it('the seat map and its arrays are frozen', () => {
    const map = buildPublicRoomSeatMap({
      roomContract: contractFrom([ROOT, OPP_REPLY]),
      arguments: [ROOT, OPP_REPLY],
      participants: [],
      nowMs: NOW,
    });
    expect(Object.isFrozen(map)).toBe(true);
    expect(Object.isFrozen(map.activeSeats)).toBe(true);
    expect(Object.isFrozen(map.movedToObserver)).toBe(true);
  });

  it('does not mutate a frozen input arguments array', () => {
    const args = Object.freeze([ROOT, OPP_REPLY]);
    expect(() =>
      buildPublicRoomSeatMap({
        roomContract: contractFrom([ROOT, OPP_REPLY]),
        arguments: args,
        participants: [],
        nowMs: NOW,
      }),
    ).not.toThrow();
  });

  it('a new chime-in arriving claims the next free seat (concurrent re-render)', () => {
    const c1 = chimeIn('u-c1', '2026-05-20T02:00:00.000Z');
    const before = buildPublicRoomSeatMap({
      roomContract: contractFrom([ROOT, OPP_REPLY, c1]),
      arguments: [ROOT, OPP_REPLY, c1],
      participants: [],
      nowMs: NOW,
    });
    expect(before.activeSeats.filter((s) => s.role === 'chime_in')).toHaveLength(1);

    const c2 = chimeIn('u-c2', '2026-05-20T03:00:00.000Z');
    const after = buildPublicRoomSeatMap({
      roomContract: contractFrom([ROOT, OPP_REPLY, c1, c2]),
      arguments: [ROOT, OPP_REPLY, c1, c2],
      participants: [],
      nowMs: NOW,
    });
    expect(after.activeSeats.filter((s) => s.role === 'chime_in')).toHaveLength(2);
    const seat4 = after.activeSeats.find((s) => s.seatIndex === 4);
    expect(seat4?.userId).toBe('u-c2');
  });
});
