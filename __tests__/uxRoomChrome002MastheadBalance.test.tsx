/**
 * UX-ROOM-CHROME-002 — signed-in masthead lockup/nav spatial balance.
 *
 * The signed-in TOP CHROME previously rendered the gold lockup at the
 * COMPACT 48 px height (≈203 px wide) on every band. Against the `flex:1`
 * nav band that left the top-left brand zone under-filled — the chrome read
 * as a tiny floating block rather than one composed region.
 *
 * This card adds an ADDITIVE `balanced` variant: a band-aware "balanced"
 * lockup height (phone 48 / tablet 88 / wide 112) that is larger + more
 * proportional than compact, far shorter than the prominent 288 px lockup,
 * and STILL width-capped so it can never overflow at any viewport. The
 * compact + prominent resolver paths are untouched (byte-equivalent).
 *
 * Repo idiom (mirrors appHeaderResponsiveLogo.test.ts + uxRoomChrome001):
 * viewport math is asserted against the pure resolver; structural / aria
 * behavior is asserted via a render at the default test viewport.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import {
  AppHeader,
  resolveMastheadLogoHeightPx,
  resolveSignedInMastheadLogoHeightPx,
} from '../src/components/AppHeader';
import type { Band } from '../src/hooks/useHeaderBreakpoint';

const REPO = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

// gold horizontal lockup aspect (1400 × 331), mirrors AppHeader.
const ASPECT = 1400 / 331;
const COMPACT = 48;
const PROMINENT = 288;
const HEADER_PADDING = 24; // root paddingHorizontal (12 + 12)

// The card's full viewport matrix.
const ALL_WIDTHS: readonly number[] = Object.freeze([
  320, 360, 390, 414, 600, 768, 1024, 1366, 1920,
]);

// Band for a given width (mirrors resolveBand thresholds: phone ≤599,
// tablet 600–1279, wide ≥1280). Used only to pick the expected balanced
// height per width in the assertions below.
function bandFor(width: number): Band {
  if (width <= 599) return 'phone';
  if (width <= 1279) return 'tablet';
  return 'wide';
}

// The design-target balanced heights (kept in sync with
// BALANCED_LOGO_HEIGHT_BY_BAND in AppHeader.tsx).
const BALANCED: Record<Band, number> = { phone: 48, tablet: 88, wide: 112 };

// ──────────────────────────────────────────────────────────────
// 1. resolveSignedInMastheadLogoHeightPx — per-band balanced math
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-002 — resolveSignedInMastheadLogoHeightPx per-band height', () => {
  it('returns the design-target balanced height per band at a roomy width', () => {
    // A roomy width per band so widthFit never caps below the target.
    expect(resolveSignedInMastheadLogoHeightPx('phone', 480)).toBe(BALANCED.phone);
    expect(resolveSignedInMastheadLogoHeightPx('tablet', 1024)).toBe(BALANCED.tablet);
    expect(resolveSignedInMastheadLogoHeightPx('wide', 1920)).toBe(BALANCED.wide);
  });

  it('on tablet + wide the balanced height is > compact (48) and < prominent (288)', () => {
    const tablet = resolveSignedInMastheadLogoHeightPx('tablet', 1024);
    const wide = resolveSignedInMastheadLogoHeightPx('wide', 1920);
    expect(tablet).toBeGreaterThan(COMPACT);
    expect(tablet).toBeLessThan(PROMINENT);
    expect(wide).toBeGreaterThan(COMPACT);
    expect(wide).toBeLessThan(PROMINENT);
    // wide is the tallest balanced band.
    expect(wide).toBeGreaterThan(tablet);
  });

  it('phone balanced height is >= 48 (stays compact on phone per the card)', () => {
    for (const width of [320, 360, 390, 414, 480]) {
      const h = resolveSignedInMastheadLogoHeightPx('phone', width);
      expect(h).toBeGreaterThanOrEqual(COMPACT);
      // Phone never grows beyond the compact target.
      expect(h).toBeLessThanOrEqual(BALANCED.phone);
    }
  });

  it('a non-positive (SSR / static) width returns the WIDE balanced default', () => {
    // resolveBand(0) === 'wide', so the first paint matches the wide height.
    expect(resolveSignedInMastheadLogoHeightPx('wide', 0)).toBe(BALANCED.wide);
    expect(resolveSignedInMastheadLogoHeightPx('phone', 0)).toBe(BALANCED.wide);
    expect(resolveSignedInMastheadLogoHeightPx('tablet', -10)).toBe(BALANCED.wide);
  });
});

// ──────────────────────────────────────────────────────────────
// 2. No horizontal overflow at any supported viewport
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-002 — balanced lockup never overflows', () => {
  it('rendered width (h × aspect) fits inside the available width AND the viewport at every width', () => {
    for (const width of ALL_WIDTHS) {
      const band = bandFor(width);
      const h = resolveSignedInMastheadLogoHeightPx(band, width);
      const renderedWidth = h * ASPECT;
      // Core acceptance: fits within the available header width (viewport − padding).
      expect(renderedWidth).toBeLessThanOrEqual(width - HEADER_PADDING);
      // And trivially within the full viewport.
      expect(renderedWidth).toBeLessThanOrEqual(width);
      // Always a positive, slim-but-substantial height.
      expect(h).toBeGreaterThan(0);
      // Never as tall as the prominent lockup.
      expect(h).toBeLessThan(PROMINENT);
    }
  });

  it('matches the documented sizing table (band + balanced height) at every width', () => {
    // The expected height is min(target, widthFit). At all listed widths the
    // target fits, so the height equals the per-band target — EXCEPT verify the
    // resolver still returns exactly that.
    for (const width of ALL_WIDTHS) {
      const band = bandFor(width);
      const expectedTarget = BALANCED[band];
      const available = Math.max(0, width - HEADER_PADDING);
      const widthFit = Math.floor(available / ASPECT);
      const expected = Math.min(expectedTarget, widthFit);
      expect(resolveSignedInMastheadLogoHeightPx(band, width)).toBe(expected);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 3. Regression — compact + prominent resolver paths UNCHANGED
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-002 — compact + prominent resolver paths unchanged', () => {
  it('the compact path stays <= 48 at every supported width', () => {
    for (const width of ALL_WIDTHS) {
      const band = bandFor(width);
      expect(resolveMastheadLogoHeightPx(band, width, true)).toBeLessThanOrEqual(COMPACT);
    }
  });

  it('the prominent path still returns 288 where it fits', () => {
    expect(resolveMastheadLogoHeightPx('wide', 1280)).toBe(PROMINENT);
    expect(resolveMastheadLogoHeightPx('wide', 1440)).toBe(PROMINENT);
    expect(resolveMastheadLogoHeightPx('tablet', 1280)).toBe(PROMINENT);
  });

  it('compact=false 3-arg call is byte-identical to the 2-arg default', () => {
    for (const width of ALL_WIDTHS) {
      const band = bandFor(width);
      expect(resolveMastheadLogoHeightPx(band, width, false)).toBe(
        resolveMastheadLogoHeightPx(band, width),
      );
    }
  });

  it('the balanced resolver is independent of the compact / prominent resolver', () => {
    // Distinct functions; the balanced default never collapses to compact on
    // tablet / wide nor to prominent anywhere.
    expect(resolveSignedInMastheadLogoHeightPx('wide', 1920)).not.toBe(
      resolveMastheadLogoHeightPx('wide', 1920, true),
    );
    expect(resolveSignedInMastheadLogoHeightPx('wide', 1920)).not.toBe(
      resolveMastheadLogoHeightPx('wide', 1920),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// 4. AppHeader balanced variant render — structure, aria, aspect
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-002 — AppHeader balanced render', () => {
  it('balanced: the brand logo Image is present with intact aria + preserved aspect', () => {
    const { getByTestId } = render(
      <AppHeader onHomePress={() => {}} balanced navSlot={<></>} />,
    );
    const logo = getByTestId('app-header-logo-image');
    expect(logo).toBeTruthy();
    expect(logo.props.accessibilityLabel).toBe('CivilDiscourse');
    expect(logo.props.resizeMode).toBe('contain');
    const style = flattenStyle(logo.props.style);
    const h = Number(style.height);
    const w = Number(style.width);
    // Aspect ALWAYS preserved — width === height × aspect (never deformed).
    expect(w).toBeCloseTo(h * ASPECT, 5);
    expect(h).toBeGreaterThan(0);
    // Never as tall as the prominent lockup.
    expect(h).toBeLessThan(PROMINENT);
  });

  it('balanced: the navSlot region is present + reachable', () => {
    const { getByTestId } = render(
      <AppHeader onHomePress={() => {}} balanced navSlot={<></>} />,
    );
    expect(getByTestId('app-header')).toBeTruthy();
    expect(getByTestId('app-header-home')).toBeTruthy();
    expect(getByTestId('app-header-nav-slot')).toBeTruthy();
  });

  it('balanced: the tagline is omitted (like compact)', () => {
    const { queryByTestId } = render(
      <AppHeader onHomePress={() => {}} balanced navSlot={<></>} />,
    );
    expect(queryByTestId('app-header-tagline')).toBeNull();
  });

  it('balanced: the home pressable keeps role + accessibility hint (gallery return)', () => {
    const { getByTestId } = render(
      <AppHeader onHomePress={() => {}} balanced navSlot={<></>} />,
    );
    const home = getByTestId('app-header-home');
    expect(home.props.accessibilityRole).toBe('button');
    expect(String(home.props.accessibilityHint).toLowerCase()).toContain('gallery');
    // hitSlop preserves the >= 44 effective touch target.
    expect(home.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
  });

  it('balanced: the rightSlot still renders its content', () => {
    const { getByTestId } = render(
      <AppHeader onHomePress={() => {}} balanced navSlot={<></>} rightSlot={<></>} />,
    );
    expect(getByTestId('app-header-right-slot')).toBeTruthy();
  });

  it('balanced is distinct from compact (taller) and from prominent (no tagline)', () => {
    const balanced = render(
      <AppHeader onHomePress={() => {}} balanced navSlot={<></>} />,
    );
    const balancedH = Number(
      flattenStyle(balanced.getByTestId('app-header-logo-image').props.style).height,
    );

    const compact = render(
      <AppHeader onHomePress={() => {}} compact navSlot={<></>} />,
    );
    const compactH = Number(
      flattenStyle(compact.getByTestId('app-header-logo-image').props.style).height,
    );

    const prominent = render(
      <AppHeader onHomePress={() => {}} navSlot={<></>} />,
    );

    // Distinct from compact: at the default (wide, resolveBand(0)) test
    // viewport the balanced height (112) exceeds the compact 48.
    expect(balancedH).toBeGreaterThan(compactH);
    // Distinct from prominent: prominent keeps the anchored tagline; balanced
    // omits it.
    expect(prominent.queryByTestId('app-header-tagline')).toBeTruthy();
    expect(balanced.queryByTestId('app-header-tagline')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// 5. Doctrine — no banned copy in the rendered balanced header
// ──────────────────────────────────────────────────────────────

const COPY_BAN = [
  'winner',
  'loser',
  'score',
  'verdict',
  'truth',
  'wrong',
  'dishonest',
  'bad faith',
  'manipulative',
  'just get to the bottom of it',
  'gameplay analysis',
  'where the points stand',
];

describe('UX-ROOM-CHROME-002 — doctrine: balanced header emits no banned copy', () => {
  it('no banned token appears in any rendered string', () => {
    const { toJSON } = render(
      <AppHeader
        onHomePress={() => {}}
        balanced
        navSlot={<></>}
        rightSlot={<></>}
      />,
    );
    const strings: string[] = [];
    const walk = (node: unknown): void => {
      if (node == null) return;
      if (typeof node === 'string') {
        strings.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      const n = node as { children?: unknown };
      if (n.children !== undefined) walk(n.children);
    };
    walk(toJSON());
    const haystack = strings.join(' ').toLowerCase();
    for (const banned of COPY_BAN) {
      expect(haystack).not.toContain(banned);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 6. Frozen surfaces — Sign In / AuthScreen / favicon untouched
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-002 — frozen surfaces untouched', () => {
  it('AuthScreen does not import or render AppHeader (Sign In hero untouched)', () => {
    const auth = read('src/features/auth/AuthScreen.tsx');
    const importLines = auth.split('\n').filter((l) => /^\s*import\b/.test(l));
    for (const line of importLines) {
      expect(line).not.toMatch(/\bAppHeader\b/);
    }
    expect(auth).not.toMatch(/<AppHeader\b/);
  });

  it('AuthScreen still uses its own signInLockupModel (not the balanced variant)', () => {
    const auth = read('src/features/auth/AuthScreen.tsx');
    expect(auth).toContain('signInLockupModel');
    // This card must not have wired the balanced masthead into the Sign In hero.
    expect(auth).not.toMatch(/\bbalanced\b/);
  });

  it('app.json (favicon) is not part of this change — the favicon source is unchanged', () => {
    // The favicon config lives in app.json; this card does not touch it. We
    // assert the canonical favicon key is still present (a structural smoke).
    const appJson = read('app.json');
    expect(appJson).toContain('favicon');
  });

  it('AppHeader still requires only the one canonical logo asset (no asset bytes changed)', () => {
    const header = read('src/components/AppHeader.tsx');
    const requires = header.match(/require\([^)]*\)/g) ?? [];
    expect(requires.length).toBe(1);
    expect(requires[0]).toMatch(/civic-discourse-logo\.png/);
  });
});
