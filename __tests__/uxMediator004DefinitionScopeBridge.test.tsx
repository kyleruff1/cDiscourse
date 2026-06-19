/**
 * UX-MEDIATOR-004 — definition/scope bridge copy + "Definition not shared".
 *
 * This card lands two narrow things (copy/label only — no model, precedence,
 * node-chip selection, or rail-structure change):
 *   1. the deferred visible label rename `definition_not_shared`:
 *      "Definition needed" → "Definition not shared" (the deterministic CODE is
 *      unchanged) — flows from the one central map to the node chip, the Inspect
 *      detail, and the rail row badge;
 *   2. the definition/scope bridge prompts reframed as person-neutral BRIDGES
 *      (advisory, never a posting gate, never an accusation).
 *
 * These tests assert the v4 contract end-to-end: the rename appears on every
 * surface that consumes the central map, the rail bridge copy matches the v4
 * strings (side + sheet parity), the bridge / help strings are ban-list clean
 * and person-neutral (no "wrong" / "evasion" / "off-topic" / etc.), one node
 * carries exactly one chip (no chip soup regression), and an insufficient
 * signal still resolves to Open with no bridge block.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { MediatorNodeMarker } from '../src/features/mediator/MediatorNodeMarker';
import { MediatorNodeInspectDetail } from '../src/features/mediator/MediatorNodeInspectDetail';
import { getNodeMediatorMarker } from '../src/features/mediator/nodeMediatorMarkers';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';
import {
  MEDIATOR_STATE_COPY,
  MEDIATOR_STATE_HELPER,
  _forbiddenMediatorTokens,
  helperForMediatorState,
  plainLanguageForMediatorState,
} from '../src/features/mediator';
import type {
  DisagreementPoint,
  MediatorBoardState,
  MediatorMarkup,
  MediatorStateCode,
} from '../src/features/mediator';

// ── fixtures ──────────────────────────────────────────────────

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

function makeMarkup(
  p: Partial<MediatorMarkup> & { nodeId: string; primaryState: MediatorStateCode },
): MediatorMarkup {
  return {
    nodeId: p.nodeId,
    pointId: p.pointId ?? p.nodeId,
    primaryState: p.primaryState,
    deviation: p.deviation ?? null,
    evidenceDebtChipStatus: p.evidenceDebtChipStatus ?? null,
    confidence: p.confidence ?? 'medium',
  };
}

function makePointBoard(points: DisagreementPoint[]): MediatorBoardState {
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

function makeMarkupBoard(markups: MediatorMarkup[]): MediatorBoardState {
  const markupByNodeId: Record<string, MediatorMarkup> = {};
  for (const m of markups) markupByNodeId[m.nodeId] = m;
  return {
    debateId: 'debate-1',
    points: [],
    markupByNodeId,
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

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

// The exact v4 copy strings this card lands (single source of truth for the
// assertions below — also asserts the copy map equals these verbatim).
const V4_DEFINITION_LABEL = 'Definition not shared';
const V4_SCOPE_LABEL = 'Scope mismatch';
const V4_DEFINITION_BRIDGE = 'The key term is not yet shared. Define the key term together.';
const V4_SCOPE_BRIDGE =
  'This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.';

// ── 1. central label rename (the one map every surface reads) ──

describe('UX-MEDIATOR-004 — central label rename', () => {
  it('maps definition_not_shared to "Definition not shared" (code unchanged)', () => {
    expect(plainLanguageForMediatorState('definition_not_shared')).toBe(V4_DEFINITION_LABEL);
    expect(MEDIATOR_STATE_COPY.definition_not_shared).toBe(V4_DEFINITION_LABEL);
  });

  it('keeps "Scope mismatch" as the already-v4 scope label', () => {
    expect(plainLanguageForMediatorState('scope_mismatch')).toBe(V4_SCOPE_LABEL);
  });

  it('the rail short labels match the chip vocabulary (rows read the same label as the chip)', () => {
    expect(DISAGREEMENT_POINTS_RAIL_COPY.definitionShort).toBe(V4_DEFINITION_LABEL);
    expect(DISAGREEMENT_POINTS_RAIL_COPY.scopeShort).toBe(V4_SCOPE_LABEL);
  });
});

// ── 2. the rename flows to the node chip + Inspect detail ──────

describe('UX-MEDIATOR-004 — rename flows to node surfaces', () => {
  it('the node chip shows "Definition not shared" (inherits the central map)', () => {
    const board = makeMarkupBoard([makeMarkup({ nodeId: 'n1', primaryState: 'definition_not_shared' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    expect(marker?.code).toBe('definition_not_shared');
    expect(marker?.label).toBe(V4_DEFINITION_LABEL);
    const { getByText } = render(<MediatorNodeMarker marker={marker} />);
    expect(getByText(V4_DEFINITION_LABEL)).toBeTruthy();
  });

  it('a definition_not_shared node carries exactly ONE chip (no chip soup regression)', () => {
    const board = makeMarkupBoard([makeMarkup({ nodeId: 'n1', primaryState: 'definition_not_shared' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    const tree = render(<MediatorNodeMarker marker={marker} />).toJSON();
    const markerNodes = collectText(tree).filter((t) => t === V4_DEFINITION_LABEL);
    expect(markerNodes).toHaveLength(1);
  });

  it('the Inspect detail shows "Definition not shared" + the v4 bridge rationale (O-2a)', () => {
    const board = makeMarkupBoard([makeMarkup({ nodeId: 'n1', primaryState: 'definition_not_shared' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    const { getByText } = render(
      <MediatorNodeInspectDetail
        marker={marker}
        helper={helperForMediatorState('definition_not_shared')}
        nextMoveLabel="Define the term"
      />,
    );
    expect(getByText(V4_DEFINITION_LABEL)).toBeTruthy();
    // O-2a: the bridge rationale surfaces in the Inspect detail via the helper map.
    expect(getByText('A shared definition would make this point easier to test.')).toBeTruthy();
  });

  it('the Inspect detail shows the scope bridge rationale (O-2a, person-neutral)', () => {
    const board = makeMarkupBoard([makeMarkup({ nodeId: 'n1', primaryState: 'scope_mismatch' })]);
    const marker = getNodeMediatorMarker(board, 'n1');
    const { getByText } = render(
      <MediatorNodeInspectDetail
        marker={marker}
        helper={helperForMediatorState('scope_mismatch')}
        nextMoveLabel="Narrow or branch the claim"
      />,
    );
    expect(getByText('A scope bridge keeps the reply anchored to the exact point.')).toBeTruthy();
  });
});

// ── 3. rail row badge inherits the rename (v4RowBadgeLabel) ────

describe('UX-MEDIATOR-004 — rail row badge inherits the rename', () => {
  it('the row badge for a definition point reads "Definition not shared"', () => {
    const board = makePointBoard([makePoint({ id: 'p1', state: 'definition_not_shared' })]);
    const { getByTestId, getByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    // The row wrapper exists; the badge text is the renamed label.
    expect(getByTestId('disagreement-points-rail-row-p1')).toBeTruthy();
    expect(getByText(V4_DEFINITION_LABEL)).toBeTruthy();
  });
});

// ── 4. bridge copy reframe (rail side + sheet parity) ─────────

describe('UX-MEDIATOR-004 — bridge copy reframe (side + sheet)', () => {
  it('definition bridge renders the v4 composed prompt (side variant)', () => {
    const board = makePointBoard([makePoint({ id: 'p1', state: 'definition_not_shared' })]);
    const { getByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByText('Clarify the point')).toBeTruthy();
    expect(getByText(V4_DEFINITION_BRIDGE)).toBeTruthy();
  });

  it('scope bridge renders the v4 prose prompt (side variant)', () => {
    const board = makePointBoard([makePoint({ id: 'p1', state: 'scope_mismatch' })]);
    const { getByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByText(V4_SCOPE_BRIDGE)).toBeTruthy();
  });

  it('the sheet variant (390px) renders identical bridge copy (one component → parity)', () => {
    const board = makePointBoard([makePoint({ id: 'p1', state: 'definition_not_shared' })]);
    const { getByText } = render(
      <DisagreementPointsRail
        board={board}
        windowWidth={390}
        windowHeight={844}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByText(V4_DEFINITION_BRIDGE)).toBeTruthy();
  });

  it('the copy slots equal the v4 strings verbatim', () => {
    expect(DISAGREEMENT_POINTS_RAIL_COPY.definitionBridge).toBe(V4_DEFINITION_BRIDGE);
    expect(DISAGREEMENT_POINTS_RAIL_COPY.scopeBridge).toBe(V4_SCOPE_BRIDGE);
  });
});

// ── 5. person-neutral + ban-list clean (doctrine) ─────────────

describe('UX-MEDIATOR-004 — person-neutral + ban-list clean', () => {
  it('every new bridge / help string is ban-list clean (no verdict / person token)', () => {
    const strings = [
      MEDIATOR_STATE_COPY.definition_not_shared,
      MEDIATOR_STATE_COPY.scope_mismatch,
      MEDIATOR_STATE_HELPER.definition_not_shared,
      MEDIATOR_STATE_HELPER.scope_mismatch,
      DISAGREEMENT_POINTS_RAIL_COPY.definitionBridge,
      DISAGREEMENT_POINTS_RAIL_COPY.scopeBridge,
      DISAGREEMENT_POINTS_RAIL_COPY.definitionShort,
      DISAGREEMENT_POINTS_RAIL_COPY.scopeShort,
      DISAGREEMENT_POINTS_RAIL_COPY.clarifyPoint,
    ];
    const banned = _forbiddenMediatorTokens();
    for (const s of strings) {
      const lower = s.toLowerCase();
      for (const token of banned) expect(lower.includes(token)).toBe(false);
      expect(s).not.toMatch(/[a-z]+_[a-z]+/); // no raw snake_case code
    }
  });

  it('the scope help line drops the person clause — contains no "wrong" (O-1)', () => {
    // Operator-confirmed: the person clause is dropped entirely; the rationale
    // must never contain "wrong" (or "right"), which the ban-list forbids.
    const help = MEDIATOR_STATE_HELPER.scope_mismatch.toLowerCase();
    expect(help.includes('wrong')).toBe(false);
    expect(help.includes('right')).toBe(false);
    expect(help).toBe('a scope bridge keeps the reply anchored to the exact point.');
  });

  it('no bridge string reads as an accusation (UX-MEDIATOR-004 reframe)', () => {
    const accusatory = ['evasion', 'bad faith', 'fallacy', 'dishonest', 'non-responsive', 'off-topic', 'dodging', 'equivocat'];
    const strings = [
      MEDIATOR_STATE_HELPER.definition_not_shared,
      MEDIATOR_STATE_HELPER.scope_mismatch,
      DISAGREEMENT_POINTS_RAIL_COPY.definitionBridge,
      DISAGREEMENT_POINTS_RAIL_COPY.scopeBridge,
    ].map((s) => s.toLowerCase());
    for (const s of strings) {
      for (const phrase of accusatory) expect(s.includes(phrase)).toBe(false);
    }
  });

  it('leaks no internal codes / ban-list tokens across the rendered bridge section', () => {
    const board = makePointBoard([
      makePoint({ id: 'p1', state: 'definition_not_shared' }),
      makePoint({ id: 'p2', state: 'scope_mismatch' }),
    ]);
    const tree = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    ).toJSON();
    const banned = _forbiddenMediatorTokens();
    for (const text of collectText(tree)) {
      const lower = text.toLowerCase();
      for (const token of banned) expect(lower.includes(token)).toBe(false);
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

// ── 6. insufficient signal → Open, no bridge (regression) ─────

describe('UX-MEDIATOR-004 — insufficient signal stays Open', () => {
  it('an ordinary open point renders no bridge block (no invented accusation)', () => {
    const board = makePointBoard([makePoint({ id: 'p1', state: 'open' })]);
    const { queryByTestId } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(queryByTestId('disagreement-points-rail-bridge-p1')).toBeNull();
  });
});
