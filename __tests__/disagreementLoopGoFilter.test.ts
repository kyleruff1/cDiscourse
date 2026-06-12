/**
 * REF-004 — Go handoff: the 8-state → Go-lens map, and the dims-never-hides
 * invariant.
 *
 *   1. `issueStateToGoLens` returns the documented `GoLens` for each of the 8
 *      `IssueState`s; the result is always a member of `ALL_GO_LENSES`.
 *   2. `goLensToFocusLensId` of each result is a `TIMELINE_LENS_IDS` member
 *      (the stage lenses) or `null` (active_path — a topology filter).
 *   3. `applyTimelineLens(nodes, focusLensId, ctx)` DIMS, never hides:
 *      `items.length === nodes.length` for every mapped lens, every
 *      `emphasis ∈ {'bright','dimmed'}` (no 'hidden' value exists), and a
 *      zero-match lens reverts every node to bright with `isEmpty: true`.
 *
 * Pure-TS model coverage — no React, no Supabase, no fetch.
 */

import {
  issueStateToGoLens,
  ISSUE_STATE_TO_GO_LENS,
  goLensToFocusLensId,
  ALL_GO_LENSES,
  type GoLens,
} from '../src/features/arguments/oneBox/goPopoutModel';
import {
  applyTimelineLens,
  TIMELINE_LENS_IDS,
  type FocusLensId,
  type LensEmphasis,
  type TimelineLensNode,
  type TimelineLensContext,
} from '../src/features/arguments/timelineDensityLensModel';
import {
  ALL_ISSUE_STATES,
  type IssueState,
} from '../src/features/refereeLoop';
import {
  ALL_POINT_LIFECYCLE_STATES,
  type PointLifecycleState,
} from '../src/features/lifecycle';

/** The documented 8-state → 3-lens affinity map (REF-004 design §"Go handoff"). */
const EXPECTED: Readonly<Record<IssueState, GoLens>> = {
  open: 'unresolved',
  source_requested: 'evidence',
  quote_requested: 'evidence',
  answered: 'active_path',
  narrowed: 'active_path',
  conceded: 'active_path',
  synthesis_ready: 'active_path',
  moved_on: 'active_path',
};

/** A timeline node carrying a LIFE-001 lifecycle state (mirrors the IX-001 /
 *  goPopoutModel test node). The lens predicates read only the fields below. */
function lensNode(id: string, stage: PointLifecycleState | null): TimelineLensNode {
  return {
    messageId: id,
    lifecycleState: stage,
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

describe('REF-004 GoFilter — issueStateToGoLens maps all 8 states', () => {
  it('every IssueState is keyed (the map is total + frozen)', () => {
    expect(Object.keys(ISSUE_STATE_TO_GO_LENS).sort()).toEqual([...ALL_ISSUE_STATES].sort());
    expect(Object.isFrozen(ISSUE_STATE_TO_GO_LENS)).toBe(true);
  });

  it.each(ALL_ISSUE_STATES.map((s) => [s] as const))(
    'state %s → the documented GoLens, which is a member of ALL_GO_LENSES',
    (state) => {
      const lens = issueStateToGoLens(state);
      expect(lens).toBe(EXPECTED[state]);
      expect(ALL_GO_LENSES).toContain(lens);
      // The map never resolves to the unfiltered baseline — every active issue
      // picks a real focusing lens.
      expect(lens).not.toBe('none');
    },
  );

  it('the standalone function agrees with the frozen map for every state', () => {
    for (const state of ALL_ISSUE_STATES) {
      expect(issueStateToGoLens(state)).toBe(ISSUE_STATE_TO_GO_LENS[state]);
    }
  });
});

describe('REF-004 GoFilter — each mapped lens resolves to a timeline lens or null', () => {
  it.each(ALL_ISSUE_STATES.map((s) => [s] as const))(
    'goLensToFocusLensId(issueStateToGoLens(%s)) is a TIMELINE_LENS_IDS member or null (active_path)',
    (state) => {
      const lens = issueStateToGoLens(state);
      const focusId = goLensToFocusLensId(lens);
      if (lens === 'active_path') {
        // Topology filter — served by IX-001's activePathLens, not a FocusLensId.
        expect(focusId).toBeNull();
      } else {
        expect(focusId).not.toBeNull();
        expect(TIMELINE_LENS_IDS).toContain(focusId as FocusLensId);
      }
    },
  );
});

describe('REF-004 GoFilter — applyTimelineLens dims, never hides', () => {
  // The two stage lenses every issue can resolve to (active_path uses the
  // separate activePathLens helper, not applyTimelineLens).
  const STAGE_FOCUS_IDS: ReadonlyArray<FocusLensId> = ['needs_response', 'evidence_requested'];

  it('LensEmphasis is a closed {bright, dimmed} union — no hidden value is ever produced', () => {
    const nodes = ALL_POINT_LIFECYCLE_STATES.map((s, i) => lensNode(`n${i}`, s));
    for (const focusId of STAGE_FOCUS_IDS) {
      const result = applyTimelineLens(nodes, focusId, emptyCtx);
      // (1) length never changes — a lens cannot drop a node.
      expect(result.items).toHaveLength(nodes.length);
      // (3) emphasis is only ever bright | dimmed.
      const seen = new Set<LensEmphasis>(result.items.map((i) => i.emphasis));
      for (const e of seen) {
        expect(['bright', 'dimmed']).toContain(e);
      }
      expect(seen.has('dimmed' as LensEmphasis) || seen.has('bright' as LensEmphasis)).toBe(true);
      // No item carries a 'hidden' emphasis (the structural impossibility).
      expect(result.items.every((i) => (i.emphasis as string) !== 'hidden')).toBe(true);
    }
  });

  it('a zero-match lens reverts every node to bright with isEmpty=true (board never emptied)', () => {
    // `synthesis_ready` matches neither needs_response nor evidence_requested.
    const nodes = [lensNode('a', 'synthesis_ready'), lensNode('b', 'synthesis_ready')];
    for (const focusId of STAGE_FOCUS_IDS) {
      const result = applyTimelineLens(nodes, focusId, emptyCtx);
      expect(result.isEmpty).toBe(true);
      expect(result.matchCount).toBe(0);
      expect(result.items).toHaveLength(nodes.length);
      expect(result.items.every((i) => i.emphasis === 'bright')).toBe(true);
    }
  });

  it('the resolved lens for source_requested / quote_requested actually brightens those nodes', () => {
    // The Go affinity is navigationally meaningful: an evidence-debt issue's
    // lens keeps the evidence-debt node bright while dimming an unrelated node.
    const focusId = goLensToFocusLensId(issueStateToGoLens('source_requested'))!;
    const result = applyTimelineLens(
      [lensNode('debt', 'source_requested'), lensNode('other', 'answered')],
      focusId,
      emptyCtx,
    );
    expect(result.isEmpty).toBe(false);
    const byId = new Map(result.items.map((i) => [i.item.messageId, i.emphasis]));
    expect(byId.get('debt')).toBe('bright');
    expect(byId.get('other')).toBe('dimmed');
  });
});
