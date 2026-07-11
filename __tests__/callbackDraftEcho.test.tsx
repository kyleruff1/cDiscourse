/**
 * UX-COMPOSER-005 (#831) — CallbackDraftEcho render + a11y.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CallbackDraftEcho } from '../src/features/arguments/crossRoom/CallbackDraftEcho';
import type { CrossRoomCallback } from '../src/features/arguments/crossRoom/crossRoomCallbackRef';

const CALLBACK: CrossRoomCallback = {
  targetDebateId: 'debate-prior-1',
  targetTitleSnapshot: 'Bike-lane baseline',
  excerpt: 'Protected lanes reduce collisions on arterials.',
  capturedFromArgumentId: 'arg-9',
};

describe('CallbackDraftEcho', () => {
  it('renders the header, quoted line, and origin line', () => {
    const { getByTestId } = render(<CallbackDraftEcho callback={CALLBACK} />);
    expect(getByTestId('callback-draft-echo')).toBeTruthy();
    expect(getByTestId('callback-draft-echo-quote').props.children).toBe(
      'Protected lanes reduce collisions on arterials.',
    );
    expect(getByTestId('callback-draft-echo-origin').props.children).toBe(
      'Callback to “Bike-lane baseline”',
    );
  });

  it('renders a Remove control (role button + a11y label + hitSlop) that fires onRemove', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(<CallbackDraftEcho callback={CALLBACK} onRemove={onRemove} />);
    const remove = getByTestId('callback-draft-echo-remove');
    expect(remove.props.accessibilityRole).toBe('button');
    expect(typeof remove.props.accessibilityLabel).toBe('string');
    expect(remove.props.accessibilityLabel.length).toBeGreaterThan(0);
    expect(remove.props.hitSlop).toBeTruthy();
    fireEvent.press(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('omits the Remove control when onRemove is absent', () => {
    const { queryByTestId } = render(<CallbackDraftEcho callback={CALLBACK} />);
    expect(queryByTestId('callback-draft-echo-remove')).toBeNull();
  });

  it('omits the origin line when the title snapshot is blank (color-independent identity remains)', () => {
    const { queryByTestId, getByTestId } = render(
      <CallbackDraftEcho callback={{ ...CALLBACK, targetTitleSnapshot: '' }} />,
    );
    expect(queryByTestId('callback-draft-echo-origin')).toBeNull();
    // The identity (header + quote) is still present without color.
    expect(getByTestId('callback-draft-echo')).toBeTruthy();
    expect(getByTestId('callback-draft-echo-quote')).toBeTruthy();
  });
});
