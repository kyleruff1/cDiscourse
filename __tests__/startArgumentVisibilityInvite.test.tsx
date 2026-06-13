/**
 * ARG-ROOM-003 — visibility + one-direct-invite on the live create surface.
 *
 * Asserts the author-facing surface for the binding creation matrix that
 * `StartArgumentPage` now exposes:
 *   - the Public / Private selector defaults to Private and switches;
 *   - the submit button-state matrix (all 8 cells) is driven by the shared
 *     `deriveArgumentRoomCreation` validator (NOT a re-implemented rule);
 *   - a 2+ comma/space paste yields the validator's `too_many_direct_invites`
 *     copy, DISTINCT from the generic invalid-email string;
 *   - the capacity explainer reads its cap + open-seat numbers from the
 *     validator output (no second hard-coded cap);
 *   - submit threads an EXPLICIT visibility + the one optional invite and
 *     navigates uniformly (generic post-create — no account enumeration);
 *   - the a11y contract (radiogroup + radio roles/state, >= 44px target,
 *     color-independent glyph, labelled email field, disabled-reason text).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { StartArgumentPage } from '../src/features/arguments/startArgument/StartArgumentPage';
import type { Debate, CreateDebateInput } from '../src/features/debates/types';
import {
  deriveArgumentRoomCreation,
  plainLanguageForCreationReason,
  ARGUMENT_ROOM_CREATION_COPY,
} from '../src/features/debates/argumentRoomCreationMatrix';
import {
  ARGUMENT_ROOM_CREATE_COPY,
  ROOM_VISIBILITY_COPY,
  fillArgumentRoomCapacityCopy,
} from '../src/features/arguments/gameCopy';

function fakeDebate(overrides: Partial<Debate> = {}): Debate {
  return {
    id: 'deb-1',
    createdBy: 'user-1',
    title: 'T',
    resolution: 'R',
    description: '',
    status: 'open',
    constitutionId: 'const-1',
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z',
    myParticipantSide: 'moderator',
    visibility: 'public',
    ...overrides,
  };
}

/** Render with the declaration already filled so the ONLY remaining gate on
 *  submit is the visibility/invite creation matrix. */
function renderForm() {
  const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeDebate());
  const onCreated = jest.fn();
  const utils = render(
    <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
  );
  fireEvent.changeText(utils.getByTestId('start-argument-declaration'), 'A declaration.');
  return { ...utils, onCreate, onCreated };
}

// ── Default + switch ──────────────────────────────────────────────

describe('StartArgumentPage visibility — default + switch', () => {
  it('defaults the visibility selector to Private', () => {
    const { getByTestId } = renderForm();
    expect(
      getByTestId('start-argument-visibility-private').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      getByTestId('start-argument-visibility-public').props.accessibilityState.selected,
    ).toBe(false);
  });

  it('switches to Public when the Public option is pressed', () => {
    const { getByTestId } = renderForm();
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    expect(
      getByTestId('start-argument-visibility-public').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      getByTestId('start-argument-visibility-private').props.accessibilityState.selected,
    ).toBe(false);
  });
});

// ── Button-state matrix — all 8 cells, validator-driven ───────────

describe('StartArgumentPage submit — 8 button-state cells', () => {
  const CELLS: Array<{
    name: string;
    visibility: 'public' | 'private';
    email: string;
    expectDisabled: boolean;
  }> = [
    { name: 'Private + no email', visibility: 'private', email: '', expectDisabled: true },
    { name: 'Private + one valid email', visibility: 'private', email: 'a@b.com', expectDisabled: false },
    { name: 'Private + malformed email', visibility: 'private', email: 'not-an-email', expectDisabled: true },
    { name: 'Private + two addresses', visibility: 'private', email: 'a@b.com, c@d.com', expectDisabled: true },
    { name: 'Public + no email', visibility: 'public', email: '', expectDisabled: false },
    { name: 'Public + one valid email', visibility: 'public', email: 'a@b.com', expectDisabled: false },
    { name: 'Public + malformed email', visibility: 'public', email: 'not-an-email', expectDisabled: true },
    { name: 'Public + two addresses', visibility: 'public', email: 'a@b.com, c@d.com', expectDisabled: true },
  ];

  it.each(CELLS)('$name → submit disabled=$expectDisabled', ({ visibility, email, expectDisabled }) => {
    const { getByTestId } = renderForm();
    if (visibility === 'public') fireEvent.press(getByTestId('start-argument-visibility-public'));
    if (email) fireEvent.changeText(getByTestId('start-argument-invite-email'), email);
    expect(getByTestId('start-argument-submit').props.accessibilityState.disabled).toBe(
      expectDisabled,
    );
  });
});

// ── Multi-address vs invalid-email reasons are DISTINCT ────────────

describe('StartArgumentPage invite reasons — multi-invite vs invalid', () => {
  it('a two-or-more paste shows the too_many_direct_invites copy, not invalid_email', () => {
    const { getByTestId } = renderForm();
    fireEvent.changeText(getByTestId('start-argument-invite-email'), 'a@b.com, c@d.com');
    const reason = getByTestId('start-argument-create-reason').props.children;
    expect(reason).toBe(plainLanguageForCreationReason('too_many_direct_invites'));
    expect(reason).toBe(ARGUMENT_ROOM_CREATION_COPY.too_many_direct_invites);
    // The two reasons are genuinely different strings (guards against the
    // reused single-email validator silently returning the generic message).
    expect(plainLanguageForCreationReason('too_many_direct_invites')).not.toBe(
      plainLanguageForCreationReason('invalid_email'),
    );
    expect(reason).not.toBe(plainLanguageForCreationReason('invalid_email'));
  });

  it('a malformed single email shows the invalid_email copy and disables submit even for Public', () => {
    const { getByTestId } = renderForm();
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.changeText(getByTestId('start-argument-invite-email'), 'not-an-email');
    expect(getByTestId('start-argument-create-reason').props.children).toBe(
      plainLanguageForCreationReason('invalid_email'),
    );
    expect(getByTestId('start-argument-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('Private + empty shows the private_requires_invite copy', () => {
    const { getByTestId } = renderForm();
    expect(getByTestId('start-argument-create-reason').props.children).toBe(
      plainLanguageForCreationReason('private_requires_invite'),
    );
  });

  it('a valid input clears the disabled-reason line', () => {
    const { getByTestId, queryByTestId } = renderForm();
    fireEvent.changeText(getByTestId('start-argument-invite-email'), 'a@b.com');
    expect(queryByTestId('start-argument-create-reason')).toBeNull();
  });
});

// ── Capacity explainer — sourced from the validator ───────────────

describe('StartArgumentPage capacity explainer', () => {
  it('renders the 1v1 explainer for Private', () => {
    const { getByTestId } = renderForm();
    expect(getByTestId('start-argument-capacity').props.children).toBe(
      ARGUMENT_ROOM_CREATE_COPY.capacity_private,
    );
  });

  it('renders the open-seats explainer for Public with no invite (numbers from the validator)', () => {
    const { getByTestId } = renderForm();
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    const derived = deriveArgumentRoomCreation({ visibility: 'public', directInviteEmails: [] });
    const expected = fillArgumentRoomCapacityCopy(
      ARGUMENT_ROOM_CREATE_COPY.capacity_public_open,
      { capacity: derived.capacity, open: derived.openSlots },
    );
    expect(getByTestId('start-argument-capacity').props.children).toBe(expected);
  });

  it('renders the one-reserved / open explainer for Public with one invite', () => {
    const { getByTestId } = renderForm();
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.changeText(getByTestId('start-argument-invite-email'), 'a@b.com');
    const derived = deriveArgumentRoomCreation({
      visibility: 'public',
      directInviteEmails: ['a@b.com'],
    });
    const expected = fillArgumentRoomCapacityCopy(
      ARGUMENT_ROOM_CREATE_COPY.capacity_public_reserved,
      { capacity: derived.capacity, open: derived.openSlots },
    );
    expect(getByTestId('start-argument-capacity').props.children).toBe(expected);
  });

  it('drives the public cap off the validator, not a hard-coded number', () => {
    const { getByTestId } = renderForm();
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    const derived = deriveArgumentRoomCreation({ visibility: 'public', directInviteEmails: [] });
    // The rendered explainer contains exactly the validator's cap + open count.
    const text = String(getByTestId('start-argument-capacity').props.children);
    expect(text).toContain(String(derived.capacity)); // reconciled 5
    expect(text).toContain(String(derived.openSlots)); // 4 open
  });
});

// ── Submit threading + generic post-create (no enumeration) ───────

describe('StartArgumentPage submit — threads visibility + one invite', () => {
  it('calls onCreate with an explicit visibility and the normalized invite, then navigates', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeDebate());
    const onCreated = jest.fn();
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
    // Default Private + a mixed-case address → normalized lowercase on the way out.
    fireEvent.changeText(getByTestId('start-argument-invite-email'), 'Guest@Example.com');
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const input = onCreate.mock.calls[0][0] as CreateDebateInput;
    expect(input.visibility).toBe('private');
    expect(input.invite).toEqual({ email: 'guest@example.com' });
    // Navigation happens uniformly after a successful atomic create.
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it('does not call onCreate when Private has no invite (submit disabled)', async () => {
    const onCreate = jest.fn(async () => fakeDebate());
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('threads NO invite on the Public no-email path', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeDebate());
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={jest.fn()} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const input = onCreate.mock.calls[0][0] as CreateDebateInput;
    expect(input.visibility).toBe('public');
    expect(input.invite).toBeUndefined();
  });

  it('renders no account-enumeration copy after creating with an invite (generic post-create)', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeDebate());
    const { getByTestId, queryByText } = render(
      <StartArgumentPage onCreate={onCreate} onCreated={jest.fn()} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(getByTestId('start-argument-declaration'), 'A declaration.');
    fireEvent.changeText(getByTestId('start-argument-invite-email'), 'guest@example.com');
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    // The surface never reveals whether the invitee is a new or existing user.
    expect(queryByText(/existing user|new user|already (has|have) an account|sign ?up|registered/i)).toBeNull();
  });
});

// ── Accessibility ─────────────────────────────────────────────────

describe('StartArgumentPage visibility — accessibility', () => {
  it('exposes a radiogroup with a join-framed label and two radio options', () => {
    const { getByTestId } = renderForm();
    const group = getByTestId('start-argument-visibility-group');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    // Reconciliation: the announced label is JOIN-framed, NOT the reused
    // "Who can see this argument" read-access phrase.
    expect(group.props.accessibilityLabel).toBe(ARGUMENT_ROOM_CREATE_COPY.visibility_group_a11y);
    expect(group.props.accessibilityLabel).not.toBe(ROOM_VISIBILITY_COPY.group_label);
    for (const id of ['start-argument-visibility-public', 'start-argument-visibility-private']) {
      expect(getByTestId(id).props.accessibilityRole).toBe('radio');
    }
  });

  it('each visibility option meets the 44px hit target', () => {
    const { getByTestId } = renderForm();
    for (const id of ['start-argument-visibility-public', 'start-argument-visibility-private']) {
      const flat = StyleSheet.flatten(getByTestId(id).props.style);
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('carries selection with a shape glyph (not color alone)', () => {
    const { getByTestId } = renderForm();
    // Default Private selected → ● ; Public unselected → ○.
    expect(
      within(getByTestId('start-argument-visibility-private')).getByText('●'),
    ).toBeTruthy();
    expect(
      within(getByTestId('start-argument-visibility-public')).getByText('○'),
    ).toBeTruthy();
  });

  it('the invite field exposes a label and email keyboard/autoCapitalize settings', () => {
    const { getByTestId } = renderForm();
    const field = getByTestId('start-argument-invite-email');
    expect(field.props.accessibilityLabel).toBe(ARGUMENT_ROOM_CREATE_COPY.invite_field_label);
    expect(field.props.keyboardType).toBe('email-address');
    expect(field.props.autoCapitalize).toBe('none');
  });

  it('renders the disabled-submit reason as visible polite-live text', () => {
    const { getByTestId } = renderForm();
    const reason = getByTestId('start-argument-create-reason');
    expect(reason.props.accessibilityLiveRegion).toBe('polite');
    expect(typeof reason.props.children).toBe('string');
    expect((reason.props.children as string).length).toBeGreaterThan(0);
  });
});
