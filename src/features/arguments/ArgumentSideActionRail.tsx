/**
 * Stage 6.4 — ArgumentSideActionRail
 *
 * Collapsed-by-default rail. In Observer mode it stays small until the
 * user expands or taps a bubble. The rail is the SINGLE entry point for
 * Join-Aff / Join-Neg and the per-bubble tactical actions.
 *
 * No body editing affordance is ever exposed. Own-bubble action set is
 * intentionally minimal (Qualifiers + Request deletion).
 *
 * SC-005 — LAYOUT pass. The Stage 6.4 action-set definitions below
 * (`RailActionCode` … `railActionToBubbleControl`) stay byte-for-byte
 * unchanged — they are the contract `railActionGrouping.test.ts` locks.
 * SC-005 only changes how the rail RENDERS: a collapsed contextual dock
 * (pill / bottom-right anchor) that expands into a compact dock —
 * side-anchored on wide viewports, a capped bottom sheet (~28% of the
 * viewport, never full-screen) on narrow ones — with short labels only,
 * helper text demoted to `accessibilityHint` plus long-press, category
 * headers shown only when >= 2 categories are non-empty, a context-aware
 * collapsed primary label, mutual exclusion with the SC-002 popover, and
 * the full accessibility contract (44×44 targets, Tab/Esc/Enter web
 * keyboard nav, reduce-motion fallback = no slide).
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
import type { ArgumentBubbleControl } from './argumentGameSurfaceModel';
import { OBSERVER_COPY } from './gameCopy';
import {
  buildCollapsedDockLabel,
  buildExpandedDockViewModel,
  deriveDockContext,
  resolveObserverDockVariant,
  resolveSheetMaxHeightPx,
} from './ObserverActionDockLayout';
import {
  RAIL_ACTION_CATEGORIES,
  RAIL_ACTION_CATEGORY_LABEL,
  groupRailActionsByCategory,
} from './railActionCategories';
import type {
  RailAction,
  RailActionCategory,
  RailActionCode,
  RailActionGroup,
  RailActionWithCategory,
  RailBubbleActor,
  RailViewerRole,
} from './railActionCategories';
import type { ParticipantSide } from '../debates/types';

// Re-export the rail-action category model so existing call sites and
// tests that import from './ArgumentSideActionRail' continue to work
// after the railActionCategories extraction.
export {
  RAIL_ACTION_CATEGORIES,
  RAIL_ACTION_CATEGORY_LABEL,
  groupRailActionsByCategory,
};
export type {
  RailAction,
  RailActionCategory,
  RailActionCode,
  RailActionGroup,
  RailActionWithCategory,
  RailBubbleActor,
  RailViewerRole,
};

// UX-001.4 — Migrate-to-Act entries removed per design §1 Table B (B.1/B.2/B.3).
// The remaining entries are either:
//   - preserve-as-shortcut: high-frequency single-tap actions (watch /
//     join_aff / join_neg for observers; reply / disagree for
//     participants on other bubbles) that would lose value with an Act
//     roundtrip.
//   - retain-with-rationale: out-of-band actions that aren't moves
//     (share — opens a native/browser share sheet; not a Constitution move).
//
// Migrated codes still exist in the RailActionCode union for back-compat
// with railActionToBubbleControl; they simply don't render in the rail.
// Act is the canonical home — open Act on a node to access Ask source /
// Ask quote / Split branch / Flag / Qualifiers / Request deletion.
const OBSERVER_ACTIONS: RailAction[] = [
  { code: 'watch', label: 'Watch', helper: OBSERVER_COPY.watchHelp, category: 'watch_observe', tone: 'neutral' },
  { code: 'join_aff', label: OBSERVER_COPY.joinAffShort, helper: OBSERVER_COPY.joinHelp + ' Argue For.', category: 'join_side', tone: 'primary' },
  { code: 'join_neg', label: OBSERVER_COPY.joinNegShort, helper: OBSERVER_COPY.joinHelp + ' Argue Against.', category: 'join_side', tone: 'primary' },
  // UX-001.4: 'share' retained inline (NOT migrated to Act) because
  // sharing is an out-of-band action (browser/native), not a debate
  // move. Adding an Act roundtrip would add friction without
  // consolidation benefit.
  { code: 'share', label: 'Share', helper: OBSERVER_COPY.shareHelp, category: 'share', tone: 'neutral' },
];

const PARTICIPANT_OTHER_ACTIONS: RailAction[] = [
  // UX-001.4 — reply / disagree retained as preserve-as-shortcut. These
  // two are the highest-frequency actions in the entire app; the rail
  // continues to dispatch them directly to the composer (no Act
  // roundtrip), matching the existing behavior. The same composer mode
  // opens whether the user picks reply via the rail OR via Act → Respond.
  { code: 'reply', label: 'Reply', helper: OBSERVER_COPY.replyHelp, category: 'reply', tone: 'primary' },
  { code: 'disagree', label: 'Disagree', helper: OBSERVER_COPY.disagreeHelp, category: 'reply', tone: 'warning' },
];

// UX-001.4 — Self (own bubble) action set is empty after B.3 migration
// (qualifiers + request_deletion both migrated to Act). The rail's
// `participant_own` context now renders the collapsed "Open Act ▾"
// label (see ObserverActionDockLayout.buildCollapsedDockLabel). The
// empty array means the expanded dock shows no rows; the user opens
// Act to view qualifiers or request deletion.
const SELF_ACTIONS: RailAction[] = [];

export function getRailActions(viewerRole: RailViewerRole, bubbleActor: RailBubbleActor): RailAction[] {
  if (viewerRole === 'observer') return OBSERVER_ACTIONS;
  if (bubbleActor === 'self') return SELF_ACTIONS;
  return PARTICIPANT_OTHER_ACTIONS;
}

/**
 * Map a rail action code to the existing `ArgumentBubbleControl` enum
 * the game surface dispatches. Some codes are rail-only (no equivalent
 * in the bubble enum) — those return `null` and the parent handler will
 * route them locally (join, share, open_timeline).
 */
export function railActionToBubbleControl(code: RailActionCode): ArgumentBubbleControl | null {
  switch (code) {
    case 'reply': return 'reply';
    case 'disagree': return 'disagree';
    case 'ask_source': return 'ask_for_source';
    case 'ask_quote': return 'ask_for_quote';
    case 'split_branch': return 'branch';
    case 'flag': return 'flag';
    case 'qualifiers': return 'view_qualifiers';
    case 'request_deletion': return 'request_deletion';
    default: return null;
  }
}

interface Props {
  // ── unchanged Stage 6.4 props ──
  viewerRole: RailViewerRole;
  bubbleActor: RailBubbleActor;
  /** Side the user is currently on, if participant. Used to hide redundant Join chips. */
  participantSide?: ParticipantSide | null;
  /** Initial collapsed state — defaults to collapsed for observer, expanded for participant. */
  defaultCollapsed?: boolean;
  /** Active message id for accessibility prefixes. */
  activeMessageId?: string | null;
  /** Called when the user picks an action. The caller routes to join / composer / share / etc. */
  onAction: (code: RailActionCode, ctx: { activeMessageId: string | null; bubbleActor: RailBubbleActor; viewerRole: RailViewerRole }) => void;

  // ── SC-005 new props (all optional → backward compatible) ──
  /** Viewport width. Defaults to a useWindowDimensions() read when omitted. */
  windowWidth?: number;
  /** Viewport height. Drives the narrow-sheet height cap. Defaults to a
   *  useWindowDimensions() read when omitted. */
  windowHeight?: number;
  /** Effective reduce-motion. Wins over the component's own OS read. */
  reduceMotionOverride?: boolean;
  /** Whether a timeline node is currently selected — drives the collapsed
   *  primary label ("Watch" vs "Actions on this point"). Defaults false. */
  hasSelectedNode?: boolean;
  /** True when the SC-002 popover OR SC-004 dock is open. When true the
   *  dock force-collapses and renders no expanded surface (mutual
   *  exclusion). Defaults false. */
  isAnyPanelOpen?: boolean;
  /** Notifies the parent when the dock expands/collapses, so the parent
   *  can close the SC-002 popover (the other half of mutual exclusion). */
  onExpandedChange?: (expanded: boolean) => void;
  /** Optional "Start an argument" CTA folded in from App.tsx's old
   *  actionBar. When provided, renders as a primary chip in the dock.
   *  When omitted, no CTA renders. */
  startArgumentAction?: { label: string; onPress: () => void } | null;

  // ── ARG-ROOM-005 new props (all optional → backward compatible) ──
  /** Whether the viewer can claim an active seat right now. `false` => the
   *  room's active seats are full (or a reserved invite holds the last seat),
   *  so the join_aff / join_neg chips render DISABLED and the full-room nudge
   *  shows; `watch` stays enabled. `undefined` / `true` => chips enabled
   *  (the pre-ARG-ROOM-005 behavior). */
  canClaimActiveSeat?: boolean;
  /** Verdict-free full-room nudge ("This argument is full. You can still
   *  watch."), surfaced under the dock when `canClaimActiveSeat === false`. */
  fullRoomNotice?: string | null;
}

/** Slide travel distance (logical px) for the narrow-sheet open animation. */
const SHEET_SLIDE_TRAVEL = 48;

export function ArgumentSideActionRail({
  viewerRole,
  bubbleActor,
  participantSide,
  defaultCollapsed,
  activeMessageId,
  onAction,
  windowWidth,
  windowHeight,
  reduceMotionOverride,
  hasSelectedNode,
  isAnyPanelOpen,
  onExpandedChange,
  startArgumentAction,
  canClaimActiveSeat,
  fullRoomNotice,
}: Props) {
  // SC-005 keeps the Stage 6.4 collapse contract verbatim — `collapsed`
  // state seeded from `defaultCollapsed ?? (viewerRole === 'observer')`.
  // The SC-005 dock semantics treat `expanded = !collapsed`.
  const initialCollapsed = defaultCollapsed ?? (viewerRole === 'observer');
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // The currently long-pressed action's helper, surfaced as a transient
  // line under the dock. Cleared on the next interaction.
  const [helperHint, setHelperHint] = useState<string | null>(null);

  // ── viewport ──
  const dims = useWindowDimensions();
  const effectiveWidth = typeof windowWidth === 'number' ? windowWidth : dims.width;
  const effectiveHeight = typeof windowHeight === 'number' ? windowHeight : dims.height;
  const variant = resolveObserverDockVariant(effectiveWidth);
  const sheetMaxHeight = resolveSheetMaxHeightPx(effectiveHeight);

  // ── reduce-motion read (mirrors ArgumentComposerDock) ──
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
      // API unavailable — keep the default.
    }
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        if (!cancelled) setPrefersReducedMotion(enabled === true);
      });
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

  // The threaded effective reduce-motion value WINS over the OS read.
  const effectiveReducedMotion =
    typeof reduceMotionOverride === 'boolean' ? reduceMotionOverride : prefersReducedMotion;

  // ── mutual exclusion with the SC-002 popover / SC-004 dock ──
  // When another panel is open the dock is force-collapsed in a DERIVED
  // render guard (not a destructive state write that fights the parent).
  const expanded = !collapsed && !isAnyPanelOpen;

  // Notify the parent of expand/collapse transitions so it can close the
  // SC-002 popover (the other half of mutual exclusion).
  const onExpandedChangeRef = useRef(onExpandedChange);
  onExpandedChangeRef.current = onExpandedChange;
  const setExpanded = useCallback((next: boolean) => {
    setCollapsed(!next);
    setHelperHint(null);
    onExpandedChangeRef.current?.(next);
  }, []);

  // ── narrow-sheet slide animation (disabled under reduce-motion) ──
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    if (effectiveReducedMotion || variant === 'side') {
      // Snap — no slide. The wide side dock is anchored, never a sheet.
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

  // ── web Escape key — collapse the expanded dock ──
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded, setExpanded]);

  const actions = useMemo(
    () =>
      getRailActions(viewerRole, bubbleActor).filter((a) => {
        // If the participant is already on this side, hide the redundant join chip.
        if (a.code === 'join_aff' && participantSide === 'affirmative') return false;
        if (a.code === 'join_neg' && participantSide === 'negative') return false;
        return true;
      }),
    [viewerRole, bubbleActor, participantSide],
  );

  const dockContext = deriveDockContext(viewerRole, bubbleActor, Boolean(hasSelectedNode));
  const collapsedLabel = buildCollapsedDockLabel(dockContext);
  const expandedViewModel = useMemo(
    () => buildExpandedDockViewModel(actions, viewerRole, bubbleActor),
    [actions, viewerRole, bubbleActor],
  );

  const handleActionPress = useCallback(
    (code: RailActionCode) => {
      // ARG-ROOM-005 — a full room blocks the active-seat claim. Watch / Share /
      // Reply are unaffected; the Join chips are also visually + a11y disabled.
      // This guard makes the no-dispatch deterministic regardless of platform.
      if ((code === 'join_aff' || code === 'join_neg') && canClaimActiveSeat === false) {
        return;
      }
      setHelperHint(null);
      onAction(code, { activeMessageId: activeMessageId ?? null, bubbleActor, viewerRole });
    },
    [onAction, activeMessageId, bubbleActor, viewerRole, canClaimActiveSeat],
  );

  // ── collapsed render ──
  if (!expanded) {
    return (
      <View
        style={[styles.collapsedWrap, variant === 'side' && styles.collapsedWrapSide]}
        testID="argument-side-action-rail"
      >
        <Pressable
          style={styles.collapsedChip}
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={collapsedLabel.accessibilityLabel}
          accessibilityHint={collapsedLabel.accessibilityHint}
          accessibilityState={{ expanded: false }}
          testID="rail-toggle-expand"
        >
          <Text style={styles.collapsedChipText} numberOfLines={1}>
            {collapsedLabel.primary} ▾
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
      <View style={styles.expandedHeader}>
        <Text style={styles.expandedTitle} accessibilityRole="header">
          {expandedViewModel.title}
        </Text>
        <Pressable
          onPress={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel="Collapse actions"
          accessibilityState={{ expanded: true }}
          testID="rail-toggle-collapse"
          style={styles.collapseControl}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.expandedCollapse}>Collapse ▴</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.sectionScroll}
        contentContainerStyle={styles.sectionScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {startArgumentAction ? (
          <Pressable
            style={[styles.actionChip, styles.actionChipPrimary, styles.startChip]}
            onPress={() => {
              setHelperHint(null);
              startArgumentAction.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={startArgumentAction.label}
            testID="rail-action-start-argument"
          >
            <Text style={styles.actionLabel}>{startArgumentAction.label}</Text>
          </Pressable>
        ) : null}
        {expandedViewModel.sections.map((section) => (
          <View key={`rail-section-${section.category}`} style={styles.section}>
            {expandedViewModel.showCategoryHeaders ? (
              <Text
                style={styles.sectionHeader}
                accessibilityRole="header"
                testID={`rail-section-header-${section.category}`}
              >
                {section.headerLabel}
              </Text>
            ) : null}
            <View style={styles.sectionChips}>
              {section.actions.map((a) => {
                // ARG-ROOM-005 — when the room's active seats are full, the
                // Join For / Join Against chips render DISABLED (hitSlop +
                // 44×44 preserved); Watch / Share / Reply stay enabled. The
                // chip is disabled ONLY when canClaimActiveSeat is explicitly
                // false (undefined => back-compat, chips enabled).
                const isJoinChip = a.code === 'join_aff' || a.code === 'join_neg';
                const isClaimBlocked = isJoinChip && canClaimActiveSeat === false;
                return (
                  <Pressable
                    key={`rail-${a.code}`}
                    style={[
                      styles.actionChip,
                      a.tone === 'primary' && styles.actionChipPrimary,
                      a.tone === 'warning' && styles.actionChipWarning,
                      a.tone === 'critical' && styles.actionChipCritical,
                      isClaimBlocked && styles.actionChipDisabled,
                    ]}
                    onPress={() => handleActionPress(a.code)}
                    onLongPress={() => setHelperHint(a.helper)}
                    disabled={isClaimBlocked}
                    accessibilityRole="button"
                    accessibilityLabel={a.label}
                    accessibilityHint={a.helper}
                    accessibilityState={{ expanded: true, disabled: isClaimBlocked }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID={`rail-action-${a.code}`}
                  >
                    <Text
                      style={[styles.actionLabel, isClaimBlocked && styles.actionLabelDisabled]}
                      numberOfLines={1}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      {/* ARG-ROOM-005 — full-room observe nudge. Verdict-free; announced
          politely so screen-reader users learn the room is full without
          per-render chatter. */}
      {canClaimActiveSeat === false && fullRoomNotice ? (
        <Text
          style={styles.fullRoomNotice}
          testID="rail-full-room-notice"
          accessibilityLiveRegion="polite"
        >
          {fullRoomNotice}
        </Text>
      ) : null}
      {helperHint ? (
        <Text style={styles.helperHint} testID="rail-helper-hint">
          {helperHint}
        </Text>
      ) : null}
    </>
  );

  if (variant === 'side') {
    return (
      <View
        style={[styles.expandedRoot, styles.expandedRootSide]}
        testID="argument-side-action-rail"
      >
        {body}
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.expandedRoot,
        styles.expandedRootSheet,
        { maxHeight: sheetMaxHeight },
        sheetAnimatedStyle,
      ]}
      testID="argument-side-action-rail"
    >
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ── collapsed chip ──
  collapsedWrap: {
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Wide viewports: anchor the chip to the bottom-right rather than a
  // full-width row, so it sits beside the board.
  collapsedWrapSide: { justifyContent: 'flex-end' },
  collapsedChip: {
    backgroundColor: '#312e81',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedChipText: { color: '#fff', fontWeight: '800' as const, fontSize: 13 },

  // ── expanded dock ──
  expandedRoot: {
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  // Narrow: bottom sheet — rounded top, the maxHeight cap is injected
  // inline from resolveSheetMaxHeightPx (~28% of the viewport).
  expandedRootSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  // Wide: anchored panel beside the board, comfortably narrower than the
  // full width so it does not crowd the timeline.
  expandedRootSide: {
    alignSelf: 'flex-end',
    width: 360,
    maxWidth: '100%',
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  expandedTitle: {
    color: '#a5b4fc',
    fontWeight: '800' as const,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  collapseControl: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  expandedCollapse: { color: '#94a3b8', fontSize: 11, fontWeight: '700' as const },

  sectionScroll: { flexGrow: 0 },
  sectionScrollContent: { paddingBottom: 2 },
  section: { marginBottom: 8 },
  sectionHeader: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // Short-label-only action chips. Helper text lives in accessibilityHint
  // + the transient long-press hint line — never a second visible line.
  actionChip: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipPrimary: { backgroundColor: '#312e81' },
  actionChipWarning: { backgroundColor: '#9a3412' },
  actionChipCritical: { backgroundColor: '#7f1d1d' },
  startChip: { alignSelf: 'stretch', marginBottom: 8 },
  actionLabel: { color: '#f8fafc', fontWeight: '800' as const, fontSize: 13 },

  // ARG-ROOM-005 — disabled Join chip when the room is full. The label is
  // dimmed AND the chip carries accessibilityState.disabled, so the "can't
  // claim" signal is not color-only (a screen reader hears it too).
  actionChipDisabled: { backgroundColor: '#111827', opacity: 0.5 },
  actionLabelDisabled: { color: '#94a3b8' },

  fullRoomNotice: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 2,
  },

  helperHint: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
    paddingHorizontal: 2,
  },
});
