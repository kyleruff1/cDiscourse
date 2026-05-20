/**
 * COMPOSER-002 — No route transition from the dock open/close path.
 *
 * The acceptance criterion: "No normal-user action routes to a full-page
 * 'Your Move' screen." COMPOSER-002 extends the TL-003 no-route invariant
 * to the composer. The dock opens and closes via a core RN `<Modal>` —
 * which is an overlay, not a navigation route — and via a web `keydown`
 * Escape listener. Neither path touches a router, `Linking`, or
 * `history`.
 *
 * Static-import / source scan, mirroring SC-004's `forbiddenImports`
 * test. This is where a navigation regression would reappear.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const DOCK_PATH = path.join(ROOT, 'src', 'features', 'arguments', 'ArgumentComposerDock.tsx');
const DOCK_SRC = fs.readFileSync(DOCK_PATH, 'utf8');

// Value-import line collector (skips `import type`). Mirrors the
// timelineNodeActionDockForbiddenImports.test.ts helper.
function valueImportLines(src: string): string {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inImport = false;
  let isTypeOnly = false;
  let buf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inImport) {
      if (/^import\s+(?!type\b)/.test(trimmed)) {
        inImport = true;
        isTypeOnly = false;
        buf = [trimmed];
        if (/;\s*$/.test(trimmed)) {
          if (!isTypeOnly) out.push(buf.join(' '));
          inImport = false;
          buf = [];
        }
      } else if (/^import\s+type\b/.test(trimmed)) {
        if (!/;\s*$/.test(trimmed)) {
          inImport = true;
          isTypeOnly = true;
          buf = [trimmed];
        }
      }
    } else {
      buf.push(trimmed);
      if (/;\s*$/.test(trimmed)) {
        if (!isTypeOnly) out.push(buf.join(' '));
        inImport = false;
        buf = [];
      }
    }
  }
  return out.join('\n');
}

const DOCK_VALUE_IMPORTS = valueImportLines(DOCK_SRC);

// ── 1. No navigation / router imports ──────────────────────────

describe('COMPOSER-002 — the dock contains no navigation primitive', () => {
  const FORBIDDEN = [
    'react-navigation',
    '@react-navigation',
    'expo-router',
    'react-router',
  ];

  it.each(FORBIDDEN)('does not value-import %s', (token) => {
    expect(DOCK_VALUE_IMPORTS).not.toContain(token);
  });

  it('does not reference a router push / navigate call', () => {
    expect(DOCK_SRC).not.toMatch(/\brouter\.push\s*\(/);
    expect(DOCK_SRC).not.toMatch(/\brouterPush\b/);
    expect(DOCK_SRC).not.toMatch(/\bnavigate\s*\(/);
    expect(DOCK_SRC).not.toMatch(/useNavigation\s*\(/);
  });

  it('does not import or use Linking', () => {
    expect(DOCK_VALUE_IMPORTS).not.toContain('Linking');
    expect(DOCK_SRC).not.toMatch(/Linking\.openURL/);
  });

  it('does not push a history entry', () => {
    expect(DOCK_SRC).not.toMatch(/history\.pushState/);
    expect(DOCK_SRC).not.toMatch(/window\.location\s*=/);
  });
});

// ── 2. The close paths route through a single onClose, no nav ───

describe('COMPOSER-002 — close paths use Modal.onRequestClose + Esc, never a route', () => {
  it('the dock outer container is a core RN <Modal>', () => {
    expect(DOCK_VALUE_IMPORTS).toMatch(/\bModal\b/);
    expect(DOCK_SRC).toMatch(/<Modal[\s\S]*?onRequestClose=\{onClose\}/);
  });

  it('hardware-back is handled by Modal.onRequestClose -> onClose (no route change)', () => {
    // RN <Modal> is an overlay; onRequestClose fires on Android
    // hardware-back and dismisses the dock without navigation.
    expect(DOCK_SRC).toMatch(/onRequestClose=\{onClose\}/);
  });

  it('web Escape is handled by a keydown listener scoped to `visible`', () => {
    expect(DOCK_SRC).toMatch(/Platform\.OS !== 'web'/);
    expect(DOCK_SRC).toMatch(/addEventListener\('keydown'/);
    expect(DOCK_SRC).toMatch(/removeEventListener\('keydown'/);
    // The Escape branch calls onClose (via the stable ref) and preventDefault.
    expect(DOCK_SRC).toMatch(/event\.key === 'Escape'/);
    expect(DOCK_SRC).toMatch(/event\.preventDefault\(\)/);
  });

  it('the keydown effect depends on `visible` (listener removed when the dock closes)', () => {
    // The effect cleanup + the `[visible]` dependency together guarantee
    // the listener is gone when the dock is not open — no leaked Esc.
    expect(DOCK_SRC).toMatch(/\}, \[visible\]\);/);
  });

  it('both close paths funnel into the single onClose prop', () => {
    // No second close channel — onClose is App.tsx#handleComposerClose,
    // which resets composerOpen / replyTarget / composerPreset.
    expect(DOCK_SRC).toMatch(/onClose:\s*\(\)\s*=>\s*void/);
  });
});

// ── 3. App.tsx: the composer no longer swaps the screen ────────

describe('COMPOSER-002 — App.tsx no longer routes the composer as a screen', () => {
  const APP_SRC = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');

  it('there is no `composerOpen ? <Composer/> : <Room/>`-style swap', () => {
    expect(APP_SRC).not.toMatch(/composerOpen\s*\?/);
    expect(APP_SRC).not.toMatch(/!composerOpen\s*&&/);
  });

  it('App.tsx itself imports no router / Linking', () => {
    expect(APP_SRC).not.toMatch(/from 'expo-router'/);
    expect(APP_SRC).not.toMatch(/from '@react-navigation/);
  });
});
