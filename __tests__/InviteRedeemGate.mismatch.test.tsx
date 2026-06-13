/**
 * ARG-ROOM-006 (item d) — wrong-account invitee recovery (verify + pin).
 *
 * An invitee signed in as the WRONG account hits the accept Edge Function,
 * which returns `invite_email_mismatch`. The gate must render the MismatchPanel
 * with: clear recovery guidance, the VIEWER's own email only (never the
 * invitee's — no enumeration), and a "Sign in as someone else" affordance.
 *
 * The shipped behavior is unchanged by 006; this render test pins it.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('../src/features/invites/inviteApi', () => ({
  lookupInviteByToken: jest.fn(),
  acceptRoomInvite: jest.fn(),
}));

import { InviteRedeemGate } from '../src/features/invites/InviteRedeemGate';
import { lookupInviteByToken, acceptRoomInvite } from '../src/features/invites/inviteApi';
import { INVITE_REDEEM_COPY } from '../src/features/invites/inviteCopy';

const mockLookup = lookupInviteByToken as jest.Mock;
const mockAccept = acceptRoomInvite as jest.Mock;

const VIEWER_EMAIL = 'wrong-account@example.com';
const INVITEE_EMAIL = 'invitee-secret@example.com'; // must NEVER appear in the UI
const INVITER = 'Alex';

beforeEach(() => {
  mockLookup.mockReset();
  mockAccept.mockReset();
  // The token is live + pending; the room exists.
  mockLookup.mockResolvedValue({
    ok: true,
    data: { status: 'pending', tokenEcho: 'tok', room: { title: 'A room', invitedByDisplayName: INVITER } },
  });
  // The signed-in account does not match the invited email.
  mockAccept.mockResolvedValue({ ok: false, error: { error: 'invite_email_mismatch' }, status: 403 });
});

function renderGate(onSignOutAndRetry?: () => void) {
  return render(
    <InviteRedeemGate
      token="tok"
      signedIn
      viewerEmail={VIEWER_EMAIL}
      onPromptSignIn={jest.fn()}
      onAccepted={jest.fn()}
      onExit={jest.fn()}
      onSignOutAndRetry={onSignOutAndRetry}
    />,
  );
}

describe('InviteRedeemGate — wrong-account recovery (item d)', () => {
  it('auto-accept on a mismatch renders the MismatchPanel recovery copy', async () => {
    const { findByText } = renderGate(jest.fn());
    expect(await findByText(INVITE_REDEEM_COPY.emailMismatchTitle)).toBeTruthy();
    await waitFor(() => expect(mockAccept).toHaveBeenCalled());
  });

  it('the recovery copy names the VIEWER email, never the invitee email (no enumeration)', async () => {
    const { findByText, queryByText } = renderGate(jest.fn());
    const body = await findByText(INVITE_REDEEM_COPY.emailMismatchBody(INVITER, VIEWER_EMAIL));
    expect(String(body.props.children)).toContain(VIEWER_EMAIL);
    // The gate never receives the invitee email, so it cannot leak it.
    expect(queryByText(new RegExp(INVITEE_EMAIL, 'i'))).toBeNull();
  });

  it('offers "Sign in as someone else" when a sign-out handler is supplied', async () => {
    const { findByText } = renderGate(jest.fn());
    expect(await findByText(INVITE_REDEEM_COPY.emailMismatchSignInElse)).toBeTruthy();
  });

  it('the universal "Go to my arguments" escape hatch is present', async () => {
    const { findByText } = renderGate(jest.fn());
    // Wait for the mismatch panel, then assert the escape hatch alongside it.
    await findByText(INVITE_REDEEM_COPY.emailMismatchTitle);
    expect(await findByText(INVITE_REDEEM_COPY.goHomeButton)).toBeTruthy();
  });
});
