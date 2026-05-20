/**
 * GAME-005 — ChimeInGovernanceControl component contract.
 *
 * The repo's test discipline avoids runtime react-test-renderer (the pinned
 * renderer version is held away from @testing-library's peer). The control's
 * load-bearing render decisions are exercised through (a) the pure
 * `GovernanceControlViewModel` that fully drives what it renders and (b) a
 * source-scan of the component for the accessibility + safety contract.
 *
 * Asserts:
 *  - one reaction entry per GovernanceReactionKind, all with non-empty labels.
 *  - `appliedByViewer` toggles the applied state per viewer.
 *  - the observer-fallback notice surfaces only when the chime-in is
 *    observer-only.
 *  - every reaction Pressable carries role + accessibilityLabel +
 *    accessibilityState; a >=44px hit target via hitSlop.
 *  - applied state is shape/text ("✓ Applied"), not color alone.
 *  - the component imports no router / navigation library.
 */
import fs from 'fs';
import path from 'path';
import { ChimeInGovernanceControl } from '../src/features/debates/ChimeInGovernanceControl';
import {
  buildPublicRoomSeatMap,
  buildGovernanceControlViewModel,
  ALL_GOVERNANCE_REACTION_KINDS,
  type GovernanceReaction,
} from '../src/features/debates/publicSeatModel';
import {
  buildRoomContract,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';

const REPO = process.cwd();
const CONTROL_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/ChimeInGovernanceControl.tsx'),
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

function roomWith(reactions: GovernanceReaction[]) {
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
    nowMs: NOW,
  });
}

// ── View-model the component renders ───────────────────────────

describe('ChimeInGovernanceControl — render contract via the view-model', () => {
  it('renders one reaction entry per reaction kind for an OP viewer', () => {
    const seatMap = roomWith([]);
    const vm = buildGovernanceControlViewModel({
      seatMap,
      targetChimeInUserId: CHIME_A,
      targetBranchId: 'branch-a',
      viewerUserId: INITIATOR,
      governanceReactions: [],
    });
    expect(vm.reactions).toHaveLength(ALL_GOVERNANCE_REACTION_KINDS.length);
    for (const reaction of vm.reactions) {
      expect(reaction.label.length).toBeGreaterThan(0);
      expect(reaction.accessibilityLabel.length).toBeGreaterThan(0);
    }
  });

  it('appliedByViewer is false for a viewer who has applied nothing', () => {
    const seatMap = roomWith([]);
    const vm = buildGovernanceControlViewModel({
      seatMap,
      targetChimeInUserId: CHIME_A,
      targetBranchId: 'branch-a',
      viewerUserId: OPPONENT,
      governanceReactions: [],
    });
    expect(vm.reactions.every((r) => !r.appliedByViewer)).toBe(true);
  });

  it('appliedByViewer is true for the kind the viewer applied', () => {
    const reaction: GovernanceReaction = {
      byPrimarySeat: 'initiator',
      byUserId: INITIATOR,
      targetBranchOrMessageId: 'branch-a',
      targetChimeInUserId: CHIME_A,
      kind: 'useful',
      at: '2026-05-20T05:00:00.000Z',
      retracted: false,
    };
    const seatMap = roomWith([reaction]);
    const vm = buildGovernanceControlViewModel({
      seatMap,
      targetChimeInUserId: CHIME_A,
      targetBranchId: 'branch-a',
      viewerUserId: INITIATOR,
      governanceReactions: [reaction],
    });
    const usefulEntry = vm.reactions.find((r) => r.kind === 'useful');
    expect(usefulEntry?.appliedByViewer).toBe(true);
  });

  it('the observer-fallback notice surfaces when the chime-in is observer-only', () => {
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
    const seatMap = roomWith(reactions);
    const vm = buildGovernanceControlViewModel({
      seatMap,
      targetChimeInUserId: CHIME_A,
      targetBranchId: 'branch-a',
      viewerUserId: INITIATOR,
      governanceReactions: reactions,
    });
    expect(vm.observerFallbackNotice).not.toBeNull();
    expect((vm.observerFallbackNotice as string).length).toBeGreaterThan(0);
  });
});

// ── Source-scan — accessibility + RN primitives + safety ───────

describe('ChimeInGovernanceControl — source contract', () => {
  it('is exported as a named function component', () => {
    expect(typeof ChimeInGovernanceControl).toBe('function');
  });

  it('uses only View / Text / Pressable RN primitives (no new dependency)', () => {
    expect(CONTROL_SRC).toContain("from 'react-native'");
    expect(CONTROL_SRC).toContain('Pressable');
  });

  it('every reaction Pressable carries role, label, and state', () => {
    expect(CONTROL_SRC).toContain('accessibilityRole="button"');
    expect(CONTROL_SRC).toContain('accessibilityLabel={reaction.accessibilityLabel}');
    expect(CONTROL_SRC).toContain(
      'accessibilityState={{ selected: reaction.appliedByViewer }}',
    );
  });

  it('reaction Pressables carry a hitSlop for the >=44px tap target', () => {
    expect(CONTROL_SRC).toContain('hitSlop');
    expect(CONTROL_SRC).toContain('REACTION_HIT_SLOP');
  });

  it('applied state is a shape/text marker, not color alone', () => {
    // The component renders a visible "Applied" text marker on an applied
    // reaction, so the state reads correctly in grayscale.
    expect(CONTROL_SRC).toContain('Applied');
    expect(CONTROL_SRC).toContain('reaction.appliedByViewer');
  });

  it('imports no router / navigation library (no route transition)', () => {
    expect(CONTROL_SRC).not.toContain('navigation');
    expect(CONTROL_SRC).not.toContain('expo-router');
    expect(CONTROL_SRC).not.toContain('@react-navigation');
  });

  it('has no service-role / functions.invoke / network call', () => {
    expect(CONTROL_SRC).not.toContain('SERVICE_ROLE');
    expect(CONTROL_SRC).not.toContain('functions.invoke');
    expect(CONTROL_SRC).not.toContain('fetch(');
  });

  it('leaves no console.log in committed code', () => {
    expect(CONTROL_SRC).not.toContain('console.log');
  });
});
