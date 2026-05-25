/**
 * Stage 6.2 — ArgumentTimelineMap (Milestone 4).
 *
 * Horizontally scrollable graphical map of the conversation.
 *   - One node per message, earliest left → latest right.
 *   - Visible parent-child connectors (segmented gradient).
 *   - Active node ring + glow.
 *   - Junction markers ("3 routes").
 *   - Detached markers.
 *   - High-level bands above the rail (Opening / First clash / etc.).
 *   - Beginning / middle / end timestamp legend.
 *   - Prev / Next / Latest controls.
 *   - Compact color legend.
 *
 * No new dependencies. Edges are rendered as 6-segment gradient strips
 * built from <View>s so we never need react-native-svg.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import {
  TIMELINE_NODE_SIZE,
  TIMELINE_KIND_COLORS,
  type ArgumentBubbleControl,
  type ArgumentBubbleViewModel,
  type ArgumentTimelineMapModel,
  type ArgumentTimelineMapNode,
  type BubbleControlsContext,
} from './argumentGameSurfaceModel';
// IX-003 — keyboard nav (web-only) + the shared screen-reader label
// builder. `keyboardNavigationModel` is a pure model file (no React).
import {
  buildNodeAccessibilityLabel,
  deriveBranchLabel,
  isTimelineNavKey,
  resolveTimelineNavEffect,
} from './keyboardNavigationModel';
import {
  buildTimelineNodePopoverModel,
  decideInfoIconEffect,
  decideNodeTapEffect,
} from './timelineNodePopoverModel';
import { TimelineNodePopover } from './TimelineNodePopover';
import { TimelineNodeActionDock } from './TimelineNodeActionDock';
import type {
  TimelineNodeActionDockActionCode,
  TimelineNodeActionDockModel,
  TimelineNodeActionDockTarget,
} from './timelineNodeActionDockModel';
import type { EvidenceArtifact, TimelineEvidenceContract } from '../evidence/evidenceModel';
import type { NodeEvidenceDebtSummary } from '../evidence/evidenceDebtModel';
import {
  buildRailSegmentInput,
  buildWholeRailAccessibilityLabel,
  visibleSegmentSlice,
  VISIBLE_SLICE_DEFAULT_BUFFER_PX,
  type RailSegmentInput,
  type RailSegmentStyle,
} from './railSegmentModel';
import { GradientWaveRail } from './GradientWaveRail';
import {
  applyActiveAutoExpand,
  buildBranchKindMap,
  buildCollapsedRailInputs,
  buildEvidenceThreadMap,
  EMPTY_COLLAPSE_STATE,
  toggleBranchCollapse,
  type BranchCollapseState,
} from './branchTopologyModel';
import { BranchCollapseStub } from './BranchCollapseStub';
import {
  buildBranchGrammarMap,
  buildCollapsedBranchSummary,
  type CollapsedBranchSummary,
} from './branchGrammarModel';
import {
  deriveTimelineNodeVisualStyle,
  type TimelineNodeVisualStyle,
} from './timelineNodeVisualModel';
import { GLOW, RECEIPT_MARK } from '../../lib/designTokens';
// UX-001.2 — Band-aware internal top offset for the Timeline rail.
// Replaces the legacy `top: 120` literal that gave the above-rail bands
// vertical space. Bands now overlay the rail's y-range with
// `pointerEvents: 'none'` so the offset reduces to a minimal token.
import { useHeaderBreakpoint } from '../../hooks/useHeaderBreakpoint';
import { BAND_RAIL_OFFSET } from './timelineViewportLayoutModel';
// IX-002 — timeline mini-map overview. The mini-map is a deterministic
// PROJECTION of the already-built `map` + the existing `collapseState`;
// it is internal chrome (no new prop crosses the component boundary).
import { TimelineMiniMap } from './TimelineMiniMap';
import {
  buildTimelineMiniMapModel,
  buildViewportWindow,
  type MiniMapJumpRequest,
} from './timelineMiniMapModel';
// QOL-042 — linked prior argument context-chip row. The chip view-models
// are built by the pure `buildLinkedPriorArgumentChip` model in the room
// shell; this component only renders the row in the timeline header /
// context area, above the rail. Additive — omitting the prop is a no-op.
import { LinkedPriorArgumentChipRow } from './crossRoom/LinkedPriorArgumentChipRow';
import type { LinkedPriorArgumentChip } from './crossRoom/linkedPriorArgumentModel';

interface Props {
  map: ArgumentTimelineMapModel;
  onActivate: (messageId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpLatest: () => void;
  /** Activate the root message. When provided AND `map.showBackToRootControl`, the Back-to-root chip renders. */
  onJumpToRoot?: () => void;
  onToggleMode?: () => void;
  /**
   * Active message's bubble view-model. When present and the user
   * double-taps the active node, the per-node popover opens with the
   * same action set the side rail uses for this actor.
   */
  activeViewModel?: ArgumentBubbleViewModel | null;
  /** Total message count in the room — shown in the popover header. */
  totalCount?: number;
  /** Dispatch a quick action from the popover. Same signature as the sidecar. */
  onAction?: (control: ArgumentBubbleControl, messageId: string) => void;
  /** Open the deeper Cards / Stack view for a message. */
  onOpenDetails?: (messageId: string) => void;
  /** Forwarded to the controls-context for action permission gating. */
  controlsContext?: BubbleControlsContext;
  /**
   * EV-002 — Optional artifact map keyed by message id. The room shell
   * builds this once per render via EV-001's `buildEvidenceArtifacts`.
   * When the active node has artifacts, the popover renders a
   * `ReceiptChip` + an inline `SourceChainPopover` section.
   */
  artifactsByMessageId?: Record<string, ReadonlyArray<EvidenceArtifact>>;
  /**
   * EV-002 — Builder for the per-node `TimelineEvidenceContract`. The
   * room shell threads `getTimelineEvidenceContract(argumentType,
   * artifacts)` here so the popover and the chip never drift.
   */
  evidenceContractFor?: (messageId: string) => TimelineEvidenceContract | null;
  /**
   * EV-003 — Builder for the per-node `NodeEvidenceDebtSummary`. The room
   * shell derives the room's evidence debts once per render and threads a
   * per-node roll-up here; the popover renders an `EvidenceDebtChip` from
   * it. Mirrors `evidenceContractFor` so the obligation chip and the
   * existence chip stay in lockstep.
   */
  evidenceDebtSummaryFor?: (messageId: string) => NodeEvidenceDebtSummary | null;
  /**
   * EV-002 — True when the viewer cannot post (observer mode). Threaded
   * through to the popover so the "ask" CTA renders disabled with the
   * locked helper "Join a side to ask".
   */
  isReadModeViewer?: boolean;
  /**
   * SC-004 — Optional currently-selected target for the action dock. When
   * present and non-null, the dock renders below the popover dock area;
   * the popover and the dock are mutually exclusive (only one of them is
   * non-null at a time per the room-shell selection contract).
   */
  selectedTarget?: TimelineNodeActionDockTarget | null;
  /**
   * SC-004 — Optional pre-built action dock model. The room shell builds
   * this once per render (memoized by lifecycle/metadata input hashes).
   */
  actionDockModel?: TimelineNodeActionDockModel | null;
  /**
   * SC-004 — Selection mutation callback. Fired when a node tap should
   * activate the dock (replaces the popover when both surfaces would
   * trigger on the same tap; design §"Risks" #1).
   */
  onSelectTarget?: (target: TimelineNodeActionDockTarget | null) => void;
  /**
   * SC-004 — Dispatch a post-producing dock action back to the room shell.
   * The room shell threads the action + composer preset into the existing
   * composer + `submit-argument` Edge Function path.
   */
  onActionDockAction?: (action: TimelineNodeActionDockActionCode, target: TimelineNodeActionDockTarget) => void;
  /**
   * SC-004 — Open Cards-detail without a route push (surface toggle).
   */
  onOpenCardsDetail?: (target: TimelineNodeActionDockTarget) => void;
  /**
   * IX-004 — short label of the selected message, rendered as
   * "Acting on: <actingOnLabel>" above the action dock so the dock
   * target is never ambiguous. Optional — omitting it keeps the dock
   * exactly as SC-004 shipped it. The label string is built by the
   * IX-004 readout model (`timelineSelectedReadoutModel`), not here.
   */
  actingOnLabel?: string | null;
  /**
   * PR-001 — user's effective reduce-motion preference (the OS value
   * composed with the user's `system`/`on`/`off` override). When
   * supplied it REPLACES the component's own `AccessibilityInfo` read,
   * so the preferences popout's reduce-motion choice drives the board's
   * node-glow shadow. When omitted, the component keeps its independent
   * OS read (back-compat for any caller that does not thread it).
   */
  reduceMotionOverride?: boolean;
  /**
   * BR-004 — the room's principal actor labels (the OP + the Primary
   * Opponent). Threaded through to `buildBranchGrammarMap` so a collapsed
   * branch stub can report whether a principal engaged inside the
   * branch. Optional — when omitted, `primaryPartyEngaged` degrades to
   * `false` for non-mainline branches (it never throws). Back-compat for
   * any caller that does not yet know its principals.
   */
  principalActorLabels?: ReadonlyArray<string>;
  /**
   * QOL-042 — linked prior argument context chips for THIS (source)
   * room. Each chip references an earlier settled room; the room shell
   * builds the view-models with the pure `buildLinkedPriorArgumentChip`
   * model and threads them here. Rendered as a wrapping chip row in the
   * timeline header, above the rail (QOL-042 design §6.1). Optional —
   * omitting it (or passing an empty array) renders nothing; every
   * existing caller is unaffected.
   */
  linkedPriorChips?: ReadonlyArray<LinkedPriorArgumentChip>;
  /**
   * QOL-042 — open a linked prior (settled, read-only) argument room.
   * Fired by a chip's "Open prior argument" action. Only invoked for an
   * enabled action — a `title_only` chip's "Open" is disabled.
   */
  onOpenLinkedPrior?: (linkId: string) => void;
  /**
   * QOL-042 — open the Inspect popout's "From the linked prior argument"
   * section. Fired by a chip's "View context" action (authorized chips
   * with resolved-tangent context only).
   */
  onViewLinkedPriorContext?: (linkId: string) => void;
}

const RAIL_THICKNESS = 4;

/** Throttle scroll updates to ~60fps. */
const SCROLL_FRAME_MS = 16;

function NodeDot({
  node,
  totalNodes,
  onNodeTap,
  onInfoTap,
  isSelected,
  hasEvidenceArtifact,
  prefersReducedMotion,
}: {
  node: ArgumentTimelineMapNode;
  /** IX-003 — total node count, for the "position N of M" a11y fragment. */
  totalNodes: number;
  onNodeTap: (id: string) => void;
  onInfoTap?: (id: string) => void;
  /** VG-004 — node.messageId === SC-004 dock target's messageId. */
  isSelected: boolean;
  /** VG-004 — node's message has ≥ 1 EvidenceArtifact. */
  hasEvidenceArtifact: boolean;
  /** VG-004 — AccessibilityInfo.isReduceMotionEnabled state (parent). */
  prefersReducedMotion: boolean;
}) {
  const ring = node.isActive ? styles.nodeRingActive : node.isLatest ? styles.nodeRingLatest : null;

  // VG-004 — derive the additive visual treatment (glow / halo / receipt
  // mark / tone tint) from the node's existing navigation + tone fields
  // via the pure helper. Glow and halo are strength-independent.
  const visual: TimelineNodeVisualStyle = deriveTimelineNodeVisualStyle({
    isActive: node.isActive,
    isActivePath: node.isActivePath,
    isSelected,
    toneBand: node.toneBand,
    temperatureBand: node.temperatureBand,
    hasEvidenceArtifact,
    prefersReducedMotion,
  });

  // Glow: a 2px indigo stroke (geometry, survives reduce-motion) plus a
  // soft drop shadow that is dropped to radius 0 under reduce-motion.
  const glowStyle =
    visual.glowTier !== 'none'
      ? {
          borderWidth: visual.glowStrokeWidthPx,
          borderColor: GLOW.activePath.color,
          shadowColor: GLOW.activePath.color,
          shadowOpacity: visual.glowShadowRadiusPx > 0 ? 0.9 : 0,
          shadowRadius: visual.glowShadowRadiusPx,
          shadowOffset: { width: 0, height: 0 },
          elevation: visual.glowShadowRadiusPx > 0 ? 6 : 0,
        }
      : null;

  // IX-003 — build the node's screen-reader label via the shared helper
  // so it always includes strength (the standingBand, in plain language)
  // and branch (mainline / side / detached). The helper is the single
  // source of truth — `buildArgumentTimelineMap` Pass 4 calls the SAME
  // function, so the model's `node.accessibilityLabel` and this rendered
  // label can never drift. The "opening claim" root suffix is folded into
  // the helper (via `isRoot`); the VG-004 navigation fragment is still
  // appended (it carries "active move" / "selected for actions" /
  // "has an attached source" — navigation/selection, not strength).
  const accessibilityLabel = (() => {
    const base = buildNodeAccessibilityLabel({
      ordinal: node.ordinal,
      totalNodes,
      kindLabel: node.kindLabel,
      sideLabel: node.sideLabel,
      standingBand: node.standingBand,
      branchLabel: deriveBranchLabel({ lane: node.lane, isDetached: node.isDetached }),
      isActive: node.isActive,
      isLatest: node.isLatest,
      isRoot: node.isRoot,
      isDetached: node.isDetached,
      isJunction: node.isJunction,
      junctionChildCount: node.junctionChildCount,
      relativeOrAbsoluteTime: node.relativeLabel || node.createdAtLabel,
    });
    return visual.accessibilityFragment
      ? `${base}, ${visual.accessibilityFragment}`
      : base;
  })();

  return (
    <View
      style={[styles.nodeWrap, { left: node.x, top: node.y }]}
      testID={`timeline-node-${node.messageId}`}
    >
      {/* VG-004 — active-path glow. Behind the node; reduce-motion keeps
          the 2px stroke and drops only the soft shadow. */}
      {glowStyle ? (
        <View
          testID={`timeline-node-glow-${node.messageId}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.nodeGlow, glowStyle]}
        />
      ) : null}
      {/* VG-004 — selected-node halo. Outermost cream ring; static
          stroke, kept under reduce-motion. SC-004 dock target only. */}
      {visual.haloRingWidthPx > 0 ? (
        <View
          testID={`timeline-node-halo-${node.messageId}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.nodeHalo,
            { borderWidth: visual.haloRingWidthPx, borderColor: GLOW.selectedHalo.color },
          ]}
        />
      ) : null}
      {ring ? <View style={[styles.nodeRing, ring]} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={node.isActive ? 'Tap again to open the per-node popover' : 'Tap to activate this message'}
        accessibilityState={{ selected: node.isActive }}
        onPress={() => onNodeTap(node.messageId)}
        // IX-003 — on web, nodes are NOT in the Tab sequence (tabIndex
        // -1): the timeline group owns the single Tab stop and Arrow
        // keys do the roving selection. Nodes stay reachable by screen
        // reader and programmatically. Native ignores the prop.
        {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})}
        style={[
          styles.node,
          { backgroundColor: node.kindColor },
          node.isActive && styles.nodeActive,
          node.isDetached && styles.nodeDetached,
          node.isRoot && styles.nodeRoot,
        ]}
      >
        <Text style={styles.nodeOrdinal} numberOfLines={1}>{node.ordinal}</Text>
        {/* VG-004 — tone tint. Active-path nodes only; static low-alpha
            overlay describing activity, never correctness. */}
        {visual.toneTint ? (
          <View
            testID={`timeline-node-tone-tint-${node.messageId}`}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[
              styles.nodeToneTint,
              { backgroundColor: visual.toneTint.color, opacity: visual.toneTint.alpha },
            ]}
          />
        ) : null}
      </Pressable>
      {/* VG-004 — evidence receipt mark. Shape-agnostic corner badge
          shown when the node's message has an attached source. */}
      {visual.showsReceiptMark ? (
        <View
          testID={`timeline-node-receipt-${node.messageId}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.receiptMark}
        >
          <View style={styles.receiptMarkInner} />
        </View>
      ) : null}
      {node.isActive && onInfoTap ? (
        <Pressable
          onPress={() => onInfoTap(node.messageId)}
          accessibilityRole="button"
          accessibilityLabel="Open per-node popover"
          testID={`timeline-node-info-${node.messageId}`}
          style={styles.infoIcon}
        >
          <Text style={styles.infoIconText}>i</Text>
        </Pressable>
      ) : null}
      {node.isRoot ? (
        <View testID={`timeline-root-marker-${node.messageId}`} style={styles.rootMarkerPill}>
          <Text style={styles.rootMarkerPillText}>Root</Text>
        </View>
      ) : null}
      {node.isFirstRebuttal ? (
        <View testID={`timeline-first-clash-marker-${node.messageId}`} style={styles.firstClashPill}>
          <Text style={styles.firstClashPillText}>First clash</Text>
        </View>
      ) : null}
      {node.isJunction ? (
        <View testID={`timeline-junction-${node.messageId}`} style={styles.junctionPill}>
          <Text style={styles.junctionPillText}>{node.junctionChildCount} routes</Text>
        </View>
      ) : null}
      {node.isDetached ? (
        <View style={styles.detachedPill}>
          <Text style={styles.detachedPillText}>detached</Text>
        </View>
      ) : null}
      {node.droppedTags.length > 0 ? (
        <View style={styles.chipRow} accessibilityLabel="dropped-tags">
          {node.droppedTags.slice(0, 3).map((t) => (
            <View key={`${node.messageId}-tag-${t.code}`} style={[styles.chip, { backgroundColor: t.color }]}>
              <Text style={styles.chipText} numberOfLines={1}>{t.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ArgumentTimelineMap({
  map,
  onActivate,
  onPrev,
  onNext,
  onJumpLatest,
  onJumpToRoot,
  onToggleMode,
  activeViewModel,
  totalCount,
  onAction,
  onOpenDetails,
  controlsContext,
  artifactsByMessageId,
  evidenceContractFor,
  evidenceDebtSummaryFor,
  isReadModeViewer,
  selectedTarget,
  actionDockModel,
  onSelectTarget,
  onActionDockAction,
  onOpenCardsDetail,
  actingOnLabel,
  reduceMotionOverride,
  principalActorLabels,
  linkedPriorChips,
  onOpenLinkedPrior,
  onViewLinkedPriorContext,
}: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [popoverMessageId, setPopoverMessageId] = useState<string | null>(null);
  // UX-001.2 — Band-aware internal rail offset. Replaces the legacy
  // `top: 120` literal. The bands now overlay the rail's y-range with
  // `pointerEvents: 'none'`, freeing this offset.
  const { band } = useHeaderBreakpoint();
  const railTopOffset = BAND_RAIL_OFFSET[band];

  // VG-002 — virtualized rail. Track scrollX + measured viewport width so
  // `visibleSegmentSlice` can return only the segments whose x-range
  // intersects the visible window (plus a one-viewport-wide buffer on
  // each side). Bounds peak rail-layer `<View>` count by viewport rather
  // than by message count.
  const [scrollX, setScrollX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const lastScrollFrameMs = useRef<number>(0);
  const railStyleCacheRef = useRef<Map<string, RailSegmentStyle>>(new Map());

  // BR-001 — in-memory collapse state. Not persisted across sessions in
  // v1. Anything not in the map is treated as expanded. The room shell
  // calls `toggleBranchCollapse` on stub tap and re-renders.
  const [collapseState, setCollapseState] = useState<BranchCollapseState>(EMPTY_COLLAPSE_STATE);

  // VG-004 — reduce-motion gate for the node glow's soft shadow. Read
  // once on mount and subscribed for mid-session OS changes, mirroring
  // the existing try/catch pattern around `announceForAccessibility`.
  // First render defaults to `false`; the effect settles within a frame.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    try {
      const result = AccessibilityInfo.isReduceMotionEnabled();
      if (result && typeof result.then === 'function') {
        result
          .then((enabled) => {
            if (!cancelled) setPrefersReducedMotion(enabled === true);
          })
          .catch(() => {
            // Some platforms (web shim, jest) reject — keep the default.
          });
      }
    } catch {
      // API unavailable — keep `prefersReducedMotion = false`.
    }
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (enabled) => {
          if (!cancelled) setPrefersReducedMotion(enabled === true);
        },
      );
    } catch {
      // Listener API unavailable — the one-shot read above still works.
    }
    return () => {
      cancelled = true;
      try {
        subscription?.remove();
      } catch {
        // Swallow — listener may already be torn down.
      }
    };
  }, []);

  // PR-001 — when the room shell threads the preferences popout's
  // effective reduce-motion value, it WINS over the component's own OS
  // read. Omitting the prop keeps the independent OS read (back-compat).
  const effectiveReducedMotion =
    typeof reduceMotionOverride === 'boolean'
      ? reduceMotionOverride
      : prefersReducedMotion;

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Throttle to ~60fps so we don't thrash setState on every native event.
    const now = Date.now();
    if (now - lastScrollFrameMs.current < SCROLL_FRAME_MS) return;
    lastScrollFrameMs.current = now;
    const x = e?.nativeEvent?.contentOffset?.x;
    if (typeof x === 'number' && Number.isFinite(x)) setScrollX(x);
  }, []);

  const handleScrollLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e?.nativeEvent?.layout?.width;
    if (typeof w === 'number' && Number.isFinite(w)) setViewportWidth(w);
  }, []);

  // Shared node-by-id lookup. Used by both VG-002's segment builder
  // and BR-001's collapse/stub feeder.
  const nodesById = useMemo(() => {
    const m = new Map<string, ArgumentTimelineMapNode>();
    for (const n of map.nodes) m.set(n.messageId, n);
    return m;
  }, [map.nodes]);

  // BR-001 — evidence-thread detection. One pass over the tree per
  // render. The map is consumed by `buildRailSegmentInput` so
  // evidence-thread additional siblings stay on `main`.
  const evidenceThreadByBranchRoot = useMemo(
    () => buildEvidenceThreadMap(map.nodes),
    [map.nodes],
  );

  // VG-002 + BR-001 — build the rail segment inputs once per render
  // from `map.edges` + the node lookup + EV-002's `artifactsByMessageId`
  // + the BR-001 evidence-thread map.
  const segmentInputs: ReadonlyArray<RailSegmentInput> = useMemo(() => {
    const out: RailSegmentInput[] = [];
    for (const edge of map.edges) {
      const fromNode = nodesById.get(edge.fromMessageId);
      const toNode = nodesById.get(edge.toMessageId);
      if (!fromNode || !toNode) continue;
      out.push(
        buildRailSegmentInput({
          edge,
          fromNode,
          toNode,
          artifactsByMessageId: artifactsByMessageId ?? {},
          evidenceThreadByBranchRoot,
        }),
      );
    }
    return out;
  }, [map.edges, nodesById, artifactsByMessageId, evidenceThreadByBranchRoot]);

  // BR-001 — auto-expand: when the active node lives inside a
  // collapsed subtree, silently uncollapse ancestor branch roots so
  // the active path is always visible. `applyActiveAutoExpand` returns
  // the same reference when no change is needed, so the effect below
  // only fires when something actually changed.
  const activeMessageId = map.activeNode?.messageId ?? null;
  useEffect(() => {
    const next = applyActiveAutoExpand(collapseState, activeMessageId, nodesById);
    if (next !== collapseState) {
      setCollapseState(next);
      try {
        AccessibilityInfo.announceForAccessibility(
          'Branch expanded to show the active move.',
        );
      } catch {
        // Some platforms (web shim, jest) lack this API — swallow.
      }
    }
  }, [activeMessageId, collapseState, nodesById]);

  // BR-001 — pre-collapsed rail inputs. Filters segments inside
  // collapsed branches and emits one `RailStubViewModel` per branch.
  const collapseResult = useMemo(
    () =>
      buildCollapsedRailInputs({
        segments: segmentInputs,
        nodeById: nodesById,
        collapseState,
        activeMessageId,
      }),
    [segmentInputs, nodesById, collapseState, activeMessageId],
  );

  // BR-004 — branch grammar map. One `BranchGrammarNode` per branch:
  // the teachable direction + the four collapsed-summary fields. Built
  // from the timeline map + BR-001's topology + evidence-thread maps.
  // The grammar is structural (it never reads heat / activity), so the
  // memo only needs to recompute when the tree topology changes. No AI,
  // no network — deterministic pure TS.
  const branchKindByEdgeId = useMemo(
    () =>
      buildBranchKindMap({
        nodes: map.nodes,
        edges: map.edges,
        evidenceThreadByBranchRoot,
      }),
    [map.nodes, map.edges, evidenceThreadByBranchRoot],
  );
  const branchGrammarMap = useMemo(
    () =>
      buildBranchGrammarMap({
        timelineMap: map,
        branchKindByEdgeId,
        evidenceThreadByBranchRoot,
        principalActorLabels: principalActorLabels ?? [],
      }),
    [map, branchKindByEdgeId, evidenceThreadByBranchRoot, principalActorLabels],
  );

  // BR-004 — the four-field collapsed-branch summary for each collapse
  // stub, keyed by the branch root message id. When a branch's grammar
  // node is not found (defensive) the stub falls back to its existing
  // `+N` label — `BranchCollapseStub` treats the summary as optional.
  const collapsedSummaryByRoot = useMemo(() => {
    const out = new Map<string, CollapsedBranchSummary>();
    for (const stub of collapseResult.stubs) {
      // The stub's branch root message id IS a node's `branchRootMessageId`;
      // find the grammar node by matching `originNodeId`.
      let grammarNode: ReturnType<typeof branchGrammarMap.get> | undefined;
      for (const node of branchGrammarMap.values()) {
        if (node.originNodeId === stub.branchRootMessageId) {
          grammarNode = node;
          break;
        }
      }
      if (!grammarNode) continue;
      out.set(
        stub.branchRootMessageId,
        buildCollapsedBranchSummary({
          grammarNode,
          hiddenMessageCount: stub.hiddenMessageCount,
        }),
      );
    }
    return out;
  }, [collapseResult.stubs, branchGrammarMap]);

  const handleStubPress = useCallback((branchRootMessageId: string) => {
    setCollapseState((prev) => toggleBranchCollapse(prev, branchRootMessageId));
    // IX-004 — tapping a collapsed branch stub also selects the branch
    // root so the readout panel shows that branch root's detail (the
    // BR-001 contract: "branch stub click selects the branch root and
    // expands if collapsed"). The collapse toggle above handles the
    // expand; this routes selection through the same callback a node
    // tap uses, so the readout follows automatically. BR-004 reuses
    // this same `activeMessageId` channel for branch selection — the
    // `resolveBranchSelectionHandoff` shape ({ branchRootMessageId,
    // status: 'explicit' }) is exactly what IX-004 already consumes.
    onActivate(branchRootMessageId);
  }, [onActivate]);

  const visibleSlice = useMemo(() => {
    // Effective viewport width: when the layout has not measured yet,
    // fall back to a wide window so the first paint still includes the
    // active region. The buffer keeps off-screen scroll deltas cheap.
    const effectiveViewport = viewportWidth > 0 ? viewportWidth : map.scrollWidth;
    return visibleSegmentSlice(
      collapseResult.visibleSegments,
      scrollX,
      effectiveViewport,
      VISIBLE_SLICE_DEFAULT_BUFFER_PX,
    );
  }, [collapseResult.visibleSegments, scrollX, viewportWidth, map.scrollWidth]);

  // VG-002 — Whole-rail accessibilityLabel. Plain English, no
  // snake_case, no verdict / amplification tokens. The label is the
  // primary screen-reader entry point for the rail.
  const wholeRailLabel = useMemo(() => {
    let withSource = 0;
    let needsSource = 0;
    let activeBranches = 0;
    for (const s of segmentInputs) {
      if (s.branchKind === 'detached') continue;
      if (s.isActivePath) activeBranches += 1;
      switch (s.sourceChainStatus) {
        case 'source_and_quote':
        case 'primary_present':
          withSource += 1;
          break;
        case 'no_source':
          needsSource += 1;
          break;
        default:
          break;
      }
    }
    return buildWholeRailAccessibilityLabel({
      nodeCount: map.nodes.length,
      activeBranchCount: activeBranches,
      segmentsWithSourceAttached: withSource,
      segmentsNeedingSource: needsSource,
    });
  }, [segmentInputs, map.nodes.length]);

  // Auto-scroll toward the active node.
  useEffect(() => {
    if (!scrollRef.current || !map.activeNode) return;
    const x = Math.max(0, map.activeNode.x - 120);
    try {
      scrollRef.current.scrollTo({ x, animated: true });
    } catch { /* swallow — not all platforms support imperative scroll */ }
  }, [map.activeNode]);

  // IX-002 — mini-map overview view-model. A deterministic projection of
  // the already-built `map` + the existing `collapseState`. It NEVER
  // re-derives heat or branch logic; it re-labels `temperatureBand` and
  // reads `branchId` / `branchRootMessageId` verbatim. The mini-map is
  // collapsed-by-default and renders nothing below the length threshold.
  const miniMapModel = useMemo(
    () => buildTimelineMiniMapModel({ timelineMap: map, collapseState }),
    [map, collapseState],
  );

  // IX-002 — the viewport window indicator: which slice of the
  // conversation the MAIN map currently shows. Built from the already-
  // tracked `scrollX` + `viewportWidth` + `map.scrollWidth`.
  const miniMapViewportWindow = useMemo(
    () =>
      buildViewportWindow({
        scrollX,
        viewportWidth,
        scrollWidth: map.scrollWidth,
      }),
    [scrollX, viewportWidth, map.scrollWidth],
  );

  // IX-002 — route every mini-map jump through the SAME two mechanisms a
  // node tap already uses: `onActivate` for selection + the imperative
  // `scrollRef.scrollTo`. No route push, no navigation. A branch jump
  // into a collapsed branch expands it first (mirrors `handleStubPress`).
  const handleMiniMapJump = useCallback(
    (req: MiniMapJumpRequest) => {
      if (req.kind === 'branch') {
        const node = nodesById.get(req.messageId);
        const branchRoot = node?.branchRootMessageId ?? req.messageId;
        setCollapseState((prev) =>
          prev[branchRoot] === 'collapsed'
            ? toggleBranchCollapse(prev, branchRoot)
            : prev,
        );
      }
      onActivate(req.messageId);
      const node = nodesById.get(req.messageId);
      if (node && scrollRef.current) {
        try {
          scrollRef.current.scrollTo({
            x: Math.max(0, node.x - 120),
            animated: !effectiveReducedMotion,
          });
        } catch {
          /* swallow — same pattern as the auto-scroll effect above */
        }
      }
    },
    [onActivate, nodesById, effectiveReducedMotion],
  );

  // IX-002 — live viewport scrub: dragging the mini-map window pans the
  // MAIN map without changing the active node (scrub pans, it does not
  // select). Converts a normalized centre fraction into a scroll offset.
  const handleMiniMapScrub = useCallback(
    (centreFraction: number) => {
      if (!scrollRef.current) return;
      const target =
        centreFraction * map.scrollWidth - Math.max(0, viewportWidth) / 2;
      try {
        scrollRef.current.scrollTo({
          x: Math.max(0, target),
          animated: false,
        });
      } catch {
        /* swallow — imperative scroll unsupported on some platforms */
      }
    },
    [map.scrollWidth, viewportWidth],
  );

  const handleJumpLatest = useCallback(() => onJumpLatest(), [onJumpLatest]);

  // SC-002 — per-node tap handler delegates to the pure model so the
  // tap→activate / second-tap→popover / info-icon→popover rules stay
  // testable.
  //
  // SC-004 — When `onSelectTarget` is provided (room shell wires the
  // action dock), tapping a node activates AND sets the dock target;
  // the popover STAYS CLOSED on node tap. The info icon is the only way
  // to open the popover. Tapping the same node again toggles the dock
  // off. The dock and popover are mutually exclusive.
  const handleNodeTap = useCallback((messageId: string) => {
    // SC-004 path: if the dock is wired, route through dock-selection.
    if (onSelectTarget) {
      const currentSelectedMessageId =
        selectedTarget && selectedTarget.kind === 'node' ? selectedTarget.messageId : null;
      // Tap same selected node → dismiss the dock.
      if (currentSelectedMessageId === messageId) {
        onSelectTarget(null);
        // Keep the node active; just close the dock.
        return;
      }
      // Open / switch the dock to this node. Always close the popover.
      setPopoverMessageId(null);
      if (map.activeNode?.messageId !== messageId) onActivate(messageId);
      onSelectTarget({ kind: 'node', messageId });
      return;
    }
    // Legacy SC-002 path (no dock wiring): activate → popover → close.
    const effect = decideNodeTapEffect({
      tappedMessageId: messageId,
      activeMessageId: map.activeNode?.messageId ?? null,
      popoverMessageId,
    });
    switch (effect.type) {
      case 'activate':
        setPopoverMessageId(null);
        onActivate(effect.messageId);
        return;
      case 'open_popover':
        setPopoverMessageId(effect.messageId);
        return;
      case 'close_popover':
        setPopoverMessageId(null);
        return;
    }
  }, [map.activeNode?.messageId, onActivate, popoverMessageId, onSelectTarget, selectedTarget]);

  const handleInfoTap = useCallback((messageId: string) => {
    const effect = decideInfoIconEffect(messageId);
    if (effect.type === 'open_popover') {
      // SC-004 — opening the popover dismisses the dock (mutual exclusion).
      onSelectTarget?.(null);
      setPopoverMessageId(effect.messageId);
    }
  }, [onSelectTarget]);

  // IX-003 — web-only keyboard navigation. The handler is wired onto the
  // outer root <View> (which carries a single tabIndex=0 Tab stop). It
  // delegates the traversal decision to the pure `resolveTimelineNavEffect`
  // model and routes the result through the SAME callbacks tap already
  // uses — `onActivate` for selection, `handleInfoTap` to open detail —
  // so keyboard and touch never diverge. Arrow / Home / End / Enter /
  // Space are prevent-defaulted (so the page does not scroll / page-down);
  // Escape only prevent-defaults when an overlay is actually open.
  const handleKeyDown = useCallback(
    (e: { key: string; preventDefault?: () => void }) => {
      if (Platform.OS !== 'web') return;
      if (!e || !isTimelineNavKey(e.key)) return;
      const effect = resolveTimelineNavEffect({
        key: e.key,
        activeMessageId: map.activeNode?.messageId ?? null,
        map,
        hasOpenOverlay: popoverMessageId !== null || selectedTarget != null,
      });
      if (effect.type === 'none') return;
      // A real effect — stop the browser default (arrows scrolling the
      // page, Space paging down, Escape bubbling to a parent modal).
      e.preventDefault?.();
      if (effect.type === 'activate') {
        onActivate(effect.messageId);
      } else if (effect.type === 'open_detail') {
        handleInfoTap(effect.messageId);
      } else if (effect.type === 'close_overlay') {
        setPopoverMessageId(null);
        onSelectTarget?.(null);
      }
    },
    [map, onActivate, popoverMessageId, selectedTarget, onSelectTarget, handleInfoTap],
  );

  // IX-003 — Prev/Next are at an end when the active node is the first /
  // last chronological node. Drives the disabled a11y state + dimmed
  // style on the two control chips. With no active node, neither end is
  // reached (a keyboard / tap user can still move in either direction).
  const isAtFirst = Boolean(
    map.activeNode &&
      map.nodes.length > 0 &&
      map.activeNode.messageId === map.nodes[0].messageId,
  );
  const isAtLatest = Boolean(
    map.activeNode &&
      map.latestMessageId !== null &&
      map.activeNode.messageId === map.latestMessageId,
  );

  const popoverModel = (() => {
    if (!popoverMessageId || !map.activeNode || !activeViewModel) return null;
    if (popoverMessageId !== map.activeNode.messageId) return null;
    const contract = evidenceContractFor ? evidenceContractFor(map.activeNode.messageId) ?? undefined : undefined;
    // EV-003 — per-node evidence-debt roll-up; undefined when the room shell
    // does not supply the builder (the popover then renders no debt chip).
    const debtSummary = evidenceDebtSummaryFor
      ? evidenceDebtSummaryFor(map.activeNode.messageId) ?? undefined
      : undefined;
    return buildTimelineNodePopoverModel({
      node: map.activeNode,
      actor: activeViewModel.actor,
      totalCount: totalCount ?? map.nodes.length,
      controlsContext,
      evidenceContract: contract,
      evidenceDebtSummary: debtSummary,
    });
  })();

  const popoverArtifacts = (() => {
    if (!popoverModel || !artifactsByMessageId) return undefined;
    return artifactsByMessageId[popoverModel.messageId];
  })();

  if (map.nodes.length === 0) {
    return (
      <View style={styles.root} testID="argument-timeline-map">
        {/* QOL-042 — a brand-new room can already carry prior-argument
            context before any move is posted; the chip row renders above
            the empty-timeline notice. */}
        <LinkedPriorArgumentChipRow
          chips={linkedPriorChips ?? []}
          onOpenPrior={onOpenLinkedPrior}
          onViewContext={onViewLinkedPriorContext}
        />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Timeline appears once any argument is posted.</Text>
        </View>
      </View>
    );
  }

  const showBackToRoot = Boolean(onJumpToRoot && map.showBackToRootControl);

  return (
    <View
      style={styles.root}
      testID="argument-timeline-map"
      // IX-003 — web-only keyboard capture. The timeline frame is a
      // single focusable group (tabIndex 0): one Tab stop for the whole
      // node set, with Arrow keys doing roving selection within it. RN-web
      // forwards `onKeyDown` + `tabIndex` to the underlying DOM node; on
      // native these props are simply not passed. No new dependency.
      {...(Platform.OS === 'web' ? { onKeyDown: handleKeyDown, tabIndex: 0 } : {})}
    >
      {/* UX-001.2 — Timeline controls moved from an above-rail row into an
          absolute overlay anchored top-right inside the timeline frame.
          The overlay sits above the rail with `zIndex: 10` and a slightly
          translucent background so the rail behind reads through; the
          overlay does NOT displace vertical space, freeing the offset
          budget for the brief's hard cap. testIDs and accessibility
          labels are preserved verbatim — Prev / Next / Latest / Back-to-
          root / Cards-toggle still resolve through the same callbacks.
          The IX-003 keyboard handler remains attached to the root frame
          below; the overlay is one tab-stop cluster after the rail. */}
      <View style={styles.overlayControls} testID="timeline-controls-overlay">
        <Pressable
          style={[styles.controlChip, isAtFirst && styles.controlChipDisabled]}
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel="Previous message"
          accessibilityState={{ disabled: isAtFirst }}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          testID="timeline-prev"
        >
          <Text style={styles.controlChipText}>‹</Text>
        </Pressable>
        <Pressable
          style={[styles.controlChip, isAtLatest && styles.controlChipDisabled]}
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="Next message"
          accessibilityState={{ disabled: isAtLatest }}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          testID="timeline-next"
        >
          <Text style={styles.controlChipText}>›</Text>
        </Pressable>
        <Pressable
          style={[styles.controlChip, styles.controlChipPrimary]}
          onPress={handleJumpLatest}
          accessibilityRole="button"
          accessibilityLabel="Jump to latest message"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          testID="timeline-jump-latest"
        >
          <Text style={styles.controlChipText}>⏭</Text>
        </Pressable>
        {showBackToRoot ? (
          <Pressable
            style={styles.controlChip}
            onPress={onJumpToRoot}
            accessibilityRole="button"
            accessibilityLabel="Back to opening claim"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            testID="timeline-jump-root"
          >
            <Text style={styles.controlChipText}>↑</Text>
          </Pressable>
        ) : null}
        {onToggleMode ? (
          <Pressable
            style={styles.controlChip}
            onPress={onToggleMode}
            accessibilityRole="button"
            accessibilityLabel="Switch to cards mode"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            testID="timeline-toggle-mode"
          >
            <Text style={styles.controlChipText}>↺</Text>
          </Pressable>
        ) : null}
      </View>

      {/* QOL-042 — linked prior argument context-chip row. Sits in the
          timeline header, above the rail. Renders nothing when the room
          carries no prior-argument links. */}
      <LinkedPriorArgumentChipRow
        chips={linkedPriorChips ?? []}
        onOpenPrior={onOpenLinkedPrior}
        onViewContext={onViewLinkedPriorContext}
      />

      {/* IX-002 — mini-map overview. Internal additive chrome directly
          under the controls row. Renders nothing for short debates
          (below the length threshold) so it never crowds mobile UI. */}
      <TimelineMiniMap
        model={miniMapModel}
        viewportWindow={miniMapViewportWindow}
        onJump={handleMiniMapJump}
        onScrubViewport={handleMiniMapScrub}
        reduceMotion={effectiveReducedMotion}
      />

      {map.rootOnboardingHint ? (
        <View style={styles.onboardingBanner} testID="timeline-root-onboarding">
          <Text style={styles.onboardingBannerText}>{map.rootOnboardingHint}</Text>
        </View>
      ) : null}

      {popoverModel ? (
        <View style={styles.popoverDock}>
          <TimelineNodePopover
            model={popoverModel}
            onAction={onAction}
            onOpenDetails={onOpenDetails ? (id) => { setPopoverMessageId(null); onOpenDetails(id); } : undefined}
            onClose={() => setPopoverMessageId(null)}
            artifacts={popoverArtifacts}
            isReadModeViewer={isReadModeViewer === true}
          />
        </View>
      ) : null}

      {/* SC-004 — Action dock. Mutually exclusive with the SC-002 popover
          above. Both surfaces are anchored at the top of the timeline
          frame; the room shell guarantees they never co-exist by
          dismissing one when the other opens. */}
      {selectedTarget && actionDockModel && !popoverModel ? (
        <View style={styles.actionDock}>
          {/* IX-004 — the dock's target, named. Purely additive chrome;
              the dock model itself is untouched. Shown only for a node
              target with a non-empty label. */}
          {selectedTarget.kind === 'node' && actingOnLabel ? (
            <Text style={styles.actingOnLine} testID="timeline-acting-on">
              Acting on: {actingOnLabel}
            </Text>
          ) : null}
          <TimelineNodeActionDock
            model={actionDockModel}
            onAction={onActionDockAction}
            onOpenCardsDetail={onOpenCardsDetail}
            onExpandBranch={(branchRootMessageId) => {
              setCollapseState((prev) => toggleBranchCollapse(prev, branchRootMessageId));
              onSelectTarget?.(null);
            }}
            onDismiss={() => onSelectTarget?.(null)}
            isReadModeViewer={isReadModeViewer === true}
          />
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator
        style={styles.scroll}
        contentContainerStyle={{ width: map.scrollWidth, minHeight: map.height }}
        accessibilityLabel={wholeRailLabel}
        testID="argument-timeline-map-scroll"
        onScroll={handleScroll}
        onLayout={handleScrollLayout}
        scrollEventThrottle={SCROLL_FRAME_MS}
      >
        <View style={{ width: map.scrollWidth, height: map.height }}>
          {/* Center rail. UX-001.2 — `top` is band-aware via
              `BAND_RAIL_OFFSET` (replaces the legacy `120` literal). The
              bands above the rail used to claim ~120 px of vertical space;
              they now overlay the rail's y-range with `pointerEvents: 'none'`
              so the offset reduces to a token close to zero per band. */}
          <View style={[styles.rail, { width: map.scrollWidth - 32, top: railTopOffset + TIMELINE_NODE_SIZE / 2 - 1 }]} />

          {/* Bands. UX-001.2 — the bands sit overlaid on the rail's y-level
              with `pointerEvents: 'none'` + reduced opacity so they read as
              background context rather than foreground chrome. Their `top`
              is centered around the rail centerline (rail centerline minus
              ~14 px so the label sits at the same vertical band as the
              node ordinals). */}
          {map.bands.map((bandSpan) => (
            <View
              key={bandSpan.bandId}
              testID={`timeline-band-${bandSpan.bandId}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: bandSpan.xStart,
                top: Math.max(0, railTopOffset + TIMELINE_NODE_SIZE / 2 - 14),
                width: Math.max(60, bandSpan.xEnd - bandSpan.xStart + TIMELINE_NODE_SIZE),
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: '#1e293b',
                borderWidth: 1,
                borderColor: '#334155',
                opacity: 0.6,
              }}
            >
              <Text style={styles.bandLabel} numberOfLines={1}>
                {bandSpan.label} · {bandSpan.messageCount}
              </Text>
            </View>
          ))}

          {/* VG-002 — Gradient wave rail (virtualized slice). */}
          <GradientWaveRail segments={visibleSlice} styleCache={railStyleCacheRef.current} />

          {/* BR-001 — Collapse stubs anchored to each collapsed branch
              root. Rendered as a separate Pressable layer so the rail's
              `pointerEvents: 'none'` invariant is preserved. */}
          {collapseResult.stubs.map((stub) => (
            <BranchCollapseStub
              key={stub.stubId}
              stub={stub}
              onPress={handleStubPress}
              testIDSuffix={stub.branchRootMessageId}
              summary={collapsedSummaryByRoot.get(stub.branchRootMessageId) ?? null}
            />
          ))}

          {/* Nodes */}
          {map.nodes.map((n) => (
            <NodeDot
              key={n.messageId}
              node={n}
              totalNodes={map.nodes.length}
              onNodeTap={handleNodeTap}
              onInfoTap={handleInfoTap}
              isSelected={
                selectedTarget?.kind === 'node' &&
                selectedTarget.messageId === n.messageId
              }
              hasEvidenceArtifact={
                (artifactsByMessageId?.[n.messageId]?.length ?? 0) > 0
              }
              prefersReducedMotion={effectiveReducedMotion}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.legendRow}>
        <Text style={styles.timestampLabel} numberOfLines={1}>{map.beginningLabel}</Text>
        <Text style={styles.timestampLabel} numberOfLines={1}>{map.middleLabel}</Text>
        <Text style={styles.timestampLabel} numberOfLines={1}>{map.endLabel}</Text>
      </View>

      <View style={styles.legendChips}>
        {map.legend.map((entry) => (
          <View key={`legend-${entry.family}`} style={styles.legendChip} accessibilityLabel={`legend-${entry.family}`}>
            <View style={[styles.legendDot, { backgroundColor: entry.color }]} />
            <Text style={styles.legendText}>{entry.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#020617' },
  scroll: { backgroundColor: '#020617', minHeight: 240 },
  empty: { padding: 24, alignItems: 'center', backgroundColor: '#020617' },
  emptyText: { color: '#64748b' },
  rail: {
    position: 'absolute',
    left: 16,
    height: RAIL_THICKNESS,
    backgroundColor: '#1f2937',
    borderRadius: RAIL_THICKNESS,
  },
  nodeWrap: { position: 'absolute', alignItems: 'center' },
  nodeRing: { position: 'absolute', width: TIMELINE_NODE_SIZE + 14, height: TIMELINE_NODE_SIZE + 14, top: -7, left: -7, borderRadius: (TIMELINE_NODE_SIZE + 14) / 2 },
  nodeRingActive: { backgroundColor: 'rgba(99,102,241,0.25)', borderWidth: 2, borderColor: '#a5b4fc' },
  nodeRingLatest: { borderWidth: 2, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.12)' },
  // VG-004 — active-path glow. Sits behind the node + rings. The 2px
  // border is set inline (it survives reduce-motion); the soft shadow
  // is also inline so reduce-motion can zero just the radius.
  nodeGlow: {
    position: 'absolute',
    width: TIMELINE_NODE_SIZE + 22,
    height: TIMELINE_NODE_SIZE + 22,
    top: -11,
    left: -11,
    borderRadius: (TIMELINE_NODE_SIZE + 22) / 2,
  },
  // VG-004 — selected-node halo. Outermost cream ring; static stroke,
  // kept on under reduce-motion. Border width / color set inline.
  nodeHalo: {
    position: 'absolute',
    width: TIMELINE_NODE_SIZE + 30,
    height: TIMELINE_NODE_SIZE + 30,
    top: -15,
    left: -15,
    borderRadius: (TIMELINE_NODE_SIZE + 30) / 2,
  },
  // VG-004 — tone tint overlay on active-path nodes only. The color +
  // alpha are set inline from the pure helper's `toneTint`.
  nodeToneTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TIMELINE_NODE_SIZE / 2,
  },
  // VG-004 — evidence receipt mark. A small corner badge composed from
  // two <View>s — no react-native-svg, no icon dependency.
  receiptMark: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: RECEIPT_MARK.sizePx,
    height: RECEIPT_MARK.sizePx,
    borderRadius: RECEIPT_MARK.sizePx / 2,
    backgroundColor: RECEIPT_MARK.color,
    borderWidth: 1,
    borderColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptMarkInner: {
    width: RECEIPT_MARK.sizePx / 3,
    height: RECEIPT_MARK.sizePx / 3,
    borderRadius: RECEIPT_MARK.sizePx / 6,
    backgroundColor: RECEIPT_MARK.innerColor,
  },
  node: {
    width: TIMELINE_NODE_SIZE,
    height: TIMELINE_NODE_SIZE,
    borderRadius: TIMELINE_NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  nodeActive: { borderColor: '#f8fafc', borderWidth: 2 },
  nodeDetached: { backgroundColor: '#475569', borderStyle: 'dashed' as const },
  nodeRoot: { borderColor: '#fde68a', borderWidth: 3 },
  nodeOrdinal: { color: '#0b1220', fontWeight: '800', fontSize: 13 },
  junctionPill: { marginTop: 4, backgroundColor: '#a855f7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  junctionPillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  rootMarkerPill: { marginTop: 4, backgroundColor: '#fde68a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  rootMarkerPillText: { color: '#78350f', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  firstClashPill: { marginTop: 4, backgroundColor: '#f97316', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  firstClashPillText: { color: '#fff7ed', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  onboardingBanner: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#334155' },
  onboardingBannerText: { color: '#fde68a', fontSize: 12, fontWeight: '600' },
  infoIcon: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: { color: '#e2e8f0', fontWeight: '800', fontSize: 11 },
  popoverDock: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  // SC-004 — Action dock surface lives just below the popover dock; the
  // two are mutually exclusive so at most one is visible at a time.
  actionDock: {
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  // IX-004 — "Acting on: <kind · #ordinal>" line above the action dock.
  actingOnLine: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  detachedPill: { marginTop: 4, backgroundColor: '#475569', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  detachedPillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: 2, marginTop: 4, maxWidth: TIMELINE_NODE_SIZE + 36 },
  chip: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6 },
  chipText: { color: '#0b1220', fontWeight: '700', fontSize: 8 },
  // UX-001.2 — Timeline controls overlay. The previous `controlsRow` was a
  // top-of-frame row that consumed ~45 px of vertical chrome. The overlay
  // is anchored top-right inside the timeline frame, semi-transparent so
  // the rail behind reads through, and sits above the rail via zIndex
  // without displacing the rail's y-position.
  overlayControls: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
    backgroundColor: 'rgba(2,6,23,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  controlChip: { backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, minHeight: 28 },
  // IX-003 — dimmed Prev/Next chip when the active node is at an end.
  // Paired with `accessibilityState={{ disabled }}` so the disabled
  // state is conveyed both visually and to screen readers. The chip
  // still no-ops on press (the underlying handler already does), so no
  // behaviour change — only the visual + a11y signal is added.
  controlChipDisabled: { opacity: 0.4 },
  controlChipPrimary: { backgroundColor: '#312e81' },
  controlChipText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 },
  timestampLabel: { color: '#64748b', fontSize: 10 },
  bandLabel: { color: '#cbd5e1', fontSize: 10, fontWeight: '700' },
  legendChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8 },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0b1220', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#94a3b8', fontSize: 10 },
});

// keep TIMELINE_KIND_COLORS imported so accidental tree-shaking doesn't break tests.
void TIMELINE_KIND_COLORS;
