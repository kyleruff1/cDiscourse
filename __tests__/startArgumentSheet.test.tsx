/**
 * START-001 (#827) — StartArgumentSheet RNTL suite (J3 + J4-partial).
 *
 * J3 (pick a person -> type point -> Start; private implied; one-time link):
 *   pick a recent -> type the point -> assert the "Private — just you and
 *   <masked>" line -> submit calls onCreate with the private + one-invite
 *   payload -> the ARG-ROOM-008 one-time link box shows when a link is returned
 *   -> Continue hands off via onCreated.
 *
 * J4-partial (open floor -> Advanced expands -> toggle -> second confirm ->
 *   public payload): selecting open floor auto-expands Advanced but LEAVES
 *   visibility private (submit disabled with the matrix reason); only after the
 *   injected toggle emits onChange('public') (the SECOND deliberate tap) does a
 *   public create become valid. Proves public is unreachable in < 2 taps.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StartArgumentSheet } from '../src/features/arguments/startArgument/StartArgumentSheet';
import type { PublicToggleSlotProps } from '../src/features/arguments/startArgument/StartArgumentSheet';
import type { RecentOpponent } from '../src/features/arguments/startArgument/personArgumentPickerModel';
import type { CreateDebateInput, CreatedRoom, Debate } from '../src/features/debates/types';
import { START_SHEET_COPY } from '../src/features/arguments/gameCopy';
import { maskInviteeEmail } from '../src/features/invites/inviteModel';

function fakeDebate(overrides: Partial<Debate> = {}): Debate {
  return {
    id: 'deb-1',
    createdBy: 'user-1',
    title: 'T',
    resolution: 'R',
    description: '',
    status: 'open',
    constitutionId: 'const-1',
    createdAt: '2026-07-08T00:00:00.000Z',
    updatedAt: '2026-07-08T00:00:00.000Z',
    myParticipantSide: 'moderator',
    visibility: 'private',
    ...overrides,
  };
}

function fakeCreated(inviteLink: string | null = null): CreatedRoom {
  return { debate: fakeDebate(), inviteLink };
}

const RECENTS: RecentOpponent[] = [
  { email: 'dana@example.com', maskedEmail: maskInviteeEmail('dana@example.com'), lastInvitedAtMs: 2 },
  { email: 'sam@example.com', maskedEmail: maskInviteeEmail('sam@example.com'), lastInvitedAtMs: 1 },
];

/** An injected stub for START-003's toggle slot. It exposes the slot props and
 *  a confirm/revert control so the sheet-side wiring can be exercised without
 *  the real PublicArgumentToggle (which lands in START-003 slices). */
function stubToggle(props: PublicToggleSlotProps) {
  return (
    <View>
      <Text testID="stub-toggle-visibility">{props.visibility}</Text>
      <Text testID="stub-toggle-capacity">
        {`${props.capacityPreview.capacity}:${props.capacityPreview.open}:${props.capacityPreview.reservedInviteSeats}`}
      </Text>
      <Pressable testID="stub-confirm-public" onPress={() => props.onChange('public')}>
        <Text>confirm public</Text>
      </Pressable>
      <Pressable testID="stub-revert-private" onPress={() => props.onChange('private')}>
        <Text>keep private</Text>
      </Pressable>
    </View>
  );
}

// ── Private default ─────────────────────────────────────────────

describe('StartArgumentSheet — private default', () => {
  it('shows the private-needs-person summary and disabled submit on a fresh sheet', () => {
    const { getByTestId } = render(
      <StartArgumentSheet onCreate={jest.fn()} onCancel={jest.fn()} recents={RECENTS} />,
    );
    expect(getByTestId('start-sheet-private-summary').props.children).toBe(
      START_SHEET_COPY.privateNeedsPerson,
    );
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(true);
  });
});

// ── J3 — pick person -> type point -> Start ─────────────────────

describe('StartArgumentSheet — J3 pick a person, private implied, one-time link', () => {
  it('shows the private-with-person line, submits the private + one-invite payload, and hands off after the link box', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated('https://cdisc.test/i/abc123'));
    const onCreated = jest.fn();
    const { getByTestId } = render(
      <StartArgumentSheet onCreate={onCreate} onCreated={onCreated} onCancel={jest.fn()} recents={RECENTS} />,
    );

    // Pick Dana (tap 1: person-first).
    fireEvent.press(getByTestId('person-picker-recent-dana@example.com'));
    // J3 copy: "Private — just you and d•••@example.com."
    expect(getByTestId('start-sheet-private-summary').props.children).toBe(
      START_SHEET_COPY.privateWithPerson.replace('{person}', maskInviteeEmail('dana@example.com')),
    );

    // Type the point.
    fireEvent.changeText(getByTestId('start-sheet-declaration'), 'Bike lanes make streets safer.');
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(false);

    // Start.
    await act(async () => {
      fireEvent.press(getByTestId('start-sheet-submit'));
    });

    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0] as CreateDebateInput;
    expect(payload.visibility).toBe('private');
    expect(payload.invite).toEqual({ email: 'dana@example.com' });
    expect(payload.resolution).toBe('Bike lanes make streets safer.');
    expect(payload.description).toBe('');

    // ARG-ROOM-008 one-time link box appears (a link was returned).
    await waitFor(() => expect(getByTestId('start-sheet-invite-link-box')).toBeTruthy());
    expect(getByTestId('start-sheet-invite-link-text').props.children).toBe('https://cdisc.test/i/abc123');

    // Continue hands off to the room (onCreated fires, onCreate already fired once).
    fireEvent.press(getByTestId('start-sheet-invite-link-continue'));
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][1]).toBe('timeline');
  });
});

// ── J4-partial — public needs two deliberate taps ───────────────

describe('StartArgumentSheet — J4 open floor two-tap ceremony', () => {
  it('open floor auto-expands Advanced but leaves visibility private (submit blocked)', () => {
    const { getByTestId } = render(
      <StartArgumentSheet
        onCreate={jest.fn()}
        onCancel={jest.fn()}
        recents={RECENTS}
        renderPublicToggle={stubToggle}
      />,
    );
    fireEvent.changeText(getByTestId('start-sheet-declaration'), 'A public claim.');

    // Tap 1: select open floor.
    fireEvent.press(getByTestId('person-picker-open-floor'));
    // Advanced expanded; the toggle slot mounted; visibility still private.
    expect(getByTestId('start-sheet-advanced')).toBeTruthy();
    expect(getByTestId('stub-toggle-visibility').props.children).toBe('private');
    // Validator-derived capacity numbers reached the slot (5 cap, 4 open, 0 reserved).
    expect(getByTestId('stub-toggle-capacity').props.children).toBe('5:4:0');
    // ONE tap does not make it public — submit is still blocked (private + no invite).
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('start-sheet-submit-reason')).toBeTruthy();
  });

  it('only after the SECOND deliberate confirm does a public create become valid', () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated());
    const { getByTestId } = render(
      <StartArgumentSheet
        onCreate={onCreate}
        onCancel={jest.fn()}
        recents={RECENTS}
        renderPublicToggle={stubToggle}
      />,
    );
    fireEvent.changeText(getByTestId('start-sheet-declaration'), 'A public claim.');

    fireEvent.press(getByTestId('person-picker-open-floor')); // tap 1
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByTestId('stub-confirm-public')); // tap 2 (confirm)
    expect(getByTestId('stub-toggle-visibility').props.children).toBe('public');
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('reverting the toggle to private re-blocks the open-floor submit', () => {
    const { getByTestId } = render(
      <StartArgumentSheet
        onCreate={jest.fn()}
        onCancel={jest.fn()}
        recents={RECENTS}
        renderPublicToggle={stubToggle}
      />,
    );
    fireEvent.changeText(getByTestId('start-sheet-declaration'), 'A public claim.');
    fireEvent.press(getByTestId('person-picker-open-floor'));
    fireEvent.press(getByTestId('stub-confirm-public'));
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(false);
    // "Keep it private" reverts — submit blocks again.
    fireEvent.press(getByTestId('stub-revert-private'));
    expect(getByTestId('stub-toggle-visibility').props.children).toBe('private');
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('re-selecting a person after a public confirm resets visibility to private', () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated());
    const { getByTestId } = render(
      <StartArgumentSheet
        onCreate={onCreate}
        onCancel={jest.fn()}
        recents={RECENTS}
        renderPublicToggle={stubToggle}
      />,
    );
    fireEvent.changeText(getByTestId('start-sheet-declaration'), 'A claim.');
    fireEvent.press(getByTestId('person-picker-open-floor'));
    fireEvent.press(getByTestId('stub-confirm-public'));
    // Now switch to a person: visibility must revert to private (Advanced collapses).
    fireEvent.press(getByTestId('person-picker-recent-dana@example.com'));
    expect(getByTestId('start-sheet-private-summary').props.children).toBe(
      START_SHEET_COPY.privateWithPerson.replace('{person}', maskInviteeEmail('dana@example.com')),
    );
  });
});
