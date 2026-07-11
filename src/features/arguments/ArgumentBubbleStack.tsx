/**
 * Stage 6.1.8 — ArgumentBubbleStack
 *
 * Overlapping 3D-ish stack with the latest message on top. Active card sits
 * at the front; older cards fan out behind it with scale + translate +
 * rotate + opacity transforms. Never renders a vertical comment thread.
 *
 * CARD-VIEW-REFINE-001 — containment + swipe:
 *   - The stage is TOP-ANCHORED (`justifyContent: 'flex-start'`) so a tall
 *     active card (the always-visible CardDetailPanel) can only grow DOWN
 *     toward the controls, NEVER up into the masthead. The active card is
 *     still centered HORIZONTALLY.
 *   - The stage's measured height (`onLayout`) is threaded to the active
 *     card as `maxHeight`; the card clips its overflow + scrolls the detail
 *     within itself instead of bleeding off the page.
 *   - A horizontal PanResponder on the stage maps a settled swipe to
 *     Prev / Next (chronological), mutually exclusive with the card tap
 *     (tap = activate; horizontal pan = navigate). Vertical drags fall
 *     through to the card's own ScrollView.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArgumentBubbleCard } from './ArgumentBubbleCard';
import {
  getStackTransformForIndex,
  type ArgumentBubbleViewModel,
} from './argumentGameSurfaceModel';
import {
  resolveStackSwipeEffect,
  shouldClaimStackHorizontalPan,
} from './stackKeyboardSwipeModel';
import type { CardDetailViewModel } from './cardView/cardDetailModel';
import type { CardMappingSectionModel } from './cardView/cardMappingSectionModel';
import type { RailActionCode, RailViewerRole } from './railActionCategories';
import type { DisagreementContract, MoveSuggestion } from '../refereeLoop';
import type { RefereeNavVerb } from './cardView/RefereeCardView';
import type { PrioritizedPointFeedbackFlags } from '../feedbackFlags';
// QUOTE-FORGE-002 (#842) — the woven-callback echo strip on the active card.
// Rendered only when the active card is a callback move (quote_forge on);
// absent => byte-identical stack.
import { CallbackEchoStrip } from './crossRoom/CallbackEchoStrip';
import type { CallbackEchoViewModel } from './crossRoom/callbackEchoModel';

interface Props {
  viewModels: ArgumentBubbleViewModel[];
  activeMessageId: string | null;
  onActivate: (messageId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleMode?: () => void;
  /**
   * CARD-VIEW-DATA-001 — pre-built exploded-detail model for the active
   * card. The Stack computes nothing; it forwards this to the active card
   * only. Memoization stays at the surface keyed on activeMessageId.
   */
  activeCardDetail?: CardDetailViewModel | null;
  /**
   * MCP-MAPPING-EXPANSION-001 (Slice B) — combination-observations section
   * model for the active card. The Stack computes nothing; it forwards this
   * to the active card only (memoization stays at the surface). Omitted → no
   * section.
   */
  activeMappingSection?: CardMappingSectionModel | null;
  /** CARD-VIEW-DATA-001 — re-activates the step-ref ancestor on token tap. */
  onActivateAncestor?: (messageId: string) => void;
  /** CVDH-001 Slice 3 — viewport width for the hub's responsive multi-column
   *  layout. Forwarded to the active card only. */
  windowWidth?: number;
  /** CARD-VIEW-REFINE-001 — viewer role, threaded to the active card so the
   *  inline ActionsZone can derive the actor-aware move set via getRailActions.
   *  Omitted → no inline ActionsZone (back-compat). */
  viewerRole?: RailViewerRole;
  /** CARD-VIEW-REFINE-001 — dispatches a RAIL ACTION CODE for the active
   *  message via the SAME path the side rail uses (`handleRailAction`), so
   *  the inline ActionsZone and the rail can never diverge. Omitted → no
   *  inline ActionsZone. */
  onRailAction?: (
    code: RailActionCode,
    ctx: { activeMessageId: string | null },
  ) => void;
  /** REF-003 — derived Open Issue for the ACTIVE card. The Stack computes
   *  nothing; it forwards this to the active card only
   *  (`t.isActive ? activeRefereeCard : null`), mirroring activeCardDetail.
   *  Omitted → no Referee Card. */
  activeRefereeCard?: DisagreementContract | null;
  /** REF-003 — zone-3 move dispatch for the active card; pure pass-through. */
  onRefereeMove?: (
    move: MoveSuggestion,
    ctx: { activeMessageId: string | null },
  ) => void;
  /** REF-004 — Referee Card navigation verbs (Inspect / Focus on board) for
   *  the active card; pure pass-through, forwarded to the active card only. */
  onRefereeNavigate?: (
    verb: RefereeNavVerb,
    ctx: { activeMessageId: string | null },
  ) => void;
  /** VISUAL-SIMPLIFY-001 — prioritized friendly feedback flags for the ACTIVE
   *  point, computed once at the surface. The Stack computes nothing; it
   *  forwards this to the active card only (`t.isActive ? pointFeedbackFlags :
   *  null`), mirroring activeCardDetail. Omitted -> no flag row. */
  pointFeedbackFlags?: PrioritizedPointFeedbackFlags | null;
  /**
   * QUOTE-FORGE-002 (#842) — the woven-callback echo for the ACTIVE card, or
   * null. Built ONCE at the surface and forwarded here; the Stack renders it as
   * an active-card banner. Omitted / null -> no echo chrome (byte-identical). */
  activeCallbackEcho?: CallbackEchoViewModel | null;
  /** QUOTE-FORGE-002 — open the referenced prior room from the echo origin. */
  onOpenPriorRoom?: (targetDebateId: string) => void;
}

export function ArgumentBubbleStack({
  viewModels,
  activeMessageId,
  onActivate,
  onPrevious,
  onNext,
  onToggleMode,
  activeCardDetail,
  activeMappingSection,
  onActivateAncestor,
  windowWidth,
  viewerRole,
  onRailAction,
  activeRefereeCard,
  onRefereeMove,
  onRefereeNavigate,
  pointFeedbackFlags,
  activeCallbackEcho,
  onOpenPriorRoom,
}: Props) {
  const activeIndex = useMemo(() => {
    const i = viewModels.findIndex((v) => v.messageId === activeMessageId);
    return i < 0 ? viewModels.length - 1 : i;
  }, [viewModels, activeMessageId]);

  const handleNext = useCallback(() => onNext(), [onNext]);
  const handlePrev = useCallback(() => onPrevious(), [onPrevious]);
  const handleDoubleToggle = useCallback(() => onToggleMode?.(), [onToggleMode]);

  // CARD-VIEW-REFINE-001 — measured stage height, threaded to the active
  // card as a maxHeight so its always-visible detail panel clips + scrolls
  // within the stage instead of overflowing top + bottom. null until first
  // layout (the card then renders unbounded, matching the legacy behavior).
  const [stageHeight, setStageHeight] = useState<number | null>(null);
  const handleStageLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e?.nativeEvent?.layout?.height;
    if (typeof h === 'number' && Number.isFinite(h) && h > 0) setStageHeight(h);
  }, []);

  // CARD-VIEW-REFINE-001 — horizontal swipe → Prev / Next. The
  // PanResponder claims a move ONLY when it is predominantly horizontal
  // (so the card's vertical ScrollView still works) and dispatches on
  // release via the pure threshold resolver. Refs keep the responder
  // identity stable while reading the latest handlers.
  const onNextRef = useRef(handleNext);
  const onPrevRef = useRef(handlePrev);
  onNextRef.current = handleNext;
  onPrevRef.current = handlePrev;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Never claim the initial touch — a plain tap must still reach the
        // card's onPress (activate). Only a moving, horizontal gesture is a
        // swipe.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, g) =>
          shouldClaimStackHorizontalPan(g.dx, g.dy),
        onPanResponderRelease: (_evt, g) => {
          const effect = resolveStackSwipeEffect({ dx: g.dx, dy: g.dy });
          if (effect === 'next') onNextRef.current();
          else if (effect === 'prev') onPrevRef.current();
        },
      }),
    [],
  );

  if (viewModels.length === 0) {
    return (
      <View style={styles.empty} accessibilityLabel="argument-stack-empty">
        <Text style={styles.emptyText}>No messages yet. The first claim will appear on top of the stack.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel="argument-bubble-stack" testID="argument-bubble-stack">
      {/* QUOTE-FORGE-002 — the active-card woven-callback echo banner. Present
          only for a callback active move (quote_forge on); the title-only /
          unavailable arms never emit the excerpt (R3 render suppression). */}
      {activeCallbackEcho ? (
        <View style={styles.echoBanner} testID="stack-callback-echo">
          <CallbackEchoStrip echo={activeCallbackEcho} onOpenOrigin={onOpenPriorRoom} />
        </View>
      ) : null}
      <View
        style={styles.stage}
        accessibilityLabel="argument-stack-stage"
        testID="argument-stack-stage"
        onLayout={handleStageLayout}
        {...panResponder.panHandlers}
      >
        {viewModels.map((vm, i) => {
          const t = getStackTransformForIndex(i, activeIndex, viewModels.length);
          return (
            <View
              key={vm.messageId}
              pointerEvents={t.isActive ? 'auto' : 'box-only'}
              style={[
                styles.cardSlot,
                {
                  zIndex: t.zIndex,
                  opacity: t.opacity,
                  transform: [
                    { translateX: t.translateX },
                    { translateY: t.translateY },
                    { scale: t.scale },
                    { rotate: `${t.rotateDeg}deg` },
                  ],
                },
              ]}
            >
              <ArgumentBubbleCard
                viewModel={vm}
                onActivate={onActivate}
                onToggleMode={onToggleMode}
                compact={!t.isActive}
                // CARD-VIEW-DATA-001 — forward the exploded detail model to
                // the active card only; the card also gates on vm.isActive.
                cardDetail={t.isActive ? activeCardDetail : null}
                // MCP-MAPPING-EXPANSION-001 (Slice B) — combination
                // observations for the active card only (same gating as
                // the detail model).
                mappingSection={t.isActive ? activeMappingSection : null}
                onActivateAncestor={onActivateAncestor}
                // CVDH-001 Slice 3 — viewport width for the active card's hub.
                windowWidth={t.isActive ? windowWidth : undefined}
                // CARD-VIEW-REFINE-001 — the measured stage height bounds the
                // active card so its always-visible detail panel scrolls in
                // place rather than overflowing into the masthead. Non-active
                // (compact) cards stay unbounded.
                maxHeight={t.isActive ? stageHeight : null}
                // CARD-VIEW-REFINE-001 — inline ActionsZone plumbing (active
                // card only). Pure pass-through; absent → no ActionsZone.
                viewerRole={t.isActive ? viewerRole : undefined}
                onRailAction={t.isActive ? onRailAction : undefined}
                // REF-003 — the synthesized Referee Card + its zone-3 move
                // dispatch, forwarded to the active card only (same gating as
                // the detail model).
                refereeCard={t.isActive ? activeRefereeCard : null}
                onRefereeMove={t.isActive ? onRefereeMove : undefined}
                // REF-004 — Inspect / Focus-on-board verbs, forwarded to the
                // active card only (same gating as onRefereeMove).
                onRefereeNavigate={t.isActive ? onRefereeNavigate : undefined}
                // VISUAL-SIMPLIFY-001 — the prioritized friendly flags for the
                // active point, forwarded to the active card only (same gating
                // as activeCardDetail). Pure pass-through.
                pointFeedbackFlags={t.isActive ? pointFeedbackFlags : null}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.controls} accessibilityLabel="argument-stack-controls">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous message"
          style={styles.navBtn}
          onPress={handlePrev}
          testID="stack-prev"
        >
          <Text style={styles.navBtnText}>◀ Prev</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch to timeline mode"
          style={styles.modeBtn}
          onPress={handleDoubleToggle}
          testID="stack-toggle-mode"
        >
          <Text style={styles.modeBtnText}>↕ Timeline</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next message"
          style={styles.navBtn}
          onPress={handleNext}
          testID="stack-next"
        >
          <Text style={styles.navBtnText}>Next ▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  // QUOTE-FORGE-002 — active-card callback echo banner.
  echoBanner: { paddingHorizontal: 12, paddingBottom: 8 },
  // CARD-VIEW-REFINE-001 — TOP-ANCHORED (was justifyContent: 'center'). A
  // tall active card now overflows DOWN toward the controls only, never UP
  // into the masthead. `overflow: 'hidden'` keeps any residual overflow
  // clipped inside the stage. Horizontal centering is unchanged.
  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', position: 'relative', overflow: 'hidden' },
  cardSlot: { position: 'absolute' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  navBtn: { backgroundColor: '#1f2937', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, minWidth: 80, alignItems: 'center' },
  navBtnText: { color: '#e2e8f0', fontWeight: '700', fontSize: 13 },
  modeBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, minWidth: 110, alignItems: 'center' },
  modeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { padding: 24, alignItems: 'center', justifyContent: 'center', flex: 1 },
  emptyText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});
