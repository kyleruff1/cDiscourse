/**
 * EV-003 — EvidenceDebtChip.
 *
 * A status chip for the OBLIGATION axis, modeled on EV-002's `ReceiptChip`
 * but answering a different question. A node can show "Source and quote"
 * (existence — ReceiptChip) AND "Source requested" (obligation — this chip)
 * at the same time; that is the three-axis design made visible (design §4, §7.1).
 *
 * Doctrine:
 *   - Every state carries a TEXT label — never color-only
 *     (accessibility-targets color-independence). The tint is the secondary
 *     signal; the label is primary.
 *   - The chip is a STATUS INDICATOR — non-pressable in v1. Tapping the node
 *     opens the Inspect popout, which lists the full debt detail.
 *   - Every string comes from `EvidenceDebtChipContract` (the pure model);
 *     this component authors no copy of its own.
 *   - A debt is advisory — this chip never blocks a reply and is never a flag.
 *
 * Pure presentation. Consumes one `EvidenceDebtChipContract`.
 */
import React, { type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { EvidenceDebtChipContract } from './evidenceDebtModel';

export interface EvidenceDebtChipProps {
  /** From `getNodeEvidenceDebtChip` / `summarizeEvidenceDebtChip`. */
  contract: EvidenceDebtChipContract;
  /** Test id suffix to disambiguate when multiple chips render. */
  testIDSuffix?: string;
}

/**
 * Tone → background color. Reuses the EV-002 ReceiptChip palette so the two
 * chips read as one family. No new design token (design §13).
 */
const TONE_BG: Record<EvidenceDebtChipContract['tone'], string> = {
  neutral: '#1e293b',
  info: '#0c4a6e', // teal/blue family.
  attention: '#7c2d12', // amber/attention family.
  muted: '#1f2937',
};

/** Tone → foreground (label) color. Mirrors the ReceiptChip palette. */
const TONE_FG: Record<EvidenceDebtChipContract['tone'], string> = {
  neutral: '#e2e8f0',
  info: '#bae6fd', // teal/blue family.
  attention: '#fed7aa', // amber/attention family.
  muted: '#cbd5e1',
};

/**
 * Hit-slop the chip uses so its effective touch surface is ≥ 44×44 even
 * though it is non-pressable — a consistent touch surface beside the
 * pressable ReceiptChip (accessibility-targets). Pure constant.
 */
export const EVIDENCE_DEBT_CHIP_HIT_SLOP = Object.freeze({
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
});

/**
 * Build the chip's container style. Pure — exposed so tests can assert the
 * tone → color mapping without a renderer. An `attention` debt renders with
 * a solid border so the obligation reads even in monochrome.
 */
export function buildEvidenceDebtChipContainerStyle(
  contract: EvidenceDebtChipContract,
): { backgroundColor: string; borderWidth: number; borderColor: string } {
  return {
    backgroundColor: TONE_BG[contract.tone],
    borderWidth: contract.tone === 'attention' ? 1 : 0,
    borderColor: TONE_FG[contract.tone],
  };
}

export function EvidenceDebtChip({
  contract,
  testIDSuffix,
}: EvidenceDebtChipProps): ReactElement | null {
  // A node with no open debt renders nothing — no clutter on a node that
  // carries no obligation.
  if (!contract.isVisible) return null;

  const testID = `evidence-debt-chip${testIDSuffix ? `-${testIDSuffix}` : ''}`;
  const containerStyle = [styles.container, buildEvidenceDebtChipContainerStyle(contract)];
  const labelStyle = [styles.label, { color: TONE_FG[contract.tone] }];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={contract.accessibilityLabel}
      hitSlop={EVIDENCE_DEBT_CHIP_HIT_SLOP}
      style={containerStyle}
      testID={testID}
    >
      <Text style={labelStyle} numberOfLines={1}>
        {contract.label}
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
