/**
 * FEEDBACK-001 (#898) — move-mark copy doctrine ban-list.
 *
 * Every move-mark code AND every rendered string describes the MOVE, never the
 * person: no verdict / person token appears in any code, label, a11y string, bar
 * copy, legend line, or error message. Raw internal codes never leak to the UI
 * (no snake_case in a rendered string). Unknown error codes fall back, never
 * echoed. A firing negative control proves the scan can fail.
 */
import { ALL_MOVE_MARK_CODES } from '../src/features/feedback/moveMarksModel';
import {
  MOVE_MARK_A11Y_LABEL,
  MOVE_MARK_ERROR_COPY,
  MOVE_MARK_LABEL,
  MOVE_MARKS_BAR_COPY,
  MOVE_MARKS_LEGEND_LINE,
  allRenderedMoveMarkStrings,
  toMoveMarkErrorCode,
} from '../src/features/feedback/moveMarksCopy';

const BANNED = [
  'winner',
  'loser',
  'liar',
  'true',
  'false',
  'correct',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
];

function scan(strings: string[]): void {
  for (const s of strings) {
    for (const b of BANNED) {
      expect(s.toLowerCase()).not.toContain(b);
    }
  }
}

describe('FEEDBACK-001 — no verdict / person tokens in codes or copy', () => {
  it('no mark code carries a banned token', () => {
    scan([...ALL_MOVE_MARK_CODES]);
  });

  it('MOVE_MARK_LABEL carries no banned token', () => {
    scan(Object.values(MOVE_MARK_LABEL));
  });

  it('MOVE_MARK_A11Y_LABEL carries no banned token', () => {
    scan(Object.values(MOVE_MARK_A11Y_LABEL));
  });

  it('MOVE_MARKS_BAR_COPY + legend + error copy carry no banned token', () => {
    scan(Object.values(MOVE_MARKS_BAR_COPY));
    scan([MOVE_MARKS_LEGEND_LINE]);
    scan(Object.values(MOVE_MARK_ERROR_COPY));
  });

  it('every rendered string (single source of truth) is ban-list clean', () => {
    scan(allRenderedMoveMarkStrings());
  });

  it('NEGATIVE CONTROL: the scan fires on a planted verdict token', () => {
    expect(() => scan(['That move is a lie by a manipulative user'])).toThrow();
    expect(() => scan(['You are the winner here'])).toThrow();
  });
});

describe('FEEDBACK-001 — no raw internal code leaks to the UI', () => {
  it('no rendered label / a11y / bar / legend string contains a snake_case code', () => {
    for (const s of [
      ...Object.values(MOVE_MARK_LABEL),
      ...Object.values(MOVE_MARK_A11Y_LABEL),
      ...Object.values(MOVE_MARKS_BAR_COPY),
      MOVE_MARKS_LEGEND_LINE,
    ]) {
      expect(s).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('no error message contains a snake_case internal code', () => {
    for (const msg of Object.values(MOVE_MARK_ERROR_COPY)) {
      expect(msg).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('toMoveMarkErrorCode maps known codes through and unknown codes to unknown', () => {
    expect(toMoveMarkErrorCode('not_a_participant')).toBe('not_a_participant');
    expect(toMoveMarkErrorCode('cannot_mark_own_move')).toBe('cannot_mark_own_move');
    expect(toMoveMarkErrorCode('invalid_mark_code')).toBe('invalid_mark_code');
    expect(toMoveMarkErrorCode('some_brand_new_code')).toBe('unknown');
    expect(toMoveMarkErrorCode(undefined)).toBe('unknown');
  });
});
