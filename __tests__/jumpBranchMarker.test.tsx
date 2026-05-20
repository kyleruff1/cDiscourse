/**
 * GAME-006 — JumpBranchMarker component contract.
 *
 * Exercised through (a) the pure `JumpMarkerViewModel` that drives what it
 * renders and (b) a source-scan for the accessibility + safety contract. The
 * marker is informational — non-interactive, no Pressable.
 *
 * Asserts:
 *  - a departed_from marker renders the "Moved to another branch" copy.
 *  - an arrived_at marker renders the "A chime-in joined this branch" copy.
 *  - every visible string is inside a <Text>; the marker root exposes an
 *    accessibilityLabel; the marker is non-interactive (no Pressable).
 *  - the departed/arrived distinction is shape/glyph, not color alone.
 */
import fs from 'fs';
import path from 'path';
import { JumpBranchMarker } from '../src/features/debates/JumpBranchMarker';
import {
  buildJumpMarkers,
  type JumpMarkerViewModel,
} from '../src/features/debates/jumpBranchModel';
import {
  buildRoomContract,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';
import { buildPublicRoomSeatMap } from '../src/features/debates/publicSeatModel';
import { JUMP_BRANCH_COPY } from '../src/features/arguments/gameCopy';

const REPO = process.cwd();
const MARKER_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/JumpBranchMarker.tsx'),
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

/** Build the two markers for a single jump. */
function jumpMarkers(): ReadonlyArray<JumpMarkerViewModel> {
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
  const contract = buildRoomContract({
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: args,
  });
  const seatMap = buildPublicRoomSeatMap({
    roomContract: contract,
    arguments: args,
    participants: [],
    nowMs: NOW,
  });
  return buildJumpMarkers({
    roomContract: contract,
    arguments: args,
    branchIdByArgumentId: new Map([
      ['ca1', 'branch-a'],
      ['ca2', 'branch-b'],
    ]),
    seatMap,
    nowMs: NOW,
  });
}

// ── The view-model the component renders ───────────────────────

describe('JumpBranchMarker — render contract via the view-model', () => {
  it('a departed_from marker carries the "Moved to another branch" copy', () => {
    const departed = jumpMarkers().find((m) => m.kind === 'departed_from');
    expect(departed).toBeDefined();
    expect(departed?.markerLabel).toBe(JUMP_BRANCH_COPY.marker_departed_title);
    expect((departed?.whenLabel as string).length).toBeGreaterThan(0);
    expect((departed?.accessibilityLabel as string).length).toBeGreaterThan(0);
  });

  it('an arrived_at marker carries the "A chime-in joined this branch" copy', () => {
    const arrived = jumpMarkers().find((m) => m.kind === 'arrived_at');
    expect(arrived).toBeDefined();
    expect(arrived?.markerLabel).toBe(JUMP_BRANCH_COPY.marker_arrived_title);
    expect((arrived?.whenLabel as string).length).toBeGreaterThan(0);
    expect((arrived?.accessibilityLabel as string).length).toBeGreaterThan(0);
  });
});

// ── Source-scan — accessibility + RN primitives + safety ───────

describe('JumpBranchMarker — source contract', () => {
  it('is exported as a named function component', () => {
    expect(typeof JumpBranchMarker).toBe('function');
  });

  it('uses View / Text RN primitives and is non-interactive (no Pressable)', () => {
    expect(MARKER_SRC).toContain("from 'react-native'");
    expect(MARKER_SRC).not.toContain('Pressable');
  });

  it('the marker root exposes an accessibilityLabel', () => {
    expect(MARKER_SRC).toContain('accessibilityLabel={viewModel.accessibilityLabel}');
  });

  it('every visible string is inside a <Text> element', () => {
    expect(MARKER_SRC).toContain('{viewModel.markerLabel}');
    expect(MARKER_SRC).toContain('{viewModel.whenLabel}');
  });

  it('the departed/arrived distinction is shape/glyph, not color alone', () => {
    // A departed marker uses a dashed border + a distinct glyph.
    expect(MARKER_SRC).toContain('markerDeparted');
    expect(MARKER_SRC).toContain('markerArrived');
    expect(MARKER_SRC).toContain("borderStyle: 'dashed'");
    expect(MARKER_SRC).toContain('markerGlyph');
  });

  it('imports no router / navigation library (no route transition)', () => {
    expect(MARKER_SRC).not.toContain('navigation');
    expect(MARKER_SRC).not.toContain('expo-router');
    expect(MARKER_SRC).not.toContain('@react-navigation');
  });

  it('has no service-role / functions.invoke / network call', () => {
    expect(MARKER_SRC).not.toContain('SERVICE_ROLE');
    expect(MARKER_SRC).not.toContain('functions.invoke');
    expect(MARKER_SRC).not.toContain('fetch(');
  });

  it('leaves no console.log in committed code', () => {
    expect(MARKER_SRC).not.toContain('console.log');
  });
});
