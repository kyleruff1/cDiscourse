/**
 * Stage 6.1.8 — ArgumentBubbleActions
 *
 * Orbit-style action chips for the active bubble. Controls are actor-aware:
 *   - Own bubble: view_qualifiers, request_deletion (only when no open request)
 *   - Other bubble: reply, disagree, flag, ask_for_source, ask_for_quote,
 *                   branch, view_qualifiers
 *
 * No "edit body" affordance is exposed anywhere — bodies are immutable
 * after submit-argument success.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ArgumentBubbleControl, ArgumentBubbleViewModel } from './argumentGameSurface';

const CONTROL_LABEL: Record<ArgumentBubbleControl, string> = {
  reply: 'Reply',
  disagree: 'Disagree',
  flag: 'Flag',
  ask_for_source: 'Ask for source',
  ask_for_quote: 'Ask for quote',
  branch: 'Branch',
  view_qualifiers: 'View qualifiers',
  request_deletion: 'Request deletion',
};

const CONTROL_TONE: Record<ArgumentBubbleControl, string> = {
  reply: '#6366f1',
  disagree: '#f97316',
  flag: '#dc2626',
  ask_for_source: '#0ea5e9',
  ask_for_quote: '#0d9488',
  branch: '#a855f7',
  view_qualifiers: '#64748b',
  request_deletion: '#475569',
};

interface Props {
  viewModel: ArgumentBubbleViewModel;
  onAction?: (control: ArgumentBubbleControl, messageId: string) => void;
}

export function ArgumentBubbleActions({ viewModel: vm, onAction }: Props) {
  if (!vm.isActive) return null;
  return (
    <View style={styles.row} accessibilityLabel={`argument-bubble-actions-${vm.messageId}`}>
      {vm.allowedControls.map((control) => {
        const disabled = control === 'request_deletion' && vm.deletionRequested;
        return (
          <Pressable
            key={control}
            onPress={() => !disabled && onAction?.(control, vm.messageId)}
            style={[
              styles.chip,
              { backgroundColor: disabled ? '#334155' : CONTROL_TONE[control] },
              disabled && styles.chipDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${CONTROL_LABEL[control]} on message ${vm.ordinal}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            testID={`bubble-action-${control}-${vm.messageId}`}
          >
            <Text style={styles.chipText}>
              {disabled && control === 'request_deletion' ? 'Deletion requested' : CONTROL_LABEL[control]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 8,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 36,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDisabled: { opacity: 0.65 },
  chipText: { color: '#f8fafc', fontWeight: '700', fontSize: 12 },
});
