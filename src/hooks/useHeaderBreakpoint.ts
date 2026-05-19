/**
 * BRAND-001 Stage 2 — header breakpoint hook.
 *
 * Tiny `useWindowDimensions()` wrapper. Returns the resolved logo /
 * header heights for the current viewport, plus an `isWide` flag.
 *
 * Doctrine + invariants:
 * - Pure React hook. No `Platform.OS` branching beyond what
 *   `useWindowDimensions` already gives us.
 * - Reads BRAND constants only; never mutates them.
 * - On `react-native-web` static export the initial render may report
 *   `width = 0` before hydration. The design's preferred behavior is
 *   to treat `width === 0` (or any non-positive value) as wide so the
 *   first paint shows the polished layout; the next paint after
 *   hydration corrects narrow viewports.
 */
import { useWindowDimensions } from 'react-native';
import { BRAND } from '../lib/designTokens';

export interface HeaderBreakpoint {
  /** True when window width ≥ BRAND.headerWideBreakpointPx. */
  isWide: boolean;
  /** Resolved logo height for this breakpoint. */
  logoHeightPx: number;
  /** Resolved header total height for this breakpoint. */
  headerHeightPx: number;
}

/**
 * Pure resolver used by `useHeaderBreakpoint`. Extracted so unit
 * tests can pin the breakpoint logic without depending on React's
 * hook runtime. Calling code should prefer the hook.
 *
 * SSR / static-export safety: a non-positive width (typically 0
 * during the first render of an `expo export --platform web` output)
 * defaults to the wide layout so the first paint is the polished
 * layout. The hydration pass will narrow it down if needed.
 */
export function resolveHeaderBreakpoint(width: number): HeaderBreakpoint {
  const isWide = !(width > 0) || width >= BRAND.headerWideBreakpointPx;
  return {
    isWide,
    logoHeightPx: isWide ? BRAND.logoHeightPxWide : BRAND.logoHeightPx,
    headerHeightPx: isWide ? BRAND.headerHeightPxWide : BRAND.headerHeightPx,
  };
}

export function useHeaderBreakpoint(): HeaderBreakpoint {
  const { width } = useWindowDimensions();
  return resolveHeaderBreakpoint(width);
}
