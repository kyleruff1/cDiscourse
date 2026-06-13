/**
 * AUTH-CALLBACK-CONSUMER-001 — AuthCallbackScreen UI tests.
 *
 * The consumer is mocked to drive each derived state; the supabase mock backs
 * the real setInvitedUserPassword for the set-password path. Asserts the six
 * states, the set-password form (disabled-until-valid, secure, accessible),
 * URL-clearing on Continue/Return, the config-missing short-circuit, that no
 * token / raw code / snake_case leaks into the rendered tree, and a
 * source-scan for console / secrets.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockConsume = jest.fn();
const mockUpdateUser = jest.fn();
const mockSupabaseConfigured = { value: true };

jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { updateUser: (...args: unknown[]) => mockUpdateUser(...args) } },
  get SUPABASE_CONFIGURED() {
    return mockSupabaseConfigured.value;
  },
  readRuntimeEnv: () => ({}),
}));

jest.mock('../src/features/auth/consumeAuthCallback', () => ({
  consumeAuthCallback: (...args: unknown[]) => mockConsume(...args),
}));

import { AuthCallbackScreen } from '../src/features/auth/AuthCallbackScreen';
import { AUTH_CALLBACK_COPY } from '../src/features/auth/authCallbackCopy';

const INVITE_URL =
  'https://dev.cdiscourse.com/auth/callback#access_token=fake.aaa.bbb&refresh_token=fake-refresh&type=invite';

beforeEach(() => {
  mockConsume.mockReset();
  mockUpdateUser.mockReset();
  mockSupabaseConfigured.value = true;
});

function renderScreen(onDone: () => void = jest.fn()) {
  return render(<AuthCallbackScreen capturedUrl={INVITE_URL} onDone={onDone} />);
}

describe('AuthCallbackScreen — checking → accepted', () => {
  it('shows the checking state before the consume resolves', async () => {
    let resolve!: (v: unknown) => void;
    mockConsume.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('auth-callback-checking')).toBeTruthy();
    await act(async () => {
      resolve({ status: 'success' });
    });
    expect(queryByTestId('auth-callback-accepted')).toBeTruthy();
  });

  it('runs consume exactly once on mount', async () => {
    mockConsume.mockResolvedValue({ status: 'success' });
    const { findByTestId } = renderScreen();
    await findByTestId('auth-callback-accepted');
    expect(mockConsume).toHaveBeenCalledTimes(1);
  });

  it('success → accepted state with a Continue button', async () => {
    mockConsume.mockResolvedValue({ status: 'success' });
    const { findByTestId, getByLabelText } = renderScreen();
    await findByTestId('auth-callback-accepted');
    expect(getByLabelText(AUTH_CALLBACK_COPY.continueButton)).toBeTruthy();
  });

  it('already_session → accepted state (idempotent re-entry)', async () => {
    mockConsume.mockResolvedValue({ status: 'already_session' });
    const { findByTestId } = renderScreen();
    expect(await findByTestId('auth-callback-accepted')).toBeTruthy();
  });
});

describe('AuthCallbackScreen — set-password (needs_password)', () => {
  it('needs_password → set_password state with a password field', async () => {
    mockConsume.mockResolvedValue({ status: 'needs_password' });
    const { findByTestId, getByLabelText } = renderScreen();
    await findByTestId('auth-callback-set-password');
    expect(getByLabelText(AUTH_CALLBACK_COPY.setPasswordFieldLabel)).toBeTruthy();
  });

  it('the password input is secure and labelled', async () => {
    mockConsume.mockResolvedValue({ status: 'needs_password' });
    const { findByTestId, getByLabelText } = renderScreen();
    await findByTestId('auth-callback-set-password');
    const input = getByLabelText(AUTH_CALLBACK_COPY.setPasswordFieldLabel);
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.accessibilityLabel).toBe(AUTH_CALLBACK_COPY.setPasswordFieldLabel);
  });

  it('submit is disabled until the password is valid (accessibilityState)', async () => {
    mockConsume.mockResolvedValue({ status: 'needs_password' });
    const { findByTestId, getByLabelText } = renderScreen();
    await findByTestId('auth-callback-set-password');
    expect(
      getByLabelText(AUTH_CALLBACK_COPY.setPasswordSubmit).props.accessibilityState.disabled,
    ).toBe(true);
    await act(async () => {
      fireEvent.changeText(getByLabelText(AUTH_CALLBACK_COPY.setPasswordFieldLabel), 'longenough');
    });
    expect(
      getByLabelText(AUTH_CALLBACK_COPY.setPasswordSubmit).props.accessibilityState.disabled,
    ).toBe(false);
  });

  it('a valid submit calls setInvitedUserPassword(updateUser) and reaches password_set', async () => {
    mockConsume.mockResolvedValue({ status: 'needs_password' });
    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const { findByTestId, getByLabelText, queryByTestId } = renderScreen();
    await findByTestId('auth-callback-set-password');
    await act(async () => {
      fireEvent.changeText(getByLabelText(AUTH_CALLBACK_COPY.setPasswordFieldLabel), 'longenough');
    });
    await act(async () => {
      fireEvent.press(getByLabelText(AUTH_CALLBACK_COPY.setPasswordSubmit));
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'longenough' });
    await waitFor(() => expect(queryByTestId('auth-callback-password-set')).toBeTruthy());
  });

  it('a failed submit shows plain error copy and stays on set_password', async () => {
    mockConsume.mockResolvedValue({ status: 'needs_password' });
    mockUpdateUser.mockResolvedValue({ data: { user: null }, error: { message: 'kaboom' } });
    const { findByTestId, getByLabelText, getByText, queryByTestId } = renderScreen();
    await findByTestId('auth-callback-set-password');
    await act(async () => {
      fireEvent.changeText(getByLabelText(AUTH_CALLBACK_COPY.setPasswordFieldLabel), 'longenough');
    });
    await act(async () => {
      fireEvent.press(getByLabelText(AUTH_CALLBACK_COPY.setPasswordSubmit));
    });
    expect(getByText(AUTH_CALLBACK_COPY.setPasswordErrorGeneric)).toBeTruthy();
    expect(queryByTestId('auth-callback-set-password')).toBeTruthy();
  });

  it('does NOT submit while the password is too short', async () => {
    mockConsume.mockResolvedValue({ status: 'needs_password' });
    const { findByTestId, getByLabelText } = renderScreen();
    await findByTestId('auth-callback-set-password');
    await act(async () => {
      fireEvent.changeText(getByLabelText(AUTH_CALLBACK_COPY.setPasswordFieldLabel), 'abc');
    });
    await act(async () => {
      fireEvent.press(getByLabelText(AUTH_CALLBACK_COPY.setPasswordSubmit));
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe('AuthCallbackScreen — error states', () => {
  it('expired → error_expired with plain copy and a Return button', async () => {
    mockConsume.mockResolvedValue({ status: 'error', reason: 'expired' });
    const { findByTestId, getByText, getByLabelText } = renderScreen();
    await findByTestId('auth-callback-error-expired');
    expect(getByText(AUTH_CALLBACK_COPY.errorExpiredBody)).toBeTruthy();
    expect(getByLabelText(AUTH_CALLBACK_COPY.returnToSignInButton)).toBeTruthy();
  });

  it('link_invalid → error_generic', async () => {
    mockConsume.mockResolvedValue({ status: 'error', reason: 'link_invalid' });
    const { findByTestId } = renderScreen();
    expect(await findByTestId('auth-callback-error-generic')).toBeTruthy();
  });

  it('network → error_generic', async () => {
    mockConsume.mockResolvedValue({ status: 'error', reason: 'network' });
    const { findByTestId } = renderScreen();
    expect(await findByTestId('auth-callback-error-generic')).toBeTruthy();
  });

  it('unknown → error_generic', async () => {
    mockConsume.mockResolvedValue({ status: 'error', reason: 'unknown' });
    const { findByTestId } = renderScreen();
    expect(await findByTestId('auth-callback-error-generic')).toBeTruthy();
  });
});

describe('AuthCallbackScreen — config missing short-circuit', () => {
  it('renders error_generic and never calls consume when unconfigured', async () => {
    mockSupabaseConfigured.value = false;
    const { findByTestId } = renderScreen();
    await findByTestId('auth-callback-error-generic');
    expect(mockConsume).not.toHaveBeenCalled();
  });
});

describe('AuthCallbackScreen — URL clearing on Continue / Return', () => {
  it('Continue clears the URL via history.replaceState and calls onDone', async () => {
    const replaceState = jest.fn();
    (global as unknown as { window?: unknown }).window = {
      history: { replaceState },
      location: { href: INVITE_URL, pathname: '/auth/callback' },
    };
    try {
      mockConsume.mockResolvedValue({ status: 'success' });
      const onDone = jest.fn();
      const { findByTestId, getByLabelText } = renderScreen(onDone);
      await findByTestId('auth-callback-accepted');
      await act(async () => {
        fireEvent.press(getByLabelText(AUTH_CALLBACK_COPY.continueButton));
      });
      expect(replaceState).toHaveBeenCalledWith(null, '', '/');
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      delete (global as unknown as { window?: unknown }).window;
    }
  });

  it('Return clears the URL and calls onDone', async () => {
    const replaceState = jest.fn();
    (global as unknown as { window?: unknown }).window = {
      history: { replaceState },
      location: { href: INVITE_URL, pathname: '/auth/callback' },
    };
    try {
      mockConsume.mockResolvedValue({ status: 'error', reason: 'link_invalid' });
      const onDone = jest.fn();
      const { findByTestId, getByLabelText } = renderScreen(onDone);
      await findByTestId('auth-callback-error-generic');
      await act(async () => {
        fireEvent.press(getByLabelText(AUTH_CALLBACK_COPY.returnToSignInButton));
      });
      expect(replaceState).toHaveBeenCalledWith(null, '', '/');
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      delete (global as unknown as { window?: unknown }).window;
    }
  });

  it('Continue still calls onDone when window is undefined (native / test env)', async () => {
    mockConsume.mockResolvedValue({ status: 'success' });
    const onDone = jest.fn();
    const { findByTestId, getByLabelText } = renderScreen(onDone);
    await findByTestId('auth-callback-accepted');
    await act(async () => {
      fireEvent.press(getByLabelText(AUTH_CALLBACK_COPY.continueButton));
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('AuthCallbackScreen — no token / raw code / snake_case leaks into the tree', () => {
  it('the rendered tree carries no captured token and no internal code', async () => {
    mockConsume.mockResolvedValue({ status: 'needs_password' });
    const { findByTestId, toJSON } = renderScreen();
    await findByTestId('auth-callback-set-password');
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('fake.aaa.bbb');
    expect(tree).not.toContain('fake-refresh');
    expect(tree).not.toContain('access_token');
    expect(tree).not.toContain('needs_password');
    expect(tree).not.toContain('link_invalid');
    expect(tree).not.toContain('SERVICE_ROLE');
  });
});

describe('AuthCallbackScreen — source scan', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'auth', 'AuthCallbackScreen.tsx'),
    'utf8',
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('contains no console.*', () => {
    expect(code).not.toMatch(/console\./);
  });
  it('contains no SERVICE_ROLE / ANTHROPIC_API_KEY literal', () => {
    expect(code).not.toContain('SERVICE_ROLE');
    expect(code).not.toContain('service_role');
    expect(code).not.toContain('ANTHROPIC_API_KEY');
  });
});
