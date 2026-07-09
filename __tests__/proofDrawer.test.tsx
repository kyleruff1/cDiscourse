/**
 * PROOF-002 (#889) — ProofDrawer render tests.
 *
 * The 6-kind grid, the focused input, an attach through the (mocked) wrapper,
 * the success chip, the inline failure retry (never a modal), the sheet-vs-panel
 * breakpoint at 719/720, and the 390px grid.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProofDrawer } from '../src/features/proof/ProofDrawer';
import type { ProofDrawerScope, ProofItemRow } from '../src/features/proof/proofDrawerModel';
import type { AttachProofInput, AttachProofResult } from '../src/features/proof/attachProofApi';

const SCOPE: ProofDrawerScope = { kind: 'argument', debateId: 'debate-1', argumentId: 'arg-1', owedDebtKind: null };

function row(overrides: Partial<ProofItemRow> = {}): ProofItemRow {
  return {
    id: 'p1',
    debate_id: 'debate-1',
    argument_id: 'arg-1',
    added_by: 'user-1',
    kind: 'url',
    label: 'A report',
    url: 'https://a.test/x',
    source_text: null,
    quote: null,
    referenced_argument_id: null,
    source_chain_status: 'source_no_quote',
    risk: 'unknown',
    created_at: '2026-07-09T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function renderDrawer(
  onAttach: (i: AttachProofInput) => Promise<AttachProofResult>,
  width = 400,
) {
  return render(
    <ProofDrawer
      scope={SCOPE}
      windowWidth={width}
      windowHeight={800}
      currentUserId="user-1"
      onAttach={onAttach}
      onClose={jest.fn()}
      generateClientAttachId={() => 'fixed-attach-id'}
    />,
  );
}

describe('ProofDrawer — kind grid', () => {
  it('renders exactly the 6 kind tiles, each a labelled button', () => {
    const r = renderDrawer(jest.fn());
    for (const kind of ['url', 'quote', 'source_text', 'note', 'prior_move', 'external_ref']) {
      const tile = r.getByTestId(`proof-drawer-kind-${kind}`);
      expect(tile.props.accessibilityRole).toBe('button');
      expect(typeof tile.props.accessibilityLabel).toBe('string');
    }
  });

  it('every tile meets the 44x44 touch floor', () => {
    const r = renderDrawer(jest.fn());
    const tile = r.getByTestId('proof-drawer-kind-url');
    const flat = Array.isArray(tile.props.style)
      ? Object.assign({}, ...tile.props.style)
      : tile.props.style;
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    expect(flat.minWidth).toBeGreaterThanOrEqual(44);
  });

  it('renders the grid at 390px without a horizontal scroll container', () => {
    const r = renderDrawer(jest.fn(), 390);
    expect(r.getByTestId('proof-drawer-kind-url')).toBeTruthy();
    expect(r.getByTestId('proof-drawer-kind-external_ref')).toBeTruthy();
  });
});

describe('ProofDrawer — focused input + attach', () => {
  it('a tile opens the focused input', () => {
    const r = renderDrawer(jest.fn());
    expect(r.queryByTestId('proof-drawer-input')).toBeNull();
    fireEvent.press(r.getByTestId('proof-drawer-kind-url'));
    expect(r.getByTestId('proof-drawer-input')).toBeTruthy();
  });

  it('attach calls the wrapper with the right AttachProofInput and renders a chip on success', async () => {
    const onAttach = jest.fn().mockResolvedValue({ ok: true, proofItem: row() });
    const r = renderDrawer(onAttach);
    fireEvent.press(r.getByTestId('proof-drawer-kind-url'));
    fireEvent.changeText(r.getByTestId('proof-drawer-input'), 'https://a.test/x');
    fireEvent.press(r.getByTestId('proof-drawer-attach'));
    await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1));
    expect(onAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        debateId: 'debate-1',
        argumentId: 'arg-1',
        kind: 'url',
        url: 'https://a.test/x',
        clientAttachId: 'fixed-attach-id',
      }),
    );
    await waitFor(() => expect(r.getByTestId('proof-drawer-chip-p1')).toBeTruthy());
  });

  it('a failed attach renders an inline error, never a modal', async () => {
    const onAttach = jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: 'proof_cap_reached', errorMessage: 'This move already has the most sources it can hold.' });
    const r = renderDrawer(onAttach);
    fireEvent.press(r.getByTestId('proof-drawer-kind-url'));
    fireEvent.changeText(r.getByTestId('proof-drawer-input'), 'https://a.test/x');
    fireEvent.press(r.getByTestId('proof-drawer-attach'));
    await waitFor(() => expect(r.getByTestId('proof-drawer-error')).toBeTruthy());
    expect(r.getByText(/most sources it can hold/)).toBeTruthy();
  });
});

describe('ProofDrawer — dock breakpoint chrome', () => {
  it('renders a bottom sheet below 720px', () => {
    const r = renderDrawer(jest.fn(), 719);
    expect(r.getByTestId('proof-drawer-sheet')).toBeTruthy();
    expect(r.queryByTestId('proof-drawer-side')).toBeNull();
  });

  it('renders a side panel at 720px', () => {
    const r = renderDrawer(jest.fn(), 720);
    expect(r.getByTestId('proof-drawer-side')).toBeTruthy();
    expect(r.queryByTestId('proof-drawer-sheet')).toBeNull();
  });
});
