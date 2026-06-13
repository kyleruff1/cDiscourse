/**
 * REF-006-RAIL — OpenIssuesRail.
 *
 * The room-wide Open Issues ledger surface: a collapsed-by-default chip
 * ("Open issues · N") that expands into a compact panel — side-anchored on
 * wide viewports, a capped bottom sheet (~28% of the viewport, never
 * full-screen) on narrow ones. It reuses the SC-005 contextual-dock chassis
 * layout helpers (`resolveObserverDockVariant` / `resolveSheetMaxHeightPx`)
 * and the shipped loop mechanics (jump / Inspect / Act move chips) — it adds
 * NO new routing and authors NO derivation.
 *
 * Pure presentational. No state beyond local UI (collapse + show-all), no
 * network, no AI, no persistence. It consumes a fully-derived `OpenIssuesLedger`
 * and routes its three verbs back through the host via `onJump` / `onInspect` /
 * `onMove`.
 *
 * Doctrine (cdiscourse-doctrine §1/§2/§3/§4/§9/§10a; REF-ADR-001; timeline-grammar):
 *   - Every label is a frozen REF-002 plain-language atom (built into the
 *     ledger entry) or an `OPEN_ISSUES_RAIL_COPY` chrome string. The renderer
 *     additionally suppresses anything that would trip `looksLikeInternalCode`.
 *   - The active row is distinguished by GEOMETRY (a left accent bar + bold
 *     text + a "Currently active" word), never by color alone — grayscale-legible.
 *   - The tone glyph is a non-color SHAPE, hidden from the screen-reader tree.
 *   - Reduce-motion safe: the narrow-sheet open animation snaps (no slide),
 *     mirroring `ArgumentSideActionRail`.
 *   - 44×44 targets on every interactive element (visual minHeight + hitSlop).
 *
 * RN primitives only — `View` / `Text` / `Pressable` / `ScrollView` /
 * `Animated`. No new dependency.
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
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import {
  BORDER_WIDTH,
  RADIUS,
  SPACING,
  SURFACE_TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../../../lib/designTokens';
import { looksLikeInternalCode } from '../gameCopy';
// Glyph-char map ONLY — the non-color tone glyph (a SHAPE). The
// `RefereeBannerView` COMPONENT is intentionally NOT imported (the rail never
// mounts a second banner element).
import { BANNER_TONE_GLYPH_CHAR } from '../../refereeBanners/RefereeBannerView';
import {
  resolveObserverDockVariant,
  resolveSheetMaxHeightPx,
} from '../ObserverActionDockLayout';
import type { MoveSuggestion } from '../../refereeLoop';
import {
  DEFAULT_MAX_ENTRIES,
  OPEN_ISSUES_RAIL_COPY,
  type OpenIssueLedgerEntry,
  type OpenIssuesLedger,
} from './openIssuesRailModel';

/** Rows shown before the in-panel "+N more" reveal. Shared with the model default. */
export const OPEN_ISSUES_RAIL_INITIAL_ROWS = DEFAULT_MAX_ENTRIES;

/** Slide travel (logical px) for the narrow-sheet open animation. */
const SHEET_SLIDE_TRAVEL = 48;

export interface OpenIssuesRailProps {
  ledger: OpenIssuesLedger;
  /** Viewport width. Defaults to a useWindowDimensions() read when omitted. */
  windowWidth?: number;
  /** Viewport height. Drives the narrow-sheet height cap. Defaults to a
   *  useWindowDimensions() read when omitted. */
  windowHeight?: number;
  /** Effective reduce-motion. Wins over the component's own OS read. */
  reduceMotionOverride?: boolean;
  /** Default true (observer-first). */
  defaultCollapsed?: boolean;
  /** Force-collapse when another bottom panel owns the space. */
  isAnyPanelOpen?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onJump: (entry: OpenIssueLedgerEntry) => void;
  onInspect: (entry: OpenIssueLedgerEntry) => void;
  onMove: (entry: OpenIssueLedgerEntry, move: MoveSuggestion) => void;
  testID?: string;
}

/** Suppress any rendered label that would read as a raw internal code. */
function displaySafe(s: string): string {
  return looksLikeInternalCode(s) ? '' : s;
}

export function OpenIssuesRail({
  ledger,
  windowWidth,
  windowHeight,
  reduceMotionOverride,
  defaultCollapsed,
  isAnyPanelOpen,
  onExpandedChange,
  onJump,
  onInspect,
  onMove,
  testID,
}: OpenIssuesRailProps): React.ReactElement | null {
  const rootTestID = testID ?? 'open-issues-rail';

  // ── viewport ──
  const dims = useWindowDimensions();
  const effectiveWidth = typeof windowWidth === 'number' ? windowWidth : dims.width;
  const effectiveHeight = typeof windowHeight === 'number' ? windowHeight : dims.height;
  const variant = resolveObserverDockVariant(effectiveWidth);
  const sheetMaxHeight = resolveSheetMaxHeightPx(effectiveHeight);

  // ── collapse state (observer-first → collapsed by default) ──
  const initialCollapsed = defaultCollapsed ?? true;
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Local "+N more" reveal — independent of the host's build cap.
  const [showAll, setShowAll] = useState(false);

  // ── reduce-motion read (mirrors ArgumentSideActionRail) ──
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

  const effectiveReducedMotion =
    typeof reduceMotionOverride === 'boolean' ? reduceMotionOverride : prefersReducedMotion;

  // ── mutual exclusion with the side action rail / node dock ──
  const expanded = !collapsed && !isAnyPanelOpen;

  const onExpandedChangeRef = useRef(onExpandedChange);
  onExpandedChangeRef.current = onExpandedChange;
  const setExpanded = useCallback((next: boolean) => {
    setCollapsed(!next);
    if (!next) setShowAll(false);
    onExpandedChangeRef.current?.(next);
  }, []);

  // ── narrow-sheet slide animation (snapped under reduce-motion / side) ──
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

  // ── web Escape — collapse the expanded panel ──
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

  const count = ledger.totalOpenCount;

  const visibleEntries = useMemo(
    () => (showAll ? ledger.entries : ledger.entries.slice(0, OPEN_ISSUES_RAIL_INITIAL_ROWS)),
    [showAll, ledger.entries],
  );
  // Rows held back locally + the host-omitted beyond-K remainder.
  const hiddenLocalRows = ledger.entries.length - visibleEntries.length;
  const moreCount = hiddenLocalRows + ledger.overflowCount;

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
          accessibilityLabel={`${OPEN_ISSUES_RAIL_COPY.collapsedLabel}. ${count} open.`}
          accessibilityHint="Opens the list of open issues in this room."
          accessibilityState={{ expanded: false }}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          testID="open-issues-rail-toggle"
        >
          <Text style={styles.collapsedChipText} numberOfLines={1}>
            {`${OPEN_ISSUES_RAIL_COPY.collapsedLabel} · ${count} ▾`}
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
        <Text style={styles.title} accessibilityRole="header" testID="open-issues-rail-title">
          {`${OPEN_ISSUES_RAIL_COPY.railTitle} · ${count}`}
        </Text>
        <Pressable
          onPress={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel="Collapse the open issues list"
          accessibilityState={{ expanded: true }}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          style={styles.collapseControl}
          testID="open-issues-rail-collapse"
        >
          <Text style={styles.collapseLabel}>{`${OPEN_ISSUES_RAIL_COPY.collapseLabel} ▴`}</Text>
        </Pressable>
      </View>

      {ledger.isEmpty ? (
        <View style={styles.emptyState} testID="open-issues-rail-empty">
          <Text style={styles.emptyPrimary}>{OPEN_ISSUES_RAIL_COPY.emptyPrimary}</Text>
          <Text style={styles.emptyHelper}>{OPEN_ISSUES_RAIL_COPY.emptyHelper}</Text>
        </View>
      ) : (
        <ScrollView
          style={[styles.scroll, { maxHeight: sheetMaxHeight }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="open-issues-rail-scroll"
        >
          {visibleEntries.map((entry) => (
            <OpenIssueRow
              key={entry.key}
              entry={entry}
              onJump={onJump}
              onInspect={onInspect}
              onMove={onMove}
            />
          ))}
          {!showAll && moreCount > 0 ? (
            <Pressable
              style={styles.overflowRow}
              onPress={() => setShowAll(true)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${moreCount} more open ${moreCount === 1 ? 'issue' : 'issues'}`}
              hitSlop={TOUCH_TARGET.hitSlopAll}
              testID="open-issues-rail-overflow"
            >
              <Text style={styles.overflowText}>{`+${moreCount} ${OPEN_ISSUES_RAIL_COPY.overflowWord}`}</Text>
            </Pressable>
          ) : null}
          {showAll && ledger.overflowCount > 0 ? (
            <Text style={styles.overflowNote} testID="open-issues-rail-overflow-note">
              {`+${ledger.overflowCount} ${OPEN_ISSUES_RAIL_COPY.overflowWord} — scroll the timeline to reach the oldest.`}
            </Text>
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

interface OpenIssueRowProps {
  entry: OpenIssueLedgerEntry;
  onJump: (entry: OpenIssueLedgerEntry) => void;
  onInspect: (entry: OpenIssueLedgerEntry) => void;
  onMove: (entry: OpenIssueLedgerEntry, move: MoveSuggestion) => void;
}

function OpenIssueRow({ entry, onJump, onInspect, onMove }: OpenIssueRowProps): React.ReactElement {
  const glyphChar = entry.toneGlyph != null ? BANNER_TONE_GLYPH_CHAR[entry.toneGlyph] : null;
  const stateLabel = displaySafe(entry.stateLabel);
  const openTaskLine = displaySafe(entry.openTaskLine);
  const proposition = displaySafe(entry.contestedProposition);

  return (
    <View
      style={[styles.row, entry.isActive && styles.rowActive]}
      testID={`open-issues-rail-rowwrap-${entry.key}`}
    >
      {/* Active geometry — a left accent bar (position/shape, not color alone). */}
      <View
        style={[styles.activeBar, entry.isActive ? styles.activeBarOn : styles.activeBarOff]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.rowMain}>
        {/* Whole content area = Jump. The Details + move chips are siblings
            (not nested) so their presses never also fire the jump. */}
        <Pressable
          style={styles.jumpZone}
          onPress={() => onJump(entry)}
          accessibilityRole="button"
          accessibilityLabel={`${entry.accessibilityLabel} ${OPEN_ISSUES_RAIL_COPY.jumpHint}`}
          accessibilityHint={OPEN_ISSUES_RAIL_COPY.jumpHint}
          accessibilityState={{ selected: entry.isActive }}
          hitSlop={TOUCH_TARGET.hitSlopCompact}
          testID={`open-issues-rail-row-${entry.key}`}
        >
          <View style={styles.stateRow}>
            {glyphChar != null ? (
              <Text
                style={styles.glyph}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                testID={`open-issues-rail-glyph-${entry.key}`}
              >
                {glyphChar}
              </Text>
            ) : null}
            {stateLabel.length > 0 ? (
              <Text style={[styles.stateLabel, entry.isActive && styles.stateLabelActive]} numberOfLines={1}>
                {stateLabel}
              </Text>
            ) : null}
            {entry.isActive ? (
              <Text style={styles.activeWord} testID={`open-issues-rail-active-${entry.key}`}>
                {OPEN_ISSUES_RAIL_COPY.activeSuffix}
              </Text>
            ) : null}
          </View>
          {openTaskLine.length > 0 ? (
            <Text style={styles.openTaskLine} numberOfLines={1}>
              {openTaskLine}
            </Text>
          ) : null}
          {proposition.length > 0 ? (
            <Text style={styles.proposition} numberOfLines={2}>
              {proposition}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.detailsButton}
            onPress={() => onInspect(entry)}
            accessibilityRole="button"
            accessibilityLabel={OPEN_ISSUES_RAIL_COPY.inspectHint}
            accessibilityHint={OPEN_ISSUES_RAIL_COPY.inspectHint}
            hitSlop={TOUCH_TARGET.hitSlopAll}
            testID={`open-issues-rail-details-${entry.key}`}
          >
            <Text style={styles.detailsLabel}>{OPEN_ISSUES_RAIL_COPY.inspectLabel}</Text>
          </Pressable>
          {entry.nextBestMoves.map((move) => (
            <Pressable
              key={`${entry.key}-${move.actEntryId}`}
              style={styles.moveButton}
              onPress={() => onMove(entry, move)}
              accessibilityRole="button"
              accessibilityLabel={move.accessibilityLabel}
              accessibilityState={{ disabled: false }}
              hitSlop={TOUCH_TARGET.hitSlopAll}
              testID={`open-issues-rail-move-${entry.key}-${move.actEntryId}`}
            >
              <Text style={styles.moveLabel} numberOfLines={1}>
                {move.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── collapsed chip ──
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

  // ── expanded panel ──
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

  // ── empty teaching state ──
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

  // ── rows ──
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
  rowActive: {
    borderColor: SURFACE_TOKENS.focusRing,
  },
  activeBar: {
    width: 4,
  },
  activeBarOn: { backgroundColor: SURFACE_TOKENS.focusRing },
  activeBarOff: { backgroundColor: 'transparent' },
  rowMain: {
    flex: 1,
    padding: SPACING.s,
    gap: SPACING.xs,
  },
  jumpZone: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    gap: 2,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  glyph: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    fontWeight: '700',
  },
  stateLabel: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    fontWeight: '700',
  },
  stateLabelActive: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  activeWord: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  openTaskLine: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 2,
  },
  proposition: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    lineHeight: TYPOGRAPHY.popoutBody.lineHeight,
  },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  detailsButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: 'transparent',
  },
  detailsLabel: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    fontWeight: '600',
  },
  moveButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.md,
    borderColor: SURFACE_TOKENS.focusRing,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  moveLabel: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutBody.fontSize,
    fontWeight: '700',
  },

  // ── overflow ──
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
  overflowNote: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: TYPOGRAPHY.badgeLabel.fontSize,
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.xs,
  },
});
