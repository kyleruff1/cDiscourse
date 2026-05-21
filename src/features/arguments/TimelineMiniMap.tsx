/**
 * IX-002 — TimelineMiniMap
 *
 * A thin, fixed-width "overview rail" for the argument timeline. For long
 * debates the main `ArgumentTimelineMap` becomes a very wide horizontal
 * scroll surface; this strip renders the WHOLE conversation at a glance
 * with a draggable / tappable viewport-window indicator and jump-to
 * affordances (Root · Latest · Hot zone · one chip per side branch).
 *
 * Doctrine anchors (cdiscourse-doctrine §2, timeline-grammar):
 *   - Heat markers are ACTIVITY / friction signals, never truth, winning,
 *     correctness, or popularity. No verdict copy, no "winning" glyph.
 *   - Every signal survives grayscale: root = notch, latest = size+border,
 *     junction = hollow ring, active = size+border, heat = ring, branch
 *     cluster = band, active path = under-line. Color is supplementary.
 *
 * RN primitives only (`View` / `Pressable` / `Text` / `PanResponder` from
 * RN core). No new dependency, no SVG, no animation library. An optional
 * RN-core `Animated` height transition for expand/collapse is gated by
 * reduce-motion (snaps when reduce-motion is on).
 *
 * Every visual decision is extracted into an exported pure helper so the
 * test suite can exercise it directly — the repo's established
 * `BranchCollapseStub` / `ConversationMiniTimeline` discipline.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  MiniMapBranchCluster,
  MiniMapHeatTier,
  MiniMapHotZone,
  MiniMapJumpRequest,
  MiniMapMarker,
  MiniMapViewportWindow,
  TimelineMiniMapModel,
} from './timelineMiniMapModel';
import {
  MINI_MAP_LANE_STEP_PX,
  MINI_MAP_MARKER_SIZE,
  MINI_MAP_RAIL_HEIGHT,
  resolveRegionJumpTarget,
} from './timelineMiniMapModel';

// ── Constants ──────────────────────────────────────────────────

/** Minimum effective tap target per accessibility-targets. */
export const MINI_MAP_MIN_TAP_PX = 44;

/** Visible height of a jump chip / the collapse header (px). The hitSlop
 *  below tops it up to `MINI_MAP_MIN_TAP_PX`. */
export const MINI_MAP_CHIP_VISIBLE_HEIGHT = 28;

/** hitSlop applied to every Pressable whose visual height is < 44px so the
 *  effective target meets the accessibility minimum. */
export const MINI_MAP_HIT_SLOP = Object.freeze({
  top: 8,
  bottom: 8,
  left: 8,
  right: 8,
});

/** Indigo active-ring family — reused, never a new color token. */
const ACTIVE_INDIGO = '#a5b4fc';
/** Cream — reused for the active marker + latest marker border. */
const CREAM = '#f8fafc';
/** Amber — reused root token (`nodeRoot` family). */
const ROOT_AMBER = '#fde68a';
/** Faint slate branch-cluster band tint. */
const BRANCH_BAND_TINT = 'rgba(148,163,184,0.14)';
/** Faint warm hot-zone underlay band. */
const HOT_ZONE_BAND_TINT = 'rgba(249,115,22,0.18)';
/** Warm ring on `hot` markers. */
const HOT_RING = 'rgba(249,115,22,0.55)';
/** Fainter ring on `warm` markers. */
const WARM_RING = 'rgba(249,115,22,0.30)';
/** Low-alpha indigo under-line beneath active-path markers. */
const ACTIVE_PATH_UNDERLINE = 'rgba(165,180,252,0.45)';

// ── Pure helpers (exported for tests) ──────────────────────────

/**
 * Effective tap target px for a chip / header — the visible side plus the
 * hitSlop on both axes. Used to assert the 44px accessibility minimum.
 */
export function getMiniMapEffectiveTapPx(
  visibleSizePx: number,
  hitSlopPx: number,
): number {
  return Math.max(0, visibleSizePx) + Math.max(0, hitSlopPx) * 2;
}

/**
 * Heat-ring style for a marker. Geometry-bearing: `hot` gets a visible
 * ring, `warm` a fainter one, `mild` / `quiet` none. The ring NEVER
 * changes the marker's kind color and NEVER adds a verdict glyph — heat is
 * an activity signal only. Returns `null` when no ring should render.
 */
export function getMiniMapHeatRingStyle(
  tier: MiniMapHeatTier,
): { borderWidth: number; borderColor: string } | null {
  if (tier === 'hot') return { borderWidth: 1, borderColor: HOT_RING };
  if (tier === 'warm') return { borderWidth: 1, borderColor: WARM_RING };
  return null;
}

/**
 * Marker geometry. Root / latest / active / junction are distinguished by
 * SIZE + BORDER + SHAPE (notch / ring) — every signal survives grayscale.
 * Color is supplementary.
 */
export interface MiniMapMarkerGeometry {
  /** Marker side length px. Active / latest are slightly larger. */
  sizePx: number;
  /** Border width px (active + latest get a visible border). */
  borderWidthPx: number;
  /** Border color (cream for active / latest). Empty string → no border. */
  borderColor: string;
  /** True when a hollow junction ring should render around the marker. */
  showsJunctionRing: boolean;
  /** True when a root notch tab should render above the marker. */
  showsRootNotch: boolean;
}

export function getMiniMapMarkerGeometry(marker: MiniMapMarker): MiniMapMarkerGeometry {
  const base = MINI_MAP_MARKER_SIZE;
  let sizePx = base;
  let borderWidthPx = 0;
  let borderColor = '';
  if (marker.isActive) {
    // Active marker: ~1.3x size + cream border. Geometry, not color-only.
    sizePx = Math.round(base * 1.3);
    borderWidthPx = 1.5;
    borderColor = CREAM;
  } else if (marker.isLatest) {
    // Latest marker: slightly larger + cream 1px border.
    sizePx = base + 2;
    borderWidthPx = 1;
    borderColor = CREAM;
  }
  return {
    sizePx,
    borderWidthPx,
    borderColor,
    showsJunctionRing: marker.isJunction === true,
    showsRootNotch: marker.isRoot === true,
  };
}

/**
 * Pixel position of a marker on the mini rail. `xFraction` maps linearly
 * across the measured `railWidthPx`; `lane` offsets the marker vertically
 * by `MINI_MAP_LANE_STEP_PX` around the rail centre.
 */
export function getMiniMapMarkerPosition(
  marker: MiniMapMarker,
  railWidthPx: number,
  railHeightPx: number,
): { leftPx: number; topPx: number } {
  const safeWidth = Math.max(0, railWidthPx);
  const leftPx = clampFraction(marker.xFraction) * safeWidth;
  const centreY = Math.max(0, railHeightPx) / 2;
  const topPx = centreY + marker.lane * MINI_MAP_LANE_STEP_PX;
  return { leftPx, topPx };
}

/**
 * Geometry for the viewport-window overlay rectangle. `coversAll` spans the
 * full rail. Otherwise the window is positioned from the normalized
 * fractions. Width is floored at a small minimum so the window is always
 * grabbable.
 */
export function getViewportWindowRectStyle(
  viewportWindow: MiniMapViewportWindow,
  railWidthPx: number,
): { leftPx: number; widthPx: number; showsDragHandle: boolean } {
  const safeWidth = Math.max(0, railWidthPx);
  if (!viewportWindow || viewportWindow.coversAll) {
    return { leftPx: 0, widthPx: safeWidth, showsDragHandle: false };
  }
  const startFrac = clampFraction(viewportWindow.xStartFraction);
  const endFrac = clampFraction(viewportWindow.xEndFraction);
  const leftPx = startFrac * safeWidth;
  const rawWidth = (endFrac - startFrac) * safeWidth;
  const widthPx = Math.max(8, Math.min(safeWidth - leftPx, rawWidth));
  return { leftPx, widthPx, showsDragHandle: true };
}

/**
 * Plain-language accessibility label for the whole mini-map. Explicitly
 * frames heat as ACTIVITY, never a result — cdiscourse-doctrine §2.
 */
export function buildMiniMapAccessibilityLabel(model: TimelineMiniMapModel): string {
  if (!model || model.moveCount === 0) return 'Conversation overview. No moves yet.';
  const sideBranches = model.branchClusters.filter((c) => !c.isMainline).length;
  const parts: string[] = [`Conversation overview. ${model.moveCount} moves`];
  if (sideBranches > 0) {
    parts.push(`${sideBranches} side ${sideBranches === 1 ? 'branch' : 'branches'}`);
  }
  if (model.hotZone) {
    parts.push('one hot zone (recent activity, not a result)');
  }
  return `${parts.join(', ')}.`;
}

/**
 * Plain-language accessibility label for a branch jump chip.
 */
export function buildBranchChipAccessibilityLabel(cluster: MiniMapBranchCluster): string {
  const where = cluster.laneLabel; // e.g. "on a side branch"
  const moves = `${cluster.moveCount} ${cluster.moveCount === 1 ? 'move' : 'moves'}`;
  const collapsed = cluster.isCollapsed ? ', currently collapsed' : '';
  return `Jump to the branch ${where}, ${moves}${collapsed}`;
}

/** Visible label for a branch jump chip, e.g. "Side branch · 4". */
export function buildBranchChipLabel(cluster: MiniMapBranchCluster): string {
  // `laneLabel` is a sentence fragment ("on a side branch"); the chip
  // wants a compact noun. Map to a short plain noun without re-deriving
  // any branch logic.
  const noun = cluster.lane === 0 ? 'Mainline' : 'Side branch';
  return `${noun} · ${cluster.moveCount}`;
}

/** Visible label for the hot-zone chip. Never "winning" / "important". */
export function buildHotZoneChipLabel(hotZone: MiniMapHotZone): string {
  return `Hot zone · ${hotZone.moveCount}`;
}

/** Accessibility label for the hot-zone chip — frames heat as activity. */
export function buildHotZoneChipAccessibilityLabel(hotZone: MiniMapHotZone): string {
  return `Jump to the hot zone, ${hotZone.moveCount} ${
    hotZone.moveCount === 1 ? 'move' : 'moves'
  } of recent activity`;
}

function clampFraction(n: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// ── Component ──────────────────────────────────────────────────

export interface TimelineMiniMapProps {
  model: TimelineMiniMapModel;
  viewportWindow: MiniMapViewportWindow;
  /** Fired for every jump (chip tap, marker tap, region tap, window drag end). */
  onJump: (request: MiniMapJumpRequest) => void;
  /**
   * Fired continuously while the viewport window is dragged so the host can
   * scroll the MAIN map live. Emits a normalized centre fraction in [0,1].
   */
  onScrubViewport?: (centreFraction: number) => void;
  /** Effective reduce-motion (composed OS + PR-001 preference). */
  reduceMotion?: boolean;
  /** Start expanded. Default false (collapsed) — mobile non-crowding. */
  initiallyExpanded?: boolean;
}

export function TimelineMiniMap({
  model,
  viewportWindow,
  onJump,
  onScrubViewport,
  reduceMotion,
  initiallyExpanded,
}: TimelineMiniMapProps) {
  const [expanded, setExpanded] = useState<boolean>(initiallyExpanded === true);
  const [railWidth, setRailWidth] = useState<number>(0);
  const railWidthRef = useRef<number>(0);

  // Optional one-shot expand/collapse height transition. Reduce-motion
  // snaps (no animation). The value itself is informational chrome.
  const heightAnim = useRef(new Animated.Value(initiallyExpanded === true ? 1 : 0)).current;

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      if (reduceMotion === true) {
        heightAnim.setValue(next ? 1 : 0);
      } else {
        Animated.timing(heightAnim, {
          toValue: next ? 1 : 0,
          duration: 140,
          useNativeDriver: false,
        }).start();
      }
      return next;
    });
  }, [heightAnim, reduceMotion]);

  const handleRailLayout = useCallback((w: number) => {
    if (typeof w === 'number' && Number.isFinite(w) && w >= 0) {
      railWidthRef.current = w;
      setRailWidth(w);
    }
  }, []);

  // Region tap: a tap on the rail background (outside the window) jumps to
  // the nearest marker. Pointer-driven; the chips + window are the
  // keyboard / screen-reader operable controls.
  const handleRailRegionTap = useCallback(
    (xFraction: number) => {
      const req = resolveRegionJumpTarget(model, xFraction);
      if (req) onJump(req);
    },
    [model, onJump],
  );

  // Viewport-window scrubber. PanResponder from RN core — no new dep. On
  // web RN-web's PanResponder is less smooth than pointer events but the
  // primary affordance is the jump chips + region tap (design §Risks), so
  // a drag is an enhancement. The `accessibilityActions` on the window
  // (below) cover the keyboard path.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          const w = railWidthRef.current;
          if (w <= 0 || !onScrubViewport) return;
          const centre = clampFraction((gesture.moveX) / w);
          onScrubViewport(centre);
        },
      }),
    [onScrubViewport],
  );

  // Mobile non-crowding rule 1 — the mini-map does not exist for short
  // debates. `isAvailable === false` → render nothing (zero pixels).
  if (!model || model.isAvailable !== true) {
    return null;
  }

  const a11yLabel = buildMiniMapAccessibilityLabel(model);
  const rootActive =
    model.rootMessageId !== null &&
    model.activePathMessageIds.length > 0 &&
    model.activePathMessageIds[0] === model.rootMessageId &&
    model.markers.find((m) => m.isActive)?.messageId === model.rootMessageId;
  const latestActive =
    model.latestMessageId !== null &&
    model.markers.find((m) => m.isActive)?.messageId === model.latestMessageId;

  const sideBranchClusters = model.branchClusters.filter((c) => !c.isMainline);

  return (
    <View
      style={styles.root}
      testID="timeline-mini-map"
      accessibilityRole={Platform.OS === 'web' ? ('summary' as 'summary') : 'image'}
      accessibilityLabel={a11yLabel}
    >
      {/* Collapsed-by-default header chip — mobile non-crowding rule 2. */}
      <Pressable
        onPress={handleToggleExpand}
        accessibilityRole="button"
        accessibilityLabel={
          expanded
            ? 'Conversation overview, tap to collapse'
            : 'Conversation overview, tap to expand'
        }
        accessibilityState={{ expanded }}
        hitSlop={MINI_MAP_HIT_SLOP}
        testID="timeline-mini-map-header"
        style={styles.header}
      >
        <Text style={styles.headerChevron}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.headerTitle}>Overview</Text>
        <Text style={styles.headerSummary} numberOfLines={1}>
          {model.summaryLine}
        </Text>
      </Pressable>

      {expanded ? (
        <View testID="timeline-mini-map-body" style={styles.body}>
          {/* The mini rail — fixed height, never grows with message count. */}
          <View
            testID="timeline-mini-map-rail"
            style={styles.rail}
            onLayout={(e) => handleRailLayout(e?.nativeEvent?.layout?.width ?? 0)}
          >
            {/* Centre baseline. */}
            <View style={styles.railBaseline} pointerEvents="none" />

            {/* Branch-cluster bands — faint slate underlay per side cluster. */}
            {sideBranchClusters.map((cluster) => {
              const leftPx = clampFraction(cluster.xStartFraction) * railWidth;
              const widthPx = Math.max(
                4,
                (clampFraction(cluster.xEndFraction) - clampFraction(cluster.xStartFraction)) *
                  railWidth,
              );
              return (
                <View
                  key={`mini-branch-band-${cluster.branchId}`}
                  testID={`mini-branch-band-${cluster.branchId}`}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.branchBand,
                    { left: leftPx, width: widthPx, backgroundColor: BRANCH_BAND_TINT },
                  ]}
                />
              );
            })}

            {/* Hot-zone underlay band — faint warm tint over the longest run. */}
            {model.hotZone ? (
              <View
                testID="mini-hot-zone-band"
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.hotZoneBand,
                  {
                    left: clampFraction(model.hotZone.xStartFraction) * railWidth,
                    width: Math.max(
                      4,
                      (clampFraction(model.hotZone.xEndFraction) -
                        clampFraction(model.hotZone.xStartFraction)) *
                        railWidth,
                    ),
                    backgroundColor: HOT_ZONE_BAND_TINT,
                  },
                ]}
              />
            ) : null}

            {/* Markers — one tiny dot per move. Not individual focus stops;
                the rail is one accessible element (see component a11y). */}
            {model.markers.map((marker) => {
              const geom = getMiniMapMarkerGeometry(marker);
              const pos = getMiniMapMarkerPosition(marker, railWidth, MINI_MAP_RAIL_HEIGHT);
              const heatRing = getMiniMapHeatRingStyle(marker.heatTier);
              return (
                <View
                  key={`mini-marker-${marker.messageId}`}
                  testID={`mini-marker-${marker.messageId}`}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.markerWrap,
                    {
                      left: pos.leftPx - geom.sizePx / 2,
                      top: pos.topPx - geom.sizePx / 2,
                    },
                  ]}
                >
                  {/* Active-path under-line tint — geometry, not color-only. */}
                  {marker.isActivePath ? (
                    <View
                      testID={`mini-marker-activepath-${marker.messageId}`}
                      pointerEvents="none"
                      style={styles.activePathUnderline}
                    />
                  ) : null}
                  {/* Junction ring — hollow ring, visible in grayscale. */}
                  {geom.showsJunctionRing ? (
                    <View
                      testID={`mini-marker-junction-${marker.messageId}`}
                      pointerEvents="none"
                      style={[
                        styles.junctionRing,
                        {
                          width: geom.sizePx + 6,
                          height: geom.sizePx + 6,
                          borderRadius: (geom.sizePx + 6) / 2,
                          left: -3,
                          top: -3,
                        },
                      ]}
                    />
                  ) : null}
                  {/* Root notch tab — geometry above the marker. */}
                  {geom.showsRootNotch ? (
                    <View
                      testID={`mini-marker-root-notch-${marker.messageId}`}
                      pointerEvents="none"
                      style={styles.rootNotch}
                    />
                  ) : null}
                  {/* The marker dot itself. */}
                  <View
                    style={[
                      styles.markerDot,
                      {
                        width: geom.sizePx,
                        height: geom.sizePx,
                        borderRadius: geom.sizePx / 2,
                        backgroundColor: marker.color,
                      },
                      geom.borderWidthPx > 0
                        ? { borderWidth: geom.borderWidthPx, borderColor: geom.borderColor }
                        : null,
                      heatRing,
                    ]}
                  />
                </View>
              );
            })}

            {/* Region-tap layer — a tap anywhere on the rail background jumps
                to the nearest marker. Behind the viewport window. */}
            <Pressable
              testID="timeline-mini-map-region"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onPress={(e) => {
                const w = railWidthRef.current;
                const x = e?.nativeEvent?.locationX;
                if (w > 0 && typeof x === 'number' && Number.isFinite(x)) {
                  handleRailRegionTap(clampFraction(x / w));
                }
              }}
              style={styles.regionLayer}
            />

            {/* Viewport-window indicator — translucent rounded rect with a
                visible border so it is legible in grayscale. */}
            <Pressable
              {...panResponder.panHandlers}
              testID="timeline-mini-map-viewport-window"
              accessibilityRole="adjustable"
              accessibilityLabel="Visible portion of the timeline"
              accessibilityValue={{
                text: `showing ${Math.round(
                  clampFraction(viewportWindow?.xStartFraction ?? 0) * model.moveCount,
                )} to ${Math.round(
                  clampFraction(viewportWindow?.xEndFraction ?? 1) * model.moveCount,
                )} of ${model.moveCount}`,
              }}
              accessibilityActions={[
                { name: 'increment', label: 'Page right' },
                { name: 'decrement', label: 'Page left' },
              ]}
              onAccessibilityAction={(event) => {
                if (!onScrubViewport) return;
                const start = clampFraction(viewportWindow?.xStartFraction ?? 0);
                const end = clampFraction(viewportWindow?.xEndFraction ?? 1);
                const span = Math.max(0.02, end - start);
                const centre = start + span / 2;
                if (event?.nativeEvent?.actionName === 'increment') {
                  onScrubViewport(clampFraction(centre + span));
                } else if (event?.nativeEvent?.actionName === 'decrement') {
                  onScrubViewport(clampFraction(centre - span));
                }
              }}
              hitSlop={MINI_MAP_HIT_SLOP}
              style={[
                styles.viewportWindow,
                (() => {
                  const rect = getViewportWindowRectStyle(viewportWindow, railWidth);
                  return { left: rect.leftPx, width: rect.widthPx };
                })(),
              ]}
            />
          </View>

          {/* Jump chips row — Root · Latest · Hot zone · per-branch. */}
          <View style={styles.chipRow} testID="timeline-mini-map-chips">
            {model.rootMessageId ? (
              <Pressable
                testID="mini-jump-root"
                onPress={() =>
                  onJump({ kind: 'root', messageId: model.rootMessageId as string })
                }
                disabled={rootActive}
                accessibilityRole="button"
                accessibilityLabel="Jump to the opening claim"
                accessibilityState={{ disabled: rootActive }}
                hitSlop={MINI_MAP_HIT_SLOP}
                style={[styles.chip, rootActive && styles.chipDisabled]}
              >
                <Text style={styles.chipText}>Root</Text>
              </Pressable>
            ) : null}

            {model.latestMessageId ? (
              <Pressable
                testID="mini-jump-latest"
                onPress={() =>
                  onJump({ kind: 'latest', messageId: model.latestMessageId as string })
                }
                disabled={latestActive}
                accessibilityRole="button"
                accessibilityLabel="Jump to the latest move"
                accessibilityState={{ disabled: latestActive }}
                hitSlop={MINI_MAP_HIT_SLOP}
                style={[styles.chip, latestActive && styles.chipDisabled]}
              >
                <Text style={styles.chipText}>Latest</Text>
              </Pressable>
            ) : null}

            {model.hotZone ? (
              <Pressable
                testID="mini-jump-hot-zone"
                onPress={() =>
                  onJump({
                    kind: 'hot_zone',
                    messageId: (model.hotZone as MiniMapHotZone).jumpTargetMessageId,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={buildHotZoneChipAccessibilityLabel(model.hotZone)}
                hitSlop={MINI_MAP_HIT_SLOP}
                style={[styles.chip, styles.chipHot]}
              >
                <Text style={styles.chipText}>{buildHotZoneChipLabel(model.hotZone)}</Text>
              </Pressable>
            ) : null}

            {sideBranchClusters.map((cluster) => (
              <Pressable
                key={`mini-jump-branch-${cluster.branchId}`}
                testID={`mini-jump-branch-${cluster.branchId}`}
                onPress={() =>
                  onJump({ kind: 'branch', messageId: cluster.branchRootMessageId })
                }
                accessibilityRole="button"
                accessibilityLabel={buildBranchChipAccessibilityLabel(cluster)}
                hitSlop={MINI_MAP_HIT_SLOP}
                style={[styles.chip, cluster.isCollapsed && styles.chipCollapsed]}
              >
                <Text style={styles.chipText}>{buildBranchChipLabel(cluster)}</Text>
              </Pressable>
            ))}
          </View>

          {/* One-line region summary. */}
          <Text style={styles.summaryLine} testID="timeline-mini-map-summary">
            {model.summaryLine}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0b1220',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: MINI_MAP_CHIP_VISIBLE_HEIGHT,
    paddingVertical: 4,
  },
  headerChevron: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
  headerTitle: { color: '#e2e8f0', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  headerSummary: { color: '#64748b', fontSize: 11, flexShrink: 1 },
  body: { paddingHorizontal: 12, paddingBottom: 8 },
  rail: {
    position: 'relative',
    height: MINI_MAP_RAIL_HEIGHT,
    backgroundColor: '#020617',
    borderRadius: 6,
    marginTop: 4,
    overflow: 'hidden',
  },
  railBaseline: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: '50%',
    height: 2,
    marginTop: -1,
    backgroundColor: '#1f2937',
    borderRadius: 2,
  },
  branchBand: {
    position: 'absolute',
    top: '15%',
    height: '70%',
    borderRadius: 4,
  },
  hotZoneBand: {
    position: 'absolute',
    top: '20%',
    height: '60%',
    borderRadius: 4,
  },
  markerWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  markerDot: { borderColor: 'rgba(0,0,0,0.25)' },
  activePathUnderline: {
    position: 'absolute',
    left: -3,
    right: -3,
    bottom: -4,
    height: 2,
    borderRadius: 1,
    backgroundColor: ACTIVE_PATH_UNDERLINE,
  },
  junctionRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#a855f7',
    backgroundColor: 'transparent',
  },
  rootNotch: {
    position: 'absolute',
    top: -6,
    width: 4,
    height: 5,
    backgroundColor: ROOT_AMBER,
    borderRadius: 1,
  },
  regionLayer: { ...StyleSheet.absoluteFillObject },
  viewportWindow: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderWidth: 1.5,
    borderColor: ACTIVE_INDIGO,
    backgroundColor: 'rgba(165,180,252,0.12)',
    borderRadius: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    minHeight: MINI_MAP_CHIP_VISIBLE_HEIGHT,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipDisabled: { opacity: 0.4 },
  chipHot: { borderColor: HOT_RING },
  chipCollapsed: { borderStyle: 'dashed' as const, borderColor: '#475569' },
  chipText: { color: '#e2e8f0', fontSize: 11, fontWeight: '700' },
  summaryLine: { color: '#64748b', fontSize: 10, marginTop: 6 },
});
