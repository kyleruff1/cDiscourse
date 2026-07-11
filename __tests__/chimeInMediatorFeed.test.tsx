/**
 * CHIMEIN-P8 Round 2 (#761) — mediator DisagreementPointsRail contributionKind
 * feed (design 4.2 clause 3).
 *
 * The rail renders the '↳ chime-in' marker on a point whose anchor node is a
 * chime CONTENT argument, fed by the new `contributionKindByNodeId` adapter map.
 * Byte-identical (no marker) when the map is absent / empty / non-matching — the
 * firing negative controls prove the feed is what lights the marker.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';
import type {
  DisagreementPoint,
  MediatorBoardState,
  MediatorStateCode,
} from '../src/features/mediator';
import { plainLanguageForMediatorState } from '../src/features/mediator';

const CHIME_ARG = 'chime-content-arg';
const CHIME_MARKER = DISAGREEMENT_POINTS_RAIL_COPY.chimeInMarker; // '↳ chime-in'

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

function makeBoard(points: DisagreementPoint[]): MediatorBoardState {
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
    pathwaysByPointId: {},
    nextAction: null,
    inputHash: 'h1',
  };
}

// A live point whose anchor node IS the chime content argument.
const BOARD = makeBoard([
  makePoint({ id: 'p1', state: 'needs_evidence', anchor: { nodeId: CHIME_ARG, parentNodeId: null, targetExcerpt: null } }),
]);

describe('CHIMEIN-P8 — mediator contributionKind feed', () => {
  it('renders NO chime marker when the feed is absent (byte-identical dormant)', () => {
    const { queryByText } = render(
      <DisagreementPointsRail board={BOARD} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(queryByText(CHIME_MARKER)).toBeNull();
  });

  it('renders NO chime marker for an empty feed map', () => {
    const { queryByText } = render(
      <DisagreementPointsRail
        board={BOARD}
        defaultCollapsed={false}
        reduceMotionOverride
        contributionKindByNodeId={{}}
      />,
    );
    expect(queryByText(CHIME_MARKER)).toBeNull();
  });

  it('renders the chime marker when the anchor node is fed as a chime-in', () => {
    const { getByText } = render(
      <DisagreementPointsRail
        board={BOARD}
        defaultCollapsed={false}
        reduceMotionOverride
        contributionKindByNodeId={{ [CHIME_ARG]: 'chime_in' }}
      />,
    );
    expect(getByText(CHIME_MARKER)).toBeTruthy();
  });

  it('NEGATIVE CONTROL: a non-matching feed key lights no marker (only the anchor node counts)', () => {
    const { queryByText } = render(
      <DisagreementPointsRail
        board={BOARD}
        defaultCollapsed={false}
        reduceMotionOverride
        contributionKindByNodeId={{ 'some-other-arg': 'chime_in' }}
      />,
    );
    expect(queryByText(CHIME_MARKER)).toBeNull();
  });
});
