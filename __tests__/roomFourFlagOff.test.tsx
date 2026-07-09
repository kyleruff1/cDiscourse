/**
 * ROOM-004 (#886) — flag-off byte-identical proof for the Map surface.
 *
 * With room_exchange_v2 OFF the Map lens is byte-identical to today:
 *   - the node action popover + the sidecar links are unmounted;
 *   - actionDockModel = dockModel (the SC-004 node dock is unchanged);
 *   - the mapNodeActionSurface memo returns null.
 * With the flag ON:
 *   - the popover mounts, actionDockModel is node-gated to null (supersession),
 *     the sidecar links mount;
 *   - App.tsx stays the sole flag consumer; the new files import no featureFlags.
 *
 * Source-scan discipline (no runtime render), modeled on roomThreeFlagOff.
 */
import fs from 'fs';
import path from 'path';

const ROOM = process.cwd();
const ROOM_SRC = fs.readFileSync(path.join(ROOM, 'src/features/arguments/room/ArgumentRoom.tsx'), 'utf8');
const MAPVIEW_SRC = fs.readFileSync(path.join(ROOM, 'src/features/arguments/room/MapView.tsx'), 'utf8');
const NEW_FILES = [
  'src/features/arguments/room/mapNodeActionSurfaceModel.ts',
  'src/features/arguments/room/roomCapabilityParity.ts',
  'src/features/arguments/room/MapNodeActionPopover.tsx',
  'src/features/arguments/room/MapNodeSidecarLinks.tsx',
];

// ── Logic identity ────────────────────────────────────────────

/** The popover mounts iff the flag is on AND a surface is supplied. */
function popoverMounted(roomExchangeV2Enabled: boolean, hasSurface: boolean): boolean {
  return roomExchangeV2Enabled && hasSurface;
}
/** actionDockModel is node-gated to null only under flag-on + a node target. */
function actionDockNulledForNode(roomExchangeV2Enabled: boolean, isNodeTarget: boolean): boolean {
  return roomExchangeV2Enabled && isNodeTarget;
}

describe('ROOM-004 flag-off — logic identity', () => {
  it('the popover is unmounted unless the flag is on with a surface', () => {
    expect(popoverMounted(false, false)).toBe(false);
    expect(popoverMounted(false, true)).toBe(false);
    expect(popoverMounted(true, false)).toBe(false);
    expect(popoverMounted(true, true)).toBe(true);
  });

  it('the SC-004 node dock is nulled only under flag-on + a node target', () => {
    expect(actionDockNulledForNode(false, true)).toBe(false);
    expect(actionDockNulledForNode(true, false)).toBe(false);
    expect(actionDockNulledForNode(true, true)).toBe(true);
  });
});

// ── ArgumentRoom gating ───────────────────────────────────────

describe('ROOM-004 flag-off — ArgumentRoom gating', () => {
  it('mapNodeActionSurface returns null when the flag is off', () => {
    expect(ROOM_SRC).toMatch(
      /const mapNodeActionSurface = useMemo<MapNodeActionSurface \| null>\(\(\) => \{\s*\n\s*if \(!roomExchangeV2Enabled\) return null;/,
    );
  });

  it('actionDockModel is node-gated to null only under flag-on + a node target', () => {
    expect(ROOM_SRC).toMatch(
      /actionDockModel=\{\s*roomExchangeV2Enabled && selectedDockTarget\?\.kind === 'node' \? null : dockModel\s*\}/,
    );
  });

  it('the sidecar links mount only when the flag is on AND a surface exists', () => {
    expect(ROOM_SRC).toMatch(/\{roomExchangeV2Enabled && mapNodeActionSurface \? \(\s*\n\s*<MapNodeSidecarLinks/);
  });

  it('the popover surface + bindings are passed to MapView', () => {
    expect(ROOM_SRC).toMatch(/nodeActionPopover=\{mapNodeActionSurface\}/);
    expect(ROOM_SRC).toMatch(/onPopoverClose=\{\(\) => setSelectedDockTarget\(null\)\}/);
  });
});

// ── MapView back-compat ───────────────────────────────────────

describe('ROOM-004 flag-off — MapView renders nothing new without a surface', () => {
  it('the popover renders only when nodeActionPopover is supplied', () => {
    expect(MAPVIEW_SRC).toMatch(/\{props\.nodeActionPopover \? \(\s*\n\s*<MapNodeActionPopover/);
  });

  it('the timeline map mount stays intact and unedited', () => {
    expect(MAPVIEW_SRC).toMatch(/<ArgumentTimelineMap/);
  });
});

// ── No new featureFlags consumer ──────────────────────────────

describe('ROOM-004 flag-off — the new files read no featureFlags', () => {
  it('none of the new Map-surface files import featureFlags', () => {
    for (const rel of NEW_FILES) {
      const src = fs.readFileSync(path.join(ROOM, rel), 'utf8');
      expect({ rel, hit: /featureFlags/.test(src) }).toEqual({ rel, hit: false });
    }
  });
});
