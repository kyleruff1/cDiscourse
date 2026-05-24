/**
 * GAL-001 — Gallery play-lane derivation tests.
 *
 * Pure-TS coverage for `classifyCardToSection` + `groupGalleryCardsBySection`
 * + the SECTION_ORDER / GALLERY_SECTION_DEFINITIONS surface area.
 *
 * Every row of the priority table in `docs/designs/GAL-001.md`
 * §"Deterministic grouping" is asserted explicitly. The one-card-one-lane
 * invariant is verified across a mixed-input fixture set.
 *
 * No React, no Supabase, no network, no AI.
 */
import {
  classifyCardToSection,
  groupGalleryCardsBySection,
  GALLERY_SECTION_DEFINITIONS,
  SECTION_ORDER,
  type ConversationGalleryCard,
  type ConversationGallerySection,
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

// ──────────────────────────────────────────────────────────────
// classifyCardToSection — priority table coverage
// ──────────────────────────────────────────────────────────────

describe('classifyCardToSection — priority 1: hasUserJoined', () => {
  it('returns my_rooms when hasUserJoined is true', () => {
    expect(classifyCardToSection(makeCard({ hasUserJoined: true }))).toBe('my_rooms');
  });
  it('returns my_rooms even when hasNoRebuttal is also true', () => {
    expect(classifyCardToSection(makeCard({ hasUserJoined: true, hasNoRebuttal: true }))).toBe('my_rooms');
  });
  it('returns my_rooms even when lifecycle is synthesis_ready', () => {
    expect(classifyCardToSection(makeCard({ hasUserJoined: true, rootClusterLifecycleState: 'synthesis_ready' }))).toBe('my_rooms');
  });
  it('returns my_rooms even when bucket is source_chain_fight', () => {
    expect(classifyCardToSection(makeCard({ hasUserJoined: true, bucket: 'source_chain_fight' }))).toBe('my_rooms');
  });
  it('returns my_rooms even when heatLevel is overheated', () => {
    expect(classifyCardToSection(makeCard({ hasUserJoined: true, heatLevel: 'overheated' }))).toBe('my_rooms');
  });
});

describe('classifyCardToSection — priority 2: hasNoRebuttal', () => {
  it('returns needs_rebuttal when hasNoRebuttal is true and not joined', () => {
    expect(classifyCardToSection(makeCard({ hasNoRebuttal: true }))).toBe('needs_rebuttal');
  });
  it('returns needs_rebuttal even when lifecycle is synthesis_ready', () => {
    expect(classifyCardToSection(makeCard({ hasNoRebuttal: true, rootClusterLifecycleState: 'synthesis_ready' }))).toBe('needs_rebuttal');
  });
  it('returns needs_rebuttal even when bucket is hot_now', () => {
    expect(classifyCardToSection(makeCard({ hasNoRebuttal: true, bucket: 'hot_now', heatLevel: 'hot' }))).toBe('needs_rebuttal');
  });
});

describe('classifyCardToSection — priority 3: lifecycle to almost_synthesis', () => {
  it('returns almost_synthesis for synthesis_ready lifecycle', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'synthesis_ready' }))).toBe('almost_synthesis');
  });
  it('returns almost_synthesis for narrowed lifecycle', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'narrowed' }))).toBe('almost_synthesis');
  });
  it('returns almost_synthesis for conceded lifecycle', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'conceded' }))).toBe('almost_synthesis');
  });
  it('returns almost_synthesis for confirmed lifecycle', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'confirmed' }))).toBe('almost_synthesis');
  });
  it('lifecycle path beats bucket path (synthesis_ready + evidence_fight → almost_synthesis)', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'synthesis_ready', bucket: 'evidence_fight' }))).toBe('almost_synthesis');
  });
});

describe('classifyCardToSection — priority 4: exhausted lifecycle to logic_traps', () => {
  it('returns logic_traps for exhausted lifecycle', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'exhausted' }))).toBe('logic_traps');
  });
  it('logic_traps beats evidence_needed bucket when exhausted', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'exhausted', bucket: 'evidence_fight' }))).toBe('logic_traps');
  });
  it('logic_traps beats definition_fights bucket when exhausted', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'exhausted', bucket: 'definition_scope_fight' }))).toBe('logic_traps');
  });
});

describe('classifyCardToSection — priority 5: branch_recommended to tangents_branches', () => {
  it('returns tangents_branches for branch_recommended lifecycle', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'branch_recommended' }))).toBe('tangents_branches');
  });
  it('tangents_branches beats source_trail bucket when branch_recommended', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'branch_recommended', bucket: 'source_chain_fight' }))).toBe('tangents_branches');
  });
});

describe('classifyCardToSection — priority 6: source_chain_fight bucket', () => {
  it('returns source_trail for source_chain_fight bucket', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'source_chain_fight' }))).toBe('source_trail');
  });
  it('returns source_trail even with hot heat (lifecycle null)', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'source_chain_fight', heatLevel: 'hot' }))).toBe('source_trail');
  });
});

describe('classifyCardToSection — priority 7: evidence_fight bucket', () => {
  it('returns evidence_needed for evidence_fight bucket', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'evidence_fight' }))).toBe('evidence_needed');
  });
  it('returns evidence_needed when lifecycle is null but bucket says evidence_fight', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'evidence_fight', rootClusterLifecycleState: null }))).toBe('evidence_needed');
  });
});

describe('classifyCardToSection — priority 8: definition_scope_fight bucket', () => {
  it('returns definition_fights for definition_scope_fight bucket', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'definition_scope_fight' }))).toBe('definition_fights');
  });
});

describe('classifyCardToSection — priority 9: unresolved_deep_chain bucket', () => {
  it('returns logic_traps for unresolved_deep_chain bucket (was hot_unresolved in Stage 6.4)', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'unresolved_deep_chain' }))).toBe('logic_traps');
  });
});

describe('classifyCardToSection — priority 10: hot_now / gaining_heat buckets', () => {
  it('returns jump_in for hot_now bucket', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'hot_now', heatLevel: 'hot' }))).toBe('jump_in');
  });
  it('returns jump_in for gaining_heat bucket', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'gaining_heat', heatLevel: 'warming' }))).toBe('jump_in');
  });
});

describe('classifyCardToSection — priority 11: heatLevel overheated fallback', () => {
  it('returns jump_in for overheated heatLevel without a lifecycle / bucket hit', () => {
    expect(classifyCardToSection(makeCard({ heatLevel: 'overheated', bucket: 'all_open' }))).toBe('jump_in');
  });
});

describe('classifyCardToSection — priority 12-13: SW-002 entryOpportunity tie-breakers', () => {
  it('returns logic_traps for entryOpportunity deep_existing_clash fallback', () => {
    expect(classifyCardToSection(makeCard({ entryOpportunity: 'deep_existing_clash', bucket: 'all_open' }))).toBe('logic_traps');
  });
  it('returns jump_in for entryOpportunity mid_thread_join fallback', () => {
    expect(classifyCardToSection(makeCard({ entryOpportunity: 'mid_thread_join', bucket: 'all_open' }))).toBe('jump_in');
  });
});

describe('classifyCardToSection — priority 14: quiet_beginner_rooms fallback', () => {
  it('returns quiet_beginner_rooms for pedantic_plain bucket', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'pedantic_plain', heatLevel: 'cold' }))).toBe('quiet_beginner_rooms');
  });
  it('returns quiet_beginner_rooms for cold + plain + no lifecycle + no bucket-match', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'all_open', heatLevel: 'cold' }))).toBe('quiet_beginner_rooms');
  });
  it('returns quiet_beginner_rooms for resolved_or_synthesized bucket (no almost_synthesis without lifecycle)', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'resolved_or_synthesized' }))).toBe('quiet_beginner_rooms');
  });
  it('returns quiet_beginner_rooms for archived_or_resolved lifecycle (no priority hit)', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'archived_or_resolved' }))).toBe('quiet_beginner_rooms');
  });
  it('returns quiet_beginner_rooms for an empty draft / zero-move card', () => {
    expect(classifyCardToSection(makeCard({ moveCount: 0, bucket: 'all_open' }))).toBe('quiet_beginner_rooms');
  });
});

// ──────────────────────────────────────────────────────────────
// Cross-priority interactions
// ──────────────────────────────────────────────────────────────

describe('classifyCardToSection — cross-priority interactions', () => {
  it('hasUserJoined wins over hasNoRebuttal', () => {
    expect(classifyCardToSection(makeCard({ hasUserJoined: true, hasNoRebuttal: true }))).toBe('my_rooms');
  });
  it('hasUserJoined wins over lifecycle', () => {
    expect(classifyCardToSection(makeCard({ hasUserJoined: true, rootClusterLifecycleState: 'exhausted' }))).toBe('my_rooms');
  });
  it('hasNoRebuttal wins over lifecycle (be the first rebuttal is most actionable)', () => {
    expect(classifyCardToSection(makeCard({ hasNoRebuttal: true, rootClusterLifecycleState: 'synthesis_ready' }))).toBe('needs_rebuttal');
  });
  it('lifecycle wins over heatLevel', () => {
    expect(classifyCardToSection(makeCard({ rootClusterLifecycleState: 'synthesis_ready', heatLevel: 'overheated' }))).toBe('almost_synthesis');
  });
  it('bucket wins over heatLevel fallback (source_chain_fight + overheated → source_trail)', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'source_chain_fight', heatLevel: 'overheated' }))).toBe('source_trail');
  });
  it('heatLevel overheated only fires when no bucket / lifecycle match', () => {
    // resolved_or_synthesized bucket doesn't have a priority match — heat fires.
    expect(classifyCardToSection(makeCard({ bucket: 'resolved_or_synthesized', heatLevel: 'overheated' }))).toBe('jump_in');
  });
});

// ──────────────────────────────────────────────────────────────
// groupGalleryCardsBySection — invariants
// ──────────────────────────────────────────────────────────────

describe('groupGalleryCardsBySection — ordering', () => {
  it('returns sections in SECTION_ORDER order', () => {
    const cards = [
      makeCard({ debateId: 'a', hasUserJoined: true }),
      makeCard({ debateId: 'b', hasNoRebuttal: true }),
      makeCard({ debateId: 'c', bucket: 'hot_now', heatLevel: 'hot' }),
      makeCard({ debateId: 'd', bucket: 'source_chain_fight' }),
      makeCard({ debateId: 'e', bucket: 'evidence_fight' }),
      makeCard({ debateId: 'f', bucket: 'definition_scope_fight' }),
      makeCard({ debateId: 'g', rootClusterLifecycleState: 'exhausted' }),
      makeCard({ debateId: 'h', rootClusterLifecycleState: 'branch_recommended' }),
      makeCard({ debateId: 'i', rootClusterLifecycleState: 'synthesis_ready' }),
      makeCard({ debateId: 'j', bucket: 'pedantic_plain', heatLevel: 'cold' }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    const ids = groups.map((g) => g.id);
    expect(ids).toEqual([
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

  it('elides empty sections', () => {
    const groups = groupGalleryCardsBySection([
      makeCard({ debateId: 'a', hasUserJoined: true }),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].id).toBe('my_rooms');
  });

  it('returns no groups for an empty input', () => {
    expect(groupGalleryCardsBySection([])).toEqual([]);
  });

  it('preserves card order within a lane (input order maintained)', () => {
    const cards = [
      makeCard({ debateId: 'a', bucket: 'hot_now', heatLevel: 'hot' }),
      makeCard({ debateId: 'b', bucket: 'hot_now', heatLevel: 'hot' }),
      makeCard({ debateId: 'c', bucket: 'hot_now', heatLevel: 'hot' }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    const jumpIn = groups.find((g) => g.id === 'jump_in');
    expect(jumpIn?.cards.map((c) => c.debateId)).toEqual(['a', 'b', 'c']);
  });
});

describe('groupGalleryCardsBySection — invariants', () => {
  it('each card appears in exactly one section', () => {
    const cards = [
      makeCard({ debateId: 'a', hasUserJoined: true }),
      makeCard({ debateId: 'b', hasNoRebuttal: true }),
      makeCard({ debateId: 'c', bucket: 'source_chain_fight' }),
      makeCard({ debateId: 'd', bucket: 'evidence_fight' }),
      makeCard({ debateId: 'e', bucket: 'definition_scope_fight' }),
      makeCard({ debateId: 'f', bucket: 'hot_now', heatLevel: 'hot' }),
      makeCard({ debateId: 'g', bucket: 'pedantic_plain', heatLevel: 'cold' }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    const all = groups.flatMap((g) => g.cards.map((c) => c.debateId));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(cards.length);
  });

  it('section labels match GALLERY_SECTION_DEFINITIONS labels', () => {
    const cards = [
      makeCard({ debateId: 'a', hasUserJoined: true }),
      makeCard({ debateId: 'b', hasNoRebuttal: true }),
      makeCard({ debateId: 'c', bucket: 'source_chain_fight' }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    for (const g of groups) {
      const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === g.id);
      expect(def).toBeDefined();
      expect(g.label).toBe(def!.label);
    }
  });

  it('section helperLine matches GALLERY_SECTION_DEFINITIONS helperLine', () => {
    const cards = [
      makeCard({ debateId: 'a', hasUserJoined: true }),
      makeCard({ debateId: 'b', bucket: 'evidence_fight' }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    for (const g of groups) {
      const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === g.id);
      expect(def).toBeDefined();
      expect(g.helperLine).toBe(def!.helperLine);
    }
  });

  it('every group has a non-empty cards list', () => {
    const cards = [
      makeCard({ debateId: 'a', hasUserJoined: true }),
      makeCard({ debateId: 'b', bucket: 'pedantic_plain', heatLevel: 'cold' }),
    ];
    const groups = groupGalleryCardsBySection(cards);
    for (const g of groups) expect(g.cards.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION_ORDER and union coverage
// ──────────────────────────────────────────────────────────────

describe('SECTION_ORDER — totality', () => {
  it('has exactly 10 entries', () => {
    expect(SECTION_ORDER.length).toBe(10);
  });

  it('contains every member of ConversationGallerySection (compile-time check via exhaustive switch)', () => {
    // If any union member is missing a case below, TypeScript will error
    // on the `: never` assignment in the default branch.
    const seen = new Set<ConversationGallerySection>(SECTION_ORDER);
    const exhaustiveCheck = (s: ConversationGallerySection): void => {
      switch (s) {
        case 'my_rooms':
        case 'needs_rebuttal':
        case 'jump_in':
        case 'source_trail':
        case 'evidence_needed':
        case 'definition_fights':
        case 'logic_traps':
        case 'tangents_branches':
        case 'almost_synthesis':
        case 'quiet_beginner_rooms':
          return;
        default: {
          const exhaustive: never = s;
          throw new Error(`Unexpected lane id ${exhaustive}`);
        }
      }
    };
    for (const s of seen) exhaustiveCheck(s);
    expect(seen.size).toBe(10);
  });

  it('places my_rooms first per the GAL-001 design', () => {
    expect(SECTION_ORDER[0]).toBe('my_rooms');
  });

  it('places quiet_beginner_rooms last (catch-all fallback)', () => {
    expect(SECTION_ORDER[SECTION_ORDER.length - 1]).toBe('quiet_beginner_rooms');
  });

  it('does NOT contain the retired Stage 6.4 codes hot_unresolved / easy_first_move', () => {
    const ids = new Set<string>(SECTION_ORDER as readonly string[]);
    expect(ids.has('hot_unresolved')).toBe(false);
    expect(ids.has('easy_first_move')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// Back-compat checks (Stage 6.4 routing rows that survive)
// ──────────────────────────────────────────────────────────────

describe('Back-compat with Stage 6.4 routing', () => {
  it('Stage 6.4 needs_rebuttal still routes to needs_rebuttal', () => {
    expect(classifyCardToSection(makeCard({ hasNoRebuttal: true, bucket: 'needs_rebuttal' }))).toBe('needs_rebuttal');
  });
  it('Stage 6.4 source_chain_fight still routes to source_trail', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'source_chain_fight' }))).toBe('source_trail');
  });
  it('Stage 6.4 my_rooms still routes to my_rooms', () => {
    expect(classifyCardToSection(makeCard({ hasUserJoined: true }))).toBe('my_rooms');
  });
  it('Stage 6.4 hot_unresolved routing now splits — hot_now goes to jump_in', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'hot_now', heatLevel: 'hot' }))).toBe('jump_in');
  });
  it('Stage 6.4 hot_unresolved routing now splits — unresolved_deep_chain goes to logic_traps', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'unresolved_deep_chain' }))).toBe('logic_traps');
  });
  it('Stage 6.4 easy_first_move routing now points at quiet_beginner_rooms', () => {
    expect(classifyCardToSection(makeCard({ bucket: 'pedantic_plain', heatLevel: 'cold' }))).toBe('quiet_beginner_rooms');
  });
});

// ──────────────────────────────────────────────────────────────
// Lane derivation is pure / side-effect-free
// ──────────────────────────────────────────────────────────────

describe('classifyCardToSection — purity / determinism', () => {
  it('returns the same lane for the same input across calls', () => {
    const card = makeCard({ bucket: 'evidence_fight' });
    expect(classifyCardToSection(card)).toBe('evidence_needed');
    expect(classifyCardToSection(card)).toBe('evidence_needed');
    expect(classifyCardToSection(card)).toBe('evidence_needed');
  });

  it('does not mutate the input card', () => {
    const card = makeCard({ bucket: 'evidence_fight' });
    const snapshot = JSON.stringify(card);
    classifyCardToSection(card);
    expect(JSON.stringify(card)).toBe(snapshot);
  });

  it('treats undefined lifecycle the same as null lifecycle (falls through to bucket)', () => {
    const a = makeCard({ rootClusterLifecycleState: undefined, bucket: 'evidence_fight' });
    const b = makeCard({ rootClusterLifecycleState: null, bucket: 'evidence_fight' });
    expect(classifyCardToSection(a)).toBe(classifyCardToSection(b));
  });

  it('treats undefined entryOpportunity the same as null entryOpportunity', () => {
    const a = makeCard({ entryOpportunity: undefined, bucket: 'all_open' });
    const b = makeCard({ entryOpportunity: null, bucket: 'all_open' });
    expect(classifyCardToSection(a)).toBe(classifyCardToSection(b));
  });
});
