/**
 * IX-002 — Timeline mini-map overview model (pure TypeScript).
 *
 * A deterministic PROJECTION of the already-built `ArgumentTimelineMapModel`
 * into a tiny constant-size "overview rail" view-model. The main timeline
 * (`ArgumentTimelineMap`) becomes a very wide horizontal scroll surface for
 * long debates; this model powers a fixed-width strip that renders the whole
 * conversation at a glance plus jump-to affordances.
 *
 * Doctrine anchors — read before changing anything in this file:
 *
 *   - This model NEVER re-derives heat or branch logic. It RE-LABELS the
 *     already-computed `temperatureBand` (an activity proxy) and reads
 *     `branchId` / `branchRootMessageId` / `lane` verbatim from
 *     `ArgumentTimelineMapNode`. Heat = activity / friction, NEVER
 *     correctness, winning, popularity, or truth (cdiscourse-doctrine §2).
 *   - Heat influences ONLY the `heatTier` re-label. It does NOT feed branch
 *     clustering, jump-target selection (the hot zone is the LONGEST run,
 *     chosen by length not by "hottest"), marker ordering, or any band that
 *     resembles a strength / standing band. This model never even reads
 *     `standingBand`.
 *   - All x-coordinates are NORMALIZED fractions in [0,1] so the mini-map is
 *     invariant to the main map's `xStep` / density (IX-001-proof).
 *
 * No React. No Supabase. No network. No AI. No `Date.now()`. No mutation of
 * any input. No new dependency. Pure, deterministic, JSON-serializable I/O.
 */

import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineTemperatureBand,
} from './argumentGameSurfaceModel';
// Type-only — the kind-color token table is consumed for marker fill.
import { TIMELINE_KIND_COLORS } from './argumentGameSurfaceModel';
import type { BranchCollapseState } from './branchTopologyModel';
// `deriveBranchLabel` is reused verbatim so branch wording never drifts.
import { deriveBranchLabel } from './keyboardNavigationModel';

// ── Constants ──────────────────────────────────────────────────

/**
 * Length threshold above which the mini-map is `isAvailable`. A debate with
 * fewer moves is already fully visible on the main map — an overview adds
 * nothing and would only crowd a narrow phone (acceptance criterion: "does
 * not crowd mobile UI").
 */
export const MINI_MAP_MIN_MOVES = 12;

/** Minimum contiguous warm/hot marker run length to count as a hot zone. */
export const MINI_MAP_HOT_ZONE_MIN_RUN = 2;

/** Fixed expanded rail height in px. The mini-map never grows with message
 *  count — markers compress, the rail does not get taller. */
export const MINI_MAP_RAIL_HEIGHT = 64;

/** Vertical px offset per branch lane on the mini rail. Compressed so a
 *  ±3-lane spread still fits inside `MINI_MAP_RAIL_HEIGHT`. */
export const MINI_MAP_LANE_STEP_PX = 7;

/** Marker dot side length in px. Same size for every move — at mini-map
 *  scale marker shape carries nothing; the main map owns shape grammar. */
export const MINI_MAP_MARKER_SIZE = 7;

// ── Public types ───────────────────────────────────────────────

/** Heat tier on the mini-map. ACTIVITY level only. Never a verdict. */
export type MiniMapHeatTier = 'quiet' | 'mild' | 'warm' | 'hot';

/** A single move plotted on the mini-map rail. One per timeline node. */
export interface MiniMapMarker {
  messageId: string;
  /** 1-based, mirrors `ArgumentTimelineMapNode.ordinal`. */
  ordinal: number;
  /** Normalized horizontal position in [0,1]. */
  xFraction: number;
  /** Branch lane the node sits on (from `node.lane`). Drives vertical offset. */
  lane: number;
  /** Branch cluster id (from `node.branchId`). */
  branchId: string;
  /** True when on the active path (`node.isActivePath`). */
  isActivePath: boolean;
  /** True when this is the active node (`node.isActive`). */
  isActive: boolean;
  /** True for the opening claim (`node.isRoot`). */
  isRoot: boolean;
  /** True for the latest move (`node.isLatest`). */
  isLatest: boolean;
  /** True for a junction — a parent with 2+ replies (`node.isJunction`). */
  isJunction: boolean;
  /** True for a missing-parent node (`node.isDetached`). */
  isDetached: boolean;
  /** Heat tier — ACTIVITY, not correctness. Re-labelled from `temperatureBand`. */
  heatTier: MiniMapHeatTier;
  /** Kind color family — reused token, never re-picked. */
  kindColorFamily: TimelineKindColorFamily;
  /** Marker fill color (kind color, reused from `TIMELINE_KIND_COLORS`). */
  color: string;
}

/** A contiguous run of warm/hot markers — the "hot zone" jump target. */
export interface MiniMapHotZone {
  /** Start normalized fraction of the run. */
  xStartFraction: number;
  /** End normalized fraction of the run. */
  xEndFraction: number;
  /** The message id to jump to (first move of the run). */
  jumpTargetMessageId: string;
  /** Count of moves in the run. */
  moveCount: number;
}

/** A branch cluster summarized for a jump chip + a region band. */
export interface MiniMapBranchCluster {
  branchId: string;
  /** The branch root message id — the jump target for this cluster. */
  branchRootMessageId: string;
  /** Branch lane (0 = mainline). */
  lane: number;
  /** Move count in this branch cluster. */
  moveCount: number;
  /** Normalized x span start of the cluster. */
  xStartFraction: number;
  /** Normalized x span end of the cluster. */
  xEndFraction: number;
  /** True when this branch is collapsed in the host's `BranchCollapseState`. */
  isCollapsed: boolean;
  /** Hidden-move count when collapsed (0 when expanded). */
  hiddenMoveCount: number;
  /** Plain-language label, e.g. "on the main line" / "on a side branch". */
  laneLabel: string;
  /** True when the active path runs through this cluster. */
  containsActivePath: boolean;
  /** True for the mainline cluster (lane 0). The mainline gets no chip. */
  isMainline: boolean;
}

/** The complete mini-map view-model. */
export interface TimelineMiniMapModel {
  /** True when the debate is long enough for the mini-map to be useful. */
  isAvailable: boolean;
  /** Total move count (mirrors `timelineMap.nodes.length`). */
  moveCount: number;
  markers: MiniMapMarker[];
  branchClusters: MiniMapBranchCluster[];
  /** At most one hot zone — the longest warm/hot run. `null` when none. */
  hotZone: MiniMapHotZone | null;
  /** Active-path markers' message ids, in chronological order. */
  activePathMessageIds: string[];
  /** Jump target — opening claim. `null` only for an empty timeline. */
  rootMessageId: string | null;
  /** Jump target — latest move. `null` only for an empty timeline. */
  latestMessageId: string | null;
  /** Min lane across all markers — drives the mini-map lane-band height. */
  minLane: number;
  /** Max lane across all markers. */
  maxLane: number;
  /** Count of collapsed branches (for the "N branches collapsed" chip). */
  collapsedBranchCount: number;
  /** Plain-language one-line region summary, e.g.
   *  "12 moves · 3 branches · 1 hot zone". */
  summaryLine: string;
}

/** Input. Everything is already-built; this model NEVER re-derives heat or
 *  branches. */
export interface BuildTimelineMiniMapInput {
  timelineMap: ArgumentTimelineMapModel;
  /** The host's branch-collapse state (BR-001's `BranchCollapseState`).
   *  Optional — degrades to all-expanded when omitted. */
  collapseState?: BranchCollapseState;
  /**
   * Length threshold above which the mini-map is `isAvailable`. Defaults to
   * `MINI_MAP_MIN_MOVES` (the product rule). Caller may override.
   */
  minMovesToShow?: number;
}

/** The slice of the conversation currently visible in the MAIN timeline. */
export interface MiniMapViewportWindow {
  /** Normalized left edge of the visible window, clamped to [0,1]. */
  xStartFraction: number;
  /** Normalized right edge of the visible window, clamped to [0,1]. */
  xEndFraction: number;
  /** True when the window covers the entire conversation (no scroll needed). */
  coversAll: boolean;
}

export interface BuildViewportWindowInput {
  /** Host ScrollView contentOffset.x (px). */
  scrollX: number;
  /** Host ScrollView measured viewport width (px). */
  viewportWidth: number;
  /** `timelineMap.scrollWidth` (px) — total scrollable content width. */
  scrollWidth: number;
}

/** A jump request the mini-map emits back to the host. */
export interface MiniMapJumpRequest {
  kind: 'root' | 'latest' | 'hot_zone' | 'branch' | 'marker' | 'region';
  /** The message id to activate + scroll to. */
  messageId: string;
}

// ── Helpers ────────────────────────────────────────────────────

/** Clamp a number into [0,1]. NaN / non-finite → 0. */
function clamp01(n: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Re-label a `TimelineTemperatureBand` into a `MiniMapHeatTier`.
 *
 * This is the ONLY place the mini-map consumes heat. It NEVER re-infers
 * heat — `inferTemperatureBand` already did. `'unknown'` degrades to
 * `'quiet'` (no heat shown).
 *
 *   cool    -> quiet
 *   mild    -> mild
 *   warm    -> warm
 *   hot     -> hot
 *   unknown -> quiet
 */
export function mapTemperatureToHeatTier(
  band: TimelineTemperatureBand | null | undefined,
): MiniMapHeatTier {
  switch (band) {
    case 'mild':
      return 'mild';
    case 'warm':
      return 'warm';
    case 'hot':
      return 'hot';
    case 'cool':
    case 'unknown':
    default:
      return 'quiet';
  }
}

/** True when a heat tier counts toward a hot zone (warm or hot). */
function isHotZoneTier(tier: MiniMapHeatTier): boolean {
  return tier === 'warm' || tier === 'hot';
}

// ── Marker projection ──────────────────────────────────────────

/**
 * Project a single timeline node into a `MiniMapMarker`. Every field is
 * read verbatim from the node except `xFraction` (normalized) and
 * `heatTier` (re-labelled). Defensive against missing fields.
 */
function projectMarker(
  node: ArgumentTimelineMapNode,
  index: number,
  nodeCount: number,
): MiniMapMarker {
  // First node -> 0, last node -> 1. Single node -> 0 (guarded max).
  const xFraction = clamp01(index / Math.max(1, nodeCount - 1));
  const kindColorFamily: TimelineKindColorFamily = node.kindColorFamily || 'default';
  const color = node.kindColor || TIMELINE_KIND_COLORS[kindColorFamily] || TIMELINE_KIND_COLORS.default;
  return {
    messageId: node.messageId,
    ordinal: typeof node.ordinal === 'number' ? node.ordinal : index + 1,
    xFraction,
    lane: typeof node.lane === 'number' ? node.lane : 0,
    branchId: node.branchId || `branch-root-${node.messageId}`,
    isActivePath: node.isActivePath === true,
    isActive: node.isActive === true,
    isRoot: node.isRoot === true,
    isLatest: node.isLatest === true,
    isJunction: node.isJunction === true,
    isDetached: node.isDetached === true,
    heatTier: mapTemperatureToHeatTier(node.temperatureBand),
    kindColorFamily,
    color,
  };
}

// ── Hot zone detection ─────────────────────────────────────────

/**
 * Find the single longest contiguous run of warm/hot markers. Returns
 * `null` when no run reaches `MINI_MAP_HOT_ZONE_MIN_RUN`.
 *
 * The hot zone is chosen by LENGTH — never by "hottest". A long run of
 * `warm` markers beats a short run that contains a `hot` marker. This keeps
 * heat from quietly becoming a quality ranking (cdiscourse-doctrine §2).
 * On a tie, the earliest run wins (deterministic).
 */
export function findHotZone(markers: ReadonlyArray<MiniMapMarker>): MiniMapHotZone | null {
  if (!Array.isArray(markers) || markers.length === 0) return null;

  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let i = 0; i < markers.length; i++) {
    if (isHotZoneTier(markers[i].heatTier)) {
      if (runStart < 0) runStart = i;
      const len = i - runStart + 1;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
    }
  }

  if (bestStart < 0 || bestLen < MINI_MAP_HOT_ZONE_MIN_RUN) return null;

  const firstMarker = markers[bestStart];
  const lastMarker = markers[bestStart + bestLen - 1];
  return {
    xStartFraction: clamp01(firstMarker.xFraction),
    xEndFraction: clamp01(lastMarker.xFraction),
    jumpTargetMessageId: firstMarker.messageId,
    moveCount: bestLen,
  };
}

// ── Branch clusters ────────────────────────────────────────────

/**
 * Group the timeline's nodes into branch clusters keyed by `branchId`. One
 * cluster per distinct `branchId`; the cluster carries the jump target
 * (`branchRootMessageId`), the lane, the move count, the normalized x span,
 * and the collapse state read from the host's `BranchCollapseState`.
 *
 * `branchId` / `branchRootMessageId` / `lane` are read VERBATIM from the
 * already-built map nodes — no parallel branch logic is invented here.
 */
export function buildBranchClusters(
  timelineMap: ArgumentTimelineMapModel,
  collapseState?: BranchCollapseState,
): MiniMapBranchCluster[] {
  const nodes = Array.isArray(timelineMap?.nodes) ? timelineMap.nodes : [];
  if (nodes.length === 0) return [];

  const nodeCount = nodes.length;
  const collapse = collapseState ?? {};

  interface Accum {
    branchId: string;
    branchRootMessageId: string;
    lane: number;
    moveCount: number;
    minIndex: number;
    maxIndex: number;
    containsActivePath: boolean;
    firstSeenOrder: number;
  }

  const byBranch = new Map<string, Accum>();
  let order = 0;
  nodes.forEach((node, index) => {
    const branchId = node.branchId || `branch-root-${node.messageId}`;
    let acc = byBranch.get(branchId);
    if (!acc) {
      acc = {
        branchId,
        branchRootMessageId: node.branchRootMessageId || node.messageId,
        lane: typeof node.lane === 'number' ? node.lane : 0,
        moveCount: 0,
        minIndex: index,
        maxIndex: index,
        containsActivePath: false,
        firstSeenOrder: order++,
      };
      byBranch.set(branchId, acc);
    }
    acc.moveCount += 1;
    if (index < acc.minIndex) acc.minIndex = index;
    if (index > acc.maxIndex) acc.maxIndex = index;
    if (node.isActivePath === true) acc.containsActivePath = true;
  });

  const clusters: MiniMapBranchCluster[] = [];
  for (const acc of byBranch.values()) {
    const isCollapsed = collapse[acc.branchRootMessageId] === 'collapsed';
    // Hidden-move count: when collapsed, every move in the cluster except
    // the branch root itself is hidden behind the stub.
    const hiddenMoveCount = isCollapsed ? Math.max(0, acc.moveCount - 1) : 0;
    const isMainline = acc.lane === 0;
    clusters.push({
      branchId: acc.branchId,
      branchRootMessageId: acc.branchRootMessageId,
      lane: acc.lane,
      moveCount: acc.moveCount,
      xStartFraction: clamp01(acc.minIndex / Math.max(1, nodeCount - 1)),
      xEndFraction: clamp01(acc.maxIndex / Math.max(1, nodeCount - 1)),
      isCollapsed,
      hiddenMoveCount,
      // Reuse `deriveBranchLabel` verbatim so branch wording never drifts.
      laneLabel: deriveBranchLabel({ lane: acc.lane, isDetached: false }),
      containsActivePath: acc.containsActivePath,
      isMainline,
    });
  }

  // Deterministic ordering: mainline first, then by first-seen chronology.
  clusters.sort((a, b) => {
    if (a.isMainline !== b.isMainline) return a.isMainline ? -1 : 1;
    const oa = byBranch.get(a.branchId)?.firstSeenOrder ?? 0;
    const ob = byBranch.get(b.branchId)?.firstSeenOrder ?? 0;
    return oa - ob;
  });

  return clusters;
}

// ── Summary line ───────────────────────────────────────────────

/**
 * Build the plain-language one-line region summary, e.g.
 * "12 moves · 3 branches · 1 hot zone". No internal codes, no verdict
 * tokens. Branch count excludes the mainline cluster (mainline is implied).
 */
export function buildMiniMapSummaryLine(model: TimelineMiniMapModel): string {
  if (!model || model.moveCount === 0) return '';
  const parts: string[] = [];
  parts.push(`${model.moveCount} ${model.moveCount === 1 ? 'move' : 'moves'}`);

  const sideBranchCount = model.branchClusters.filter((c) => !c.isMainline).length;
  if (sideBranchCount > 0) {
    parts.push(`${sideBranchCount} ${sideBranchCount === 1 ? 'branch' : 'branches'}`);
  }

  if (model.collapsedBranchCount > 0) {
    parts.push(
      `${model.collapsedBranchCount} ${
        model.collapsedBranchCount === 1 ? 'branch collapsed' : 'branches collapsed'
      }`,
    );
  }

  if (model.hotZone) {
    parts.push('1 hot zone');
  }

  return parts.join(' · ');
}

// ── Region jump resolution ─────────────────────────────────────

/**
 * Map a tapped normalized x position to the nearest marker. Returns a
 * `region` jump request, or `null` when there are no markers. The tapped
 * fraction is clamped to [0,1] first so out-of-range taps never throw.
 */
export function resolveRegionJumpTarget(
  model: TimelineMiniMapModel,
  xFraction: number,
): MiniMapJumpRequest | null {
  if (!model || !Array.isArray(model.markers) || model.markers.length === 0) {
    return null;
  }
  const target = clamp01(xFraction);
  let nearest = model.markers[0];
  let nearestDist = Math.abs(nearest.xFraction - target);
  for (let i = 1; i < model.markers.length; i++) {
    const dist = Math.abs(model.markers[i].xFraction - target);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = model.markers[i];
    }
  }
  return { kind: 'region', messageId: nearest.messageId };
}

// ── Viewport window ────────────────────────────────────────────

/**
 * Compute the normalized slice of the conversation currently visible in the
 * MAIN timeline from the host's scroll offset + measured viewport width.
 *
 * Edge cases (never throws on NaN / negative inputs — all clamped):
 *   - `scrollWidth <= 0` → whole conversation, `coversAll: true`.
 *   - `viewportWidth <= 0` (layout not measured yet) → `coversAll: true`,
 *     full-width window, until layout settles.
 *   - `viewportWidth >= scrollWidth` (everything fits) → `coversAll: true`.
 */
export function buildViewportWindow(
  input: BuildViewportWindowInput,
): MiniMapViewportWindow {
  const scrollWidth =
    typeof input?.scrollWidth === 'number' && Number.isFinite(input.scrollWidth)
      ? input.scrollWidth
      : 0;
  const viewportWidth =
    typeof input?.viewportWidth === 'number' && Number.isFinite(input.viewportWidth)
      ? input.viewportWidth
      : 0;
  const scrollX =
    typeof input?.scrollX === 'number' && Number.isFinite(input.scrollX)
      ? input.scrollX
      : 0;

  // Layout not measured yet, or content is not scrollable, or everything
  // fits — show a full-width window with the drag handle hidden.
  if (scrollWidth <= 0 || viewportWidth <= 0 || viewportWidth >= scrollWidth) {
    return { xStartFraction: 0, xEndFraction: 1, coversAll: true };
  }

  const xStartFraction = clamp01(scrollX / scrollWidth);
  const xEndFraction = clamp01((scrollX + viewportWidth) / scrollWidth);
  return { xStartFraction, xEndFraction, coversAll: false };
}

// ── Main builder ───────────────────────────────────────────────

/**
 * Build the complete `TimelineMiniMapModel` from an already-built
 * `ArgumentTimelineMapModel`.
 *
 *   - Empty timeline → `isAvailable: false`, empty markers / clusters,
 *     `hotZone: null`, `summaryLine: ''`. Never throws.
 *   - `isAvailable` ⇔ `nodes.length >= (minMovesToShow ?? MINI_MAP_MIN_MOVES)`.
 *   - `markers` are in chronological order (mirrors `timelineMap.nodes`).
 *   - Every missing / `undefined` field degrades to a safe default.
 */
export function buildTimelineMiniMapModel(
  input: BuildTimelineMiniMapInput,
): TimelineMiniMapModel {
  const timelineMap = input?.timelineMap;
  const nodes: ArgumentTimelineMapNode[] = Array.isArray(timelineMap?.nodes)
    ? timelineMap!.nodes
    : [];
  const nodeCount = nodes.length;
  const threshold =
    typeof input?.minMovesToShow === 'number' && input.minMovesToShow > 0
      ? input.minMovesToShow
      : MINI_MAP_MIN_MOVES;

  if (nodeCount === 0) {
    return {
      isAvailable: false,
      moveCount: 0,
      markers: [],
      branchClusters: [],
      hotZone: null,
      activePathMessageIds: [],
      rootMessageId: null,
      latestMessageId: null,
      minLane: 0,
      maxLane: 0,
      collapsedBranchCount: 0,
      summaryLine: '',
    };
  }

  const markers = nodes.map((node, index) => projectMarker(node, index, nodeCount));
  const branchClusters = buildBranchClusters(timelineMap!, input?.collapseState);
  const hotZone = findHotZone(markers);

  const activePathMessageIds = markers
    .filter((m) => m.isActivePath)
    .map((m) => m.messageId);

  let minLane = markers[0].lane;
  let maxLane = markers[0].lane;
  for (const m of markers) {
    if (m.lane < minLane) minLane = m.lane;
    if (m.lane > maxLane) maxLane = m.lane;
  }

  const collapsedBranchCount = branchClusters.filter((c) => c.isCollapsed).length;

  const model: TimelineMiniMapModel = {
    isAvailable: nodeCount >= threshold,
    moveCount: nodeCount,
    markers,
    branchClusters,
    hotZone,
    activePathMessageIds,
    rootMessageId: timelineMap?.rootMessageId ?? null,
    latestMessageId: timelineMap?.latestMessageId ?? null,
    minLane,
    maxLane,
    collapsedBranchCount,
    summaryLine: '',
  };
  model.summaryLine = buildMiniMapSummaryLine(model);
  return model;
}
