/**
 * PROOF-002 (#889) — ProofChip render tests.
 *
 * ProofChip is a thin wrapper over the shipped ReceiptChip: it renders the
 * ban-list-clean RECEIPT_CHIP_COPY, is color-independent (a text label), shows a
 * +N overflow, and opens the SourceChainPopover on tap.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProofChip } from '../src/features/proof/ProofChip';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';

function artifact(overrides: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: 'arg-1:evidence:0',
    argumentId: 'arg-1',
    kind: 'url',
    label: 'A report',
    url: 'https://a.test/x',
    sourceChainStatus: 'source_no_quote',
    risk: 'unknown',
    addedByUserId: 'user-1',
    createdAt: '2026-07-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProofChip', () => {
  it('renders the ReceiptChip copy verbatim from the artifacts (color-independent text)', () => {
    const r = render(<ProofChip artifacts={[artifact()]} argumentId="arg-1" />);
    // The status-derived copy for source_no_quote is "Source attached".
    expect(r.getByText(/Source attached/)).toBeTruthy();
    expect(r.getByTestId('proof-chip')).toBeTruthy();
  });

  it('renders a +N overflow suffix for multiple artifacts', () => {
    const r = render(
      <ProofChip
        artifacts={[artifact({ id: 'arg-1:evidence:0' }), artifact({ id: 'arg-1:evidence:1' })]}
        argumentId="arg-1"
      />,
    );
    expect(r.getByText(/\+1/)).toBeTruthy();
  });

  it('opens the SourceChainPopover when the chip is tapped', () => {
    const r = render(<ProofChip artifacts={[artifact()]} argumentId="arg-1" />);
    expect(r.queryByTestId('source-chain-popover-arg-1')).toBeNull();
    fireEvent.press(r.getByTestId('receipt-chip'));
    expect(r.getByTestId('source-chain-popover-arg-1')).toBeTruthy();
  });
});
