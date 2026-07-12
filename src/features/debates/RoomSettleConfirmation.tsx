import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { ROOM_SETTLE_COPY } from '../arguments/gameCopy';
import type { SettleConsequences, SettleConsequence, SettleMode } from './settleRoomModel';

/**
 * SETTLE-001 (#911) — mode-parameterized confirm sheet for settle / re-open.
 *
 * Structural clone of MakePrivateConfirmation. Settling a room is a calm
 * lifecycle change, not a punishment — no scare colors, no warning icons.
 * Each SettleConsequence renders as its own plain bullet (no prose
 * concatenation). Motion respects reduceMotion (animationType none when set).
 * Hit targets meet >= 44px per accessibility-targets; both buttons carry
 * accessibilityRole + label, and the primary exposes busy state.
 *
 * Comments are apostrophe-free for the naive quote-parity doctrine scanner.
 */
interface Props {
  visible: boolean;
  mode: SettleMode;
  consequences: SettleConsequences;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  reduceMotion?: boolean;
}

/**
 * Map each SettleConsequence code to its plain-language bullet. Exhaustive
 * switch — a missing case is a compile error (never fallthrough).
 */
function effectBullet(effect: SettleConsequence): string {
  switch (effect) {
    case 'no_new_moves':
      return ROOM_SETTLE_COPY.effect_no_new_moves;
    case 'no_new_joiners':
      return ROOM_SETTLE_COPY.effect_no_new_joiners;
    case 'stays_readable':
      return ROOM_SETTLE_COPY.effect_stays_readable;
    case 'becomes_linkable':
      return ROOM_SETTLE_COPY.effect_becomes_linkable;
    case 'reversible':
      return ROOM_SETTLE_COPY.effect_reversible;
    case 'new_moves_allowed':
      return ROOM_SETTLE_COPY.effect_new_moves_allowed;
    case 'content_unchanged':
      return ROOM_SETTLE_COPY.effect_content_unchanged;
    case 'existing_links_kept':
      return ROOM_SETTLE_COPY.effect_existing_links_kept;
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

export function RoomSettleConfirmation({
  visible,
  mode,
  consequences,
  submitting,
  onConfirm,
  onCancel,
  reduceMotion,
}: Props) {
  const title =
    mode === 'settle'
      ? ROOM_SETTLE_COPY.confirm_settle_title
      : ROOM_SETTLE_COPY.confirm_reopen_title;
  const primaryLabel =
    mode === 'settle'
      ? ROOM_SETTLE_COPY.confirm_settle_primary
      : ROOM_SETTLE_COPY.confirm_reopen_primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      testID={`room-settle-confirmation-${mode}`}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityRole="alert" accessibilityLabel={title}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.intro}>{ROOM_SETTLE_COPY.confirm_intro}</Text>
          <View style={styles.bullets}>
            {consequences.effects.map((eff) => (
              <View key={eff} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{effectBullet(eff)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onCancel}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={ROOM_SETTLE_COPY.confirm_cancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.actionButton, styles.cancelButton]}
              testID="room-settle-cancel"
            >
              <Text style={styles.cancelLabel}>{ROOM_SETTLE_COPY.confirm_cancel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              accessibilityState={{ busy: submitting }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.actionButton, styles.primaryButton]}
              testID="room-settle-confirm"
            >
              <Text style={styles.primaryLabel}>{submitting ? '…' : primaryLabel}</Text>
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
