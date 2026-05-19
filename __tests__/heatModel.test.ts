/**
 * SW-002 — Heat / momentum / trend model tests.
 *
 * Pure-TS deriver tests. No React, no Supabase, no network.
 *
 * Coverage matrix (per design doc `docs/designs/SW-002.md`):
 *   - Union reach for `HeatLevel`, `MomentumState`, `TrendDirection`,
 *     `ActivityChip['kind']`, `EntryOpportunity`.
 *   - Doctrine ban-list scan on every helper-line literal.
 *   - `hot` carve-out pinned with inline doctrine citation.
 *   - Snake_case ban on rendered helper-line strings.
 *   - Determinism + idempotency.
 *   - Cool-room default + null input handling.
 *   - Threshold normalization + defensive swap.
 *   - Forbidden-imports source scan.
 *   - Type-only import scan for cross-module dependencies.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ACTIVITY_HELPER_LINES,
  ALL_ACTIVITY_CHIP_KINDS,
  ALL_ENTRY_OPPORTUNITIES,
  ALL_HEAT_LEVELS,
  ALL_MOMENTUM_STATES,
  ALL_TREND_DIRECTIONS,
  DEFAULT_ACTIVITY_THRESHOLDS,
  _forbiddenActivityTokens,
  deriveRoomActivityChips,
  deriveRoomActivityProfile,
  type ActivityChip,
  type ActivityChipKind,
  type ActivityThresholds,
  type EntryOpportunity,
  type HeatInputBundle,
  type HeatLevel,
  type MomentumState,
  type RoomActivityProfile,
  type TrendDirection,
} from '../src/features/strengthWeakness';
import type {
  AutoMetadataCode,
  ClusterMetadataSummary,
  ManualTagCode,
  MoveMetadataLedger,
} from '../src/features/metadata';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleState,
} from '../src/features/lifecycle';
import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { LIFECYCLE_UX_MAP } from '../src/features/rulesUx/lifecycleUxMap';

// ── Fixture clock — frozen for determinism ───────────────────

const T0_MS = new Date('2026-05-18T12:00:00.000Z').getTime();

// ── Fixture builders ─────────────────────────────────────────

function isoMinusMinutes(min: number): string {
  return new Date(T0_MS - min * 60 * 1000).toISOString();
}

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? isoMinusMinutes(60),
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 11:00',
    relativeLabel: over.relativeLabel ?? 'now',
    actorLabel: over.actorLabel ?? 'You',
    kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: over.bodyPreview ?? 'body',
    badges: over.badges ?? [],
    droppedTags: over.droppedTags ?? [],
    depth: over.depth ?? 0,
    lane: over.lane ?? 0,
    siblingIndex: over.siblingIndex ?? 0,
    replyCount: over.replyCount ?? 0,
    descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? 'branch-root-m1',
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: over.junctionGroupId ?? null,
    isJunction: over.isJunction ?? false,
    junctionChildCount: over.junctionChildCount ?? 0,
    isActive: over.isActive ?? false,
    isLatest: over.isLatest ?? false,
    isDetached: over.isDetached ?? false,
    isActivePath: over.isActivePath ?? false,
    isRoot: over.isRoot ?? false,
    isFirstRebuttal: over.isFirstRebuttal ?? false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: over.kindColor ?? '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: over.x ?? 0,
    y: over.y ?? 100,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
  };
}

function buildTimelineMap(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapModel {
  const edges: ArgumentTimelineMapEdge[] = nodes
    .filter((n) => n.parentId !== null)
    .map((n) => ({
      edgeId: `e-${n.parentId}-${n.messageId}`,
      fromMessageId: n.parentId as string,
      toMessageId: n.messageId,
      x1: 0,
      y1: 100,
      x2: 0,
      y2: 100,
      fromLane: 0,
      toLane: n.lane,
      isActivePath: false,
      isDetached: n.isDetached,
      isFirstClash: false,
      kindColor: n.kindColor,
      standingColor: '#64748b',
      toneColor: '#64748b',
      gradientStops: [],
    }));
  return {
    nodes,
    edges,
    bands: [],
    activeNode: null,
    latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: [],
    width: 800,
    height: 240,
    scrollWidth: 800,
    beginningLabel: '',
    middleLabel: '',
    endLabel: '',
    participantTrends: [],
    legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false,
    rootOnboardingHint: null,
    showBackToRootControl: false,
  };
}

function fakeLifecycleCluster(
  over: Partial<PointLifecycleClusterSummary> = {},
): PointLifecycleClusterSummary {
  return {
    clusterId: over.clusterId ?? 'c1',
    rootMessageId: over.rootMessageId ?? 'm1',
    state: (over.state ?? 'open') as PointLifecycleState,
    plainLabel: over.plainLabel ?? 'Open',
    messageIds: over.messageIds ?? ['m1'],
    memberCount: over.memberCount ?? 1,
    affirmativeMoveCount: over.affirmativeMoveCount ?? 0,
    negativeMoveCount: over.negativeMoveCount ?? 0,
    observerMoveCount: over.observerMoveCount ?? 0,
    hasOpenSourceOrQuoteRequest: over.hasOpenSourceOrQuoteRequest ?? false,
    hasConcessionOrSynthesisMove: over.hasConcessionOrSynthesisMove ?? false,
    worstEvidenceStatus: over.worstEvidenceStatus ?? 'no_source',
    primaryAxis: over.primaryAxis ?? null,
    isAdvisory: over.isAdvisory ?? false,
  };
}

function buildLifecycleMap(
  clusters: PointLifecycleClusterSummary[],
): PointLifecycleMap {
  const byCluster = new Map<string, PointLifecycleClusterSummary>();
  for (const c of clusters) byCluster.set(c.clusterId, c);
  return {
    byCluster,
    byMessage: new Map(),
    clusterOrder: clusters.map((c) => c.clusterId),
    cumulativeStateSequence: clusters.map((c) => c.state),
    inputHash: 'hash-' + clusters.map((c) => c.clusterId).join('-'),
  };
}

function fakeMetadataSummary(
  over: Partial<ClusterMetadataSummary> = {},
): ClusterMetadataSummary {
  return {
    clusterId: over.clusterId ?? 'c1',
    manualTagCodes: (over.manualTagCodes ?? []) as ReadonlyArray<ManualTagCode>,
    autoMetadataCodes: (over.autoMetadataCodes ?? []) as ReadonlyArray<AutoMetadataCode>,
    lifecycleState: (over.lifecycleState ?? 'open') as PointLifecycleState,
    lastManualTagAt: over.lastManualTagAt ?? null,
    taggingParticipantCount: over.taggingParticipantCount ?? 0,
  };
}

function buildMetadataLedger(summaries: ClusterMetadataSummary[]): MoveMetadataLedger {
  const byCluster = new Map<string, ClusterMetadataSummary>();
  for (const s of summaries) byCluster.set(s.clusterId, s);
  return {
    byMessage: new Map(),
    byCluster,
    metadataEvents: [],
    messageOrder: [],
    inputHash: 'mhash-' + summaries.map((s) => s.clusterId).join('-'),
  };
}

function bundle(over: Partial<HeatInputBundle> = {}): HeatInputBundle {
  return {
    timelineMap: over.timelineMap ?? null,
    lifecycleMap: over.lifecycleMap ?? null,
    metadataLedger: over.metadataLedger ?? null,
    clockMs: over.clockMs ?? T0_MS,
    recentWindowMs: over.recentWindowMs,
    comparisonWindowMs: over.comparisonWindowMs,
    thresholds: over.thresholds,
  };
}

// Build a hot-room fixture: 8 recent moves, root unanswered scenario
// uses a *detached* "root" — easier to compose without bending counts.
function buildHotRoomFixture(): HeatInputBundle {
  const root = fakeNode({
    messageId: 'r',
    isRoot: true,
    replyCount: 8,
    kindLabel: 'claim',
    createdAt: isoMinusMinutes(180),
    branchRootMessageId: 'r',
    branchId: 'branch-root-r',
  });
  const recent: ArgumentTimelineMapNode[] = [];
  for (let i = 1; i <= 8; i++) {
    recent.push(
      fakeNode({
        messageId: `m${i}`,
        parentId: i === 1 ? 'r' : `m${i - 1}`,
        ordinal: i + 1,
        depth: i,
        lane: i % 3,
        branchId: 'branch-root-r',
        branchRootMessageId: 'r',
        kindLabel: 'rebuttal',
        createdAt: isoMinusMinutes(60 - i),
      }),
    );
  }
  return bundle({
    timelineMap: buildTimelineMap([root, ...recent]),
    lifecycleMap: buildLifecycleMap([
      fakeLifecycleCluster({
        clusterId: 'c-r',
        rootMessageId: 'r',
        state: 'rebutted',
        memberCount: 9,
        affirmativeMoveCount: 4,
        negativeMoveCount: 5,
      }),
    ]),
    metadataLedger: buildMetadataLedger([
      fakeMetadataSummary({
        clusterId: 'c-r',
        autoMetadataCodes: ['repeated_axis_pressure'],
        lifecycleState: 'rebutted',
      }),
    ]),
  });
}

// Build a cooling-room fixture: many old moves, 1 recent.
function buildCoolingRoomFixture(): HeatInputBundle {
  const nodes: ArgumentTimelineMapNode[] = [];
  const root = fakeNode({
    messageId: 'r',
    isRoot: true,
    replyCount: 6,
    kindLabel: 'claim',
    createdAt: isoMinusMinutes(60 * 24 * 5), // 5 days ago
    branchRootMessageId: 'r',
    branchId: 'branch-root-r',
  });
  nodes.push(root);
  // 6 older moves in the comparison window (between 24h and 96h ago).
  for (let i = 1; i <= 6; i++) {
    nodes.push(
      fakeNode({
        messageId: `o${i}`,
        parentId: i === 1 ? 'r' : `o${i - 1}`,
        ordinal: i + 1,
        depth: i,
        branchId: 'branch-root-r',
        branchRootMessageId: 'r',
        kindLabel: 'rebuttal',
        // Place them between 30h and 80h before now.
        createdAt: isoMinusMinutes(60 * (30 + i * 8)),
      }),
    );
  }
  // 1 recent move (within the 24h window) — should classify as quiet.
  nodes.push(
    fakeNode({
      messageId: 'r1',
      parentId: 'o6',
      ordinal: 100,
      depth: 7,
      branchId: 'branch-root-r',
      branchRootMessageId: 'r',
      kindLabel: 'rebuttal',
      createdAt: isoMinusMinutes(60),
    }),
  );
  return bundle({
    timelineMap: buildTimelineMap(nodes),
    lifecycleMap: buildLifecycleMap([
      fakeLifecycleCluster({
        clusterId: 'c-r',
        rootMessageId: 'r',
        state: 'rebutted',
        memberCount: 8,
      }),
    ]),
    metadataLedger: buildMetadataLedger([]),
  });
}

// ── Vocabulary reach ─────────────────────────────────────────

describe('SW-002 — vocabulary reach', () => {
  it('exposes exactly the three locked HeatLevel values', () => {
    expect([...ALL_HEAT_LEVELS]).toEqual(['quiet', 'active', 'hot']);
  });

  it('exposes exactly the three locked MomentumState values', () => {
    expect([...ALL_MOMENTUM_STATES]).toEqual(['cooling', 'steady', 'building']);
  });

  it('exposes exactly the three locked TrendDirection values', () => {
    expect([...ALL_TREND_DIRECTIONS]).toEqual([
      'unresolved_open',
      'narrowing_toward_synthesis',
      'branch_proliferating',
    ]);
  });

  it('exposes exactly the 8 locked ActivityChip kinds', () => {
    expect([...ALL_ACTIVITY_CHIP_KINDS]).toEqual([
      'recent_post',
      'open_source_request',
      'repeated_axis_pressure',
      'no_rebuttal',
      'synthesis_ready',
      'branch_tangent',
      'evidence_debt_open',
      'cool_room_easy_entry',
    ]);
  });

  it('exposes exactly the three locked EntryOpportunity values', () => {
    expect([...ALL_ENTRY_OPPORTUNITIES]).toEqual([
      'easy_first_move',
      'mid_thread_join',
      'deep_existing_clash',
    ]);
  });
});

// ── Cool-room default + null handling ────────────────────────

describe('SW-002 — cool-room default + null handling', () => {
  it('empty timelineMap → cool-room default', () => {
    const profile = deriveRoomActivityProfile(bundle({}));
    expect(profile.heatLevel).toBe<HeatLevel>('quiet');
    expect(profile.momentumState).toBe<MomentumState>('steady');
    expect(profile.trendDirection).toBe<TrendDirection>('unresolved_open');
    expect(profile.segments).toEqual([]);
    expect(profile.entryOpportunity).toBe<EntryOpportunity>('easy_first_move');
  });

  it('null timelineMap → cool-room default', () => {
    const profile = deriveRoomActivityProfile(
      bundle({ timelineMap: null, lifecycleMap: buildLifecycleMap([]), metadataLedger: buildMetadataLedger([]) }),
    );
    expect(profile.heatLevel).toBe('quiet');
    expect(profile.entryOpportunity).toBe('easy_first_move');
  });

  it('null lifecycleMap → does not throw; still returns a valid profile', () => {
    const node = fakeNode({ isRoot: true });
    const profile = deriveRoomActivityProfile(
      bundle({ timelineMap: buildTimelineMap([node]), lifecycleMap: null, metadataLedger: null }),
    );
    expect(ALL_HEAT_LEVELS).toContain(profile.heatLevel);
    expect(ALL_TREND_DIRECTIONS).toContain(profile.trendDirection);
  });

  it('null metadataLedger → does not throw; still returns a valid profile', () => {
    const node = fakeNode({ isRoot: true });
    const profile = deriveRoomActivityProfile(
      bundle({ timelineMap: buildTimelineMap([node]), lifecycleMap: buildLifecycleMap([]), metadataLedger: null }),
    );
    expect(ALL_HEAT_LEVELS).toContain(profile.heatLevel);
  });

  it('NaN clockMs → does not throw, treats as 0; returns valid profile', () => {
    const profile = deriveRoomActivityProfile(
      bundle({
        clockMs: Number.NaN,
        timelineMap: buildTimelineMap([fakeNode({ isRoot: true })]),
      }),
    );
    expect(profile).toBeDefined();
    expect(ALL_HEAT_LEVELS).toContain(profile.heatLevel);
  });
});

// ── Determinism / idempotency ────────────────────────────────

describe('SW-002 — determinism', () => {
  it('same input twice → deep-equal output', () => {
    const a = deriveRoomActivityProfile(buildHotRoomFixture());
    const b = deriveRoomActivityProfile(buildHotRoomFixture());
    expect(a).toEqual(b);
  });

  it('idempotent across 10 repeated calls (same thresholds)', () => {
    const fixture = buildHotRoomFixture();
    const first = deriveRoomActivityProfile(fixture);
    for (let i = 0; i < 10; i++) {
      expect(deriveRoomActivityProfile(fixture)).toEqual(first);
    }
  });

  it('two different clockMs values produce different recent-window slices', () => {
    const fixture = buildHotRoomFixture();
    const sameClock = deriveRoomActivityProfile(fixture);
    const muchLater = deriveRoomActivityProfile({
      ...fixture,
      clockMs: T0_MS + 1000 * 60 * 60 * 48, // 48h later
    });
    expect(sameClock.heatLevel).toBe<HeatLevel>('hot');
    // 48h later, none of the recent posts are within the 24h window → quiet.
    expect(muchLater.heatLevel).toBe<HeatLevel>('quiet');
  });
});

// ── Heat / Momentum / Trend reach ────────────────────────────

describe('SW-002 — heat reach', () => {
  it('produces quiet for an empty timeline', () => {
    expect(deriveRoomActivityProfile(bundle({})).heatLevel).toBe<HeatLevel>('quiet');
  });

  it('produces active for a moderate recent move count', () => {
    const nodes: ArgumentTimelineMapNode[] = [fakeNode({ isRoot: true, replyCount: 3 })];
    for (let i = 1; i <= 3; i++) {
      nodes.push(
        fakeNode({
          messageId: `m${i}`,
          parentId: i === 1 ? 'm1' : `m${i - 1}`,
          ordinal: i + 1,
          depth: i,
          kindLabel: 'rebuttal',
          createdAt: isoMinusMinutes(60 - i * 2),
        }),
      );
    }
    const profile = deriveRoomActivityProfile(bundle({ timelineMap: buildTimelineMap(nodes) }));
    expect(profile.heatLevel).toBe<HeatLevel>('active');
  });

  it('produces hot for a heavy recent move count', () => {
    expect(deriveRoomActivityProfile(buildHotRoomFixture()).heatLevel).toBe<HeatLevel>('hot');
  });
});

describe('SW-002 — momentum reach', () => {
  it('cooling: many old, very few recent → cooling', () => {
    expect(deriveRoomActivityProfile(buildCoolingRoomFixture()).momentumState).toBe<MomentumState>(
      'cooling',
    );
  });

  it('steady: no nodes → steady', () => {
    expect(deriveRoomActivityProfile(bundle({})).momentumState).toBe<MomentumState>('steady');
  });

  it('building: many recent, no earlier window → building', () => {
    expect(deriveRoomActivityProfile(buildHotRoomFixture()).momentumState).toBe<MomentumState>(
      'building',
    );
  });
});

describe('SW-002 — trend reach', () => {
  it('unresolved_open: ordinary active room with no synthesis-ready cluster', () => {
    expect(deriveRoomActivityProfile(buildHotRoomFixture()).trendDirection).toBe<TrendDirection>(
      'unresolved_open',
    );
  });

  it('narrowing_toward_synthesis: at least one synthesis_ready cluster', () => {
    const nodes: ArgumentTimelineMapNode[] = [
      fakeNode({ isRoot: true, replyCount: 1, createdAt: isoMinusMinutes(120) }),
      fakeNode({
        messageId: 'm2',
        parentId: 'm1',
        depth: 1,
        ordinal: 2,
        kindLabel: 'synthesis',
        createdAt: isoMinusMinutes(30),
      }),
    ];
    const profile = deriveRoomActivityProfile(
      bundle({
        timelineMap: buildTimelineMap(nodes),
        lifecycleMap: buildLifecycleMap([
          fakeLifecycleCluster({ clusterId: 'c-r', rootMessageId: 'm1', state: 'synthesis_ready' }),
        ]),
      }),
    );
    expect(profile.trendDirection).toBe<TrendDirection>('narrowing_toward_synthesis');
  });

  it('branch_proliferating: 3+ active branches in recent window', () => {
    const root = fakeNode({
      isRoot: true,
      replyCount: 6,
      createdAt: isoMinusMinutes(120),
    });
    const branches: ArgumentTimelineMapNode[] = [];
    for (let b = 0; b < 4; b++) {
      branches.push(
        fakeNode({
          messageId: `b${b}-m1`,
          parentId: 'm1',
          ordinal: 2 + b * 2,
          depth: 1,
          branchId: `branch-${b}`,
          branchRootMessageId: 'm1',
          kindLabel: 'rebuttal',
          createdAt: isoMinusMinutes(30 - b),
        }),
      );
      branches.push(
        fakeNode({
          messageId: `b${b}-m2`,
          parentId: `b${b}-m1`,
          ordinal: 3 + b * 2,
          depth: 2,
          branchId: `branch-${b}`,
          branchRootMessageId: 'm1',
          kindLabel: 'rebuttal',
          createdAt: isoMinusMinutes(25 - b),
        }),
      );
    }
    const profile = deriveRoomActivityProfile(
      bundle({ timelineMap: buildTimelineMap([root, ...branches]) }),
    );
    expect(profile.trendDirection).toBe<TrendDirection>('branch_proliferating');
  });
});

// ── Activity chip reach ──────────────────────────────────────

describe('SW-002 — activity chip reach', () => {
  it('recent_post chip: any recent activity surfaces it', () => {
    const chips = deriveRoomActivityChips(buildHotRoomFixture());
    expect(chips.map((c) => c.kind)).toContain('recent_post');
  });

  it('open_source_request chip: cluster with open source request', () => {
    const profile = deriveRoomActivityProfile(
      bundle({
        timelineMap: buildTimelineMap([fakeNode({ isRoot: true, replyCount: 1 })]),
        lifecycleMap: buildLifecycleMap([
          fakeLifecycleCluster({
            clusterId: 'c1',
            state: 'source_requested',
            hasOpenSourceOrQuoteRequest: true,
          }),
        ]),
      }),
    );
    const allChipKinds = profile.segments.flatMap((s) => s.reasonChips.map((c) => c.kind));
    expect(allChipKinds).toContain('open_source_request');
  });

  it('repeated_axis_pressure chip: metadata code present', () => {
    const profile = deriveRoomActivityProfile(
      bundle({
        timelineMap: buildTimelineMap([fakeNode({ isRoot: true, replyCount: 1 })]),
        metadataLedger: buildMetadataLedger([
          fakeMetadataSummary({ clusterId: 'c1', autoMetadataCodes: ['repeated_axis_pressure'] }),
        ]),
      }),
    );
    const allChipKinds = profile.segments.flatMap((s) => s.reasonChips.map((c) => c.kind));
    expect(allChipKinds).toContain('repeated_axis_pressure');
  });

  it('no_rebuttal chip: root with replyCount = 0', () => {
    const root = fakeNode({ isRoot: true, replyCount: 0, createdAt: isoMinusMinutes(60) });
    const profile = deriveRoomActivityProfile(bundle({ timelineMap: buildTimelineMap([root]) }));
    const allChipKinds = profile.segments.flatMap((s) => s.reasonChips.map((c) => c.kind));
    expect(allChipKinds).toContain('no_rebuttal');
  });

  it('synthesis_ready chip: lifecycle in synthesis_ready', () => {
    const profile = deriveRoomActivityProfile(
      bundle({
        timelineMap: buildTimelineMap([fakeNode({ isRoot: true, replyCount: 1 })]),
        lifecycleMap: buildLifecycleMap([
          fakeLifecycleCluster({ state: 'synthesis_ready' }),
        ]),
      }),
    );
    const allChipKinds = profile.segments.flatMap((s) => s.reasonChips.map((c) => c.kind));
    expect(allChipKinds).toContain('synthesis_ready');
  });

  it('branch_tangent chip: branch_suggested auto metadata', () => {
    const profile = deriveRoomActivityProfile(
      bundle({
        timelineMap: buildTimelineMap([fakeNode({ isRoot: true, replyCount: 1 })]),
        metadataLedger: buildMetadataLedger([
          fakeMetadataSummary({ clusterId: 'c1', autoMetadataCodes: ['branch_suggested'] }),
        ]),
      }),
    );
    const allChipKinds = profile.segments.flatMap((s) => s.reasonChips.map((c) => c.kind));
    expect(allChipKinds).toContain('branch_tangent');
  });

  it('evidence_debt_open chip: manual evidence_debt tag', () => {
    const profile = deriveRoomActivityProfile(
      bundle({
        timelineMap: buildTimelineMap([fakeNode({ isRoot: true, replyCount: 1 })]),
        metadataLedger: buildMetadataLedger([
          fakeMetadataSummary({ clusterId: 'c1', manualTagCodes: ['evidence_debt'] }),
        ]),
      }),
    );
    const allChipKinds = profile.segments.flatMap((s) => s.reasonChips.map((c) => c.kind));
    expect(allChipKinds).toContain('evidence_debt_open');
  });

  it('cool_room_easy_entry chip: empty room', () => {
    const chips = deriveRoomActivityChips(bundle({}));
    expect(chips.map((c) => c.kind)).toContain('cool_room_easy_entry');
  });
});

// ── Entry opportunity reach ──────────────────────────────────

describe('SW-002 — entry opportunity', () => {
  it('easy_first_move: empty room', () => {
    expect(deriveRoomActivityProfile(bundle({})).entryOpportunity).toBe<EntryOpportunity>(
      'easy_first_move',
    );
  });

  it('easy_first_move: quiet + root unanswered', () => {
    const root = fakeNode({
      isRoot: true,
      replyCount: 0,
      createdAt: isoMinusMinutes(60 * 6),
    });
    const profile = deriveRoomActivityProfile(bundle({ timelineMap: buildTimelineMap([root]) }));
    expect(profile.entryOpportunity).toBe<EntryOpportunity>('easy_first_move');
  });

  it('deep_existing_clash: hot + maxDepth ≥ 4', () => {
    expect(deriveRoomActivityProfile(buildHotRoomFixture()).entryOpportunity).toBe<EntryOpportunity>(
      'deep_existing_clash',
    );
  });

  it('mid_thread_join: active with shallow depth', () => {
    const nodes: ArgumentTimelineMapNode[] = [
      fakeNode({ isRoot: true, replyCount: 3, createdAt: isoMinusMinutes(120) }),
    ];
    for (let i = 1; i <= 3; i++) {
      nodes.push(
        fakeNode({
          messageId: `m${i + 1}`,
          parentId: 'm1',
          ordinal: i + 1,
          depth: 1,
          branchId: `branch-${i}`,
          branchRootMessageId: 'm1',
          kindLabel: 'rebuttal',
          createdAt: isoMinusMinutes(30 - i),
        }),
      );
    }
    const profile = deriveRoomActivityProfile(
      bundle({ timelineMap: buildTimelineMap(nodes) }),
    );
    // 3 active branches in recent window → branch_proliferating; but
    // entry opportunity is computed from heat + depth, not from trend.
    expect(profile.entryOpportunity).toBe<EntryOpportunity>('mid_thread_join');
  });
});

// ── Hot AND no_rebuttal scenario (singled out in design) ─────

describe('SW-002 — hot AND no_rebuttal coexistence', () => {
  it('hot heat does not preempt the no_rebuttal chip when root is unanswered', () => {
    // Build a room with a detached "root" (replyCount=0) plus many recent
    // posts on a separate detached branch — both signals must coexist.
    const root = fakeNode({
      messageId: 'root-claim',
      isRoot: true,
      replyCount: 0,
      kindLabel: 'claim',
      createdAt: isoMinusMinutes(180),
      branchRootMessageId: 'root-claim',
      branchId: 'branch-root',
    });
    const recentBranch: ArgumentTimelineMapNode[] = [];
    for (let i = 1; i <= 8; i++) {
      recentBranch.push(
        fakeNode({
          messageId: `x${i}`,
          parentId: i === 1 ? null : `x${i - 1}`,
          ordinal: 10 + i,
          depth: i,
          isDetached: i === 1,
          branchId: 'branch-x',
          branchRootMessageId: 'x1',
          kindLabel: 'rebuttal',
          createdAt: isoMinusMinutes(60 - i * 2),
        }),
      );
    }
    const profile = deriveRoomActivityProfile(
      bundle({ timelineMap: buildTimelineMap([root, ...recentBranch]) }),
    );
    expect(profile.heatLevel).toBe<HeatLevel>('hot');
    const allChipKinds = profile.segments.flatMap((s) => s.reasonChips.map((c) => c.kind));
    expect(allChipKinds).toContain('recent_post');
    expect(allChipKinds).toContain('no_rebuttal');
  });
});

// ── Threshold normalization ──────────────────────────────────

describe('SW-002 — threshold normalization', () => {
  it('non-finite recentMovesQuietMax → default substituted', () => {
    const profile = deriveRoomActivityProfile({
      ...buildHotRoomFixture(),
      thresholds: { recentMovesQuietMax: Number.NaN },
    });
    expect(profile.heatLevel).toBe<HeatLevel>('hot');
  });

  it('non-finite recentMovesHotMin → default substituted', () => {
    const profile = deriveRoomActivityProfile({
      ...buildHotRoomFixture(),
      thresholds: { recentMovesHotMin: Number.POSITIVE_INFINITY },
    });
    expect(profile.heatLevel).toBe<HeatLevel>('hot');
  });

  it('negative thresholds → default substituted (non-negative-finite only)', () => {
    const profile = deriveRoomActivityProfile({
      ...buildHotRoomFixture(),
      thresholds: { recentMovesQuietMax: -5, recentMovesHotMin: -10 } as Partial<ActivityThresholds>,
    });
    expect(ALL_HEAT_LEVELS).toContain(profile.heatLevel);
  });

  it('defensive swap when quietMax > hotMin', () => {
    // Operator misconfigures 10 / 2 — deriver must defensively swap.
    const profile = deriveRoomActivityProfile({
      ...buildHotRoomFixture(),
      thresholds: { recentMovesQuietMax: 10, recentMovesHotMin: 2 },
    });
    // After swap, ordering quiet ≤ active ≤ hot holds; profile is valid.
    expect(ALL_HEAT_LEVELS).toContain(profile.heatLevel);
  });

  it('equal quietMax / hotMin → defaults restored (both poles need ordering)', () => {
    const profile = deriveRoomActivityProfile({
      ...buildHotRoomFixture(),
      thresholds: { recentMovesQuietMax: 4, recentMovesHotMin: 4 },
    });
    expect(profile.heatLevel).toBe<HeatLevel>('hot');
  });
});

// ── Single root, no replies ──────────────────────────────────

describe('SW-002 — single root / sparse-tree cases', () => {
  it('single root with no replies → quiet / steady / unresolved_open / no_rebuttal', () => {
    // Place the root well outside both the recent window (24h) and the
    // comparison window (next 72h) so recent = comparison = 0 → steady.
    const root = fakeNode({
      isRoot: true,
      replyCount: 0,
      createdAt: isoMinusMinutes(60 * 24 * 10), // 10 days ago
    });
    const profile = deriveRoomActivityProfile(bundle({ timelineMap: buildTimelineMap([root]) }));
    expect(profile.heatLevel).toBe<HeatLevel>('quiet');
    expect(profile.momentumState).toBe<MomentumState>('steady');
    expect(profile.trendDirection).toBe<TrendDirection>('unresolved_open');
    const allChipKinds = profile.segments.flatMap((s) => s.reasonChips.map((c) => c.kind));
    expect(allChipKinds).toContain('no_rebuttal');
  });

  it('deep branch with single chain → ≥ 2 depth segments emitted', () => {
    const nodes: ArgumentTimelineMapNode[] = [
      fakeNode({ isRoot: true, replyCount: 1, createdAt: isoMinusMinutes(120) }),
    ];
    for (let d = 1; d <= 6; d++) {
      nodes.push(
        fakeNode({
          messageId: `d${d}`,
          parentId: d === 1 ? 'm1' : `d${d - 1}`,
          ordinal: d + 1,
          depth: d,
          branchId: 'branch-root-m1',
          branchRootMessageId: 'm1',
          createdAt: isoMinusMinutes(60 + d * 5),
        }),
      );
    }
    const profile = deriveRoomActivityProfile(bundle({ timelineMap: buildTimelineMap(nodes) }));
    expect(profile.segments.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Doctrine ban-list scan ───────────────────────────────────

describe('SW-002 — doctrine ban-list scan', () => {
  it('no helper line contains a banned token (case-insensitive substring)', () => {
    const banned = _forbiddenActivityTokens();
    for (const kind of ALL_ACTIVITY_CHIP_KINDS) {
      const line = ACTIVITY_HELPER_LINES[kind].toLowerCase();
      for (const tok of banned) {
        if (line.includes(tok)) {
          throw new Error(
            `ACTIVITY_HELPER_LINES.${kind} contains banned token "${tok}": ${line}`,
          );
        }
      }
    }
  });

  it('hot carve-out: `hot` is a valid HeatLevel AND is NOT in the ban-list', () => {
    // Doctrine pin: cdiscourse-doctrine §2 + COPY-001 §5.1 + §8 — `hot`
    // is an activity descriptor, never a verdict. SW-002 inherits the
    // carve-out so the activity vocabulary can name "hot rooms" without
    // implying anyone is right or winning.
    expect(ALL_HEAT_LEVELS).toContain('hot');
    expect(_forbiddenActivityTokens()).not.toContain('hot');
  });

  it('no helper line uses snake_case in rendered text', () => {
    for (const kind of ALL_ACTIVITY_CHIP_KINDS) {
      expect(ACTIVITY_HELPER_LINES[kind]).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('every helper line is ≤ 80 chars', () => {
    for (const kind of ALL_ACTIVITY_CHIP_KINDS) {
      expect(ACTIVITY_HELPER_LINES[kind].length).toBeLessThanOrEqual(80);
    }
  });

  it('person-attribution tokens are present in ban-list (you / your / they / the user / the author)', () => {
    const banned = _forbiddenActivityTokens();
    for (const tok of ['you', 'your', 'they', 'their', 'the user', 'the author', 'the poster', 'the participant']) {
      expect(banned).toContain(tok);
    }
  });

  it('person-attribution tokens are absent from every helper line', () => {
    const personTokens = ['you', 'your', 'they', 'their', 'the user', 'the author', 'the poster', 'the participant'];
    for (const kind of ALL_ACTIVITY_CHIP_KINDS) {
      const line = ACTIVITY_HELPER_LINES[kind].toLowerCase();
      for (const tok of personTokens) {
        expect(line).not.toContain(tok);
      }
    }
  });

  it('verdict-specific SW-002 tokens are present in ban-list', () => {
    const banned = _forbiddenActivityTokens();
    for (const tok of [
      'winning',
      'losing',
      'dominant',
      'losing ground',
      'gaining ground',
      'proven',
      'disproven',
      'verdict',
      'validated',
      'correct',
      'incorrect',
      'right',
      'wrong',
    ]) {
      expect(banned).toContain(tok);
    }
  });
});

// ── RULE-003 read-through ────────────────────────────────────

describe('SW-002 — RULE-003 read-through', () => {
  it('synthesis_ready helper is read verbatim from LIFECYCLE_UX_MAP', () => {
    expect(ACTIVITY_HELPER_LINES.synthesis_ready).toBe(
      LIFECYCLE_UX_MAP.synthesis_ready.helperLine,
    );
  });

  it('no_rebuttal helper is read verbatim from LIFECYCLE_UX_MAP.open', () => {
    expect(ACTIVITY_HELPER_LINES.no_rebuttal).toBe(LIFECYCLE_UX_MAP.open.helperLine);
  });

  it('open_source_request helper is read verbatim from LIFECYCLE_UX_MAP.source_requested', () => {
    expect(ACTIVITY_HELPER_LINES.open_source_request).toBe(
      LIFECYCLE_UX_MAP.source_requested.helperLine,
    );
  });

  it('repeated_axis_pressure helper is read verbatim from LIFECYCLE_UX_MAP.exhausted', () => {
    expect(ACTIVITY_HELPER_LINES.repeated_axis_pressure).toBe(
      LIFECYCLE_UX_MAP.exhausted.helperLine,
    );
  });

  it('branch_tangent helper is read verbatim from LIFECYCLE_UX_MAP.branch_recommended', () => {
    expect(ACTIVITY_HELPER_LINES.branch_tangent).toBe(
      LIFECYCLE_UX_MAP.branch_recommended.helperLine,
    );
  });
});

// ── Defaults ─────────────────────────────────────────────────

describe('SW-002 — locked v1 defaults', () => {
  it('DEFAULT_ACTIVITY_THRESHOLDS matches the design-locked values', () => {
    expect(DEFAULT_ACTIVITY_THRESHOLDS.recentMovesQuietMax).toBe(1);
    expect(DEFAULT_ACTIVITY_THRESHOLDS.recentMovesHotMin).toBe(6);
    expect(DEFAULT_ACTIVITY_THRESHOLDS.activeBranchesProliferatingMin).toBe(3);
    expect(DEFAULT_ACTIVITY_THRESHOLDS.momentumBuildingRatioMin).toBe(1.5);
    expect(DEFAULT_ACTIVITY_THRESHOLDS.momentumCoolingRatioMax).toBe(0.5);
    expect(DEFAULT_ACTIVITY_THRESHOLDS.maxSegments).toBe(4);
  });

  it('DEFAULT_ACTIVITY_THRESHOLDS is frozen', () => {
    expect(Object.isFrozen(DEFAULT_ACTIVITY_THRESHOLDS)).toBe(true);
  });

  it('ACTIVITY_HELPER_LINES is frozen', () => {
    expect(Object.isFrozen(ACTIVITY_HELPER_LINES)).toBe(true);
  });
});

// ── Profile freeze + JSON-serializability ────────────────────

describe('SW-002 — profile freeze + JSON-serializability', () => {
  it('returned profile is frozen', () => {
    const profile = deriveRoomActivityProfile(buildHotRoomFixture());
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('returned profile JSON-roundtrips cleanly', () => {
    const profile: RoomActivityProfile = deriveRoomActivityProfile(buildHotRoomFixture());
    const round = JSON.parse(JSON.stringify(profile)) as RoomActivityProfile;
    expect(round.heatLevel).toBe(profile.heatLevel);
    expect(round.momentumState).toBe(profile.momentumState);
    expect(round.trendDirection).toBe(profile.trendDirection);
    expect(round.entryOpportunity).toBe(profile.entryOpportunity);
    expect(round.segments.length).toBe(profile.segments.length);
  });

  it('ActivityChip kind narrowing compiles + behaves at runtime', () => {
    const chip: ActivityChip = { kind: 'recent_post' };
    const k: ActivityChipKind = chip.kind;
    expect(ALL_ACTIVITY_CHIP_KINDS).toContain(k);
  });
});

// ── Forbidden-imports / source scan ──────────────────────────

const HEAT_MODEL_PATH = path.join(
  __dirname,
  '..',
  'src',
  'features',
  'strengthWeakness',
  'heatModel.ts',
);

function stripCommentsAndStrings(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\/\/[^\n]*/g, '');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``');
  return out;
}

describe('SW-002 — forbidden-imports source scan', () => {
  const raw = fs.readFileSync(HEAT_MODEL_PATH, 'utf8');
  const code = stripCommentsAndStrings(raw);

  it('no Date.now() call in executable code', () => {
    expect(/\bDate\.now\s*\(/.test(code)).toBe(false);
  });

  it('no Math.random() call in executable code', () => {
    expect(/\bMath\.random\s*\(/.test(code)).toBe(false);
  });

  it('no fetch() call in executable code', () => {
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
  });

  it('no XMLHttpRequest reference in executable code', () => {
    expect(code.includes('XMLHttpRequest')).toBe(false);
  });

  it('no console.log call in executable code', () => {
    expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
  });

  it('no supabase identifier in executable code', () => {
    expect(/\bsupabase\b/i.test(code)).toBe(false);
  });

  it('no anthropic identifier in executable code', () => {
    expect(/\banthropic\b/i.test(code)).toBe(false);
  });

  it('no xai identifier in executable code', () => {
    expect(/\bxai\b/i.test(code)).toBe(false);
  });

  it('no value-import of buildPointLifecycleMap', () => {
    expect(code.includes('buildPointLifecycleMap')).toBe(false);
  });

  it('no value-import of buildMoveMetadataLedger', () => {
    expect(code.includes('buildMoveMetadataLedger')).toBe(false);
  });

  it('no value-import of deriveAutoMetadataForMessage', () => {
    expect(code.includes('deriveAutoMetadataForMessage')).toBe(false);
  });

  it('no value-import of gradeChallenge / gradeRepair', () => {
    expect(code.includes('gradeChallenge')).toBe(false);
    expect(code.includes('gradeRepair')).toBe(false);
  });

  it('no value-import of applyAntiAmplification', () => {
    expect(code.includes('applyAntiAmplification')).toBe(false);
  });

  it('no React / RN / Expo imports', () => {
    const rawLines = raw.split(/\r?\n/);
    for (const line of rawLines) {
      const t = line.trim();
      if (/^import\s+(?!type\b)/.test(t)) {
        expect(t.includes("'react'")).toBe(false);
        expect(t.includes('"react"')).toBe(false);
        expect(t.includes("'react-native'")).toBe(false);
        expect(t.includes('"react-native"')).toBe(false);
        expect(t.includes("'expo")).toBe(false);
        expect(t.includes('"expo')).toBe(false);
      }
    }
  });

  it('no ANTHROPIC_API_KEY / XAI_API_KEY / SERVICE_ROLE secret literal', () => {
    expect(raw.includes('ANTHROPIC_API_KEY')).toBe(false);
    expect(raw.includes('XAI_API_KEY')).toBe(false);
    expect(raw.includes('SERVICE_ROLE')).toBe(false);
    expect(raw.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
  });
});

describe('SW-002 — cross-module imports are type-only (no runtime upstream value pulls)', () => {
  const raw = fs.readFileSync(HEAT_MODEL_PATH, 'utf8');

  // Walk top-level imports and partition into value-imports vs
  // type-imports. Only one runtime-value import is allowed: the RULE-003
  // helper-line map.
  function valueImportSpecifiers(src: string): string[] {
    const lines = src.split(/\r?\n/);
    const out: string[] = [];
    let acc: string[] = [];
    let inImport = false;
    let isType = false;
    for (const line of lines) {
      const t = line.trim();
      if (!inImport) {
        if (/^import\s+type\b/.test(t)) {
          isType = true;
          inImport = true;
          acc = [t];
          if (/;\s*$/.test(t)) {
            inImport = false;
            acc = [];
          }
        } else if (/^import\s+(?!type\b)/.test(t)) {
          isType = false;
          inImport = true;
          acc = [t];
          if (/;\s*$/.test(t)) {
            if (!isType) out.push(acc.join(' '));
            inImport = false;
            acc = [];
          }
        }
      } else {
        acc.push(t);
        if (/;\s*$/.test(t)) {
          if (!isType) out.push(acc.join(' '));
          inImport = false;
          acc = [];
        }
      }
    }
    return out;
  }

  const valueImports = valueImportSpecifiers(raw);

  it('lifecycle module imports are type-only', () => {
    for (const stmt of valueImports) {
      expect(stmt.includes("'../lifecycle'")).toBe(false);
    }
  });

  it('metadata module imports are type-only', () => {
    for (const stmt of valueImports) {
      expect(stmt.includes("'../metadata'")).toBe(false);
    }
  });

  it('argumentGameSurfaceModel imports are type-only', () => {
    for (const stmt of valueImports) {
      expect(stmt.includes('argumentGameSurfaceModel')).toBe(false);
    }
  });

  it('only allowed runtime-value import is rulesUx/lifecycleUxMap', () => {
    // RULE-003 helper-line map read at module load is documented in the
    // file header. Everything else must be type-only.
    for (const stmt of valueImports) {
      // pointStanding never appears as value-import.
      expect(stmt.includes('pointStanding')).toBe(false);
      // engagementIntelligence never appears.
      expect(stmt.includes('engagementIntelligence')).toBe(false);
    }
    const ruleImports = valueImports.filter((s) => s.includes('rulesUx/lifecycleUxMap'));
    expect(ruleImports.length).toBe(1);
  });
});
