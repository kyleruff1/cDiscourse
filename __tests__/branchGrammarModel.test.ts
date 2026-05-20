/**
 * BR-004 — branchGrammarModel pure-model tests.
 *
 * No React, no Supabase, no network. Covers:
 *   - deriveBranchDirection rule table (rules 1-5; tangent via each of
 *     the four tangent signals).
 *   - Doctrine: the mainline never auto-promotes; heat does not move a
 *     direction; evidence pass-through has top priority.
 *   - buildBranchGrammarMap aggregation (participantCount, lastActivityAt,
 *     unresolvedAxisCount, primaryPartyEngaged, offshootDepthCapReached).
 *   - buildCollapsedBranchSummary (four fields + pluralization).
 *   - resolveBranchSelectionHandoff.
 *   - The BR-003 / MCP-010 advisory bridges (incl. override-wins).
 *   - Edge cases: empty room, root-only tree, missing-origin fallback,
 *     empty principals, inbound-kind absent from the map.
 *   - Determinism + frozen-input safety.
 */
import {
  ALL_BRANCH_DIRECTIONS,
  TANGENT_DEPTH_CAP,
  branchDirectionLabel,
  buildBranchGrammarMap,
  buildCollapsedBranchSummary,
  deriveBranchDirection,
  overrideLaneToBranchDirection,
  resolveBranchSelectionHandoff,
  suggestedActionToBranchDirection,
  type BranchDirection,
  type BranchGrammarNode,
  type BranchOrigin,
  type SemanticOverrideLane,
} from '../src/features/arguments/branchGrammarModel';
import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type { RailBranchKind } from '../src/features/arguments/railSegmentModel';
import type { RedirectSuggestedAction } from '../src/features/arguments/tangentRoutingModel';

// ── Fixture builders ──────────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    actorLabel: over.actorLabel ?? 'You',
    kindLabel: over.kindLabel ?? 'Claim',
    sideLabel: over.sideLabel ?? 'For',
    bodyPreview: over.bodyPreview ?? 'body',
    badges: over.badges ?? [],
    droppedTags: over.droppedTags ?? [],
    depth: over.depth ?? 0,
    lane: over.lane ?? 0,
    siblingIndex: over.siblingIndex ?? 0,
    replyCount: over.replyCount ?? 0,
    descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? 'branch-1',
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: over.junctionGroupId ?? null,
    isJunction: over.isJunction ?? false,
    junctionChildCount: over.junctionChildCount ?? 0,
    isActive: over.isActive ?? false,
    isLatest: over.isLatest ?? false,
    isDetached: over.isDetached ?? false,
    isActivePath: over.isActivePath ?? false,
    isRoot: over.isRoot ?? false,
    isFirstRebuttal: over.isFirstRebuttal ?? false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: over.kindColor ?? '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: over.x ?? 0,
    y: over.y ?? 100,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
  };
}

function fakeEdge(over: Partial<ArgumentTimelineMapEdge> = {}): ArgumentTimelineMapEdge {
  return {
    edgeId: over.edgeId ?? 'e-1',
    fromMessageId: over.fromMessageId ?? 'm1',
    toMessageId: over.toMessageId ?? 'm2',
    x1: over.x1 ?? 0,
    y1: over.y1 ?? 100,
    x2: over.x2 ?? 100,
    y2: over.y2 ?? 100,
    fromLane: over.fromLane ?? 0,
    toLane: over.toLane ?? 0,
    isActivePath: over.isActivePath ?? false,
    isDetached: over.isDetached ?? false,
    isFirstClash: over.isFirstClash ?? false,
    kindColor: over.kindColor ?? '#22c55e',
    standingColor: over.standingColor ?? '#22c55e',
    toneColor: over.toneColor ?? '#94a3b8',
    gradientStops: over.gradientStops ?? ['#22c55e', '#f59e0b'],
  };
}

function fakeMap(
  nodes: ArgumentTimelineMapNode[],
  edges: ArgumentTimelineMapEdge[],
): ArgumentTimelineMapModel {
  return {
    nodes,
    edges,
    bands: [],
    activeNode: null,
    latestMessageId: nodes.length > 0 ? nodes[nodes.length - 1].messageId : null,
    activePathIds: [],
    width: 1000,
    height: 400,
    scrollWidth: 1000,
    beginningLabel: '',
    middleLabel: '',
    endLabel: '',
    participantTrends: [],
    legend: [],
    rootMessageId: nodes.find((n) => n.isRoot)?.messageId ?? null,
    firstRebuttalMessageId: null,
    hasRebuttal: false,
    rootOnboardingHint: null,
    showBackToRootControl: false,
  };
}

function origin(over: Partial<BranchOrigin> = {}): BranchOrigin {
  return {
    branchId: over.branchId ?? 'branch-x',
    branchRootMessageId: over.branchRootMessageId ?? 'mx',
    isMainlineBranch: over.isMainlineBranch ?? false,
    inboundBranchKind: (over.inboundBranchKind ?? 'kink_start') as RailBranchKind,
    isEvidenceThread: over.isEvidenceThread ?? false,
    hasTangentLexicalCode: over.hasTangentLexicalCode ?? false,
    routedSuggestedAction: over.routedSuggestedAction ?? null,
    userOverrideLane: over.userOverrideLane ?? null,
  };
}

// ── deriveBranchDirection — rule table ────────────────────────────

describe('deriveBranchDirection — rule table', () => {
  it('rule 1: an evidence thread → evidence_passthrough', () => {
    expect(deriveBranchDirection(origin({ isEvidenceThread: true }))).toBe(
      'evidence_passthrough',
    );
  });

  it('rule 2: the mainline branch → mainline', () => {
    expect(
      deriveBranchDirection(origin({ isMainlineBranch: true, inboundBranchKind: 'main' })),
    ).toBe('mainline');
  });

  it('rule 3a: inbound tangent kind → tangent_diagonal', () => {
    expect(deriveBranchDirection(origin({ inboundBranchKind: 'tangent' }))).toBe(
      'tangent_diagonal',
    );
  });

  it('rule 3a: inbound kink_end kind → tangent_diagonal', () => {
    expect(deriveBranchDirection(origin({ inboundBranchKind: 'kink_end' }))).toBe(
      'tangent_diagonal',
    );
  });

  it('rule 3b: explicit tangent lexical code → tangent_diagonal', () => {
    expect(deriveBranchDirection(origin({ hasTangentLexicalCode: true }))).toBe(
      'tangent_diagonal',
    );
  });

  it('rule 3c: a BR-003 send_to_side_branch route → tangent_diagonal', () => {
    expect(
      deriveBranchDirection(origin({ routedSuggestedAction: 'send_to_side_branch' })),
    ).toBe('tangent_diagonal');
  });

  it('rule 3c: a BR-003 branch_this route → tangent_diagonal', () => {
    expect(deriveBranchDirection(origin({ routedSuggestedAction: 'branch_this' }))).toBe(
      'tangent_diagonal',
    );
  });

  it('rule 3d: an MCP-010 tangent override → tangent_diagonal', () => {
    expect(deriveBranchDirection(origin({ userOverrideLane: 'tangent' }))).toBe(
      'tangent_diagonal',
    );
  });

  it('rule 4: a kink_start with no tangent signal → chime_in_vertical', () => {
    expect(deriveBranchDirection(origin({ inboundBranchKind: 'kink_start' }))).toBe(
      'chime_in_vertical',
    );
  });

  it('rule 5: a detached non-root branch → chime_in_vertical (conservative default)', () => {
    expect(deriveBranchDirection(origin({ inboundBranchKind: 'detached' }))).toBe(
      'chime_in_vertical',
    );
  });

  it('an MCP-010 branch override → chime_in_vertical', () => {
    // 'branch' is a deliberate non-tangent branch; rule 4 / rule 5 apply.
    expect(
      deriveBranchDirection(
        origin({ inboundBranchKind: 'kink_start', userOverrideLane: 'branch' }),
      ),
    ).toBe('chime_in_vertical');
  });
});

// ── Doctrine guards ───────────────────────────────────────────────

describe('deriveBranchDirection — doctrine', () => {
  it('the mainline never auto-promotes: a chime-in with far more messages stays a chime-in', () => {
    // The chime-in origin carries no activity fields at all — direction
    // derivation never reads message count. A separate map-level test
    // proves the same with real node counts.
    const chime = origin({ inboundBranchKind: 'kink_start', isMainlineBranch: false });
    expect(deriveBranchDirection(chime)).toBe('chime_in_vertical');
  });

  it('heat does not move a direction: two structurally-identical origins → identical directions', () => {
    // BranchOrigin has no heat field by construction — proving that two
    // identical structural origins yield identical directions IS the
    // type-level guarantee that heat cannot enter.
    const a = origin({ inboundBranchKind: 'kink_start' });
    const b = origin({ inboundBranchKind: 'kink_start' });
    expect(deriveBranchDirection(a)).toBe(deriveBranchDirection(b));
  });

  it('evidence pass-through beats an explicit tangent tag (rule 1 > rule 3)', () => {
    expect(
      deriveBranchDirection(
        origin({ isEvidenceThread: true, hasTangentLexicalCode: true }),
      ),
    ).toBe('evidence_passthrough');
  });

  it('evidence pass-through beats a BR-003 route and an MCP-010 override', () => {
    expect(
      deriveBranchDirection(
        origin({
          isEvidenceThread: true,
          routedSuggestedAction: 'send_to_side_branch',
          userOverrideLane: 'tangent',
        }),
      ),
    ).toBe('evidence_passthrough');
  });

  it('an MCP-010 user override beats a disagreeing BR-003 route', () => {
    // BR-003 routed it to a side branch; the user explicitly chose
    // mainline → the user override wins, so it is NOT a tangent.
    const d = deriveBranchDirection(
      origin({
        inboundBranchKind: 'kink_start',
        routedSuggestedAction: 'send_to_side_branch',
        userOverrideLane: 'mainline',
      }),
    );
    expect(d).not.toBe('tangent_diagonal');
  });

  it('an MCP-010 branch override beats a disagreeing BR-003 tangent route', () => {
    const d = deriveBranchDirection(
      origin({
        inboundBranchKind: 'kink_start',
        routedSuggestedAction: 'branch_this',
        userOverrideLane: 'branch',
      }),
    );
    expect(d).toBe('chime_in_vertical');
  });

  it('is deterministic — same input twice yields equal output', () => {
    const o = origin({ inboundBranchKind: 'tangent', hasTangentLexicalCode: true });
    expect(deriveBranchDirection(o)).toBe(deriveBranchDirection(o));
  });

  it('ALL_BRANCH_DIRECTIONS is exhaustive over the BranchDirection union', () => {
    const all: BranchDirection[] = [
      'mainline',
      'chime_in_vertical',
      'tangent_diagonal',
      'evidence_passthrough',
    ];
    expect([...ALL_BRANCH_DIRECTIONS].sort()).toEqual([...all].sort());
  });
});

// ── buildBranchGrammarMap — aggregation ───────────────────────────

describe('buildBranchGrammarMap', () => {
  it('returns an empty map for an empty room', () => {
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap([], []),
      branchKindByEdgeId: new Map(),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    expect(m.size).toBe(0);
  });

  it('a root-only tree has one mainline branch', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchId: 'b-main' });
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap([root], []),
      branchKindByEdgeId: new Map(),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: ['You'],
    });
    expect(m.size).toBe(1);
    expect(m.get('b-main')?.direction).toBe('mainline');
  });

  it('aggregates participantCount as distinct actorLabel', () => {
    const nodes = [
      fakeNode({ messageId: 'r', isRoot: true, branchId: 'b', actorLabel: 'OP' }),
      fakeNode({
        messageId: 'r2',
        branchId: 'b',
        branchRootMessageId: 'r',
        actorLabel: 'Primary',
      }),
      fakeNode({
        messageId: 'r3',
        branchId: 'b',
        branchRootMessageId: 'r',
        actorLabel: 'OP',
      }),
    ];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, []),
      branchKindByEdgeId: new Map(),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: ['OP', 'Primary'],
    });
    expect(m.get('b')?.participantCount).toBe(2);
  });

  it('aggregates lastActivityAt as the max createdAt across the branch', () => {
    const nodes = [
      fakeNode({
        messageId: 'r',
        isRoot: true,
        branchId: 'b',
        createdAt: '2026-05-18T10:00:00.000Z',
      }),
      fakeNode({
        messageId: 'r2',
        branchId: 'b',
        branchRootMessageId: 'r',
        createdAt: '2026-05-18T12:00:00.000Z',
      }),
      fakeNode({
        messageId: 'r3',
        branchId: 'b',
        branchRootMessageId: 'r',
        createdAt: '2026-05-18T11:00:00.000Z',
      }),
    ];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, []),
      branchKindByEdgeId: new Map(),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    expect(m.get('b')?.lastActivityAt).toBe('2026-05-18T12:00:00.000Z');
  });

  it('counts unresolvedAxisCount as raised − resolved, clamped at 0', () => {
    // 4-node branch: 2 open challenges + 1 answering evidence → count 1.
    const nodes = [
      fakeNode({ messageId: 'r', isRoot: true, branchId: 'b', ordinal: 1 }),
      fakeNode({
        messageId: 'r2',
        branchId: 'b',
        branchRootMessageId: 'r',
        ordinal: 2,
        droppedTags: [{ code: 'evidence_challenge', label: 'Challenge', color: '#f00' }],
      }),
      fakeNode({
        messageId: 'r3',
        branchId: 'b',
        branchRootMessageId: 'r',
        ordinal: 3,
        droppedTags: [{ code: 'source_request', label: 'Source?', color: '#f00' }],
      }),
      fakeNode({
        messageId: 'r4',
        branchId: 'b',
        branchRootMessageId: 'r',
        ordinal: 4,
        droppedTags: [{ code: 'evidence', label: 'Evidence', color: '#0f0' }],
      }),
    ];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, []),
      branchKindByEdgeId: new Map(),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    expect(m.get('b')?.unresolvedAxisCount).toBe(1);
  });

  it('clamps unresolvedAxisCount at 0 when answers exceed challenges', () => {
    const nodes = [
      fakeNode({
        messageId: 'r',
        isRoot: true,
        branchId: 'b',
        ordinal: 1,
        droppedTags: [{ code: 'evidence', label: 'Evidence', color: '#0f0' }],
      }),
      fakeNode({
        messageId: 'r2',
        branchId: 'b',
        branchRootMessageId: 'r',
        ordinal: 2,
        droppedTags: [{ code: 'concede', label: 'Narrowed', color: '#88f' }],
      }),
    ];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, []),
      branchKindByEdgeId: new Map(),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    expect(m.get('b')?.unresolvedAxisCount).toBe(0);
  });

  it('sets primaryPartyEngaged when a principal posts inside the branch', () => {
    const nodes = [
      fakeNode({ messageId: 'r', isRoot: true, branchId: 'main', actorLabel: 'OP' }),
      fakeNode({
        messageId: 'c1',
        branchId: 'chime',
        branchRootMessageId: 'c1',
        parentId: 'r',
        siblingIndex: 1,
        actorLabel: 'Observer A',
      }),
      fakeNode({
        messageId: 'c2',
        branchId: 'chime',
        branchRootMessageId: 'c1',
        parentId: 'c1',
        actorLabel: 'Primary',
      }),
    ];
    const edges = [fakeEdge({ edgeId: 'e1', fromMessageId: 'r', toMessageId: 'c1' })];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, edges),
      branchKindByEdgeId: new Map([['e1', 'kink_start' as RailBranchKind]]),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: ['OP', 'Primary'],
    });
    expect(m.get('chime')?.primaryPartyEngaged).toBe(true);
    expect(m.get('chime')?.direction).toBe('chime_in_vertical');
  });

  it('primaryPartyEngaged is false for a non-mainline branch with no principals supplied', () => {
    const nodes = [
      fakeNode({ messageId: 'r', isRoot: true, branchId: 'main', actorLabel: 'OP' }),
      fakeNode({
        messageId: 'c1',
        branchId: 'chime',
        branchRootMessageId: 'c1',
        parentId: 'r',
        siblingIndex: 1,
        actorLabel: 'Observer A',
      }),
    ];
    const edges = [fakeEdge({ edgeId: 'e1', fromMessageId: 'r', toMessageId: 'c1' })];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, edges),
      branchKindByEdgeId: new Map([['e1', 'kink_start' as RailBranchKind]]),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    expect(m.get('chime')?.primaryPartyEngaged).toBe(false);
  });

  it('the mainline never auto-promotes even when a chime-in has 10x the messages', () => {
    const nodes: ArgumentTimelineMapNode[] = [
      fakeNode({ messageId: 'r', isRoot: true, branchId: 'main', actorLabel: 'OP' }),
    ];
    // A chime-in branch with 20 messages — far more than the mainline's 1.
    for (let i = 0; i < 20; i += 1) {
      nodes.push(
        fakeNode({
          messageId: `c${i}`,
          branchId: 'chime',
          branchRootMessageId: 'c0',
          parentId: i === 0 ? 'r' : `c${i - 1}`,
          siblingIndex: i === 0 ? 1 : 0,
          actorLabel: `Observer ${i}`,
        }),
      );
    }
    const edges = [fakeEdge({ edgeId: 'e1', fromMessageId: 'r', toMessageId: 'c0' })];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, edges),
      branchKindByEdgeId: new Map([['e1', 'kink_start' as RailBranchKind]]),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: ['OP'],
    });
    expect(m.get('main')?.direction).toBe('mainline');
    expect(m.get('chime')?.direction).toBe('chime_in_vertical');
  });

  it('treats an inbound edge absent from the kind map as detached → chime_in_vertical', () => {
    const nodes = [
      fakeNode({ messageId: 'r', isRoot: true, branchId: 'main' }),
      fakeNode({
        messageId: 'c1',
        branchId: 'lost',
        branchRootMessageId: 'c1',
        parentId: 'r',
        siblingIndex: 1,
      }),
    ];
    // Edge present, but NOT in branchKindByEdgeId.
    const edges = [fakeEdge({ edgeId: 'e1', fromMessageId: 'r', toMessageId: 'c1' })];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, edges),
      branchKindByEdgeId: new Map(),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    expect(m.get('lost')?.direction).toBe('chime_in_vertical');
  });

  it('does not mutate its inputs (frozen-input safety)', () => {
    const nodes = [Object.freeze(fakeNode({ messageId: 'r', isRoot: true, branchId: 'b' }))];
    const edges: ArgumentTimelineMapEdge[] = [];
    const map = fakeMap(nodes as ArgumentTimelineMapNode[], edges);
    expect(() =>
      buildBranchGrammarMap({
        timelineMap: map,
        branchKindByEdgeId: new Map(),
        evidenceThreadByBranchRoot: new Map(),
        principalActorLabels: [],
      }),
    ).not.toThrow();
  });

  it('is deterministic — building twice yields identical grammar nodes', () => {
    const nodes = [
      fakeNode({ messageId: 'r', isRoot: true, branchId: 'b', actorLabel: 'OP' }),
      fakeNode({
        messageId: 'r2',
        branchId: 'b',
        branchRootMessageId: 'r',
        actorLabel: 'Primary',
      }),
    ];
    const args = {
      timelineMap: fakeMap(nodes, []),
      branchKindByEdgeId: new Map<string, RailBranchKind>(),
      evidenceThreadByBranchRoot: new Map<string, boolean>(),
      principalActorLabels: ['OP', 'Primary'],
    };
    const a = buildBranchGrammarMap(args);
    const b = buildBranchGrammarMap(args);
    expect(a.get('b')).toEqual(b.get('b'));
  });
});

// ── offshoot depth cap ────────────────────────────────────────────

describe('buildBranchGrammarMap — offshoot depth cap', () => {
  /**
   * Build a nested tangent chain: main → t1 → t2 → t3 (each tangent off
   * the previous). Each tangent branch is a single node carrying an
   * explicit tangent code so deriveBranchDirection → tangent_diagonal.
   */
  function buildTangentChain(depth: number): {
    nodes: ArgumentTimelineMapNode[];
    edges: ArgumentTimelineMapEdge[];
    branchKindByEdgeId: Map<string, RailBranchKind>;
  } {
    const nodes: ArgumentTimelineMapNode[] = [
      fakeNode({ messageId: 'm0', isRoot: true, branchId: 'main' }),
    ];
    const edges: ArgumentTimelineMapEdge[] = [];
    const branchKindByEdgeId = new Map<string, RailBranchKind>();
    let parentId = 'm0';
    for (let i = 1; i <= depth; i += 1) {
      const id = `t${i}`;
      nodes.push(
        fakeNode({
          messageId: id,
          branchId: id,
          branchRootMessageId: id,
          parentId,
          siblingIndex: 1,
          droppedTags: [
            { code: 'branch_this_off', label: 'Side issue', color: '#999' },
          ],
        }),
      );
      const edgeId = `e${i}`;
      edges.push(fakeEdge({ edgeId, fromMessageId: parentId, toMessageId: id }));
      branchKindByEdgeId.set(edgeId, 'kink_start');
      parentId = id;
    }
    return { nodes, edges, branchKindByEdgeId };
  }

  it('TANGENT_DEPTH_CAP is the frozen proposed value 3', () => {
    expect(TANGENT_DEPTH_CAP).toBe(3);
  });

  it('a tangent below the cap has offshootDepthCapReached false', () => {
    const { nodes, edges, branchKindByEdgeId } = buildTangentChain(TANGENT_DEPTH_CAP - 1);
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, edges),
      branchKindByEdgeId,
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    const last = m.get(`t${TANGENT_DEPTH_CAP - 1}`);
    expect(last?.direction).toBe('tangent_diagonal');
    expect(last?.offshootDepthCapReached).toBe(false);
  });

  it('a tangent at the cap has offshootDepthCapReached true', () => {
    const { nodes, edges, branchKindByEdgeId } = buildTangentChain(TANGENT_DEPTH_CAP);
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, edges),
      branchKindByEdgeId,
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    const last = m.get(`t${TANGENT_DEPTH_CAP}`);
    expect(last?.direction).toBe('tangent_diagonal');
    expect(last?.offshootDepthCapReached).toBe(true);
  });

  it('every tangent in a tangent-off-tangent chain classifies tangent_diagonal', () => {
    const { nodes, edges, branchKindByEdgeId } = buildTangentChain(TANGENT_DEPTH_CAP);
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, edges),
      branchKindByEdgeId,
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    for (let i = 1; i <= TANGENT_DEPTH_CAP; i += 1) {
      expect(m.get(`t${i}`)?.direction).toBe('tangent_diagonal');
    }
  });

  it('a non-tangent branch never reports offshootDepthCapReached', () => {
    const nodes = [
      fakeNode({ messageId: 'r', isRoot: true, branchId: 'main' }),
      fakeNode({
        messageId: 'c1',
        branchId: 'chime',
        branchRootMessageId: 'c1',
        parentId: 'r',
        siblingIndex: 1,
      }),
    ];
    const edges = [fakeEdge({ edgeId: 'e1', fromMessageId: 'r', toMessageId: 'c1' })];
    const m = buildBranchGrammarMap({
      timelineMap: fakeMap(nodes, edges),
      branchKindByEdgeId: new Map([['e1', 'kink_start' as RailBranchKind]]),
      evidenceThreadByBranchRoot: new Map(),
      principalActorLabels: [],
    });
    expect(m.get('chime')?.offshootDepthCapReached).toBe(false);
  });
});

// ── buildCollapsedBranchSummary ───────────────────────────────────

describe('buildCollapsedBranchSummary', () => {
  function grammarNode(over: Partial<BranchGrammarNode> = {}): BranchGrammarNode {
    return {
      branchId: over.branchId ?? 'b',
      direction: over.direction ?? 'tangent_diagonal',
      originNodeId: over.originNodeId ?? 'root-1',
      participantCount: over.participantCount ?? 2,
      // Use an `in` check so an explicit `null` override is honored —
      // `?? ` would otherwise replace null with the default timestamp.
      lastActivityAt:
        'lastActivityAt' in over
          ? (over.lastActivityAt as string | null)
          : '2026-05-18T10:00:00.000Z',
      unresolvedAxisCount: over.unresolvedAxisCount ?? 1,
      primaryPartyEngaged: over.primaryPartyEngaged ?? false,
      offshootDepthCapReached: over.offshootDepthCapReached ?? false,
    };
  }

  it('populates all four summary fields', () => {
    const s = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ participantCount: 3, unresolvedAxisCount: 2 }),
      hiddenMessageCount: 5,
    });
    expect(s.messageCount).toBe(5);
    expect(s.participantCount).toBe(3);
    expect(s.unresolvedCount).toBe(2);
    expect(s.primaryPartyEngaged).toBe(false);
    expect(s.recencyLabel.length).toBeGreaterThan(0);
  });

  it('pluralizes replies (1 vs N)', () => {
    const one = buildCollapsedBranchSummary({
      grammarNode: grammarNode(),
      hiddenMessageCount: 1,
    });
    expect(one.summaryLine).toContain('1 reply');
    const many = buildCollapsedBranchSummary({
      grammarNode: grammarNode(),
      hiddenMessageCount: 4,
    });
    expect(many.summaryLine).toContain('4 replies');
  });

  it('pluralizes people (1 vs N)', () => {
    const one = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ participantCount: 1 }),
      hiddenMessageCount: 2,
    });
    expect(one.summaryLine).toContain('1 person');
    const many = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ participantCount: 3 }),
      hiddenMessageCount: 2,
    });
    expect(many.summaryLine).toContain('3 people');
  });

  it('renders open items (0 / 1 / N)', () => {
    const none = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ unresolvedAxisCount: 0 }),
      hiddenMessageCount: 2,
    });
    expect(none.summaryLine).toContain('nothing open');
    const one = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ unresolvedAxisCount: 1 }),
      hiddenMessageCount: 2,
    });
    expect(one.summaryLine).toContain('1 open item');
    const many = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ unresolvedAxisCount: 3 }),
      hiddenMessageCount: 2,
    });
    expect(many.summaryLine).toContain('3 open items');
  });

  it('includes the direction label for a tangent branch', () => {
    const s = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ direction: 'tangent_diagonal' }),
      hiddenMessageCount: 2,
    });
    expect(s.summaryLine).toContain('Side issue');
  });

  it('omits a direction label for an evidence_passthrough branch', () => {
    const s = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ direction: 'evidence_passthrough' }),
      hiddenMessageCount: 2,
    });
    expect(branchDirectionLabel('evidence_passthrough')).toBe('');
    // The summary still builds; it just leads with no direction label.
    expect(s.summaryLine.length).toBeGreaterThan(0);
  });

  it('clamps negative counts to 0', () => {
    const s = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ participantCount: -1, unresolvedAxisCount: -3 }),
      hiddenMessageCount: -5,
    });
    expect(s.messageCount).toBe(0);
    expect(s.participantCount).toBe(0);
    expect(s.unresolvedCount).toBe(0);
  });

  it('renders a fallback recency label when lastActivityAt is null', () => {
    const s = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ lastActivityAt: null }),
      hiddenMessageCount: 2,
    });
    expect(s.recencyLabel).toBe('no activity yet');
  });

  it('the accessibility label ends with "Tap to expand."', () => {
    const s = buildCollapsedBranchSummary({
      grammarNode: grammarNode(),
      hiddenMessageCount: 2,
    });
    expect(s.accessibilityLabel.endsWith('Tap to expand.')).toBe(true);
  });
});

// ── resolveBranchSelectionHandoff ─────────────────────────────────

describe('resolveBranchSelectionHandoff', () => {
  const grammarMap = new Map<string, BranchGrammarNode>([
    [
      'b1',
      {
        branchId: 'b1',
        direction: 'chime_in_vertical',
        originNodeId: 'root-msg-1',
        participantCount: 1,
        lastActivityAt: null,
        unresolvedAxisCount: 0,
        primaryPartyEngaged: false,
        offshootDepthCapReached: false,
      },
    ],
  ]);

  it('resolves a known branch to its root message id + explicit status', () => {
    const h = resolveBranchSelectionHandoff('b1', grammarMap);
    expect(h).toEqual({ branchRootMessageId: 'root-msg-1', status: 'explicit' });
  });

  it('returns null for an unknown branch id', () => {
    expect(resolveBranchSelectionHandoff('nope', grammarMap)).toBeNull();
  });
});

// ── advisory bridges ──────────────────────────────────────────────

describe('suggestedActionToBranchDirection', () => {
  const cases: ReadonlyArray<[RedirectSuggestedAction, BranchDirection]> = [
    ['continue', 'mainline'],
    ['ask_clarifying_question', 'mainline'],
    ['send_to_side_branch', 'tangent_diagonal'],
    ['branch_this', 'tangent_diagonal'],
  ];
  for (const [action, expected] of cases) {
    it(`maps ${action} → ${expected}`, () => {
      expect(suggestedActionToBranchDirection(action)).toBe(expected);
    });
  }
});

describe('overrideLaneToBranchDirection', () => {
  const cases: ReadonlyArray<[SemanticOverrideLane, BranchDirection]> = [
    ['mainline', 'mainline'],
    ['branch', 'chime_in_vertical'],
    ['tangent', 'tangent_diagonal'],
  ];
  for (const [lane, expected] of cases) {
    it(`maps ${lane} → ${expected}`, () => {
      expect(overrideLaneToBranchDirection(lane)).toBe(expected);
    });
  }
});
