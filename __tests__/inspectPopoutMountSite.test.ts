/**
 * UX-001.4 — InspectPopout mount site source scan.
 *
 * Verifies InspectPopout is mounted at the board level, consumes a
 * `buildInspectContent`-produced content object, and wires the §5
 * hand-off to the board-level Act mount (Inspect → Act bridge).
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

describe('UX-001.4 — InspectPopout mount source scan', () => {
  const src = fs.readFileSync(SURFACE_PATH, 'utf8');

  it('imports InspectPopout from oneBox/InspectPopout', () => {
    expect(src).toMatch(/import\s+\{\s*InspectPopout\s*\}\s+from\s+['"]\.\/oneBox\/InspectPopout['"]/);
  });

  it('imports buildInspectContent from oneBox/inspectContentBuilder', () => {
    expect(src).toMatch(
      /import\s+\{\s*buildInspectContent\s*\}\s+from\s+['"]\.\/oneBox\/inspectContentBuilder['"]/,
    );
  });

  it('mounts <InspectPopout> with testID "board-inspect-popout"', () => {
    expect(src).toMatch(/testID="board-inspect-popout"/);
  });

  it('threads content from buildInspectContent (pure-TS builder)', () => {
    expect(src).toMatch(/content=\{inspectContent\}/);
    expect(src).toMatch(/buildInspectContent\(\{ sidecarViewModel \}\)/);
  });

  it('threads stage from activeStage (LIFE-001 cluster state — drives §3.3 emphasis)', () => {
    // Same stage signal Act consumes; design §4.1 specifies.
    expect(src).toMatch(/stage=\{activeStage\}/);
  });

  it('wires onHandoffToAct → opens Act on the same selection (Inspect → Act bridge)', () => {
    expect(src).toMatch(/onHandoffToAct=\{handleInspectHandoffToAct\}/);
    // Handler closes Inspect and opens board-level Act.
    expect(src).toMatch(/setInspectVisible\(false\);\s*setBoardActVisible\(true\)/s);
  });

  it('threads prev / next traversal via the existing chronological nav', () => {
    expect(src).toMatch(/onPrev=\{inspectHasPrev \? handlePrev : undefined\}/);
    expect(src).toMatch(/onNext=\{inspectHasNext \? handleNext : undefined\}/);
  });

  it('threads maxHeightOverride from inspectPresentation.maxHeight', () => {
    expect(src).toMatch(/maxHeightOverride=\{inspectPresentation\.maxHeight\}/);
  });
});

describe('UX-001.4 — InspectPopout itself stays strictly read-only', () => {
  const POPOUT_PATH = path.resolve(
    __dirname,
    '..',
    'src',
    'features',
    'arguments',
    'oneBox',
    'InspectPopout.tsx',
  );
  const src = fs.readFileSync(POPOUT_PATH, 'utf8');

  // Inspect must NEVER import Supabase, fetch, router primitives, or
  // Linking. The single mutation is the §5 hand-off chip, which calls
  // back to the host's onHandoffToAct — never opens the box itself.
  const FORBIDDEN_IMPORTS = [
    'supabase',
    'expo-router',
    '@react-navigation/native',
    'react-native-url-polyfill',
  ];

  for (const forbidden of FORBIDDEN_IMPORTS) {
    it(`InspectPopout.tsx does NOT import "${forbidden}"`, () => {
      expect(src).not.toMatch(new RegExp(`from\\s+['"][^'"]*${forbidden}[^'"]*['"]`));
    });
  }

  it('InspectPopout.tsx does NOT call `fetch(`', () => {
    expect(src).not.toMatch(/\bfetch\(/);
  });

  it('InspectPopout.tsx does NOT import Linking from react-native', () => {
    expect(src).not.toMatch(/import\s+\{[^}]*\bLinking\b[^}]*\}\s+from\s+['"]react-native['"]/);
  });
});
