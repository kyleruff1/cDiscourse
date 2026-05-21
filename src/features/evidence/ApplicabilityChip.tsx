/**
 * QOL-037 — ApplicabilityChip.
 *
 * A status chip for the APPLICABILITY axis — the third independent axis on an
 * evidence object. A node can show EV-002's `ReceiptChip` ("Source and quote",
 * the existence axis), EV-003's `EvidenceDebtChip` ("Source requested", the
 * obligation axis), AND this chip ("Applicability disputed") all at once; that
 * is the three-axis design made visible (design §4, §6.3).
 *
 * Doctrine:
 *   - Renders ONLY when the status is not `applicability_undisputed` —
 *     uncontested evidence shows no applicability chip (no clutter).
 *   - Every visible state carries a TEXT label — never color-only
 *     (accessibility-targets color-independence). The tint is the secondary
 *     signal; the label is primary.
 *   - The chip is a STATUS INDICATOR — non-pressable in v1 (design §6.3).
 *     Tapping the node opens the Inspect popout, which shows the full detail.
 *   - Every string comes from `ApplicabilityChipContract` (the pure model);
 *     this component authors no copy of its own.
 *   - The status describes the applicability AXIS — it is never a truth
 *     verdict. No animation: the chip is a static indicator (design §10 edge
 *     case 15).
 *
 * Pure presentation. Consumes one `ApplicabilityChipContract`.
 */
import React, { type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ApplicabilityChipContract } from './evidenceApplicabilityModel';

export interface ApplicabilityChipProps {
  /** From `summarizeApplicabilityChip` (the pure model). */
  contract: ApplicabilityChipContract;
  /** Test id suffix to disambiguate when multiple chips render. */
  testIDSuffix?: string;
}

/**
 * Tone → background color. Reuses the EV-002 / EV-003 chip palette so all
 * three axis chips read as one family. No new design token (design §6.3).
 */
const TONE_BG: Record<ApplicabilityChipContract['tone'], string> = {
  neutral: '#1e293b',
  info: '#0c4a6e', // teal/blue family — "supported".
  attention: '#7c2d12', // amber/attention family — "disputed".
};

/** Tone → foreground (label) color. Mirrors the EV-003 chip palette. */
const TONE_FG: Record<ApplicabilityChipContract['tone'], string> = {
  neutral: '#e2e8f0',
  info: '#bae6fd', // teal/blue family.
  attention: '#fed7aa', // amber/attention family.
};

/**
 * Hit-slop the chip uses so its effective touch surface is ≥ 44×44 even
 * though it is non-pressable — a consistent touch surface beside the
 * pressable `ReceiptChip` (accessibility-targets). Pure constant.
 */
export const APPLICABILITY_CHIP_HIT_SLOP = Object.freeze({
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
});

/**
 * Build the chip's container style. Pure — exposed so tests can assert the
 * tone → color mapping without a renderer. An `attention` chip renders with a
 * solid border so the contested state reads even in monochrome.
 */
export function buildApplicabilityChipContainerStyle(
  contract: ApplicabilityChipContract,
): { backgroundColor: string; borderWidth: number; borderColor: string } {
  return {
    backgroundColor: TONE_BG[contract.tone],
    borderWidth: contract.tone === 'attention' ? 1 : 0,
    borderColor: TONE_FG[contract.tone],
  };
}

export function ApplicabilityChip({
  contract,
  testIDSuffix,
}: ApplicabilityChipProps): ReactElement | null {
  // Uncontested evidence renders nothing — no applicability chip on a node
  // where no dispute has been opened (design §6.3).
  if (!contract.isVisible) return null;

  const testID = `applicability-chip${testIDSuffix ? `-${testIDSuffix}` : ''}`;
  const containerStyle = [styles.container, buildApplicabilityChipContainerStyle(contract)];
  const labelStyle = [styles.label, { color: TONE_FG[contract.tone] }];

  // The accessible label pairs the status label with its helper so a
  // screen-reader user gets the same context a sighted user reads on hover.
  const accessibilityLabel = contract.helper
    ? `${contract.label}. ${contract.helper}`
    : contract.label;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      hitSlop={APPLICABILITY_CHIP_HIT_SLOP}
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
