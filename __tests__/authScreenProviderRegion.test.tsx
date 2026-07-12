/**
 * UX-COPY-BATCH-002 (#740 / #760) — AuthScreen provider-region render tests.
 *
 * The headline guard: the DEFAULT Sign In surface renders NO enabled provider
 * button (email-only default; Google config not live) and pressing nothing on
 * the provider region can ever reach a provider. Email/password sign-in still
 * works byte-identically. No Facebook / Apple. The future-framed "coming soon"
 * notice + divider render above the unchanged email form.
 *
 * The supabase mock exposes signInWithPassword (the email path) AND a
 * signInWithOAuth jest.fn that MUST stay at 0 calls — any accidental provider
 * call is caught.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockSignInWithPassword = jest.fn().mockResolvedValue({
  data: { user: { id: 'u1', email: 'a@b.com' } },
  error: null,
});
const mockSignInWithOAuth = jest.fn(); // MUST stay at 0 direct calls from the component
const mockSignUp = jest.fn().mockResolvedValue({
  data: { user: { id: 'u1', email: 'a@b.com' } },
  error: null,
});
// AUTH-GOOGLE-SSO-003 (#746) — mutable runtime-env so the enabled-state describe
// can flip the public flag ON while the default-OFF tests keep seeing `{}`.
const mockRuntimeEnv: { value: Record<string, unknown> } = { value: {} };
// The gated provider button's onPress goes through this wrapper, NOT
// supabase.auth.signInWithOAuth directly from the component.
const mockSignInWithGoogle = jest.fn().mockResolvedValue({ ok: true });

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a: unknown[]) => mockSignInWithPassword(...a),
      signInWithOAuth: (...a: unknown[]) => mockSignInWithOAuth(...a),
      signUp: (...a: unknown[]) => mockSignUp(...a),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
  get SUPABASE_CONFIGURED() {
    return true;
  },
  readRuntimeEnv: () => mockRuntimeEnv.value,
}));

jest.mock('../src/features/auth/signInWithGoogle', () => ({
  signInWithGoogle: (...a: unknown[]) => mockSignInWithGoogle(...a),
}));

import { AuthScreen } from '../src/features/auth/AuthScreen';
import {
  PROVIDER_UNAVAILABLE_COPY,
  PROVIDER_SSO_DIVIDER_LABEL,
  CONTINUE_WITH_GOOGLE_LABEL,
} from '../src/features/auth/authProviderSlotModel';
import { GOOGLE_AUTH_ENABLED_FLAG } from '../src/features/auth/googleAuthGate';

beforeEach(() => {
  mockSignInWithPassword.mockClear();
  mockSignInWithOAuth.mockClear();
  mockSignUp.mockClear();
  mockSignInWithGoogle.mockClear();
  // Default OFF: flag unset → gate returns false → email-only surface.
  mockRuntimeEnv.value = {};
});

describe('UX-COPY-BATCH-002 — AuthScreen default surface (email-only)', () => {
  it('renders the provider-slot region', () => {
    const { getByTestId } = render(<AuthScreen />);
    expect(getByTestId('auth-provider-slot-region')).toBeTruthy();
  });

  it('renders the future-framed "coming soon" notice, NOT an enabled provider button', () => {
    const { getByTestId, queryByTestId } = render(<AuthScreen />);
    const notice = getByTestId('auth-provider-unavailable');
    expect(notice.props.children).toBe(PROVIDER_UNAVAILABLE_COPY);
    // No future-lit provider button wrapper is mounted in the default path.
    expect(queryByTestId('auth-provider-region')).toBeNull();
  });

  it('renders NO clickable Google affordance (no button labeled Continue with Google)', () => {
    const { queryByText, queryByLabelText } = render(<AuthScreen />);
    expect(queryByText('Continue with Google')).toBeNull();
    expect(queryByLabelText('Continue with Google')).toBeNull();
  });

  it('renders NO Facebook and NO Apple affordance', () => {
    const { queryByText } = render(<AuthScreen />);
    expect(queryByText(/facebook/i)).toBeNull();
    expect(queryByText(/apple/i)).toBeNull();
  });

  it('renders the "or continue with SSO" divider (plain text, not interactive)', () => {
    const { getByTestId, getByText } = render(<AuthScreen />);
    const divider = getByTestId('auth-provider-divider');
    expect(divider).toBeTruthy();
    const label = getByText(PROVIDER_SSO_DIVIDER_LABEL);
    expect(PROVIDER_SSO_DIVIDER_LABEL).toBe('or continue with SSO');
    // The divider label is plain Text (role text), never a button.
    expect(label.props.accessibilityRole).not.toBe('button');
  });
});

describe('AUTH-GOOGLE-SSO-LAYOUT-001 (#780) — email-first render order', () => {
  // Collect every node identifier (testID, else accessibilityLabel) in document
  // (pre-order) order from the rendered tree, so we can assert relative
  // position: email form + Sign In button come BEFORE the SSO divider + region.
  const collectOrderedMarkers = (node: unknown, acc: string[]): string[] => {
    if (node == null) return acc;
    if (Array.isArray(node)) {
      for (const child of node) collectOrderedMarkers(child, acc);
      return acc;
    }
    if (typeof node === 'object') {
      const el = node as { props?: Record<string, unknown>; children?: unknown };
      const props = el.props ?? {};
      const marker =
        (typeof props.testID === 'string' && props.testID) ||
        (typeof props.accessibilityLabel === 'string' && props.accessibilityLabel) ||
        null;
      if (marker) acc.push(marker);
      if (props.children !== undefined) collectOrderedMarkers(props.children, acc);
      else if (el.children !== undefined) collectOrderedMarkers(el.children, acc);
    }
    return acc;
  };

  it('renders the SSO divider + provider region AFTER the email Sign In button (default surface)', () => {
    const { toJSON } = render(<AuthScreen />);
    const markers = collectOrderedMarkers(toJSON(), []);
    const signInIdx = markers.indexOf('Sign In');
    const dividerIdx = markers.indexOf('auth-provider-divider');
    const regionIdx = markers.indexOf('auth-provider-slot-region');
    expect(signInIdx).toBeGreaterThanOrEqual(0);
    expect(dividerIdx).toBeGreaterThanOrEqual(0);
    expect(regionIdx).toBeGreaterThanOrEqual(0);
    // Email-first: the email Sign In button precedes the SSO divider + region.
    expect(signInIdx).toBeLessThan(dividerIdx);
    expect(dividerIdx).toBeLessThan(regionIdx);
  });

  it('renders the Sign-up toggle as the LAST interactive element (after the SSO region)', () => {
    const { toJSON } = render(<AuthScreen />);
    const markers = collectOrderedMarkers(toJSON(), []);
    const regionIdx = markers.indexOf('auth-provider-slot-region');
    const signUpToggleIdx = markers.indexOf("Don't have an account? Sign up");
    expect(regionIdx).toBeGreaterThanOrEqual(0);
    expect(signUpToggleIdx).toBeGreaterThanOrEqual(0);
    // The Sign-up toggle is the very last element — after the SSO region.
    expect(signUpToggleIdx).toBeGreaterThan(regionIdx);
  });
});

describe('UX-COPY-BATCH-002 — AuthScreen never reaches a provider', () => {
  it('rendering the default surface never calls signInWithOAuth', () => {
    render(<AuthScreen />);
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });
});

describe('UX-COPY-BATCH-002 — AuthScreen email/password still works', () => {
  it('filling email + password and pressing Sign In calls signInWithPassword once', async () => {
    const { getByLabelText } = render(<AuthScreen />);
    fireEvent.changeText(getByLabelText('Email'), 'user@example.com');
    fireEvent.changeText(getByLabelText('Password'), 'hunter2');
    await act(async () => {
      fireEvent.press(getByLabelText('Sign In'));
    });
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'hunter2',
    });
    // The email path never touched any provider method.
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });
});

describe('AUTH-GOOGLE-SSO-003 (#746) — enabled state', () => {
  // Strategy (a): force the REAL gate ON by setting the runtime-env shim flag to
  // 'true' (SUPABASE_CONFIGURED is already true in this suite's supabase mock).
  beforeEach(() => {
    mockRuntimeEnv.value = { [GOOGLE_AUTH_ENABLED_FLAG]: 'true' };
  });

  it('renders the official Google "Continue with Google" button (by testID, a11y label, and image)', () => {
    // AUTH-GOOGLE-SSO-BRAND-001 (#778) — the affordance is now the official
    // Google button IMAGE inside a Pressable. The "Continue with Google" text is
    // baked into the image, so it is NO LONGER a queryable Text node — the
    // accessible name lives on the Pressable's accessibilityLabel and the image
    // renders under its own testID.
    const { getByTestId, getByLabelText } = render(<AuthScreen />);
    expect(getByTestId('auth-provider-google-button')).toBeTruthy();
    expect(getByLabelText(CONTINUE_WITH_GOOGLE_LABEL)).toBeTruthy();
    expect(getByLabelText('Continue with Google')).toBeTruthy();
    // The official Google button image renders inside the Pressable.
    expect(getByTestId('auth-provider-google-icon')).toBeTruthy();
  });

  it('does NOT render the provider-unavailable "coming soon" notice when enabled', () => {
    const { queryByTestId, queryByText } = render(<AuthScreen />);
    expect(queryByTestId('auth-provider-unavailable')).toBeNull();
    expect(queryByText(PROVIDER_UNAVAILABLE_COPY)).toBeNull();
  });

  it('pressing the Google button calls the signInWithGoogle wrapper, NOT signInWithOAuth directly', async () => {
    const { getByTestId } = render(<AuthScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('auth-provider-google-button'));
    });
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });
    // The component goes THROUGH the wrapper; it never calls the supabase
    // provider method directly.
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it('UX-PR-B (#918) — a failed Google sign-in surfaces the wrapper message in the ErrorNotice', async () => {
    mockSignInWithGoogle.mockResolvedValueOnce({
      ok: false,
      error: 'provider',
      message: 'Google sign-in is not enabled.',
    });
    const { getByTestId, queryByText } = render(<AuthScreen />);
    expect(queryByText('Google sign-in is not enabled.')).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId('auth-provider-google-button'));
    });
    await waitFor(() => {
      expect(queryByText('Google sign-in is not enabled.')).toBeTruthy();
    });
  });

  it('UX-PR-B (#918) — a successful Google initiation surfaces NO error', async () => {
    mockSignInWithGoogle.mockResolvedValueOnce({ ok: true });
    const { getByTestId, queryByText } = render(<AuthScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('auth-provider-google-button'));
    });
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });
    // On success the browser redirects away — nothing to show, no error notice.
    expect(queryByText('Google sign-in is not enabled.')).toBeNull();
  });

  it('email/password still works in the enabled state', async () => {
    const { getByLabelText } = render(<AuthScreen />);
    fireEvent.changeText(getByLabelText('Email'), 'user@example.com');
    fireEvent.changeText(getByLabelText('Password'), 'hunter2');
    await act(async () => {
      fireEvent.press(getByLabelText('Sign In'));
    });
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'hunter2',
    });
  });

  it('renders NO Facebook and NO Apple affordance even when Google is enabled', () => {
    const { queryByText } = render(<AuthScreen />);
    expect(queryByText(/facebook/i)).toBeNull();
    expect(queryByText(/apple/i)).toBeNull();
  });

  it('renders the Google affordance as a Pressable (role=button, named, 44px tap target)', () => {
    // AUTH-GOOGLE-SSO-BRAND-001 (#778) — the affordance is a Pressable wrapping
    // the official Google image. The Pressable carries the button role + the
    // accessible name; the minHeight:44 + hitSlop keep the tap target at floor
    // even though the visible image is 48 tall.
    const { getByTestId } = render(<AuthScreen />);
    const button = getByTestId('auth-provider-google-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(CONTINUE_WITH_GOOGLE_LABEL);
    const flatStyle = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style)
      : button.props.style;
    expect(flatStyle.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('the Google button image is decorative (not separately announced) — name is on the Pressable', () => {
    // The official asset has its text baked in; exposing the image to screen
    // readers would double-announce. The Pressable owns the accessible name.
    const { getByTestId } = render(<AuthScreen />);
    const icon = getByTestId('auth-provider-google-icon');
    expect(icon.props.accessible).toBe(false);
    // resizeMode="contain" guarantees the official proportions are never stretched.
    expect(icon.props.resizeMode).toBe('contain');
  });
});

describe('UX-COPY-BATCH-002 — source guards', () => {
  const ROOT = path.join(__dirname, '..');
  const authSource = fs.readFileSync(
    path.join(ROOT, 'src', 'features', 'auth', 'AuthScreen.tsx'),
    'utf8',
  );

  it('AuthScreen source contains no signInWithOAuth / OAuth references', () => {
    expect(authSource).not.toContain('signInWithOAuth');
    expect(authSource).not.toContain('signInWithIdToken');
    expect(authSource.toLowerCase()).not.toContain('oauth');
  });

  it('AuthScreen source renders no "Continue with" provider button literal', () => {
    expect(authSource).not.toContain('Continue with Google');
    expect(authSource).not.toContain('Continue with Facebook');
    expect(authSource).not.toContain('Continue with Apple');
  });

  it('signInWithOAuth appears ONLY in the dedicated wrapper under src/', () => {
    // AUTH-GOOGLE-SSO-003 (#746) — the provider call is now wired, so the guard
    // is a SINGLE-FILE allow-list (not loosened in spirit: exactly one file may
    // contain the call). Path separators are normalized for cross-platform.
    const SRC = path.join(ROOT, 'src');
    const ALLOW = [path.join('src', 'features', 'auth', 'signInWithGoogle.ts')];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          if (fs.readFileSync(full, 'utf8').includes('signInWithOAuth')) {
            const rel = path.relative(ROOT, full);
            if (!ALLOW.includes(rel)) offenders.push(rel);
          }
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });

  it('the dedicated wrapper actually contains the provider call (allow-list is not vacuous)', () => {
    const wrapper = fs.readFileSync(
      path.join(ROOT, 'src', 'features', 'auth', 'signInWithGoogle.ts'),
      'utf8',
    );
    expect(wrapper).toContain('signInWithOAuth');
  });
});
