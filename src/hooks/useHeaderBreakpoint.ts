/**
 * BRAND-001 Stage 2 / UX-001.1 Phase 1 — header breakpoint hook.
 *
 * Tiny `useWindowDimensions()` wrapper. Returns the resolved logo /
 * header heights for the current viewport, the new 3-band breakpoint
 * (`band: 'phone' | 'tablet' | 'wide'`), and the legacy `isWide` flag
 * preserved as a back-compat alias.
 *
 * Doctrine + invariants:
 * - Pure React hook. No `Platform.OS` branching beyond what
 *   `useWindowDimensions` already gives us.
 * - Reads BRAND constants only; never mutates them.
 * - On `react-native-web` static export the initial render may report
 *   `width = 0` before hydration. The design's preferred behavior is
 *   to treat `width === 0` (or any non-positive value) as wide so the
 *   first paint shows the polished layout; the next paint after
 *   hydration corrects narrow viewports. The new `resolveBand`
 *   preserves this: `resolveBand(0) === 'wide'`.
 *
 * UX-001.1 additions (additive only, every Stage 1 + Stage 2 contract
 * preserved):
 * - New exported `Band` type (`'phone' | 'tablet' | 'wide'`).
 * - New exported `resolveBand(width)` pure helper.
 * - `HeaderBreakpoint` interface gains a new `band: Band` field.
 * - `resolveHeaderBreakpoint(width)` returns the new `band` AND
 *   populates `logoHeightPx` / `headerHeightPx` from
 *   `BRAND.logoHeightByBand` / `BRAND.headerHeightByBand` (the legacy
 *   wide values are preserved at `BRAND.logoHeightPxWide` /
 *   `BRAND.headerHeightPxWide` for back-compat).
 * - `isWide` semantic: `band !== 'phone'`. Existing assertions on
 *   `isWide=true at 720dp` continue to pass because 720 falls in the
 *   tablet band (tablet is not phone, so `isWide=true`).
 */
import { useWindowDimensions } from 'react-native';
import { BRAND } from '../lib/designTokens';

/**
 * UX-001.1 — 3-band breakpoint label. Authoritative for new code.
 * The legacy `isWide` boolean on `HeaderBreakpoint` is back-compat
 * only and equals `band !== 'phone'`.
 */
export type Band = 'phone' | 'tablet' | 'wide';

export interface HeaderBreakpoint {
  /**
   * Back-compat alias. Semantic: `band !== 'phone'`.
   * - phone (< 600 dp) → false
   * - tablet (600..1279 dp) → true
   * - wide (>= 1280 dp) → true
   * - non-positive width (SSR safety) → true
   */
  isWide: boolean;
  /** UX-001.1 — 3-band breakpoint label. */
  band: Band;
  /** Resolved logo height for this breakpoint, from `BRAND.logoHeightByBand`. */
  logoHeightPx: number;
  /** Resolved header total height for this breakpoint, from `BRAND.headerHeightByBand`. */
  headerHeightPx: number;
}

/**
 * UX-001.1 — Pure band resolver. Extracted so unit tests can pin
 * the breakpoint logic without depending on React's hook runtime.
 *
 * SSR / static-export safety: a non-positive width (typically 0 during
 * the first render of an `expo export --platform web` output) defaults
 * to the wide band so the first paint is the polished layout. The
 * hydration pass corrects narrow viewports.
 */
export function resolveBand(width: number): Band {
  if (!(width > 0)) return 'wide';
  if (width <= BRAND.breakpoints.phone.maxPx) return 'phone';
  if (width <= BRAND.breakpoints.tablet.maxPx) return 'tablet';
  return 'wide';
}

/**
 * Pure resolver used by `useHeaderBreakpoint`. Extracted so unit
 * tests can pin the breakpoint logic without depending on React's
 * hook runtime. Calling code should prefer the hook.
 *
 * SSR / static-export safety: a non-positive width defaults to the
 * wide band so the first paint is the polished layout.
 */
export function resolveHeaderBreakpoint(width: number): HeaderBreakpoint {
  const band = resolveBand(width);
  const isWide = band !== 'phone';
  return {
    isWide,
    band,
    logoHeightPx: BRAND.logoHeightByBand[band],
    headerHeightPx: BRAND.headerHeightByBand[band],
  };
}

export function useHeaderBreakpoint(): HeaderBreakpoint {
  const { width } = useWindowDimensions();
  return resolveHeaderBreakpoint(width);
}
