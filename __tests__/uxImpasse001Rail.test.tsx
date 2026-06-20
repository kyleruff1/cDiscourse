/**
 * UX-IMPASSE-001 (#689) — DisagreementPointsRail dignified-impasse render.
 *
 * The empty "Move forward:" row for a structured-impasse point (its only pathway
 * step is unavailable, so `nextStepLabelFor` returns '') now renders the
 * dignified preserve/reopen line in the existing row body. Guards: the line never
 * renders on a non-impasse point, never renders on an impasse point that still
 * has an available pathway step, and the deferred subtypes do NOT surface a new
 * primary chip at render time.
 *
 * Render test over a pre-built MediatorBoardState. No new surface, no relocation.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';
import {
  _forbiddenMediatorTokens,
  plainLanguageForMediatorState,
  VALUE_TRADEOFF_DISPLAY_COPY,
  KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY,
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

/** The shipped impasse pathway: a single unavailable `await_record` step. */
const IMPASSE_PATHWAY = (pointId: string): ResolutionPathway => ({
  pointId,
  steps: [{ code: 'await_record', plainLabel: 'A primary record would distinguish these claims', available: false }],
  anyAvailable: false,
});

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

describe('UX-IMPASSE-001 — rail dignified-impasse render', () => {
  it('shows the dignified preserve + reopen line on an impasse row (not an empty Move-forward)', () => {
    const { getByTestId, getByText, queryByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'structured_impasse' })], {
          n1: IMPASSE_PATHWAY('n1'),
        })}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByTestId('disagreement-points-rail-impasse-n1')).toBeTruthy();
    expect(getByText(DISAGREEMENT_POINTS_RAIL_COPY.impassePreserved)).toBeTruthy();
    expect(getByText(DISAGREEMENT_POINTS_RAIL_COPY.impasseReopen)).toBeTruthy();
    // The empty "Move forward:" lead-in is NOT rendered for the impasse row.
    expect(queryByText(/^Move forward:/)).toBeNull();
    // The chip still reads "Structured impasse" (single calm chip, no soup).
    expect(getByText('Structured impasse')).toBeTruthy();
  });

  it('also renders the dignified line when the board carries no pathway entry for the point', () => {
    // No pathway entry => nextStepLabel '' + anyAvailable falsy => still impasse.
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'structured_impasse' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByTestId('disagreement-points-rail-impasse-n1')).toBeTruthy();
  });

  it('does NOT render the impasse line on a non-impasse point (Open)', () => {
    const { queryByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(queryByTestId('disagreement-points-rail-impasse-n1')).toBeNull();
  });

  it('does NOT render the impasse line when an impasse point still has an available pathway step', () => {
    // Defensive parity with deriveImpasseMarkers: an available step means the
    // point is not actually at impasse for display purposes — show the step, not
    // the preserve line.
    const pathways: Record<string, ResolutionPathway> = {
      n1: {
        pointId: 'n1',
        steps: [{ code: 'provide_source', plainLabel: 'Add a source.', available: true }],
        anyAvailable: true,
      },
    };
    const { queryByTestId, getByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'structured_impasse' })], pathways)}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(queryByTestId('disagreement-points-rail-impasse-n1')).toBeNull();
    // The ordinary "Move forward:" line shows instead.
    expect(getByText('Move forward: Add a source.')).toBeTruthy();
  });

  it('SURFACING PROOF (#710) — a value_tradeoff point renders its own "Different priorities" chip and NO impasse line', () => {
    const { queryByTestId, queryByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'value_tradeoff' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    // Surfacing a more specific state never escalates to an impasse line.
    expect(queryByTestId('disagreement-points-rail-impasse-n1')).toBeNull();
    // The surfaced chip text appears as the rail badge.
    expect(queryByText(VALUE_TRADEOFF_DISPLAY_COPY.chip)).toBeTruthy();
    // It is no longer folded into "Open".
    expect(queryByText('Open')).toBeNull();
  });

  it('SURFACING PROOF (#710) — a key_detail_unavailable point renders its own "Key detail unavailable" chip, distinct from Evidence blocked', () => {
    const { queryByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'key_detail_unavailable' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    // The surfaced distinct chip text appears...
    expect(queryByText(KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY.chip)).toBeTruthy();
    // ...and it no longer folds into the "Evidence blocked" label.
    expect(queryByText('Evidence blocked')).toBeNull();
  });

  it('the impasse row text is ban-list clean (no deadlock / failure / verdict tokens)', () => {
    const tree = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'structured_impasse' })], {
          n1: IMPASSE_PATHWAY('n1'),
        })}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    ).toJSON();
    const texts = collectText(tree);
    const banned = _forbiddenMediatorTokens();
    const cardBan = ['deadlock', 'failure', 'failed', 'verdict', 'dead end', 'give up'];
    for (const text of texts) {
      const lower = text.toLowerCase().split('right now').join('');
      for (const token of [...banned, ...cardBan]) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  });

  it('keeps the single jump Pressable and the existing row testID intact on an impasse row', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'structured_impasse' })], {
          n1: IMPASSE_PATHWAY('n1'),
        })}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    // The jump Pressable (row) is unchanged — no new interactive element added.
    expect(getByTestId('disagreement-points-rail-row-n1')).toBeTruthy();
  });
});
