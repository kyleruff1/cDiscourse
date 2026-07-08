/**
 * ROOM-001 (#876) — ArgumentStateRail pure-model matrix + read-only proof.
 *
 * Verifies the four turn states, open/owed count chip derivation + suppression,
 * visibility variants, the no-new-query seat subset, overflow "+N", the reserved
 * slots (saved recordings / chime-in / watching render nothing), and the
 * READ-ONLY SOURCE SCAN proving the model imports no data client, no query, no
 * mutation, and no mediator-board deriver (single-derivation invariant safe).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  deriveArgumentStateRail,
  formatStateRailOverflowLabel,
  formatStateRailOverflowAccessibilityLabel,
  STATE_RAIL_INLINE_CHIP_LIMIT,
  type ArgumentStateRailInput,
  type StateRailChip,
  type StateRailChipKind,
} from '../src/features/arguments/room/argumentStateRailModel';

const ROOT = process.cwd();
const MODEL_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/arguments/room/argumentStateRailModel.ts'),
  'utf8',
);

/** A participant, established (both voices), nothing open, public — the calm base. */
function baseInput(overrides: Partial<ArgumentStateRailInput> = {}): ArgumentStateRailInput {
  return {
    viewerRole: 'participant',
    participantSide: 'affirmative',
    turnLabel: "Other voice's move",
    visibility: 'public',
    opponentSeatIsOpen: false,
    openPointCount: 0,
    receiptsOwedCount: 0,
    ...overrides,
  };
}

function chipById(chips: ReadonlyArray<StateRailChip>, id: StateRailChipKind): StateRailChip | undefined {
  return chips.find((c) => c.id === id);
}

describe('deriveArgumentStateRail — turn state', () => {
  it('resolves observer from viewerRole', () => {
    const m = deriveArgumentStateRail(baseInput({ viewerRole: 'observer' }));
    expect(m.turnState).toBe('observer');
  });

  it('resolves observer from participantSide observer / moderator / null even when viewerRole is participant', () => {
    for (const side of ['observer', 'moderator', null]) {
      const m = deriveArgumentStateRail(baseInput({ viewerRole: 'participant', participantSide: side }));
      expect(m.turnState).toBe('observer');
    }
  });

  it('resolves your_turn when the derived turnLabel is the viewer-turn value', () => {
    const m = deriveArgumentStateRail(baseInput({ turnLabel: 'Your move' }));
    expect(m.turnState).toBe('your_turn');
  });

  it('resolves resting for a participant with nothing open and not their move', () => {
    const m = deriveArgumentStateRail(baseInput({ turnLabel: "Other voice's move", openPointCount: 0 }));
    expect(m.turnState).toBe('resting');
  });

  it('resolves waiting for a participant with a live point and not their move', () => {
    const m = deriveArgumentStateRail(baseInput({ turnLabel: "Other voice's move", openPointCount: 2 }));
    expect(m.turnState).toBe('waiting');
  });

  it('turn chip is always first and always visible', () => {
    const m = deriveArgumentStateRail(baseInput());
    expect(m.chips[0]?.id).toBe('turn');
    expect(chipById(m.chips, 'turn')?.isVisible).toBe(true);
  });

  it('your_turn chip carries attention tone; other turn states are neutral', () => {
    expect(chipById(deriveArgumentStateRail(baseInput({ turnLabel: 'Your move' })).chips, 'turn')?.tone).toBe('attention');
    expect(chipById(deriveArgumentStateRail(baseInput({ viewerRole: 'observer' })).chips, 'turn')?.tone).toBe('neutral');
  });

  it('turn chip is informational (no deep-link)', () => {
    expect(chipById(deriveArgumentStateRail(baseInput()).chips, 'turn')?.deepLink).toBeNull();
  });
});

describe('deriveArgumentStateRail — open points chip', () => {
  it('suppresses the open_points chip when the count is zero', () => {
    expect(chipById(deriveArgumentStateRail(baseInput({ openPointCount: 0 })).chips, 'open_points')).toBeUndefined();
  });

  it('renders singular label + map deep-link for one open point', () => {
    const chip = chipById(deriveArgumentStateRail(baseInput({ openPointCount: 1 })).chips, 'open_points');
    expect(chip?.label).toBe('1 open point');
    expect(chip?.deepLink).toBe('map');
  });

  it('renders plural label for many open points', () => {
    const chip = chipById(deriveArgumentStateRail(baseInput({ openPointCount: 4 })).chips, 'open_points');
    expect(chip?.label).toBe('4 open points');
    expect(chip?.accessibilityLabel).toContain('4 open points');
  });

  it('coerces a negative / non-finite count to zero (suppressed)', () => {
    expect(chipById(deriveArgumentStateRail(baseInput({ openPointCount: -3 })).chips, 'open_points')).toBeUndefined();
    expect(chipById(deriveArgumentStateRail(baseInput({ openPointCount: Number.NaN })).chips, 'open_points')).toBeUndefined();
  });
});

describe('deriveArgumentStateRail — receipts owed chip', () => {
  it('suppresses the receipts_owed chip when zero', () => {
    expect(chipById(deriveArgumentStateRail(baseInput({ receiptsOwedCount: 0 })).chips, 'receipts_owed')).toBeUndefined();
  });

  it('renders singular / plural labels + debts deep-link', () => {
    const one = chipById(deriveArgumentStateRail(baseInput({ receiptsOwedCount: 1 })).chips, 'receipts_owed');
    expect(one?.label).toBe('1 receipt owed');
    expect(one?.deepLink).toBe('debts');
    const many = chipById(deriveArgumentStateRail(baseInput({ receiptsOwedCount: 3 })).chips, 'receipts_owed');
    expect(many?.label).toBe('3 receipts owed');
  });
});

describe('deriveArgumentStateRail — visibility chip', () => {
  it('public → Public 1:1, neutral tone, always visible, details deep-link', () => {
    const chip = chipById(deriveArgumentStateRail(baseInput({ visibility: 'public' })).chips, 'visibility');
    expect(chip?.label).toBe('Public 1:1');
    expect(chip?.tone).toBe('neutral');
    expect(chip?.isVisible).toBe(true);
    expect(chip?.deepLink).toBe('details');
  });

  it('private → Private 1:1, private_gold tone', () => {
    const chip = chipById(deriveArgumentStateRail(baseInput({ visibility: 'private' })).chips, 'visibility');
    expect(chip?.label).toBe('Private 1:1');
    expect(chip?.tone).toBe('private_gold');
  });
});

describe('deriveArgumentStateRail — seat segment (no-new-query subset)', () => {
  it('renders the seat chip when the respondent seat is open', () => {
    const chip = chipById(deriveArgumentStateRail(baseInput({ opponentSeatIsOpen: true })).chips, 'seat');
    expect(chip?.label).toBe('Seat open');
    expect(chip?.deepLink).toBe('details');
    expect(chip?.tone).toBe('attention');
  });

  it('suppresses the seat chip when both principal voices are established', () => {
    expect(chipById(deriveArgumentStateRail(baseInput({ opponentSeatIsOpen: false })).chips, 'seat')).toBeUndefined();
  });
});

describe('deriveArgumentStateRail — minimum degrade + overflow', () => {
  it('degrades to [turn, visibility] for an established participant with nothing open', () => {
    const m = deriveArgumentStateRail(baseInput());
    expect(m.chips.map((c) => c.id)).toEqual(['turn', 'visibility']);
    expect(m.overflowCount).toBe(0);
  });

  it('shows exactly 3 inline chips + the remainder as overflow when more than 3 are visible', () => {
    const m = deriveArgumentStateRail(
      baseInput({
        turnLabel: 'Your move',
        openPointCount: 3,
        receiptsOwedCount: 2,
        visibility: 'private',
        opponentSeatIsOpen: true,
      }),
    );
    // [turn, open_points, receipts_owed, visibility, seat] = 5 visible.
    expect(m.chips).toHaveLength(5);
    expect(m.visibleChips).toHaveLength(STATE_RAIL_INLINE_CHIP_LIMIT);
    expect(m.overflowCount).toBe(2);
  });

  it('keeps canonical chip order (turn, open_points, receipts_owed, visibility, seat)', () => {
    const m = deriveArgumentStateRail(
      baseInput({ openPointCount: 1, receiptsOwedCount: 1, opponentSeatIsOpen: true }),
    );
    expect(m.chips.map((c) => c.id)).toEqual(['turn', 'open_points', 'receipts_owed', 'visibility', 'seat']);
  });
});

describe('deriveArgumentStateRail — reserved slots render nothing', () => {
  it('omits the saved_recordings chip when absent or zero', () => {
    expect(chipById(deriveArgumentStateRail(baseInput()).chips, 'saved_recordings')).toBeUndefined();
    expect(
      chipById(deriveArgumentStateRail(baseInput({ savedRecordingCount: 0 })).chips, 'saved_recordings'),
    ).toBeUndefined();
  });

  it('blank-chip guard — a positive count with an empty label stays suppressed (no blank chip)', () => {
    // The reserved slot has no copy yet (VOICE-ADR-002). A future VOICE wiring
    // card that supplies a count MUST also supply a non-empty label; until then
    // the chip never renders, so a positive count alone cannot paint a blank chip.
    const chip = chipById(deriveArgumentStateRail(baseInput({ savedRecordingCount: 2 })).chips, 'saved_recordings');
    expect(chip).toBeUndefined();
  });

  it('ignores reserved openChimeInSeatCount / watchingCount inputs (no chip, no crash)', () => {
    const m = deriveArgumentStateRail(baseInput({ openChimeInSeatCount: 2, watchingCount: 9 }));
    expect(m.chips.map((c) => c.id)).toEqual(['turn', 'visibility']);
  });
});

describe('deriveArgumentStateRail — overflow label helpers + serializability', () => {
  it('formats the +N overflow label and its a11y sentence', () => {
    expect(formatStateRailOverflowLabel(2)).toBe('+2');
    expect(formatStateRailOverflowAccessibilityLabel(2)).toContain('2 more');
    expect(formatStateRailOverflowLabel(-1)).toBe('+0');
  });

  it('produces JSON-serializable output (round-trips)', () => {
    const m = deriveArgumentStateRail(baseInput({ openPointCount: 2, opponentSeatIsOpen: true }));
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });

  it('exposes the root accessibility label', () => {
    expect(deriveArgumentStateRail(baseInput()).accessibilityLabel.length).toBeGreaterThan(0);
  });
});

describe('argumentStateRailModel — read-only source scan (single-derivation safe)', () => {
  it('imports no data client and contains no query / mutation call', () => {
    expect(MODEL_SRC).not.toMatch(/supabase/i);
    expect(MODEL_SRC).not.toMatch(/\.from\(/);
    expect(MODEL_SRC).not.toMatch(/\bfetch\(/);
    expect(MODEL_SRC).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });

  it('does not import or call the mediator-board deriver (props-only projection)', () => {
    expect(MODEL_SRC).not.toMatch(/deriveMediatorBoardState|deriveRoomMediatorBoardState/);
  });

  it('imports no React (pure model)', () => {
    expect(MODEL_SRC).not.toMatch(/from ['"]react['"]/);
  });
});
