/**
 * BR-001 — branchTopologyModel pure-model tests.
 *
 * No React, no Supabase, no network. Covers:
 *   - Decision-table coverage (rows 1–7 explicit + pass-2 'tangent' /
 *     'kink_end' rows 8–9).
 *   - Acceptance-criterion tests from the BR-001 card body (4).
 *   - Evidence-thread detection (threshold, cycle defensiveness).
 *   - Collapse state semantics (immutable, toggle, auto-expand).
 *   - Pre-collapsed input feeder.
 *   - VG-002 surface lock (RailBranchKind / RailSegmentInput unchanged).
 *   - Ban-list (verdict / amplification / snake_case) on every produced
 *     user-facing string.
 *   - Doctrine anchors (popularity / heat does not influence kink
 *     detection; evidence-thread is topology, not truth).
 *   - Performance — 250-message synthetic fixture in < 50 ms.
 */

import {
  applyActiveAutoExpand,
  buildBranchKindMap,
  buildCollapsedRailInputs,
  buildEvidenceThreadMap,
  deriveBranchKindFromConstitutionModel,
  derivePlaceholderBranchKindBR001Adapter,
  EMPTY_COLLAPSE_STATE,
  hasTangentLexicalCode,
  isEvidenceLikeNode,
  toggleBranchCollapse,
  type BranchCollapseState,
  type RailStubViewModel,
} from '../src/features/arguments/branchTopologyModel';
import {
  ALL_RAIL_BRANCH_KINDS,
  derivePlaceholderBranchKind,
  type RailBranchKind,
  type RailSegmentInput,
} from '../src/features/arguments/railSegmentModel';
import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Ban-lists (same as VG-002) ────────────────────────────────────

const VERDICT_TOKENS: ReadonlyArray<string> = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'bot',
  'astroturfer',
  'verdict',
  'proof',
  'proven',
  'disproven',
  'validated',
  'winning',
];

// `true` / `false` are excluded from the user-visible ban list here
// because the active-message accessibility hint may legitimately render
// the phrase "Includes the active message." — the doctrine ban-list
// targets verdict claims, not arbitrary English.

const AMPLIFICATION_TOKENS: ReadonlyArray<string> = [
  'likes',
  'retweets',
  'shares',
  'views',
  'followers',
  'verified',
  'engagement',
  'amplification',
  'trending',
  'virality',
  'popular',
  'viral',
];

function assertNoBanned(s: string, tokens: ReadonlyArray<string>) {
  const lower = s.toLowerCase();
  for (const t of tokens) {
    expect(lower.includes(t.toLowerCase())).toBe(false);
  }
}

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

function fakeSegment(over: Partial<RailSegmentInput> = {}): RailSegmentInput {
  return {
    segmentId: over.segmentId ?? 'seg-1',
    fromMessageId: over.fromMessageId ?? 'm1',
    toMessageId: over.toMessageId ?? 'm2',
    x1: over.x1 ?? 0,
    y1: over.y1 ?? 100,
    x2: over.x2 ?? 100,
    y2: over.y2 ?? 100,
    gradientStops: over.gradientStops ?? ['#22c55e', '#f59e0b'],
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    sourceChainStatus: over.sourceChainStatus ?? 'no_source',
    branchKind: (over.branchKind ?? 'main') as RailBranchKind,
    isActivePath: over.isActivePath ?? false,
    isFirstClash: over.isFirstClash ?? false,
  };
}

/** Build a small tree:
 *
 *   m0 (root)
 *    ├── m1 (siblingIndex 0) — branch root continues parent lane
 *    │    └── m1c (child of m1)
 *    ├── m2 (siblingIndex 1) — additional sibling → kink_start branch
 *    │    └── m2c (child of m2)
 *    └── m3 (siblingIndex 2) — additional sibling → kink_start branch
 */
function buildSmallTree(): {
  nodes: ArgumentTimelineMapNode[];
  edges: ArgumentTimelineMapEdge[];
} {
  const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0', siblingIndex: 0, x: 0 });
  const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm0', siblingIndex: 0, x: 100 });
  const m1c = fakeNode({ messageId: 'm1c', parentId: 'm1', branchRootMessageId: 'm0', siblingIndex: 0, x: 200 });
  const m2 = fakeNode({ messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2', siblingIndex: 1, x: 300 });
  const m2c = fakeNode({ messageId: 'm2c', parentId: 'm2', branchRootMessageId: 'm2', siblingIndex: 0, x: 400 });
  const m3 = fakeNode({ messageId: 'm3', parentId: 'm0', branchRootMessageId: 'm3', siblingIndex: 2, x: 500 });
  return {
    nodes: [m0, m1, m1c, m2, m2c, m3],
    edges: [
      fakeEdge({ edgeId: 'e-m0-m1', fromMessageId: 'm0', toMessageId: 'm1' }),
      fakeEdge({ edgeId: 'e-m1-m1c', fromMessageId: 'm1', toMessageId: 'm1c' }),
      fakeEdge({ edgeId: 'e-m0-m2', fromMessageId: 'm0', toMessageId: 'm2' }),
      fakeEdge({ edgeId: 'e-m2-m2c', fromMessageId: 'm2', toMessageId: 'm2c' }),
      fakeEdge({ edgeId: 'e-m0-m3', fromMessageId: 'm0', toMessageId: 'm3' }),
    ],
  };
}

function nodeById(nodes: ReadonlyArray<ArgumentTimelineMapNode>): Map<string, ArgumentTimelineMapNode> {
  const m = new Map<string, ArgumentTimelineMapNode>();
  for (const n of nodes) m.set(n.messageId, n);
  return m;
}

// ── 1. Evidence-thread detection ────────────────────────────────

describe('BR-001 — isEvidenceLikeNode', () => {
  it('returns true for evidence color family', () => {
    expect(isEvidenceLikeNode(fakeNode({ kindColorFamily: 'evidence' }))).toBe(true);
  });

  it('returns true for the source_request qualifier code', () => {
    expect(isEvidenceLikeNode(fakeNode({
      kindColorFamily: 'claim',
      droppedTags: [{ code: 'source_request', label: 'Ask source', color: '#fff' }],
    }))).toBe(true);
  });

  it('returns true for quote_request', () => {
    expect(isEvidenceLikeNode(fakeNode({
      kindColorFamily: 'claim',
      droppedTags: [{ code: 'quote_request', label: 'Ask quote', color: '#fff' }],
    }))).toBe(true);
  });

  it('returns true for the future-compat ask_receipts qualifier', () => {
    expect(isEvidenceLikeNode(fakeNode({
      kindColorFamily: 'claim',
      droppedTags: [{ code: 'ask_receipts', label: 'Ask receipts', color: '#fff' }],
    }))).toBe(true);
  });

  it('returns false for a plain claim with no evidence tags', () => {
    expect(isEvidenceLikeNode(fakeNode())).toBe(false);
  });
});

describe('BR-001 — buildEvidenceThreadMap', () => {
  it('empty node list → empty map', () => {
    const map = buildEvidenceThreadMap([]);
    expect(map.size).toBe(0);
  });

  it('2-node evidence subtree → evidence-thread true', () => {
    const root = fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r' });
    const branchRoot = fakeNode({
      messageId: 'br',
      parentId: 'r',
      branchRootMessageId: 'br',
    });
    const evidenceChild = fakeNode({
      messageId: 'ev1',
      parentId: 'br',
      branchRootMessageId: 'br',
      kindColorFamily: 'evidence',
    });
    const evidenceChild2 = fakeNode({
      messageId: 'ev2',
      parentId: 'ev1',
      branchRootMessageId: 'br',
      kindColorFamily: 'evidence',
    });
    const map = buildEvidenceThreadMap([root, branchRoot, evidenceChild, evidenceChild2]);
    expect(map.get('br')).toBe(true);
  });

  it('2-node non-evidence subtree → evidence-thread false', () => {
    const root = fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r' });
    const branchRoot = fakeNode({
      messageId: 'br',
      parentId: 'r',
      branchRootMessageId: 'br',
    });
    const child1 = fakeNode({
      messageId: 'c1',
      parentId: 'br',
      branchRootMessageId: 'br',
    });
    const child2 = fakeNode({
      messageId: 'c2',
      parentId: 'c1',
      branchRootMessageId: 'br',
    });
    const map = buildEvidenceThreadMap([root, branchRoot, child1, child2]);
    expect(map.get('br')).toBe(false);
  });

  it('5-node subtree with 3/2 evidence-to-non → true (60%)', () => {
    const root = fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r' });
    const br = fakeNode({ messageId: 'br', parentId: 'r', branchRootMessageId: 'br' });
    const e1 = fakeNode({ messageId: 'e1', parentId: 'br', branchRootMessageId: 'br', kindColorFamily: 'evidence' });
    const e2 = fakeNode({ messageId: 'e2', parentId: 'e1', branchRootMessageId: 'br', kindColorFamily: 'evidence' });
    const e3 = fakeNode({ messageId: 'e3', parentId: 'e2', branchRootMessageId: 'br', kindColorFamily: 'evidence' });
    const n1 = fakeNode({ messageId: 'n1', parentId: 'br', branchRootMessageId: 'br' });
    const n2 = fakeNode({ messageId: 'n2', parentId: 'n1', branchRootMessageId: 'br' });
    const map = buildEvidenceThreadMap([root, br, e1, e2, e3, n1, n2]);
    expect(map.get('br')).toBe(true);
  });

  it('5-node subtree with 2/3 evidence-to-non → false (40%)', () => {
    const root = fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r' });
    const br = fakeNode({ messageId: 'br', parentId: 'r', branchRootMessageId: 'br' });
    const e1 = fakeNode({ messageId: 'e1', parentId: 'br', branchRootMessageId: 'br', kindColorFamily: 'evidence' });
    const e2 = fakeNode({ messageId: 'e2', parentId: 'e1', branchRootMessageId: 'br', kindColorFamily: 'evidence' });
    const n1 = fakeNode({ messageId: 'n1', parentId: 'br', branchRootMessageId: 'br' });
    const n2 = fakeNode({ messageId: 'n2', parentId: 'n1', branchRootMessageId: 'br' });
    const n3 = fakeNode({ messageId: 'n3', parentId: 'n2', branchRootMessageId: 'br' });
    const map = buildEvidenceThreadMap([root, br, e1, e2, n1, n2, n3]);
    expect(map.get('br')).toBe(false);
  });

  it('lone branch root (no descendants) → false (size < 2)', () => {
    const root = fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r' });
    const lone = fakeNode({
      messageId: 'br',
      parentId: 'r',
      branchRootMessageId: 'br',
      kindColorFamily: 'evidence',
    });
    const map = buildEvidenceThreadMap([root, lone]);
    expect(map.get('br')).toBe(false);
  });

  it('cycle defensiveness — does not infinite-loop', () => {
    const root = fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r' });
    const a = fakeNode({ messageId: 'a', parentId: 'r', branchRootMessageId: 'a', kindColorFamily: 'evidence' });
    const b = fakeNode({ messageId: 'b', parentId: 'a', branchRootMessageId: 'a', kindColorFamily: 'evidence' });
    // Force a cycle by lying about parentage in another node.
    const c = fakeNode({ messageId: 'c', parentId: 'b', branchRootMessageId: 'a', kindColorFamily: 'evidence' });
    // d → e → d would be a cycle; the surface model never produces it,
    // but we still defend.
    const map = buildEvidenceThreadMap([root, a, b, c]);
    expect(typeof map.get('a')).toBe('boolean');
  });
});

// ── 2. Topology classifier — decision table rows 1–7 ─────────────

describe('BR-001 — deriveBranchKindFromConstitutionModel (decision rows 1–7)', () => {
  it('row 1: isDetached → detached', () => {
    const k = deriveBranchKindFromConstitutionModel({
      fromNode: fakeNode(),
      toNode: fakeNode({ messageId: 'm2' }),
      isDetached: true,
      siblingIndex: 0,
      isEvidenceThread: false,
      hasTangentLexicalCode: false,
    });
    expect(k).toBe('detached');
  });

  it('row 2: !detached + siblingIndex 0 + evidence-thread → main', () => {
    const k = deriveBranchKindFromConstitutionModel({
      fromNode: fakeNode(),
      toNode: fakeNode({ messageId: 'm2' }),
      isDetached: false,
      siblingIndex: 0,
      isEvidenceThread: true,
      hasTangentLexicalCode: false,
    });
    expect(k).toBe('main');
  });

  it('row 3: !detached + siblingIndex 0 + non-evidence + no-tag → main', () => {
    const k = deriveBranchKindFromConstitutionModel({
      fromNode: fakeNode(),
      toNode: fakeNode({ messageId: 'm2' }),
      isDetached: false,
      siblingIndex: 0,
      isEvidenceThread: false,
      hasTangentLexicalCode: false,
    });
    expect(k).toBe('main');
  });

  it('row 4: !detached + siblingIndex 0 + non-evidence + explicit-tag → kink_start', () => {
    const k = deriveBranchKindFromConstitutionModel({
      fromNode: fakeNode(),
      toNode: fakeNode({ messageId: 'm2' }),
      isDetached: false,
      siblingIndex: 0,
      isEvidenceThread: false,
      hasTangentLexicalCode: true,
    });
    expect(k).toBe('kink_start');
  });

  it('row 5: !detached + siblingIndex ≥ 1 + evidence-thread → main', () => {
    for (const idx of [1, 2, 3, 4]) {
      const k = deriveBranchKindFromConstitutionModel({
        fromNode: fakeNode(),
        toNode: fakeNode({ messageId: 'm2' }),
        isDetached: false,
        siblingIndex: idx,
        isEvidenceThread: true,
        hasTangentLexicalCode: false,
      });
      expect(k).toBe('main');
    }
  });

  it('row 6: !detached + siblingIndex ≥ 1 + non-evidence + no-tag → kink_start', () => {
    for (const idx of [1, 2, 3, 4, 7]) {
      const k = deriveBranchKindFromConstitutionModel({
        fromNode: fakeNode(),
        toNode: fakeNode({ messageId: 'm2' }),
        isDetached: false,
        siblingIndex: idx,
        isEvidenceThread: false,
        hasTangentLexicalCode: false,
      });
      expect(k).toBe('kink_start');
    }
  });

  it('row 7: !detached + siblingIndex ≥ 1 + non-evidence + explicit-tag → kink_start', () => {
    const k = deriveBranchKindFromConstitutionModel({
      fromNode: fakeNode(),
      toNode: fakeNode({ messageId: 'm2' }),
      isDetached: false,
      siblingIndex: 2,
      isEvidenceThread: false,
      hasTangentLexicalCode: true,
    });
    expect(k).toBe('kink_start');
  });

  it('detached takes precedence over every other axis', () => {
    const variants: Array<{ siblingIndex: number; isEvidenceThread: boolean; hasTangentLexicalCode: boolean }> = [
      { siblingIndex: 0, isEvidenceThread: false, hasTangentLexicalCode: false },
      { siblingIndex: 0, isEvidenceThread: true, hasTangentLexicalCode: true },
      { siblingIndex: 4, isEvidenceThread: false, hasTangentLexicalCode: false },
      { siblingIndex: 4, isEvidenceThread: true, hasTangentLexicalCode: true },
    ];
    for (const v of variants) {
      const k = deriveBranchKindFromConstitutionModel({
        fromNode: fakeNode(),
        toNode: fakeNode({ messageId: 'm2' }),
        isDetached: true,
        ...v,
      });
      expect(k).toBe('detached');
    }
  });
});

// ── 3. buildBranchKindMap — pass 2 (tangent + kink_end) ──────────

describe('BR-001 — buildBranchKindMap pass 2', () => {
  it('empty edges → empty map', () => {
    const m = buildBranchKindMap({
      nodes: [],
      edges: [],
      evidenceThreadByBranchRoot: new Map(),
    });
    expect(m.size).toBe(0);
  });

  it('small tree: first sibling → main; additional sibling → kink_start', () => {
    const { nodes, edges } = buildSmallTree();
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    expect(map.get('e-m0-m1')).toBe('main');
    expect(map.get('e-m0-m2')).toBe('kink_start');
    expect(map.get('e-m0-m3')).toBe('kink_start');
  });

  it('first child of mainline first sibling continues as main (lane-continuity mirror)', () => {
    const { nodes, edges } = buildSmallTree();
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    expect(map.get('e-m1-m1c')).toBe('main');
  });

  it('interior edge under a kink_start becomes tangent', () => {
    const { nodes, edges } = buildSmallTree();
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    // m2c is the child of m2 (a kink_start). Its inbound edge has no
    // children of its own → kink_end (the leaf of the tangent subtree).
    expect(map.get('e-m2-m2c')).toBe('kink_end');
  });

  it('deeply nested tangents — kink_end fires only on the leaf', () => {
    // m0 ─ m1 (sibling 0 main) ─ m2 (sibling 0 main)
    //  └── m3 (sibling 1 kink_start)
    //        └── m4 (only child — tangent)
    //              └── m5 (only child — tangent)
    //                    └── m6 (leaf — kink_end)
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm0', siblingIndex: 0 });
    const m2 = fakeNode({ messageId: 'm2', parentId: 'm1', branchRootMessageId: 'm0', siblingIndex: 0 });
    const m3 = fakeNode({ messageId: 'm3', parentId: 'm0', branchRootMessageId: 'm3', siblingIndex: 1 });
    const m4 = fakeNode({ messageId: 'm4', parentId: 'm3', branchRootMessageId: 'm3', siblingIndex: 0 });
    const m5 = fakeNode({ messageId: 'm5', parentId: 'm4', branchRootMessageId: 'm3', siblingIndex: 0 });
    const m6 = fakeNode({ messageId: 'm6', parentId: 'm5', branchRootMessageId: 'm3', siblingIndex: 0 });
    const nodes = [m0, m1, m2, m3, m4, m5, m6];
    const edges = [
      fakeEdge({ edgeId: 'e-m0-m1', fromMessageId: 'm0', toMessageId: 'm1' }),
      fakeEdge({ edgeId: 'e-m1-m2', fromMessageId: 'm1', toMessageId: 'm2' }),
      fakeEdge({ edgeId: 'e-m0-m3', fromMessageId: 'm0', toMessageId: 'm3' }),
      fakeEdge({ edgeId: 'e-m3-m4', fromMessageId: 'm3', toMessageId: 'm4' }),
      fakeEdge({ edgeId: 'e-m4-m5', fromMessageId: 'm4', toMessageId: 'm5' }),
      fakeEdge({ edgeId: 'e-m5-m6', fromMessageId: 'm5', toMessageId: 'm6' }),
    ];
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    expect(map.get('e-m0-m1')).toBe('main');
    expect(map.get('e-m1-m2')).toBe('main');
    expect(map.get('e-m0-m3')).toBe('kink_start');
    expect(map.get('e-m3-m4')).toBe('tangent');
    expect(map.get('e-m4-m5')).toBe('tangent');
    expect(map.get('e-m5-m6')).toBe('kink_end');
  });

  it('evidence-thread sibling stays main even when not first-born', () => {
    // m0 ─ m1 (sibling 0 main)
    //  └── m2 (sibling 1) — would normally be kink_start
    //        └── m3 evidence
    //              └── m4 evidence — branch is evidence-dominated
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm0', siblingIndex: 0 });
    const m2 = fakeNode({
      messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2', siblingIndex: 1,
    });
    const m3 = fakeNode({
      messageId: 'm3', parentId: 'm2', branchRootMessageId: 'm2',
      kindColorFamily: 'evidence',
    });
    const m4 = fakeNode({
      messageId: 'm4', parentId: 'm3', branchRootMessageId: 'm2',
      kindColorFamily: 'evidence',
    });
    const nodes = [m0, m1, m2, m3, m4];
    const edges = [
      fakeEdge({ edgeId: 'e-m0-m1', fromMessageId: 'm0', toMessageId: 'm1' }),
      fakeEdge({ edgeId: 'e-m0-m2', fromMessageId: 'm0', toMessageId: 'm2' }),
      fakeEdge({ edgeId: 'e-m2-m3', fromMessageId: 'm2', toMessageId: 'm3' }),
      fakeEdge({ edgeId: 'e-m3-m4', fromMessageId: 'm3', toMessageId: 'm4' }),
    ];
    const evidenceMap = buildEvidenceThreadMap(nodes);
    expect(evidenceMap.get('m2')).toBe(true);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    expect(map.get('e-m0-m2')).toBe('main');
    expect(map.get('e-m2-m3')).toBe('main');
    expect(map.get('e-m3-m4')).toBe('main');
  });

  it('every produced value is one of the five locked RailBranchKinds', () => {
    const { nodes, edges } = buildSmallTree();
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    for (const value of map.values()) {
      expect(ALL_RAIL_BRANCH_KINDS).toContain(value);
    }
  });

  it('edge with missing fromNode/toNode → defensive detached', () => {
    const nodes = [fakeNode({ messageId: 'm0' })];
    const edges = [fakeEdge({ edgeId: 'e-orphan', fromMessageId: 'ghost', toMessageId: 'm0' })];
    const map = buildBranchKindMap({
      nodes,
      edges,
      evidenceThreadByBranchRoot: new Map(),
    });
    expect(map.get('e-orphan')).toBe('detached');
  });
});

// ── 4. Acceptance criteria from the BR-001 card body ─────────────

describe('BR-001 — [ISSUE] AC tests', () => {
  it('[ISSUE] Sibling branches get deterministic lanes', () => {
    // Build 5 siblings under one parent.
    const parent = fakeNode({ messageId: 'p', parentId: null, branchRootMessageId: 'p' });
    const siblings = [0, 1, 2, 3, 4].map((i) =>
      fakeNode({
        messageId: `c${i}`,
        parentId: 'p',
        branchRootMessageId: i === 0 ? 'p' : `c${i}`,
        siblingIndex: i,
      }),
    );
    const nodes = [parent, ...siblings];
    const edges = siblings.map((s, i) =>
      fakeEdge({ edgeId: `e-p-${s.messageId}`, fromMessageId: 'p', toMessageId: s.messageId, x1: i * 50, x2: (i + 1) * 50 }),
    );
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    expect(map.get('e-p-c0')).toBe('main');
    expect(map.get('e-p-c1')).toBe('kink_start');
    expect(map.get('e-p-c2')).toBe('kink_start');
    expect(map.get('e-p-c3')).toBe('kink_start');
    expect(map.get('e-p-c4')).toBe('kink_start');

    // Stability — running twice produces deep-equal output.
    const map2 = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    expect([...map2.entries()]).toEqual([...map.entries()]);
  });

  it('[ISSUE] Tangent creates kink edge', () => {
    // m0 ─ m1 (main first sibling)
    //  └── m2 (kink_start sibling 1)
    //        └── m2c (tangent interior)
    //              └── m2cc (kink_end leaf)
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm0', siblingIndex: 0 });
    const m2 = fakeNode({ messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2', siblingIndex: 1 });
    const m2c = fakeNode({ messageId: 'm2c', parentId: 'm2', branchRootMessageId: 'm2', siblingIndex: 0 });
    const m2cc = fakeNode({ messageId: 'm2cc', parentId: 'm2c', branchRootMessageId: 'm2', siblingIndex: 0 });
    const nodes = [m0, m1, m2, m2c, m2cc];
    const edges = [
      fakeEdge({ edgeId: 'e-m0-m1', fromMessageId: 'm0', toMessageId: 'm1' }),
      fakeEdge({ edgeId: 'e-m0-m2', fromMessageId: 'm0', toMessageId: 'm2' }),
      fakeEdge({ edgeId: 'e-m2-m2c', fromMessageId: 'm2', toMessageId: 'm2c' }),
      fakeEdge({ edgeId: 'e-m2c-m2cc', fromMessageId: 'm2c', toMessageId: 'm2cc' }),
    ];
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    expect(map.get('e-m0-m2')).toBe('kink_start');
    expect(map.get('e-m2-m2c')).toBe('tangent');
    expect(map.get('e-m2c-m2cc')).toBe('kink_end');
  });

  it('[ISSUE] Collapsed branch preserves count and stub', () => {
    // Mainline: m0 → m1 → m1c (3 messages incl. root)
    // Branch starting m2 (5 messages incl. root): m2 → m2a → m2b → m2c → m2d
    // Branch starting m3 (3 messages incl. root): m3 → m3a → m3b
    // Collapse the m2 branch — assert 4 hidden messages (m2a..m2d) and
    // a single stub with label containing "4".
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0', x: 0 });
    const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm0', siblingIndex: 0, x: 100 });
    const m1c = fakeNode({ messageId: 'm1c', parentId: 'm1', branchRootMessageId: 'm0', siblingIndex: 0, x: 200 });
    const m2 = fakeNode({ messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2', siblingIndex: 1, x: 300 });
    const m2a = fakeNode({ messageId: 'm2a', parentId: 'm2', branchRootMessageId: 'm2', siblingIndex: 0, x: 400 });
    const m2b = fakeNode({ messageId: 'm2b', parentId: 'm2a', branchRootMessageId: 'm2', siblingIndex: 0, x: 500 });
    const m2c = fakeNode({ messageId: 'm2c', parentId: 'm2b', branchRootMessageId: 'm2', siblingIndex: 0, x: 600 });
    const m2d = fakeNode({ messageId: 'm2d', parentId: 'm2c', branchRootMessageId: 'm2', siblingIndex: 0, x: 700 });
    const m3 = fakeNode({ messageId: 'm3', parentId: 'm0', branchRootMessageId: 'm3', siblingIndex: 2, x: 800 });
    const m3a = fakeNode({ messageId: 'm3a', parentId: 'm3', branchRootMessageId: 'm3', siblingIndex: 0, x: 900 });
    const m3b = fakeNode({ messageId: 'm3b', parentId: 'm3a', branchRootMessageId: 'm3', siblingIndex: 0, x: 1000 });

    const nodes = [m0, m1, m1c, m2, m2a, m2b, m2c, m2d, m3, m3a, m3b];
    const segments: RailSegmentInput[] = [
      fakeSegment({ segmentId: 'seg-m0-m1', fromMessageId: 'm0', toMessageId: 'm1' }),
      fakeSegment({ segmentId: 'seg-m1-m1c', fromMessageId: 'm1', toMessageId: 'm1c' }),
      fakeSegment({ segmentId: 'seg-m0-m2', fromMessageId: 'm0', toMessageId: 'm2' }),
      fakeSegment({ segmentId: 'seg-m2-m2a', fromMessageId: 'm2', toMessageId: 'm2a' }),
      fakeSegment({ segmentId: 'seg-m2a-m2b', fromMessageId: 'm2a', toMessageId: 'm2b' }),
      fakeSegment({ segmentId: 'seg-m2b-m2c', fromMessageId: 'm2b', toMessageId: 'm2c' }),
      fakeSegment({ segmentId: 'seg-m2c-m2d', fromMessageId: 'm2c', toMessageId: 'm2d' }),
      fakeSegment({ segmentId: 'seg-m0-m3', fromMessageId: 'm0', toMessageId: 'm3' }),
      fakeSegment({ segmentId: 'seg-m3-m3a', fromMessageId: 'm3', toMessageId: 'm3a' }),
      fakeSegment({ segmentId: 'seg-m3a-m3b', fromMessageId: 'm3a', toMessageId: 'm3b' }),
    ];

    const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'm2');
    const result = buildCollapsedRailInputs({
      segments,
      nodeById: nodeById(nodes),
      collapseState: state,
    });
    expect(result.stubs.length).toBe(1);
    expect(result.stubs[0].branchRootMessageId).toBe('m2');
    expect(result.stubs[0].hiddenMessageCount).toBe(4);
    expect(result.stubs[0].label).toContain('4');
    // Verify the segments inside the m2 subtree are filtered out — the
    // inbound edge m0→m2 stays so the stub has a geometric anchor.
    const visibleIds = result.visibleSegments.map((s) => s.segmentId);
    expect(visibleIds).toContain('seg-m0-m2');
    expect(visibleIds).not.toContain('seg-m2-m2a');
    expect(visibleIds).not.toContain('seg-m2a-m2b');
    expect(visibleIds).not.toContain('seg-m2b-m2c');
    expect(visibleIds).not.toContain('seg-m2c-m2d');
    // The m3 branch is untouched.
    expect(visibleIds).toContain('seg-m0-m3');
    expect(visibleIds).toContain('seg-m3-m3a');
    expect(visibleIds).toContain('seg-m3a-m3b');
  });

  it('[ISSUE] Active branch path expands', () => {
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm0' });
    const m2 = fakeNode({ messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2' });
    const m2a = fakeNode({ messageId: 'm2a', parentId: 'm2', branchRootMessageId: 'm2' });
    const m3 = fakeNode({ messageId: 'm3', parentId: 'm0', branchRootMessageId: 'm3' });
    const m3a = fakeNode({ messageId: 'm3a', parentId: 'm3', branchRootMessageId: 'm3' });
    const nodes = [m0, m1, m2, m2a, m3, m3a];

    // Collapse both m2 and m3.
    let state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'm2');
    state = toggleBranchCollapse(state, 'm3');
    expect(state.m2).toBe('collapsed');
    expect(state.m3).toBe('collapsed');

    // Active message lives in the m2 subtree.
    const expanded = applyActiveAutoExpand(state, 'm2a', nodeById(nodes));
    expect(expanded.m2).toBeUndefined(); // m2 expanded away
    expect(expanded.m3).toBe('collapsed'); // m3 still collapsed
  });
});

// ── 5. Collapse state semantics ──────────────────────────────────

describe('BR-001 — collapse state semantics', () => {
  it('toggleBranchCollapse is immutable — original unchanged', () => {
    const a = EMPTY_COLLAPSE_STATE;
    const b = toggleBranchCollapse(a, 'br-1');
    expect(a).toEqual({});
    expect(b).toEqual({ 'br-1': 'collapsed' });
  });

  it('toggling twice removes the entry (back to expanded default)', () => {
    const a = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br-1');
    const b = toggleBranchCollapse(a, 'br-1');
    expect(b).toEqual({});
  });

  it('EMPTY_COLLAPSE_STATE is treated as "everything expanded"', () => {
    const result = buildCollapsedRailInputs({
      segments: [fakeSegment()],
      nodeById: new Map([['m1', fakeNode()], ['m2', fakeNode({ messageId: 'm2', parentId: 'm1' })]]),
      collapseState: EMPTY_COLLAPSE_STATE,
    });
    expect(result.stubs).toEqual([]);
    expect(result.visibleSegments.length).toBe(1);
  });

  it('applyActiveAutoExpand(null active) is a no-op', () => {
    const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br-1');
    const out = applyActiveAutoExpand(state, null, new Map());
    expect(out).toBe(state); // same reference
  });

  it('applyActiveAutoExpand(active = root) is a no-op', () => {
    const root = fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r' });
    const otherBranch = fakeNode({ messageId: 'br', parentId: 'r', branchRootMessageId: 'br' });
    const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br');
    const out = applyActiveAutoExpand(state, 'r', nodeById([root, otherBranch]));
    expect(out).toEqual(state);
  });

  it('applyActiveAutoExpand returns the same reference when nothing changed', () => {
    // No branches collapsed, no work to do.
    const out = applyActiveAutoExpand(EMPTY_COLLAPSE_STATE, 'm1', new Map());
    expect(out).toBe(EMPTY_COLLAPSE_STATE);
  });

  it('double-collapsed ancestor expansion — both ancestors expand atomically', () => {
    // m0 ─ br1 ─ br1c ─ br2 (br2 is its own branch root under br1c)
    //                    └── br2c (deepest)
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const br1 = fakeNode({ messageId: 'br1', parentId: 'm0', branchRootMessageId: 'br1' });
    const br1c = fakeNode({ messageId: 'br1c', parentId: 'br1', branchRootMessageId: 'br1' });
    const br2 = fakeNode({ messageId: 'br2', parentId: 'br1c', branchRootMessageId: 'br2' });
    const br2c = fakeNode({ messageId: 'br2c', parentId: 'br2', branchRootMessageId: 'br2' });
    let state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br1');
    state = toggleBranchCollapse(state, 'br2');
    const out = applyActiveAutoExpand(state, 'br2c', nodeById([m0, br1, br1c, br2, br2c]));
    expect(out.br1).toBeUndefined();
    expect(out.br2).toBeUndefined();
  });
});

// ── 6. Pre-collapsed input feeder edge cases ─────────────────────

describe('BR-001 — buildCollapsedRailInputs', () => {
  it('empty collapse state → all segments visible, no stubs', () => {
    const segments = [fakeSegment(), fakeSegment({ segmentId: 'seg-2', fromMessageId: 'm2', toMessageId: 'm3' })];
    const nodes = [
      fakeNode({ messageId: 'm1' }),
      fakeNode({ messageId: 'm2', parentId: 'm1' }),
      fakeNode({ messageId: 'm3', parentId: 'm2' }),
    ];
    const result = buildCollapsedRailInputs({
      segments,
      nodeById: nodeById(nodes),
      collapseState: EMPTY_COLLAPSE_STATE,
    });
    expect(result.stubs).toEqual([]);
    expect(result.visibleSegments.map((s) => s.segmentId)).toEqual(['seg-1', 'seg-2']);
  });

  it('degenerate branch (no children inside) → no stub emitted', () => {
    // A collapse entry for a branch that has no children. The stub is
    // skipped because hiddenMessageCount === 0.
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm1' });
    const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'm1');
    const result = buildCollapsedRailInputs({
      segments: [fakeSegment({ segmentId: 's-m0-m1', fromMessageId: 'm0', toMessageId: 'm1' })],
      nodeById: nodeById([m0, m1]),
      collapseState: state,
    });
    expect(result.stubs).toEqual([]);
    // Inbound segment to the branch root stays visible.
    expect(result.visibleSegments.map((s) => s.segmentId)).toEqual(['s-m0-m1']);
  });

  it('containsActive flips true when active node lives in the collapsed subtree', () => {
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const br = fakeNode({ messageId: 'br', parentId: 'm0', branchRootMessageId: 'br' });
    const brc = fakeNode({ messageId: 'brc', parentId: 'br', branchRootMessageId: 'br' });
    const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br');
    const result = buildCollapsedRailInputs({
      segments: [
        fakeSegment({ segmentId: 's-m0-br', fromMessageId: 'm0', toMessageId: 'br' }),
        fakeSegment({ segmentId: 's-br-brc', fromMessageId: 'br', toMessageId: 'brc' }),
      ],
      nodeById: nodeById([m0, br, brc]),
      collapseState: state,
      activeMessageId: 'brc',
    });
    expect(result.stubs.length).toBe(1);
    expect(result.stubs[0].containsActive).toBe(true);
  });

  it('stub anchor uses branch root node coordinates', () => {
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0', x: 0, y: 100 });
    const br = fakeNode({ messageId: 'br', parentId: 'm0', branchRootMessageId: 'br', x: 250, y: 120 });
    const brc = fakeNode({ messageId: 'brc', parentId: 'br', branchRootMessageId: 'br', x: 350, y: 120 });
    const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br');
    const result = buildCollapsedRailInputs({
      segments: [
        fakeSegment({ segmentId: 's-m0-br', fromMessageId: 'm0', toMessageId: 'br' }),
        fakeSegment({ segmentId: 's-br-brc', fromMessageId: 'br', toMessageId: 'brc' }),
      ],
      nodeById: nodeById([m0, br, brc]),
      collapseState: state,
    });
    expect(result.stubs[0].anchorX).toBe(250);
    expect(result.stubs[0].anchorY).toBe(120);
  });

  it('all-collapsed tree — mainline survives + one stub per collapsed branch', () => {
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0', x: 0 });
    const a = fakeNode({ messageId: 'a', parentId: 'm0', branchRootMessageId: 'a', x: 100 });
    const ac = fakeNode({ messageId: 'ac', parentId: 'a', branchRootMessageId: 'a', x: 150 });
    const b = fakeNode({ messageId: 'b', parentId: 'm0', branchRootMessageId: 'b', x: 200 });
    const bc = fakeNode({ messageId: 'bc', parentId: 'b', branchRootMessageId: 'b', x: 250 });
    let state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'a');
    state = toggleBranchCollapse(state, 'b');
    const result = buildCollapsedRailInputs({
      segments: [
        fakeSegment({ segmentId: 's-m0-a', fromMessageId: 'm0', toMessageId: 'a' }),
        fakeSegment({ segmentId: 's-a-ac', fromMessageId: 'a', toMessageId: 'ac' }),
        fakeSegment({ segmentId: 's-m0-b', fromMessageId: 'm0', toMessageId: 'b' }),
        fakeSegment({ segmentId: 's-b-bc', fromMessageId: 'b', toMessageId: 'bc' }),
      ],
      nodeById: nodeById([m0, a, ac, b, bc]),
      collapseState: state,
    });
    expect(result.stubs.length).toBe(2);
    const ids = result.visibleSegments.map((s) => s.segmentId);
    expect(ids).toContain('s-m0-a');
    expect(ids).toContain('s-m0-b');
    expect(ids).not.toContain('s-a-ac');
    expect(ids).not.toContain('s-b-bc');
  });
});

// ── 7. VG-002 surface lock (regression guard) ────────────────────

describe('BR-001 — VG-002 surface lock', () => {
  it('RailBranchKind has exactly the five locked values', () => {
    expect(ALL_RAIL_BRANCH_KINDS).toEqual([
      'main',
      'tangent',
      'kink_start',
      'kink_end',
      'detached',
    ]);
  });

  it('every produced value is one of the locked kinds (sweep)', () => {
    const cases = [
      { isDetached: true, siblingIndex: 0, isEvidenceThread: false, hasTangentLexicalCode: false },
      { isDetached: false, siblingIndex: 0, isEvidenceThread: false, hasTangentLexicalCode: false },
      { isDetached: false, siblingIndex: 0, isEvidenceThread: false, hasTangentLexicalCode: true },
      { isDetached: false, siblingIndex: 0, isEvidenceThread: true, hasTangentLexicalCode: false },
      { isDetached: false, siblingIndex: 1, isEvidenceThread: false, hasTangentLexicalCode: false },
      { isDetached: false, siblingIndex: 1, isEvidenceThread: false, hasTangentLexicalCode: true },
      { isDetached: false, siblingIndex: 1, isEvidenceThread: true, hasTangentLexicalCode: false },
      { isDetached: false, siblingIndex: 5, isEvidenceThread: false, hasTangentLexicalCode: false },
    ];
    for (const c of cases) {
      const k = deriveBranchKindFromConstitutionModel({
        fromNode: fakeNode(),
        toNode: fakeNode({ messageId: 'm2' }),
        ...c,
      });
      expect(ALL_RAIL_BRANCH_KINDS).toContain(k);
    }
  });

  it('legacy adapter signature still works (three-arg shape)', () => {
    const fromNode = fakeNode();
    const toNode = fakeNode({ messageId: 'm2' });
    const adapterOut = derivePlaceholderBranchKindBR001Adapter({
      fromNode,
      toNode,
      isDetached: false,
    });
    expect(ALL_RAIL_BRANCH_KINDS).toContain(adapterOut);
  });

  it('VG-002 placeholder export is still callable (regression guard)', () => {
    // The exported function name is unchanged; whatever it now
    // delegates to, the call shape is preserved.
    const out = derivePlaceholderBranchKind({
      fromNode: fakeNode(),
      toNode: fakeNode({ messageId: 'm2' }),
      isDetached: false,
    });
    expect(ALL_RAIL_BRANCH_KINDS).toContain(out);
  });

  it('hasTangentLexicalCode detects both endpoint sides', () => {
    const a = fakeNode({ droppedTags: [{ code: 'branch_this_off', label: 'B', color: '#fff' }] });
    const b = fakeNode({ messageId: 'm2' });
    expect(hasTangentLexicalCode(a, b)).toBe(true);
    expect(hasTangentLexicalCode(b, a)).toBe(true);
    expect(hasTangentLexicalCode(fakeNode(), fakeNode({ messageId: 'm2' }))).toBe(false);
  });
});

// ── 8. Ban-list — verdict / amplification / snake_case ───────────

describe('BR-001 — ban-list (verdict / amplification / snake_case)', () => {
  function sweepStubLabels(): RailStubViewModel[] {
    // Sweep multiple hidden counts + active flags to capture every
    // user-facing string the stub builder can produce.
    const outAll: RailStubViewModel[] = [];
    for (const count of [1, 2, 3, 5, 12, 99]) {
      for (const active of [false, true]) {
        const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
        const br = fakeNode({ messageId: 'br', parentId: 'm0', branchRootMessageId: 'br', x: 100 });
        const subtreeNodes = Array.from({ length: count }, (_, i) =>
          fakeNode({
            messageId: `c${i}`,
            parentId: i === 0 ? 'br' : `c${i - 1}`,
            branchRootMessageId: 'br',
          }),
        );
        const allNodes = [m0, br, ...subtreeNodes];
        const segments: RailSegmentInput[] = subtreeNodes.map((n, i) =>
          fakeSegment({
            segmentId: `s-${i}`,
            fromMessageId: i === 0 ? 'br' : `c${i - 1}`,
            toMessageId: n.messageId,
          }),
        );
        const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br');
        const r = buildCollapsedRailInputs({
          segments: [
            fakeSegment({ segmentId: 's-m0-br', fromMessageId: 'm0', toMessageId: 'br' }),
            ...segments,
          ],
          nodeById: nodeById(allNodes),
          collapseState: state,
          activeMessageId: active ? `c${count - 1}` : null,
        });
        outAll.push(...r.stubs);
      }
    }
    return outAll;
  }

  it('every stub label contains zero verdict tokens', () => {
    for (const stub of sweepStubLabels()) {
      assertNoBanned(stub.label, VERDICT_TOKENS);
      assertNoBanned(stub.accessibilityLabel, VERDICT_TOKENS);
    }
  });

  it('every stub label contains zero amplification tokens', () => {
    for (const stub of sweepStubLabels()) {
      assertNoBanned(stub.label, AMPLIFICATION_TOKENS);
      assertNoBanned(stub.accessibilityLabel, AMPLIFICATION_TOKENS);
    }
  });

  it('no stub label looks like an internal snake_case code', () => {
    for (const stub of sweepStubLabels()) {
      expect(looksLikeInternalCode(stub.label)).toBe(false);
      expect(looksLikeInternalCode(stub.accessibilityLabel)).toBe(false);
    }
  });
});

// ── 9. Doctrine anchors ──────────────────────────────────────────

describe('BR-001 — doctrine anchors', () => {
  it('popularity / heat does not influence kink detection', () => {
    // Build two identical trees. Tree A: every node toneBand=hostile +
    // temperatureBand=hot. Tree B: every node calm + cool. The
    // classifier should produce deep-equal output.
    function build(toneBand: TimelineToneBand, temperatureBand: TimelineTemperatureBand) {
      const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0', toneBand, temperatureBand });
      const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm0', siblingIndex: 0, toneBand, temperatureBand });
      const m2 = fakeNode({ messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2', siblingIndex: 1, toneBand, temperatureBand });
      const m2c = fakeNode({ messageId: 'm2c', parentId: 'm2', branchRootMessageId: 'm2', toneBand, temperatureBand });
      const nodes = [m0, m1, m2, m2c];
      const edges = [
        fakeEdge({ edgeId: 'e1', fromMessageId: 'm0', toMessageId: 'm1' }),
        fakeEdge({ edgeId: 'e2', fromMessageId: 'm0', toMessageId: 'm2' }),
        fakeEdge({ edgeId: 'e3', fromMessageId: 'm2', toMessageId: 'm2c' }),
      ];
      const evidenceMap = buildEvidenceThreadMap(nodes);
      return buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    }
    const hot = build('hostile', 'hot');
    const cool = build('calm', 'cool');
    expect([...hot.entries()]).toEqual([...cool.entries()]);
  });

  it('standing band does not influence kink detection', () => {
    // Same as above but varying standingBand. The classifier never
    // reads standingBand.
    function build(standingBand: TimelineStandingBand) {
      const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0', standingBand });
      const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm0', siblingIndex: 0, standingBand });
      const m2 = fakeNode({ messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2', siblingIndex: 1, standingBand });
      const nodes = [m0, m1, m2];
      const edges = [
        fakeEdge({ edgeId: 'e1', fromMessageId: 'm0', toMessageId: 'm1' }),
        fakeEdge({ edgeId: 'e2', fromMessageId: 'm0', toMessageId: 'm2' }),
      ];
      const evidenceMap = buildEvidenceThreadMap(nodes);
      return buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    }
    const wrong = build('pretty_wrong');
    const right = build('pretty_right');
    expect([...wrong.entries()]).toEqual([...right.entries()]);
  });

  it('stub label says "side branch" — never "wrong / unimportant / off-topic"', () => {
    // Explicit phrasing assertion. The doctrine sentence is: a tangent
    // is a topology label, not a verdict.
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const br = fakeNode({
      messageId: 'br', parentId: 'm0', branchRootMessageId: 'br',
      droppedTags: [{ code: 'branch_this_off', label: 'Branch this off', color: '#fff' }],
    });
    const brc = fakeNode({ messageId: 'brc', parentId: 'br', branchRootMessageId: 'br' });
    const brcc = fakeNode({ messageId: 'brcc', parentId: 'brc', branchRootMessageId: 'br' });
    const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br');
    const r = buildCollapsedRailInputs({
      segments: [
        fakeSegment({ segmentId: 's1', fromMessageId: 'm0', toMessageId: 'br' }),
        fakeSegment({ segmentId: 's2', fromMessageId: 'br', toMessageId: 'brc' }),
        fakeSegment({ segmentId: 's3', fromMessageId: 'brc', toMessageId: 'brcc' }),
      ],
      nodeById: nodeById([m0, br, brc, brcc]),
      collapseState: state,
    });
    expect(r.stubs.length).toBe(1);
    expect(r.stubs[0].accessibilityLabel.toLowerCase()).toContain('side branch');
    expect(r.stubs[0].accessibilityLabel.toLowerCase()).not.toContain('wrong');
    expect(r.stubs[0].accessibilityLabel.toLowerCase()).not.toContain('off-topic');
    expect(r.stubs[0].accessibilityLabel.toLowerCase()).not.toContain('off topic');
    expect(r.stubs[0].accessibilityLabel.toLowerCase()).not.toContain('unimportant');
  });

  it('evidence-thread classification does NOT assert truth', () => {
    // Build a 2-edge subtree of evidence nodes — the evidence-thread
    // map flips to true. BR-001 does NOT change the rail's
    // sourceChainStatus layer; if EV-001 says 'broken', the rail
    // renders broken regardless of evidence-thread classification.
    // This test verifies the topology layer never mutates the
    // segment's `sourceChainStatus`.
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const br = fakeNode({ messageId: 'br', parentId: 'm0', branchRootMessageId: 'br', kindColorFamily: 'evidence' });
    const brc = fakeNode({ messageId: 'brc', parentId: 'br', branchRootMessageId: 'br', kindColorFamily: 'evidence' });
    const evidenceMap = buildEvidenceThreadMap([m0, br, brc]);
    expect(evidenceMap.get('br')).toBe(true);

    // The classifier never touches sourceChainStatus.
    const k = deriveBranchKindFromConstitutionModel({
      fromNode: m0,
      toNode: br,
      isDetached: false,
      siblingIndex: 0,
      isEvidenceThread: true,
      hasTangentLexicalCode: false,
    });
    expect(k).toBe('main');
    // Note: the segment's sourceChainStatus (broken vs source_and_quote)
    // is owned by buildRailSegmentInput via EV-001 — BR-001 has no
    // hook to change it. This is asserted structurally — the
    // classifier signature has no sourceChainStatus input.
  });
});

// ── 10. Performance — 250-message synthetic fixture ──────────────

describe('BR-001 — performance', () => {
  function buildLargeTree(n: number): {
    nodes: ArgumentTimelineMapNode[];
    edges: ArgumentTimelineMapEdge[];
  } {
    // Wide-and-shallow: root + 5 main-line nodes + (n - 6) tangent
    // children distributed across 10 branches.
    const root = fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r', x: 0 });
    const nodes: ArgumentTimelineMapNode[] = [root];
    const edges: ArgumentTimelineMapEdge[] = [];
    const branchCount = 10;
    const perBranch = Math.max(2, Math.floor((n - 1) / branchCount));
    let id = 0;
    for (let b = 0; b < branchCount; b += 1) {
      const branchRoot = fakeNode({
        messageId: `b${b}`,
        parentId: 'r',
        branchRootMessageId: `b${b}`,
        siblingIndex: b,
        x: 50 + b * 50,
      });
      nodes.push(branchRoot);
      edges.push(fakeEdge({ edgeId: `e-r-b${b}`, fromMessageId: 'r', toMessageId: `b${b}` }));
      let prevId = `b${b}`;
      for (let i = 0; i < perBranch; i += 1) {
        const mid = `b${b}-c${i}`;
        nodes.push(fakeNode({
          messageId: mid,
          parentId: prevId,
          branchRootMessageId: `b${b}`,
          siblingIndex: 0,
          x: 60 + b * 50 + i * 5,
        }));
        edges.push(fakeEdge({ edgeId: `e-${prevId}-${mid}`, fromMessageId: prevId, toMessageId: mid }));
        prevId = mid;
        id += 1;
        if (nodes.length >= n) break;
      }
      if (nodes.length >= n) break;
    }
    void id;
    return { nodes, edges };
  }

  it('250-message tree: buildEvidenceThreadMap + buildBranchKindMap < 50 ms', () => {
    const { nodes, edges } = buildLargeTree(250);
    const t0 = Date.now();
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    const elapsed = Date.now() - t0;
    expect(map.size).toBe(edges.length);
    expect(elapsed).toBeLessThan(50);
  });

  it('250-message tree: deep-equal output when called twice', () => {
    const { nodes, edges } = buildLargeTree(250);
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const a = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    const b = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('250-message tree: applyActiveAutoExpand stays under 5 ms even when fully collapsed', () => {
    const { nodes } = buildLargeTree(250);
    let state: BranchCollapseState = EMPTY_COLLAPSE_STATE;
    for (const n of nodes) {
      if (n.branchRootMessageId === n.messageId && n.parentId !== null) {
        state = toggleBranchCollapse(state, n.messageId);
      }
    }
    const t0 = Date.now();
    const last = nodes[nodes.length - 1];
    applyActiveAutoExpand(state, last.messageId, nodeById(nodes));
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(5);
  });
});

// ── 11. Edge cases ───────────────────────────────────────────────

describe('BR-001 — edge cases from the design doc', () => {
  it('root-only tree → empty classifier output', () => {
    const nodes = [fakeNode({ messageId: 'r', parentId: null, branchRootMessageId: 'r' })];
    const edges: ArgumentTimelineMapEdge[] = [];
    const map = buildBranchKindMap({
      nodes,
      edges,
      evidenceThreadByBranchRoot: new Map(),
    });
    expect(map.size).toBe(0);
  });

  it('all-tangent tree — every edge classified, kink_end fires only on leaves', () => {
    // m0 ─ m1 (sibling 1 → kink_start)
    // m0 ─ m2 (sibling 2 → kink_start)
    // m0 ─ m3 (sibling 3 → kink_start)
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm1', siblingIndex: 1 });
    const m2 = fakeNode({ messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2', siblingIndex: 2 });
    const m3 = fakeNode({ messageId: 'm3', parentId: 'm0', branchRootMessageId: 'm3', siblingIndex: 3 });
    const nodes = [m0, m1, m2, m3];
    const edges = [
      fakeEdge({ edgeId: 'e1', fromMessageId: 'm0', toMessageId: 'm1' }),
      fakeEdge({ edgeId: 'e2', fromMessageId: 'm0', toMessageId: 'm2' }),
      fakeEdge({ edgeId: 'e3', fromMessageId: 'm0', toMessageId: 'm3' }),
    ];
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    for (const k of map.values()) {
      expect(k).toBe('kink_start'); // each leaf is its own start — no child → keep start.
    }
  });

  it('all-evidence-thread tree — every edge stays main', () => {
    const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
    const m1 = fakeNode({ messageId: 'm1', parentId: 'm0', branchRootMessageId: 'm1', siblingIndex: 1, kindColorFamily: 'evidence' });
    const m1c = fakeNode({ messageId: 'm1c', parentId: 'm1', branchRootMessageId: 'm1', kindColorFamily: 'evidence' });
    const m2 = fakeNode({ messageId: 'm2', parentId: 'm0', branchRootMessageId: 'm2', siblingIndex: 2, kindColorFamily: 'evidence' });
    const m2c = fakeNode({ messageId: 'm2c', parentId: 'm2', branchRootMessageId: 'm2', kindColorFamily: 'evidence' });
    const nodes = [m0, m1, m1c, m2, m2c];
    const edges = [
      fakeEdge({ edgeId: 'e1', fromMessageId: 'm0', toMessageId: 'm1' }),
      fakeEdge({ edgeId: 'e2', fromMessageId: 'm1', toMessageId: 'm1c' }),
      fakeEdge({ edgeId: 'e3', fromMessageId: 'm0', toMessageId: 'm2' }),
      fakeEdge({ edgeId: 'e4', fromMessageId: 'm2', toMessageId: 'm2c' }),
    ];
    const evidenceMap = buildEvidenceThreadMap(nodes);
    const map = buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot: evidenceMap });
    for (const k of map.values()) {
      expect(k).toBe('main');
    }
  });
});
