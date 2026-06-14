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
import type { DisagreementPoint, MediatorBoardState } from './mediatorBoardTypes';
import {
  DISAGREEMENT_POINTS_RAIL_COPY,
  DISAGREEMENT_POINTS_RAIL_INITIAL_ROWS,
  evidenceRequestCountLabel,
} from './mediatorRailCopy';
import { getEvidenceDebtForPoint, type PointEvidenceDisplay } from './evidenceDebtDisplay';

const SHEET_SLIDE_TRAVEL = 48;

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
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? true);
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
  const expanded = !collapsed && !isAnyPanelOpen;

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
    if (effectiveReducedMotion || variant === 'side') {
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
  }, [expanded, effectiveReducedMotion, variant, progress]);

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
          {`${DISAGREEMENT_POINTS_RAIL_COPY.title} · ${count}`}
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
              evidence={getEvidenceDebtForPoint(board, point.id)}
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
  /** UX-MEDIATOR-003 — compact evidence display for the point, or null. */
  evidence?: PointEvidenceDisplay | null;
  onJump?: (nodeId: string) => void;
}

function DisagreementPointRow({
  point,
  isActive,
  nextStepLabel,
  evidence,
  onJump,
}: DisagreementPointRowProps): React.ReactElement {
  const stateLabel = displaySafe(point.plainLabel);
  const evidenceLine = evidenceRequestCountLabel(point.openEvidenceDebtIds.length);

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
            {`${DISAGREEMENT_POINTS_RAIL_COPY.whatHelps} ${nextStepLabel}`}
          </Text>
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

        <Text style={styles.jumpHint} numberOfLines={1}>
          {`${DISAGREEMENT_POINTS_RAIL_COPY.viewInTimeline} →`}
        </Text>
      </Pressable>
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
