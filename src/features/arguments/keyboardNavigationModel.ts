/**
 * IX-003 — Keyboard navigation + accessibility-label model (pure TypeScript).
 *
 * No React. No Supabase. No network. No AI. Two responsibilities, both
 * pure and unit-testable in isolation:
 *
 *   1. `resolveTimelineNavEffect` — given the built timeline map, the
 *      current active node, and a `KeyboardEvent.key` string, return the
 *      effect the component should apply (move active node / open detail /
 *      close overlay / nothing). This is the traversal resolver behind the
 *      web-only `onKeyDown` handler in `ArgumentTimelineMap.tsx`.
 *
 *   2. `buildNodeAccessibilityLabel` — the single source of truth for the
 *      plain-language screen-reader label of one timeline node. It exposes
 *      type, side, ordinal, STRENGTH band (plain language) and BRANCH
 *      (mainline vs. side) plus active / latest / junction / detached
 *      state. Both `NodeDot` (ArgumentTimelineMap.tsx) and
 *      `buildArgumentTimelineMap` Pass 4 call this helper so the rendered
 *      node label and the model's stored label never drift.
 *
 * Doctrine (cdiscourse-doctrine §1/§2/§9, accessibility-targets,
 * timeline-grammar):
 *   - The strength fragment is `STANDING_BAND_SOFT_LABEL[band]` — a
 *     gameplay STANDING band ("Strongly supported" / "Needs work" /
 *     "Neutral" / "No reading yet"), never a verdict. No "winner",
 *     "loser", "correct", "true", "false", "liar" — ever. A ban-list test
 *     locks this.
 *   - The branch label is topology (mainline / side branch / detached),
 *     never popularity. Lane numbers are never spoken aloud.
 *   - Keyboard nav only changes *selection*; it cannot post, score, flag,
 *     or block anything.
 *
 * This file imports ONLY *types* from `argumentGameSurfaceModel` plus the
 * `STANDING_BAND_SOFT_LABEL` value map from `standingBandCopy`. The
 * chronological prev/next index logic is inlined here (it mirrors
 * `timelineMapPrevId` / `timelineMapNextId`) so the dependency on
 * `argumentGameSurfaceModel` stays type-only — that keeps the
 * model→model relationship one-directional and free of any runtime
 * import cycle, since `argumentGameSurfaceModel` Pass 4 value-imports
 * `buildNodeAccessibilityLabel` from this file. No React, no
 * react-native, no Supabase, no network.
 */
import type {
  ArgumentTimelineMapModel,
  TimelineStandingBand,
} from './argumentGameSurfaceModel';
import { STANDING_BAND_SOFT_LABEL } from './standingBandCopy';

// ── Keyboard nav types ──────────────────────────────────────────

/** The keys IX-003 binds plus the two open/close keys. */
export type TimelineNavKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'Enter'
  | ' ' // Space — KeyboardEvent.key for the spacebar is a single space
  | 'Escape';

/**
 * The set of strings `KeyboardEvent.key` may produce that we treat as one
 * of the bound keys. Space arrives as `' '` (or, rarely, `'Spacebar'` on
 * older engines). Frozen so callers cannot mutate the contract.
 */
export const TIMELINE_NAV_KEYS: ReadonlyArray<string> = Object.freeze([
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Enter',
  ' ',
  'Spacebar',
  'Escape',
]);

/** Outcome of pressing a nav key. Pure — the component applies the effect. */
export type TimelineNavEffect =
  | { type: 'none' } // key not handled / nothing to do
  | { type: 'activate'; messageId: string } // move the active node
  | { type: 'open_detail'; messageId: string } // Enter/Space on the active node
  | { type: 'close_overlay' }; // Escape

export interface TimelineNavInput {
  /** The raw `KeyboardEvent.key` value. */
  key: string;
  /** Current active node id (`map.activeNode?.messageId ?? null`). */
  activeMessageId: string | null;
  /** The built timeline map — the source of node order, root, latest. */
  map: ArgumentTimelineMapModel;
  /**
   * True when an overlay (SC-002 popover or SC-004 dock) is open; only
   * then does Escape produce `'close_overlay'`.
   */
  hasOpenOverlay: boolean;
}

// ── Accessibility-label types ───────────────────────────────────

/**
 * Minimal node shape the label builder needs — a structural subset of
 * `ArgumentTimelineMapNode` so the helper can be tested with tiny
 * fixtures and called from both `NodeDot` and `buildArgumentTimelineMap`.
 */
export interface NodeAccessibilityInput {
  ordinal: number;
  totalNodes: number;
  kindLabel: string;
  /** 'Aff' | 'Neg' | 'Obs' | 'Mod' | '—' — '—' omits the side fragment. */
  sideLabel: string;
  standingBand: TimelineStandingBand;
  /** Plain-language branch descriptor — see `deriveBranchLabel`. */
  branchLabel: string;
  isActive: boolean;
  isLatest: boolean;
  isRoot: boolean;
  isDetached: boolean;
  isJunction: boolean;
  junctionChildCount: number;
  /** Relative time ("8m ago") or absolute fallback. */
  relativeOrAbsoluteTime: string;
}

// ── Keyboard nav ────────────────────────────────────────────────

/** True when `key` is one IX-003 binds. Cheap guard for `onKeyDown`. */
export function isTimelineNavKey(key: string): boolean {
  return TIMELINE_NAV_KEYS.indexOf(key) !== -1;
}

/**
 * Chronological PREVIOUS node id by `map.nodes` index. Mirrors
 * `timelineMapPrevId` (kept inline so this file's dependency on
 * `argumentGameSurfaceModel` stays type-only — see the file header).
 * Returns null at index 0 — the active node does NOT wrap.
 */
function prevNodeId(map: ArgumentTimelineMapModel, currentId: string): string | null {
  const idx = map.nodes.findIndex((n) => n.messageId === currentId);
  if (idx <= 0) return null;
  return map.nodes[idx - 1].messageId;
}

/**
 * Chronological NEXT node id by `map.nodes` index. Mirrors
 * `timelineMapNextId`. Returns null at the last index — no wrap.
 */
function nextNodeId(map: ArgumentTimelineMapModel, currentId: string): string | null {
  const idx = map.nodes.findIndex((n) => n.messageId === currentId);
  if (idx < 0 || idx >= map.nodes.length - 1) return null;
  return map.nodes[idx + 1].messageId;
}

/**
 * Pure traversal. Given the current map + active node + a key, return the
 * effect the component should apply. Never throws. Never mutates input.
 *
 *  - ArrowLeft  → activate the chronological PREVIOUS node; 'none' if
 *                 already at index 0.
 *  - ArrowRight → activate the chronological NEXT node; 'none' if already
 *                 at the last index.
 *  - Home       → activate `map.rootMessageId`; 'none' if root is already
 *                 active or `rootMessageId` is null.
 *  - End        → activate `map.latestMessageId`; 'none' if latest is
 *                 already active or `latestMessageId` is null.
 *  - Enter / Space → 'open_detail' for the active node; 'none' if there is
 *                 no active node.
 *  - Escape     → 'close_overlay' iff `hasOpenOverlay`; else 'none'.
 *  - anything else → 'none'.
 *
 * When `activeMessageId` is null, ArrowLeft/Home behave as "go to root"
 * and ArrowRight/End behave as "go to latest" — so a keyboard user with
 * no selection yet still gets a sensible first move. The active node
 * never wraps at the ends.
 */
export function resolveTimelineNavEffect(input: TimelineNavInput): TimelineNavEffect {
  if (!input || !input.map || !Array.isArray(input.map.nodes)) {
    return { type: 'none' };
  }
  const { key, activeMessageId, map, hasOpenOverlay } = input;

  // Empty timeline — nothing is navigable.
  if (map.nodes.length === 0) return { type: 'none' };

  switch (key) {
    case 'ArrowLeft': {
      // No selection yet → go to root as a sensible first move.
      if (activeMessageId === null) {
        return map.rootMessageId
          ? { type: 'activate', messageId: map.rootMessageId }
          : { type: 'none' };
      }
      const prev = prevNodeId(map, activeMessageId);
      return prev ? { type: 'activate', messageId: prev } : { type: 'none' };
    }
    case 'ArrowRight': {
      if (activeMessageId === null) {
        return map.latestMessageId
          ? { type: 'activate', messageId: map.latestMessageId }
          : { type: 'none' };
      }
      const next = nextNodeId(map, activeMessageId);
      return next ? { type: 'activate', messageId: next } : { type: 'none' };
    }
    case 'Home': {
      const root = map.rootMessageId;
      if (!root) return { type: 'none' };
      if (root === activeMessageId) return { type: 'none' };
      return { type: 'activate', messageId: root };
    }
    case 'End': {
      const latest = map.latestMessageId;
      if (!latest) return { type: 'none' };
      if (latest === activeMessageId) return { type: 'none' };
      return { type: 'activate', messageId: latest };
    }
    case 'Enter':
    case ' ':
    case 'Spacebar': {
      if (activeMessageId === null) return { type: 'none' };
      return { type: 'open_detail', messageId: activeMessageId };
    }
    case 'Escape': {
      return hasOpenOverlay ? { type: 'close_overlay' } : { type: 'none' };
    }
    default:
      return { type: 'none' };
  }
}

// ── Accessibility labels ────────────────────────────────────────

/**
 * Derive the plain-language branch descriptor for a node.
 *  - `isDetached`  → 'detached from the main thread'
 *  - lane === 0    → 'on the main line'
 *  - lane !== 0    → 'on a side branch'
 *
 * Lane numbers themselves are never read aloud — "+2" / "-1" mean nothing
 * to a listener. The mainline-vs-side distinction is what matters.
 */
export function deriveBranchLabel(node: { lane: number; isDetached: boolean }): string {
  if (node.isDetached) return 'detached from the main thread';
  return node.lane === 0 ? 'on the main line' : 'on a side branch';
}

/**
 * Build the full plain-language screen-reader label for one node.
 *
 * Order:
 *   "<kindLabel>[ on side <sideLabel>], position <ordinal> of <total>,
 *    <strength soft label>, <branchLabel>[, opening claim]
 *    [, currently active][, latest move][, junction with N replies]
 *    [, detached — parent unavailable], posted <time>".
 *
 * The strength fragment is `STANDING_BAND_SOFT_LABEL[band]` — gameplay
 * standing, never a verdict (see §"Doctrine self-check" in the design).
 * `side <X>` is omitted when `sideLabel` is '—'.
 */
export function buildNodeAccessibilityLabel(input: NodeAccessibilityInput): string {
  const parts: string[] = [];

  // Type + side.
  if (input.sideLabel && input.sideLabel !== '—') {
    parts.push(`${input.kindLabel} on side ${input.sideLabel}`);
  } else {
    parts.push(input.kindLabel);
  }

  // Ordinal.
  parts.push(`position ${input.ordinal} of ${input.totalNodes}`);

  // Strength band — plain-language gameplay standing, never a verdict.
  parts.push(STANDING_BAND_SOFT_LABEL[input.standingBand]);

  // Branch — mainline / side / detached topology.
  parts.push(input.branchLabel);

  // Root marker.
  if (input.isRoot) parts.push('opening claim');

  // State flags.
  if (input.isActive) parts.push('currently active');
  if (input.isLatest) parts.push('latest move');
  if (input.isJunction) {
    parts.push(`junction with ${input.junctionChildCount} replies`);
  }
  if (input.isDetached) parts.push('detached — parent unavailable');

  // Time.
  if (input.relativeOrAbsoluteTime) {
    parts.push(`posted ${input.relativeOrAbsoluteTime}`);
  }

  return parts.join(', ');
}
