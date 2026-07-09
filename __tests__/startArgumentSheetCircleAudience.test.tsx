/**
 * START-002 (#839) — StartArgumentSheet circle-audience RNTL tests.
 *
 * Proves that selecting a circle row:
 *   - forces the room PRIVATE and locks the public toggle off (never previews
 *     public — composes honestly with the START-003 state machine);
 *   - submits `{ title, resolution, description:'', visibility:'private',
 *     circleId }` with NO invite key;
 *   - is submittable on the declaration alone (no invite required), and shows a
 *     neutral circle summary line.
 *
 * The START-001 non-circle contract (startArgumentSheetCreationContract) is a
 * SEPARATE, unmodified suite — the circle path never perturbs the non-circle
 * payload.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StartArgumentSheet } from '../src/features/arguments/startArgument/StartArgumentSheet';
import type { PublicToggleSlotProps } from '../src/features/arguments/startArgument/StartArgumentSheet';
import type { CreateDebateInput, CreatedRoom, Debate } from '../src/features/debates/types';
import type { CircleOption } from '../src/features/arguments/startArgument/personArgumentPickerModel';

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

function fakeCreated(): CreatedRoom {
  return { debate: fakeDebate(), inviteLink: null };
}

function stubToggle(props: PublicToggleSlotProps) {
  return (
    <View>
      <Text testID="toggle-disabled">{String(props.disabled === true)}</Text>
      <Pressable testID="stub-confirm-public" onPress={() => props.onChange('public')}>
        <Text>confirm public</Text>
      </Pressable>
    </View>
  );
}

const CIRCLES: CircleOption[] = [{ id: 'c1', label: 'Book Club', memberCount: 4 }];

function renderSheet(onCreate = jest.fn(async (_i: CreateDebateInput) => fakeCreated())) {
  const utils = render(
    <StartArgumentSheet
      onCreate={onCreate}
      onCreated={jest.fn()}
      onCancel={jest.fn()}
      recents={[]}
      circles={CIRCLES}
      renderPublicToggle={stubToggle}
    />,
  );
  return { ...utils, onCreate };
}

describe('START-002 — circle audience selection', () => {
  it('renders a selectable circle row with the member count as a size', () => {
    const { getByTestId } = renderSheet();
    const row = getByTestId('person-picker-circle-c1');
    expect(row.props.accessibilityLabel).toContain('Book Club');
    expect(row.props.accessibilityLabel).toContain('4 people');
    expect(row.props.accessibilityLabel).toContain('private');
  });

  it('selecting a circle shows the private circle summary and no needs-person prompt', () => {
    const { getByTestId, queryByTestId } = renderSheet();
    fireEvent.press(getByTestId('person-picker-circle-c1'));
    const summary = getByTestId('start-sheet-circle-summary');
    expect(summary).toBeTruthy();
    // Present-honest phrasing (AC2 read deferred to #882): the summary states
    // the room is kept private to the circle, NOT that its members can read it
    // (only the creator can read it until the read-arm migration lands).
    expect(summary.props.children).toBe('Inside Book Club — kept private to this circle.');
    expect(summary.props.children).not.toContain('members can read');
    // The non-circle "add one person" private summary is NOT shown for a circle.
    expect(queryByTestId('start-sheet-private-summary')).toBeNull();
    // The private_requires_invite disabled reason must NOT appear for a circle.
    expect(queryByTestId('start-sheet-submit-reason')).toBeNull();
  });

  it('locks the public toggle off for a circle target (never previews public)', () => {
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId('person-picker-circle-c1'));
    // Expand Advanced to inspect the toggle slot.
    fireEvent.press(getByTestId('start-sheet-advanced-toggle'));
    expect(getByTestId('toggle-disabled').props.children).toBe('true');
    expect(getByTestId('start-sheet-circle-forces-private')).toBeTruthy();
  });

  it('submits a private circle payload with NO invite key', async () => {
    const { getByTestId, onCreate } = renderSheet();
    fireEvent.press(getByTestId('person-picker-circle-c1'));
    fireEvent.changeText(getByTestId('start-sheet-declaration'), 'Reading order matters.');
    await act(async () => {
      fireEvent.press(getByTestId('start-sheet-submit'));
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0] as CreateDebateInput;
    expect(payload).toEqual({
      title: expect.any(String),
      resolution: 'Reading order matters.',
      description: '',
      visibility: 'private',
      circleId: 'c1',
    });
    expect(payload).not.toHaveProperty('invite');
  });

  it('is submittable on the declaration alone (no invite required for a circle)', async () => {
    const { getByTestId, onCreate } = renderSheet();
    // Circle selected + declaration present => submit fires (a non-circle
    // private target would be blocked by private_requires_invite here).
    fireEvent.press(getByTestId('person-picker-circle-c1'));
    fireEvent.changeText(getByTestId('start-sheet-declaration'), 'A point to argue.');
    await act(async () => {
      fireEvent.press(getByTestId('start-sheet-submit'));
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
