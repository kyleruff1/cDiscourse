/**
 * UX-001.3 — Composer keyboard shortcut model (pure TypeScript).
 *
 * The brief's keyboard contract (§"The keyboard and shortcut contract"):
 *   - Cmd/Ctrl + Enter → submit
 *   - Cmd/Ctrl + K → open mode switcher
 *   - Tab / Shift+Tab → move between fields (DOM-native)
 *   - Esc → collapse the composer; pressing Esc twice fully dismisses
 *     (UX-001.3 operator-accepted shift)
 *
 * Focus-context routing: composer shortcuts ONLY fire when the composer
 * is focused. When the board (Timeline) is focused, the composer's
 * `document`-level handler returns `'none'` and the Timeline's existing
 * arrow-key navigation runs unimpeded. The boolean is supplied by
 * `useComposerFocusContext`.
 *
 * Doctrine:
 *  - Pure TypeScript. No React. No Supabase. No network. No `Date.now()`.
 *  - No verdict tokens.
 *  - Idempotent on identical inputs.
 *
 * Pure TS. No new dependency.
 */

/**
 * The discrete effects the composer's keyboard handler dispatches. Each
 * effect describes WHAT to do, not HOW; the dock wires the actual
 * submit / open / close calls.
 */
export type ComposerKeyEffect =
  | { type: 'none' }
  | { type: 'submit' }
  | { type: 'open_mode_switcher' }
  | { type: 'close' };

/** Frozen array of every effect type — tests iterate this. */
export const ALL_COMPOSER_KEY_EFFECT_TYPES: ReadonlyArray<ComposerKeyEffect['type']> =
  Object.freeze(['none', 'submit', 'open_mode_switcher', 'close']);

/**
 * Inputs to the resolver. Mirrors the load-bearing fields of a DOM
 * `KeyboardEvent`. The pure model accepts a plain object so it can be
 * unit-tested without a browser harness.
 */
export interface ComposerKeyInput {
  /** `event.key` — e.g. `'Enter'`, `'k'`, `'Escape'`, `'Tab'`. */
  key: string;
  /** macOS Cmd modifier. */
  metaKey: boolean;
  /** Windows / Linux Ctrl modifier. */
  ctrlKey: boolean;
  /** Shift modifier. */
  shiftKey: boolean;
  /**
   * True iff focus is meaningfully inside the composer. When false,
   * EVERY composer shortcut returns `{ type: 'none' }` so board
   * shortcuts (arrow keys, Home / End) run uncontested.
   *
   * The boolean is owned by `useComposerFocusContext` — it tracks the
   * `document.activeElement` against a registered container ref. A
   * collapsed composer with no focused input is `false`; an expanded
   * composer with a TextInput focused is `true`.
   */
  composerFocused: boolean;
}

/**
 * Resolve a keyboard event into a composer effect.
 *
 * Rules (matches brief §"The keyboard and shortcut contract"):
 *   1. composerFocused === false → `{ type: 'none' }` ALWAYS.
 *   2. Cmd/Ctrl + Enter → `{ type: 'submit' }`.
 *   3. Cmd/Ctrl + K (any case) → `{ type: 'open_mode_switcher' }`.
 *   4. Escape → `{ type: 'close' }`.
 *      The dock interprets `'close'` as "collapse to strip" on the
 *      first press and "fully dismiss" on the second press in
 *      quick succession; that two-press semantics is owned by the
 *      dock, not this pure model.
 *   5. Tab / Shift+Tab → `{ type: 'none' }`. The brief is explicit
 *      that Tab moves between fields — that is the browser default,
 *      so the pure model returns no effect (the dock does not
 *      prevent-default).
 *
 * Pure. Deterministic. Idempotent.
 */
export function resolveComposerKeyEffect(
  input: ComposerKeyInput,
): ComposerKeyEffect {
  if (!input.composerFocused) {
    return { type: 'none' };
  }
  const cmdOrCtrl = input.metaKey || input.ctrlKey;
  // Cmd/Ctrl + Enter — submit.
  if (cmdOrCtrl && input.key === 'Enter') {
    return { type: 'submit' };
  }
  // Cmd/Ctrl + K — open the mode switcher. Accept lowercase + uppercase
  // because some keyboard layouts deliver Shift-combined keys.
  if (cmdOrCtrl && (input.key === 'k' || input.key === 'K')) {
    return { type: 'open_mode_switcher' };
  }
  // Esc — close (the dock interprets as collapse-then-dismiss).
  if (input.key === 'Escape') {
    return { type: 'close' };
  }
  // Tab / Shift+Tab — DOM-native, no effect from the composer model.
  return { type: 'none' };
}

/**
 * Convenience: returns true iff a key input matches any composer
 * shortcut (i.e. the resolver would return something other than
 * `'none'` when composerFocused is true). Useful for the dock to
 * pre-filter events before doing work.
 */
export function isComposerShortcut(input: ComposerKeyInput): boolean {
  // We test against composerFocused: true so the resolver actually
  // considers the shortcut bindings (the input's own focus boolean is
  // ignored here — this is a structural classifier).
  const effect = resolveComposerKeyEffect({ ...input, composerFocused: true });
  return effect.type !== 'none';
}
