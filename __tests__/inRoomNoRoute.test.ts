/**
 * TL-003 — Timeline board shell with no page redirect.
 *
 * The in-room board (Timeline + Cards toggle + sidecar + quick
 * actions) must never trigger a route transition. All state lives in
 * `useState` in `MainAppShell`. These static-scan tests lock the
 * invariant so SC-001 / SC-002 (and future cards) cannot accidentally
 * regress it by importing a navigation library.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

function safeRead(rel: string): string {
  try {
    return read(rel);
  } catch {
    return '';
  }
}

const ROUTING_IMPORT_PATTERNS: RegExp[] = [
  /from\s+['"]@react-navigation\/[^'"]+['"]/,
  /from\s+['"]expo-router['"]/,
  /from\s+['"]react-router(?:-native|-dom)?['"]/,
  /import\s+\{\s*useNavigation\s*\}/,
  /import\s+\{\s*[^}]*\brouter\b[^}]*\}\s+from\s+['"]expo-router['"]/,
];

const ROUTING_CALL_PATTERNS: RegExp[] = [
  /\bnavigation\.navigate\s*\(/,
  /\bnavigation\.push\s*\(/,
  /\bnavigation\.replace\s*\(/,
  /\bnavigation\.reset\s*\(/,
  /\brouter\.push\s*\(/,
  /\brouter\.replace\s*\(/,
];

// ── No routing primitives anywhere in the app ────────────────────

describe('TL-003 — no routing primitive in the in-room view', () => {
  const inRoomFiles = [
    'App.tsx',
    'src/features/arguments/ArgumentGameSurface.tsx',
    'src/features/arguments/ArgumentTimelineMap.tsx',
    // ASP-EXTRACT-001 (Slice 1) — the extracted timeline-map lens is an
    // in-room surface; held to the same no-routing invariant.
    'src/features/arguments/room/MapView.tsx',
    'src/features/arguments/ArgumentBubbleStack.tsx',
    'src/features/arguments/ArgumentReplySidecar.tsx',
    'src/features/arguments/ArgumentBubbleActions.tsx',
    'src/features/arguments/ArgumentSideActionRail.tsx',
    'src/features/arguments/ArgumentComposer.tsx',
    // UX-001.2 — the compact strip is now an in-room surface (replaces the
    // App.tsx roomToolbar's Timeline/Cards toggle); held to the same
    // no-routing invariant.
    'src/features/debates/DebateDetailHeader.tsx',
  ];

  it.each(inRoomFiles)('%s imports no navigation library', (rel) => {
    const src = safeRead(rel);
    if (!src) return; // some files may not exist yet; that's fine
    for (const re of ROUTING_IMPORT_PATTERNS) {
      expect(src).not.toMatch(re);
    }
  });

  it.each(inRoomFiles)('%s contains no router/navigation method calls', (rel) => {
    const src = safeRead(rel);
    if (!src) return;
    for (const re of ROUTING_CALL_PATTERNS) {
      expect(src).not.toMatch(re);
    }
  });
});

// ── package.json: no routing libraries installed ─────────────────

describe('TL-003 — no routing library is installed as a runtime dependency', () => {
  const pkg = JSON.parse(read('package.json')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const runtime = pkg.dependencies ?? {};

  const FORBIDDEN_RUNTIME_DEPS = [
    '@react-navigation/native',
    '@react-navigation/native-stack',
    '@react-navigation/stack',
    '@react-navigation/drawer',
    '@react-navigation/bottom-tabs',
    'expo-router',
    'react-router',
    'react-router-native',
    'react-router-dom',
  ];

  it.each(FORBIDDEN_RUNTIME_DEPS)('%s is not in package.json dependencies', (dep) => {
    expect(runtime).not.toHaveProperty(dep);
  });
});

// ── In-room mode toggles go through useState, not navigation ─────

describe('TL-003 — Cards/Timeline toggle is state-based', () => {
  const appTsx = read('App.tsx');
  const debateHeader = read('src/features/debates/DebateDetailHeader.tsx');

  it('UX-001.2 — App.tsx threads setViewMode into DebateDetailHeader as a prop', () => {
    // UX-001.2 — the Timeline/Cards toggle moved out of the App.tsx
    // roomToolbar into the compact strip inside DebateDetailHeader. App.tsx
    // still owns the setViewMode state setter and threads it via
    // `onSetViewMode`; the toggle Pressables themselves live in the strip.
    expect(appTsx).toMatch(/onSetViewMode=\{setViewMode\}/);
    // The strip exposes Cards and Timeline as Pressables that call the
    // forwarded callback. Source-scan asserts both.
    expect(debateHeader).toMatch(/onPress=\{\(\) => onSetViewMode\?\.\('stack'\)\}/);
    expect(debateHeader).toMatch(/onPress=\{\(\) => onSetViewMode\?\.\('timeline'\)\}/);
  });

  it('setViewMode is called nowhere alongside a navigation primitive', () => {
    // Each occurrence of setViewMode (across App.tsx + DebateDetailHeader)
    // must NOT be in a block that also contains a routing call. Cheap
    // heuristic: scan ±200 chars around every match.
    for (const src of [appTsx, debateHeader]) {
      const matches: number[] = [];
      const re = /setViewMode\s*\(|onSetViewMode\s*[?]?\.\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        matches.push(m.index);
      }
      for (const idx of matches) {
        const window = src.slice(Math.max(0, idx - 200), idx + 200);
        for (const routeRe of ROUTING_CALL_PATTERNS) {
          expect(window).not.toMatch(routeRe);
        }
      }
    }
  });
});

// ── Quick-action callbacks are local state changes ───────────────

describe('TL-003 — timeline quick actions use setActiveMessageId, not routing', () => {
  const surface = read('src/features/arguments/ArgumentGameSurface.tsx');
  // ASP-EXTRACT-001 (Slice 1) — the <ArgumentTimelineMap> mount moved into
  // MapView. The timeline nav handlers stayed in the orchestrator (they own
  // activeMessageId state); ASP-EXTRACT-001 lifted the former onJumpLatest /
  // onJumpToRoot inline arrows into named handlers there. So the local-setter
  // scan reads the named handlers in the surface, and the no-routing scan of
  // the map mount reads MapView.
  const mapView = read('src/features/arguments/room/MapView.tsx');

  it('the timeline jump handlers are wired to local state setters', () => {
    // handleJumpLatest / handleJumpToRoot (lifted from the former inline
    // arrows) call setActiveMessageId (local state). Window-based scan since
    // each handler body also sets the readout selectionStatus + microMoment.
    const latestIdx = surface.indexOf('const handleJumpLatest');
    expect(latestIdx).toBeGreaterThan(-1);
    expect(surface.slice(latestIdx, latestIdx + 220)).toMatch(/setActiveMessageId\(/);
    const rootIdx = surface.indexOf('const handleJumpToRoot');
    expect(rootIdx).toBeGreaterThan(-1);
    expect(surface.slice(rootIdx, rootIdx + 220)).toMatch(/setActiveMessageId\(/);
  });

  it('no navigation call sits in the ArgumentTimelineMap callback path (MapView) or the lifted handlers', () => {
    // The <ArgumentTimelineMap> mount now lives in MapView; scan its window.
    const idx = mapView.indexOf('<ArgumentTimelineMap');
    expect(idx).toBeGreaterThan(-1);
    const mapBlock = mapView.slice(idx, idx + 1500);
    for (const routeRe of ROUTING_CALL_PATTERNS) {
      expect(mapBlock).not.toMatch(routeRe);
    }
    // The lifted timeline nav handlers in the orchestrator are also routing-free.
    const handlersIdx = surface.indexOf('const handleJumpLatest');
    expect(handlersIdx).toBeGreaterThan(-1);
    const handlersBlock = surface.slice(handlersIdx, handlersIdx + 900);
    for (const routeRe of ROUTING_CALL_PATTERNS) {
      expect(handlersBlock).not.toMatch(routeRe);
    }
  });
});

// ── No Linking deep-link inside the room ─────────────────────────

describe('TL-003 — Linking.openURL is only used for the dev banner report link', () => {
  // The dev banner is allowed to use Linking.openURL for the Report-issue
  // link. Nothing inside the room (Timeline / Cards / sidecar / actions)
  // should be calling Linking.openURL.
  const inRoomFiles = [
    'src/features/arguments/ArgumentGameSurface.tsx',
    'src/features/arguments/ArgumentTimelineMap.tsx',
    // ASP-EXTRACT-001 (Slice 1) — the extracted timeline-map lens.
    'src/features/arguments/room/MapView.tsx',
    'src/features/arguments/ArgumentBubbleStack.tsx',
    'src/features/arguments/ArgumentReplySidecar.tsx',
    'src/features/arguments/ArgumentBubbleActions.tsx',
    'src/features/arguments/ArgumentSideActionRail.tsx',
    'src/features/arguments/ArgumentComposer.tsx',
  ];

  it.each(inRoomFiles)('%s does NOT call Linking.openURL', (rel) => {
    const src = safeRead(rel);
    if (!src) return;
    expect(src).not.toMatch(/Linking\.openURL/);
  });

  it('the dev banner — where Linking.openURL IS allowed — is outside the room', () => {
    const banner = read('src/features/devEnvironment/DevEnvironmentBanner.tsx');
    expect(banner).toMatch(/Linking\.openURL/);
  });
});
