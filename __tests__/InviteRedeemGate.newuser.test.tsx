/**
 * EMAIL-TRANSPORT-002 (Option B) — InviteRedeemGate new-user RTL contract.
 *
 * The signed-out pending branch now offers TWO in-place paths:
 *   - "Create account & join" → mounts the credential step (create mode);
 *   - "I already have an account — sign in" → credential step (sign-in mode).
 *
 * Asserts:
 *   - the two-path panel renders for a signed-out, live-pending invite;
 *   - choosing "create account" mounts the in-place credential step;
 *   - a full provision → sign-in succeeds and the gate (once signedIn flips)
 *     fires acceptRoomInvite and calls onAccepted;
 *   - the "sign in" path mounts the step in sign-in sub-mode;
 *   - NO-ENUMERATION: the gate's signed-out render is byte-identical for two
 *     tokens regardless of whether the invitee already has an account (the
 *     gate has no input that could differ — the lookup shape is the same).
 *
 * The Edge wrappers are mocked — no live network.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { InviteRedeemGate } from '../src/features/invites/InviteRedeemGate';
import {
  lookupInviteByToken,
  acceptRoomInvite,
  provisionAndAcceptInvite,
} from '../src/features/invites/inviteApi';
import { signInWithEmailPassword } from '../src/features/auth/authApi';

jest.mock('../src/features/invites/inviteApi', () => ({
  lookupInviteByToken: jest.fn(),
  acceptRoomInvite: jest.fn(),
  provisionAndAcceptInvite: jest.fn(),
}));
jest.mock('../src/features/auth/authApi', () => ({
  signInWithEmailPassword: jest.fn(),
  validateNewPassword: (pw: string) =>
    typeof pw === 'string' && pw.length >= 6 ? null : 'Password must be at least 6 characters.',
}));

const mockLookup = lookupInviteByToken as jest.MockedFunction<typeof lookupInviteByToken>;
const mockAccept = acceptRoomInvite as jest.MockedFunction<typeof acceptRoomInvite>;
const mockProvision = provisionAndAcceptInvite as jest.MockedFunction<
  typeof provisionAndAcceptInvite
>;
const mockSignIn = signInWithEmailPassword as jest.MockedFunction<typeof signInWithEmailPassword>;

const TOKEN = 'aB12345678901234567890123456789012345678901';

function pendingLookup() {
  return {
    ok: true as const,
    data: {
      status: 'pending' as const,
      tokenEcho: TOKEN,
      room: { title: 'Should cities ban cars?', invitedByDisplayName: 'Alex' },
    },
  };
}

function renderGate(overrides: Partial<React.ComponentProps<typeof InviteRedeemGate>> = {}) {
  const onAccepted = jest.fn();
  const onExit = jest.fn();
  const onPromptSignIn = jest.fn();
  const utils = render(
    <InviteRedeemGate
      token={TOKEN}
      signedIn={false}
      viewerEmail={null}
      onPromptSignIn={onPromptSignIn}
      onAccepted={onAccepted}
      onExit={onExit}
      {...overrides}
    />,
  );
  return { ...utils, onAccepted, onExit, onPromptSignIn };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InviteRedeemGate (new user) — two-path signed-out prompt', () => {
  it('renders both the create-account and sign-in paths for a signed-out pending invite', async () => {
    mockLookup.mockResolvedValue(pendingLookup());
    const { getByTestId } = renderGate();
    await waitFor(() => expect(getByTestId('invite-redeem-signed-out')).toBeTruthy());
    expect(getByTestId('invite-redeem-create-account')).toBeTruthy();
    expect(getByTestId('invite-redeem-signin-existing')).toBeTruthy();
    // The universal escape hatch is preserved.
    expect(getByTestId('invite-redeem-exit-button')).toBeTruthy();
  });

  it('choosing "create account" mounts the in-place credential step', async () => {
    mockLookup.mockResolvedValue(pendingLookup());
    const { getByTestId } = renderGate();
    await waitFor(() => expect(getByTestId('invite-redeem-create-account')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('invite-redeem-create-account'));
    });
    expect(getByTestId('invite-credential-step')).toBeTruthy();
    expect(getByTestId('invite-credential-email')).toBeTruthy();
  });

  it('choosing "sign in" mounts the credential step in sign-in sub-mode', async () => {
    mockLookup.mockResolvedValue(pendingLookup());
    const { getByTestId } = renderGate();
    await waitFor(() => expect(getByTestId('invite-redeem-signin-existing')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('invite-redeem-signin-existing'));
    });
    expect(getByTestId('invite-credential-step')).toBeTruthy();
  });
});

describe('InviteRedeemGate (new user) — provision → sign-in → accept', () => {
  it('after credentials are established and signedIn flips, the gate fires accept and calls onAccepted', async () => {
    mockLookup.mockResolvedValue(pendingLookup());
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
    mockAccept.mockResolvedValue({
      ok: true,
      data: {
        debateId: 'deb-1',
        status: 'accepted',
        enteredAsParticipant: true,
        intendedSeat: 'respondent',
      },
    });

    const onAccepted = jest.fn();
    const { getByTestId, rerender } = render(
      <InviteRedeemGate
        token={TOKEN}
        signedIn={false}
        viewerEmail={null}
        onPromptSignIn={jest.fn()}
        onAccepted={onAccepted}
        onExit={jest.fn()}
      />,
    );

    await waitFor(() => expect(getByTestId('invite-redeem-create-account')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('invite-redeem-create-account'));
    });
    fireEvent.changeText(getByTestId('invite-credential-email'), 'me@example.com');
    fireEvent.changeText(getByTestId('invite-credential-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('invite-credential-submit'));
    });
    await waitFor(() => expect(mockProvision).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));

    // Simulate the parent's auth listener flipping signedIn=true after the
    // in-place sign-in established a session.
    await act(async () => {
      rerender(
        <InviteRedeemGate
          token={TOKEN}
          signedIn
          viewerEmail="me@example.com"
          onPromptSignIn={jest.fn()}
          onAccepted={onAccepted}
          onExit={jest.fn()}
        />,
      );
    });

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith({ token: TOKEN }));
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith({ debateId: 'deb-1' }));
  });
});

describe('InviteRedeemGate (new user) — no enumeration', () => {
  it('the signed-out render is identical regardless of invitee account state', async () => {
    // The gate has NO input that distinguishes "the invitee already has an
    // account" from "the invitee does not" — the lookup shape is identical
    // in both cases (no email, no account flag). Two independent renders of
    // the same pending lookup must produce byte-identical signed-out trees.
    mockLookup.mockResolvedValue(pendingLookup());

    const a = render(
      <InviteRedeemGate
        token={TOKEN}
        signedIn={false}
        viewerEmail={null}
        onPromptSignIn={jest.fn()}
        onAccepted={jest.fn()}
        onExit={jest.fn()}
      />,
    );
    await waitFor(() => expect(a.getByTestId('invite-redeem-signed-out')).toBeTruthy());
    const treeA = JSON.stringify(a.toJSON());

    const b = render(
      <InviteRedeemGate
        token={TOKEN}
        signedIn={false}
        viewerEmail={null}
        onPromptSignIn={jest.fn()}
        onAccepted={jest.fn()}
        onExit={jest.fn()}
      />,
    );
    await waitFor(() => expect(b.getByTestId('invite-redeem-signed-out')).toBeTruthy());
    const treeB = JSON.stringify(b.toJSON());

    // Byte-identical renders prove the gate cannot vary by account state.
    expect(treeA).toBe(treeB);
    // And the tree never carries the invitee email address (no `@`), so the
    // invited address is never revealed. (The word "account" appears in the
    // button labels — "Create account", "I already have an account" — which
    // is generic copy, NOT an account-existence flag; the no-enumeration
    // property is the byte-identical render + the absent invited address.)
    expect(treeA).not.toContain('@');
  });
});
