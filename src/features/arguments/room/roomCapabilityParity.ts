/**
 * ROOM-004 (#886) — roomCapabilityParity.
 *
 * The pure capability-reachability model behind the A x B parity rule: view
 * choice is a lens, never a capability gate. For a given actor, every
 * RailActionCode reachable in the Exchange lens must be reachable in the Map
 * lens, and every code has ONE lens-independent handler class.
 *
 * This is the single source the parity-matrix test iterates. It builds the
 * per-lens reachable set from the SAME sources the room uses:
 *   - the node-level action row (Exchange element row / Map node popover), both
 *     derived from getRailActions. The Map arm runs the injected list through
 *     buildMapNodeActionSurface so a future popover filter is caught;
 *   - the lens-agnostic board Act menu (own-move qualifiers + request deletion;
 *     participant-other ask-source / ask-quote / split-branch / flag /
 *     qualifiers), mounted in col2Footer regardless of mode;
 *   - the lens-agnostic Go menu (view_timeline).
 *
 * If a future card adds an Exchange-only capability, the two lenses diverge and
 * the matrix test fails. Pure TS; no React import of its own. No verdict tokens.
 * All comments apostrophe-free for the doctrine scanner.
 */
import type { RailActionCode, RailBubbleActor, RailViewerRole } from '../railActionCategories';
import { getBubbleControlsForActor } from '../argumentGameSurfaceModel';
import { getRailActions } from '../ArgumentSideActionRail';
import { ROOM_RAIL_ACTION_CODES } from './roomActionCodes';
import {
  BUBBLE_CONTROL_TO_RAIL_ACTION_CODE,
  buildMapNodeActionSurface,
  mapActionRowToRailCodes,
} from './mapNodeActionSurfaceModel';

export type RoomLens = 'exchange' | 'map';

/** Lens-independent handler class for a code. */
export type RailActionHandlerClass = 'rail' | 'act' | 'go';

/**
 * The frozen code set the matrix iterates. Derived FROM the shipped
 * ROOM_RAIL_ACTION_CODES (which is itself compiler-pinned to the RailActionCode
 * union), so it cannot silently drift.
 */
export const PARITY_ACTION_CODES: readonly RailActionCode[] = ROOM_RAIL_ACTION_CODES;

/**
 * Classify a code to its single home surface. Lens-independent: the same code
 * routes through the same handler class in either lens.
 *   - rail: dispatched by handleRailAction (node-level shortcut).
 *   - act:  reached via the board Act menu (migrated codes).
 *   - go:   reached via the Go menu (view_timeline).
 */
export function railActionHandlerId(code: RailActionCode): RailActionHandlerClass {
  switch (code) {
    case 'watch':
    case 'join_aff':
    case 'join_neg':
    case 'share':
    case 'reply':
    case 'disagree':
      return 'rail';
    case 'ask_source':
    case 'ask_quote':
    case 'split_branch':
    case 'flag':
    case 'qualifiers':
    case 'request_deletion':
      return 'act';
    case 'open_timeline':
      return 'go';
    default: {
      // Exhaustive: the ROOM_RAIL_ACTION_CODES satisfies guard keeps this dead.
      const _never: never = code;
      return _never;
    }
  }
}

/**
 * The Exchange node-row codes — the REAL Ringside derivation. Participants use
 * getBubbleControlsForActor (the SAME source vm.allowedControls / the Ringside
 * card consume), normalized into RailActionCode space; observers use the
 * getRailActions observer set. This is the exchange arm the matrix compares.
 */
export function exchangeNodeRowCodes(viewerRole: RailViewerRole, actor: RailBubbleActor): RailActionCode[] {
  if (viewerRole === 'observer') return getRailActions('observer', actor).map((a) => a.code);
  return getBubbleControlsForActor(actor).map((c) => BUBBLE_CONTROL_TO_RAIL_ACTION_CODE[c]);
}

/**
 * The Map node-row codes — the REAL popover injection. It runs the SAME
 * derivations the Exchange arm uses THROUGH buildMapNodeActionSurface (the
 * actual popover surface), so a future popover-side filter / re-order makes the
 * two arms diverge and FAILS the matrix. This is the map arm the matrix compares.
 */
export function mapNodeRowCodes(viewerRole: RailViewerRole, actor: RailBubbleActor): RailActionCode[] {
  const surface = buildMapNodeActionSurface({
    activeMessageId: 'parity-probe',
    viewerRole,
    actor,
    participantControls: getBubbleControlsForActor(actor),
    observerActions: getRailActions('observer', actor),
    actingOnShortLabel: null,
    isOpenPointMember: false,
  });
  return mapActionRowToRailCodes(surface.actionRow);
}

/** The lens-agnostic board Act menu codes reachable for an actor. */
function boardActCodes(viewerRole: RailViewerRole, actor: RailBubbleActor): RailActionCode[] {
  if (viewerRole === 'observer') return [];
  if (actor === 'self') return ['qualifiers', 'request_deletion'];
  return ['ask_source', 'ask_quote', 'split_branch', 'flag', 'qualifiers'];
}

/** The lens-agnostic Go menu codes. */
function goCodes(): RailActionCode[] {
  return ['open_timeline'];
}

/**
 * Compose a reachable set from an EXPLICIT node-row plus the lens-agnostic
 * board Act + Go menus. Exposed so a negative-control test can inject a stubbed
 * (subset) node row and PROVE the set-equality guard fires on divergence.
 */
export function reachableRailActionCodesWith(
  nodeRow: readonly RailActionCode[],
  viewerRole: RailViewerRole,
  actor: RailBubbleActor,
): ReadonlySet<RailActionCode> {
  const out = new Set<RailActionCode>();
  for (const c of nodeRow) out.add(c);
  for (const c of boardActCodes(viewerRole, actor)) out.add(c);
  for (const c of goCodes()) out.add(c);
  return out;
}

/**
 * The set of RailActionCodes reachable in a lens for an actor. The union of the
 * node-level row (the REAL per-lens derivation) plus the lens-agnostic board
 * Act + Go menus. The exchange arm is the Ringside derivation; the map arm is
 * the popover injection — so set-equality genuinely fails on any lens divergence.
 */
export function reachableRailActionCodes(
  lens: RoomLens,
  viewerRole: RailViewerRole,
  actor: RailBubbleActor,
): ReadonlySet<RailActionCode> {
  const nodeRow = lens === 'exchange' ? exchangeNodeRowCodes(viewerRole, actor) : mapNodeRowCodes(viewerRole, actor);
  return reachableRailActionCodesWith(nodeRow, viewerRole, actor);
}
