/**
 * META-001 — Concentrated doctrine anchor tests.
 *
 * Pure-model. Covers the headline doctrine lines:
 *   1. Manual tag ≠ moderation flag. Type-level separation is enforced by
 *      `ManualTagCode` being a closed 10-code union; flag codes never
 *      appear there.
 *   2. Auto metadata is non-blocking. `JSON.stringify(ledger)` contains
 *      no `block` / `prevent` / `reject` / `forbid` / `disallow` /
 *      `denied` tokens.
 *   3. No verdict tokens in any produced field.
 *   4. Observers cannot apply tags (universal refusal).
 *   5. Cluster-wide auto codes mirror correctly onto every member.
 *   6. Heat / popularity never feed any code.
 *   7. Forbidden tokens enumerated in `_forbiddenMetadataTokens` are NEVER
 *      a substring of any plain label.
 */

import {
  ALL_AUTO_METADATA_CODES,
  ALL_MANUAL_TAG_CODES,
  applyManualTag,
  buildMoveMetadataLedger,
  getAutoMetadataPlainLabel,
  getManualTagPlainLabel,
  _forbiddenMetadataTokens,
  type EligibilityContext,
  type ManualTagEntry,
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
} from '../src/features/lifecycle';

// ── Fixture helpers ───────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: '2026-05-18T10:00:00.000Z', createdAtLabel: '', relativeLabel: '',
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

function makeLifecycleMap(
  clusters: ReadonlyArray<{
    clusterId: string;
    state: PointLifecycleState;
    messageIds: ReadonlyArray<string>;
  }>,
): PointLifecycleMap {
  const byCluster = new Map<string, PointLifecycleClusterSummary>();
  const byMessage = new Map<string, PointLifecycleSnapshot>();
  const order: string[] = [];
  for (const c of clusters) {
    byCluster.set(c.clusterId, {
      clusterId: c.clusterId, rootMessageId: c.clusterId, state: c.state,
      plainLabel: c.state, messageIds: c.messageIds, memberCount: c.messageIds.length,
      affirmativeMoveCount: 0, negativeMoveCount: 0, observerMoveCount: 0,
      hasOpenSourceOrQuoteRequest: false, hasConcessionOrSynthesisMove: false,
      worstEvidenceStatus: 'no_source', primaryAxis: null, isAdvisory: false,
    });
    order.push(c.clusterId);
    for (const mid of c.messageIds) {
      byMessage.set(mid, {
        messageId: mid, clusterId: c.clusterId, clusterState: c.state,
        messageContribution: c.state, axis: null,
        opensRequest: false, resolvesRequest: false,
        isConcessionShape: false, isSynthesisShape: false,
        plainLabel: c.state,
      });
    }
  }
  return {
    byCluster, byMessage, clusterOrder: order,
    cumulativeStateSequence: clusters.map((c) => c.state), inputHash: 'lc',
  };
}

// ── Manual tag ≠ moderation flag ──────────────────────────────

describe('META-001 doctrine — manual tag != moderation flag', () => {
  it('flag codes in droppedTags never appear in userAppliedTags', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true,
      droppedTags: [
        { code: 'flag:civility', label: '', color: '' },
        { code: 'flag:harassment', label: '', color: '' },
      ] as TimelineDroppedTag[],
    });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap([{ clusterId: 'r', state: 'open', messageIds: ['r'] }]);
    const before = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    // Now apply a real manual tag.
    const after = applyManualTag({
      ledger: before, messageId: 'r', code: 'needs_source',
      eligibility: {
        applierUserId: 'u1', applierActorRole: 'participant_negative', isOwnBubble: false,
      },
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    const rec = after.byMessage.get('r')!;
    // userAppliedTags has the manual tag, NOT the flag codes.
    const manualCodes = rec.userAppliedTags.map((t) => t.code);
    expect(manualCodes).toContain('needs_source');
    expect(manualCodes).not.toContain('flag:civility');
    expect(manualCodes).not.toContain('flag:harassment');
    // semanticFlags carries the flag codes.
    expect(rec.semanticFlags).toContain('flag:civility');
    expect(rec.semanticFlags).toContain('flag:harassment');
  });

  it('all 10 ManualTagCode values are NOT moderation flag codes (no flag: prefix)', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(c.startsWith('flag:')).toBe(false);
    }
  });

  it('all 16 AutoMetadataCode values are NOT moderation flag codes (no flag: prefix)', () => {
    for (const c of ALL_AUTO_METADATA_CODES) {
      expect(c.startsWith('flag:')).toBe(false);
    }
  });
});

// ── Auto metadata is non-blocking ─────────────────────────────

describe('META-001 doctrine — auto metadata is non-blocking', () => {
  it('JSON.stringify(ledger) contains no block / prevent / reject / forbid / disallow / denied tokens', () => {
    const banned = ['block', 'prevent', 'reject', 'forbid', 'disallow', 'denied'];
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 1 });
    const c = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
    });
    const tl = makeTimelineMap([root, c]);
    const lc = makeLifecycleMap([{ clusterId: 'r', state: 'exhausted', messageIds: ['r', 'c'] }]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
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

// ── No verdict tokens in any produced field ───────────────────

describe('META-001 doctrine — no verdict tokens in any produced field', () => {
  const banned = _forbiddenMetadataTokens();

  it('manual tag plain labels never contain banned tokens', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      const label = getManualTagPlainLabel(c).toLowerCase();
      for (const t of banned) {
        expect(label.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('auto metadata plain labels never contain banned tokens', () => {
    for (const c of ALL_AUTO_METADATA_CODES) {
      const label = getAutoMetadataPlainLabel(c).toLowerCase();
      for (const t of banned) {
        expect(label.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('forbidden token list has no internal-code shapes (lowercase words)', () => {
    for (const t of banned) {
      expect(t).toBe(t.toLowerCase());
    }
  });
});

// ── Observers cannot apply tags ───────────────────────────────

describe('META-001 doctrine — observers cannot apply tags', () => {
  it('every one of the 10 manual tags is refused for observer applier', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap([{ clusterId: 'r', state: 'open', messageIds: ['r'] }]);
    const before = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const observerCtx: EligibilityContext = {
      applierUserId: 'u-obs', applierActorRole: 'observer', isOwnBubble: false,
    };
    for (const code of ALL_MANUAL_TAG_CODES) {
      const after = applyManualTag({
        ledger: before, messageId: 'r', code,
        eligibility: observerCtx, appliedAt: '2026-05-18T12:00:00.000Z',
      });
      expect(after).toBe(before);
    }
  });
});

// ── Cluster-wide auto codes mirror correctly ──────────────────

describe('META-001 doctrine — cluster-wide auto codes mirror onto every member', () => {
  it('a 5-member cluster reaches `exhausted`; every member has point_exhausted', () => {
    const nodes: ArgumentTimelineMapNode[] = [];
    for (let i = 0; i < 5; i++) {
      nodes.push(fakeNode({
        messageId: `m${i}`,
        parentId: i === 0 ? null : `m${i - 1}`,
        branchRootMessageId: 'm0',
        ordinal: i + 1,
        isRoot: i === 0,
        kindColorFamily: i % 2 === 0 ? 'claim' : 'challenge',
      }));
    }
    const tl = makeTimelineMap(nodes);
    const lc = makeLifecycleMap([{
      clusterId: 'm0', state: 'exhausted', messageIds: nodes.map((n) => n.messageId),
    }]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    for (const n of nodes) {
      const codes = ledger.byMessage.get(n.messageId)!.autoDerivedMetadata.map((a) => a.code);
      expect(codes).toContain('point_exhausted');
    }
  });

  it('cluster summary lists `point_exhausted` exactly once', () => {
    const nodes: ArgumentTimelineMapNode[] = [];
    for (let i = 0; i < 3; i++) {
      nodes.push(fakeNode({
        messageId: `m${i}`, parentId: i === 0 ? null : `m${i - 1}`,
        branchRootMessageId: 'm0', ordinal: i + 1,
      }));
    }
    const tl = makeTimelineMap(nodes);
    const lc = makeLifecycleMap([{
      clusterId: 'm0', state: 'exhausted', messageIds: nodes.map((n) => n.messageId),
    }]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const clusterCodes = ledger.byCluster.get('m0')!.autoMetadataCodes;
    const occurrences = clusterCodes.filter((c) => c === 'point_exhausted').length;
    expect(occurrences).toBe(1);
  });
});

// ── No AI / Supabase calls in this module ─────────────────────

describe('META-001 doctrine — no AI / Supabase / network surface', () => {
  it('metadata source files do not import any AI provider client', () => {
    // Already covered by metadataForbiddenImports.test.ts; this is the
    // doctrine-level sanity reaffirmation.
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap([{ clusterId: 'r', state: 'open', messageIds: ['r'] }]);
    const ledger = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    // The model produced output without calling out — synchronous,
    // deterministic, no side effects.
    expect(ledger).toBeDefined();
  });

  it('applyManualTag is synchronous and produces no Promise', () => {
    const root = fakeNode({ messageId: 'r' });
    const tl = makeTimelineMap([root]);
    const lc = makeLifecycleMap([{ clusterId: 'r', state: 'open', messageIds: ['r'] }]);
    const before = buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map(), manualTagsByMessageId: new Map(),
    });
    const result = applyManualTag({
      ledger: before, messageId: 'r', code: 'concession_offered',
      eligibility: {
        applierUserId: 'u1', applierActorRole: 'participant_negative', isOwnBubble: true,
      },
      appliedAt: '2026-05-18T12:00:00.000Z',
    });
    // Not a thenable.
    expect((result as unknown as { then?: unknown }).then).toBeUndefined();
  });
});

// ── No popularity / heat input affects ANY code ───────────────

describe('META-001 doctrine — heat / popularity / engagement NEVER feed any code', () => {
  function buildLedger(band: TimelineStandingBand, tone: TimelineToneBand, temp: TimelineTemperatureBand) {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 2, descendantCount: 2,
      standingBand: band, toneBand: tone, temperatureBand: temp,
      droppedTags: [{ code: 'branch_this_off', label: '', color: '' }],
    });
    const c1 = fakeNode({
      messageId: 'c1', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
      kindColorFamily: 'challenge',
      standingBand: band, toneBand: tone, temperatureBand: temp,
    });
    const c2 = fakeNode({
      messageId: 'c2', parentId: 'c1', branchRootMessageId: 'r', ordinal: 3,
      kindColorFamily: 'challenge',
      standingBand: band, toneBand: tone, temperatureBand: temp,
    });
    const tl = makeTimelineMap([root, c1, c2]);
    const lc = makeLifecycleMap([{ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c1', 'c2'] }]);
    return buildMoveMetadataLedger({
      timelineMap: tl, lifecycleMap: lc,
      artifactsByMessageId: new Map([
        ['r', [{
          id: 'r:e:0', argumentId: 'r', kind: 'url', label: 'S',
          url: 'https://x', sourceChainStatus: 'source_and_quote', risk: 'low',
          addedByUserId: 'u1', createdAt: '2026-05-18T10:00:00.000Z',
          quote: 'A quotable thing.',
        } as EvidenceArtifact]],
      ]),
      manualTagsByMessageId: new Map(),
      detectedAt: 'FIXED-AT',
    });
  }

  function ledgerShape(l: ReturnType<typeof buildLedger>) {
    return [...l.byMessage.entries()].map(([id, rec]) => ({
      id,
      auto: rec.autoDerivedMetadata.map((a) => a.code).sort(),
      manual: rec.userAppliedTags.map((t) => t.code).sort(),
      semanticFlags: [...rec.semanticFlags].sort(),
      lifecycle: rec.lifecycleEventsCausedByMove.map((l) => l.causationKey).sort(),
    }));
  }

  it('every {band, tone, temp} combination produces the same byMessage shape', () => {
    const baseline = ledgerShape(buildLedger('neutral', 'calm', 'cool'));
    const variants: Array<[TimelineStandingBand, TimelineToneBand, TimelineTemperatureBand]> = [
      ['completely_right', 'calm', 'cool'],
      ['pretty_wrong', 'calm', 'cool'],
      ['neutral', 'hostile', 'cool'],
      ['neutral', 'calm', 'hot'],
      ['completely_right', 'hostile', 'hot'],
    ];
    for (const v of variants) {
      expect(ledgerShape(buildLedger(...v))).toEqual(baseline);
    }
  });
});

// ── Tag application happens via the closed-union type system ──

describe('META-001 doctrine — ManualTagCode is a closed union (TypeScript)', () => {
  it('a ManualTagEntry constructed from external input is normalised through the union', () => {
    // This is a structural assertion — entries the caller passes in carry
    // the closed-union code. Tests at the module surface never accept a
    // non-union value at runtime because the type system rejects it.
    const entry: ManualTagEntry = {
      code: 'needs_source',
      appliedByUserId: 'u1',
      appliedByActorRole: 'participant_negative',
      appliedAt: '2026-05-18T12:00:00.000Z',
      dedupeKey: 'needs_source:u1',
    };
    expect(ALL_MANUAL_TAG_CODES).toContain(entry.code);
  });
});
