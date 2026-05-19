/**
 * Stage 6.4 — Seamless conversation entry + observer-first action rail.
 *
 * Pure tests:
 *   - plain-language copy mappings (no internal codes leak)
 *   - rail action sets for observer / participant / self bubble
 *   - rail action → bubble control mapping
 *   - smart entry hints per bucket
 *   - gallery section grouping per card
 */
import {
  PLAIN_LANGUAGE_COPY,
  toPlainLanguage,
  toPlainLanguageOrSuppress,
  looksLikeInternalCode,
  OBSERVER_COPY,
  GALLERY_SECTIONS,
} from '../src/features/arguments/gameCopy';
import {
  getRailActions,
  railActionToBubbleControl,
} from '../src/features/arguments/ArgumentSideActionRail';
import {
  deriveGalleryEntryHint,
  groupGalleryCardsBySection,
  type ConversationGalleryCard,
} from '../src/features/debates/conversationGalleryModel';

// ──────────────────────────────────────────────────────────────
// Plain-language copy
// ──────────────────────────────────────────────────────────────

describe('toPlainLanguage', () => {
  it('maps known validation codes to human prose', () => {
    expect(toPlainLanguage('topic_satisfaction_lexical')).toContain('clearer link');
    expect(toPlainLanguage('weak_relevance')).toContain('stronger tie-in');
    expect(toPlainLanguage('parent_nonresponsive')).toContain('parent');
    expect(toPlainLanguage('off_topic')).toContain('topic');
    expect(toPlainLanguage('evidence_required')).toContain('source');
  });

  it('maps runner pipeline codes to human prose', () => {
    expect(toPlainLanguage('validation_failed_after_retries')).toContain('clearer shape');
    expect(toPlainLanguage('max_depth_reached')).toContain('Deep unresolved');
    // LIFE-001 updated this label from 'Near resolution' to 'Ready for synthesis'.
    expect(toPlainLanguage('synthesis_ready')).toContain('Ready for synthesis');
    expect(toPlainLanguage('submit_failed')).toContain('Posting failed');
  });

  it('maps role codes for normal users (moderator → Observer; observer → Watching)', () => {
    expect(toPlainLanguage('observer')).toBe('Watching');
    expect(toPlainLanguage('moderator')).toBe('Observer');
  });

  it('maps semantic-corpus axes (source_chain → Source trail, anti_amplification → Popularity is not proof)', () => {
    expect(toPlainLanguage('source_chain')).toBe('Source trail');
    expect(toPlainLanguage('anti_amplification')).toBe('Popularity is not proof');
    // META-001 updated this label from 'Receipts needed' to 'Evidence debt'
    // to match the manual-tag vocabulary verbatim. The pipeline reads the
    // code, not the label, so no runner-side regression.
    expect(toPlainLanguage('evidence_debt')).toBe('Evidence debt');
    expect(toPlainLanguage('platform_support_warning')).toBe('Do not score as proven yet');
  });

  it('returns null for unknown codes (toPlainLanguageOrSuppress)', () => {
    expect(toPlainLanguageOrSuppress('unknown_internal_code')).toBeNull();
    expect(toPlainLanguageOrSuppress(null)).toBeNull();
    expect(toPlainLanguageOrSuppress('')).toBeNull();
  });

  it('is case insensitive and normalises dashes/spaces', () => {
    expect(toPlainLanguage('TOPIC_SATISFACTION_LEXICAL')).not.toBeNull();
    expect(toPlainLanguage('source-chain')).toBe('Source trail');
    expect(toPlainLanguage('  source chain  ')).toBe('Source trail');
  });
});

describe('looksLikeInternalCode', () => {
  it('flags snake_case identifiers', () => {
    expect(looksLikeInternalCode('topic_satisfaction_lexical')).toBe(true);
    expect(looksLikeInternalCode('max_depth_reached')).toBe(true);
  });
  it('flags HTTP-status-prefixed reasons', () => {
    expect(looksLikeInternalCode('http_422_validation_failed')).toBe(true);
  });
  it('does NOT flag prose', () => {
    expect(looksLikeInternalCode('Deep unresolved chain')).toBe(false);
    expect(looksLikeInternalCode('Source trail')).toBe(false);
    expect(looksLikeInternalCode('Watching')).toBe(false);
  });
});

describe('PLAIN_LANGUAGE_COPY catalogue', () => {
  it('covers every category named by Stage 6.4 spec', () => {
    const required = [
      'topic_satisfaction_lexical', 'weak_relevance', 'source_chain', 'anti_amplification',
      'evidence_debt', 'platform_support_warning', 'validation_failed_after_retries',
      'max_depth_reached', 'synthesis_ready', 'submit_failed', 'observer', 'moderator',
    ];
    for (const k of required) {
      expect(Object.prototype.hasOwnProperty.call(PLAIN_LANGUAGE_COPY, k)).toBe(true);
    }
  });
});

describe('OBSERVER_COPY catalogue', () => {
  it('includes Observe / Jump in / Join For / Join Against entries', () => {
    expect(OBSERVER_COPY.enterRoom).toBe('Observe');
    expect(OBSERVER_COPY.enterRoomSecondary).toBe('Jump in');
    expect(OBSERVER_COPY.joinAff).toContain('For');
    expect(OBSERVER_COPY.joinNeg).toContain('Against');
  });
});

describe('GALLERY_SECTIONS catalogue', () => {
  it('declares the ten GAL-001 play lanes in order', () => {
    expect(GALLERY_SECTIONS.map((s) => s.id)).toEqual([
      'my_rooms',
      'needs_rebuttal',
      'jump_in',
      'source_trail',
      'evidence_needed',
      'definition_fights',
      'logic_traps',
      'tangents_branches',
      'almost_synthesis',
      'quiet_beginner_rooms',
    ]);
  });
});

// ──────────────────────────────────────────────────────────────
// Rail action sets
// ──────────────────────────────────────────────────────────────

describe('getRailActions', () => {
  it('observer set exposes Watch / Join For / Join Against / Ask source / Open timeline / Share', () => {
    const codes = getRailActions('observer', 'other').map((a) => a.code);
    expect(codes).toEqual(['watch', 'join_aff', 'join_neg', 'ask_source', 'open_timeline', 'share']);
  });
  it('participant on OTHER bubble exposes Reply / Disagree / Ask source / Ask quote / Split / Flag / Qualifiers', () => {
    const codes = getRailActions('participant', 'other').map((a) => a.code);
    expect(codes).toEqual(['reply', 'disagree', 'ask_source', 'ask_quote', 'split_branch', 'flag', 'qualifiers']);
  });
  it('participant on OWN bubble exposes only Qualifiers + Request deletion (no edit, no disagree, no flag, no score)', () => {
    const codes = getRailActions('participant', 'self').map((a) => a.code);
    expect(codes).toEqual(['qualifiers', 'request_deletion']);
    expect(codes).not.toContain('reply');
    expect(codes).not.toContain('disagree');
    expect(codes).not.toContain('flag');
  });
  it('every observer action has a helper string', () => {
    for (const a of getRailActions('observer', 'other')) {
      expect(typeof a.helper).toBe('string');
      expect(a.helper.length).toBeGreaterThan(0);
    }
  });
});

describe('railActionToBubbleControl', () => {
  it('maps participant codes to canonical bubble controls', () => {
    expect(railActionToBubbleControl('reply')).toBe('reply');
    expect(railActionToBubbleControl('disagree')).toBe('disagree');
    expect(railActionToBubbleControl('ask_source')).toBe('ask_for_source');
    expect(railActionToBubbleControl('ask_quote')).toBe('ask_for_quote');
    expect(railActionToBubbleControl('split_branch')).toBe('branch');
    expect(railActionToBubbleControl('flag')).toBe('flag');
    expect(railActionToBubbleControl('qualifiers')).toBe('view_qualifiers');
    expect(railActionToBubbleControl('request_deletion')).toBe('request_deletion');
  });
  it('returns null for rail-only codes (handled locally by the room shell)', () => {
    expect(railActionToBubbleControl('join_aff')).toBeNull();
    expect(railActionToBubbleControl('join_neg')).toBeNull();
    expect(railActionToBubbleControl('watch')).toBeNull();
    expect(railActionToBubbleControl('share')).toBeNull();
    expect(railActionToBubbleControl('open_timeline')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// Smart entry hints
// ──────────────────────────────────────────────────────────────

function makeCard(over: Partial<ConversationGalleryCard>): ConversationGalleryCard {
  return {
    debateId: 'd1', canonicalConversationKey: 'k1', duplicateCount: 1, duplicateDebateIds: ['d1'],
    title: 'T', fallbackTitle: 'T', starterDisplayName: 'u', starterSide: null, mySide: null,
    firstPostExcerpt: '', latestPostExcerpt: '', latestPostAuthor: '',
    createdAt: '', updatedAt: '',
    moveCount: 1, rebuttalCount: 0, participantCount: 1,
    hasNoRebuttal: false, hasUserJoined: false, openStatus: 'open',
    bucket: 'all_open', heatLevel: 'cold', temperament: 'plain',
    issueFrame: 'unknown', dominantAxis: 'none',
    sourceChainRisk: 'unknown', evidentiaryRisk: 'unknown', amplificationRisk: 'none_observed',
    platformSupportWarning: false, unresolvedReason: null, stopReason: null,
    timelinePreviewSegments: [], signals: [], searchText: '',
    voteScorePreview: null, winnerPreview: null, promotedArgumentCount: 0,
    sortKeys: { latestActivityMs: 0, createdAtMs: 0, heatScore: 0, needsRebuttalFlag: 0, moveCount: 0, oldestUnresolvedMs: Number.POSITIVE_INFINITY },
    ...over,
  };
}

describe('deriveGalleryEntryHint', () => {
  it('needs-rebuttal card activates root + says "Be the first rebuttal"', () => {
    const hint = deriveGalleryEntryHint(makeCard({ hasNoRebuttal: true, bucket: 'needs_rebuttal' }));
    expect(hint.activate).toBe('root');
    expect(hint.code).toBe('be_first_rebuttal');
    expect(hint.verbPhrase).toMatch(/first rebuttal/i);
  });
  it('source-chain card activates the most recent challenge/source move', () => {
    const hint = deriveGalleryEntryHint(makeCard({ bucket: 'source_chain_fight' }));
    expect(hint.activate).toBe('first_open_challenge');
    expect(hint.code).toBe('ask_source');
    expect(hint.verbPhrase.toLowerCase()).toMatch(/source/);
  });
  it('evidence-fight card asks for the mechanism', () => {
    const hint = deriveGalleryEntryHint(makeCard({ bucket: 'evidence_fight' }));
    expect(hint.activate).toBe('first_open_challenge');
    expect(hint.code).toBe('challenge_mechanism');
    expect(hint.verbPhrase.toLowerCase()).toMatch(/mechanism|narrow/);
  });
  it('hot-now card activates latest with the narrow first move', () => {
    const hint = deriveGalleryEntryHint(makeCard({ bucket: 'hot_now', heatLevel: 'hot' }));
    expect(hint.activate).toBe('latest');
    expect(hint.code).toBe('narrow');
  });
  it('unresolved deep-chain card suggests narrow', () => {
    const hint = deriveGalleryEntryHint(makeCard({ bucket: 'unresolved_deep_chain' }));
    expect(hint.code).toBe('narrow');
    expect(hint.verbPhrase.toLowerCase()).toMatch(/narrow|synthesis/);
  });
  it('pedantic_plain card activates root + says "Watch first"', () => {
    const hint = deriveGalleryEntryHint(makeCard({ bucket: 'pedantic_plain', heatLevel: 'cold' }));
    expect(hint.activate).toBe('root');
    expect(hint.code).toBe('watch_first');
    expect(hint.verbPhrase.toLowerCase()).toContain('watch');
  });
  it('resolved card routes to watch_first (room is closed for new moves)', () => {
    const hint = deriveGalleryEntryHint(makeCard({ bucket: 'resolved_or_synthesized' }));
    expect(hint.code).toBe('watch_first');
    expect(hint.verbPhrase.toLowerCase()).toContain('watch');
  });
  it('default all_open says "Watch first"', () => {
    const hint = deriveGalleryEntryHint(makeCard({ bucket: 'all_open' }));
    expect(hint.code).toBe('watch_first');
    expect(hint.verbPhrase.toLowerCase()).toContain('watch');
  });
});

// ──────────────────────────────────────────────────────────────
// Section grouping
// ──────────────────────────────────────────────────────────────

describe('groupGalleryCardsBySection', () => {
  it('puts joined rooms into my_rooms first', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', hasUserJoined: true }),
      makeCard({ debateId: 'b' }),
    ]);
    const my = groups.find((g) => g.id === 'my_rooms');
    expect(my?.cards.map((c) => c.debateId)).toContain('a');
  });
  it('routes a no-rebuttal card to needs_rebuttal', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', hasNoRebuttal: true, bucket: 'needs_rebuttal' }),
    ]);
    expect(groups.find((g) => g.id === 'needs_rebuttal')?.cards.length).toBe(1);
  });
  it('routes source-chain cards to source_trail', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', bucket: 'source_chain_fight' }),
    ]);
    expect(groups.find((g) => g.id === 'source_trail')?.cards.length).toBe(1);
  });
  it('routes hot_now bucket to jump_in (GAL-001 replaces hot_unresolved)', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', bucket: 'hot_now', heatLevel: 'hot' }),
    ]);
    expect(groups.find((g) => g.id === 'jump_in')?.cards.length).toBe(1);
  });
  it('routes cold/plain cards to quiet_beginner_rooms (renamed from easy_first_move)', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', bucket: 'pedantic_plain', heatLevel: 'cold' }),
    ]);
    expect(groups.find((g) => g.id === 'quiet_beginner_rooms')?.cards.length).toBe(1);
  });
  it('routes evidence_fight bucket to evidence_needed (GAL-001 new lane)', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', bucket: 'evidence_fight' }),
    ]);
    expect(groups.find((g) => g.id === 'evidence_needed')?.cards.length).toBe(1);
  });
  it('routes definition_scope_fight bucket to definition_fights (GAL-001 new lane)', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', bucket: 'definition_scope_fight' }),
    ]);
    expect(groups.find((g) => g.id === 'definition_fights')?.cards.length).toBe(1);
  });
  it('routes synthesis_ready lifecycle to almost_synthesis (GAL-001 new lane)', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', rootClusterLifecycleState: 'synthesis_ready' }),
    ]);
    expect(groups.find((g) => g.id === 'almost_synthesis')?.cards.length).toBe(1);
  });
  it('returns only sections that contain at least one card', () => {
    const groups = groupGalleryCardsBySection([makeCard({ debateId: 'a', hasNoRebuttal: true })]);
    for (const g of groups) expect(g.cards.length).toBeGreaterThan(0);
  });
  it('each card appears in exactly one section', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', bucket: 'needs_rebuttal', hasNoRebuttal: true }),
      makeCard({ debateId: 'b', bucket: 'source_chain_fight' }),
      makeCard({ debateId: 'c', bucket: 'pedantic_plain', heatLevel: 'cold' }),
    ]);
    const all = groups.flatMap((g) => g.cards.map((c) => c.debateId));
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });
});
