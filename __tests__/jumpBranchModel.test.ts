/**
 * GAME-006 — Jump Branch pure model.
 *
 * Covers every public function of `jumpBranchModel.ts`: home-branch
 * derivation, the `JumpBranchRecord` derivation, the once-per-room counter,
 * the branch-engagement-state map, the control + marker view-models,
 * determinism, no-mutation, and the §7 edge cases.
 */
import * as jumpBranchModel from '../src/features/debates/jumpBranchModel';
import {
  deriveParticipantHomeBranch,
  listJumpsForParticipant,
  jumpsUsed,
  buildBranchEngagementMap,
  buildJumpControlViewModel,
  buildJumpMarkers,
  jumpDenyReasonLabel,
  MAX_JUMPS_PER_ROOM,
  ALL_JUMP_DENY_REASONS,
  type JumpEligibility,
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
import type { BranchGrammarNode } from '../src/features/arguments/branchGrammarModel';

const INITIATOR = 'u-init';
const OPPONENT = 'u-opp';
const CHIME_A = 'u-chime-a';
const CHIME_B = 'u-chime-b';
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

// ── deriveParticipantHomeBranch ─────────────────────────────────

describe('deriveParticipantHomeBranch', () => {
  it('returns the branchId of the participant first qualifying move', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT, argumentType: 'rebuttal' }),
      move({ id: 'ca', authorId: CHIME_A, argumentType: 'claim' }),
    ];
    const home = deriveParticipantHomeBranch(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([['ca', 'branch-a']]),
    });
    expect(home).toBe('branch-a');
  });

  it('returns null for a participant with no qualifying move', () => {
    const args = [ROOT];
    const home = deriveParticipantHomeBranch(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map(),
    });
    expect(home).toBeNull();
  });

  it('a one-word non-move never counts as a home branch (reuses isQualifyingResponse)', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca',
        authorId: CHIME_A,
        argumentType: 'claim',
        body: 'lol',
      }),
    ];
    const home = deriveParticipantHomeBranch(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([['ca', 'branch-a']]),
    });
    expect(home).toBeNull();
  });

  it('uses the earliest qualifying move when several exist on different branches', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const home = deriveParticipantHomeBranch(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
      ]),
    });
    expect(home).toBe('branch-a');
  });
});

// ── listJumpsForParticipant ─────────────────────────────────────

describe('listJumpsForParticipant', () => {
  it('returns no jump when every qualifying move is on one branch', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const jumps = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-a'],
      ]),
    });
    expect(jumps).toHaveLength(0);
  });

  it('detects one jump when a later qualifying move is on a different branch', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const jumps = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
      ]),
    });
    expect(jumps).toHaveLength(1);
    expect(jumps[0]).toEqual({
      participantUserId: CHIME_A,
      fromBranchId: 'branch-a',
      toBranchId: 'branch-b',
      at: '2026-05-20T03:00:00.000Z',
      viaArgumentId: 'ca2',
    });
  });

  it('detects two jumps when the branch changes twice, in chronological order', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
      move({
        id: 'ca3',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T04:00:00.000Z',
      }),
    ];
    const jumps = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
        ['ca3', 'branch-a'],
      ]),
    });
    expect(jumps).toHaveLength(2);
    expect(jumps[0].toBranchId).toBe('branch-b');
    expect(jumps[1].fromBranchId).toBe('branch-b');
    expect(jumps[1].toBranchId).toBe('branch-a');
    expect(jumps[0].at < jumps[1].at).toBe(true);
  });

  it('a participant jumping back to their home branch is detected as a second jump', () => {
    // §7 edge case 11 — the deriver reports honestly; canJump is the gate.
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
      move({
        id: 'ca3',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T04:00:00.000Z',
      }),
    ];
    const jumps = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
        ['ca3', 'branch-a'],
      ]),
    });
    expect(jumps).toHaveLength(2);
    expect(jumps[1].toBranchId).toBe('branch-a');
  });

  it('two moves on the same branch then one move elsewhere is exactly one jump', () => {
    // §7 edge case 9 + 10 — staying put never consumes a jump.
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
      move({
        id: 'ca3',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T04:00:00.000Z',
      }),
      move({
        id: 'ca4',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T05:00:00.000Z',
      }),
    ];
    const jumps = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-a'],
        ['ca3', 'branch-b'],
        ['ca4', 'branch-b'],
      ]),
    });
    expect(jumps).toHaveLength(1);
    expect(jumps[0].fromBranchId).toBe('branch-a');
    expect(jumps[0].toBranchId).toBe('branch-b');
  });

  it('skips moves whose branch placement is unknown', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const jumps = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      // ca2 has no branch entry — skipped.
      branchIdByArgumentId: new Map([['ca1', 'branch-a']]),
    });
    expect(jumps).toHaveLength(0);
  });
});

// ── jumpsUsed ───────────────────────────────────────────────────

describe('jumpsUsed', () => {
  it('returns 0 for a participant who never jumped', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({ id: 'ca1', authorId: CHIME_A, argumentType: 'claim' }),
    ];
    const used = jumpsUsed('r1', CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([['ca1', 'branch-a']]),
    });
    expect(used).toBe(0);
  });

  it('returns 1 after one jump', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const used = jumpsUsed('r1', CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
      ]),
    });
    expect(used).toBe(1);
  });

  it('returns 0 defensively when roomId does not match the contract', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const used = jumpsUsed('WRONG-ROOM', CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
      ]),
    });
    expect(used).toBe(0);
  });

  it('MAX_JUMPS_PER_ROOM is 1 (the once-per-room default)', () => {
    expect(MAX_JUMPS_PER_ROOM).toBe(1);
  });
});

// ── buildBranchEngagementMap ────────────────────────────────────

function grammarNode(over: Partial<BranchGrammarNode>): BranchGrammarNode {
  return Object.freeze({
    branchId: 'b',
    direction: 'chime_in_vertical',
    originNodeId: 'n',
    participantCount: 1,
    lastActivityAt: '2026-05-20T03:00:00.000Z',
    unresolvedAxisCount: 0,
    primaryPartyEngaged: false,
    offshootDepthCapReached: false,
    ...over,
  });
}

function seatMapWith(
  args: RoomArgumentInput[],
  governanceReactions: GovernanceReaction[] = [],
  chimeInBranchIdByUserId?: Map<string, string>,
): PublicRoomSeatMap {
  return buildPublicRoomSeatMap({
    roomContract: contractFor(args),
    arguments: args,
    participants: [],
    governanceReactions,
    chimeInBranchIdByUserId,
    nowMs: NOW,
  });
}

describe('buildBranchEngagementMap', () => {
  it('marks the mainline branch open and isMainline', () => {
    const grammarMap = new Map<string, BranchGrammarNode>([
      ['branch-main', grammarNode({ branchId: 'branch-main', direction: 'mainline' })],
    ]);
    const map = buildBranchEngagementMap({
      branchGrammarMap: grammarMap,
      seatMap: seatMapWith([ROOT]),
    });
    const main = map.get('branch-main');
    expect(main?.openToEngagement).toBe(true);
    expect(main?.isMainline).toBe(true);
  });

  it('marks an active chime-in vertical branch open', () => {
    const grammarMap = new Map<string, BranchGrammarNode>([
      ['branch-a', grammarNode({ branchId: 'branch-a', direction: 'chime_in_vertical' })],
    ]);
    const map = buildBranchEngagementMap({
      branchGrammarMap: grammarMap,
      seatMap: seatMapWith([ROOT]),
    });
    expect(map.get('branch-a')?.openToEngagement).toBe(true);
    expect(map.get('branch-a')?.isMainline).toBe(false);
  });

  it('marks an evidence_passthrough branch closed to engagement', () => {
    const grammarMap = new Map<string, BranchGrammarNode>([
      [
        'branch-ev',
        grammarNode({ branchId: 'branch-ev', direction: 'evidence_passthrough' }),
      ],
    ]);
    const map = buildBranchEngagementMap({
      branchGrammarMap: grammarMap,
      seatMap: seatMapWith([ROOT]),
    });
    expect(map.get('branch-ev')?.openToEngagement).toBe(false);
  });

  it('marks a moved-to-observer chime-in branch closed to engagement', () => {
    // Two off_track reactions from both primaries move CHIME_A to observer.
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
    ];
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
    const seatMap = seatMapWith(
      args,
      reactions,
      new Map([[CHIME_A, 'branch-a']]),
    );
    const grammarMap = new Map<string, BranchGrammarNode>([
      ['branch-a', grammarNode({ branchId: 'branch-a', direction: 'chime_in_vertical' })],
    ]);
    const map = buildBranchEngagementMap({ branchGrammarMap: grammarMap, seatMap });
    expect(map.get('branch-a')?.openToEngagement).toBe(false);
  });
});

// ── buildJumpControlViewModel ───────────────────────────────────

describe('buildJumpControlViewModel', () => {
  it('enabled mirrors eligibility.ok and carries no disabled reason', () => {
    const ok: JumpEligibility = { ok: true, reason: null };
    const vm = buildJumpControlViewModel({
      eligibility: ok,
      participantUserId: CHIME_A,
      destinationBranchId: 'branch-b',
    });
    expect(vm.enabled).toBe(true);
    expect(vm.disabledReasonLabel).toBeNull();
    expect(vm.confirmPrompt.length).toBeGreaterThan(0);
    expect(vm.confirmLabel.length).toBeGreaterThan(0);
    expect(vm.cancelLabel.length).toBeGreaterThan(0);
  });

  it('disabled control carries a non-null plain-language reason', () => {
    const denied: JumpEligibility = { ok: false, reason: 'jump_already_used' };
    const vm = buildJumpControlViewModel({
      eligibility: denied,
      participantUserId: CHIME_A,
      destinationBranchId: 'branch-b',
    });
    expect(vm.enabled).toBe(false);
    expect(vm.disabledReasonLabel).not.toBeNull();
    expect((vm.disabledReasonLabel as string).length).toBeGreaterThan(0);
  });

  it('every JumpDenyReason maps to a non-empty disabled label', () => {
    for (const reason of ALL_JUMP_DENY_REASONS) {
      expect(jumpDenyReasonLabel(reason).length).toBeGreaterThan(0);
    }
  });
});

// ── buildJumpMarkers ────────────────────────────────────────────

describe('buildJumpMarkers', () => {
  it('one jump yields exactly two markers — departed_from + arrived_at', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const branchIdByArgumentId = new Map([
      ['ca1', 'branch-a'],
      ['ca2', 'branch-b'],
    ]);
    const markers = buildJumpMarkers({
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId,
      seatMap: seatMapWith(args),
      nowMs: NOW,
    });
    expect(markers).toHaveLength(2);
    const departed = markers.find((m) => m.kind === 'departed_from');
    const arrived = markers.find((m) => m.kind === 'arrived_at');
    expect(departed?.branchId).toBe('branch-a');
    expect(arrived?.branchId).toBe('branch-b');
    expect(departed?.anchorArgumentId).toBe('ca2');
    expect(arrived?.anchorArgumentId).toBe('ca2');
  });

  it('marker whenLabel uses a relative time, never a raw timestamp', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const markers = buildJumpMarkers({
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
      ]),
      seatMap: seatMapWith(args),
      nowMs: NOW,
    });
    for (const m of markers) {
      expect(m.whenLabel).not.toContain('2026-');
      expect(m.whenLabel.length).toBeGreaterThan(0);
    }
  });

  it('an empty room yields no markers', () => {
    const markers = buildJumpMarkers({
      roomContract: contractFor([ROOT]),
      arguments: [ROOT],
      branchIdByArgumentId: new Map(),
      seatMap: seatMapWith([ROOT]),
      nowMs: NOW,
    });
    expect(markers).toHaveLength(0);
  });

  it('a room with only the OP yields no markers', () => {
    // §7 edge case 8.
    const args = [ROOT];
    const markers = buildJumpMarkers({
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([['root', 'branch-main']]),
      seatMap: seatMapWith(args),
      nowMs: NOW,
    });
    expect(markers).toHaveLength(0);
  });

  it('whenLabel falls back to the unknown-time copy when time is unparseable', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: 'not-a-date',
      }),
    ];
    const markers = buildJumpMarkers({
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
      ]),
      seatMap: seatMapWith(args),
    });
    expect(markers).toHaveLength(2);
    for (const m of markers) {
      expect(m.whenLabel).toBe('a little while ago');
    }
  });
});

// ── Determinism + no-mutation ───────────────────────────────────

describe('GAME-006 model — determinism and no-mutation', () => {
  it('listJumpsForParticipant is deterministic on identical input', () => {
    const args = Object.freeze([
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ]) as ReadonlyArray<RoomArgumentInput>;
    const branchIdByArgumentId = new Map([
      ['ca1', 'branch-a'],
      ['ca2', 'branch-b'],
    ]);
    const first = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args.slice()),
      arguments: args,
      branchIdByArgumentId,
    });
    const second = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args.slice()),
      arguments: args,
      branchIdByArgumentId,
    });
    expect(first).toEqual(second);
  });

  it('buildJumpMarkers does not mutate a frozen arguments array', () => {
    const args = Object.freeze([
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ]) as ReadonlyArray<RoomArgumentInput>;
    expect(() =>
      buildJumpMarkers({
        roomContract: contractFor(args.slice()),
        arguments: args,
        branchIdByArgumentId: new Map([
          ['ca1', 'branch-a'],
          ['ca2', 'branch-b'],
        ]),
        seatMap: seatMapWith(args.slice()),
        nowMs: NOW,
      }),
    ).not.toThrow();
  });

  it('the derived records are frozen', () => {
    const args = [
      ROOT,
      move({ id: 'opp', authorId: OPPONENT }),
      move({
        id: 'ca1',
        authorId: CHIME_A,
        argumentType: 'claim',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
      move({
        id: 'ca2',
        authorId: CHIME_A,
        argumentType: 'rebuttal',
        createdAt: '2026-05-20T03:00:00.000Z',
      }),
    ];
    const jumps = listJumpsForParticipant(CHIME_A, {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map([
        ['ca1', 'branch-a'],
        ['ca2', 'branch-b'],
      ]),
    });
    expect(Object.isFrozen(jumps)).toBe(true);
    expect(Object.isFrozen(jumps[0])).toBe(true);
  });
});

// ── API surface — the once-per-room cap is encoded by omission ──

describe('GAME-006 model — API surface', () => {
  it('exports no forceJump / resetJumps / setJumpCount escape hatch', () => {
    const mod = jumpBranchModel as Record<string, unknown>;
    expect(typeof mod.resetJumps).toBe('undefined');
    expect(typeof mod.forceJump).toBe('undefined');
    expect(typeof mod.setJumpCount).toBe('undefined');
  });

  it('CHIME_B with no qualifying move has no home branch and no jumps', () => {
    // §7 edge case 7b — a participant who never engaged a branch.
    const args = [ROOT, move({ id: 'opp', authorId: OPPONENT })];
    const ctx = {
      roomContract: contractFor(args),
      arguments: args,
      branchIdByArgumentId: new Map<string, string>(),
    };
    expect(deriveParticipantHomeBranch(CHIME_B, ctx)).toBeNull();
    expect(listJumpsForParticipant(CHIME_B, ctx)).toHaveLength(0);
  });
});
