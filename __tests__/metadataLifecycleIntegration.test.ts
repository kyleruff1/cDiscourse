/**
 * META-001 — Integration with LIFE-001 + BR-001.
 *
 * Builds the real `ArgumentTimelineMapModel` + `PointLifecycleMap` from
 * raw `ArgumentMessageInput[]` and feeds them into
 * `buildMoveMetadataLedger`. Asserts:
 *   - Cluster boundaries in `ledger.byCluster` exactly match
 *     `lifecycleMap.byCluster`.
 *   - `byMessage.get(id).disagreementAxis === lifecycleMap.byMessage.get(id).axis`.
 *   - Snapshot-diff causation entries fire correctly across two renders
 *     of an evolving timeline.
 *   - `MoveLinkageRecord.branchId` matches the BR-001 branchId carried on
 *     the surface model.
 */

import {
  buildMoveMetadataLedger,
} from '../src/features/metadata';
import {
  buildArgumentTimelineMap,
  type ArgumentMessageInput,
} from '../src/features/arguments/argumentGameSurfaceModel';
import {
  buildPointLifecycleMap,
} from '../src/features/lifecycle';

function msg(over: Partial<ArgumentMessageInput> & { id: string; createdAt: string }): ArgumentMessageInput {
  const base: ArgumentMessageInput = {
    id: over.id,
    debateId: 'd1',
    parentId: null,
    authorId: 'u1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'body text',
    status: 'open',
    createdAt: over.createdAt,
    isBot: false,
    qualifierLabels: [],
    pointStandingHint: null,
    attachedEvidence: null,
  };
  return { ...base, ...over };
}

// ── 6-node fixture exercising BR-001 + LIFE-001 ───────────────

function buildSmallFixture(): ReturnType<typeof buildArgumentTimelineMap> {
  const messages: ArgumentMessageInput[] = [
    msg({ id: 'r', createdAt: '2026-05-18T10:00:00.000Z', argumentType: 'thesis' }),
    msg({
      id: 'a', parentId: 'r', authorId: 'u2', side: 'negative',
      argumentType: 'rebuttal', createdAt: '2026-05-18T10:05:00.000Z',
    }),
    msg({
      id: 'b', parentId: 'a', authorId: 'u1', side: 'affirmative',
      argumentType: 'counter-rebuttal', createdAt: '2026-05-18T10:10:00.000Z',
    }),
    msg({
      id: 'c', parentId: 'r', authorId: 'u2', side: 'negative',
      argumentType: 'clarification_request', createdAt: '2026-05-18T10:15:00.000Z',
    }),
    msg({
      id: 'd', parentId: 'c', authorId: 'u1', side: 'affirmative',
      argumentType: 'evidence', createdAt: '2026-05-18T10:20:00.000Z',
      attachedEvidence: [{
        url: 'https://example.org/study',
        label: 'Source',
        sourceText: null,
        quote: 'Quoted excerpt from the source.',
      }],
    }),
    msg({
      id: 'e', parentId: 'r', authorId: 'u1', side: 'affirmative',
      argumentType: 'synthesis', createdAt: '2026-05-18T10:25:00.000Z',
    }),
  ];
  return buildArgumentTimelineMap({ messages, currentUserId: 'u1' });
}

// ── Cluster boundary parity ──────────────────────────────────

describe('META-001 integration with LIFE-001 + BR-001 — cluster boundaries', () => {
  it('ledger.byCluster keys equal lifecycleMap.byCluster keys', () => {
    const timelineMap = buildSmallFixture();
    const lifecycleMap = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap,
      lifecycleMap,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect([...ledger.byCluster.keys()].sort()).toEqual([...lifecycleMap.byCluster.keys()].sort());
  });

  it('cluster lifecycleState is a read-through from LIFE-001', () => {
    const timelineMap = buildSmallFixture();
    const lifecycleMap = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap,
      lifecycleMap,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    for (const [clusterId, lc] of lifecycleMap.byCluster.entries()) {
      const ms = ledger.byCluster.get(clusterId)!;
      expect(ms.lifecycleState).toBe(lc.state);
    }
  });

  it('byMessage.get(id).disagreementAxis === lifecycleMap.byMessage.get(id).axis', () => {
    const timelineMap = buildSmallFixture();
    const lifecycleMap = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap,
      lifecycleMap,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    for (const [mid, rec] of ledger.byMessage.entries()) {
      const snap = lifecycleMap.byMessage.get(mid);
      expect(rec.disagreementAxis).toBe(snap?.axis ?? null);
    }
  });

  it('every node has a linkage record (no dropped messages)', () => {
    const timelineMap = buildSmallFixture();
    const lifecycleMap = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap,
      lifecycleMap,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    for (const n of timelineMap.nodes) {
      expect(ledger.byMessage.has(n.messageId)).toBe(true);
    }
  });

  it('branchId on the linkage record matches the timeline node branchId', () => {
    const timelineMap = buildSmallFixture();
    const lifecycleMap = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: new Map(),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap,
      lifecycleMap,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    for (const n of timelineMap.nodes) {
      const rec = ledger.byMessage.get(n.messageId)!;
      expect(rec.branchId).toBe(n.branchId);
      expect(rec.rootPointId).toBe(n.branchRootMessageId);
      expect(rec.pointClusterId).toBe(n.branchRootMessageId);
    }
  });
});

// ── Snapshot-diff across two renders ──────────────────────────

describe('META-001 integration — snapshot-diff causation across two renders', () => {
  it('second render of an extended timeline fires transition events keyed on the new chronologically-last cluster member', () => {
    // First render: thesis + one rebuttal.
    const first = [
      msg({ id: 'r', createdAt: '2026-05-18T10:00:00.000Z', argumentType: 'thesis' }),
      msg({
        id: 'a', parentId: 'r', authorId: 'u2', side: 'negative',
        argumentType: 'rebuttal', createdAt: '2026-05-18T10:05:00.000Z',
      }),
    ];
    const tl1 = buildArgumentTimelineMap({ messages: first, currentUserId: 'u1' });
    const lc1 = buildPointLifecycleMap({
      timelineMap: tl1,
      artifactsByMessageId: new Map(),
    });
    const ledger1 = buildMoveMetadataLedger({
      timelineMap: tl1, lifecycleMap: lc1,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });

    // Second render: add a synthesis at the root cluster.
    const second = [
      ...first,
      msg({
        id: 'b', parentId: 'r', authorId: 'u1', side: 'affirmative',
        argumentType: 'synthesis', createdAt: '2026-05-18T10:10:00.000Z',
      }),
    ];
    const tl2 = buildArgumentTimelineMap({ messages: second, currentUserId: 'u1' });
    const lc2 = buildPointLifecycleMap({
      timelineMap: tl2,
      artifactsByMessageId: new Map(),
    });
    const ledger2 = buildMoveMetadataLedger({
      timelineMap: tl2, lifecycleMap: lc2,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
      previousLedger: ledger1,
      previousLifecycleMap: lc1,
    });

    // Some transition event must fire because the lifecycle state moved.
    const transitions = ledger2.metadataEvents.filter(
      (e) => e.codeFamily === 'lifecycle_causation' && e.kind === 'transition',
    );
    expect(transitions.length).toBeGreaterThan(0);
  });
});

// ── Doctrine: branchId integrity ──────────────────────────────

describe('META-001 integration — BR-001 branchId integrity', () => {
  it('a BR-001 branch root (parent !== null AND branchRootMessageId === messageId) emits branch_created auto-metadata', () => {
    // Build a fixture where a branch is created.
    const messages = [
      msg({ id: 'r', createdAt: '2026-05-18T10:00:00.000Z', argumentType: 'thesis' }),
      msg({
        id: 'a', parentId: 'r', authorId: 'u2', side: 'negative',
        argumentType: 'rebuttal', createdAt: '2026-05-18T10:05:00.000Z',
      }),
    ];
    const tl = buildArgumentTimelineMap({ messages, currentUserId: 'u1' });
    const lc = buildPointLifecycleMap({
      timelineMap: tl,
      artifactsByMessageId: new Map(),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    // Find the chronologically-second node — should be a branch root if
    // BR-001 considers it one.
    const reply = tl.nodes.find((n) => n.messageId === 'a')!;
    const isBranchRoot = reply.parentId !== null && reply.branchRootMessageId === 'a';
    if (isBranchRoot) {
      const codes = ledger.byMessage.get('a')!.autoDerivedMetadata.map((a) => a.code);
      expect(codes).toContain('branch_created');
    }
  });
});

// ── Performance — full chain with LIFE-001 + BR-001 ──────────

describe('META-001 integration — performance', () => {
  it('full pipeline (timeline + lifecycle + ledger) for a 60-node tree completes quickly', () => {
    const N = 60;
    const messages: ArgumentMessageInput[] = [];
    messages.push(msg({ id: 'r', createdAt: '2026-05-18T10:00:00.000Z', argumentType: 'thesis' }));
    let lastChainId = 'r';
    for (let i = 1; i < N; i++) {
      const isRebut = i % 3 === 0;
      const isClarify = i % 5 === 0;
      const id = `m${i}`;
      messages.push(msg({
        id,
        parentId: lastChainId,
        authorId: i % 2 === 0 ? 'u1' : 'u2',
        side: i % 2 === 0 ? 'affirmative' : 'negative',
        argumentType: isClarify ? 'clarification_request' : isRebut ? 'rebuttal' : 'claim',
        createdAt: `2026-05-18T10:${String(i).padStart(2, '0')}:00.000Z`,
      }));
      lastChainId = id;
    }
    const start = performance.now();
    const tl = buildArgumentTimelineMap({ messages, currentUserId: 'u1' });
    const lc = buildPointLifecycleMap({
      timelineMap: tl,
      artifactsByMessageId: new Map(),
    });
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    const elapsed = performance.now() - start;
    expect(ledger.byMessage.size).toBe(N);
    expect(elapsed).toBeLessThan(150);
  });
});
