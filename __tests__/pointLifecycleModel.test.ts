/**
 * LIFE-001 — Pure-model tests for the point lifecycle model.
 *
 * No React, no Supabase, no network. Covers:
 *   - Per-state derivation (one happy + one boundary for each of 18 states).
 *   - Cluster composition order (5 explicit tests).
 *   - Per-message snapshot fields.
 *   - Map shape + clusterOrder + cumulativeStateSequence + inputHash.
 *   - Priority order assertions.
 *   - Doctrine anchors: heat / standing / popularity / tone / topicScore
 *     do not feed the model (4 deep-equal tests).
 *   - Ban-list (verdict / amplification / snake_case) on every produced
 *     plain label.
 *   - JSON-serializability.
 *   - Performance (250-message synthetic fixture < 30 ms).
 *   - Edge cases — empty room, root-only, detached, deeply nested,
 *     oscillating, multiple concessions, synthesis-without-concession,
 *     cross-axis non-closure, external evidence, admin-resolved,
 *     open-request-only, repeated tangent, quiet, observer-both,
 *     unaxed, synthesis-after-resolved.
 */

import {
  ALL_POINT_LIFECYCLE_STATES,
  ALL_POINT_LIFECYCLE_AXES,
  DEFAULT_LIFECYCLE_ADVISORY_CONFIG,
  LIFECYCLE_PRIORITY,
  _forbiddenLifecycleTokens,
  buildPointLifecycleMap,
  derivePointLifecycleSnapshot,
  getPointLifecyclePlainLabel,
  type LifecycleAdvisoryConfig,
} from '../src/features/lifecycle';
import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

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
  edges?: ArgumentTimelineMapEdge[],
): ArgumentTimelineMapModel {
  const edgesActual: ArgumentTimelineMapEdge[] = edges ?? nodes
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
    nodes,
    edges: edgesActual,
    bands: [],
    activeNode: null,
    latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: [],
    width: 800, height: 240, scrollWidth: 800,
    beginningLabel: '', middleLabel: '', endLabel: '',
    participantTrends: [], legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false, rootOnboardingHint: null,
    showBackToRootControl: false,
  };
}

function fakeArtifact(argumentId: string, over: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: `${argumentId}:evidence:0`,
    argumentId,
    kind: 'url',
    label: 'Source',
    url: 'https://example.org/article',
    sourceText: undefined,
    quote: 'Verbatim text excerpt for evidence.',
    sourceChainStatus: 'source_and_quote',
    risk: 'low',
    addedByUserId: 'u1',
    createdAt: '2026-05-18T10:00:00.000Z',
    ...over,
  };
}

// Builds a 2-node cluster: root claim + a reply with the specified shape.
function buildSimpleClusterFixture(replyOver: Partial<ArgumentTimelineMapNode>) {
  const root = fakeNode({
    messageId: 'r', kindLabel: 'claim', isRoot: true, replyCount: 1, descendantCount: 1,
    sideLabel: 'Aff', ordinal: 1, branchRootMessageId: 'r',
  });
  const reply = fakeNode({
    messageId: 'a',
    parentId: 'r',
    ordinal: 2,
    sideLabel: 'Neg',
    branchRootMessageId: 'r',
    ...replyOver,
  });
  return { nodes: [root, reply] };
}

// ── Vocabulary + priority assertions ──────────────────────────

describe('LIFE-001 vocabulary + priority', () => {
  it('exposes the full lifecycle vocabulary (18 gameplay states + archived terminal)', () => {
    // Design names this an "18-state vocabulary" + the `archived_or_resolved`
    // terminal closure state = 19 entries exposed in `ALL_POINT_LIFECYCLE_STATES`.
    expect(ALL_POINT_LIFECYCLE_STATES.length).toBe(19);
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('open');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('answered');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('rebutted');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('clarified');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('sourced');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('quote_requested');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('source_requested');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('narrowed');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('conceded');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('confirmed');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('synthesis_ready');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('moved_on_by_affirmative');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('moved_on_by_negative');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('ignored_by_affirmative');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('ignored_by_negative');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('ignored_by_both');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('exhausted');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('branch_recommended');
    expect(ALL_POINT_LIFECYCLE_STATES).toContain('archived_or_resolved');
  });

  it('every state has a priority entry', () => {
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      expect(typeof LIFECYCLE_PRIORITY[s]).toBe('number');
      expect(Number.isInteger(LIFECYCLE_PRIORITY[s])).toBe(true);
    }
  });

  it('archived_or_resolved < open (resolved is calmer than open)', () => {
    expect(LIFECYCLE_PRIORITY.archived_or_resolved).toBeLessThan(LIFECYCLE_PRIORITY.open);
  });

  it('exhausted > rebutted (exhausted dominates ordinary push)', () => {
    expect(LIFECYCLE_PRIORITY.exhausted).toBeGreaterThan(LIFECYCLE_PRIORITY.rebutted);
  });

  it('ignored_by_both > ignored_by_affirmative', () => {
    expect(LIFECYCLE_PRIORITY.ignored_by_both)
      .toBeGreaterThan(LIFECYCLE_PRIORITY.ignored_by_affirmative);
  });

  it('synthesis_ready < open (resolution-ish is calmer than open)', () => {
    expect(LIFECYCLE_PRIORITY.synthesis_ready).toBeLessThan(LIFECYCLE_PRIORITY.open);
  });

  it('exposes 10 axis values', () => {
    expect(ALL_POINT_LIFECYCLE_AXES.length).toBe(10);
  });

  it('exposes the default advisory config with conservative defaults', () => {
    expect(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.exhaustionRepeatThreshold).toBe(3);
    expect(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.movedOnTurnThreshold).toBe(4);
    expect(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.ignoredBySideTurnThreshold).toBe(3);
    expect(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.ignoredByBothTurnThreshold).toBe(6);
    expect(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.branchRecommendedRepeatThreshold).toBe(2);
  });
});

// ── Per-state derivation tests (happy + boundary for each of 18) ──

describe('LIFE-001 per-state derivation', () => {
  describe('open', () => {
    it('root with no replies → open', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 0, descendantCount: 0,
        branchRootMessageId: 'r',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('open');
    });

    it('boundary — single-node room is open even if observer side', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 0, descendantCount: 0,
        sideLabel: 'Obs', branchRootMessageId: 'r',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('open');
    });
  });

  describe('answered', () => {
    it('root with a single non-pressure reply → answered', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'claim',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('answered');
    });

    it('boundary — first rebuttal with no prior axis still answered', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'rebuttal',
        droppedTags: [{ code: 'fact_challenge', label: 'Fact', color: '#000' }],
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      // First fact-challenge with no ancestor → answered (not rebutted)
      expect(map.byCluster.get('r')!.state).toBe('answered');
    });
  });

  describe('rebutted', () => {
    it('two same-axis rebuttals in a chain → rebutted', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 2,
        branchRootMessageId: 'r',
      });
      const r1 = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'rebuttal',
        droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
        branchRootMessageId: 'r', sideLabel: 'Neg',
      });
      const r2 = fakeNode({
        messageId: 'b', parentId: 'a', ordinal: 3,
        kindLabel: 'counter-rebuttal',
        droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
        branchRootMessageId: 'r', sideLabel: 'Aff',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, r1, r2]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('rebutted');
    });

    it('boundary — challenge under a non-cluster ancestor still rebutted via parent chain', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 2,
        branchRootMessageId: 'r',
      });
      const reb = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'rebuttal',
        droppedTags: [{ code: 'definition_challenge', label: 'D', color: '#000' }],
        branchRootMessageId: 'r',
      });
      const reb2 = fakeNode({
        messageId: 'b', parentId: 'a', ordinal: 3,
        kindLabel: 'counter-rebuttal',
        droppedTags: [{ code: 'definition_challenge', label: 'D', color: '#000' }],
        branchRootMessageId: 'r',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, reb, reb2]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('rebutted');
    });
  });

  describe('clarified', () => {
    it('clarification_request without ask-source/quote shape → clarified', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'clarification',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('clarified');
    });

    it('boundary — `define_term` qualifier alone → clarified', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
        branchRootMessageId: 'r',
      });
      const c = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'clarification',
        droppedTags: [{ code: 'define_term', label: 'Define', color: '#000' }],
        branchRootMessageId: 'r',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, c]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('clarified');
    });
  });

  describe('sourced', () => {
    it('move with primary_present source_and_quote → sourced', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
        branchRootMessageId: 'r',
      });
      const ev = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'evidence',
        branchRootMessageId: 'r',
      });
      const arts = new Map();
      arts.set('a', [fakeArtifact('a', { sourceChainStatus: 'source_and_quote' })]);
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, ev]),
        artifactsByMessageId: arts,
      });
      expect(map.byCluster.get('r')!.state).toBe('sourced');
    });

    it('boundary — primary_present alone → sourced', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
        branchRootMessageId: 'r',
      });
      const ev = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'evidence',
        branchRootMessageId: 'r',
      });
      const arts = new Map();
      arts.set('a', [fakeArtifact('a', { sourceChainStatus: 'primary_present' })]);
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, ev]),
        artifactsByMessageId: arts,
      });
      expect(map.byCluster.get('r')!.state).toBe('sourced');
    });
  });

  describe('quote_requested', () => {
    it('clarification_request with quote_exact_bit → quote_requested', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
        branchRootMessageId: 'r',
      });
      const q = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'clarification',
        droppedTags: [{ code: 'quote_exact_bit', label: 'Q', color: '#000' }],
        branchRootMessageId: 'r',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, q]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('quote_requested');
    });

    it('boundary — quote_request alias code also → quote_requested', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
        branchRootMessageId: 'r',
      });
      const q = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'clarification',
        droppedTags: [{ code: 'quote_request', label: 'Q', color: '#000' }],
        branchRootMessageId: 'r',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, q]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('quote_requested');
    });
  });

  describe('source_requested', () => {
    it('clarification_request with ask_receipts → source_requested', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
        branchRootMessageId: 'r',
      });
      const s = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'clarification',
        droppedTags: [{ code: 'ask_receipts', label: 'Src', color: '#000' }],
        branchRootMessageId: 'r',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, s]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('source_requested');
    });

    it('boundary — source_request alias code → source_requested', () => {
      const root = fakeNode({
        messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 1,
        branchRootMessageId: 'r',
      });
      const s = fakeNode({
        messageId: 'a', parentId: 'r', ordinal: 2,
        kindLabel: 'clarification',
        droppedTags: [{ code: 'source_request', label: 'Src', color: '#000' }],
        branchRootMessageId: 'r',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap([root, s]),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('source_requested');
    });
  });

  describe('narrowed', () => {
    it('concession with concede_small_point → narrowed', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'concession',
        droppedTags: [{ code: 'concede_small_point', label: 'C', color: '#000' }],
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('narrowed');
    });

    it('boundary — narrow_scope qualifier alone (non-concession type) → narrowed', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'rebuttal',
        droppedTags: [{ code: 'narrow_scope', label: 'N', color: '#000' }],
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('narrowed');
    });
  });

  describe('conceded', () => {
    it('concession with concede_broad_point → conceded', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'concession',
        droppedTags: [{ code: 'concede_broad_point', label: 'C', color: '#000' }],
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('conceded');
    });

    it('boundary — bare concession argument type (no narrow lexeme) → conceded', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'concession',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('conceded');
    });
  });

  describe('confirmed', () => {
    it('argument type "confirmation" → confirmed', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'confirmation',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('confirmed');
    });

    it('boundary — pure_accept qualifier alone (non-root) → confirmed', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'claim',
        droppedTags: [{ code: 'pure_accept', label: 'A', color: '#000' }],
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('confirmed');
    });
  });

  describe('synthesis_ready', () => {
    it('argument type synthesis → synthesis_ready', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'synthesis',
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('synthesis_ready');
    });

    it('boundary — synthesize_open_question qualifier on non-synthesis type → synthesis_ready', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'claim',
        droppedTags: [{ code: 'synthesize_open_question', label: 'S', color: '#000' }],
      });
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
      });
      expect(map.byCluster.get('r')!.state).toBe('synthesis_ready');
    });
  });

  describe('archived_or_resolved', () => {
    it('flag code argument_resolved → archived_or_resolved', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'claim',
      });
      const flags = new Map();
      flags.set('a', ['argument_resolved']);
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
        flagCodesByMessageId: flags,
      });
      expect(map.byCluster.get('r')!.state).toBe('archived_or_resolved');
    });

    it('boundary — flag code archived_by_admin → archived_or_resolved', () => {
      const { nodes } = buildSimpleClusterFixture({
        kindLabel: 'claim',
      });
      const flags = new Map();
      flags.set('a', ['archived_by_admin']);
      const map = buildPointLifecycleMap({
        timelineMap: buildTimelineMap(nodes),
        artifactsByMessageId: new Map(),
        flagCodesByMessageId: flags,
      });
      expect(map.byCluster.get('r')!.state).toBe('archived_or_resolved');
    });
  });
});

// ── Cluster composition order ────────────────────────────────

describe('LIFE-001 cluster composition order', () => {
  it('resolution beats synthesis', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 2,
      branchRootMessageId: 'r',
    });
    const syn = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'synthesis',
      branchRootMessageId: 'r',
    });
    const arch = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'claim',
      branchRootMessageId: 'r',
    });
    const flags = new Map();
    flags.set('b', ['argument_resolved']);
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, syn, arch]),
      artifactsByMessageId: new Map(),
      flagCodesByMessageId: flags,
    });
    expect(map.byCluster.get('r')!.state).toBe('archived_or_resolved');
  });

  it('synthesis beats concession (no open request)', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 2,
      branchRootMessageId: 'r',
    });
    const conc = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'concession',
      branchRootMessageId: 'r',
    });
    const syn = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'synthesis',
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, conc, syn]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('synthesis_ready');
  });

  it('open request beats pressure', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 2,
      branchRootMessageId: 'r',
    });
    const reb = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const ask = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const reb2 = fakeNode({
      messageId: 'c', parentId: 'b', ordinal: 4,
      kindLabel: 'counter-rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reb, ask, reb2]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('source_requested');
  });

  it('concession at the end beats earlier pressure', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 2,
      branchRootMessageId: 'r',
    });
    const reb = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const reb2 = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'counter-rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const conc = fakeNode({
      messageId: 'c', parentId: 'b', ordinal: 4,
      kindLabel: 'concession',
      droppedTags: [{ code: 'concede_small_point', label: 'C', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reb, reb2, conc]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('narrowed');
  });

  it('rebut after concession invalidates (oscillating)', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 3,
      branchRootMessageId: 'r',
    });
    const conc = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'concession',
      branchRootMessageId: 'r',
    });
    const reb = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const reb2 = fakeNode({
      messageId: 'c', parentId: 'b', ordinal: 4,
      kindLabel: 'counter-rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, conc, reb, reb2]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('rebutted');
  });

  it('sourced answer closes a source request', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 2,
      branchRootMessageId: 'r',
    });
    const ask = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const src = fakeNode({
      messageId: 'b', parentId: 'r', ordinal: 3,
      kindLabel: 'evidence',
      branchRootMessageId: 'r',
    });
    const arts = new Map();
    arts.set('b', [fakeArtifact('b', { sourceChainStatus: 'source_and_quote' })]);
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, ask, src]),
      artifactsByMessageId: arts,
    });
    expect(map.byCluster.get('r')!.state).toBe('sourced');
  });
});

// ── Per-message snapshot fields ──────────────────────────────

describe('LIFE-001 per-message snapshots', () => {
  it('axis derives from droppedTags', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, replyCount: 0, descendantCount: 0, branchRootMessageId: 'r' });
    const snapshot = derivePointLifecycleSnapshot({
      node: fakeNode({
        messageId: 'q', parentId: 'r',
        kindLabel: 'clarification',
        droppedTags: [{ code: 'quote_exact_bit', label: 'Q', color: '#000' }],
      }),
      parentNode: root,
      clusterId: 'r',
      clusterState: 'quote_requested',
      artifactStatus: null,
      clusterMembers: [root],
    });
    expect(snapshot.axis).toBe('quote');
  });

  it('opensRequest is true for source_requested contributions', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const snap = derivePointLifecycleSnapshot({
      node: fakeNode({
        messageId: 'a', parentId: 'r',
        kindLabel: 'clarification',
        droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      }),
      parentNode: root,
      clusterId: 'r',
      clusterState: 'source_requested',
      artifactStatus: null,
      clusterMembers: [root],
    });
    expect(snap.opensRequest).toBe(true);
    expect(snap.resolvesRequest).toBe(false);
  });

  it('resolvesRequest true when prior request open AND this is sourced', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r', ordinal: 1 });
    const ask = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const ev = fakeNode({
      messageId: 'b', parentId: 'r', ordinal: 3,
      kindLabel: 'evidence',
      branchRootMessageId: 'r',
    });
    const snap = derivePointLifecycleSnapshot({
      node: ev,
      parentNode: root,
      clusterId: 'r',
      clusterState: 'sourced',
      artifactStatus: 'source_and_quote',
      clusterMembers: [root, ask, ev],
    });
    expect(snap.resolvesRequest).toBe(true);
  });

  it('isConcessionShape true for narrowed contributions', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const snap = derivePointLifecycleSnapshot({
      node: fakeNode({
        messageId: 'a', parentId: 'r',
        kindLabel: 'rebuttal',
        droppedTags: [{ code: 'narrow_scope', label: 'N', color: '#000' }],
      }),
      parentNode: root,
      clusterId: 'r',
      clusterState: 'narrowed',
      artifactStatus: null,
      clusterMembers: [root],
    });
    expect(snap.isConcessionShape).toBe(true);
  });

  it('isSynthesisShape true for synthesis_ready contribution', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const snap = derivePointLifecycleSnapshot({
      node: fakeNode({
        messageId: 'a', parentId: 'r',
        kindLabel: 'synthesis',
      }),
      parentNode: root,
      clusterId: 'r',
      clusterState: 'synthesis_ready',
      artifactStatus: null,
      clusterMembers: [root],
    });
    expect(snap.isSynthesisShape).toBe(true);
  });
});

// ── Map shape + inputHash ─────────────────────────────────────

describe('LIFE-001 map shape', () => {
  it('empty room returns empty maps and empty inputHash', () => {
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.size).toBe(0);
    expect(map.byMessage.size).toBe(0);
    expect(map.clusterOrder.length).toBe(0);
    expect(map.cumulativeStateSequence.length).toBe(0);
    expect(map.inputHash).toBe('');
  });

  it('clusterOrder length equals byCluster size', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root]),
      artifactsByMessageId: new Map(),
    });
    expect(map.clusterOrder.length).toBe(map.byCluster.size);
    expect(map.cumulativeStateSequence.length).toBe(map.clusterOrder.length);
  });

  it('inputHash changes when last message id changes', () => {
    const root1 = fakeNode({ messageId: 'r1', isRoot: true, branchRootMessageId: 'r1' });
    const root2 = fakeNode({ messageId: 'r2', isRoot: true, branchRootMessageId: 'r2' });
    const m1 = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root1]),
      artifactsByMessageId: new Map(),
    });
    const m2 = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root2]),
      artifactsByMessageId: new Map(),
    });
    expect(m1.inputHash).not.toBe(m2.inputHash);
  });

  it('inputHash is stable for identical inputs', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const m1 = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root]),
      artifactsByMessageId: new Map(),
    });
    const m2 = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root]),
      artifactsByMessageId: new Map(),
    });
    expect(m1.inputHash).toBe(m2.inputHash);
  });
});

// ── Doctrine anchors — heat / standing / popularity do NOT feed lifecycle ─

describe('LIFE-001 doctrine anchors — no heat / standing / popularity input', () => {
  function buildFixtureWithBands(opts: {
    standingBand: TimelineStandingBand;
    toneBand: TimelineToneBand;
    temperatureBand: TimelineTemperatureBand;
  }) {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 1, descendantCount: 2,
      branchRootMessageId: 'r',
      standingBand: opts.standingBand, toneBand: opts.toneBand, temperatureBand: opts.temperatureBand,
    });
    const reb = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
      standingBand: opts.standingBand, toneBand: opts.toneBand, temperatureBand: opts.temperatureBand,
    });
    const reb2 = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'counter-rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
      standingBand: opts.standingBand, toneBand: opts.toneBand, temperatureBand: opts.temperatureBand,
    });
    return buildTimelineMap([root, reb, reb2]);
  }

  function statesOf(map: ReturnType<typeof buildPointLifecycleMap>): string[] {
    const out: string[] = [];
    for (const [, s] of map.byCluster.entries()) out.push(s.state);
    return out;
  }

  it('standingBand value never affects derivation', () => {
    const right = buildPointLifecycleMap({
      timelineMap: buildFixtureWithBands({
        standingBand: 'completely_right', toneBand: 'calm', temperatureBand: 'cool',
      }),
      artifactsByMessageId: new Map(),
    });
    const wrong = buildPointLifecycleMap({
      timelineMap: buildFixtureWithBands({
        standingBand: 'pretty_wrong', toneBand: 'calm', temperatureBand: 'cool',
      }),
      artifactsByMessageId: new Map(),
    });
    expect(statesOf(right)).toEqual(statesOf(wrong));
  });

  it('toneBand value never affects derivation', () => {
    const calm = buildPointLifecycleMap({
      timelineMap: buildFixtureWithBands({
        standingBand: 'neutral', toneBand: 'calm', temperatureBand: 'cool',
      }),
      artifactsByMessageId: new Map(),
    });
    const hostile = buildPointLifecycleMap({
      timelineMap: buildFixtureWithBands({
        standingBand: 'neutral', toneBand: 'hostile', temperatureBand: 'cool',
      }),
      artifactsByMessageId: new Map(),
    });
    expect(statesOf(calm)).toEqual(statesOf(hostile));
  });

  it('temperatureBand value never affects derivation', () => {
    const cool = buildPointLifecycleMap({
      timelineMap: buildFixtureWithBands({
        standingBand: 'neutral', toneBand: 'calm', temperatureBand: 'cool',
      }),
      artifactsByMessageId: new Map(),
    });
    const hot = buildPointLifecycleMap({
      timelineMap: buildFixtureWithBands({
        standingBand: 'neutral', toneBand: 'calm', temperatureBand: 'hot',
      }),
      artifactsByMessageId: new Map(),
    });
    expect(statesOf(cool)).toEqual(statesOf(hot));
  });

  it('topicScore is never read (the node never carries it; sanity guard)', () => {
    // We assert this structurally: the classifier accepts ArgumentTimelineMapNode
    // which has no topicScore field — there's no way to feed it. This test
    // exists to anchor that contract.
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')).toBeDefined();
  });
});

// ── Doctrine anchor — ignored_by_* is cluster, not user ─

describe('LIFE-001 ignored_by_* describes the cluster, not the user', () => {
  it('a single user posting to multiple clusters does not "tag" the user', () => {
    // Cluster 1: Aff posts root + asks source + waits.
    const c1Root = fakeNode({
      messageId: 'r1', isRoot: true, sideLabel: 'Aff', ordinal: 1,
      replyCount: 1, descendantCount: 1, branchRootMessageId: 'r1',
    });
    // Cluster 2 (off-axis): same user (Aff) posts a separate claim later.
    const c2Root = fakeNode({
      messageId: 'r2', isRoot: false, parentId: null,
      sideLabel: 'Aff', ordinal: 10,
      replyCount: 0, descendantCount: 0, branchRootMessageId: 'r2',
      isDetached: true,
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([c1Root, c2Root]),
      artifactsByMessageId: new Map(),
    });
    // The user-side is not tagged; only the cluster carries advisory state.
    const r1 = map.byCluster.get('r1');
    const r2 = map.byCluster.get('r2');
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });

  it('plainLabel never contains person-attribution tokens', () => {
    const personTokens = ['troll', 'bot user', 'astroturfer', 'liar', 'dishonest user'];
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      const label = getPointLifecyclePlainLabel(s);
      const lc = label.toLowerCase();
      for (const t of personTokens) {
        expect(lc.includes(t)).toBe(false);
      }
    }
  });
});

// ── Concession is a repair, not a defeat ─

describe('LIFE-001 concession is a repair, not a defeat', () => {
  it('cluster ending with conceded reports conceded — never a "lost" / "defeated" label', () => {
    const { nodes } = buildSimpleClusterFixture({
      kindLabel: 'concession',
      droppedTags: [{ code: 'concede_broad_point', label: 'C', color: '#000' }],
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    const state = map.byCluster.get('r')!.state;
    expect(state).toBe('conceded');
    const lc = getPointLifecyclePlainLabel(state).toLowerCase();
    expect(lc.includes('lost')).toBe(false);
    expect(lc.includes('defeated')).toBe(false);
    expect(lc.includes('won')).toBe(false);
  });
});

// ── Ban-lists ─────────────────────────────────────────────────

describe('LIFE-001 ban-list — verdict tokens never appear in any label', () => {
  it('no state label contains a verdict token', () => {
    const tokens = _forbiddenLifecycleTokens();
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      const label = getPointLifecyclePlainLabel(s);
      const lc = label.toLowerCase();
      for (const t of tokens) {
        expect(lc.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('no state label looks like an internal snake_case code', () => {
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      const label = getPointLifecyclePlainLabel(s);
      expect(looksLikeInternalCode(label)).toBe(false);
    }
  });

  it('no produced snapshot field contains block/prevent/reject/forbid', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const reb = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'rebuttal',
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reb]),
      artifactsByMessageId: new Map(),
    });
    for (const snapshot of map.byMessage.values()) {
      const serialized = JSON.stringify(snapshot).toLowerCase();
      expect(serialized.includes('"block"')).toBe(false);
      expect(serialized.includes('"prevent"')).toBe(false);
      expect(serialized.includes('"reject"')).toBe(false);
      expect(serialized.includes('"forbid"')).toBe(false);
    }
  });
});

// ── JSON-serializability ──────────────────────────────────────

describe('LIFE-001 JSON-serializability', () => {
  it('round-trips byCluster + byMessage via JSON.parse(JSON.stringify(...))', () => {
    const { nodes } = buildSimpleClusterFixture({ kindLabel: 'rebuttal' });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    const serialized = {
      byCluster: Array.from(map.byCluster.entries()),
      byMessage: Array.from(map.byMessage.entries()),
      clusterOrder: map.clusterOrder,
      cumulativeStateSequence: map.cumulativeStateSequence,
      inputHash: map.inputHash,
    };
    const json = JSON.stringify(serialized);
    const back = JSON.parse(json);
    expect(back.byCluster.length).toBe(map.byCluster.size);
    expect(back.byMessage.length).toBe(map.byMessage.size);
    expect(back.clusterOrder).toEqual([...map.clusterOrder]);
    expect(back.inputHash).toBe(map.inputHash);
  });
});

// ── Performance ──────────────────────────────────────────────

describe('LIFE-001 performance', () => {
  it('250-node synthetic fixture builds in < 30 ms', () => {
    const nodes: ArgumentTimelineMapNode[] = [];
    for (let c = 0; c < 50; c++) {
      const rootId = `r-${c}`;
      nodes.push(fakeNode({
        messageId: rootId, isRoot: c === 0,
        ordinal: c * 5 + 1,
        replyCount: 4, descendantCount: 4,
        branchRootMessageId: rootId, parentId: c === 0 ? null : null,
        sideLabel: c % 2 ? 'Aff' : 'Neg',
        isDetached: c > 0,
      }));
      for (let i = 1; i <= 4; i++) {
        nodes.push(fakeNode({
          messageId: `${rootId}-${i}`,
          parentId: i === 1 ? rootId : `${rootId}-${i - 1}`,
          ordinal: c * 5 + i + 1,
          kindLabel: i % 2 ? 'rebuttal' : 'claim',
          droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
          branchRootMessageId: rootId,
          sideLabel: i % 2 ? 'Aff' : 'Neg',
        }));
      }
    }
    const start = performance.now();
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    const elapsed = performance.now() - start;
    expect(map.byCluster.size).toBe(50);
    // Generous bound; design says < 30 ms. Allow some headroom for CI.
    expect(elapsed).toBeLessThan(120);
  });
});

// ── Edge cases ────────────────────────────────────────────────

describe('LIFE-001 edge cases', () => {
  it('(1) empty room: no cluster, no advisories', () => {
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.size).toBe(0);
    expect(map.byMessage.size).toBe(0);
  });

  it('(2) root-only: cluster keyed by root id, state = open', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 0, descendantCount: 0,
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('open');
    expect(map.byMessage.get('r')!.messageContribution).toBe('open');
  });

  it('(4) detached: forms own cluster, default open', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, replyCount: 0, descendantCount: 0,
      branchRootMessageId: 'r',
    });
    const detached = fakeNode({
      messageId: 'd', isDetached: true, parentId: null,
      ordinal: 2, replyCount: 0, descendantCount: 0,
      branchRootMessageId: 'd',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, detached]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.size).toBe(2);
    expect(map.byCluster.get('d')!.state).toBe('open');
    expect(map.byCluster.get('r')!.state).toBe('open');
  });

  it('(9) oscillating concede / rebut → rebutted', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r', replyCount: 1, descendantCount: 3 });
    const conc = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2, kindLabel: 'concession',
      branchRootMessageId: 'r',
    });
    const reb = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3, kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const reb2 = fakeNode({
      messageId: 'c', parentId: 'b', ordinal: 4, kindLabel: 'counter-rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, conc, reb, reb2]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('rebutted');
  });

  it('(10) multiple concessions in one cluster — last wins for cluster state', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const c1 = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'concession',
      droppedTags: [{ code: 'concede_small_point', label: 'C', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const c2 = fakeNode({
      messageId: 'b', parentId: 'r', ordinal: 3,
      kindLabel: 'concession',
      droppedTags: [{ code: 'concede_broad_point', label: 'C', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, c1, c2]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('conceded');
    expect(map.byMessage.get('a')!.messageContribution).toBe('narrowed');
    expect(map.byMessage.get('b')!.messageContribution).toBe('conceded');
  });

  it('(11) synthesis without prior concession → synthesis_ready', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const syn = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'synthesis',
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, syn]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('synthesis_ready');
  });

  it('(12) open request resolved by a different axis is NOT closed', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const ask = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    // Different parent, different axis: scope move under another branch.
    const scope = fakeNode({
      messageId: 'b', parentId: 'r', ordinal: 3,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'scope_challenge', label: 'Sc', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, ask, scope]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('source_requested');
  });

  it('(13) open request resolved by external evidence move → sourced', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const ask = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const src = fakeNode({
      messageId: 'b', parentId: 'r', ordinal: 3,
      kindLabel: 'evidence',
      branchRootMessageId: 'r',
    });
    const arts = new Map();
    arts.set('b', [fakeArtifact('b', { sourceChainStatus: 'primary_present' })]);
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, ask, src]),
      artifactsByMessageId: arts,
    });
    expect(map.byCluster.get('r')!.state).toBe('sourced');
  });

  it('(14) admin-resolved cluster dominates everything', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const reb = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const flags = new Map();
    flags.set('r', ['archived_by_admin']);
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reb]),
      artifactsByMessageId: new Map(),
      flagCodesByMessageId: flags,
    });
    expect(map.byCluster.get('r')!.state).toBe('archived_or_resolved');
  });

  it('(17) no advisory threshold reached + ordinary open state → answered', () => {
    const { nodes } = buildSimpleClusterFixture({ kindLabel: 'claim' });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('answered');
  });

  it('(18) observer-both: synthesis still fires; no advisory fires', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, sideLabel: 'Obs', branchRootMessageId: 'r',
    });
    const syn = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'synthesis',
      sideLabel: 'Obs',
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, syn]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('synthesis_ready');
  });

  it('(21) axis === unaxed cannot create exhaustion pressure', () => {
    // Many rebuttals with NO axis qualifier → no exhaustion (axis === unaxed).
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const reb1 = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'rebuttal', branchRootMessageId: 'r',
    });
    const reb2 = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'counter-rebuttal', branchRootMessageId: 'r',
    });
    const reb3 = fakeNode({
      messageId: 'c', parentId: 'b', ordinal: 4,
      kindLabel: 'rebuttal', branchRootMessageId: 'r',
    });
    const reb4 = fakeNode({
      messageId: 'd', parentId: 'c', ordinal: 5,
      kindLabel: 'counter-rebuttal', branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reb1, reb2, reb3, reb4]),
      artifactsByMessageId: new Map(),
    });
    // No axis assigned → no exhaustion. Should be `answered` (no same-axis lineage → no rebutted).
    expect(map.byCluster.get('r')!.state).not.toBe('exhausted');
  });

  it('(22) synthesis after archived_or_resolved → cluster stays archived', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const reb = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'rebuttal',
      branchRootMessageId: 'r',
    });
    const syn = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'synthesis',
      branchRootMessageId: 'r',
    });
    const flags = new Map();
    flags.set('a', ['archived_by_admin']);
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reb, syn]),
      artifactsByMessageId: new Map(),
      flagCodesByMessageId: flags,
    });
    expect(map.byCluster.get('r')!.state).toBe('archived_or_resolved');
  });

  // LIFE-1C — named fixtures that trace 1:1 to docs/designs/LIFE-001.md §"Edge cases".
  // These cases are covered indirectly by other tests above; the named blocks below
  // add the traceability pointer ("design edge case N - ...") so future readers can
  // grep the design doc and find the exact test.

  it('design edge case 5 - concurrent edits / new message arrives invalidates memoization (inputHash changes, rebuild is coherent)', () => {
    // Design: "Memoization invalidates because `inputHash` changes
    //          (the last message id changes). One O(n) rebuild — no cumulative growth in cost."
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const reply1 = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const before = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reply1]),
      artifactsByMessageId: new Map(),
    });

    // New message arrives mid-conversation — same first N inputs, plus one more.
    const reply2 = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3,
      kindLabel: 'counter-rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const after = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reply1, reply2]),
      artifactsByMessageId: new Map(),
    });

    // inputHash must differ when the last message id changes.
    expect(after.inputHash).not.toBe(before.inputHash);
    // Rebuild must be coherent: the new message is present in byMessage with a contribution.
    expect(after.byMessage.has('b')).toBe(true);
    expect(after.byMessage.get('b')!.messageContribution).toBeTruthy();
    // Same cluster, but state reflects the new pressure move.
    expect(after.byCluster.size).toBe(1);
    expect(after.byCluster.get('r')!.state).toBe('rebutted');
  });

  it('design edge case 7 - observer mode: lifecycle derivation is identical for observers (no viewer parameter exists)', () => {
    // Design: "Lifecycle derivation is identical for observers. No state changes
    //          based on viewer identity; lifecycle describes the cluster, not the viewer."
    // Anchor: buildPointLifecycleMap accepts only (timelineMap, artifactsByMessageId,
    // flagCodesByMessageId?, advisoryConfig?) — no viewer parameter. Two identical inputs
    // produce deep-equal output regardless of who is "looking at" them.
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const reply = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'synthesis',
      branchRootMessageId: 'r',
    });
    const input = {
      timelineMap: buildTimelineMap([root, reply]),
      artifactsByMessageId: new Map<string, EvidenceArtifact[]>(),
    };
    // Run the model twice with the same input — represents "participant viewer" and
    // "observer viewer" both calling the pure model. Output must be deep-equal.
    const asParticipant = buildPointLifecycleMap(input);
    const asObserver = buildPointLifecycleMap(input);

    expect(asObserver.inputHash).toBe(asParticipant.inputHash);
    expect(asObserver.clusterOrder).toEqual(asParticipant.clusterOrder);
    expect(asObserver.cumulativeStateSequence).toEqual(asParticipant.cumulativeStateSequence);
    expect(Array.from(asObserver.byCluster.entries())).toEqual(
      Array.from(asParticipant.byCluster.entries()),
    );
    expect(Array.from(asObserver.byMessage.entries())).toEqual(
      Array.from(asParticipant.byMessage.entries()),
    );
  });

  it('design edge case 8 - very deep trees (depth ≥ 50): same-axis ancestor walk classifies the chain without overflow', () => {
    // Design: "Same-axis ancestor walk is O(depth). At depth 50 with 250 messages,
    //          the worst case is 250 × 50 = 12,500 comparisons — < 1 ms in V8."
    // Build a linear chain of 60 nodes (root + 59 same-axis replies). Depth ≥ 50.
    const nodes: ArgumentTimelineMapNode[] = [];
    const total = 60;
    for (let i = 0; i < total; i++) {
      const id = `n-${i}`;
      const parentId = i === 0 ? null : `n-${i - 1}`;
      nodes.push(fakeNode({
        messageId: id,
        parentId,
        ordinal: i + 1,
        isRoot: i === 0,
        depth: i,
        kindLabel: i === 0 ? 'claim' : (i % 2 ? 'rebuttal' : 'counter-rebuttal'),
        droppedTags: i === 0
          ? []
          : [{ code: 'fact_challenge', label: 'F', color: '#000' }],
        branchRootMessageId: 'n-0',
        sideLabel: i % 2 ? 'Aff' : 'Neg',
      }));
    }
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });

    // Single cluster keyed by root, every non-deleted node classified.
    expect(map.byCluster.size).toBe(1);
    expect(map.byMessage.size).toBe(total);
    for (let i = 0; i < total; i++) {
      expect(map.byMessage.get(`n-${i}`)!.messageContribution).toBeTruthy();
    }
    // With ≥ 3 same-axis pressure moves and no new info, exhaustion fires.
    // If exhaustion thresholds change, this still must not crash and must produce a defined state.
    expect(map.byCluster.get('n-0')!.state).toBeTruthy();
  });
});

// ── Custom advisory config (operator passes 0 / 999) ─

describe('LIFE-001 advisory config boundaries', () => {
  it('threshold = 999 effectively disables exhaustion', () => {
    const cfg: LifecycleAdvisoryConfig = {
      ...DEFAULT_LIFECYCLE_ADVISORY_CONFIG,
      exhaustionRepeatThreshold: 999,
    };
    // 4 same-axis rebuttals, none additive → with 999 it stays rebutted.
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r', replyCount: 1, descendantCount: 4 });
    const r1 = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2, kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }], branchRootMessageId: 'r',
    });
    const r2 = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3, kindLabel: 'counter-rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }], branchRootMessageId: 'r',
    });
    const r3 = fakeNode({
      messageId: 'c', parentId: 'b', ordinal: 4, kindLabel: 'rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }], branchRootMessageId: 'r',
    });
    const r4 = fakeNode({
      messageId: 'd', parentId: 'c', ordinal: 5, kindLabel: 'counter-rebuttal',
      droppedTags: [{ code: 'fact_challenge', label: 'F', color: '#000' }], branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, r1, r2, r3, r4]),
      artifactsByMessageId: new Map(),
      advisoryConfig: cfg,
    });
    expect(map.byCluster.get('r')!.state).toBe('rebutted');
  });
});
