/**
 * Stage 6.1.8 — ArgumentBubbleStack
 *
 * Overlapping 3D-ish stack with the latest message on top. Active card sits
 * at the front; older cards fan out behind it with scale + translate +
 * rotate + opacity transforms. Never renders a vertical comment thread.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArgumentBubbleCard } from './ArgumentBubbleCard';
import {
  getStackTransformForIndex,
  type ArgumentBubbleViewModel,
} from './argumentGameSurfaceModel';
import type { CardDetailViewModel } from './cardView/cardDetailModel';

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
  /** CARD-VIEW-DATA-001 — re-activates the step-ref ancestor on token tap. */
  onActivateAncestor?: (messageId: string) => void;
}

export function ArgumentBubbleStack({
  viewModels,
  activeMessageId,
  onActivate,
  onPrevious,
  onNext,
  onToggleMode,
  activeCardDetail,
  onActivateAncestor,
}: Props) {
  const activeIndex = useMemo(() => {
    const i = viewModels.findIndex((v) => v.messageId === activeMessageId);
    return i < 0 ? viewModels.length - 1 : i;
  }, [viewModels, activeMessageId]);

  const handleNext = useCallback(() => onNext(), [onNext]);
  const handlePrev = useCallback(() => onPrevious(), [onPrevious]);
  const handleDoubleToggle = useCallback(() => onToggleMode?.(), [onToggleMode]);

  if (viewModels.length === 0) {
    return (
      <View style={styles.empty} accessibilityLabel="argument-stack-empty">
        <Text style={styles.emptyText}>No messages yet. The first claim will appear on top of the stack.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel="argument-bubble-stack" testID="argument-bubble-stack">
      <View style={styles.stage} accessibilityLabel="argument-stack-stage">
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
                onActivateAncestor={onActivateAncestor}
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
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
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
