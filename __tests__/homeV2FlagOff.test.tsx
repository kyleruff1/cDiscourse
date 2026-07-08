/**
 * HOME-001 (#874) — home_v2 flag-off byte-identical proof (Decision 4).
 *
 * The home_v2 flag is read in EXACTLY ONE place — App.tsx — and controls only
 * (i) the galleryLane initial value and (ii) whether the ArgumentHome branch is
 * allowed to mount. With the flag unset:
 *   - the initial lane is 'all';
 *   - 'home' is never set by any code path;
 *   - therefore galleryLane === 'home' is never true, the ArgumentHome branch
 *     never mounts, and the existing gallery-with-toolbar landing renders
 *     byte-identically to today.
 *
 * App.tsx is a monolith shell (auth, live hooks) that the repo does NOT
 * render whole in unit tests — the App.tsx-level nav contracts use the
 * source-scan convention (see galleryLaneFilter.test.tsx). This proof therefore
 * combines: (A) the real accessor driving the initial-lane decision, (B) a
 * source-scan of the reversibility wiring, and (C) a rendered disjointness
 * proof that the flag-ON surface (ArgumentHome) introduces ZERO gallery-landing
 * chrome. Complementary: the existing galleryLaneFilter / HeaderNavigation.*
 * suites run unmodified and stay green with zero deltas (AC1).
 */
const mockReadRuntimeEnv = jest.fn<Record<string, unknown>, []>();
jest.mock('../src/lib/supabase', () => ({
  readRuntimeEnv: () => mockReadRuntimeEnv(),
}));

import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
import { isHomeV2Enabled, HOME_V2_FLAG } from '../src/lib/featureFlags';
import { ArgumentHome } from '../src/features/home';
import type { ArgumentHomeProps } from '../src/features/home';

const APP_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');

/** Mirrors App.tsx exactly: `useState(homeV2Enabled ? 'home' : 'all')`. */
function initialLane(): 'home' | 'all' {
  return isHomeV2Enabled() ? 'home' : 'all';
}

const savedEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  mockReadRuntimeEnv.mockReset();
  mockReadRuntimeEnv.mockReturnValue({});
  savedEnv[HOME_V2_FLAG] = process.env[HOME_V2_FLAG];
  delete process.env[HOME_V2_FLAG];
});
afterEach(() => {
  if (savedEnv[HOME_V2_FLAG] === undefined) delete process.env[HOME_V2_FLAG];
  else process.env[HOME_V2_FLAG] = savedEnv[HOME_V2_FLAG];
});

// ── A. The accessor drives the initial landing lane ─────────────

describe('HOME-001 — flag-off initial lane', () => {
  it('flag unset => isHomeV2Enabled() false => initial lane is "all" (gallery landing)', () => {
    expect(isHomeV2Enabled()).toBe(false);
    expect(initialLane()).toBe('all');
  });

  it('flag "true" => isHomeV2Enabled() true => initial lane is "home" (ArgumentHome landing)', () => {
    process.env[HOME_V2_FLAG] = 'true';
    expect(isHomeV2Enabled()).toBe(true);
    expect(initialLane()).toBe('home');
  });

  it('any non-"true" value keeps the gallery landing (default OFF)', () => {
    for (const v of ['', 'false', '1', 'TRUE', 'yes', ' true ']) {
      process.env[HOME_V2_FLAG] = v;
      expect(isHomeV2Enabled()).toBe(false);
      expect(initialLane()).toBe('all');
    }
  });
});

// ── B. App.tsx reversibility wiring (source-scan) ───────────────

describe('HOME-001 — App.tsx reversibility wiring', () => {
  it('reads the flag exactly once, at the nav owner', () => {
    expect(APP_SOURCE).toContain("import { isHomeV2Enabled } from './src/lib/featureFlags'");
    const reads = APP_SOURCE.match(/isHomeV2Enabled\(\)/g) || [];
    expect(reads).toHaveLength(1);
    expect(APP_SOURCE).toContain('const homeV2Enabled = isHomeV2Enabled();');
  });

  it('gates the initial lane value on the flag', () => {
    expect(APP_SOURCE).toMatch(/useState<[^>]*'home'>\(\s*homeV2Enabled \? 'home' : 'all',?\s*\)/);
  });

  it('mounts ArgumentHome ONLY when lane is home AND the flag is on', () => {
    expect(APP_SOURCE).toContain("galleryLane === 'home' && homeV2Enabled");
    expect(APP_SOURCE).toContain('<ArgumentHome');
  });

  it('guards the gallery-landing block so it never co-renders with home', () => {
    expect(APP_SOURCE).toContain("galleryLane !== 'home'");
  });

  it("never sets galleryLane to 'home' from any nav path (initial value is the only setter)", () => {
    expect(APP_SOURCE).not.toContain("setGalleryLane('home')");
  });
});

// ── C. Flag-ON surface is a disjoint subtree (no gallery chrome) ─

function homeProps(over: Partial<ArgumentHomeProps> = {}): ArgumentHomeProps {
  return {
    debates: [],
    argumentsByDebateId: {},
    currentUserId: 'me',
    isAdminViewer: false,
    notifications: [],
    unreadCount: 0,
    notificationsLoading: false,
    loading: false,
    error: null,
    onRefresh: jest.fn(),
    onOpen: jest.fn(),
    onStart: jest.fn(),
    onOpenFloor: jest.fn(),
    onOpenDemoCorridor: jest.fn(),
    onOpenNotificationDeepLink: jest.fn(),
    ...over,
  };
}

describe('HOME-001 — flag-on ArgumentHome subtree is disjoint from the gallery landing', () => {
  it('mounts argument-home and introduces NONE of the gallery-landing testIDs', () => {
    const { getByTestId, queryByTestId } = render(<ArgumentHome {...homeProps()} />);
    expect(getByTestId('argument-home')).toBeTruthy();
    for (const galleryTestId of [
      'conversation-gallery-screen',
      'open-notifications-trigger',
      'open-demo-corridor-trigger',
      'lane-chip-all',
      'gallery-new-room',
      'gallery-search-input',
    ]) {
      expect(queryByTestId(galleryTestId)).toBeNull();
    }
  });
});
