/**
 * HOME-003 (#840) — circleHomeFilter pure-model matrix.
 *
 * Covers the exactness predicate (debate.circleId === selectedCircle.id — the
 * orchestrator R2 path), the projection-not-rebuild guarantee (same references),
 * the no-filter identity (zero-diff to HOME-001), and the tolerant adapter.
 *
 * NOTE: the participant-subset predicate from the HOME-003 design draft is
 * intentionally NOT implemented (superseded by the exactness path). The filter
 * consumes only the room's stamped circle id (via buildCircleIdIndex) and no
 * member user-ids — a privacy win.
 */
import {
  buildCircleIdIndex,
  filterArgumentHomeByCircle,
  roomMatchesCircle,
  toCircleLens,
} from '../src/features/circles/circleHomeFilter';
import type {
  ConversationGalleryCard,
  YourTurnItem,
} from '../src/features/debates/conversationGalleryModel';
import type { Debate } from '../src/features/debates/types';

// Minimal fixtures — the filter only reads `.debateId` (card) / `.card.debateId`
// (your-turn item), so a narrow cast keeps the matrix focused on the predicate.
function card(debateId: string): ConversationGalleryCard {
  return { debateId } as unknown as ConversationGalleryCard;
}
function item(debateId: string): YourTurnItem {
  return { card: card(debateId), entryHint: null } as unknown as YourTurnItem;
}
function debate(id: string, circleId: string | null): Pick<Debate, 'id' | 'circleId'> {
  return { id, circleId };
}

describe('roomMatchesCircle', () => {
  it('matches when the room circle id equals the selected id', () => {
    expect(roomMatchesCircle('c1', 'c1')).toBe(true);
  });
  it('excludes a different circle, a null, and an undefined room circle id', () => {
    expect(roomMatchesCircle('c2', 'c1')).toBe(false);
    expect(roomMatchesCircle(null, 'c1')).toBe(false);
    expect(roomMatchesCircle(undefined, 'c1')).toBe(false);
  });
});

describe('buildCircleIdIndex', () => {
  it('maps each debate to its circle id, null for a non-circle room', () => {
    const idx = buildCircleIdIndex([debate('d1', 'c1'), debate('d2', null), debate('d3', 'c2')]);
    expect(idx.get('d1')).toBe('c1');
    expect(idx.get('d2')).toBeNull();
    expect(idx.get('d3')).toBe('c2');
  });
  it('treats a missing circleId as null and skips malformed rows', () => {
    const idx = buildCircleIdIndex([
      { id: 'd1' } as Pick<Debate, 'id' | 'circleId'>,
      null as unknown as Pick<Debate, 'id' | 'circleId'>,
    ]);
    expect(idx.get('d1')).toBeNull();
    expect(idx.size).toBe(1);
  });
  it('returns an empty map for a non-array input', () => {
    expect(buildCircleIdIndex(null as unknown as Debate[]).size).toBe(0);
  });
});

describe('filterArgumentHomeByCircle', () => {
  const yourTurn = [item('d1'), item('d2'), item('d3')];
  const ongoing = [card('d1'), card('d2'), card('d3'), card('d4')];
  // d1 -> c1, d2 -> c1, d3 -> c2, d4 -> non-circle.
  const circleIdByDebateId = buildCircleIdIndex([
    debate('d1', 'c1'),
    debate('d2', 'c1'),
    debate('d3', 'c2'),
    debate('d4', null),
  ]);

  it('with NO circle selected, returns the input references unchanged (zero-diff)', () => {
    const out = filterArgumentHomeByCircle({ yourTurn, ongoing, circleIdByDebateId, selectedCircleId: null });
    expect(out.yourTurn).toBe(yourTurn);
    expect(out.ongoing).toBe(ongoing);
  });

  it('narrows BOTH the your-turn strip and the ongoing cards to the selected circle', () => {
    const out = filterArgumentHomeByCircle({ yourTurn, ongoing, circleIdByDebateId, selectedCircleId: 'c1' });
    expect(out.yourTurn.map((i) => i.card.debateId)).toEqual(['d1', 'd2']);
    expect(out.ongoing.map((c) => c.debateId)).toEqual(['d1', 'd2']);
  });

  it('the AC fixture proves inclusion/exclusion exactly (in / other / non-circle)', () => {
    const c2 = filterArgumentHomeByCircle({ yourTurn, ongoing, circleIdByDebateId, selectedCircleId: 'c2' });
    expect(c2.yourTurn.map((i) => i.card.debateId)).toEqual(['d3']); // in-circle
    expect(c2.ongoing.map((c) => c.debateId)).toEqual(['d3']);
    // d4 (non-circle) and d1/d2 (other circle) are excluded from a c2 lens.
    expect(c2.ongoing.some((c) => c.debateId === 'd4')).toBe(false);
    expect(c2.ongoing.some((c) => c.debateId === 'd1')).toBe(false);
  });

  it('is projection-not-rebuild — surviving items are the SAME references', () => {
    const out = filterArgumentHomeByCircle({ yourTurn, ongoing, circleIdByDebateId, selectedCircleId: 'c1' });
    expect(out.yourTurn[0]).toBe(yourTurn[0]);
    expect(out.ongoing[0]).toBe(ongoing[0]);
  });

  it('is deterministic and never mutates its inputs', () => {
    const a = filterArgumentHomeByCircle({ yourTurn, ongoing, circleIdByDebateId, selectedCircleId: 'c1' });
    const b = filterArgumentHomeByCircle({ yourTurn, ongoing, circleIdByDebateId, selectedCircleId: 'c1' });
    expect(a).toEqual(b);
    expect(yourTurn).toHaveLength(3);
    expect(ongoing).toHaveLength(4);
  });

  it('yields empty lists when the selected circle matches nothing', () => {
    const out = filterArgumentHomeByCircle({ yourTurn, ongoing, circleIdByDebateId, selectedCircleId: 'c-none' });
    expect(out.yourTurn).toEqual([]);
    expect(out.ongoing).toEqual([]);
  });
});

describe('toCircleLens', () => {
  it('maps id + name + a positive member count', () => {
    expect(toCircleLens({ id: 'c1', name: 'Book Club', memberCount: 4 })).toEqual({
      id: 'c1',
      name: 'Book Club',
      memberCount: 4,
    });
  });
  it('coerces a missing / negative / non-finite count to 0', () => {
    expect(toCircleLens({ id: 'c1', name: 'A' }).memberCount).toBe(0);
    expect(toCircleLens({ id: 'c1', name: 'A', memberCount: -3 }).memberCount).toBe(0);
    expect(toCircleLens({ id: 'c1', name: 'A', memberCount: Number.NaN }).memberCount).toBe(0);
  });
});
