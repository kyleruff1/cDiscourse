/**
 * UX-001.4 — GoPopout mount site source scan.
 *
 * Verifies GoPopout is mounted at the board level, the new `leave_room`
 * entry routes through `onLeaveRoom` (the existing App.tsx
 * `handleLeaveRoom` path), and the view-toggle integrates with the
 * existing `setMode` path (NOT a new view-mode mutation).
 */
import fs from 'fs';
import path from 'path';

const SURFACE_PATH = path.resolve(
  __dirname,
  '..',
  'src',
  'features',
  'arguments',
  'ArgumentGameSurface.tsx',
);
const APP_PATH = path.resolve(
  __dirname,
  '..',
  'App.tsx',
);

describe('UX-001.4 — GoPopout mount source scan', () => {
  const src = fs.readFileSync(SURFACE_PATH, 'utf8');

  it('imports GoPopout from oneBox/GoPopout', () => {
    expect(src).toMatch(/import\s+\{\s*GoPopout\s*\}\s+from\s+['"]\.\/oneBox\/GoPopout['"]/);
  });

  it('mounts <GoPopout> with testID "board-go-popout"', () => {
    expect(src).toMatch(/testID="board-go-popout"/);
  });

  it('threads onLeaveRoom prop from the surface-level prop (App.tsx -> handleLeaveRoom)', () => {
    // Surface props include onLeaveRoom.
    expect(src).toMatch(/onLeaveRoom\?:\s*\(\)\s*=>\s*void/);
    // And the prop is threaded into <GoPopout onLeaveRoom={...}>.
    expect(src).toMatch(/onLeaveRoom=\{onLeaveRoom\}/);
  });

  it('handleGoJump for "root" jumps to timelineMap.rootMessageId via setActiveMessageId', () => {
    expect(src).toMatch(
      /target === 'root'[\s\S]*?setActiveMessageId\(timelineMap\.rootMessageId\)/s,
    );
  });

  it('handleGoJump for "latest" jumps to latestId via setActiveMessageId', () => {
    expect(src).toMatch(
      /target === 'latest'[\s\S]*?setActiveMessageId\(latestId\)/s,
    );
  });

  it('Go view-toggle reuses existing setMode path (no new mode-state mutation)', () => {
    // The GoPopout `onSelectView` callback uses the existing setMode.
    expect(src).toMatch(/onSelectView=\{[\s\S]*?setMode\(['"]timeline['"]\)[\s\S]*?\}/);
    expect(src).toMatch(/onSelectView=\{[\s\S]*?setMode\(['"]stack['"]\)[\s\S]*?\}/);
  });

  it('Go popout builds mini-map model via buildTimelineMiniMapModel (read-only)', () => {
    expect(src).toMatch(
      /import\s+\{\s*buildTimelineMiniMapModel\s*\}\s+from\s+['"]\.\/timelineMiniMapModel['"]/,
    );
    expect(src).toMatch(/buildTimelineMiniMapModel\(\{ timelineMap \}\)/);
  });

  it('threads maxHeightOverride from goPresentation.maxHeight', () => {
    expect(src).toMatch(/maxHeightOverride=\{goPresentation\.maxHeight\}/);
  });

  it('does NOT introduce a new room-exit path (leave_room delegates to onLeaveRoom)', () => {
    // The surface does not define its own `handleLeaveRoom` and does
    // not call any deselectDebate / setComposerOpen-style cleanup —
    // the prop is the only path.
    expect(src).not.toMatch(/const handleLeaveRoom\s*=/);
    expect(src).not.toMatch(/deselectDebate\(/);
  });
});

describe('UX-001.4 — App.tsx wires onLeaveRoom from the existing handleLeaveRoom', () => {
  const src = fs.readFileSync(APP_PATH, 'utf8');

  it('App.tsx still defines a single handleLeaveRoom (the canonical path)', () => {
    expect(src).toMatch(/const handleLeaveRoom\s*=/);
  });

  it('App.tsx handleLeaveRoom calls deselectDebate (the existing room-exit path)', () => {
    expect(src).toMatch(/handleLeaveRoom[\s\S]*?deselectDebate\(\)/);
  });
});
