/**
 * UX-BOARD-RAIL-003 — Disagreement Points distribution-segment navigation.
 *
 * The distribution strip becomes a LOCAL navigation control over the rail's own
 * row list. Pressing a segment (or its legend item) focuses that display-state
 * group, jumps the rail's own ScrollView to the first matching row, and marks
 * the matching rows "In view" — a focus / group anchor, NOT a hard filter (every
 * row stays mounted). A "Show all points" reset clears the selection.
 *
 * This suite verifies, narrowly, the navigation behavior + the doctrine guards:
 *   - segments + legend items are interactive (Pressable, role=button) and named
 *     as navigation/jump, never as scoring;
 *   - touch targets are ≥44px (hitSlop on the bar; minHeight on the legend);
 *   - selecting a segment focuses it + targets the first matching-state row, and
 *     the selected state is NOT color-only (text + geometry markers assert);
 *   - segment ORDER stays v4 priority (never count-rank);
 *   - counts are present but subordinate;
 *   - "View in timeline →" (onJump) + state badges + "Move forward:" intact;
 *   - "Show all points" reset clears the selection;
 *   - the dormant chime-in slot stays inert;
 *   - the ban-list scan over all rendered rail copy is clean.
 *
 * Render-only (RTL). No board topology, no mediator derivation touched.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// UX-BOARD-RAIL-003 — replace ScrollView with a ref-forwarding stub that exposes
// a capturable `scrollTo` spy, so we can assert the rail jumps its OWN list to
// the first matching row (host-component refs are not spyable in react-test-
// renderer). The stub renders its children as a plain View, preserving testID.
const mockScrollTo = jest.fn();
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const ReactLocal = require('react');
  const Stub = ReactLocal.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    ReactLocal.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    // Render a host "View" so children (rows) still mount and testIDs resolve;
    // the lowercase string element avoids a require('react-native') cycle.
    return ReactLocal.createElement('View', props);
  });
  Stub.displayName = 'ScrollView';
  return { __esModule: true, default: Stub };
});

import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';
import {
  _forbiddenMediatorTokens,
  plainLanguageForMediatorState,
  V4_PRIMARY_STATE_PRIORITY,
} from '../src/features/mediator';
import type {
  DisagreementPoint,
  MediatorBoardState,
  MediatorStateCode,
  ResolutionPathway,
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

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

// A multi-state board with ≥2 distinct display states (impasse + needs_evidence
// + others) so the priority-ordering + first-match navigation are observable.
function makeMultiStateBoard(): MediatorBoardState {
  const pathways: Record<string, ResolutionPathway> = {
    a: { pointId: 'a', steps: [{ code: 'provide_source', plainLabel: 'Provide a source', available: true }], anyAvailable: true },
  };
  return makeBoard(
    [
      makePoint({ id: 'a', state: 'needs_evidence', openEvidenceDebtIds: ['d1'] }),
      makePoint({ id: 'b', state: 'definition_not_shared' }),
      makePoint({ id: 'c', state: 'evidence_blocked' }),
      makePoint({ id: 'd', state: 'scope_mismatch' }),
      makePoint({ id: 'e', state: 'narrowed' }),
      makePoint({ id: 'f', state: 'structured_impasse' }),
    ],
    pathways,
  );
}

// ── 1. Segments are interactive navigation, not decorative ────

describe('UX-BOARD-RAIL-003 — distribution segments are pressable navigation', () => {
  it('every distribution segment is a button named as a jump (not a score)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    for (const state of ['structured_impasse', 'needs_evidence', 'scope_mismatch']) {
      const seg = getByTestId(`disagreement-points-rail-distribution-segment-${state}`);
      expect(seg.props.accessibilityRole).toBe('button');
      // Default (unselected) reads as a navigation jump verb.
      expect(seg.props.accessibilityLabel).toMatch(/^Jump to /);
      expect(seg.props.accessibilityState).toEqual({ selected: false });
    }
  });

  it('every legend item is also a pressable jump (button + label)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    const legend = getByTestId('disagreement-points-rail-distribution-legend-needs_evidence');
    expect(legend.props.accessibilityRole).toBe('button');
    expect(legend.props.accessibilityLabel).toMatch(/^Jump to /);
  });

  it('segment + legend touch targets are ≥44px (hitSlop on bar, minHeight on legend)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    const seg = getByTestId('disagreement-points-rail-distribution-segment-needs_evidence');
    // The 18px bar is small visually → must carry a hitSlop to reach 44×44.
    expect(seg.props.hitSlop).not.toBeNull();
    const legend = getByTestId('disagreement-points-rail-distribution-legend-needs_evidence');
    const flat = Array.isArray(legend.props.style)
      ? Object.assign({}, ...legend.props.style.filter(Boolean))
      : legend.props.style;
    expect(flat.minHeight).toBe(44);
  });

  it('the a11y labels name navigation, never scoring (no score/rank/winner tokens)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    const BANNED = ['score', 'ranked', 'rank', 'top', 'winning', 'losing', 'verdict', 'leaderboard'];
    for (const state of ['structured_impasse', 'needs_evidence']) {
      const seg = getByTestId(`disagreement-points-rail-distribution-segment-${state}`);
      const label = String(seg.props.accessibilityLabel).toLowerCase();
      for (const b of BANNED) expect(label).not.toContain(b);
    }
  });
});

// ── 2. Selecting a segment focuses it + targets the first row ──

describe('UX-BOARD-RAIL-003 — selecting a segment focuses the group', () => {
  it('pressing a segment marks it selected + shows the "Showing: <state>" anchor', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    // No anchor on the default all-points view.
    expect(() => getByTestId('disagreement-points-rail-showing')).toThrow();
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-needs_evidence'));
    // Selected segment now reads as "Showing …", not "Jump to …".
    const seg = getByTestId('disagreement-points-rail-distribution-segment-needs_evidence');
    expect(seg.props.accessibilityState).toEqual({ selected: true });
    expect(seg.props.accessibilityLabel).toMatch(/^Showing /);
    // The header anchor names the focused group as TEXT.
    const showing = getByTestId('disagreement-points-rail-showing');
    expect(collectText(showing).join('')).toBe('Showing: Needs evidence');
  });

  it('targets the FIRST matching-state row (offset measured → scrollTo y)', () => {
    mockScrollTo.mockClear();
    // Put a non-matching state first so the target is not row 0.
    const board = makeBoard([
      makePoint({ id: 'first', state: 'open' }),
      makePoint({ id: 'target', state: 'structured_impasse' }),
    ]);
    const { getByTestId } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    // Feed measured offsets via onLayout so scrollTo has a target.
    fireEvent(getByTestId('disagreement-points-rail-rowwrap-first'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 60 } },
    });
    fireEvent(getByTestId('disagreement-points-rail-rowwrap-target'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 60, width: 100, height: 60 } },
    });
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-structured_impasse'));
    // The rail scrolls its OWN ScrollView to the first matching row's offset.
    expect(mockScrollTo).toHaveBeenCalledWith({ y: 60, animated: false });
  });

  it('the first matching row carries a non-color-only "In view" text marker', () => {
    const board = makeBoard([
      makePoint({ id: 'first', state: 'open' }),
      makePoint({ id: 'target', state: 'structured_impasse' }),
    ]);
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-structured_impasse'));
    const marker = getByTestId('disagreement-points-rail-inview-target');
    // Text carries the meaning (not color): the "In view" word is rendered.
    expect(collectText(marker).join('')).toContain(DISAGREEMENT_POINTS_RAIL_COPY.inViewMarker);
    // A non-matching row gets NO in-view marker.
    expect(queryByTestId('disagreement-points-rail-inview-first')).toBeNull();
  });

  it('is a FOCUS, not a hard filter — non-matching rows stay mounted', () => {
    const board = makeBoard([
      makePoint({ id: 'open1', state: 'open' }),
      makePoint({ id: 'imp1', state: 'structured_impasse' }),
    ]);
    const { getByTestId } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-structured_impasse'));
    // Both rows still rendered after a selection (no filtering away).
    expect(getByTestId('disagreement-points-rail-row-open1')).toBeTruthy();
    expect(getByTestId('disagreement-points-rail-row-imp1')).toBeTruthy();
  });

  it('a matching row past the initial cap is revealed by the segment press (showAll)', () => {
    // 6 open points fill the initial cap; the only impasse point is row 7
    // (behind the +N more reveal). Pressing the impasse segment must reveal it.
    const points = [
      ...Array.from({ length: 6 }, (_, i) => makePoint({ id: `open${i}`, state: 'open' as const })),
      makePoint({ id: 'late-impasse', state: 'structured_impasse' }),
    ];
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail board={makeBoard(points)} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(queryByTestId('disagreement-points-rail-row-late-impasse')).toBeNull();
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-structured_impasse'));
    expect(getByTestId('disagreement-points-rail-row-late-impasse')).toBeTruthy();
    expect(getByTestId('disagreement-points-rail-inview-late-impasse')).toBeTruthy();
  });

  it('reduced motion → non-animated scroll; selection still applies', () => {
    mockScrollTo.mockClear();
    const board = makeBoard([makePoint({ id: 'imp', state: 'structured_impasse' })]);
    const { getByTestId } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    fireEvent(getByTestId('disagreement-points-rail-rowwrap-imp'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 60 } },
    });
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-structured_impasse'));
    // reduceMotionOverride → animated:false; selection (the "Showing" anchor) applies.
    expect(mockScrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    expect(getByTestId('disagreement-points-rail-showing')).toBeTruthy();
  });
});

// ── 3. Order stays v4 priority; counts subordinate ────────────

describe('UX-BOARD-RAIL-003 — order stays v4 priority, counts subordinate', () => {
  it('segments render in V4_PRIMARY_STATE_PRIORITY order even when a low-priority state has the largest count', () => {
    // needs_evidence ×3 (priority 7) vs structured_impasse ×1 (priority 1).
    const points = [
      makePoint({ id: '1', state: 'needs_evidence' }),
      makePoint({ id: '2', state: 'needs_evidence' }),
      makePoint({ id: '3', state: 'needs_evidence' }),
      makePoint({ id: '4', state: 'structured_impasse' }),
    ];
    const tree = render(
      <DisagreementPointsRail board={makeBoard(points)} defaultCollapsed={false} reduceMotionOverride />,
    ).toJSON();
    // Collect the segment testIDs in render order.
    const order: string[] = [];
    const walk = (node: unknown): void => {
      if (node == null || typeof node !== 'object') return;
      if (Array.isArray(node)) return void node.forEach(walk);
      const props = (node as { props?: Record<string, unknown> }).props ?? {};
      const id = props.testID;
      if (typeof id === 'string' && id.startsWith('disagreement-points-rail-distribution-segment-')) {
        order.push(id.replace('disagreement-points-rail-distribution-segment-', ''));
      }
      walk((node as { children?: unknown }).children);
    };
    walk(tree);
    const priorityIndex = (code: string) => V4_PRIMARY_STATE_PRIORITY.indexOf(code as never);
    expect(order.indexOf('structured_impasse')).toBeLessThan(order.indexOf('needs_evidence'));
    for (let i = 1; i < order.length; i++) {
      expect(priorityIndex(order[i - 1])).toBeLessThan(priorityIndex(order[i]));
    }
  });

  it('counts are present but subordinate (no rank / percentage in the visible copy)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    // The segment count is rendered (subordinate detail).
    const seg = getByTestId('disagreement-points-rail-distribution-segment-needs_evidence');
    expect(collectText(seg).join('')).toContain('1');
    // No percentage glyph or "rank" word in any legend/segment text.
    const legend = getByTestId('disagreement-points-rail-distribution-legend');
    const legendText = collectText(legend).join(' ').toLowerCase();
    expect(legendText).not.toContain('%');
    expect(legendText).not.toContain('rank');
    expect(legendText).not.toContain('#1');
  });
});

// ── 4. Row verbs + badges survive; reset works ────────────────

describe('UX-BOARD-RAIL-003 — row affordances intact + reset', () => {
  it('"View in timeline →" (onJump) still fires with the anchor node id', () => {
    const onJump = jest.fn();
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([
          makePoint({ id: 'p1', state: 'open', anchor: { nodeId: 'anchor-7', parentNodeId: null, targetExcerpt: null } }),
        ])}
        defaultCollapsed={false}
        reduceMotionOverride
        onJump={onJump}
      />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-row-p1'));
    expect(onJump).toHaveBeenCalledWith('anchor-7');
  });

  it('state badge + "Move forward:" lead-in remain after a selection', () => {
    const pathways: Record<string, ResolutionPathway> = {
      p1: { pointId: 'p1', steps: [{ code: 'provide_source', plainLabel: 'Provide a source', available: true }], anyAvailable: true },
    };
    const { getByTestId, getByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'needs_evidence' })], pathways)}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-needs_evidence'));
    expect(getByText('Needs evidence')).toBeTruthy();
    expect(getByText('Move forward: Provide a source')).toBeTruthy();
  });

  it('"Show all points" reset clears the selection (anchor + markers gone)', () => {
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-needs_evidence'));
    expect(getByTestId('disagreement-points-rail-showing')).toBeTruthy();
    expect(getByTestId('disagreement-points-rail-inview-a')).toBeTruthy();
    // Reset.
    const reset = getByTestId('disagreement-points-rail-show-all');
    expect(reset.props.accessibilityRole).toBe('button');
    expect(reset.props.accessibilityLabel).toBe('Show all points');
    fireEvent.press(reset);
    expect(queryByTestId('disagreement-points-rail-showing')).toBeNull();
    expect(queryByTestId('disagreement-points-rail-inview-a')).toBeNull();
    // Segment is back to the unselected "Jump to …" state.
    const seg = getByTestId('disagreement-points-rail-distribution-segment-needs_evidence');
    expect(seg.props.accessibilityState).toEqual({ selected: false });
  });
});

// ── 5. Dormant chime-in slot stays inert ──────────────────────

describe('UX-BOARD-RAIL-003 — dormant chime-in slot unchanged', () => {
  it('no chime-in marker renders without contributionKind data, even after a selection', () => {
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'needs_evidence' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-needs_evidence'));
    expect(queryByTestId('disagreement-points-rail-chimein-p1')).toBeNull();
  });
});

// ── 6. Presentation preserved (sheet vs pane) ─────────────────

describe('UX-BOARD-RAIL-003 — presentation preserved', () => {
  it('mobile sheet (390px): segment nav works inside the expanded sheet', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeMultiStateBoard()}
        windowWidth={390}
        windowHeight={844}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-needs_evidence'));
    expect(getByTestId('disagreement-points-rail-showing')).toBeTruthy();
  });

  it('tablet/wide pane: segment nav works in the docked pane and the pane stays expanded', () => {
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} presentation="pane" reduceMotionOverride />,
    );
    // Pane is expanded by default (no toggle press needed).
    expect(getByTestId('disagreement-points-rail-title')).toBeTruthy();
    expect(queryByTestId('disagreement-points-rail-toggle')).toBeNull();
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-structured_impasse'));
    expect(getByTestId('disagreement-points-rail-showing')).toBeTruthy();
  });
});

// ── 7. Ban-list scan over all rendered rail copy (with a selection) ──

describe('UX-BOARD-RAIL-003 — ban-list clean over the navigation surface', () => {
  it('no banned / snake_case token in any rendered rail string after a selection', () => {
    const { getByTestId, toJSON } = render(
      <DisagreementPointsRail board={makeMultiStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-distribution-segment-needs_evidence'));
    const texts = collectText(toJSON());
    expect(texts.length).toBeGreaterThan(0);
    const EXTRA = ['ranked', 'leaderboard', 'strongest', 'weakest', 'heat', 'popularity'];
    const banned = [..._forbiddenMediatorTokens(), ...EXTRA];
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of banned) expect(lower.includes(token)).toBe(false);
      // No raw snake_case classifier key leaks into a rendered string.
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('the new copy atoms are ban-list clean', () => {
    const banned = _forbiddenMediatorTokens();
    for (const text of [
      DISAGREEMENT_POINTS_RAIL_COPY.showAllPoints,
      DISAGREEMENT_POINTS_RAIL_COPY.showingPrefix,
      DISAGREEMENT_POINTS_RAIL_COPY.inViewMarker,
    ]) {
      const lower = text.toLowerCase();
      for (const token of banned) expect(lower.includes(token)).toBe(false);
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
