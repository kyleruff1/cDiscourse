/**
 * NAV-START-ARGUMENT-001 Slice B — global header navigation tests.
 *
 * Covers the §4 acceptance contract:
 *   - A regular (non-admin) user sees the primary header nav: Start An
 *     Argument · Browse Arguments · My Arguments · Profile · About
 *     CivilDiscourse.
 *   - Admin AND Debug are HIDDEN from regular users (gate preserved); an
 *     admin/moderator user DOES see Admin + Debug (gate preserved).
 *   - Active-section styling is applied (accessibilityState.selected).
 *   - Each nav item is a real button (role=button, >= 44x44 tap target).
 *   - Tapping a nav item drives the expected in-memory shell-state
 *     transition (the pure resolvePrimaryNavTransition model — NO router).
 *   - The public header renders NO Admin / Debug / classifier-health /
 *     H-I-J / routing / production labels for regular users.
 *   - No-route invariant: the model + components import no router.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { AppPrimaryNav, APP_COPYRIGHT_TEXT } from '../src/features/navigation/AppPrimaryNav';
import {
  PRIMARY_NAV_ORDER,
  PRIMARY_NAV_LABELS,
  FORBIDDEN_PUBLIC_NAV_TOKENS,
  deriveActivePrimaryNavSection,
  resolvePrimaryNavTransition,
  type PrimaryNavSection,
} from '../src/features/navigation/appPrimaryNavModel';
import { getVisibleTabs } from '../src/features/arguments/roomNavigation';

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

function renderNav(active: PrimaryNavSection = 'browse_arguments', onNavigate = jest.fn()) {
  return render(
    <AppPrimaryNav activeSection={active} onNavigate={onNavigate} bandOverride="wide" />,
  );
}

// ──────────────────────────────────────────────────────────────
// 1. Regular user sees all primary nav items + About
// ──────────────────────────────────────────────────────────────

describe('AppPrimaryNav — regular user sees the primary nav', () => {
  it('renders Start An Argument', () => {
    const { getByText } = renderNav();
    expect(getByText('Start An Argument')).toBeTruthy();
  });

  it('renders Browse Arguments', () => {
    const { getByText } = renderNav();
    expect(getByText('Browse Arguments')).toBeTruthy();
  });

  it('renders My Arguments', () => {
    const { getByText } = renderNav();
    expect(getByText('My Arguments')).toBeTruthy();
  });

  it('renders Profile', () => {
    const { getByText } = renderNav();
    expect(getByText('Profile')).toBeTruthy();
  });

  it('renders About CivilDiscourse (upper-right, public)', () => {
    const { getByText, getByTestId } = renderNav();
    expect(getByText('About CivilDiscourse')).toBeTruthy();
    expect(getByTestId('app-primary-nav-about')).toBeTruthy();
  });

  it('renders the lower-right copyright / site mark', () => {
    const { getByTestId } = renderNav();
    expect(getByTestId('app-primary-nav-copyright').props.children).toBe(APP_COPYRIGHT_TEXT);
  });
});

// ──────────────────────────────────────────────────────────────
// 2. Admin AND Debug are HIDDEN from regular users in the public header
// ──────────────────────────────────────────────────────────────

describe('AppPrimaryNav — Admin / Debug never appear in the public header', () => {
  it('the rendered header text contains no "Admin" or "Debug"', () => {
    const { queryByText } = renderNav();
    expect(queryByText('Admin')).toBeNull();
    expect(queryByText('Debug')).toBeNull();
  });

  it('no primary nav section is "admin" or "debug"', () => {
    expect(PRIMARY_NAV_ORDER).not.toContain('admin' as unknown as PrimaryNavSection);
    expect(PRIMARY_NAV_ORDER).not.toContain('debug' as unknown as PrimaryNavSection);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. Admin/Debug gate is PRESERVED (getVisibleTabs unchanged)
// ──────────────────────────────────────────────────────────────

describe('Admin / Debug role gate is preserved (getVisibleTabs)', () => {
  it('a regular (null role) user does NOT get the admin tab, even in dev', () => {
    expect(getVisibleTabs(null, true)).not.toContain('admin');
  });

  it('a regular user (non-dev) gets neither admin nor debug', () => {
    const tabs = getVisibleTabs('user', false);
    expect(tabs).not.toContain('admin');
    expect(tabs).not.toContain('debug');
    expect(tabs).toEqual(['arguments', 'account']);
  });

  it('an admin user DOES get the admin tab', () => {
    expect(getVisibleTabs('admin', false)).toContain('admin');
  });

  it('the debug tab is gated on dev, not on the public header', () => {
    expect(getVisibleTabs('admin', true)).toContain('debug');
    expect(getVisibleTabs('admin', false)).not.toContain('debug');
  });
});

// ──────────────────────────────────────────────────────────────
// 4. Active-section styling (accessibilityState.selected)
// ──────────────────────────────────────────────────────────────

describe('AppPrimaryNav — active section styling', () => {
  it('the active item carries accessibilityState.selected = true', () => {
    const { getByTestId } = renderNav('my_arguments');
    const item = getByTestId('app-primary-nav-item-my_arguments');
    expect(item.props.accessibilityState).toEqual({ selected: true });
  });

  it('a non-active item carries accessibilityState.selected = false', () => {
    const { getByTestId } = renderNav('my_arguments');
    const item = getByTestId('app-primary-nav-item-browse_arguments');
    expect(item.props.accessibilityState).toEqual({ selected: false });
  });

  it('the active item applies the active border style (not color-only)', () => {
    const { getByTestId } = renderNav('start_argument');
    const item = getByTestId('app-primary-nav-item-start_argument');
    const style = flattenStyle(item.props.style);
    // Active state is carried by a visible border (shape/stroke), not by
    // color alone — survives a grayscale snapshot.
    expect(style.borderColor).not.toBe('transparent');
  });

  it('About reflects the selected state when it is the active section', () => {
    const { getByTestId } = renderNav('about');
    const about = getByTestId('app-primary-nav-about');
    expect(about.props.accessibilityState).toEqual({ selected: true });
  });
});

// ──────────────────────────────────────────────────────────────
// 5. Each nav item is a real button with a >= 44x44 tap target
// ──────────────────────────────────────────────────────────────

describe('AppPrimaryNav — real buttons, 44x44 tap target', () => {
  it.each([...PRIMARY_NAV_ORDER, 'about'] as PrimaryNavSection[])(
    '%s item has accessibilityRole="button"',
    (section) => {
      const testID = section === 'about' ? 'app-primary-nav-about' : `app-primary-nav-item-${section}`;
      const { getByTestId } = renderNav();
      expect(getByTestId(testID).props.accessibilityRole).toBe('button');
    },
  );

  it.each([...PRIMARY_NAV_ORDER, 'about'] as PrimaryNavSection[])(
    '%s item meets the 44x44 tap target (minHeight/minWidth + hitSlop)',
    (section) => {
      const testID = section === 'about' ? 'app-primary-nav-about' : `app-primary-nav-item-${section}`;
      const { getByTestId } = renderNav();
      const item = getByTestId(testID);
      const style = flattenStyle(item.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
      // hitSlop is present so even the visual minimum clears 44.
      expect(item.props.hitSlop).toBeTruthy();
    },
  );

  it('every item has a non-empty accessibilityLabel', () => {
    const { getByTestId } = renderNav();
    for (const section of PRIMARY_NAV_ORDER) {
      const item = getByTestId(`app-primary-nav-item-${section}`);
      expect(String(item.props.accessibilityLabel).length).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 6. Tapping a nav item drives the expected in-memory transition
// ──────────────────────────────────────────────────────────────

describe('AppPrimaryNav — tapping drives the expected section (no router)', () => {
  it.each(PRIMARY_NAV_ORDER)('tapping %s calls onNavigate with that section', (section) => {
    const onNavigate = jest.fn();
    const { getByTestId } = renderNav('browse_arguments', onNavigate);
    fireEvent.press(getByTestId(`app-primary-nav-item-${section}`));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(section);
  });

  it('tapping About calls onNavigate("about")', () => {
    const onNavigate = jest.fn();
    const { getByTestId } = renderNav('browse_arguments', onNavigate);
    fireEvent.press(getByTestId('app-primary-nav-about'));
    expect(onNavigate).toHaveBeenCalledWith('about');
  });
});

describe('resolvePrimaryNavTransition — in-memory shell state per item', () => {
  it('Start An Argument → Arguments tab, Start page open, room deselected', () => {
    const t = resolvePrimaryNavTransition('start_argument');
    expect(t.tab).toBe('arguments');
    expect(t.startArgumentOpen).toBe(true);
    expect(t.aboutOpen).toBe(false);
    expect(t.deselectRoom).toBe(true);
  });

  it('Browse Arguments → Arguments tab, full gallery (all lanes)', () => {
    const t = resolvePrimaryNavTransition('browse_arguments');
    expect(t.tab).toBe('arguments');
    expect(t.startArgumentOpen).toBe(false);
    expect(t.galleryLane).toBe('all');
    expect(t.aboutOpen).toBe(false);
  });

  it('My Arguments → Arguments tab, "my_rooms" lane', () => {
    const t = resolvePrimaryNavTransition('my_arguments');
    expect(t.tab).toBe('arguments');
    expect(t.galleryLane).toBe('my_rooms');
    expect(t.startArgumentOpen).toBe(false);
  });

  it('Profile → Account tab', () => {
    const t = resolvePrimaryNavTransition('profile');
    expect(t.tab).toBe('account');
    expect(t.aboutOpen).toBe(false);
  });

  it('About → About screen open, room deselected', () => {
    const t = resolvePrimaryNavTransition('about');
    expect(t.aboutOpen).toBe(true);
    expect(t.deselectRoom).toBe(true);
  });

  it('every transition deselects the open room (always returns to a top-level surface)', () => {
    for (const section of [...PRIMARY_NAV_ORDER, 'about'] as PrimaryNavSection[]) {
      expect(resolvePrimaryNavTransition(section).deselectRoom).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 7. deriveActivePrimaryNavSection (active-section derivation)
// ──────────────────────────────────────────────────────────────

describe('deriveActivePrimaryNavSection', () => {
  const base = {
    tab: 'arguments',
    hasDebate: false,
    startArgumentOpen: false,
    galleryLane: 'all',
    aboutOpen: false,
  };

  it('About open wins over everything', () => {
    expect(deriveActivePrimaryNavSection({ ...base, aboutOpen: true })).toBe('about');
  });

  it('Account tab → profile', () => {
    expect(deriveActivePrimaryNavSection({ ...base, tab: 'account' })).toBe('profile');
  });

  it('Arguments tab + Start page open → start_argument', () => {
    expect(deriveActivePrimaryNavSection({ ...base, startArgumentOpen: true })).toBe('start_argument');
  });

  it('Arguments tab + my_rooms lane → my_arguments', () => {
    expect(deriveActivePrimaryNavSection({ ...base, galleryLane: 'my_rooms' })).toBe('my_arguments');
  });

  it('Arguments tab, gallery default → browse_arguments', () => {
    expect(deriveActivePrimaryNavSection(base)).toBe('browse_arguments');
  });

  it('an open room keeps browse_arguments active (reached from the gallery)', () => {
    expect(deriveActivePrimaryNavSection({ ...base, hasDebate: true })).toBe('browse_arguments');
  });
});

// ──────────────────────────────────────────────────────────────
// 8. The public header renders NO restricted / verdict labels
// ──────────────────────────────────────────────────────────────

describe('AppPrimaryNav — no restricted or verdict labels for regular users', () => {
  it('every rendered nav label is free of forbidden public tokens', () => {
    const labels = [
      ...PRIMARY_NAV_ORDER.map((s) => PRIMARY_NAV_LABELS[s]),
      PRIMARY_NAV_LABELS.about,
      APP_COPYRIGHT_TEXT,
    ];
    for (const label of labels) {
      const lower = label.toLowerCase();
      for (const banned of FORBIDDEN_PUBLIC_NAV_TOKENS) {
        expect(lower).not.toContain(banned.toLowerCase());
      }
    }
  });

  it('the component source never references Admin / Debug / classifier / routing surfaces', () => {
    // Strip comment lines first: the doc comment legitimately NAMES these
    // surfaces to explain that the public header does NOT render them. The
    // scan asserts no EXECUTABLE reference reaches them.
    const src = read('src/features/navigation/AppPrimaryNav.tsx');
    const codeOnly = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    const lower = codeOnly.toLowerCase();
    for (const banned of [
      'admin',
      'debug',
      'classifier',
      'classifier-health',
      'family h',
      'family i',
      'family j',
      'routing',
      'production family',
      'service_role',
      'service role',
    ]) {
      expect(lower).not.toContain(banned);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 9. No-route invariant — model + component import no router
// ──────────────────────────────────────────────────────────────

describe('NAV-START-ARGUMENT-001 Slice B — no router import', () => {
  const FILES = [
    'src/features/navigation/appPrimaryNavModel.ts',
    'src/features/navigation/AppPrimaryNav.tsx',
    'src/features/navigation/AboutScreen.tsx',
    'src/features/navigation/index.ts',
  ];

  it.each(FILES)('%s imports no navigation library', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/from\s+['"]@react-navigation\//);
    expect(src).not.toMatch(/from\s+['"]expo-router['"]/);
    expect(src).not.toMatch(/from\s+['"]react-router(?:-native|-dom)?['"]/);
  });

  it.each(FILES)('%s contains no router/navigation method calls', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/\bnavigation\.navigate\s*\(/);
    expect(src).not.toMatch(/\brouter\.push\s*\(/);
    expect(src).not.toMatch(/useNavigation\s*\(/);
    expect(src).not.toMatch(/Linking\.openURL/);
  });
});
