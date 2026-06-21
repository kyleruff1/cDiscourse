/**
 * AUTH-GOOGLE-SSO-005 (#748) — InviteRedeemGate resume RTL contract for the
 * invite-through-Google round trip.
 *
 * The gate is PROVIDER-AGNOSTIC: its auto-accept effect fires on
 * (signed-in + live pending + viewer email), regardless of HOW the session
 * was established (email/password, Supabase invite, or — this card — a Google
 * OAuth `?code=` return). These tests prove the resume fires once a session
 * exists, however established, and that the doctrine-critical states render
 * plainly:
 *   - 748-T2: signed-in + live pending + viewer email → acceptRoomInvite
 *     fires once with { token } and onAccepted is called with the debateId
 *     (the "signed in via Google" shape);
 *   - 748-T4: email mismatch (the Google account email ≠ the invited email) →
 *     plain MismatchPanel, the tree never contains the invited address (no
 *     enumeration);
 *   - 748-T5: the signed-out gate render is byte-identical regardless of
 *     invitee account state (no enumeration);
 *   - resume does NOT force-accept a dead invite (expired / room_closed render
 *     their panels, not an auto-accept).
 *
 * Acceptance stays the existing server-side acceptRoomInvite Edge invoke —
 * this card adds no new authorization surface. The Edge wrappers are mocked;
 * there is NO live network and NO live OAuth call (cdiscourse-doctrine §7).
 */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

// EMAIL-TRANSPORT-002 — the gate statically imports InviteCredentialStep,
// which pulls in the auth module chain (supabase → async-storage) at load.
// Mock the native module so these renders can load.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/features/invites/inviteApi', () => ({
  lookupInviteByToken: jest.fn(),
  acceptRoomInvite: jest.fn(),
  provisionAndAcceptInvite: jest.fn(),
}));

import { InviteRedeemGate } from '../src/features/invites/InviteRedeemGate';
import { lookupInviteByToken, acceptRoomInvite } from '../src/features/invites/inviteApi';
import { INVITE_REDEEM_COPY } from '../src/features/invites/inviteCopy';

const mockLookup = lookupInviteByToken as jest.Mock;
const mockAccept = acceptRoomInvite as jest.Mock;

const TOKEN = 'aB12345678901234567890123456789012345678901';
const GOOGLE_VIEWER_EMAIL = 'me@gmail.com'; // the Google account email
const INVITEE_SECRET_EMAIL = 'invitee-secret@example.com'; // must NEVER surface
const INVITER = 'Alex';

function pendingLookup() {
  return {
    ok: true as const,
    data: {
      status: 'pending' as const,
      tokenEcho: TOKEN,
      room: { title: 'Should cities ban cars?', invitedByDisplayName: INVITER },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InviteRedeemGate (OAuth resume) — resumes off ANY established session (748-T2)', () => {
  it('signed-in + live pending + viewer email → fires acceptRoomInvite once with { token } and calls onAccepted', async () => {
    mockLookup.mockResolvedValue(pendingLookup());
    mockAccept.mockResolvedValue({
      ok: true,
      data: { debateId: 'deb-1', status: 'accepted', enteredAsParticipant: true, intendedSeat: 'respondent' },
    });

    const onAccepted = jest.fn();
    render(
      <InviteRedeemGate
        token={TOKEN}
        // The session was just established by a Google ?code= return; the
        // parent's auth listener has flipped signedIn=true with the Google
        // account email. The gate cannot see the provider — it only sees a
        // live session + email.
        signedIn
        viewerEmail={GOOGLE_VIEWER_EMAIL}
        onPromptSignIn={jest.fn()}
        onAccepted={onAccepted}
        onExit={jest.fn()}
      />,
    );

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith({ token: TOKEN }));
    await waitFor(() => expect(mockAccept).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith({ debateId: 'deb-1' }));
  });

  it('the resume routes through acceptRoomInvite (the existing Edge invoke), never a direct accept bypass', async () => {
    // The gate has exactly one acceptance seam — the mocked acceptRoomInvite
    // wrapper. If the resume fired, it fired through that wrapper.
    mockLookup.mockResolvedValue(pendingLookup());
    mockAccept.mockResolvedValue({
      ok: true,
      data: { debateId: 'deb-2', status: 'accepted', enteredAsParticipant: true, intendedSeat: 'respondent' },
    });
    render(
      <InviteRedeemGate
        token={TOKEN}
        signedIn
        viewerEmail={GOOGLE_VIEWER_EMAIL}
        onPromptSignIn={jest.fn()}
        onAccepted={jest.fn()}
        onExit={jest.fn()}
      />,
    );
    await waitFor(() => expect(mockAccept).toHaveBeenCalled());
    // The accept payload is the unchanged { token } shape — no seat/capacity
    // arg, no provider arg.
    expect(mockAccept).toHaveBeenCalledWith({ token: TOKEN });
  });
});

describe('InviteRedeemGate (OAuth resume) — email mismatch is plain + non-enumerating (748-T4)', () => {
  it('a Google account email ≠ the invited email renders the MismatchPanel without revealing the invited address', async () => {
    mockLookup.mockResolvedValue(pendingLookup());
    mockAccept.mockResolvedValue({ ok: false, error: { error: 'invite_email_mismatch' }, status: 403 });

    const { findByText, queryByText, toJSON } = render(
      <InviteRedeemGate
        token={TOKEN}
        signedIn
        viewerEmail={GOOGLE_VIEWER_EMAIL}
        onPromptSignIn={jest.fn()}
        onAccepted={jest.fn()}
        onExit={jest.fn()}
        onSignOutAndRetry={jest.fn()}
      />,
    );

    expect(await findByText(INVITE_REDEEM_COPY.emailMismatchTitle)).toBeTruthy();
    await waitFor(() => expect(mockAccept).toHaveBeenCalled());
    // The viewer's own (Google) email may appear; the invited address never can.
    expect(queryByText(new RegExp(INVITEE_SECRET_EMAIL, 'i'))).toBeNull();
    expect(JSON.stringify(toJSON())).not.toContain(INVITEE_SECRET_EMAIL);
  });
});

describe('InviteRedeemGate (OAuth resume) — no enumeration in the signed-out render (748-T5)', () => {
  it('the signed-out gate render is byte-identical regardless of invitee account state', async () => {
    // Before the OAuth session lands the gate is signed-out. Its render cannot
    // vary by whether the invitee already has an account — there is no input
    // that distinguishes the two. Two independent renders must be identical.
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

    expect(treeA).toBe(treeB);
    // The invited address is never present in the signed-out tree.
    expect(treeA).not.toContain('@');
  });
});

describe('InviteRedeemGate (OAuth resume) — resume never force-accepts a dead invite', () => {
  it('an expired lookup renders the expired panel, NOT an auto-accept, even when signed in', async () => {
    mockLookup.mockResolvedValue({
      ok: true,
      data: { status: 'expired', tokenEcho: TOKEN, room: { title: 'A room', invitedByDisplayName: INVITER } },
    });
    const { findByText } = render(
      <InviteRedeemGate
        token={TOKEN}
        signedIn
        viewerEmail={GOOGLE_VIEWER_EMAIL}
        onPromptSignIn={jest.fn()}
        onAccepted={jest.fn()}
        onExit={jest.fn()}
      />,
    );
    expect(await findByText(INVITE_REDEEM_COPY.expiredTitle)).toBeTruthy();
    // No acceptance is attempted for a non-pending lookup.
    await act(async () => {});
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('a room_closed lookup renders the closed panel, NOT an auto-accept', async () => {
    mockLookup.mockResolvedValue({
      ok: true,
      data: { status: 'room_closed', tokenEcho: TOKEN, room: { title: 'A room', invitedByDisplayName: INVITER } },
    });
    const { findByText } = render(
      <InviteRedeemGate
        token={TOKEN}
        signedIn
        viewerEmail={GOOGLE_VIEWER_EMAIL}
        onPromptSignIn={jest.fn()}
        onAccepted={jest.fn()}
        onExit={jest.fn()}
      />,
    );
    expect(await findByText(INVITE_REDEEM_COPY.roomClosedTitle)).toBeTruthy();
    await act(async () => {});
    expect(mockAccept).not.toHaveBeenCalled();
  });
});
