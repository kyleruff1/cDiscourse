/**
 * INTEL-002 (#901) — the specificity KPI matrix.
 *
 * marker-linked replies / total reply moves, per-room + POOLED aggregate; null on
 * a zero denominator; secondary rebuttal-typed rate; pooled aggregate is NOT the
 * mean of per-room rates. No per-person axis.
 */
import {
  deriveRoomSpecificityKpi,
  deriveAggregateSpecificityKpi,
  type SpecificityMarkerInput,
  type SpecificityReplyInput,
} from '../src/features/intel/markerSpecificityModel';

function reply(
  id: string,
  parentId: string | null,
  argumentType: string | null = 'rebuttal',
  status: string | null = 'posted',
  inactiveAt: string | null = null,
): SpecificityReplyInput {
  return { id, parentId, argumentType, status, inactiveAt };
}
function marker(replyArgumentId: string | null, deletedAt: string | null = null): SpecificityMarkerInput {
  return { replyArgumentId, deletedAt };
}

describe('INTEL-002 — deriveRoomSpecificityKpi', () => {
  it('zero replies (root-only room) => rate null ("No replies yet")', () => {
    const out = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('root', null, 'claim')],
      markers: [],
    });
    expect(out.totalReplies).toBe(0);
    expect(out.rate).toBeNull();
  });

  it('replies but zero markers => rate 0 (not null)', () => {
    const out = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('r1', 'root'), reply('r2', 'root')],
      markers: [],
    });
    expect(out.totalReplies).toBe(2);
    expect(out.markerLinkedReplies).toBe(0);
    expect(out.rate).toBe(0);
  });

  it('N of M replies pinned => rate N/M', () => {
    const out = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('r1', 'root'), reply('r2', 'root'), reply('r3', 'root'), reply('r4', 'root')],
      markers: [marker('r1'), marker('r2')],
    });
    expect(out.markerLinkedReplies).toBe(2);
    expect(out.totalReplies).toBe(4);
    expect(out.rate).toBe(0.5);
  });

  it('two markers on one reply => the reply is counted once (deduped)', () => {
    const out = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('r1', 'root'), reply('r2', 'root')],
      markers: [marker('r1'), marker('r1')],
    });
    expect(out.markerLinkedReplies).toBe(1);
  });

  it('a standalone marker (null reply) is excluded from the numerator', () => {
    const out = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('r1', 'root')],
      markers: [marker(null), marker('r1')],
    });
    expect(out.markerLinkedReplies).toBe(1);
  });

  it('a deleted/inactive reply is excluded from the denominator (and its marker not counted)', () => {
    const out = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [
        reply('r1', 'root'),
        reply('r2', 'root', 'rebuttal', 'deleted'),
        reply('r3', 'root', 'rebuttal', 'posted', '2026-07-01T00:00:00.000Z'),
      ],
      markers: [marker('r1'), marker('r2'), marker('r3')],
    });
    // Only r1 is an active reply; r2 (deleted) + r3 (inactive) excluded.
    expect(out.totalReplies).toBe(1);
    expect(out.markerLinkedReplies).toBe(1);
    expect(out.rate).toBe(1);
  });

  it('the root move is excluded from the denominator', () => {
    const out = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('root', null, 'claim'), reply('r1', 'root')],
      markers: [marker('r1')],
    });
    expect(out.totalReplies).toBe(1);
  });

  it('secondary rebuttal-typed rate restricts to argumentType rebuttal', () => {
    const out = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [
        reply('r1', 'root', 'rebuttal'),
        reply('r2', 'root', 'clarification'),
        reply('r3', 'root', 'rebuttal'),
      ],
      markers: [marker('r1'), marker('r2')],
    });
    // Primary: 2 of 3 linked.
    expect(out.rate).toBeCloseTo(2 / 3);
    // Rebuttal-typed: r1, r3 are rebuttals; r1 linked => 1/2.
    expect(out.totalRebuttals).toBe(2);
    expect(out.markerLinkedRebuttals).toBe(1);
    expect(out.rebuttalRate).toBe(0.5);
  });

  it('is deterministic (shuffled input => deep-equal)', () => {
    const replies = [reply('r1', 'root'), reply('r2', 'root'), reply('r3', 'root')];
    const markers = [marker('r1'), marker('r3')];
    const a = deriveRoomSpecificityKpi({ debateId: 'd', replies, markers });
    const b = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [...replies].reverse(),
      markers: [...markers].reverse(),
    });
    expect(a).toEqual(b);
  });
});

describe('INTEL-002 — deriveAggregateSpecificityKpi', () => {
  it('POOLED (sum/sum), NOT the mean of per-room rates', () => {
    const roomA = deriveRoomSpecificityKpi({
      debateId: 'A',
      replies: [reply('a1', 'root')],
      markers: [marker('a1')],
    }); // 1/1
    const roomB = deriveRoomSpecificityKpi({
      debateId: 'B',
      replies: Array.from({ length: 100 }, (_, i) => reply(`b${i}`, 'root')),
      markers: [],
    }); // 0/100
    const agg = deriveAggregateSpecificityKpi([roomA, roomB]);
    // Pooled = 1 / 101, NOT the mean of rates (which would be 0.5).
    expect(agg.rate).toBeCloseTo(1 / 101);
    expect(agg.rate).not.toBeCloseTo(0.5);
    expect(agg.totalReplies).toBe(101);
    expect(agg.markerLinkedReplies).toBe(1);
    expect(agg.roomCount).toBe(2);
  });

  it('aggregate over zero rooms => roomCount 0, rate null', () => {
    const agg = deriveAggregateSpecificityKpi([]);
    expect(agg.roomCount).toBe(0);
    expect(agg.rate).toBeNull();
  });

  it('aggregate where every room has rate null => pooled null', () => {
    const rootOnlyA = deriveRoomSpecificityKpi({ debateId: 'A', replies: [reply('root', null, 'claim')], markers: [] });
    const rootOnlyB = deriveRoomSpecificityKpi({ debateId: 'B', replies: [], markers: [] });
    const agg = deriveAggregateSpecificityKpi([rootOnlyA, rootOnlyB]);
    expect(agg.rate).toBeNull();
  });
});

describe('INTEL-002 — no per-person axis in the input shape', () => {
  it('SpecificityReplyInput / SpecificityMarkerInput expose no author field', () => {
    const r = reply('r1', 'root');
    const m = marker('r1');
    expect(Object.keys(r)).not.toContain('authorId');
    expect(Object.keys(r)).not.toContain('createdBy');
    expect(Object.keys(m)).not.toContain('createdBy');
  });
});
