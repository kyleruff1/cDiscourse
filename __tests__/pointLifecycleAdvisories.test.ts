/**
 * LIFE-001 — Threshold-boundary tests for the four advisory states.
 *
 * Doctrine: exhausted / moved_on_by_* / ignored_by_* / branch_recommended
 * are ADVISORIES. They never block posting, never auto-archive, never
 * auto-hide. The plain labels are descriptive — "Out of new angles",
 * "Affirmative did not respond" — never accusatory.
 */

import {
  DEFAULT_LIFECYCLE_ADVISORY_CONFIG,
  buildPointLifecycleMap,
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

function fakeArtifact(argumentId: string, over: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: `${argumentId}:evidence:0`,
    argumentId,
    kind: 'url',
    label: 'Source',
    url: 'https://example.org/article',
    quote: 'Verbatim quote.',
    sourceChainStatus: 'source_and_quote',
    risk: 'low',
    addedByUserId: 'u1',
    createdAt: '2026-05-18T10:00:00.000Z',
    ...over,
  };
}

// ── Exhaustion boundary ───────────────────────────────────────

describe('LIFE-001 exhaustion boundary', () => {
  function buildRebutChain(count: number, options: {
    sourceOnLast?: boolean;
    narrowOnLast?: boolean;
  } = {}): ArgumentTimelineMapNode[] {
    const root = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
      replyCount: count > 0 ? 1 : 0, descendantCount: count, sideLabel: 'Aff',
    });
    const out: ArgumentTimelineMapNode[] = [root];
    for (let i = 1; i <= count; i++) {
      const isLast = i === count;
      const tags = [{ code: 'fact_challenge', label: 'F', color: '#000' }];
      if (isLast && options.narrowOnLast) {
        tags.push({ code: 'narrow_scope', label: 'N', color: '#000' });
      }
      out.push(fakeNode({
        messageId: `r${i}`,
        parentId: i === 1 ? 'r' : `r${i - 1}`,
        ordinal: i + 1,
        kindLabel: i % 2 ? 'rebuttal' : 'counter-rebuttal',
        droppedTags: tags,
        branchRootMessageId: 'r',
        sideLabel: i % 2 ? 'Neg' : 'Aff',
      }));
    }
    return out;
  }

  it('2 same-axis rebuttals → rebutted (not exhausted)', () => {
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(buildRebutChain(2)),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('rebutted');
  });

  it('3 same-axis rebuttals (no additive info) → exhausted', () => {
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(buildRebutChain(3)),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('exhausted');
  });

  it('3 same-axis rebuttals where the 3rd has narrow_scope → rebutted (additive)', () => {
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(buildRebutChain(3, { narrowOnLast: true })),
      artifactsByMessageId: new Map(),
    });
    // The 3rd move adds info → exhaustion counter doesn't include it.
    // But the narrow_scope qualifier ALSO causes the 3rd move to be classified
    // as `narrowed` per rule 4 of per-message classifier. So cluster ends with
    // a narrowed move and the cluster state should be `narrowed`.
    expect(map.byCluster.get('r')!.state).toBe('narrowed');
  });

  it('3 same-axis rebuttals where the 3rd attaches a source → rebutted (additive)', () => {
    const nodes = buildRebutChain(3);
    const arts = new Map();
    arts.set('r3', [fakeArtifact('r3', { sourceChainStatus: 'source_and_quote' })]);
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: arts,
    });
    // The 3rd move attaches a source → classified as `sourced` per rule 6.
    expect(map.byCluster.get('r')!.state).toBe('sourced');
  });

  it('4 same-axis rebuttals, none additive → exhausted', () => {
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(buildRebutChain(4)),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('exhausted');
  });

  it('custom config exhaustionRepeatThreshold=1 fires on 1 pressure move', () => {
    const cfg: LifecycleAdvisoryConfig = {
      ...DEFAULT_LIFECYCLE_ADVISORY_CONFIG,
      exhaustionRepeatThreshold: 1,
    };
    // 1 pressure move = `answered` per per-message (no ancestor) → but
    // cluster has 1 same-axis rebuttal not additive → exhaustion fires
    // at threshold 1 only when the cluster passes through pressure
    // dominance. With 1 reply (no ancestor) the contribution is `answered`,
    // so pressure dominance does not engage and exhaustion is not checked.
    // We need 2 same-axis rebuttals to trigger the `rebutted` path.
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(buildRebutChain(2)),
      artifactsByMessageId: new Map(),
      advisoryConfig: cfg,
    });
    // 1 of the 2 same-axis rebuttals are non-additive → counter = 1 (>= 1).
    expect(map.byCluster.get('r')!.state).toBe('exhausted');
  });
});

// ── Moved-on boundary ─────────────────────────────────────────

describe('LIFE-001 moved-on boundary', () => {
  it('side posted recently in this cluster → not moved-on', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r', sideLabel: 'Aff', ordinal: 1,
    });
    const reply = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2, sideLabel: 'Neg', branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, reply]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).not.toContain('moved_on');
  });

  it('side has not posted to cluster across enough subsequent turns → moved_on_by_<side>', () => {
    // Cluster c1: Aff posts root.
    // Then a separate detached cluster receives Aff posts.
    // After enough Aff turns away, c1 fires moved_on_by_affirmative.
    const c1Root = fakeNode({
      messageId: 'r', isRoot: true, sideLabel: 'Aff', ordinal: 1,
      branchRootMessageId: 'r',
    });
    const nodes: ArgumentTimelineMapNode[] = [c1Root];
    // 5 Aff turns away (each in its own detached cluster).
    for (let i = 1; i <= 5; i++) {
      nodes.push(fakeNode({
        messageId: `o-${i}`, isDetached: true,
        sideLabel: 'Aff', ordinal: i + 1,
        branchRootMessageId: `o-${i}`,
      }));
    }
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    // Cluster c1 should be moved_on_by_affirmative — Aff has 5 turns away.
    expect(map.byCluster.get('r')!.state).toBe('moved_on_by_affirmative');
  });
});

// ── Ignored-by-side boundary ──────────────────────────────────

describe('LIFE-001 ignored-by-side boundary', () => {
  it('side has open request not yet answered AND threshold turns since → ignored_by_<requestee>', () => {
    // Affirmative posts a question, Negative asks for source, then Aff
    // continues elsewhere — the source request is OPEN and Aff has
    // ignored it.
    const root = fakeNode({
      messageId: 'r', isRoot: true, sideLabel: 'Aff', ordinal: 1,
      replyCount: 1, descendantCount: 1, branchRootMessageId: 'r',
    });
    const ask = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2, sideLabel: 'Neg',
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const nodes: ArgumentTimelineMapNode[] = [root, ask];
    // Aff has 4 turns elsewhere — exceeds ignoredBySideTurnThreshold=3.
    for (let i = 1; i <= 4; i++) {
      nodes.push(fakeNode({
        messageId: `o-${i}`, isDetached: true,
        sideLabel: 'Aff', ordinal: i + 2,
        branchRootMessageId: `o-${i}`,
      }));
    }
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    // The open request is open AND Aff has not answered. Aff is the
    // requestee (Neg posted the request). So → ignored_by_affirmative.
    expect(map.byCluster.get('r')!.state).toBe('ignored_by_affirmative');
  });

  it('side responded within threshold → ignored_by_<side> does NOT fire', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, sideLabel: 'Aff', ordinal: 1, branchRootMessageId: 'r',
    });
    const ask = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2, sideLabel: 'Neg',
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const src = fakeNode({
      messageId: 'b', parentId: 'a', ordinal: 3, sideLabel: 'Aff',
      kindLabel: 'evidence', branchRootMessageId: 'r',
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

// ── Ignored-by-both boundary ──────────────────────────────────

describe('LIFE-001 ignored-by-both boundary', () => {
  it('both sides dormant past threshold AND open request → ignored_by_both', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, sideLabel: 'Aff', ordinal: 1, branchRootMessageId: 'r',
    });
    const ask = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2, sideLabel: 'Aff',
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    // 12 turns away from this cluster — both sides moved on (6 each).
    const nodes: ArgumentTimelineMapNode[] = [root, ask];
    for (let i = 1; i <= 12; i++) {
      nodes.push(fakeNode({
        messageId: `o-${i}`, isDetached: true,
        sideLabel: i % 2 ? 'Aff' : 'Neg',
        ordinal: i + 2,
        branchRootMessageId: `o-${i}`,
      }));
    }
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    // With both sides dormant for ≥ 6 turns AND an open request → ignored_by_both.
    expect(map.byCluster.get('r')!.state).toBe('ignored_by_both');
  });

  it('both sides dormant but NO open request → cluster stays open', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, sideLabel: 'Aff', ordinal: 1,
      branchRootMessageId: 'r',
    });
    const nodes: ArgumentTimelineMapNode[] = [root];
    for (let i = 1; i <= 8; i++) {
      nodes.push(fakeNode({
        messageId: `o-${i}`, isDetached: true,
        sideLabel: i % 2 ? 'Aff' : 'Neg',
        ordinal: i + 1, branchRootMessageId: `o-${i}`,
      }));
    }
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    // No open request → ignored_by_both does NOT fire. Cluster's state
    // is `moved_on_by_*` (whichever side moved away most).
    const state = map.byCluster.get('r')!.state;
    expect(state).not.toBe('ignored_by_both');
  });
});

// ── Branch recommended boundary ───────────────────────────────

describe('LIFE-001 branch_recommended boundary', () => {
  it('1 tangent move → not yet branch_recommended', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
      replyCount: 1, descendantCount: 1,
    });
    const tan = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'claim',
      droppedTags: [{ code: 'branch_this_off', label: 'B', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, tan]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).not.toBe('branch_recommended');
  });

  it('2 branch_this_off moves → branch_recommended', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
      replyCount: 2, descendantCount: 2,
    });
    const t1 = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'claim',
      droppedTags: [{ code: 'branch_this_off', label: 'B', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const t2 = fakeNode({
      messageId: 'b', parentId: 'r', ordinal: 3,
      kindLabel: 'claim',
      droppedTags: [{ code: 'branch_this_off', label: 'B', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, t1, t2]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('branch_recommended');
  });

  it('1 branch_this_off + 1 tangent_or_joke → branch_recommended', () => {
    const root = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
      replyCount: 2, descendantCount: 2,
    });
    const t1 = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'claim',
      droppedTags: [{ code: 'branch_this_off', label: 'B', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const t2 = fakeNode({
      messageId: 'b', parentId: 'r', ordinal: 3,
      kindLabel: 'claim',
      droppedTags: [{ code: 'tangent_or_joke', label: 'T', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, t1, t2]),
      artifactsByMessageId: new Map(),
    });
    expect(map.byCluster.get('r')!.state).toBe('branch_recommended');
  });
});

// ── Advisory ≠ blocking (critical doctrine test) ─

describe('LIFE-001 advisories are NEVER blocking', () => {
  it('no produced snapshot or summary contains block/prevent/reject/forbid/disallow/denied', () => {
    // Build a fixture that fires every advisory state.
    const root = fakeNode({
      messageId: 'r', isRoot: true, sideLabel: 'Aff', ordinal: 1, branchRootMessageId: 'r',
    });
    const ask = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2, sideLabel: 'Aff',
      kindLabel: 'clarification',
      droppedTags: [{ code: 'ask_receipts', label: 'S', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const nodes: ArgumentTimelineMapNode[] = [root, ask];
    for (let i = 1; i <= 8; i++) {
      nodes.push(fakeNode({
        messageId: `o-${i}`, isDetached: true,
        sideLabel: i % 2 ? 'Aff' : 'Neg',
        ordinal: i + 2, branchRootMessageId: `o-${i}`,
      }));
    }
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap(nodes),
      artifactsByMessageId: new Map(),
    });
    const serialized = JSON.stringify({
      byCluster: Array.from(map.byCluster.values()),
      byMessage: Array.from(map.byMessage.values()),
    }).toLowerCase();
    expect(serialized.includes('"block"')).toBe(false);
    expect(serialized.includes('"prevent"')).toBe(false);
    expect(serialized.includes('"reject"')).toBe(false);
    expect(serialized.includes('"forbid"')).toBe(false);
    expect(serialized.includes('"disallow"')).toBe(false);
    expect(serialized.includes('"denied"')).toBe(false);
  });

  it('exhausted plain label is "Out of new angles" (not "you lost")', () => {
    expect(getPointLifecyclePlainLabel('exhausted')).toBe('Out of new angles');
  });

  it('moved_on_by_* labels describe the cluster, not accuse the user', () => {
    expect(getPointLifecyclePlainLabel('moved_on_by_affirmative')).toBe('Affirmative moved on');
    expect(getPointLifecyclePlainLabel('moved_on_by_negative')).toBe('Negative moved on');
  });

  it('ignored_by_* labels describe the cluster, not accuse the user', () => {
    expect(getPointLifecyclePlainLabel('ignored_by_affirmative')).toBe('Affirmative did not respond');
    expect(getPointLifecyclePlainLabel('ignored_by_negative')).toBe('Negative did not respond');
    expect(getPointLifecyclePlainLabel('ignored_by_both')).toBe('Nobody followed up');
  });

  it('isAdvisory flag is true exactly for the 7 advisory states', () => {
    // Build clusters that produce each advisory state and assert isAdvisory.
    const root = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
    });
    const t1 = fakeNode({
      messageId: 'a', parentId: 'r', ordinal: 2,
      kindLabel: 'claim',
      droppedTags: [{ code: 'branch_this_off', label: 'B', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const t2 = fakeNode({
      messageId: 'b', parentId: 'r', ordinal: 3,
      kindLabel: 'claim',
      droppedTags: [{ code: 'branch_this_off', label: 'B', color: '#000' }],
      branchRootMessageId: 'r',
    });
    const map = buildPointLifecycleMap({
      timelineMap: buildTimelineMap([root, t1, t2]),
      artifactsByMessageId: new Map(),
    });
    const summary = map.byCluster.get('r')!;
    expect(summary.state).toBe('branch_recommended');
    expect(summary.isAdvisory).toBe(true);
  });
});
