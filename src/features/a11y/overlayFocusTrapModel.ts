/**
 * A11Y-PR0 (#913) — pure Tab-trap resolver for RN-web overlays.
 *
 * A focus trap keeps Tab / Shift+Tab inside an open overlay so a keyboard
 * or screen-reader user cannot reach a background control while a modal
 * surface is up. This module is the PURE decision layer: given the key,
 * the shift flag, and whether the active element sits at the first / last
 * focusable boundary, it returns what a Tab press should do. The DOM
 * plumbing (querying focusables, calling focus, preventDefault) lives in
 * the useOverlayA11y hook; keeping the decision pure mirrors
 * annotationFocusBoundary.ts and gives full-branch unit coverage.
 *
 * Doctrine: pure TS. No React, no DOM, no network, no Date. No verdict
 * tokens. JSON-serializable in and out.
 */

/**
 * CSS selector matching tab-reachable descendants in the rendered DOM.
 * RN-web renders Pressable / TextInput / anchor nodes as real focusable
 * DOM elements; this selector enumerates the standard focusable set and
 * excludes elements explicitly removed from the tab order
 * (tabindex="-1", disabled).
 */
export const FOCUSABLE_SELECTOR: string = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/** What a Tab keypress at a boundary should do inside a trap. */
export type FocusTrapEffect =
  | { type: 'pass' } // interior move — let the browser handle it
  | { type: 'wrap_to_first' } // Tab on the last element wraps to the first
  | { type: 'wrap_to_last' }; // Shift+Tab on the first element wraps to the last

/** Singleton pass — saves an allocation in the hot path. */
export const FOCUS_TRAP_PASS: FocusTrapEffect = Object.freeze({ type: 'pass' });

export interface FocusTrapInput {
  /** event.key */
  key: string;
  /** event.shiftKey */
  shiftKey: boolean;
  /** activeElement is the first focusable in scope. */
  atFirst: boolean;
  /** activeElement is the last focusable in scope. */
  atLast: boolean;
}

/**
 * Resolve the trap effect for one Tab keypress.
 *
 * Rules:
 *   - Any non-Tab key returns `pass` (the trap only governs Tab cycling).
 *   - Shift+Tab while at the first focusable wraps to the last.
 *   - Tab while at the last focusable wraps to the first.
 *   - Any interior Tab (not at a boundary) returns `pass` so the browser
 *     performs the natural next/previous move.
 *   - A single-focusable scope has `atFirst && atLast` both true: Tab
 *     wraps to first, Shift+Tab wraps to last (both resolve to the one
 *     element), so focus never escapes.
 *
 * Pure. Deterministic. Total.
 */
export function resolveFocusTrapEffect(input: FocusTrapInput): FocusTrapEffect {
  if (input.key !== 'Tab') return FOCUS_TRAP_PASS;
  if (input.shiftKey) {
    return input.atFirst ? { type: 'wrap_to_last' } : FOCUS_TRAP_PASS;
  }
  return input.atLast ? { type: 'wrap_to_first' } : FOCUS_TRAP_PASS;
}
