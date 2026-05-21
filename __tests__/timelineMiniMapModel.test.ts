/**
 * IX-002 — Timeline mini-map model tests.
 *
 * Pure-function tests for `timelineMiniMapModel.ts`. No React, no
 * Supabase, no network. Fixtures are built through the real
 * `buildArgumentTimelineMap` so the mini-map is exercised against the
 * actual `ArgumentTimelineMapModel` shape it projects from.
 */
import {
  buildArgumentTimelineMap,
  type ArgumentTimelineMapMessageInput,
  type ArgumentTimelineMapModel,
} from '../src/features/arguments/argumentGameSurfaceModel';
import {
  buildTimelineMiniMapModel,
  buildViewportWindow,
  buildBranchClusters,
  findHotZone,
  mapTemperatureToHeatTier,
  resolveRegionJumpTarget,
  MINI_MAP_MIN_MOVES,
  MINI_MAP_HOT_ZONE_MIN_RUN,
  type MiniMapMarker,
} from '../src/features/arguments/timelineMiniMapModel';
import type { BranchCollapseState } from '../src/features/arguments/branchTopologyModel';

function isoAt(offsetMs: number): string {
  return new Date(1715000000000 + offsetMs).toISOString();
}

function msg(
  partial: Partial<ArgumentTimelineMapMessageInput> & { id: string },
): ArgumentTimelineMapMessageInput {
  return {
    id: partial.id,
    debateId: partial.debateId ?? 'd1',
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'author-a',
    argumentType: partial.argumentType ?? 'claim',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A claim body.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(0),
    updatedAt: partial.updatedAt ?? partial.createdAt ?? isoAt(0),
    isBot: partial.isBot ?? false,
    qualifierLabels: partial.qualifierLabels ?? [],
    flagCodes: partial.flagCodes ?? [],
    tagCodes: partial.tagCodes ?? [],
    topicScore: partial.topicScore ?? null,
    hasEvidence: partial.hasEvidence ?? false,
  };
}

/** A long single-chain debate of `n` moves. */
function buildChain(n: number): ArgumentTimelineMapModel {
  const messages: ArgumentTimelineMapMessageInput[] = [];
  for (let i = 0; i < n; i++) {
    messages.push(
      msg({
        id: `m${i}`,
        parentId: i === 0 ? null : `m${i - 1}`,
        createdAt: isoAt(i * 1000),
        argumentType: i === 0 ? 'thesis' : 'claim',
      }),
    );
  }
  return buildArgumentTimelineMap({ messages, currentUserId: 'me' });
}

// ── buildTimelineMiniMapModel — happy path ─────────────────────

describe('buildTimelineMiniMapModel — happy path', () => {
  it('a 12-move debate yields isAvailable true with one marker per node', () => {
    const map = buildChain(12);
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.isAvailable).toBe(true);
    expect(mini.moveCount).toBe(12);
    expect(mini.markers.length).toBe(map.nodes.length);
  });

  it('markers are in chronological order (mirrors timelineMap.nodes)', () => {
    const map = buildChain(15);
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.markers.map((m) => m.messageId)).toEqual(
      map.nodes.map((n) => n.messageId),
    );
  });

  it('exposes rootMessageId + latestMessageId from the timeline map', () => {
    const map = buildChain(14);
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.rootMessageId).toBe(map.rootMessageId);
    expect(mini.latestMessageId).toBe(map.latestMessageId);
  });
});

// ── threshold ──────────────────────────────────────────────────

describe('buildTimelineMiniMapModel — length threshold', () => {
  it('11-move debate is not available; 12-move debate is available', () => {
    expect(buildTimelineMiniMapModel({ timelineMap: buildChain(11) }).isAvailable).toBe(
      false,
    );
    expect(buildTimelineMiniMapModel({ timelineMap: buildChain(12) }).isAvailable).toBe(
      true,
    );
  });

  it('the default threshold is MINI_MAP_MIN_MOVES', () => {
    const atThreshold = buildChain(MINI_MAP_MIN_MOVES);
    expect(buildTimelineMiniMapModel({ timelineMap: atThreshold }).isAvailable).toBe(
      true,
    );
    const belowThreshold = buildChain(MINI_MAP_MIN_MOVES - 1);
    expect(buildTimelineMiniMapModel({ timelineMap: belowThreshold }).isAvailable).toBe(
      false,
    );
  });

  it('honors a minMovesToShow override', () => {
    const map = buildChain(5);
    expect(
      buildTimelineMiniMapModel({ timelineMap: map, minMovesToShow: 3 }).isAvailable,
    ).toBe(true);
    expect(
      buildTimelineMiniMapModel({ timelineMap: map, minMovesToShow: 99 }).isAvailable,
    ).toBe(false);
  });
});

// ── empty / single-node ────────────────────────────────────────

describe('buildTimelineMiniMapModel — empty + single-node', () => {
  it('empty timeline → not available, empty markers, hotZone null, no throw', () => {
    const map = buildArgumentTimelineMap({ messages: [], currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.isAvailable).toBe(false);
    expect(mini.markers).toEqual([]);
    expect(mini.branchClusters).toEqual([]);
    expect(mini.hotZone).toBeNull();
    expect(mini.summaryLine).toBe('');
    expect(mini.rootMessageId).toBeNull();
    expect(mini.latestMessageId).toBeNull();
  });

  it('single-node debate → not available, one marker, no throw', () => {
    const map = buildChain(1);
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.isAvailable).toBe(false);
    expect(mini.markers.length).toBe(1);
    expect(mini.hotZone).toBeNull();
  });
});

// ── xFraction ──────────────────────────────────────────────────

describe('buildTimelineMiniMapModel — xFraction normalization', () => {
  it('first marker is 0, last marker is 1', () => {
    const mini = buildTimelineMiniMapModel({ timelineMap: buildChain(20) });
    expect(mini.markers[0].xFraction).toBe(0);
    expect(mini.markers[mini.markers.length - 1].xFraction).toBe(1);
  });

  it('single node → xFraction 0 with no NaN (guarded divide)', () => {
    const mini = buildTimelineMiniMapModel({ timelineMap: buildChain(1) });
    expect(mini.markers[0].xFraction).toBe(0);
    expect(Number.isNaN(mini.markers[0].xFraction)).toBe(false);
  });

  it('every xFraction is finite and within [0,1]', () => {
    const mini = buildTimelineMiniMapModel({ timelineMap: buildChain(40) });
    for (const m of mini.markers) {
      expect(Number.isFinite(m.xFraction)).toBe(true);
      expect(m.xFraction).toBeGreaterThanOrEqual(0);
      expect(m.xFraction).toBeLessThanOrEqual(1);
    }
  });
});

// ── mapTemperatureToHeatTier ───────────────────────────────────

describe('mapTemperatureToHeatTier', () => {
  it('cool → quiet, mild → mild, warm → warm, hot → hot', () => {
    expect(mapTemperatureToHeatTier('cool')).toBe('quiet');
    expect(mapTemperatureToHeatTier('mild')).toBe('mild');
    expect(mapTemperatureToHeatTier('warm')).toBe('warm');
    expect(mapTemperatureToHeatTier('hot')).toBe('hot');
  });

  it('unknown → quiet (no heat shown)', () => {
    expect(mapTemperatureToHeatTier('unknown')).toBe('quiet');
  });

  it('null / undefined → quiet, no throw', () => {
    expect(mapTemperatureToHeatTier(null)).toBe('quiet');
    expect(mapTemperatureToHeatTier(undefined)).toBe('quiet');
  });
});

// ── findHotZone ────────────────────────────────────────────────

function marker(partial: Partial<MiniMapMarker> & { messageId: string }): MiniMapMarker {
  return {
    messageId: partial.messageId,
    ordinal: partial.ordinal ?? 1,
    xFraction: partial.xFraction ?? 0,
    lane: partial.lane ?? 0,
    branchId: partial.branchId ?? 'branch-root-x',
    isActivePath: partial.isActivePath ?? false,
    isActive: partial.isActive ?? false,
    isRoot: partial.isRoot ?? false,
    isLatest: partial.isLatest ?? false,
    isJunction: partial.isJunction ?? false,
    isDetached: partial.isDetached ?? false,
    heatTier: partial.heatTier ?? 'quiet',
    kindColorFamily: partial.kindColorFamily ?? 'claim',
    color: partial.color ?? '#6366f1',
  };
}

describe('findHotZone', () => {
  it('returns null for an empty marker array', () => {
    expect(findHotZone([])).toBeNull();
  });

  it('all-quiet markers → null', () => {
    const markers = Array.from({ length: 10 }, (_, i) =>
      marker({ messageId: `m${i}`, heatTier: 'quiet' }),
    );
    expect(findHotZone(markers)).toBeNull();
  });

  it('a single warm marker (run length 1) is below threshold → null', () => {
    const markers = [
      marker({ messageId: 'a', heatTier: 'quiet' }),
      marker({ messageId: 'b', heatTier: 'warm' }),
      marker({ messageId: 'c', heatTier: 'quiet' }),
    ];
    expect(MINI_MAP_HOT_ZONE_MIN_RUN).toBeGreaterThan(1);
    expect(findHotZone(markers)).toBeNull();
  });

  it('detects a contiguous warm/hot run that meets the minimum', () => {
    const markers = [
      marker({ messageId: 'a', heatTier: 'quiet', xFraction: 0 }),
      marker({ messageId: 'b', heatTier: 'warm', xFraction: 0.25 }),
      marker({ messageId: 'c', heatTier: 'hot', xFraction: 0.5 }),
      marker({ messageId: 'd', heatTier: 'quiet', xFraction: 0.75 }),
    ];
    const zone = findHotZone(markers);
    expect(zone).not.toBeNull();
    expect(zone!.jumpTargetMessageId).toBe('b');
    expect(zone!.moveCount).toBe(2);
    expect(zone!.xStartFraction).toBe(0.25);
    expect(zone!.xEndFraction).toBe(0.5);
  });

  it('picks the LONGEST run, never the hottest', () => {
    // A short run that contains `hot` vs a longer run of only `warm`.
    const markers = [
      marker({ messageId: 'h1', heatTier: 'hot' }),
      marker({ messageId: 'h2', heatTier: 'hot' }),
      marker({ messageId: 'q', heatTier: 'quiet' }),
      marker({ messageId: 'w1', heatTier: 'warm' }),
      marker({ messageId: 'w2', heatTier: 'warm' }),
      marker({ messageId: 'w3', heatTier: 'warm' }),
    ];
    const zone = findHotZone(markers);
    expect(zone).not.toBeNull();
    // The 3-warm run wins over the 2-hot run — length, not heat.
    expect(zone!.jumpTargetMessageId).toBe('w1');
    expect(zone!.moveCount).toBe(3);
  });

  it('on a tie, the earliest run wins (deterministic)', () => {
    const markers = [
      marker({ messageId: 'a', heatTier: 'warm' }),
      marker({ messageId: 'b', heatTier: 'warm' }),
      marker({ messageId: 'q', heatTier: 'quiet' }),
      marker({ messageId: 'c', heatTier: 'warm' }),
      marker({ messageId: 'd', heatTier: 'warm' }),
    ];
    const zone = findHotZone(markers);
    expect(zone!.jumpTargetMessageId).toBe('a');
  });
});

// ── buildBranchClusters ────────────────────────────────────────

describe('buildBranchClusters', () => {
  it('a no-branch chain produces a single mainline cluster', () => {
    const map = buildChain(12);
    const clusters = buildBranchClusters(map);
    expect(clusters.length).toBe(1);
    expect(clusters[0].isMainline).toBe(true);
    expect(clusters[0].lane).toBe(0);
    expect(clusters[0].moveCount).toBe(12);
  });

  it('a 2-branch fixture produces a mainline + at least one side cluster', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [
      msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
      msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
      msg({ id: 'b', parentId: 'r', createdAt: isoAt(2000) }),
      msg({ id: 'c', parentId: 'b', createdAt: isoAt(3000) }),
    ];
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const clusters = buildBranchClusters(map);
    expect(clusters.some((c) => c.isMainline)).toBe(true);
    expect(clusters.some((c) => !c.isMainline)).toBe(true);
  });

  it('branchRootMessageId on each cluster matches a real node branch root', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [
      msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
      msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
      msg({ id: 'b', parentId: 'r', createdAt: isoAt(2000) }),
    ];
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const clusters = buildBranchClusters(map);
    const validRoots = new Set(map.nodes.map((n) => n.branchRootMessageId));
    for (const c of clusters) {
      expect(validRoots.has(c.branchRootMessageId)).toBe(true);
    }
  });

  it('a collapsed branch is flagged isCollapsed with hiddenMoveCount > 0', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [
      msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
      msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
      msg({ id: 'b', parentId: 'r', createdAt: isoAt(2000) }),
      msg({ id: 'c', parentId: 'b', createdAt: isoAt(3000) }),
    ];
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    // Collapse the side branch rooted at 'b'.
    const sideRoot = map.nodes.find((n) => n.messageId === 'b')!.branchRootMessageId;
    const collapseState: BranchCollapseState = { [sideRoot]: 'collapsed' };
    const clusters = buildBranchClusters(map, collapseState);
    const collapsed = clusters.find((c) => c.branchRootMessageId === sideRoot)!;
    expect(collapsed.isCollapsed).toBe(true);
    expect(collapsed.hiddenMoveCount).toBeGreaterThan(0);
  });

  it('an expanded branch has isCollapsed false and hiddenMoveCount 0', () => {
    const map = buildChain(12);
    const clusters = buildBranchClusters(map, {});
    for (const c of clusters) {
      expect(c.isCollapsed).toBe(false);
      expect(c.hiddenMoveCount).toBe(0);
    }
  });

  it('laneLabel is a plain-language branch descriptor', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [
      msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
      msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
      msg({ id: 'b', parentId: 'r', createdAt: isoAt(2000) }),
    ];
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const clusters = buildBranchClusters(map);
    const mainline = clusters.find((c) => c.isMainline)!;
    expect(mainline.laneLabel).toBe('on the main line');
  });

  it('empty timeline → empty clusters', () => {
    const map = buildArgumentTimelineMap({ messages: [], currentUserId: 'me' });
    expect(buildBranchClusters(map)).toEqual([]);
  });
});

// ── buildViewportWindow ────────────────────────────────────────

describe('buildViewportWindow', () => {
  it('mid-scroll → a fractional window', () => {
    const w = buildViewportWindow({ scrollX: 250, viewportWidth: 500, scrollWidth: 1000 });
    expect(w.coversAll).toBe(false);
    expect(w.xStartFraction).toBeCloseTo(0.25);
    expect(w.xEndFraction).toBeCloseTo(0.75);
  });

  it('viewportWidth >= scrollWidth → coversAll true', () => {
    const w = buildViewportWindow({ scrollX: 0, viewportWidth: 1200, scrollWidth: 1000 });
    expect(w.coversAll).toBe(true);
    expect(w.xStartFraction).toBe(0);
    expect(w.xEndFraction).toBe(1);
  });

  it('viewportWidth 0 (layout not measured) → coversAll true', () => {
    const w = buildViewportWindow({ scrollX: 0, viewportWidth: 0, scrollWidth: 1000 });
    expect(w.coversAll).toBe(true);
  });

  it('scrollWidth 0 → coversAll true', () => {
    const w = buildViewportWindow({ scrollX: 0, viewportWidth: 300, scrollWidth: 0 });
    expect(w.coversAll).toBe(true);
  });

  it('negative scrollX is clamped, no throw', () => {
    const w = buildViewportWindow({ scrollX: -500, viewportWidth: 300, scrollWidth: 1000 });
    expect(w.xStartFraction).toBe(0);
    expect(w.xStartFraction).toBeGreaterThanOrEqual(0);
  });

  it('NaN inputs are coerced, no throw', () => {
    const w = buildViewportWindow({
      scrollX: NaN,
      viewportWidth: NaN,
      scrollWidth: NaN,
    });
    expect(w.coversAll).toBe(true);
    expect(Number.isFinite(w.xStartFraction)).toBe(true);
    expect(Number.isFinite(w.xEndFraction)).toBe(true);
  });

  it('scrollX past the end clamps the window to 1', () => {
    const w = buildViewportWindow({ scrollX: 5000, viewportWidth: 300, scrollWidth: 1000 });
    expect(w.xEndFraction).toBe(1);
    expect(w.xStartFraction).toBe(1);
  });
});

// ── resolveRegionJumpTarget ────────────────────────────────────

describe('resolveRegionJumpTarget', () => {
  it('maps a tapped fraction to the nearest marker id', () => {
    const map = buildChain(20);
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    const req = resolveRegionJumpTarget(mini, 0);
    expect(req).not.toBeNull();
    expect(req!.kind).toBe('region');
    expect(req!.messageId).toBe(mini.markers[0].messageId);
  });

  it('a fraction near 1 resolves to the last marker', () => {
    const map = buildChain(20);
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    const req = resolveRegionJumpTarget(mini, 0.99);
    expect(req!.messageId).toBe(mini.markers[mini.markers.length - 1].messageId);
  });

  it('out-of-range fraction is clamped, no throw', () => {
    const map = buildChain(20);
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(resolveRegionJumpTarget(mini, -5)!.messageId).toBe(mini.markers[0].messageId);
    expect(resolveRegionJumpTarget(mini, 99)!.messageId).toBe(
      mini.markers[mini.markers.length - 1].messageId,
    );
  });

  it('no markers → null', () => {
    const map = buildArgumentTimelineMap({ messages: [], currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(resolveRegionJumpTarget(mini, 0.5)).toBeNull();
  });
});

// ── buildMiniMapSummaryLine ────────────────────────────────────

describe('buildMiniMapSummaryLine', () => {
  it('counts moves correctly', () => {
    const mini = buildTimelineMiniMapModel({ timelineMap: buildChain(12) });
    expect(mini.summaryLine).toContain('12 moves');
  });

  it('a no-branch debate omits the branch fragment', () => {
    const mini = buildTimelineMiniMapModel({ timelineMap: buildChain(12) });
    expect(mini.summaryLine).not.toContain('branch');
  });

  it('a debate with side branches reports the branch count', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [
      msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
    ];
    for (let i = 0; i < 12; i++) {
      messages.push(
        msg({ id: `a${i}`, parentId: 'r', createdAt: isoAt((i + 1) * 1000) }),
      );
    }
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.summaryLine).toMatch(/branch/);
  });

  it('a debate with no hot zone omits "hot zone"', () => {
    const mini = buildTimelineMiniMapModel({ timelineMap: buildChain(12) });
    expect(mini.summaryLine).not.toContain('hot zone');
  });

  it('a debate with a hot zone includes "1 hot zone"', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [];
    for (let i = 0; i < 12; i++) {
      messages.push(
        msg({
          id: `m${i}`,
          parentId: i === 0 ? null : `m${i - 1}`,
          createdAt: isoAt(i * 1000),
          // ad_hominem → temperatureBand 'hot' on consecutive nodes.
          flagCodes: i >= 4 && i <= 6 ? ['ad_hominem'] : [],
        }),
      );
    }
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.hotZone).not.toBeNull();
    expect(mini.summaryLine).toContain('1 hot zone');
  });

  it('an empty model → empty summary', () => {
    const map = buildArgumentTimelineMap({ messages: [], currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.summaryLine).toBe('');
  });
});

// ── determinism ────────────────────────────────────────────────

describe('buildTimelineMiniMapModel — determinism', () => {
  it('the same input produces a deep-equal output across two calls', () => {
    const map = buildChain(18);
    const a = buildTimelineMiniMapModel({ timelineMap: map });
    const b = buildTimelineMiniMapModel({ timelineMap: map });
    expect(a).toEqual(b);
  });
});

// ── stress fixture ─────────────────────────────────────────────

describe('buildTimelineMiniMapModel — 260-node stress fixture', () => {
  it('compresses 260 markers into normalized fractions without throwing', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [];
    for (let i = 0; i < 260; i++) {
      messages.push(
        msg({
          id: `m${i}`,
          parentId: i === 0 ? null : `m${i - 1}`,
          createdAt: isoAt(i * 1000),
        }),
      );
    }
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.markers.length).toBe(260);
    expect(mini.markers[0].xFraction).toBe(0);
    expect(mini.markers[259].xFraction).toBe(1);
    expect(mini.isAvailable).toBe(true);
  });
});

// ── active path ────────────────────────────────────────────────

describe('buildTimelineMiniMapModel — active path', () => {
  it('activePathMessageIds lists the chronological active path', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [];
    for (let i = 0; i < 12; i++) {
      messages.push(
        msg({
          id: `m${i}`,
          parentId: i === 0 ? null : `m${i - 1}`,
          createdAt: isoAt(i * 1000),
        }),
      );
    }
    const map = buildArgumentTimelineMap({
      messages,
      currentUserId: 'me',
      activeMessageId: 'm5',
    });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.activePathMessageIds).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);
  });
});
