/**
 * ST-002 — SC-003 sidecar widening integration.
 *
 * The SC-003 builder reserves a typed `SuggestedMoveStub | null` slot
 * (`suggestion`). ST-002 widens the stub from `never` to `SuggestedMove`.
 * This test pins:
 *
 *   1. The SC-003 builder still returns `suggestion: null` (no behaviour
 *      change in v1).
 *   2. The widening compiles — a fixture-shaped `SuggestedMove` is
 *      assignable to `SuggestedMoveStub | null`.
 *   3. The placeholder line still passes the SC-003 ban-list contract.
 *   4. The `reason === 'st_002_not_yet_implemented'` sentinel is stable.
 *   5. The `SuggestedNextMove` type from suggestedMovesModel equals
 *      `SuggestedMove`.
 *   6. A constructed fixture's `suggestion` is type-compatible with the
 *      section's typing.
 */

import {
  buildSidecarViewModel,
  SIDECAR_COPY,
  type BuildSidecarViewModelInput,
  type SidecarSection_SuggestedNextMove,
  type SidecarViewModel,
  type SuggestedMoveStub,
} from '../src/features/arguments/argumentReplySidecarModel';
import {
  type SuggestedMove,
  type SuggestedNextMove,
} from '../src/features/arguments/suggestedMovesModel';
import {
  type PointLifecycleClusterSummary,
  type PointLifecycleMap,
  type PointLifecycleSnapshot,
  type PointLifecycleState,
} from '../src/features/lifecycle';
import {
  type AutoMetadataCode,
  type ClusterMetadataSummary,
  type ManualTagCode,
  type MoveLinkageRecord,
  type MoveMetadataLedger,
} from '../src/features/metadata';
import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

// ── Fixtures (mirrors argumentReplySidecarModel.test.ts) ─────────

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
    bodyPreview: over.bodyPreview ?? 'parent preview body',
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
    isActive: over.isActive ?? true,
    isLatest: over.isLatest ?? true,
    isDetached: over.isDetached ?? false,
    isActivePath: over.isActivePath ?? true,
    isRoot: over.isRoot ?? true,
    isFirstRebuttal: over.isFirstRebuttal ?? false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: over.kindColor ?? '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: over.x ?? 100,
    y: over.y ?? 120,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
  };
}

function fakeViewModel(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  return {
    messageId: over.messageId ?? 'm1',
    ordinal: over.ordinal ?? 1,
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    body: over.body ?? 'A short claim body.',
    kindLabel: over.kindLabel ?? 'claim',
    actor: over.actor ?? 'self',
    sideLabel: over.sideLabel ?? 'Aff',
    isLatest: over.isLatest ?? true,
    isActive: over.isActive ?? true,
    parentHint: over.parentHint ?? null,
    qualifierBadges: over.qualifierBadges ?? [],
    pointStandingHint: over.pointStandingHint ?? null,
    allowedControls: over.allowedControls ?? ['view_qualifiers', 'request_deletion'],
    deletionRequested: over.deletionRequested ?? false,
  };
}

function fakeClusterSummary(over: Partial<PointLifecycleClusterSummary> = {}): PointLifecycleClusterSummary {
  return {
    clusterId: over.clusterId ?? 'm1',
    rootMessageId: over.rootMessageId ?? 'm1',
    state: (over.state ?? 'open') as PointLifecycleState,
    plainLabel: over.plainLabel ?? 'Open',
    messageIds: over.messageIds ?? ['m1'],
    memberCount: over.memberCount ?? 1,
    affirmativeMoveCount: over.affirmativeMoveCount ?? 0,
    negativeMoveCount: over.negativeMoveCount ?? 0,
    observerMoveCount: over.observerMoveCount ?? 0,
    hasOpenSourceOrQuoteRequest: over.hasOpenSourceOrQuoteRequest ?? false,
    hasConcessionOrSynthesisMove: over.hasConcessionOrSynthesisMove ?? false,
    worstEvidenceStatus: over.worstEvidenceStatus ?? 'no_source',
    primaryAxis: over.primaryAxis ?? null,
    isAdvisory: over.isAdvisory ?? false,
  };
}

function makeLifecycleMap(
  cluster: PointLifecycleClusterSummary | null,
): PointLifecycleMap | null {
  if (!cluster) return null;
  const byCluster = new Map<string, PointLifecycleClusterSummary>([[cluster.clusterId, cluster]]);
  const byMessage = new Map<string, PointLifecycleSnapshot>();
  return {
    byCluster,
    byMessage,
    clusterOrder: [cluster.clusterId],
    cumulativeStateSequence: [cluster.state],
    inputHash: 'integration-hash',
  };
}

function fakeClusterMetadata(over: Partial<ClusterMetadataSummary> = {}): ClusterMetadataSummary {
  return {
    clusterId: over.clusterId ?? 'm1',
    manualTagCodes: over.manualTagCodes ?? [],
    autoMetadataCodes: over.autoMetadataCodes ?? [],
    lifecycleState: (over.lifecycleState ?? 'open') as PointLifecycleState,
    lastManualTagAt: over.lastManualTagAt ?? null,
    taggingParticipantCount: over.taggingParticipantCount ?? 0,
  };
}

function fakeMoveLinkage(over: Partial<MoveLinkageRecord> = {}): MoveLinkageRecord {
  return {
    messageId: over.messageId ?? 'm1',
    parentMessageId: over.parentMessageId ?? null,
    rootPointId: over.rootPointId ?? 'm1',
    pointClusterId: over.pointClusterId ?? 'm1',
    branchId: over.branchId ?? 'branch-1',
    targetExcerpt: over.targetExcerpt ?? null,
    disagreementAxis: over.disagreementAxis ?? null,
    semanticFlags: over.semanticFlags ?? [],
    userAppliedTags: over.userAppliedTags ?? [],
    autoDerivedMetadata: over.autoDerivedMetadata ?? [],
    lifecycleEventsCausedByMove: over.lifecycleEventsCausedByMove ?? [],
  };
}

function makeLedger(
  clusterId: string,
  clusterMeta: ClusterMetadataSummary,
  moveRecord?: MoveLinkageRecord,
): MoveMetadataLedger {
  const byMessage = new Map<string, MoveLinkageRecord>();
  byMessage.set(
    clusterId,
    moveRecord ??
      fakeMoveLinkage({ messageId: clusterId, rootPointId: clusterId, pointClusterId: clusterId }),
  );
  const byCluster = new Map<string, ClusterMetadataSummary>([[clusterId, clusterMeta]]);
  return {
    byMessage,
    byCluster,
    metadataEvents: [],
    messageOrder: [clusterId],
    inputHash: 'integration-ledger-hash',
  };
}

function fullInput(over: Partial<BuildSidecarViewModelInput> = {}): BuildSidecarViewModelInput {
  const node = 'activeNode' in over ? (over.activeNode as ArgumentTimelineMapNode | null) : fakeNode();
  const fallbackVm = node ? fakeViewModel({ messageId: node.messageId }) : null;
  const vm = 'activeViewModel' in over ? (over.activeViewModel as ArgumentBubbleViewModel | null) : fallbackVm;
  const clusterId = node ? node.branchRootMessageId : 'm1';
  const cluster = fakeClusterSummary({ clusterId, state: 'open' });
  return {
    activeNode: node,
    activeViewModel: vm,
    parentNode: 'parentNode' in over ? (over.parentNode as ArgumentTimelineMapNode | null) : null,
    totalCount: over.totalCount ?? 1,
    activePathIds: over.activePathIds ?? (node ? [node.messageId] : []),
    lifecycleMap: 'lifecycleMap' in over ? (over.lifecycleMap as PointLifecycleMap | null) : makeLifecycleMap(cluster),
    metadataLedger:
      'metadataLedger' in over
        ? (over.metadataLedger as MoveMetadataLedger | null)
        : makeLedger(clusterId, fakeClusterMetadata({ clusterId })),
    viewMode: over.viewMode ?? 'stack',
    bodyExcerptCap: over.bodyExcerptCap,
  };
}

function pickSuggested(vm: SidecarViewModel): SidecarSection_SuggestedNextMove {
  const s = vm.sections.find((x) => x.kind === 'suggested_next_move');
  expect(s).toBeDefined();
  return s as SidecarSection_SuggestedNextMove;
}

// ── 1. SC-003 builder still returns suggestion: null ───────────

describe('ST-002 integration — SC-003 builder behaviour unchanged', () => {
  it('happy-path build still returns suggestion: null', () => {
    const vm = buildSidecarViewModel(fullInput());
    const s = pickSuggested(vm);
    expect(s.suggestion).toBeNull();
  });

  it('variant inputs (no lifecycle / no metadata / timeline mode) all return null', () => {
    const inputs: BuildSidecarViewModelInput[] = [
      fullInput(),
      fullInput({ viewMode: 'timeline' }),
      fullInput({ lifecycleMap: null }),
      fullInput({ metadataLedger: null }),
      fullInput({
        metadataLedger: makeLedger(
          'm1',
          fakeClusterMetadata({
            clusterId: 'm1',
            manualTagCodes: ['needs_source'] as ManualTagCode[],
            autoMetadataCodes: ['has_reply'] as AutoMetadataCode[],
          }),
        ),
      }),
    ];
    for (const input of inputs) {
      const vm = buildSidecarViewModel(input);
      expect(pickSuggested(vm).suggestion).toBeNull();
    }
  });
});

// ── 2. SuggestedMoveStub widening compiles ────────────────────

describe('ST-002 integration — SuggestedMoveStub widening', () => {
  it('a SuggestedMove fixture is assignable to SuggestedMoveStub | null', () => {
    // Pre-ST-002 this would not compile (only null was assignable to
    // `never | null`). Post-ST-002 the stub is `SuggestedMove`, so the
    // fixture is type-compatible.
    const fixture: SuggestedMove = {
      code: 'ask_source',
      label: 'A',
      rationale: 'r',
      presetKey: 'source',
      dockAction: 'ask_source',
      sourceSignals: [],
    };
    const widened: SuggestedMoveStub | null = fixture;
    expect(widened).toBe(fixture);

    const nullValue: SuggestedMoveStub | null = null;
    expect(nullValue).toBeNull();
  });
});

// ── 3. Placeholder line still passes SC-003 ban-list ──────────

describe('ST-002 integration — placeholder line stable', () => {
  it('the SC-003 placeholder line is the stable copy', () => {
    const vm = buildSidecarViewModel(fullInput());
    const s = pickSuggested(vm);
    expect(s.placeholderLine).toBe(SIDECAR_COPY.ST_002_PLACEHOLDER);
  });

  it('the placeholder string contains no verdict / amplification token (smoke check)', () => {
    const placeholder = SIDECAR_COPY.ST_002_PLACEHOLDER.toLowerCase();
    for (const t of ['winner', 'loser', 'correct', 'true', 'false', 'liar']) {
      expect(placeholder).not.toContain(t);
    }
  });
});

// ── 4. reason sentinel stable ──────────────────────────────────

describe('ST-002 integration — reason sentinel', () => {
  it("reason stays 'st_002_not_yet_implemented'", () => {
    const vm = buildSidecarViewModel(fullInput());
    const s = pickSuggested(vm);
    expect(s.reason).toBe('st_002_not_yet_implemented');
  });
});

// ── 5. SuggestedNextMove type re-export ────────────────────────

describe('ST-002 integration — SuggestedNextMove re-export', () => {
  it('SuggestedNextMove is structurally a SuggestedMove', () => {
    const value: SuggestedNextMove = {
      code: 'narrow',
      label: 'N',
      rationale: 'r',
      presetKey: 'narrow',
      dockAction: 'narrow',
      sourceSignals: [],
    };
    expect(value.code).toBe('narrow');
  });
});

// ── 6. Forward-compat invariant — slot widens correctly ────────

describe('ST-002 integration — slot widens to SuggestedMove | null', () => {
  it('a section literal with a SuggestedMove in suggestion type-checks', () => {
    // Construct a section literal as a downstream caller might (this
    // pins the widened type for ST-003 / integrator consumers).
    const fixture: SuggestedMove = {
      code: 'synthesize',
      label: 'S',
      rationale: 'r',
      presetKey: 'synthesize',
      dockAction: 'synthesize',
      sourceSignals: [],
    };
    const section: SidecarSection_SuggestedNextMove = {
      kind: 'suggested_next_move',
      suggestion: fixture,
      reason: 'st_002_not_yet_implemented',
      placeholderLine: SIDECAR_COPY.ST_002_PLACEHOLDER,
    };
    expect(section.suggestion).toBe(fixture);
  });
});
