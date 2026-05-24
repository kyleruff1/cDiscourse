/**
 * QOL-039 §6.4 — Private rooms route to "My rooms" only.
 *
 * A `visibility === 'private'` card the caller is in must NEVER appear in
 * the public-discovery lanes (`needs_rebuttal`, `jump_in`, `source_trail`,
 * etc.). Because RLS already withholds private rooms from non-participants,
 * the only seam this rule covers is the case where the participant's
 * `hasUserJoined` flag is not yet propagated into `joinedDebateIds`.
 */
import {
  classifyCardToSection,
  groupGalleryCardsBySection,
  type ConversationGalleryCard,
} from '../src/features/debates/conversationGalleryModel';

function makeCard(over: Partial<ConversationGalleryCard>): ConversationGalleryCard {
  return {
    debateId: 'd1',
    canonicalConversationKey: 'k1',
    duplicateCount: 1,
    duplicateDebateIds: ['d1'],
    title: 'T',
    fallbackTitle: 'T',
    starterDisplayName: 'u',
    starterSide: null,
    mySide: null,
    firstPostExcerpt: '',
    latestPostExcerpt: '',
    latestPostAuthor: '',
    createdAt: '',
    updatedAt: '',
    moveCount: 3,
    rebuttalCount: 1,
    participantCount: 1,
    hasNoRebuttal: false,
    hasUserJoined: false,
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

describe('classifyCardToSection — QOL-039 visibility', () => {
  it('a private card the user joined → "my_rooms" (joined-room arm)', () => {
    const card = makeCard({ visibility: 'private', hasUserJoined: true });
    expect(classifyCardToSection(card)).toBe('my_rooms');
  });

  it('a private card with hasUserJoined=false also routes to "my_rooms" (RLS-derived)', () => {
    // A private card the caller can read came back via RLS, which means
    // they MUST be a participant or a mod. The §6.4 rule force-routes it
    // to "my_rooms" so it never appears in public-discovery lanes even if
    // `joinedDebateIds` is stale at load time.
    const card = makeCard({
      visibility: 'private',
      hasUserJoined: false,
      bucket: 'source_chain_fight', // would normally route to 'source_trail'
    });
    expect(classifyCardToSection(card)).toBe('my_rooms');
  });

  it('a public card with hasNoRebuttal routes to needs_rebuttal as usual', () => {
    const card = makeCard({
      visibility: 'public',
      hasUserJoined: false,
      hasNoRebuttal: true,
    });
    expect(classifyCardToSection(card)).toBe('needs_rebuttal');
  });

  it('a private card with hasNoRebuttal still routes to my_rooms (visibility wins)', () => {
    const card = makeCard({
      visibility: 'private',
      hasUserJoined: false,
      hasNoRebuttal: true,
    });
    expect(classifyCardToSection(card)).toBe('my_rooms');
  });

  it('a private card with source_chain_fight bucket still routes to my_rooms', () => {
    const card = makeCard({
      visibility: 'private',
      hasUserJoined: false,
      bucket: 'source_chain_fight',
    });
    expect(classifyCardToSection(card)).toBe('my_rooms');
  });

  it('a private card with evidence_fight bucket still routes to my_rooms', () => {
    const card = makeCard({
      visibility: 'private',
      hasUserJoined: false,
      bucket: 'evidence_fight',
    });
    expect(classifyCardToSection(card)).toBe('my_rooms');
  });

  it('a private card with overheated heat still routes to my_rooms', () => {
    const card = makeCard({
      visibility: 'private',
      hasUserJoined: false,
      heatLevel: 'overheated',
    });
    expect(classifyCardToSection(card)).toBe('my_rooms');
  });
});

describe('groupGalleryCardsBySection — QOL-039 visibility groups', () => {
  it('a mixed list partitions private cards into my_rooms only', () => {
    const cards = [
      makeCard({ debateId: 'a', visibility: 'private', hasUserJoined: false, bucket: 'source_chain_fight' }),
      makeCard({ debateId: 'b', visibility: 'public', hasNoRebuttal: true }),
      makeCard({ debateId: 'c', visibility: 'public', bucket: 'source_chain_fight' }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    const byId = new Map(groups.map((g) => [g.id, g.cards.map((c) => c.debateId)]));
    expect(byId.get('my_rooms')).toEqual(['a']);
    expect(byId.get('needs_rebuttal')).toEqual(['b']);
    expect(byId.get('source_trail')).toEqual(['c']);
  });

  it('a private card never appears in needs_rebuttal even when hasNoRebuttal=true', () => {
    const cards = [
      makeCard({ debateId: 'priv', visibility: 'private', hasNoRebuttal: true }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    const needs = groups.find((g) => g.id === 'needs_rebuttal');
    expect(needs).toBeUndefined();
    const my = groups.find((g) => g.id === 'my_rooms');
    expect(my?.cards.map((c) => c.debateId)).toEqual(['priv']);
  });

  it('no card appears in more than one group', () => {
    const cards = [
      makeCard({ debateId: 'p1', visibility: 'private', hasNoRebuttal: true, bucket: 'source_chain_fight' }),
      makeCard({ debateId: 'p2', visibility: 'private', bucket: 'evidence_fight' }),
      makeCard({ debateId: 'pub1', visibility: 'public', hasNoRebuttal: true }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    const seen = new Set<string>();
    for (const g of groups) {
      for (const c of g.cards) {
        expect(seen.has(c.debateId)).toBe(false);
        seen.add(c.debateId);
      }
    }
    expect(seen.size).toBe(3);
  });
});
