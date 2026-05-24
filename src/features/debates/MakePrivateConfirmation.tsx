import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { ROOM_VISIBILITY_COPY } from '../arguments/gameCopy';
import type { TransitionConsequences, TransitionEffect } from './roomVisibilityModel';

/**
 * QOL-039 — Neutral confirmation modal for the `make private` action.
 *
 * Renders the `TransitionConsequences` as plain bullets. No scare colors,
 * no warning icons that imply wrongdoing — this is a routine setting
 * change, not a punishment. The confirmation is the ONLY place the
 * irreversibility is stated; the wording is calm but unmissable.
 *
 * Hit targets meet ≥44px per `accessibility-targets`. The modal traps
 * focus on web via the underlying `<Modal>` primitive; the two buttons
 * carry explicit accessibilityRole + accessibilityLabel.
 */
interface Props {
  visible: boolean;
  consequences: TransitionConsequences;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Pick the chime-in-retention bullet copy based on the count. Each
 * variant is plain English, ban-list-clean, and renders as its own line —
 * no prose concatenation.
 */
function effectBullet(
  effect: TransitionEffect,
  retainedChimeInBranchCount: number,
): string {
  if (effect !== 'chime_in_branches_retained') {
    switch (effect) {
      case 'leaves_public_list':
        return ROOM_VISIBILITY_COPY.effect_leaves_public_list;
      case 'non_participants_lose_read':
        return ROOM_VISIBILITY_COPY.effect_non_participants_lose_read;
      case 'participants_keep_access':
        return ROOM_VISIBILITY_COPY.effect_participants_keep_access;
      case 'content_unchanged':
        return ROOM_VISIBILITY_COPY.effect_content_unchanged;
      case 'one_way':
        return ROOM_VISIBILITY_COPY.effect_one_way;
    }
  }
  if (retainedChimeInBranchCount === 0) {
    return ROOM_VISIBILITY_COPY.effect_chime_in_branches_retained_zero;
  }
  if (retainedChimeInBranchCount === 1) {
    return ROOM_VISIBILITY_COPY.effect_chime_in_branches_retained_one;
  }
  return ROOM_VISIBILITY_COPY.effect_chime_in_branches_retained_many.replace(
    '{count}',
    String(retainedChimeInBranchCount),
  );
}

export function MakePrivateConfirmation({
  visible,
  consequences,
  submitting,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      testID="make-private-confirmation"
    >
      <View style={styles.backdrop}>
        <View
          style={styles.sheet}
          accessibilityRole="alert"
          accessibilityLabel={ROOM_VISIBILITY_COPY.confirmation_title}
        >
          <Text style={styles.title}>{ROOM_VISIBILITY_COPY.confirmation_title}</Text>
          <Text style={styles.intro}>{ROOM_VISIBILITY_COPY.confirmation_intro}</Text>
          <View style={styles.bullets}>
            {consequences.effects.map((eff) => (
              <View key={eff} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  {effectBullet(eff, consequences.retainedChimeInBranchCount)}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onCancel}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={ROOM_VISIBILITY_COPY.confirmation_cancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.actionButton, styles.cancelButton]}
              testID="make-private-cancel"
            >
              <Text style={styles.cancelLabel}>{ROOM_VISIBILITY_COPY.confirmation_cancel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={ROOM_VISIBILITY_COPY.confirmation_primary}
              accessibilityState={{ busy: submitting }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.actionButton, styles.primaryButton]}
              testID="make-private-confirm"
            >
              <Text style={styles.primaryLabel}>
                {submitting ? '…' : ROOM_VISIBILITY_COPY.confirmation_primary}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  intro: {
    fontSize: 14,
    color: '#374151',
  },
  bullets: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: '#6b7280',
    width: 12,
    textAlign: 'center',
  },
  bulletText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 6,
  },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#111827',
  },
  primaryLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
});
