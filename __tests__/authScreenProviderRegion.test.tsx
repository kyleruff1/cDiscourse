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
const mockSignInWithOAuth = jest.fn(); // MUST stay at 0 calls
const mockSignUp = jest.fn().mockResolvedValue({
  data: { user: { id: 'u1', email: 'a@b.com' } },
  error: null,
});

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
  readRuntimeEnv: () => ({}),
}));

import { AuthScreen } from '../src/features/auth/AuthScreen';
import {
  PROVIDER_UNAVAILABLE_COPY,
  PROVIDER_EMAIL_DIVIDER_LABEL,
} from '../src/features/auth/authProviderSlotModel';

beforeEach(() => {
  mockSignInWithPassword.mockClear();
  mockSignInWithOAuth.mockClear();
  mockSignUp.mockClear();
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

  it('renders the "or continue with email" divider (plain text, not interactive)', () => {
    const { getByTestId, getByText } = render(<AuthScreen />);
    const divider = getByTestId('auth-provider-divider');
    expect(divider).toBeTruthy();
    const label = getByText(PROVIDER_EMAIL_DIVIDER_LABEL);
    // The divider label is plain Text (role text), never a button.
    expect(label.props.accessibilityRole).not.toBe('button');
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

  it('no signInWithOAuth anywhere under src/', () => {
    const SRC = path.join(ROOT, 'src');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          if (fs.readFileSync(full, 'utf8').includes('signInWithOAuth')) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
