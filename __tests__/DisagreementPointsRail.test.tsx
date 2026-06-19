/**
 * UX-MEDIATOR-005 — DisagreementPointsRail component tests.
 *
 * Read-only rail over a pre-built MediatorBoardState. Verifies collapsed-by-
 * default behavior, the three primary v1 states, resolved-point filtering,
 * empty/unavailable states, the jump verb, and doctrine safety (no internal
 * codes, ban-list clean) over rendered text.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import {
  _forbiddenMediatorTokens,
  plainLanguageForMediatorState,
} from '../src/features/mediator';
import type {
  DisagreementPoint,
  MediatorBoardState,
  MediatorStateCode,
  ResolutionPathway,
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

function makeBoard(
  points: DisagreementPoint[],
  pathways?: Record<string, ResolutionPathway>,
): MediatorBoardState {
  return {
    debateId: 'debate-1',
    points,
    markupByNodeId: {},
    evidenceDebts: [],
    blockedEvidencePaths: [],
    definitionMismatches: [],
    scopeMismatches: [],
    recollectionConflicts: [],
    nonProvableKeyDetails: [],
    impasses: [],
    pathwaysByPointId: pathways ?? {},
    nextAction: null,
    inputHash: 'h1',
  };
}

/** Recursively collect every rendered string from a test renderer JSON tree. */
function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') {
    const children = (node as { children?: unknown }).children;
    return collectText(children);
  }
  return [];
}

describe('UX-MEDIATOR-005 DisagreementPointsRail', () => {
  it('is collapsed by default (shows the toggle pill, not the expanded list)', () => {
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail board={makeBoard([makePoint({ id: 'n1', state: 'open' })])} />,
    );
    expect(getByTestId('disagreement-points-rail-toggle')).toBeTruthy();
    expect(queryByTestId('disagreement-points-rail-title')).toBeNull();
  });

  it('renders the empty state when there are no live points', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeBoard([])} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-empty')).toBeTruthy();
  });

  it('renders an Open point', () => {
    const { getByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByText('Open')).toBeTruthy();
  });

  it('renders a Needs evidence point', () => {
    const { getByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'needs_evidence', openEvidenceDebtIds: ['d1'] })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByText('Needs evidence')).toBeTruthy();
    expect(getByText('1 evidence request')).toBeTruthy();
  });

  it('renders a Structured impasse point', () => {
    const { getByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'structured_impasse' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByText('Structured impasse')).toBeTruthy();
  });

  it('filters out resolved/settled points (board with only resolved → empty state)', () => {
    const { getByTestId, queryByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'resolved_or_settled' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByTestId('disagreement-points-rail-empty')).toBeTruthy();
    expect(queryByText('Resolved')).toBeNull();
  });

  it('fires onJump with the point anchor node id when a row is pressed', () => {
    const onJump = jest.fn();
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([
          makePoint({ id: 'n1', state: 'open', anchor: { nodeId: 'anchor-9', parentNodeId: null, targetExcerpt: null } }),
        ])}
        defaultCollapsed={false}
        reduceMotionOverride
        onJump={onJump}
      />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-row-n1'));
    expect(onJump).toHaveBeenCalledWith('anchor-9');
  });

  it('shows the unavailable state when the board is null', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={null} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-unavailable')).toBeTruthy();
  });

  it('marks the point anchored to the active node as currently active', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open', memberNodeIds: ['n1', 'n2'] })])}
        defaultCollapsed={false}
        reduceMotionOverride
        activeNodeId="n2"
      />,
    );
    expect(getByTestId('disagreement-points-rail-active-n1')).toBeTruthy();
  });

  // ── UX-BOARD-RAIL-002 — additive `presentation` prop cases ──

  it('presentation="pane" renders expanded-by-default as a column child (no toggle press needed)', () => {
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open' })])}
        presentation="pane"
        reduceMotionOverride
      />,
    );
    // The root + expanded content render without first pressing the toggle.
    expect(getByTestId('disagreement-points-rail')).toBeTruthy();
    expect(getByTestId('disagreement-points-rail-title')).toBeTruthy();
    // No collapsed pill in the default-expanded pane.
    expect(queryByTestId('disagreement-points-rail-toggle')).toBeNull();
  });

  it('presentation="pane" ignores isAnyPanelOpen (a docked column is not in the bottom group)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open' })])}
        presentation="pane"
        isAnyPanelOpen
        reduceMotionOverride
      />,
    );
    // Still expanded even though isAnyPanelOpen is true — the pane cannot be
    // force-collapsed by a sibling bottom rail.
    expect(getByTestId('disagreement-points-rail-title')).toBeTruthy();
  });

  it('presentation="pane" renders the empty-state pane (stable geometry, no collapse to zero)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeBoard([])} presentation="pane" reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-empty')).toBeTruthy();
  });

  it('presentation="pane" carries the pane root (left geometry border), not the side bottom-overlay cues', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open' })])}
        presentation="pane"
        reduceMotionOverride
      />,
    );
    const root = getByTestId('disagreement-points-rail');
    const flat = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style.filter(Boolean))
      : root.props.style;
    // The pane wrapper carries a LEFT geometry border and drops the top border.
    expect(flat.borderLeftWidth).toBeGreaterThan(0);
    expect(flat.borderTopWidth).toBe(0);
    // The column owns the width — the pane root does not pin width:380 or
    // alignSelf:'flex-end' (the 'side' bottom-overlay cues).
    expect(flat.width).toBeUndefined();
    expect(flat.alignSelf).toBe('stretch');
  });

  it('presentation="sheet" (default) stays collapsed-by-default and honors isAnyPanelOpen (byte-identity)', () => {
    // Default prop: collapsed pill present, expanded title absent.
    const def = render(
      <DisagreementPointsRail board={makeBoard([makePoint({ id: 'n1', state: 'open' })])} />,
    );
    expect(def.getByTestId('disagreement-points-rail-toggle')).toBeTruthy();
    expect(def.queryByTestId('disagreement-points-rail-title')).toBeNull();

    // Explicit sheet + expanded + isAnyPanelOpen → force-collapsed (today's
    // mutual-exclusion behavior, unchanged).
    const forced = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open' })])}
        presentation="sheet"
        defaultCollapsed={false}
        isAnyPanelOpen
        reduceMotionOverride
      />,
    );
    expect(forced.queryByTestId('disagreement-points-rail-title')).toBeNull();
    expect(forced.getByTestId('disagreement-points-rail-toggle')).toBeTruthy();
  });

  it('renders no internal codes and no ban-list tokens in any visible text', () => {
    const pathways: Record<string, ResolutionPathway> = {
      a: { pointId: 'a', steps: [{ code: 'provide_source', plainLabel: 'Provide a source', available: true }], anyAvailable: true },
    };
    const board = makeBoard(
      [
        makePoint({ id: 'a', state: 'needs_evidence', openEvidenceDebtIds: ['d1'] }),
        makePoint({ id: 'b', state: 'scope_mismatch' }),
        makePoint({ id: 'c', state: 'structured_impasse' }),
        makePoint({ id: 'd', state: 'evidence_blocked' }),
        makePoint({ id: 'e', state: 'definition_not_shared' }),
      ],
      pathways,
    );
    const tree = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    ).toJSON();
    const texts = collectText(tree);
    expect(texts.length).toBeGreaterThan(0);
    const banned = _forbiddenMediatorTokens();
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of banned) {
        expect(lower.includes(token)).toBe(false);
      }
      // No raw snake_case internal code leaks (e.g. needs_evidence, point_exhausted).
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
