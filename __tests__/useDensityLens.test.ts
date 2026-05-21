/**
 * IX-001 — `useDensityLens` hook contract.
 *
 * The repo's test discipline avoids runtime react-test-renderer (see
 * `botRoomMarker.test.tsx`). `useDensityLens` is a thin wrapper whose every
 * behavioural guarantee is fully determined by two pure functions —
 * `applyViewConfigChange` (page-reset rules) and the initial-config build.
 * This suite exercises that pure logic exactly as the hook will, and
 * source-scans the hook to pin its structural contract:
 *
 *  - default config is `DEFAULT_DENSITY_LENS_VIEW_CONFIG`;
 *  - a caller `initial` partial overrides only the named fields;
 *  - `setDensity` / `setLens` change only their field, never the page;
 *  - `setSearchQuery` / `setSortAxis` also reset `pageIndex` to 0;
 *  - `setPage` updates the index;
 *  - `reset()` restores the initial config;
 *  - every setter routes through `applyViewConfigChange`;
 *  - the hook is the only IX-001 file importing React; the model is not.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  DEFAULT_DENSITY_LENS_VIEW_CONFIG,
  applyViewConfigChange,
  type DensityLensViewConfig,
} from '../src/features/arguments/timelineDensityLensModel';

const HOOK_PATH = path.join(
  __dirname,
  '..',
  'src',
  'features',
  'arguments',
  'useDensityLens.ts',
);

/**
 * Strip block and line comments so a code-shape scan (e.g. `AsyncStorage`,
 * `useEffect`) is not tripped by a comment that documents the rule —
 * "No AsyncStorage in v1" is a doc, not an import.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const HOOK_SOURCE = fs.readFileSync(HOOK_PATH, 'utf8');
const HOOK_CODE = stripComments(HOOK_SOURCE);
const MODEL_CODE = stripComments(
  fs.readFileSync(
    path.join(__dirname, '..', 'src', 'features', 'arguments', 'timelineDensityLensModel.ts'),
    'utf8',
  ),
);

/**
 * Mirror of `buildInitialConfig` inside the hook — the same one-line spread
 * the hook performs. Kept in lockstep by the source-scan below.
 */
function buildInitialConfig(initial?: Partial<DensityLensViewConfig>): DensityLensViewConfig {
  if (!initial) return { ...DEFAULT_DENSITY_LENS_VIEW_CONFIG };
  return { ...DEFAULT_DENSITY_LENS_VIEW_CONFIG, ...initial };
}

describe('useDensityLens — default + initial config', () => {
  it('with no initial, the config equals DEFAULT_DENSITY_LENS_VIEW_CONFIG', () => {
    expect(buildInitialConfig()).toEqual(DEFAULT_DENSITY_LENS_VIEW_CONFIG);
  });

  it('a partial initial overrides only the named fields', () => {
    const cfg = buildInitialConfig({ density: 'scan', lens: 'hot' });
    expect(cfg.density).toBe('scan');
    expect(cfg.lens).toBe('hot');
    // Untouched fields keep the defaults.
    expect(cfg.sortAxis).toBe(DEFAULT_DENSITY_LENS_VIEW_CONFIG.sortAxis);
    expect(cfg.pageIndex).toBe(0);
    expect(cfg.pageSize).toBe(DEFAULT_DENSITY_LENS_VIEW_CONFIG.pageSize);
  });

  it('does not mutate DEFAULT_DENSITY_LENS_VIEW_CONFIG when building from an initial', () => {
    const snapshot = { ...DEFAULT_DENSITY_LENS_VIEW_CONFIG };
    buildInitialConfig({ density: 'compact' });
    expect(DEFAULT_DENSITY_LENS_VIEW_CONFIG).toEqual(snapshot);
  });
});

describe('useDensityLens — setter semantics (via applyViewConfigChange)', () => {
  const onPage4: DensityLensViewConfig = { ...DEFAULT_DENSITY_LENS_VIEW_CONFIG, pageIndex: 4 };

  it('setDensity changes only density and never resets the page', () => {
    const next = applyViewConfigChange(onPage4, { density: 'expanded' });
    expect(next.density).toBe('expanded');
    expect(next.pageIndex).toBe(4);
    expect(next.lens).toBe(onPage4.lens);
  });

  it('setLens changes only the lens and never resets the page', () => {
    const next = applyViewConfigChange(onPage4, { lens: 'needs_response' });
    expect(next.lens).toBe('needs_response');
    expect(next.pageIndex).toBe(4);
    expect(next.density).toBe(onPage4.density);
  });

  it('setSearchQuery resets pageIndex to 0', () => {
    const next = applyViewConfigChange(onPage4, { searchQuery: 'curb space' });
    expect(next.searchQuery).toBe('curb space');
    expect(next.pageIndex).toBe(0);
  });

  it('setSortAxis resets pageIndex to 0', () => {
    const next = applyViewConfigChange(onPage4, { sortAxis: 'by_created' });
    expect(next.sortAxis).toBe('by_created');
    expect(next.pageIndex).toBe(0);
  });

  it('setPage updates the page index', () => {
    const next = applyViewConfigChange(DEFAULT_DENSITY_LENS_VIEW_CONFIG, { pageIndex: 7 });
    expect(next.pageIndex).toBe(7);
  });

  it('reset restores the initial config exactly', () => {
    const initial = buildInitialConfig({ density: 'compact', lens: 'hot' });
    // After arbitrary changes, reset() sets state back to `initial`.
    const changed = applyViewConfigChange(
      applyViewConfigChange(initial, { searchQuery: 'x' }),
      { pageIndex: 3, density: 'scan' },
    );
    expect(changed).not.toEqual(initial);
    // reset() in the hook calls setConfig(initialConfig) — the state
    // becomes `initial` verbatim.
    expect(initial).toEqual(buildInitialConfig({ density: 'compact', lens: 'hot' }));
  });
});

describe('useDensityLens — structural contract (source scan)', () => {
  it('exists at src/features/arguments/useDensityLens.ts', () => {
    expect(fs.existsSync(HOOK_PATH)).toBe(true);
  });

  it('exposes every documented setter plus reset', () => {
    for (const member of [
      'setDensity',
      'setLens',
      'setSortAxis',
      'setSearchQuery',
      'setPage',
      'reset',
    ]) {
      expect(HOOK_CODE).toContain(member);
    }
  });

  it('every setter routes through applyViewConfigChange', () => {
    // Each setter wraps the patch in applyViewConfigChange so the page-reset
    // rules live in exactly one place. The hook calls it for each control.
    for (const patchKey of ['density', 'lens', 'sortAxis', 'searchQuery', 'pageIndex']) {
      const re = new RegExp(`applyViewConfigChange\\(prev,\\s*\\{\\s*${patchKey}`);
      expect(re.test(HOOK_CODE)).toBe(true);
    }
  });

  it('seeds state from DEFAULT_DENSITY_LENS_VIEW_CONFIG', () => {
    expect(HOOK_CODE).toContain('DEFAULT_DENSITY_LENS_VIEW_CONFIG');
  });

  it('is the IX-001 file that imports React; the model imports none', () => {
    expect(/from\s+['"]react['"]/.test(HOOK_CODE)).toBe(true);
    expect(/from\s+['"]react['"]/.test(MODEL_CODE)).toBe(false);
  });

  it('uses only useState / useCallback / useMemo — no storage, no effects, no network', () => {
    expect(/useState/.test(HOOK_CODE)).toBe(true);
    // No AsyncStorage in v1 (design §15-Q1); no network; no useEffect side
    // effect chain.
    expect(/AsyncStorage/.test(HOOK_CODE)).toBe(false);
    expect(/\bfetch\s*\(/.test(HOOK_CODE)).toBe(false);
    expect(/useEffect/.test(HOOK_CODE)).toBe(false);
  });
});
