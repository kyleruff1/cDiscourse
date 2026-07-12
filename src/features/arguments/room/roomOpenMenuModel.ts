/**
 * A11Y-PR0 (#913) — room "has an open menu" helper (pure).
 *
 * The argument room suppresses its background keyboard shortcuts (board
 * A / I / G, stack arrow nav) whenever a menu or containment sheet is
 * open. Before this card the two inline computations only counted the
 * three board popouts, so the marker phrase picker and the request-review
 * composer let background shortcuts fire behind them (P0-3d). This helper
 * folds those two sheets into the single boolean so the room bails while
 * either is open.
 *
 * Pure TS. No React, no DOM, no network. Tested in isolation.
 */

export interface RoomOpenMenuInput {
  boardActVisible: boolean;
  inspectVisible: boolean;
  goVisible: boolean;
  /** markerPickerTargetId !== null */
  markerPickerOpen: boolean;
  /** requestReviewTarget !== null */
  requestReviewOpen: boolean;
}

/** True when any board menu OR containment sheet is open. */
export function computeRoomHasOpenMenu(input: RoomOpenMenuInput): boolean {
  return (
    input.boardActVisible ||
    input.inspectVisible ||
    input.goVisible ||
    input.markerPickerOpen ||
    input.requestReviewOpen
  );
}

/** The board menu-open effect types (from resolveBoardMenuKeyEffect). */
export interface RoomContainmentSheetInput {
  /** markerPickerTargetId !== null */
  markerPickerOpen: boolean;
  /** requestReviewTarget !== null */
  requestReviewOpen: boolean;
}

/**
 * A11Y-PR0 (#913, P0-3d) — should the board handler DECLINE to act on a
 * board menu-open effect because a containment sheet owns the overlay layer?
 *
 * This is the SHEET SUBSET (marker phrase picker / request-review composer),
 * deliberately DISTINCT from `computeRoomHasOpenMenu`:
 *
 *  - `hasOpenMenu` must keep A/I/G LIVE so the three mutually-exclusive board
 *    menus can switch between each other (folding the sheet subset into it
 *    would over-suppress that legitimate switching).
 *  - This predicate suppresses ONLY the three menu-OPEN effects, and ONLY when
 *    a containment sheet is open, so pressing A/I/G cannot spawn a board menu
 *    behind the sheet. The marker sheet has no text input, so the handler
 *    `composerFocused` gate does not cover it; this closes that gap for BOTH
 *    sheets.
 *
 * The pure `boardMenuKeyboardModel` is unchanged — it still returns the effect;
 * the ArgumentRoom handler declines to act on it, mirroring the composer dock
 * `isTopmost` handler-level gate. Returns false for `close_open_menu` / `none`
 * (Escape still closes any board menu; nothing else is affected).
 */
export function isBoardMenuOpenSuppressedBySheet(
  effectType: string,
  input: RoomContainmentSheetInput,
): boolean {
  const isMenuOpenEffect =
    effectType === 'open_act' ||
    effectType === 'open_inspect' ||
    effectType === 'open_go';
  return isMenuOpenEffect && (input.markerPickerOpen || input.requestReviewOpen);
}
