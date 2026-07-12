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
 *  - Board A/I/G behind a containment sheet: resolveBoardMenuKeyEffect keeps
 *    A/I/G LIVE (they switch between the three mutually-exclusive board menus,
 *    so folding the sheet subset into hasOpenMenu would over-suppress that).
 *    The gap is closed HANDLER-side: ArgumentRoom gates the resulting
 *    open_act / open_inspect / open_go on the SHEET SUBSET via
 *    isBoardMenuOpenSuppressedBySheet, mirroring the dock isTopmost gate. This
 *    covers the marker phrase picker (which has NO text input, so the
 *    composerFocused gate alone never fired) AND the request-review composer.
 *    The pure model stays byte-identical; the handler declines to act.
 */
import {
  computeRoomHasOpenMenu,
  isBoardMenuOpenSuppressedBySheet,
} from '../src/features/arguments/room/roomOpenMenuModel';
import { resolveStackKeyEffect } from '../src/features/arguments/stackKeyboardSwipeModel';
import { resolveBoardMenuKeyEffect } from '../src/features/arguments/boardMenuKeyboardModel';
import * as fs from 'fs';
import * as path from 'path';

/** Resolve A/I/G exactly as the ArgumentRoom board handler feeds the model. */
function resolveOpenEffect(key: string) {
  return resolveBoardMenuKeyEffect({
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    composerFocused: false,
    hasOpenMenu: false,
  });
}

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

  it('a focused sheet text input still suppresses A/I/G via composerFocused (defense in depth)', () => {
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

describe('A11Y-PR0 — board A/I/G suppressed behind a containment sheet (P0-3d gap closed)', () => {
  // The board handler feeds resolveBoardMenuKeyEffect with composerFocused:false
  // (the marker sheet has no text input) and then declines to act on the
  // resulting open_* effect via isBoardMenuOpenSuppressedBySheet. These assert
  // that composite decision.

  it('marker sheet open (no text input, composerFocused:false): A/I/G is suppressed', () => {
    for (const key of ['a', 'i', 'g']) {
      const effect = resolveOpenEffect(key);
      // The pure model DOES return an open_* effect (A/I/G stay live)...
      expect(['open_act', 'open_inspect', 'open_go']).toContain(effect.type);
      // ...but the handler declines to act because the marker sheet is open.
      expect(
        isBoardMenuOpenSuppressedBySheet(effect.type, {
          markerPickerOpen: true,
          requestReviewOpen: false,
        }),
      ).toBe(true);
    }
  });

  it('request-review composer open: A/I/G is suppressed', () => {
    for (const key of ['a', 'i', 'g']) {
      const effect = resolveOpenEffect(key);
      expect(
        isBoardMenuOpenSuppressedBySheet(effect.type, {
          markerPickerOpen: false,
          requestReviewOpen: true,
        }),
      ).toBe(true);
    }
  });

  it('FIRING CONTROL — with NO sheet open, A/I/G still act (menu-switching not regressed)', () => {
    for (const key of ['a', 'i', 'g']) {
      const effect = resolveOpenEffect(key);
      expect(['open_act', 'open_inspect', 'open_go']).toContain(effect.type);
      expect(
        isBoardMenuOpenSuppressedBySheet(effect.type, {
          markerPickerOpen: false,
          requestReviewOpen: false,
        }),
      ).toBe(false);
    }
  });

  it('the sheet-subset gate does NOT suppress close_open_menu or none', () => {
    // Escape must still close an open board menu even with a sheet open, and a
    // non-shortcut key is untouched.
    for (const effectType of ['close_open_menu', 'none']) {
      expect(
        isBoardMenuOpenSuppressedBySheet(effectType, {
          markerPickerOpen: true,
          requestReviewOpen: true,
        }),
      ).toBe(false);
    }
  });

  it('ArgumentRoom wires the sheet-subset gate on the board handler', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'features', 'arguments', 'room', 'ArgumentRoom.tsx'),
      'utf8',
    );
    expect(src).toMatch(/isBoardMenuOpenSuppressedBySheet\(effect\.type/);
    expect(src).toMatch(/markerPickerOpen: markerPickerTargetId !== null/);
    expect(src).toMatch(/requestReviewOpen: requestReviewTarget !== null/);
  });
});
