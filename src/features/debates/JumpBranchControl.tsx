/**
 * GAME-006 — Jump Branch control.
 *
 * Read-time, presentation-only RN component — the confirm-required Jump action
 * plus its inline confirm step. A thin layer over a pure `JumpControlViewModel`
 * — no state beyond the local "confirm step open?" toggle, no network, no
 * write path. The jump itself commits through the EXISTING reply composer /
 * `submit-argument` path — `onConfirmJump` hands off to the caller.
 *
 * Doctrine:
 *  - The Jump action is deliberate and CONFIRM-REQUIRED. Tapping the action
 *    does NOT jump — it opens an inline confirm step; only the confirm button
 *    commits. Never accidental, never a side effect of scrolling/tapping.
 *  - No silent no-op: a disabled control still renders, visibly, with
 *    `accessibilityState={{ disabled: true }}` and the plain-language
 *    `disabledReasonLabel` shown as visible text.
 *  - The enabled/disabled distinction is shape + text, not color alone —
 *    color-independence (accessibility-targets).
 *  - The action Pressable carries role + label + hint + state + a >=44px hit
 *    target (hitSlop fills the gap when the visual is smaller). The confirm +
 *    cancel buttons are focusable in reading order — reachable without a
 *    pointer.
 *  - A Jump is structural movement, never a verdict. Copy comes from
 *    `JUMP_BRANCH_COPY`.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { JumpControlViewModel } from './jumpBranchModel';

interface JumpBranchControlProps {
  viewModel: JumpControlViewModel;
  /**
   * Commit the jump. Fired ONLY when the user explicitly confirms the inline
   * confirm step. The caller routes to the existing reply composer
   * pre-targeted at `viewModel.destinationBranchId` — GAME-006 adds no new
   * write path.
   */
  onConfirmJump: (destinationBranchId: string) => void;
  /** Optional — called when the user dismisses the confirm step. */
  onCancel?: () => void;
}

/** A 44px hit target on a smaller pill — fills the gap with hitSlop. */
const JUMP_HIT_SLOP = { top: 11, bottom: 11, left: 8, right: 8 } as const;

export function JumpBranchControl({
  viewModel,
  onConfirmJump,
  onCancel,
}: JumpBranchControlProps) {
  // The only local state — whether the deliberate confirm step is open. The
  // jump never commits from this toggle; only `onConfirmJump` commits.
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleActionPress = () => {
    if (!viewModel.enabled) return; // disabled — no silent jump, no toggle
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    onConfirmJump(viewModel.destinationBranchId);
  };

  const handleCancel = () => {
    setConfirmOpen(false);
    if (onCancel) onCancel();
  };

  return (
    <View style={styles.control} testID="jump-branch-control">
      {/* The Jump action — tapping opens the confirm step, never jumps. */}
      <Pressable
        onPress={handleActionPress}
        disabled={!viewModel.enabled}
        accessibilityRole="button"
        accessibilityLabel={viewModel.accessibilityLabel}
        accessibilityHint={viewModel.accessibilityHint}
        accessibilityState={{ disabled: !viewModel.enabled, expanded: confirmOpen }}
        hitSlop={JUMP_HIT_SLOP}
        style={[styles.actionButton, !viewModel.enabled && styles.actionButtonDisabled]}
        testID="jump-branch-action"
      >
        <Text style={styles.actionGlyph} accessibilityElementsHidden>
          {'↗'}
        </Text>
        <Text
          style={[styles.actionText, !viewModel.enabled && styles.actionTextDisabled]}
        >
          {viewModel.actionLabel}
        </Text>
      </Pressable>

      {/* Disabled-state reason — visible text, no silent no-op. */}
      {!viewModel.enabled && viewModel.disabledReasonLabel !== null ? (
        <View
          style={styles.disabledReason}
          accessibilityLabel={viewModel.disabledReasonLabel}
          testID="jump-branch-disabled-reason"
        >
          <Text style={styles.disabledReasonGlyph} accessibilityElementsHidden>
            {'•'}
          </Text>
          <Text style={styles.disabledReasonText}>
            {viewModel.disabledReasonLabel}
          </Text>
        </View>
      ) : null}

      {/* The inline confirm step — deliberate two-step gate. Only the confirm
          button commits the jump. */}
      {confirmOpen && viewModel.enabled ? (
        <View style={styles.confirmPanel} testID="jump-branch-confirm-step">
          <Text style={styles.confirmPrompt}>{viewModel.confirmPrompt}</Text>
          <View style={styles.confirmRow}>
            <Pressable
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={viewModel.confirmLabel}
              hitSlop={JUMP_HIT_SLOP}
              style={[styles.confirmButton, styles.confirmButtonPrimary]}
              testID="jump-branch-confirm-button"
            >
              <Text style={styles.confirmButtonPrimaryText}>
                {viewModel.confirmLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel={viewModel.cancelLabel}
              hitSlop={JUMP_HIT_SLOP}
              style={[styles.confirmButton, styles.confirmButtonSecondary]}
              testID="jump-branch-cancel-button"
            >
              <Text style={styles.confirmButtonSecondaryText}>
                {viewModel.cancelLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    marginTop: 8,
    gap: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  actionButtonDisabled: {
    // Shape change — dashed border + neutral fill — not color alone.
    borderColor: '#9ca3af',
    borderStyle: 'dashed',
    backgroundColor: '#f3f4f6',
  },
  actionGlyph: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  actionText: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },
  actionTextDisabled: { color: '#6b7280', fontWeight: '600' },
  disabledReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingHorizontal: 4,
  },
  disabledReasonGlyph: { fontSize: 11, color: '#6b7280', lineHeight: 16 },
  disabledReasonText: {
    flex: 1,
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 16,
  },
  confirmPanel: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  confirmPrompt: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 5,
    borderWidth: 1,
  },
  confirmButtonPrimary: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  confirmButtonPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  confirmButtonSecondary: {
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  confirmButtonSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
});
