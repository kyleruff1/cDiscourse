/**
 * A11Y-PR0 (#913) — room hasOpenMenu integration (P0-3d background suppression).
 *
 * ArgumentRoom folds the marker phrase picker + request-review composer into
 * the single `hasOpenMenu` boolean (via computeRoomHasOpenMenu) that both the
 * board and stack document-level keydown handlers read. This proves the wiring
 * against the two PINNED key models exactly as ArgumentRoom feeds them:
 *
 *  - Stack mode: resolveStackKeyEffect bails to 'none' on hasOpenMenu, so the
 *    arrow / Home / End card nav is fully suppressed while a sheet is open.
 *  - Board mode: resolveBoardMenuKeyEffect routes Escape to 'close_open_menu'
 *    only when hasOpenMenu is true, so the sheet-open state participates in
 *    the board Esc arbitration.
 *
 * Note (honest scope): resolveBoardMenuKeyEffect deliberately does NOT gate
 * the A/I/G menu-switch letters on hasOpenMenu (they switch between the three
 * mutually-exclusive board menus); that pinned model is unchanged by this
 * card. Behind a containment sheet, A/I/G suppression is provided by the
 * separate composerFocused gate (when the sheet holds a focused text input)
 * and by the sheet being topmost on the overlay layer stack.
 */
import { computeRoomHasOpenMenu } from '../src/features/arguments/room/roomOpenMenuModel';
import { resolveStackKeyEffect } from '../src/features/arguments/stackKeyboardSwipeModel';
import { resolveBoardMenuKeyEffect } from '../src/features/arguments/boardMenuKeyboardModel';

const NONE = {
  boardActVisible: false,
  inspectVisible: false,
  goVisible: false,
  markerPickerOpen: false,
  requestReviewOpen: false,
};

describe('A11Y-PR0 — stack nav suppressed while a containment sheet is open', () => {
  it('marker-open suppresses ArrowLeft/Right/Home/End (all -> none)', () => {
    const hasOpenMenu = computeRoomHasOpenMenu({ ...NONE, markerPickerOpen: true });
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(resolveStackKeyEffect({ key, composerFocused: false, hasOpenMenu })).toBe('none');
    }
  });

  it('request-review-open suppresses ArrowLeft/Right/Home/End (all -> none)', () => {
    const hasOpenMenu = computeRoomHasOpenMenu({ ...NONE, requestReviewOpen: true });
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(resolveStackKeyEffect({ key, composerFocused: false, hasOpenMenu })).toBe('none');
    }
  });

  it('with no sheet open, arrows still navigate (regression: suppression is scoped)', () => {
    const hasOpenMenu = computeRoomHasOpenMenu(NONE);
    expect(resolveStackKeyEffect({ key: 'ArrowLeft', composerFocused: false, hasOpenMenu })).toBe(
      'prev',
    );
    expect(resolveStackKeyEffect({ key: 'ArrowRight', composerFocused: false, hasOpenMenu })).toBe(
      'next',
    );
  });
});

describe('A11Y-PR0 — board Esc arbitration reads the sheet-open state', () => {
  it('marker-open routes Escape to close_open_menu (hasOpenMenu branch)', () => {
    const hasOpenMenu = computeRoomHasOpenMenu({ ...NONE, markerPickerOpen: true });
    expect(
      resolveBoardMenuKeyEffect({
        key: 'Escape',
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        composerFocused: false,
        hasOpenMenu,
      }),
    ).toEqual({ type: 'close_open_menu' });
  });

  it('request-review-open routes Escape to close_open_menu (hasOpenMenu branch)', () => {
    const hasOpenMenu = computeRoomHasOpenMenu({ ...NONE, requestReviewOpen: true });
    expect(
      resolveBoardMenuKeyEffect({
        key: 'Escape',
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        composerFocused: false,
        hasOpenMenu,
      }),
    ).toEqual({ type: 'close_open_menu' });
  });

  it('a focused sheet text input suppresses A/I/G via composerFocused', () => {
    const hasOpenMenu = computeRoomHasOpenMenu({ ...NONE, requestReviewOpen: true });
    for (const key of ['a', 'i', 'g']) {
      expect(
        resolveBoardMenuKeyEffect({
          key,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          composerFocused: true,
          hasOpenMenu,
        }),
      ).toEqual({ type: 'none' });
    }
  });
});
