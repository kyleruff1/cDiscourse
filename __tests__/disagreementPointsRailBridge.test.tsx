/**
 * UX-MEDIATOR-004 — Disagreement Points rail definition/scope bridge tests.
 *
 * Renders the rail with a board carrying definition/scope markers and asserts
 * the compact bridge section: the "Clarify the point" lead-in, the definition
 * and scope prompts, absence for ordinary points, coexistence with the
 * UX-MEDIATOR-003 evidence section, and doctrine safety (no internal codes,
 * ban-list clean, non-accusatory).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';
import { _forbiddenMediatorTokens, plainLanguageForMediatorState } from '../src/features/mediator';
import type {
  DefinitionMismatch,
  DisagreementPoint,
  EvidenceDebtView,
  MediatorBoardState,
  MediatorStateCode,
  ScopeMismatch,
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

function makeBoard(opts: {
  points: DisagreementPoint[];
  definitionMismatches?: DefinitionMismatch[];
  scopeMismatches?: ScopeMismatch[];
  evidenceDebts?: EvidenceDebtView[];
}): MediatorBoardState {
  return {
    debateId: 'debate-1',
    points: opts.points,
    markupByNodeId: {},
    evidenceDebts: opts.evidenceDebts ?? [],
    blockedEvidencePaths: [],
    definitionMismatches: opts.definitionMismatches ?? [],
    scopeMismatches: opts.scopeMismatches ?? [],
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

describe('UX-MEDIATOR-004 DisagreementPointsRail definition/scope bridge', () => {
  it('renders the definition bridge for a definition_not_shared point', () => {
    const board = makeBoard({ points: [makePoint({ id: 'p1', state: 'definition_not_shared' })] });
    const { getByTestId, getByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-bridge-p1')).toBeTruthy();
    expect(getByText('Clarify the point')).toBeTruthy();
    expect(getByText('The key term is not yet shared. Define the key term together.')).toBeTruthy();
  });

  it('renders the scope bridge for a scope_mismatch point', () => {
    const board = makeBoard({ points: [makePoint({ id: 'p1', state: 'scope_mismatch' })] });
    const { getByTestId, getByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-bridge-primary-p1')).toBeTruthy();
    expect(getByText('This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.')).toBeTruthy();
  });

  it('shows no bridge section for an ordinary open or needs-evidence point', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'open' }), makePoint({ id: 'p2', state: 'needs_evidence', openEvidenceDebtIds: ['d'] })],
      evidenceDebts: [
        {
          debtId: 'd',
          nodeId: 'p2',
          pointId: 'p2',
          kind: 'source',
          status: 'requested',
          isOpen: true,
          isBlocked: false,
          plainLabel: 'Needs evidence',
        },
      ],
    });
    const { queryByTestId, getByTestId } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(queryByTestId('disagreement-points-rail-bridge-p1')).toBeNull();
    expect(queryByTestId('disagreement-points-rail-bridge-p2')).toBeNull();
    // UX-MEDIATOR-003 evidence section still renders for the needs-evidence point.
    expect(getByTestId('disagreement-points-rail-evidence-help-p2')).toBeTruthy();
  });

  it('shows one primary prompt plus a summarised secondary when both apply', () => {
    const board = makeBoard({
      points: [makePoint({ id: 'p1', state: 'scope_mismatch' })],
      definitionMismatches: [{ pointId: 'p1', nodeId: 'p1', proposedButNotConfirmed: false, confidence: 'low' }],
      scopeMismatches: [{ pointId: 'p1', nodeId: 'p1', confidence: 'medium' }],
    });
    const { getByTestId, getByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    // Board priority says scope -> scope leads, definition summarised.
    expect(getByText('This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.')).toBeTruthy();
    expect(getByTestId('disagreement-points-rail-bridge-secondary-p1')).toBeTruthy();
    expect(getByText('Also: Definition not shared')).toBeTruthy();
  });

  it('bridge prompts are advisory — no posting-gate language (doctrine §1)', () => {
    // The board is advisory and never blocks posting; bridge copy must not read
    // as a precondition to continue. Guards the UX-MEDIATOR-004 copy reframe.
    const gateLike = ['before continuing', 'before you continue', 'before posting', 'first define', 'must define', 'must narrow', 'you must', 'required'];
    const bridgeCopy = [
      DISAGREEMENT_POINTS_RAIL_COPY.clarifyPoint,
      DISAGREEMENT_POINTS_RAIL_COPY.definitionBridge,
      DISAGREEMENT_POINTS_RAIL_COPY.scopeBridge,
      DISAGREEMENT_POINTS_RAIL_COPY.definitionShort,
      DISAGREEMENT_POINTS_RAIL_COPY.scopeShort,
      DISAGREEMENT_POINTS_RAIL_COPY.alsoPrefix,
    ].map((s) => s.toLowerCase());
    for (const text of bridgeCopy) {
      for (const phrase of gateLike) expect(text.includes(phrase)).toBe(false);
    }
  });

  it('bridge prompts are person-neutral — no accusation language (UX-MEDIATOR-004 reframe)', () => {
    // The reframe treats divergent terms / scope as a SHARED structural task,
    // never an accusation. Guard every bridge string against blame phrasing.
    const accusatory = ['evasion', 'bad faith', 'fallacy', 'wrong', 'dishonest', 'non-responsive', 'off-topic', 'dodging', 'equivocat'];
    const bridgeCopy = [
      DISAGREEMENT_POINTS_RAIL_COPY.clarifyPoint,
      DISAGREEMENT_POINTS_RAIL_COPY.definitionBridge,
      DISAGREEMENT_POINTS_RAIL_COPY.scopeBridge,
      DISAGREEMENT_POINTS_RAIL_COPY.definitionShort,
      DISAGREEMENT_POINTS_RAIL_COPY.scopeShort,
    ].map((s) => s.toLowerCase());
    for (const text of bridgeCopy) {
      for (const phrase of accusatory) expect(text.includes(phrase)).toBe(false);
    }
  });

  it('leaks no internal codes and no ban-list tokens across the bridge section', () => {
    const board = makeBoard({
      points: [
        makePoint({ id: 'p1', state: 'definition_not_shared' }),
        makePoint({ id: 'p2', state: 'scope_mismatch' }),
      ],
    });
    const tree = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    ).toJSON();
    const texts = collectText(tree);
    const banned = _forbiddenMediatorTokens();
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of banned) expect(lower.includes(token)).toBe(false);
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
