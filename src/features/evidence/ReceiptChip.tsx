/**
 * EV-002 — ReceiptChip.
 *
 * Pressable chip that displays a `ReceiptChipContract` from EV-001 inside
 * the existing `TimelineNodePopover` body region. Tapping the chip opens
 * the inline `SourceChainPopover` section.
 *
 * The chip's text label carries the same information as the dotted-teal
 * ring (color independence — every visual signal has a text equivalent).
 *
 * Accessibility:
 *   - `accessibilityRole="button"` when pressable.
 *   - Tap target ≥ 44×44 via hitSlop on small chips.
 *   - Label includes `+N` count suffix when more than one artifact.
 *
 * Visual: when `contract.showsSourceChainPressure === true`, the wrapping
 * <View> renders with `borderStyle: 'dotted'` and a teal-700 border
 * (`ARGUMENT.branch.bg` from VG-001 tokens). Otherwise the chip renders
 * with no ring.
 *
 * TODO(VG-001-ext): migrate to a discrete `RING.sourceChain` design token
 * if/when VG-001 introduces one.
 */
import React, { type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ARGUMENT } from '../../lib/designTokens';
import type { ReceiptChipContract } from './evidenceModel';

export interface ReceiptChipProps {
  /** From summarizeArtifactsForReceiptChip. */
  contract: ReceiptChipContract;
  /** Tap dispatches to the parent (opens the popover). */
  onPress?: () => void;
  /**
   * Whether the chip is the visible / pressable surface (true) or a
   * read-only summary (false). Defaults to true.
   */
  pressable?: boolean;
  /** Test id suffix to disambiguate when multiple chips render. */
  testIDSuffix?: string;
}

const TONE_BG: Record<ReceiptChipContract['tone'], string> = {
  neutral: '#1e293b',
  info: '#0c4a6e',
  attention: '#7c2d12',
  muted: '#1f2937',
};

const TONE_FG: Record<ReceiptChipContract['tone'], string> = {
  neutral: '#e2e8f0',
  info: '#bae6fd',
  attention: '#fed7aa',
  muted: '#cbd5e1',
};

/** Color tokens that the dotted ring may legitimately use. Asserted in tests. */
export const RECEIPT_CHIP_RING_COLOR = ARGUMENT.branch.bg; // teal-700

// ── Pure helpers (test-only consumers) ────────────────────────

/**
 * Decide the chip's display string from the EV-001 contract.
 * Adds a `+N` suffix when the contract represents multiple artifacts.
 * Pure — no React.
 */
export function buildReceiptChipDisplayLabel(contract: ReceiptChipContract): string {
  const countSuffix = contract.count > 1 ? ` +${contract.count - 1}` : '';
  return `${contract.label}${countSuffix}`;
}

/**
 * Build the accessibility label for the chip. Pure.
 */
export function buildReceiptChipAccessibilityLabel(contract: ReceiptChipContract): string {
  return `Receipt status: ${contract.label}. ${contract.helper}`;
}

/**
 * Build the container style object for the chip. Returns a single
 * StyleSheet-compatible object so tests can assert borderStyle /
 * borderColor / borderWidth across the two visual modes.
 * Pure.
 */
export function buildReceiptChipContainerStyle(contract: ReceiptChipContract): {
  backgroundColor: string;
  borderStyle: 'dotted' | 'solid';
  borderWidth: number;
  borderColor?: string;
} {
  if (contract.showsSourceChainPressure) {
    return {
      backgroundColor: TONE_BG[contract.tone],
      borderStyle: 'dotted',
      borderWidth: 2,
      borderColor: RECEIPT_CHIP_RING_COLOR,
    };
  }
  return {
    backgroundColor: TONE_BG[contract.tone],
    borderStyle: 'solid',
    borderWidth: 0,
  };
}

/** Hit-slop the chip uses when pressable. Pure constant. */
export const RECEIPT_CHIP_HIT_SLOP = Object.freeze({ top: 10, bottom: 10, left: 10, right: 10 });

export function ReceiptChip({ contract, onPress, pressable = true, testIDSuffix }: ReceiptChipProps): ReactElement {
  const displayLabel = buildReceiptChipDisplayLabel(contract);
  const accessibilityLabel = buildReceiptChipAccessibilityLabel(contract);
  const testID = `receipt-chip${testIDSuffix ? `-${testIDSuffix}` : ''}`;

  const containerStyle = [styles.container, buildReceiptChipContainerStyle(contract)];
  const labelStyle = [styles.label, { color: TONE_FG[contract.tone] }];

  if (pressable && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={RECEIPT_CHIP_HIT_SLOP}
        style={containerStyle}
        testID={testID}
      >
        <Text style={labelStyle} numberOfLines={1}>
          {displayLabel}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={containerStyle}
      testID={testID}
    >
      <Text style={labelStyle} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 28,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
