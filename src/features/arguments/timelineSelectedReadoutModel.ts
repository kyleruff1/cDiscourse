/**
 * IX-004 — timelineSelectedReadoutModel.
 *
 * Pure TypeScript. No React. No Supabase. No network. No AI.
 *
 * A thin PROJECTION over `SidecarViewModel` (SC-003). It does NOT
 * re-derive standing, lifecycle, or metadata — every banded value
 * (standing / tone / heat) is already produced by `buildSidecarViewModel`
 * in non-verdict language and is rendered verbatim by the panel.
 *
 * What this model adds on top of the SC-003 view-model:
 *
 *   - `directReplyCount` — the number of IMMEDIATE children of the
 *     selected node (`parentId === selectedMessageId`). Not descendants.
 *   - `replyCountLabel` — plain-language pluralized count line.
 *   - `actingOnShortLabel` — a short "<kind> · #<ordinal>" label so the
 *     SC-004 action dock's "Acting on:" line is never ambiguous.
 *   - `staleNotice` — the verbatim fallback banner when the previously
 *     selected message has vanished and the surface snapped to latest.
 *   - `accessibilityPanelLabel` / `accessibilitySelectionAnnouncement` —
 *     the panel-root a11y label and the live-region announcement string.
 *
 * Doctrine (cdiscourse-doctrine):
 *   - §1/§2: reply count is an ACTIVITY signal. It is never cross-derived
 *     into the standing band and carries no verdict word.
 *   - §9: every label is plain English; internal codes are not echoed.
 *
 * The component (`TimelineSelectedReadoutPanel`) is a thin presentation
 * layer over the `TimelineSelectedReadoutViewModel` this builder returns.
 */

import type { SidecarViewModel } from './argumentReplySidecarModel';
import type { ArgumentTimelineMapModel } from './argumentGameSurfaceModel';

// ── Selection status ─────────────────────────────────────────

/** Why the readout is showing what it shows — drives the fallback banner. */
export type ReadoutSelectionStatus =
  | 'explicit' //         user clicked / navigated to this node
  | 'entry_hint' //       pre-activated from the Stage 6.4 gallery entry hint
  | 'default_latest' //   no explicit pick yet — showing latest (or root)
  | 'stale_fallback'; //  previously-selected id is gone — snapped to latest

// ── View model ───────────────────────────────────────────────

export interface TimelineSelectedReadoutViewModel {
  /** True when the room has zero nodes — panel shows the empty hint. */
  isEmpty: boolean;
  /** The message id this readout describes. null only when isEmpty. */
  selectedMessageId: string | null;
  /** Why this message is selected — drives the optional banner. */
  status: ReadoutSelectionStatus;
  /**
   * One-line banner shown above the body when status === 'stale_fallback'.
   * Verbatim: "That message is no longer here — showing the latest move."
   * null for every other status.
   */
  staleNotice: string | null;
  /** The SC-003 view-model the panel renders verbatim (reused, not rebuilt). */
  sidecar: SidecarViewModel;
  /**
   * Direct reply count for the selected node (children whose parentId ===
   * selectedMessageId in the built map). 0 when none. Plain-language label
   * is `replyCountLabel`.
   */
  directReplyCount: number;
  /** "No direct replies yet" | "1 direct reply" | "N direct replies". */
  replyCountLabel: string;
  /**
   * Short label for the action dock's "Acting on:" line. ≤ 48 chars.
   * Form: "<kindLabel> · #<ordinal>" (e.g. "Challenge · #4").
   * Empty string when no node resolved.
   */
  actingOnShortLabel: string;
  /**
   * Full a11y label for the panel root. Summarises kind + ordinal +
   * standing band (via the reused `sidecar.accessibilityRootLabel`) and
   * appends the reply count.
   */
  accessibilityPanelLabel: string;
  /**
   * The string announced via accessibilityLiveRegion when the selection
   * changes. Includes the staleNotice when status === 'stale_fallback'.
   */
  accessibilitySelectionAnnouncement: string;
}

// ── Builder input ────────────────────────────────────────────

export interface BuildTimelineSelectedReadoutInput {
  /** The SC-003 view-model — already built by the room shell. */
  sidecar: SidecarViewModel;
  /** The built timeline map — source of node order + child counts. */
  timelineMap: ArgumentTimelineMapModel;
  /** The currently-selected message id (room shell's activeMessageId). */
  selectedMessageId: string | null;
  /** Why this id is selected. See ReadoutSelectionStatus. */
  status: ReadoutSelectionStatus;
}

// ── Frozen copy ──────────────────────────────────────────────

/**
 * The verbatim stale-fallback banner. Surfaced ONLY when
 * status === 'stale_fallback'. Plain English, no verdict tokens, no
 * internal code.
 */
const STALE_NOTICE = 'That message is no longer here — showing the latest move.';

/** Reply-count copy. Plain counts only — never a standing/verdict word. */
const NO_REPLIES_LABEL = 'No direct replies yet';

/** Empty-state copy when the room has zero nodes. */
const EMPTY_PANEL_LABEL = 'Selected-message readout. Pick a message on the timeline to see details.';

/**
 * Re-exported for tests so they do not re-author the same strings.
 */
export const TIMELINE_READOUT_COPY = Object.freeze({
  STALE_NOTICE,
  NO_REPLIES_LABEL,
  EMPTY_PANEL_LABEL,
});

// ── Helpers ──────────────────────────────────────────────────

/**
 * Plain-language reply-count line. Activity signal, never a verdict.
 *   0 → "No direct replies yet"
 *   1 → "1 direct reply"
 *   n → "N direct replies"
 */
export function buildReplyCountLabel(count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n === 0) return NO_REPLIES_LABEL;
  if (n === 1) return '1 direct reply';
  return `${n} direct replies`;
}

/**
 * Short "Acting on:" label for the SC-004 dock — "<kind> · #<ordinal>".
 * Empty string when no node could be resolved.
 */
export function buildActingOnShortLabel(
  kindLabel: string | null | undefined,
  ordinal: number | null | undefined,
): string {
  const kind = (kindLabel ?? '').trim();
  if (!kind || ordinal == null || !Number.isFinite(ordinal)) return '';
  return `${kind} · #${Math.floor(ordinal)}`;
}

/**
 * Count IMMEDIATE children of `selectedMessageId` in the built timeline
 * map. A "direct reply" is a node whose `parentId` equals the selected
 * id — NOT a descendant deeper in the subtree.
 */
function countDirectReplies(
  timelineMap: ArgumentTimelineMapModel,
  selectedMessageId: string | null,
): number {
  if (!selectedMessageId) return 0;
  const nodes = timelineMap?.nodes;
  if (!Array.isArray(nodes)) return 0;
  let count = 0;
  for (const n of nodes) {
    if (n && n.parentId === selectedMessageId) count += 1;
  }
  return count;
}

// ── Public builder ───────────────────────────────────────────

export function buildTimelineSelectedReadoutViewModel(
  input: BuildTimelineSelectedReadoutInput,
): TimelineSelectedReadoutViewModel {
  const status = input?.status ?? 'default_latest';
  const sidecar = input?.sidecar;
  const timelineMap = input?.timelineMap;

  // Empty room — zero nodes — OR a malformed/empty sidecar. Either way
  // the panel shows the SC-003 empty state; no stale banner, no count.
  const hasNodes = Boolean(
    timelineMap && Array.isArray(timelineMap.nodes) && timelineMap.nodes.length > 0,
  );
  const hasSubject = Boolean(sidecar && !sidecar.isEmpty && sidecar.selectedMessageId);

  if (!hasNodes || !hasSubject) {
    return {
      isEmpty: true,
      selectedMessageId: null,
      status,
      staleNotice: null,
      sidecar,
      directReplyCount: 0,
      replyCountLabel: NO_REPLIES_LABEL,
      actingOnShortLabel: '',
      accessibilityPanelLabel: EMPTY_PANEL_LABEL,
      accessibilitySelectionAnnouncement: EMPTY_PANEL_LABEL,
    };
  }

  const selectedMessageId = sidecar.selectedMessageId as string;
  const directReplyCount = countDirectReplies(timelineMap, selectedMessageId);
  const replyCountLabel = buildReplyCountLabel(directReplyCount);

  // Resolve the node so the "Acting on:" label mirrors the dock target.
  const node = timelineMap.nodes.find((n) => n.messageId === selectedMessageId) ?? null;
  const actingOnShortLabel = node
    ? buildActingOnShortLabel(node.kindLabel, node.ordinal)
    : '';

  const staleNotice = status === 'stale_fallback' ? STALE_NOTICE : null;

  // The panel-root a11y label reuses SC-003's already-doctrine-clean
  // root label (kind + ordinal + lifecycle helper) and appends the
  // reply-count activity line.
  const accessibilityPanelLabel = `${sidecar.accessibilityRootLabel} ${replyCountLabel}.`;

  // On a stale fallback the announcement leads with the verbatim notice
  // so the screen-reader user hears WHY the subject changed.
  const accessibilitySelectionAnnouncement = staleNotice
    ? `${staleNotice} ${accessibilityPanelLabel}`
    : accessibilityPanelLabel;

  return {
    isEmpty: false,
    selectedMessageId,
    status,
    staleNotice,
    sidecar,
    directReplyCount,
    replyCountLabel,
    actingOnShortLabel,
    accessibilityPanelLabel,
    accessibilitySelectionAnnouncement,
  };
}
