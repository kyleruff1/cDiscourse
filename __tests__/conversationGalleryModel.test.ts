/**
 * Stage 6.3 — Conversation Gallery model tests.
 *
 * Pure-function coverage of dedupe, bucket classification, heat scoring,
 * temperament, signals, search, sort, pagination. No React, no Supabase,
 * no network.
 */
import {
  buildConversationGalleryCards,
  cleanTitleForDedupe,
  deriveCanonicalConversationKey,
  dedupeConversationCards,
  classifyConversationBucket,
  computeConversationHeat,
  computeConversationTemperament,
  getConversationSignals,
  getConversationSearchText,
  sortConversationGalleryCards,
  paginateConversationGalleryCards,
  BUCKET_DEFINITIONS,
  type GalleryArgumentInput,
  type GalleryFlagInput,
  type GalleryTagInput,
  type ConversationGalleryCard,
} from '../src/features/debates/conversationGalleryModel';
import type { Debate } from '../src/features/debates/types';

function isoAt(ms: number): string { return new Date(ms).toISOString(); }

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
  };
}

function arg(partial: Partial<GalleryArgumentInput> & { id: string; debateId: string }): GalleryArgumentInput {
  return {
    id: partial.id,
    debateId: partial.debateId,
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'author-a',
    argumentType: partial.argumentType ?? 'thesis',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A body.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(1715000000000),
    updatedAt: partial.updatedAt ?? null,
    // EV-003 — propagate the optional attached-evidence payload so debt
    // derivation tests can supply a resolving artifact.
    ...(partial.attachedEvidence !== undefined
      ? { attachedEvidence: partial.attachedEvidence }
      : {}),
  };
}

// ──────────────────────────────────────────────────────────────
// Title dedupe + canonical key
// ──────────────────────────────────────────────────────────────

describe('cleanTitleForDedupe', () => {
  it('strips [xai-adv <ids>] suffixes', () => {
    expect(cleanTitleForDedupe('Bike lanes work better than parking [xai-adv 9018694f c45188c5]'))
      .toBe('Bike lanes work better than parking');
  });
  it('strips [ai-corpus …] suffixes', () => {
    expect(cleanTitleForDedupe('Pitch clock changed baseball pacing [ai-corpus fa172432 ai-seed-pitch-clock]'))
      .toBe('Pitch clock changed baseball pacing');
  });
  it('strips [stress-…] suffixes', () => {
    expect(cleanTitleForDedupe('Sports debate [stress-2026-05-17 #scenario-7]'))
      .toBe('Sports debate');
  });
  it('leaves untagged titles alone', () => {
    expect(cleanTitleForDedupe('Universal basic income reduces poverty.'))
      .toBe('Universal basic income reduces poverty.');
  });
  it('handles double-tagged titles in one pass', () => {
    expect(cleanTitleForDedupe('Topic [xai-adv 12345678 abc] [ai-corpus xy]'))
      .toBe('Topic');
  });
});

describe('deriveCanonicalConversationKey', () => {
  it('prefers an explicit hint hash when long enough', () => {
    const k = deriveCanonicalConversationKey({
      debate: debate({ id: 'd1', title: 'Anything' }),
      hintHash: 'abc1234567',
    });
    expect(k).toBe('hash:abc1234567');
  });
  it('uses cleaned title + root body excerpt when no hint', () => {
    const k = deriveCanonicalConversationKey({
      debate: debate({ id: 'd1', title: 'Bike lanes are better curb space [xai-adv 9018694f]' }),
      rootArgumentBody: 'Bike lanes work better than parking in dense urban cores by reclaiming public space.',
    });
    expect(k).toContain('root:bike lanes work better');
    expect(k).toContain('title:bike lanes are better curb space');
  });
  it('falls back to title+resolution when root is short', () => {
    const k = deriveCanonicalConversationKey({
      debate: debate({ id: 'd1', title: 'Short title', resolution: 'A reasonable resolution.' }),
      rootArgumentBody: 'tiny',
    });
    expect(k).toContain('title:short title');
    expect(k).toContain('resolution:a reasonable resolution.');
  });
});

// ──────────────────────────────────────────────────────────────
// buildConversationGalleryCards + duplicate collapse
// ──────────────────────────────────────────────────────────────

describe('buildConversationGalleryCards — dedupe behaviour', () => {
  function repeatedXai(times: number, rootBody: string): { debates: Debate[]; argumentsByDebateId: Record<string, GalleryArgumentInput[]> } {
    const debates: Debate[] = [];
    const argumentsByDebateId: Record<string, GalleryArgumentInput[]> = {};
    for (let i = 0; i < times; i++) {
      const id = `d-xai-${i}`;
      debates.push(debate({
        id,
        title: `Pitch clock changed baseball pacing [xai-adv ${i}abcd 12345678]`,
        createdAt: isoAt(1715000000000 + i * 1000),
        updatedAt: isoAt(1715000000000 + i * 1000),
      }));
      argumentsByDebateId[id] = [arg({ id: `${id}-m1`, debateId: id, body: rootBody, createdAt: isoAt(1715000000000 + i * 1000) })];
    }
    return { debates, argumentsByDebateId };
  }

  it('collapses repeated xAI rooms with the same root body into one card', () => {
    const { debates, argumentsByDebateId } = repeatedXai(5, 'Pitch clock visibly changed baseball pacing — average game duration dropped by 25 minutes.');
    const cards = buildConversationGalleryCards({ debates, argumentsByDebateId });
    expect(cards.length).toBe(5);
    const deduped = dedupeConversationCards(cards);
    expect(deduped.length).toBe(1);
    expect(deduped[0].duplicateCount).toBe(5);
    expect(deduped[0].duplicateDebateIds.length).toBe(5);
  });

  it('does NOT collapse rooms with materially different root bodies', () => {
    const cards = buildConversationGalleryCards({
      debates: [
        debate({ id: 'd1', title: 'Pitch clock helps [xai-adv 1]' }),
        debate({ id: 'd2', title: 'Pitch clock helps [xai-adv 2]' }),
      ],
      argumentsByDebateId: {
        d1: [arg({ id: 'd1-m1', debateId: 'd1', body: 'Pitch clock visibly reduced game length by 25 minutes in 2023.' })],
        d2: [arg({ id: 'd2-m1', debateId: 'd2', body: 'Pitch clock failed because relievers ignored it during high-leverage at-bats in 2023.' })],
      },
    });
    expect(dedupeConversationCards(cards).length).toBe(2);
  });

  it('does NOT over-collapse human-created unique rooms', () => {
    const cards = buildConversationGalleryCards({
      debates: [
        debate({ id: 'h1', title: 'Universal basic income reduces poverty.', resolution: 'UBI reduces long-term poverty.' }),
        debate({ id: 'h2', title: 'Pitch clock changed baseball pacing.', resolution: 'Pitch clock changed baseball pacing.' }),
        debate({ id: 'h3', title: 'Bike lanes work better than parking.', resolution: 'Bike lanes work better than parking.' }),
      ],
      argumentsByDebateId: {
        h1: [arg({ id: 'h1-m1', debateId: 'h1', body: 'UBI lifts people out of poverty by establishing a stable income floor.' })],
        h2: [arg({ id: 'h2-m1', debateId: 'h2', body: 'Pitch clock cut average game time by about 25 minutes.' })],
        h3: [arg({ id: 'h3-m1', debateId: 'h3', body: 'Bike lanes reduce car traffic and reclaim public space.' })],
      },
    });
    expect(dedupeConversationCards(cards).length).toBe(3);
  });

  it('shows duplicate count on the collapsed card', () => {
    const { debates, argumentsByDebateId } = repeatedXai(3, 'A repeated thesis about the same exact topic.');
    const deduped = dedupeConversationCards(buildConversationGalleryCards({ debates, argumentsByDebateId }));
    expect(deduped[0].duplicateCount).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────
// First post + latest move selection
// ──────────────────────────────────────────────────────────────

describe('buildConversationGalleryCards — first/latest excerpts', () => {
  it('chooses chronologically first message as firstPostExcerpt and chronologically last as latestPostExcerpt', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1', title: 'Test' })],
      argumentsByDebateId: {
        d1: [
          arg({ id: 'm2', debateId: 'd1', body: 'Middle reply.', createdAt: isoAt(1715000100000) }),
          arg({ id: 'm1', debateId: 'd1', body: 'Root thesis claim.', createdAt: isoAt(1715000000000), argumentType: 'thesis' }),
          arg({ id: 'm3', debateId: 'd1', body: 'Latest concession.', createdAt: isoAt(1715000200000), argumentType: 'concession' }),
        ],
      },
    });
    expect(cards[0].firstPostExcerpt).toBe('Root thesis claim.');
    expect(cards[0].latestPostExcerpt).toBe('Latest concession.');
  });
});

// ──────────────────────────────────────────────────────────────
// Bucket classification
// ──────────────────────────────────────────────────────────────

describe('classifyConversationBucket', () => {
  function base(over: Partial<Parameters<typeof classifyConversationBucket>[0]> = {}) {
    return classifyConversationBucket({
      hasNoRebuttal: false,
      heatLevel: 'cold',
      challengeRunLength: 0,
      sourceChainHits: 0,
      evidenceHits: 0,
      definitionHits: 0,
      scopeHits: 0,
      platformSupportWarning: false,
      stopReason: null,
      moveCount: 0,
      hasUserJoined: false,
      sourceChainRisk: 'unknown',
      evidentiaryRisk: 'unknown',
      isMaxDepth: false,
      temperament: 'plain',
      ...over,
    });
  }

  it('needs_rebuttal when root exists with no rebuttals', () => {
    expect(base({ hasNoRebuttal: true })).toBe('needs_rebuttal');
  });
  it('source_chain_fight on high source-chain risk', () => {
    expect(base({ sourceChainHits: 1, sourceChainRisk: 'high' })).toBe('source_chain_fight');
  });
  it('source_chain_fight when platformSupportWarning is set', () => {
    expect(base({ sourceChainHits: 1, platformSupportWarning: true })).toBe('source_chain_fight');
  });
  it('evidence_fight on 2+ evidence hits', () => {
    expect(base({ evidenceHits: 3 })).toBe('evidence_fight');
  });
  it('definition_scope_fight on 3+ combined hits', () => {
    expect(base({ definitionHits: 2, scopeHits: 1 })).toBe('definition_scope_fight');
  });
  it('unresolved_deep_chain on max depth without stop reason', () => {
    expect(base({ isMaxDepth: true })).toBe('unresolved_deep_chain');
  });
  it('hot_now on hot heat', () => {
    expect(base({ heatLevel: 'hot', moveCount: 3 })).toBe('hot_now');
  });
  it('gaining_heat on warming heat with at least one challenge', () => {
    expect(base({ heatLevel: 'warming', challengeRunLength: 1 })).toBe('gaining_heat');
  });
  it('pedantic_plain on pedantic temperament', () => {
    expect(base({ temperament: 'pedantic' })).toBe('pedantic_plain');
  });
  it('resolved_or_synthesized on synthesis stop reason', () => {
    expect(base({ stopReason: 'synthesis_ready' })).toBe('resolved_or_synthesized');
  });
  it('my_rooms when user joined and nothing else fires', () => {
    expect(base({ hasUserJoined: true, temperament: 'curious' })).toBe('my_rooms');
  });
});

// ──────────────────────────────────────────────────────────────
// Heat scoring
// ──────────────────────────────────────────────────────────────

describe('computeConversationHeat', () => {
  function h(over: Partial<Parameters<typeof computeConversationHeat>[0]> = {}) {
    return computeConversationHeat({
      moveCount: 0, rebuttalCount: 0, participantCount: 0, latestActivityAgeMs: 7 * 24 * 60 * 60 * 1000,
      sourceChainHits: 0, evidenceHits: 0, challengeRunLength: 0, hostileToneHits: 0,
      platformSupportWarning: false,
      ...over,
    });
  }
  it('cold for old + empty', () => {
    expect(h().level).toBe('cold');
  });
  it('warming for recent + 1 rebuttal + 3 moves', () => {
    expect(h({ latestActivityAgeMs: 30 * 60 * 1000, moveCount: 3, rebuttalCount: 1 }).level).toBe('warming');
  });
  it('hot for recent + high move + challenge run', () => {
    const result = h({ latestActivityAgeMs: 30 * 60 * 1000, moveCount: 12, rebuttalCount: 4, participantCount: 3, challengeRunLength: 3, evidenceHits: 2 });
    expect(['hot', 'overheated'].includes(result.level)).toBe(true);
  });
  it('overheated with hostile tone + platform warning', () => {
    const result = h({ latestActivityAgeMs: 10 * 60 * 1000, moveCount: 20, rebuttalCount: 6, participantCount: 4, challengeRunLength: 5, hostileToneHits: 4, platformSupportWarning: true, sourceChainHits: 3, evidenceHits: 3 });
    expect(result.level).toBe('overheated');
  });
  it('returns score in [0,1]', () => {
    const result = h({ latestActivityAgeMs: 0, moveCount: 100, rebuttalCount: 100, participantCount: 100, hostileToneHits: 100, sourceChainHits: 100, evidenceHits: 100, challengeRunLength: 100, platformSupportWarning: true });
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ──────────────────────────────────────────────────────────────
// Temperament
// ──────────────────────────────────────────────────────────────

describe('computeConversationTemperament', () => {
  function t(over: Partial<Parameters<typeof computeConversationTemperament>[0]> = {}) {
    return computeConversationTemperament({
      moveCount: 0, challengeRunLength: 0, evidenceHits: 0, sourceChainHits: 0,
      definitionHits: 0, scopeHits: 0, hostileToneHits: 0, concessionHits: 0, synthesisHits: 0,
      ...over,
    });
  }
  it('plain when nothing happened', () => { expect(t()).toBe('plain'); });
  it('curious on 3+ moves', () => { expect(t({ moveCount: 4 })).toBe('curious'); });
  it('sharp on challenge run', () => { expect(t({ challengeRunLength: 3 })).toBe('sharp'); });
  it('pedantic on definition/scope heavy with no evidence', () => { expect(t({ definitionHits: 2, scopeHits: 2 })).toBe('pedantic'); });
  it('evidence_heavy on 2+ evidence', () => { expect(t({ evidenceHits: 2 })).toBe('evidence_heavy'); });
  it('source_chain_heavy on 2+ source hits', () => { expect(t({ sourceChainHits: 3, evidenceHits: 1 })).toBe('source_chain_heavy'); });
  it('chaotic on 3+ hostile', () => { expect(t({ hostileToneHits: 4 })).toBe('chaotic'); });
  it('near_resolution on synthesis', () => { expect(t({ synthesisHits: 1 })).toBe('near_resolution'); });
});

// ──────────────────────────────────────────────────────────────
// Signals + search
// ──────────────────────────────────────────────────────────────

describe('signals', () => {
  it('emits no_rebuttal + source_chain warnings', () => {
    const card = {
      sourceChainRisk: 'high' as const,
      evidentiaryRisk: 'unknown' as const,
      amplificationRisk: 'none_observed' as const,
      platformSupportWarning: false,
      hasNoRebuttal: true,
      unresolvedReason: null,
      temperament: 'sharp' as const,
      rebuttalCount: 0,
      evidenceDebtSummary: {
        debateId: 'd1',
        totalCount: 0,
        openCount: 0,
        staleCount: 0,
        settledCount: 0,
        hasOpenEvidenceDebt: false,
        statusLine: '',
      },
    };
    const sigs = getConversationSignals(card);
    expect(sigs.find((s) => s.code === 'no_rebuttal')).toBeTruthy();
    expect(sigs.find((s) => s.code === 'source_chain_high')).toBeTruthy();
  });

  it('emits near_resolution chip on closing-in temperament', () => {
    const sigs = getConversationSignals({
      sourceChainRisk: 'low', evidentiaryRisk: 'unknown', amplificationRisk: 'none_observed',
      platformSupportWarning: false, hasNoRebuttal: false, unresolvedReason: null,
      temperament: 'near_resolution', rebuttalCount: 5,
    } as unknown as Parameters<typeof getConversationSignals>[0]);
    expect(sigs.find((s) => s.code === 'near_resolution')).toBeTruthy();
  });
});

describe('searchText', () => {
  it('matches by title, root excerpt, axis, and bucket', () => {
    const card = {
      title: 'Bike lanes reduce car traffic.',
      fallbackTitle: 'Bike lanes',
      firstPostExcerpt: 'Bike lanes reclaim public space in dense urban cores.',
      latestPostExcerpt: 'Counter: enforcement budgets are not matched.',
      starterDisplayName: 'User · abcd…1234',
      issueFrame: 'civic-policy',
      dominantAxis: 'evidence_challenge',
      temperament: 'evidence_heavy' as const,
      bucket: 'evidence_fight' as const,
    };
    const text = getConversationSearchText(card);
    expect(text.includes('bike lanes')).toBe(true);
    expect(text.includes('evidence_challenge')).toBe(true);
    expect(text.includes('evidence_fight')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Sorting + pagination
// ──────────────────────────────────────────────────────────────

describe('sortConversationGalleryCards', () => {
  function makeCard(over: Partial<ConversationGalleryCard>): ConversationGalleryCard {
    return {
      debateId: over.debateId || 'd?',
      canonicalConversationKey: 'k',
      duplicateCount: 1,
      duplicateDebateIds: [],
      title: 't', fallbackTitle: 't',
      starterDisplayName: 'u',
      starterSide: null, mySide: null,
      firstPostExcerpt: '', latestPostExcerpt: '', latestPostAuthor: '',
      createdAt: '', updatedAt: '',
      moveCount: 0, rebuttalCount: 0, participantCount: 0,
      hasNoRebuttal: false, hasUserJoined: false, openStatus: 'open',
      bucket: 'all_open', heatLevel: 'cold', temperament: 'plain',
      issueFrame: 'unknown', dominantAxis: 'none',
      sourceChainRisk: 'unknown', evidentiaryRisk: 'unknown', amplificationRisk: 'none_observed',
      platformSupportWarning: false, unresolvedReason: null, stopReason: null,
      evidenceDebtSummary: {
        debateId: 'd1', totalCount: 0, openCount: 0, staleCount: 0,
        settledCount: 0, hasOpenEvidenceDebt: false, statusLine: '',
      },
      timelinePreviewSegments: [], signals: [], searchText: '',
      voteScorePreview: null, winnerPreview: null, promotedArgumentCount: 0,
      sortKeys: {
        latestActivityMs: 0, createdAtMs: 0, heatScore: 0,
        needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY,
      },
      ...over,
    };
  }

  it('latest_activity desc', () => {
    const sorted = sortConversationGalleryCards([
      makeCard({ debateId: 'old', sortKeys: { latestActivityMs: 1, createdAtMs: 0, heatScore: 0, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY } }),
      makeCard({ debateId: 'new', sortKeys: { latestActivityMs: 10, createdAtMs: 0, heatScore: 0, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY } }),
    ], 'latest_activity');
    expect(sorted.map((c) => c.debateId)).toEqual(['new', 'old']);
  });

  it('needs_rebuttal_first promotes flagged rooms', () => {
    const sorted = sortConversationGalleryCards([
      makeCard({ debateId: 'normal', sortKeys: { latestActivityMs: 100, createdAtMs: 0, heatScore: 0, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY } }),
      makeCard({ debateId: 'flagged', sortKeys: { latestActivityMs: 1, createdAtMs: 0, heatScore: 0, needsRebuttalFlag: 1, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY } }),
    ], 'needs_rebuttal_first');
    expect(sorted[0].debateId).toBe('flagged');
  });

  it('heat desc with latest as tiebreaker', () => {
    const sorted = sortConversationGalleryCards([
      makeCard({ debateId: 'low-hot', sortKeys: { latestActivityMs: 100, createdAtMs: 0, heatScore: 0.2, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY } }),
      makeCard({ debateId: 'high-hot', sortKeys: { latestActivityMs: 1, createdAtMs: 0, heatScore: 0.9, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY } }),
    ], 'heat');
    expect(sorted[0].debateId).toBe('high-hot');
  });

  it('oldest_unresolved promotes the oldest still-unresolved', () => {
    const sorted = sortConversationGalleryCards([
      makeCard({ debateId: 'resolved', sortKeys: { latestActivityMs: 0, createdAtMs: 0, heatScore: 0, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY } }),
      makeCard({ debateId: 'very-old', sortKeys: { latestActivityMs: 0, createdAtMs: 1, heatScore: 0, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: 1 } }),
      makeCard({ debateId: 'recent-unres', sortKeys: { latestActivityMs: 0, createdAtMs: 100, heatScore: 0, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: 100 } }),
    ], 'oldest_unresolved');
    expect(sorted.map((c) => c.debateId)).toEqual(['very-old', 'recent-unres', 'resolved']);
  });
});

describe('paginateConversationGalleryCards', () => {
  function pile(n: number): ConversationGalleryCard[] {
    return Array.from({ length: n }, (_, i) => ({
      debateId: `d${i}`,
    } as unknown as ConversationGalleryCard));
  }
  it('returns correct page slice + page count', () => {
    const p = paginateConversationGalleryCards(pile(30), 12, 1);
    expect(p.page.length).toBe(12);
    expect(p.total).toBe(30);
    expect(p.pageCount).toBe(3);
    expect(p.pageIndex).toBe(1);
  });
  it('clamps oversized page index', () => {
    const p = paginateConversationGalleryCards(pile(5), 10, 99);
    expect(p.pageIndex).toBe(0);
    expect(p.page.length).toBe(5);
  });
});

// ──────────────────────────────────────────────────────────────
// Timeline preview is HORIZONTAL — no y axis required
// ──────────────────────────────────────────────────────────────

describe('timelinePreviewSegments', () => {
  it('emits one segment per posted move and detects evidence run band', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: {
        d1: [
          arg({ id: 'm1', debateId: 'd1', argumentType: 'thesis', createdAt: isoAt(1) }),
          arg({ id: 'm2', debateId: 'd1', argumentType: 'rebuttal', createdAt: isoAt(2) }),
          arg({ id: 'm3', debateId: 'd1', argumentType: 'evidence', createdAt: isoAt(3) }),
          arg({ id: 'm4', debateId: 'd1', argumentType: 'evidence', createdAt: isoAt(4) }),
        ],
      },
    });
    const segs = cards[0].timelinePreviewSegments;
    expect(segs.length).toBe(4);
    expect(segs[2].bandHighlight).toBe('evidence_run');
    expect(segs[3].bandHighlight).toBe('evidence_run');
    expect(segs[3].isLatest).toBe(true);
  });

  it('detects first_clash on the first rebuttal at depth ≥ 2', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: {
        d1: [
          arg({ id: 'm1', debateId: 'd1', argumentType: 'thesis', createdAt: isoAt(1) }),
          arg({ id: 'm2', debateId: 'd1', argumentType: 'rebuttal', createdAt: isoAt(2) }),
        ],
      },
    });
    expect(cards[0].timelinePreviewSegments[1].bandHighlight).toBe('first_clash');
  });
});

// ──────────────────────────────────────────────────────────────
// Bucket catalogue is complete
// ──────────────────────────────────────────────────────────────

describe('BUCKET_DEFINITIONS', () => {
  it('covers every bucket id with a label + empty copy', () => {
    expect(BUCKET_DEFINITIONS.length).toBe(11);
    for (const b of BUCKET_DEFINITIONS) {
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.emptyCopy.length).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// Safety: no raw X identifiers in derived fields
// ──────────────────────────────────────────────────────────────

describe('safety — derived fields preserve upstream redaction placeholders without adding new identifier shapes', () => {
  it('keeps angle-bracket placeholders intact and does not re-introduce raw URLs', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1', title: 'Posted at <x-handle>: claim about subway delays', resolution: 'See <x-link> for the original.' })],
      argumentsByDebateId: { d1: [arg({ id: 'm1', debateId: 'd1', body: '<x-link> <x-handle> — the claim needs a primary source.' })] },
    });
    expect(cards[0].searchText).toContain('<x-handle>');
    expect(cards[0].searchText).toContain('<x-link>');
    // No raw x.com / twitter.com / t.co URL surface from the gallery model.
    expect(cards[0].searchText).not.toMatch(/https?:\/\/(?:x|twitter|t)\.co/);
  });
});

// ──────────────────────────────────────────────────────────────
// EV-003 — evidence-debt roll-up on the gallery card
// ──────────────────────────────────────────────────────────────

describe('EV-003 — buildConversationGalleryCards evidenceDebtSummary', () => {
  const NOW = 1715000000000 + 3 * 86_400_000;

  it('attaches an evidenceDebtSummary to every card', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: { d1: [arg({ id: 'm1', debateId: 'd1' })] },
      nowMs: NOW,
    });
    expect(cards[0].evidenceDebtSummary).toBeDefined();
    expect(cards[0].evidenceDebtSummary.debateId).toBe('d1');
  });

  it('a room with an OPEN source request yields hasOpenEvidenceDebt + the evidence_debt_open signal', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: {
        d1: [
          arg({ id: 'root', debateId: 'd1', argumentType: 'thesis', createdAt: isoAt(1715000000000) }),
          arg({
            id: 'ask',
            debateId: 'd1',
            parentId: 'root',
            argumentType: 'clarification_request',
            createdAt: isoAt(1715000000000 + 1000),
          }),
        ],
      },
      tagsByArgumentId: {
        ask: [{ argumentId: 'ask', tagCode: 'source_request' }],
      },
      nowMs: NOW,
    });
    expect(cards[0].evidenceDebtSummary.hasOpenEvidenceDebt).toBe(true);
    expect(cards[0].evidenceDebtSummary.openCount).toBe(1);
    expect(cards[0].signals.some((s) => s.code === 'evidence_debt_open')).toBe(true);
  });

  it('a room whose source request was RESOLVED two moves later yields no open debt and no signal', () => {
    // The precision fix — the central gallery acceptance test.
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: {
        d1: [
          arg({ id: 'root', debateId: 'd1', argumentType: 'thesis', createdAt: isoAt(1715000000000) }),
          arg({
            id: 'ask',
            debateId: 'd1',
            parentId: 'root',
            argumentType: 'clarification_request',
            createdAt: isoAt(1715000000000 + 1000),
          }),
          arg({
            id: 'answer',
            debateId: 'd1',
            parentId: 'ask',
            argumentType: 'evidence',
            createdAt: isoAt(1715000000000 + 2000),
            attachedEvidence: [{ url: 'https://example.org/report' }],
          }),
        ],
      },
      tagsByArgumentId: {
        ask: [{ argumentId: 'ask', tagCode: 'source_request' }],
      },
      nowMs: NOW,
    });
    expect(cards[0].evidenceDebtSummary.totalCount).toBe(1);
    expect(cards[0].evidenceDebtSummary.hasOpenEvidenceDebt).toBe(false);
    expect(cards[0].signals.some((s) => s.code === 'evidence_debt_open')).toBe(false);
  });

  it('routes a room with an open debt into the source_chain_fight bucket', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: {
        d1: [
          arg({ id: 'root', debateId: 'd1', argumentType: 'thesis', createdAt: isoAt(1715000000000) }),
          arg({
            id: 'reb',
            debateId: 'd1',
            parentId: 'root',
            argumentType: 'rebuttal',
            createdAt: isoAt(1715000000000 + 500),
          }),
          arg({
            id: 'ask',
            debateId: 'd1',
            parentId: 'reb',
            argumentType: 'clarification_request',
            createdAt: isoAt(1715000000000 + 1000),
          }),
        ],
      },
      tagsByArgumentId: {
        ask: [{ argumentId: 'ask', tagCode: 'source_request' }],
      },
      nowMs: NOW,
    });
    expect(cards[0].bucket).toBe('source_chain_fight');
  });

  it('keeps a room whose source debt is fully resolved OUT of the source_chain_fight bucket', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: {
        d1: [
          arg({ id: 'root', debateId: 'd1', argumentType: 'thesis', createdAt: isoAt(1715000000000) }),
          arg({
            id: 'reb',
            debateId: 'd1',
            parentId: 'root',
            argumentType: 'rebuttal',
            createdAt: isoAt(1715000000000 + 500),
          }),
          arg({
            id: 'ask',
            debateId: 'd1',
            parentId: 'reb',
            argumentType: 'clarification_request',
            createdAt: isoAt(1715000000000 + 1000),
          }),
          arg({
            id: 'answer',
            debateId: 'd1',
            parentId: 'ask',
            argumentType: 'evidence',
            createdAt: isoAt(1715000000000 + 2000),
            attachedEvidence: [{ url: 'https://example.org/report' }],
          }),
        ],
      },
      tagsByArgumentId: {
        ask: [{ argumentId: 'ask', tagCode: 'source_request' }],
      },
      nowMs: NOW,
    });
    // Debts exist but all resolved → not a live source-trail fight.
    expect(cards[0].evidenceDebtSummary.totalCount).toBe(1);
    expect(cards[0].bucket).not.toBe('source_chain_fight');
  });

  it('surfaces the evidence_debt_stale signal for a long-dormant request', () => {
    const STALE_NOW = 1715000000000 + 10 * 86_400_000;
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: {
        d1: [
          arg({ id: 'root', debateId: 'd1', argumentType: 'thesis', createdAt: isoAt(1715000000000) }),
          arg({
            id: 'ask',
            debateId: 'd1',
            parentId: 'root',
            argumentType: 'clarification_request',
            createdAt: isoAt(1715000000000),
          }),
        ],
      },
      tagsByArgumentId: {
        ask: [{ argumentId: 'ask', tagCode: 'source_request' }],
      },
      nowMs: STALE_NOW,
    });
    expect(cards[0].evidenceDebtSummary.staleCount).toBe(1);
    expect(cards[0].signals.some((s) => s.code === 'evidence_debt_stale')).toBe(true);
  });

  it('a room with no request tags carries an empty evidence-debt summary and no signal', () => {
    const cards = buildConversationGalleryCards({
      debates: [debate({ id: 'd1' })],
      argumentsByDebateId: {
        d1: [arg({ id: 'm1', debateId: 'd1', argumentType: 'thesis' })],
      },
      nowMs: NOW,
    });
    expect(cards[0].evidenceDebtSummary.totalCount).toBe(0);
    expect(cards[0].evidenceDebtSummary.hasOpenEvidenceDebt).toBe(false);
    expect(cards[0].signals.some((s) => s.code.startsWith('evidence_debt'))).toBe(false);
  });
});

// Unused suppressions for table-driven shape (kept for completeness).
void {} as unknown as GalleryFlagInput;
void {} as unknown as GalleryTagInput;
