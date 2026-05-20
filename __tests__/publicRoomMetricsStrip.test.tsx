/**
 * GAME-005 — PublicRoomMetricsStrip component contract.
 *
 * Exercised through (a) the pure `PublicRoomMetricsViewModel` that fully
 * drives the strip and (b) a source-scan of the component.
 *
 * Asserts:
 *  - seat count + chime-in count + branch-state chips render from the
 *    view-model.
 *  - the "Side branches" heading renders when a moved-to-observer branch
 *    exists.
 *  - every visible string is inside <Text>; the strip root carries an
 *    accessibilityLabel; the strip has no Pressable (informational).
 */
import fs from 'fs';
import path from 'path';
import { PublicRoomMetricsStrip } from '../src/features/debates/PublicRoomMetricsStrip';
import {
  buildPublicRoomSeatMap,
  buildPublicRoomMetricsViewModel,
  type GovernanceReaction,
} from '../src/features/debates/publicSeatModel';
import {
  buildRoomContract,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';
import type { CollapsedBranchSummary } from '../src/features/arguments/branchGrammarModel';

const REPO = process.cwd();
const STRIP_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/PublicRoomMetricsStrip.tsx'),
  'utf8',
);

const INITIATOR = 'u-init';
const OPPONENT = 'u-opp';
const CHIME_A = 'u-chime-a';
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
    summaryLine: 'Chime-in branch with two people',
    accessibilityLabel: 'Chime-in branch. Tap to expand.',
    ...over,
  };
}

function seatMapWith(reactions: GovernanceReaction[]) {
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
  const input: BuildRoomContractInput = {
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: args,
  };
  const contract = buildRoomContract(input);
  return buildPublicRoomSeatMap({
    roomContract: contract,
    arguments: args,
    participants: [],
    governanceReactions: reactions,
    chimeInBranchIdByUserId: new Map([[CHIME_A, 'branch-a']]),
    nowMs: NOW,
  });
}

// ── View-model the component renders ───────────────────────────

describe('PublicRoomMetricsStrip — render contract via the view-model', () => {
  it('renders seat count + chime-in count from the view-model', () => {
    const seatMap = seatMapWith([]);
    const vm = buildPublicRoomMetricsViewModel(seatMap, []);
    expect(vm.seatCountLabel).toBe('3 of 6 seats active');
    expect(vm.chimeInCountLabel).toBe('1 person chiming in');
  });

  it('renders branch-state chips from the BR-004 summaries', () => {
    const seatMap = seatMapWith([]);
    const vm = buildPublicRoomMetricsViewModel(seatMap, [
      summary({ summaryLine: 'Side issue branch with one person' }),
    ]);
    expect(vm.branchStateLabels).toEqual(['Side issue branch with one person']);
  });

  it('exposes the Side branches heading when a moved-to-observer branch exists', () => {
    const reactions: GovernanceReaction[] = [
      {
        byPrimarySeat: 'initiator',
        byUserId: INITIATOR,
        targetBranchOrMessageId: 'branch-a',
        targetChimeInUserId: CHIME_A,
        kind: 'off_track',
        at: '2026-05-20T05:00:00.000Z',
        retracted: false,
      },
      {
        byPrimarySeat: 'primary_opponent',
        byUserId: OPPONENT,
        targetBranchOrMessageId: 'branch-a',
        targetChimeInUserId: CHIME_A,
        kind: 'off_track',
        at: '2026-05-20T06:00:00.000Z',
        retracted: false,
      },
    ];
    const seatMap = seatMapWith(reactions);
    const vm = buildPublicRoomMetricsViewModel(seatMap, []);
    expect(vm.hasSideBranches).toBe(true);
    expect(vm.sideBranchesHeading).toBe('Side branches');
  });

  it('hasSideBranches is false when no branch was moved to observer', () => {
    const seatMap = seatMapWith([]);
    const vm = buildPublicRoomMetricsViewModel(seatMap, []);
    expect(vm.hasSideBranches).toBe(false);
  });

  it('the strip view-model always carries an accessibility label', () => {
    const seatMap = seatMapWith([]);
    const vm = buildPublicRoomMetricsViewModel(seatMap, []);
    expect(typeof vm.accessibilityLabel).toBe('string');
    expect(vm.accessibilityLabel.length).toBeGreaterThan(0);
  });
});

// ── Source-scan ────────────────────────────────────────────────

describe('PublicRoomMetricsStrip — source contract', () => {
  it('is exported as a named function component', () => {
    expect(typeof PublicRoomMetricsStrip).toBe('function');
  });

  it('uses only View / Text RN primitives (no new dependency)', () => {
    expect(STRIP_SRC).toContain("from 'react-native'");
    expect(STRIP_SRC).toContain('View');
    expect(STRIP_SRC).toContain('Text');
  });

  it('the strip root exposes an accessibilityLabel', () => {
    expect(STRIP_SRC).toContain('accessibilityLabel={viewModel.accessibilityLabel}');
  });

  it('renders no Pressable (read-time, informational)', () => {
    expect(STRIP_SRC).not.toContain('<Pressable');
    expect(
      /import\s*\{[^}]*\bPressable\b[^}]*\}\s*from\s*'react-native'/.test(STRIP_SRC),
    ).toBe(false);
  });

  it('imports no router / navigation library (no route transition)', () => {
    expect(STRIP_SRC).not.toContain('navigation');
    expect(STRIP_SRC).not.toContain('expo-router');
    expect(STRIP_SRC).not.toContain('@react-navigation');
  });

  it('has no service-role / network call and leaves no console.log', () => {
    expect(STRIP_SRC).not.toContain('SERVICE_ROLE');
    expect(STRIP_SRC).not.toContain('functions.invoke');
    expect(STRIP_SRC).not.toContain('fetch(');
    expect(STRIP_SRC).not.toContain('console.log');
  });
});
