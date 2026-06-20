/**
 * UX-MEDIATOR-003 — evidence-debt / evidence-blocked detail (display-layer).
 *
 * Pins the narrow copy delta for the two evidence states the mediator board
 * surfaces: "Needs evidence" (a point owes a source/record — a structural
 * obligation, never a person failing) and "Evidence blocked" (the record that
 * would test the point is not available right now — an unavailable PATH, never
 * anyone hiding / withholding / concealing / refusing / failing to provide).
 *
 * DISPLAY-LAYER ONLY. No persistence, no migration, no model/type change. The
 * advisory "Mark evidence unavailable." next move ships as COPY ONLY — the
 * persisted write is deferred to a GATE-C card.
 *
 * Doctrine: person-neutral; describes the evidence PATH, never anyone's
 * conduct; carries NO reassurance / negation line (per operator: even a
 * negation surfaces the accusation); engagement credit and factual-standing
 * credit are never conflated in a visible string (evidence-doctrine).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import {
  MEDIATOR_STATE_COPY,
  MEDIATOR_STATE_HELPER,
  PATHWAY_STEP_COPY,
  _forbiddenMediatorTokens,
  deriveMediatorBoardState,
  helperForMediatorState,
  plainLanguageForMediatorState,
  v4DisplayStateFor,
} from '../src/features/mediator';
import { DISAGREEMENT_POINTS_RAIL_COPY } from '../src/features/mediator/mediatorRailCopy';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { MediatorNodeInspectDetail } from '../src/features/mediator/MediatorNodeInspectDetail';
import { getNodeMediatorMarker } from '../src/features/mediator/nodeMediatorMarkers';
import type {
  MediatorGraphInput,
  MediatorGraphNode,
  MediatorObservationInput,
} from '../src/features/mediator';
import type { EvidenceDebt } from '../src/features/evidence/evidenceDebtModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
} from '../src/features/lifecycle/pointLifecycleModel';
import type { MachineObservationFamily } from '../src/features/nodeLabels/nodeLabelTypes';

// ── Fixture builders (mirror mediatorBoardState.test.ts) ──────────────────

function makeNode(p: Partial<MediatorGraphNode> & { messageId: string }): MediatorGraphNode {
  return {
    messageId: p.messageId,
    parentId: p.parentId ?? null,
    ordinal: p.ordinal ?? 0,
    branchRootMessageId: p.branchRootMessageId ?? p.messageId,
    kindLabel: p.kindLabel ?? 'Claim',
    sideLabel: p.sideLabel ?? 'Aff',
    isRoot: p.isRoot ?? p.parentId == null,
    replyCount: p.replyCount ?? 0,
    descendantCount: p.descendantCount ?? 0,
    targetExcerpt: p.targetExcerpt ?? null,
  };
}

function makeCluster(
  p: Partial<PointLifecycleClusterSummary> & { clusterId: string },
): PointLifecycleClusterSummary {
  const messageIds = p.messageIds ?? [p.clusterId];
  return {
    clusterId: p.clusterId,
    rootMessageId: p.rootMessageId ?? p.clusterId,
    state: p.state ?? 'open',
    plainLabel: p.plainLabel ?? 'Open for response',
    messageIds,
    memberCount: p.memberCount ?? messageIds.length,
    affirmativeMoveCount: p.affirmativeMoveCount ?? 0,
    negativeMoveCount: p.negativeMoveCount ?? 0,
    observerMoveCount: p.observerMoveCount ?? 0,
    hasOpenSourceOrQuoteRequest: p.hasOpenSourceOrQuoteRequest ?? false,
    hasConcessionOrSynthesisMove: p.hasConcessionOrSynthesisMove ?? false,
    worstEvidenceStatus: p.worstEvidenceStatus ?? 'no_source',
    primaryAxis: p.primaryAxis ?? null,
    isAdvisory: p.isAdvisory ?? false,
  };
}

function makeLifecycle(clusters: PointLifecycleClusterSummary[]): PointLifecycleMap {
  const byCluster = new Map<string, PointLifecycleClusterSummary>();
  for (const c of clusters) byCluster.set(c.clusterId, c);
  return {
    byCluster,
    byMessage: new Map(),
    clusterOrder: clusters.map((c) => c.clusterId),
    cumulativeStateSequence: clusters.map((c) => c.state),
    inputHash: 'lc-hash-1',
  };
}

function makeDebt(p: Partial<EvidenceDebt> & { id: string; nodeId: string }): EvidenceDebt {
  return {
    id: p.id,
    debateId: p.debateId ?? 'debate-1',
    nodeId: p.nodeId,
    requestArgumentId: p.requestArgumentId ?? p.id.replace(':debt', ''),
    debtKind: p.debtKind ?? 'source',
    requestedByUserId: p.requestedByUserId ?? 'user-1',
    requestedAt: p.requestedAt ?? '2009-02-13T23:31:30.000Z',
    status: p.status ?? 'requested',
    ageDays: p.ageDays ?? 0,
    isStale: p.isStale ?? false,
  };
}

function makeObs(
  argumentId: string,
  family: MachineObservationFamily,
  rawKey: string,
  confidence: MediatorObservationInput['confidence'] = 'high',
): MediatorObservationInput {
  return { argumentId, family, rawKey, confidence };
}

function makeGraph(p: {
  nodes: MediatorGraphNode[];
  clusters: PointLifecycleClusterSummary[];
  debts?: EvidenceDebt[];
}): MediatorGraphInput {
  return {
    debateId: 'debate-1',
    nodes: p.nodes,
    lifecycle: makeLifecycle(p.clusters),
    evidenceDebts: p.debts ?? [],
  };
}

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

// The operator-expanded ban list — scanned over EVERY rendered evidence string.
// Multi-word phrases are included; single tokens are substring-scanned.
const EXPANDED_BANNED = [
  'hiding', 'withheld', 'concealed', 'refused', 'failed to provide', 'failed',
  'not about the person', 'blame', 'fault', 'wrong', 'right', 'dishonest',
  'bad faith', 'manipulative', 'ai thinks', 'truth', 'verdict', 'winner',
  'loser', 'score', 'decide for me', 'proof of truth', 'proof', 'concealment',
  'accusation', 'at fault',
];

// Engagement / popularity tokens — factual-standing must never be conflated
// with engagement credit in a visible string (evidence-doctrine).
const ENGAGEMENT_TOKENS = [
  'engagement', 'likes', 'views', 'followers', 'popular', 'viral',
  'amplification', 'standing', 'credit', 'stronger', 'score',
];

// The blocked-state lead is the operator-locked temporal copy "The evidence
// path is not available right now." The verdict token `right` ("you are right")
// is banned, but "right now" is a temporal adverb, not a verdict — and the two
// are the SAME word, indistinguishable by form. The single documented exception
// is the exact phrase "right now": it is neutralized before the verdict scan so
// "right" stays banned everywhere else. No other ambiguity exists in the copy.
const SAFE_PHRASES = ['right now'];
function scrub(lower: string): string {
  let out = lower;
  for (const phrase of SAFE_PHRASES) out = out.split(phrase).join('');
  return out;
}
function bannedHit(lower: string, token: string): boolean {
  return scrub(lower).includes(token);
}

function assertNoBanned(texts: string[]): void {
  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const token of EXPANDED_BANNED) {
      expect(bannedHit(lower, token)).toBe(false);
    }
    // No raw snake_case internal code leak.
    expect(text).not.toMatch(/[a-z]+_[a-z]+/);
  }
}

describe('UX-MEDIATOR-003 — evidence-state labels (v4 vocabulary)', () => {
  it('renames evidence_blocked label to "Evidence blocked"; "Needs evidence" stays', () => {
    expect(MEDIATOR_STATE_COPY.evidence_blocked).toBe('Evidence blocked');
    expect(MEDIATOR_STATE_COPY.needs_evidence).toBe('Needs evidence');
    // The state CODE is unchanged — only the label string was renamed.
    expect(plainLanguageForMediatorState('evidence_blocked')).toBe('Evidence blocked');
    expect(plainLanguageForMediatorState('needs_evidence')).toBe('Needs evidence');
  });

  it('the old "Blocked evidence path" label is gone from every evidence surface', () => {
    expect(MEDIATOR_STATE_COPY.evidence_blocked).not.toBe('Blocked evidence path');
    expect(DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath).not.toBe('Blocked evidence path');
    expect(DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath).toBe('Evidence blocked');
  });

  it('the two evidence states are distinct strings; neither leaks the other framing', () => {
    expect(MEDIATOR_STATE_COPY.evidence_blocked).not.toBe(MEDIATOR_STATE_COPY.needs_evidence);
    expect(helperForMediatorState('evidence_blocked')).not.toBe(
      helperForMediatorState('needs_evidence'),
    );
  });

  it('key_detail_unavailable projects to its own "Key detail unavailable" display label (#710)', () => {
    // UX-IMPASSE-002 (#710) — key_detail_unavailable is now surfaced as its own
    // display state (identity); its chip / Inspect read the distinct v4 label.
    // A declined evidence debt still wins evidence_blocked (producer guard), so
    // surfacing this never steals a true Evidence-blocked row.
    expect(v4DisplayStateFor('key_detail_unavailable')).toBe('key_detail_unavailable');
    expect(plainLanguageForMediatorState(v4DisplayStateFor('key_detail_unavailable'))).toBe(
      'Key detail unavailable',
    );
  });
});

describe('UX-MEDIATOR-003 — evidence-blocked detail copy (doctrine)', () => {
  const blockedHelper = helperForMediatorState('evidence_blocked');

  it('describes the evidence PATH availability, person-neutral', () => {
    expect(blockedHelper).toContain('The evidence path is not available right now.');
    expect(blockedHelper).toContain('Name what kind of record would test this point');
  });

  it('carries NO reassurance / negation line (never surfaces the accusation)', () => {
    const lower = blockedHelper.toLowerCase();
    // The operator-forbidden negation phrasings must NOT appear — describing
    // the path, never anyone's conduct, even to deny it.
    expect(lower).not.toContain('not about the person');
    expect(lower).not.toContain('at fault');
    expect(lower).not.toContain('does not mean');
    expect(lower).not.toContain('never implies');
    expect(lower).not.toContain('no one is');
  });

  it('"Evidence blocked" never reads as concealment or blame', () => {
    assertNoBanned([blockedHelper, MEDIATOR_STATE_COPY.evidence_blocked]);
  });

  it('ships the advisory next moves as COPY only (no write wired)', () => {
    // Advisory next-move phrasing is present as copy; it is NOT a button / action.
    expect(blockedHelper).toContain('Mark evidence unavailable');
    expect(blockedHelper).toContain('branch the provable part');
    expect(blockedHelper).toContain('ask what kind of record would test this');
  });
});

describe('UX-MEDIATOR-003 — needs-evidence detail copy', () => {
  it('reads as a structural point obligation, person-neutral', () => {
    const helper = helperForMediatorState('needs_evidence');
    expect(helper).toContain('This point needs a source or record.');
    expect(helper).toContain('easier to test');
    assertNoBanned([helper, MEDIATOR_STATE_COPY.needs_evidence]);
  });

  it('next-move verb is the warmer "Add a source."', () => {
    expect(PATHWAY_STEP_COPY.provide_source).toBe('Add a source.');
    assertNoBanned([PATHWAY_STEP_COPY.provide_source]);
  });
});

describe('UX-MEDIATOR-003 — Inspect detail renders the person-neutral framing', () => {
  it('an evidence_blocked node shows the blocked, non-accusation copy', () => {
    const marker = {
      nodeId: 'n1',
      code: 'evidence_blocked' as const,
      label: plainLanguageForMediatorState('evidence_blocked'),
      isImpasse: false,
    };
    const { getByText, toJSON } = render(
      <MediatorNodeInspectDetail
        marker={marker}
        helper={helperForMediatorState('evidence_blocked')}
        nextMoveLabel={PATHWAY_STEP_COPY.narrow_or_branch}
      />,
    );
    expect(getByText('Evidence blocked')).toBeTruthy();
    assertNoBanned(collectText(toJSON()));
  });

  it('a key_detail_unavailable (family-D) node surfaces its own Inspect framing (#710)', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
    });
    const board = deriveMediatorBoardState(graph, [
      makeObs('n1', 'evidence_source_chain', 'flags_context_limit', 'medium'),
    ]);
    // The internal state stays key_detail_unavailable for traceability...
    expect(board.points[0].state).toBe('key_detail_unavailable');
    // ...and UX-IMPASSE-002 (#710) now surfaces it as its own display chip.
    const marker = getNodeMediatorMarker(board, 'n1');
    expect(marker?.code).toBe('key_detail_unavailable');
    expect(marker?.label).toBe('Key detail unavailable');
    const { getByText, toJSON } = render(
      <MediatorNodeInspectDetail
        marker={marker}
        helper={helperForMediatorState(marker!.code)}
        nextMoveLabel={PATHWAY_STEP_COPY.narrow_or_branch}
      />,
    );
    expect(getByText('Key detail unavailable')).toBeTruthy();
    assertNoBanned(collectText(toJSON()));
  });
});

describe('UX-MEDIATOR-003 — rail vocabulary parity + distinction (derived board)', () => {
  it('A: an unresolved (declined) debt → evidence_blocked, rail uses the chip label', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
      debts: [makeDebt({ id: 'n1:debt', nodeId: 'n1', status: 'unresolved' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('evidence_blocked');

    const { getAllByText, queryAllByText, getByTestId } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(getByTestId('disagreement-points-rail-blocked-n1')).toBeTruthy();
    // Rail blocked line uses the SAME display label as the node chip.
    expect(getAllByText('Evidence blocked').length).toBeGreaterThanOrEqual(1);
    expect(queryAllByText('Blocked evidence path').length).toBe(0);
  });

  it('C: a plain requested debt with no blocking signal stays "Needs evidence" (no regression)', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'answered' })],
      debts: [makeDebt({ id: 'n1:debt', nodeId: 'n1', status: 'requested' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('needs_evidence');
    expect(board.blockedEvidencePaths).toEqual([]);

    const { queryAllByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    // The blocked line never appears for a non-blocked needs-evidence point.
    expect(queryAllByText('Evidence blocked').length).toBe(0);
  });

  it('insufficient signal → Open: no evidence copy appears, no chip', () => {
    const graph = makeGraph({
      nodes: [makeNode({ messageId: 'n1', ordinal: 1, isRoot: true })],
      clusters: [makeCluster({ clusterId: 'n1', state: 'open' })],
    });
    const board = deriveMediatorBoardState(graph, []);
    expect(board.points[0].state).toBe('open');
    // No node chip for an ordinary open node (no chip soup).
    expect(getNodeMediatorMarker(board, 'n1')).toBeNull();

    const { queryAllByText } = render(
      <DisagreementPointsRail board={board} defaultCollapsed={false} reduceMotionOverride />,
    );
    expect(queryAllByText('Evidence blocked').length).toBe(0);
    expect(queryAllByText('Needs evidence').length).toBe(0);
  });
});

describe('UX-MEDIATOR-003 — engagement is never conflated with factual standing', () => {
  it('no evidence copy implies engagement / popularity grants standing or score', () => {
    const texts = [
      MEDIATOR_STATE_COPY.evidence_blocked,
      MEDIATOR_STATE_COPY.needs_evidence,
      helperForMediatorState('evidence_blocked'),
      helperForMediatorState('needs_evidence'),
      DISAGREEMENT_POINTS_RAIL_COPY.evidenceHelp,
      DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath,
      PATHWAY_STEP_COPY.provide_source,
    ];
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of ENGAGEMENT_TOKENS) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  });
});

describe('UX-MEDIATOR-003 — copy maps are pure (no side effects, submit path untouched)', () => {
  it('helper lookups are deterministic and the maps are frozen', () => {
    expect(helperForMediatorState('evidence_blocked')).toBe(
      helperForMediatorState('evidence_blocked'),
    );
    expect(Object.isFrozen(MEDIATOR_STATE_COPY)).toBe(true);
    expect(Object.isFrozen(MEDIATOR_STATE_HELPER)).toBe(true);
    expect(Object.isFrozen(PATHWAY_STEP_COPY)).toBe(true);
  });

  it('every produced evidence string is ban-list clean against the full forbidden set', () => {
    const banned = _forbiddenMediatorTokens();
    const texts = [
      MEDIATOR_STATE_COPY.evidence_blocked,
      MEDIATOR_STATE_COPY.needs_evidence,
      helperForMediatorState('evidence_blocked'),
      helperForMediatorState('needs_evidence'),
      DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath,
      DISAGREEMENT_POINTS_RAIL_COPY.evidenceHelp,
    ];
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of banned) expect(bannedHit(lower, token)).toBe(false);
    }
  });
});
