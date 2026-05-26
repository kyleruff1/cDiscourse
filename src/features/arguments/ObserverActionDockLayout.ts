/**
 * SC-005 — ObserverActionDockLayout
 *
 * Pure TypeScript layout / derivation logic for the collapsed observer
 * action dock. Split out of `ArgumentSideActionRail.tsx` so the breakpoint
 * rule, the four-way collapsed-label derivation, the category grouping
 * projection, and the narrow-sheet height cap are all unit-testable
 * without a render harness.
 *
 * No React, no Supabase, no network. Type-only re-uses from
 * `ArgumentSideActionRail` keep this module dependency-light.
 *
 * SC-005 is a LAYOUT card. It does NOT touch any Stage 6.4 action-set
 * definition. The dock derives — never stores — gameplay state; it reads
 * only viewerRole / bubbleActor / participantSide / hasSelectedNode /
 * viewport size. Heat, strength bands, and lifecycle are not read.
 */
import {
  RAIL_ACTION_CATEGORIES,
  RAIL_ACTION_CATEGORY_LABEL,
  groupRailActionsByCategory,
  type RailActionCategory,
  type RailActionWithCategory,
  type RailViewerRole,
  type RailBubbleActor,
} from './railActionCategories';

/**
 * Which physical layout the dock takes for the current viewport.
 *  'sheet' — narrow: bottom sheet, capped height.
 *  'side'  — wide:   anchored panel at bottom-right next to the board.
 *
 * Same string union name as `ArgumentComposerDock.DockLayoutVariant` by
 * intent — but a deliberately INDEPENDENT copy. SC-005 does not import the
 * composer's symbol (see docs/designs/SC-005.md "Risks": a shared
 * `dockLayout.ts` is a separate refactor card).
 */
export type DockLayoutVariant = 'sheet' | 'side';

/** Collapsed/expanded state of the dock. Local UI state, never persisted. */
export type DockExpansionState = 'collapsed' | 'expanded';

/**
 * The four-way "what is the user looking at" context that drives the
 * collapsed-state primary label. Derived from existing inputs only:
 * viewerRole + bubbleActor + whether a node is selected.
 */
export type DockContext =
  | 'observer_no_node' // observer, no node selected
  | 'observer_node' // observer, a node is selected
  | 'participant_own' // participant viewing own bubble
  | 'participant_other'; // participant viewing another's bubble

/** Render-ready strings for the collapsed pill / anchor chip. */
export interface CollapsedDockLabel {
  /**
   * Short visible text on the chip, e.g. "Watch". The caret glyph is
   * appended by the component, not stored here.
   */
  primary: string;
  /** accessibilityLabel — fuller phrasing for screen readers. */
  accessibilityLabel: string;
  /** accessibilityHint — what expanding does. */
  accessibilityHint: string;
}

/** A category section as rendered in the expanded dock. */
export interface DockCategorySection {
  category: RailActionCategory;
  /** RAIL_ACTION_CATEGORY_LABEL[category]; only consumed when showHeader. */
  headerLabel: string;
  actions: RailActionWithCategory[];
}

/** The fully-derived expanded-dock view model. */
export interface ExpandedDockViewModel {
  sections: DockCategorySection[];
  /**
   * True only when >= 2 sections are non-empty. When false, the single
   * section renders header-less (flat list).
   */
  showCategoryHeaders: boolean;
  /** Title shown in the dock header — context-derived, no verdict copy. */
  title: string;
}

/** Width (logical px) at or above which the dock is a side-anchored panel. */
export const DOCK_SIDE_BREAKPOINT = 720;

/** Narrow-sheet height cap, as a fraction of the viewport height. */
export const SHEET_MAX_VIEWPORT_FRACTION = 0.28;

/**
 * Floor for the narrow-sheet height. 168 px keeps two action rows plus a
 * header visible even on short devices.
 */
export const SHEET_MIN_HEIGHT_PX = 168;

/**
 * Pure breakpoint resolver — mirrors `resolveDockLayoutVariant`.
 *
 *  - width <= 0 / non-finite → 'side' (web static-export hydration first
 *    paint; the polished layout is the safer first paint, matching
 *    `resolveHeaderBreakpoint`'s non-positive = wide rule).
 *  - 0 < width < 720 → 'sheet' (bottom sheet on narrow viewports).
 *  - width >= 720 → 'side' (anchored panel on wide viewports).
 */
export function resolveObserverDockVariant(windowWidth: number): DockLayoutVariant {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) return 'side';
  return windowWidth < DOCK_SIDE_BREAKPOINT ? 'sheet' : 'side';
}

/**
 * Derive the four-way dock context from existing rail inputs.
 *
 *  - observer + no node selected → 'observer_no_node'
 *  - observer + a node selected  → 'observer_node'
 *  - participant on own bubble   → 'participant_own'
 *  - participant on other bubble → 'participant_other'
 *
 * Note: an observer ALWAYS gets the observer action set regardless of
 * `bubbleActor` (Stage 6.4 `getRailActions`). Only the collapsed LABEL
 * changes between `observer_no_node` and `observer_node`; the action set
 * does not.
 */
export function deriveDockContext(
  viewerRole: RailViewerRole,
  bubbleActor: RailBubbleActor,
  hasSelectedNode: boolean,
): DockContext {
  if (viewerRole === 'observer') {
    return hasSelectedNode ? 'observer_node' : 'observer_no_node';
  }
  return bubbleActor === 'self' ? 'participant_own' : 'participant_other';
}

/**
 * The four collapsed primary labels per the SC-005 issue scope. Visible
 * `primary` text only; the caret glyph is appended by the component.
 *
 * All four strings are ban-list-clean (activity words, never verdicts) —
 * verified by `sideActionDockNoVerdictCopy.test.ts`.
 */
export function buildCollapsedDockLabel(context: DockContext): CollapsedDockLabel {
  switch (context) {
    case 'observer_no_node':
      return {
        primary: 'Watch',
        accessibilityLabel: 'Watch — observer actions',
        accessibilityHint: 'Opens the observer action dock.',
      };
    case 'observer_node':
      return {
        primary: 'Actions on this point',
        accessibilityLabel: 'Actions on this point',
        accessibilityHint: 'Opens actions for the selected point.',
      };
    case 'participant_own':
      // UX-001.4 — After B.3 migration the own-bubble action set is
      // empty (qualifiers + request_deletion both migrated to Act). The
      // collapsed label points the user at the Act menu where those
      // affordances now live. Plain English; no verdict tokens.
      return {
        primary: 'Open Act',
        accessibilityLabel: 'Open Act menu for your own message',
        accessibilityHint: 'Opens the Act menu where qualifiers and request deletion live.',
      };
    case 'participant_other':
      return {
        primary: 'Reply',
        accessibilityLabel: 'Reply — actions on this message',
        accessibilityHint: 'Opens reply and challenge actions.',
      };
    default: {
      // Exhaustiveness guard — unreachable for the four-value union.
      const never: never = context;
      return never;
    }
  }
}

/**
 * The context-derived dock title — verbatim the Stage 6.4 header strings.
 * Observer → "Observer actions"; own → "On your message"; other → "On this
 * message".
 */
function dockTitle(viewerRole: RailViewerRole, bubbleActor: RailBubbleActor): string {
  if (viewerRole === 'observer') return 'Observer actions';
  return bubbleActor === 'self' ? 'On your message' : 'On this message';
}

/**
 * Build the fully-derived expanded-dock view model.
 *
 * Wraps the existing `groupRailActionsByCategory` (which already skips
 * empty groups and orders by `RAIL_ACTION_CATEGORIES`) and computes:
 *  - `showCategoryHeaders` — true only when >= 2 sections are non-empty.
 *  - `title` — the Stage 6.4 header string for this viewer/actor.
 *
 * The action set itself is NEVER recomputed here — the caller passes the
 * already-resolved (and redundant-join-filtered) action list.
 */
export function buildExpandedDockViewModel(
  actions: readonly RailActionWithCategory[],
  viewerRole: RailViewerRole,
  bubbleActor: RailBubbleActor,
): ExpandedDockViewModel {
  const groups = groupRailActionsByCategory(actions);
  const sections: DockCategorySection[] = groups.map((g) => ({
    category: g.category,
    headerLabel: RAIL_ACTION_CATEGORY_LABEL[g.category],
    actions: g.actions,
  }));
  return {
    sections,
    showCategoryHeaders: sections.length >= 2,
    title: dockTitle(viewerRole, bubbleActor),
  };
}

/**
 * Resolve the maximum height (logical px) for the narrow bottom sheet.
 *
 *  - Returns `round(windowHeight * 0.28)`.
 *  - Clamped to a sane floor (`SHEET_MIN_HEIGHT_PX`, 168) so a short
 *    device still gets a usable sheet.
 *  - Never returns a value `>= windowHeight` — the sheet is NEVER
 *    full-screen. When the floor would exceed the viewport, the sheet is
 *    capped to leave at least a small slice of board visible.
 *  - For a non-positive / non-finite height, returns the floor.
 */
export function resolveSheetMaxHeightPx(windowHeight: number): number {
  if (!Number.isFinite(windowHeight) || windowHeight <= 0) {
    return SHEET_MIN_HEIGHT_PX;
  }
  const fraction = Math.round(windowHeight * SHEET_MAX_VIEWPORT_FRACTION);
  let height = Math.max(fraction, SHEET_MIN_HEIGHT_PX);
  // Never full-screen — keep a visible slice of the board. If even the
  // floor cannot fit, cap so the sheet stays strictly below the viewport.
  if (height >= windowHeight) {
    height = Math.max(1, Math.floor(windowHeight * 0.9));
  }
  return height;
}

// Re-export the category constant so the component can import the layout
// module as a single SC-005 surface without re-importing from the rail.
export { RAIL_ACTION_CATEGORIES };
