/**
 * QOL-033 — Go popout content model (navigate & re-view, pure TypeScript).
 *
 * `buildGoPopout(input)` is the pure function that produces the Go popout's
 * grouped entries (QOL-033 design §3.2 / §5). The Go popout is the
 * navigate-and-re-view surface — it moves the viewport and reconfigures the
 * board's render mode. It is the third popout that stands on the QOL-030
 * chassis, beside Act (QOL-031) and Inspect (QOL-032).
 *
 * The Go popout has FOUR controls (design §3.2):
 *
 *   1. **Jump**    — Root · Latest · Hot zone · Branch list. Pans / focuses
 *                    the board. NO route transition.
 *   2. **View**    — Timeline ⇄ Cards. The existing view toggle — re-presents,
 *                    keeps the active node.
 *   3. **Density** — Compact · Normal · Expanded (IX-001). Sizes the board;
 *                    preserves the active node; timeline-only.
 *   4. **Lens**    — Active path · Unresolved · Evidence. A focus filter that
 *                    DIMS non-matching nodes — it HIDES NOTHING (design §3.3).
 *
 * Doctrine anchors — read this before changing anything (design §8,
 * cdiscourse-doctrine §1/§2, timeline-grammar):
 *
 *   - Go performs NO write and NO content mutation — viewport + render-mode
 *     only. This module never imports `supabase`, `fetch`, a router, React,
 *     or any network primitive.
 *   - A lens **dims, never hides**. The lens entries here only configure
 *     which `FocusLensId` is active; the actual dimming is `applyTimelineLens`
 *     (IX-001), whose `LensEmphasis` has no `hidden` value. All nodes stay
 *     navigable.
 *   - "Hot zone" / heat is an ACTIVITY signal, never correctness. The hot
 *     zone is `timelineMiniMapModel.findHotZone` — the LONGEST warm/hot run,
 *     chosen by length not by "hottest". No verdict / winner / loser token
 *     appears in any label.
 *   - Deterministic pure projection over already-built models — IX-002
 *     `timelineMiniMapModel`, IX-001 density + lens, LIFE-001 stages,
 *     BR-001/004 topology — all consumed READ-ONLY. This module re-derives
 *     none of them. No AI. No `Date.now()`.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import type { TimelineMiniMapModel } from '../timelineMiniMapModel';
import {
  FOCUS_LENS_COPY,
  TIMELINE_LENS_IDS,
  type FocusLensId,
  type GalleryDensityMode,
} from '../timelineDensityLensModel';
import type { BoxView } from './boxModel';

/**
 * The two stage-lens `FocusLensId`s the Go popout maps onto — `needs_response`
 * (Unresolved) and `evidence_requested` (Evidence). Both are members of
 * IX-001's `TIMELINE_LENS_IDS` (the timeline-meaningful subset). This frozen
 * tuple makes the membership a runtime fact `goLensToFocusLensId` and the
 * tests can both assert, instead of leaving it to a doc comment.
 */
export const GO_STAGE_LENS_FOCUS_IDS: ReadonlyArray<FocusLensId> = Object.freeze(
  (['needs_response', 'evidence_requested'] as const).filter((id) =>
    TIMELINE_LENS_IDS.includes(id),
  ),
);

// ── Group vocabulary ───────────────────────────────────────────

/**
 * The four Go-popout control groups (QOL-033 design §3.2). The popout
 * renders the groups in this order — Jump first (the most common reason to
 * open Go), then View, Density, and finally the focus Lens.
 */
export type GoGroupId = 'jump' | 'view' | 'density' | 'lens';

/** Frozen, ordered list of every Go group. */
export const GO_GROUP_ORDER: ReadonlyArray<GoGroupId> = Object.freeze([
  'jump',
  'view',
  'density',
  'lens',
]);

/** Plain-language group headings. No verdict vocabulary (design §8). */
export const GO_GROUP_LABEL: Readonly<Record<GoGroupId, string>> = Object.freeze({
  jump: 'Jump',
  view: 'View',
  density: 'Density',
  lens: 'Lens',
});

// ── Entry vocabulary ───────────────────────────────────────────

/**
 * The kind of a Go-popout entry. Every Go entry reconfigures the viewport
 * or the render mode — none of them composes or writes:
 *
 *  - `jump`        — pans / focuses the board to a target node. No route
 *                    transition.
 *  - `view_toggle` — switches Timeline ⇄ Cards (presentation).
 *  - `density`     — sets the IX-001 density mode.
 *  - `lens`        — sets the active IX-001 focus lens (dims, never hides).
 */
export type GoEntryKind = 'jump' | 'view_toggle' | 'density' | 'lens';

/** Frozen list of every Go entry kind. */
export const ALL_GO_ENTRY_KINDS: ReadonlyArray<GoEntryKind> = Object.freeze([
  'jump',
  'view_toggle',
  'density',
  'lens',
]);

/**
 * A stable identifier for every Go-popout entry. The jump ids name a jump
 * target; the view / density / lens ids name a render-mode option.
 *
 * UX-001.4 — `jump_leave_room` added. Routes through the existing
 * `App.tsx::handleLeaveRoom` path via `GoPopoutProps.onLeaveRoom`. NOT
 * a new room-exit path.
 */
export type GoEntryId =
  // Jump group (design §3.2 row 1).
  | 'jump_root'
  | 'jump_latest'
  | 'jump_hot_zone'
  | 'jump_branch_list'
  // UX-001.4 — Leave-room jump entry. Always present; disabled when the
  // host omits the `onLeaveRoom` callback.
  | 'jump_leave_room'
  // View group (design §3.2 row 2).
  | 'view_timeline'
  | 'view_cards'
  // Density group (design §3.2 row 3 — IX-001).
  | 'density_compact'
  | 'density_normal'
  | 'density_expanded'
  // Lens group (design §3.2 row 4 / §3.3 — IX-001 focus lenses).
  | 'lens_active_path'
  | 'lens_unresolved'
  | 'lens_evidence';

// ── Jump targets ───────────────────────────────────────────────

/**
 * What a `jump` entry resolves to. `messageId` is the node to activate +
 * scroll to (`null` when the jump cannot resolve — e.g. an empty timeline,
 * or the Branch-list entry which opens a sub-picker rather than jumping to
 * one node). The host pans the board; there is NO route transition (design
 * §3.2).
 *
 * UX-001.4 — `leave_room` added. Calls `App.tsx::handleLeaveRoom` via
 * the host wiring; it is the SAME path UX-001.2's strip-leave uses,
 * NOT a new path.
 */
export type GoJumpTarget = 'root' | 'latest' | 'hot_zone' | 'branch_list' | 'leave_room';

/** Frozen list of every jump target. */
export const ALL_GO_JUMP_TARGETS: ReadonlyArray<GoJumpTarget> = Object.freeze([
  'root',
  'latest',
  'hot_zone',
  'branch_list',
  'leave_room',
]);

// ── Density ↔ entry mapping ────────────────────────────────────

/**
 * The three density entries the Go popout exposes (design §3.2 row 3).
 * IX-001's `GalleryDensityMode` also has a 4th `scan` tier — that tier is
 * gallery-only and clamps to `compact` for the in-room board, so the Go
 * popout deliberately offers only the three timeline-meaningful modes.
 */
export const GO_DENSITY_MODES: ReadonlyArray<GalleryDensityMode> = Object.freeze([
  'compact',
  'normal',
  'expanded',
]);

/** Map a density `GoEntryId` to its `GalleryDensityMode`, or `null`. */
export function goEntryToDensityMode(entryId: GoEntryId): GalleryDensityMode | null {
  switch (entryId) {
    case 'density_compact':
      return 'compact';
    case 'density_normal':
      return 'normal';
    case 'density_expanded':
      return 'expanded';
    default:
      return null;
  }
}

/** Map a `GoEntryId` to the `BoxView` it selects, or `null`. */
export function goEntryToView(entryId: GoEntryId): BoxView | null {
  switch (entryId) {
    case 'view_timeline':
      return 'timeline';
    case 'view_cards':
      return 'cards';
    default:
      return null;
  }
}

/** Map a `GoEntryId` to the `GoJumpTarget` it resolves, or `null`. */
export function goEntryToJumpTarget(entryId: GoEntryId): GoJumpTarget | null {
  switch (entryId) {
    case 'jump_root':
      return 'root';
    case 'jump_latest':
      return 'latest';
    case 'jump_hot_zone':
      return 'hot_zone';
    case 'jump_branch_list':
      return 'branch_list';
    case 'jump_leave_room':
      // UX-001.4 — Leave-room jump entry.
      return 'leave_room';
    default:
      return null;
  }
}

// ── Lens ↔ entry mapping ───────────────────────────────────────

/**
 * The three focus lenses the Go popout exposes (design §3.2 row 4 / §3.3):
 *
 *  - **Active path** → a TOPOLOGY filter (root → active node). IX-001 keeps
 *    this as a separate `activePathLens` helper, not a `FocusLensId` — it is
 *    not a stage filter (design §3.3 "topology, not stage"). The Go popout
 *    represents it with a dedicated `lens_active_path` entry.
 *  - **Unresolved** → IX-001's `needs_response` lens — the §3.3 stage set
 *    `open · rebutted · clarified · source_requested · quote_requested ·
 *    narrowed`.
 *  - **Evidence**  → IX-001's `evidence_requested` lens — the §3.3 stage set
 *    `source_requested · quote_requested · sourced`.
 *
 * `GoLens` is the Go popout's own union; `goLensToFocusLensId` maps the two
 * stage lenses onto their `FocusLensId`. `active_path` maps to `null`
 * (`activePathLens` is the dedicated helper — not a `FocusLensId`).
 */
export type GoLens = 'none' | 'active_path' | 'unresolved' | 'evidence';

/** Frozen list of every Go lens, `none` (unfiltered baseline) first. */
export const ALL_GO_LENSES: ReadonlyArray<GoLens> = Object.freeze([
  'none',
  'active_path',
  'unresolved',
  'evidence',
]);

/** The default Go lens — `none`, the unfiltered baseline (design §3.3). */
export const DEFAULT_GO_LENS: GoLens = 'none';

/**
 * Map a `GoLens` to the IX-001 `FocusLensId` it dims with. `active_path`
 * resolves to `null` — it is a topology filter served by IX-001's separate
 * `activePathLens` helper, not a `FocusLensId`. `none` resolves to `'none'`
 * (IX-001's unfiltered baseline). The two returned ids are members of
 * `TIMELINE_LENS_IDS` — the timeline-meaningful subset.
 */
export function goLensToFocusLensId(lens: GoLens): FocusLensId | null {
  switch (lens) {
    case 'none':
      return 'none';
    case 'unresolved':
      return 'needs_response';
    case 'evidence':
      return 'evidence_requested';
    case 'active_path':
      // Topology filter — IX-001 serves it via `activePathLens`, not a
      // `FocusLensId`. The Go renderer calls `activePathLens` directly.
      return null;
    default: {
      // Exhaustiveness guard — unreachable for the typed union.
      const never: never = lens;
      return never;
    }
  }
}

/** Map a lens `GoEntryId` to its `GoLens`, or `null`. */
export function goEntryToLens(entryId: GoEntryId): GoLens | null {
  switch (entryId) {
    case 'lens_active_path':
      return 'active_path';
    case 'lens_unresolved':
      return 'unresolved';
    case 'lens_evidence':
      return 'evidence';
    default:
      return null;
  }
}

// ── Entry definitions ──────────────────────────────────────────

/**
 * A static Go-entry definition. `label` / `accessibilityLabel` are plain
 * English — no verdict / amplification / internal-code token. Every string
 * is scanned by `__tests__/oneBoxCopyBanList.test.ts`.
 */
interface GoEntryDefinition {
  id: GoEntryId;
  kind: GoEntryKind;
  group: GoGroupId;
  /** Plain-language label. ≤ 24 chars. */
  label: string;
  /** Verbose accessibility label. ≤ 80 chars. */
  accessibilityLabel: string;
  /**
   * Single-character key badge (the §5 wireframe shows `R L Z B`, `T`,
   * `1 2 3`, `P U E`). The keyboard *layer* is IX-003 — this is the visible
   * badge slot only.
   */
  keyBadge: string;
}

/**
 * The full Go-entry table. The labels are authored to the §5 wireframe —
 * Jump (Root / Latest / Hot zone / Branches), View (Timeline / Cards),
 * Density (Compact / Normal / Expanded), Lens (Active path / Unresolved /
 * Evidence).
 */
const GO_ENTRY_DEFINITIONS: Readonly<Record<GoEntryId, GoEntryDefinition>> = Object.freeze({
  // ── Jump group ──
  jump_root: Object.freeze({
    id: 'jump_root',
    kind: 'jump',
    group: 'jump',
    label: 'Root',
    accessibilityLabel: 'Jump to the opening claim',
    keyBadge: 'R',
  }),
  jump_latest: Object.freeze({
    id: 'jump_latest',
    kind: 'jump',
    group: 'jump',
    label: 'Latest',
    accessibilityLabel: 'Jump to the latest move',
    keyBadge: 'L',
  }),
  jump_hot_zone: Object.freeze({
    id: 'jump_hot_zone',
    kind: 'jump',
    group: 'jump',
    label: 'Hot zone',
    // Heat is framed as activity, never a result (doctrine §2).
    accessibilityLabel: 'Jump to the busiest run of recent activity',
    keyBadge: 'Z',
  }),
  jump_branch_list: Object.freeze({
    id: 'jump_branch_list',
    kind: 'jump',
    group: 'jump',
    label: 'Branches',
    accessibilityLabel: 'Open the list of side branches to jump to',
    keyBadge: 'B',
  }),
  // UX-001.4 — Leave-room entry. Calls the existing handleLeaveRoom
  // path via the host. Plain English; matches the strip's "Leave"
  // label so muscle memory carries.
  jump_leave_room: Object.freeze({
    id: 'jump_leave_room',
    kind: 'jump',
    group: 'jump',
    label: 'Leave argument',
    accessibilityLabel: 'Leave this argument and return to the conversation list',
    keyBadge: 'X',
  }),
  // ── View group ──
  view_timeline: Object.freeze({
    id: 'view_timeline',
    kind: 'view_toggle',
    group: 'view',
    label: 'Timeline',
    accessibilityLabel: 'Show the board as a timeline',
    keyBadge: 'T',
  }),
  view_cards: Object.freeze({
    id: 'view_cards',
    kind: 'view_toggle',
    group: 'view',
    label: 'Cards',
    accessibilityLabel: 'Show the board as cards',
    keyBadge: 'C',
  }),
  // ── Density group (IX-001) ──
  density_compact: Object.freeze({
    id: 'density_compact',
    kind: 'density',
    group: 'density',
    label: 'Compact',
    accessibilityLabel: 'Use the compact board density',
    keyBadge: '1',
  }),
  density_normal: Object.freeze({
    id: 'density_normal',
    kind: 'density',
    group: 'density',
    label: 'Normal',
    accessibilityLabel: 'Use the normal board density',
    keyBadge: '2',
  }),
  density_expanded: Object.freeze({
    id: 'density_expanded',
    kind: 'density',
    group: 'density',
    label: 'Expanded',
    accessibilityLabel: 'Use the expanded board density',
    keyBadge: '3',
  }),
  // ── Lens group (IX-001 focus lenses — design §3.3) ──
  lens_active_path: Object.freeze({
    id: 'lens_active_path',
    kind: 'lens',
    group: 'lens',
    label: 'Active path',
    accessibilityLabel: 'Focus the path from the opening claim to the active move',
    keyBadge: 'P',
  }),
  lens_unresolved: Object.freeze({
    id: 'lens_unresolved',
    kind: 'lens',
    group: 'lens',
    label: 'Unresolved',
    accessibilityLabel: 'Focus the moves that still need a response',
    keyBadge: 'U',
  }),
  lens_evidence: Object.freeze({
    id: 'lens_evidence',
    kind: 'lens',
    group: 'lens',
    label: 'Evidence',
    accessibilityLabel: 'Focus the moves where a source is owed or attached',
    keyBadge: 'E',
  }),
});

/** Frozen array of every Go entry id. Tests iterate this. */
export const ALL_GO_ENTRY_IDS: ReadonlyArray<GoEntryId> = Object.freeze(
  Object.keys(GO_ENTRY_DEFINITIONS) as GoEntryId[],
);

// ── Disabled-reason copy ───────────────────────────────────────

/**
 * Plain-language disabled reasons (design §6 edge cases). A disabled Go
 * entry is never silently omitted — it renders with one of these one-line
 * reasons (the QOL-030 `PopoutEntry` chassis shows the reason under the
 * row).
 */
export const GO_DISABLED_REASON = Object.freeze({
  /** §6 — "No branches → the Branch-list entry is disabled". */
  noBranches: 'No side branches yet.',
  /** §6 — "Cards view → Density + the mini-map are timeline-only". */
  timelineOnly: 'Available in Timeline view.',
  /** A hot zone needs a contiguous warm/hot run; none exists yet. */
  noHotZone: 'No hot zone yet — activity is spread out.',
  /** The entry's option is already the active one. */
  alreadyActive: 'Already selected.',
  /** UX-001.4 — Leave-room callback not wired by the host. */
  leaveRoomUnavailable: 'Leaving is not available here.',
});

// ── Lens helper copy ───────────────────────────────────────────

/**
 * Build the Go popout's lens helper / empty copy. The Go popout reuses
 * IX-001's `FOCUS_LENS_COPY` verbatim for the two stage lenses so lens
 * wording never drifts; `active_path` is a topology filter with its own
 * Go-authored copy. `none` returns the unfiltered-baseline copy.
 *
 * Returns `{ helper, emptyNote }`:
 *  - `helper`    — one line shown when the lens is active / in the picker.
 *  - `emptyNote` — shown when the lens matches zero nodes (design §6 "a
 *    lens that matches zero nodes" — the board is left unfiltered).
 */
export function getGoLensCopy(lens: GoLens): { helper: string; emptyNote: string } {
  if (lens === 'active_path') {
    return {
      helper: 'Stay on the line from the opening claim to the active move.',
      emptyNote: 'No active move selected yet.',
    };
  }
  const focusLensId = goLensToFocusLensId(lens);
  // `none` and the two stage lenses all map to a FocusLensId.
  const copy = FOCUS_LENS_COPY[focusLensId ?? 'none'];
  return { helper: copy.helper, emptyNote: copy.emptyNote };
}

// ── Public types — the popout output ───────────────────────────

/** A single rendered Go-popout entry (the chassis `PopoutEntry` consumes this). */
export interface GoPopoutEntry {
  /** Stable entry id. */
  id: GoEntryId;
  /** Entry kind — jump / view-toggle / density / lens. */
  kind: GoEntryKind;
  /** Plain-language label. */
  label: string;
  /** Verbose accessibility label. */
  accessibilityLabel: string;
  /** Single-character key badge. */
  keyBadge: string;
  /**
   * True when this entry's option is the currently-active selection (the
   * active View, the active Density, the active Lens). The active jump
   * target is never "selected" — a jump is a one-shot action.
   */
  isActive: boolean;
  /** True when the entry is rendered but cannot be invoked. */
  isDisabled: boolean;
  /** One-line plain-language reason — present only when `isDisabled`. */
  disabledReason: string | null;
}

/** A labelled group of Go entries (the chassis `PopoutGroup` consumes this). */
export interface GoPopoutGroup {
  id: GoGroupId;
  /** Plain-language group heading. */
  label: string;
  entries: ReadonlyArray<GoPopoutEntry>;
}

/** Inputs to `buildGoPopout` (QOL-033 design §3.2 / §6). */
export interface BuildGoPopoutInput {
  /**
   * The IX-002 mini-map model — consumed READ-ONLY. The Go popout reads
   * `hotZone`, `branchClusters`, `isAvailable`, `moveCount`, `rootMessageId`,
   * `latestMessageId` from it; it re-derives none of them.
   */
  miniMap: TimelineMiniMapModel;
  /** The currently-active board view (Timeline / Cards). */
  view: BoxView;
  /** The currently-active IX-001 density mode. */
  density: GalleryDensityMode;
  /** The currently-active Go focus lens. */
  lens: GoLens;
  /**
   * UX-001.4 — true when the host has supplied an `onLeaveRoom` callback
   * (the existing `App.tsx::handleLeaveRoom` path). When false, the
   * `jump_leave_room` entry renders disabled with `leaveRoomUnavailable`.
   * Optional → defaults to `false` for existing callers that did not
   * supply leave-room wiring.
   */
  leaveRoomEnabled?: boolean;
}

// ── Hot-zone / branch availability ─────────────────────────────

/**
 * True when the mini-map has at least one side branch — the Branch-list
 * jump entry is enabled iff this is true (design §6 "no branches →
 * disabled"). Reads `miniMap.branchClusters` verbatim (a cluster with
 * `isMainline: false` is a genuine side branch).
 */
export function hasSideBranches(miniMap: TimelineMiniMapModel): boolean {
  if (!miniMap || !Array.isArray(miniMap.branchClusters)) return false;
  return miniMap.branchClusters.some((c) => c.isMainline === false);
}

/**
 * True when the mini-map has a hot zone — the Hot-zone jump entry is
 * enabled iff this is true. Reads `miniMap.hotZone` verbatim (IX-002's
 * `findHotZone` already chose it by run LENGTH, never by "hottest").
 */
export function hasHotZone(miniMap: TimelineMiniMapModel): boolean {
  return !!miniMap && miniMap.hotZone !== null && miniMap.hotZone !== undefined;
}

/**
 * True when the embedded mini-map strip should render inside the Go popout.
 * The mini-map appears only above IX-002's `MINI_MAP_MIN_MOVES` node
 * threshold (design §6 "short argument < 12 nodes → the mini-map strip is
 * omitted"). Reads `miniMap.isAvailable` verbatim — IX-002 owns the
 * threshold; this never re-computes it.
 */
export function showsEmbeddedMiniMap(miniMap: TimelineMiniMapModel): boolean {
  return !!miniMap && miniMap.isAvailable === true;
}

// ── buildGoPopout — the pure builder ───────────────────────────

/**
 * Per-entry: is this entry's option the active selection, and is it
 * disabled (with what reason)? Pure — every branch is design §3.2 / §6.
 */
function resolveEntryState(
  id: GoEntryId,
  input: BuildGoPopoutInput,
): { isActive: boolean; isDisabled: boolean; disabledReason: string | null } {
  const def = GO_ENTRY_DEFINITIONS[id];
  const cardsView = input.view === 'cards';

  switch (def.kind) {
    case 'jump': {
      // Jump entries are never "active" (a jump is a one-shot action).
      if (id === 'jump_branch_list') {
        // §6 — no branches → disabled with a reason.
        const enabled = hasSideBranches(input.miniMap);
        return {
          isActive: false,
          isDisabled: !enabled,
          disabledReason: enabled ? null : GO_DISABLED_REASON.noBranches,
        };
      }
      if (id === 'jump_hot_zone') {
        // A hot zone needs a contiguous warm/hot run — disable with a
        // reason when IX-002 found none.
        const enabled = hasHotZone(input.miniMap);
        return {
          isActive: false,
          isDisabled: !enabled,
          disabledReason: enabled ? null : GO_DISABLED_REASON.noHotZone,
        };
      }
      if (id === 'jump_leave_room') {
        // UX-001.4 — disabled when the host has not wired the
        // handleLeaveRoom callback (back-compat for callers that don't
        // supply leave-room). Plain-language reason; no internal code.
        const enabled = input.leaveRoomEnabled === true;
        return {
          isActive: false,
          isDisabled: !enabled,
          disabledReason: enabled ? null : GO_DISABLED_REASON.leaveRoomUnavailable,
        };
      }
      // Root / Latest — disabled only on a truly empty timeline (no node
      // to jump to). Mirrors `miniMap.rootMessageId` / `latestMessageId`.
      const targetId =
        id === 'jump_root' ? input.miniMap?.rootMessageId : input.miniMap?.latestMessageId;
      const enabled = targetId != null;
      return {
        isActive: false,
        isDisabled: !enabled,
        disabledReason: null,
      };
    }
    case 'view_toggle': {
      // The active view's entry is "selected"; the other is enabled.
      const entryView = goEntryToView(id);
      return {
        isActive: entryView === input.view,
        isDisabled: false,
        disabledReason: null,
      };
    }
    case 'density': {
      // §6 — Density is timeline-only. In Cards view every density entry is
      // disabled with the "available in Timeline view" reason.
      if (cardsView) {
        return {
          isActive: false,
          isDisabled: true,
          disabledReason: GO_DISABLED_REASON.timelineOnly,
        };
      }
      const entryDensity = goEntryToDensityMode(id);
      return {
        isActive: entryDensity === input.density,
        isDisabled: false,
        disabledReason: null,
      };
    }
    case 'lens': {
      // A lens dims the timeline board — it is meaningful in Timeline view
      // only. In Cards view the lens entries are disabled with the
      // timeline-only reason (the lens still DIMS, never hides, when active).
      const entryLens = goEntryToLens(id);
      if (cardsView) {
        return {
          isActive: false,
          isDisabled: true,
          disabledReason: GO_DISABLED_REASON.timelineOnly,
        };
      }
      return {
        isActive: entryLens === input.lens,
        isDisabled: false,
        disabledReason: null,
      };
    }
    default: {
      // Exhaustiveness guard — unreachable for the typed union.
      const never: never = def.kind;
      return never;
    }
  }
}

/**
 * Builds the Go popout content — the four control groups (Jump · View ·
 * Density · Lens) with each entry's active + disabled state resolved.
 *
 * The pipeline (QOL-033 design §3.2 / §6):
 *   1. For every `GoEntryId`, resolve `isActive` + `isDisabled` +
 *      `disabledReason` against the current view / density / lens / mini-map.
 *   2. Group into `GO_GROUP_ORDER` (Jump · View · Density · Lens),
 *      preserving the definition order within each group.
 *
 * Pure. Deterministic. Idempotent. No AI, no network, no `Date.now()`.
 *
 * Doctrine: Go produces NO write — every entry only reconfigures the
 * viewport or the render mode (design §8). The entries here are
 * configuration; the host applies the jump / view / density / lens. The
 * lens entries only *select* a `GoLens`; the actual dimming is IX-001's
 * `applyTimelineLens`, which can never remove a node.
 */
export function buildGoPopout(input: BuildGoPopoutInput): GoPopoutGroup[] {
  const groups: GoPopoutGroup[] = [];
  for (const groupId of GO_GROUP_ORDER) {
    const entries: GoPopoutEntry[] = [];
    for (const id of ALL_GO_ENTRY_IDS) {
      const def = GO_ENTRY_DEFINITIONS[id];
      if (def.group !== groupId) continue;
      const state = resolveEntryState(id, input);
      entries.push({
        id: def.id,
        kind: def.kind,
        label: def.label,
        accessibilityLabel: def.accessibilityLabel,
        keyBadge: def.keyBadge,
        isActive: state.isActive,
        isDisabled: state.isDisabled,
        disabledReason: state.disabledReason,
      });
    }
    // Every group has at least one entry — kept for symmetry with the Act
    // builder, which can produce empty groups.
    groups.push({
      id: groupId,
      label: GO_GROUP_LABEL[groupId],
      entries,
    });
  }
  return groups;
}

/**
 * Convenience: the flat ordered entry list (every group concatenated in
 * `GO_GROUP_ORDER`). Useful for tests + keyboard traversal.
 */
export function flattenGoPopout(groups: ReadonlyArray<GoPopoutGroup>): GoPopoutEntry[] {
  const flat: GoPopoutEntry[] = [];
  for (const g of groups) {
    for (const e of g.entries) flat.push(e);
  }
  return flat;
}

// ── _debug namespace — internal table access for tests ─────────

/**
 * Internal table access for tests. NOT part of the public API. The
 * leading underscore signals "test-only".
 */
export const _debug = Object.freeze({
  GO_ENTRY_DEFINITIONS,
  resolveEntryState,
});
