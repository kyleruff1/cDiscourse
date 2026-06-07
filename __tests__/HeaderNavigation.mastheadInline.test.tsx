/**
 * NAV-HEADER-INLINE-001 — masthead-inline primary nav tests.
 *
 * (Refines NAV-START-ARGUMENT-001 Slice B / PR #527.)
 *
 * Operator feedback this card resolves:
 *   1. The primary nav must be a stylized bar rendered INSIDE the
 *      masthead/header region — sharing the AppHeader container with the
 *      large logo lockup — NOT a separate strip beneath the header.
 *   2. The admin's access to the OLD menu (the secondary tab row:
 *      Arguments · Account · Admin · Debug) must remain intact and
 *      reachable; regular users still never see Admin / Debug. The
 *      getVisibleTabs role gate is preserved byte-for-byte.
 *
 * §4 acceptance covered here:
 *   - The nav and the logo share ONE header container (structural proof
 *     it is in the masthead, not beneath it).
 *   - The nav is the stylized bar (panel background + outline, not plain
 *     stacked text buttons).
 *   - Each primary item is a real button with selected-state.
 *   - Admin reaches the old menu (getVisibleTabs gate preserved).
 *   - App.tsx wires the nav through AppHeader's `navSlot` (integration),
 *     not as a separate sibling strip, and keeps the secondary tab row.
 *   - No-route invariant: AppHeader + nav import no router.
 */
import React from 'react';
import { render, within } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { AppHeader } from '../src/components/AppHeader';
import { AppPrimaryNav, APP_COPYRIGHT_TEXT } from '../src/features/navigation/AppPrimaryNav';
import { PRIMARY_NAV_ORDER } from '../src/features/navigation/appPrimaryNavModel';
import { getVisibleTabs, TAB_LABELS } from '../src/features/arguments/roomNavigation';

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

/**
 * Render the integrated masthead the way MainAppShell mounts it: the
 * AppHeader hosts the primary nav via its `navSlot`. The `logoSource={null}`
 * exercises the wordmark-fallback path so the masthead renders without the
 * PNG require in the test environment.
 */
function renderMasthead(active: 'browse_arguments' | 'about' = 'browse_arguments') {
  return render(
    <AppHeader
      onHomePress={() => {}}
      logoSource={null as never}
      navSlot={
        <AppPrimaryNav
          activeSection={active}
          onNavigate={() => {}}
          bandOverride="wide"
        />
      }
    />,
  );
}

// ──────────────────────────────────────────────────────────────
// 1. The nav is INSIDE the masthead (shared header container)
// ──────────────────────────────────────────────────────────────

describe('NAV-HEADER-INLINE-001 — the primary nav renders IN the masthead', () => {
  it('the primary nav is a descendant of the AppHeader container (not a beneath-strip)', () => {
    const { getByTestId } = renderMasthead();
    const header = getByTestId('app-header');
    // within() scopes queries to the AppHeader subtree. Finding the nav
    // here proves it shares the header container with the logo lockup.
    const scoped = within(header);
    expect(scoped.getByTestId('app-primary-nav')).toBeTruthy();
  });

  it('the masthead exposes a dedicated nav slot region inside the header', () => {
    const { getByTestId } = renderMasthead();
    const header = getByTestId('app-header');
    const scoped = within(header);
    const navSlot = scoped.getByTestId('app-header-nav-slot');
    expect(navSlot).toBeTruthy();
    // The nav lives inside that slot.
    expect(within(navSlot).getByTestId('app-primary-nav')).toBeTruthy();
  });

  it('the logo lockup and the nav share the SAME header container', () => {
    const { getByTestId } = renderMasthead();
    const header = getByTestId('app-header');
    const scoped = within(header);
    // Both the brand lockup (home pressable / logo fallback) AND the nav
    // are descendants of the one AppHeader — i.e. one cohesive masthead.
    expect(scoped.getByTestId('app-header-home')).toBeTruthy();
    expect(scoped.getByTestId('app-primary-nav')).toBeTruthy();
  });

  it('the anchored tagline stays in the brand lockup (not floated into the nav)', () => {
    const { getByTestId } = renderMasthead();
    const home = getByTestId('app-header-home');
    // The tagline is a descendant of the brand lockup pressable, NOT of
    // the nav — so it stays anchored to the logo.
    expect(within(home).getByTestId('app-header-tagline')).toBeTruthy();
    const nav = getByTestId('app-primary-nav');
    expect(within(nav).queryByTestId('app-header-tagline')).toBeNull();
  });

  it('About + copyright render inside the nav bar, inside the masthead', () => {
    const { getByTestId } = renderMasthead();
    const header = getByTestId('app-header');
    const scoped = within(header);
    expect(scoped.getByTestId('app-primary-nav-about')).toBeTruthy();
    expect(scoped.getByTestId('app-primary-nav-copyright').props.children).toBe(
      APP_COPYRIGHT_TEXT,
    );
  });
});

// ──────────────────────────────────────────────────────────────
// 2. The nav is the STYLIZED bar (not plain stacked text buttons)
// ──────────────────────────────────────────────────────────────

describe('NAV-HEADER-INLINE-001 — the nav is a stylized bar', () => {
  it('the nav root has a panel background + outline (a real bar, not bare text)', () => {
    const { getByTestId } = renderMasthead();
    const root = getByTestId('app-primary-nav');
    const style = flattenStyle(root.props.style);
    // A background fill + a border = a discrete, polished bar surface.
    expect(style.backgroundColor).toBeTruthy();
    expect(style.borderWidth).toBeGreaterThanOrEqual(1);
    expect(style.borderColor).toBeTruthy();
  });

  it('the bar carries a bottom rule (stylized header-bar treatment)', () => {
    const { getByTestId } = renderMasthead();
    const root = getByTestId('app-primary-nav');
    const style = flattenStyle(root.props.style);
    // A heavier bottom edge gives the bar its anchored "nav bar" look.
    expect(style.borderBottomWidth).toBeGreaterThanOrEqual(1);
    expect(style.borderBottomColor).toBeTruthy();
  });

  it('the active item conveys selection by MORE than color (underline indicator + marker)', () => {
    const { getByTestId } = renderMasthead('browse_arguments');
    // The active item renders a leading ● marker so the selection is
    // grayscale-legible alongside the underline / weight cues.
    const active = getByTestId('app-primary-nav-item-browse_arguments');
    const markerTexts = within(active).getAllByText('●');
    expect(markerTexts.length).toBeGreaterThanOrEqual(1);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. Each primary item is a real button with selected state
// ──────────────────────────────────────────────────────────────

describe('NAV-HEADER-INLINE-001 — primary items are real buttons (in the masthead)', () => {
  it.each([...PRIMARY_NAV_ORDER, 'about'] as const)(
    '%s item is a button with a >=44x44 target inside the masthead',
    (section) => {
      const testID =
        section === 'about' ? 'app-primary-nav-about' : `app-primary-nav-item-${section}`;
      const { getByTestId } = renderMasthead();
      const header = getByTestId('app-header');
      const item = within(header).getByTestId(testID);
      expect(item.props.accessibilityRole).toBe('button');
      const style = flattenStyle(item.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
      expect(item.props.hitSlop).toBeTruthy();
    },
  );

  it('the active section carries accessibilityState.selected = true', () => {
    const { getByTestId } = renderMasthead('about');
    const about = getByTestId('app-primary-nav-about');
    expect(about.props.accessibilityState).toEqual({ selected: true });
  });
});

// ──────────────────────────────────────────────────────────────
// 4. Admin reaches the OLD menu; regular users never see Admin/Debug
//    (getVisibleTabs role gate preserved)
// ──────────────────────────────────────────────────────────────

describe('NAV-HEADER-INLINE-001 — admin keeps the old-menu access (gate preserved)', () => {
  it('an admin user gets Admin AND (in dev) Debug in the secondary tab row', () => {
    const tabs = getVisibleTabs('admin', true);
    expect(tabs).toContain('admin');
    expect(tabs).toContain('debug');
    // The Admin tab is reachable in ONE step from the secondary tab row.
    expect(TAB_LABELS.admin).toBe('Admin');
  });

  it('an admin user (non-dev) still gets Admin (Debug gated on dev only)', () => {
    const tabs = getVisibleTabs('admin', false);
    expect(tabs).toContain('admin');
    expect(tabs).not.toContain('debug');
  });

  it('a regular (null role) user never gets the Admin tab, even in dev (role gate)', () => {
    // Admin is ROLE-gated: a non-admin never sees it regardless of __DEV__.
    expect(getVisibleTabs(null, true)).not.toContain('admin');
    // Debug is DEV-gated (a developer affordance), not role-gated — the
    // production case below pins the "regular users see neither" guarantee.
  });

  it('a regular user in production (non-dev) sees NEITHER Admin nor Debug', () => {
    // The doctrine guarantee: regular users in a real build see only the
    // two public tabs — no Admin, no Debug.
    expect(getVisibleTabs('user', false)).toEqual(['arguments', 'account']);
    expect(getVisibleTabs(null, false)).toEqual(['arguments', 'account']);
  });

  it('the masthead primary nav never includes Admin or Debug for any user', () => {
    const { queryByText } = renderMasthead();
    expect(queryByText('Admin')).toBeNull();
    expect(queryByText('Debug')).toBeNull();
    // And no primary section is admin/debug.
    expect(PRIMARY_NAV_ORDER).not.toContain('admin' as never);
    expect(PRIMARY_NAV_ORDER).not.toContain('debug' as never);
  });
});

// ──────────────────────────────────────────────────────────────
// 5. App.tsx integration: nav wired through AppHeader.navSlot,
//    secondary tab row (old menu) still rendered + role-gated
// ──────────────────────────────────────────────────────────────

describe('NAV-HEADER-INLINE-001 — App.tsx integrates the nav into the masthead', () => {
  const APP_SRC = read('App.tsx');

  it('the primary nav is passed to AppHeader via the navSlot prop (in the masthead)', () => {
    // Structural proof the nav is mounted INSIDE the masthead, not as a
    // separate sibling strip: AppHeader receives navSlot={<AppPrimaryNav .../>}.
    expect(APP_SRC).toMatch(/navSlot=\{\s*[\s\S]*?<AppPrimaryNav/);
  });

  it('AppPrimaryNav is no longer rendered as a standalone sibling strip', () => {
    // The only AppPrimaryNav usage is inside the navSlot expression. A bare
    // `<AppPrimaryNav` directly under SafeAreaView (the old beneath-strip)
    // would appear as a self-closing top-level element; assert the nav is
    // nested under a navSlot rather than mounted on its own line at the
    // shell root. We check that every AppPrimaryNav mount is preceded by a
    // navSlot prop within the same JSX block.
    const matches = APP_SRC.match(/<AppPrimaryNav/g) ?? [];
    expect(matches.length).toBe(1);
    // The single mount sits inside a navSlot={...} expression.
    const navSlotBlock = APP_SRC.slice(
      APP_SRC.indexOf('navSlot='),
      APP_SRC.indexOf('navSlot=') + 200,
    );
    expect(navSlotBlock).toContain('<AppPrimaryNav');
  });

  it('the secondary (old-menu) tab row is still rendered + driven by getVisibleTabs', () => {
    // The role-gated tab row remains so admins keep one-step Admin access.
    expect(APP_SRC).toMatch(/testID="app-tab-bar"/);
    expect(APP_SRC).toMatch(/getVisibleTabs\(/);
    // The admin + debug tab branches remain in the body switch.
    expect(APP_SRC).toMatch(/activeTab === 'admin'/);
    expect(APP_SRC).toMatch(/activeTab === 'debug'/);
  });

  it('App.tsx imports no router / Linking (no-route invariant preserved)', () => {
    expect(APP_SRC).not.toMatch(/from 'expo-router'/);
    expect(APP_SRC).not.toMatch(/from '@react-navigation/);
    expect(APP_SRC).not.toMatch(/Linking\.openURL/);
  });
});

// ──────────────────────────────────────────────────────────────
// 6. getVisibleTabs is byte-for-byte unchanged (gate preserved)
// ──────────────────────────────────────────────────────────────

describe('NAV-HEADER-INLINE-001 — getVisibleTabs gate is byte-for-byte unchanged', () => {
  const SRC = read('src/features/arguments/roomNavigation.ts');

  it('the getVisibleTabs body is the exact preserved gate', () => {
    // Pin the gate verbatim so a future edit that loosens the role check
    // (e.g. dropping the role === "admin" guard) fails this test.
    expect(SRC).toContain(
      "export function getVisibleTabs(role: string | null | undefined, isDev: boolean): ArgumentRoomTab[] {\n" +
        "  const tabs: ArgumentRoomTab[] = ['arguments', 'account'];\n" +
        "  if (role === 'admin') tabs.push('admin');\n" +
        "  if (isDev) tabs.push('debug');\n" +
        "  return tabs;\n" +
        '}',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// 7. AppHeader masthead-with-nav source contract (no router, navSlot)
// ──────────────────────────────────────────────────────────────

describe('NAV-HEADER-INLINE-001 — AppHeader navSlot source contract', () => {
  const SRC = read('src/components/AppHeader.tsx');

  it('AppHeader accepts a navSlot prop', () => {
    expect(SRC).toMatch(/navSlot\??:/);
  });

  it('AppHeader renders the navSlot inside the header container', () => {
    expect(SRC).toMatch(/testID=['"]app-header-nav-slot['"]/);
    expect(SRC).toMatch(/\{navSlot\}/);
  });

  it('AppHeader imports no router / navigation library (no-route invariant)', () => {
    expect(SRC).not.toMatch(/from\s+['"]@react-navigation\//);
    expect(SRC).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(SRC).not.toMatch(/\bnavigation\.navigate\s*\(/);
    expect(SRC).not.toMatch(/Linking\.openURL/);
  });

  it('AppHeader preserves the prior testIDs (masthead structure intact)', () => {
    for (const id of [
      'app-header',
      'app-header-home',
      'app-header-tagline',
      'app-header-right-slot',
      'app-header-divider',
    ]) {
      expect(SRC).toContain(`testID="${id}"`);
    }
  });
});
