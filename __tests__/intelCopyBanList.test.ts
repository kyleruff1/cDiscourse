/**
 * INTEL-002 (#901) — specificity readout copy ban-list (with a firing control).
 *
 * Every readout string over a broad set of KPI states is scanned for verdict /
 * person tokens and internal-code leaks. The copy is a literal count, never a
 * verdict, never a per-person score.
 */
import {
  SPECIFICITY_VISIBILITY_CAVEAT,
  roomSpecificityChipText,
  aggregateSpecificityText,
} from '../src/features/admin/adminSpecificityReadoutCopy';
import {
  deriveRoomSpecificityKpi,
  deriveAggregateSpecificityKpi,
  type SpecificityReplyInput,
} from '../src/features/intel/markerSpecificityModel';

const BANNED = [
  'winner',
  'loser',
  'won',
  'lost',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'propagandist',
  'extremist',
  'troll',
  'bot',
  'stupid',
  'idiot',
  'truth',
  'verdict',
];

function assertClean(text: string): void {
  const lower = text.toLowerCase();
  for (const token of BANNED) {
    expect(lower.includes(token)).toBe(false);
  }
  // No snake_case internal-code leak.
  expect(/[a-z]_[a-z]/.test(text)).toBe(false);
}

function reply(id: string, parentId: string | null, argumentType = 'rebuttal'): SpecificityReplyInput {
  return { id, parentId, argumentType, status: 'posted', inactiveAt: null };
}

describe('INTEL-002 — readout copy ban-list', () => {
  it('the visibility caveat is ban-list clean', () => {
    assertClean(SPECIFICITY_VISIBILITY_CAVEAT);
  });

  it('the per-room chip text is clean across states (zero / zero-markers / N-of-M)', () => {
    const zero = deriveRoomSpecificityKpi({ debateId: 'd', replies: [reply('root', null, 'claim')], markers: [] });
    const zeroMarkers = deriveRoomSpecificityKpi({ debateId: 'd', replies: [reply('r1', 'root')], markers: [] });
    const someLinked = deriveRoomSpecificityKpi({
      debateId: 'd',
      replies: [reply('r1', 'root'), reply('r2', 'root')],
      markers: [{ replyArgumentId: 'r1', deletedAt: null }],
    });
    for (const kpi of [zero, zeroMarkers, someLinked]) {
      assertClean(roomSpecificityChipText(kpi));
    }
  });

  it('the aggregate text is clean across states', () => {
    const empty = deriveAggregateSpecificityKpi([]);
    const oneRoom = deriveAggregateSpecificityKpi([
      deriveRoomSpecificityKpi({ debateId: 'd', replies: [reply('r1', 'root')], markers: [{ replyArgumentId: 'r1', deletedAt: null }] }),
    ]);
    const multi = deriveAggregateSpecificityKpi([
      deriveRoomSpecificityKpi({ debateId: 'a', replies: [reply('r1', 'root')], markers: [] }),
      deriveRoomSpecificityKpi({ debateId: 'b', replies: [reply('r2', 'root')], markers: [{ replyArgumentId: 'r2', deletedAt: null }] }),
    ]);
    for (const agg of [empty, oneRoom, multi]) {
      assertClean(aggregateSpecificityText(agg));
    }
  });

  it('FIRING NEGATIVE CONTROL — the scanner rejects a verdict string', () => {
    expect(() => assertClean('this side is the winner')).toThrow();
  });
});
