/**
 * IX-001 — `useDensityLens` session-state hook.
 *
 * A thin React hook holding ONE `DensityLensViewConfig` in `useState`,
 * seeded from `DEFAULT_DENSITY_LENS_VIEW_CONFIG`. Every setter routes
 * through `applyViewConfigChange` so the page-reset rules (search/sort
 * reset the page; density/lens do not) are enforced in exactly one place.
 *
 * Session-scoped (design §15-Q1): the config lives in component state for
 * the lifetime of the surface. No AsyncStorage in v1 — a future card can
 * seed `initial.density` from PR-001's persisted `DensityPreference` so the
 * device default flows in while the session override stays ephemeral.
 *
 * This is the ONLY file in IX-001 that imports React. The model
 * (`timelineDensityLensModel.ts`) is pure TS and stays React-free.
 */

import { useCallback, useMemo, useState } from 'react';

import {
  DEFAULT_DENSITY_LENS_VIEW_CONFIG,
  applyViewConfigChange,
  type DensityLensViewConfig,
  type FocusLensId,
  type GalleryDensityMode,
  type GallerySortAxis,
} from './timelineDensityLensModel';

export interface UseDensityLensResult {
  config: DensityLensViewConfig;
  setDensity: (mode: GalleryDensityMode) => void;
  setLens: (lens: FocusLensId) => void;
  setSortAxis: (axis: GallerySortAxis) => void;
  setSearchQuery: (q: string) => void;
  setPage: (index: number) => void;
  reset: () => void;
}

/**
 * Build the initial config from the defaults plus any caller overrides.
 * Overrides are spread on top of `DEFAULT_DENSITY_LENS_VIEW_CONFIG`, so a
 * partial `initial` only changes the named fields.
 */
function buildInitialConfig(initial?: Partial<DensityLensViewConfig>): DensityLensViewConfig {
  if (!initial) {
    return { ...DEFAULT_DENSITY_LENS_VIEW_CONFIG };
  }
  return { ...DEFAULT_DENSITY_LENS_VIEW_CONFIG, ...initial };
}

/**
 * Hold one `DensityLensViewConfig` for a gallery / popout surface.
 *
 * `setDensity` / `setLens` change only their field (no page reset —
 * density never changes membership, a lens dims rather than removes).
 * `setSortAxis` / `setSearchQuery` also snap `pageIndex` to 0 via
 * `applyViewConfigChange` (they genuinely reorder the list). `reset`
 * restores the caller's initial config.
 */
export function useDensityLens(initial?: Partial<DensityLensViewConfig>): UseDensityLensResult {
  // The initial config is computed once; `initial` is a seed, not a live
  // prop. A surface that needs to react to a changing seed should remount.
  const initialConfig = useMemo(() => buildInitialConfig(initial), [initial]);
  const [config, setConfig] = useState<DensityLensViewConfig>(initialConfig);

  const setDensity = useCallback((mode: GalleryDensityMode) => {
    setConfig((prev) => applyViewConfigChange(prev, { density: mode }));
  }, []);

  const setLens = useCallback((lens: FocusLensId) => {
    setConfig((prev) => applyViewConfigChange(prev, { lens }));
  }, []);

  const setSortAxis = useCallback((axis: GallerySortAxis) => {
    setConfig((prev) => applyViewConfigChange(prev, { sortAxis: axis }));
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setConfig((prev) => applyViewConfigChange(prev, { searchQuery: q }));
  }, []);

  const setPage = useCallback((index: number) => {
    setConfig((prev) => applyViewConfigChange(prev, { pageIndex: index }));
  }, []);

  const reset = useCallback(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  return { config, setDensity, setLens, setSortAxis, setSearchQuery, setPage, reset };
}
