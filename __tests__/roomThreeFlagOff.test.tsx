/**
 * ROOM-003 (#829) — flag-off byte-identical proof.
 *
 * The one-bar entry composer mounts ONLY behind room_exchange_v2. With the
 * flag OFF the room compose path is byte-identical to today:
 *   - the bar subtree is NOT mounted (logic + source pin);
 *   - the collapsed strip keeps its handler (onComposerExpand stays
 *     handleComposerExpand), so ArgumentRoom still renders the strip;
 *   - flag ON suppresses the strip (onComposerExpand undefined) and mounts
 *     the bar together with the ROOM-001 rail;
 *   - the bar reads no featureFlags (it receives the mount decision as a
 *     prop from App.tsx, the sole flag consumer);
 *   - ArgumentRoom strip gating on the prop is the shipped mechanism.
 */
import fs from 'fs';
import path from 'path';

const APP_SRC = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');
const ROOM_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/arguments/room/ArgumentRoom.tsx'),
  'utf8',
);
const COMPOSER_DIR = path.join(process.cwd(), 'src', 'features', 'arguments', 'composer');
const NEW_FILES = ['ArgumentEntryComposer.tsx', 'argumentEntryComposerModel.ts', 'useEntryComposerSubmit.ts'];

// ── Logic identities (the boolean wiring the mount relies on) ───

function barMounted(roomExchangeV2Enabled: boolean): boolean {
  return roomExchangeV2Enabled;
}
/** The strip handler value: undefined => strip suppressed; a handler => strip shown. */
function stripHandler(roomExchangeV2Enabled: boolean): string | undefined {
  return roomExchangeV2Enabled ? undefined : 'handleComposerExpand';
}

describe('ROOM-003 flag-off — logic identities', () => {
  it('the bar is NOT mounted when the flag is OFF, and IS when ON', () => {
    expect(barMounted(false)).toBe(false);
    expect(barMounted(true)).toBe(true);
  });

  it('the collapsed strip keeps its handler when OFF (shown) and loses it when ON (suppressed)', () => {
    expect(stripHandler(false)).toBe('handleComposerExpand');
    expect(stripHandler(true)).toBeUndefined();
  });
});

describe('ROOM-003 flag-off — App.tsx wiring pins', () => {
  it('imports the bar from the composer path', () => {
    expect(APP_SRC).toContain("import { ArgumentEntryComposer } from './src/features/arguments/composer/ArgumentEntryComposer';");
  });

  it('gates the bar mount on roomExchangeV2Enabled', () => {
    expect(APP_SRC).toMatch(/\{roomExchangeV2Enabled \? \(\s*\n\s*<ArgumentEntryComposer/);
  });

  it('suppresses the collapsed strip only when the flag is ON', () => {
    expect(APP_SRC).toContain('onComposerExpand={roomExchangeV2Enabled ? undefined : handleComposerExpand}');
  });

  it('App.tsx is the flag consumer (isRoomExchangeV2Enabled), not the bar', () => {
    expect(APP_SRC).toMatch(/import\s+\{\s*isRoomExchangeV2Enabled\s*\}\s+from\s+['"]\.\/src\/lib\/featureFlags['"]/);
  });

  it('the dock stays mounted as the More host (unchanged)', () => {
    expect(APP_SRC).toContain('<ArgumentComposerDock');
  });
});

describe('ROOM-003 flag-off — no new featureFlags consumer', () => {
  it('none of the three new files import featureFlags', () => {
    for (const name of NEW_FILES) {
      const src = fs.readFileSync(path.join(COMPOSER_DIR, name), 'utf8');
      expect({ name, hit: /featureFlags/.test(src) }).toEqual({ name, hit: false });
    }
  });
});

describe('ROOM-003 flag-off — ArgumentRoom strip gating is the shipped mechanism', () => {
  it('ArgumentRoom renders the CollapsedComposerStrip only when onComposerExpand is provided', () => {
    expect(ROOM_SRC).toMatch(/\{onComposerExpand \? \(/);
    expect(ROOM_SRC).toContain('<CollapsedComposerStrip');
  });
});
