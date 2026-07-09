/**
 * ROOM-004 (#886) — mapNodeActionSurfaceModel.
 *
 * Pure-TS projection that turns the actor-aware action list (injected from the
 * SAME getRailActions derivation ROOM-002 owns) plus a small amount of
 * already-derived node context into the Map node-action popover row and the
 * data-rich sidecar deep-link footer. It holds nothing, fetches nothing, and
 * imports NO derivation: the orchestrator (ArgumentRoom) is the single
 * reconciliation point, so a reasonable ROOM-002 contract difference changes
 * only the injected actions, never this model or its view.
 *
 * Doctrine (cdiscourse-doctrine, timeline-grammar):
 *   - Band-free: no standing / tone / heat chips. VISUAL-SIMPLIFY-003 band
 *     retirement is preserved.
 *   - Advisory-only: the open-point membership line is procedural (mediator
 *     board), never popularity or a verdict.
 *   - No verdict tokens. No AI. No Supabase. No React. No network.
 *
 * All comments apostrophe-free for the naive quote-parity doctrine scanner.
 */
import type { RailAction, RailBubbleActor, RailViewerRole } from '../railActionCategories';

/** Sidecar deep-link descriptor. */
export interface MapNodeSidecarLink {
  key: 'answer_this' | 'open_debts';
  label: string;
  hint: string;
}

/** The full projected Map node-action surface. */
export interface MapNodeActionSurface {
  messageId: string | null;
  /** Ordered actor-aware action row (the popover chips). Mirrors the Exchange row. */
  actionRow: RailAction[];
  /** True when the active move is the viewer own move (empty rail row → Open Act). */
  isOwnMove: boolean;
  /** Sidecar deep-link descriptors (Answer this, Open disagreement points). */
  sidecarLinks: MapNodeSidecarLink[];
  /** Open-point membership line, or null when the node has no open-point membership. */
  openPointMembershipLine: string | null;
  /** Popover root accessibility label. */
  accessibilityLabel: string;
  answerThisLabel: string;
  answerThisHint: string;
  openActLabel: string;
  openActHint: string;
  closeLabel: string;
}

export interface MapNodeActionSurfaceInput {
  activeMessageId: string | null;
  viewerRole: RailViewerRole;
  /** The active move actor (activeViewModel.actor). */
  actor: RailBubbleActor;
  /** Injected actor->actions list (getRailActions output). This model never derives it. */
  actions: RailAction[];
  /** Short acting-on label for the popover a11y root (timelineReadoutViewModel). */
  actingOnShortLabel: string | null;
  /** True when the node belongs to an OPEN (not settled) mediator point. */
  isOpenPointMember: boolean;
}

// ── Locked copy (ban-list clean; no verdict / standing / amplification) ──

const ANSWER_THIS_LABEL = 'Answer this ↗';
const ANSWER_THIS_HINT = 'Opens the reply composer scoped to this point in the conversation view.';
const OPEN_ACT_LABEL = 'Open Act ▾';
const OPEN_ACT_HINT = 'View qualifiers or request deletion';
const OPEN_DEBTS_LABEL = 'Open disagreement points';
const OPEN_DEBTS_HINT = 'Review owed sources and open points for this move.';
const OPEN_POINT_MEMBERSHIP_LINE = 'Part of an open point';
const CLOSE_LABEL = 'Close actions';

/**
 * Tokens forbidden in any Map-surface label / hint / a11y string. Exported for
 * the ban-list test so the assertion and the copy share ONE source of truth.
 */
const FORBIDDEN_MAP_SURFACE_TOKENS: readonly string[] = Object.freeze([
  'winner',
  'loser',
  'correct',
  'incorrect',
  'true',
  'false',
  'right',
  'wrong',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'verdict',
  'proof',
  'proven',
  'won',
  'lost',
  'likes',
  'retweets',
  'followers',
  'engagement',
  'trending',
  'viral',
]);

export function _forbiddenMapSurfaceTokens(): readonly string[] {
  return FORBIDDEN_MAP_SURFACE_TOKENS;
}

function buildAccessibilityLabel(actingOnShortLabel: string | null): string {
  const subject = actingOnShortLabel && actingOnShortLabel.length > 0 ? actingOnShortLabel : 'this point';
  return `Actions for ${subject}.`;
}

/**
 * Build the Map node-action surface. Pure projection; the action row is a
 * faithful pass-through of the injected actor actions (the popover mirrors the
 * Exchange row for the SAME actor). Own moves have an empty rail row and route
 * to the board Act menu instead.
 */
export function buildMapNodeActionSurface(input: MapNodeActionSurfaceInput): MapNodeActionSurface {
  const actions = Array.isArray(input?.actions) ? input.actions.slice() : [];
  const isOwnMove = input?.actor === 'self';
  const sidecarLinks: MapNodeSidecarLink[] = [
    { key: 'answer_this', label: ANSWER_THIS_LABEL, hint: ANSWER_THIS_HINT },
    { key: 'open_debts', label: OPEN_DEBTS_LABEL, hint: OPEN_DEBTS_HINT },
  ];
  return {
    messageId: input?.activeMessageId ?? null,
    actionRow: actions,
    isOwnMove,
    sidecarLinks,
    openPointMembershipLine: input?.isOpenPointMember ? OPEN_POINT_MEMBERSHIP_LINE : null,
    accessibilityLabel: buildAccessibilityLabel(input?.actingOnShortLabel ?? null),
    answerThisLabel: ANSWER_THIS_LABEL,
    answerThisHint: ANSWER_THIS_HINT,
    openActLabel: OPEN_ACT_LABEL,
    openActHint: OPEN_ACT_HINT,
    closeLabel: CLOSE_LABEL,
  };
}
