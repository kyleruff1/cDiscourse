/**
 * BRAND-001 Stage 2 — useHeaderBreakpoint hook contract.
 *
 * Verifies (1) BRAND token contract for the new wide-breakpoint
 * constants, (2) the hook's pure resolver `resolveHeaderBreakpoint`
 * returns the right shape across viewport widths, (3) the SSR /
 * static-export safety branch treats `width === 0` as wide, (4) a
 * source-scan contract on `AppHeader.tsx` pins the wiring (testIDs,
 * hitSlop, divider, no animation lib), and (5) the source-scan on
 * `useHeaderBreakpoint.ts` confirms the hook itself delegates to the
 * pure resolver (so the two stay in sync).
 *
 * The hook's reactive surface is just `useWindowDimensions().width`
 * → `resolveHeaderBreakpoint(width)`. Testing the pure resolver
 * directly avoids depending on React's hook runtime and matches the
 * repo's existing pure-helper test discipline.
 */
import fs from 'fs';
import path from 'path';
import { BRAND } from '../src/lib/designTokens';
import { resolveHeaderBreakpoint } from '../src/hooks/useHeaderBreakpoint';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

// ── 1. BRAND token contract for Stage 2 additions ───────────────────

describe('BRAND-001 Stage 2 — BRAND token additions', () => {
  it('logoHeightPxWide is exactly 110', () => {
    expect(BRAND.logoHeightPxWide).toBe(110);
  });

  it('logoHeightPxWide is ≈ 2.5× the base logoHeightPx', () => {
    expect(BRAND.logoHeightPxWide).toBe(Math.round(BRAND.logoHeightPx * 2.5));
  });

  it('logoHeightPxWide is strictly greater than logoHeightPx', () => {
    expect(BRAND.logoHeightPxWide).toBeGreaterThan(BRAND.logoHeightPx);
  });

  it('headerHeightPxWide is exactly 152', () => {
    expect(BRAND.headerHeightPxWide).toBe(152);
  });

  it('headerHeightPxWide is strictly greater than headerHeightPx', () => {
    expect(BRAND.headerHeightPxWide).toBeGreaterThan(BRAND.headerHeightPx);
  });

  it('headerHeightPx (Stage 1) is still 64 — must not regress', () => {
    expect(BRAND.headerHeightPx).toBe(64);
  });

  it('logoHeightPx (Stage 1) is still 44 — must not regress', () => {
    expect(BRAND.logoHeightPx).toBe(44);
  });

  it('headerWideBreakpointPx is exactly 720', () => {
    expect(BRAND.headerWideBreakpointPx).toBe(720);
  });

  it('headerWideBreakpointPx is in the (320, 1024) range', () => {
    expect(BRAND.headerWideBreakpointPx).toBeGreaterThan(320);
    expect(BRAND.headerWideBreakpointPx).toBeLessThan(1024);
  });

  it('accent.creamHairline matches the expected rgba pattern', () => {
    expect(BRAND.accent.creamHairline).toMatch(
      /^rgba\(245,\s*237,\s*224,\s*0\.18\)$/,
    );
  });

  it('text.taglineFg is a 6-digit hex string', () => {
    expect(BRAND.text.taglineFg).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ── 2. resolveHeaderBreakpoint pure-resolver behaviour ─────────────

describe('BRAND-001 Stage 2 — resolveHeaderBreakpoint', () => {
  it('returns isWide=true exactly at the breakpoint (720dp)', () => {
    // UX-001.1 — 720dp falls in the new tablet band (600..1279). The
    // legacy `isWide=true` semantic is preserved (tablet !== phone)
    // but `logoHeightPx` / `headerHeightPx` now resolve from the
    // band-aware maps. See UX-001.1 design doc "Implementer note".
    const r = resolveHeaderBreakpoint(BRAND.headerWideBreakpointPx);
    expect(r.isWide).toBe(true);
    expect(r.logoHeightPx).toBe(BRAND.logoHeightByBand.tablet);
    expect(r.headerHeightPx).toBe(BRAND.headerHeightByBand.tablet);
  });

  it('returns isWide=true above the breakpoint (1024dp)', () => {
    // UX-001.1 — 1024dp (iPad landscape) is in the tablet band
    // (600..1279); per Q1 verdict it deliberately does NOT jump to
    // wide. `isWide=true` preserved (tablet !== phone).
    const r = resolveHeaderBreakpoint(1024);
    expect(r.isWide).toBe(true);
    expect(r.logoHeightPx).toBe(BRAND.logoHeightByBand.tablet);
    expect(r.headerHeightPx).toBe(BRAND.headerHeightByBand.tablet);
  });

  it('returns isWide=true just below the legacy 720dp breakpoint (719dp, now tablet band)', () => {
    // UX-001.1 — 719dp falls in the new tablet band (Q1 phone upper
    // bound is 599, not 719). The legacy 720dp boundary is preserved
    // as a constant but is no longer the band boundary. `isWide`
    // semantic preserved: tablet !== phone → true.
    const r = resolveHeaderBreakpoint(BRAND.headerWideBreakpointPx - 1);
    expect(r.isWide).toBe(true);
    expect(r.logoHeightPx).toBe(BRAND.logoHeightByBand.tablet);
    expect(r.headerHeightPx).toBe(BRAND.headerHeightByBand.tablet);
  });

  it('returns isWide=false for a typical iPhone portrait width (390dp)', () => {
    const r = resolveHeaderBreakpoint(390);
    expect(r.isWide).toBe(false);
    expect(r.headerHeightPx).toBe(64);
  });

  it('returns isWide=false for a typical small Android portrait width (360dp)', () => {
    const r = resolveHeaderBreakpoint(360);
    expect(r.isWide).toBe(false);
    expect(r.headerHeightPx).toBe(64);
  });

  it('treats width=0 (SSR / static-export pre-hydration) as wide', () => {
    // UX-001.1 — width=0 still resolves to the wide band so the first
    // paint shows the polished layout. The band's height is now 120
    // (per UX-001.1 §19); legacy 152 is preserved as a constant only.
    const r = resolveHeaderBreakpoint(0);
    expect(r.isWide).toBe(true);
    expect(r.headerHeightPx).toBe(BRAND.headerHeightByBand.wide);
  });

  it('treats negative width as wide (defensive, never crashes)', () => {
    const r = resolveHeaderBreakpoint(-1);
    expect(r.isWide).toBe(true);
  });
});

// ── 2b. useHeaderBreakpoint source-scan (delegates to resolver) ────

describe('BRAND-001 Stage 2 — useHeaderBreakpoint source contract', () => {
  const src = read('src/hooks/useHeaderBreakpoint.ts');

  it('hook delegates to resolveHeaderBreakpoint (single source of truth)', () => {
    expect(src).toMatch(/export function useHeaderBreakpoint/);
    expect(src).toMatch(/resolveHeaderBreakpoint\s*\(/);
  });

  it('hook reads useWindowDimensions from react-native', () => {
    expect(src).toMatch(
      /import\s+\{\s*useWindowDimensions\s*\}\s+from\s+['"]react-native['"]/,
    );
  });

  it('hook does NOT use Dimensions.addEventListener', () => {
    // useWindowDimensions handles resize already; we never want a
    // global listener that would leak on unmount.
    expect(src).not.toMatch(/Dimensions\.addEventListener/);
  });

  it('hook does NOT branch on Platform.OS', () => {
    expect(src).not.toMatch(/Platform\.OS\s*===/);
  });

  it('hook does NOT import any router / navigation lib', () => {
    expect(src).not.toMatch(/@react-navigation/);
    expect(src).not.toMatch(/expo-router/);
  });
});

// ── 3. AppHeader.tsx source-scan contract (Stage 2 wiring) ─────────

describe('BRAND-001 Stage 2 — AppHeader source contract', () => {
  const src = read('src/components/AppHeader.tsx');

  it('imports useHeaderBreakpoint from the hooks module', () => {
    expect(src).toMatch(
      /import\s+\{\s*useHeaderBreakpoint\s*\}\s+from\s+['"]\.\.\/hooks\/useHeaderBreakpoint['"]/,
    );
  });

  it('imports AppHeaderTagline', () => {
    expect(src).toMatch(/AppHeaderTagline/);
    expect(src).toMatch(/from\s+['"]\.\/AppHeaderTagline['"]/);
  });

  it('renders <AppHeaderTagline /> inside the header', () => {
    expect(src).toMatch(/<AppHeaderTagline\b/);
  });

  it('passes both `inline` and `stacked` variants to AppHeaderTagline', () => {
    expect(src).toMatch(/['"]inline['"]/);
    expect(src).toMatch(/['"]stacked['"]/);
  });

  it('references BRAND.accent.creamHairline (divider color)', () => {
    expect(src).toMatch(/BRAND\.accent\.creamHairline/);
  });

  it('exposes a "app-header-divider" testID', () => {
    expect(src).toMatch(/testID=['"]app-header-divider['"]/);
  });

  it('preserves every Stage 1 testID verbatim', () => {
    for (const id of [
      'app-header',
      'app-header-home',
      'app-header-logo-image',
      'app-header-logo-fallback',
      'app-header-right-slot',
    ]) {
      expect(src).toMatch(new RegExp(`testID=['"]${id}['"]`));
    }
  });

  it('configures hitSlop ≥ 8 on each edge of the home pressable', () => {
    expect(src).toMatch(/hitSlop=\{\{[^}]*top:\s*8/);
    expect(src).toMatch(/hitSlop=\{\{[^}]*bottom:\s*8/);
    expect(src).toMatch(/hitSlop=\{\{[^}]*left:\s*8/);
    expect(src).toMatch(/hitSlop=\{\{[^}]*right:\s*8/);
  });

  it('logo Image style is height-only (no fixed width, aspect-ratio safe)', () => {
    // The Stage 1 style "width: 168, height: BRAND.logoHeightPx" is
    // replaced with a height-only inline style so wide-breakpoint
    // scaling preserves the logo's aspect ratio via resizeMode.
    expect(src).not.toMatch(/width:\s*168/);
    expect(src).toMatch(/resizeMode=['"]contain['"]/);
  });

  it('does NOT import any animation library', () => {
    expect(src).not.toMatch(/from\s+['"]react-native-reanimated['"]/);
    expect(src).not.toMatch(/Animated\.View/);
    expect(src).not.toMatch(/LayoutAnimation/);
  });

  it('does NOT import an icon library', () => {
    expect(src).not.toMatch(/from\s+['"]@expo\/vector-icons['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native-vector-icons/);
  });

  it('does NOT declare a heavy shadow in styles (flat divider only)', () => {
    expect(src).not.toMatch(/shadowRadius:\s*[1-9]/);
    expect(src).not.toMatch(/elevation:\s*[1-9]/);
  });

  it('still wires no router / navigation (TL-003 invariant)', () => {
    expect(src).not.toMatch(/from\s+['"]@react-navigation\//);
    expect(src).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(src).not.toMatch(/\bnavigate\s*\(/);
  });

  it('uses BRAND tokens for color (no hardcoded brand hexes drift)', () => {
    expect(src).toMatch(/BRAND\.surface\.app\.bg/);
    expect(src).not.toMatch(/['"]#08060F['"]/);
  });

  it('source does NOT contain verdict tokens as string literals', () => {
    // Spot-check that the new copy did not slip in a verdict label.
    const banned = ['winner', 'loser', 'liar', 'dishonest'];
    for (const t of banned) {
      expect(src.toLowerCase()).not.toContain(t);
    }
  });
});

// ── 4. App.tsx still wires the Stage 1 invariants ─────────────────

describe('BRAND-001 Stage 2 — App.tsx Stage 1 invariants preserved', () => {
  const appTsx = read('App.tsx');

  it('still wires onHomePress to a state-only dispatch (SIGNED_IN)', () => {
    expect(appTsx).toMatch(/onHomePress=\{handleHomePress\}/);
    expect(appTsx).toMatch(/dispatch\(\s*\{\s*type:\s*['"]SIGNED_IN['"]/);
  });

  it('still uses BRAND.surface.app.bg for the app backdrop', () => {
    expect(appTsx).toMatch(/backgroundColor:\s*BRAND\.surface\.app\.bg/);
  });

  it('AppHeader still sits above DevEnvironmentBanner in source order', () => {
    const headerIdx = appTsx.indexOf('<AppHeader');
    const bannerIdx = appTsx.indexOf('<DevEnvironmentBanner');
    expect(headerIdx).toBeGreaterThan(-1);
    expect(bannerIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeLessThan(bannerIdx);
  });
});

// ── 5. package.json — no surprise new runtime dep ─────────────────

describe('BRAND-001 Stage 2 — dependency discipline', () => {
  it('package.json adds NO @expo-google-fonts/* dep (system-serif default)', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const name of Object.keys(all)) {
      expect(name.startsWith('@expo-google-fonts/')).toBe(false);
    }
  });

  it('package.json does NOT add an animation library', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
    };
    const deps = pkg.dependencies || {};
    expect(deps['react-native-reanimated']).toBeUndefined();
    expect(deps['moti']).toBeUndefined();
  });
});
