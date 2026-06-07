/**
 * CARD-VIEW-REFINE-001 — Stack-mode keyboard + swipe navigation model.
 *
 * Pure-TS resolvers for the Cards (Stack) surface's chronological
 * Prev / Next navigation. The Stack uses CHRONOLOGICAL prev/next
 * (`handlePrev` / `handleNext` → `getPreviousMessageId` /
 * `getNextMessageId`), NOT the Timeline's DAG-based navigation — the
 * stack is an ordered fan of cards, so left/right is "the move before /
 * after this one in time".
 *
 * Two resolvers:
 *   - `resolveStackKeyEffect` — maps a web `keydown` to a 'prev' / 'next' /
 *     'first' / 'last' / 'none' effect. Bails (→ 'none') when the composer
 *     (a TextInput / contentEditable) is focused or a board menu/overlay is
 *     open, so the document-level listener never steals keys from typing or
 *     fights the Act/Inspect/Go menu key handler.
 *   - `resolveStackSwipeEffect` — maps a settled horizontal PanResponder
 *     gesture to 'prev' / 'next' / 'none'. A swipe LEFT (dx negative, finger
 *     moves left → content advances) goes to the NEXT (newer) move; a swipe
 *     RIGHT goes to the PREVIOUS (older) move. Below the threshold → 'none'
 *     (a tap or a tiny drag stays a tap = activate).
 *
 * Pure. No React, no Supabase, no network, no router. JSON-serializable IO.
 */

/** The navigation intent a stack key / swipe resolves to. */
export type StackNavEffect = 'prev' | 'next' | 'first' | 'last' | 'none';

export interface StackKeyEffectInput {
  /** `KeyboardEvent.key`. */
  key: string;
  /** True when a text input / textarea / contentEditable element is focused
   *  (the composer or any text field). When true the handler bails so arrow
   *  keys move the caret, not the card. */
  composerFocused: boolean;
  /** True when the board Act / Inspect / Go menu (or any overlay) is open.
   *  When true the handler bails so the menu's own key handler owns keys. */
  hasOpenMenu: boolean;
}

/**
 * Resolve a stack-mode keyboard effect. Pure.
 *
 *  - ArrowLeft  → 'prev'  (older move)
 *  - ArrowRight → 'next'  (newer move)
 *  - Home       → 'first' (oldest move)
 *  - End        → 'last'  (newest move)
 *  - anything else → 'none'
 *
 * Always returns 'none' when the composer is focused OR a menu/overlay is
 * open — those contexts own the keystroke.
 */
export function resolveStackKeyEffect(input: StackKeyEffectInput): StackNavEffect {
  if (!input || typeof input.key !== 'string') return 'none';
  if (input.composerFocused) return 'none';
  if (input.hasOpenMenu) return 'none';
  switch (input.key) {
    case 'ArrowLeft':
      return 'prev';
    case 'ArrowRight':
      return 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return 'none';
  }
}

/** Minimum horizontal travel (logical px) before a pan counts as a swipe.
 *  Below this it stays a tap (activate) / vertical scroll. */
export const STACK_SWIPE_THRESHOLD_PX = 48;

export interface StackSwipeEffectInput {
  /** Net horizontal travel of the gesture (release dx). Negative = left. */
  dx: number;
  /** Net vertical travel of the gesture (release dy). Used only to keep a
   *  predominantly-vertical drag (card scroll) from triggering nav. */
  dy: number;
  /** Threshold override (tests). Defaults to STACK_SWIPE_THRESHOLD_PX. */
  thresholdPx?: number;
}

/**
 * Resolve a settled horizontal swipe to a nav effect. Pure.
 *
 *  - dx <= -threshold AND |dx| > |dy|  → 'next' (swipe left → newer move)
 *  - dx >=  threshold AND |dx| > |dy|  → 'prev' (swipe right → older move)
 *  - otherwise → 'none'
 *
 * The `|dx| > |dy|` guard keeps a mostly-vertical drag (the card's own
 * scroll) from being read as a horizontal swipe.
 */
export function resolveStackSwipeEffect(input: StackSwipeEffectInput): StackNavEffect {
  if (!input || typeof input.dx !== 'number' || typeof input.dy !== 'number') {
    return 'none';
  }
  if (!Number.isFinite(input.dx) || !Number.isFinite(input.dy)) return 'none';
  const threshold =
    typeof input.thresholdPx === 'number' && input.thresholdPx > 0
      ? input.thresholdPx
      : STACK_SWIPE_THRESHOLD_PX;
  // A predominantly-vertical drag is the card's scroll, not a swipe.
  if (Math.abs(input.dx) <= Math.abs(input.dy)) return 'none';
  if (input.dx <= -threshold) return 'next';
  if (input.dx >= threshold) return 'prev';
  return 'none';
}

/**
 * Should the PanResponder CLAIM this move gesture? True only for a
 * predominantly-horizontal drag past a small slop, so vertical card-scroll
 * and taps are left alone. Pure mirror of the `onMoveShouldSetPanResponder`
 * predicate the Stack wires.
 */
export function shouldClaimStackHorizontalPan(dx: number, dy: number): boolean {
  if (typeof dx !== 'number' || typeof dy !== 'number') return false;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  // Small slop so an accidental jitter on a tap is not claimed.
  const SLOP = 8;
  return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SLOP;
}
