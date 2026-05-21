/**
 * IX-001 — Timeline density + focus-lens model tests.
 *
 * Pure-function coverage: the 4 density modes + spec object, the 11 gallery
 * lens predicates (lifecycle-loaded AND lifecycle-absent fallback branches),
 * the 7 timeline lens predicates, `applyGalleryLens` / `applyTimelineLens`
 * invariants, the sort + density converters, the view-config reset rules,
 * and the dedupe rule adoption. No React, no Supabase, no network.
 */
import {
  // density
  ALL_GALLERY_DENSITY_MODES,
  DEFAULT_GALLERY_DENSITY,
  GALLERY_DENSITY_SPECS,
  resolveGalleryDensitySpec,
  toTimelineDensityMode,
  densityChangePreservesActive,
  // lenses
  ALL_FOCUS_LENSES,
  TIMELINE_LENS_IDS,
  DEFAULT_FOCUS_LENS,
  FOCUS_LENS_COPY,
  GALLERY_LENS_PREDICATES,
  TIMELINE_LENS_PREDICATES,
  activePathLens,
  applyGalleryLens,
  applyTimelineLens,
  RECENTLY_UPDATED_WINDOW_MS,
  // sort + config
  ALL_GALLERY_SORT_AXES,
  toConversationSortMode,
  DEFAULT_DENSITY_LENS_VIEW_CONFIG,
  applyViewConfigChange,
  type LensContext,
  type TimelineLensContext,
  type TimelineLensNode,
} from '../src/features/arguments/timelineDensityLensModel';
import {
  buildConversationGalleryCards,
  dedupeConversationCards,
  sortConversationGalleryCards,
  type ConversationGalleryCard,
  type GalleryArgumentInput,
} from '../src/features/debates/conversationGalleryModel';
import type { Debate } from '../src/features/debates/types';
import type { PointLifecycleState } from '../src/features/lifecycle';
import type { ArgumentTimelineMapNode } from '../src/features/arguments/argumentGameSurfaceModel';

// ──────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────

const BASE_MS = 1_715_000_000_000;
function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

function debate(partial: Partial<Debate> & { id: string }): Debate {
  return {
    id: partial.id,
    createdBy: partial.createdBy ?? 'user-creator',
    title: partial.title ?? 'A debate title',
    resolution: partial.resolution ?? 'A debate resolution.',
    description: partial.description ?? '',
    status: partial.status ?? 'open',
    constitutionId: partial.constitutionId ?? 'c1',
    createdAt: partial.createdAt ?? isoAt(BASE_MS),
    updatedAt: partial.updatedAt ?? isoAt(BASE_MS),
    myParticipantSide: partial.myParticipantSide ?? null,
  };
}

function arg(
  partial: Partial<GalleryArgumentInput> & { id: string; debateId: string },
): GalleryArgumentInput {
  return {
    id: partial.id,
    debateId: partial.debateId,
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'author-a',
    argumentType: partial.argumentType ?? 'thesis',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A reasonably long argument body for the gallery card.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(BASE_MS),
    updatedAt: partial.updatedAt ?? null,
  };
}

/**
 * A fully-built `ConversationGalleryCard` with every field at a known
 * baseline, mergeable via `partial`. Built directly (not via
 * `buildConversationGalleryCards`) so a predicate test can pin the exact
 * field a lens reads.
 */
function card(partial: Partial<ConversationGalleryCard> = {}): ConversationGalleryCard {
  const base: ConversationGalleryCard = {
    debateId: 'd-1',
    canonicalConversationKey: 'k-1',
    duplicateCount: 1,
    duplicateDebateIds: ['d-1'],
    title: 'A room',
    fallbackTitle: 'A room',
    starterDisplayName: 'User · abcd…wxyz',
    starterSide: null,
    mySide: null,
    firstPostExcerpt: 'First post.',
    latestPostExcerpt: 'Latest post.',
    latestPostAuthor: 'Opponent',
    createdAt: isoAt(BASE_MS),
    updatedAt: isoAt(BASE_MS),
    moveCount: 3,
    rebuttalCount: 1,
    participantCount: 2,
    hasNoRebuttal: false,
    hasUserJoined: false,
    openStatus: 'open',
    bucket: 'all_open',
    heatLevel: 'cold',
    temperament: 'curious',
    issueFrame: 'unknown',
    dominantAxis: 'none',
    sourceChainRisk: 'unknown',
    evidentiaryRisk: 'unknown',
    amplificationRisk: 'none_observed',
    platformSupportWarning: false,
    evidenceDebtSummary: {
      debateId: 'd-1',
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
    searchText: 'a room',
    voteScorePreview: null,
    winnerPreview: null,
    promotedArgumentCount: 0,
    sortKeys: {
      latestActivityMs: BASE_MS,
      createdAtMs: BASE_MS,
      heatScore: 0.1,
      needsRebuttalFlag: 0,
      moveCount: 3,
      oldestUnresolvedMs: Number.POSITIVE_INFINITY,
    },
  };
  return { ...base, ...partial };
}

/** A built `TimelineLensNode` at a known baseline, mergeable via `partial`. */
function node(partial: Partial<TimelineLensNode> = {}): TimelineLensNode {
  const base: ArgumentTimelineMapNode = {
    messageId: 'm-1',
    parentId: null,
    ordinal: 1,
    createdAt: isoAt(BASE_MS),
    createdAtLabel: 'May 6',
    relativeLabel: '2h ago',
    actorLabel: 'Opponent',
    kindLabel: 'Claim',
    sideLabel: 'For',
    bodyPreview: 'A node body.',
    badges: [],
    droppedTags: [],
    depth: 0,
    lane: 0,
    siblingIndex: 0,
    replyCount: 0,
    descendantCount: 0,
    branchId: 'b-1',
    branchRootMessageId: 'm-1',
    junctionGroupId: null,
    isJunction: false,
    junctionChildCount: 0,
    isActive: false,
    isLatest: false,
    isDetached: false,
    isActivePath: false,
    isRoot: true,
    isFirstRebuttal: false,
    standingBand: 'unscored',
    toneBand: 'measured',
    temperatureBand: 'cool',
    kindColor: '#6366f1',
    kindColorFamily: 'claim',
    x: 0,
    y: 0,
    accessibilityLabel: 'Claim, position 1',
  };
  return { ...base, ...partial };
}

const CTX: LensContext = { nowMs: BASE_MS };

// ══════════════════════════════════════════════════════════════
// Density model
// ══════════════════════════════════════════════════════════════

describe('IX-001 density modes', () => {
  it('exposes exactly the 4 modes, normal as default', () => {
    expect([...ALL_GALLERY_DENSITY_MODES]).toEqual(['expanded', 'normal', 'compact', 'scan']);
    expect(DEFAULT_GALLERY_DENSITY).toBe('normal');
  });

  it('is a strict superset of the 3 shipped TimelineDensityMode values', () => {
    // The three shipped names appear 1:1 in GalleryDensityMode.
    for (const shipped of ['compact', 'normal', 'expanded'] as const) {
      expect(ALL_GALLERY_DENSITY_MODES).toContain(shipped);
    }
    // …plus exactly one extra, gallery-only tier.
    expect(ALL_GALLERY_DENSITY_MODES.length).toBe(4);
    expect(ALL_GALLERY_DENSITY_MODES).toContain('scan');
  });

  it('GALLERY_DENSITY_SPECS has an entry for every mode', () => {
    for (const mode of ALL_GALLERY_DENSITY_MODES) {
      const spec = resolveGalleryDensitySpec(mode);
      expect(spec.mode).toBe(mode);
    }
  });

  it('spec excerpt lines shrink monotonically toward scan', () => {
    expect(GALLERY_DENSITY_SPECS.expanded.firstPostExcerptLines).toBe(3);
    expect(GALLERY_DENSITY_SPECS.normal.firstPostExcerptLines).toBe(2);
    expect(GALLERY_DENSITY_SPECS.compact.firstPostExcerptLines).toBe(1);
    expect(GALLERY_DENSITY_SPECS.scan.firstPostExcerptLines).toBe(0);
  });

  it('scan hides only OPTIONAL regions — never the always-present data', () => {
    const scan = GALLERY_DENSITY_SPECS.scan;
    // Optional regions off in scan:
    expect(scan.showMiniTimeline).toBe(false);
    expect(scan.showStatsRow).toBe(false);
    expect(scan.signalChips).toBe('primary_only');
    // …but the latest-move line is still shown (>=1 line) — scan is
    // "one line per conversation", not "less truth per conversation".
    expect(scan.latestPostExcerptLines).toBeGreaterThanOrEqual(1);
    expect(scan.rhythm).toBe('single_line');
  });

  it('expanded and normal keep all optional regions on', () => {
    for (const mode of ['expanded', 'normal'] as const) {
      const spec = GALLERY_DENSITY_SPECS[mode];
      expect(spec.showMiniTimeline).toBe(true);
      expect(spec.showStatsRow).toBe(true);
      expect(spec.signalChips).toBe('all');
    }
  });
});

describe('toTimelineDensityMode', () => {
  it('passes the 3 shipped modes through 1:1', () => {
    expect(toTimelineDensityMode('expanded')).toBe('expanded');
    expect(toTimelineDensityMode('normal')).toBe('normal');
    expect(toTimelineDensityMode('compact')).toBe('compact');
  });

  it('clamps scan down to compact (the board never goes tighter)', () => {
    expect(toTimelineDensityMode('scan')).toBe('compact');
  });
});

describe('densityChangePreservesActive', () => {
  const a = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];

  it('is true when the same list is passed before and after', () => {
    expect(densityChangePreservesActive(a, a, 'y')).toBe(true);
  });

  it('is true for a null activeId', () => {
    expect(densityChangePreservesActive(a, [], null)).toBe(true);
  });

  it('is true when activeId is present in both lists', () => {
    const after = [{ id: 'z' }, { id: 'y' }, { id: 'x' }]; // reordered, same members
    expect(densityChangePreservesActive(a, after, 'x')).toBe(true);
  });

  it('is false when activeId is in one list but not the other', () => {
    expect(densityChangePreservesActive(a, [{ id: 'y' }], 'x')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// Lens vocabulary
// ══════════════════════════════════════════════════════════════

describe('IX-001 focus-lens vocabulary', () => {
  it('exposes 11 named lenses plus the none baseline', () => {
    expect(ALL_FOCUS_LENSES.length).toBe(12);
    expect(ALL_FOCUS_LENSES[0]).toBe('none');
    expect(DEFAULT_FOCUS_LENS).toBe('none');
  });

  it('FOCUS_LENS_COPY has an entry for every lens', () => {
    for (const lens of ALL_FOCUS_LENSES) {
      const copy = FOCUS_LENS_COPY[lens];
      expect(copy.id).toBe(lens);
      expect(copy.label.length).toBeGreaterThan(0);
    }
  });

  it('GALLERY_LENS_PREDICATES has a predicate for every lens', () => {
    for (const lens of ALL_FOCUS_LENSES) {
      expect(typeof GALLERY_LENS_PREDICATES[lens]).toBe('function');
    }
  });

  it('TIMELINE_LENS_IDS is a strict subset of ALL_FOCUS_LENSES', () => {
    for (const lens of TIMELINE_LENS_IDS) {
      expect(ALL_FOCUS_LENSES).toContain(lens);
    }
    expect(TIMELINE_LENS_IDS.length).toBeLessThan(ALL_FOCUS_LENSES.length);
  });

  it('the 4 room-level lenses are absent from TIMELINE_LENS_IDS', () => {
    for (const galleryOnly of [
      'quiet_plain',
      'private_invites',
      'my_active_rooms',
      'recently_updated',
      'settled_locked',
    ] as const) {
      expect(TIMELINE_LENS_IDS).not.toContain(galleryOnly);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// The 11 gallery lens predicates — membership table
// ══════════════════════════════════════════════════════════════

describe('gallery lens predicate: none', () => {
  it('matches every card', () => {
    expect(GALLERY_LENS_PREDICATES.none(card(), CTX)).toBe(true);
    expect(GALLERY_LENS_PREDICATES.none(card({ openStatus: 'archived' }), CTX)).toBe(true);
  });
});

describe('gallery lens predicate: needs_response', () => {
  const p = GALLERY_LENS_PREDICATES.needs_response;

  it('lifecycle-loaded — true for a needs-response state', () => {
    for (const s of [
      'open',
      'rebutted',
      'clarified',
      'source_requested',
      'quote_requested',
      'narrowed',
    ] as PointLifecycleState[]) {
      expect(p(card({ rootClusterLifecycleState: s }), CTX)).toBe(true);
    }
  });

  it('lifecycle-loaded — false for a settled state', () => {
    expect(p(card({ rootClusterLifecycleState: 'archived_or_resolved' }), CTX)).toBe(false);
    expect(p(card({ rootClusterLifecycleState: 'confirmed' }), CTX)).toBe(false);
  });

  it('lifecycle-absent fallback — true when hasNoRebuttal', () => {
    expect(p(card({ rootClusterLifecycleState: null, hasNoRebuttal: true }), CTX)).toBe(true);
  });

  it('lifecycle-absent fallback — true when an unresolvedReason exists', () => {
    expect(
      p(card({ rootClusterLifecycleState: null, unresolvedReason: 'long_thread_no_close' }), CTX),
    ).toBe(true);
  });

  it('lifecycle-absent fallback — false for a plain answered card', () => {
    expect(
      p(card({ rootClusterLifecycleState: null, hasNoRebuttal: false, unresolvedReason: null }), CTX),
    ).toBe(false);
  });
});

describe('gallery lens predicate: no_rebuttal', () => {
  const p = GALLERY_LENS_PREDICATES.no_rebuttal;
  it('is the pure hasNoRebuttal structural field', () => {
    expect(p(card({ hasNoRebuttal: true }), CTX)).toBe(true);
    expect(p(card({ hasNoRebuttal: false }), CTX)).toBe(false);
  });
});

describe('gallery lens predicate: heating_up', () => {
  const p = GALLERY_LENS_PREDICATES.heating_up;
  it('true for a warming heat level', () => {
    expect(p(card({ heatLevel: 'warming' }), CTX)).toBe(true);
  });
  it('true for the gaining_heat bucket even when heat is cold', () => {
    expect(p(card({ heatLevel: 'cold', bucket: 'gaining_heat' }), CTX)).toBe(true);
  });
  it('false for a cold non-gaining card', () => {
    expect(p(card({ heatLevel: 'cold', bucket: 'all_open' }), CTX)).toBe(false);
  });
});

describe('gallery lens predicate: hot', () => {
  const p = GALLERY_LENS_PREDICATES.hot;
  it('true for hot and overheated heat levels', () => {
    expect(p(card({ heatLevel: 'hot' }), CTX)).toBe(true);
    expect(p(card({ heatLevel: 'overheated' }), CTX)).toBe(true);
  });
  it('false for cold and warming', () => {
    expect(p(card({ heatLevel: 'cold' }), CTX)).toBe(false);
    expect(p(card({ heatLevel: 'warming' }), CTX)).toBe(false);
  });
});

describe('gallery lens predicate: quiet_plain', () => {
  const p = GALLERY_LENS_PREDICATES.quiet_plain;
  it('true for a plain or pedantic temperament with cold heat', () => {
    expect(p(card({ temperament: 'plain', heatLevel: 'cold' }), CTX)).toBe(true);
    expect(p(card({ temperament: 'pedantic', heatLevel: 'cold' }), CTX)).toBe(true);
  });
  it('false when the room is not cold', () => {
    expect(p(card({ temperament: 'plain', heatLevel: 'warming' }), CTX)).toBe(false);
  });
  it('false for a non-plain temperament', () => {
    expect(p(card({ temperament: 'sharp', heatLevel: 'cold' }), CTX)).toBe(false);
  });
});

describe('gallery lens predicate: evidence_requested', () => {
  const p = GALLERY_LENS_PREDICATES.evidence_requested;
  it('lifecycle-loaded — true for source_requested / quote_requested', () => {
    expect(p(card({ rootClusterLifecycleState: 'source_requested' }), CTX)).toBe(true);
    expect(p(card({ rootClusterLifecycleState: 'quote_requested' }), CTX)).toBe(true);
  });
  it('lifecycle-loaded — false for an unrelated lifecycle state', () => {
    expect(p(card({ rootClusterLifecycleState: 'open', evidentiaryRisk: 'low' }), CTX)).toBe(false);
  });
  it('lifecycle-absent fallback — true when evidentiaryRisk is high', () => {
    expect(p(card({ rootClusterLifecycleState: null, evidentiaryRisk: 'high' }), CTX)).toBe(true);
  });
  it('lifecycle-absent fallback — false for low evidentiary risk', () => {
    expect(p(card({ rootClusterLifecycleState: null, evidentiaryRisk: 'low' }), CTX)).toBe(false);
  });
});

describe('gallery lens predicate: source_chain_pressure', () => {
  const p = GALLERY_LENS_PREDICATES.source_chain_pressure;
  it('true for high or medium source-chain risk', () => {
    expect(p(card({ sourceChainRisk: 'high' }), CTX)).toBe(true);
    expect(p(card({ sourceChainRisk: 'medium' }), CTX)).toBe(true);
  });
  it('true when a platform-support warning is set', () => {
    expect(p(card({ sourceChainRisk: 'low', platformSupportWarning: true }), CTX)).toBe(true);
  });
  it('false for low risk with no warning', () => {
    expect(p(card({ sourceChainRisk: 'low', platformSupportWarning: false }), CTX)).toBe(false);
  });
});

describe('gallery lens predicate: private_invites', () => {
  const p = GALLERY_LENS_PREDICATES.private_invites;
  const invitedCtx: LensContext = { nowMs: BASE_MS, invitedDebateIds: new Set(['d-9']) };

  it('true for an invited, not-joined, non-archived room', () => {
    expect(p(card({ debateId: 'd-9', hasUserJoined: false, openStatus: 'open' }), invitedCtx)).toBe(
      true,
    );
  });
  it('false when the viewer has already joined', () => {
    expect(p(card({ debateId: 'd-9', hasUserJoined: true }), invitedCtx)).toBe(false);
  });
  it('false for an archived room even if invited', () => {
    expect(p(card({ debateId: 'd-9', openStatus: 'archived' }), invitedCtx)).toBe(false);
  });
  it('false for every card when no invites are loaded', () => {
    expect(p(card({ debateId: 'd-9' }), CTX)).toBe(false);
  });
});

describe('gallery lens predicate: my_active_rooms', () => {
  const p = GALLERY_LENS_PREDICATES.my_active_rooms;
  it('true for a joined open or draft room', () => {
    expect(p(card({ hasUserJoined: true, openStatus: 'open' }), CTX)).toBe(true);
    expect(p(card({ hasUserJoined: true, openStatus: 'draft' }), CTX)).toBe(true);
  });
  it('false for a joined but locked or archived room', () => {
    expect(p(card({ hasUserJoined: true, openStatus: 'locked' }), CTX)).toBe(false);
    expect(p(card({ hasUserJoined: true, openStatus: 'archived' }), CTX)).toBe(false);
  });
  it('false for a not-joined room', () => {
    expect(p(card({ hasUserJoined: false, openStatus: 'open' }), CTX)).toBe(false);
  });
});

describe('gallery lens predicate: recently_updated', () => {
  const p = GALLERY_LENS_PREDICATES.recently_updated;
  it('true when latest activity is inside the recency window', () => {
    const recent = card({ sortKeys: { ...card().sortKeys, latestActivityMs: BASE_MS - 1000 } });
    expect(p(recent, { nowMs: BASE_MS })).toBe(true);
  });
  it('false when latest activity is older than the window', () => {
    const stale = card({
      sortKeys: { ...card().sortKeys, latestActivityMs: BASE_MS - RECENTLY_UPDATED_WINDOW_MS - 1 },
    });
    expect(p(stale, { nowMs: BASE_MS })).toBe(false);
  });
  it('false when there is no activity timestamp (latestActivityMs 0)', () => {
    const noActivity = card({ sortKeys: { ...card().sortKeys, latestActivityMs: 0 } });
    expect(p(noActivity, { nowMs: BASE_MS })).toBe(false);
  });
});

describe('gallery lens predicate: settled_locked', () => {
  const p = GALLERY_LENS_PREDICATES.settled_locked;
  it('lifecycle-loaded — true for archived_or_resolved', () => {
    expect(p(card({ rootClusterLifecycleState: 'archived_or_resolved' }), CTX)).toBe(true);
  });
  it('lifecycle-absent fallback — true for a locked or archived openStatus', () => {
    expect(p(card({ rootClusterLifecycleState: null, openStatus: 'locked' }), CTX)).toBe(true);
    expect(p(card({ rootClusterLifecycleState: null, openStatus: 'archived' }), CTX)).toBe(true);
  });
  it('lifecycle-absent fallback — true for the resolved_or_synthesized bucket', () => {
    expect(
      p(card({ rootClusterLifecycleState: null, bucket: 'resolved_or_synthesized' }), CTX),
    ).toBe(true);
  });
  it('false for a plain open room', () => {
    expect(
      p(card({ rootClusterLifecycleState: null, openStatus: 'open', bucket: 'all_open' }), CTX),
    ).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// applyGalleryLens invariants
// ══════════════════════════════════════════════════════════════

describe('applyGalleryLens', () => {
  const cards = [
    card({ debateId: 'a', hasNoRebuttal: true }),
    card({ debateId: 'b', hasNoRebuttal: false }),
    card({ debateId: 'c', hasNoRebuttal: false }),
  ];

  it('returns one LensedItem per input card — length never changes — for every lens', () => {
    for (const lens of ALL_FOCUS_LENSES) {
      const result = applyGalleryLens(cards, lens, CTX);
      expect(result.items.length).toBe(cards.length);
    }
  });

  it('none keeps every card bright with no empty state', () => {
    const result = applyGalleryLens(cards, 'none', CTX);
    expect(result.items.every((i) => i.emphasis === 'bright')).toBe(true);
    expect(result.isEmpty).toBe(false);
    expect(result.matchCount).toBe(3);
  });

  it('a lens with some matches dims the non-matching cards only', () => {
    const result = applyGalleryLens(cards, 'no_rebuttal', CTX);
    expect(result.matchCount).toBe(1);
    expect(result.isEmpty).toBe(false);
    const byId = new Map(result.items.map((i) => [i.item.debateId, i.emphasis]));
    expect(byId.get('a')).toBe('bright'); // matches
    expect(byId.get('b')).toBe('dimmed'); // does not
    expect(byId.get('c')).toBe('dimmed');
  });

  it('a lens that matches zero cards sets isEmpty and forces every card bright', () => {
    const allAnswered = [
      card({ debateId: 'x', hasNoRebuttal: false }),
      card({ debateId: 'y', hasNoRebuttal: false }),
    ];
    const result = applyGalleryLens(allAnswered, 'no_rebuttal', CTX);
    expect(result.isEmpty).toBe(true);
    expect(result.matchCount).toBe(0);
    expect(result.items.every((i) => i.emphasis === 'bright')).toBe(true);
  });

  it('a lens that matches every card dims none', () => {
    const allNoRebuttal = [
      card({ debateId: 'x', hasNoRebuttal: true }),
      card({ debateId: 'y', hasNoRebuttal: true }),
    ];
    const result = applyGalleryLens(allNoRebuttal, 'no_rebuttal', CTX);
    expect(result.isEmpty).toBe(false);
    expect(result.matchCount).toBe(2);
    expect(result.items.every((i) => i.emphasis === 'bright')).toBe(true);
  });

  it('handles an empty card list', () => {
    expect(applyGalleryLens([], 'none', CTX)).toEqual({ items: [], matchCount: 0, isEmpty: false });
    const lensed = applyGalleryLens([], 'no_rebuttal', CTX);
    expect(lensed).toEqual({ items: [], matchCount: 0, isEmpty: true });
  });

  it('never emits an emphasis other than bright or dimmed (lenses dim, never delete)', () => {
    for (const lens of ALL_FOCUS_LENSES) {
      const result = applyGalleryLens(cards, lens, CTX);
      for (const lensed of result.items) {
        expect(['bright', 'dimmed']).toContain(lensed.emphasis);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Timeline lens predicates + applyTimelineLens
// ══════════════════════════════════════════════════════════════

const TL_CTX: TimelineLensContext = { activePathIds: new Set<string>() };

describe('timeline lens predicates', () => {
  it('none matches every node', () => {
    expect(TIMELINE_LENS_PREDICATES.none(node(), TL_CTX)).toBe(true);
  });

  it('needs_response — lifecycle-loaded reads the per-node state', () => {
    expect(TIMELINE_LENS_PREDICATES.needs_response(node({ lifecycleState: 'open' }), TL_CTX)).toBe(
      true,
    );
    expect(
      TIMELINE_LENS_PREDICATES.needs_response(
        node({ lifecycleState: 'archived_or_resolved' }),
        TL_CTX,
      ),
    ).toBe(false);
  });

  it('needs_response — lifecycle-absent falls back to a warm/hot tone band', () => {
    expect(
      TIMELINE_LENS_PREDICATES.needs_response(node({ temperatureBand: 'warm' }), TL_CTX),
    ).toBe(true);
    expect(TIMELINE_LENS_PREDICATES.needs_response(node({ temperatureBand: 'hot' }), TL_CTX)).toBe(
      true,
    );
    expect(
      TIMELINE_LENS_PREDICATES.needs_response(node({ temperatureBand: 'cool' }), TL_CTX),
    ).toBe(false);
  });

  it('no_rebuttal — true for a root node with no child edge', () => {
    expect(TIMELINE_LENS_PREDICATES.no_rebuttal(node({ isRoot: true }), TL_CTX)).toBe(true);
  });

  it('no_rebuttal — false once the node has a child edge', () => {
    const ctxWithChild: TimelineLensContext = {
      activePathIds: new Set(),
      nodeIdsWithChildren: new Set(['m-1']),
    };
    expect(
      TIMELINE_LENS_PREDICATES.no_rebuttal(node({ messageId: 'm-1', isRoot: true }), ctxWithChild),
    ).toBe(false);
  });

  it('no_rebuttal — lifecycle-loaded prefers the open state over isRoot', () => {
    expect(
      TIMELINE_LENS_PREDICATES.no_rebuttal(node({ isRoot: false, lifecycleState: 'open' }), TL_CTX),
    ).toBe(true);
    expect(
      TIMELINE_LENS_PREDICATES.no_rebuttal(
        node({ isRoot: true, lifecycleState: 'rebutted' }),
        TL_CTX,
      ),
    ).toBe(false);
  });

  it('heating_up / hot read the temperature band', () => {
    expect(TIMELINE_LENS_PREDICATES.heating_up(node({ temperatureBand: 'warm' }), TL_CTX)).toBe(
      true,
    );
    expect(TIMELINE_LENS_PREDICATES.heating_up(node({ temperatureBand: 'hot' }), TL_CTX)).toBe(
      false,
    );
    expect(TIMELINE_LENS_PREDICATES.hot(node({ temperatureBand: 'hot' }), TL_CTX)).toBe(true);
    expect(TIMELINE_LENS_PREDICATES.hot(node({ temperatureBand: 'warm' }), TL_CTX)).toBe(false);
  });

  it('evidence_requested — lifecycle-loaded vs kind-family fallback', () => {
    expect(
      TIMELINE_LENS_PREDICATES.evidence_requested(
        node({ lifecycleState: 'source_requested' }),
        TL_CTX,
      ),
    ).toBe(true);
    expect(
      TIMELINE_LENS_PREDICATES.evidence_requested(
        node({ kindColorFamily: 'evidence' }),
        TL_CTX,
      ),
    ).toBe(true);
    expect(
      TIMELINE_LENS_PREDICATES.evidence_requested(node({ kindColorFamily: 'claim' }), TL_CTX),
    ).toBe(false);
  });

  it('source_chain_pressure reads the evidence kind family', () => {
    expect(
      TIMELINE_LENS_PREDICATES.source_chain_pressure(
        node({ kindColorFamily: 'evidence' }),
        TL_CTX,
      ),
    ).toBe(true);
    expect(
      TIMELINE_LENS_PREDICATES.source_chain_pressure(node({ kindColorFamily: 'claim' }), TL_CTX),
    ).toBe(false);
  });

  it('the room-level lenses match no node (safe no-op on the board)', () => {
    for (const galleryOnly of [
      'quiet_plain',
      'private_invites',
      'my_active_rooms',
      'recently_updated',
      'settled_locked',
    ] as const) {
      expect(TIMELINE_LENS_PREDICATES[galleryOnly](node(), TL_CTX)).toBe(false);
    }
  });
});

describe('activePathLens', () => {
  it('is true only for nodes on the active path (topology, not stage)', () => {
    const ctx: TimelineLensContext = { activePathIds: new Set(['m-1', 'm-3']) };
    expect(activePathLens(node({ messageId: 'm-1' }), ctx)).toBe(true);
    expect(activePathLens(node({ messageId: 'm-2' }), ctx)).toBe(false);
  });
});

describe('applyTimelineLens', () => {
  const nodes = [
    node({ messageId: 'n1', temperatureBand: 'hot' }),
    node({ messageId: 'n2', temperatureBand: 'cool' }),
  ];

  it('returns one item per node — length never changes — for every timeline lens', () => {
    for (const lens of TIMELINE_LENS_IDS) {
      const result = applyTimelineLens(nodes, lens, TL_CTX);
      expect(result.items.length).toBe(nodes.length);
    }
  });

  it('dims non-matching nodes for a matching lens', () => {
    const result = applyTimelineLens(nodes, 'hot', TL_CTX);
    expect(result.matchCount).toBe(1);
    const byId = new Map(result.items.map((i) => [i.item.messageId, i.emphasis]));
    expect(byId.get('n1')).toBe('bright');
    expect(byId.get('n2')).toBe('dimmed');
  });

  it('a zero-match lens forces every node bright and sets isEmpty', () => {
    const coolOnly = [node({ messageId: 'a', temperatureBand: 'cool' })];
    const result = applyTimelineLens(coolOnly, 'hot', TL_CTX);
    expect(result.isEmpty).toBe(true);
    expect(result.items.every((i) => i.emphasis === 'bright')).toBe(true);
  });

  it('a gallery-only lens leaves the whole board bright (never silently empties it)', () => {
    const result = applyTimelineLens(nodes, 'settled_locked', TL_CTX);
    expect(result.matchCount).toBe(0);
    expect(result.isEmpty).toBe(true);
    expect(result.items.every((i) => i.emphasis === 'bright')).toBe(true);
  });

  it('never emits an emphasis other than bright or dimmed', () => {
    for (const lens of ALL_FOCUS_LENSES) {
      const result = applyTimelineLens(nodes, lens, TL_CTX);
      for (const lensed of result.items) {
        expect(['bright', 'dimmed']).toContain(lensed.emphasis);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Sort
// ══════════════════════════════════════════════════════════════

describe('toConversationSortMode', () => {
  it('maps the 3 coarse axes to the shipped ConversationSortMode values', () => {
    expect(toConversationSortMode('by_created')).toBe('newest_created');
    expect(toConversationSortMode('by_activity')).toBe('latest_activity');
    expect(toConversationSortMode('by_engagement_state')).toBe('needs_rebuttal_first');
  });

  it('ALL_GALLERY_SORT_AXES lists exactly the 3 axes', () => {
    expect([...ALL_GALLERY_SORT_AXES]).toEqual([
      'by_created',
      'by_activity',
      'by_engagement_state',
    ]);
  });
});

describe('sort axes drive sortConversationGalleryCards correctly', () => {
  const older = card({
    debateId: 'older',
    hasNoRebuttal: false,
    createdAt: isoAt(BASE_MS - 100_000),
    sortKeys: {
      ...card().sortKeys,
      createdAtMs: BASE_MS - 100_000,
      latestActivityMs: BASE_MS - 50_000,
      needsRebuttalFlag: 0,
    },
  });
  const newer = card({
    debateId: 'newer',
    hasNoRebuttal: true,
    createdAt: isoAt(BASE_MS),
    sortKeys: {
      ...card().sortKeys,
      createdAtMs: BASE_MS,
      latestActivityMs: BASE_MS - 90_000,
      needsRebuttalFlag: 1,
    },
  });

  it('by_created — newest created first', () => {
    const sorted = sortConversationGalleryCards([older, newer], toConversationSortMode('by_created'));
    expect(sorted.map((c) => c.debateId)).toEqual(['newer', 'older']);
  });

  it('by_activity — most recent activity first', () => {
    const sorted = sortConversationGalleryCards(
      [newer, older],
      toConversationSortMode('by_activity'),
    );
    expect(sorted.map((c) => c.debateId)).toEqual(['older', 'newer']);
  });

  it('by_engagement_state — needs-rebuttal cards first', () => {
    const sorted = sortConversationGalleryCards(
      [older, newer],
      toConversationSortMode('by_engagement_state'),
    );
    expect(sorted[0].debateId).toBe('newer');
  });
});

// ══════════════════════════════════════════════════════════════
// View config
// ══════════════════════════════════════════════════════════════

describe('DEFAULT_DENSITY_LENS_VIEW_CONFIG', () => {
  it('seeds normal density, no lens, activity sort, page 0', () => {
    expect(DEFAULT_DENSITY_LENS_VIEW_CONFIG.density).toBe('normal');
    expect(DEFAULT_DENSITY_LENS_VIEW_CONFIG.lens).toBe('none');
    expect(DEFAULT_DENSITY_LENS_VIEW_CONFIG.sortAxis).toBe('by_activity');
    expect(DEFAULT_DENSITY_LENS_VIEW_CONFIG.searchQuery).toBe('');
    expect(DEFAULT_DENSITY_LENS_VIEW_CONFIG.pageIndex).toBe(0);
    expect(DEFAULT_DENSITY_LENS_VIEW_CONFIG.pageSize).toBe(24);
  });
});

describe('applyViewConfigChange — page-reset rules', () => {
  const onPage3: typeof DEFAULT_DENSITY_LENS_VIEW_CONFIG = {
    ...DEFAULT_DENSITY_LENS_VIEW_CONFIG,
    pageIndex: 3,
  };

  it('a searchQuery change resets pageIndex to 0', () => {
    const next = applyViewConfigChange(onPage3, { searchQuery: 'bike' });
    expect(next.pageIndex).toBe(0);
    expect(next.searchQuery).toBe('bike');
  });

  it('a sortAxis change resets pageIndex to 0', () => {
    const next = applyViewConfigChange(onPage3, { sortAxis: 'by_created' });
    expect(next.pageIndex).toBe(0);
  });

  it('a density change does NOT reset the page (density never changes membership)', () => {
    const next = applyViewConfigChange(onPage3, { density: 'scan' });
    expect(next.pageIndex).toBe(3);
    expect(next.density).toBe('scan');
  });

  it('a lens change does NOT reset the page (a lens dims, never removes)', () => {
    const next = applyViewConfigChange(onPage3, { lens: 'hot' });
    expect(next.pageIndex).toBe(3);
    expect(next.lens).toBe('hot');
  });

  it('an explicit pageIndex patch is honoured', () => {
    const next = applyViewConfigChange(DEFAULT_DENSITY_LENS_VIEW_CONFIG, { pageIndex: 5 });
    expect(next.pageIndex).toBe(5);
  });

  it('does not reset the page when searchQuery is patched to the same value', () => {
    const withQuery = { ...onPage3, searchQuery: 'bike' };
    const next = applyViewConfigChange(withQuery, { searchQuery: 'bike' });
    expect(next.pageIndex).toBe(3);
  });

  it('never mutates the previous config', () => {
    const frozen = { ...DEFAULT_DENSITY_LENS_VIEW_CONFIG, pageIndex: 3 };
    const snapshot = { ...frozen };
    applyViewConfigChange(frozen, { searchQuery: 'x', density: 'compact' });
    expect(frozen).toEqual(snapshot);
  });
});

// ══════════════════════════════════════════════════════════════
// Determinism
// ══════════════════════════════════════════════════════════════

describe('determinism', () => {
  const cards = [card({ debateId: 'a', hasNoRebuttal: true }), card({ debateId: 'b' })];

  it('applyGalleryLens returns deep-equal output across two calls', () => {
    const first = applyGalleryLens(cards, 'no_rebuttal', { nowMs: BASE_MS });
    const second = applyGalleryLens(cards, 'no_rebuttal', { nowMs: BASE_MS });
    expect(first).toEqual(second);
  });

  it('recency uses the injected nowMs, not a wall clock', () => {
    const recent = card({ sortKeys: { ...card().sortKeys, latestActivityMs: 5_000 } });
    // With nowMs just after the activity, the card is "recent".
    expect(GALLERY_LENS_PREDICATES.recently_updated(recent, { nowMs: 6_000 })).toBe(true);
    // With nowMs far in the future, the same card is no longer recent —
    // proving the function read ctx.nowMs and never Date.now().
    expect(
      GALLERY_LENS_PREDICATES.recently_updated(recent, {
        nowMs: 5_000 + RECENTLY_UPDATED_WINDOW_MS + 1,
      }),
    ).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// Dedupe rule adoption (IX-001 documents conversationGalleryModel's rule)
// ══════════════════════════════════════════════════════════════

describe('dedupe — one card per conversation (IX-001 §5 documented rule)', () => {
  it('collapses N corpus-suffixed debates sharing a cleaned title + root body into 1 card', () => {
    const ROOT =
      'Protected bike lanes reduce cyclist injury rates and reclaim curb space for transit.';
    const debates: Debate[] = [
      debate({ id: 'd1', title: 'Bike lanes [xai-adv 9018694f c45188c5]' }),
      debate({ id: 'd2', title: 'Bike lanes [ai-corpus fa172432 ai-seed-bike]' }),
      debate({ id: 'd3', title: 'Bike lanes [stress-2026-05-17 #scenario-7]' }),
    ];
    const argumentsByDebateId: Record<string, GalleryArgumentInput[]> = {
      d1: [arg({ id: 'a1', debateId: 'd1', body: ROOT })],
      d2: [arg({ id: 'a2', debateId: 'd2', body: ROOT })],
      d3: [arg({ id: 'a3', debateId: 'd3', body: ROOT })],
    };
    const built = buildConversationGalleryCards({
      debates,
      argumentsByDebateId,
      nowMs: BASE_MS,
    });
    const deduped = dedupeConversationCards(built, 'collapse_generated');
    expect(deduped.length).toBe(1);
    expect(deduped[0].duplicateCount).toBe(3);
    expect(deduped[0].duplicateDebateIds.sort()).toEqual(['d1', 'd2', 'd3']);
  });

  it('keeps two genuinely unrelated rooms as separate cards (tier-4 key — no over-merge)', () => {
    const debates: Debate[] = [
      debate({ id: 'd1', title: 'Bike lanes debate', resolution: 'Cities should add bike lanes.' }),
      debate({
        id: 'd2',
        title: 'Pitch clock debate',
        resolution: 'Baseball should keep the pitch clock.',
      }),
    ];
    const built = buildConversationGalleryCards({ debates, nowMs: BASE_MS });
    const deduped = dedupeConversationCards(built, 'collapse_generated');
    expect(deduped.length).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════
// Lens / dedupe composition order (IX-001 §5.3)
// ══════════════════════════════════════════════════════════════

describe('lens composes on top of dedupe — never changes membership', () => {
  it('applyGalleryLens preserves the deduped list length exactly', () => {
    const deduped: ConversationGalleryCard[] = [
      card({ debateId: 'p1', hasNoRebuttal: true }),
      card({ debateId: 'p2', hasNoRebuttal: false }),
    ];
    const lensed = applyGalleryLens(deduped, 'needs_response', CTX);
    expect(lensed.items.length).toBe(deduped.length);
    // Each card object is carried through unmodified.
    expect(lensed.items.map((i) => i.item.debateId)).toEqual(['p1', 'p2']);
  });
});
