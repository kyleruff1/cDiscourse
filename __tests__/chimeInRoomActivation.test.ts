/**
 * CHIMEIN-P8 Round 2 (#761) — UI-model activation: the chimeAffordanceVisible
 * flip (oneToOneRoomModel) + the ArgumentStateRail chime-seat chip.
 *
 * Both are flag-gated at the room-shell boundary (the flag threads from App.tsx as
 * a prop); the pure models activate ONLY when the room shell supplies the new
 * input. With the input absent / false / 0 the output is byte-identical to the
 * pre-Round-2 behavior — proven here alongside the flag-ON activation.
 */
import {
  buildRoomOneToOneViewModel,
  type RoomOneToOneDisplayInput,
} from '../src/features/debates/oneToOneRoomModel';
import {
  deriveArgumentStateRail,
  type ArgumentStateRailInput,
} from '../src/features/arguments/room/argumentStateRailModel';

// ── oneToOneRoomModel.chimeAffordanceVisible flip ───────────────

function roomInput(over: Partial<RoomOneToOneDisplayInput> = {}): RoomOneToOneDisplayInput {
  return {
    visibility: 'public',
    opponentSeatIsOpen: false, // established (both principals) by default
    openChimeInSeatCount: 3,
    ...over,
  };
}

describe('CHIMEIN-P8 — chimeAffordanceVisible is dormant-false when the flag input is absent', () => {
  it('byte-identical: an available-dormant public room stays false with no activation input', () => {
    const vm = buildRoomOneToOneViewModel(roomInput());
    expect(vm.state).toBe('public_chime_in_available_dormant');
    expect(vm.chimeAffordanceVisible).toBe(false);
  });

  it('byte-identical: an explicit false activation input keeps it false', () => {
    const vm = buildRoomOneToOneViewModel(roomInput({ chimeInActivationEnabled: false }));
    expect(vm.chimeAffordanceVisible).toBe(false);
  });
});

describe('CHIMEIN-P8 — chimeAffordanceVisible flips true only in the eligible public state (flag ON)', () => {
  it('true when public, established, with an open chime seat + flag ON', () => {
    const vm = buildRoomOneToOneViewModel(roomInput({ chimeInActivationEnabled: true }));
    expect(vm.state).toBe('public_chime_in_available_dormant');
    expect(vm.chimeAffordanceVisible).toBe(true);
  });

  it('false for a private room even with the flag ON (the public-only guard)', () => {
    const vm = buildRoomOneToOneViewModel(
      roomInput({ visibility: 'private', opponentSeatIsOpen: null, chimeInActivationEnabled: true }),
    );
    expect(vm.state).toBe('private_invited_access');
    expect(vm.chimeAffordanceVisible).toBe(false);
  });

  it('false when the chime seats are full (full-dormant) even with the flag ON', () => {
    const vm = buildRoomOneToOneViewModel(
      roomInput({ openChimeInSeatCount: 0, chimeInActivationEnabled: true }),
    );
    expect(vm.state).toBe('public_chime_in_full_dormant');
    expect(vm.chimeAffordanceVisible).toBe(false);
  });

  it('false when the respondent seat is still open (not established) even with the flag ON', () => {
    const vm = buildRoomOneToOneViewModel(
      roomInput({ opponentSeatIsOpen: true, chimeInActivationEnabled: true }),
    );
    expect(vm.state).toBe('public_respondent_seat_open');
    expect(vm.chimeAffordanceVisible).toBe(false);
  });

  it('false for a pure observer view even with the flag ON', () => {
    const vm = buildRoomOneToOneViewModel(
      roomInput({ viewerIsObserver: true, chimeInActivationEnabled: true }),
    );
    expect(vm.state).toBe('observer_reading');
    expect(vm.chimeAffordanceVisible).toBe(false);
  });

  it('never changes the display state — activation flips only the affordance boolean', () => {
    const off = buildRoomOneToOneViewModel(roomInput());
    const on = buildRoomOneToOneViewModel(roomInput({ chimeInActivationEnabled: true }));
    expect(on.state).toBe(off.state);
    expect(on.label).toBe(off.label);
    expect(on.subcopy).toBe(off.subcopy);
    expect(on.chimeAffordanceVisible).not.toBe(off.chimeAffordanceVisible);
  });
});

// ── ArgumentStateRail chime-seat chip ───────────────────────────

function railInput(over: Partial<ArgumentStateRailInput> = {}): ArgumentStateRailInput {
  return {
    viewerRole: 'participant',
    participantSide: 'affirmative',
    turnLabel: 'Your move',
    visibility: 'public',
    opponentSeatIsOpen: false,
    openPointCount: 0,
    receiptsOwedCount: 0,
    ...over,
  };
}

describe('CHIMEIN-P8 — the ArgumentStateRail chime-seat chip', () => {
  it('byte-identical: no chime chip when openChimeInSeatCount is absent (the pre-Round-2 rail)', () => {
    const rail = deriveArgumentStateRail(railInput());
    expect(rail.chips.some((c) => c.id === 'chime_seats')).toBe(false);
  });

  it('byte-identical: no chime chip when openChimeInSeatCount is 0 (seats full)', () => {
    const rail = deriveArgumentStateRail(railInput({ openChimeInSeatCount: 0 }));
    expect(rail.chips.some((c) => c.id === 'chime_seats')).toBe(false);
  });

  it('renders a chime chip with the plural count when seats are open', () => {
    const rail = deriveArgumentStateRail(railInput({ openChimeInSeatCount: 2 }));
    const chip = rail.chips.find((c) => c.id === 'chime_seats');
    expect(chip).toBeDefined();
    expect(chip?.label).toBe('2 chime-in seats open');
    expect(chip?.tone).toBe('neutral');
    // A pure count readout — never a navigation target, never pressable.
    expect(chip?.deepLink).toBeNull();
  });

  it('uses the singular word for exactly one open seat', () => {
    const rail = deriveArgumentStateRail(railInput({ openChimeInSeatCount: 1 }));
    const chip = rail.chips.find((c) => c.id === 'chime_seats');
    expect(chip?.label).toBe('1 chime-in seat open');
    expect(chip?.accessibilityLabel).toContain('Open to chime in');
  });

  it('the chime chip carries no verdict / amplification / snake_case token', () => {
    const rail = deriveArgumentStateRail(railInput({ openChimeInSeatCount: 3 }));
    const chip = rail.chips.find((c) => c.id === 'chime_seats');
    const strings = [chip?.label ?? '', chip?.accessibilityLabel ?? ''];
    const BANNED = ['winner', 'loser', 'correct', 'verdict', 'score', 'viral', 'popular', 'upvote'];
    for (const s of strings) {
      const lower = s.toLowerCase();
      for (const token of BANNED) expect(lower).not.toContain(token);
      expect(s).not.toMatch(/[a-z]+_[a-z]+/); // no snake_case leak
    }
  });
});
