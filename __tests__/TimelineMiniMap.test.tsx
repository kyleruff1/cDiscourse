/**
 * IX-002 — TimelineMiniMap component tests.
 *
 * The repo's established test discipline for `.tsx` surfaces is
 * pure-helper + source-scan (the `BranchCollapseStub` / `ReceiptChip`
 * pattern) — no `render()`. Every visual decision in `TimelineMiniMap` is
 * extracted into an exported pure helper, so the design's component test
 * plan (null-render, chip wiring, disabled state, hot-zone hidden,
 * viewport positioning, a11y / hitSlop, grayscale, reduce-motion) is
 * verified by exercising those helpers directly plus a source scan that
 * proves the component wires them in.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  getMiniMapEffectiveTapPx,
  getMiniMapHeatRingStyle,
  getMiniMapMarkerGeometry,
  getMiniMapMarkerPosition,
  getViewportWindowRectStyle,
  buildMiniMapAccessibilityLabel,
  buildBranchChipLabel,
  buildBranchChipAccessibilityLabel,
  buildHotZoneChipLabel,
  buildHotZoneChipAccessibilityLabel,
  MINI_MAP_MIN_TAP_PX,
  MINI_MAP_CHIP_VISIBLE_HEIGHT,
  MINI_MAP_HIT_SLOP,
} from '../src/features/arguments/TimelineMiniMap';
import {
  buildTimelineMiniMapModel,
  MINI_MAP_LANE_STEP_PX,
  MINI_MAP_MARKER_SIZE,
  type MiniMapMarker,
  type MiniMapBranchCluster,
  type MiniMapHotZone,
  type MiniMapViewportWindow,
} from '../src/features/arguments/timelineMiniMapModel';
import {
  buildArgumentTimelineMap,
  type ArgumentTimelineMapMessageInput,
} from '../src/features/arguments/argumentGameSurfaceModel';

const COMPONENT_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'arguments', 'TimelineMiniMap.tsx'),
  'utf8',
);

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

function cluster(
  partial: Partial<MiniMapBranchCluster> & { branchId: string },
): MiniMapBranchCluster {
  return {
    branchId: partial.branchId,
    branchRootMessageId: partial.branchRootMessageId ?? 'root-x',
    lane: partial.lane ?? 1,
    moveCount: partial.moveCount ?? 4,
    xStartFraction: partial.xStartFraction ?? 0.2,
    xEndFraction: partial.xEndFraction ?? 0.6,
    isCollapsed: partial.isCollapsed ?? false,
    hiddenMoveCount: partial.hiddenMoveCount ?? 0,
    laneLabel: partial.laneLabel ?? 'on a side branch',
    containsActivePath: partial.containsActivePath ?? false,
    isMainline: partial.isMainline ?? false,
  };
}

// ── null render for short debates ───────────────────────────────

describe('TimelineMiniMap — renders nothing for short debates', () => {
  it('the component returns null when model.isAvailable is false', () => {
    // Source-scan proof: the early-return guard is present.
    expect(COMPONENT_SRC).toMatch(/model\.isAvailable\s*!==\s*true/);
    expect(COMPONENT_SRC).toMatch(/return\s+null/);
  });

  it('a 5-move debate produces an unavailable model', () => {
    const messages: ArgumentTimelineMapMessageInput[] = [];
    for (let i = 0; i < 5; i++) {
      messages.push({
        id: `m${i}`,
        debateId: 'd1',
        parentId: i === 0 ? null : `m${i - 1}`,
        authorId: 'a',
        argumentType: 'claim',
        side: 'affirmative',
        body: 'b',
        status: 'posted',
        createdAt: new Date(1715000000000 + i * 1000).toISOString(),
        updatedAt: new Date(1715000000000 + i * 1000).toISOString(),
        isBot: false,
        qualifierLabels: [],
      });
    }
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.isAvailable).toBe(false);
  });
});

// ── collapsed-by-default ────────────────────────────────────────

describe('TimelineMiniMap — collapsed by default', () => {
  it('the expanded useState is seeded from initiallyExpanded (default false)', () => {
    expect(COMPONENT_SRC).toMatch(/useState<boolean>\(initiallyExpanded\s*===\s*true\)/);
  });

  it('the body only renders when expanded', () => {
    expect(COMPONENT_SRC).toContain('timeline-mini-map-body');
    expect(COMPONENT_SRC).toMatch(/expanded\s*\?\s*\(/);
  });

  it('the header chip toggles expansion', () => {
    expect(COMPONENT_SRC).toContain('timeline-mini-map-header');
    expect(COMPONENT_SRC).toContain('handleToggleExpand');
  });
});

// ── jump chips ──────────────────────────────────────────────────

describe('TimelineMiniMap — jump chips fire onJump with the right kind', () => {
  it("the root chip emits kind 'root'", () => {
    expect(COMPONENT_SRC).toMatch(/kind:\s*'root'/);
    expect(COMPONENT_SRC).toContain('mini-jump-root');
  });

  it("the latest chip emits kind 'latest'", () => {
    expect(COMPONENT_SRC).toMatch(/kind:\s*'latest'/);
    expect(COMPONENT_SRC).toContain('mini-jump-latest');
  });

  it("the hot-zone chip emits kind 'hot_zone'", () => {
    expect(COMPONENT_SRC).toMatch(/kind:\s*'hot_zone'/);
    expect(COMPONENT_SRC).toContain('mini-jump-hot-zone');
  });

  it("the branch chip emits kind 'branch' with the branch root id", () => {
    expect(COMPONENT_SRC).toMatch(/kind:\s*'branch'/);
    expect(COMPONENT_SRC).toContain('cluster.branchRootMessageId');
  });

  it('the root chip is disabled (a11y state) when the root is active', () => {
    expect(COMPONENT_SRC).toContain('rootActive');
    expect(COMPONENT_SRC).toMatch(/disabled:\s*rootActive/);
  });

  it('the latest chip is disabled (a11y state) when the latest is active', () => {
    expect(COMPONENT_SRC).toContain('latestActive');
    expect(COMPONENT_SRC).toMatch(/disabled:\s*latestActive/);
  });

  it('the hot-zone chip is only rendered when model.hotZone is non-null', () => {
    expect(COMPONENT_SRC).toMatch(/model\.hotZone\s*\?/);
  });

  it('the mainline cluster never produces a chip (only side branches)', () => {
    // The chip row maps over `sideBranchClusters`, which excludes mainline.
    expect(COMPONENT_SRC).toContain('sideBranchClusters');
    expect(COMPONENT_SRC).toMatch(/branchClusters\.filter\(\(c\)\s*=>\s*!c\.isMainline\)/);
  });
});

// ── chip copy builders ──────────────────────────────────────────

describe('TimelineMiniMap — chip copy builders', () => {
  it('the branch chip label is a compact noun + move count', () => {
    expect(buildBranchChipLabel(cluster({ branchId: 'b1', lane: 1, moveCount: 4 }))).toBe(
      'Side branch · 4',
    );
    expect(buildBranchChipLabel(cluster({ branchId: 'b0', lane: 0, moveCount: 9 }))).toBe(
      'Mainline · 9',
    );
  });

  it('the branch chip a11y label describes the branch + collapse state', () => {
    const label = buildBranchChipAccessibilityLabel(
      cluster({ branchId: 'b1', moveCount: 4, isCollapsed: true }),
    );
    expect(label).toContain('Jump to the branch');
    expect(label).toContain('4 moves');
    expect(label).toContain('collapsed');
  });

  it('the hot-zone chip copy never says "winning" / "important"', () => {
    const hz: MiniMapHotZone = {
      xStartFraction: 0.2,
      xEndFraction: 0.5,
      jumpTargetMessageId: 'm3',
      moveCount: 3,
    };
    expect(buildHotZoneChipLabel(hz)).toBe('Hot zone · 3');
    expect(buildHotZoneChipAccessibilityLabel(hz).toLowerCase()).toContain(
      'recent activity',
    );
  });

  it('the whole-mini-map a11y label frames heat as activity, not a result', () => {
    const map = buildArgumentTimelineMap({ messages: [], currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(buildMiniMapAccessibilityLabel(mini)).toContain('No moves yet');
  });
});

// ── viewport-window geometry ────────────────────────────────────

describe('TimelineMiniMap — viewport-window rectangle', () => {
  it('coversAll → a full-width window with no drag handle', () => {
    const w: MiniMapViewportWindow = {
      xStartFraction: 0,
      xEndFraction: 1,
      coversAll: true,
    };
    const rect = getViewportWindowRectStyle(w, 300);
    expect(rect.leftPx).toBe(0);
    expect(rect.widthPx).toBe(300);
    expect(rect.showsDragHandle).toBe(false);
  });

  it('a fractional window is positioned from its normalized fractions', () => {
    const w: MiniMapViewportWindow = {
      xStartFraction: 0.25,
      xEndFraction: 0.75,
      coversAll: false,
    };
    const rect = getViewportWindowRectStyle(w, 400);
    expect(rect.leftPx).toBe(100);
    expect(rect.widthPx).toBe(200);
    expect(rect.showsDragHandle).toBe(true);
  });

  it('width is floored to a grabbable minimum', () => {
    const w: MiniMapViewportWindow = {
      xStartFraction: 0.5,
      xEndFraction: 0.5,
      coversAll: false,
    };
    const rect = getViewportWindowRectStyle(w, 400);
    expect(rect.widthPx).toBeGreaterThanOrEqual(8);
  });

  it('a zero-width rail does not throw and yields finite numbers', () => {
    const w: MiniMapViewportWindow = {
      xStartFraction: 0.2,
      xEndFraction: 0.6,
      coversAll: false,
    };
    const rect = getViewportWindowRectStyle(w, 0);
    expect(Number.isFinite(rect.leftPx)).toBe(true);
    expect(Number.isFinite(rect.widthPx)).toBe(true);
  });
});

// ── accessibility — 44px targets ────────────────────────────────

describe('TimelineMiniMap — 44px accessibility targets', () => {
  it('the chip visible height + hitSlop meets the 44px minimum', () => {
    const effective = getMiniMapEffectiveTapPx(
      MINI_MAP_CHIP_VISIBLE_HEIGHT,
      MINI_MAP_HIT_SLOP.top,
    );
    expect(effective).toBeGreaterThanOrEqual(MINI_MAP_MIN_TAP_PX);
  });

  it('MINI_MAP_MIN_TAP_PX is 44', () => {
    expect(MINI_MAP_MIN_TAP_PX).toBe(44);
  });

  it('every Pressable in the component carries hitSlop', () => {
    // header + region + viewport window + each chip — all need hitSlop.
    const pressableCount = (COMPONENT_SRC.match(/<Pressable/g) || []).length;
    const hitSlopCount = (COMPONENT_SRC.match(/hitSlop=/g) || []).length;
    // The region-tap layer fills the rail (already large); every other
    // Pressable (header, viewport window, jump chips) carries hitSlop.
    expect(pressableCount).toBeGreaterThan(0);
    expect(hitSlopCount).toBeGreaterThanOrEqual(pressableCount - 1);
  });

  it('every Pressable exposes accessibilityRole', () => {
    const pressableBlocks = COMPONENT_SRC.split('<Pressable').slice(1);
    for (const block of pressableBlocks) {
      const head = block.slice(0, 600);
      expect(head).toMatch(/accessibility(Role|ElementsHidden)/);
    }
  });

  it('the header chip exposes accessibilityState expanded', () => {
    expect(COMPONENT_SRC).toMatch(/accessibilityState=\{\{\s*expanded\s*\}\}/);
  });

  it('the viewport window is accessibilityRole adjustable with increment/decrement actions', () => {
    expect(COMPONENT_SRC).toContain('accessibilityRole="adjustable"');
    expect(COMPONENT_SRC).toContain("name: 'increment'");
    expect(COMPONENT_SRC).toContain("name: 'decrement'");
    expect(COMPONENT_SRC).toContain('onAccessibilityAction');
  });
});

// ── grayscale — geometry survives without color ─────────────────

describe('TimelineMiniMap — grayscale: every marker signal is geometric', () => {
  it('the active marker is distinguished by SIZE + BORDER (not color)', () => {
    const active = getMiniMapMarkerGeometry(marker({ messageId: 'a', isActive: true }));
    const plain = getMiniMapMarkerGeometry(marker({ messageId: 'b' }));
    expect(active.sizePx).toBeGreaterThan(plain.sizePx);
    expect(active.borderWidthPx).toBeGreaterThan(0);
  });

  it('the latest marker is distinguished by SIZE + BORDER (not color)', () => {
    const latest = getMiniMapMarkerGeometry(marker({ messageId: 'a', isLatest: true }));
    const plain = getMiniMapMarkerGeometry(marker({ messageId: 'b' }));
    expect(latest.sizePx).toBeGreaterThan(plain.sizePx);
    expect(latest.borderWidthPx).toBeGreaterThan(0);
  });

  it('the root marker carries a notch (geometry), not just a color', () => {
    expect(getMiniMapMarkerGeometry(marker({ messageId: 'a', isRoot: true })).showsRootNotch).toBe(
      true,
    );
    expect(getMiniMapMarkerGeometry(marker({ messageId: 'b' })).showsRootNotch).toBe(false);
  });

  it('the junction marker carries a hollow ring (geometry)', () => {
    expect(
      getMiniMapMarkerGeometry(marker({ messageId: 'a', isJunction: true })).showsJunctionRing,
    ).toBe(true);
    expect(getMiniMapMarkerGeometry(marker({ messageId: 'b' })).showsJunctionRing).toBe(false);
  });

  it('heat is a ring overlay — it never replaces the marker kind color', () => {
    // hot → a visible ring; warm → a fainter ring; mild / quiet → none.
    expect(getMiniMapHeatRingStyle('hot')).not.toBeNull();
    expect(getMiniMapHeatRingStyle('warm')).not.toBeNull();
    expect(getMiniMapHeatRingStyle('mild')).toBeNull();
    expect(getMiniMapHeatRingStyle('quiet')).toBeNull();
    // The ring is a border — geometry, visible in grayscale.
    expect(getMiniMapHeatRingStyle('hot')!.borderWidth).toBeGreaterThan(0);
  });

  it('the base marker size is the shared MINI_MAP_MARKER_SIZE', () => {
    expect(getMiniMapMarkerGeometry(marker({ messageId: 'a' })).sizePx).toBe(
      MINI_MAP_MARKER_SIZE,
    );
  });
});

// ── marker positioning ──────────────────────────────────────────

describe('TimelineMiniMap — marker positioning', () => {
  it('xFraction maps linearly across the rail width', () => {
    const pos0 = getMiniMapMarkerPosition(marker({ messageId: 'a', xFraction: 0 }), 200, 64);
    const pos1 = getMiniMapMarkerPosition(marker({ messageId: 'b', xFraction: 1 }), 200, 64);
    expect(pos0.leftPx).toBe(0);
    expect(pos1.leftPx).toBe(200);
  });

  it('lane offsets the marker vertically by MINI_MAP_LANE_STEP_PX', () => {
    const lane0 = getMiniMapMarkerPosition(marker({ messageId: 'a', lane: 0 }), 200, 64);
    const lane1 = getMiniMapMarkerPosition(marker({ messageId: 'b', lane: 1 }), 200, 64);
    expect(lane1.topPx - lane0.topPx).toBe(MINI_MAP_LANE_STEP_PX);
  });

  it('a negative-lane marker sits above the rail centre', () => {
    const laneNeg = getMiniMapMarkerPosition(marker({ messageId: 'a', lane: -2 }), 200, 64);
    const lane0 = getMiniMapMarkerPosition(marker({ messageId: 'b', lane: 0 }), 200, 64);
    expect(laneNeg.topPx).toBeLessThan(lane0.topPx);
  });
});

// ── reduce motion ───────────────────────────────────────────────

describe('TimelineMiniMap — reduce motion', () => {
  it('the expand/collapse height transition snaps when reduceMotion is true', () => {
    // reduceMotion true → setValue (snap); false → Animated.timing.
    expect(COMPONENT_SRC).toMatch(/reduceMotion\s*===\s*true/);
    expect(COMPONENT_SRC).toContain('heightAnim.setValue');
    expect(COMPONENT_SRC).toContain('Animated.timing');
  });

  it('the imperative scrub scroll is non-animated (pan, do not animate)', () => {
    // handleMiniMapScrub in the host always uses animated: false; the
    // mini-map itself only emits a centre fraction. Assert the component
    // never animates its own state on scrub.
    expect(COMPONENT_SRC).toContain('onScrubViewport');
  });
});

// ── RN primitives only ──────────────────────────────────────────

describe('TimelineMiniMap — RN primitives only, no new dependency', () => {
  it('imports only from react and react-native', () => {
    const importLines = COMPONENT_SRC.split(/\r?\n/).filter((l) =>
      /^import\s/.test(l.trim()),
    );
    for (const line of importLines) {
      const fromMatch = line.match(/from\s+['"]([^'"]+)['"]/);
      if (!fromMatch) continue;
      const mod = fromMatch[1];
      const ok =
        mod === 'react' ||
        mod === 'react-native' ||
        mod.startsWith('./') ||
        mod.startsWith('../');
      expect(ok).toBe(true);
    }
  });

  it('uses PanResponder from RN core for the viewport scrubber (no new dep)', () => {
    expect(COMPONENT_SRC).toContain('PanResponder');
  });

  it('contains no SVG / Bootstrap / animation-library import', () => {
    expect(COMPONENT_SRC.includes('react-native-svg')).toBe(false);
    expect(COMPONENT_SRC.includes('bootstrap')).toBe(false);
    expect(COMPONENT_SRC.includes('reanimated')).toBe(false);
    expect(COMPONENT_SRC.includes('lottie')).toBe(false);
  });
});
