/**
 * UX-SIMPLIFY-001 — create-argument flow copy clarity.
 *
 * The creation surface already uses "Start an argument" + consistent "argument"
 * vocabulary. This card adds the #652 seat/voice clarity to the public-room
 * capacity explainer (readers/watchers do not consume an active seat) and a
 * clearer first-point prompt. Tests pin the new copy + doctrine safety. NO
 * room-creation / invite / seat behavior is exercised here (pure copy).
 */
import {
  ARGUMENT_ROOM_CREATE_COPY,
  ROOM_COPY,
  fillArgumentRoomCapacityCopy,
  looksLikeInternalCode,
} from '../src/features/arguments/gameCopy';

// Verdict / person-judgment + raw internal identifiers that must never appear
// in user-facing create-flow copy.
const FORBIDDEN = [
  'winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative',
  'verdict', 'right', 'wrong', 'true', 'false',
];
const RAW_IDENTIFIERS = [
  'participant_side', 'debate_id', 'roomactiveseatcap', 'moderator', 'visibility',
];

describe('UX-SIMPLIFY-001 create-flow copy', () => {
  it('keeps the primary CTA "Start an argument"', () => {
    expect(ROOM_COPY.startArgument).toBe('Start an argument');
  });

  it('private capacity copy communicates a 1v1', () => {
    const c = ARGUMENT_ROOM_CREATE_COPY.capacity_private.toLowerCase();
    expect(c).toMatch(/two of you|one person/);
  });

  it('public capacity copy frames active seats AND that watching does not use a seat', () => {
    for (const tpl of [
      ARGUMENT_ROOM_CREATE_COPY.capacity_public_open,
      ARGUMENT_ROOM_CREATE_COPY.capacity_public_reserved,
    ]) {
      expect(tpl).toMatch(/active seat/i);
      expect(tpl.toLowerCase()).toContain('watch');
      expect(tpl.toLowerCase()).toContain('without using a seat');
      // Placeholders are preserved so the cap stays the single source of truth.
      expect(tpl).toContain('{capacity}');
      expect(tpl).toContain('{open}');
    }
  });

  it('the filled public capacity copy renders the numbers + keeps the readers clarity', () => {
    const filled = fillArgumentRoomCapacityCopy(ARGUMENT_ROOM_CREATE_COPY.capacity_public_open, {
      capacity: 5,
      open: 4,
    });
    expect(filled).toContain('5');
    expect(filled).toContain('4');
    expect(filled).toContain('Readers can watch without using a seat');
    // The placeholders are fully replaced — no leftover token.
    expect(filled).not.toContain('{capacity}');
    expect(filled).not.toContain('{open}');
  });

  it('create-flow capacity/invite copy is ban-list clean and leaks no internal code', () => {
    const strings = [
      ARGUMENT_ROOM_CREATE_COPY.who_can_join_label,
      ARGUMENT_ROOM_CREATE_COPY.who_can_join_helper,
      ARGUMENT_ROOM_CREATE_COPY.invite_helper_private,
      ARGUMENT_ROOM_CREATE_COPY.invite_helper_public,
      ARGUMENT_ROOM_CREATE_COPY.capacity_private,
      ARGUMENT_ROOM_CREATE_COPY.capacity_public_open,
      ARGUMENT_ROOM_CREATE_COPY.capacity_public_reserved,
    ];
    for (const s of strings) {
      const lower = s.toLowerCase();
      for (const token of FORBIDDEN) expect(lower).not.toContain(token);
      // Raw internal identifiers (snake_case names / model keys) never shown.
      for (const id of RAW_IDENTIFIERS) expect(lower).not.toContain(id);
      // The capacity templates legitimately contain {capacity}/{open}; strip
      // those before the snake_case-shape check so the placeholder braces don't
      // false-positive (they are not snake_case anyway).
      expect(looksLikeInternalCode(s.replace(/\{[a-z]+\}/g, 'N'))).toBe(false);
    }
  });
});
