/**
 * META-001 — Move metadata ledger tests.
 *
 * Pure-model tests for the entry point `buildMoveMetadataLedger` +
 * `applyManualTag` + `removeManualTag`. Covers:
 *   - Linkage record fields (per-message).
 *   - Per-cluster aggregation.
 *   - Map shape (byMessage / byCluster / messageOrder / inputHash).
 *   - JSON-serializability (round-trip preserves data).
 *   - Doctrine anchors (heat / standing / popularity do NOT feed any
 *     output; manual tags never auto-populate; moderation flag boundary).
 *   - Performance (< 60 ms for 250 messages).
 *   - applyManualTag / removeManualTag semantics (eligibility,
 *     dedupe, unknown message, reference-equal refusal).
 *   - Edge cases (1–22 from the design).
 */

import {
  applyManualTag,
  buildMoveMetadataLedger,
  removeManualTag,
  type EligibilityContext,
  type ManualTagEntry,
  type MoveMetadataLedger,
} from '../src/features/metadata';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineDroppedTag,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleSnapshot,
  PointLifecycleState,
  PointLifecycleAxis,
} from '../src/features/lifecycle';

// ── Fixture helpers ───────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: '', relativeLabel: '',
    actorLabel: 'U', kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: '', badges: [], droppedTags: over.droppedTags ?? [],
    depth: 0, lane: 0, siblingIndex: 0,
    replyCount: over.replyCount ?? 0, descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? `branch-${over.messageId ?? 'm1'}`,
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: null, isJunction: false, junctionChildCount: 0,
    isActive: false, isLatest: false, isDetached: over.isDetached ?? false, isActivePath: false,
    isRoot: over.isRoot ?? false, isFirstRebuttal: false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: 0, y: 0, accessibilityLabel: over.messageId ?? '',
  };
}

function fakeArtifact(argumentId: string, over: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: `${argumentId}:evidence:0`,
    argumentId,
    kind: 'url',
    label: 'Source',
    url: 'https://example.org/article',
    quote: 'Verbatim text.',
    sourceChainStatus: 'source_and_quote',
    risk: 'low',
    addedByUserId: 'u1',
    createdAt: '2026-05-18T10:00:00.000Z',
    ...over,
  };
}

function makeTimelineMap(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapModel {
  return {
    nodes, edges: [], bands: [],
    activeNode: null, latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: [], width: 0, height: 0, scrollWidth: 0,
    beginningLabel: '', middleLabel: '', endLabel: '',
    participantTrends: [], legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false, rootOnboardingHint: null,
    showBackToRootControl: false,
  };
}

function makeLifecycleMap(args: {
  clusters: ReadonlyArray<{
    clusterId: string;
    state: PointLifecycleState;
    messageIds: ReadonlyArray<string>;
    primaryAxis?: PointLifecycleAxis | null;
  }>;
  perMessage?: ReadonlyMap<string, {
    contribution?: PointLifecycleState;
    axis?: PointLifecycleAxis | null;
  }>;
}): PointLifecycleMap {
  const byCluster = new Map<string, PointLifecycleClusterSummary>();
  const byMessage = new Map<string, PointLifecycleSnapshot>();
  const clusterOrder: string[] = [];
  const cumulative: PointLifecycleState[] = [];
  for (const c of args.clusters) {
    byCluster.set(c.clusterId, {
      clusterId: c.clusterId,
      rootMessageId: c.clusterId,
      state: c.state,
      plainLabel: c.state,
      messageIds: c.messageIds,
      memberCount: c.messageIds.length,
      affirmativeMoveCount: 0,
      negativeMoveCount: 0,
      observerMoveCount: 0,
      hasOpenSourceOrQuoteRequest: false,
      hasConcessionOrSynthesisMove: false,
      worstEvidenceStatus: 'no_source',
      primaryAxis: c.primaryAxis ?? null,
      isAdvisory: false,
    });
    clusterOrder.push(c.clusterId);
    cumulative.push(c.state);
    for (const mid of c.messageIds) {
      const per = args.perMessage?.get(mid);
      byMessage.set(mid, {
        messageId: mid,
        clusterId: c.clusterId,
        clusterState: c.state,
        messageContribution: per?.contribution ?? c.state,
        axis: per?.axis ?? null,
        opensRequest: false,
        resolvesRequest: false,
        isConcessionShape: false,
        isSynthesisShape: false,
        plainLabel: c.state,
      });
    }
  }
  return {
    byCluster, byMessage,
    clusterOrder, cumulativeStateSequence: cumulative,
    inputHash: `lc-${args.clusters.length}-${cumulative.join(',')}`,
  };
}

function buildEmpty(): MoveMetadataLedger {
  const tl = makeTimelineMap([]);
  const lc: PointLifecycleMap = {
    byCluster: new Map(),
    byMessage: new Map(),
    clusterOrder: [],
    cumulativeStateSequence: [],
    inputHash: '',
  };
  return buildMoveMetadataLedger({
    timelineMap: tl,
    lifecycleMap: lc,
    artifactsByMessageId: new Map(),
    manualTagsByMessageId: new Map(),
  });
}

// ── Empty / single-node ledger ────────────────────────────────

describe('META-001 buildMoveMetadataLedger — empty / single-node', () => {
  it('empty room produces empty ledger with empty inputHash', () => {
    const ledger = buildEmpty();
    expect(ledger.byMessage.size).toBe(0);
    expect(ledger.byCluster.size).toBe(0);
    expect(ledger.metadataEvents.length).toBe(0);
    expect(ledger.messageOrder.length).toBe(0);
    expect(ledger.inputHash).toBe('');
  });

  it('root-only room produces one linkage record', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(ledger.byMessage.size).toBe(1);
    const rec = ledger.byMessage.get('r')!;
    expect(rec.userAppliedTags.length).toBe(0);
    expect(rec.autoDerivedMetadata.length).toBe(0); // root with no descendants
    expect(rec.lifecycleEventsCausedByMove.length).toBe(0); // first render, state === 'open'
  });

  it('root with cluster state == "archived_or_resolved" fires open → archived_or_resolved event on first render', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'archived_or_resolved', messageIds: ['r'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const rec = ledger.byMessage.get('r')!;
    expect(rec.lifecycleEventsCausedByMove.length).toBe(1);
    expect(rec.lifecycleEventsCausedByMove[0].fromState).toBe('open');
    expect(rec.lifecycleEventsCausedByMove[0].toState).toBe('archived_or_resolved');
  });
});

// ── Linkage record fields ─────────────────────────────────────

describe('META-001 buildMoveMetadataLedger — linkage record fields', () => {
  it('mirrors disagreementAxis from lifecycle snapshot.axis (never re-derived)', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl = makeTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'], primaryAxis: 'scope' }],
      perMessage: new Map([['c', { contribution: 'rebutted', axis: 'scope' }]]),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(ledger.byMessage.get('c')!.disagreementAxis).toBe('scope');
  });

  it('semantic flags mirror node.droppedTags codes (lowercased, deduped)', () => {
    const dt1: TimelineDroppedTag = { code: 'flag:civility', label: '', color: '' };
    const dt2: TimelineDroppedTag = { code: 'BRANCH_THIS_OFF', label: '', color: '' };
    const dt3: TimelineDroppedTag = { code: 'flag:civility', label: '', color: '' };
    const root = fakeNode({
      messageId: 'r', isRoot: true,
      droppedTags: [dt1, dt2, dt3],
    });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const rec = ledger.byMessage.get('r')!;
    expect(rec.semanticFlags.length).toBe(2);
    expect(rec.semanticFlags).toContain('flag:civility');
    expect(rec.semanticFlags).toContain('branch_this_off');
  });

  it('parentMessageId mirrors node.parentId', () => {
    const root = fakeNode({ messageId: 'r' });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl = makeTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(ledger.byMessage.get('c')!.parentMessageId).toBe('r');
    expect(ledger.byMessage.get('r')!.parentMessageId).toBe(null);
  });

  it('rootPointId === pointClusterId === node.branchRootMessageId', () => {
    const root = fakeNode({ messageId: 'r' });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl = makeTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const rec = ledger.byMessage.get('c')!;
    expect(rec.rootPointId).toBe('r');
    expect(rec.pointClusterId).toBe('r');
    expect(rec.branchId).toBe('branch-c'); // node.branchId
  });

  it('branchId mirrors node.branchId from BR-001', () => {
    const branchRoot = fakeNode({
      messageId: 'b', parentId: 'r', branchRootMessageId: 'b',
      branchId: 'branch-b', ordinal: 2,
    });
    const tl = makeTimelineMap([fakeNode({ messageId: 'r' }), branchRoot]);
    const lc = makeLifecycleMap({
      clusters: [
        { clusterId: 'r', state: 'open', messageIds: ['r'] },
        { clusterId: 'b', state: 'rebutted', messageIds: ['b'] },
      ],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(ledger.byMessage.get('b')!.branchId).toBe('branch-b');
  });
});

// ── Cluster aggregation ───────────────────────────────────────

describe('META-001 buildMoveMetadataLedger — cluster aggregation', () => {
  it('byCluster.manualTagCodes equals the union of userAppliedTags codes across members', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl = makeTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }],
    });
    const manual = new Map<string, ReadonlyArray<ManualTagEntry>>([
      ['r', [{
        code: 'needs_source',
        appliedByUserId: 'u1',
        appliedByActorRole: 'participant_negative',
        appliedAt: '2026-05-18T11:00:00.000Z',
        dedupeKey: 'needs_source:u1',
      }]],
      ['c', [{
        code: 'tangent',
        appliedByUserId: 'u2',
        appliedByActorRole: 'participant_affirmative',
        appliedAt: '2026-05-18T11:30:00.000Z',
        dedupeKey: 'tangent:u2',
      }]],
    ]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: manual,
    });
    const cluster = ledger.byCluster.get('r')!;
    expect([...cluster.manualTagCodes].sort()).toEqual(['needs_source', 'tangent']);
  });

  it('byCluster.taggingParticipantCount counts distinct appliedByUserId', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl = makeTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }],
    });
    const manual = new Map<string, ReadonlyArray<ManualTagEntry>>([
      ['r', [
        {
          code: 'needs_source',
          appliedByUserId: 'u1',
          appliedByActorRole: 'participant_negative',
          appliedAt: '2026-05-18T11:00:00.000Z',
          dedupeKey: 'needs_source:u1',
        },
        {
          code: 'tangent',
          appliedByUserId: 'u1',
          appliedByActorRole: 'participant_negative',
          appliedAt: '2026-05-18T11:10:00.000Z',
          dedupeKey: 'tangent:u1',
        },
      ]],
      ['c', [{
        code: 'tangent',
        appliedByUserId: 'u2',
        appliedByActorRole: 'participant_affirmative',
        appliedAt: '2026-05-18T11:30:00.000Z',
        dedupeKey: 'tangent:u2',
      }]],
    ]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: manual,
    });
    expect(ledger.byCluster.get('r')!.taggingParticipantCount).toBe(2);
  });

  it('byCluster.lastManualTagAt is the latest appliedAt across members', () => {
    const root = fakeNode({ messageId: 'r' });
    const c1 = fakeNode({ messageId: 'a', parentId: 'r', branchRootMessageId: 'r', ordinal: 2 });
    const c2 = fakeNode({ messageId: 'b', parentId: 'r', branchRootMessageId: 'r', ordinal: 3 });
    const tl = makeTimelineMap([root, c1, c2]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r', 'a', 'b'] }],
    });
    const manual = new Map<string, ReadonlyArray<ManualTagEntry>>([
      ['a', [{
        code: 'needs_source',
        appliedByUserId: 'u1',
        appliedByActorRole: 'participant_negative',
        appliedAt: '2026-05-18T11:00:00.000Z',
        dedupeKey: 'needs_source:u1',
      }]],
      ['b', [{
        code: 'tangent',
        appliedByUserId: 'u2',
        appliedByActorRole: 'participant_affirmative',
        appliedAt: '2026-05-18T12:30:00.000Z',
        dedupeKey: 'tangent:u2',
      }]],
    ]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: manual,
    });
    expect(ledger.byCluster.get('r')!.lastManualTagAt).toBe('2026-05-18T12:30:00.000Z');
  });

  it('byCluster.lifecycleState mirrors lifecycle map cluster state (READ; never derived)', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'exhausted', messageIds: ['r'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(ledger.byCluster.get('r')!.lifecycleState).toBe('exhausted');
  });

  it('cluster with no manual tags has lastManualTagAt === null', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(ledger.byCluster.get('r')!.lastManualTagAt).toBe(null);
  });
});

// ── Map shape ─────────────────────────────────────────────────

describe('META-001 buildMoveMetadataLedger — map shape', () => {
  it('byMessage keys equal the chronologically-ordered set of message ids', () => {
    const a = fakeNode({ messageId: 'a', ordinal: 1, isRoot: true });
    const b = fakeNode({ messageId: 'b', parentId: 'a', branchRootMessageId: 'a', ordinal: 2 });
    const c = fakeNode({ messageId: 'c', parentId: 'a', branchRootMessageId: 'a', ordinal: 3 });
    const tl = makeTimelineMap([a, b, c]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'a', state: 'answered', messageIds: ['a', 'b', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect([...ledger.messageOrder]).toEqual(['a', 'b', 'c']);
    expect([...ledger.byMessage.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('messageOrder.length === byMessage.size', () => {
    const a = fakeNode({ messageId: 'a', isRoot: true });
    const b = fakeNode({ messageId: 'b', parentId: 'a', branchRootMessageId: 'a', ordinal: 2 });
    const tl = makeTimelineMap([a, b]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'a', state: 'answered', messageIds: ['a', 'b'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(ledger.messageOrder.length).toBe(ledger.byMessage.size);
  });

  it('inputHash changes when the timeline grows', () => {
    const a = fakeNode({ messageId: 'a' });
    const tlA = makeTimelineMap([a]);
    const lcA = makeLifecycleMap({
      clusters: [{ clusterId: 'a', state: 'open', messageIds: ['a'] }],
    });
    const ledgerA = buildMoveMetadataLedger({
      timelineMap: tlA, lifecycleMap: lcA,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const b = fakeNode({ messageId: 'b', parentId: 'a', branchRootMessageId: 'a', ordinal: 2 });
    const tlB = makeTimelineMap([a, b]);
    const lcB = makeLifecycleMap({
      clusters: [{ clusterId: 'a', state: 'answered', messageIds: ['a', 'b'] }],
    });
    const ledgerB = buildMoveMetadataLedger({
      timelineMap: tlB, lifecycleMap: lcB,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    expect(ledgerA.inputHash).not.toBe(ledgerB.inputHash);
  });

  it('inputHash is stable when the timeline does not change', () => {
    const a = fakeNode({ messageId: 'a' });
    const tl = makeTimelineMap([a]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'a', state: 'open', messageIds: ['a'] }],
    });
    const ledger1 = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const ledger2 = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    expect(ledger1.inputHash).toBe(ledger2.inputHash);
  });
});

// ── JSON-serializability ──────────────────────────────────────

describe('META-001 buildMoveMetadataLedger — JSON-serializability', () => {
  it('byMessage entries round-trip through JSON.parse / JSON.stringify', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 1 });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const tl = makeTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const arr = Array.from(ledger.byMessage.entries());
    const json = JSON.stringify(arr);
    const reparsed = JSON.parse(json);
    expect(reparsed.length).toBe(arr.length);
    expect(reparsed[0][0]).toBe(arr[0][0]);
    expect(reparsed[0][1].messageId).toBe(arr[0][1].messageId);
  });

  it('metadataEvents are JSON-serializable', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 1 });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const tl = makeTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const json = JSON.stringify([...ledger.metadataEvents]);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(ledger.metadataEvents.length);
  });
});

// ── Doctrine anchor — heat / standing / popularity ────────────

describe('META-001 buildMoveMetadataLedger — doctrine: no heat/standing/popularity input', () => {
  function structureFixture(band: TimelineStandingBand, tone: TimelineToneBand, temp: TimelineTemperatureBand) {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
      standingBand: band, toneBand: tone, temperatureBand: temp,
    });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
      standingBand: band, toneBand: tone, temperatureBand: temp,
    });
    return [root, child];
  }

  function buildFor(nodes: ArgumentTimelineMapNode[]) {
    const tl = makeTimelineMap(nodes);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    return buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
      detectedAt: 'FIXED-AT',
    });
  }

  function ledgerToCodeShape(l: MoveMetadataLedger) {
    return [...l.byMessage.entries()].map(([id, rec]) => ({
      id,
      auto: [...rec.autoDerivedMetadata].map((a) => a.code).sort(),
      manual: [...rec.userAppliedTags].map((t) => t.code).sort(),
      semantic: [...rec.semanticFlags].sort(),
    }));
  }

  it('standingBand variation produces deep-equal byMessage code shape', () => {
    const a = buildFor(structureFixture('completely_right', 'calm', 'cool'));
    const b = buildFor(structureFixture('pretty_wrong', 'calm', 'cool'));
    expect(ledgerToCodeShape(a)).toEqual(ledgerToCodeShape(b));
  });

  it('toneBand variation produces deep-equal byMessage code shape', () => {
    const a = buildFor(structureFixture('neutral', 'calm', 'cool'));
    const b = buildFor(structureFixture('neutral', 'hostile', 'cool'));
    expect(ledgerToCodeShape(a)).toEqual(ledgerToCodeShape(b));
  });

  it('temperatureBand variation produces deep-equal byMessage code shape', () => {
    const a = buildFor(structureFixture('neutral', 'calm', 'cool'));
    const b = buildFor(structureFixture('neutral', 'calm', 'hot'));
    expect(ledgerToCodeShape(a)).toEqual(ledgerToCodeShape(b));
  });
});

// ── Doctrine — manual tags never auto-populate ────────────────

describe('META-001 buildMoveMetadataLedger — doctrine: manual tags never auto-populate', () => {
  it('a rich lifecycle / evidence fixture produces empty userAppliedTags everywhere', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 2, descendantCount: 2,
      droppedTags: [{ code: 'branch_this_off', label: '', color: '' }],
    });
    const c1 = fakeNode({
      messageId: 'c1', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const c2 = fakeNode({
      messageId: 'c2', parentId: 'r', branchRootMessageId: 'r', ordinal: 3,
      kindColorFamily: 'challenge',
    });
    const tl = makeTimelineMap([root, c1, c2]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'exhausted', messageIds: ['r', 'c1', 'c2'], primaryAxis: 'fact' }],
      perMessage: new Map([
        ['c1', { contribution: 'rebutted', axis: 'fact' }],
        ['c2', { contribution: 'rebutted', axis: 'fact' }],
      ]),
    });
    const artifacts = new Map<string, ReadonlyArray<EvidenceArtifact>>([
      ['r', [fakeArtifact('r', { kind: 'url' })]],
    ]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: artifacts, manualTagsByMessageId: new Map(),
    });
    for (const rec of ledger.byMessage.values()) {
      expect(rec.userAppliedTags.length).toBe(0);
    }
  });
});

// ── Doctrine — moderation flag boundary ───────────────────────

describe('META-001 buildMoveMetadataLedger — doctrine: manual tag != moderation flag', () => {
  it('a flag:civility code in droppedTags becomes a semanticFlag but NEVER a manual tag', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true,
      droppedTags: [{ code: 'flag:civility', label: '', color: '' }],
    });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const rec = ledger.byMessage.get('r')!;
    expect(rec.semanticFlags).toContain('flag:civility');
    expect(rec.userAppliedTags.length).toBe(0);
    // No auto metadata code is named flag:civility.
    expect(rec.autoDerivedMetadata.map((a) => a.code)).not.toContain('flag:civility');
  });

  it('no metadataEvents with codeFamily === "manual_tag" reference flag codes', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true,
      droppedTags: [{ code: 'flag:civility', label: '', color: '' }],
    });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    for (const ev of ledger.metadataEvents) {
      if (ev.codeFamily === 'manual_tag') {
        expect(ev.code).not.toBe('flag:civility');
      }
    }
  });
});

// ── applyManualTag — eligibility + dedupe + unknown-id ─────────

describe('META-001 applyManualTag', () => {
  function makeLedgerWithTwoMessages() {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl = makeTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }],
    });
    return buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
  }

  const negCtx: EligibilityContext = {
    applierUserId: 'u-neg',
    applierActorRole: 'participant_negative',
    isOwnBubble: false,
  };
  const observerCtx: EligibilityContext = {
    applierUserId: 'u-obs',
    applierActorRole: 'observer',
    isOwnBubble: false,
  };
  const ownCtx: EligibilityContext = {
    applierUserId: 'u-own',
    applierActorRole: 'participant_negative',
    isOwnBubble: true,
  };

  it('allowed application returns a NEW ledger containing the new entry', () => {
    const before = makeLedgerWithTwoMessages();
    const after = applyManualTag({
      ledger: before,
      messageId: 'c',
      code: 'needs_source',
      eligibility: negCtx,
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    expect(after).not.toBe(before);
    const tags = after.byMessage.get('c')!.userAppliedTags;
    expect(tags.length).toBe(1);
    expect(tags[0].code).toBe('needs_source');
    expect(tags[0].appliedByUserId).toBe('u-neg');
  });

  it('emits an add event for the new entry', () => {
    const before = makeLedgerWithTwoMessages();
    const after = applyManualTag({
      ledger: before,
      messageId: 'c',
      code: 'needs_source',
      eligibility: negCtx,
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    const newEvents = after.metadataEvents.slice(before.metadataEvents.length);
    expect(newEvents.length).toBe(1);
    expect(newEvents[0].kind).toBe('add');
    expect(newEvents[0].codeFamily).toBe('manual_tag');
    expect(newEvents[0].code).toBe('needs_source');
    expect(newEvents[0].messageId).toBe('c');
  });

  it('observer applier → returns ledger reference-equal', () => {
    const before = makeLedgerWithTwoMessages();
    const after = applyManualTag({
      ledger: before,
      messageId: 'c',
      code: 'needs_source',
      eligibility: observerCtx,
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    expect(after).toBe(before);
  });

  it('own-bubble + non-own-allowed tag → returns ledger reference-equal', () => {
    const before = makeLedgerWithTwoMessages();
    const after = applyManualTag({
      ledger: before,
      messageId: 'c',
      code: 'needs_source',
      eligibility: ownCtx,
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    expect(after).toBe(before);
  });

  it('own-bubble + own-allowed tag (concession_offered) → succeeds', () => {
    const before = makeLedgerWithTwoMessages();
    const after = applyManualTag({
      ledger: before,
      messageId: 'c',
      code: 'concession_offered',
      eligibility: ownCtx,
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    expect(after).not.toBe(before);
    expect(after.byMessage.get('c')!.userAppliedTags.length).toBe(1);
  });

  it('unknown messageId → returns ledger reference-equal', () => {
    const before = makeLedgerWithTwoMessages();
    const after = applyManualTag({
      ledger: before,
      messageId: 'nonexistent',
      code: 'needs_source',
      eligibility: negCtx,
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    expect(after).toBe(before);
  });

  it('duplicate (code, userId) → second call returns ledger reference-equal', () => {
    const before = makeLedgerWithTwoMessages();
    const after1 = applyManualTag({
      ledger: before,
      messageId: 'c',
      code: 'needs_source',
      eligibility: negCtx,
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    const after2 = applyManualTag({
      ledger: after1,
      messageId: 'c',
      code: 'needs_source',
      eligibility: negCtx,
      appliedAt: '2026-05-18T12:30:00.000Z',
    });
    expect(after2).toBe(after1);
    expect(after1.byMessage.get('c')!.userAppliedTags.length).toBe(1);
  });

  it('different participants applying the same code produce two entries', () => {
    const before = makeLedgerWithTwoMessages();
    const ctxA = { ...negCtx, applierUserId: 'u-a' };
    const ctxB = { ...negCtx, applierUserId: 'u-b' };
    const after1 = applyManualTag({
      ledger: before, messageId: 'c', code: 'needs_source',
      eligibility: ctxA, appliedAt: '2026-05-18T12:00:00.000Z',
    });
    const after2 = applyManualTag({
      ledger: after1, messageId: 'c', code: 'needs_source',
      eligibility: ctxB, appliedAt: '2026-05-18T12:30:00.000Z',
    });
    expect(after2.byMessage.get('c')!.userAppliedTags.length).toBe(2);
    expect(after2.byCluster.get('r')!.taggingParticipantCount).toBe(2);
  });

  it('truncates note to 140 chars', () => {
    const before = makeLedgerWithTwoMessages();
    const longNote = 'x'.repeat(200);
    const after = applyManualTag({
      ledger: before, messageId: 'c', code: 'needs_source',
      eligibility: negCtx, appliedAt: '2026-05-18T12:00:00.000Z',
      note: longNote,
    });
    const tag = after.byMessage.get('c')!.userAppliedTags[0];
    expect((tag.note || '').length).toBe(140);
  });

  it('admin applier may apply tags forbidden to participants on own bubble', () => {
    const before = makeLedgerWithTwoMessages();
    const adminCtx: EligibilityContext = {
      applierUserId: 'u-admin',
      applierActorRole: 'admin',
      isOwnBubble: true,
    };
    const after = applyManualTag({
      ledger: before, messageId: 'c', code: 'needs_source',
      eligibility: adminCtx, appliedAt: '2026-05-18T12:00:00.000Z',
    });
    expect(after).not.toBe(before);
    expect(after.byMessage.get('c')!.userAppliedTags.length).toBe(1);
  });
});

// ── removeManualTag ───────────────────────────────────────────

describe('META-001 removeManualTag', () => {
  it('removes a present tag and emits a remove event', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const after1 = applyManualTag({
      ledger: buildMoveMetadataLedger({
        timelineMap: tl, lifecycleMap: lc,
        artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
      }),
      messageId: 'r',
      code: 'concession_offered',
      eligibility: {
        applierUserId: 'u1', applierActorRole: 'participant_negative', isOwnBubble: true,
      },
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    expect(after1.byMessage.get('r')!.userAppliedTags.length).toBe(1);
    const after2 = removeManualTag({
      ledger: after1, messageId: 'r', code: 'concession_offered', applierUserId: 'u1',
      removedAt: '2026-05-18T12:30:00.000Z',
    });
    expect(after2).not.toBe(after1);
    expect(after2.byMessage.get('r')!.userAppliedTags.length).toBe(0);
    const removeEvents = after2.metadataEvents.filter(
      (e) => e.kind === 'remove' && e.codeFamily === 'manual_tag',
    );
    expect(removeEvents.length).toBe(1);
  });

  it('removing an absent tag returns the ledger reference-equal', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const before = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const after = removeManualTag({
      ledger: before, messageId: 'r', code: 'needs_source', applierUserId: 'u1',
    });
    expect(after).toBe(before);
  });

  it('removing from a non-existent message returns the ledger reference-equal', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const before = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const after = removeManualTag({
      ledger: before, messageId: 'nonexistent', code: 'needs_source', applierUserId: 'u1',
    });
    expect(after).toBe(before);
  });

  it('only the same applier can remove their own tag', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const after1 = applyManualTag({
      ledger: buildMoveMetadataLedger({
        timelineMap: tl, lifecycleMap: lc,
        artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
      }),
      messageId: 'r', code: 'concession_offered',
      eligibility: { applierUserId: 'u1', applierActorRole: 'participant_negative', isOwnBubble: true },
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    // Different user tries to remove — reference-equal.
    const after2 = removeManualTag({
      ledger: after1, messageId: 'r', code: 'concession_offered', applierUserId: 'u2',
    });
    expect(after2).toBe(after1);
  });
});

// ── Edge cases ────────────────────────────────────────────────

describe('META-001 buildMoveMetadataLedger — edge cases', () => {
  it('edge 1 — empty room', () => {
    const ledger = buildEmpty();
    expect(ledger.byMessage.size).toBe(0);
    expect(ledger.metadataEvents.length).toBe(0);
    expect(ledger.inputHash).toBe('');
  });

  it('edge 4 — detached message forms its own cluster (rootPointId === messageId)', () => {
    const detached = fakeNode({
      messageId: 'd', parentId: null, isDetached: true,
      branchRootMessageId: 'd',
    });
    const tl = makeTimelineMap([detached]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'd', state: 'open', messageIds: ['d'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    expect(ledger.byMessage.get('d')!.rootPointId).toBe('d');
  });

  it('edge 11 — same tag applied by two different participants → both entries appear, cluster lists code once', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const tags: ManualTagEntry[] = [
      {
        code: 'needs_source', appliedByUserId: 'u1',
        appliedByActorRole: 'participant_negative',
        appliedAt: '2026-05-18T12:00:00.000Z',
        dedupeKey: 'needs_source:u1',
      },
      {
        code: 'needs_source', appliedByUserId: 'u2',
        appliedByActorRole: 'participant_affirmative',
        appliedAt: '2026-05-18T12:30:00.000Z',
        dedupeKey: 'needs_source:u2',
      },
    ];
    const manual = new Map<string, ReadonlyArray<ManualTagEntry>>([['r', tags]]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: manual,
    });
    expect(ledger.byMessage.get('r')!.userAppliedTags.length).toBe(2);
    expect(ledger.byCluster.get('r')!.manualTagCodes.length).toBe(1);
  });

  it('edge 16 — same participant double-tag at build time deduped by dedupeKey', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const tags: ManualTagEntry[] = [
      {
        code: 'needs_source', appliedByUserId: 'u1',
        appliedByActorRole: 'participant_negative',
        appliedAt: '2026-05-18T12:00:00.000Z',
        dedupeKey: 'needs_source:u1',
      },
      {
        code: 'needs_source', appliedByUserId: 'u1',
        appliedByActorRole: 'participant_negative',
        appliedAt: '2026-05-18T12:30:00.000Z',
        dedupeKey: 'needs_source:u1',
      },
    ];
    const manual = new Map<string, ReadonlyArray<ManualTagEntry>>([['r', tags]]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: manual,
    });
    expect(ledger.byMessage.get('r')!.userAppliedTags.length).toBe(1);
  });

  it('edge 19 — admin applies any tag (e.g. needs_source on own bubble) — allowed', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const before = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const adminCtx: EligibilityContext = {
      applierUserId: 'u-admin', applierActorRole: 'admin', isOwnBubble: true,
    };
    const after = applyManualTag({
      ledger: before, messageId: 'r', code: 'tangent',
      eligibility: adminCtx, appliedAt: '2026-05-18T12:00:00.000Z',
    });
    expect(after).not.toBe(before);
  });

  it('edge 20 — evidence_debt tag coexists with sourced cluster state', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'sourced', messageIds: ['r'] }],
    });
    const artifacts = new Map<string, ReadonlyArray<EvidenceArtifact>>([
      ['r', [fakeArtifact('r', { kind: 'url' })]],
    ]);
    const before = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: artifacts, manualTagsByMessageId: new Map(),
    });
    const after = applyManualTag({
      ledger: before, messageId: 'r', code: 'evidence_debt',
      eligibility: {
        applierUserId: 'u1', applierActorRole: 'participant_negative', isOwnBubble: false,
      },
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    const rec = after.byMessage.get('r')!;
    expect(rec.userAppliedTags.map((t) => t.code)).toContain('evidence_debt');
    expect(rec.autoDerivedMetadata.map((a) => a.code)).toContain('source_attached');
  });

  it('edge 22 — manual needs_source and auto source_attached can coexist on the same move', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'sourced', messageIds: ['r'] }],
    });
    const artifacts = new Map<string, ReadonlyArray<EvidenceArtifact>>([
      ['r', [fakeArtifact('r', { kind: 'url' })]],
    ]);
    const before = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: artifacts, manualTagsByMessageId: new Map(),
    });
    const after = applyManualTag({
      ledger: before, messageId: 'r', code: 'needs_source',
      eligibility: {
        applierUserId: 'u1', applierActorRole: 'participant_negative', isOwnBubble: false,
      },
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    const rec = after.byMessage.get('r')!;
    expect(rec.userAppliedTags.map((t) => t.code)).toContain('needs_source');
    expect(rec.autoDerivedMetadata.map((a) => a.code)).toContain('source_attached');
  });
});

// ── Performance ───────────────────────────────────────────────

describe('META-001 buildMoveMetadataLedger — performance', () => {
  it('builds a 250-message synthetic ledger in < 60 ms', () => {
    // Synthetic tree: chronological chain of 250 messages with 25 clusters
    // (rooted every 10 messages via branch creation).
    const N = 250;
    const nodes: ArgumentTimelineMapNode[] = [];
    const clusters: Array<{ clusterId: string; state: PointLifecycleState; messageIds: string[] }> = [];
    let currentCluster: string = 'r0';
    let clusterMembers: string[] = [];
    for (let i = 0; i < N; i++) {
      const id = `m${i}`;
      const isClusterRoot = i % 10 === 0;
      if (isClusterRoot) {
        if (clusterMembers.length > 0) {
          clusters.push({ clusterId: currentCluster, state: 'rebutted', messageIds: clusterMembers });
        }
        currentCluster = `r${i}`;
        clusterMembers = [id];
      } else {
        clusterMembers.push(id);
      }
      nodes.push(fakeNode({
        messageId: id,
        parentId: i === 0 ? null : `m${i - 1}`,
        branchRootMessageId: currentCluster,
        branchId: `b-${currentCluster}`,
        ordinal: i + 1,
        isRoot: i === 0,
        replyCount: i < N - 1 ? 1 : 0,
        descendantCount: Math.max(0, N - 1 - i),
        kindColorFamily: i % 2 === 0 ? 'claim' : 'challenge',
      }));
    }
    if (clusterMembers.length > 0) {
      clusters.push({ clusterId: currentCluster, state: 'rebutted', messageIds: clusterMembers });
    }
    const tl = makeTimelineMap(nodes);
    const lc = makeLifecycleMap({ clusters });
    const start = performance.now();
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const elapsed = performance.now() - start;
    expect(ledger.byMessage.size).toBe(N);
    expect(elapsed).toBeLessThan(60);
  });
});

// ── Doctrine — no verdict tokens leak into produced strings ──

describe('META-001 buildMoveMetadataLedger — doctrine: no verdict tokens in produced strings', () => {
  it('inputSignals strings contain no verdict / amplification tokens', () => {
    const banned = ['winner', 'loser', 'liar', 'truth', 'true', 'false', 'viral', 'popular', 'engagement'];
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 2 });
    const c1 = fakeNode({
      messageId: 'c1', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const c2 = fakeNode({
      messageId: 'c2', parentId: 'c1', branchRootMessageId: 'r', ordinal: 3,
      kindColorFamily: 'challenge',
    });
    const tl = makeTimelineMap([root, c1, c2]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'exhausted', messageIds: ['r', 'c1', 'c2'], primaryAxis: 'fact' }],
      perMessage: new Map([
        ['c1', { contribution: 'rebutted', axis: 'fact' }],
        ['c2', { contribution: 'rebutted', axis: 'fact' }],
      ]),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    for (const rec of ledger.byMessage.values()) {
      for (const a of rec.autoDerivedMetadata) {
        for (const s of a.inputSignals) {
          const lc = s.toLowerCase();
          for (const b of banned) {
            expect(lc.includes(b)).toBe(false);
          }
        }
      }
    }
  });

  it('JSON.stringify(ledger) scanned for block / prevent / reject keywords (auto metadata must never block)', () => {
    const banned = ['block', 'prevent', 'reject', 'forbid', 'disallow', 'denied'];
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 1 });
    const c = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const tl = makeTimelineMap([root, c]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const dump = JSON.stringify({
      events: [...ledger.metadataEvents],
      messages: [...ledger.byMessage.values()].map((r) => ({
        ...r,
        userAppliedTags: [...r.userAppliedTags],
        autoDerivedMetadata: [...r.autoDerivedMetadata],
        lifecycleEventsCausedByMove: [...r.lifecycleEventsCausedByMove],
        semanticFlags: [...r.semanticFlags],
      })),
    }).toLowerCase();
    for (const b of banned) {
      expect(dump.includes(b)).toBe(false);
    }
  });
});
