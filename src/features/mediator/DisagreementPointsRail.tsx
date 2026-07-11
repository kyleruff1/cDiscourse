/**
 * UX-MEDIATOR-005 — Disagreement Points rail.
 *
 * The first VISIBLE mediator spine: a collapsed-by-default chip
 * ("Disagreement points · N") that expands into a compact, READ-ONLY panel —
 * side-anchored on wide viewports, a capped bottom sheet on narrow ones. It
 * lists the room's live disagreement points (everything not yet resolved) with
 * one structural state badge each, a one-line "what would help next?", an
 * evidence-request count, and a "View in timeline" jump.
 *
 * It reuses the SC-005 dock chassis (`resolveObserverDockVariant` /
 * `resolveSheetMaxHeightPx`) and mirrors `OpenIssuesRail`'s reduce-motion +
 * mutual-exclusion + grayscale-legible-active patterns. It is PURE
 * presentation over a fully-derived `MediatorBoardState` (UX-MEDIATOR-001) —
 * it authors NO derivation, calls NO network/AI, performs NO mutation, and is
 * never a submission gate. The only verb is `onJump` (a read-only navigation),
 * so observers and participants see the identical read-only rail.
 *
 * Doctrine: every label is a plain-language atom already mapped in
 * `MediatorBoardState` (or `DISAGREEMENT_POINTS_RAIL_COPY` chrome); the
 * renderer additionally suppresses anything that would trip
 * `looksLikeInternalCode`. The active point is distinguished by GEOMETRY (a
 * left accent bar + bold + a "Currently active" word), never by color alone.
 * 44×44 targets on every interactive element. RN primitives only.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  BORDER_WIDTH,
  RADIUS,
  SPACING,
  SURFACE_TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../../lib/designTokens';
import { looksLikeInternalCode } from '../arguments/gameCopy';
import {
  resolveObserverDockVariant,
  resolveSheetMaxHeightPx,
} from '../arguments/ObserverActionDockLayout';
import { useReduceMotion } from '../preferences/useReduceMotion';
import type {
  DisagreementPoint,
  MediatorBoardState,
  PointAnchor,
  V4MediatorStateCode,
} from './mediatorBoardTypes';
import { v4DisplayStateFor } from './deriveMediatorBoardState';
import { plainLanguageForMediatorState } from './mediatorPlainLanguage';
import {
  DISAGREEMENT_POINTS_RAIL_COPY,
  DISAGREEMENT_POINTS_RAIL_INITIAL_ROWS,
  evidenceRequestCountLabel,
} from './mediatorRailCopy';
import {
  buildDisagreementDistribution,
  type DisagreementDistributionSegment,
} from './mediatorDistribution';
import type { DerivedSignalLine } from '../feedbackFlags/derivedSignalConsumerModel';
import { getEvidenceDebtForPoint, type PointEvidenceDisplay } from './evidenceDebtDisplay';
import {
  getDefinitionScopeBridgeForPoint,
  type PointBridgeDisplay,
} from './definitionScopeBridgeDisplay';

const SHEET_SLIDE_TRAVEL = 48;

/**
 * UX-MEDIATOR-005 (O-1) — the rail badge label for a point, projected onto the
 * v4 nine-state DISPLAY vocabulary so the rail matches the UX-MEDIATOR-002 node
 * chip. `point.state` is unchanged for Inspect / traceability; only the rail
 * DISPLAY projects. A point whose display projection is terminal
 * (`resolved_or_settled`) is never live in the rail, so it shows no badge.
 */
function v4RowBadgeLabel(point: DisagreementPoint): string {
  const displayState = v4DisplayStateFor(point.state);
  if (displayState === 'resolved_or_settled') return '';
  return plainLanguageForMediatorState(displayState);
}

/**
 * UX-MEDIATOR-005 (O-4a / Finding B) — the chime-in contribution marker.
 *
 * The shipped board carries no chime-in data on the anchor itself. CHIMEIN-P8
 * Round 2 (#761) FEEDS this render slot from the loaded chime_in_contributions
 * rows via the `contributionKindByNodeId` adapter map (keyed by the anchor node =
 * the chime CONTENT argument id), supplied by ArgumentRoom ONLY when the chime_in
 * flag is on. With no map (flag off / no data) every row returns false → no marker
 * renders, byte-identical to before. We NEVER synthesize the marker from absent
 * data (doctrine §4 — observation-driven). The `anchor.contributionKind` field is
 * also honored for a future producer that fills the anchor directly.
 */
interface PointAnchorWithContribution extends PointAnchor {
  /** OPTIONAL — an anchor a future producer marks directly; the adapter map is the Round-2 path. */
  contributionKind?: 'principal' | 'chime_in';
}

function isChimeInAnchor(
  anchor: PointAnchor,
  contributionKindByNodeId?: Readonly<Record<string, 'chime_in'>>,
): boolean {
  if ((anchor as PointAnchorWithContribution).contributionKind === 'chime_in') return true;
  return contributionKindByNodeId?.[anchor.nodeId] === 'chime_in';
}

export interface DisagreementPointsRailProps {
  /** The derived board. `null` => "not available for this view yet" state. */
  board: MediatorBoardState | null;
  /** Observer vs participant — the rail is read-only for both in v1. */
  viewerRole?: 'observer' | 'participant';
  /** The active timeline node — drives the per-point "Currently active" mark. */
  activeNodeId?: string | null;
  windowWidth?: number;
  windowHeight?: number;
  reduceMotionOverride?: boolean;
  /** Default true (observer-first, collapsed). */
  defaultCollapsed?: boolean;
  /**
   * UX-BOARD-RAIL-002 — chassis intent.
   * 'sheet' (default) = today's collapsed-pill → bottom-sheet behavior
   *   (byte-identical phone). Honors `isAnyPanelOpen` (member of the bottom
   *   shared-space group), animates the sheet slide, defaults collapsed.
   * 'pane'  = expanded-by-default docked column child (no bottom-overlay
   *   positioning, ignores `isAnyPanelOpen`, no entry animation). Used on
   *   tablet/wide where the rail docks as a persistent column.
   */
  presentation?: 'sheet' | 'pane';
  /** Force-collapse when another bottom panel owns the space. */
  isAnyPanelOpen?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Read-only navigation to a point's anchor node. */
  onJump?: (nodeId: string) => void;
  /**
   * FEEDBACK-001 (#898) surface #2 — an optional ambient room-level line rendered
   * alongside the distribution legend (e.g. moves marked unanswered feed what
   * remains unresolved). Absent => byte-identical. Never a per-node / per-person
   * count.
   */
  marksLegendLine?: string;
  /**
   * FEEDBACK-002 (#899) — optional advisory overlay keyed by board point id (the
   * dodge_chain / talking_past derived-signal lines). ADDITIVE ONLY: it renders a
   * calm sub-line under the matching point and NEVER reorders points or re-reads
   * the board. Absent (default {}) => byte-identical rail (the single-derivation
   * pin: the board object is passed through untouched).
   */
  advisoryOverlayByPointId?: Readonly<Record<string, DerivedSignalLine>>;
  /**
   * CHIMEIN-P8 Round 2 (#761) — the chime-in contribution feed. Keyed by anchor
   * node id (= the chime CONTENT argument id); a matching entry marks that point
   * anchor a `chime_in` and renders the `↳ chime-in` marker. Supplied by
   * ArgumentRoom ONLY when the chime_in flag is on. Absent (default) => no marker
   * on any row => byte-identical rail. Never reorders / re-derives the board.
   */
  contributionKindByNodeId?: Readonly<Record<string, 'chime_in'>>;
  testID?: string;
}

/** Suppress any rendered label that would read as a raw internal code. */
function displaySafe(s: string): string {
  return looksLikeInternalCode(s) ? '' : s;
}

/** The "live" spine = every point that is not resolved/settled. */
function selectLivePoints(board: MediatorBoardState | null): ReadonlyArray<DisagreementPoint> {
  if (!board) return [];
  return board.points.filter((p) => p.state !== 'resolved_or_settled');
}

export function DisagreementPointsRail({
  board,
  viewerRole: _viewerRole,
  activeNodeId,
  windowWidth,
  windowHeight,
  reduceMotionOverride,
  defaultCollapsed,
  presentation = 'sheet',
  isAnyPanelOpen,
  onExpandedChange,
  onJump,
  marksLegendLine,
  advisoryOverlayByPointId,
  contributionKindByNodeId,
  testID,
}: DisagreementPointsRailProps): React.ReactElement | null {
  const rootTestID = testID ?? 'disagreement-points-rail';

  // ── viewport ──
  const dims = useWindowDimensions();
  const effectiveWidth = typeof windowWidth === 'number' ? windowWidth : dims.width;
  const effectiveHeight = typeof windowHeight === 'number' ? windowHeight : dims.height;
  const variant = resolveObserverDockVariant(effectiveWidth);
  const sheetMaxHeight = resolveSheetMaxHeightPx(effectiveHeight);

  // ── collapse state (observer-first → collapsed by default) ──
  // UX-BOARD-RAIL-002 — a docked pane is expanded by default (it IS the
  // column); the bottom sheet stays collapsed-by-default. An explicit
  // `defaultCollapsed` still wins (back-compat for existing callers/tests).
  const [collapsed, setCollapsed] = useState(
    defaultCollapsed ?? (presentation === 'pane' ? false : true),
  );
  const [showAll, setShowAll] = useState(false);

  // ── UX-BOARD-RAIL-003 — local distribution-segment navigation ──
  // The distribution strip is a navigation control: pressing a segment selects
  // that display state, jumps the rail's OWN ScrollView to the first matching
  // row, and marks the matching rows "In view" (geometry + text, never color
  // alone). This is purely rail-local: it touches NO board topology, NO mediator
  // derivation, NO scroll model outside this rail. `selectedSegment === null`
  // means "Show all points" (no group focused — every row reads as in view).
  const [selectedSegment, setSelectedSegment] = useState<V4MediatorStateCode | null>(null);
  // The rail's own ScrollView ref + per-row vertical offset (captured via
  // onLayout on each row wrapper). Used to scrollTo the first matching row.
  const scrollRef = useRef<ScrollView | null>(null);
  const rowOffsetsRef = useRef<Record<string, number>>({});

  // ── reduce-motion read (shared useReduceMotion hook — A11Y-693) ──
  // Behavior-preserving: the hook returns the identical value and honors the
  // same reduceMotionOverride prop as the prior inline reduce-motion effect.
  const effectiveReducedMotion = useReduceMotion(reduceMotionOverride);

  // ── mutual exclusion with the other bottom rails ──
  // UX-BOARD-RAIL-002 — a docked pane is NOT in the bottom shared-space group,
  // so it ignores `isAnyPanelOpen` (a stale OR-term on a sibling rail can never
  // force-collapse the column). The sheet honors it exactly as today.
  const expanded =
    presentation === 'pane' ? !collapsed : !collapsed && !isAnyPanelOpen;

  const onExpandedChangeRef = useRef(onExpandedChange);
  onExpandedChangeRef.current = onExpandedChange;
  const setExpanded = useCallback((next: boolean) => {
    setCollapsed(!next);
    if (!next) {
      setShowAll(false);
      // UX-BOARD-RAIL-003 — collapsing the rail also clears any segment focus,
      // so reopening starts from the full "Show all points" view.
      setSelectedSegment(null);
    }
    onExpandedChangeRef.current?.(next);
  }, []);

  // ── narrow-sheet slide (snapped under reduce-motion / side) ──
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    // UX-BOARD-RAIL-002 — the docked pane suppresses the entry animation
    // (width-independent: a 600–719 px pane straddles the 720 dock boundary but
    // must not slide). The sheet keeps its shipped slide unless reduce-motion.
    if (effectiveReducedMotion || variant === 'side' || presentation === 'pane') {
      progress.setValue(expanded ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, effectiveReducedMotion, variant, presentation, progress]);

  // ── web Escape — collapse ──
  useEffect(() => {
    if (!expanded) return;
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExpanded(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expanded, setExpanded]);

  const livePoints = useMemo(() => selectLivePoints(board), [board]);
  const count = livePoints.length;

  // UX-MEDIATOR-005 — the state-distribution roll-up. A COMPOSITION of the same
  // live points the rows render (no second derivation); ordered structurally.
  const distribution = useMemo(() => buildDisagreementDistribution(livePoints), [livePoints]);

  // UX-BOARD-RAIL-003 — the first live point whose v4 DISPLAY state matches a
  // segment. Used to scroll/focus the group's lead row. Reads the SAME live
  // points the rows render (no new derivation); preserves chronological order.
  const firstMatchingPointId = useCallback(
    (displayState: V4MediatorStateCode): string | null => {
      for (const point of livePoints) {
        if (v4DisplayStateFor(point.state) === displayState) return point.id;
      }
      return null;
    },
    [livePoints],
  );

  // UX-BOARD-RAIL-003 — select a segment + jump the rail's OWN ScrollView to the
  // first matching row. Not a hard filter — every row stays mounted; the target
  // group is anchored (header "Showing:" line) and marked ("In view"). Scroll is
  // best-effort: if the offset has not been measured yet (onLayout not fired) we
  // still set the selection so the visible group anchor + markers update.
  const handleSegmentPress = useCallback(
    (displayState: V4MediatorStateCode) => {
      setSelectedSegment(displayState);
      // Reveal hidden rows so a matching point past the initial cap is reachable.
      setShowAll(true);
      const targetId = firstMatchingPointId(displayState);
      if (targetId == null) return;
      const y = rowOffsetsRef.current[targetId];
      if (typeof y === 'number' && scrollRef.current) {
        scrollRef.current.scrollTo({ y, animated: !effectiveReducedMotion });
      }
    },
    [firstMatchingPointId, effectiveReducedMotion],
  );

  // UX-BOARD-RAIL-003 — "Show all points" reset: clear the segment focus so no
  // group is anchored and every row reads as in view. Returns to the top.
  const handleShowAll = useCallback(() => {
    setSelectedSegment(null);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: !effectiveReducedMotion });
    }
  }, [effectiveReducedMotion]);

  // UX-BOARD-RAIL-003 — the plain-language label for the focused group (read
  // from the distribution segment, which already carries the ban-list-clean
  // `plainLabel`). Empty when no segment is focused or it has no live members.
  const selectedSegmentLabel = useMemo(() => {
    if (selectedSegment == null) return '';
    const match = distribution.find((s) => s.displayState === selectedSegment);
    return match ? match.plainLabel : '';
  }, [selectedSegment, distribution]);

  const visiblePoints = useMemo(
    () => (showAll ? livePoints : livePoints.slice(0, DISAGREEMENT_POINTS_RAIL_INITIAL_ROWS)),
    [showAll, livePoints],
  );
  const moreCount = livePoints.length - visiblePoints.length;

  // First available next-step label per point (read from the board's pathways).
  const nextStepLabelFor = useCallback(
    (pointId: string): string => {
      const pathway = board?.pathwaysByPointId?.[pointId];
      if (!pathway) return '';
      const step = pathway.steps.find((s) => s.available);
      return step ? displaySafe(step.plainLabel) : '';
    },
    [board],
  );

  // UX-IMPASSE-001 (#689) — true when the point's pathway has NO available step
  // (`anyAvailable === false`). Read from the already-derived board; no new
  // derivation. Pairs with a `structured_impasse` display state to render the
  // dignified preserve/reopen line in place of an empty "Move forward:" row.
  const pathwayAnyAvailableFor = useCallback(
    (pointId: string): boolean => {
      const pathway = board?.pathwaysByPointId?.[pointId];
      return pathway?.anyAvailable === true;
    },
    [board],
  );

  // ── collapsed render ──
  if (!expanded) {
    return (
      <View
        style={[styles.collapsedWrap, variant === 'side' && styles.collapsedWrapSide]}
        testID={rootTestID}
      >
        <Pressable
          style={styles.collapsedChip}
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={`${DISAGREEMENT_POINTS_RAIL_COPY.title}. ${count} marked.`}
          accessibilityHint="Opens the list of disagreement points in this room."
          accessibilityState={{ expanded: false }}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          testID="disagreement-points-rail-toggle"
        >
          <Text style={styles.collapsedChipText} numberOfLines={1}>
            {`${DISAGREEMENT_POINTS_RAIL_COPY.title} · ${count} ▾`}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── expanded render ──
  const sheetAnimatedStyle =
    variant === 'sheet' && !effectiveReducedMotion
      ? {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [SHEET_SLIDE_TRAVEL, 0],
              }),
            },
          ],
        }
      : null;

  const body = (
    <>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header" testID="disagreement-points-rail-title">
          {`${DISAGREEMENT_POINTS_RAIL_COPY.title} · ${count} ${DISAGREEMENT_POINTS_RAIL_COPY.totalSuffix}`}
        </Text>
        <Pressable
          onPress={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel="Collapse the disagreement points list"
          accessibilityState={{ expanded: true }}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          style={styles.collapseControl}
          testID="disagreement-points-rail-collapse"
        >
          <Text style={styles.collapseLabel}>{`${DISAGREEMENT_POINTS_RAIL_COPY.collapseLabel} ▴`}</Text>
        </Pressable>
      </View>

      {/* UX-MEDIATOR-005 — state-distribution bar: a COMPOSITION roll-up of the
          live points, ordered structurally (V4_PRIMARY_STATE_PRIORITY), never by
          count/votes/heat. NOT color-only — each segment carries a text count
          and an accessibilityLabel, and a compact text legend renders the same
          buckets for grayscale / screen-reader parity. */}
      {distribution.length > 0 ? (
        <DisagreementDistributionBar
          segments={distribution}
          total={count}
          selectedSegment={selectedSegment}
          onSegmentPress={handleSegmentPress}
        />
      ) : null}

      {/* FEEDBACK-001 (#898) surface #2 — the ambient move-marks legend line,
          rendered alongside the distribution legend. A room-level reading, never a
          per-node count and never a per-person tally. Absent => byte-identical. */}
      {marksLegendLine ? (
        <Text
          style={styles.marksLegendLine}
          numberOfLines={2}
          testID="disagreement-points-rail-marks-legend"
        >
          {marksLegendLine}
        </Text>
      ) : null}

      {/* UX-BOARD-RAIL-003 — segment-selection anchor + reset. When a segment is
          focused, a "Showing: <state>" line names the active group (text, not
          color) and a "Show all points" reset clears it. Absent on the default
          (all-points) view so the calm baseline is unchanged. */}
      {selectedSegment != null && selectedSegmentLabel.length > 0 ? (
        <View style={styles.selectionAnchorRow} testID="disagreement-points-rail-selection-anchor">
          <Text
            style={styles.selectionAnchorText}
            numberOfLines={1}
            accessibilityRole="header"
            testID="disagreement-points-rail-showing"
          >
            {`${DISAGREEMENT_POINTS_RAIL_COPY.showingPrefix}: ${selectedSegmentLabel}`}
          </Text>
          <Pressable
            onPress={handleShowAll}
            accessibilityRole="button"
            accessibilityLabel={DISAGREEMENT_POINTS_RAIL_COPY.showAllPoints}
            accessibilityState={{ selected: false }}
            hitSlop={TOUCH_TARGET.hitSlopAll}
            style={styles.showAllControl}
            testID="disagreement-points-rail-show-all"
          >
            <Text style={styles.showAllText} numberOfLines={1}>
              {DISAGREEMENT_POINTS_RAIL_COPY.showAllPoints}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {board == null ? (
        <View style={styles.emptyState} testID="disagreement-points-rail-unavailable">
          <Text style={styles.emptyPrimary}>{DISAGREEMENT_POINTS_RAIL_COPY.unavailablePrimary}</Text>
        </View>
      ) : count === 0 ? (
        <View style={styles.emptyState} testID="disagreement-points-rail-empty">
          <Text style={styles.emptyPrimary}>{DISAGREEMENT_POINTS_RAIL_COPY.emptyPrimary}</Text>
          <Text style={styles.emptyHelper}>{DISAGREEMENT_POINTS_RAIL_COPY.emptyHelper}</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={[styles.scroll, { maxHeight: sheetMaxHeight }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="disagreement-points-rail-scroll"
        >
          {visiblePoints.map((point) => (
            <DisagreementPointRow
              key={point.id}
              point={point}
              isActive={activeNodeId != null && point.memberNodeIds.includes(activeNodeId)}
              nextStepLabel={nextStepLabelFor(point.id)}
              pathwayAnyAvailable={pathwayAnyAvailableFor(point.id)}
              evidence={getEvidenceDebtForPoint(board, point.id)}
              bridge={getDefinitionScopeBridgeForPoint(board, point.id)}
              onJump={onJump}
              // UX-BOARD-RAIL-003 — the row is "in view" of the focused segment
              // when its v4 display state matches the selection. `null` selection
              // (Show all points) marks no row, so the calm baseline is unchanged.
              inSelectedSegment={
                selectedSegment != null && v4DisplayStateFor(point.state) === selectedSegment
              }
              onMeasureOffset={(y) => {
                rowOffsetsRef.current[point.id] = y;
              }}
              advisoryOverlayLine={advisoryOverlayByPointId?.[point.id]}
              // CHIMEIN-P8 Round 2 (#761) — computed once in the parent from the
              // fed adapter map; absent map => false => no marker (byte-identical).
              isChimeIn={isChimeInAnchor(point.anchor, contributionKindByNodeId)}
            />
          ))}
          {!showAll && moreCount > 0 ? (
            <Pressable
              style={styles.overflowRow}
              onPress={() => setShowAll(true)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${moreCount} more ${moreCount === 1 ? 'point' : 'points'}`}
              hitSlop={TOUCH_TARGET.hitSlopAll}
              testID="disagreement-points-rail-overflow"
            >
              <Text style={styles.overflowText}>{`+${moreCount} ${DISAGREEMENT_POINTS_RAIL_COPY.overflowWord}`}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </>
  );

  // UX-BOARD-RAIL-002 — docked-pane chassis. The parent column owns the width
  // (380 px), so the pane wrapper drops the bottom-overlay cues
  // (`alignSelf:'flex-end'` / `width:380` / `borderTop`) and carries a LEFT
  // geometry border instead (column boundary, never color-only). `flex:1`
  // stretches the pane to the column height so the empty-state pane keeps a
  // stable shape and never collapses.
  if (presentation === 'pane') {
    return (
      <View style={[styles.expandedRoot, styles.expandedRootPane]} testID={rootTestID}>
        {body}
      </View>
    );
  }
  if (variant === 'side') {
    return (
      <View style={[styles.expandedRoot, styles.expandedRootSide]} testID={rootTestID}>
        {body}
      </View>
    );
  }
  return (
    <Animated.View
      style={[styles.expandedRoot, styles.expandedRootSheet, sheetAnimatedStyle]}
      testID={rootTestID}
    >
      {body}
    </Animated.View>
  );
}

interface DisagreementPointRowProps {
  point: DisagreementPoint;
  isActive: boolean;
  nextStepLabel: string;
  /**
   * UX-IMPASSE-001 (#689) — whether the point's pathway has any available step.
   * When false AND the display state is `structured_impasse`, the row renders the
   * dignified preserve/reopen line instead of an empty "Move forward:".
   */
  pathwayAnyAvailable?: boolean;
  /** UX-MEDIATOR-003 — compact evidence display for the point, or null. */
  evidence?: PointEvidenceDisplay | null;
  /** UX-MEDIATOR-004 — compact definition/scope bridge for the point, or null. */
  bridge?: PointBridgeDisplay | null;
  onJump?: (nodeId: string) => void;
  /**
   * UX-BOARD-RAIL-003 — true when this row's display state matches the focused
   * distribution segment. Renders a non-color-only "In view" group marker (a
   * left accent rule + text), never a hard filter (the row stays mounted).
   */
  inSelectedSegment?: boolean;
  /**
   * UX-BOARD-RAIL-003 — reports the row wrapper's vertical offset within the
   * rail's own ScrollView (via onLayout) so a segment press can scrollTo it.
   */
  onMeasureOffset?: (y: number) => void;
  /**
   * FEEDBACK-002 (#899) — optional advisory sub-line (dodge_chain / talking_past)
   * for this point. Absent => byte-identical row. Ban-list-clean, never a verdict.
   */
  advisoryOverlayLine?: DerivedSignalLine;
  /**
   * CHIMEIN-P8 Round 2 (#761) — whether this point anchor is a chime-in
   * contribution (computed by the parent from the fed adapter map). Absent /
   * false => no marker => byte-identical row.
   */
  isChimeIn?: boolean;
}

function DisagreementPointRow({
  point,
  isActive,
  nextStepLabel,
  pathwayAnyAvailable,
  evidence,
  bridge,
  onJump,
  inSelectedSegment,
  onMeasureOffset,
  advisoryOverlayLine,
  isChimeIn,
}: DisagreementPointRowProps): React.ReactElement {
  // UX-MEDIATOR-005 (O-1) — project the badge through the v4 display vocabulary
  // so the rail row matches the node chip; `point.state` stays intact for Inspect.
  const stateLabel = displaySafe(v4RowBadgeLabel(point));
  const evidenceLine = evidenceRequestCountLabel(point.openEvidenceDebtIds.length);
  // UX-MEDIATOR-005 (O-4a) — rendered only when CHIMEIN-P8 Round 2 (#761) feeds
  // the contribution data marking this anchor as a chime-in (computed in the
  // parent from the adapter map). Absent => byte-identical (no marker).
  const showChimeIn = isChimeIn === true;

  // UX-IMPASSE-001 (#689) — a structured-impasse point with no available pathway
  // step shows an empty "Move forward:" today (the only step is unavailable). Show
  // the dignified preserve/reopen line instead. Keyed on the v4 DISPLAY state (so
  // it matches the chip) + `anyAvailable === false`; guards against rendering on
  // any non-impasse point. Copy on the existing row body — no new row/relocation.
  const isImpasseNoPathway =
    v4DisplayStateFor(point.state) === 'structured_impasse' &&
    nextStepLabel.length === 0 &&
    pathwayAnyAvailable !== true;

  return (
    <View
      style={[styles.row, isActive && styles.rowActive, inSelectedSegment && styles.rowInView]}
      onLayout={(event) => onMeasureOffset?.(event.nativeEvent.layout.y)}
      testID={`disagreement-points-rail-rowwrap-${point.id}`}
    >
      {/* Active geometry — left accent bar (position/shape, not color alone). A
          row that is also "in view" of the focused segment widens the accent
          rule (geometry), so the group membership reads in grayscale. */}
      <View
        style={[
          styles.activeBar,
          isActive ? styles.activeBarOn : inSelectedSegment ? styles.activeBarInView : styles.activeBarOff,
          inSelectedSegment && styles.activeBarInViewWidth,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Pressable
        style={styles.rowMain}
        onPress={() => onJump?.(point.anchor.nodeId)}
        accessibilityRole="button"
        accessibilityLabel={`${stateLabel}. ${DISAGREEMENT_POINTS_RAIL_COPY.viewInTimeline}.`}
        accessibilityHint={DISAGREEMENT_POINTS_RAIL_COPY.viewInTimeline}
        accessibilityState={{ selected: isActive }}
        hitSlop={TOUCH_TARGET.hitSlopCompact}
        testID={`disagreement-points-rail-row-${point.id}`}
      >
        <View style={styles.stateRow}>
          {stateLabel.length > 0 ? (
            <View style={[styles.badge, isActive && styles.badgeActive]}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {stateLabel}
              </Text>
            </View>
          ) : null}
          {isActive ? (
            <Text style={styles.activeWord} testID={`disagreement-points-rail-active-${point.id}`}>
              {DISAGREEMENT_POINTS_RAIL_COPY.activeSuffix}
            </Text>
          ) : null}
          {/* UX-BOARD-RAIL-003 — non-color-only "in view" group marker: a "▸ In
              view" text chip (text + the left accent rule carry the meaning).
              Renders only when this row matches the focused segment. */}
          {inSelectedSegment ? (
            <Text style={styles.inViewWord} testID={`disagreement-points-rail-inview-${point.id}`}>
              {`▸ ${DISAGREEMENT_POINTS_RAIL_COPY.inViewMarker}`}
            </Text>
          ) : null}
        </View>

        {nextStepLabel.length > 0 ? (
          <Text style={styles.nextStep} numberOfLines={2}>
            {`${DISAGREEMENT_POINTS_RAIL_COPY.moveForward} ${nextStepLabel}`}
          </Text>
        ) : null}

        {/* UX-IMPASSE-001 (#689) — dignified impasse line: replaces the empty
            "Move forward:" row for a structured-impasse point with no available
            pathway step. A calm, complete statement (the disagreement is
            preserved) + the reopen invitation. Structural guidance, never a gate;
            `accessibilityRole="text"` (no interactive element added). */}
        {isImpasseNoPathway ? (
          <View
            style={styles.impasseWrap}
            testID={`disagreement-points-rail-impasse-${point.id}`}
          >
            <Text
              style={styles.impassePreserved}
              numberOfLines={1}
              accessibilityRole="text"
              testID={`disagreement-points-rail-impasse-preserved-${point.id}`}
            >
              {DISAGREEMENT_POINTS_RAIL_COPY.impassePreserved}
            </Text>
            <Text
              style={styles.impasseReopen}
              numberOfLines={2}
              accessibilityRole="text"
              testID={`disagreement-points-rail-impasse-reopen-${point.id}`}
            >
              {DISAGREEMENT_POINTS_RAIL_COPY.impasseReopen}
            </Text>
          </View>
        ) : null}

        {/* UX-MEDIATOR-004 — definition/scope bridge: actionable clarification
            guidance (structural; never a verdict, never a posting gate). */}
        {bridge ? (
          <View style={styles.bridgeWrap} testID={`disagreement-points-rail-bridge-${point.id}`}>
            <Text style={styles.bridgeLead} numberOfLines={1}>
              {DISAGREEMENT_POINTS_RAIL_COPY.clarifyPoint}
            </Text>
            <Text
              style={styles.bridgePrompt}
              numberOfLines={2}
              testID={`disagreement-points-rail-bridge-primary-${point.id}`}
            >
              {bridge.primary === 'definition'
                ? DISAGREEMENT_POINTS_RAIL_COPY.definitionBridge
                : DISAGREEMENT_POINTS_RAIL_COPY.scopeBridge}
            </Text>
            {bridge.secondary ? (
              <Text
                style={styles.bridgeSecondary}
                numberOfLines={1}
                testID={`disagreement-points-rail-bridge-secondary-${point.id}`}
              >
                {`${DISAGREEMENT_POINTS_RAIL_COPY.alsoPrefix}: ${
                  bridge.secondary === 'definition'
                    ? DISAGREEMENT_POINTS_RAIL_COPY.definitionShort
                    : DISAGREEMENT_POINTS_RAIL_COPY.scopeShort
                }`}
              </Text>
            ) : null}
          </View>
        ) : null}

        {evidenceLine.length > 0 ? (
          <Text style={styles.evidenceLine} numberOfLines={1} testID={`disagreement-points-rail-evidence-${point.id}`}>
            {evidenceLine}
          </Text>
        ) : null}

        {/* UX-MEDIATOR-003 — what evidence would help (structural; never a proof demand). */}
        {evidence && evidence.kindsLine.length > 0 ? (
          <Text style={styles.evidenceLine} numberOfLines={2} testID={`disagreement-points-rail-evidence-help-${point.id}`}>
            {`${DISAGREEMENT_POINTS_RAIL_COPY.evidenceHelp}: ${evidence.kindsLine}`}
          </Text>
        ) : null}
        {evidence?.isBlocked ? (
          <Text style={styles.blockedPathLine} numberOfLines={1} testID={`disagreement-points-rail-blocked-${point.id}`}>
            {DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath}
          </Text>
        ) : null}

        {/* FEEDBACK-002 (#899) — optional advisory overlay sub-line (dodge_chain
            / talking_past). Additive, calm, ban-list-clean; never a verdict,
            never reorders the point. Absent => byte-identical row. */}
        {advisoryOverlayLine ? (
          <Text
            style={styles.derivedAdvisoryLine}
            numberOfLines={2}
            accessibilityRole="text"
            accessibilityLabel={advisoryOverlayLine.accessibilityLabel}
            testID={`disagreement-points-rail-advisory-${point.id}`}
          >
            {advisoryOverlayLine.text}
          </Text>
        ) : null}

        <View style={styles.anchorRow}>
          <Text style={styles.jumpHint} numberOfLines={1}>
            {`${DISAGREEMENT_POINTS_RAIL_COPY.viewInTimeline} →`}
          </Text>
          {/* UX-MEDIATOR-005 (O-4a) — dormant chime-in contribution marker.
              Renders ONLY when the (optional, not-yet-shipped) board data marks
              this anchor as a chime-in; the common path renders nothing. A
              contribution label, never a state, verdict, or third principal. */}
          {showChimeIn ? (
            <Text
              style={styles.chimeInMarker}
              numberOfLines={1}
              testID={`disagreement-points-rail-chimein-${point.id}`}
            >
              {DISAGREEMENT_POINTS_RAIL_COPY.chimeInMarker}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

interface DisagreementDistributionBarProps {
  segments: ReadonlyArray<DisagreementDistributionSegment>;
  total: number;
  /** UX-BOARD-RAIL-003 — the focused segment (or null = Show all points). */
  selectedSegment: V4MediatorStateCode | null;
  /** UX-BOARD-RAIL-003 — press a segment to jump the list to that group. */
  onSegmentPress: (displayState: V4MediatorStateCode) => void;
}

/**
 * UX-MEDIATOR-005 — the state-distribution bar. A flex-weighted row of segments
 * (width proportional to count/total → a COMPOSITION bar, never a magnitude/heat
 * bar), each carrying its own count text + accessibilityLabel, followed by a
 * compact text legend so the bar is fully legible in grayscale and to screen
 * readers (color is never the only signal). The impasse segment gets the gold
 * focus-ring emphasis; every other segment uses the same neutral raised surface
 * — no red/green verdict pairing.
 *
 * UX-BOARD-RAIL-003 — each segment AND each legend item is now a touch-safe
 * `Pressable` navigation control: pressing it focuses that display-state group
 * and jumps the rail's own list to the first matching row. The selected segment
 * carries a non-color-only "selected" treatment (a top accent rule + a "▸"
 * marker glyph in the count) so the focus reads in grayscale. Ordering is
 * UNCHANGED (V4_PRIMARY_STATE_PRIORITY), counts stay subordinate — this is a
 * structure navigator, never a scoreboard.
 */
function DisagreementDistributionBar({
  segments,
  total,
  selectedSegment,
  onSegmentPress,
}: DisagreementDistributionBarProps): React.ReactElement | null {
  if (segments.length === 0 || total <= 0) return null;
  return (
    <View style={styles.distributionWrap} testID="disagreement-points-rail-distribution">
      <View style={styles.distributionBar}>
        {segments.map((segment) => {
          const isImpasse = segment.displayState === 'structured_impasse';
          const isSelected = segment.displayState === selectedSegment;
          return (
            <Pressable
              key={segment.displayState}
              onPress={() => onSegmentPress(segment.displayState)}
              accessibilityRole="button"
              accessibilityLabel={
                isSelected
                  ? `Showing ${segment.plainLabel} points: ${segment.count} of ${total}`
                  : `Jump to ${segment.plainLabel} points: ${segment.count} of ${total}`
              }
              accessibilityState={{ selected: isSelected }}
              hitSlop={TOUCH_TARGET.hitSlopAll}
              style={[
                styles.distributionSegment,
                isImpasse ? styles.distributionSegmentImpasse : styles.distributionSegmentDefault,
                isSelected && styles.distributionSegmentSelected,
                { flexGrow: segment.count, flexShrink: 1, flexBasis: 0 },
              ]}
              testID={`disagreement-points-rail-distribution-segment-${segment.displayState}`}
            >
              <Text style={styles.distributionSegmentCount} numberOfLines={1}>
                {/* The "▸" marker is the non-color-only selected cue on the bar. */}
                {isSelected ? `▸ ${segment.count}` : String(segment.count)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.distributionLegend} testID="disagreement-points-rail-distribution-legend">
        {segments.map((segment) => {
          const isSelected = segment.displayState === selectedSegment;
          return (
            <Pressable
              key={segment.displayState}
              onPress={() => onSegmentPress(segment.displayState)}
              accessibilityRole="button"
              accessibilityLabel={
                isSelected
                  ? `Showing ${segment.plainLabel} points`
                  : `Jump to ${segment.plainLabel} points`
              }
              accessibilityState={{ selected: isSelected }}
              hitSlop={TOUCH_TARGET.hitSlopCompact}
              style={[styles.distributionLegendItemWrap, isSelected && styles.distributionLegendItemSelected]}
              testID={`disagreement-points-rail-distribution-legend-${segment.displayState}`}
            >
              <Text style={styles.distributionLegendItem} numberOfLines={1}>
                {/* Geometry + text selected cue (the "▸" glyph), never color alone. */}
                {`${isSelected ? '▸ ' : ''}${segment.plainLabel} ${segment.count}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedWrap: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderTopWidth: BORDER_WIDTH.sm,
    borderTopColor: SURFACE_TOKENS.border,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapsedWrapSide: { justifyContent: 'flex-end' },
  collapsedChip: {
    backgroundColor: SURFACE_TOKENS.overlay,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.focusRing,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.pill,
    minHeight: TOUCH_TARGET.minSizePx,
    minWidth: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedChipText: {
    color: SURFACE_TOKENS.textPrimary,
    fontWeight: '800',
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
  },

  expandedRoot: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderTopWidth: BORDER_WIDTH.sm,
    borderTopColor: SURFACE_TOKENS.border,
    paddingHorizontal: SPACING.s,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.m,
  },
  expandedRootSheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  expandedRootSide: {
    alignSelf: 'flex-end',
    width: 380,
    maxWidth: '100%',
  },
  // UX-BOARD-RAIL-002 — docked-pane chassis. Stretches to the column height
  // and width (the parent column is sized to 380 px), drops the bottom-overlay
  // top border, and carries a LEFT geometry border for the column boundary.
  expandedRootPane: {
    flex: 1,
    alignSelf: 'stretch',
    borderTopWidth: 0,
    borderLeftWidth: BORDER_WIDTH.sm,
    borderLeftColor: SURFACE_TOKENS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // UX-BOARD-READABILITY-001 (2026-06-19): xs -> s so the title clears the rows.
    marginBottom: SPACING.s,
  },
  // UX-BOARD-READABILITY-001 (2026-06-19): establish title-vs-row hierarchy by
  // re-pointing the section header to the EXISTING popoutHeading token (13/18)
  // and dropping the all-caps + letterSpacing "admin panel" treatment. The
  // composed header string ('Disagreement points · N total') is unchanged
  // (uxMediator005). No new tokens, no global TYPOGRAPHY mutation.
  title: {
    color: SURFACE_TOKENS.focusRing,
    fontWeight: '800',
    fontSize: TYPOGRAPHY.popoutHeading.fontSize,
    lineHeight: TYPOGRAPHY.popoutHeading.lineHeight,
  },
  collapseControl: {
    minHeight: TOUCH_TARGET.minSizePx,
    minWidth: TOUCH_TARGET.minSizePx,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  collapseLabel: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '700',
  },

  // UX-BOARD-RAIL-003 — the segment-selection anchor row: a "Showing: <state>"
  // label (names the focused group as text) + a "Show all points" reset. Only
  // shown when a segment is focused; absent on the calm all-points baseline.
  selectionAnchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: SPACING.s,
    gap: SPACING.xs,
  },
  selectionAnchorText: {
    flexShrink: 1,
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '800',
  },
  showAllControl: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    borderStyle: 'dashed',
  },
  showAllText: {
    color: SURFACE_TOKENS.focusRing,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '700',
  },

  emptyState: {
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.xs,
    gap: SPACING.xs,
  },
  emptyPrimary: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
    fontWeight: '700',
  },
  emptyHelper: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 2,
  },

  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: SPACING.xs, gap: SPACING.xs },
  row: {
    flexDirection: 'row',
    backgroundColor: SURFACE_TOKENS.overlay,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    overflow: 'hidden',
  },
  rowActive: { borderColor: SURFACE_TOKENS.focusRing },
  // UX-BOARD-RAIL-003 — a row "in view" of the focused segment gets a subtle
  // geometry emphasis (a raised-surface border) distinct from the active row's
  // focus-ring border. Both are reinforced by text, never color alone.
  rowInView: { borderColor: SURFACE_TOKENS.textSecondary },
  activeBar: { width: 4 },
  activeBarOn: { backgroundColor: SURFACE_TOKENS.focusRing },
  activeBarOff: { backgroundColor: 'transparent' },
  // UX-BOARD-RAIL-003 — the in-view accent rule: a wider, muted left bar so the
  // group membership reads as geometry in grayscale (paired with the "In view"
  // text). The active bar (focus-ring) still wins when a row is both.
  activeBarInView: { backgroundColor: SURFACE_TOKENS.textSecondary },
  activeBarInViewWidth: { width: 6 },
  rowMain: {
    flex: 1,
    // UX-BOARD-READABILITY-001 (2026-06-19): loosen the crammed row — padding
    // s(8) -> m(12) and gap 2 -> xs(4) so each point reads as a card, not a
    // spreadsheet line. Geometry only; minHeight/topology unchanged.
    padding: SPACING.m,
    gap: SPACING.xs,
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  badge: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
  },
  badgeActive: { borderColor: SURFACE_TOKENS.focusRing },
  badgeText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '700',
  },
  // UX-BOARD-READABILITY-001 (2026-06-19): the 'Currently active' you-are-here
  // marker lifted badgeLabel(10) -> chipLabel(11). Left accent bar + text still
  // carry the meaning (color-independence preserved).
  activeWord: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  // UX-BOARD-RAIL-003 — the "▸ In view" group marker word. A muted, weighted
  // label distinct from the focus-ring "Currently active" word; the "▸" glyph +
  // the wider left accent rule carry the meaning in grayscale (color-independent).
  inViewWord: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '700',
  },
  // UX-BOARD-READABILITY-001 (2026-06-19): 'Move forward: <step>' is the most
  // load-bearing guidance line per point; re-point chipLabel(11) -> popoutBody(12/16)
  // so the line a reader actually acts on is the most legible in the row.
  nextStep: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
  },
  // UX-IMPASSE-001 (#689) — dignified impasse line: a bold "preserved" lead-in +
  // a muted reopen invitation. Mirrors the bridge block's calm two-line shape; no
  // new color signal (text carries the meaning), no interactive element.
  impasseWrap: {
    marginTop: 2,
    gap: 2,
  },
  impassePreserved: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '800',
  },
  impasseReopen: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 2,
  },
  // UX-MEDIATOR-004 — definition/scope bridge. A compact guidance block: a
  // bold "Clarify the point" lead-in + one actionable prompt, with an optional
  // one-line secondary note only when both definition and scope apply.
  bridgeWrap: {
    marginTop: 2,
    gap: 2,
  },
  bridgeLead: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '800',
  },
  bridgePrompt: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 2,
  },
  bridgeSecondary: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
  },
  // UX-BOARD-READABILITY-001 (2026-06-19): evidence count + 'Evidence that would
  // help' (numberOfLines 2) lifted badgeLabel(10) -> chipLabel(11) with an explicit
  // lineHeight so the wrapped guidance is legible.
  evidenceLine: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: 15,
  },
  // FEEDBACK-002 (#899) — advisory overlay sub-line. Calm muted tone; the words
  // carry the meaning (never color-only). Italic-free plain advisory copy.
  derivedAdvisoryLine: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: 15,
    marginTop: 2,
  },
  // UX-MEDIATOR-003 — blocked evidence path: attention tone via the focus-ring
  // color + weight (not color alone — the explicit "Blocked evidence path"
  // word carries the meaning).
  // UX-BOARD-READABILITY-001 (2026-06-19): 'Blocked evidence path' is a structural
  // state the reader must notice — lifted badgeLabel(10) -> chipLabel(11). Text
  // still carries the meaning (no new color signal).
  blockedPathLine: {
    color: SURFACE_TOKENS.focusRing,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: 14,
    fontWeight: '700',
  },
  // UX-BOARD-READABILITY-001 (2026-06-19): 'View in timeline →' is the only verb
  // in each row; lifted badgeLabel(10) -> chipLabel(11) so the action clears the
  // metadata. Copy string unchanged.
  jumpHint: {
    color: SURFACE_TOKENS.focusRing,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: 14,
    fontWeight: '700',
  },
  // UX-MEDIATOR-005 — anchor row: the jump hint + the dormant chime-in marker
  // sit on one line; the marker is absent on the common path.
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  // UX-MEDIATOR-005 — chime-in contribution marker (dormant). A muted
  // contribution label, visually distinct from the focus-ring jump hint so it
  // never reads as a state badge.
  chimeInMarker: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '700',
  },

  // UX-MEDIATOR-005 — state-distribution bar. A composition bar (flex-weighted
  // segments) + a compact text legend. Color is never the only signal: each
  // segment carries a count and an accessibilityLabel, and the legend names
  // every bucket for grayscale / screen-reader parity.
  // UX-BOARD-READABILITY-001 (2026-06-19): more air below the roll-up (xs -> s)
  // and a slightly taller bar (14 -> 18) so the composition strip reads as calm
  // structure, not a dense metrics chart. Buckets/order/counts unchanged.
  distributionWrap: {
    marginBottom: SPACING.s,
    gap: SPACING.xs,
  },
  distributionBar: {
    flexDirection: 'row',
    height: 18,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
  },
  distributionSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    borderRightWidth: BORDER_WIDTH.sm,
    borderRightColor: SURFACE_TOKENS.border,
  },
  // Impasse segment gets the gold focus-ring emphasis (the doctrine's "dignity /
  // selected / impasse emphasis" tone); everything else is the neutral raised
  // surface — no red/green verdict pairing.
  distributionSegmentImpasse: { backgroundColor: SURFACE_TOKENS.focusRing },
  distributionSegmentDefault: { backgroundColor: SURFACE_TOKENS.raised },
  // UX-BOARD-RAIL-003 — the selected/focused segment carries a top accent rule
  // (geometry) in addition to the "▸" glyph in its count; the focus is legible
  // in grayscale (never color alone).
  distributionSegmentSelected: {
    borderTopWidth: 2,
    borderTopColor: SURFACE_TOKENS.textPrimary,
  },
  distributionSegmentCount: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '800',
  },
  distributionLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  // UX-BOARD-RAIL-003 — each legend entry is now a touch-safe Pressable jump.
  // The wrapper carries the min touch target (paired with hitSlop); the selected
  // entry gets an underline rule (geometry) + the "▸" glyph (text), not color.
  distributionLegendItemWrap: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  distributionLegendItemSelected: {
    borderBottomWidth: 2,
    borderBottomColor: SURFACE_TOKENS.textPrimary,
  },
  distributionLegendItem: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '600',
  },
  // FEEDBACK-001 (#898) surface #2 — the ambient move-marks legend line. A quiet
  // secondary caption; neutral tone, never a count.
  marksLegendLine: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },

  overflowRow: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    borderStyle: 'dashed',
  },
  overflowText: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '700',
  },
});
