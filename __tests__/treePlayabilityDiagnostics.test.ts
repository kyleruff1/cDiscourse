/**
 * AN-003 — Tree playability diagnostics tests.
 *
 * Pure-model suite (no React, no Supabase). Builds real LIFE-001 lifecycle
 * maps from inline timeline-map fixtures and asserts every metric
 * `computeTreePlayabilityDiagnostics` produces, plus the Markdown renderer,
 * the verdict-token ban list, and the no-duplication boundary with AN-001.
 */

import fs from 'fs';
import path from 'path';
import {
  computeTreePlayabilityDiagnostics,
  renderTreePlayabilityMarkdown,
  _forbiddenTreePlayabilityTokens,
  _internal,
  DEFAULT_TREE_PLAYABILITY_CONFIG,
  type TreePlayabilityDiagnosticsInput,
} from '../src/features/analytics/treePlayabilityDiagnostics';
import { computeBoardDiagnostics } from '../src/features/analytics/boardDiagnostics';
import { buildPointLifecycleMap } from '../src/features/lifecycle';
import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type { ExhaustionTimeoutAdvisory } from '../src/features/lifecycle';
import type {
  TimelineNodeActionDockModel,
  TimelineNodeActionDockAction,
  TimelineNodeActionDockActionCode,
} from '../src/features/arguments/timelineNodeActionDockModel';
import type { TimelineEvidenceContract } from '../src/features/evidence/evidenceModel';

// ── Fixture helpers ────────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    actorLabel: over.actorLabel ?? 'You',
    kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: over.bodyPreview ?? 'body',
    badges: over.badges ?? [],
    droppedTags: over.droppedTags ?? [],
    depth: over.depth ?? 0,
    lane: over.lane ?? 0,
    siblingIndex: over.siblingIndex ?? 0,
    replyCount: over.replyCount ?? 0,
    descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? 'branch-root-m1',
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

function buildTimelineMap(
  nodes: ArgumentTimelineMapNode[],
  activeNodeId?: string | null,
): ArgumentTimelineMapModel {
  const edges: ArgumentTimelineMapEdge[] = nodes
    .filter((n) => n.parentId !== null)
    .map((n) => ({
      edgeId: `e-${n.parentId}-${n.messageId}`,
      fromMessageId: n.parentId!,
      toMessageId: n.messageId,
      x1: 0, y1: 100, x2: 0, y2: 100,
      fromLane: 0, toLane: n.lane,
      isActivePath: false, isDetached: n.isDetached,
      isFirstClash: false,
      kindColor: n.kindColor,
      standingColor: '#64748b', toneColor: '#64748b',
      gradientStops: [],
    }));
  const activeNode = activeNodeId ? nodes.find((n) => n.messageId === activeNodeId) || null : null;
  return {
    nodes, edges, bands: [],
    activeNode,
    latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: activeNodeId ? [activeNodeId] : [],
    width: 800, height: 240, scrollWidth: 800,
    beginningLabel: '', middleLabel: '', endLabel: '',
    participantTrends: [], legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false, rootOnboardingHint: null, showBackToRootControl: false,
  };
}

function tag(code: string) {
  return { code, label: code, color: '#000' };
}

/**
 * Build a deep-tree fixture with >= 50 nodes spanning several clusters.
 * The lifecycle states below are what LIFE-001's `buildPointLifecycleMap`
 * actually produces for these shapes (verified, not assumed):
 *   - cluster A: a deep same-axis rebuttal chain (relative depth 13,
 *     >= the default branchOverloadDepthThreshold of 8) → exhausted.
 *   - cluster B: a single-message root the room moved past
 *     → moved_on_by_affirmative.
 *   - cluster C: an open ask-receipts request nobody answered
 *     → ignored_by_affirmative.
 *   - cluster D: a broad concession on the last move → conceded.
 *   - cluster E: a single-answered branch the room moved past
 *     → moved_on_by_affirmative.
 *   - cluster G: a 2-deep same-axis rebuttal chain → rebutted (unresolved).
 *   - 30 filler single-message roots: F1..F29 → moved_on_by_affirmative,
 *     F30 (the room's latest move) → open.
 *
 * Resulting cluster tally (36 clusters, 55 messages):
 *   exhausted 1 · moved_on_by_affirmative 28 · ignored_by_affirmative 1 ·
 *   conceded 1 · rebutted 1 · open 4.
 *   unresolved = open(4) + rebutted(1) = 5.
 *   exhausted/stale = exhausted(1) + moved_on(28) + ignored(1) = 30.
 */
function buildDeepTreeNodes(): ArgumentTimelineMapNode[] {
  const nodes: ArgumentTimelineMapNode[] = [];
  let ordinal = 0;
  const next = () => (ordinal += 1);

  // Cluster A — deep exhausting chain, root 'A'.
  nodes.push(fakeNode({
    messageId: 'A', isRoot: true, branchRootMessageId: 'A', depth: 0,
    ordinal: next(), replyCount: 1, descendantCount: 13, sideLabel: 'Aff',
  }));
  for (let i = 1; i <= 13; i++) {
    nodes.push(fakeNode({
      messageId: `A${i}`,
      parentId: i === 1 ? 'A' : `A${i - 1}`,
      branchRootMessageId: 'A',
      depth: i,
      ordinal: next(),
      kindLabel: i % 2 ? 'rebuttal' : 'counter-rebuttal',
      droppedTags: [tag('fact_challenge')],
      sideLabel: i % 2 ? 'Neg' : 'Aff',
    }));
  }

  // Cluster B — open root, no replies.
  nodes.push(fakeNode({
    messageId: 'B', isRoot: true, branchRootMessageId: 'B', depth: 0,
    ordinal: next(), replyCount: 0, descendantCount: 0, sideLabel: 'Aff',
  }));

  // Cluster C — open source request that nobody answers.
  nodes.push(fakeNode({
    messageId: 'C', isRoot: true, branchRootMessageId: 'C', depth: 0,
    ordinal: next(), replyCount: 1, descendantCount: 1, sideLabel: 'Aff',
  }));
  nodes.push(fakeNode({
    messageId: 'C1', parentId: 'C', branchRootMessageId: 'C', depth: 1,
    ordinal: next(), kindLabel: 'clarification',
    droppedTags: [tag('ask_receipts')], sideLabel: 'Neg',
  }));

  // Cluster D — root + rebuttal + broad concession.
  nodes.push(fakeNode({
    messageId: 'D', isRoot: true, branchRootMessageId: 'D', depth: 0,
    ordinal: next(), replyCount: 1, descendantCount: 2, sideLabel: 'Aff',
  }));
  nodes.push(fakeNode({
    messageId: 'D1', parentId: 'D', branchRootMessageId: 'D', depth: 1,
    ordinal: next(), kindLabel: 'rebuttal',
    droppedTags: [tag('fact_challenge')], sideLabel: 'Neg',
  }));
  nodes.push(fakeNode({
    messageId: 'D2', parentId: 'D1', branchRootMessageId: 'D', depth: 2,
    ordinal: next(), kindLabel: 'concession',
    droppedTags: [tag('concede_broad_point')], sideLabel: 'Aff',
  }));

  // Cluster E — a plain answered branch (root + claim reply).
  nodes.push(fakeNode({
    messageId: 'E', isRoot: true, branchRootMessageId: 'E', depth: 0,
    ordinal: next(), replyCount: 1, descendantCount: 1, sideLabel: 'Aff',
  }));
  nodes.push(fakeNode({
    messageId: 'E1', parentId: 'E', branchRootMessageId: 'E', depth: 1,
    ordinal: next(), kindLabel: 'claim', sideLabel: 'Neg',
  }));

  // Cluster G — a 2-deep same-axis rebuttal chain → rebutted (unresolved).
  nodes.push(fakeNode({
    messageId: 'G', isRoot: true, branchRootMessageId: 'G', depth: 0,
    ordinal: next(), replyCount: 1, descendantCount: 2, sideLabel: 'Aff',
  }));
  nodes.push(fakeNode({
    messageId: 'G1', parentId: 'G', branchRootMessageId: 'G', depth: 1,
    ordinal: next(), kindLabel: 'rebuttal',
    droppedTags: [tag('fact_challenge')], sideLabel: 'Neg',
  }));
  nodes.push(fakeNode({
    messageId: 'G2', parentId: 'G1', branchRootMessageId: 'G', depth: 2,
    ordinal: next(), kindLabel: 'counter-rebuttal',
    droppedTags: [tag('fact_challenge')], sideLabel: 'Aff',
  }));

  // Filler single-message root clusters to push node count past 50.
  for (let i = 1; i <= 30; i++) {
    nodes.push(fakeNode({
      messageId: `F${i}`, isRoot: true, branchRootMessageId: `F${i}`, depth: 0,
      ordinal: next(), replyCount: 0, descendantCount: 0, sideLabel: 'Aff',
    }));
  }

  return nodes;
}

function buildDeepTreeInput(
  activeNodeId?: string | null,
  extras: Partial<TreePlayabilityDiagnosticsInput> = {},
): TreePlayabilityDiagnosticsInput {
  const nodes = buildDeepTreeNodes();
  const timelineMap = buildTimelineMap(nodes, activeNodeId);
  const lifecycleMap = buildPointLifecycleMap({
    timelineMap,
    artifactsByMessageId: new Map(),
  });
  return { timelineMap, lifecycleMap, ...extras };
}

/** A small "all healthy" fixture: root + 2 answered claim replies. */
function buildHealthyInput(): TreePlayabilityDiagnosticsInput {
  const nodes: ArgumentTimelineMapNode[] = [
    fakeNode({
      messageId: 'H', isRoot: true, branchRootMessageId: 'H', depth: 0,
      ordinal: 1, replyCount: 2, descendantCount: 2, sideLabel: 'Aff',
    }),
    fakeNode({
      messageId: 'H1', parentId: 'H', branchRootMessageId: 'H', depth: 1,
      ordinal: 2, kindLabel: 'claim', sideLabel: 'Neg',
    }),
    fakeNode({
      messageId: 'H2', parentId: 'H', branchRootMessageId: 'H', depth: 1,
      ordinal: 3, kindLabel: 'claim', sideLabel: 'Aff',
    }),
  ];
  const timelineMap = buildTimelineMap(nodes);
  const lifecycleMap = buildPointLifecycleMap({ timelineMap, artifactsByMessageId: new Map() });
  return { timelineMap, lifecycleMap };
}

/** Empty fixture. */
function buildEmptyInput(): TreePlayabilityDiagnosticsInput {
  const timelineMap = buildTimelineMap([]);
  const lifecycleMap = buildPointLifecycleMap({ timelineMap, artifactsByMessageId: new Map() });
  return { timelineMap, lifecycleMap };
}

/** Build a dock-model fixture with a chosen enabled/disabled action set. */
function dockModel(
  messageId: string,
  actionSpecs: Array<{ code: TimelineNodeActionDockActionCode; disabled: boolean }>,
): TimelineNodeActionDockModel {
  const actions: TimelineNodeActionDockAction[] = actionSpecs.map((spec, idx) => ({
    action: spec.code,
    label: spec.code,
    accessibilityLabel: spec.code,
    isPrimary: idx === 0,
    isDisabled: spec.disabled,
  }));
  return {
    target: { kind: 'node', messageId },
    actor: 'other',
    clusterId: messageId,
    clusterHeader: {
      clusterId: messageId,
      lifecycleState: 'open',
      lifecycleLabel: 'Open',
      lifecycleHelper: '',
      memberCount: 1,
      metadataChips: [],
    } as unknown as TimelineNodeActionDockModel['clusterHeader'],
    moveChips: [],
    primarySuggestion: {
      action: actionSpecs[0]?.code ?? 'open_cards_detail',
      label: 'primary',
      rationale: '',
    } as unknown as TimelineNodeActionDockModel['primarySuggestion'],
    actions,
    accessibilityLabel: `dock-${messageId}`,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('AN-003 — computeTreePlayabilityDiagnostics', () => {
  // 1
  it('returns the canonical empty record for an empty timeline', () => {
    const result = computeTreePlayabilityDiagnostics(buildEmptyInput());
    expect(result.playabilityClass).toBe('empty');
    expect(result.totalMessages).toBe(0);
    expect(result.totalClusters).toBe(0);
    expect(result.unresolvedPointCount).toBe(0);
    expect(result.exhaustedOrStalePointCount).toBe(0);
    expect(result.branchDepth).toEqual({
      maxDepth: 0, medianDepth: 0, isBranchOverload: false, deepestClusterId: null,
    });
    expect(result.actionsToActiveUnresolvedPointFromRoot).toBeNull();
    expect(result.dominantAdvisoryState).toBeNull();
    expect(result.dominantAdvisoryClusterCount).toBe(0);
    expect(result.nodesWithNoActionableSuggestion).toBeNull();
    expect(typeof result.fingerprint).toBe('string');
  });

  // 2
  it('is deterministic — same input produces identical output incl. fingerprint', () => {
    const a = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    const b = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    expect(a).toEqual(b);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  // 3
  it('counts total messages and clusters', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    // 14 (A) + 1 (B) + 2 (C) + 3 (D) + 2 (E) + 3 (G) + 30 (F) = 55 messages.
    expect(result.totalMessages).toBe(55);
    // Clusters: A, B, C, D, E, G + 30 F = 36.
    expect(result.totalClusters).toBe(36);
  });

  // 4 — card-named
  it('derives unresolved-point count from open/rebutted/source_requested/quote_requested', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    // Unresolved: open(4) + G (rebutted) = 5.
    expect(result.unresolvedPointCount).toBe(5);
  });

  // 5
  it('derives exhausted/stale-point count from exhausted/moved_on_*/ignored_*', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    // exhausted(1) + moved_on_by_affirmative(28) + ignored_by_affirmative(1) = 30.
    expect(result.exhaustedOrStalePointCount).toBe(30);
    expect(result.lifecycleBreakdown.countsByState.exhausted).toBe(1);
    expect(result.lifecycleBreakdown.countsByState.moved_on_by_affirmative).toBe(28);
    expect(result.lifecycleBreakdown.countsByState.ignored_by_affirmative).toBe(1);
  });

  // 6
  it('counts branch_recommended in neither unresolved nor stale, but in the breakdown', () => {
    // Off-axis pressure ×2 on plain-claim moves → branch_recommended.
    const nodes: ArgumentTimelineMapNode[] = [
      fakeNode({
        messageId: 'R', isRoot: true, branchRootMessageId: 'R', depth: 0,
        ordinal: 1, replyCount: 1, descendantCount: 2, sideLabel: 'Aff',
      }),
      fakeNode({
        messageId: 'R1', parentId: 'R', branchRootMessageId: 'R', depth: 1,
        ordinal: 2, kindLabel: 'claim', droppedTags: [tag('branch_this_off')],
        sideLabel: 'Neg',
      }),
      fakeNode({
        messageId: 'R2', parentId: 'R1', branchRootMessageId: 'R', depth: 2,
        ordinal: 3, kindLabel: 'claim', droppedTags: [tag('branch_this_off')],
        sideLabel: 'Aff',
      }),
    ];
    const timelineMap = buildTimelineMap(nodes);
    const lifecycleMap = buildPointLifecycleMap({ timelineMap, artifactsByMessageId: new Map() });
    const state = lifecycleMap.byCluster.get('R')!.state;
    expect(state).toBe('branch_recommended');
    const result = computeTreePlayabilityDiagnostics({ timelineMap, lifecycleMap });
    expect(result.unresolvedPointCount).toBe(0);
    expect(result.exhaustedOrStalePointCount).toBe(0);
    expect(result.lifecycleBreakdown.countsByState.branch_recommended).toBe(1);
  });

  // 7 — card-named
  it('flags branch overload when the deepest chain reaches the threshold', () => {
    const overload = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    // Cluster A reaches cluster-relative depth 13 >= default threshold 8.
    expect(overload.branchDepth.isBranchOverload).toBe(true);

    const shallow = computeTreePlayabilityDiagnostics(buildHealthyInput());
    expect(shallow.branchDepth.isBranchOverload).toBe(false);
  });

  // 8 — pins R1 (node.depth is absolute, cluster-relative = depth - rootDepth)
  it('computes max + median branch depth (lower-middle median, absolute depth)', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    // Cluster A max relative depth = 13 (A13 at depth 13, root A at depth 0).
    // This pins R1: node.depth is ABSOLUTE from the timeline root, so the
    // cluster-relative depth = node.depth - clusterRoot.depth.
    expect(result.branchDepth.maxDepth).toBe(13);
    // Per-cluster max depths: A=13, B=0, C=1, D=2, E=1, G=2, F1..F30 = 0.
    // 36 values sorted; lower-middle index = ceil(36/2)-1 = 17 → value 0.
    expect(result.branchDepth.medianDepth).toBe(0);
  });

  // 9
  it('reports deepestClusterId pointing at the deepest chain', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    expect(result.branchDepth.deepestClusterId).toBe('A');
  });

  // 10
  it('measures actions to the active unresolved point from its cluster root', () => {
    // Active node G2 (depth 2) in cluster G (rebutted = unresolved).
    const unresolvedActive = computeTreePlayabilityDiagnostics(buildDeepTreeInput('G2'));
    expect(unresolvedActive.actionsToActiveUnresolvedPointFromRoot).toBe(2);

    // Active node D2 in cluster D (conceded = resolved) → null.
    const resolvedActive = computeTreePlayabilityDiagnostics(buildDeepTreeInput('D2'));
    expect(resolvedActive.actionsToActiveUnresolvedPointFromRoot).toBeNull();

    // No active node → null.
    const noActive = computeTreePlayabilityDiagnostics(buildDeepTreeInput(null));
    expect(noActive.actionsToActiveUnresolvedPointFromRoot).toBeNull();
  });

  // 11
  it('computes evidence-debt concentration with an EV-001 contract lookup', () => {
    const evidenceContractFor = (messageId: string): TimelineEvidenceContract | null => {
      // Mark cluster E's claim reply (E1) as carrying broken-chain debt.
      if (messageId === 'E1') {
        return {
          rendersAsEvidenceNode: false,
          rendersSourceChainRing: true,
          accessibilityLabelSuffix: '',
          receiptChip: {
            status: 'broken',
          } as unknown as TimelineEvidenceContract['receiptChip'],
        };
      }
      return null;
    };
    const input = buildDeepTreeInput(null, { evidenceContractFor });
    const result = computeTreePlayabilityDiagnostics(input);
    // Cluster C (open ask-receipts request) + cluster E (E1 broken chain) = 2.
    expect(result.evidenceDebtClusterCount).toBe(2);
    expect(result.evidenceDebtConcentration).toBeCloseTo(2 / 36);
  });

  // 12
  it('falls back to lifecycle states for evidence-debt when no contract lookup is given', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    // Without evidenceContractFor: only cluster C carries debt
    // (open source/quote request — the basis of its ignored advisory).
    expect(result.evidenceDebtClusterCount).toBe(1);
    expect(() => computeTreePlayabilityDiagnostics(buildDeepTreeInput())).not.toThrow();
  });

  // 13 — card-named
  it('detects nodes whose SC-004 dock has no enabled POST-producing action', () => {
    const dockModelForNode = (messageId: string): TimelineNodeActionDockModel | null => {
      // A1 is the "stuck" node: only open_cards_detail enabled.
      if (messageId === 'A1') {
        return dockModel('A1', [
          { code: 'open_cards_detail', disabled: false },
          { code: 'reply', disabled: true },
          { code: 'challenge', disabled: true },
        ]);
      }
      // Every other node has reply enabled (ordinary).
      return dockModel(messageId, [
        { code: 'reply', disabled: false },
        { code: 'open_cards_detail', disabled: false },
      ]);
    };
    const result = computeTreePlayabilityDiagnostics(
      buildDeepTreeInput(null, { dockModelForNode }),
    );
    expect(result.nodesWithNoActionableSuggestion).toBe(1);
  });

  // 14
  it('reports nodesWithNoActionableSuggestion as null when dockModelForNode is omitted', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    expect(result.nodesWithNoActionableSuggestion).toBeNull();
    expect(result.nodesWithNoActionableSuggestion).not.toBe(0);
  });

  // 15
  it('excludes detached nodes from the no-actionable-suggestion scan but counts them as messages', () => {
    const nodes: ArgumentTimelineMapNode[] = [
      fakeNode({
        messageId: 'P', isRoot: true, branchRootMessageId: 'P', depth: 0,
        ordinal: 1, replyCount: 1, descendantCount: 1, sideLabel: 'Aff',
      }),
      fakeNode({
        messageId: 'P1', parentId: 'P', branchRootMessageId: 'P', depth: 1,
        ordinal: 2, kindLabel: 'claim', sideLabel: 'Neg',
      }),
      // Detached node — parent not in the map.
      fakeNode({
        messageId: 'Det', parentId: 'ghost', branchRootMessageId: 'Det', depth: 1,
        ordinal: 3, kindLabel: 'claim', isDetached: true, sideLabel: 'Neg',
      }),
    ];
    const timelineMap = buildTimelineMap(nodes);
    const lifecycleMap = buildPointLifecycleMap({ timelineMap, artifactsByMessageId: new Map() });
    // Dock with NO enabled post action for every node.
    const dockModelForNode = (messageId: string): TimelineNodeActionDockModel =>
      dockModel(messageId, [{ code: 'open_cards_detail', disabled: false }]);
    const result = computeTreePlayabilityDiagnostics({
      timelineMap, lifecycleMap, dockModelForNode,
    });
    expect(result.totalMessages).toBe(3);
    // Scanned: only P1 (non-root, non-detached). P is root, Det is detached.
    expect(result.nodesWithNoActionableSuggestion).toBe(1);
  });

  // 16
  it('picks the dominant GAME-001 advisory state, ties broken by priority order', () => {
    const advisory = (clusterId: string, state: ExhaustionTimeoutAdvisory['state']):
      ExhaustionTimeoutAdvisory => ({
      clusterId, state, label: '', helperLine: '', ruleFired: null,
      blocksSubmit: false, appliesPointStandingPenalty: false,
    });
    // exhausted x2, moved_on_by_negative x2 — tie. `exhausted` precedes
    // `moved_on_by_negative` in ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES.
    const map = new Map<string, ExhaustionTimeoutAdvisory>([
      ['c1', advisory('c1', 'exhausted')],
      ['c2', advisory('c2', 'exhausted')],
      ['c3', advisory('c3', 'moved_on_by_negative')],
      ['c4', advisory('c4', 'moved_on_by_negative')],
    ]);
    const input = buildDeepTreeInput(null, { exhaustionAdvisoryByClusterId: map });
    const result = computeTreePlayabilityDiagnostics(input);
    expect(result.dominantAdvisoryState).toBe('exhausted');
    expect(result.dominantAdvisoryClusterCount).toBe(2);
  });

  // 17
  it('falls back to the dominant lifecycle stale state when no advisory map is given', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    // Stale states: exhausted(1) + moved_on_by_affirmative(28) +
    // ignored_by_affirmative(1) → most-frequent is moved_on_by_affirmative.
    expect(result.dominantAdvisoryState).toBe('moved_on_by_affirmative');
    expect(result.dominantAdvisoryClusterCount).toBe(28);
    // Healthy fixture has zero stale clusters → null.
    const healthy = computeTreePlayabilityDiagnostics(buildHealthyInput());
    expect(healthy.dominantAdvisoryState).toBeNull();
    expect(healthy.dominantAdvisoryClusterCount).toBe(0);
  });

  // 18
  it('classifies a tree as healthy when both dominance fractions are below threshold', () => {
    const result = computeTreePlayabilityDiagnostics(buildHealthyInput());
    expect(result.playabilityClass).toBe('healthy');
  });

  // 19
  it('classifies unresolved_dominant / stalled / mixed at the thresholds', () => {
    // Deep-tree fixture: 5/36 unresolved (~0.139), 30/36 stale (~0.833).
    // Default config (unresolved >= 0.5, stale >= 0.4) → stalled fires alone.
    const stalled = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    expect(stalled.playabilityClass).toBe('stalled');

    // unresolved_dominant: lower the unresolved threshold below 0.139 and
    // raise the stalled threshold above 0.833 so only unresolved fires.
    const unresolvedDominant = computeTreePlayabilityDiagnostics(buildDeepTreeInput(null, {
      config: {
        branchOverloadDepthThreshold: 8,
        unresolvedDominanceFraction: 0.1,
        stalledDominanceFraction: 0.9,
      },
    }));
    expect(unresolvedDominant.playabilityClass).toBe('unresolved_dominant');

    // Mixed: both thresholds low enough that both fractions cross.
    const mixed = computeTreePlayabilityDiagnostics(buildDeepTreeInput(null, {
      config: {
        branchOverloadDepthThreshold: 8,
        unresolvedDominanceFraction: 0.1,
        stalledDominanceFraction: 0.4,
      },
    }));
    expect(mixed.playabilityClass).toBe('mixed');
  });

  // 20
  it('covers every ALL_POINT_LIFECYCLE_STATES entry in the breakdown and sums to totalClusters', () => {
    const result = computeTreePlayabilityDiagnostics(buildDeepTreeInput());
    const counts = result.lifecycleBreakdown.countsByState;
    // Importing the frozen array indirectly: assert known keys present.
    const keys = Object.keys(counts);
    expect(keys).toContain('open');
    expect(keys).toContain('archived_or_resolved');
    expect(keys).toContain('branch_recommended');
    expect(keys.length).toBe(19);
    const sum = keys.reduce((acc, k) => acc + counts[k as keyof typeof counts], 0);
    expect(sum).toBe(result.totalClusters);
    expect(result.lifecycleBreakdown.totalClusters).toBe(result.totalClusters);
  });

  // 21
  it('guards every fraction against division by zero on empty / zero-cluster input', () => {
    const empty = computeTreePlayabilityDiagnostics(buildEmptyInput());
    expect(empty.unresolvedFraction).toBe(0);
    expect(empty.exhaustedOrStaleFraction).toBe(0);
    expect(empty.evidenceDebtConcentration).toBe(0);
    expect(Number.isNaN(empty.unresolvedFraction)).toBe(false);
  });

  // 26 — purity
  it('does not mutate its input', () => {
    const input = buildDeepTreeInput('C1');
    const clone = {
      totalNodes: input.timelineMap.nodes.length,
      totalClusters: input.lifecycleMap.byCluster.size,
      firstNodeId: input.timelineMap.nodes[0].messageId,
    };
    Object.freeze(input);
    expect(() => computeTreePlayabilityDiagnostics(input)).not.toThrow();
    expect(input.timelineMap.nodes.length).toBe(clone.totalNodes);
    expect(input.lifecycleMap.byCluster.size).toBe(clone.totalClusters);
    expect(input.timelineMap.nodes[0].messageId).toBe(clone.firstNodeId);
  });

  // 27 — config override
  it('honors a custom branchOverloadDepthThreshold', () => {
    // Healthy fixture max depth = 1; threshold 1 → overload, threshold 2 → not.
    const overload = computeTreePlayabilityDiagnostics({
      ...buildHealthyInput(),
      config: { ...DEFAULT_TREE_PLAYABILITY_CONFIG, branchOverloadDepthThreshold: 1 },
    });
    expect(overload.branchDepth.isBranchOverload).toBe(true);
    const notOverload = computeTreePlayabilityDiagnostics({
      ...buildHealthyInput(),
      config: { ...DEFAULT_TREE_PLAYABILITY_CONFIG, branchOverloadDepthThreshold: 2 },
    });
    expect(notOverload.branchDepth.isBranchOverload).toBe(false);
  });
});

describe('AN-003 — renderTreePlayabilityMarkdown', () => {
  // 22
  it('renders a non-empty snapshot with section headers and every lifecycle-state row', () => {
    const diagnostics = computeTreePlayabilityDiagnostics(buildDeepTreeInput('C1'));
    const md = renderTreePlayabilityMarkdown(diagnostics, {
      roomLabel: 'demo room', generatedAtLabel: '2026-05-19',
    });
    expect(md.length).toBeGreaterThan(0);
    expect(md).toContain('# Tree playability snapshot — demo room');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Resolution');
    expect(md).toContain('## Branch depth');
    expect(md).toContain('## Reachability');
    expect(md).toContain('## Advisory distribution');
    expect(md).toContain('## Fingerprint');
    // Every lifecycle-state row present.
    for (const state of ['open', 'rebutted', 'exhausted', 'archived_or_resolved',
      'branch_recommended', 'conceded']) {
      expect(md).toContain(`| ${state} |`);
    }
  });

  // 23
  it('renders a valid empty snapshot without throwing', () => {
    const diagnostics = computeTreePlayabilityDiagnostics(buildEmptyInput());
    expect(() => renderTreePlayabilityMarkdown(diagnostics)).not.toThrow();
    const md = renderTreePlayabilityMarkdown(diagnostics);
    expect(md).toContain('Playability class: empty');
    expect(md).toContain('Actions to active unresolved point from root: n/a');
    expect(md).toContain('Nodes with no actionable suggestion: signal unavailable');
  });
});

describe('AN-003 — doctrine ban list', () => {
  // 24 — card-named
  it('never emits a verdict or popularity token in any produced string', () => {
    const banned = _forbiddenTreePlayabilityTokens();
    expect(banned.length).toBeGreaterThan(0);
    const strings: string[] = [
      renderTreePlayabilityMarkdown(
        computeTreePlayabilityDiagnostics(buildDeepTreeInput('C1')),
        { roomLabel: 'room', generatedAtLabel: 'now' },
      ),
      renderTreePlayabilityMarkdown(
        computeTreePlayabilityDiagnostics(buildEmptyInput()),
      ),
    ];
    for (const s of strings) {
      const lower = s.toLowerCase();
      for (const token of banned) {
        expect(lower).not.toContain(token);
      }
    }
  });
});

describe('AN-003 — non-duplication of AN-001', () => {
  // 25
  it('does not import boardDiagnostics and exposes a distinct deriver symbol', () => {
    expect(typeof computeTreePlayabilityDiagnostics).toBe('function');
    expect(typeof computeBoardDiagnostics).toBe('function');
    expect(computeTreePlayabilityDiagnostics).not.toBe(computeBoardDiagnostics);

    const sourcePath = path.join(
      __dirname, '..', 'src', 'features', 'analytics', 'treePlayabilityDiagnostics.ts',
    );
    const source = fs.readFileSync(sourcePath, 'utf8');
    // No `from '...boardDiagnostics'` import specifier may appear — scanned
    // per-line so a prose mention of the sibling module in a comment is not
    // a false positive.
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*(import|export)\b/.test(line) || /\bfrom\s+['"]/.test(line));
    for (const line of importLines) {
      expect(line).not.toMatch(/boardDiagnostics/);
    }
  });
});

describe('AN-003 — internal helpers', () => {
  it('medianLowerMiddle returns the lower-middle element on an even count', () => {
    expect(_internal.medianLowerMiddle([])).toBe(0);
    expect(_internal.medianLowerMiddle([5])).toBe(5);
    expect(_internal.medianLowerMiddle([1, 2, 3, 4])).toBe(2);
    expect(_internal.medianLowerMiddle([4, 1, 3, 2])).toBe(2);
    expect(_internal.medianLowerMiddle([1, 2, 3])).toBe(2);
  });

  it('fnv1a is stable for identical input', () => {
    expect(_internal.fnv1a('abc')).toBe(_internal.fnv1a('abc'));
    expect(_internal.fnv1a('abc')).not.toBe(_internal.fnv1a('abd'));
  });
});
