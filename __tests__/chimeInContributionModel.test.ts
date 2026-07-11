/**
 * CHIMEIN-P8 Round 2 (#761) — chimeInContributionModel pure-model tests.
 *
 * Covers the derived seat count, per-point grouping, the mediator contributionKind
 * adapter, retract exclusion, the structural never-a-principal-count invariant,
 * determinism / frozen output, and the GAME-005 cap parity + ban-list.
 */
import {
  deriveChimeInContributionState,
  isChimeInArgument,
  chimeInCountForPoint,
  contributionKindForArgument,
  CHIME_IN_CONTRIBUTION_CAP,
  _forbiddenChimeInContributionTokens,
  type ChimeInContributionRow,
} from '../src/features/debates/chimeInContributionModel';

function row(over: Partial<ChimeInContributionRow>): ChimeInContributionRow {
  return {
    id: over.id ?? 'c-1',
    debateId: over.debateId ?? 'debate-1',
    argumentId: over.argumentId ?? 'arg-1',
    targetArgumentId: over.targetArgumentId ?? 'point-1',
    authorId: over.authorId ?? 'user-1',
    seatIndex: over.seatIndex ?? 1,
    retractedAt: over.retractedAt ?? null,
  };
}

describe('CHIMEIN-P8 — cap parity', () => {
  it('CHIME_IN_CONTRIBUTION_CAP is 3 (GAME-005 PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT)', () => {
    expect(CHIME_IN_CONTRIBUTION_CAP).toBe(3);
  });
});

describe('CHIMEIN-P8 — seat count derivation', () => {
  it('an empty room has all 3 seats free', () => {
    const s = deriveChimeInContributionState([]);
    expect(s.activeCount).toBe(0);
    expect(s.openChimeInSeatCount).toBe(3);
    expect(s.isFull).toBe(false);
  });

  it('one active chime leaves 2 free', () => {
    const s = deriveChimeInContributionState([row({ argumentId: 'a', seatIndex: 1 })]);
    expect(s.activeCount).toBe(1);
    expect(s.openChimeInSeatCount).toBe(2);
    expect(s.isFull).toBe(false);
  });

  it('three active chimes fill the room', () => {
    const s = deriveChimeInContributionState([
      row({ argumentId: 'a', seatIndex: 1 }),
      row({ argumentId: 'b', seatIndex: 2 }),
      row({ argumentId: 'c', seatIndex: 3 }),
    ]);
    expect(s.activeCount).toBe(3);
    expect(s.openChimeInSeatCount).toBe(0);
    expect(s.isFull).toBe(true);
  });

  it('never lets the open count go negative even with over-cap or out-of-range rows', () => {
    const s = deriveChimeInContributionState([
      row({ argumentId: 'a', seatIndex: 1 }),
      row({ argumentId: 'b', seatIndex: 2 }),
      row({ argumentId: 'c', seatIndex: 3 }),
      row({ argumentId: 'd', seatIndex: 9 }), // out of range -> ignored
      row({ argumentId: 'e', seatIndex: 0 }), // out of range -> ignored
    ]);
    expect(s.activeCount).toBe(3);
    expect(s.openChimeInSeatCount).toBe(0);
  });
});

describe('CHIMEIN-P8 — retracted rows are excluded', () => {
  it('a retracted chime frees its seat and disappears from every projection', () => {
    const s = deriveChimeInContributionState([
      row({ argumentId: 'a', seatIndex: 1, retractedAt: null }),
      row({ argumentId: 'b', seatIndex: 2, retractedAt: '2026-07-11T00:00:00.000Z' }),
    ]);
    expect(s.activeCount).toBe(1);
    expect(s.openChimeInSeatCount).toBe(2);
    expect(isChimeInArgument(s, 'a')).toBe(true);
    expect(isChimeInArgument(s, 'b')).toBe(false);
  });
});

describe('CHIMEIN-P8 — per-point grouping + contributionKind adapter', () => {
  it('groups active chime argument ids by the point they attach to, in seat order', () => {
    const s = deriveChimeInContributionState([
      row({ argumentId: 'a2', targetArgumentId: 'P', seatIndex: 2 }),
      row({ argumentId: 'a1', targetArgumentId: 'P', seatIndex: 1 }),
      row({ argumentId: 'b1', targetArgumentId: 'Q', seatIndex: 3 }),
    ]);
    expect(s.chimeArgumentIdsByPointId.P).toEqual(['a1', 'a2']); // seat order
    expect(s.chimeArgumentIdsByPointId.Q).toEqual(['b1']);
    expect(chimeInCountForPoint(s, 'P')).toBe(2);
    expect(chimeInCountForPoint(s, 'Q')).toBe(1);
    expect(chimeInCountForPoint(s, 'unknown')).toBe(0);
  });

  it('maps only active chime arguments to contributionKind chime_in (absent otherwise)', () => {
    const s = deriveChimeInContributionState([row({ argumentId: 'a', seatIndex: 1 })]);
    expect(contributionKindForArgument(s, 'a')).toBe('chime_in');
    expect(contributionKindForArgument(s, 'principal-arg')).toBeUndefined();
    // The adapter never emits 'principal' — a principal is simply absent.
    expect(Object.values(s.contributionKindByArgumentId).every((v) => v === 'chime_in')).toBe(true);
  });
});

describe('CHIMEIN-P8 — the never-a-principal-count invariant (structural)', () => {
  it('the state object carries NO principal / score / standing / node-state field', () => {
    const s = deriveChimeInContributionState([row({ argumentId: 'a' })]);
    const keys = Object.keys(s);
    expect(keys).toEqual([
      'activeCount',
      'openChimeInSeatCount',
      'isFull',
      'chimeArgumentIdsByPointId',
      'contributionKindByArgumentId',
    ]);
    // No matter how many chimes attach, there is no field a chime could use to
    // move a principal count — it does not exist in the shape.
    for (const banned of ['principalVoiceCount', 'principalCount', 'score', 'standing', 'nodeState']) {
      expect(keys).not.toContain(banned);
    }
  });
});

describe('CHIMEIN-P8 — determinism + frozen + degradation', () => {
  it('is deterministic and deeply frozen', () => {
    const input = [row({ argumentId: 'a', seatIndex: 1 }), row({ argumentId: 'b', seatIndex: 2 })];
    const a = deriveChimeInContributionState(input);
    const b = deriveChimeInContributionState(input);
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.chimeArgumentIdsByPointId)).toBe(true);
    expect(Object.isFrozen(a.contributionKindByArgumentId)).toBe(true);
  });

  it('degrades to the empty-room state on null / undefined / malformed input', () => {
    for (const bad of [null, undefined, 'nope' as unknown]) {
      const s = deriveChimeInContributionState(bad as never);
      expect(s.activeCount).toBe(0);
      expect(s.openChimeInSeatCount).toBe(3);
      expect(s.isFull).toBe(false);
    }
  });

  it('collapses duplicate active rows for the same argument (DB UNIQUE backstop)', () => {
    const s = deriveChimeInContributionState([
      row({ id: 'c1', argumentId: 'dup', seatIndex: 1 }),
      row({ id: 'c2', argumentId: 'dup', seatIndex: 2 }),
    ]);
    expect(s.activeCount).toBe(1);
  });
});

describe('CHIMEIN-P8 — doctrine ban-list', () => {
  it('the forbidden-token list carries the verdict / amplification / third-voice tokens', () => {
    const tokens = _forbiddenChimeInContributionTokens();
    expect(tokens).toEqual(expect.arrayContaining(['winner', 'loser', 'viral', 'third voice']));
  });
});
