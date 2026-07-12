/**
 * UX-PR-B (#918) — RoomLoadErrorStrip component.
 *
 * Renders null when nothing failed; otherwise a single live-region notice with a
 * retry control that meets role + label + 44x44. Non-blocking, muted.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RoomLoadErrorStrip } from '../src/features/arguments/room/RoomLoadErrorStrip';
import { ROOM_LOAD_ERROR_COPY } from '../src/features/arguments/gameCopy';
import type { RoomLoadErrorStripState } from '../src/features/arguments/room/roomLoadErrorModel';

const HIDDEN: RoomLoadErrorStripState = {
  visible: false,
  message: ROOM_LOAD_ERROR_COPY.stripMessage,
  failedSources: [],
};
const VISIBLE: RoomLoadErrorStripState = {
  visible: true,
  message: ROOM_LOAD_ERROR_COPY.stripMessage,
  failedSources: ['proof', 'markers'],
};

describe('RoomLoadErrorStrip', () => {
  it('renders null when the state is not visible', () => {
    const { queryByTestId } = render(
      <RoomLoadErrorStrip state={HIDDEN} onRetry={jest.fn()} />,
    );
    expect(queryByTestId('room-load-error-strip')).toBeNull();
  });

  it('renders the stable message + retry when visible', () => {
    const { getByTestId } = render(
      <RoomLoadErrorStrip state={VISIBLE} onRetry={jest.fn()} />,
    );
    expect(getByTestId('room-load-error-strip-message').props.children).toBe(
      ROOM_LOAD_ERROR_COPY.stripMessage,
    );
    expect(getByTestId('room-load-error-strip-retry')).toBeTruthy();
  });

  it('exposes a polite live region on the container', () => {
    const { getByTestId } = render(
      <RoomLoadErrorStrip state={VISIBLE} onRetry={jest.fn()} />,
    );
    expect(getByTestId('room-load-error-strip').props.accessibilityLiveRegion).toBe('polite');
  });

  it('the retry control has button role, a label, and a >=44 hit target', () => {
    const { getByTestId } = render(
      <RoomLoadErrorStrip state={VISIBLE} onRetry={jest.fn()} />,
    );
    const retry = getByTestId('room-load-error-strip-retry');
    expect(retry.props.accessibilityRole).toBe('button');
    expect(retry.props.accessibilityLabel).toBe(ROOM_LOAD_ERROR_COPY.retryA11y);
    // 44x44 via visual minHeight/minWidth + hitSlop padding.
    const flat = Array.isArray(retry.props.style)
      ? Object.assign({}, ...retry.props.style)
      : retry.props.style;
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    expect(flat.minWidth).toBeGreaterThanOrEqual(44);
    expect(retry.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
  });

  it('fires onRetry when the retry control is pressed', () => {
    const onRetry = jest.fn();
    const { getByTestId } = render(
      <RoomLoadErrorStrip state={VISIBLE} onRetry={onRetry} />,
    );
    fireEvent.press(getByTestId('room-load-error-strip-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
