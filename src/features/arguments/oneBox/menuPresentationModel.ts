/**
 * UX-001.4 — Menu presentation model (per-band variant + sizing).
 *
 * Pure TS resolver that maps a viewport band + menu identity onto one
 * of three presentation variants:
 *
 *   - `sheet_bottom`    — bottom sheet (phone / tablet portrait).
 *   - `panel_side`      — side panel (tablet landscape Inspect / Go).
 *   - `panel_anchored`  — anchored compact panel near the trigger
 *                         (tablet landscape Act, wide for all menus).
 *
 * Per-band maxHeight (UX-001.4 design §3.2 / §4.2 / §5.3, brief
 * §"Position and height contracts"):
 *
 *  Phone (<600 dp):
 *    Act / Inspect → sheet_bottom, maxHeight ≤ 50% viewport
 *    Go            → sheet_bottom, maxHeight ≤ 40% viewport (typically shorter)
 *
 *  Tablet portrait (600-1023 dp):
 *    Act / Inspect → sheet_bottom, maxHeight ≤ 50% viewport
 *    Go            → sheet_bottom, maxHeight ≤ 40% viewport
 *
 *  Tablet landscape (1024-1279 dp):
 *    Act           → panel_anchored, maxHeight ≤ 40%, width 360
 *    Inspect       → panel_side, maxHeight ≤ 60%, width 420
 *    Go            → panel_side, maxHeight ≤ 50%, width 320
 *
 *  Wide (≥1280 dp):
 *    Act           → panel_anchored, maxHeight ≤ 35%, width 360
 *    Inspect       → panel_anchored, maxHeight ≤ 60%, width 420
 *    Go            → panel_anchored, maxHeight ≤ 50%, width 320
 *
 * The brief MANDATES that menu presentation does NOT push the Timeline
 * above UX-001.2's offset caps (128 / 168 / 200). The menus overlay
 * (Modal) — they do not displace. The resolver returns sizing values
 * the host applies as inline style on the chassis panel; the chassis
 * remains layout-neutral.
 *
 * Doctrine:
 *  - Pure TS. No React. No Supabase. No `Date.now()`. No AI.
 *  - Returned numbers are LOGICAL pixels (caller does not multiply by
 *    a DPR — RN already works in logical px).
 *  - No verdict tokens, no internal codes. The return shape is
 *    presentation-only.
 *
 * Pure TS. No new dependency.
 */

/** The three presentation variants the chassis panel can take. */
export type MenuVariant = 'sheet_bottom' | 'panel_side' | 'panel_anchored';

/** The three menus that share this presentation contract. */
export type MenuId = 'act' | 'inspect' | 'go';

/** The viewport band (matches UX-001.1's `Band` union). */
export type MenuBand = 'phone' | 'tablet' | 'wide';

/** Inputs to the resolver. */
export interface MenuPresentationInput {
  /** Viewport band. The host derives this from `useHeaderBreakpoint`. */
  band: MenuBand;
  /** Which of the three menus is being presented. */
  menu: MenuId;
  /**
   * Window width in logical px. Used to distinguish tablet portrait
   * (< 1024) from tablet landscape (>= 1024) inside the `tablet` band.
   * The 1024 dp landscape signal matches iPad Pro horizontal +
   * Chromebook tablet-class viewports.
   */
  windowWidth: number;
  /** Window height in logical px. Used to compute sheet maxHeight. */
  windowHeight: number;
}

/** Resolver output. */
export interface MenuPresentationOutput {
  /** Per-band-and-menu variant. */
  variant: MenuVariant;
  /**
   * Max height (logical px) for sheet / side / anchored variants.
   * For sheet_bottom: maxHeight cap (50% phone Act/Inspect, 40% Go).
   * For panel_side / panel_anchored: maxHeight is the panel height cap.
   */
  maxHeight: number;
  /**
   * Width (logical px) for side / anchored panel variants. `null` for
   * sheet_bottom (sheet spans full viewport width).
   */
  width: number | null;
}

/**
 * The tablet-landscape signal — the resolver flips Act to
 * `panel_anchored` and Inspect/Go to `panel_side` at this threshold.
 * Matches the iPad Pro horizontal viewport and other tablet-class
 * landscape devices. Below this, tablet stays in `sheet_bottom`.
 */
export const TABLET_LANDSCAPE_THRESHOLD = 1024;

/** Per-menu height fractions for sheet_bottom. */
const SHEET_HEIGHT_FRACTION: Readonly<Record<MenuId, number>> = Object.freeze({
  act: 0.5,
  inspect: 0.5,
  go: 0.4,
});

/** Per-menu height fractions for panel_side / panel_anchored on tablet landscape. */
const TABLET_LANDSCAPE_HEIGHT_FRACTION: Readonly<Record<MenuId, number>> = Object.freeze({
  act: 0.4,
  inspect: 0.6,
  go: 0.5,
});

/** Per-menu height fractions for panel_anchored on wide. */
const WIDE_HEIGHT_FRACTION: Readonly<Record<MenuId, number>> = Object.freeze({
  act: 0.35,
  inspect: 0.6,
  go: 0.5,
});

/** Per-menu fixed widths for panel_side / panel_anchored variants. */
const PANEL_WIDTH_BY_MENU: Readonly<Record<MenuId, number>> = Object.freeze({
  act: 360,
  inspect: 420,
  go: 320,
});

/**
 * Floor for sheet maxHeight (logical px). Even on tiny viewports the
 * sheet shows a readable two-row chunk; the chassis ScrollView handles
 * overflow.
 */
const SHEET_MIN_HEIGHT_PX = 200;

/**
 * Resolve the presentation for a menu at a viewport. Pure. Deterministic.
 *
 * Rules:
 *  - phone band → sheet_bottom for all three menus.
 *  - tablet band + windowWidth < TABLET_LANDSCAPE_THRESHOLD (portrait)
 *    → sheet_bottom for all three.
 *  - tablet band + windowWidth >= TABLET_LANDSCAPE_THRESHOLD (landscape)
 *    → Act: panel_anchored; Inspect / Go: panel_side.
 *  - wide band → panel_anchored for all three.
 */
export function resolveMenuPresentation(
  input: MenuPresentationInput,
): MenuPresentationOutput {
  const { band, menu, windowHeight } = input;
  const safeHeight = Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 0;

  // Phone band — always sheet_bottom.
  if (band === 'phone') {
    return {
      variant: 'sheet_bottom',
      maxHeight: clampSheetHeight(safeHeight * SHEET_HEIGHT_FRACTION[menu]),
      width: null,
    };
  }

  // Tablet band — split by landscape vs portrait.
  if (band === 'tablet') {
    if (input.windowWidth < TABLET_LANDSCAPE_THRESHOLD) {
      // Portrait tablet — same as phone shape, with the comfortable
      // tablet width as the host responsibility.
      return {
        variant: 'sheet_bottom',
        maxHeight: clampSheetHeight(safeHeight * SHEET_HEIGHT_FRACTION[menu]),
        width: null,
      };
    }
    // Landscape tablet — Act anchored, Inspect / Go side panel.
    if (menu === 'act') {
      return {
        variant: 'panel_anchored',
        maxHeight: clampPanelHeight(safeHeight * TABLET_LANDSCAPE_HEIGHT_FRACTION.act),
        width: PANEL_WIDTH_BY_MENU.act,
      };
    }
    return {
      variant: 'panel_side',
      maxHeight: clampPanelHeight(safeHeight * TABLET_LANDSCAPE_HEIGHT_FRACTION[menu]),
      width: PANEL_WIDTH_BY_MENU[menu],
    };
  }

  // Wide band — all three menus are panel_anchored. Act is comparatively
  // shorter than Inspect/Go because its entry count is smaller.
  return {
    variant: 'panel_anchored',
    maxHeight: clampPanelHeight(safeHeight * WIDE_HEIGHT_FRACTION[menu]),
    width: PANEL_WIDTH_BY_MENU[menu],
  };
}

/**
 * Floor a sheet maxHeight to keep a readable surface even on very short
 * viewports. Returns at least `SHEET_MIN_HEIGHT_PX`; never returns more
 * than the input.
 */
function clampSheetHeight(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return SHEET_MIN_HEIGHT_PX;
  return Math.max(SHEET_MIN_HEIGHT_PX, Math.round(raw));
}

/**
 * Floor a panel maxHeight (side / anchored) to a sensible minimum so
 * the panel never collapses to a single row.
 */
function clampPanelHeight(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return SHEET_MIN_HEIGHT_PX;
  return Math.max(SHEET_MIN_HEIGHT_PX, Math.round(raw));
}
