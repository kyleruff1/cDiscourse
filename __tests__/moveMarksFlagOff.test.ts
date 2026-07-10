/**
 * FEEDBACK-001 (#898) — flag-off byte-identity proof for the move-marks surface.
 *
 * With move_marks OFF the room is byte-identical to today:
 *   - useMoveMarks fetches nothing (enabled is moveMarksEnabled === true);
 *   - the aggregate memo returns null, so the state-rail openPointCount +
 *     receiptsOwedCount fall through to their base values unchanged;
 *   - the DisagreementPointsRail marksLegendLine is undefined;
 *   - the ghost bar props passed to both lenses are all undefined => no bar mounts.
 * With the flag ON the hook fetches, the aggregate derives, and the bar mounts.
 * App.tsx stays the sole flag consumer; the new feedback files import no
 * featureFlags.
 *
 * Source-scan discipline (no runtime render), modeled on roomFourFlagOff.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const APP_SRC = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
const TREE_SRC = fs.readFileSync(path.join(ROOT, 'src/features/arguments/ArgumentTreeScreen.tsx'), 'utf8');
const ROOM_SRC = fs.readFileSync(path.join(ROOT, 'src/features/arguments/room/ArgumentRoom.tsx'), 'utf8');

const FEEDBACK_FILES = [
  'src/features/feedback/moveMarksModel.ts',
  'src/features/feedback/moveMarkAggregateModel.ts',
  'src/features/feedback/moveMarksCopy.ts',
  'src/features/feedback/moveMarksApi.ts',
  'src/features/feedback/BooleanFeedbackBar.tsx',
  'src/features/feedback/useMoveMarks.ts',
];

// ── Logic identity ────────────────────────────────────────────

/** The bar mounts iff the flag is on AND not own AND the viewer is a participant. */
function barMounted(moveMarksEnabled: boolean, isOwn: boolean, isParticipant: boolean): boolean {
  return moveMarksEnabled && !isOwn && isParticipant;
}

describe('FEEDBACK-001 flag-off — logic identity', () => {
  it('the bar is unmounted unless the flag is on, not own, participant', () => {
    expect(barMounted(false, false, true)).toBe(false); // flag off
    expect(barMounted(true, true, true)).toBe(false); // own move
    expect(barMounted(true, false, false)).toBe(false); // observer
    expect(barMounted(true, false, true)).toBe(true);
  });
});

// ── App.tsx (the sole flag consumer) ──────────────────────────

describe('FEEDBACK-001 flag-off — App.tsx threads the flag', () => {
  it('reads the flag once via isMoveMarksEnabled', () => {
    expect(APP_SRC).toMatch(/import \{ isMoveMarksEnabled \} from '\.\/src\/lib\/featureFlags';/);
    expect(APP_SRC).toMatch(/const moveMarksEnabled = isMoveMarksEnabled\(\);/);
  });

  it('passes moveMarksEnabled to the room screen', () => {
    expect(APP_SRC).toMatch(/moveMarksEnabled=\{moveMarksEnabled\}/);
  });
});

// ── ArgumentTreeScreen pass-through ───────────────────────────

describe('FEEDBACK-001 flag-off — ArgumentTreeScreen forwards the flag verbatim', () => {
  it('declares and forwards moveMarksEnabled through both mounts', () => {
    expect(TREE_SRC).toMatch(/moveMarksEnabled\?: boolean;/);
    // Forwarded at least twice (ArgumentTreeScreen mount + FullRoomGameSurfaceMount).
    const forwards = TREE_SRC.match(/moveMarksEnabled=\{moveMarksEnabled\}/g) ?? [];
    expect(forwards.length).toBeGreaterThanOrEqual(2);
  });
});

// ── ArgumentRoom gating ───────────────────────────────────────

describe('FEEDBACK-001 flag-off — ArgumentRoom gating', () => {
  it('useMoveMarks is enabled only when moveMarksEnabled === true', () => {
    expect(ROOM_SRC).toMatch(/enabled:\s*moveMarksEnabled === true/);
  });

  it('the aggregate memo returns null when the flag is off', () => {
    expect(ROOM_SRC).toMatch(/moveMarksEnabled \? deriveMoveMarkAggregate\(moveMarks\.activeRows\) : null/);
  });

  it('openPointCount + receiptsOwedCount fall through to their base when the aggregate is null', () => {
    expect(ROOM_SRC).toMatch(/if \(!moveMarkAggregate\) return base;/);
  });

  it('the marks legend line is passed only when the aggregate has an unanswered move', () => {
    expect(ROOM_SRC).toMatch(
      /marksLegendLine=\{[\s\S]*?moveMarkAggregate && moveMarkAggregate\.unaddressedMoveIds\.length > 0[\s\S]*?\}/,
    );
  });

  it('the ghost bar props to both lenses are gated on moveMarksEnabled', () => {
    // ExchangeView (Ringside) + MapView (Map): both pass the bar handlers only
    // when the flag is on (else undefined => no bar).
    const gatedMark = ROOM_SRC.match(/onMarkMove=\{moveMarksEnabled \? moveMarks\.onMark : undefined\}/g) ?? [];
    expect(gatedMark.length).toBeGreaterThanOrEqual(2);
    const gatedUnmark = ROOM_SRC.match(/onUnmarkMove=\{moveMarksEnabled \? moveMarks\.onUnmark : undefined\}/g) ?? [];
    expect(gatedUnmark.length).toBeGreaterThanOrEqual(2);
  });
});

// ── No new featureFlags consumer ──────────────────────────────

describe('FEEDBACK-001 flag-off — the new feedback files read no featureFlags', () => {
  it('none of the new feedback files import from featureFlags (App.tsx is the sole consumer)', () => {
    // Scan for the IMPORT path, not the word: the doctrine comments legitimately
    // say "No featureFlags import".
    for (const rel of FEEDBACK_FILES) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect({ rel, hit: /from '[^']*featureFlags'/.test(src) }).toEqual({ rel, hit: false });
    }
  });

  it('NEGATIVE CONTROL: the featureFlags-import scan fires on a planted import', () => {
    const planted = "import { isMoveMarksEnabled } from '../../lib/featureFlags';";
    expect(/from '[^']*featureFlags'/.test(planted)).toBe(true);
    const proseOnly = '// No featureFlags import in this file.';
    expect(/from '[^']*featureFlags'/.test(proseOnly)).toBe(false);
  });
});
