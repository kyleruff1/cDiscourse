/**
 * INTEL-001 (#900) — computeConversationHeat dodge-chain term byte-identity.
 *
 * dodgeChainHits absent/0 => identical score to today; present => a small
 * monotonic increase capped at 6. The gallery deriver folds the term ONLY when
 * unaddressedMoveIdsByDebateId is supplied (the gated move_marks fetch).
 */
import {
  computeConversationHeat,
  buildConversationGalleryCards,
  type BuildGalleryInput,
} from '../src/features/debates/conversationGalleryModel';

const HEAT_BASE = {
  moveCount: 6,
  rebuttalCount: 3,
  participantCount: 2,
  latestActivityAgeMs: 30 * 60 * 1000,
  sourceChainHits: 1,
  evidenceHits: 1,
  challengeRunLength: 2,
  hostileToneHits: 0,
  platformSupportWarning: false,
};

describe('INTEL-001 — computeConversationHeat dodge term', () => {
  it('absent dodgeChainHits => identical score to explicit 0', () => {
    const absent = computeConversationHeat(HEAT_BASE);
    const zero = computeConversationHeat({ ...HEAT_BASE, dodgeChainHits: 0 });
    expect(zero.score).toBe(absent.score);
  });

  it('present dodgeChainHits monotonically increases the score', () => {
    const base = computeConversationHeat(HEAT_BASE).score;
    const withDodge = computeConversationHeat({ ...HEAT_BASE, dodgeChainHits: 3 }).score;
    expect(withDodge).toBeGreaterThan(base);
  });

  it('the dodge term is capped at 6 hits', () => {
    const six = computeConversationHeat({ ...HEAT_BASE, dodgeChainHits: 6 }).score;
    const twenty = computeConversationHeat({ ...HEAT_BASE, dodgeChainHits: 20 }).score;
    expect(twenty).toBe(six);
  });
});

describe('INTEL-001 — gallery deriver folds the term only when marks are supplied', () => {
  const debate = {
    id: 'debate-1',
    title: 'Bike lanes',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:10:00.000Z',
  } as unknown as BuildGalleryInput['debates'][number];

  const argumentsByDebateId = {
    'debate-1': [
      { id: 'a', debateId: 'debate-1', parentId: null, authorId: 'u1', argumentType: 'claim', side: 'affirmative', body: 'root', status: 'posted', createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', attachedEvidence: null },
      { id: 'b', debateId: 'debate-1', parentId: 'a', authorId: 'u2', argumentType: 'rebuttal', side: 'negative', body: 'reply', status: 'posted', createdAt: '2026-07-01T00:05:00.000Z', updatedAt: '2026-07-01T00:05:00.000Z', attachedEvidence: null },
      { id: 'c', debateId: 'debate-1', parentId: 'b', authorId: 'u1', argumentType: 'rebuttal', side: 'affirmative', body: 'reply2', status: 'posted', createdAt: '2026-07-01T00:08:00.000Z', updatedAt: '2026-07-01T00:08:00.000Z', attachedEvidence: null },
    ],
  } as unknown as BuildGalleryInput['argumentsByDebateId'];

  const nowMs = new Date('2026-07-01T01:00:00.000Z').getTime();

  it('no marks supplied => heat identical to no dodge input (byte-identical)', () => {
    const withoutMarks = buildConversationGalleryCards({ debates: [debate], argumentsByDebateId, nowMs });
    const withEmptyMarks = buildConversationGalleryCards({
      debates: [debate],
      argumentsByDebateId,
      unaddressedMoveIdsByDebateId: {},
      nowMs,
    });
    expect(withEmptyMarks[0].sortKeys.heatScore).toBe(withoutMarks[0].sortKeys.heatScore);
  });

  it('FIRING CONTROL — supplied marks (2 on a thread) raise the heat', () => {
    const base = buildConversationGalleryCards({ debates: [debate], argumentsByDebateId, nowMs });
    const withDodge = buildConversationGalleryCards({
      debates: [debate],
      argumentsByDebateId,
      unaddressedMoveIdsByDebateId: { 'debate-1': ['b', 'c'] },
      nowMs,
    });
    expect(withDodge[0].sortKeys.heatScore).toBeGreaterThan(base[0].sortKeys.heatScore);
  });
});
