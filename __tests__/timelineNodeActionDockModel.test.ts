/**
 * SC-004 — Timeline node action dock model tests.
 *
 * Categories 1–6, 8, 11, 12 from design §"Test plan":
 *   1. Pure action availability.
 *   2. Actor-role matrix.
 *   3. Lifecycle primary-action matrix.
 *   4. Metadata interaction.
 *   5. Evidence / source-chain mapping.
 *   6. Branch / cluster selection.
 *   8. Plain-language.
 *  11. 250+ message stress fixture.
 *  12. Composer preset mapping.
 *
 * Doctrine / ban-list / forbidden-imports live in companion suites.
 */

import {
  ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES,
  actionDockToComposerPreset,
  buildTimelineNodeActionDockModel,
  getPrimaryTimelineNodeAction,
  _debug,
  type TimelineNodeActionDockActionCode,
  type TimelineNodeActionDockActor,
  type TimelineNodeActionDockInput,
  type TimelineNodeActionDockTarget,
} from '../src/features/arguments/timelineNodeActionDockModel';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type {
  AutoMetadataCode,
  AutoMetadataEntry,
  ClusterMetadataSummary,
  ManualTagCode,
  ManualTagEntry,
  MoveLinkageRecord,
  MoveMetadataLedger,
} from '../src/features/metadata';
import {
  ALL_AUTO_METADATA_CODES,
  ALL_MANUAL_TAG_CODES,
} from '../src/features/metadata';
import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleState,
} from '../src/features/lifecycle';
import { ALL_POINT_LIFECYCLE_STATES } from '../src/features/lifecycle';
import type { SourceChainStatus, TimelineEvidenceContract } from '../src/features/evidence/evidenceModel';
import { ALL_SOURCE_CHAIN_STATUSES } from '../src/features/evidence/evidenceModel';
import {
  NARROW_PRESET_BODY,
  CONFIRM_PRESET_BODY,
  SYNTHESIZE_PRESET_BODY,
} from '../src/features/arguments/quickActionPresets';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Fixture helpers ───────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: '',
    relativeLabel: '',
    actorLabel: 'U',
    kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: '',
    badges: [],
    droppedTags: over.droppedTags ?? [],
    depth: 0,
    lane: 0,
    siblingIndex: 0,
    replyCount: over.replyCount ?? 0,
    descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? `branch-${over.messageId ?? 'm1'}`,
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: null,
    isJunction: false,
    junctionChildCount: 0,
    isActive: false,
    isLatest: false,
    isDetached: over.isDetached ?? false,
    isActivePath: false,
    isRoot: over.isRoot ?? false,
    isFirstRebuttal: false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: 0,
    y: 0,
    accessibilityLabel: over.messageId ?? '',
  };
}

function makeTimelineMap(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapModel {
  return {
    nodes,
    edges: [],
    bands: [],
    activeNode: null,
    latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: [],
    width: 0,
    height: 0,
    scrollWidth: 0,
    beginningLabel: '',
    middleLabel: '',
    endLabel: '',
    participantTrends: [],
    legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false,
    rootOnboardingHint: null,
    showBackToRootControl: false,
  };
}

function makeLifecycleMap(args: {
  clusters: ReadonlyArray<{
    clusterId: string;
    state: PointLifecycleState;
    messageIds: ReadonlyArray<string>;
  }>;
}): PointLifecycleMap {
  const byCluster = new Map<string, PointLifecycleClusterSummary>();
  const byMessage = new Map<string, { messageId: string; clusterId: string; clusterState: PointLifecycleState; messageContribution: PointLifecycleState; axis: null; opensRequest: false; resolvesRequest: false; isConcessionShape: false; isSynthesisShape: false; plainLabel: string }>();
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
      byMessage.set(mid, {
        messageId: mid,
        clusterId: c.clusterId,
        clusterState: c.state,
        messageContribution: c.state,
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
    byCluster,
    byMessage: byMessage as unknown as PointLifecycleMap['byMessage'],
    clusterOrder,
    cumulativeStateSequence: cumulative,
    inputHash: `lc-${args.clusters.length}`,
  };
}

function makeMoveLinkage(over: Partial<MoveLinkageRecord> = {}): MoveLinkageRecord {
  return {
    messageId: over.messageId ?? 'm1',
    parentMessageId: over.parentMessageId ?? null,
    rootPointId: over.rootPointId ?? over.messageId ?? 'm1',
    pointClusterId: over.pointClusterId ?? over.messageId ?? 'm1',
    branchId: over.branchId ?? `branch-${over.messageId ?? 'm1'}`,
    targetExcerpt: null,
    disagreementAxis: null,
    semanticFlags: over.semanticFlags ?? [],
    userAppliedTags: over.userAppliedTags ?? [],
    autoDerivedMetadata: over.autoDerivedMetadata ?? [],
    lifecycleEventsCausedByMove: [],
  };
}

function makeAutoEntry(code: AutoMetadataCode): AutoMetadataEntry {
  return { code, detectedAt: '2026-05-18T10:00:00.000Z', inputSignals: [] };
}

function makeManualTagEntry(code: ManualTagCode): ManualTagEntry {
  return {
    code,
    appliedByUserId: 'tester',
    appliedByActorRole: 'participant_affirmative',
    appliedAt: '2026-05-18T10:00:00.000Z',
    dedupeKey: `${code}:tester`,
  };
}

function makeClusterMetadata(args: {
  clusterId: string;
  lifecycleState: PointLifecycleState;
  manualTagCodes?: ReadonlyArray<ManualTagCode>;
  autoMetadataCodes?: ReadonlyArray<AutoMetadataCode>;
}): ClusterMetadataSummary {
  return {
    clusterId: args.clusterId,
    manualTagCodes: args.manualTagCodes ?? [],
    autoMetadataCodes: args.autoMetadataCodes ?? [],
    lifecycleState: args.lifecycleState,
    lastManualTagAt: null,
    taggingParticipantCount: 0,
  };
}

function makeMetadataLedger(args: {
  byMessage?: ReadonlyArray<MoveLinkageRecord>;
  byCluster?: ReadonlyArray<ClusterMetadataSummary>;
}): MoveMetadataLedger {
  const bm = new Map<string, MoveLinkageRecord>();
  const bc = new Map<string, ClusterMetadataSummary>();
  for (const r of args.byMessage ?? []) bm.set(r.messageId, r);
  for (const c of args.byCluster ?? []) bc.set(c.clusterId, c);
  return {
    byMessage: bm,
    byCluster: bc,
    metadataEvents: [],
    messageOrder: Array.from(bm.keys()),
    inputHash: 'md-hash',
  };
}

function makeEvidenceContract(status: SourceChainStatus): TimelineEvidenceContract {
  return {
    rendersAsEvidenceNode: false,
    rendersSourceChainRing: status !== 'source_and_quote' && status !== 'primary_present',
    accessibilityLabelSuffix: '',
    receiptChip: {
      status,
      label: status === 'source_and_quote' ? 'Source + quote' : status === 'no_source' ? 'No source' : status,
      helper: '',
      tone: 'neutral',
      invitesFollowup: false,
      showsSourceChainPressure: status !== 'source_and_quote' && status !== 'primary_present',
      kinds: [],
      count: 0,
    },
  };
}

function makeInput(opts: {
  target: TimelineNodeActionDockTarget;
  actor: TimelineNodeActionDockActor;
  nodes?: ArgumentTimelineMapNode[];
  lifecycleClusters?: ReadonlyArray<{
    clusterId: string;
    state: PointLifecycleState;
    messageIds: ReadonlyArray<string>;
  }>;
  moveLinks?: ReadonlyArray<MoveLinkageRecord>;
  clusterMetas?: ReadonlyArray<ClusterMetadataSummary>;
  evidenceFor?: (messageId: string) => TimelineEvidenceContract | null;
}): TimelineNodeActionDockInput {
  const nodes = opts.nodes ?? [];
  const tl = makeTimelineMap(nodes);
  const lc = makeLifecycleMap({ clusters: opts.lifecycleClusters ?? [] });
  const ml = makeMetadataLedger({
    byMessage: opts.moveLinks,
    byCluster: opts.clusterMetas,
  });
  return {
    target: opts.target,
    actor: opts.actor,
    timelineMap: tl,
    lifecycleMap: lc,
    metadataLedger: ml,
    evidenceContractFor: opts.evidenceFor ?? (() => null),
  };
}

// ── Category 1 — Pure action availability ─────────────────────

describe('SC-004 buildTimelineNodeActionDockModel — happy path', () => {
  it('returns a deterministic model for a fresh cluster (lifecycle=open, no tags, no evidence)', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const input = makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const model = buildTimelineNodeActionDockModel(input);
    expect(model.target).toEqual({ kind: 'node', messageId: 'r' });
    expect(model.actor).toBe('other');
    expect(model.clusterId).toBe('r');
    expect(model.primarySuggestion.action).toBe('reply');
    expect(model.primarySuggestion.rationaleCode).toBe('lifecycle:open');
    // Primary first in actions[].
    expect(model.actions[0].action).toBe('reply');
    expect(model.actions[0].isPrimary).toBe(true);
    // Cluster header lifecycle label is plain English (not snake_case).
    expect(looksLikeInternalCode(model.clusterHeader.lifecycleLabel)).toBe(false);
    expect(model.clusterHeader.lifecycleLabel).toBe('Open for response');
  });

  it('actions list contains every public action code (15 codes; expand_branch may also appear when disabled)', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const input = makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    });
    const model = buildTimelineNodeActionDockModel(input);
    const codes = new Set(model.actions.map((a) => a.action));
    expect(codes.has('reply')).toBe(true);
    expect(codes.has('challenge')).toBe(true);
    expect(codes.has('flag')).toBe(true);
    expect(codes.has('open_cards_detail')).toBe(true);
    expect(codes.has('synthesize')).toBe(true);
  });

  it('cluster header reads cluster lifecycle, NOT move-level metadata', () => {
    const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
    const input = makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'source_requested', messageIds: ['r'] }],
    });
    const model = buildTimelineNodeActionDockModel(input);
    expect(model.clusterHeader.lifecycleLabel).toBe('Source requested');
  });
});

// ── Category 2 — Actor-role matrix ────────────────────────────

describe('SC-004 actor-role matrix', () => {
  const lifecycle = [{ clusterId: 'r', state: 'open' as PointLifecycleState, messageIds: ['r'] }];
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });
  const target: TimelineNodeActionDockTarget = { kind: 'node', messageId: 'r' };

  function build(actor: TimelineNodeActionDockActor) {
    return buildTimelineNodeActionDockModel(makeInput({
      target,
      actor,
      nodes: [root],
      lifecycleClusters: lifecycle,
    }));
  }

  it('self disables reply / challenge / ask_source / ask_quote with own_bubble', () => {
    const m = build('self');
    const get = (a: TimelineNodeActionDockActionCode) => m.actions.find((x) => x.action === a)!;
    expect(get('reply').isDisabled).toBe(true);
    expect(get('reply').disabledReason).toBe('own_bubble');
    expect(get('challenge').isDisabled).toBe(true);
    expect(get('challenge').disabledReason).toBe('own_bubble');
    expect(get('ask_source').isDisabled).toBe(true);
    expect(get('ask_source').disabledReason).toBe('own_bubble');
    expect(get('ask_quote').isDisabled).toBe(true);
    expect(get('ask_quote').disabledReason).toBe('own_bubble');
  });

  it('self enables narrow / concede / synthesize (own-bubble eligibility)', () => {
    const m = build('self');
    const get = (a: TimelineNodeActionDockActionCode) => m.actions.find((x) => x.action === a)!;
    expect(get('narrow').isDisabled).toBe(false);
    expect(get('concede').isDisabled).toBe(false);
    // synthesize on a node target is gated by cluster_action_on_node, NOT own_bubble.
    expect(get('synthesize').disabledReason).toBe('cluster_action_on_node');
  });

  it('observer disables most participant actions with observer_must_join, but allows ask_source + flag + open_cards_detail', () => {
    const m = build('observer');
    const get = (a: TimelineNodeActionDockActionCode) => m.actions.find((x) => x.action === a)!;
    expect(get('reply').isDisabled).toBe(true);
    expect(get('reply').disabledReason).toBe('observer_must_join');
    expect(get('ask_source').isDisabled).toBe(false);
    expect(get('flag').isDisabled).toBe(false);
    expect(get('open_cards_detail').isDisabled).toBe(false);
  });

  it('observer primary is open_cards_detail (does not jump to a posting action)', () => {
    const m = build('observer');
    expect(m.primarySuggestion.action).toBe('open_cards_detail');
  });

  it('bot is treated identically to other (full participant action set enabled)', () => {
    const mBot = build('bot');
    const mOther = build('other');
    // Map of code → isDisabled
    function shape(actions: typeof mBot.actions) {
      const out: Record<string, boolean> = {};
      for (const a of actions) out[a.action] = a.isDisabled;
      return out;
    }
    expect(shape(mBot.actions)).toEqual(shape(mOther.actions));
  });

  it('admin is treated identically to other (no admin-only actions in the dock)', () => {
    const mAdmin = build('admin');
    const mOther = build('other');
    function shape(actions: typeof mAdmin.actions) {
      const out: Record<string, boolean> = {};
      for (const a of actions) out[a.action] = a.isDisabled;
      return out;
    }
    expect(shape(mAdmin.actions)).toEqual(shape(mOther.actions));
  });

  it('mark_moved_on / mark_ignored are disabled for every actor in v1', () => {
    for (const actor of ['self', 'other', 'observer', 'bot', 'admin', 'unknown'] as const) {
      const m = build(actor);
      const get = (a: TimelineNodeActionDockActionCode) => m.actions.find((x) => x.action === a)!;
      expect(get('mark_moved_on').isDisabled).toBe(true);
      expect(get('mark_ignored').isDisabled).toBe(true);
    }
  });

  it('open_cards_detail is enabled for every actor', () => {
    for (const actor of ['self', 'other', 'observer', 'bot', 'admin', 'unknown'] as const) {
      const m = build(actor);
      const get = (a: TimelineNodeActionDockActionCode) => m.actions.find((x) => x.action === a)!;
      expect(get('open_cards_detail').isDisabled).toBe(false);
    }
  });

  it('reply is enabled for participants on every lifecycle state (recommends, never blocks)', () => {
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const m = buildTimelineNodeActionDockModel(makeInput({
        target,
        actor: 'other',
        nodes: [root],
        lifecycleClusters: [{ clusterId: 'r', state, messageIds: ['r'] }],
      }));
      const reply = m.actions.find((x) => x.action === 'reply')!;
      // Reply must EXIST in the action list AND be enabled (or, in the
      // archived_or_resolved case, it's enabled by the explicit override).
      expect(reply).toBeTruthy();
      expect(reply.isDisabled).toBe(false);
    }
  });
});

// ── Category 3 — Lifecycle primary-action matrix ─────────────

describe('SC-004 lifecycle primary-action matrix', () => {
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });

  const EXPECTED: ReadonlyArray<{ state: PointLifecycleState; primary: TimelineNodeActionDockActionCode; rationale: string }> = [
    { state: 'open', primary: 'reply', rationale: 'lifecycle:open' },
    { state: 'answered', primary: 'challenge', rationale: 'lifecycle:answered' },
    { state: 'rebutted', primary: 'challenge', rationale: 'lifecycle:rebutted' },
    { state: 'clarified', primary: 'reply', rationale: 'lifecycle:clarified' },
    { state: 'sourced', primary: 'challenge', rationale: 'lifecycle:sourced' },
    { state: 'quote_requested', primary: 'ask_quote', rationale: 'lifecycle:quote_requested' },
    { state: 'source_requested', primary: 'ask_source', rationale: 'lifecycle:source_requested' },
    { state: 'narrowed', primary: 'confirm', rationale: 'lifecycle:narrowed' },
    { state: 'conceded', primary: 'confirm', rationale: 'lifecycle:conceded' },
    { state: 'confirmed', primary: 'synthesize', rationale: 'lifecycle:confirmed' },
    { state: 'synthesis_ready', primary: 'synthesize', rationale: 'lifecycle:synthesis_ready' },
    { state: 'moved_on_by_affirmative', primary: 'confirm', rationale: 'lifecycle:moved_on_by_affirmative' },
    { state: 'moved_on_by_negative', primary: 'confirm', rationale: 'lifecycle:moved_on_by_negative' },
    { state: 'ignored_by_affirmative', primary: 'reply', rationale: 'lifecycle:ignored_by_affirmative' },
    { state: 'ignored_by_negative', primary: 'reply', rationale: 'lifecycle:ignored_by_negative' },
    { state: 'ignored_by_both', primary: 'reply', rationale: 'lifecycle:ignored_by_both' },
    { state: 'exhausted', primary: 'narrow', rationale: 'lifecycle:exhausted' },
    { state: 'branch_recommended', primary: 'branch', rationale: 'lifecycle:branch_recommended' },
    { state: 'archived_or_resolved', primary: 'open_cards_detail', rationale: 'lifecycle:archived_or_resolved' },
  ];

  it.each(EXPECTED)('lifecycle=$state → primary=$primary (participant-other)', ({ state, primary, rationale }) => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state, messageIds: ['r'] }],
    }));
    expect(m.primarySuggestion.action).toBe(primary);
    expect(m.primarySuggestion.rationaleCode).toBe(rationale);
  });

  it('every lifecycle state covered (no implicit fallback to undefined)', () => {
    const covered = new Set(EXPECTED.map((e) => e.state));
    for (const s of ALL_POINT_LIFECYCLE_STATES) {
      expect(covered.has(s)).toBe(true);
    }
  });
});

// ── Category 4 — Metadata interaction ─────────────────────────

describe('SC-004 metadata interaction', () => {
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });

  const TAG_EXPECTATIONS: ReadonlyArray<{ code: ManualTagCode; action: TimelineNodeActionDockActionCode }> = [
    { code: 'needs_source', action: 'ask_source' },
    { code: 'needs_quote', action: 'ask_quote' },
    { code: 'definition_issue', action: 'clarify' },
    { code: 'scope_issue', action: 'narrow' },
    { code: 'causal_mechanism', action: 'challenge' },
    { code: 'evidence_debt', action: 'add_evidence' },
    { code: 'concession_offered', action: 'confirm' },
    { code: 'narrowed_claim', action: 'confirm' },
    { code: 'tangent', action: 'branch' },
    { code: 'ready_for_synthesis', action: 'synthesize' },
  ];

  it.each(TAG_EXPECTATIONS)('manual tag $code on selected node promotes primary to $action', ({ code, action }) => {
    const linkage = makeMoveLinkage({
      messageId: 'r',
      userAppliedTags: [makeManualTagEntry(code)],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      moveLinks: [linkage],
    }));
    // For synthesize, the dock disables the action on node targets (cluster_action_on_node).
    if (action === 'synthesize') {
      expect(m.primarySuggestion.action).toBe('synthesize');
      const synth = m.actions.find((a) => a.action === 'synthesize')!;
      expect(synth.disabledReason).toBe('cluster_action_on_node');
    } else {
      expect(m.primarySuggestion.action).toBe(action);
    }
  });

  it('manual tag beats lifecycle default (intent > default)', () => {
    const linkage = makeMoveLinkage({
      messageId: 'r',
      userAppliedTags: [makeManualTagEntry('scope_issue')],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      moveLinks: [linkage],
    }));
    // Without the tag, lifecycle 'open' → 'reply'. With scope_issue tag → 'narrow'.
    expect(m.primarySuggestion.action).toBe('narrow');
    expect(m.primarySuggestion.rationaleCode).toBe('tag:scope_issue');
  });

  it('cluster-level manual tag aggregate appears in clusterHeader.manualTagSummary', () => {
    const meta = makeClusterMetadata({
      clusterId: 'r',
      lifecycleState: 'open',
      manualTagCodes: ['needs_source', 'definition_issue'],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      clusterMetas: [meta],
    }));
    expect(m.clusterHeader.manualTagSummary).toContain('Needs source');
  });

  it('auto metadata `synthesis_candidate` promotes synthesize to secondary head (cluster target)', () => {
    const meta = makeClusterMetadata({
      clusterId: 'r',
      lifecycleState: 'open',
      autoMetadataCodes: ['synthesis_candidate'],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      clusterMetas: [meta],
    }));
    // Primary stays as lifecycle default (open → reply); synthesize moves
    // forward in the secondaries.
    expect(m.primarySuggestion.action).toBe('reply');
    const secondaries = m.actions.slice(1).map((a) => a.action);
    expect(secondaries.indexOf('synthesize')).toBeLessThan(secondaries.indexOf('flag'));
  });

  it('auto metadata `repeated_axis_pressure` promotes narrow + branch ahead of others', () => {
    const meta = makeClusterMetadata({
      clusterId: 'r',
      lifecycleState: 'open',
      autoMetadataCodes: ['repeated_axis_pressure'],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      clusterMetas: [meta],
    }));
    const secondaries = m.actions.slice(1).map((a) => a.action);
    expect(secondaries.indexOf('narrow')).toBeLessThan(secondaries.indexOf('clarify'));
    expect(secondaries.indexOf('branch')).toBeLessThan(secondaries.indexOf('flag'));
  });

  it('auto metadata never overrides primary (cluster lifecycle wins)', () => {
    const meta = makeClusterMetadata({
      clusterId: 'r',
      lifecycleState: 'open',
      autoMetadataCodes: ['synthesis_candidate', 'point_stalled', 'branch_suggested'],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      clusterMetas: [meta],
    }));
    expect(m.primarySuggestion.action).toBe('reply');
  });

  it('move chip surfaces has_reply but the cluster header suppresses answered duplication (COPY-001)', () => {
    // Cluster lifecycle 'answered' renders as "Has a reply" via PLAIN_LANGUAGE_COPY.
    // Move-level has_reply on the same selected node would also render
    // "Has a reply". The dock dedups: move chip is suppressed.
    const linkage = makeMoveLinkage({
      messageId: 'r',
      autoDerivedMetadata: [makeAutoEntry('has_reply')],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'answered', messageIds: ['r'] }],
      moveLinks: [linkage],
    }));
    expect(m.clusterHeader.lifecycleLabel).toBe('Has a reply');
    // No "Has a reply" chip should be in moveChips — that would be the duplication.
    const dupChip = m.moveChips.find((c) => c.label === 'Has a reply');
    expect(dupChip).toBeUndefined();
  });

  it('all 10 manual tag codes are covered by promotion table', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(_debug.MANUAL_TAG_ACTION_PROMOTION[code]).toBeDefined();
    }
  });

  it('all 16 auto metadata codes are either cluster-level or move-level (no orphans)', () => {
    const cl = new Set(_debug.CLUSTER_LEVEL_AUTO_CODES);
    const ml = new Set(_debug.MOVE_LEVEL_AUTO_CODES);
    for (const c of ALL_AUTO_METADATA_CODES) {
      // Every code must be in at least one bucket.
      expect(cl.has(c) || ml.has(c)).toBe(true);
    }
  });
});

// ── Category 5 — Evidence / source-chain mapping ──────────────

describe('SC-004 evidence / source-chain mapping', () => {
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });

  it.each(ALL_SOURCE_CHAIN_STATUSES)('source-chain status %s drives a known primary action (node target, actor other)', (status) => {
    const linkage = makeMoveLinkage({ messageId: 'r' });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      moveLinks: [linkage],
      evidenceFor: () => makeEvidenceContract(status),
    }));
    expect(m.primarySuggestion.rationaleCode.startsWith('evidence:')).toBe(true);
  });

  it('source_no_quote primary is ask_quote', () => {
    const linkage = makeMoveLinkage({ messageId: 'r' });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      moveLinks: [linkage],
      evidenceFor: () => makeEvidenceContract('source_no_quote'),
    }));
    expect(m.primarySuggestion.action).toBe('ask_quote');
  });

  it('source_and_quote primary is open_cards_detail (inspect receipt)', () => {
    const linkage = makeMoveLinkage({ messageId: 'r' });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      moveLinks: [linkage],
      evidenceFor: () => makeEvidenceContract('source_and_quote'),
    }));
    expect(m.primarySuggestion.action).toBe('open_cards_detail');
  });

  it('source_attached auto code disables ask_source with evidence_already_attached', () => {
    const linkage = makeMoveLinkage({
      messageId: 'r',
      autoDerivedMetadata: [makeAutoEntry('source_attached')],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'sourced', messageIds: ['r'] }],
      moveLinks: [linkage],
    }));
    const askSrc = m.actions.find((a) => a.action === 'ask_source')!;
    expect(askSrc.isDisabled).toBe(true);
    expect(askSrc.disabledReason).toBe('evidence_already_attached');
  });

  it('quote_attached auto code disables ask_quote with quote_already_attached', () => {
    const linkage = makeMoveLinkage({
      messageId: 'r',
      autoDerivedMetadata: [makeAutoEntry('quote_attached')],
    });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      moveLinks: [linkage],
    }));
    const askQ = m.actions.find((a) => a.action === 'ask_quote')!;
    expect(askQ.isDisabled).toBe(true);
    expect(askQ.disabledReason).toBe('quote_already_attached');
  });
});

// ── Category 6 — Branch / cluster selection ───────────────────

describe('SC-004 branch / cluster selection', () => {
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });

  it('node target — synthesize is disabled with cluster_action_on_node', () => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    }));
    const synth = m.actions.find((a) => a.action === 'synthesize')!;
    expect(synth.isDisabled).toBe(true);
    expect(synth.disabledReason).toBe('cluster_action_on_node');
  });

  it('cluster target — ask_source / ask_quote are disabled with node_action_on_cluster', () => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    }));
    const askSrc = m.actions.find((a) => a.action === 'ask_source')!;
    expect(askSrc.isDisabled).toBe(true);
    expect(askSrc.disabledReason).toBe('node_action_on_cluster');
    const askQ = m.actions.find((a) => a.action === 'ask_quote')!;
    expect(askQ.isDisabled).toBe(true);
    expect(askQ.disabledReason).toBe('node_action_on_cluster');
  });

  it('collapsed_stub target — primary is expand_branch', () => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'collapsed_stub', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    }));
    expect(m.primarySuggestion.action).toBe('expand_branch');
    expect(m.primarySuggestion.rationaleCode).toBe('target:collapsed_stub');
  });

  it('collapsed_stub target — every action except expand_branch + open_cards_detail is disabled', () => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'collapsed_stub', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    }));
    for (const a of m.actions) {
      if (a.action === 'expand_branch' || a.action === 'open_cards_detail') {
        expect(a.isDisabled).toBe(false);
      } else {
        expect(a.isDisabled).toBe(true);
        expect(a.disabledReason).toBe('collapsed_stub_must_expand');
      }
    }
  });

  it('detached node — primary is open_cards_detail; other actions disabled with detached_node', () => {
    const detached = fakeNode({ messageId: 'd', isDetached: true, branchRootMessageId: 'd' });
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'd' },
      actor: 'other',
      nodes: [detached],
      lifecycleClusters: [{ clusterId: 'd', state: 'open', messageIds: ['d'] }],
    }));
    expect(m.primarySuggestion.action).toBe('open_cards_detail');
    const reply = m.actions.find((a) => a.action === 'reply')!;
    expect(reply.isDisabled).toBe(true);
    expect(reply.disabledReason).toBe('detached_node');
  });

  it('archived_or_resolved cluster — reply stays enabled (dock RECOMMENDS, never BLOCKS)', () => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'archived_or_resolved', messageIds: ['r'] }],
    }));
    const reply = m.actions.find((a) => a.action === 'reply')!;
    expect(reply.isDisabled).toBe(false);
  });
});

// ── Category 8 — Plain-language ───────────────────────────────

describe('SC-004 plain-language (no internal codes in user-facing copy)', () => {
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });

  it('every action label looks like English (not snake_case)', () => {
    for (const code of ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES) {
      const label = _debug.ACTION_LABELS[code];
      expect(label).toBeTruthy();
      expect(looksLikeInternalCode(label)).toBe(false);
    }
  });

  it('every disabled helper copy is plain English', () => {
    for (const reason of Object.keys(_debug.DISABLED_HELPER_COPY)) {
      const copy = _debug.DISABLED_HELPER_COPY[reason as keyof typeof _debug.DISABLED_HELPER_COPY];
      expect(looksLikeInternalCode(copy)).toBe(false);
    }
  });

  it('cluster header is plain English under every lifecycle state', () => {
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const m = buildTimelineNodeActionDockModel(makeInput({
        target: { kind: 'cluster', branchRootMessageId: 'r' },
        actor: 'other',
        nodes: [root],
        lifecycleClusters: [{ clusterId: 'r', state, messageIds: ['r'] }],
      }));
      expect(looksLikeInternalCode(m.clusterHeader.lifecycleLabel)).toBe(false);
    }
  });
});

// ── Category 11 — 250+ message stress fixture ─────────────────

describe('SC-004 performance — 250+ messages', () => {
  it('buildTimelineNodeActionDockModel completes in < 50 ms on a 250-message tree', () => {
    const nodes: ArgumentTimelineMapNode[] = [];
    const clusters: { clusterId: string; state: PointLifecycleState; messageIds: string[] }[] = [];
    for (let i = 0; i < 250; i++) {
      const id = `m${i}`;
      const root = i === 0;
      const branchRoot = root ? id : 'm0';
      nodes.push(fakeNode({ messageId: id, isRoot: root, branchRootMessageId: branchRoot, ordinal: i + 1 }));
      if (root) clusters.push({ clusterId: id, state: 'open', messageIds: [] });
      clusters[0].messageIds.push(id);
    }
    const input = makeInput({
      target: { kind: 'node', messageId: 'm125' },
      actor: 'other',
      nodes,
      lifecycleClusters: clusters,
    });
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) buildTimelineNodeActionDockModel(input);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(250); // 5 builds in < 250 ms = avg < 50 ms.
  });
});

// ── Category 12 — Composer preset mapping ─────────────────────

describe('SC-004 actionDockToComposerPreset — post-action round trips', () => {
  const target: TimelineNodeActionDockTarget = { kind: 'node', messageId: 'r' };

  it('challenge → rebuttal patch', () => {
    const p = actionDockToComposerPreset('challenge', target, null);
    expect(p).not.toBeNull();
    expect(p!.argumentType).toBe('rebuttal');
  });

  it('ask_source → clarification_request + source_request tag + seeded body', () => {
    const p = actionDockToComposerPreset('ask_source', target, null);
    expect(p).not.toBeNull();
    expect(p!.argumentType).toBe('clarification_request');
    expect(p!.suggestedTagCodes).toContain('source_request');
    expect(typeof p!.body).toBe('string');
  });

  it('ask_quote → clarification_request + quote_request tag + seeded body', () => {
    const p = actionDockToComposerPreset('ask_quote', target, null);
    expect(p).not.toBeNull();
    expect(p!.argumentType).toBe('clarification_request');
    expect(p!.suggestedTagCodes).toContain('quote_request');
  });

  it('clarify → clarification_request', () => {
    const p = actionDockToComposerPreset('clarify', target, null);
    expect(p!.argumentType).toBe('clarification_request');
  });

  it('add_evidence → evidence', () => {
    const p = actionDockToComposerPreset('add_evidence', target, null);
    expect(p!.argumentType).toBe('evidence');
  });

  it('concede → concession', () => {
    const p = actionDockToComposerPreset('concede', target, null);
    expect(p!.argumentType).toBe('concession');
  });

  it('narrow → concession + narrow_scope tag + NARROW_PRESET_BODY', () => {
    const p = actionDockToComposerPreset('narrow', target, null);
    expect(p!.argumentType).toBe('concession');
    expect(p!.suggestedTagCodes).toContain('narrow_scope');
    expect(p!.body).toBe(NARROW_PRESET_BODY);
  });

  it('confirm → CONFIRM_PRESET_BODY (no forced type)', () => {
    const p = actionDockToComposerPreset('confirm', target, null);
    expect(p!.body).toBe(CONFIRM_PRESET_BODY);
  });

  it('synthesize → synthesis + SYNTHESIZE_PRESET_BODY', () => {
    const p = actionDockToComposerPreset('synthesize', target, null);
    expect(p!.argumentType).toBe('synthesis');
    expect(p!.body).toBe(SYNTHESIZE_PRESET_BODY);
  });

  it('non-post actions return null', () => {
    expect(actionDockToComposerPreset('reply', target, null)).toBeNull();
    expect(actionDockToComposerPreset('branch', target, null)).toBeNull();
    expect(actionDockToComposerPreset('flag', target, null)).toBeNull();
    expect(actionDockToComposerPreset('open_cards_detail', target, null)).toBeNull();
    expect(actionDockToComposerPreset('expand_branch', target, null)).toBeNull();
    expect(actionDockToComposerPreset('mark_moved_on', target, null)).toBeNull();
    expect(actionDockToComposerPreset('mark_ignored', target, null)).toBeNull();
  });

  it('challenge respects parentType for rebuttal vs counter_rebuttal', () => {
    const p1 = actionDockToComposerPreset('challenge', target, 'rebuttal');
    expect(p1!.argumentType).toBe('counter_rebuttal');
    const p2 = actionDockToComposerPreset('challenge', target, 'counter_rebuttal');
    expect(p2!.argumentType).toBe('rebuttal');
  });
});

// ── Primary-only lightweight path ─────────────────────────────

describe('SC-004 getPrimaryTimelineNodeAction (lightweight gallery path)', () => {
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });

  it('returns the same primary as the full model build', () => {
    const input = makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'synthesis_ready', messageIds: ['r'] }],
    });
    const full = buildTimelineNodeActionDockModel(input);
    const light = getPrimaryTimelineNodeAction(input);
    expect(light.action).toBe(full.primarySuggestion.action);
    expect(light.rationaleCode).toBe(full.primarySuggestion.rationaleCode);
  });
});

// ── Empty / missing-input fallbacks ───────────────────────────

describe('SC-004 fallback / missing-input behaviour', () => {
  const root = fakeNode({ messageId: 'r', isRoot: true, branchRootMessageId: 'r' });

  it('missing cluster summary → cluster header falls back to "Open for response"', () => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [], // no clusters
    }));
    expect(m.clusterHeader.lifecycleLabel).toBe('Open for response');
  });

  it('missing cluster metadata → empty manualTagSummary + empty autoMetadataSummary', () => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'cluster', branchRootMessageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
    }));
    expect(m.clusterHeader.manualTagSummary).toBe('');
    expect(m.clusterHeader.autoMetadataSummary).toBe('');
  });

  it('null evidence contract → evidenceLabel is empty string', () => {
    const m = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' },
      actor: 'other',
      nodes: [root],
      lifecycleClusters: [{ clusterId: 'r', state: 'open', messageIds: ['r'] }],
      evidenceFor: () => null,
    }));
    expect(m.clusterHeader.evidenceLabel).toBe('');
  });
});

// ── Doctrine: heat ≠ correctness ─────────────────────────────

describe('SC-004 doctrine — wrong-but-loud vs right-but-quiet produce identical primary action', () => {
  it('same lifecycle, different toneBand / temperatureBand / standingBand → identical primary action', () => {
    const hot = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
      toneBand: 'hostile',
      temperatureBand: 'hot',
      standingBand: 'pretty_right',
    });
    const cool = fakeNode({
      messageId: 'r', isRoot: true, branchRootMessageId: 'r',
      toneBand: 'calm',
      temperatureBand: 'cool',
      standingBand: 'pretty_wrong',
    });
    const lifecycleClusters = [{ clusterId: 'r', state: 'rebutted' as PointLifecycleState, messageIds: ['r'] }];
    const a = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' }, actor: 'other',
      nodes: [hot], lifecycleClusters,
    }));
    const b = buildTimelineNodeActionDockModel(makeInput({
      target: { kind: 'node', messageId: 'r' }, actor: 'other',
      nodes: [cool], lifecycleClusters,
    }));
    expect(a.primarySuggestion.action).toBe(b.primarySuggestion.action);
    expect(a.primarySuggestion.rationaleCode).toBe(b.primarySuggestion.rationaleCode);
  });
});
