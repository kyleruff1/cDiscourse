/**
 * EMAIL-TRANSPORT-002 (Option B) — InviteCredentialStep RTL contract.
 *
 * The step is the in-place "Create your account" surface on /invite. It
 * owns provision_and_accept + the subsequent sign-in. These tests mock
 * the two wrappers (no live network) and assert:
 *   - renders email + password fields + submit;
 *   - inline validation blocks the wire call;
 *   - submit (create) calls provisionAndAcceptInvite once, then
 *     signInWithEmailPassword, then onCredentialsEstablished;
 *   - account_exists shows the offer-signin banner; the switch toggles to
 *     sign-in mode and calls signInWithEmailPassword;
 *   - after success the rendered tree holds NO password value and NO token;
 *   - the source carries no console.* and no service-role literal.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { InviteCredentialStep } from '../src/features/invites/InviteCredentialStep';
import { INVITE_CREDENTIAL_COPY } from '../src/features/invites/inviteCopy';
import { provisionAndAcceptInvite } from '../src/features/invites/inviteApi';
import { signInWithEmailPassword } from '../src/features/auth/authApi';

jest.mock('../src/features/invites/inviteApi', () => ({
  provisionAndAcceptInvite: jest.fn(),
}));
jest.mock('../src/features/auth/authApi', () => ({
  signInWithEmailPassword: jest.fn(),
  // validateNewPassword is pure — re-export the real one for the model.
  validateNewPassword: (pw: string) =>
    typeof pw === 'string' && pw.length >= 6 ? null : 'Password must be at least 6 characters.',
}));

const mockProvision = provisionAndAcceptInvite as jest.MockedFunction<
  typeof provisionAndAcceptInvite
>;
const mockSignIn = signInWithEmailPassword as jest.MockedFunction<typeof signInWithEmailPassword>;

const TOKEN = 'aB12345678901234567890123456789012345678901';

function renderStep(overrides: Partial<React.ComponentProps<typeof InviteCredentialStep>> = {}) {
  const onCredentialsEstablished = jest.fn();
  const onExit = jest.fn();
  const utils = render(
    <InviteCredentialStep
      token={TOKEN}
      roomTitle="Should cities ban cars?"
      inviterDisplayName="Alex"
      onCredentialsEstablished={onCredentialsEstablished}
      onExit={onExit}
      {...overrides}
    />,
  );
  return { ...utils, onCredentialsEstablished, onExit };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InviteCredentialStep — render', () => {
  it('renders the step, email + password fields, submit, and exit', () => {
    const { getByTestId } = renderStep();
    expect(getByTestId('invite-credential-step')).toBeTruthy();
    expect(getByTestId('invite-credential-email')).toBeTruthy();
    expect(getByTestId('invite-credential-password')).toBeTruthy();
    expect(getByTestId('invite-credential-submit')).toBeTruthy();
    expect(getByTestId('invite-credential-exit')).toBeTruthy();
  });

  it('shows room context (title + inviter) but never a token', () => {
    const { queryByText, toJSON } = renderStep();
    expect(queryByText(/Should cities ban cars\?/)).toBeTruthy();
    expect(queryByText(/Alex/)).toBeTruthy();
    expect(JSON.stringify(toJSON())).not.toContain(TOKEN);
  });
});

describe('InviteCredentialStep — inline validation', () => {
  it('blocks the wire call when the password is too short', async () => {
    const { getByTestId } = renderStep();
    fireEvent.changeText(getByTestId('invite-credential-email'), 'me@example.com');
    fireEvent.changeText(getByTestId('invite-credential-password'), '123');
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-submit'));
    });
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it('blocks the wire call when the email is invalid', async () => {
    const { getByTestId } = renderStep();
    fireEvent.changeText(getByTestId('invite-credential-email'), 'not-an-email');
    fireEvent.changeText(getByTestId('invite-credential-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-submit'));
    });
    expect(mockProvision).not.toHaveBeenCalled();
  });
});

describe('InviteCredentialStep — create happy path', () => {
  it('calls provisionAndAcceptInvite once, then signInWithEmailPassword, then onCredentialsEstablished', async () => {
    mockProvision.mockResolvedValue({
      ok: true,
      data: {
        debateId: 'deb-1',
        status: 'accepted',
        enteredAsParticipant: true,
        intendedSeat: 'respondent',
      },
    });
    mockSignIn.mockResolvedValue({ ok: true, data: { id: 'u-1', email: 'me@example.com' } });

    const { getByTestId, onCredentialsEstablished } = renderStep();
    fireEvent.changeText(getByTestId('invite-credential-email'), 'me@example.com');
    fireEvent.changeText(getByTestId('invite-credential-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-submit'));
    });

    await waitFor(() => expect(onCredentialsEstablished).toHaveBeenCalledTimes(1));
    expect(mockProvision).toHaveBeenCalledTimes(1);
    expect(mockProvision).toHaveBeenCalledWith({
      token: TOKEN,
      email: 'me@example.com',
      password: 'secret123',
    });
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledWith('me@example.com', 'secret123');
  });

  it('after a successful submit the rendered tree holds no password value and no token', async () => {
    mockProvision.mockResolvedValue({
      ok: true,
      data: {
        debateId: 'deb-1',
        status: 'accepted',
        enteredAsParticipant: true,
        intendedSeat: 'respondent',
      },
    });
    mockSignIn.mockResolvedValue({ ok: true, data: { id: 'u-1', email: 'me@example.com' } });

    const { getByTestId, onCredentialsEstablished, toJSON } = renderStep();
    fireEvent.changeText(getByTestId('invite-credential-email'), 'me@example.com');
    fireEvent.changeText(getByTestId('invite-credential-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-submit'));
    });
    await waitFor(() => expect(onCredentialsEstablished).toHaveBeenCalled());

    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('secret123');
    expect(tree).not.toContain(TOKEN);
  });
});

describe('InviteCredentialStep — account_exists → sign-in sub-mode', () => {
  it('shows the offer-signin banner on account_exists and does NOT establish a session', async () => {
    mockProvision.mockResolvedValue({
      ok: false,
      error: { error: 'account_exists' },
      status: 409,
    });

    const { getByTestId, onCredentialsEstablished } = renderStep();
    fireEvent.changeText(getByTestId('invite-credential-email'), 'me@example.com');
    fireEvent.changeText(getByTestId('invite-credential-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-submit'));
    });

    await waitFor(() => expect(getByTestId('invite-credential-banner')).toBeTruthy());
    expect(onCredentialsEstablished).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('switching to sign-in mode submits via signInWithEmailPassword (not provision)', async () => {
    mockSignIn.mockResolvedValue({ ok: true, data: { id: 'u-1', email: 'me@example.com' } });

    const { getByTestId, onCredentialsEstablished } = renderStep();
    // Switch to sign-in mode.
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-switch-mode'));
    });
    fireEvent.changeText(getByTestId('invite-credential-email'), 'me@example.com');
    fireEvent.changeText(getByTestId('invite-credential-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-submit'));
    });

    await waitFor(() => expect(onCredentialsEstablished).toHaveBeenCalledTimes(1));
    expect(mockProvision).not.toHaveBeenCalled();
    expect(mockSignIn).toHaveBeenCalledWith('me@example.com', 'secret123');
  });
});

describe('InviteCredentialStep — email_mismatch (server-side binding)', () => {
  it('shows the mismatch banner and never establishes a session', async () => {
    mockProvision.mockResolvedValue({
      ok: false,
      error: { error: 'invite_email_mismatch' },
      status: 403,
    });

    const { getByTestId, onCredentialsEstablished } = renderStep();
    fireEvent.changeText(getByTestId('invite-credential-email'), 'wrong@example.com');
    fireEvent.changeText(getByTestId('invite-credential-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-submit'));
    });

    await waitFor(() => expect(getByTestId('invite-credential-banner')).toBeTruthy());
    expect(onCredentialsEstablished).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});

describe('InviteCredentialStep — exit', () => {
  it('the exit affordance calls onExit', () => {
    const { getByTestId, onExit } = renderStep();
    fireEvent.press(getByTestId('invite-credential-exit'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('InviteCredentialStep — source safety', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'invites', 'InviteCredentialStep.tsx'),
    'utf8',
  );
  function stripComments(s: string): string {
    return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }
  const code = stripComments(src);

  it('contains no console.* (the step handles a password + token)', () => {
    expect(code).not.toMatch(/console\./);
  });

  it('contains no SERVICE_ROLE literal', () => {
    expect(code).not.toContain('SERVICE_ROLE');
    expect(code).not.toContain('service_role');
  });

  it('does NOT import the supabase client directly (only via the wrappers)', () => {
    expect(code).not.toMatch(/from ['"]\.\.\/\.\.\/lib\/supabase['"]/);
  });

  it('uses the copy bundle for its visible strings', () => {
    expect(code).toContain('INVITE_CREDENTIAL_COPY');
    // sanity: the copy bundle is verdict-free (full scan in inviteCopyDoctrine).
    expect(INVITE_CREDENTIAL_COPY.submitButton.length).toBeGreaterThan(0);
  });
});
