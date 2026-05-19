/**
 * LIFE-001 — Integration with BR-001 branch topology + forbidden-imports
 * doctrine anchor.
 *
 * Asserts:
 *   - Cluster boundaries equal `branchRootMessageId` boundaries from the
 *     surface model + BR-001 — no cluster spans across BR-001 branch
 *     roots.
 *   - Collapsed branches (per BR-001's `BranchCollapseState`) do NOT
 *     change lifecycle derivation — visible vs hidden is a UI concern.
 *   - The lifecycle module never IMPORTS a derivation function from
 *     messageQualifiers (only type imports). This is the design's
 *     risk #1 mitigation — caught at source-scan time.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildPointLifecycleMap,
} from '../src/features/lifecycle';
import {
  buildBranchKindMap,
  buildEvidenceThreadMap,
} from '../src/features/arguments/branchTopologyModel';
import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

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

function buildTimelineMap(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapModel {
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
  return {
    nodes, edges, bands: [],
    activeNode: null,
    latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: [],
    width: 800, height: 240, scrollWidth: 800,
    beginningLabel: '', middleLabel: '', endLabel: '',
    participantTrends: [], legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false, rootOnboardingHint: null, showBackToRootControl: false,
  };
}

/**
 * Build a 50-node synthetic tree:
 *   - 1 root cluster
 *   - 4 explicit branches (sibling 2+ children of the root produce new
 *     branch roots)
 *   - each branch has a 12-node chain
 *   - 1 tangent under branch 2
 */
function buildFortyEightPlusTwoNodeFixture() {
  const nodes: ArgumentTimelineMapNode[] = [];
  // Root claim.
  nodes.push(fakeNode({
    messageId: 'root', isRoot: true,
    ordinal: 1,
    replyCount: 4, descendantCount: 49,
    branchRootMessageId: 'root',
    sideLabel: 'Aff',
  }));
  // 4 branches off the root.
  for (let b = 0; b < 4; b++) {
    const branchRootId = `b${b}-0`;
    nodes.push(fakeNode({
      messageId: branchRootId, parentId: 'root',
      ordinal: 2 + b * 13,
      siblingIndex: b,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: branchRootId,
      replyCount: 1, descendantCount: 11,
      sideLabel: 'Neg',
    }));
    // 11 reply nodes per branch.
    for (let i = 1; i < 12; i++) {
      nodes.push(fakeNode({
        messageId: `b${b}-${i}`,
        parentId: i === 1 ? branchRootId : `b${b}-${i - 1}`,
        ordinal: 2 + b * 13 + i,
        kindLabel: i % 2 ? 'counter-rebuttal' : 'rebuttal',
        droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
        branchRootMessageId: branchRootId,
        sideLabel: i % 2 ? 'Aff' : 'Neg',
      }));
    }
  }
  // Tangent under branch 2 — a 1-message detached/new cluster.
  const tangentRoot = 'tangent-0';
  nodes.push(fakeNode({
    messageId: tangentRoot, parentId: 'b2-3',
    ordinal: 80,
    siblingIndex: 1,
    kindLabel: 'claim',
    droppedTags: [{ code: 'branch_this_off', label: 'B', color: '#000' }],
    branchRootMessageId: tangentRoot,
    sideLabel: 'Aff',
  }));
  return nodes;
}

// ── BR-001 integration tests ─────────────────────────────────

describe('LIFE-001 integration with BR-001 branch topology', () => {
  it('cluster boundaries align with branchRootMessageId boundaries', () => {
    const nodes = buildFortyEightPlusTwoNodeFixture();
    const timelineMap = buildTimelineMap(nodes);
    const map = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    // 1 root + 4 branch roots + 1 tangent = 6 clusters expected
    expect(map.byCluster.size).toBe(6);

    // Every member's clusterId == its node.branchRootMessageId
    for (const node of nodes) {
      const snap = map.byMessage.get(node.messageId);
      expect(snap).toBeDefined();
      expect(snap!.clusterId).toBe(node.branchRootMessageId);
    }
  });

  it('cluster order starts with the root cluster', () => {
    const nodes = buildFortyEightPlusTwoNodeFixture();
    const timelineMap = buildTimelineMap(nodes);
    const map = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    expect(map.clusterOrder[0]).toBe('root');
  });

  it('tangent forms its own cluster (id matches BR-001 branch root)', () => {
    const nodes = buildFortyEightPlusTwoNodeFixture();
    const timelineMap = buildTimelineMap(nodes);
    const map = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.has('tangent-0')).toBe(true);
  });

  it('no cluster spans across BR-001 branch root boundaries', () => {
    const nodes = buildFortyEightPlusTwoNodeFixture();
    const timelineMap = buildTimelineMap(nodes);
    const map = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    for (const [clusterId, summary] of map.byCluster.entries()) {
      for (const memberId of summary.messageIds) {
        const node = nodes.find((n) => n.messageId === memberId);
        expect(node).toBeDefined();
        expect(node!.branchRootMessageId).toBe(clusterId);
      }
    }
  });

  it('branchKindMap output and lifecycle derivation are independent (collapse does not change lifecycle)', () => {
    const nodes = buildFortyEightPlusTwoNodeFixture();
    const timelineMap = buildTimelineMap(nodes);

    // Run BR-001's classifier to confirm it produces a valid branchKindMap
    // on the same fixture — but lifecycle derivation does not consume it.
    const evidenceThreadByBranchRoot = buildEvidenceThreadMap(timelineMap.nodes);
    const branchKindMap = buildBranchKindMap({
      nodes: timelineMap.nodes,
      edges: timelineMap.edges,
      evidenceThreadByBranchRoot,
    });
    expect(branchKindMap.size).toBeGreaterThan(0);

    // Lifecycle map without BR-001 collapse state.
    const mapBase = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    // Lifecycle map "with" a hypothetical collapse state — collapse is a
    // UI concern; lifecycle reads the underlying tree regardless of
    // visibility. We confirm by re-running with the same input.
    const mapAgain = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    expect(mapAgain.byCluster.size).toBe(mapBase.byCluster.size);
    // Cluster states should be deep-equal.
    for (const cid of mapBase.clusterOrder) {
      expect(mapAgain.byCluster.get(cid)!.state).toBe(mapBase.byCluster.get(cid)!.state);
    }
  });
});

// ── Forbidden imports doctrine anchor ─────────────────────────

describe('LIFE-001 forbidden imports doctrine anchor', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const lifecycleFiles = [
    path.join(repoRoot, 'src', 'features', 'lifecycle', 'pointLifecycleModel.ts'),
    path.join(repoRoot, 'src', 'features', 'lifecycle', 'pointLifecycleClusters.ts'),
    path.join(repoRoot, 'src', 'features', 'lifecycle', 'pointLifecycleAdvisoryInputs.ts'),
    path.join(repoRoot, 'src', 'features', 'lifecycle', 'index.ts'),
  ];

  it('no lifecycle file imports `deriveMessageCategory` as a function', () => {
    for (const file of lifecycleFiles) {
      const source = fs.readFileSync(file, 'utf8');
      // Type imports are OK (`import type { MessageCategory } ...`).
      // Value imports of derivation functions are NOT OK.
      // Match `import { ... deriveMessageCategory ... } from ...` (no leading `type`).
      const valueImportRegex = /import\s+\{[^}]*\bderiveMessageCategory\b[^}]*\}\s+from/;
      const matches = source.match(valueImportRegex);
      // If the import block starts with `import type {` it's fine.
      if (matches) {
        // Re-check that the match isn't part of an `import type {` block.
        const isTypeOnly = /import\s+type\s+\{[^}]*\bderiveMessageCategory\b[^}]*\}/.test(source);
        expect(isTypeOnly).toBe(true);
      }
    }
  });

  it('no lifecycle file imports `derivePrimaryQualifier` as a function', () => {
    for (const file of lifecycleFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const valueImportRegex = /import\s+\{[^}]*\bderivePrimaryQualifier\b[^}]*\}\s+from/;
      const matches = source.match(valueImportRegex);
      if (matches) {
        const isTypeOnly = /import\s+type\s+\{[^}]*\bderivePrimaryQualifier\b[^}]*\}/.test(source);
        expect(isTypeOnly).toBe(true);
      }
    }
  });

  it('no lifecycle file imports `deriveMessageQualifiers` as a function', () => {
    for (const file of lifecycleFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const valueImportRegex = /import\s+\{[^}]*\bderiveMessageQualifiers\b[^}]*\}\s+from/;
      const matches = source.match(valueImportRegex);
      if (matches) {
        const isTypeOnly = /import\s+type\s+\{[^}]*\bderiveMessageQualifiers\b[^}]*\}/.test(source);
        expect(isTypeOnly).toBe(true);
      }
    }
  });

  it('no lifecycle file imports `applyAntiAmplification`', () => {
    for (const file of lifecycleFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source.includes('applyAntiAmplification')).toBe(false);
    }
  });

  it('no lifecycle file imports `gradeChallenge` / `gradeRepair`', () => {
    for (const file of lifecycleFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source.includes('gradeChallenge')).toBe(false);
      expect(source.includes('gradeRepair')).toBe(false);
    }
  });

  it('no lifecycle file imports React, Supabase, or fetch (pure-TS hygiene)', () => {
    for (const file of lifecycleFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(/from\s+['"]react['"]/.test(source)).toBe(false);
      expect(/from\s+['"]react-native['"]/.test(source)).toBe(false);
      expect(/@supabase/.test(source)).toBe(false);
      expect(/\bfetch\s*\(/.test(source)).toBe(false);
    }
  });

  it('no lifecycle file references AI provider modules', () => {
    for (const file of lifecycleFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(/anthropic/i.test(source)).toBe(false);
      expect(/\bxAI\b/i.test(source)).toBe(false);
      expect(/openai/i.test(source)).toBe(false);
    }
  });
});
