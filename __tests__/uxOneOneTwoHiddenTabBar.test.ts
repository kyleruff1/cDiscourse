/**
 * UX-001.2 — Hidden global tab bar in room-active view (Q12 cat 2).
 *
 * Source-scan + structural verification that the MainAppShell tab bar is
 * hidden when a room is active and restored on room exit. The single gate
 * variable is `roomActive` (per the design's Q3); the test asserts the
 * boolean is computed exactly once and used to wrap the tabBar JSX.
 *
 * The render-test path (mocking `useWindowDimensions` + mounting the App
 * shell with a fixture debate) is intentionally avoided in favour of the
 * static scan pattern this repo standardizes on (see
 * `composerDockInRoom.test.ts` for precedent — RN render harness is brittle
 * in jest for the full App shell).
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const APP_SRC = read('App.tsx');

describe('UX-001.2 — roomActive gate variable', () => {
  it('declares a single `roomActive` boolean inside MainAppShell', () => {
    expect(APP_SRC).toMatch(
      /const\s+roomActive\s*=\s*activeTab\s*===\s*'arguments'\s*&&\s*hasDebate\s*&&\s*Boolean\(currentDebate\)\s*&&\s*!notificationsOpen/,
    );
  });

  it('does not redeclare roomActive (single source of truth)', () => {
    const matches = APP_SRC.match(/\bconst\s+roomActive\b/g) || [];
    expect(matches.length).toBe(1);
  });
});

describe('UX-001.2 — tab bar conditional render', () => {
  it('the global tab bar JSX is gated on !roomActive', () => {
    expect(APP_SRC).toMatch(/\{!roomActive\s*\?[\s\S]*?<View style=\{styles\.tabBar\}/);
  });

  it('the tab bar carries the new app-tab-bar testID anchor', () => {
    expect(APP_SRC).toContain('testID="app-tab-bar"');
  });

  it('the gate is structurally above the rest of the body render (rendered FIRST)', () => {
    // The gate fires before the body View / debateRoom render path.
    const gateIdx = APP_SRC.indexOf('{!roomActive ? (');
    const bodyIdx = APP_SRC.indexOf('<View style={styles.body}>');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(bodyIdx);
  });
});

describe('UX-001.2 — Account and Admin remain reachable outside the room', () => {
  it('AccountScreen mount path is preserved (activeTab === account)', () => {
    expect(APP_SRC).toMatch(/\{activeTab === 'account' &&[\s\S]*?<AccountScreen/);
  });

  it('AdminScreen mount path is preserved (admin role gate)', () => {
    expect(APP_SRC).toMatch(
      /\{activeTab === 'admin' && currentProfile\?\.role === 'admin' && \(\s*<AdminScreen onOpenArgumentTimeline=\{handleOpenArgumentFromAdmin\}/,
    );
  });

  it('getVisibleTabs call is unchanged', () => {
    expect(APP_SRC).toMatch(
      /const tabs\s*=\s*getVisibleTabs\(currentProfile\?\.role\s*\?\?\s*null,\s*Boolean\(__DEV__\)\)/,
    );
  });
});

describe('UX-001.2 — room-exit affordance preserved', () => {
  it('handleLeaveRoom is wired into DebateDetailHeader (the strip carries the Leave button)', () => {
    expect(APP_SRC).toMatch(/onLeave=\{handleLeaveRoom\}/);
  });

  it('handleLeaveRoom dispatches deselectDebate so roomActive flips to false', () => {
    expect(APP_SRC).toMatch(
      /const handleLeaveRoom\s*=\s*\(\)\s*=>\s*\{[\s\S]*?deselectDebate\(\)/,
    );
  });
});

describe('UX-001.2 — Notifications flow is preserved (notificationsOpen interacts with roomActive)', () => {
  it('the room render is gated on !notificationsOpen (room hidden while notifications is open)', () => {
    expect(APP_SRC).toMatch(
      /activeTab === 'arguments' && hasDebate && currentDebate && !notificationsOpen/,
    );
  });

  it('roomActive is false when notificationsOpen is true (tab bar restored)', () => {
    // The `!notificationsOpen` clause on the gate ensures the tab bar
    // remains visible when the notification list takes the body.
    expect(APP_SRC).toMatch(/&&\s*!notificationsOpen/);
  });
});
