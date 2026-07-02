/**
 * PRIVATE-GROUPS-002 (#859) — pure-TS circleModel tests.
 *
 * Every public function has a happy-path + failure/empty test
 * (test-discipline). A ban-list assertion scans every rendered string the
 * model can emit (the band tokens) for verdict / person / amplification
 * tokens (cdiscourse-doctrine §1-§3).
 */
import {
  liveMemberCount,
  memberCountBand,
  isMinimalCircle,
  ownerCount,
  deriveCircleDisplaySummary,
  type CircleMemberSummary,
  type CircleMemberBand,
} from '../src/features/circles/circleModel';

const owner: CircleMemberSummary = { userId: 'u-owner', role: 'owner' };
const m = (id: string): CircleMemberSummary => ({ userId: id, role: 'member' });

describe('liveMemberCount', () => {
  it('counts the live-member summaries', () => {
    expect(liveMemberCount([owner, m('a'), m('b')])).toBe(3);
  });

  it('returns 0 for an empty list', () => {
    expect(liveMemberCount([])).toBe(0);
  });

  it('returns 0 for null / undefined (defensive, never throws)', () => {
    expect(liveMemberCount(null)).toBe(0);
    expect(liveMemberCount(undefined)).toBe(0);
    // A non-array shape must not throw.
    expect(liveMemberCount({} as unknown as CircleMemberSummary[])).toBe(0);
  });
});

describe('memberCountBand', () => {
  it('maps 0 -> empty', () => {
    expect(memberCountBand(0)).toBe('empty');
  });

  it('maps 1 -> solo (owner alone, pre-first-accept)', () => {
    expect(memberCountBand(1)).toBe('solo');
  });

  it('maps 2 -> pair (the minimal circle)', () => {
    expect(memberCountBand(2)).toBe('pair');
  });

  it('maps 3..6 -> small', () => {
    for (const n of [3, 4, 5, 6]) expect(memberCountBand(n)).toBe('small');
  });

  it('maps 7+ -> large', () => {
    expect(memberCountBand(7)).toBe('large');
    expect(memberCountBand(50)).toBe('large');
  });

  it('treats a negative / non-finite count as empty (defensive)', () => {
    expect(memberCountBand(-3)).toBe('empty');
    expect(memberCountBand(Number.NaN)).toBe('empty');
    // Infinity is not finite -> the defensive guard maps it to 'empty'
    // (never throws, never returns an out-of-set band).
    expect(memberCountBand(Number.POSITIVE_INFINITY)).toBe('empty');
  });
});

describe('isMinimalCircle', () => {
  it('is true for exactly 2 members (the 1:1 pair)', () => {
    expect(isMinimalCircle(2)).toBe(true);
  });

  it('is false for any other count', () => {
    for (const n of [0, 1, 3, 5, 10]) expect(isMinimalCircle(n)).toBe(false);
  });
});

describe('ownerCount', () => {
  it('counts only owner-role members', () => {
    expect(ownerCount([owner, m('a'), m('b')])).toBe(1);
  });

  it('returns 0 when there is no owner (drained circle)', () => {
    expect(ownerCount([m('a'), m('b')])).toBe(0);
  });

  it('returns 0 for null / undefined (defensive)', () => {
    expect(ownerCount(null)).toBe(0);
    expect(ownerCount(undefined)).toBe(0);
  });
});

describe('deriveCircleDisplaySummary', () => {
  it('rolls up a normal small circle', () => {
    const summary = deriveCircleDisplaySummary([owner, m('a'), m('b')]);
    expect(summary).toEqual({
      memberCount: 3,
      band: 'small',
      isMinimalCircle: false,
      ownerCount: 1,
    });
  });

  it('flags the minimal circle (exactly 2 members) as isMinimalCircle', () => {
    const summary = deriveCircleDisplaySummary([owner, m('a')]);
    expect(summary.memberCount).toBe(2);
    expect(summary.band).toBe('pair');
    expect(summary.isMinimalCircle).toBe(true);
  });

  it('returns a well-formed empty summary for null / empty (never throws)', () => {
    const empty = deriveCircleDisplaySummary(null);
    expect(empty).toEqual({
      memberCount: 0,
      band: 'empty',
      isMinimalCircle: false,
      ownerCount: 0,
    });
    expect(deriveCircleDisplaySummary([])).toEqual(empty);
  });
});

describe('circleModel — doctrine ban-list on every rendered band token', () => {
  const BANNED = [
    // verdict
    'winner', 'loser', 'correct', 'incorrect', 'truth', 'true', 'false',
    'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist',
    'propagandist', 'stupid', 'idiot',
    // amplification
    'popular', 'trending', 'viral',
    // person attribution
    'troll', 'challenger', 'opponent',
  ];

  const ALL_BANDS: CircleMemberBand[] = ['empty', 'solo', 'pair', 'small', 'large'];

  it('no band token contains a verdict / amplification / person token', () => {
    for (const band of ALL_BANDS) {
      const lower = band.toLowerCase();
      for (const token of BANNED) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('every count 0..12 produces a band drawn only from the known set', () => {
    for (let n = 0; n <= 12; n++) {
      expect(ALL_BANDS).toContain(memberCountBand(n));
    }
  });
});
