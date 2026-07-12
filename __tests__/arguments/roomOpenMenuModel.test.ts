/**
 * A11Y-PR0 (#913) — computeRoomHasOpenMenu truth table.
 *
 * P0-3d: the marker phrase picker and the request-review composer must
 * fold into hasOpenMenu so background board / stack shortcuts bail while
 * either sheet is open.
 */
import {
  computeRoomHasOpenMenu,
  isBoardMenuOpenSuppressedBySheet,
} from '../../src/features/arguments/room/roomOpenMenuModel';

const NONE = {
  boardActVisible: false,
  inspectVisible: false,
  goVisible: false,
  markerPickerOpen: false,
  requestReviewOpen: false,
};

describe('A11Y-PR0 — computeRoomHasOpenMenu', () => {
  it('is false when nothing is open', () => {
    expect(computeRoomHasOpenMenu(NONE)).toBe(false);
  });

  it('is true for each board popout individually', () => {
    expect(computeRoomHasOpenMenu({ ...NONE, boardActVisible: true })).toBe(true);
    expect(computeRoomHasOpenMenu({ ...NONE, inspectVisible: true })).toBe(true);
    expect(computeRoomHasOpenMenu({ ...NONE, goVisible: true })).toBe(true);
  });

  it('is true when ONLY the marker picker is open (the new containment)', () => {
    expect(computeRoomHasOpenMenu({ ...NONE, markerPickerOpen: true })).toBe(true);
  });

  it('is true when ONLY the request-review composer is open (the new containment)', () => {
    expect(computeRoomHasOpenMenu({ ...NONE, requestReviewOpen: true })).toBe(true);
  });

  it('is true when several are open at once', () => {
    expect(
      computeRoomHasOpenMenu({
        boardActVisible: true,
        inspectVisible: false,
        goVisible: false,
        markerPickerOpen: true,
        requestReviewOpen: true,
      }),
    ).toBe(true);
  });
});

describe('A11Y-PR0 — isBoardMenuOpenSuppressedBySheet', () => {
  const NO_SHEET = { markerPickerOpen: false, requestReviewOpen: false };

  it('suppresses each menu-open effect when the marker sheet is open', () => {
    for (const effectType of ['open_act', 'open_inspect', 'open_go']) {
      expect(
        isBoardMenuOpenSuppressedBySheet(effectType, {
          markerPickerOpen: true,
          requestReviewOpen: false,
        }),
      ).toBe(true);
    }
  });

  it('suppresses each menu-open effect when the request-review composer is open', () => {
    for (const effectType of ['open_act', 'open_inspect', 'open_go']) {
      expect(
        isBoardMenuOpenSuppressedBySheet(effectType, {
          markerPickerOpen: false,
          requestReviewOpen: true,
        }),
      ).toBe(true);
    }
  });

  it('does NOT suppress a menu-open effect when no sheet is open (switching preserved)', () => {
    for (const effectType of ['open_act', 'open_inspect', 'open_go']) {
      expect(isBoardMenuOpenSuppressedBySheet(effectType, NO_SHEET)).toBe(false);
    }
  });

  it('never suppresses close_open_menu or none, even with a sheet open', () => {
    for (const effectType of ['close_open_menu', 'none']) {
      expect(
        isBoardMenuOpenSuppressedBySheet(effectType, {
          markerPickerOpen: true,
          requestReviewOpen: true,
        }),
      ).toBe(false);
    }
  });
});
