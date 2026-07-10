/**
 * FEEDBACK-001 (#898) — moveMarksModel pure-model tests.
 *
 * summarizeViewerMarks, oppositeOf, isMoveMarkCode, ALL_MOVE_MARK_CODES, and the
 * empty-state constructor. The summarizer is active-only, viewer-scoped, total,
 * and pure. No React, no Supabase, no network.
 */
import {
  ALL_MOVE_MARK_CODES,
  MUTUALLY_EXCLUSIVE_PAIR,
  emptyViewerMoveMarkState,
  isMoveMarkCode,
  oppositeOf,
  summarizeViewerMarks,
  type MoveMarkRow,
} from '../src/features/feedback/moveMarksModel';

const row = (
  argumentId: string,
  markCode: MoveMarkRow['markCode'],
  markedBy: string,
  retractedAt: string | null = null,
): MoveMarkRow => ({ argumentId, markCode, markedBy, retractedAt });

describe('FEEDBACK-001 — ALL_MOVE_MARK_CODES', () => {
  it('is exactly the five Output 9 codes, frozen', () => {
    expect([...ALL_MOVE_MARK_CODES]).toEqual([
      'addressed_my_point',
      'did_not_address',
      'receipts_requested',
      'good_receipt',
      'off_the_point',
    ]);
    expect(ALL_MOVE_MARK_CODES).toHaveLength(5);
    expect(Object.isFrozen(ALL_MOVE_MARK_CODES)).toBe(true);
  });

  it('the mutually-exclusive pair is the two ghost-bar arms', () => {
    expect([...MUTUALLY_EXCLUSIVE_PAIR]).toEqual(['addressed_my_point', 'did_not_address']);
  });
});

describe('FEEDBACK-001 — isMoveMarkCode', () => {
  it('accepts every valid code, rejects unknowns / casing / empty', () => {
    for (const c of ALL_MOVE_MARK_CODES) expect(isMoveMarkCode(c)).toBe(true);
    expect(isMoveMarkCode('is_the_winner')).toBe(false);
    expect(isMoveMarkCode('')).toBe(false);
    expect(isMoveMarkCode('ADDRESSED_MY_POINT')).toBe(false);
  });
});

describe('FEEDBACK-001 — oppositeOf', () => {
  it('pairs only the two arms; other codes return null', () => {
    expect(oppositeOf('addressed_my_point')).toBe('did_not_address');
    expect(oppositeOf('did_not_address')).toBe('addressed_my_point');
    expect(oppositeOf('receipts_requested')).toBeNull();
    expect(oppositeOf('good_receipt')).toBeNull();
    expect(oppositeOf('off_the_point')).toBeNull();
  });
});

describe('FEEDBACK-001 — emptyViewerMoveMarkState', () => {
  it('returns all-false and a fresh object each call', () => {
    const a = emptyViewerMoveMarkState();
    const b = emptyViewerMoveMarkState();
    expect(a).toEqual({
      addressed_my_point: false,
      did_not_address: false,
      receipts_requested: false,
      good_receipt: false,
      off_the_point: false,
    });
    expect(a).not.toBe(b); // fresh ref (never a shared singleton)
  });
});

describe('FEEDBACK-001 — summarizeViewerMarks', () => {
  it('reflects the viewer active marks on the target move only', () => {
    const rows = [
      row('m1', 'addressed_my_point', 'viewer'),
      row('m1', 'receipts_requested', 'viewer'),
      row('m2', 'did_not_address', 'viewer'), // different move
      row('m1', 'did_not_address', 'other'), // different marker
    ];
    const state = summarizeViewerMarks(rows, 'm1', 'viewer');
    expect(state.addressed_my_point).toBe(true);
    expect(state.receipts_requested).toBe(true);
    expect(state.did_not_address).toBe(false); // that row is on m2 / other
    expect(state.good_receipt).toBe(false);
    expect(state.off_the_point).toBe(false);
  });

  it('ignores retracted rows (active-only)', () => {
    const rows = [row('m1', 'addressed_my_point', 'viewer', '2026-07-12T00:00:00Z')];
    expect(summarizeViewerMarks(rows, 'm1', 'viewer').addressed_my_point).toBe(false);
  });

  it('a null viewerId yields the all-false state', () => {
    const rows = [row('m1', 'addressed_my_point', 'viewer')];
    expect(summarizeViewerMarks(rows, 'm1', null)).toEqual(emptyViewerMoveMarkState());
  });

  it('ignores unknown mark codes defensively', () => {
    const rows = [{ argumentId: 'm1', markCode: 'is_the_winner', markedBy: 'viewer', retractedAt: null } as unknown as MoveMarkRow];
    expect(summarizeViewerMarks(rows, 'm1', 'viewer')).toEqual(emptyViewerMoveMarkState());
  });

  it('is pure — same input yields an equal, distinct object; no input mutation', () => {
    const rows = [row('m1', 'did_not_address', 'viewer')];
    const frozenRows = Object.freeze(rows.map((r) => Object.freeze({ ...r })));
    const a = summarizeViewerMarks(frozenRows, 'm1', 'viewer');
    const b = summarizeViewerMarks(frozenRows, 'm1', 'viewer');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('the returned state carries no score / standing field (inert)', () => {
    const state = summarizeViewerMarks([row('m1', 'did_not_address', 'viewer')], 'm1', 'viewer') as Record<
      string,
      unknown
    >;
    for (const key of Object.keys(state)) {
      expect(key).not.toMatch(/score|standing|weight|delta/i);
    }
  });
});
