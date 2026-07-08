/**
 * START-003 (#875) — PublicArgumentToggle RNTL suite (two-tap proof L2).
 *
 * 3.4 onChange emission invariant: one switch tap NEVER emits 'public' (emits
 *     'private' — the preview is still private); the SECOND tap (confirm) emits
 *     'public' exactly once.
 * 3.5 sheet-analog negative: a harness records the latest onChange value and a
 *     create control reads it — after one tap the recorded value is 'private'.
 * Plus: default OFF, flip -> panel with the two choke-point bullets, retreat
 * paths, a11y (switch role/checked/disabled, >=44px confirm/cancel,
 * color-independent status + glyph, reduce-motion conditional mount), and an
 * end-to-end J4 with the REAL toggle mounted in the StartArgumentSheet.
 */
import fs from 'fs';
import path from 'path';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { PublicArgumentToggle } from '../src/features/arguments/startArgument/PublicArgumentToggle';
import { StartArgumentSheet } from '../src/features/arguments/startArgument/StartArgumentSheet';
import type { RoomVisibility, CreateDebateInput, CreatedRoom, Debate } from '../src/features/debates/types';
import {
  ROOM_VISIBILITY_COPY,
  ARGUMENT_ROOM_CREATE_COPY,
  PUBLIC_ARGUMENT_TOGGLE_COPY,
  fillArgumentRoomCapacityCopy,
} from '../src/features/arguments/gameCopy';

const OPEN_FLOOR_CAPACITY = { capacity: 5, open: 4, reservedInviteSeats: 0 as const };

function renderToggle(overrides: Partial<React.ComponentProps<typeof PublicArgumentToggle>> = {}) {
  const onChange = jest.fn();
  const utils = render(
    <PublicArgumentToggle
      visibility="private"
      onChange={onChange}
      capacityPreview={OPEN_FLOOR_CAPACITY}
      {...overrides}
    />,
  );
  return { ...utils, onChange };
}

// ── Default OFF ─────────────────────────────────────────────────

describe('PublicArgumentToggle — default OFF', () => {
  it('switch is unchecked and the consequences panel is absent', () => {
    const { getByTestId, queryByTestId } = renderToggle();
    expect(getByTestId('public-argument-toggle-switch').props.accessibilityState.checked).toBe(false);
    expect(queryByTestId('public-argument-toggle-panel')).toBeNull();
  });
});

// ── Flip -> panel with the two choke-point bullets ──────────────

describe('PublicArgumentToggle — flip shows the consequences', () => {
  it('renders the visibility + capacity bullets from choke-point copy only', () => {
    const { getByTestId } = renderToggle();
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true);
    expect(getByTestId('public-argument-toggle-panel')).toBeTruthy();
    expect(getByTestId('public-argument-toggle-visibility-bullet').props.children).toBe(
      ROOM_VISIBILITY_COPY.option_public_helper,
    );
    expect(getByTestId('public-argument-toggle-capacity-bullet').props.children).toBe(
      fillArgumentRoomCapacityCopy(ARGUMENT_ROOM_CREATE_COPY.capacity_public_open, { capacity: 5, open: 4 }),
    );
  });

  it('uses the reserved-seat capacity template when an invite reserves a seat', () => {
    const { getByTestId } = renderToggle({
      capacityPreview: { capacity: 5, open: 3, reservedInviteSeats: 1 },
    });
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true);
    expect(getByTestId('public-argument-toggle-capacity-bullet').props.children).toBe(
      fillArgumentRoomCapacityCopy(ARGUMENT_ROOM_CREATE_COPY.capacity_public_reserved, { capacity: 5, open: 3 }),
    );
  });
});

// ── 3.4 onChange emission invariant ─────────────────────────────

describe('PublicArgumentToggle — 3.4 one tap never emits public', () => {
  it('one switch tap emits private (not public); the confirm emits public once', () => {
    const { getByTestId, onChange } = renderToggle();

    // Tap 1: flip the switch.
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true);
    // NEVER 'public' from a single tap.
    expect(onChange).not.toHaveBeenCalledWith('public');
    expect(onChange).toHaveBeenLastCalledWith('private');
    // Preview is visible; status says not-yet-public (color-independent).
    expect(getByTestId('public-argument-toggle-status').props.children).toBe(
      PUBLIC_ARGUMENT_TOGGLE_COPY.status_not_yet_public,
    );

    // Tap 2: confirm.
    fireEvent.press(getByTestId('public-argument-toggle-confirm'));
    const publicCalls = onChange.mock.calls.filter((c) => c[0] === 'public');
    expect(publicCalls).toHaveLength(1);
    // Confirmed status + glyph.
    expect(getByTestId('public-argument-toggle-status').props.children).toBe(
      PUBLIC_ARGUMENT_TOGGLE_COPY.status_confirmed,
    );
    expect(getByTestId('public-argument-toggle-confirmed-glyph')).toBeTruthy();
  });
});

// ── 3.5 sheet-analog negative ───────────────────────────────────

function Harness() {
  const [committed, setCommitted] = useState<RoomVisibility>('private');
  const [readAtCreate, setReadAtCreate] = useState<RoomVisibility | null>(null);
  return (
    <View>
      <PublicArgumentToggle
        visibility={committed}
        onChange={setCommitted}
        capacityPreview={OPEN_FLOOR_CAPACITY}
      />
      <Pressable testID="harness-create" onPress={() => setReadAtCreate(committed)}>
        <Text>create</Text>
      </Pressable>
      <Text testID="harness-read">{readAtCreate ?? 'none'}</Text>
    </View>
  );
}

describe('PublicArgumentToggle — 3.5 sheet-analog cannot hold public after one tap', () => {
  it('after ONE tap, the recorded create-time visibility is private', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true); // one tap
    fireEvent.press(getByTestId('harness-create'));
    expect(getByTestId('harness-read').props.children).toBe('private');
  });

  it('only after the SECOND tap (confirm) does the recorded visibility become public', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true); // tap 1
    fireEvent.press(getByTestId('public-argument-toggle-confirm')); // tap 2
    fireEvent.press(getByTestId('harness-create'));
    expect(getByTestId('harness-read').props.children).toBe('public');
  });
});

// ── Retreat paths ───────────────────────────────────────────────

describe('PublicArgumentToggle — retreat paths', () => {
  it('flip_off from preview reverts to private and unmounts the panel', () => {
    const { getByTestId, queryByTestId, onChange } = renderToggle();
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true);
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', false);
    expect(onChange).toHaveBeenLastCalledWith('private');
    expect(queryByTestId('public-argument-toggle-panel')).toBeNull();
  });

  it('dismiss ("Keep it private") from confirmed reverts to private', () => {
    const { getByTestId, queryByTestId, onChange } = renderToggle();
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true);
    fireEvent.press(getByTestId('public-argument-toggle-confirm'));
    expect(onChange).toHaveBeenLastCalledWith('public');
    fireEvent.press(getByTestId('public-argument-toggle-cancel'));
    expect(onChange).toHaveBeenLastCalledWith('private');
    expect(queryByTestId('public-argument-toggle-panel')).toBeNull();
  });
});

// ── A11y ────────────────────────────────────────────────────────

describe('PublicArgumentToggle — a11y', () => {
  it('switch has role switch + label + hint + checked state tracking', () => {
    const { getByTestId } = renderToggle();
    const sw = getByTestId('public-argument-toggle-switch');
    expect(sw.props.accessibilityRole).toBe('switch');
    expect(sw.props.accessibilityLabel).toBe(PUBLIC_ARGUMENT_TOGGLE_COPY.switch_label);
    expect(sw.props.accessibilityHint).toBe(PUBLIC_ARGUMENT_TOGGLE_COPY.switch_a11y_hint);
    expect(sw.props.accessibilityState.checked).toBe(false);
    fireEvent(sw, 'valueChange', true);
    expect(getByTestId('public-argument-toggle-switch').props.accessibilityState.checked).toBe(true);
  });

  it('confirm + cancel are >= 44px buttons', () => {
    const { getByTestId } = renderToggle();
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true);
    for (const id of ['public-argument-toggle-confirm', 'public-argument-toggle-cancel']) {
      const el = getByTestId(id);
      expect(el.props.accessibilityRole).toBe('button');
      expect(StyleSheet.flatten(el.props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('disabled freezes the switch + confirm (accessibilityState.disabled)', () => {
    const { getByTestId } = renderToggle({ visibility: 'public', disabled: true });
    // visibility public => initial state public_confirmed => panel present.
    expect(getByTestId('public-argument-toggle-switch').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('public-argument-toggle-confirm').props.accessibilityState.disabled).toBe(true);
  });

  it('is reduce-motion safe — conditional-mount panel, no Animated in the source', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/arguments/startArgument/PublicArgumentToggle.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/Animated/);
  });
});

// ── End-to-end J4 with the REAL toggle in the sheet ─────────────

function fakeCreated(): CreatedRoom {
  const debate: Debate = {
    id: 'deb-1', createdBy: 'user-1', title: 'T', resolution: 'R', description: '',
    status: 'open', constitutionId: 'const-1', createdAt: '2026-07-08T00:00:00.000Z',
    updatedAt: '2026-07-08T00:00:00.000Z', myParticipantSide: 'moderator', visibility: 'public',
  };
  return { debate, inviteLink: null };
}

describe('J4 end-to-end — real PublicArgumentToggle in StartArgumentSheet', () => {
  it('open floor -> flip -> consequences -> confirm -> public submit enabled', () => {
    const onCreate = jest.fn(async (_i: CreateDebateInput) => fakeCreated());
    const { getByTestId, queryByTestId } = render(
      <StartArgumentSheet
        onCreate={onCreate}
        onCancel={jest.fn()}
        recents={[]}
        renderPublicToggle={(p) => <PublicArgumentToggle {...p} />}
      />,
    );
    fireEvent.changeText(getByTestId('start-sheet-declaration'), 'A public claim to debate.');

    // Tap 1 — open floor auto-expands Advanced; the real toggle mounts OFF.
    fireEvent.press(getByTestId('person-picker-open-floor'));
    expect(getByTestId('public-argument-toggle')).toBeTruthy();
    expect(queryByTestId('public-argument-toggle-panel')).toBeNull();
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(true);

    // Flip — consequences panel appears (validator-derived capacity numbers).
    fireEvent(getByTestId('public-argument-toggle-switch'), 'valueChange', true);
    expect(getByTestId('public-argument-toggle-capacity-bullet').props.children).toBe(
      fillArgumentRoomCapacityCopy(ARGUMENT_ROOM_CREATE_COPY.capacity_public_open, { capacity: 5, open: 4 }),
    );
    // Still not public — one flip is not two taps.
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(true);

    // Tap 2 — confirm. Now the public create is valid.
    fireEvent.press(getByTestId('public-argument-toggle-confirm'));
    expect(getByTestId('start-sheet-submit').props.accessibilityState.disabled).toBe(false);
  });
});
