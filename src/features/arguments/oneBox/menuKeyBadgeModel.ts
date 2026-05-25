/**
 * UX-001.4 — Menu key-badge presentation model.
 *
 * Pure TS resolver that decides whether to render the small `A` / `I` /
 * `G` monospace badge next to the menu trigger. The brief specifies
 * (UX-001.4 design §8, brief §"Keyboard and shortcut contract"):
 *
 *  - Badges render on BROWSER viewports (Platform.OS === 'web' AND
 *    wide-enough viewport).
 *  - Badges do NOT render on phone or tablet portrait (no keyboard
 *    expected).
 *  - Tablet landscape (>= 1024 dp web) renders badges (the user likely
 *    has a hardware keyboard at that viewport).
 *  - Native (iOS / Android / Windows / macOS) never renders badges; the
 *    screen-reader user gets the shortcut via the trigger's
 *    `accessibilityLabel` ("Open Act menu. Keyboard shortcut: A.").
 *
 * Doctrine:
 *  - Pure TS. No React. No Supabase. No `Date.now()`. No AI.
 *  - No verdict / amplification tokens. No internal-code leaks.
 *  - The badge `<Text>` itself is rendered by the chassis
 *    `PopoutEntry`; this model only decides VISIBILITY + carries the
 *    context derivation. The accessibility text (which all users get
 *    regardless of platform) lives on the trigger.
 *
 * Pure TS. No new dependency.
 */

/**
 * The input context that drives badge visibility. Three values cover
 * the matrix:
 *   - browser_keyboard: render badges.
 *   - touch: do not render badges.
 *   - unknown: do not render badges (safest fallback for SSR / tests
 *     that omit Platform.OS).
 */
export type MenuKeyBadgeContext = 'browser_keyboard' | 'touch' | 'unknown';

/** Resolver input for `deriveMenuKeyBadgeContext`. */
export interface DeriveMenuKeyBadgeContextInput {
  /**
   * Platform.OS read at the call site. The model accepts the literal
   * so it remains React-Native-free; the host (`ArgumentGameSurface`)
   * passes `Platform.OS`.
   */
  platformOs: 'web' | 'ios' | 'android' | 'windows' | 'macos';
  /** Window width (logical px). */
  windowWidth: number;
}

/**
 * Per-platform threshold (logical px) above which the web viewport is
 * treated as a keyboard context. iPad Pro horizontal (1024 dp) sits at
 * the boundary; the brief explicitly accepts treating wide tablet web
 * as a keyboard context.
 */
export const BROWSER_KEYBOARD_WIDTH_THRESHOLD = 1024;

/**
 * Derive the badge context from platform + viewport. Pure.
 *
 * Rules:
 *   - platformOs !== 'web' → touch (native).
 *   - web + windowWidth >= 1024 → browser_keyboard.
 *   - web + smaller viewport → touch (phone / tablet portrait web).
 *   - any non-finite or zero / negative width → unknown.
 */
export function deriveMenuKeyBadgeContext(
  input: DeriveMenuKeyBadgeContextInput,
): MenuKeyBadgeContext {
  if (!Number.isFinite(input.windowWidth) || input.windowWidth <= 0) {
    return 'unknown';
  }
  if (input.platformOs !== 'web') return 'touch';
  if (input.windowWidth >= BROWSER_KEYBOARD_WIDTH_THRESHOLD) return 'browser_keyboard';
  return 'touch';
}

/** Resolver input for `resolveKeyBadgeVisibility`. */
export interface KeyBadgeInput {
  /** Derived context. */
  context: MenuKeyBadgeContext;
  /**
   * Whether the user prefers reduced motion. Reserved for future use
   * (a heavy badge animation could be quieted when reduce-motion is on);
   * v1 ignores this — the badge is a static chip with no animation.
   */
  reduceMotion: boolean;
}

/**
 * Resolve whether to render a key badge. Pure.
 *
 * Returns true ONLY for `browser_keyboard`. Touch and unknown contexts
 * hide the badge entirely; the trigger's `accessibilityLabel` still
 * carries the shortcut text so screen-reader users learn the keys
 * regardless of badge visibility.
 */
export function resolveKeyBadgeVisibility(input: KeyBadgeInput): boolean {
  // reduce-motion is reserved for a future card; touching it now keeps
  // the unused-parameter signal explicit.
  void input.reduceMotion;
  return input.context === 'browser_keyboard';
}
