/**
 * UX-001.5 — Pure-TS keyboard focus boundary model for chip strips.
 *
 * The `AnnotationChipStrip` wraps its chips in an `AnnotationFocusBoundary`
 * on web (`Platform.OS === 'web'`) to enable arrow-key navigation
 * between chips. This module is the pure-TS interpreter: it takes a
 * keyboard event and returns the focus effect the strip should apply.
 *
 * Doctrine:
 *   - No new keyboard shortcut conflicts (A / I / G stay free per
 *     UX-001.3 + UX-001.4 contracts). Modifier keys present →
 *     `FOCUS_BOUNDARY_NOOP` so Tab still works at the OS / browser
 *     level.
 *   - Pure TS. No React. No DOM. Tested in isolation.
 */

/**
 * The set of focus effects the boundary can dispatch. The component
 * wrapper translates these into focus calls on the chip children.
 */
export type FocusBoundaryKeyEffect =
  | { type: 'focus_next' }
  | { type: 'focus_prev' }
  | { type: 'focus_first' }
  | { type: 'focus_last' }
  | { type: 'exit_boundary' }
  | { type: 'noop' };

/** Singleton noop — saves an allocation in the hot path. */
export const FOCUS_BOUNDARY_NOOP: FocusBoundaryKeyEffect = Object.freeze({ type: 'noop' });

/** Modifier-key bag accepted by `resolveFocusBoundaryKeyEffect`. */
export interface FocusBoundaryModifiers {
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
}

/**
 * Resolve the focus effect for one keyboard event.
 *
 * Behavior (design §2 #12):
 *   - `ArrowRight` / `ArrowDown` → `focus_next`
 *   - `ArrowLeft` / `ArrowUp` → `focus_prev`
 *   - `Home` → `focus_first`
 *   - `End` → `focus_last`
 *   - `Escape` → `exit_boundary`
 *   - Any modifier key present → `noop` (so Tab + accelerators still
 *     work at the OS level)
 *   - Unknown key → `noop`
 *
 * Pure. Deterministic. Tested.
 */
export function resolveFocusBoundaryKeyEffect(
  key: string,
  modifiers: FocusBoundaryModifiers,
): FocusBoundaryKeyEffect {
  // Modifier-key noop — preserves Tab + accelerator key behavior.
  if (modifiers.shift || modifiers.alt || modifiers.ctrl || modifiers.meta) {
    return FOCUS_BOUNDARY_NOOP;
  }

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return { type: 'focus_next' };
    case 'ArrowLeft':
    case 'ArrowUp':
      return { type: 'focus_prev' };
    case 'Home':
      return { type: 'focus_first' };
    case 'End':
      return { type: 'focus_last' };
    case 'Escape':
      return { type: 'exit_boundary' };
    default:
      return FOCUS_BOUNDARY_NOOP;
  }
}

/**
 * Compute the next focused index after an effect is applied.
 *
 * Wraps within `[0, total - 1]`. For an empty list returns `null` so the
 * component can render nothing. `current` is the currently focused
 * index, or `null` when the boundary is unfocused — in that case
 * `focus_next` starts at 0, `focus_prev` starts at `total - 1`,
 * `focus_first` at 0, `focus_last` at `total - 1`.
 *
 * Pure. Deterministic.
 */
export function applyFocusBoundaryEffect(
  effect: FocusBoundaryKeyEffect,
  current: number | null,
  total: number,
): number | null {
  if (total <= 0) return null;
  switch (effect.type) {
    case 'focus_next': {
      if (current === null) return 0;
      const next = current + 1;
      return next >= total ? 0 : next;
    }
    case 'focus_prev': {
      if (current === null) return total - 1;
      const prev = current - 1;
      return prev < 0 ? total - 1 : prev;
    }
    case 'focus_first':
      return 0;
    case 'focus_last':
      return total - 1;
    case 'exit_boundary':
      return null;
    case 'noop':
    default:
      return current;
  }
}
