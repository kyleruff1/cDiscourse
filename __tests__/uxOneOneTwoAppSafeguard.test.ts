/**
 * UX-001.2 — App.tsx safeguard (Q12 cat 6).
 *
 * The brief is explicit: App.tsx is in scope ONLY for room-active chrome
 * suppression and roomToolbar consolidation. The implementer may NOT
 * rewrite top-level routing, authentication, Account/Admin mounting,
 * role resolution, composer submission, or app-wide state.
 *
 * This test asserts the bounded scope mechanically: the AppRoot
 * function's signatures + key mount points are preserved verbatim, and
 * the file does not gain new dependency imports or routing primitives.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const APP_SRC = read('App.tsx');
const PKG = JSON.parse(read('package.json')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe('UX-001.2 — AppRoot is unchanged outside the room-active branch', () => {
  it('AppRoot function declaration is preserved', () => {
    expect(APP_SRC).toMatch(/function\s+AppRoot\(\)\s*\{/);
  });

  it('AppHeader mount is preserved (one call inside SafeAreaView)', () => {
    expect(APP_SRC).toMatch(
      /<AppHeader onHomePress=\{handleHomePress\} rightSlot=\{preferencesTrigger\}\s*\/>/,
    );
  });

  it('PreferencesPopout mount is preserved', () => {
    expect(APP_SRC).toMatch(/<PreferencesPopout/);
  });

  it('ProfileTagPopout mount is preserved', () => {
    expect(APP_SRC).toMatch(/<ProfileTagPopout/);
  });

  it('InviteRedeemGate mount is preserved', () => {
    expect(APP_SRC).toMatch(/<InviteRedeemGate/);
  });

  it('AuthScreen mount path is preserved (signed_out branch)', () => {
    expect(APP_SRC).toMatch(/state\.status === 'signed_out'/);
    expect(APP_SRC).toMatch(/<AuthScreen \/>/);
  });
});

describe('UX-001.2 — MainAppShell core mounts unchanged', () => {
  // NAV-START-ARGUMENT-001 Slice B — the public About screen takes over the
  // body when open, so each non-About body mount path gained a leading
  // `!aboutOpen &&` guard. The per-tab conditions + role gates below are
  // otherwise PRESERVED verbatim.
  it('AccountScreen mount is preserved (activeTab === account)', () => {
    expect(APP_SRC).toMatch(
      /\{!aboutOpen && activeTab === 'account' &&\s*\(\s*<AccountScreen onSignOut=\{handleSignOut\} signOutLoading=\{signOutLoading\}/,
    );
  });

  it('AdminScreen mount is preserved (admin role gate)', () => {
    expect(APP_SRC).toMatch(
      /\{!aboutOpen && activeTab === 'admin' && currentProfile\?\.role === 'admin' && \(\s*<AdminScreen onOpenArgumentTimeline=\{handleOpenArgumentFromAdmin\}/,
    );
  });

  it('SessionDebugPanel mount path is preserved (dev only)', () => {
    expect(APP_SRC).toMatch(/\{!aboutOpen && activeTab === 'debug' && __DEV__ && <SessionDebugPanel \/>\}/);
  });

  it('useRoomContract invocation is preserved (GAME-004 contract path)', () => {
    expect(APP_SRC).toMatch(/const roomContract\s*=\s*useRoomContract\(\{/);
  });

  it('useNotifications invocation is preserved (QOL-040 path)', () => {
    expect(APP_SRC).toMatch(/const notifications\s*=\s*useNotifications\(state\.snapshot\.userId\)/);
  });

  it('handleSignOut path is preserved', () => {
    expect(APP_SRC).toMatch(/const handleSignOut\s*=\s*async \(\) => \{/);
  });

  it('handleOpenNotificationDeepLink path is preserved (QOL-040.3)', () => {
    expect(APP_SRC).toMatch(/const handleOpenNotificationDeepLink/);
  });

  it('ArgumentComposerDock mount is preserved (COMPOSER-002 path)', () => {
    expect(APP_SRC).toMatch(/<ArgumentComposerDock/);
  });

  it('ArgumentTreeScreen mount is preserved (room body)', () => {
    expect(APP_SRC).toMatch(/<ArgumentTreeScreen/);
  });
});

describe('UX-001.2 — no new dependency added', () => {
  const FORBIDDEN_RUNTIME_DEPS = [
    'bootstrap',
    'react-bootstrap',
    'react-router',
    'react-router-dom',
    'react-router-native',
    'expo-router',
    '@react-navigation/native',
    '@react-navigation/bottom-tabs',
    '@react-navigation/stack',
    '@react-navigation/native-stack',
    '@react-navigation/drawer',
    'react-icons',
    'react-native-vector-icons',
    '@expo/vector-icons',
  ];

  it.each(FORBIDDEN_RUNTIME_DEPS)('%s is not in package.json dependencies', (dep) => {
    expect(PKG.dependencies ?? {}).not.toHaveProperty(dep);
  });
});

describe('UX-001.2 — no Modal import in any UX-001.2 file (TL-003 doctrine)', () => {
  const UX_001_2_FILES = [
    'App.tsx',
    'src/features/debates/DebateDetailHeader.tsx',
    // ASP-EXTRACT-001 (Slice 2) — surface content moved into the room/
    // orchestrator; ArgumentGameSurface.tsx is now a re-export shim.
    'src/features/arguments/room/ArgumentRoom.tsx',
    'src/features/arguments/ArgumentTimelineMap.tsx',
    'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
    'src/features/arguments/timelineViewportLayoutModel.ts',
  ];

  it.each(UX_001_2_FILES)('%s does NOT import Modal from react-native', (rel) => {
    const src = read(rel);
    // Tolerate `<Modal` only when it's actually a transient inline panel
    // we did NOT introduce. Allow the existing MakePrivateConfirmation
    // path (a Modal component imported from elsewhere) by checking the
    // import statement specifically.
    expect(src).not.toMatch(/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*'react-native'/);
  });
});

describe('UX-001.2 — no AI provider import in any UX-001.2 file', () => {
  const UX_001_2_FILES = [
    'App.tsx',
    'src/features/debates/DebateDetailHeader.tsx',
    // ASP-EXTRACT-001 (Slice 2) — surface content moved into the room/
    // orchestrator; ArgumentGameSurface.tsx is now a re-export shim.
    'src/features/arguments/room/ArgumentRoom.tsx',
    'src/features/arguments/ArgumentTimelineMap.tsx',
    'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
    'src/features/arguments/timelineViewportLayoutModel.ts',
  ];

  const FORBIDDEN_PATTERNS: RegExp[] = [
    /from\s+['"]@anthropic-ai\/sdk['"]/,
    /from\s+['"]openai['"]/,
    /from\s+['"]@google-cloud\/aiplatform['"]/,
    /\bANTHROPIC_API_KEY\b/,
    /\bXAI_API_KEY\b/,
    /\bX_BEARER_TOKEN\b/,
    /\bSERVICE_ROLE\b/,
    /\bservice_role\b/,
  ];

  it.each(UX_001_2_FILES)('%s contains no AI provider / service-role reference', (rel) => {
    const src = read(rel);
    for (const re of FORBIDDEN_PATTERNS) {
      expect(src).not.toMatch(re);
    }
  });
});

describe('UX-001.2 — no new route added', () => {
  it('no router primitive imports were added to App.tsx', () => {
    expect(APP_SRC).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(APP_SRC).not.toMatch(/from\s+['"]@react-navigation\/[^'"]+['"]/);
    expect(APP_SRC).not.toMatch(/from\s+['"]react-router(?:-native|-dom)?['"]/);
  });

  it('no router method calls were added to App.tsx', () => {
    expect(APP_SRC).not.toMatch(/\bnavigation\.navigate\s*\(/);
    expect(APP_SRC).not.toMatch(/\brouter\.push\s*\(/);
    expect(APP_SRC).not.toMatch(/\brouter\.replace\s*\(/);
  });
});
