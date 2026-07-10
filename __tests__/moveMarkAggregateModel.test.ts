/**
 * FEEDBACK-001 (#898) — moveMarkAggregateModel pure-model tests.
 *
 * deriveMoveMarkAggregate is the ONE derivation both aggregate surfaces consume.
 * It is active-only, deterministic, and carries NO score / standing / weight field
 * (the anti-amplification boundary — a pile of did_not_address marks can never
 * lower a claim's standing).
 */
import {
  RECEIPTS_PROMPT_THRESHOLD,
  deriveMoveMarkAggregate,
  receiptsPromptMoveIds,
} from '../src/features/feedback/moveMarkAggregateModel';
import type { MoveMarkRow } from '../src/features/feedback/moveMarksModel';

const row = (
  argumentId: string,
  markCode: MoveMarkRow['markCode'],
  markedBy: string,
  retractedAt: string | null = null,
): MoveMarkRow => ({ argumentId, markCode, markedBy, retractedAt });

describe('FEEDBACK-001 — deriveMoveMarkAggregate', () => {
  it('collects did_not_address chains into unaddressedMoveIds (distinct, sorted)', () => {
    const agg = deriveMoveMarkAggregate([
      row('m2', 'did_not_address', 'a'),
      row('m1', 'did_not_address', 'a'),
      row('m1', 'did_not_address', 'b'), // distinct markers, same move
    ]);
    expect(agg.unaddressedMoveIds).toEqual(['m1', 'm2']);
  });

  it('counts active receipts_requested per move (the proof-prompt threshold)', () => {
    const agg = deriveMoveMarkAggregate([
      row('m1', 'receipts_requested', 'a'),
      row('m1', 'receipts_requested', 'b'),
      row('m2', 'receipts_requested', 'a'),
    ]);
    expect(agg.receiptsRequestedByArgumentId).toEqual({ m1: 2, m2: 1 });
    expect(RECEIPTS_PROMPT_THRESHOLD).toBe(2);
    expect(receiptsPromptMoveIds(agg)).toEqual(['m1']); // only m1 reaches 2
  });

  it('collects off_the_point moves (distinct, sorted)', () => {
    const agg = deriveMoveMarkAggregate([
      row('m3', 'off_the_point', 'a'),
      row('m1', 'off_the_point', 'a'),
    ]);
    expect(agg.offThePointMoveIds).toEqual(['m1', 'm3']);
  });

  it('ignores retracted rows (active-only)', () => {
    const agg = deriveMoveMarkAggregate([
      row('m1', 'did_not_address', 'a', '2026-07-12T00:00:00Z'),
      row('m1', 'receipts_requested', 'a', '2026-07-12T00:00:00Z'),
    ]);
    expect(agg.unaddressedMoveIds).toEqual([]);
    expect(agg.receiptsRequestedByArgumentId).toEqual({});
  });

  it('ignores the addressed_my_point / good_receipt codes for these three lenses', () => {
    const agg = deriveMoveMarkAggregate([
      row('m1', 'addressed_my_point', 'a'),
      row('m1', 'good_receipt', 'a'),
    ]);
    expect(agg.unaddressedMoveIds).toEqual([]);
    expect(agg.offThePointMoveIds).toEqual([]);
    expect(agg.receiptsRequestedByArgumentId).toEqual({});
  });

  it('is deterministic — same input yields an equal aggregate', () => {
    const rows = [row('mb', 'did_not_address', 'a'), row('ma', 'did_not_address', 'b')];
    expect(deriveMoveMarkAggregate(rows)).toEqual(deriveMoveMarkAggregate(rows));
    expect(deriveMoveMarkAggregate(rows).unaddressedMoveIds).toEqual(['ma', 'mb']);
  });

  it('the aggregate shape carries NO score / standing / weight / delta field', () => {
    const agg = deriveMoveMarkAggregate([row('m1', 'did_not_address', 'a')]) as unknown as Record<
      string,
      unknown
    >;
    for (const key of Object.keys(agg)) {
      // "offThePointMoveIds" legitimately carries the domain word "point"; the
      // scoring concern is a score / standing / weight / delta field.
      expect(key).not.toMatch(/score|standing|weight|delta/i);
    }
    // The value shapes are id-lists + a count map only — no numeric standing.
    expect(Object.keys(agg).sort()).toEqual([
      'offThePointMoveIds',
      'receiptsRequestedByArgumentId',
      'unaddressedMoveIds',
    ]);
  });

  it('freezes the output collections', () => {
    const agg = deriveMoveMarkAggregate([row('m1', 'did_not_address', 'a')]);
    expect(Object.isFrozen(agg.unaddressedMoveIds)).toBe(true);
    expect(Object.isFrozen(agg.offThePointMoveIds)).toBe(true);
    expect(Object.isFrozen(agg.receiptsRequestedByArgumentId)).toBe(true);
  });
});
