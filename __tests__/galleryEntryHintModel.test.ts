/**
 * GAL-002 — Entry cards with first suggested move.
 *
 * Tests for the `deriveGalleryEntryHint` deriver and the `GalleryEntryHint`
 * shape that replaces Stage 6.4's `deriveConversationEntryHint`. Pure-TS;
 * no React, no Supabase, no network.
 *
 * Coverage:
 *  1. Derivation totality across all 19 lifecycle states + 11 buckets.
 *  2. Per-call freshness (no internal cache).
 *  3. Verb / helper length contracts.
 *  4. Preset + dock action mapping coverage.
 *  5. Ban-list scans (verdict / amplification / person-attribution / snake_case).
 *  6. Source-file scan: no AI / popularity tokens inside the GAL-002 region.
 *  7. Doctrine §3 carve-out: hint is not derived from move count or heat.
 *  8. SW-002 `entryOpportunity` tie-breaker.
 *  9. `openStatus` override.
 * 10. Hint shape totality.
 */
import fs from 'fs';
import path from 'path';
import {
  ALL_GALLERY_ENTRY_HINT_CODES,
  deriveGalleryEntryHint,
  type ConversationBucket,
  type ConversationGalleryCard,
  type GalleryEntryHint,
  type GalleryEntryHintCode,
} from '../src/features/debates/conversationGalleryModel';
import {
  ALL_POINT_LIFECYCLE_STATES,
  type PointLifecycleState,
} from '../src/features/lifecycle';
import { ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES } from '../src/features/arguments/timelineNodeActionDockModel';
import type { EntryOpportunity } from '../src/features/strengthWeakness/heatModel';

const ALL_QUICK_ACTION_LABELS = [
  'reply', 'challenge', 'source', 'quote', 'clarify', 'evidence', 'concede',
  'branch', 'flag', 'weak_source', 'inspect_receipt', 'narrow', 'confirm',
  'synthesize',
] as const;

const ALL_BUCKETS: ReadonlyArray<ConversationBucket> = [
  'needs_rebuttal',
  'gaining_heat',
  'hot_now',
  'source_chain_fight',
  'evidence_fight',
  'definition_scope_fight',
  'pedantic_plain',
  'unresolved_deep_chain',
  'resolved_or_synthesized',
  'my_rooms',
  'all_open',
];

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
    mySide: null,
    firstPostExcerpt: '',
    latestPostExcerpt: '',
    latestPostAuthor: '',
    createdAt: '',
    updatedAt: '',
    moveCount: 5,
    rebuttalCount: 1,
    participantCount: 2,
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

// ── 1. Derivation totality ────────────────────────────────────

describe('GAL-002 derivation totality', () => {
  it('every lifecycle state produces a hint with a recognised code', () => {
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const hint = deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: state }));
      expect(ALL_GALLERY_ENTRY_HINT_CODES).toContain(hint.code);
    }
  });

  it('every bucket produces a hint with a recognised code (lifecycle-null fallback)', () => {
    for (const bucket of ALL_BUCKETS) {
      const hint = deriveGalleryEntryHint(baseCard({
        bucket,
        rootClusterLifecycleState: null,
        hasNoRebuttal: bucket === 'needs_rebuttal',
      }));
      expect(ALL_GALLERY_ENTRY_HINT_CODES).toContain(hint.code);
    }
  });

  it('lifecycle dispatch covers the expected codes per the GAL-002 mapping table', () => {
    const expected: Record<PointLifecycleState, GalleryEntryHintCode> = {
      open: 'watch_first',                 // open + rebuttalCount=1 → not first rebuttal
      answered: 'watch_first',
      rebutted: 'narrow',
      clarified: 'watch_first',
      sourced: 'challenge_mechanism',
      quote_requested: 'ask_source',
      source_requested: 'ask_source',
      narrowed: 'synthesize',
      conceded: 'synthesize',
      confirmed: 'synthesize',
      synthesis_ready: 'synthesize',
      moved_on_by_affirmative: 'join_when_ready',
      moved_on_by_negative: 'join_when_ready',
      ignored_by_affirmative: 'join_when_ready',
      ignored_by_negative: 'join_when_ready',
      ignored_by_both: 'synthesize',
      exhausted: 'narrow',
      branch_recommended: 'narrow',
      archived_or_resolved: 'watch_first',
    };
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const hint = deriveGalleryEntryHint(baseCard({
        rootClusterLifecycleState: state,
        hasNoRebuttal: false,
      }));
      expect(hint.code).toBe(expected[state]);
    }
  });

  it('open lifecycle + hasNoRebuttal short-circuits to be_first_rebuttal', () => {
    const hint = deriveGalleryEntryHint(baseCard({
      rootClusterLifecycleState: 'open',
      hasNoRebuttal: true,
      moveCount: 1,
    }));
    expect(hint.code).toBe('be_first_rebuttal');
    expect(hint.activate).toBe('root');
  });

  it('bucket-fallback dispatch preserves Stage 6.4 activate semantics', () => {
    const expected: Record<ConversationBucket, { code: GalleryEntryHintCode; activate: GalleryEntryHint['activate'] }> = {
      needs_rebuttal: { code: 'be_first_rebuttal', activate: 'root' },
      source_chain_fight: { code: 'ask_source', activate: 'first_open_challenge' },
      evidence_fight: { code: 'challenge_mechanism', activate: 'first_open_challenge' },
      definition_scope_fight: { code: 'narrow', activate: 'latest' },
      unresolved_deep_chain: { code: 'narrow', activate: 'latest' },
      hot_now: { code: 'narrow', activate: 'latest' },
      gaining_heat: { code: 'watch_first', activate: 'latest' },
      pedantic_plain: { code: 'watch_first', activate: 'root' },
      resolved_or_synthesized: { code: 'watch_first', activate: 'latest' },
      my_rooms: { code: 'join_when_ready', activate: 'latest' },
      all_open: { code: 'watch_first', activate: 'latest' },
    };
    for (const bucket of ALL_BUCKETS) {
      const hint = deriveGalleryEntryHint(baseCard({
        bucket,
        hasNoRebuttal: bucket === 'needs_rebuttal',
        rootClusterLifecycleState: null,
      }));
      expect(hint.code).toBe(expected[bucket].code);
      expect(hint.activate).toBe(expected[bucket].activate);
    }
  });
});

// ── 2. Freshness ──────────────────────────────────────────────

describe('GAL-002 freshness', () => {
  it('recomputes on each call when inputs change', () => {
    const card = baseCard({ rootClusterLifecycleState: 'open', hasNoRebuttal: false });
    const a = deriveGalleryEntryHint(card);
    card.rootClusterLifecycleState = 'source_requested';
    const b = deriveGalleryEntryHint(card);
    expect(a.code).not.toBe(b.code);
    expect(b.code).toBe('ask_source');
  });

  it('returns deep-equal output for identical inputs', () => {
    const c = baseCard({ rootClusterLifecycleState: 'narrowed' });
    const a = deriveGalleryEntryHint(c);
    const b = deriveGalleryEntryHint(c);
    expect(a).toEqual(b);
  });

  it('module has no top-level mutable cache state for the deriver', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/debates/conversationGalleryModel.ts'),
      'utf8',
    );
    // The GAL-002 region must not introduce a Map / WeakMap / Set / mutable
    // module-level let. We slice the file at the GAL-002 region header.
    const regionStart = src.indexOf('// ── GAL-002 — Gallery entry-hint deriver');
    const regionEnd = src.indexOf('// ── End GAL-002 region');
    expect(regionStart).toBeGreaterThan(0);
    expect(regionEnd).toBeGreaterThan(regionStart);
    const region = src.slice(regionStart, regionEnd);
    expect(region).not.toMatch(/^let\s+\w+/m);
    expect(region).not.toMatch(/new\s+(?:WeakMap|Map|Set)\s*\(/);
  });
});

// ── 3. Length contracts ───────────────────────────────────────

describe('GAL-002 length contracts', () => {
  it('verbPhrase is ≤ 8 words for every hint code', () => {
    const probes: Array<Partial<ConversationGalleryCard>> = [
      { hasNoRebuttal: true, moveCount: 1 },                                    // be_first_rebuttal
      { rootClusterLifecycleState: 'source_requested' },                        // ask_source
      { rootClusterLifecycleState: 'sourced' },                                 // challenge_mechanism
      { rootClusterLifecycleState: 'narrowed' },                                // synthesize (lifecycle precedence)
      { rootClusterLifecycleState: 'exhausted' },                               // narrow
      { rootClusterLifecycleState: 'synthesis_ready' },                         // synthesize
      { rootClusterLifecycleState: 'archived_or_resolved' },                    // watch_first
      { rootClusterLifecycleState: 'moved_on_by_affirmative' },                 // join_when_ready
    ];
    for (const over of probes) {
      const hint = deriveGalleryEntryHint(baseCard(over));
      const words = hint.verbPhrase.split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(8);
    }
  });

  it('verbPhrase + helperLine + separator stays ≤ 200 chars', () => {
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const hint = deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: state }));
      const total = hint.verbPhrase.length + hint.helperLine.length + 3;
      expect(total).toBeLessThanOrEqual(200);
    }
    for (const bucket of ALL_BUCKETS) {
      const hint = deriveGalleryEntryHint(baseCard({
        bucket,
        hasNoRebuttal: bucket === 'needs_rebuttal',
        rootClusterLifecycleState: null,
      }));
      const total = hint.verbPhrase.length + hint.helperLine.length + 3;
      expect(total).toBeLessThanOrEqual(200);
    }
  });

  it('every produced verbPhrase is non-empty', () => {
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const hint = deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: state }));
      expect(hint.verbPhrase.length).toBeGreaterThan(0);
      expect(hint.helperLine.length).toBeGreaterThan(0);
    }
  });
});

// ── 4. Preset + dock mapping ──────────────────────────────────

describe('GAL-002 preset + dock mapping', () => {
  function hintsForEveryCode(): Array<{ code: GalleryEntryHintCode; hint: GalleryEntryHint }> {
    return [
      { code: 'be_first_rebuttal', hint: deriveGalleryEntryHint(baseCard({ hasNoRebuttal: true, moveCount: 1 })) },
      { code: 'ask_source', hint: deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: 'source_requested' })) },
      { code: 'challenge_mechanism', hint: deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: 'sourced' })) },
      { code: 'narrow', hint: deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: 'rebutted' })) },
      { code: 'synthesize', hint: deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: 'synthesis_ready' })) },
      { code: 'watch_first', hint: deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: 'archived_or_resolved' })) },
      { code: 'join_when_ready', hint: deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: 'moved_on_by_affirmative' })) },
    ];
  }

  it('every presetKey is null or an existing QuickActionLabel', () => {
    for (const { code, hint } of hintsForEveryCode()) {
      expect(hint.code).toBe(code);
      if (hint.presetKey !== null) {
        expect(ALL_QUICK_ACTION_LABELS).toContain(hint.presetKey);
      }
    }
  });

  it('every dockAction is null or an existing TimelineNodeActionDockActionCode', () => {
    for (const { hint } of hintsForEveryCode()) {
      if (hint.dockAction !== null) {
        expect(ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES).toContain(hint.dockAction);
      }
    }
  });

  it('the 3 gallery-only meta hints have null preset and null dock', () => {
    const watch = deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: 'archived_or_resolved' }));
    const join = deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: 'moved_on_by_affirmative' }));
    const first = deriveGalleryEntryHint(baseCard({ hasNoRebuttal: true, moveCount: 1 }));
    expect(first.presetKey).toBe('reply');           // be_first_rebuttal opens reply composer
    expect(first.dockAction).toBe('reply');
    expect(watch.presetKey).toBeNull();
    expect(watch.dockAction).toBeNull();
    expect(join.presetKey).toBeNull();
    expect(join.dockAction).toBeNull();
  });

  it('every non-meta hint has a non-null preset and dock action', () => {
    const nonMetaCodes: GalleryEntryHintCode[] = ['ask_source', 'challenge_mechanism', 'narrow', 'synthesize'];
    const probes = hintsForEveryCode().filter((p) => nonMetaCodes.includes(p.code));
    for (const { hint } of probes) {
      expect(hint.presetKey).not.toBeNull();
      expect(hint.dockAction).not.toBeNull();
    }
  });
});

// ── 5. Ban-list scans ─────────────────────────────────────────

describe('GAL-002 ban-list scans', () => {
  const VERDICT_TOKENS = [
    'winner', 'loser', 'correct', 'incorrect', 'true', 'false',
    'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist',
    'propagandist', 'troll', 'astroturfer', 'verdict', 'proven',
    'disproven', 'won', 'lost', 'right', 'wrong', 'validated',
  ];
  const POPULARITY_TOKENS = [
    'likes', 'retweets', 'shares', 'views', 'followers', 'verified',
    'engagement', 'amplification', 'trending', 'virality', 'popular', 'viral',
  ];
  const PERSON_ATTRIBUTION_TOKENS = [
    'this person', 'this user', 'the user is', 'the author is',
  ];

  function allProducedStrings(): string[] {
    const out: string[] = [];
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const hint = deriveGalleryEntryHint(baseCard({ rootClusterLifecycleState: state }));
      out.push(hint.verbPhrase, hint.helperLine);
    }
    for (const bucket of ALL_BUCKETS) {
      const hint = deriveGalleryEntryHint(baseCard({
        bucket,
        hasNoRebuttal: bucket === 'needs_rebuttal',
        rootClusterLifecycleState: null,
      }));
      out.push(hint.verbPhrase, hint.helperLine);
    }
    // Also include the SW-002-tie-breaker output paths.
    for (const eo of ['easy_first_move', 'mid_thread_join', 'deep_existing_clash'] as const) {
      const hint = deriveGalleryEntryHint(baseCard({
        rootClusterLifecycleState: null,
        bucket: 'all_open',
        entryOpportunity: eo,
      }));
      out.push(hint.verbPhrase, hint.helperLine);
    }
    return out;
  }

  it('no verdict tokens in any produced string', () => {
    for (const s of allProducedStrings()) {
      const lower = s.toLowerCase();
      for (const token of VERDICT_TOKENS) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no popularity / engagement tokens in any produced string', () => {
    for (const s of allProducedStrings()) {
      const lower = s.toLowerCase();
      for (const token of POPULARITY_TOKENS) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no person-attribution tokens in any produced string', () => {
    for (const s of allProducedStrings()) {
      const lower = s.toLowerCase();
      for (const token of PERSON_ATTRIBUTION_TOKENS) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no internal hint codes leak into produced strings as snake_case', () => {
    // The hint codes are snake_case identifiers. The verb phrases reuse the
    // verbs (`narrow`, `synthesize`) as plain English, so we scan only for
    // the underscore-bearing form to catch raw code leakage.
    for (const s of allProducedStrings()) {
      for (const code of ALL_GALLERY_ENTRY_HINT_CODES) {
        if (code.includes('_')) {
          expect(s).not.toContain(code);
        }
      }
    }
  });

  it('no snake_case identifier leaks into produced strings', () => {
    const snake = /[a-z]+_[a-z]+/;
    for (const s of allProducedStrings()) {
      expect(s).not.toMatch(snake);
    }
  });
});

// ── 6. Source-file scan ───────────────────────────────────────

describe('GAL-002 source-file scan', () => {
  it('the GAL-002 region does not call fetch / anthropic / xai or read Date.now / Math.random', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/debates/conversationGalleryModel.ts'),
      'utf8',
    );
    const regionStart = src.indexOf('// ── GAL-002 — Gallery entry-hint deriver');
    const regionEnd = src.indexOf('// ── End GAL-002 region');
    expect(regionStart).toBeGreaterThan(0);
    expect(regionEnd).toBeGreaterThan(regionStart);
    const region = src.slice(regionStart, regionEnd);
    // The deriver must not call any external API, read system time, or use
    // any source of randomness. Doctrine words like "popularity" and
    // "engagement" may legitimately appear in the doctrine commentary
    // (describing what the deriver does NOT do); the test below catches
    // actual code use patterns instead of broad word matches.
    expect(region).not.toMatch(/\bfetch\s*\(/);
    expect(region).not.toMatch(/\banthropic\b/i);
    expect(region).not.toMatch(/\bxai\b/i);
    expect(region).not.toMatch(/\bopenai\b/i);
    expect(region).not.toMatch(/Math\.random/);
    expect(region).not.toMatch(/Date\.now/);
    // No read of popularity / engagement / virality / heat fields by name.
    // These are property accesses on the card object — `card.heatLevel`,
    // `card.heatScore`, `card.moveCount` (as a primary hint signal beyond
    // the explicit moveCount === 0 short-circuit which IS structural,
    // not popularity-derived).
    expect(region).not.toMatch(/card\.heatScore\b/);
    expect(region).not.toMatch(/card\.heatLevel\b/);
    expect(region).not.toMatch(/card\.participantCount\b/);
    expect(region).not.toMatch(/card\.rebuttalCount\b/);
  });

  it('the GAL-002 region uses Object.freeze for every constant lookup table', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/debates/conversationGalleryModel.ts'),
      'utf8',
    );
    const regionStart = src.indexOf('// ── GAL-002 — Gallery entry-hint deriver');
    const regionEnd = src.indexOf('// ── End GAL-002 region');
    const region = src.slice(regionStart, regionEnd);
    // Confirm at least four frozen constants exist (verbs / helpers /
    // preset / dock). The exact count is allowed to grow.
    const frozenCount = (region.match(/Object\.freeze\(/g) || []).length;
    expect(frozenCount).toBeGreaterThanOrEqual(4);
  });
});

// ── 7. Doctrine §3 carve-out ──────────────────────────────────

describe('GAL-002 doctrine §3 carve-out', () => {
  it('hint code does not change with move count alone', () => {
    const lo = deriveGalleryEntryHint(baseCard({
      moveCount: 3, rebuttalCount: 1, bucket: 'all_open',
      hasNoRebuttal: false, openStatus: 'open',
      rootClusterLifecycleState: null, entryOpportunity: null,
    }));
    const hi = deriveGalleryEntryHint(baseCard({
      moveCount: 30, rebuttalCount: 1, bucket: 'all_open',
      hasNoRebuttal: false, openStatus: 'open',
      rootClusterLifecycleState: null, entryOpportunity: null,
    }));
    expect(lo.code).toBe(hi.code);
  });

  it('hint code does not change with heat level alone', () => {
    const cold = deriveGalleryEntryHint(baseCard({
      heatLevel: 'cold', bucket: 'all_open',
      hasNoRebuttal: false, openStatus: 'open',
      rootClusterLifecycleState: null, entryOpportunity: null,
    }));
    const overheated = deriveGalleryEntryHint(baseCard({
      heatLevel: 'overheated', bucket: 'all_open',
      hasNoRebuttal: false, openStatus: 'open',
      rootClusterLifecycleState: null, entryOpportunity: null,
    }));
    expect(cold.code).toBe(overheated.code);
  });
});

// ── 8. SW-002 entryOpportunity tie-breaker ────────────────────

describe('GAL-002 SW-002 entryOpportunity tie-breaker', () => {
  function withEntryOpportunity(eo: EntryOpportunity | null): GalleryEntryHint {
    return deriveGalleryEntryHint(baseCard({
      rootClusterLifecycleState: null,
      bucket: 'all_open',          // bucket fallback → watch_first
      hasNoRebuttal: false,
      openStatus: 'open',
      entryOpportunity: eo,
    }));
  }

  it("deep_existing_clash promotes a watch_first fallback to narrow", () => {
    expect(withEntryOpportunity('deep_existing_clash').code).toBe('narrow');
  });

  it("mid_thread_join promotes a watch_first fallback to join_when_ready", () => {
    expect(withEntryOpportunity('mid_thread_join').code).toBe('join_when_ready');
  });

  it("easy_first_move keeps watch_first when that's the underlying recommendation", () => {
    expect(withEntryOpportunity('easy_first_move').code).toBe('watch_first');
  });

  it("null entryOpportunity defers to lifecycle / bucket alone", () => {
    expect(withEntryOpportunity(null).code).toBe('watch_first');
  });

  it('entryOpportunity never overrides a non-watch_first choice', () => {
    // Lifecycle says synthesize; entryOpportunity should NOT downgrade.
    const hint = deriveGalleryEntryHint(baseCard({
      rootClusterLifecycleState: 'synthesis_ready',
      entryOpportunity: 'deep_existing_clash',
    }));
    expect(hint.code).toBe('synthesize');
  });
});

// ── 9. openStatus override ────────────────────────────────────

describe('GAL-002 openStatus override', () => {
  for (const status of ['archived', 'draft', 'locked'] as const) {
    it(`openStatus '${status}' overrides lifecycle to watch_first`, () => {
      const hint = deriveGalleryEntryHint(baseCard({
        openStatus: status,
        rootClusterLifecycleState: 'synthesis_ready', // would otherwise produce synthesize
        hasNoRebuttal: false,
      }));
      expect(hint.code).toBe('watch_first');
      expect(hint.activate).toBe('latest');
    });
  }

  it('openStatus open does not override anything', () => {
    const hint = deriveGalleryEntryHint(baseCard({
      openStatus: 'open',
      rootClusterLifecycleState: 'synthesis_ready',
      hasNoRebuttal: false,
    }));
    expect(hint.code).toBe('synthesize');
  });
});

// ── 10. Shape totality ────────────────────────────────────────

describe('GAL-002 hint shape totality', () => {
  it('every produced hint has fully populated, typed fields', () => {
    const lifecycleProbes: Array<PointLifecycleState | null | undefined> = [
      ...ALL_POINT_LIFECYCLE_STATES, null, undefined,
    ];
    const openStatuses: ConversationGalleryCard['openStatus'][] = ['open', 'draft', 'locked', 'archived'];
    const entryOpps: Array<EntryOpportunity | null | undefined> = ['easy_first_move', 'mid_thread_join', 'deep_existing_clash', null, undefined];
    for (const lc of lifecycleProbes) {
      for (const bucket of ALL_BUCKETS) {
        for (const status of openStatuses) {
          for (const eo of entryOpps) {
            for (const hnr of [true, false]) {
              const hint = deriveGalleryEntryHint(baseCard({
                rootClusterLifecycleState: lc,
                bucket,
                openStatus: status,
                entryOpportunity: eo,
                hasNoRebuttal: hnr,
                moveCount: hnr ? 1 : 5,
              }));
              expect(typeof hint.activate).toBe('string');
              expect(typeof hint.code).toBe('string');
              expect(typeof hint.verbPhrase).toBe('string');
              expect(typeof hint.helperLine).toBe('string');
              expect(hint.verbPhrase.length).toBeGreaterThan(0);
              expect(hint.helperLine.length).toBeGreaterThan(0);
              expect(ALL_GALLERY_ENTRY_HINT_CODES).toContain(hint.code);
              expect(['root', 'latest', 'first_open_challenge']).toContain(hint.activate);
            }
          }
        }
      }
    }
  });

  it('moveCount === 0 short-circuits to be_first_rebuttal regardless of bucket', () => {
    for (const bucket of ALL_BUCKETS) {
      const hint = deriveGalleryEntryHint(baseCard({
        moveCount: 0, hasNoRebuttal: false, bucket,
        rootClusterLifecycleState: null,
      }));
      expect(hint.code).toBe('be_first_rebuttal');
    }
  });
});

// ── 11. QOL-040.3 — entryHintForArgumentId additive field ────

describe('QOL-040.3 entryHintForArgumentId additive field', () => {
  it('the GalleryEntryHint interface accepts the optional field', () => {
    // TypeScript compile-time check: a hint with the field set must
    // satisfy the interface. The variable is consumed below to keep
    // no-unused-vars happy without changing semantics.
    const withField: GalleryEntryHint = {
      activate: 'latest',
      code: 'watch_first',
      verbPhrase: '',
      helperLine: '',
      presetKey: null,
      dockAction: null,
      entryHintForArgumentId: 'a-7',
    };
    expect(withField.entryHintForArgumentId).toBe('a-7');
    // The field is optional; a hint without it remains valid.
    const withoutField: GalleryEntryHint = {
      activate: 'latest',
      code: 'watch_first',
      verbPhrase: '',
      helperLine: '',
      presetKey: null,
      dockAction: null,
    };
    expect(withoutField.entryHintForArgumentId).toBeUndefined();
  });

  it('deriveGalleryEntryHint never sets entryHintForArgumentId', () => {
    // Every lifecycle / bucket / entryOpportunity combination must
    // produce a hint with `entryHintForArgumentId === undefined`. The
    // gallery deriver is not a producer of this field; only the
    // notification deep-link path (`buildDeepLinkEntryHint`) sets it.
    const lifecycleProbes: Array<PointLifecycleState | null | undefined> = [
      ...ALL_POINT_LIFECYCLE_STATES, null, undefined,
    ];
    const openStatuses: ConversationGalleryCard['openStatus'][] = ['open', 'draft', 'locked', 'archived'];
    const entryOpps: Array<EntryOpportunity | null | undefined> = ['easy_first_move', 'mid_thread_join', 'deep_existing_clash', null, undefined];
    for (const lc of lifecycleProbes) {
      for (const bucket of ALL_BUCKETS) {
        for (const status of openStatuses) {
          for (const eo of entryOpps) {
            for (const hnr of [true, false]) {
              const hint = deriveGalleryEntryHint(baseCard({
                rootClusterLifecycleState: lc,
                bucket,
                openStatus: status,
                entryOpportunity: eo,
                hasNoRebuttal: hnr,
                moveCount: hnr ? 1 : 5,
              }));
              expect(hint.entryHintForArgumentId).toBeUndefined();
            }
          }
        }
      }
    }
  });
});
