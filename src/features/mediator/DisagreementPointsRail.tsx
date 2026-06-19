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
  AccessibilityInfo,
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
import type { DisagreementPoint, MediatorBoardState, PointAnchor } from './mediatorBoardTypes';
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
 * UX-MEDIATOR-005 (O-4a / Finding B) — the dormant chime-in contribution marker.
 *
 * The shipped board carries NO chime-in / principal / contribution data — that
 * model is owned by UX-ROOM-1V1-CHIMEIN-001 (not yet shipped). This card ships
 * only the RENDER SLOT: the row reads an OPTIONAL `contributionKind` from the
 * anchor without adding a field to `PointAnchor` (the producer can't fill it
 * yet). With no such data, every row returns false → no marker renders. We NEVER
 * synthesize the marker from absent data (doctrine §4 — observation-driven).
 */
interface PointAnchorWithContribution extends PointAnchor {
  /** OPTIONAL, dormant — supplied later by UX-ROOM-1V1-CHIMEIN-001 / its adapter. */
  contributionKind?: 'principal' | 'chime_in';
}

function isChimeInAnchor(anchor: PointAnchor): boolean {
  return (anchor as PointAnchorWithContribution).contributionKind === 'chime_in';
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

  // ── reduce-motion read (mirrors OpenIssuesRail) ──
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
            // Some platforms reject — keep the default.
          });
      }
    } catch {
      // API unavailable — keep the default.
    }
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        if (!cancelled) setPrefersReducedMotion(enabled === true);
      });
    } catch {
      // Listener API unavailable.
    }
    return () => {
      cancelled = true;
      try {
        subscription?.remove();
      } catch {
        // Already torn down.
      }
    };
  }, []);

  const effectiveReducedMotion =
    typeof reduceMotionOverride === 'boolean' ? reduceMotionOverride : prefersReducedMotion;

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
    if (!next) setShowAll(false);
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
        <DisagreementDistributionBar segments={distribution} total={count} />
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
}

function DisagreementPointRow({
  point,
  isActive,
  nextStepLabel,
  pathwayAnyAvailable,
  evidence,
  bridge,
  onJump,
}: DisagreementPointRowProps): React.ReactElement {
  // UX-MEDIATOR-005 (O-1) — project the badge through the v4 display vocabulary
  // so the rail row matches the node chip; `point.state` stays intact for Inspect.
  const stateLabel = displaySafe(v4RowBadgeLabel(point));
  const evidenceLine = evidenceRequestCountLabel(point.openEvidenceDebtIds.length);
  // UX-MEDIATOR-005 (O-4a) — dormant unless the (optional, not-yet-shipped)
  // contribution data marks this anchor as a chime-in.
  const showChimeIn = isChimeInAnchor(point.anchor);

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
    <View style={[styles.row, isActive && styles.rowActive]} testID={`disagreement-points-rail-rowwrap-${point.id}`}>
      {/* Active geometry — left accent bar (position/shape, not color alone). */}
      <View
        style={[styles.activeBar, isActive ? styles.activeBarOn : styles.activeBarOff]}
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
}

/**
 * UX-MEDIATOR-005 — the state-distribution bar. A flex-weighted row of `<View>`
 * segments (width proportional to count/total → a COMPOSITION bar, never a
 * magnitude/heat bar), each carrying its own count text + accessibilityLabel,
 * followed by a compact text legend so the bar is fully legible in grayscale
 * and to screen readers (color is never the only signal). The impasse segment
 * gets the gold focus-ring emphasis; every other segment uses the same neutral
 * raised surface — no red/green verdict pairing.
 */
function DisagreementDistributionBar({
  segments,
  total,
}: DisagreementDistributionBarProps): React.ReactElement | null {
  if (segments.length === 0 || total <= 0) return null;
  return (
    <View style={styles.distributionWrap} testID="disagreement-points-rail-distribution">
      <View
        style={styles.distributionBar}
        accessibilityRole="image"
        accessibilityLabel={`Disagreement points by state: ${segments
          .map((s) => `${s.count} ${s.plainLabel}`)
          .join(', ')}.`}
      >
        {segments.map((segment) => {
          const isImpasse = segment.displayState === 'structured_impasse';
          return (
            <View
              key={segment.displayState}
              style={[
                styles.distributionSegment,
                isImpasse ? styles.distributionSegmentImpasse : styles.distributionSegmentDefault,
                { flexGrow: segment.count, flexShrink: 1, flexBasis: 0 },
              ]}
              accessibilityLabel={`${segment.plainLabel}: ${segment.count} of ${total}`}
              testID={`disagreement-points-rail-distribution-segment-${segment.displayState}`}
            >
              <Text style={styles.distributionSegmentCount} numberOfLines={1}>
                {String(segment.count)}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.distributionLegend} testID="disagreement-points-rail-distribution-legend">
        {segments.map((segment) => (
          <Text
            key={segment.displayState}
            style={styles.distributionLegendItem}
            numberOfLines={1}
            testID={`disagreement-points-rail-distribution-legend-${segment.displayState}`}
          >
            {`${segment.plainLabel} ${segment.count}`}
          </Text>
        ))}
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
    marginBottom: SPACING.xs,
  },
  title: {
    color: SURFACE_TOKENS.focusRing,
    fontWeight: '800',
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  activeBar: { width: 4 },
  activeBarOn: { backgroundColor: SURFACE_TOKENS.focusRing },
  activeBarOff: { backgroundColor: 'transparent' },
  rowMain: {
    flex: 1,
    padding: SPACING.s,
    gap: 2,
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
  activeWord: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nextStep: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 2,
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
  evidenceLine: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
  },
  // UX-MEDIATOR-003 — blocked evidence path: attention tone via the focus-ring
  // color + weight (not color alone — the explicit "Blocked evidence path"
  // word carries the meaning).
  blockedPathLine: {
    color: SURFACE_TOKENS.focusRing,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '700',
  },
  jumpHint: {
    color: SURFACE_TOKENS.focusRing,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
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
  distributionWrap: {
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  distributionBar: {
    flexDirection: 'row',
    height: 14,
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
  distributionLegendItem: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '600',
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
