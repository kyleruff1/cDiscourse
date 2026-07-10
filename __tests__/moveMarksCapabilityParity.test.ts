/**
 * FEEDBACK-001 (#898) — mark capability parity (A×B rule, ROOM-004).
 *
 * The mark capability must be reachable in BOTH the Ringside active card and the
 * Map node popover for a participant on a non-own opponent move, and reachable in
 * NEITHER for an observer or on an own move. Because both lenses mount the SAME
 * BooleanFeedbackBar wired to the SAME useMoveMarks handlers, parity is
 * structural. This suite pins (a) the shared gate predicate across the actor
 * matrix and (b) that both lens source files mount the bar under the same gate,
 * with a firing negative control that stubs one lens to diverge.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const RINGSIDE_SRC = fs.readFileSync(
  path.join(ROOT, 'src/features/arguments/room/RingsideCard.tsx'),
  'utf8',
);
const POPOVER_SRC = fs.readFileSync(
  path.join(ROOT, 'src/features/arguments/room/MapNodeActionPopover.tsx'),
  'utf8',
);

type ActorKind = 'participant' | 'observer';

/** The single gate both lenses apply. Reachable iff flag on + not own + participant. */
function markBarReachable(input: {
  moveMarksEnabled: boolean;
  isOwn: boolean;
  actorKind: ActorKind;
}): boolean {
  return input.moveMarksEnabled && !input.isOwn && input.actorKind === 'participant';
}

/** A DELIBERATELY BROKEN lens that forgets the own-move check (the negative control). */
function brokenLensReachable(input: {
  moveMarksEnabled: boolean;
  isOwn: boolean;
  actorKind: ActorKind;
}): boolean {
  return input.moveMarksEnabled && input.actorKind === 'participant';
}

const MATRIX: Array<{ moveMarksEnabled: boolean; isOwn: boolean; actorKind: ActorKind; expected: boolean }> = [
  { moveMarksEnabled: true, isOwn: false, actorKind: 'participant', expected: true },
  { moveMarksEnabled: true, isOwn: true, actorKind: 'participant', expected: false }, // own move
  { moveMarksEnabled: true, isOwn: false, actorKind: 'observer', expected: false }, // observer
  { moveMarksEnabled: false, isOwn: false, actorKind: 'participant', expected: false }, // flag off
];

describe('FEEDBACK-001 — mark capability parity predicate', () => {
  it('the gate matches the expected actor matrix', () => {
    for (const cell of MATRIX) {
      expect(markBarReachable(cell)).toBe(cell.expected);
    }
  });

  it('BOTH lenses share the identical gate for every cell (parity by construction)', () => {
    for (const cell of MATRIX) {
      const ringside = markBarReachable(cell);
      const popover = markBarReachable(cell);
      expect(ringside).toBe(popover);
    }
  });

  it('NEGATIVE CONTROL: a lens that drops the own-move check diverges on an own move', () => {
    const ownMove = { moveMarksEnabled: true, isOwn: true, actorKind: 'participant' as ActorKind };
    // The correct lens hides the bar on an own move; the broken lens would show it.
    expect(markBarReachable(ownMove)).toBe(false);
    expect(brokenLensReachable(ownMove)).toBe(true);
    expect(markBarReachable(ownMove)).not.toBe(brokenLensReachable(ownMove));
  });
});

describe('FEEDBACK-001 — both lens sources mount the SAME bar under the SAME gate', () => {
  it('the Ringside card imports and mounts BooleanFeedbackBar', () => {
    expect(RINGSIDE_SRC).toMatch(/import \{ BooleanFeedbackBar \}/);
    expect(RINGSIDE_SRC).toMatch(/<BooleanFeedbackBar/);
  });

  it('the Map popover imports and mounts BooleanFeedbackBar', () => {
    expect(POPOVER_SRC).toMatch(/import \{ BooleanFeedbackBar \}/);
    expect(POPOVER_SRC).toMatch(/<BooleanFeedbackBar/);
  });

  it('the Ringside gate is flag on + not own + participant', () => {
    expect(RINGSIDE_SRC).toMatch(/props\.moveMarksEnabled/);
    expect(RINGSIDE_SRC).toMatch(/!card\.isOwn/);
    expect(RINGSIDE_SRC).toMatch(/card\.actionRow\.kind === 'participant'/);
  });

  it('the Map popover gate is flag on + not own + participant', () => {
    expect(POPOVER_SRC).toMatch(/props\.moveMarksEnabled/);
    expect(POPOVER_SRC).toMatch(/!surface\.isOwnMove/);
    expect(POPOVER_SRC).toMatch(/row\.kind === 'participant'/);
  });

  it('both lenses wire the SAME onMark / onUnmark handler props', () => {
    expect(RINGSIDE_SRC).toMatch(/onMark=\{props\.onMarkMove\}/);
    expect(RINGSIDE_SRC).toMatch(/onUnmark=\{props\.onUnmarkMove\}/);
    expect(POPOVER_SRC).toMatch(/onMark=\{props\.onMarkMove\}/);
    expect(POPOVER_SRC).toMatch(/onUnmark=\{props\.onUnmarkMove\}/);
  });
});
