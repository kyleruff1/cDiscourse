/**
 * META-001 — Lifecycle-causation + metadata event log tests.
 *
 * Pure-model tests. Covers:
 *   - Snapshot-diff causation (first render emits 'open' → state events
 *     for non-open clusters only on the chronologically-last member).
 *   - Cluster transitions between two renders (only chronologically-last
 *     member is credited).
 *   - Per-message contribution changes.
 *   - Event log composition (add/remove/transition events + `cause` field
 *     ban-list).
 *   - Causation keys are stable hashes.
 */

import {
  computeLifecycleCausationForMove,
  buildMoveMetadataLedger,
  diffLedgers,
} from '../src/features/metadata';
import type {
  ManualTagEntry,
} from '../src/features/metadata';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleSnapshot,
  PointLifecycleState,
} from '../src/features/lifecycle';

// ── Fixture helpers ───────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: '', relativeLabel: '',
    actorLabel: '', kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: '', badges: [], droppedTags: over.droppedTags ?? [],
    depth: 0, lane: 0, siblingIndex: 0,
    replyCount: over.replyCount ?? 0, descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? `branch-${over.messageId ?? 'm1'}`,
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: null, isJunction: false, junctionChildCount: 0,
    isActive: false, isLatest: false, isDetached: false, isActivePath: false,
    isRoot: over.isRoot ?? false, isFirstRebuttal: false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: 0, y: 0, accessibilityLabel: '',
  };
}

function makeLifecycleMap(args: {
  clusters: ReadonlyArray<{
    clusterId: string;
    state: PointLifecycleState;
    messageIds: ReadonlyArray<string>;
  }>;
  perMessageContribution?: ReadonlyMap<string, PointLifecycleState>;
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
      primaryAxis: null,
      isAdvisory: false,
    });
    clusterOrder.push(c.clusterId);
    cumulative.push(c.state);
    for (const mid of c.messageIds) {
      const contribution = args.perMessageContribution?.get(mid) ?? c.state;
      byMessage.set(mid, {
        messageId: mid,
        clusterId: c.clusterId,
        clusterState: c.state,
        messageContribution: contribution,
        axis: null,
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
    inputHash: `inputs-${JSON.stringify(args.clusters)}`,
  };
}

function makeEmptyTimelineMap(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapModel {
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

// ── computeLifecycleCausationForMove — first-render rule ──────

describe('META-001 computeLifecycleCausationForMove — first render', () => {
  it('no events when previous map is null AND current cluster state is open', () => {
    const node = fakeNode({ messageId: 'r', isRoot: true });
    const current = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const out = computeLifecycleCausationForMove({
      node,
      previousLifecycleMap: null,
      currentLifecycleMap: current,
    });
    expect(out.length).toBe(0);
  });

  it('one open → state event when first render shows non-open cluster (latest member)', () => {
    const node = fakeNode({ messageId: 'r', isRoot: true });
    const current = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r'] }],
    });
    const out = computeLifecycleCausationForMove({
      node,
      previousLifecycleMap: null,
      currentLifecycleMap: current,
    });
    expect(out.length).toBe(1);
    expect(out[0].fromState).toBe('open');
    expect(out[0].toState).toBe('rebutted');
    expect(out[0].level).toBe('cluster_state');
  });

  it('no event for non-latest-in-cluster member on first render (only latest credits)', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const current = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'a'] }],
    });
    const out = computeLifecycleCausationForMove({
      node: root,
      previousLifecycleMap: null,
      currentLifecycleMap: current,
    });
    // root is members[0], not the chronologically-last
    expect(out.length).toBe(0);
  });

  it('emits event for the chronologically-last member only', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const reply = fakeNode({
      messageId: 'a', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const current = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'a'] }],
    });
    const rootOut = computeLifecycleCausationForMove({
      node: root,
      previousLifecycleMap: null,
      currentLifecycleMap: current,
    });
    const replyOut = computeLifecycleCausationForMove({
      node: reply,
      previousLifecycleMap: null,
      currentLifecycleMap: current,
    });
    expect(rootOut.length).toBe(0);
    expect(replyOut.length).toBe(1);
    expect(replyOut[0].fromState).toBe('open');
    expect(replyOut[0].toState).toBe('rebutted');
  });
});

// ── computeLifecycleCausationForMove — between two renders ────

describe('META-001 computeLifecycleCausationForMove — second render diff', () => {
  it('emits cluster_state event when prev state differs and node is latest', () => {
    const reply = fakeNode({
      messageId: 'a', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const prev = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const curr = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'a'] }],
    });
    const out = computeLifecycleCausationForMove({
      node: reply,
      previousLifecycleMap: prev,
      currentLifecycleMap: curr,
    });
    const clusterEvent = out.find((e) => e.level === 'cluster_state');
    expect(clusterEvent).toBeDefined();
    expect(clusterEvent!.fromState).toBe('open');
    expect(clusterEvent!.toState).toBe('rebutted');
  });

  it('no cluster_state event when prev state matches current', () => {
    const reply = fakeNode({
      messageId: 'a', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const prev = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r'] }],
    });
    const curr = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'a'] }],
    });
    const out = computeLifecycleCausationForMove({
      node: reply,
      previousLifecycleMap: prev,
      currentLifecycleMap: curr,
    });
    expect(out.find((e) => e.level === 'cluster_state')).toBeUndefined();
  });

  it('emits message_contribution event when per-message contribution changed', () => {
    const node = fakeNode({
      messageId: 'a', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const prev = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r', 'a'] }],
      perMessageContribution: new Map([['a', 'open']]),
    });
    const curr = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'sourced', messageIds: ['r', 'a'] }],
      perMessageContribution: new Map([['a', 'sourced']]),
    });
    const out = computeLifecycleCausationForMove({
      node,
      previousLifecycleMap: prev,
      currentLifecycleMap: curr,
    });
    const msgEvent = out.find((e) => e.level === 'message_contribution');
    expect(msgEvent).toBeDefined();
    expect(msgEvent!.fromState).toBe('open');
    expect(msgEvent!.toState).toBe('sourced');
    expect(msgEvent!.messageId).toBe('a');
  });

  it('attributes cluster transition to the chronologically-last member only', () => {
    const root = fakeNode({ messageId: 'r' });
    const a = fakeNode({
      messageId: 'a', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const b = fakeNode({
      messageId: 'b', parentId: 'r', branchRootMessageId: 'r', ordinal: 3,
    });
    const prev = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r', 'a'] }],
    });
    const curr = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'a', 'b'] }],
    });
    const rootOut = computeLifecycleCausationForMove({
      node: root,
      previousLifecycleMap: prev,
      currentLifecycleMap: curr,
    });
    const aOut = computeLifecycleCausationForMove({
      node: a,
      previousLifecycleMap: prev,
      currentLifecycleMap: curr,
    });
    const bOut = computeLifecycleCausationForMove({
      node: b,
      previousLifecycleMap: prev,
      currentLifecycleMap: curr,
    });
    expect(rootOut.find((e) => e.level === 'cluster_state')).toBeUndefined();
    expect(aOut.find((e) => e.level === 'cluster_state')).toBeUndefined();
    expect(bOut.find((e) => e.level === 'cluster_state')).toBeDefined();
  });

  it('causationKey is stable across two calls with identical inputs', () => {
    const node = fakeNode({
      messageId: 'a', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const prev = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const curr = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'a'] }],
    });
    const a = computeLifecycleCausationForMove({
      node, previousLifecycleMap: prev, currentLifecycleMap: curr,
    });
    const b = computeLifecycleCausationForMove({
      node, previousLifecycleMap: prev, currentLifecycleMap: curr,
    });
    expect(a[0].causationKey).toBe(b[0].causationKey);
  });

  it('new cluster appears (BR-001 branch creation) → fromState: open event', () => {
    const branchRoot = fakeNode({
      messageId: 'b', parentId: 'r', branchRootMessageId: 'b', ordinal: 2,
    });
    const prev = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const curr = makeLifecycleMap({
      clusters: [
        { clusterId: 'r', state: 'open', messageIds: ['r'] },
        { clusterId: 'b', state: 'rebutted', messageIds: ['b'] },
      ],
    });
    const out = computeLifecycleCausationForMove({
      node: branchRoot,
      previousLifecycleMap: prev,
      currentLifecycleMap: curr,
    });
    const ev = out.find((e) => e.level === 'cluster_state');
    expect(ev).toBeDefined();
    expect(ev!.fromState).toBe('open');
    expect(ev!.toState).toBe('rebutted');
    expect(ev!.clusterId).toBe('b');
  });
});

// ── Event log composition (via buildMoveMetadataLedger) ───────

describe('META-001 event log composition', () => {
  it('first ledger fires add events for every observed code', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
    });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const tl = makeEmptyTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(ledger.metadataEvents.length).toBeGreaterThan(0);
    const addEvents = ledger.metadataEvents.filter((e) => e.kind === 'add');
    expect(addEvents.length).toBeGreaterThan(0);
    // Includes has_reply on root, has_rebuttal on root.
    const codes = addEvents
      .filter((e) => e.codeFamily === 'auto_metadata')
      .map((e) => e.code);
    expect(codes).toContain('has_reply');
    expect(codes).toContain('has_rebuttal');
  });

  it('second ledger with same inputs produces zero events', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
    });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const tl = makeEmptyTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const first = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const second = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
      previousLedger: first,
      previousLifecycleMap: lc,
    });
    expect(second.metadataEvents.length).toBe(0);
  });

  it('auto-metadata code that flips off emits a remove event', () => {
    // Build root with 1 challenge child, then re-build with 0 children.
    const root1 = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
    });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const tl1 = makeEmptyTimelineMap([root1, child]);
    const lc1 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const first = buildMoveMetadataLedger({
      timelineMap: tl1,
      lifecycleMap: lc1,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });

    const root2 = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 0, descendantCount: 0,
    });
    const tl2 = makeEmptyTimelineMap([root2]);
    const lc2 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const second = buildMoveMetadataLedger({
      timelineMap: tl2,
      lifecycleMap: lc2,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
      previousLedger: first,
      previousLifecycleMap: lc1,
    });
    const removes = second.metadataEvents.filter((e) => e.kind === 'remove' && e.codeFamily === 'auto_metadata');
    const codes = removes.map((e) => e.code);
    expect(codes).toContain('has_reply');
    expect(codes).toContain('has_rebuttal');
  });

  it('soft-deleted message emits remove events for any attached manual tags with cause === message_deleted', () => {
    // First ledger has a manual tag applied to message "c".
    const root = fakeNode({ messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1 });
    const child = fakeNode({ messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2 });
    const tl1 = makeEmptyTimelineMap([root, child]);
    const lc1 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }],
    });
    const cTag: ManualTagEntry = {
      code: 'needs_source',
      appliedByUserId: 'u1',
      appliedByActorRole: 'participant_negative',
      appliedAt: '2026-05-18T10:30:00.000Z',
      dedupeKey: 'needs_source:u1',
      note: null,
    };
    const manualTags = new Map<string, ReadonlyArray<ManualTagEntry>>([
      ['c', [cTag]],
    ]);
    const first = buildMoveMetadataLedger({
      timelineMap: tl1,
      lifecycleMap: lc1,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: manualTags,
    });
    // Second ledger drops "c" (soft-deleted upstream).
    const tl2 = makeEmptyTimelineMap([root]);
    const lc2 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const second = buildMoveMetadataLedger({
      timelineMap: tl2,
      lifecycleMap: lc2,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
      previousLedger: first,
      previousLifecycleMap: lc1,
    });
    const deletedTagEvents = second.metadataEvents.filter(
      (e) => e.kind === 'remove' && e.codeFamily === 'manual_tag' && e.cause === 'message_deleted',
    );
    expect(deletedTagEvents.length).toBeGreaterThan(0);
    expect(deletedTagEvents.find((e) => e.code === 'needs_source')).toBeDefined();
  });

  it('event log cause field never contains verdict / amplification tokens', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
    });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const tl = makeEmptyTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const banned = ['winner', 'loser', 'liar', 'true', 'false', 'viral', 'popular'];
    for (const ev of ledger.metadataEvents) {
      const cause = (ev.cause || '').toLowerCase();
      for (const b of banned) {
        expect(cause.includes(b)).toBe(false);
      }
    }
  });

  it('cause field is one of the known causes or null', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
    });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl1 = makeEmptyTimelineMap([root, child]);
    const lc1 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }],
    });
    const first = buildMoveMetadataLedger({
      timelineMap: tl1,
      lifecycleMap: lc1,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const tl2 = makeEmptyTimelineMap([root]);
    const lc2 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const second = buildMoveMetadataLedger({
      timelineMap: tl2,
      lifecycleMap: lc2,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
      previousLedger: first,
      previousLifecycleMap: lc1,
    });
    const knownCauses: Array<string | null | undefined> = [
      'eligibility_refused',
      'unknown_message_id',
      'message_deleted',
      null,
      undefined,
    ];
    for (const ev of second.metadataEvents) {
      expect(knownCauses).toContain(ev.cause ?? null);
    }
  });

  it('diffLedgers returns the same event sequence the build emitted', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
    });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl = makeEmptyTimelineMap([root, child]);
    const lc = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl,
      lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const dumped = diffLedgers({ previous: null, current: ledger });
    expect(dumped).toEqual([...ledger.metadataEvents]);
  });
});

// ── Lifecycle causation events propagate through ledger ───────

describe('META-001 lifecycle_causation events propagate', () => {
  it('cluster transition emits a transition event in the ledger', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const reply = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const tl1 = makeEmptyTimelineMap([root]);
    const lc1 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const first = buildMoveMetadataLedger({
      timelineMap: tl1,
      lifecycleMap: lc1,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const tl2 = makeEmptyTimelineMap([root, reply]);
    const lc2 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }],
    });
    const second = buildMoveMetadataLedger({
      timelineMap: tl2,
      lifecycleMap: lc2,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
      previousLedger: first,
      previousLifecycleMap: lc1,
    });
    const transitions = second.metadataEvents.filter(
      (e) => e.codeFamily === 'lifecycle_causation' && e.kind === 'transition',
    );
    expect(transitions.length).toBeGreaterThan(0);
    // A cluster-state transition event with code 'open->rebutted' is
    // attributed to the chronologically-last cluster member (= 'c').
    // The root (`r`) may ALSO carry a `message_contribution` event with
    // the same code if its per-message contribution changed, so we filter
    // by messageId explicitly here.
    const cEvent = transitions.find(
      (e) => e.code === 'open->rebutted' && e.messageId === 'c',
    );
    expect(cEvent).toBeDefined();
    expect(cEvent!.clusterId).toBe('r');
  });

  it('cluster transition NOT attributed to non-latest cluster members', () => {
    // Same fixture as above, but assert that the cluster_state-level
    // transition does NOT fire on root (because root is not the
    // chronologically-last cluster member).
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const a = fakeNode({
      messageId: 'a', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const b = fakeNode({
      messageId: 'b', parentId: 'r', branchRootMessageId: 'r', ordinal: 3,
    });
    const tl1 = makeEmptyTimelineMap([root, a]);
    const lc1 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'open', messageIds: ['r', 'a'] }],
    });
    const first = buildMoveMetadataLedger({
      timelineMap: tl1,
      lifecycleMap: lc1,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const tl2 = makeEmptyTimelineMap([root, a, b]);
    const lc2 = makeLifecycleMap({
      clusters: [{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'a', 'b'] }],
    });
    const second = buildMoveMetadataLedger({
      timelineMap: tl2,
      lifecycleMap: lc2,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
      previousLedger: first,
      previousLifecycleMap: lc1,
    });
    // Look at each node's lifecycleEventsCausedByMove — only 'b' (the
    // chronologically-last cluster member) should have a cluster_state
    // entry.
    const rootRec = second.byMessage.get('r');
    const aRec = second.byMessage.get('a');
    const bRec = second.byMessage.get('b');
    const rootClusterLevel = (rootRec?.lifecycleEventsCausedByMove ?? []).filter((e) => e.level === 'cluster_state');
    const aClusterLevel = (aRec?.lifecycleEventsCausedByMove ?? []).filter((e) => e.level === 'cluster_state');
    const bClusterLevel = (bRec?.lifecycleEventsCausedByMove ?? []).filter((e) => e.level === 'cluster_state');
    expect(rootClusterLevel.length).toBe(0);
    expect(aClusterLevel.length).toBe(0);
    expect(bClusterLevel.length).toBe(1);
    expect(bClusterLevel[0].fromState).toBe('open');
    expect(bClusterLevel[0].toState).toBe('rebutted');
  });
});
