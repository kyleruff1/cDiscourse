/**
 * START-001 (#827) — creation-payload contract test (the load-bearing test).
 *
 * Proves that for equivalent inputs the NEW StartArgumentSheet path and the
 * LEGACY StartArgumentPage path produce a DEEP-EQUAL `CreateDebateInput`, so
 * the sheet wraps the shipped creation machinery without forking it. Both paths
 * are the actual rendered components submitting through the SAME `onCreate`;
 * the payloads are captured and compared with `toEqual`.
 *
 * It also pins that `deriveArgumentRoomCreation` is the SOLE invite normaliser:
 * a mixed-case address produces the same `lower(trim)` storage form on both
 * paths, equal to the validator output.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StartArgumentPage } from '../src/features/arguments/startArgument/StartArgumentPage';
import { StartArgumentSheet } from '../src/features/arguments/startArgument/StartArgumentSheet';
import type { PublicToggleSlotProps } from '../src/features/arguments/startArgument/StartArgumentSheet';
import type { CreateDebateInput, CreatedRoom, Debate } from '../src/features/debates/types';
import { deriveArgumentRoomCreation } from '../src/features/debates/argumentRoomCreationMatrix';

function fakeDebate(): Debate {
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
  };
}

// No create-time link box on this path (link handling is covered elsewhere).
function fakeCreated(): CreatedRoom {
  return { debate: fakeDebate(), inviteLink: null };
}

function stubToggle(props: PublicToggleSlotProps) {
  return (
    <View>
      <Pressable testID="stub-confirm-public" onPress={() => props.onChange('public')}>
        <Text>confirm public</Text>
      </Pressable>
    </View>
  );
}

interface Scenario {
  name: string;
  declaration: string;
  visibility: 'public' | 'private';
  /** The typed invite address (empty means none). */
  email: string;
  /** Sheet-only: reach public via the open-floor row (no invite) vs a person. */
  openFloor?: boolean;
}

async function legacyPagePayload(s: Scenario): Promise<CreateDebateInput | undefined> {
  const onCreate = jest.fn(async (_i: CreateDebateInput) => fakeCreated());
  const { getByTestId } = render(
    <StartArgumentPage onCreate={onCreate} onCreated={jest.fn()} onCancel={jest.fn()} />,
  );
  fireEvent.changeText(getByTestId('start-argument-declaration'), s.declaration);
  if (s.visibility === 'public') fireEvent.press(getByTestId('start-argument-visibility-public'));
  if (s.email) fireEvent.changeText(getByTestId('start-argument-invite-email'), s.email);
  await act(async () => {
    fireEvent.press(getByTestId('start-argument-submit'));
  });
  return onCreate.mock.calls[0]?.[0];
}

async function sheetPayload(s: Scenario): Promise<CreateDebateInput | undefined> {
  const onCreate = jest.fn(async (_i: CreateDebateInput) => fakeCreated());
  const { getByTestId } = render(
    <StartArgumentSheet
      onCreate={onCreate}
      onCreated={jest.fn()}
      onCancel={jest.fn()}
      recents={[]}
      renderPublicToggle={stubToggle}
    />,
  );
  fireEvent.changeText(getByTestId('start-sheet-declaration'), s.declaration);
  if (s.openFloor) {
    fireEvent.press(getByTestId('person-picker-open-floor')); // auto-expands Advanced
  } else if (s.email) {
    fireEvent.changeText(getByTestId('person-picker-email-input'), s.email);
  }
  if (s.visibility === 'public') {
    if (!s.openFloor) fireEvent.press(getByTestId('start-sheet-advanced-toggle')); // expand for a person
    fireEvent.press(getByTestId('stub-confirm-public')); // the second deliberate tap
  }
  await act(async () => {
    fireEvent.press(getByTestId('start-sheet-submit'));
  });
  return onCreate.mock.calls[0]?.[0];
}

const SCENARIOS: Scenario[] = [
  { name: 'Private + one invite', declaration: 'Bike lanes make streets safer.', visibility: 'private', email: 'dana@example.com' },
  { name: 'Private + one invite (mixed case normalises)', declaration: 'A framing point.', visibility: 'private', email: 'Dana@Example.COM' },
  { name: 'Public + no invite (open floor)', declaration: 'A public claim to debate.', visibility: 'public', email: '', openFloor: true },
  { name: 'Public + one invite (reserved seat)', declaration: 'A public claim with a named respondent.', visibility: 'public', email: 'sam@example.com' },
];

describe('START-001 creation-payload contract — sheet path === legacy path', () => {
  it.each(SCENARIOS)('$name → identical CreateDebateInput', async (s) => {
    const legacy = await legacyPagePayload(s);
    const sheet = await sheetPayload(s);
    expect(legacy).toBeDefined();
    expect(sheet).toBeDefined();
    // The load-bearing assertion: the two paths agree byte-for-byte.
    expect(sheet).toEqual(legacy);
    // Visibility is exactly what the scenario intended (the sheet only reaches
    // public via the toggle confirm; the page via its radio).
    expect(sheet?.visibility).toBe(s.visibility);
  });

  it('deriveArgumentRoomCreation is the SOLE invite normaliser (mixed case -> lower(trim))', async () => {
    const s = SCENARIOS[1]; // 'Dana@Example.COM'
    const legacy = await legacyPagePayload(s);
    const sheet = await sheetPayload(s);
    const validatorNormalised = deriveArgumentRoomCreation({
      visibility: 'private',
      directInviteEmails: [s.email],
    }).normalisedDirectInviteEmail;
    expect(validatorNormalised).toBe('dana@example.com');
    expect(legacy?.invite?.email).toBe(validatorNormalised);
    expect(sheet?.invite?.email).toBe(validatorNormalised);
  });

  it('public + no invite omits the invite key entirely on both paths', async () => {
    const s = SCENARIOS[2];
    const legacy = await legacyPagePayload(s);
    const sheet = await sheetPayload(s);
    expect(legacy).not.toHaveProperty('invite');
    expect(sheet).not.toHaveProperty('invite');
    expect(sheet).toEqual(legacy);
  });
});
