/**
 * BRAND-001 — Global CivilDiscourse app header tests.
 *
 * Verifies (1) the BRAND token contract that the global dark theme
 * relies on, (2) the `AppHeader` component contract via source scan
 * (the repo's pattern — render tests aren't set up project-wide), and
 * (3) the wiring of `AppHeader` in `App.tsx` so it persists across all
 * three session states (unconfigured / signed_out / signed_in).
 */
import fs from 'fs';
import path from 'path';
import { BRAND, TOKENS, FORBIDDEN_TOKEN_TOKENS } from '../src/lib/designTokens';
import { APP_HEADER_HEIGHT } from '../src/components/AppHeader';

const HEX_6 = /^#[0-9a-fA-F]{6}$/;
const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

// ── BRAND token contract ─────────────────────────────────────────

describe('BRAND-001 token contract', () => {
  it('surface.app is the canonical #08060F backdrop', () => {
    expect(BRAND.surface.app.bg).toBe('#08060F');
  });

  it('text.primary is the canonical cream #F5EDE0', () => {
    expect(BRAND.text.primary).toBe('#F5EDE0');
  });

  it('surface.appElevated is a darker tone than text.primary but lighter than surface.app', () => {
    expect(BRAND.surface.appElevated.bg).toMatch(HEX_6);
    expect(BRAND.surface.appElevated.bg).not.toBe(BRAND.surface.app.bg);
    expect(BRAND.surface.appElevated.bg).not.toBe(BRAND.text.primary);
  });

  it('all BRAND color values are valid 6-digit hex', () => {
    expect(BRAND.surface.app.bg).toMatch(HEX_6);
    expect(BRAND.surface.appElevated.bg).toMatch(HEX_6);
    expect(BRAND.text.primary).toMatch(HEX_6);
    expect(BRAND.text.muted).toMatch(HEX_6);
    expect(BRAND.accent.cream).toMatch(HEX_6);
  });

  it('header + logo heights are sensible defaults', () => {
    expect(BRAND.headerHeightPx).toBeGreaterThanOrEqual(48);
    expect(BRAND.headerHeightPx).toBeLessThanOrEqual(96);
    expect(BRAND.logoHeightPx).toBeGreaterThanOrEqual(32);
    expect(BRAND.logoHeightPx).toBeLessThanOrEqual(BRAND.headerHeightPx);
  });

  it('APP_HEADER_HEIGHT re-export matches BRAND.headerHeightPx', () => {
    expect(APP_HEADER_HEIGHT).toBe(BRAND.headerHeightPx);
  });

  it('BRAND is reachable via TOKENS.brand', () => {
    expect(TOKENS.brand).toBe(BRAND);
  });

  it('BRAND token keys contain no verdict tokens', () => {
    // Recursive scan of all string fields under BRAND for forbidden tokens.
    function* allStrings(o: unknown): Generator<string> {
      if (typeof o === 'string') yield o;
      else if (o && typeof o === 'object') {
        for (const v of Object.values(o as Record<string, unknown>)) yield* allStrings(v);
      }
    }
    function wordBoundary(t: string): RegExp {
      return new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i');
    }
    for (const s of allStrings(BRAND)) {
      for (const banned of FORBIDDEN_TOKEN_TOKENS) {
        expect(s).not.toMatch(wordBoundary(banned));
      }
    }
  });
});

// ── AppHeader component contract (source scan) ───────────────────

describe('BRAND-001 AppHeader component', () => {
  const src = read('src/components/AppHeader.tsx');

  it('uses the canonical asset path for the logo', () => {
    expect(src).toMatch(/['"]\.\.\/\.\.\/assets\/branding\/civic-discourse-logo\.png['"]/);
  });

  it('exports an AppHeader function component', () => {
    expect(src).toMatch(/export function AppHeader\s*\(/);
  });

  it('accessibility label on the logo says "CivilDiscourse"', () => {
    expect(src).toMatch(/accessibilityLabel=['"]CivilDiscourse['"]/);
  });

  it('home pressable carries an accessibility hint about returning to the gallery', () => {
    expect(src).toMatch(/accessibilityHint=['"][^'"]*gallery[^'"]*['"]/);
  });

  it('text-only wordmark fallback exists for the missing-asset case', () => {
    expect(src).toMatch(/CivilDiscourse/);
    expect(src).toMatch(/wordmarkFallback/);
  });

  it('exposes an `app-header` testID at the root', () => {
    expect(src).toMatch(/testID=['"]app-header['"]/);
  });

  it('does NOT import any routing library (TL-003 no-route invariant)', () => {
    expect(src).not.toMatch(/from\s+['"]@react-navigation\//);
    expect(src).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(src).not.toMatch(/\bnavigation\.navigate\s*\(/);
  });

  it('uses BRAND tokens for color (no hardcoded brand hexes drift)', () => {
    expect(src).toMatch(/BRAND\.surface\.app\.bg/);
    expect(src).toMatch(/BRAND\.text\.primary/);
  });
});

// ── App.tsx wires AppHeader at the root, persistent across screens ──

describe('BRAND-001 AppHeader is mounted in App.tsx at the AppRoot level', () => {
  const appTsx = read('App.tsx');

  it('imports AppHeader from src/components/AppHeader', () => {
    expect(appTsx).toMatch(/import\s*\{\s*AppHeader\s*\}\s*from\s*['"]\.\/src\/components\/AppHeader['"]/);
  });

  it('renders <AppHeader /> inside AppRoot (above the content switch)', () => {
    // AppRoot is the routing-state switch; mounting AppHeader there means
    // the header persists across signed_out / loading / signed_in.
    expect(appTsx).toMatch(/<AppHeader\b/);
  });

  it('wires onHomePress to a state-only deselect (no router push)', () => {
    expect(appTsx).toMatch(/onHomePress=\{handleHomePress\}/);
    expect(appTsx).toMatch(/handleHomePress\s*=\s*[^;]*useCallback/);
    expect(appTsx).toMatch(/dispatch\(\s*\{\s*type:\s*['"]SIGNED_IN['"]/);
  });

  it('global app backdrop uses BRAND.surface.app.bg, not the prior light grey', () => {
    expect(appTsx).toMatch(/backgroundColor:\s*BRAND\.surface\.app\.bg/);
    expect(appTsx).not.toMatch(/backgroundColor:\s*['"]#f9fafb['"]/);
  });

  it('AppHeader is mounted and DevEnvironmentBanner is no longer mounted (banner ribbon removed per operator request)', () => {
    const headerIdx = appTsx.indexOf('<AppHeader');
    const bannerIdx = appTsx.indexOf('<DevEnvironmentBanner');
    expect(headerIdx).toBeGreaterThan(-1);
    // Banner mount was removed; the component file remains intact for
    // future reinstatement, but App.tsx no longer renders it.
    expect(bannerIdx).toBe(-1);
  });
});

// ── Asset committed at the canonical path ────────────────────────

describe('BRAND-001 logo asset', () => {
  const assetPath = path.join(REPO, 'assets/branding/civic-discourse-logo.png');

  it('asset file exists at assets/branding/civic-discourse-logo.png', () => {
    expect(fs.existsSync(assetPath)).toBe(true);
  });

  it('asset file is a non-trivial size (>10KB — real artwork, not a 1×1 placeholder)', () => {
    const stat = fs.statSync(assetPath);
    expect(stat.size).toBeGreaterThan(10 * 1024);
  });

  it('asset file is a PNG (header magic bytes)', () => {
    const buf = Buffer.alloc(8);
    const fd = fs.openSync(assetPath, 'r');
    try { fs.readSync(fd, buf, 0, 8, 0); } finally { fs.closeSync(fd); }
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });
});
