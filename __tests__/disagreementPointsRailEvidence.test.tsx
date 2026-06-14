/**
 * UX-MEDIATOR-003 — Disagreement Points rail evidence section tests.
 *
 * Renders the rail with a board carrying evidence debts / blocked paths and
 * asserts the compact evidence section: "Evidence that would help: <kinds>",
 * the blocked-path line when supported, absence for points without debt, and
 * doctrine safety (no internal codes, ban-list clean, non-accusatory).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { _forbiddenMediatorTokens, plainLanguageForMediatorState } from '../src/features/mediator';
import type {
  DisagreementPoint,
  EvidenceDebtView,
  MediatorBoardState,
  MediatorStateCode,
  BlockedEvidencePath,
} from '../src/features/mediator';

function makePoint(
  p: Partial<DisagreementPoint> & { id: string; state: MediatorStateCode },
): DisagreementPoint {
  return {
    id: p.id,
    anchor: p.anchor ?? { nodeId: p.id, parentNodeId: null, targetExcerpt: null },
    kind: p.kind ?? 'unaxed',
    state: p.state,
    plainLabel: p.plainLabel ?? plainLanguageForMediatorState(p.state),
    lifecycleState: p.lifecycleState ?? 'open',
    confidence: p.confidence ?? 'medium',
    openEvidenceDebtIds: p.openEvidenceDebtIds ?? [],
    memberNodeIds: p.memberNodeIds ?? [p.id],
    isAdvisory: p.isAdvisory ?? false,
  };
}

function makeView(p: Partial<EvidenceDebtView> & { pointId: string }): EvidenceDebtView {
  return {
    debtId: p.debtId ?? `${p.pointId}:debt`,
    nodeId: p.nodeId ?? p.pointId,
    pointId: p.pointId,
    kind: p.kind ?? 'source',
    status: p.status ?? 'requested',
    isOpen: p.isOpen ?? true,
    isBlocked: p.isBlocked ?? false,
    plainLabel: p.plainLabel ?? 'Needs evidence',
  };
}

function makeBoard(opts: {
  points: DisagreementPoint[];
  evidenceDebts?: EvidenceDebtView[];
  blockedEvidencePaths?: BlockedEvidencePath[];
}): MediatorBoardState {
  return {
    debateId: 'debate-1',
    points: opts.points,
    markupByNodeId: {},
    evidenceDebts: opts.evidenceDebts ?? [],
    blockedEvidencePaths: opts.blockedEvidencePaths ?? [],
    definitionMismatches: [],
    scopeMismatches: [],
    recollectionConflicts: [],
    nonProvableKeyDetails: [],
    impasses: [],
    pathwaysByPointId: {},
    nextAction: null,
    inputHash: 'h1',
  };
}

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

describe('UX-MEDIATOR-003 DisagreementPointsRail evidence section', () => {
  it('renders "Evidence that would help: <kinds>" for a needs-evidence point', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'needs_evidence', openEvidenceDebtIds: ['p1:debt'] })],
      evidenceDebts: [makeView({ pointId: 'p1', kind: 'source' })],
    });
    const { getByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByText('Evidence that would help: source')).toBeTruthy();
    expect(getByText('1 evidence request')).toBeTruthy(); // existing count line still renders
  });

  it('renders "Blocked evidence path" when a blocked path is present', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'evidence_blocked', openEvidenceDebtIds: ['p1:debt'] })],
      evidenceDebts: [makeView({ pointId: 'p1', kind: 'receipt', status: 'unresolved', isBlocked: true })],
      blockedEvidencePaths: [{ pointId: 'p1', nodeId: 'p1', debtId: 'p1:debt', artifactCategory: 'receipt', plainLabel: 'Blocked evidence path' }],
    });
    const { getByTestId, getAllByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-blocked-p1')).toBeTruthy();
    // The dedicated blocked line renders (the evidence_blocked state badge may
    // also read the same words — at least one occurrence is required).
    expect(getAllByText('Blocked evidence path').length).toBeGreaterThanOrEqual(1);
  });

  it('shows no evidence-help line for a point without open evidence debt', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'open' }), makePoint({ id: 'p2', state: 'scope_mismatch' })],
      evidenceDebts: [],
    });
    const { queryByTestId } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(queryByTestId('disagreement-points-rail-evidence-help-p1')).toBeNull();
    expect(queryByTestId('disagreement-points-rail-evidence-help-p2')).toBeNull();
    expect(queryByTestId('disagreement-points-rail-blocked-p1')).toBeNull();
  });

  it('leaks no internal codes and no ban-list tokens across the evidence section', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'needs_evidence', openEvidenceDebtIds: ['a', 'b'] })],
      evidenceDebts: [
        makeView({ pointId: 'p1', debtId: 'a', kind: 'source' }),
        makeView({ pointId: 'p1', debtId: 'b', kind: 'primary_record', isBlocked: true }),
      ],
      blockedEvidencePaths: [{ pointId: 'p1', nodeId: 'p1', debtId: 'b', artifactCategory: 'primary record', plainLabel: 'Blocked evidence path' }],
    });
    const tree = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    ).toJSON();
    const texts = collectText(tree);
    const banned = _forbiddenMediatorTokens();
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of banned) expect(lower.includes(token)).toBe(false);
      // No raw snake_case internal code (e.g. primary_record, needs_evidence).
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
    // "primary record" (plain words) renders, not the raw kind code.
    expect(texts.join(' ')).toContain('primary record');
  });
});
