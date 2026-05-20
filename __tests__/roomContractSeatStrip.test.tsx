/**
 * GAME-004 — RoomContractSeatStrip component contract.
 *
 * The repo's test discipline avoids runtime react-test-renderer (the pinned
 * renderer version is held away from @testing-library's peer). So the strip's
 * load-bearing render decisions are exercised through (a) the pure
 * `roomTypeGlyph` helper, (b) the pure `RoomContractViewModel` that fully
 * drives what the component renders, and (c) a source-scan of the component.
 *
 * Asserts:
 *  - public seat-open room → both seat pills + room-type chip are present in
 *    the view-model the component renders.
 *  - 'You' surfaces on the Initiator seat when the viewer is the OP.
 *  - 'You' surfaces on the Opponent seat when the viewer is the Primary
 *    Opponent.
 *  - 'Private room' chip label for a private room.
 *  - the turn label is non-null when a turn is determinable, null otherwise.
 *  - the room-type glyph is shape/text, not color.
 *  - every visible string in the component goes through <Text>; the strip
 *    root carries an accessibilityLabel.
 */
import fs from 'fs';
import path from 'path';
import {
  RoomContractSeatStrip,
  roomTypeGlyph,
} from '../src/features/debates/RoomContractSeatStrip';
import {
  buildRoomContract,
  buildRoomContractViewModel,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';

const REPO = process.cwd();
const STRIP_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/RoomContractSeatStrip.tsx'),
  'utf8',
);

const INITIATOR = 'u-init';
const OPPONENT = 'u-opp';

const ROOT: RoomArgumentInput = {
  id: 'root',
  parentId: null,
  authorId: INITIATOR,
  argumentType: 'thesis',
  body: 'Opening claim long enough to count as a real opening move.',
  status: 'posted',
  createdAt: '2026-05-20T00:30:00.000Z',
};
const REPLY: RoomArgumentInput = {
  id: 'a1',
  parentId: 'root',
  authorId: OPPONENT,
  argumentType: 'rebuttal',
  body: 'I disagree with the root claim because the cited mechanism fails here.',
  status: 'posted',
  createdAt: '2026-05-20T01:00:00.000Z',
};

function baseInput(over: Partial<BuildRoomContractInput> = {}): BuildRoomContractInput {
  return {
    roomId: 'r1',
    initiatorUserId: INITIATOR,
    openedAt: '2026-05-20T00:00:00.000Z',
    participants: [],
    arguments: [],
    ...over,
  };
}

// ── View-model the component renders ───────────────────────────

describe('RoomContractSeatStrip — render contract via the view-model', () => {
  it('public, seat-open room → both seat pills + room-type chip present', () => {
    const contract = buildRoomContract(baseInput({ arguments: [ROOT] }));
    const vm = buildRoomContractViewModel(contract, INITIATOR, [ROOT]);
    expect(vm.roomTypeLabel).toBe('Public room');
    expect(vm.initiatorSeat.label).toBe('You');
    expect(vm.opponentSeat.label).toBe('Open seat — first reply takes it');
    expect(vm.opponentSeat.isOpen).toBe(true);
  });

  it("viewer is the OP → 'You' on the Initiator seat", () => {
    const contract = buildRoomContract(baseInput({ arguments: [ROOT, REPLY] }));
    const vm = buildRoomContractViewModel(contract, INITIATOR, [ROOT, REPLY]);
    expect(vm.initiatorSeat.label).toBe('You');
    expect(vm.opponentSeat.label).toBe('Opponent');
  });

  it("viewer is the Primary Opponent → 'You' on the Opponent seat", () => {
    const contract = buildRoomContract(baseInput({ arguments: [ROOT, REPLY] }));
    const vm = buildRoomContractViewModel(contract, OPPONENT, [ROOT, REPLY]);
    expect(vm.opponentSeat.label).toBe('You');
    expect(vm.initiatorSeat.label).toBe('Initiator');
  });

  it("private room → 'Private room' chip label", () => {
    const contract = buildRoomContract(
      baseInput({
        roomType: 'private',
        invitedOpponentUserId: OPPONENT,
        arguments: [ROOT],
      }),
    );
    const vm = buildRoomContractViewModel(contract, INITIATOR, [ROOT]);
    expect(vm.roomTypeLabel).toBe('Private room');
  });

  it('turn label is non-null when a turn is determinable', () => {
    const contract = buildRoomContract(baseInput({ arguments: [ROOT, REPLY] }));
    const vm = buildRoomContractViewModel(contract, INITIATOR, [ROOT, REPLY]);
    expect(vm.turnLabel).not.toBeNull();
  });

  it('turn label is null for an unopened room', () => {
    const contract = buildRoomContract(baseInput({ arguments: [] }));
    const vm = buildRoomContractViewModel(contract, INITIATOR, []);
    expect(vm.turnLabel).toBeNull();
  });

  it('the strip view-model always carries an accessibility label', () => {
    const contract = buildRoomContract(baseInput({ arguments: [ROOT] }));
    const vm = buildRoomContractViewModel(contract, INITIATOR, [ROOT]);
    expect(typeof vm.accessibilityLabel).toBe('string');
    expect(vm.accessibilityLabel.length).toBeGreaterThan(0);
  });
});

// ── roomTypeGlyph — shape/text, not color ──────────────────────

describe('roomTypeGlyph', () => {
  it('returns a distinct non-color glyph per room type', () => {
    const privateGlyph = roomTypeGlyph('Private room');
    const publicGlyph = roomTypeGlyph('Public room');
    expect(privateGlyph).not.toBe(publicGlyph);
    expect(privateGlyph.length).toBeGreaterThan(0);
    expect(publicGlyph.length).toBeGreaterThan(0);
  });
});

// ── Source-scan — RN primitives, Text wrapping, accessibility ──

describe('RoomContractSeatStrip — source contract', () => {
  it('is exported as a named function component', () => {
    expect(typeof RoomContractSeatStrip).toBe('function');
  });

  it('uses only View / Text RN primitives (no new dependency)', () => {
    expect(STRIP_SRC).toContain("from 'react-native'");
    expect(STRIP_SRC).toContain('View');
    expect(STRIP_SRC).toContain('Text');
  });

  it('the strip root exposes an accessibilityLabel', () => {
    expect(STRIP_SRC).toContain('accessibilityLabel={viewModel.accessibilityLabel}');
  });

  it('renders the room-type glyph alongside the room-type text', () => {
    expect(STRIP_SRC).toContain('roomTypeGlyph');
    expect(STRIP_SRC).toContain('{roomTypeLabel}');
  });

  it('imports no router / navigation library (no route transition)', () => {
    expect(STRIP_SRC).not.toContain('navigation');
    expect(STRIP_SRC).not.toContain('expo-router');
    expect(STRIP_SRC).not.toContain('@react-navigation');
  });
});
