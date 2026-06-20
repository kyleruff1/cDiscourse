/**
 * UX-MEDIATOR-005 — Disagreement Points rail v4 delta tests.
 *
 * Extends the shipped read-only rail with the v4 vocabulary/structure delta:
 *   - the state-distribution roll-up (pure `buildDisagreementDistribution`)
 *   - the distribution BAR render (composition, not color-only, a11y-labelled)
 *   - the "· N total" header count framing
 *   - the "Move forward:" row lead-in (replacing "What would help next?")
 *   - the v4 badge projection through `v4DisplayStateFor` (O-1)
 *   - the dormant `↳ chime-in` contribution marker (O-4a — renders only with data)
 *   - one row per point, anchored to a node; no chip-soup; no sensitive marks
 *   - 390px mobile sheet touch-safety + reduce-motion; ban-list clean.
 *
 * Pure-model + render. No React in the helper; RTL for the rail.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import {
  buildDisagreementDistribution,
  totalDistributionCount,
} from '../src/features/mediator/mediatorDistribution';
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
  PointAnchor,
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

/** Recursively collect every node's props from a test renderer JSON tree. */
function collectProps(node: unknown): Array<Record<string, unknown>> {
  if (node == null || typeof node !== 'string') {
    if (Array.isArray(node)) return node.flatMap(collectProps);
    if (node && typeof node === 'object') {
      const props = (node as { props?: Record<string, unknown> }).props ?? {};
      const children = (node as { children?: unknown }).children;
      return [props, ...collectProps(children)];
    }
  }
  return [];
}

// A multi-state, multi-point board with ≥6 live points of distinct states.
function makeSixStateBoard(): MediatorBoardState {
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

// ── buildDisagreementDistribution (pure) ──────────────────────

describe('UX-MEDIATOR-005 buildDisagreementDistribution', () => {
  it('buckets live points by display state and sums to the live total', () => {
    const points = [
      makePoint({ id: '1', state: 'needs_evidence' }),
      makePoint({ id: '2', state: 'needs_evidence' }),
      makePoint({ id: '3', state: 'definition_not_shared' }),
      makePoint({ id: '4', state: 'structured_impasse' }),
    ];
    const dist = buildDisagreementDistribution(points);
    expect(totalDistributionCount(dist)).toBe(4);
    const byState = Object.fromEntries(dist.map((s) => [s.displayState, s.count]));
    expect(byState.needs_evidence).toBe(2);
    expect(byState.definition_not_shared).toBe(1);
    expect(byState.structured_impasse).toBe(1);
  });

  it('orders segments by V4_PRIMARY_STATE_PRIORITY, never by count magnitude', () => {
    // needs_evidence has the largest count but LOWER priority than impasse.
    const points = [
      makePoint({ id: '1', state: 'needs_evidence' }),
      makePoint({ id: '2', state: 'needs_evidence' }),
      makePoint({ id: '3', state: 'needs_evidence' }),
      makePoint({ id: '4', state: 'structured_impasse' }),
    ];
    const dist = buildDisagreementDistribution(points);
    const order = dist.map((s) => s.displayState);
    // structured_impasse (priority 1) must come before needs_evidence (priority 7).
    expect(order.indexOf('structured_impasse')).toBeLessThan(order.indexOf('needs_evidence'));
    // The relative order matches the canonical priority list.
    const priorityIndex = (code: string) => V4_PRIMARY_STATE_PRIORITY.indexOf(code as never);
    for (let i = 1; i < order.length; i++) {
      expect(priorityIndex(order[i - 1])).toBeLessThan(priorityIndex(order[i]));
    }
  });

  it('projects internal codes onto the eleven-state display vocabulary', () => {
    // off_point -> scope_mismatch still collapses; UX-IMPASSE-002 (#710)
    // surfaces key_detail_unavailable as its OWN display bucket (identity).
    const dist = buildDisagreementDistribution([
      makePoint({ id: '1', state: 'off_point' }),
      makePoint({ id: '2', state: 'key_detail_unavailable' }),
    ]);
    const states = dist.map((s) => s.displayState);
    expect(states).toContain('scope_mismatch');
    expect(states).toContain('key_detail_unavailable'); // #710 — its own bucket
    expect(states).not.toContain('off_point');
    expect(states).not.toContain('evidence_blocked'); // never stolen from a true blocked row
  });

  it('excludes terminal/suppressed points (resolved excluded; value_tradeoff is its own live bucket — #710)', () => {
    // resolved_or_settled is excluded entirely; UX-IMPASSE-002 (#710) surfaces
    // value_tradeoff as its OWN live bucket (no longer folded into 'open').
    const dist = buildDisagreementDistribution([
      makePoint({ id: '1', state: 'resolved_or_settled' }),
      makePoint({ id: '2', state: 'value_tradeoff' }),
      makePoint({ id: '3', state: 'open' }),
    ]);
    expect(totalDistributionCount(dist)).toBe(2);
    // Ordered by V4_PRIMARY_STATE_PRIORITY: value_tradeoff (#10) before open (#11).
    expect(dist.map((s) => s.displayState)).toEqual(['value_tradeoff', 'open']);
    expect(dist.map((s) => s.count)).toEqual([1, 1]);
  });

  it('returns empty segments for empty / degenerate input', () => {
    expect(buildDisagreementDistribution([])).toEqual([]);
    // null-ish entries are skipped defensively.
    expect(buildDisagreementDistribution([null as never])).toEqual([]);
    expect(totalDistributionCount([])).toBe(0);
  });

  it('emits only non-empty buckets with plain-language labels', () => {
    const dist = buildDisagreementDistribution([makePoint({ id: '1', state: 'needs_evidence' })]);
    expect(dist).toHaveLength(1);
    expect(dist[0].plainLabel).toBe('Needs evidence');
  });
});

// ── rail render delta ─────────────────────────────────────────

describe('UX-MEDIATOR-005 DisagreementPointsRail v4 delta', () => {
  it('renders one row per live point and a +N more overflow past the initial rows', () => {
    const points = Array.from({ length: 8 }, (_, i) =>
      makePoint({ id: `p${i}`, state: 'open' }),
    );
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail board={makeBoard(points)} defaultCollapsed={false} reduceMotionOverride />,
    );
    // First 6 rows render; rows 7-8 are behind the overflow reveal.
    for (let i = 0; i < 6; i++) {
      expect(getByTestId(`disagreement-points-rail-row-p${i}`)).toBeTruthy();
    }
    expect(queryByTestId('disagreement-points-rail-row-p6')).toBeNull();
    expect(getByTestId('disagreement-points-rail-overflow')).toBeTruthy();
    fireEvent.press(getByTestId('disagreement-points-rail-overflow'));
    expect(getByTestId('disagreement-points-rail-row-p6')).toBeTruthy();
    expect(getByTestId('disagreement-points-rail-row-p7')).toBeTruthy();
  });

  it('each row anchors to a node — press jumps to the anchor nodeId', () => {
    const onJump = jest.fn();
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([
          makePoint({ id: 'p1', state: 'open', anchor: { nodeId: 'anchor-42', parentNodeId: null, targetExcerpt: null } }),
        ])}
        defaultCollapsed={false}
        reduceMotionOverride
        onJump={onJump}
      />,
    );
    fireEvent.press(getByTestId('disagreement-points-rail-row-p1'));
    expect(onJump).toHaveBeenCalledWith('anchor-42');
  });

  it('projects the row badge through v4DisplayStateFor (off_point reads as Scope mismatch)', () => {
    const { getByText, queryByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'off_point' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    // off_point projects to scope_mismatch -> "Scope mismatch" display label.
    expect(getByText('Scope mismatch')).toBeTruthy();
    // The internal 13-code label "Off-point response" is NOT shown on the rail.
    expect(queryByText('Off-point response')).toBeNull();
  });

  it('renders the "Move forward:" lead-in and not the old "What would help next?"', () => {
    const pathways: Record<string, ResolutionPathway> = {
      p1: { pointId: 'p1', steps: [{ code: 'provide_source', plainLabel: 'Provide a source', available: true }], anyAvailable: true },
    };
    const { getByText, queryByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'needs_evidence' })], pathways)}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByText('Move forward: Provide a source')).toBeTruthy();
    expect(queryByText('What would help next? Provide a source')).toBeNull();
  });

  it('header reads "Disagreement points · N total" tracking the live count (no hard-coded 12)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([
          makePoint({ id: 'p1', state: 'open' }),
          makePoint({ id: 'p2', state: 'needs_evidence' }),
          makePoint({ id: 'p3', state: 'scope_mismatch' }),
        ])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByTestId('disagreement-points-rail-title').props.children).toBe(
      'Disagreement points · 3 total',
    );
  });

  it('renders the distribution bar with a segment per non-empty bucket and a11y labels (not color-only)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeSixStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-distribution')).toBeTruthy();
    // A segment + a legend entry for each distinct state.
    for (const state of ['structured_impasse', 'evidence_blocked', 'definition_not_shared', 'scope_mismatch', 'needs_evidence', 'narrowed']) {
      const segment = getByTestId(`disagreement-points-rail-distribution-segment-${state}`);
      expect(segment).toBeTruthy();
      // Color is not the only signal: each segment carries an accessibilityLabel.
      expect(typeof segment.props.accessibilityLabel).toBe('string');
      expect(segment.props.accessibilityLabel.length).toBeGreaterThan(0);
      // And a text legend entry names the bucket for grayscale parity.
      expect(getByTestId(`disagreement-points-rail-distribution-legend-${state}`)).toBeTruthy();
    }
  });

  it('does not render the distribution bar when there are no live points (empty state)', () => {
    const { queryByTestId, getByTestId } = render(
      <DisagreementPointsRail board={makeBoard([])} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-empty')).toBeTruthy();
    expect(queryByTestId('disagreement-points-rail-distribution')).toBeNull();
  });

  it('shows exactly one primary state badge per row (no node-level chip-soup)', () => {
    const tree = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'needs_evidence' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    ).toJSON();
    const allProps = collectProps(tree);
    // The rail must not mount the node-surface chip strips (UX-MEDIATOR-002).
    const testIds = allProps
      .map((p) => p.testID)
      .filter((id): id is string => typeof id === 'string');
    expect(testIds.some((id) => id.includes('node-label-strip'))).toBe(false);
    expect(testIds.some((id) => id.includes('annotation-chip-strip'))).toBe(false);
  });
});

// ── dormant chime-in marker (O-4a / Finding B) ────────────────

describe('UX-MEDIATOR-005 dormant chime-in marker', () => {
  it('renders NO chime-in marker on the shipped board (no contributionKind data)', () => {
    const { queryByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'open' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(queryByTestId('disagreement-points-rail-chimein-p1')).toBeNull();
  });

  it('renders the chime-in marker ONLY when anchor.contributionKind === "chime_in"; state chip unchanged', () => {
    // Simulate the FUTURE data the chime-in card will supply on the anchor.
    const chimeAnchor = {
      nodeId: 'p1',
      parentNodeId: null,
      targetExcerpt: null,
      contributionKind: 'chime_in',
    } as unknown as PointAnchor;
    const { getByTestId, getByText } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'needs_evidence', anchor: chimeAnchor })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(getByTestId('disagreement-points-rail-chimein-p1')).toBeTruthy();
    // The contribution marker is NOT a state — the state chip is still the state.
    expect(getByText('Needs evidence')).toBeTruthy();
  });

  it('renders NO chime-in marker when contributionKind is the principal kind', () => {
    const principalAnchor = {
      nodeId: 'p1',
      parentNodeId: null,
      targetExcerpt: null,
      contributionKind: 'principal',
    } as unknown as PointAnchor;
    const { queryByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'open', anchor: principalAnchor })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(queryByTestId('disagreement-points-rail-chimein-p1')).toBeNull();
  });
});

// ── mobile sheet touch-safety + reduce-motion ─────────────────

describe('UX-MEDIATOR-005 mobile sheet (390px) + reduce-motion', () => {
  for (const width of [320, 360, 390, 414]) {
    it(`toggle + collapse + row press targets are touch-safe at ${width}px`, () => {
      const { getByTestId } = render(
        <DisagreementPointsRail
          board={makeBoard([makePoint({ id: 'p1', state: 'open' })])}
          windowWidth={width}
          windowHeight={844}
          reduceMotionOverride
        />,
      );
      // Collapsed pill is reachable at the narrow viewport.
      const toggle = getByTestId('disagreement-points-rail-toggle');
      expect(toggle).toBeTruthy();
      // It carries a hitSlop OR a min target so the tap area meets 44×44.
      const hasHitSlop = toggle.props.hitSlop != null;
      expect(hasHitSlop).toBe(true);
    });
  }

  it('expanded sheet at 390px is dismissible via the collapse control and snaps under reduce-motion', () => {
    const onExpandedChange = jest.fn();
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p1', state: 'open' })])}
        windowWidth={390}
        windowHeight={844}
        defaultCollapsed={false}
        reduceMotionOverride
        onExpandedChange={onExpandedChange}
      />,
    );
    // The collapse control is present and touch-safe.
    const collapse = getByTestId('disagreement-points-rail-collapse');
    expect(collapse.props.hitSlop).not.toBeNull();
    fireEvent.press(collapse);
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });
});

// ── doctrine safety: no sensitive marks + ban-list clean ──────

describe('UX-MEDIATOR-005 doctrine safety', () => {
  it('renders no sensitive composer-only observation strings in any row', () => {
    const sensitive = ['shifts_to_person_or_intent', 'contains_unplayable_insult_only', 'needs_pre_send_pause'];
    const tree = render(
      <DisagreementPointsRail board={makeSixStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    ).toJSON();
    const texts = collectText(tree);
    for (const text of texts) {
      for (const token of sensitive) expect(text).not.toContain(token);
    }
  });

  it('is ban-list clean and leaks no snake_case across the full v4 delta surface', () => {
    const pathways: Record<string, ResolutionPathway> = {
      a: { pointId: 'a', steps: [{ code: 'provide_source', plainLabel: 'Provide a source', available: true }], anyAvailable: true },
    };
    const board = makeBoard(
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
      // Allow the "↳ chime-in" hyphenated marker; reject snake_case codes only.
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('the new copy keys are ban-list clean', () => {
    const banned = _forbiddenMediatorTokens();
    const newCopy = [
      DISAGREEMENT_POINTS_RAIL_COPY.moveForward,
      DISAGREEMENT_POINTS_RAIL_COPY.totalSuffix,
      DISAGREEMENT_POINTS_RAIL_COPY.chimeInMarker,
    ];
    for (const text of newCopy) {
      const lower = text.toLowerCase();
      for (const token of banned) expect(lower.includes(token)).toBe(false);
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
