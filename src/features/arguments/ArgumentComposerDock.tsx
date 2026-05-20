/**
 * COMPOSER-002 — In-room composer dock.
 *
 * Renders the existing `ArgumentComposer` as an in-room dock instead of
 * a full-page "Your Move" screen. The argument room stays mounted behind
 * the dock, so `viewMode`, the active node, the entry-hint micro-moment,
 * and scroll position all survive a compose-cancel round trip.
 *
 * Layout:
 *  - narrow viewports (width < 720)  → bottom sheet, ~88% height, rounded
 *    top, drag handle.
 *  - wide viewports (width >= 720)   → fixed right-side panel, full room
 *    height, left-edge border, header strip (no drag handle).
 *  - width <= 0 (web static-export hydration first paint) → 'side', so the
 *    first paint is the polished layout. Mirrors `resolveHeaderBreakpoint`.
 *
 * Close paths (no route change — TL-003 invariant extended here):
 *  - native hardware-back → core RN `<Modal onRequestClose>` → onClose.
 *  - web Escape key       → `keydown` listener (scoped to `visible`) → onClose.
 *  Both call the single `onClose` handler. No router, no Linking, no
 *  history entry. RN `<Modal>` is an overlay, not a navigation route.
 *
 * The dock is presentational. It owns only local UI state (layout
 * variant, slide animation, reduce-motion read). The composer's draft,
 * validation, preset application, and `submit-argument` path are all
 * unchanged and owned by `ArgumentComposer`.
 *
 * Out of scope (per the COMPOSER-002 design): a dark re-skin of
 * `ArgumentComposer` (deferred to BRAND-002); moving the `Post move`
 * button into the dock footer; an inline-near-node wide composer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ArgumentComposer } from './ArgumentComposer';
import type { MoveDraftPatch } from './conversationMoves';
import type { ArgumentRow } from './types';
import type { Debate } from '../debates/types';
import {
  PacingChip,
  buildPacingChipViewModel,
  getDevPacingOverride,
  DEFAULT_CASUAL_PACING_RULE,
} from '../modes';
import type { PacingRule, PacingMoveRecord } from '../modes';

/** Width (logical px) at or above which the dock is a right-side panel. */
export const DOCK_SIDE_BREAKPOINT = 720;

export type DockLayoutVariant = 'sheet' | 'side';

/**
 * Pure breakpoint resolver — exported so the layout rule is unit-testable
 * without a render harness.
 *
 *  - width <= 0  → 'side' (web static-export hydration first paint; the
 *    polished layout is the safer first paint, mirroring
 *    `resolveHeaderBreakpoint`'s non-positive = wide rule).
 *  - 0 < width < 720 → 'sheet' (bottom sheet on narrow viewports).
 *  - width >= 720 → 'side' (right-side panel on wide viewports).
 */
export function resolveDockLayoutVariant(windowWidth: number): DockLayoutVariant {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) return 'side';
  return windowWidth < DOCK_SIDE_BREAKPOINT ? 'sheet' : 'side';
}

interface ArgumentComposerDockProps {
  /** Drives mount + slide-in. When false the dock is not rendered. */
  visible: boolean;
  /** Same objects App.tsx already passes to <ArgumentComposer>. */
  debate: Debate;
  selectedParentId: string | null;
  parentArgument: ArgumentRow | null;
  initialPatch?: MoveDraftPatch | null;
  /** Clears the reply target (the composer's "Clear" affordance). */
  onClearParent: () => void;
  /** Close without posting. App.tsx -> handleComposerClose. */
  onClose: () => void;
  /** Post succeeded. App.tsx -> handleSubmitSuccess (refreshes the room). */
  onSubmitSuccess: () => void;
  /**
   * PR-001 — effective reduce-motion (OS value composed with the user's
   * preference). When omitted the dock reads AccessibilityInfo itself.
   */
  reduceMotionOverride?: boolean;
  /**
   * GAME-002 — mode-level turn pacing rule. Defaults to the casual
   * no-pacing baseline; the chip is then a no-op render. GAME-003 mode
   * templates supply a non-casual rule.
   */
  pacingRule?: PacingRule;
  /**
   * GAME-002 — this participant's recent moves, used for the pacing chip's
   * cap + cooldown math. Derived in-memory; defaults to none.
   */
  pacingRecentMoves?: readonly PacingMoveRecord[];
}

/** Slide travel distance (logical px) for the open animation. */
const SLIDE_TRAVEL = 64;

/** Stable empty default for `pacingRecentMoves` (avoids new-array churn). */
const EMPTY_PACING_MOVES: readonly PacingMoveRecord[] = Object.freeze([]);

export function ArgumentComposerDock({
  visible,
  debate,
  selectedParentId,
  parentArgument,
  initialPatch,
  onClearParent,
  onClose,
  onSubmitSuccess,
  reduceMotionOverride,
  pacingRule,
  pacingRecentMoves,
}: ArgumentComposerDockProps) {
  const { width } = useWindowDimensions();
  const variant = resolveDockLayoutVariant(width);

  // ── reduce-motion read (mirrors TimelineNodePopover / ArgumentTimelineMap) ──
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

  // PR-001 — the threaded effective reduce-motion value WINS over the
  // component's own OS read. Omitting the prop keeps the OS read.
  const effectiveReducedMotion =
    typeof reduceMotionOverride === 'boolean' ? reduceMotionOverride : prefersReducedMotion;

  // ── slide / fade animation ──
  // `progress` 0 = closed, 1 = open. When reduce-motion is on we drive
  // opacity only (no translate); otherwise translate + opacity.
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (effectiveReducedMotion) {
      // Snap (fade handled by the static 0/1 value, no spring/timing curve).
      progress.setValue(visible ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, effectiveReducedMotion, progress]);

  // ── GAME-002 pacing chip ──
  // The pacing rule + this participant's recent moves drive a status chip
  // in the dock header. Casual default → the chip renders nothing and no
  // interval is mounted. A DEV-only override can force a rule for manual
  // testing; it is never surfaced in any UI.
  let effectivePacingRule: PacingRule = pacingRule ?? DEFAULT_CASUAL_PACING_RULE;
  if (__DEV__) {
    // getDevPacingOverride is itself __DEV__-guarded; this whole branch is
    // dead-code-eliminated from production bundles.
    const devOverride = getDevPacingOverride();
    if (devOverride) effectivePacingRule = devOverride;
  }
  const pacingMoves = pacingRecentMoves ?? EMPTY_PACING_MOVES;

  // `now` is read once per render and advanced by a 1s tick ONLY while the
  // dock is visible and the chip is in a countdown state.
  const [pacingNow, setPacingNow] = useState(() => Date.now());

  // Build the view model with the current `now`. Cheap pure call.
  const pacingViewModel = useMemo(
    () =>
      buildPacingChipViewModel({
        rule: effectivePacingRule,
        recentMoves: pacingMoves,
        now: pacingNow,
      }),
    [effectivePacingRule, pacingMoves, pacingNow],
  );

  // The interval is keyed on `visible` + whether a countdown is currently
  // active. When the countdown reaches zero, `countdownLabel` becomes null,
  // the effect re-runs, and the interval is cleared — no idle ticking.
  const pacingHasCountdown = pacingViewModel.countdownLabel !== null;
  useEffect(() => {
    if (!visible || !pacingHasCountdown) return;
    const id = setInterval(() => {
      setPacingNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [visible, pacingHasCountdown]);

  // ── web Escape close ──
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Reduce-motion: opacity fade only, no translate. Otherwise translate
  // from the appropriate edge plus opacity.
  const panelAnimatedStyle = useMemo(() => {
    const opacity = progress;
    if (effectiveReducedMotion) {
      return { opacity };
    }
    const translate = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [SLIDE_TRAVEL, 0],
    });
    if (variant === 'sheet') {
      return { opacity, transform: [{ translateY: translate }] };
    }
    return { opacity, transform: [{ translateX: translate }] };
  }, [progress, effectiveReducedMotion, variant]);

  if (!visible) return null;

  const panelStyle = variant === 'sheet' ? styles.sheetPanel : styles.sidePanel;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        style={variant === 'sheet' ? styles.sheetBackdrop : styles.sideBackdrop}
        testID="argument-composer-dock"
      >
        {/* Full-bleed scrim. On the sheet variant it shields background
            touches so a stray tap on the timeline cannot change the
            active node or lose a half-typed draft. The scrim is inert —
            tapping it does NOT close the dock (Cancel / Esc / back are
            the deliberate close paths). */}
        <Pressable
          style={styles.scrim}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          // Inert touch shield — no onPress so a stray tap is absorbed,
          // not converted into a destructive close.
          onPress={() => undefined}
        />

        <Animated.View
          style={[panelStyle, panelAnimatedStyle]}
          accessibilityViewIsModal
          accessibilityLabel="Compose your move"
          testID="argument-composer-dock-panel"
        >
          {/* Handle + header strip. The drag handle is a non-interactive
              bar (sheet variant only); Cancel is the close affordance.
              Both the handle (shape) and the Cancel label (text) are
              color-independent. */}
          <View style={styles.handleStrip}>
            {variant === 'sheet' ? (
              <View
                style={styles.dragHandle}
                accessibilityElementsHidden
                importantForAccessibility="no"
                testID="argument-composer-dock-handle"
              />
            ) : null}
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Compose your move</Text>
              {/* GAME-002 — pacing status chip. Renders null for the
                  casual default (no pacing). It is a status display, not
                  a button, and never disables the composer. */}
              <PacingChip
                viewModel={pacingViewModel}
                reduceMotionOverride={effectiveReducedMotion}
              />
              <Pressable
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel and close composer"
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                style={styles.cancelButton}
                testID="argument-composer-dock-cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>

          {/* The composer body. `mode="dock"` drops the legacy "Your
              Move" page header — the dock supplies the handle + Cancel.
              The composer keeps its own ScrollView + Post move button. */}
          <View style={styles.composerBody}>
            <ArgumentComposer
              mode="dock"
              debate={debate}
              selectedParentId={selectedParentId}
              parentArgument={parentArgument}
              onClearParent={onClearParent}
              onSubmitSuccess={onSubmitSuccess}
              onClose={onClose}
              initialPatch={initialPatch}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Sheet variant: dock docks to the bottom edge.
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.6)',
    justifyContent: 'flex-end',
  },
  // Side variant: dock docks to the right edge, full height.
  sideBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetPanel: {
    height: '88%',
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
    // Clean shadow so the light panel reads as an intentional surface
    // over the dark room, not a glitch (COMPOSER-002 risk note).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  sidePanel: {
    width: 420,
    maxWidth: '92%',
    height: '100%',
    backgroundColor: '#f9fafb',
    borderLeftWidth: 1,
    borderLeftColor: '#1f2937',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  handleStrip: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cancelButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  composerBody: {
    flex: 1,
  },
});
