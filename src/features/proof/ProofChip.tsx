/**
 * PROOF-002 (#889) — ProofChip.
 *
 * A THIN wrapper over the shipped ReceiptChip (EV-002). It authors NO copy of
 * its own: it computes summarizeArtifactsForReceiptChip(artifacts) and renders
 * the ReceiptChip, whose strings come entirely from the ban-list-clean
 * RECEIPT_CHIP_COPY. Tapping opens the existing SourceChainPopover inline. Same
 * chip contract in the drawer, the Ringside card, and the Map popover.
 *
 * Color-independent (the ReceiptChip label carries the same info as the ring),
 * touch floor via RECEIPT_CHIP_HIT_SLOP. Comments are apostrophe-free for
 * scanner safety.
 */
import React, { useCallback, useState, type ReactElement } from 'react';
import { View } from 'react-native';
import {
  ReceiptChip,
  SourceChainPopover,
  summarizeArtifactsForReceiptChip,
  buildSourceChainPopoverModelFromArtifacts,
  type EvidenceArtifact,
} from '../evidence';

export interface ProofChipProps {
  /** The move artifacts (EvidenceArtifact[]), already folded from rows or JSONB. */
  artifacts: ReadonlyArray<EvidenceArtifact>;
  /** The move id the chip is bound to (anchors the SourceChainPopover). */
  argumentId: string;
  /** Disambiguates the inner receipt-chip testID when several chips render. */
  testIDSuffix?: string;
  /** Effective reduce-motion (snaps the popover expand). */
  reduceMotion?: boolean;
  /** True when the viewer authored this move (hides the ask CTA). */
  isOwnMessage?: boolean;
  /** True when the viewer is in read mode (observer). */
  isReadModeViewer?: boolean;
}

export function ProofChip({
  artifacts,
  argumentId,
  testIDSuffix,
  reduceMotion,
  isOwnMessage,
  isReadModeViewer,
}: ProofChipProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const contract = summarizeArtifactsForReceiptChip(artifacts);
  const model = buildSourceChainPopoverModelFromArtifacts(artifacts);
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const testID = `proof-chip${testIDSuffix ? `-${testIDSuffix}` : ''}`;

  return (
    <View testID={testID}>
      <ReceiptChip contract={contract} onPress={toggle} testIDSuffix={testIDSuffix} />
      {expanded ? (
        <SourceChainPopover
          model={model}
          artifacts={artifacts}
          messageId={argumentId}
          isExpanded
          onToggleExpanded={toggle}
          reduceMotion={reduceMotion === true}
          isOwnMessage={isOwnMessage === true}
          isReadModeViewer={isReadModeViewer === true}
        />
      ) : null}
    </View>
  );
}
