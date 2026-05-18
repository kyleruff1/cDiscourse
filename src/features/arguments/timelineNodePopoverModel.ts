/**
 * SC-002 — Timeline node popover.
 *
 * Pure-TS model that turns an active `ArgumentTimelineMapNode` + its
 * actor classification into a compact popover view-model. The action
 * set mirrors `getBubbleControlsForActor` (the side rail uses the
 * same source of truth), so the popover and the rail can never drift.
 *
 * No React, no Supabase, no network.
 */
import {
  getBubbleControlsForActor,
  type ArgumentBubbleActor,
  type ArgumentBubbleControl,
  type ArgumentTimelineMapNode,
  type BubbleControlsContext,
} from './argumentGameSurfaceModel';
import { formatStandingBandShort } from './standingBandCopy';

export interface TimelineNodePopoverModel {
  /** The node the popover is bound to. */
  messageId: string;
  /** Pre-trimmed preview of the body — short enough for a popover. */
  bodyPreview: string;
  /** Header line — ordinal + kind + side. */
  headerLine: string;
  /** Standing band rendered as "<glyph> <soft label>" via SW-001 copy. */
  standingLabel: string;
  /** Tone band — `calm` / `measured` / `heated` / `hostile` / `unknown`. */
  toneBand: ArgumentTimelineMapNode['toneBand'];
  /** Temperature band — `cool` / `mild` / `warm` / `hot` / `unknown`. */
  temperatureBand: ArgumentTimelineMapNode['temperatureBand'];
  /** Allowed action set, identical to the side-rail mapping. */
  actions: ArgumentBubbleControl[];
  /** Whether this is the viewer's own bubble (locks the action set). */
  isOwn: boolean;
  /** Accessibility label for the popover root. */
  accessibilityLabel: string;
}

export interface BuildPopoverModelInput {
  node: ArgumentTimelineMapNode;
  actor: ArgumentBubbleActor;
  totalCount: number;
  controlsContext?: BubbleControlsContext;
}

/**
 * Build the popover view-model. Returns null if the node would not be
 * legibly representable (defensive).
 */
export function buildTimelineNodePopoverModel(input: BuildPopoverModelInput): TimelineNodePopoverModel | null {
  const { node, actor, totalCount, controlsContext } = input;
  if (!node) return null;

  const actions = getBubbleControlsForActor(actor, controlsContext ?? {});

  const sideFragment = node.sideLabel && node.sideLabel !== '—' ? ` · ${node.sideLabel}` : '';
  const headerLine = `Message ${node.ordinal} of ${totalCount} · ${node.kindLabel}${sideFragment}`;

  const standingLabel = formatStandingBandShort(node.standingBand);

  const isOwn = actor === 'self';

  // Body preview comes pre-trimmed from the timeline node. We cap it
  // again defensively in case a future caller passes a longer string.
  const bodyPreview = (node.bodyPreview || '').slice(0, 240);

  const accessibilityLabel = [
    `Popover for message ${node.ordinal} of ${totalCount}`,
    node.kindLabel,
    standingLabel,
    isOwn ? 'your message' : 'reply from another participant',
  ].join(', ');

  return {
    messageId: node.messageId,
    bodyPreview,
    headerLine,
    standingLabel,
    toneBand: node.toneBand,
    temperatureBand: node.temperatureBand,
    actions,
    isOwn,
    accessibilityLabel,
  };
}

// ── Popover state helpers ────────────────────────────────────────

/**
 * Decide what should happen on a node tap. Caller passes the current
 * popover state + the tapped node; this returns the next state.
 *
 * Rules:
 *   - Tap a non-active node → activate it, close any open popover.
 *   - Tap the active node when popover is closed → open popover.
 *   - Tap the active node when popover is open on the same node →
 *     close popover.
 */
export type NodeTapEffect =
  | { type: 'activate'; messageId: string }
  | { type: 'open_popover'; messageId: string }
  | { type: 'close_popover' };

export interface NodeTapInput {
  tappedMessageId: string;
  activeMessageId: string | null;
  popoverMessageId: string | null;
}

export function decideNodeTapEffect(input: NodeTapInput): NodeTapEffect {
  const { tappedMessageId, activeMessageId, popoverMessageId } = input;

  if (tappedMessageId !== activeMessageId) {
    // First tap on a not-yet-active node → activate; close popover if any.
    return { type: 'activate', messageId: tappedMessageId };
  }

  if (popoverMessageId === tappedMessageId) {
    return { type: 'close_popover' };
  }

  return { type: 'open_popover', messageId: tappedMessageId };
}

/**
 * Decide what happens on info-icon tap (next to an active node). Info
 * icon always opens the popover for that node — never toggles.
 */
export function decideInfoIconEffect(messageId: string): NodeTapEffect {
  return { type: 'open_popover', messageId };
}
