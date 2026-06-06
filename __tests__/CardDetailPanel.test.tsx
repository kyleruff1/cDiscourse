/**
 * CARD-VIEW-DATA-001 — CardDetailPanel + ArgumentBubbleCard active-path tests.
 *
 * Covers (card §1 / §5):
 *   - the active card renders the exploded zones BY DEFAULT (no tap)
 *   - a non-active card does NOT render the panel
 *   - classifier / flag / standing / lifecycle / category chips are NOT
 *     pressable (no accessibilityRole="button")
 *   - the step-reference ancestor token IS a button and fires the callback
 *   - confidence is shown as PIPS, not a raw number
 *
 * Uses @testing-library/react-native (the repo's RN render harness).
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CardDetailPanel } from '../src/features/arguments/cardView/CardDetailPanel';
import { ArgumentBubbleCard } from '../src/features/arguments/ArgumentBubbleCard';
import { buildCardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import type { CardDetailViewModel } from '../src/features/arguments/cardView/cardDetailModel';
import type { ArgumentBubbleViewModel } from '../src/features/arguments/argumentGameSurfaceModel';

const ACTIVE = 'msg-active';
const PARENT = 'msg-parent';

function persistedRow(): MachineObservationResultRow {
  return {
    id: 'res-1',
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: ACTIVE,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal',
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-05-26T00:00:00.000Z',
  };
}

function model(): CardDetailViewModel {
  return buildCardDetailViewModel({
    activeMessageId: ACTIVE,
    chronologicalIds: [PARENT, ACTIVE],
    ordinalOf: (id) => (id === ACTIVE ? 4 : id === PARENT ? 3 : null),
    kindLabelOf: (id) => (id === ACTIVE ? 'rebuttal' : 'claim'),
    parentIdOf: (id) => (id === ACTIVE ? PARENT : null),
    categoryLabel: 'Rebuttal',
    qualifierLabels: ['Scope challenge'],
    persistedClassifierRows: [persistedRow()],
    manualTagEntries: [],
    autoMetadataCodes: [],
    clusterState: 'rebutted',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: 'Receipts owed: a source for this claim.',
    standingHint: 'Needs work',
    lifecycleState: 'sourced',
    flagLabels: ['Scope challenge'],
  });
}

function bubbleVm(overrides: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  return {
    messageId: ACTIVE,
    ordinal: 4,
    createdAtLabel: '2026-05-26 12:00',
    relativeLabel: '2h ago',
    body: 'Bike lanes do not improve safety in every district.',
    kindLabel: 'rebuttal',
    actor: 'other',
    sideLabel: 'Neg',
    isLatest: true,
    isActive: true,
    parentHint: "replied to: 'we should narrow scope'",
    qualifierBadges: ['Scope challenge'],
    pointStandingHint: 'Needs work',
    allowedControls: [],
    deletionRequested: false,
    ...overrides,
  };
}

describe('CARD-VIEW-DATA-001 — CardDetailPanel renders zones by default (no tap)', () => {
  it('renders the panel + all populated zones with no interaction', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    expect(getByTestId('card-detail-panel')).toBeTruthy();
    expect(getByTestId('card-detail-step-reference')).toBeTruthy();
    expect(getByTestId('card-detail-category-zone')).toBeTruthy();
    expect(getByTestId('card-detail-classifier-zone')).toBeTruthy();
    expect(getByTestId('card-detail-evidence-zone')).toBeTruthy();
    expect(getByTestId('card-detail-standing-zone')).toBeTruthy();
    expect(getByTestId('card-detail-lifecycle-zone')).toBeTruthy();
    expect(getByTestId('card-detail-flags-zone')).toBeTruthy();
  });

  it('shows confidence as PIPS, not a raw number', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const pips = getByTestId('card-detail-classifier-pips');
    expect(pips).toBeTruthy();
    // 3 pip dots, each a <View> — no numeric text node.
    expect(pips.props.children).toHaveLength(3);
    expect(pips.props.accessibilityLabel).toBe('high confidence');
  });
});

describe('CARD-VIEW-DATA-001 — display-only labels are NOT buttons', () => {
  function roleOf(node: { props: { accessibilityRole?: string } }): string | undefined {
    return node.props.accessibilityRole;
  }

  it('classifier observation is a text label, not a button', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    const chip = getByTestId('card-detail-classifier-machine_observation:persisted:res-1:msg-active');
    expect(roleOf(chip)).toBe('text');
    expect(roleOf(chip)).not.toBe('button');
  });

  it('category / qualifier / lifecycle / flag chips carry no button role', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    for (const id of [
      'card-detail-category',
      'card-detail-qualifier-0',
      'card-detail-lifecycle',
      'card-detail-flag-0',
    ]) {
      expect(roleOf(getByTestId(id))).not.toBe('button');
    }
  });

  it('standing + evidence-debt are text, not buttons', () => {
    const { getByTestId } = render(<CardDetailPanel model={model()} />);
    expect(roleOf(getByTestId('card-detail-standing'))).not.toBe('button');
    expect(roleOf(getByTestId('card-detail-evidence-debt'))).not.toBe('button');
  });
});

describe('CARD-VIEW-DATA-001 — the ancestor token IS a button', () => {
  it('exposes role=button + hitSlop and fires onActivateAncestor with the parent id', () => {
    const onActivateAncestor = jest.fn();
    const { getByTestId } = render(
      <CardDetailPanel model={model()} onActivateAncestor={onActivateAncestor} />,
    );
    const token = getByTestId('card-step-reference-parent-token');
    expect(token.props.accessibilityRole).toBe('button');
    expect(token.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
    fireEvent.press(token);
    expect(onActivateAncestor).toHaveBeenCalledWith(PARENT);
  });
});

describe('CARD-VIEW-DATA-001 — ArgumentBubbleCard active/non-active gating', () => {
  it('renders the detail panel on the ACTIVE card by default', () => {
    const { getByTestId } = render(
      <ArgumentBubbleCard viewModel={bubbleVm({ isActive: true })} cardDetail={model()} />,
    );
    expect(getByTestId(`card-detail-panel-${ACTIVE}`)).toBeTruthy();
  });

  it('does NOT render the detail panel on a NON-active card', () => {
    const { queryByTestId } = render(
      <ArgumentBubbleCard viewModel={bubbleVm({ isActive: false })} cardDetail={model()} compact />,
    );
    expect(queryByTestId(`card-detail-panel-${ACTIVE}`)).toBeNull();
    // The legacy compact body is still shown.
    expect(queryByTestId(`bubble-body-${ACTIVE}`)).toBeTruthy();
  });

  it('does NOT render the panel when no cardDetail is supplied (byte-equivalent legacy path)', () => {
    const { queryByTestId } = render(
      <ArgumentBubbleCard viewModel={bubbleVm({ isActive: true })} />,
    );
    expect(queryByTestId(`card-detail-panel-${ACTIVE}`)).toBeNull();
    // Legacy parentHint returns when the panel is absent.
    expect(queryByTestId(`bubble-parent-hint-${ACTIVE}`)).toBeTruthy();
  });
});
