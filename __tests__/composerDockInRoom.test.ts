/**
 * COMPOSER-002 — In-room dock: the room stays mounted while composing.
 *
 * The defining acceptance criterion of this card is "the room is never
 * unmounted to show the composer." Before COMPOSER-002 `App.tsx` rendered
 * `<ArgumentTreeScreen>` only when `!composerOpen` and `<ArgumentComposer>`
 * only when `composerOpen` — two mutually-exclusive branches. The dock
 * removes that exclusivity.
 *
 * This repo's component-test discipline (see AdminCreateUserForm.test.tsx,
 * argumentReplySidecar.test.tsx) is static source-scan + pure-helper
 * invariants — runtime react-test-renderer rendering is intentionally
 * avoided because the pinned react-test-renderer is outside
 * @testing-library's peer range. These tests assert the "in-room"
 * structure at the source level, which is exactly where the regression
 * would reappear.
 */
import fs from 'fs';
import path from 'path';

// ArgumentComposerDock transitively imports ArgumentComposer, which pulls
// in the session storage layer (AsyncStorage). Mock AsyncStorage with the
// established repo pattern (see session.test.ts) so importing the dock's
// pure `resolveDockLayoutVariant` helper does not need a native module.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { resolveDockLayoutVariant } from '../src/features/arguments/ArgumentComposerDock';

const ROOT = path.join(__dirname, '..');
const APP_SRC = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
const DOCK_SRC = fs.readFileSync(
  path.join(ROOT, 'src', 'features', 'arguments', 'ArgumentComposerDock.tsx'),
  'utf8',
);

// ── 1. The room render guard no longer excludes composerOpen ───

describe('COMPOSER-002 — the room stays mounted while the dock is open', () => {
  it('the room render guard does NOT carry a `!composerOpen` term', () => {
    // The legacy guard was `... && currentDebate && !composerOpen`.
    // Dropping `!composerOpen` is what keeps ArgumentTreeScreen mounted.
    expect(APP_SRC).not.toMatch(/currentDebate\s*&&\s*!composerOpen/);
  });

  it('the room is rendered on `activeTab === arguments && hasDebate && currentDebate`', () => {
    expect(APP_SRC).toMatch(
      /activeTab === 'arguments' && hasDebate && currentDebate &&/,
    );
  });

  it('there is no standalone full-page <ArgumentComposer composerOpen> branch left', () => {
    // The deleted branch read `... && composerOpen && <ArgumentComposer .../>`.
    expect(APP_SRC).not.toMatch(/composerOpen\s*&&\s*\(\s*<ArgumentComposer/);
    // App.tsx no longer imports ArgumentComposer directly — it mounts the
    // dock, which owns the composer.
    expect(APP_SRC).not.toMatch(/import\s*\{[^}]*\bArgumentComposer\b[^}]*\}/);
  });
});

// ── 2. The dock is mounted as a sibling inside the room view ────

describe('COMPOSER-002 — the dock is mounted inside the room, not as a screen swap', () => {
  it('App.tsx mounts <ArgumentComposerDock>', () => {
    expect(APP_SRC).toMatch(/<ArgumentComposerDock/);
  });

  it('the dock visibility is driven by `composerOpen` (a toggle, not a branch)', () => {
    // SETTLE-001 (#911) — the dock is now additionally gated on roomAcceptsMoves
    // so a settled (locked) room suppresses it; composerOpen is still the toggle.
    expect(APP_SRC).toMatch(/<ArgumentComposerDock[\s\S]*?visible=\{composerOpen && roomAcceptsMoves\}/);
  });

  it('the dock is rendered after the room surface, inside the debateRoom view', () => {
    // SC-005 removed the separate bottom actionBar (its "Start an argument"
    // CTA folded into the side action rail). The COMPOSER-002 invariant —
    // the dock is a sibling rendered inside the room view, after the room
    // surface — is unchanged; this anchors on the room surface instead of
    // the now-deleted actionBar.
    const treeScreenIdx = APP_SRC.indexOf('<ArgumentTreeScreen');
    const dockIdx = APP_SRC.indexOf('<ArgumentComposerDock');
    const debateRoomIdx = APP_SRC.indexOf('styles.debateRoom');
    expect(debateRoomIdx).toBeGreaterThan(-1);
    expect(treeScreenIdx).toBeGreaterThan(-1);
    expect(dockIdx).toBeGreaterThan(treeScreenIdx);
  });

  it('the dock receives the same composer props App previously passed to ArgumentComposer', () => {
    const dockBlock = APP_SRC.slice(
      APP_SRC.indexOf('<ArgumentComposerDock'),
      APP_SRC.indexOf('<ArgumentComposerDock') + 600,
    );
    expect(dockBlock).toMatch(/debate=\{currentDebate\}/);
    expect(dockBlock).toMatch(/onClearParent=\{handleClearParent\}/);
    expect(dockBlock).toMatch(/onSubmitSuccess=\{handleSubmitSuccess\}/);
    expect(dockBlock).toMatch(/onClose=\{handleComposerClose\}/);
    expect(dockBlock).toMatch(/initialPatch=\{composerPreset\}/);
  });
});

// ── 3. The dock hosts the QOL-030 OneBox in-place ──
// QOL-030 refactor: the dock now hosts `OneBox` (the single switchable
// composer), and `OneBox` hosts `ArgumentComposer` — the `submit-argument`
// post path is unchanged, one layer deeper.

describe('COMPOSER-002 / QOL-030 — the dock hosts the OneBox in dock mode', () => {
  it('the dock value-imports OneBox', () => {
    expect(DOCK_SRC).toMatch(/import\s*\{\s*OneBox\s*\}\s*from\s*'\.\/oneBox\/OneBox'/);
  });

  it('the dock renders <OneBox ...>', () => {
    expect(DOCK_SRC).toMatch(/<OneBox\b/);
  });

  it('the OneBox still hosts ArgumentComposer in dock mode (post path unchanged)', () => {
    const oneBoxSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'features', 'arguments', 'oneBox', 'OneBox.tsx'),
      'utf8',
    );
    expect(oneBoxSrc).toMatch(/import\s*\{\s*ArgumentComposer\s*\}\s*from\s*'\.\.\/ArgumentComposer'/);
    expect(oneBoxSrc).toMatch(/<ArgumentComposer[\s\S]*?mode="dock"/);
  });

  it('the dock returns null when not visible (no animate-out leak)', () => {
    expect(DOCK_SRC).toMatch(/if\s*\(!visible\)\s*return null/);
  });
});

// ── 4. State-preservation mechanism is "do not unmount", not state-lifting ──

describe('COMPOSER-002 — state preservation is achieved by keeping the room mounted', () => {
  it('App.tsx does not own activeMessageId state (no setter; UX-001.3 only MIRRORS it)', () => {
    // COMPOSER-002 doctrine: the room stays mounted; App.tsx does NOT
    // own the active-node state. UX-001.3 introduces a one-way READ
    // (timelineActiveMessageId) so the composer dock can show a
    // divergence cue — App.tsx receives an id via onActiveMessageChange
    // but never WRITES the canonical state in ArgumentGameSurface.
    //
    // The state-lifting-refactor guard is preserved by asserting that
    // App.tsx never calls a setter on the canonical activeMessageId.
    // The mirror state lives under a different name (timelineActiveMessageId).
    expect(APP_SRC).not.toMatch(/setActiveMessageId/);
    // Mirror state is allowed; canonical state name is not.
    // Specifically: App.tsx must NOT define a `useState<…>('activeMessageId')`
    // hook or any other writer that would compete with
    // ArgumentGameSurface's single source of truth.
    expect(APP_SRC).not.toMatch(/useState[\s\S]{0,80}activeMessageId/);
  });

  it('ArgumentTreeScreen still receives entryHint so the micro-moment survives', () => {
    // The room (and its argument-micro-moment / argument-game-surface)
    // staying mounted is what keeps the entry hint alive while composing.
    expect(APP_SRC).toMatch(/<ArgumentTreeScreen[\s\S]*?entryHint=\{entryHint\}/);
  });
});

// ── 5. Pure breakpoint helper — the dock's layout decision ──────

describe('COMPOSER-002 — resolveDockLayoutVariant', () => {
  it('narrow viewport (< 720) resolves to the bottom sheet', () => {
    expect(resolveDockLayoutVariant(375)).toBe('sheet');
    expect(resolveDockLayoutVariant(719)).toBe('sheet');
  });

  it('wide viewport (>= 720) resolves to the right-side panel', () => {
    expect(resolveDockLayoutVariant(720)).toBe('side');
    expect(resolveDockLayoutVariant(1280)).toBe('side');
  });

  it('width <= 0 (web static-export hydration first paint) resolves to side', () => {
    expect(resolveDockLayoutVariant(0)).toBe('side');
    expect(resolveDockLayoutVariant(-1)).toBe('side');
  });

  it('non-finite width falls back to side (the polished layout)', () => {
    expect(resolveDockLayoutVariant(Number.NaN)).toBe('side');
    expect(resolveDockLayoutVariant(Number.POSITIVE_INFINITY)).toBe('side');
  });

  it('the variant flips deterministically across the 720 boundary', () => {
    // A viewport rotation that crosses 720 must flip the variant — the
    // composer draft survives because ArgumentComposer state is React
    // state inside the still-mounted component, not because of the dock.
    expect(resolveDockLayoutVariant(700)).not.toBe(resolveDockLayoutVariant(800));
  });
});
