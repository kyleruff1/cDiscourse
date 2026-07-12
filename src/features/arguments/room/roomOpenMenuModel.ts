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
