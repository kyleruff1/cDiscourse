/**
 * UX-001.3 — Composer haptic feedback shim (no-op).
 *
 * The brief lists haptic feedback as a SOFT requirement:
 *   - Light haptic on mode switch
 *   - Light haptic on submit success
 *   - Medium haptic on validation error
 *   "Haptics are NOT a hard requirement; if the platform does not
 *    support them cleanly, the composer functions identically without
 *    them."
 *
 * `expo-rn-patterns` §1.5 forbids speculative dependencies; the repo
 * has no `expo-haptics` import. Adding the dep just for the soft
 * requirement would violate that rule. UX-001.3 therefore ships a
 * NO-OP SHIM with the full API surface — every call is silently
 * ignored. A future card may swap the implementation for the real
 * `expo-haptics` call without changing any call site.
 *
 * Doctrine:
 *  - No new dependency.
 *  - No platform branching beyond the universal no-op.
 *  - No `console.log`; silent.
 *
 * Pure TS. No React. No Supabase. No network.
 */

/**
 * The discrete haptic intensities the composer asks for. Mirrors the
 * Expo haptics impact types so a future swap is mechanical. Plain
 * English label only — no verdict tokens.
 */
export type ComposerHapticKind = 'light' | 'medium' | 'success' | 'error';

/** Frozen array of every kind — tests iterate this. */
export const ALL_COMPOSER_HAPTIC_KINDS: ReadonlyArray<ComposerHapticKind> =
  Object.freeze(['light', 'medium', 'success', 'error']);

/**
 * Trigger a haptic. v1 is a no-op — the platform / dep situation is
 * documented in the file header. Returns synchronously; never throws.
 */
export function triggerHaptic(_kind: ComposerHapticKind): void {
  // Intentionally empty. See file header for the deferral rationale.
  // The argument is read via `void` so static analyzers do not flag it
  // as unused while keeping the signature stable for a future swap.
  void _kind;
}

/**
 * Returns true iff the shim is currently a no-op. The dock can read
 * this to avoid setting up state changes that exist only to feed haptic
 * triggers when the shim is dormant. v1 always returns `false`.
 */
export function hasHapticSupport(): boolean {
  return false;
}
