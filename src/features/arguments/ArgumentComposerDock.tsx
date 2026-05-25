/**
 * COMPOSER-002 / QOL-030 — In-room composer dock hosting the one-box.
 *
 * The dock renders the QOL-030 `OneBox` (the single switchable composer)
 * as an in-room dock instead of a full-page "Your Move" screen. The
 * argument room stays mounted behind the dock, so `viewMode`, the active
 * node, the entry-hint micro-moment, and scroll position all survive a
 * compose-cancel round trip.
 *
 * QOL-030 refactor — the dock now hosts `OneBox`, NOT `ArgumentComposer`
 * directly. The OneBox owns the box-type header + the Act popout (the
 * flash menu, the engine+role-gated decision surface). The RULE-005
 * `ChannelChipRow` / `ChannelHelperFields` chip-row chrome is removed:
 * per the one-box supersession map the chip-row UI folds into the Act
 * popout (the channel *model* survives, untouched). The post path is
 * unchanged — `OneBox` hosts the same `ArgumentComposer` → `submit-argument`
 * flow, so no migration, no Edge Function change, no service-role.
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
 * variant, slide animation, reduce-motion read) and the RULE-004
 * pre-send review state. The composer's draft, validation, preset
 * application, and `submit-argument` path are all unchanged.
 *
 * Out of scope (per the COMPOSER-002 design): a dark re-skin of the
 * composer (deferred to BRAND-002); moving the `Post move` button into
 * the dock footer; an inline-near-node wide composer.
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
import type { MoveDraftPatch } from './conversationMoves';
import type { ArgumentRow } from './types';
import type { Debate } from '../debates/types';
import { OneBox } from './oneBox/OneBox';
import { useConstitution } from './useConstitution';
import { useAppSession } from '../session/useAppSession';
import { sessionToDraft } from './composerState';
import { buildEvaluationInput } from './composerValidation';
import { evaluateArgumentDraft } from '../../domain/constitution';
import { quickActionToPreset } from './quickActionPresets';
import { PreSendReviewSheet } from './PreSendReviewSheet';
import {
  buildPreSendReview,
  transformationToQuickAction,
  DEFAULT_PRESEND_ROOM_CONTEXT,
  type AdvisoryTransformation,
  type PreSendReview,
} from './preSendReviewModel';
import {
  PacingChip,
  buildPacingChipViewModel,
  getDevPacingOverride,
  DEFAULT_CASUAL_PACING_RULE,
} from '../modes';
import type { PacingRule, PacingMoveRecord } from '../modes';
import { SURFACE_TOKENS } from '../../lib/designTokens';
// UX-001.3 — composer keyboard shortcut routing. The dock owns the
// document-level keydown listener; the pure model decides what to do
// based on the event + the focus context.
import { resolveComposerKeyEffect } from './composer/composerKeyboardModel';
import { useComposerFocusContext } from './composer/useComposerFocusContext';
import { triggerHaptic } from './composer/composerHaptics';

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
  /**
   * UX-001.3 — read-only `activeMessageId` from `ArgumentGameSurface`.
   * Threaded straight through to `OneBox` so its
   * `ComposerContextStrip` can render a divergence cue when the
   * Timeline's selected node differs from the composer's bound parent.
   * Additive optional; omitted = no divergence cue surface.
   */
  activeMessageId?: string | null;
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
  activeMessageId,
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

  // ── UX-001.3 — web keyboard shortcut routing ──
  // The dock owns a single document-level keydown listener that
  // consults `resolveComposerKeyEffect` (focus-context gated) and
  // dispatches to:
  //  - submit          → increment postSignal (composer posts via the
  //                       existing RULE-004 one-shot bypass mechanism)
  //  - open_mode_switcher → increment openModeSwitcherSignal (OneBox
  //                          opens its ActPopout)
  //  - close           → Esc collapses → dismisses (operator-accepted
  //                       UX-001.3 behavior shift; the dock owns this
  //                       semantics: v1 calls onClose because the
  //                       collapsed strip lives in the underlying
  //                       ArgumentGameSurface, so dismissing the dock
  //                       returns the user to the collapsed strip)
  //
  // Focus-context: the `useComposerFocusContext` hook tracks whether
  // `document.activeElement` is inside the registered composer
  // container. When the user is focused on the Timeline (or anywhere
  // outside the dock), the pure model returns `'none'` and the
  // Timeline's existing arrow-key handler runs uncontested.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { composerFocused, registerContainer } = useComposerFocusContext(visible);
  const [openModeSwitcherSignal, setOpenModeSwitcherSignal] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const effect = resolveComposerKeyEffect({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        composerFocused,
      });
      switch (effect.type) {
        case 'submit':
          event.preventDefault();
          triggerHaptic('success');
          setPostSignal((n) => n + 1);
          return;
        case 'open_mode_switcher':
          event.preventDefault();
          triggerHaptic('light');
          setOpenModeSwitcherSignal((n) => n + 1);
          return;
        case 'close':
          event.preventDefault();
          // Esc collapses the dock to the persistent strip. The
          // strip lives in ArgumentGameSurface and stays visible; a
          // second Esc press on a re-opened dock dismisses again.
          onCloseRef.current();
          return;
        case 'none':
        default:
          return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, composerFocused]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // ── QOL-030 — one-box composer ──
  // The RULE-005 channel chip-row chrome is removed: per the one-box
  // supersession map the chip-row UI folds into the Act popout (the
  // `OneBox`'s flash menu). The `OneBox` owns box-type selection; the
  // dock keeps only the Constitution data (the Act popout's engine gate)
  // and the RULE-004 transformation patch.
  const constitution = useConstitution();
  // RULE-004 — the transformation patch from a pre-send advisory's
  // "Narrow / Branch / Add a source" action. Threaded into the OneBox as
  // its `initialPatch` so the prefilled change applies when the sheet
  // closes.
  const [transformationPatch, setTransformationPatch] =
    useState<MoveDraftPatch | null>(null);

  // Merge the RULE-004 transformation patch onto the caller's
  // `initialPatch`. The OneBox forwards this to the composer, which
  // applies an `initialPatch` only when its reference changes — so this
  // memo produces a new object exactly when the transformation changes.
  const oneBoxInitialPatch = useMemo<MoveDraftPatch | null>(() => {
    if (transformationPatch === null) return initialPatch ?? null;
    return { ...(initialPatch ?? {}), ...transformationPatch };
  }, [initialPatch, transformationPatch]);

  // ── RULE-004 pause-before-send review ──
  // The dock owns the review state. On the Post intent the composer
  // calls `handleBeforeSubmit`; the dock builds the `PreSendReview` from
  // the active draft (read from session — the composer writes it there)
  // plus the already-computed Constitution evaluation. When the review
  // is non-empty the sheet shows and the composer's submit is suppressed.
  // RULE-004 adds no block — `evaluateArgumentDraft` stays the single
  // source of truth for what can block a post.
  const { state: appSession } = useAppSession();
  const activeDraftSession = appSession.snapshot.activeDraft;
  const [presendReview, setPresendReview] = useState<PreSendReview | null>(null);
  const [presendVisible, setPresendVisible] = useState(false);
  // One-shot "Post anyway" counter — incremented to trigger the
  // composer's real submit once, bypassing the review (design OD-3).
  const [postSignal, setPostSignal] = useState(0);
  // First contentful post attempt in this dock session — drives the
  // `permanent_record_warning` advisory. Resets when the dock re-opens.
  const isFirstPostRef = useRef(true);

  // Reset the review whenever the dock re-opens or the reply target
  // changes — a new compose session starts with a fresh review state.
  useEffect(() => {
    if (!visible) return;
    setPresendReview(null);
    setPresendVisible(false);
    setTransformationPatch(null);
    isFirstPostRef.current = true;
  }, [visible, selectedParentId]);

  /**
   * RULE-004 — the Post-intent gate threaded into <ArgumentComposer>.
   * Returns `true` to let the composer post straight through (no
   * friction — clean move), `false` to suppress its submit because the
   * dock is showing the pre-send review sheet.
   */
  const handleBeforeSubmit = useCallback((): boolean => {
    if (
      !activeDraftSession ||
      activeDraftSession.debateId !== debate.id
    ) {
      // No draft to review — let the composer's own guards handle it.
      return true;
    }
    const draft = sessionToDraft(activeDraftSession);
    const evaluationInput = buildEvaluationInput(draft, debate, parentArgument, {
      activeConstitution: constitution.activeConstitution,
      activeRules: constitution.activeRules,
      tagDefinitions: constitution.tagDefinitions,
      flagDefinitions: constitution.flagDefinitions,
    });
    const evaluation = evaluationInput
      ? evaluateArgumentDraft(evaluationInput)
      : null;
    const review = buildPreSendReview({
      draft,
      mode: 'casual',
      parent: parentArgument,
      room: DEFAULT_PRESEND_ROOM_CONTEXT,
      lifecycle: {
        parentSnapshot: null,
        parentClusterSummary: null,
        parentLinkage: null,
      },
      evaluation,
      // QOL-030 — the OneBox's Act popout is engine-gated, so it cannot
      // pick a type the parent forbids; there is no channel-vs-type
      // mismatch to surface. `null` keeps the `channel_mismatch` advisory
      // inert (it never fires) — RULE-004's other advisories are
      // unaffected.
      channelSuggestion: null,
      isFirstPostInSession: isFirstPostRef.current,
    });
    isFirstPostRef.current = false;
    if (!review.shouldShowSheet) {
      // Clean ordinary reply — zero friction; the composer posts.
      return true;
    }
    setPresendReview(review);
    setPresendVisible(true);
    return false;
  }, [
    activeDraftSession,
    debate,
    parentArgument,
    constitution.activeConstitution,
    constitution.activeRules,
    constitution.tagDefinitions,
    constitution.flagDefinitions,
  ]);

  /** RULE-004 — "Post anyway": close the sheet, trigger the real submit. */
  const handlePresendPostAnyway = useCallback(() => {
    setPresendVisible(false);
    setPresendReview(null);
    setPostSignal((n) => n + 1);
  }, []);

  /** RULE-004 — "Back to editing": close the sheet, keep the draft. */
  const handlePresendBackToEditing = useCallback(() => {
    setPresendVisible(false);
    setPresendReview(null);
  }, []);

  /** RULE-004 — "Save draft": close the whole dock; the draft persists
   *  via the composer's existing session-backed draft storage. */
  const handlePresendSaveDraft = useCallback(() => {
    setPresendVisible(false);
    setPresendReview(null);
    onClose();
  }, [onClose]);

  /**
   * RULE-004 — apply a transformation preset and return to the composer
   * so the user sees the prefilled change. Routes through the existing
   * `quickActionToPreset` machinery; `save_draft` / `post_anyway` are
   * sheet actions and never reach this handler (they map to `null`).
   */
  const handlePresendTransformation = useCallback(
    (t: AdvisoryTransformation) => {
      const quickAction = transformationToQuickAction(t);
      if (!quickAction) return;
      const patch = quickActionToPreset(
        quickAction,
        parentArgument?.argumentType ?? null,
      );
      setPresendVisible(false);
      setPresendReview(null);
      if (!patch) return;
      setTransformationPatch(patch);
    },
    [parentArgument],
  );

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

          {/* QOL-030 — the one-box composer. The OneBox owns the
              box-type header + the Act popout (the flash menu — the
              engine+role-gated decision surface that replaces the
              RULE-005 chip row). It hosts the same `ArgumentComposer` →
              `submit-argument` post path. RULE-004 threads the
              pause-before-send gate (`onBeforeSubmit`) and the one-shot
              "Post anyway" trigger (`postSignal`) straight through. */}
          <View
            style={styles.composerBody}
            // UX-001.3 — register this container with the focus
            // context hook so the composer's keyboard shortcuts only
            // fire when focus is inside this subtree. On native, the
            // ref-callback is a no-op (the hook short-circuits).
            ref={(el) => registerContainer(el as unknown as HTMLElement | null)}
          >
            <OneBox
              debate={debate}
              selectedParentId={selectedParentId}
              parentArgument={parentArgument}
              onClearParent={onClearParent}
              onSubmitSuccess={onSubmitSuccess}
              onClose={onClose}
              initialPatch={oneBoxInitialPatch}
              rules={constitution.activeRules}
              reduceMotionOverride={effectiveReducedMotion}
              onBeforeSubmit={handleBeforeSubmit}
              postSignal={postSignal}
              activeMessageId={activeMessageId ?? null}
              openModeSwitcherSignal={openModeSwitcherSignal}
            />

            {/* RULE-004 — pause-before-send review sheet. A nested overlay
                ABOVE the box body (not a second RN <Modal>), so the
                composer stays mounted behind it and the draft is never
                lost. Advisory only — it never blocks a post. */}
            {presendReview ? (
              <PreSendReviewSheet
                visible={presendVisible}
                review={presendReview}
                mode="casual"
                reduceMotionOverride={effectiveReducedMotion}
                onApplyTransformation={handlePresendTransformation}
                onPostAnyway={handlePresendPostAnyway}
                onSaveDraft={handlePresendSaveDraft}
                onBackToEditing={handlePresendBackToEditing}
              />
            ) : null}
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
    backgroundColor: SURFACE_TOKENS.base,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    overflow: 'hidden',
    // Clean shadow so the dock panel reads as an intentional surface
    // over the room, not a glitch (COMPOSER-002 risk note).
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
    backgroundColor: SURFACE_TOKENS.base,
    borderLeftWidth: 1,
    borderLeftColor: SURFACE_TOKENS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  handleStrip: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: SURFACE_TOKENS.inputBorder,
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
    color: SURFACE_TOKENS.textPrimary,
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
    color: SURFACE_TOKENS.textSecondary,
  },
  composerBody: {
    flex: 1,
  },
});
