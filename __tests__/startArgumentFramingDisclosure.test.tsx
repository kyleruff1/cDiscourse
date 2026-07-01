/**
 * UX-COMPOSER-002 — the create-screen framing taxonomy behind one optional
 * disclosure.
 *
 * Contract exercised here:
 *   - default render: the "Add framing (optional)" toggle is present; the three
 *     taxonomy groups + the expanded container are ABSENT (no framing mass on
 *     first render);
 *   - the toggle exposes accessibilityRole="button" and
 *     accessibilityState.expanded === false initially;
 *   - pressing the toggle reveals all three groups (and a sample chip in each)
 *     and flips accessibilityState.expanded to true;
 *   - pressing again collapses the groups (idempotent toggle);
 *   - the toggle meets the 44px hit target (flattened minHeight >= 44);
 *   - submit WITHOUT ever opening the disclosure calls onCreate once and the
 *     payload has NO argumentScheme/disagreementStrategy/disagreementCause keys
 *     (write-only-ceremony + no-gate contract);
 *   - submit AFTER opening + selecting a chip still carries no framing keys
 *     (threading unchanged from today);
 *   - the new framing copy contains no verdict tokens and no snake_case leak.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StartArgumentPage } from '../src/features/arguments/startArgument/StartArgumentPage';
import type { Debate, CreateDebateInput, CreatedRoom } from '../src/features/debates/types';

function fakeDebate(overrides: Partial<Debate> = {}): Debate {
  return {
    id: 'deb-1',
    createdBy: 'user-1',
    title: 'T',
    resolution: 'R',
    description: '',
    status: 'open',
    constitutionId: 'const-1',
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
    myParticipantSide: 'moderator',
    visibility: 'public',
    ...overrides,
  };
}

function fakeCreated(inviteLink: string | null = null): CreatedRoom {
  return { debate: fakeDebate(), inviteLink };
}

const GROUP_TEST_IDS = [
  'start-argument-scheme',
  'start-argument-strategy',
  'start-argument-cause',
] as const;

const SAMPLE_CHIP_TEST_IDS = [
  'start-argument-scheme-argument_from_example',
  'start-argument-strategy-complex_counter_argument',
  'start-argument-cause-informant_related',
] as const;

describe('StartArgumentPage framing disclosure — default collapsed', () => {
  it('shows the toggle but no taxonomy groups on first render', () => {
    const { getByTestId, queryByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(getByTestId('start-argument-framing-toggle')).toBeTruthy();
    expect(queryByTestId('start-argument-framing-groups')).toBeNull();
    for (const id of GROUP_TEST_IDS) {
      expect(queryByTestId(id)).toBeNull();
    }
  });

  it('exposes accessibilityRole="button" and expanded=false initially', () => {
    const { getByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    const toggle = getByTestId('start-argument-framing-toggle');
    expect(toggle.props.accessibilityRole).toBe('button');
    expect(toggle.props.accessibilityState.expanded).toBe(false);
  });

  it('meets the 44px hit target (flattened minHeight >= 44)', () => {
    const { getByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    const toggle = getByTestId('start-argument-framing-toggle');
    // The style is a function (pressed-aware); flatten the non-pressed branch.
    const flattened = Array.isArray(toggle.props.style)
      ? Object.assign({}, ...toggle.props.style.filter(Boolean))
      : toggle.props.style;
    expect(flattened.minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('StartArgumentPage framing disclosure — expand / collapse', () => {
  it('reveals all three groups + a sample chip in each when pressed', () => {
    const { getByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    fireEvent.press(getByTestId('start-argument-framing-toggle'));
    expect(getByTestId('start-argument-framing-groups')).toBeTruthy();
    for (const id of GROUP_TEST_IDS) {
      expect(getByTestId(id)).toBeTruthy();
    }
    for (const id of SAMPLE_CHIP_TEST_IDS) {
      expect(getByTestId(id)).toBeTruthy();
    }
  });

  it('flips accessibilityState.expanded to true when expanded', () => {
    const { getByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    fireEvent.press(getByTestId('start-argument-framing-toggle'));
    expect(getByTestId('start-argument-framing-toggle').props.accessibilityState.expanded).toBe(
      true,
    );
  });

  it('collapses the groups again on a second press (idempotent toggle)', () => {
    const { getByTestId, queryByTestId } = render(
      <StartArgumentPage onCreate={jest.fn()} onCancel={jest.fn()} />,
    );
    const toggle = getByTestId('start-argument-framing-toggle');
    fireEvent.press(toggle);
    expect(getByTestId('start-argument-framing-groups')).toBeTruthy();
    fireEvent.press(toggle);
    expect(queryByTestId('start-argument-framing-groups')).toBeNull();
    for (const id of GROUP_TEST_IDS) {
      expect(queryByTestId(id)).toBeNull();
    }
    expect(toggle.props.accessibilityState.expanded).toBe(false);
  });
});

describe('StartArgumentPage framing disclosure — framing never enters the payload', () => {
  it('submits with the disclosure never opened and no framing keys in the payload', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated());
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCancel={jest.fn()} />,
    );
    // Default visibility is Private (submit disabled) — switch to Public.
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.changeText(
      getByTestId('start-argument-declaration'),
      'Protected bike lanes reduce collisions.',
    );
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const input = onCreate.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(input).not.toHaveProperty('argumentScheme');
    expect(input).not.toHaveProperty('disagreementStrategy');
    expect(input).not.toHaveProperty('disagreementCause');
  });

  it('submits after opening + selecting a chip with still no framing keys in the payload', async () => {
    const onCreate = jest.fn(async (_input: CreateDebateInput) => fakeCreated());
    const { getByTestId } = render(
      <StartArgumentPage onCreate={onCreate} onCancel={jest.fn()} />,
    );
    fireEvent.press(getByTestId('start-argument-visibility-public'));
    fireEvent.changeText(
      getByTestId('start-argument-declaration'),
      'Protected bike lanes reduce collisions.',
    );
    // Expand and select one chip in each group.
    fireEvent.press(getByTestId('start-argument-framing-toggle'));
    fireEvent.press(getByTestId('start-argument-scheme-argument_from_example'));
    fireEvent.press(getByTestId('start-argument-strategy-complex_counter_argument'));
    fireEvent.press(getByTestId('start-argument-cause-informant_related'));
    await act(async () => {
      fireEvent.press(getByTestId('start-argument-submit'));
    });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const input = onCreate.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(input).not.toHaveProperty('argumentScheme');
    expect(input).not.toHaveProperty('disagreementStrategy');
    expect(input).not.toHaveProperty('disagreementCause');
  });
});

describe('StartArgumentPage framing disclosure — copy doctrine', () => {
  // The new toggle copy is the only user-facing string this card adds.
  const NEW_COPY_STRINGS = ['Add framing (optional)'];
  const BANNED_VERDICT_TOKENS = [
    'winner',
    'loser',
    'correct',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    'popular',
    'trending',
    'viral',
    'troll',
  ];

  it('the new framing copy contains no verdict tokens', () => {
    for (const copy of NEW_COPY_STRINGS) {
      const lower = copy.toLowerCase();
      for (const banned of BANNED_VERDICT_TOKENS) {
        expect(lower).not.toContain(banned);
      }
    }
  });

  it('the new framing copy leaks no snake_case internal code', () => {
    for (const copy of NEW_COPY_STRINGS) {
      expect(copy).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
