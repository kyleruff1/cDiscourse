/**
 * UX-BRAND-ASSETS-001 — Sign In hero lockup sizing (pure TS).
 *
 * The Sign In hero renders the cream "CivilDiscourse" horizontal lockup
 * (`assets/branding/lockup-horizontal.png`) on the dark brand field.
 * This module owns the single responsive sizing decision so it is unit
 * testable in isolation: given the viewport width, how wide (in logical
 * px) should the lockup `<Image>` render?
 *
 * Doctrine + invariants:
 * - Pure TypeScript — no React, no Supabase, no network. The AuthScreen
 *   imports the helper; this file never imports the screen.
 * - The lockup MUST NEVER cause horizontal overflow or a mobile edge
 *   gutter. The returned width is clamped to the card's available width
 *   (viewport minus the screen + card horizontal padding budget) and
 *   capped at `MAX_SIGNIN_LOCKUP_WIDTH_PX` so it stays an editorial
 *   brand mark rather than stretching across a wide viewport.
 * - The intrinsic aspect ratio (`SIGNIN_LOCKUP_ASPECT_RATIO` ≈ 1499/388)
 *   is preserved by the consumer via an EXPLICIT `height` style derived
 *   from the width (`resolveSignInLockupHeightPx`). React Native Web does
 *   NOT honor an `aspectRatio` style to derive an Image's height from its
 *   width — relying on it strands the cream art in a box sized to the
 *   PNG's intrinsic 388 px height. The explicit height keeps the rendered
 *   box at width / aspect on web AND native; `resizeMode="contain"` still
 *   guards against any sub-pixel drift.
 * - SSR / static-export safety: a non-positive / non-finite width (the
 *   `width === 0` first paint on `react-native-web` static export) falls
 *   back to the cap so the first paint shows the polished brand mark; the
 *   hydration pass corrects narrow viewports.
 */

/**
 * Intrinsic aspect ratio of `lockup-horizontal.png` (width / height).
 * Source asset is ~1499 × 388 px. Exported so the AuthScreen can pin the
 * `aspectRatio` style to the same value the width math assumes.
 */
export const SIGNIN_LOCKUP_ASPECT_RATIO = 1499 / 388;

/**
 * Hard cap on the rendered lockup width. Keeps the mark editorial on
 * tablet / wide viewports rather than letting it stretch full-bleed.
 */
export const MAX_SIGNIN_LOCKUP_WIDTH_PX = 320;

/**
 * Horizontal padding budget subtracted from the viewport width before
 * clamping. The `Screen` scroll content uses 20 px padding on each side
 * (40 px) and the value-prop card adds 16 px on each side (32 px), for
 * a total of 72 px of horizontal chrome around the lockup. Subtracting
 * it guarantees the lockup never reaches the screen edge on the
 * tightest phone viewport.
 */
export const SIGNIN_LOCKUP_HORIZONTAL_BUDGET_PX = 72;

/**
 * Resolve the rendered lockup width (logical px) for a viewport width.
 *
 * - Non-positive / non-finite width (SSR / first paint) → the cap.
 * - Otherwise: viewport minus the horizontal chrome budget, clamped to
 *   never exceed the cap and never go below 0.
 *
 * The result is always ≤ the card's available width AND ≤ the cap, so
 * the lockup can never overflow horizontally or create an edge gutter.
 */
export function resolveSignInLockupWidthPx(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return MAX_SIGNIN_LOCKUP_WIDTH_PX;
  }
  const available = Math.max(0, viewportWidth - SIGNIN_LOCKUP_HORIZONTAL_BUDGET_PX);
  return Math.min(MAX_SIGNIN_LOCKUP_WIDTH_PX, available);
}

/**
 * Resolve the rendered lockup height (logical px) for a viewport width.
 *
 * The height is the resolved width divided by the intrinsic aspect ratio,
 * so the rendered box preserves the lockup's ~1499/388 proportion. This is
 * set as an EXPLICIT `height` style on the consumer's `<Image>` because
 * React Native Web does NOT honor an `aspectRatio` style to derive an
 * Image's height from its width — without an explicit height the box
 * renders at the PNG's intrinsic 388 px height and the cream art is
 * stranded (letterboxed by `resizeMode="contain"`) in a huge empty band.
 *
 * Degenerate inputs (0 / NaN / Infinity) are handled exactly as the width
 * helper handles them: `resolveSignInLockupWidthPx` falls back to the cap,
 * so the height falls back to `MAX_SIGNIN_LOCKUP_WIDTH_PX / aspect`. The
 * result is therefore always finite and positive.
 *
 * Rounded to 0.01 px so the value stays deterministic across platforms
 * (no long binary fractions in the rendered style / snapshots).
 */
export function resolveSignInLockupHeightPx(viewportWidth: number): number {
  const width = resolveSignInLockupWidthPx(viewportWidth);
  return Math.round((width / SIGNIN_LOCKUP_ASPECT_RATIO) * 100) / 100;
}
