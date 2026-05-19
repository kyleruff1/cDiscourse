/**
 * META-001 — Auto-derived metadata model tests.
 *
 * Pure-model tests, no React / Supabase / network. Covers:
 *   - Per-code derivation (one happy + one boundary for each of the 16 codes).
 *   - Cluster-wide mirroring of `point_stalled`, `point_exhausted`,
 *     `synthesis_candidate` onto every cluster member.
 *   - Doctrine anchor: heat / standing / popularity / tone / topicScore
 *     never feed auto metadata.
 *   - Idempotency: rerunning the deriver with the same inputs is stable.
 */

import {
  deriveAutoMetadataForMessage,
  DEFAULT_AUTO_METADATA_CONFIG,
  buildMoveMetadataLedger,
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
  PointLifecycleAxis,
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
    branchId: over.branchId ?? `branch-${over.messageId ?? 'm1'}`,
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
    accessibilityLabel: over.accessibilityLabel ?? over.messageId ?? 'm1',
  };
}

function fakeArtifact(argumentId: string, over: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: `${argumentId}:evidence:0`,
    argumentId,
    kind: 'url',
    label: 'Source',
    url: 'https://example.org/article',
    quote: 'Verbatim excerpt.',
    sourceChainStatus: 'source_and_quote',
    risk: 'low',
    addedByUserId: 'u1',
    createdAt: '2026-05-18T10:00:00.000Z',
    ...over,
  };
}

function clusterSummary(over: Partial<PointLifecycleClusterSummary> & {
  clusterId: string;
  state: PointLifecycleState;
  messageIds: ReadonlyArray<string>;
}): PointLifecycleClusterSummary {
  return {
    clusterId: over.clusterId,
    rootMessageId: over.rootMessageId ?? over.clusterId,
    state: over.state,
    plainLabel: over.plainLabel ?? over.state,
    messageIds: over.messageIds,
    memberCount: over.memberCount ?? over.messageIds.length,
    affirmativeMoveCount: over.affirmativeMoveCount ?? 0,
    negativeMoveCount: over.negativeMoveCount ?? 0,
    observerMoveCount: over.observerMoveCount ?? 0,
    hasOpenSourceOrQuoteRequest: over.hasOpenSourceOrQuoteRequest ?? false,
    hasConcessionOrSynthesisMove: over.hasConcessionOrSynthesisMove ?? false,
    worstEvidenceStatus: over.worstEvidenceStatus ?? 'no_source',
    primaryAxis: (over.primaryAxis ?? null) as PointLifecycleAxis | null,
    isAdvisory: over.isAdvisory ?? false,
  };
}

function snapshot(over: Partial<PointLifecycleSnapshot> & {
  messageId: string;
  clusterId: string;
  clusterState: PointLifecycleState;
  messageContribution: PointLifecycleState;
}): PointLifecycleSnapshot {
  return {
    messageId: over.messageId,
    clusterId: over.clusterId,
    clusterState: over.clusterState,
    messageContribution: over.messageContribution,
    axis: (over.axis ?? null) as PointLifecycleAxis | null,
    opensRequest: over.opensRequest ?? false,
    resolvesRequest: over.resolvesRequest ?? false,
    isConcessionShape: over.isConcessionShape ?? false,
    isSynthesisShape: over.isSynthesisShape ?? false,
    plainLabel: over.plainLabel ?? over.clusterState,
  };
}

// ── Per-code derivation: happy + boundary ─────────────────────

describe('META-001 deriveAutoMetadataForMessage — has_reply', () => {
  it('absent when node has no children', () => {
    const node = fakeNode({ replyCount: 0 });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'open', messageIds: ['m1'] }),
      messageSnapshot: snapshot({
        messageId: 'm1',
        clusterId: 'm1',
        clusterState: 'open',
        messageContribution: 'open',
      }),
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: '2026-05-18T11:00:00.000Z',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).not.toContain('has_reply');
  });

  it('present when node has ≥ 1 direct child', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 1, isRoot: true });
    const child = fakeNode({ messageId: 'c', parentId: 'r', branchRootMessageId: 'r' });
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child],
      artifacts: [],
      detectedAt: '2026-05-18T11:00:00.000Z',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [root, child],
    });
    expect(out.map((e) => e.code)).toContain('has_reply');
  });
});

describe('META-001 deriveAutoMetadataForMessage — has_rebuttal', () => {
  it('absent when child is non-challenge', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 1 });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r',
      kindColorFamily: 'claim',
    });
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'answered', messageIds: ['r', 'c'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [root, child],
    });
    expect(out.map((e) => e.code)).not.toContain('has_rebuttal');
  });

  it('present when child is challenge-family', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 1 });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r',
      kindColorFamily: 'challenge', kindLabel: 'rebuttal',
    });
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [root, child],
    });
    expect(out.map((e) => e.code)).toContain('has_rebuttal');
  });
});

describe('META-001 deriveAutoMetadataForMessage — has_counter_rebuttal', () => {
  it('present when grandchild is challenge-family', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 2 });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r',
      kindColorFamily: 'challenge', kindLabel: 'rebuttal',
    });
    const grand = fakeNode({
      messageId: 'g', parentId: 'c', branchRootMessageId: 'r',
      kindColorFamily: 'challenge', kindLabel: 'counter-rebuttal',
    });
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c', 'g'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child, grand],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [root, child, grand],
    });
    expect(out.map((e) => e.code)).toContain('has_counter_rebuttal');
  });

  it('absent when grandchild is not challenge', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 2 });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r',
      kindColorFamily: 'challenge',
    });
    const grand = fakeNode({
      messageId: 'g', parentId: 'c', branchRootMessageId: 'r',
      kindColorFamily: 'evidence',
    });
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'sourced', messageIds: ['r', 'c', 'g'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child, grand],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [root, child, grand],
    });
    expect(out.map((e) => e.code)).not.toContain('has_counter_rebuttal');
  });
});

describe('META-001 deriveAutoMetadataForMessage — has_evidence / source_attached / quote_attached', () => {
  it('absent when no artifacts attached', () => {
    const node = fakeNode({ messageId: 'r', replyCount: 0 });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'open', messageIds: ['r'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    const codes = out.map((e) => e.code);
    expect(codes).not.toContain('has_evidence');
    expect(codes).not.toContain('source_attached');
    expect(codes).not.toContain('quote_attached');
  });

  it('has_evidence + source_attached + quote_attached when url + quote artifact attached', () => {
    const node = fakeNode({ messageId: 'r' });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'sourced', messageIds: ['r'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [fakeArtifact('r', { kind: 'url', quote: 'A quotable phrase.' })],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    const codes = out.map((e) => e.code);
    expect(codes).toContain('has_evidence');
    expect(codes).toContain('source_attached');
    expect(codes).toContain('quote_attached');
  });

  it('manual_citation kind artifact triggers has_evidence but NOT source_attached', () => {
    const node = fakeNode({ messageId: 'r' });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'sourced', messageIds: ['r'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [fakeArtifact('r', {
        kind: 'manual_citation',
        url: undefined,
        quote: undefined,
      })],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    const codes = out.map((e) => e.code);
    expect(codes).toContain('has_evidence');
    expect(codes).not.toContain('source_attached');
    expect(codes).not.toContain('quote_attached');
  });

  it('dataset kind artifact triggers source_attached', () => {
    const node = fakeNode({ messageId: 'r' });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'sourced', messageIds: ['r'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [fakeArtifact('r', { kind: 'dataset', quote: undefined })],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).toContain('source_attached');
  });
});

describe('META-001 deriveAutoMetadataForMessage — source_requested / quote_requested', () => {
  it('source_requested when a direct child has messageContribution === source_requested', () => {
    const root = fakeNode({ messageId: 'r' });
    const child = fakeNode({ messageId: 'c', parentId: 'r', branchRootMessageId: 'r' });
    const contributions = new Map<string, PointLifecycleState>([['c', 'source_requested']]);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'source_requested', messageIds: ['r', 'c'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, child],
    });
    expect(out.map((e) => e.code)).toContain('source_requested');
  });

  it('absent when child has clarified contribution instead', () => {
    const root = fakeNode({ messageId: 'r' });
    const child = fakeNode({ messageId: 'c', parentId: 'r', branchRootMessageId: 'r' });
    const contributions = new Map<string, PointLifecycleState>([['c', 'clarified']]);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'clarified', messageIds: ['r', 'c'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, child],
    });
    expect(out.map((e) => e.code)).not.toContain('source_requested');
  });

  it('quote_requested when a direct child has messageContribution === quote_requested', () => {
    const root = fakeNode({ messageId: 'r' });
    const child = fakeNode({ messageId: 'c', parentId: 'r', branchRootMessageId: 'r' });
    const contributions = new Map<string, PointLifecycleState>([['c', 'quote_requested']]);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'quote_requested', messageIds: ['r', 'c'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, child],
    });
    expect(out.map((e) => e.code)).toContain('quote_requested');
  });
});

describe('META-001 deriveAutoMetadataForMessage — repeated_axis_pressure', () => {
  function buildAxisPressureFixture(rebuttedCount: number) {
    const root = fakeNode({
      messageId: 'r', replyCount: rebuttedCount, descendantCount: rebuttedCount,
    });
    const descendants: ArgumentTimelineMapNode[] = [];
    const contributions = new Map<string, PointLifecycleState>();
    for (let i = 0; i < rebuttedCount; i++) {
      const id = `r${i}`;
      const d = fakeNode({
        messageId: id, parentId: 'r', branchRootMessageId: 'r',
        kindColorFamily: 'challenge', kindLabel: 'rebuttal',
        ordinal: 2 + i,
      });
      descendants.push(d);
      contributions.set(id, 'rebutted');
    }
    return { root, descendants, contributions };
  }

  it('absent when only 1 same-axis non-additive rebut exists (below threshold 2)', () => {
    const { root, descendants, contributions } = buildAxisPressureFixture(1);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'rebutted', messageIds: ['r', ...descendants.map((d) => d.messageId)],
        primaryAxis: 'fact',
      }),
      messageSnapshot: snapshot({
        messageId: 'r', clusterId: 'r', clusterState: 'rebutted',
        messageContribution: 'open', axis: 'fact',
      }),
      childNodes: descendants,
      descendantNodes: descendants,
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, ...descendants],
    });
    expect(out.map((e) => e.code)).not.toContain('repeated_axis_pressure');
  });

  it('present when 2 same-axis non-additive rebuts exist (default threshold 2)', () => {
    const { root, descendants, contributions } = buildAxisPressureFixture(2);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'rebutted', messageIds: ['r', ...descendants.map((d) => d.messageId)],
        primaryAxis: 'fact',
      }),
      messageSnapshot: snapshot({
        messageId: 'r', clusterId: 'r', clusterState: 'rebutted',
        messageContribution: 'open', axis: 'fact',
      }),
      childNodes: descendants,
      descendantNodes: descendants,
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, ...descendants],
    });
    expect(out.map((e) => e.code)).toContain('repeated_axis_pressure');
  });

  it('absent when node has no axis (null snapshot.axis)', () => {
    const { root, descendants, contributions } = buildAxisPressureFixture(3);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'rebutted',
        messageIds: ['r', ...descendants.map((d) => d.messageId)],
      }),
      messageSnapshot: snapshot({
        messageId: 'r', clusterId: 'r', clusterState: 'rebutted',
        messageContribution: 'open', axis: null,
      }),
      childNodes: descendants,
      descendantNodes: descendants,
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, ...descendants],
    });
    expect(out.map((e) => e.code)).not.toContain('repeated_axis_pressure');
  });
});

describe('META-001 deriveAutoMetadataForMessage — branch_suggested', () => {
  it('present when node carries branch_this_off qualifier', () => {
    const dropTag: TimelineDroppedTag = { code: 'branch_this_off', label: '', color: '' };
    const node = fakeNode({ droppedTags: [dropTag] });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'open', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).toContain('branch_suggested');
  });

  it('present when node carries tangent_or_joke qualifier', () => {
    const dropTag: TimelineDroppedTag = { code: 'tangent_or_joke', label: '', color: '' };
    const node = fakeNode({ droppedTags: [dropTag] });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'open', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).toContain('branch_suggested');
  });

  it('present when cluster lifecycle state is branch_recommended', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'branch_recommended', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).toContain('branch_suggested');
  });

  it('absent otherwise', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'open', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).not.toContain('branch_suggested');
  });
});

describe('META-001 deriveAutoMetadataForMessage — branch_created', () => {
  it('present when node is a branch root with a parent', () => {
    const node = fakeNode({
      messageId: 'b', parentId: 'r', branchRootMessageId: 'b',
    });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'b', state: 'open', messageIds: ['b'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).toContain('branch_created');
  });

  it('absent for the original root (no parent)', () => {
    const node = fakeNode({
      messageId: 'r', parentId: null, branchRootMessageId: 'r', isRoot: true,
    });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'open', messageIds: ['r'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).not.toContain('branch_created');
  });

  it('absent for a non-branch-root descendant (branchRoot !== self)', () => {
    const node = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r',
    });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'open', messageIds: ['r', 'c'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).not.toContain('branch_created');
  });
});

describe('META-001 deriveAutoMetadataForMessage — point_stalled', () => {
  it('absent when cluster state is rebutted', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'rebutted', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).not.toContain('point_stalled');
  });

  it('present when cluster state is moved_on_by_affirmative', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({
        clusterId: 'm1', state: 'moved_on_by_affirmative', messageIds: ['m1'],
      }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).toContain('point_stalled');
  });

  it('present for all 5 stalled-family states', () => {
    const states: PointLifecycleState[] = [
      'moved_on_by_affirmative',
      'moved_on_by_negative',
      'ignored_by_affirmative',
      'ignored_by_negative',
      'ignored_by_both',
    ];
    for (const s of states) {
      const node = fakeNode({});
      const out = deriveAutoMetadataForMessage({
        node,
        clusterSummary: clusterSummary({ clusterId: 'm1', state: s, messageIds: ['m1'] }),
        messageSnapshot: null,
        childNodes: [],
        descendantNodes: [],
        artifacts: [],
        detectedAt: 'T1',
        autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
        descendantContributions: new Map(),
        roomNodes: [node],
      });
      expect(out.map((e) => e.code)).toContain('point_stalled');
    }
  });
});

describe('META-001 deriveAutoMetadataForMessage — point_exhausted', () => {
  it('absent when cluster state is rebutted', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'rebutted', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).not.toContain('point_exhausted');
  });

  it('present when cluster state is exhausted', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'exhausted', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).toContain('point_exhausted');
  });
});

describe('META-001 deriveAutoMetadataForMessage — synthesis_candidate', () => {
  it('absent when cluster state is rebutted', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'rebutted', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).not.toContain('synthesis_candidate');
  });

  it('present when cluster state is synthesis_ready', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({
        clusterId: 'm1', state: 'synthesis_ready', messageIds: ['m1'],
      }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    expect(out.map((e) => e.code)).toContain('synthesis_candidate');
  });
});

describe('META-001 deriveAutoMetadataForMessage — participant_skipped_node', () => {
  it('present when a same-side participant posted after this node but did not reply', () => {
    const node = fakeNode({ messageId: 'a1', sideLabel: 'Aff', ordinal: 1 });
    const otherCluster1 = fakeNode({
      messageId: 'a2', sideLabel: 'Aff', ordinal: 2,
      parentId: 'b1', branchRootMessageId: 'b1',
    });
    const otherCluster2 = fakeNode({
      messageId: 'a3', sideLabel: 'Aff', ordinal: 3,
      parentId: 'b1', branchRootMessageId: 'b1',
    });
    const otherCluster3 = fakeNode({
      messageId: 'a4', sideLabel: 'Aff', ordinal: 4,
      parentId: 'b1', branchRootMessageId: 'b1',
    });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'a1', state: 'open', messageIds: ['a1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node, otherCluster1, otherCluster2, otherCluster3],
    });
    expect(out.map((e) => e.code)).toContain('participant_skipped_node');
  });

  it('absent when a same-side participant DID reply to this node', () => {
    const node = fakeNode({ messageId: 'a1', sideLabel: 'Aff', ordinal: 1 });
    const reply = fakeNode({
      messageId: 'a2', parentId: 'a1', sideLabel: 'Aff', ordinal: 2,
      branchRootMessageId: 'a1',
    });
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'a1', state: 'answered', messageIds: ['a1', 'a2'] }),
      messageSnapshot: null,
      childNodes: [reply],
      descendantNodes: [reply],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node, reply],
    });
    expect(out.map((e) => e.code)).not.toContain('participant_skipped_node');
  });
});

describe('META-001 deriveAutoMetadataForMessage — no_response_after_n_turns', () => {
  it('present when an open ask exists AND enough room-wide turns have passed without sourcing', () => {
    const root = fakeNode({ messageId: 'r', ordinal: 1 });
    const ask = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const t1 = fakeNode({
      messageId: 'x1', ordinal: 3, branchRootMessageId: 'x1', parentId: null,
    });
    const t2 = fakeNode({
      messageId: 'x2', ordinal: 4, branchRootMessageId: 'x2', parentId: null,
    });
    const t3 = fakeNode({
      messageId: 'x3', ordinal: 5, branchRootMessageId: 'x3', parentId: null,
    });
    const contributions = new Map<string, PointLifecycleState>([
      ['c', 'source_requested'],
    ]);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'source_requested', messageIds: ['r', 'c'],
      }),
      messageSnapshot: null,
      childNodes: [ask],
      descendantNodes: [ask],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, ask, t1, t2, t3],
    });
    expect(out.map((e) => e.code)).toContain('no_response_after_n_turns');
  });

  it('absent at the boundary (2 turns, default threshold 3)', () => {
    const root = fakeNode({ messageId: 'r', ordinal: 1 });
    const ask = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const t1 = fakeNode({
      messageId: 'x1', ordinal: 3, branchRootMessageId: 'x1', parentId: null,
    });
    const t2 = fakeNode({
      messageId: 'x2', ordinal: 4, branchRootMessageId: 'x2', parentId: null,
    });
    const contributions = new Map<string, PointLifecycleState>([
      ['c', 'source_requested'],
    ]);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'source_requested', messageIds: ['r', 'c'],
      }),
      messageSnapshot: null,
      childNodes: [ask],
      descendantNodes: [ask],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, ask, t1, t2],
    });
    expect(out.map((e) => e.code)).not.toContain('no_response_after_n_turns');
  });

  it('absent when a sourced descendant closes the request', () => {
    const root = fakeNode({ messageId: 'r' });
    const ask = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r', ordinal: 2,
    });
    const ans = fakeNode({
      messageId: 'a', parentId: 'c', branchRootMessageId: 'r', ordinal: 3,
    });
    const t1 = fakeNode({ messageId: 'x1', ordinal: 4 });
    const t2 = fakeNode({ messageId: 'x2', ordinal: 5 });
    const t3 = fakeNode({ messageId: 'x3', ordinal: 6 });
    const contributions = new Map<string, PointLifecycleState>([
      ['c', 'source_requested'],
      ['a', 'sourced'],
    ]);
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'sourced', messageIds: ['r', 'c', 'a'],
      }),
      messageSnapshot: null,
      childNodes: [ask],
      descendantNodes: [ask, ans],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: contributions,
      roomNodes: [root, ask, ans, t1, t2, t3],
    });
    expect(out.map((e) => e.code)).not.toContain('no_response_after_n_turns');
  });
});

// ── Cluster-wide mirroring ────────────────────────────────────

describe('META-001 cluster-wide mirroring — point_exhausted', () => {
  it('mirrors onto every cluster member when cluster state is exhausted', () => {
    // Build a 3-member cluster with exhausted state, derive on each member.
    const members = ['r', 'a', 'b'];
    for (const memberId of members) {
      const node = fakeNode({
        messageId: memberId,
        parentId: memberId === 'r' ? null : 'r',
        branchRootMessageId: 'r',
      });
      const out = deriveAutoMetadataForMessage({
        node,
        clusterSummary: clusterSummary({
          clusterId: 'r', state: 'exhausted', messageIds: members,
        }),
        messageSnapshot: snapshot({
          messageId: memberId, clusterId: 'r', clusterState: 'exhausted',
          messageContribution: 'rebutted',
        }),
        childNodes: [],
        descendantNodes: [],
        artifacts: [],
        detectedAt: 'T1',
        autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
        descendantContributions: new Map(),
        roomNodes: [node],
      });
      expect(out.map((e) => e.code)).toContain('point_exhausted');
    }
  });

  it('inputSignals documents the cluster-level source so AN-003 can distinguish per-message vs cluster-mirrored signals', () => {
    const node = fakeNode({});
    const out = deriveAutoMetadataForMessage({
      node,
      clusterSummary: clusterSummary({ clusterId: 'm1', state: 'exhausted', messageIds: ['m1'] }),
      messageSnapshot: null,
      childNodes: [],
      descendantNodes: [],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: [node],
    });
    const entry = out.find((e) => e.code === 'point_exhausted');
    expect(entry).toBeDefined();
    expect(entry!.inputSignals.some((s) => s.includes('lifecycle.cluster.state'))).toBe(true);
  });
});

// ── Doctrine anchor — heat / standing / popularity do NOT feed auto metadata ──

describe('META-001 deriveAutoMetadataForMessage — doctrine anchor (no heat/popularity input)', () => {
  function buildIdenticalStructureFixture(
    band: TimelineStandingBand,
    tone: TimelineToneBand,
    temp: TimelineTemperatureBand,
  ) {
    const root = fakeNode({
      messageId: 'r', replyCount: 1, descendantCount: 1, isRoot: true,
      standingBand: band, toneBand: tone, temperatureBand: temp,
    });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r',
      standingBand: band, toneBand: tone, temperatureBand: temp,
    });
    return [root, child];
  }

  function deriveCodesFor(nodes: ArgumentTimelineMapNode[]) {
    return deriveAutoMetadataForMessage({
      node: nodes[0],
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'answered', messageIds: nodes.map((n) => n.messageId),
      }),
      messageSnapshot: null,
      childNodes: nodes.slice(1),
      descendantNodes: nodes.slice(1),
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map(),
      roomNodes: nodes,
    }).map((e) => e.code);
  }

  it('standingBand variation does NOT change output codes', () => {
    const a = deriveCodesFor(buildIdenticalStructureFixture('completely_right', 'calm', 'cool'));
    const b = deriveCodesFor(buildIdenticalStructureFixture('pretty_wrong', 'calm', 'cool'));
    expect(a.sort()).toEqual(b.sort());
  });

  it('toneBand variation does NOT change output codes', () => {
    const a = deriveCodesFor(buildIdenticalStructureFixture('neutral', 'calm', 'cool'));
    const b = deriveCodesFor(buildIdenticalStructureFixture('neutral', 'hostile', 'cool'));
    expect(a.sort()).toEqual(b.sort());
  });

  it('temperatureBand variation does NOT change output codes', () => {
    const a = deriveCodesFor(buildIdenticalStructureFixture('neutral', 'calm', 'cool'));
    const b = deriveCodesFor(buildIdenticalStructureFixture('neutral', 'calm', 'hot'));
    expect(a.sort()).toEqual(b.sort());
  });
});

// ── Idempotency ───────────────────────────────────────────────

describe('META-001 deriveAutoMetadataForMessage — idempotency', () => {
  it('produces deep-equal outputs for two calls with same inputs', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 1 });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r',
      kindColorFamily: 'challenge',
    });
    const args = {
      node: root,
      clusterSummary: clusterSummary({ clusterId: 'r', state: 'rebutted', messageIds: ['r', 'c'] }),
      messageSnapshot: null,
      childNodes: [child],
      descendantNodes: [child],
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map<string, PointLifecycleState>(),
      roomNodes: [root, child],
    };
    const a = deriveAutoMetadataForMessage(args);
    const b = deriveAutoMetadataForMessage(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('every entry has at most 4 inputSignals', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 1, descendantCount: 2 });
    const child = fakeNode({
      messageId: 'c', parentId: 'r', branchRootMessageId: 'r',
      kindColorFamily: 'challenge',
    });
    const grand = fakeNode({
      messageId: 'g', parentId: 'c', branchRootMessageId: 'r',
      kindColorFamily: 'challenge',
    });
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'exhausted', messageIds: ['r', 'c', 'g'],
        primaryAxis: 'fact',
      }),
      messageSnapshot: snapshot({
        messageId: 'r', clusterId: 'r', clusterState: 'exhausted',
        messageContribution: 'open', axis: 'fact',
      }),
      childNodes: [child],
      descendantNodes: [child, grand],
      artifacts: [fakeArtifact('r', { kind: 'url', quote: 'A.' })],
      detectedAt: 'T1',
      autoMetadataConfig: DEFAULT_AUTO_METADATA_CONFIG,
      descendantContributions: new Map([
        ['c', 'rebutted'],
        ['g', 'rebutted'],
      ]),
      roomNodes: [root, child, grand],
    });
    for (const entry of out) {
      expect(entry.inputSignals.length).toBeLessThanOrEqual(4);
    }
  });
});

// ── Doctrine — repeated_axis_pressure suppressed when threshold is 0 ──

describe('META-001 deriveAutoMetadataForMessage — config tunability', () => {
  it('repeated_axis_pressure respects custom threshold', () => {
    const root = fakeNode({ messageId: 'r', replyCount: 3 });
    const ds: ArgumentTimelineMapNode[] = [];
    const contributions = new Map<string, PointLifecycleState>();
    for (let i = 0; i < 3; i++) {
      const id = `r${i}`;
      const d = fakeNode({
        messageId: id, parentId: 'r', branchRootMessageId: 'r',
        kindColorFamily: 'challenge', ordinal: 2 + i,
      });
      ds.push(d);
      contributions.set(id, 'rebutted');
    }
    const out = deriveAutoMetadataForMessage({
      node: root,
      clusterSummary: clusterSummary({
        clusterId: 'r', state: 'rebutted',
        messageIds: ['r', ...ds.map((d) => d.messageId)],
        primaryAxis: 'fact',
      }),
      messageSnapshot: snapshot({
        messageId: 'r', clusterId: 'r', clusterState: 'rebutted',
        messageContribution: 'open', axis: 'fact',
      }),
      childNodes: ds,
      descendantNodes: ds,
      artifacts: [],
      detectedAt: 'T1',
      autoMetadataConfig: { ...DEFAULT_AUTO_METADATA_CONFIG, repeatedAxisPressureThreshold: 4 },
      descendantContributions: contributions,
      roomNodes: [root, ...ds],
    });
    // Threshold is 4; only 3 rebuts → absent.
    expect(out.map((e) => e.code)).not.toContain('repeated_axis_pressure');
  });
});

// Sanity: buildMoveMetadataLedger import wired through the same module surface.
describe('META-001 module wiring sanity', () => {
  it('buildMoveMetadataLedger is exported and callable on empty input', () => {
    const emptyTl: ArgumentTimelineMapModel = {
      nodes: [], edges: [], bands: [],
      activeNode: null, latestMessageId: null,
      activePathIds: [], width: 0, height: 0, scrollWidth: 0,
      beginningLabel: '', middleLabel: '', endLabel: '',
      participantTrends: [], legend: [],
      rootMessageId: null, firstRebuttalMessageId: null,
      hasRebuttal: false, rootOnboardingHint: null,
      showBackToRootControl: false,
    };
    const emptyLifecycle: PointLifecycleMap = {
      byCluster: new Map(),
      byMessage: new Map(),
      clusterOrder: [],
      cumulativeStateSequence: [],
      inputHash: '',
    };
    const out = buildMoveMetadataLedger({
      timelineMap: emptyTl,
      lifecycleMap: emptyLifecycle,
      artifactsByMessageId: new Map(),
      manualTagsByMessageId: new Map(),
    });
    expect(out.byMessage.size).toBe(0);
    expect(out.byCluster.size).toBe(0);
    expect(out.metadataEvents.length).toBe(0);
    expect(out.messageOrder.length).toBe(0);
    expect(out.inputHash).toBe('');
  });
});
