/**
 * UX-ROOM-CHROME-001 — compact signed-in room chrome + de-game
 * mediator-board copy.
 *
 * Two safe-now changes verified here:
 *
 *  1. AppHeader gains an ADDITIVE `compact?: boolean` prop (default
 *     false). When false the masthead is byte-identical to today
 *     (prominent ~288 px gold lockup, width-capped). When true the SAME
 *     gold lockup renders at a COMPACT height (~48 px), still width-
 *     capped so the rendered width never exceeds the available header
 *     width (no horizontal overflow), with the anchored tagline omitted
 *     and the brand still announced via the logo aria. The signed-in
 *     shell masthead (the navSlot-bearing <AppHeader>) receives
 *     `compact`; the bare/transient <AppHeader> and AuthScreen do NOT.
 *
 *  2. ArgumentScoreTracker's visible title is now "Mediator readout"
 *     (was "Where the points stand · gameplay analysis"). The room
 *     reads as a neutral mediator surface, not a game scoreboard.
 *
 * Repo idiom: viewport-specific height/width math is asserted against
 * the pure `resolveMastheadLogoHeightPx(band, width, compact)` resolver
 * (mirroring appHeaderResponsiveLogo.test.ts); structural / aria
 * behavior is asserted via a render at the default test viewport; copy
 * + wiring are asserted via source scan.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { AppHeader, resolveMastheadLogoHeightPx } from '../src/components/AppHeader';
import { ArgumentScoreTracker } from '../src/features/arguments/ArgumentScoreTracker';
import { AUTH_FIRST_RUN_COPY, PRIMARY_TAGLINE } from '../src/lib/brandCopy';
import type { Band } from '../src/hooks/useHeaderBreakpoint';
import type { ParticipantTrend } from '../src/features/arguments/argumentScoreModel';

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

// gold horizontal lockup aspect (800 × 260), mirrors AppHeader.
const ASPECT = 800 / 260;
const PROMINENT = 288;
const HEADER_PADDING = 24; // root paddingHorizontal (12 + 12)

// The card-spec viewport matrix.
const VIEWPORTS: ReadonlyArray<[Band, number]> = Object.freeze([
  ['phone', 320],
  ['phone', 360],
  ['phone', 390],
  ['phone', 414],
  ['tablet', 768],
  ['wide', 1280],
]);

// ──────────────────────────────────────────────────────────────
// 1a. resolveMastheadLogoHeightPx — compact variant math
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-001 — compact masthead logo height', () => {
  it('is MATERIALLY smaller than the prominent height at every viewport', () => {
    for (const [band, width] of VIEWPORTS) {
      const prominent = resolveMastheadLogoHeightPx(band, width);
      const compact = resolveMastheadLogoHeightPx(band, width, true);
      // Compact must be slim (~48 px) and clearly shorter than prominent.
      expect(compact).toBeLessThanOrEqual(48);
      expect(compact).toBeLessThan(prominent);
      // On tablet / wide the prominent path is the tall lockup, so the gap
      // is large; even on phone (compact-capped prominent) it is shorter.
      expect(compact).toBeGreaterThan(0);
    }
  });

  it('renders WITHIN the available width at every viewport (no horizontal overflow)', () => {
    for (const [band, width] of VIEWPORTS) {
      const compact = resolveMastheadLogoHeightPx(band, width, true);
      // rendered width = height × aspect must fit inside viewport − padding.
      expect(compact * ASPECT).toBeLessThanOrEqual(width - HEADER_PADDING);
      // and trivially within the full viewport.
      expect(compact * ASPECT).toBeLessThanOrEqual(width);
    }
  });

  it('caps the compact logo to ~48 px on a wide viewport where the prominent fits', () => {
    // 1280 wide: prominent = 288; compact stays at the slim cap, not 288.
    expect(resolveMastheadLogoHeightPx('wide', 1280, true)).toBe(48);
    expect(resolveMastheadLogoHeightPx('wide', 1280)).toBe(PROMINENT);
  });

  it('keeps a slim height for a non-positive (SSR / static) width in compact', () => {
    expect(resolveMastheadLogoHeightPx('wide', 0, true)).toBe(48);
    expect(resolveMastheadLogoHeightPx('phone', 0, true)).toBe(48);
  });
});

// ──────────────────────────────────────────────────────────────
// 1b. resolveMastheadLogoHeightPx — prominent (default) UNCHANGED
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-001 — prominent (default) masthead unchanged by the additive prop', () => {
  it('omitting compact preserves the prior prominent-path heights', () => {
    // These mirror appHeaderResponsiveLogo.test.ts expectations.
    expect(resolveMastheadLogoHeightPx('wide', 1024)).toBe(PROMINENT);
    expect(resolveMastheadLogoHeightPx('wide', 1440)).toBe(PROMINENT);
    expect(resolveMastheadLogoHeightPx('tablet', 1024)).toBe(PROMINENT);
    // non-positive width still returns the prominent fallback.
    expect(resolveMastheadLogoHeightPx('phone', 0)).toBe(PROMINENT);
  });

  it('compact=false is identical to the 2-arg call (byte-identical default)', () => {
    for (const [band, width] of VIEWPORTS) {
      expect(resolveMastheadLogoHeightPx(band, width, false)).toBe(
        resolveMastheadLogoHeightPx(band, width),
      );
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 1c. AppHeader render — compact structure + aria
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-001 — AppHeader compact render', () => {
  it('compact: the brand logo Image is still present with intact aria, tagline omitted', () => {
    const { getByTestId, queryByTestId } = render(
      <AppHeader onHomePress={() => {}} compact navSlot={<></>} />,
    );
    const logo = getByTestId('app-header-logo-image');
    expect(logo).toBeTruthy();
    // brand still announced.
    expect(logo.props.accessibilityLabel).toBe('CivilDiscourse');
    // tagline omitted in compact so the masthead stays slim.
    expect(queryByTestId('app-header-tagline')).toBeNull();
    // header + home pressable still mount; navSlot region present.
    expect(getByTestId('app-header')).toBeTruthy();
    expect(getByTestId('app-header-home')).toBeTruthy();
    expect(getByTestId('app-header-nav-slot')).toBeTruthy();
  });

  it('compact: the logo Image height is the slim compact height (not the prominent 288)', () => {
    const { getByTestId } = render(
      <AppHeader onHomePress={() => {}} compact navSlot={<></>} />,
    );
    const style = flattenStyle(getByTestId('app-header-logo-image').props.style);
    const h = Number(style.height);
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThanOrEqual(48);
    expect(h).toBeLessThan(PROMINENT);
  });

  it('default (no compact): the prominent path still mounts the tagline + logo', () => {
    const { getByTestId } = render(
      <AppHeader onHomePress={() => {}} navSlot={<></>} />,
    );
    expect(getByTestId('app-header-logo-image')).toBeTruthy();
    // prominent keeps the anchored tagline.
    expect(getByTestId('app-header-tagline')).toBeTruthy();
  });

  it('compact: the rightSlot still renders its content', () => {
    const { getByTestId } = render(
      <AppHeader
        onHomePress={() => {}}
        compact
        navSlot={<></>}
        rightSlot={<></>}
      />,
    );
    const right = getByTestId('app-header-right-slot');
    expect(right).toBeTruthy();
  });

  it('compact: the home pressable keeps role + accessibility hint (gallery return)', () => {
    const { getByTestId } = render(
      <AppHeader onHomePress={() => {}} compact navSlot={<></>} />,
    );
    const home = getByTestId('app-header-home');
    expect(home.props.accessibilityRole).toBe('button');
    expect(String(home.props.accessibilityHint).toLowerCase()).toContain('gallery');
  });
});

// ──────────────────────────────────────────────────────────────
// 1d. App.tsx wiring — signed-in shell compact, bare/transient prominent
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-001 — App.tsx wires compact only on the signed-in shell masthead', () => {
  const appTsx = read('App.tsx');

  it('the navSlot-bearing (signed-in shell) AppHeader passes compact', () => {
    // The signed-in shell masthead is the AppHeader that carries the
    // AppPrimaryNav navSlot. It must carry `compact`.
    expect(appTsx).toMatch(
      /<AppHeader[\s\S]*?compact[\s\S]*?navSlot=\{[\s\S]*?<AppPrimaryNav/,
    );
  });

  it('the bare/transient AppHeader (unconfigured / invite / callback) does NOT pass compact', () => {
    // The transient masthead is the AppHeader rendered with rightSlot only
    // (no navSlot) and must stay prominent.
    expect(appTsx).toMatch(
      /<AppHeader onHomePress=\{handleHomePress\} rightSlot=\{preferencesTrigger\} \/>/,
    );
  });

  it('exactly one AppHeader site in App.tsx carries compact', () => {
    const compactSites = (appTsx.match(/<AppHeader\b[\s\S]*?\/>/g) ?? []).filter((s) =>
      /\bcompact\b/.test(s),
    );
    expect(compactSites.length).toBe(1);
  });

  it('AuthScreen does not import or render AppHeader (Sign In hero untouched)', () => {
    const auth = read('src/features/auth/AuthScreen.tsx');
    // No import of AppHeader and no <AppHeader> JSX element. (A bare comment
    // mention of "AppHeader" is allowed and present at the top of the file.)
    // Scan import statements line-by-line so a comment word never trips it.
    const importLines = auth
      .split('\n')
      .filter((l) => /^\s*import\b/.test(l));
    for (const line of importLines) {
      expect(line).not.toMatch(/\bAppHeader\b/);
    }
    expect(auth).not.toMatch(/<AppHeader\b/);
  });
});

// ──────────────────────────────────────────────────────────────
// 1e. Sign In / AuthScreen copy intact (QUICK-COPY-001 deferrals hold)
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-001 — logged-out Sign In copy intact', () => {
  const auth = read('src/features/auth/AuthScreen.tsx');

  it('the primary high-trust tagline fixture is present and wired into AuthScreen', () => {
    expect(PRIMARY_TAGLINE).toBe('A high-trust room for hard conversations.');
    expect(AUTH_FIRST_RUN_COPY.tagline).toBe(PRIMARY_TAGLINE);
    expect(auth).toContain('AUTH_FIRST_RUN_COPY');
    expect(auth).toContain('auth-value-prop');
  });

  it('the three-beat subline + mediator footer remain absent (QUICK-COPY-001)', () => {
    // Assert against the actual exported copy object, not raw source text
    // (the file's doc comment legitimately names the removed keys).
    const keys = Object.keys(AUTH_FIRST_RUN_COPY);
    expect(keys.sort()).toEqual(['brand', 'tagline']);
    expect(keys).not.toContain('subline');
    expect(keys).not.toContain('mediatorFooter');
  });
});

// ──────────────────────────────────────────────────────────────
// 2. ArgumentScoreTracker — de-game copy ("Mediator readout")
// ──────────────────────────────────────────────────────────────

const TRENDS: ParticipantTrend[] = [
  {
    participantId: 'p1',
    participantLabel: 'For side',
    messageCount: 3,
    currentBand: 'pretty_right',
    previousBand: 'neutral',
    trendDirection: 'up',
    averageScore: 0.4,
    averageTone: 0.2,
    averageTemperature: 0.3,
    sparkline: [0.1, 0.4, 0.6],
    lastMoveLabel: 'rebuttal',
    color: '#10b981',
  },
];

const COPY_BAN = [
  'gameplay analysis',
  'gameplay',
  'points stand',
  'score',
  'scoreboard',
  'ranking',
  'leaderboard',
  'winner',
  'loser',
];

describe('UX-ROOM-CHROME-001 — ArgumentScoreTracker reads "Mediator readout"', () => {
  it('renders the "Mediator readout" title with a matching aria label', () => {
    const { getByText, getByTestId } = render(<ArgumentScoreTracker trends={TRENDS} />);
    expect(getByTestId('argument-score-tracker')).toBeTruthy();
    const title = getByText('Mediator readout');
    expect(title).toBeTruthy();
    expect(title.props.accessibilityLabel).toBe('mediator readout');
  });

  it('does NOT render any game-scoreboard token in its visible output (case-insensitive)', () => {
    const { toJSON } = render(<ArgumentScoreTracker trends={TRENDS} />);
    // Collect every rendered string from the tree.
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
    expect(haystack).toContain('mediator readout');
    for (const banned of COPY_BAN) {
      expect(haystack).not.toContain(banned);
    }
  });

  it('source no longer carries the retired "Where the points stand · gameplay analysis" label', () => {
    const src = read('src/features/arguments/ArgumentScoreTracker.tsx');
    // Visible <Text> body must be the new label.
    expect(src).toMatch(/>Mediator readout</);
    // The retired label must not appear as a visible <Text> body.
    expect(src).not.toMatch(/>Where the points stand · gameplay analysis</);
    // testID + component name preserved (rename deferred).
    expect(src).toContain('testID="argument-score-tracker"');
    expect(src).toMatch(/export function ArgumentScoreTracker/);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. Regression — RoomBoardLayout / mediator surfaces untouched
// ──────────────────────────────────────────────────────────────

describe('UX-ROOM-CHROME-001 — out-of-scope surfaces are untouched', () => {
  it('the dedicated topology suite (uxBoardRail002Topology) source is present (runs the real board regression)', () => {
    expect(fs.existsSync(path.join(REPO, '__tests__/uxBoardRail002Topology.test.tsx'))).toBe(true);
  });

  it('ArgumentScoreTracker still imports only standingBand copy + the score model (no new deps)', () => {
    const src = read('src/features/arguments/ArgumentScoreTracker.tsx');
    expect(src).toMatch(/from '\.\/argumentScoreModel'/);
    expect(src).toMatch(/from '\.\/standingBandCopy'/);
    // No new asset import was added to the header for the compact variant.
    const header = read('src/components/AppHeader.tsx');
    const requires = header.match(/require\([^)]*\)/g) ?? [];
    expect(requires.length).toBe(1); // only DEFAULT_LOGO
    expect(requires[0]).toMatch(/civic-discourse-logo\.png/);
  });
});
