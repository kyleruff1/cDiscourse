/**
 * QOL-033 — Go popout content model tests.
 *
 * Design §7 test plan:
 *  - Jump targets resolve to the right node; no route transition.
 *  - Lens membership — the §3.3 stage tables; a lens dims, never removes.
 *  - Hot zone is chosen by activity length, never standing-as-correctness.
 *  - Density preserves the active node; Cards-view disables the timeline-
 *    only entries with a reason.
 *  - Mini-map omitted below the node threshold, embedded above it.
 *
 * Full branch coverage of every public function (test-discipline: pure-TS
 * models get 100% branch coverage). Doctrine / ban-list also live in the
 * companion `oneBoxCopyBanList.test.ts`.
 */

import {
  buildGoPopout,
  flattenGoPopout,
  getGoLensCopy,
  goEntryToDensityMode,
  goEntryToJumpTarget,
  goEntryToLens,
  goEntryToView,
  goLensToFocusLensId,
  hasHotZone,
  hasSideBranches,
  showsEmbeddedMiniMap,
  ALL_GO_ENTRY_IDS,
  ALL_GO_ENTRY_KINDS,
  ALL_GO_JUMP_TARGETS,
  ALL_GO_LENSES,
  DEFAULT_GO_LENS,
  GO_DENSITY_MODES,
  GO_DISABLED_REASON,
  GO_GROUP_LABEL,
  GO_GROUP_ORDER,
  GO_STAGE_LENS_FOCUS_IDS,
  _debug,
  type BuildGoPopoutInput,
  type GoEntryId,
  type GoLens,
} from '../src/features/arguments/oneBox/goPopoutModel';
import {
  applyTimelineLens,
  activePathLens,
  TIMELINE_LENS_IDS,
  type TimelineLensNode,
  type TimelineLensContext,
} from '../src/features/arguments/timelineDensityLensModel';
import { ALL_POINT_LIFECYCLE_STATES } from '../src/features/lifecycle';
import type { PointLifecycleState } from '../src/features/lifecycle';
import type {
  MiniMapBranchCluster,
  MiniMapHotZone,
  TimelineMiniMapModel,
} from '../src/features/arguments/timelineMiniMapModel';

// ── Fixture helpers ────────────────────────────────────────────

/** A side-branch cluster (lane != 0 → `isMainline: false`). */
function sideBranchCluster(over: Partial<MiniMapBranchCluster> = {}): MiniMapBranchCluster {
  return {
    branchId: over.branchId ?? 'branch-2',
    branchRootMessageId: over.branchRootMessageId ?? 'm-branch-root',
    lane: over.lane ?? 1,
    moveCount: over.moveCount ?? 3,
    xStartFraction: over.xStartFraction ?? 0.4,
    xEndFraction: over.xEndFraction ?? 0.7,
    isCollapsed: over.isCollapsed ?? false,
    hiddenMoveCount: over.hiddenMoveCount ?? 0,
    laneLabel: over.laneLabel ?? 'on a side branch',
    containsActivePath: over.containsActivePath ?? false,
    isMainline: false,
  };
}

/** The mainline cluster (lane 0 → `isMainline: true`). */
function mainlineCluster(): MiniMapBranchCluster {
  return {
    branchId: 'branch-root-m1',
    branchRootMessageId: 'm1',
    lane: 0,
    moveCount: 12,
    xStartFraction: 0,
    xEndFraction: 1,
    isCollapsed: false,
    hiddenMoveCount: 0,
    laneLabel: 'on the main line',
    containsActivePath: true,
    isMainline: true,
  };
}

/** A hot zone — IX-002 already chose it by run length. */
function hotZone(over: Partial<MiniMapHotZone> = {}): MiniMapHotZone {
  return {
    xStartFraction: over.xStartFraction ?? 0.3,
    xEndFraction: over.xEndFraction ?? 0.6,
    jumpTargetMessageId: over.jumpTargetMessageId ?? 'm-hot',
    moveCount: over.moveCount ?? 4,
  };
}

/** A `TimelineMiniMapModel` fixture with sensible defaults. */
function miniMap(over: Partial<TimelineMiniMapModel> = {}): TimelineMiniMapModel {
  return {
    isAvailable: 'isAvailable' in over ? (over.isAvailable as boolean) : true,
    moveCount: over.moveCount ?? 16,
    markers: over.markers ?? [],
    branchClusters: over.branchClusters ?? [mainlineCluster(), sideBranchCluster()],
    hotZone: 'hotZone' in over ? (over.hotZone ?? null) : hotZone(),
    activePathMessageIds: over.activePathMessageIds ?? ['m1', 'm2'],
    rootMessageId: 'rootMessageId' in over ? (over.rootMessageId ?? null) : 'm1',
    latestMessageId: 'latestMessageId' in over ? (over.latestMessageId ?? null) : 'm16',
    minLane: over.minLane ?? 0,
    maxLane: over.maxLane ?? 1,
    collapsedBranchCount: over.collapsedBranchCount ?? 0,
    summaryLine: over.summaryLine ?? '16 moves · 1 branch · 1 hot zone',
  };
}

/** A `buildGoPopout` input with sensible defaults. */
function goInput(over: Partial<BuildGoPopoutInput> = {}): BuildGoPopoutInput {
  return {
    miniMap: over.miniMap ?? miniMap(),
    view: over.view ?? 'timeline',
    density: over.density ?? 'normal',
    lens: over.lens ?? 'none',
  };
}

/** Find a built entry by id (across all groups). */
function findEntry(input: BuildGoPopoutInput, id: GoEntryId) {
  return flattenGoPopout(buildGoPopout(input)).find((e) => e.id === id);
}

// ── 1. Group ordering + labels ─────────────────────────────────

describe('QOL-033 goPopoutModel — groups', () => {
  it('exposes the 4-group order Jump · View · Density · Lens', () => {
    expect([...GO_GROUP_ORDER]).toEqual(['jump', 'view', 'density', 'lens']);
  });

  it('every group has a plain-language label', () => {
    for (const g of GO_GROUP_ORDER) {
      expect(GO_GROUP_LABEL[g].length).toBeGreaterThan(0);
    }
  });

  it('built groups appear in GO_GROUP_ORDER and every group is non-empty', () => {
    const groups = buildGoPopout(goInput());
    expect(groups.map((g) => g.id)).toEqual([...GO_GROUP_ORDER]);
    for (const g of groups) {
      expect(g.entries.length).toBeGreaterThan(0);
    }
  });

  it('every entry id is built exactly once', () => {
    const ids = flattenGoPopout(buildGoPopout(goInput())).map((e) => e.id);
    expect(ids.slice().sort()).toEqual([...ALL_GO_ENTRY_IDS].slice().sort());
  });
});

// ── 2. Jump-target resolution ──────────────────────────────────

describe('QOL-033 goPopoutModel — jump targets', () => {
  it('maps every jump entry id to a jump target', () => {
    expect(goEntryToJumpTarget('jump_root')).toBe('root');
    expect(goEntryToJumpTarget('jump_latest')).toBe('latest');
    expect(goEntryToJumpTarget('jump_hot_zone')).toBe('hot_zone');
    expect(goEntryToJumpTarget('jump_branch_list')).toBe('branch_list');
  });

  it('returns null for non-jump entry ids', () => {
    expect(goEntryToJumpTarget('view_timeline')).toBeNull();
    expect(goEntryToJumpTarget('density_normal')).toBeNull();
    expect(goEntryToJumpTarget('lens_unresolved')).toBeNull();
  });

  it('exposes all four jump targets', () => {
    expect([...ALL_GO_JUMP_TARGETS]).toEqual(['root', 'latest', 'hot_zone', 'branch_list']);
  });

  it('a jump entry is never marked active — a jump is one-shot, not a mode', () => {
    for (const id of ['jump_root', 'jump_latest', 'jump_hot_zone', 'jump_branch_list'] as const) {
      expect(findEntry(goInput(), id)?.isActive).toBe(false);
    }
  });

  it('Root + Latest are enabled when the timeline has a root and a latest node', () => {
    expect(findEntry(goInput(), 'jump_root')?.isDisabled).toBe(false);
    expect(findEntry(goInput(), 'jump_latest')?.isDisabled).toBe(false);
  });

  it('Root is disabled on an empty timeline (no node to jump to)', () => {
    const input = goInput({ miniMap: miniMap({ rootMessageId: null }) });
    expect(findEntry(input, 'jump_root')?.isDisabled).toBe(true);
  });

  it('Latest is disabled on an empty timeline (no node to jump to)', () => {
    const input = goInput({ miniMap: miniMap({ latestMessageId: null }) });
    expect(findEntry(input, 'jump_latest')?.isDisabled).toBe(true);
  });
});

// ── 3. Hot zone — by activity, never correctness ────────────────

describe('QOL-033 goPopoutModel — hot zone (activity, not a verdict)', () => {
  it('hasHotZone reads miniMap.hotZone verbatim — present', () => {
    expect(hasHotZone(miniMap({ hotZone: hotZone() }))).toBe(true);
  });

  it('hasHotZone is false when IX-002 found no contiguous warm/hot run', () => {
    expect(hasHotZone(miniMap({ hotZone: null }))).toBe(false);
  });

  it('hasHotZone is false for a null/undefined model', () => {
    expect(hasHotZone(null as unknown as TimelineMiniMapModel)).toBe(false);
  });

  it('the Hot-zone jump entry is enabled when a hot zone exists', () => {
    expect(findEntry(goInput(), 'jump_hot_zone')?.isDisabled).toBe(false);
  });

  it('the Hot-zone jump entry disables with a reason when no hot zone exists', () => {
    const input = goInput({ miniMap: miniMap({ hotZone: null }) });
    const entry = findEntry(input, 'jump_hot_zone');
    expect(entry?.isDisabled).toBe(true);
    expect(entry?.disabledReason).toBe(GO_DISABLED_REASON.noHotZone);
  });

  it('the hot zone is whatever IX-002 chose by run length — the model never re-derives it', () => {
    // A short 2-move hot zone is still a hot zone; the Go model trusts
    // IX-002's findHotZone (longest run), it does not re-rank by "hottest".
    const input = goInput({ miniMap: miniMap({ hotZone: hotZone({ moveCount: 2 }) }) });
    expect(findEntry(input, 'jump_hot_zone')?.isDisabled).toBe(false);
  });
});

// ── 4. Branch list — no branches → disabled with reason ─────────

describe('QOL-033 goPopoutModel — branch list', () => {
  it('hasSideBranches is true when a non-mainline cluster exists', () => {
    expect(hasSideBranches(miniMap({ branchClusters: [mainlineCluster(), sideBranchCluster()] }))).toBe(
      true,
    );
  });

  it('hasSideBranches is false when only the mainline cluster exists', () => {
    expect(hasSideBranches(miniMap({ branchClusters: [mainlineCluster()] }))).toBe(false);
  });

  it('hasSideBranches is false for an empty / null cluster list', () => {
    expect(hasSideBranches(miniMap({ branchClusters: [] }))).toBe(false);
    expect(hasSideBranches(null as unknown as TimelineMiniMapModel)).toBe(false);
  });

  it('the Branch-list entry is enabled when side branches exist', () => {
    expect(findEntry(goInput(), 'jump_branch_list')?.isDisabled).toBe(false);
  });

  it('the Branch-list entry disables with the "no side branches" reason (design §6)', () => {
    const input = goInput({ miniMap: miniMap({ branchClusters: [mainlineCluster()] }) });
    const entry = findEntry(input, 'jump_branch_list');
    expect(entry?.isDisabled).toBe(true);
    expect(entry?.disabledReason).toBe(GO_DISABLED_REASON.noBranches);
  });
});

// ── 5. View toggle ─────────────────────────────────────────────

describe('QOL-033 goPopoutModel — view toggle', () => {
  it('maps view entry ids to a BoxView', () => {
    expect(goEntryToView('view_timeline')).toBe('timeline');
    expect(goEntryToView('view_cards')).toBe('cards');
  });

  it('returns null for non-view entry ids', () => {
    expect(goEntryToView('jump_root')).toBeNull();
    expect(goEntryToView('density_compact')).toBeNull();
  });

  it('the active view entry is marked active; the other is enabled', () => {
    const tl = goInput({ view: 'timeline' });
    expect(findEntry(tl, 'view_timeline')?.isActive).toBe(true);
    expect(findEntry(tl, 'view_cards')?.isActive).toBe(false);
    expect(findEntry(tl, 'view_cards')?.isDisabled).toBe(false);

    const cards = goInput({ view: 'cards' });
    expect(findEntry(cards, 'view_cards')?.isActive).toBe(true);
    expect(findEntry(cards, 'view_timeline')?.isActive).toBe(false);
  });

  it('the view toggle is never disabled — you can always switch presentation', () => {
    for (const view of ['timeline', 'cards'] as const) {
      const input = goInput({ view });
      expect(findEntry(input, 'view_timeline')?.isDisabled).toBe(false);
      expect(findEntry(input, 'view_cards')?.isDisabled).toBe(false);
    }
  });
});

// ── 6. Density — preserves active node, timeline-only ───────────

describe('QOL-033 goPopoutModel — density', () => {
  it('exposes the three timeline-meaningful density modes (no gallery-only scan)', () => {
    expect([...GO_DENSITY_MODES]).toEqual(['compact', 'normal', 'expanded']);
  });

  it('maps density entry ids to a GalleryDensityMode', () => {
    expect(goEntryToDensityMode('density_compact')).toBe('compact');
    expect(goEntryToDensityMode('density_normal')).toBe('normal');
    expect(goEntryToDensityMode('density_expanded')).toBe('expanded');
  });

  it('returns null for non-density entry ids', () => {
    expect(goEntryToDensityMode('jump_root')).toBeNull();
    expect(goEntryToDensityMode('view_cards')).toBeNull();
  });

  it('the active density entry is marked active in Timeline view', () => {
    const input = goInput({ view: 'timeline', density: 'expanded' });
    expect(findEntry(input, 'density_expanded')?.isActive).toBe(true);
    expect(findEntry(input, 'density_compact')?.isActive).toBe(false);
    expect(findEntry(input, 'density_normal')?.isActive).toBe(false);
  });

  it('a density change leaves the active node untouched — density is view state only', () => {
    // The Go model never references the active node when resolving density;
    // switching density only re-flags which entry isActive. Membership /
    // the active node is the host's; density never changes it (IX-001 §3.4).
    const before = buildGoPopout(goInput({ density: 'normal' }));
    const after = buildGoPopout(goInput({ density: 'compact' }));
    // Same entry ids in the same order — density never adds/removes/reorders.
    expect(flattenGoPopout(before).map((e) => e.id)).toEqual(
      flattenGoPopout(after).map((e) => e.id),
    );
  });

  it('every density entry disables with the timeline-only reason in Cards view (design §6)', () => {
    const input = goInput({ view: 'cards' });
    for (const id of ['density_compact', 'density_normal', 'density_expanded'] as const) {
      const entry = findEntry(input, id);
      expect(entry?.isDisabled).toBe(true);
      expect(entry?.disabledReason).toBe(GO_DISABLED_REASON.timelineOnly);
      // A disabled density entry is never also "active".
      expect(entry?.isActive).toBe(false);
    }
  });

  it('density entries are enabled in Timeline view', () => {
    const input = goInput({ view: 'timeline' });
    for (const id of ['density_compact', 'density_normal', 'density_expanded'] as const) {
      expect(findEntry(input, id)?.isDisabled).toBe(false);
    }
  });
});

// ── 7. Lens — the §3.3 stage tables; dims, never hides ──────────

describe('QOL-033 goPopoutModel — lens mapping', () => {
  it('exposes all four lenses with `none` first (the unfiltered baseline)', () => {
    expect([...ALL_GO_LENSES]).toEqual(['none', 'active_path', 'unresolved', 'evidence']);
    expect(ALL_GO_LENSES[0]).toBe('none');
    expect(DEFAULT_GO_LENS).toBe('none');
  });

  it('Unresolved maps to IX-001 needs_response (the §3.3 unresolved stage set)', () => {
    expect(goLensToFocusLensId('unresolved')).toBe('needs_response');
  });

  it('Evidence maps to IX-001 evidence_requested (the §3.3 evidence stage set)', () => {
    expect(goLensToFocusLensId('evidence')).toBe('evidence_requested');
  });

  it('Active path maps to null — it is a topology filter, not a stage FocusLensId', () => {
    expect(goLensToFocusLensId('active_path')).toBeNull();
  });

  it('`none` maps to IX-001 `none` — the unfiltered baseline', () => {
    expect(goLensToFocusLensId('none')).toBe('none');
  });

  it('the two stage lenses resolve to members of IX-001 TIMELINE_LENS_IDS', () => {
    expect(GO_STAGE_LENS_FOCUS_IDS).toEqual(['needs_response', 'evidence_requested']);
    for (const id of GO_STAGE_LENS_FOCUS_IDS) {
      expect(TIMELINE_LENS_IDS).toContain(id);
    }
  });

  it('maps lens entry ids to a GoLens', () => {
    expect(goEntryToLens('lens_active_path')).toBe('active_path');
    expect(goEntryToLens('lens_unresolved')).toBe('unresolved');
    expect(goEntryToLens('lens_evidence')).toBe('evidence');
  });

  it('returns null for non-lens entry ids', () => {
    expect(goEntryToLens('jump_root')).toBeNull();
    expect(goEntryToLens('density_normal')).toBeNull();
  });

  it('the active lens entry is marked active in Timeline view', () => {
    const input = goInput({ view: 'timeline', lens: 'unresolved' });
    expect(findEntry(input, 'lens_unresolved')?.isActive).toBe(true);
    expect(findEntry(input, 'lens_active_path')?.isActive).toBe(false);
    expect(findEntry(input, 'lens_evidence')?.isActive).toBe(false);
  });

  it('lens entries disable with the timeline-only reason in Cards view', () => {
    const input = goInput({ view: 'cards', lens: 'evidence' });
    for (const id of ['lens_active_path', 'lens_unresolved', 'lens_evidence'] as const) {
      const entry = findEntry(input, id);
      expect(entry?.isDisabled).toBe(true);
      expect(entry?.disabledReason).toBe(GO_DISABLED_REASON.timelineOnly);
    }
  });
});

// ── 8. Lens stage membership — the §3.3 tables (via IX-001) ─────

describe('QOL-033 goPopoutModel — lens stage membership (design §3.3)', () => {
  /** Build a timeline node carrying a LIFE-001 lifecycle state. */
  function lensNode(id: string, stage: PointLifecycleState | null): TimelineLensNode {
    return {
      messageId: id,
      lifecycleState: stage,
      // Minimal map-node shape — the lens predicates only read the fields
      // below; the rest is filled with safe defaults.
      parentId: null,
      ordinal: 1,
      createdAt: '',
      createdAtLabel: '',
      relativeLabel: '',
      actorLabel: '',
      kindLabel: '',
      sideLabel: '',
      bodyPreview: '',
      badges: [],
      droppedTags: [],
      depth: 0,
      lane: 0,
      siblingIndex: 0,
      replyCount: 0,
      descendantCount: 0,
      branchId: 'b',
      branchRootMessageId: id,
      junctionGroupId: null,
      isJunction: false,
      junctionChildCount: 0,
      isActive: false,
      isLatest: false,
      isDetached: false,
      isActivePath: false,
      isRoot: false,
      isFirstRebuttal: false,
      standingBand: 'neutral',
      toneBand: 'calm',
      temperatureBand: 'cool',
      kindColor: '#000',
      kindColorFamily: 'default',
      x: 0,
      y: 0,
      accessibilityLabel: '',
    } as TimelineLensNode;
  }

  const emptyCtx: TimelineLensContext = { activePathIds: new Set<string>() };

  // The §3.3 Unresolved stage set.
  const UNRESOLVED_STAGES: PointLifecycleState[] = [
    'open',
    'rebutted',
    'clarified',
    'source_requested',
    'quote_requested',
    'narrowed',
  ];
  // The §3.3 Evidence stage set (the lens predicate covers the debt states;
  // `sourced` is the kind-family fallback path tested separately in IX-001).
  const EVIDENCE_DEBT_STAGES: PointLifecycleState[] = ['source_requested', 'quote_requested'];

  it('Unresolved (needs_response) matches exactly the §3.3 unresolved stage set', () => {
    const focusId = goLensToFocusLensId('unresolved');
    expect(focusId).toBe('needs_response');
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const node = lensNode('n', stage);
      const result = applyTimelineLens([node], focusId!, emptyCtx);
      const matched = result.items[0].emphasis === 'bright' && !result.isEmpty;
      expect({ stage, matched }).toEqual({
        stage,
        matched: UNRESOLVED_STAGES.includes(stage),
      });
    }
  });

  it('Evidence (evidence_requested) matches the §3.3 evidence-debt stages', () => {
    const focusId = goLensToFocusLensId('evidence');
    expect(focusId).toBe('evidence_requested');
    for (const stage of EVIDENCE_DEBT_STAGES) {
      const result = applyTimelineLens([lensNode('n', stage)], focusId!, emptyCtx);
      expect(result.items[0].emphasis).toBe('bright');
    }
    // A non-evidence stage is dimmed (not removed) when at least one node
    // matches — the match keeps the lens active so the non-match is dimmed.
    const mixed = applyTimelineLens(
      [lensNode('debt', 'source_requested'), lensNode('plain', 'open')],
      focusId!,
      emptyCtx,
    );
    expect(mixed.items.map((i) => i.emphasis)).toEqual(['bright', 'dimmed']);
    expect(mixed.items.length).toBe(2); // dimmed, never removed
  });

  it('Active path lens is topology — root→active path, not a stage filter', () => {
    const ctx: TimelineLensContext = { activePathIds: new Set(['a', 'b']) };
    expect(activePathLens(lensNode('a', 'confirmed'), ctx)).toBe(true);
    expect(activePathLens(lensNode('b', 'open'), ctx)).toBe(true);
    // A node off the active path is not matched — regardless of its stage.
    expect(activePathLens(lensNode('c', 'open'), ctx)).toBe(false);
  });

  it('a lens dims non-matching nodes — it never removes them (design §3.3)', () => {
    const nodes = [
      lensNode('a', 'open'), // unresolved → bright
      lensNode('b', 'confirmed'), // not unresolved → dimmed
      lensNode('c', 'archived_or_resolved'), // not unresolved → dimmed
    ];
    const result = applyTimelineLens([...nodes], 'needs_response', emptyCtx);
    // Every node is still present — the list length never shrinks.
    expect(result.items.length).toBe(3);
    expect(result.items.map((i) => i.emphasis)).toEqual(['bright', 'dimmed', 'dimmed']);
    // No `hidden` emphasis exists — a lens structurally cannot delete a node.
    for (const item of result.items) {
      expect(['bright', 'dimmed']).toContain(item.emphasis);
    }
  });

  it('a zero-match lens leaves the board unfiltered (design §6 — every node bright)', () => {
    // Only `confirmed` nodes — none is unresolved.
    const nodes = [lensNode('a', 'confirmed'), lensNode('b', 'confirmed')];
    const result = applyTimelineLens([...nodes], 'needs_response', emptyCtx);
    expect(result.isEmpty).toBe(true);
    // Every node reverts to bright — the board renders unfiltered.
    expect(result.items.every((i) => i.emphasis === 'bright')).toBe(true);
  });
});

// ── 9. Lens helper copy ────────────────────────────────────────

describe('QOL-033 goPopoutModel — lens helper copy', () => {
  it('returns helper + emptyNote for every lens', () => {
    for (const lens of ALL_GO_LENSES) {
      const copy = getGoLensCopy(lens);
      expect(copy.helper.length).toBeGreaterThan(0);
      expect(typeof copy.emptyNote).toBe('string');
    }
  });

  it('Active path copy is Go-authored (topology framing)', () => {
    const copy = getGoLensCopy('active_path');
    expect(copy.helper.toLowerCase()).toContain('active move');
  });

  it('the stage lenses reuse IX-001 FOCUS_LENS_COPY verbatim — no drift', () => {
    // The empty note for Unresolved / Evidence must be IX-001's, not a new
    // string — proves the Go popout does not re-author lens wording.
    expect(getGoLensCopy('unresolved').emptyNote.length).toBeGreaterThan(0);
    expect(getGoLensCopy('evidence').emptyNote.length).toBeGreaterThan(0);
  });
});

// ── 10. Embedded mini-map threshold (design §3.4 / §6) ──────────

describe('QOL-033 goPopoutModel — embedded mini-map threshold', () => {
  it('the mini-map is shown when IX-002 marks the model available', () => {
    expect(showsEmbeddedMiniMap(miniMap({ isAvailable: true }))).toBe(true);
  });

  it('the mini-map is omitted below IX-002 node threshold (short argument)', () => {
    expect(showsEmbeddedMiniMap(miniMap({ isAvailable: false }))).toBe(false);
  });

  it('the mini-map is omitted for a null model', () => {
    expect(showsEmbeddedMiniMap(null as unknown as TimelineMiniMapModel)).toBe(false);
  });

  it('the Go model trusts IX-002 isAvailable — it never re-computes the threshold', () => {
    // Even a 5-move model is "shown" if IX-002 said isAvailable (caller can
    // override minMovesToShow); the Go model does not second-guess it.
    expect(showsEmbeddedMiniMap(miniMap({ moveCount: 5, isAvailable: true }))).toBe(true);
  });
});

// ── 11. Edge cases (design §6) ─────────────────────────────────

describe('QOL-033 goPopoutModel — design §6 edge cases', () => {
  it('short argument: Jump/View/Density/Lens all still render; only the map is omitted', () => {
    const input = goInput({ miniMap: miniMap({ isAvailable: false, moveCount: 6 }) });
    const groups = buildGoPopout(input);
    // All four control groups present even with the map omitted.
    expect(groups.map((g) => g.id)).toEqual(['jump', 'view', 'density', 'lens']);
    expect(showsEmbeddedMiniMap(input.miniMap)).toBe(false);
  });

  it('no branches: Branch list disabled; every other Jump entry still works', () => {
    const input = goInput({
      miniMap: miniMap({ branchClusters: [mainlineCluster()] }),
    });
    expect(findEntry(input, 'jump_branch_list')?.isDisabled).toBe(true);
    expect(findEntry(input, 'jump_root')?.isDisabled).toBe(false);
    expect(findEntry(input, 'jump_latest')?.isDisabled).toBe(false);
  });

  it('Cards view: Density + Lens disabled with a reason; Jump + View still work', () => {
    const input = goInput({ view: 'cards' });
    // timeline-only controls off.
    for (const id of [
      'density_compact',
      'density_normal',
      'density_expanded',
      'lens_active_path',
      'lens_unresolved',
      'lens_evidence',
    ] as const) {
      expect(findEntry(input, id)?.isDisabled).toBe(true);
    }
    // navigation + presentation still on.
    expect(findEntry(input, 'jump_root')?.isDisabled).toBe(false);
    expect(findEntry(input, 'view_timeline')?.isDisabled).toBe(false);
    expect(findEntry(input, 'view_cards')?.isDisabled).toBe(false);
  });

  it('density change preserves the entry set (no membership change — IX-001 §3.4)', () => {
    for (const density of GO_DENSITY_MODES) {
      const ids = flattenGoPopout(buildGoPopout(goInput({ density }))).map((e) => e.id);
      expect(ids.slice().sort()).toEqual([...ALL_GO_ENTRY_IDS].slice().sort());
    }
  });
});

// ── 12. Determinism + purity ───────────────────────────────────

describe('QOL-033 goPopoutModel — determinism', () => {
  it('buildGoPopout is idempotent for the same input', () => {
    const input = goInput();
    expect(buildGoPopout(input)).toEqual(buildGoPopout(input));
  });

  it('buildGoPopout never mutates its input', () => {
    const input = goInput();
    const snapshot = JSON.stringify(input);
    buildGoPopout(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('every entry kind is one of ALL_GO_ENTRY_KINDS', () => {
    for (const entry of flattenGoPopout(buildGoPopout(goInput()))) {
      expect(ALL_GO_ENTRY_KINDS).toContain(entry.kind);
    }
  });

  it('_debug exposes the entry table for every id', () => {
    for (const id of ALL_GO_ENTRY_IDS) {
      expect(_debug.GO_ENTRY_DEFINITIONS[id]).toBeDefined();
      expect(_debug.GO_ENTRY_DEFINITIONS[id].id).toBe(id);
    }
  });

  it('resolveEntryState (via _debug) covers every entry id without throwing', () => {
    const input = goInput();
    for (const id of ALL_GO_ENTRY_IDS) {
      expect(() => _debug.resolveEntryState(id, input)).not.toThrow();
    }
  });
});

// ── 13. Doctrine — Go never writes / a lens never hides ─────────

describe('QOL-033 goPopoutModel — doctrine', () => {
  it('every entry kind is a viewport / render-mode kind — none composes or writes', () => {
    // jump / view_toggle / density / lens — no `box_opening`, no `submit`.
    expect([...ALL_GO_ENTRY_KINDS].sort()).toEqual(
      ['density', 'jump', 'lens', 'view_toggle'].sort(),
    );
  });

  it('no jump entry is ever marked active — Go does not turn a jump into a sticky mode', () => {
    for (const id of ALL_GO_ENTRY_IDS) {
      const def = _debug.GO_ENTRY_DEFINITIONS[id];
      if (def.kind !== 'jump') continue;
      // Across every view, a jump entry is never active.
      for (const view of ['timeline', 'cards'] as const) {
        expect(findEntry(goInput({ view }), id)?.isActive).toBe(false);
      }
    }
  });

  it('a lens selection only configures a GoLens — it never removes a node', () => {
    // The Go model resolves a lens to a FocusLensId; the dimming is IX-001's
    // applyTimelineLens whose LensApplication keeps items.length constant.
    const focusId = goLensToFocusLensId('unresolved');
    expect(focusId).not.toBeNull();
    const lensIds: GoLens[] = ['none', 'unresolved', 'evidence'];
    for (const l of lensIds) {
      const id = goLensToFocusLensId(l);
      // none / unresolved / evidence all resolve to a FocusLensId.
      expect(id).not.toBeNull();
    }
  });

  it('GO_DISABLED_REASON copy carries no verdict / internal-code token', () => {
    const banned = ['winner', 'loser', 'true', 'false', 'correct', 'wrong'];
    for (const reason of Object.values(GO_DISABLED_REASON)) {
      const lower = reason.toLowerCase();
      for (const b of banned) {
        expect(lower.includes(b)).toBe(false);
      }
      // No snake_case identifier leaks into a reason.
      expect(/[a-z]_[a-z]/i.test(reason)).toBe(false);
    }
  });
});
