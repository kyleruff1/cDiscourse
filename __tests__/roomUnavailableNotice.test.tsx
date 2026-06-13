/**
 * ARG-ROOM-006 (item c) — RoomUnavailableNotice render + a11y + no-enumeration.
 *
 * The notice is shown when a deep link resolves to `unavailable`. It must read
 * cause-neutrally (IDENTICAL for a private room the viewer cannot see and a
 * nonexistent id) and never confirm a private room exists.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RoomUnavailableNotice } from '../src/features/debates/RoomUnavailableNotice';
import { ROOM_ACCESS_COPY } from '../src/features/arguments/gameCopy';

describe('RoomUnavailableNotice', () => {
  it('renders the cause-neutral title + body when visible', () => {
    const { getByTestId, getByText } = render(
      <RoomUnavailableNotice visible onDismiss={jest.fn()} />,
    );
    expect(getByTestId('room-unavailable-notice')).toBeTruthy();
    expect(getByText(ROOM_ACCESS_COPY.unavailable_title)).toBeTruthy();
    expect(getByText(ROOM_ACCESS_COPY.unavailable_body)).toBeTruthy();
  });

  it('NEVER reveals that a private room exists (no enumeration)', () => {
    const { getByText } = render(<RoomUnavailableNotice visible onDismiss={jest.fn()} />);
    const body = getByText(ROOM_ACCESS_COPY.unavailable_body);
    const text = String(body.props.children).toLowerCase();
    expect(text).not.toContain('it is private');
    expect(text).not.toContain('only invited');
    expect(text).not.toContain('private room');
  });

  it('the dismiss control is a 44-target button with a screen-reader label', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(<RoomUnavailableNotice visible onDismiss={onDismiss} />);
    const btn = getByTestId('room-unavailable-dismiss');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(String(btn.props.accessibilityLabel).length).toBeGreaterThan(0);
    // 44×44 target via visual min-height + hitSlop.
    expect(btn.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
    fireEvent.press(btn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the heading is exposed to assistive tech as a header', () => {
    const { getByText } = render(<RoomUnavailableNotice visible onDismiss={jest.fn()} />);
    expect(getByText(ROOM_ACCESS_COPY.unavailable_title).props.accessibilityRole).toBe('header');
  });
});
