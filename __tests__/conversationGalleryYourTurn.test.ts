/**
 * HOME-001 (#874) — your-turn projection pure-model matrix (Slice 1).
 *
 * Covers the additive your-turn primitives on the gallery model:
 *   - LATEST_AUTHOR_LABEL (hoisted constant; byte-identical emitted output)
 *   - isWaitingOnViewer (the "waiting on me" predicate)
 *   - YOUR_TURN_HINT_RANK (deterministic actionability rank)
 *   - deriveYourTurn (filter + fixture exclusion + deterministic ranking)
 *
 * Pure TS: no React, no Supabase, no network. The ranking reads only
 * structural turn-state / recency / unread signals — never heat / popularity
 * (doctrine cdiscourse-doctrine §2/§3).
 */
import {
  buildConversationGalleryCards,
  deriveGalleryEntryHint,
  isWaitingOnViewer,
  deriveYourTurn,
  YOUR_TURN_HINT_RANK,
  LATEST_AUTHOR_LABEL,
  ALL_GALLERY_ENTRY_HINT_CODES,
  type ConversationGalleryCard,
  type GalleryArgumentInput,
} from '../src/features/debates/conversationGalleryModel';
import type { Debate } from '../src/features/debates/types';

// ── Fixtures ────────────────────────────────────────────────────

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

function debate(partial: Partial<Debate> & { id: string }): Debate {
  const base = 1715000000000;
  return {
    id: partial.id,
    createdBy: partial.createdBy ?? 'user-creator',
    title: partial.title ?? 'A debate title',
    resolution: partial.resolution ?? 'A debate resolution.',
    description: partial.description ?? '',
    status: partial.status ?? 'open',
    constitutionId: partial.constitutionId ?? 'c1',
    createdAt: partial.createdAt ?? isoAt(base),
    updatedAt: partial.updatedAt ?? isoAt(base),
    myParticipantSide: partial.myParticipantSide ?? null,
    visibility: partial.visibility ?? 'public',
    inactiveAt: partial.inactiveAt ?? null,
  };
}

function arg(
  partial: Partial<GalleryArgumentInput> & { id: string; debateId: string },
): GalleryArgumentInput {
  return {
    id: partial.id,
    debateId: partial.debateId,
    parentId: partial.parentId ?? null,
    authorId: partial.authorId === undefined ? 'author-a' : partial.authorId,
    argumentType: partial.argumentType ?? 'thesis',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A reasonably long argument body for the room.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(1715000000000),
    updatedAt: partial.updatedAt ?? null,
  };
}

/** A complete gallery card with sane defaults; overrides win. */
function baseCard(over: Partial<ConversationGalleryCard> = {}): ConversationGalleryCard {
  return {
    debateId: 'd1',
    canonicalConversationKey: 'k1',
    duplicateCount: 1,
    duplicateDebateIds: ['d1'],
    title: 'T',
    fallbackTitle: 'T',
    starterDisplayName: 'u',
    starterSide: null,
    mySide: 'affirmative',
    firstPostExcerpt: '',
    latestPostExcerpt: '',
    latestPostAuthor: LATEST_AUTHOR_LABEL.other,
    createdAt: '',
    updatedAt: '',
    moveCount: 4,
    rebuttalCount: 1,
    participantCount: 2,
    hasNoRebuttal: false,
    hasUserJoined: true,
    openStatus: 'open',
    visibility: 'public',
    bucket: 'all_open',
    heatLevel: 'cold',
    temperament: 'plain',
    issueFrame: 'unknown',
    dominantAxis: 'none',
    sourceChainRisk: 'unknown',
    evidentiaryRisk: 'unknown',
    amplificationRisk: 'none_observed',
    platformSupportWarning: false,
    evidenceDebtSummary: {
      debateId: 'd1',
      totalCount: 0,
      openCount: 0,
      staleCount: 0,
      settledCount: 0,
      hasOpenEvidenceDebt: false,
      statusLine: '',
    },
    unresolvedReason: null,
    stopReason: null,
    timelinePreviewSegments: [],
    signals: [],
    searchText: '',
    voteScorePreview: null,
    winnerPreview: null,
    promotedArgumentCount: 0,
    sortKeys: {
      latestActivityMs: 0,
      createdAtMs: 0,
      heatScore: 0,
      needsRebuttalFlag: 0,
      moveCount: 0,
      oldestUnresolvedMs: Number.POSITIVE_INFINITY,
    },
    ...over,
  };
}

// ── LATEST_AUTHOR_LABEL ─────────────────────────────────────────

describe('HOME-001 — LATEST_AUTHOR_LABEL', () => {
  it('carries the exact three display literals unchanged', () => {
    expect(LATEST_AUTHOR_LABEL.you).toBe('You');
    expect(LATEST_AUTHOR_LABEL.other).toBe('Other voice');
    expect(LATEST_AUTHOR_LABEL.unknown).toBe('Unknown');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(LATEST_AUTHOR_LABEL)).toBe(true);
  });

  it('the card builder emits byte-identical latestPostAuthor strings after the hoist', () => {
    const debates = [
      debate({ id: 'd-you' }),
      debate({ id: 'd-other' }),
      debate({ id: 'd-unknown' }),
    ];
    const argumentsByDebateId: Record<string, GalleryArgumentInput[]> = {
      'd-you': [arg({ id: 'a1', debateId: 'd-you', authorId: 'me', createdAt: isoAt(1) })],
      'd-other': [
        arg({ id: 'b1', debateId: 'd-other', authorId: 'me', createdAt: isoAt(1) }),
        arg({
          id: 'b2',
          debateId: 'd-other',
          authorId: 'someone-else',
          parentId: 'b1',
          argumentType: 'rebuttal',
          createdAt: isoAt(2),
        }),
      ],
      'd-unknown': [arg({ id: 'c1', debateId: 'd-unknown', authorId: null, createdAt: isoAt(1) })],
    };
    const cards = buildConversationGalleryCards({
      debates,
      argumentsByDebateId,
      currentUserId: 'me',
    });
    const byId = Object.fromEntries(cards.map((c) => [c.debateId, c]));
    expect(byId['d-you'].latestPostAuthor).toBe('You');
    expect(byId['d-you'].latestPostAuthor).toBe(LATEST_AUTHOR_LABEL.you);
    expect(byId['d-other'].latestPostAuthor).toBe('Other voice');
    expect(byId['d-other'].latestPostAuthor).toBe(LATEST_AUTHOR_LABEL.other);
    expect(byId['d-unknown'].latestPostAuthor).toBe('Unknown');
    expect(byId['d-unknown'].latestPostAuthor).toBe(LATEST_AUTHOR_LABEL.unknown);
  });
});

// ── isWaitingOnViewer ───────────────────────────────────────────

describe('HOME-001 — isWaitingOnViewer', () => {
  it('true for a joined, open, non-empty room whose latest move is a known other voice', () => {
    expect(
      isWaitingOnViewer(
        baseCard({
          hasUserJoined: true,
          openStatus: 'open',
          moveCount: 3,
          latestPostAuthor: LATEST_AUTHOR_LABEL.other,
        }),
      ),
    ).toBe(true);
  });

  it('false when the viewer authored the latest move (You)', () => {
    expect(isWaitingOnViewer(baseCard({ latestPostAuthor: LATEST_AUTHOR_LABEL.you }))).toBe(false);
  });

  it('false when the latest author is unattributable (Unknown)', () => {
    expect(isWaitingOnViewer(baseCard({ latestPostAuthor: LATEST_AUTHOR_LABEL.unknown }))).toBe(
      false,
    );
  });

  it('false for an observer-only room (not joined)', () => {
    expect(isWaitingOnViewer(baseCard({ hasUserJoined: false }))).toBe(false);
  });

  it('false when the room is not open (locked / archived / draft)', () => {
    for (const openStatus of ['locked', 'archived', 'draft'] as const) {
      expect(isWaitingOnViewer(baseCard({ openStatus }))).toBe(false);
    }
  });

  it('false when there are zero moves', () => {
    expect(isWaitingOnViewer(baseCard({ moveCount: 0 }))).toBe(false);
  });
});

// ── YOUR_TURN_HINT_RANK ─────────────────────────────────────────

describe('HOME-001 — YOUR_TURN_HINT_RANK', () => {
  it('assigns a numeric rank to every gallery entry-hint code', () => {
    for (const code of ALL_GALLERY_ENTRY_HINT_CODES) {
      expect(typeof YOUR_TURN_HINT_RANK[code]).toBe('number');
    }
  });

  it('ranks be_first_rebuttal most actionable and watch_first least', () => {
    const min = Math.min(...Object.values(YOUR_TURN_HINT_RANK));
    const max = Math.max(...Object.values(YOUR_TURN_HINT_RANK));
    expect(YOUR_TURN_HINT_RANK.be_first_rebuttal).toBe(min);
    expect(YOUR_TURN_HINT_RANK.watch_first).toBe(max);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(YOUR_TURN_HINT_RANK)).toBe(true);
  });
});

// ── deriveYourTurn ──────────────────────────────────────────────

describe('HOME-001 — deriveYourTurn', () => {
  // Cards engineered to produce distinct, known entry-hint codes.
  // A: be_first_rebuttal (rank 0) via hasNoRebuttal.
  // B: challenge_mechanism (rank 1) via lifecycle 'sourced'.
  // C/D/E: narrow (rank 3) via lifecycle 'rebutted'.
  const waiting = (over: Partial<ConversationGalleryCard>): ConversationGalleryCard =>
    baseCard({
      hasUserJoined: true,
      openStatus: 'open',
      moveCount: 4,
      latestPostAuthor: LATEST_AUTHOR_LABEL.other,
      ...over,
    });

  const cardA = waiting({
    debateId: 'd-a',
    hasNoRebuttal: true,
    moveCount: 1,
    sortKeys: { ...baseCard().sortKeys, latestActivityMs: 100 },
  });
  const cardB = waiting({
    debateId: 'd-b',
    rootClusterLifecycleState: 'sourced',
    sortKeys: { ...baseCard().sortKeys, latestActivityMs: 200 },
  });
  const cardC = waiting({
    debateId: 'd-c',
    rootClusterLifecycleState: 'rebutted',
    sortKeys: { ...baseCard().sortKeys, latestActivityMs: 50 },
  });
  const cardD = waiting({
    debateId: 'd-d',
    rootClusterLifecycleState: 'rebutted',
    sortKeys: { ...baseCard().sortKeys, latestActivityMs: 300 },
  });
  const cardE = waiting({
    debateId: 'd-e',
    rootClusterLifecycleState: 'rebutted',
    sortKeys: { ...baseCard().sortKeys, latestActivityMs: 300 },
  });
  const notWaiting = waiting({ debateId: 'd-mine', latestPostAuthor: LATEST_AUTHOR_LABEL.you });

  it('sanity: the fixture cards produce the intended entry-hint codes', () => {
    expect(deriveGalleryEntryHint(cardA).code).toBe('be_first_rebuttal');
    expect(deriveGalleryEntryHint(cardB).code).toBe('challenge_mechanism');
    expect(deriveGalleryEntryHint(cardC).code).toBe('narrow');
  });

  it('filters out cards where the viewer authored the latest move', () => {
    const items = deriveYourTurn([cardA, notWaiting]);
    expect(items.map((i) => i.card.debateId)).toEqual(['d-a']);
  });

  it('ranks hint-verb, then unread, then recency, then debateId (deterministic)', () => {
    const items = deriveYourTurn([cardE, cardC, cardA, cardD, cardB], {
      unreadDebateIds: new Set(['d-c']),
    });
    // A(rank0), B(rank1), then rank3 group: C(unread) before D/E(recency tie
    // broken by debateId asc).
    expect(items.map((i) => i.card.debateId)).toEqual(['d-a', 'd-b', 'd-c', 'd-d', 'd-e']);
  });

  it('unread precedes recency within the same hint rank', () => {
    // C is unread with the OLDEST activity; D is read with newer activity.
    const items = deriveYourTurn([cardD, cardC], { unreadDebateIds: new Set(['d-c']) });
    expect(items.map((i) => i.card.debateId)).toEqual(['d-c', 'd-d']);
    expect(items[0].hasUnread).toBe(true);
    expect(items[1].hasUnread).toBe(false);
  });

  it('is order-independent (same set, shuffled input, identical output)', () => {
    const a = deriveYourTurn([cardA, cardB, cardC, cardD, cardE]);
    const b = deriveYourTurn([cardE, cardD, cardC, cardB, cardA]);
    expect(a.map((i) => i.card.debateId)).toEqual(b.map((i) => i.card.debateId));
  });

  it('is a pure projection: calling twice yields deeply-equal output and no mutation', () => {
    const input = [cardE, cardC, cardA, cardD, cardB];
    const snapshot = input.map((c) => c.debateId);
    expect(deriveYourTurn(input)).toEqual(deriveYourTurn(input));
    expect(input.map((c) => c.debateId)).toEqual(snapshot); // input array untouched
  });

  it('attaches the pre-activation entry hint to each item (J2 resume wiring)', () => {
    const items = deriveYourTurn([cardA]);
    expect(items[0].entryHint).toEqual(deriveGalleryEntryHint(cardA));
  });

  describe('fixture exclusion', () => {
    const fixtureCard = waiting({ debateId: 'd-fixture', hasNoRebuttal: true, moveCount: 1 });
    const realCard = cardA;
    const fixtureDebateIds = new Set(['d-fixture']);

    it('excludes fixture rooms for a non-admin viewer', () => {
      const items = deriveYourTurn([fixtureCard, realCard], { fixtureDebateIds });
      expect(items.map((i) => i.card.debateId)).toEqual(['d-a']);
    });

    it('keeps fixture rooms for an admin viewer', () => {
      const items = deriveYourTurn([fixtureCard, realCard], {
        fixtureDebateIds,
        isAdminViewer: true,
      });
      expect(items.map((i) => i.card.debateId).sort()).toEqual(['d-a', 'd-fixture']);
    });

    it('applies no exclusion when no fixture set is supplied', () => {
      const items = deriveYourTurn([fixtureCard, realCard]);
      expect(items).toHaveLength(2);
    });
  });
});
