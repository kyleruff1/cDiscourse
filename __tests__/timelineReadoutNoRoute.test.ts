/**
 * IX-004 — readout selection triggers no route transition.
 *
 * The acceptance criterion: selecting a node / pressing Prev / Next /
 * Latest / Back-to-root mutates LOCAL state only — never a router push
 * or navigation call. The readout panel is strictly in-surface.
 *
 * This file is a static scan (mirrors `inRoomNoRoute.test.ts` /
 * `composerDockNoRoute.test.ts`):
 *
 *   1. `TimelineSelectedReadoutPanel.tsx` and
 *      `timelineSelectedReadoutModel.ts` contain zero references to
 *      `expo-router`, `@react-navigation`, `react-router`, `router.`,
 *      `navigation.`, or `Linking`.
 *   2. The IX-004 selection-mutating callbacks in `ArgumentGameSurface.tsx`
 *      (handleActivate / handlePrev / handleNext / the jump closures /
 *      the stale-snap effect) call only local `setState` setters, with no
 *      navigation call in the surrounding window.
 *   3. The model is pure — no `supabase`, no `fetch(`, no
 *      `SERVICE_ROLE` / `ANTHROPIC_API_KEY`, no React import.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const MODEL_REL = 'src/features/arguments/timelineSelectedReadoutModel.ts';
const PANEL_REL = 'src/features/arguments/TimelineSelectedReadoutPanel.tsx';
const SURFACE_REL = 'src/features/arguments/ArgumentGameSurface.tsx';

const ROUTING_IMPORT_PATTERNS: RegExp[] = [
  /from\s+['"]@react-navigation\/[^'"]+['"]/,
  /from\s+['"]expo-router['"]/,
  /from\s+['"]react-router(?:-native|-dom)?['"]/,
  /import\s+\{\s*useNavigation\s*\}/,
];

const ROUTING_CALL_PATTERNS: RegExp[] = [
  /\bnavigation\.(navigate|push|replace|reset)\s*\(/,
  /\brouter\.(push|replace)\s*\(/,
  /\bLinking\.openURL\s*\(/,
];

// ── 1. New IX-004 files contain no routing primitive ──────────

describe('IX-004 — readout model + panel import no navigation library', () => {
  it.each([MODEL_REL, PANEL_REL])('%s imports no navigation library', (rel) => {
    const src = read(rel);
    for (const re of ROUTING_IMPORT_PATTERNS) {
      expect(src).not.toMatch(re);
    }
  });

  it.each([MODEL_REL, PANEL_REL])('%s makes no navigation / Linking call', (rel) => {
    const src = read(rel);
    for (const re of ROUTING_CALL_PATTERNS) {
      expect(src).not.toMatch(re);
    }
  });

  it.each([MODEL_REL, PANEL_REL])('%s references no router / navigation identifier', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/\brouter\b/);
    expect(src).not.toMatch(/\bnavigation\b/);
  });
});

// ── 2. The model is pure ──────────────────────────────────────

describe('IX-004 — timelineSelectedReadoutModel is a pure-TS model', () => {
  const src = read(MODEL_REL);

  it('imports no React', () => {
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native['"]/);
  });

  it('imports no Supabase client', () => {
    expect(src).not.toMatch(/from\s+['"]@supabase\/[^'"]+['"]/);
    // No Supabase client usage (the file's doc comment legitimately
    // STATES the "no Supabase" rule — scan for actual identifier use).
    expect(src).not.toMatch(/\bsupabase\.[A-Za-z]/);
    expect(src).not.toMatch(/createClient\s*\(/);
  });

  it('makes no network call', () => {
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
  });

  it('references no secret token', () => {
    expect(src).not.toMatch(/SERVICE_ROLE/);
    expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
  });

  it('only the two type-import lines reach outside the module', () => {
    const importLines = src.match(/^import .*$/gm) ?? [];
    // Both imports are `import type` of pure-TS view-model / map types.
    for (const line of importLines) {
      expect(line.startsWith('import type ')).toBe(true);
    }
  });
});

// ── 3. Selection callbacks in the surface mutate local state ──

describe('IX-004 — selection callbacks in ArgumentGameSurface route through local state only', () => {
  const surface = read(SURFACE_REL);

  const SELECTION_HANDLERS: ReadonlyArray<{ name: string; anchor: string; window: number }> = [
    { name: 'handleActivate', anchor: 'const handleActivate = useCallback', window: 220 },
    { name: 'handlePrev', anchor: 'const handlePrev = useCallback', window: 320 },
    { name: 'handleNext', anchor: 'const handleNext = useCallback', window: 320 },
  ];

  it.each(SELECTION_HANDLERS)('$name calls setActiveMessageId, never a navigation call', ({ anchor, window }) => {
    const idx = surface.indexOf(anchor);
    expect(idx).toBeGreaterThan(-1);
    const block = surface.slice(idx, idx + window);
    expect(block).toMatch(/setActiveMessageId/);
    for (const re of ROUTING_CALL_PATTERNS) {
      expect(block).not.toMatch(re);
    }
  });

  it('the onJumpLatest / onJumpToRoot closures contain no navigation call', () => {
    for (const anchor of ['onJumpLatest=', 'onJumpToRoot=']) {
      const idx = surface.indexOf(anchor);
      expect(idx).toBeGreaterThan(-1);
      const block = surface.slice(idx, idx + 260);
      for (const re of ROUTING_CALL_PATTERNS) {
        expect(block).not.toMatch(re);
      }
    }
  });

  it('the stale-snap effect contains no navigation call', () => {
    const idx = surface.indexOf('Active message disappeared');
    expect(idx).toBeGreaterThan(-1);
    const block = surface.slice(idx - 80, idx + 260);
    for (const re of ROUTING_CALL_PATTERNS) {
      expect(block).not.toMatch(re);
    }
  });

  it('the TimelineSelectedReadoutPanel render site passes a single read-only viewModel prop', () => {
    // UX-001.2 — the panel relocated from above the Timeline to below it
    // and gained an optional `compact` prop.
    // UX-SELECTED-NODE-001 (reconciliation) — the mount also gained a
    // read-only `onGoToParent` selection-jump prop (wired to
    // setActiveMessageId, the SAME local-state selection path section 2 of
    // this file explicitly allows). It remains read-only: NO action / submit /
    // route callback is threaded in.
    expect(surface).toMatch(
      /<TimelineSelectedReadoutPanel\s+viewModel=\{timelineReadoutViewModel\}\s+compact/,
    );
    // Extract the panel mount element and assert it threads no action/submit/
    // route callback (only the read-only onGoToParent jump is permitted).
    const mountStart = surface.indexOf('<TimelineSelectedReadoutPanel');
    const mountEnd = surface.indexOf('/>', mountStart);
    const mountBlock = surface.slice(mountStart, mountEnd + 2);
    expect(mountBlock).not.toMatch(/\bonAction\b/);
    expect(mountBlock).not.toMatch(/\bonSubmit\b/);
    expect(mountBlock).not.toMatch(/\bonSelect\b/);
    expect(mountBlock).not.toMatch(/\bonPress\b/);
  });
});
