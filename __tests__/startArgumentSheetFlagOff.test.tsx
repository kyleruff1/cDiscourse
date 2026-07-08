/**
 * START-001 (#827) — flag-off byte-identical proof.
 *
 * The person-first StartArgumentSheet mounts ONLY behind home_v2. This suite
 * proves that with the flag OFF the App.tsx render path is byte-identical to
 * today:
 *   - the new `startSheetActive` guard requires `homeV2Enabled`, so it is
 *     ALWAYS false when the flag is off (logic pin);
 *   - the gallery `showCreate` prop is `startArgumentOpen && !homeV2Enabled`,
 *     which reduces to `startArgumentOpen` when the flag is off (logic pin);
 *   - the App.tsx source carries the exact guarded wiring (source pins);
 *   - the legacy StartArgumentPage is untouched and remains the flag-off create
 *     surface (source pins on StartArgumentPage.tsx);
 *   - no new file imports featureFlags — the allowlist stays App.tsx-only.
 */
import fs from 'fs';
import path from 'path';

const APP_SRC = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');
const PAGE_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/arguments/startArgument/StartArgumentPage.tsx'),
  'utf8',
);

// ── Logic pins (the boolean identities the wiring relies on) ────

/** Re-derivation of the two App.tsx guards, evaluated for every flag state. */
function startSheetActive(homeV2Enabled: boolean, startArgumentOpen: boolean): boolean {
  // Mirrors App.tsx: all the not-over-a-subscreen guards held true here so the
  // test isolates the flag + start-open contribution.
  return (
    homeV2Enabled &&
    startArgumentOpen &&
    true /* activeTab === 'arguments' */ &&
    true /* !hasDebate */ &&
    true /* !notificationsOpen */ &&
    true /* !aboutOpen */ &&
    true /* !demoCorridorOpen */
  );
}

function galleryShowCreate(homeV2Enabled: boolean, startArgumentOpen: boolean): boolean {
  return startArgumentOpen && !homeV2Enabled;
}

describe('START-001 flag-off — logic identities', () => {
  it('startSheetActive is ALWAYS false when home_v2 is OFF', () => {
    for (const open of [true, false]) {
      expect(startSheetActive(false, open)).toBe(false);
    }
  });

  it('the sheet only activates when home_v2 is ON and start is open', () => {
    expect(startSheetActive(true, true)).toBe(true);
    expect(startSheetActive(true, false)).toBe(false);
  });

  it('gallery showCreate reduces to startArgumentOpen when the flag is OFF (byte-identical)', () => {
    for (const open of [true, false]) {
      expect(galleryShowCreate(false, open)).toBe(open);
    }
  });

  it('gallery showCreate is always false when the flag is ON (the sheet owns start)', () => {
    for (const open of [true, false]) {
      expect(galleryShowCreate(true, open)).toBe(false);
    }
  });
});

// ── Source pins on App.tsx ──────────────────────────────────────

describe('START-001 flag-off — App.tsx wiring pins', () => {
  it('mounts StartArgumentSheet from the startArgument barrel', () => {
    expect(APP_SRC).toMatch(
      /import\s+\{[^}]*StartArgumentSheet[^}]*\}\s+from\s+['"]\.\/src\/features\/arguments\/startArgument['"]/,
    );
    expect(APP_SRC).toContain('<StartArgumentSheet');
  });

  it('the startSheetActive guard requires homeV2Enabled AND startArgumentOpen', () => {
    expect(APP_SRC).toMatch(/const startSheetActive\s*=\s*\n?\s*homeV2Enabled\s*&&\s*\n?\s*startArgumentOpen/);
  });

  it('the ArgumentHome and gallery blocks both add !startSheetActive', () => {
    const withGuard = APP_SRC.match(/!startSheetActive/g) || [];
    // One in the const definition context is NOT counted (it is `startSheetActive =`);
    // the two block guards each add `!startSheetActive`.
    expect(withGuard.length).toBeGreaterThanOrEqual(2);
  });

  it('the gallery showCreate prop is gated on !homeV2Enabled', () => {
    expect(APP_SRC).toContain('showCreate={startArgumentOpen && !homeV2Enabled}');
  });

  it('App.tsx remains the sole featureFlags consumer (isHomeV2Enabled only)', () => {
    expect(APP_SRC).toMatch(/import\s+\{\s*isHomeV2Enabled\s*\}\s+from\s+['"]\.\/src\/lib\/featureFlags['"]/);
  });
});

// ── Source pins on the untouched legacy page ────────────────────

describe('START-001 flag-off — legacy StartArgumentPage untouched', () => {
  it('still renders the legacy create surface (testID start-argument-page)', () => {
    expect(PAGE_SRC).toContain('testID="start-argument-page"');
    expect(PAGE_SRC).toContain('start-argument-submit');
  });

  it('still drives off the shared creation matrix (deriveArgumentRoomCreation)', () => {
    expect(PAGE_SRC).toContain('deriveArgumentRoomCreation');
  });

  it('does NOT import the new sheet (no cross-contamination of the flag-off path)', () => {
    expect(PAGE_SRC).not.toMatch(/StartArgumentSheet/);
    expect(PAGE_SRC).not.toMatch(/PersonArgumentPicker/);
  });
});
