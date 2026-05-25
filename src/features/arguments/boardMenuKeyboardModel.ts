/**
 * UX-001.4 — Board-focus keyboard model for Act / Inspect / Go.
 *
 * Pure TS resolver that maps a keyboard event (key + modifier state +
 * composer-focus + open-menu state) onto one of five effects:
 *
 *   - `none`               — no menu effect; let the existing handler chain run
 *                            (Timeline arrow nav, etc.).
 *   - `open_act`           — A pressed on board focus → open Act menu.
 *   - `open_inspect`       — I pressed on board focus → open Inspect menu.
 *   - `open_go`            — G pressed on board focus → open Go menu.
 *   - `close_open_menu`    — Esc pressed while any of the three menus is open.
 *
 * Doctrine and rationale (UX-001.4 design §3.3 / §7 / §16.1):
 *
 *  - A / I / G fire **only** when the board has focus. When the composer
 *    is focused (per UX-001.3's `useComposerFocusContext`) the letter is
 *    consumed by the composer's text input and the resolver returns
 *    `none`. The board-menu handler runs at the `ArgumentGameSurface`
 *    level so the same gate covers both Timeline and Cards views.
 *
 *  - Modifier-held keystrokes (Cmd+A select-all, Ctrl+A, Alt+A) are
 *    NEVER captured. The resolver returns `none` for any combination
 *    that holds metaKey / ctrlKey / altKey. shiftKey is not held to a
 *    blocker: holding shift only changes case, never intent.
 *
 *  - Esc is only consumed by this resolver when `hasOpenMenu` is true.
 *    With no menu open, Esc falls through to the Timeline's existing
 *    `resolveTimelineNavEffect` (IX-003), which uses it to dismiss
 *    overlays / popovers.
 *
 *  - The resolver is platform-agnostic (no React, no React Native, no
 *    Platform.OS). The host (`ArgumentGameSurface`) wires it on web
 *    only via `Platform.OS === 'web'` + `document.addEventListener`.
 *
 *  - No verdict tokens, no internal codes. Effect names describe the
 *    UI action only (open / close). No `Date.now()`, no AI, no
 *    Supabase, no fetch.
 *
 * Pure TS. No React. No Supabase. No new dependency.
 */

/** Inputs to the resolver — every field a primitive. */
export interface BoardMenuKeyInput {
  /** The raw KeyboardEvent.key (e.g. "a", "A", "Escape", "Enter"). */
  key: string;
  /** Cmd (macOS) / Win key. */
  metaKey: boolean;
  /** Ctrl key. */
  ctrlKey: boolean;
  /** Shift key. Held shift does NOT block A/I/G — it only changes case. */
  shiftKey: boolean;
  /** Alt / Option key. */
  altKey: boolean;
  /**
   * True when the composer (or any descendant text input) currently
   * holds focus. Sourced from UX-001.3's `useComposerFocusContext`. The
   * resolver returns `none` for ANY key when this is true.
   */
  composerFocused: boolean;
  /**
   * True when any of the three board menus is currently visible. Drives
   * the Esc → `close_open_menu` branch. The resolver does NOT close
   * popovers other than the three menus — those are owned by their
   * existing handlers (e.g. PopoutChassis Esc, Timeline overlay Esc).
   */
  hasOpenMenu: boolean;
}

/** Discriminated-union output. */
export type BoardMenuKeyEffect =
  | { type: 'none' }
  | { type: 'open_act' }
  | { type: 'open_inspect' }
  | { type: 'open_go' }
  | { type: 'close_open_menu' };

/**
 * Map a keyboard event onto a board-menu effect. Pure. Deterministic.
 *
 * Resolution order (matches design §7.1):
 *   1. Composer focused → none (letter is consumed by the composer).
 *   2. Esc + hasOpenMenu → close_open_menu.
 *   3. Any modifier held (meta / ctrl / alt) → none.
 *   4. Letter A/I/G (lowercase or shifted uppercase) → open_act / open_inspect / open_go.
 *   5. Anything else → none.
 *
 * Returning `none` does NOT preventDefault — the host must call
 * preventDefault only for the four non-none branches so existing
 * shortcuts (Tab focus traversal, single-letter inputs in other
 * focused fields) continue to work.
 */
export function resolveBoardMenuKeyEffect(
  input: BoardMenuKeyInput,
): BoardMenuKeyEffect {
  // 1. Composer focused → never fire a menu shortcut.
  if (input.composerFocused) return { type: 'none' };

  // 2. Esc + menu open → close. With no menu open, Esc falls through
  //    to the Timeline's existing Esc handler (IX-003) which dismisses
  //    overlays / popovers.
  if (input.key === 'Escape' && input.hasOpenMenu) {
    return { type: 'close_open_menu' };
  }

  // 3. Any modifier held → none (avoid Cmd+A select-all, Ctrl+A,
  //    Alt+A). Shift is allowed (capitals are equally valid triggers).
  if (input.metaKey || input.ctrlKey || input.altKey) return { type: 'none' };

  // 4. Letter A / I / G — case-insensitive.
  if (input.key === 'a' || input.key === 'A') return { type: 'open_act' };
  if (input.key === 'i' || input.key === 'I') return { type: 'open_inspect' };
  if (input.key === 'g' || input.key === 'G') return { type: 'open_go' };

  // 5. Anything else.
  return { type: 'none' };
}
