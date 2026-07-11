/**
 * QUOTE-FORGE-002 (#842) — CallbackEchoStrip render + a11y + privacy.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CallbackEchoStrip } from '../src/features/arguments/crossRoom/CallbackEchoStrip';
import {
  deriveCallbackEcho,
  type ResolvedPriorLink,
} from '../src/features/arguments/crossRoom/callbackEchoModel';
import type { CrossRoomCallbackRef } from '../src/features/arguments/crossRoom/crossRoomCallbackRef';

const EXCERPT = 'Protected lanes reduce collisions on arterials.';
const REF: CrossRoomCallbackRef = {
  targetDebateId: 'debate-prior-1',
  excerpt: EXCERPT,
  targetTitleSnapshot: 'Bike-lane baseline',
  capturedFromArgumentId: 'arg-9',
  v: 1,
};

function echoFor(accessState: ResolvedPriorLink['accessState']) {
  const link: ResolvedPriorLink | null =
    accessState === 'unavailable'
      ? null
      : { targetDebateId: 'debate-prior-1', accessState, title: 'Bike-lane baseline' };
  return deriveCallbackEcho({ messageId: 'm1', ref: REF, link })!;
}

describe('CallbackEchoStrip', () => {
  it('authorized — renders the quote strip + a tappable origin firing onOpenOrigin', () => {
    const onOpenOrigin = jest.fn();
    const { getByTestId } = render(
      <CallbackEchoStrip echo={echoFor('authorized')} onOpenOrigin={onOpenOrigin} />,
    );
    expect(getByTestId('callback-echo-strip-quote').props.children).toBe(EXCERPT);
    const origin = getByTestId('callback-echo-strip-origin');
    expect(origin.props.accessibilityRole).toBe('button');
    expect(origin.props.hitSlop).toBeTruthy();
    fireEvent.press(origin);
    expect(onOpenOrigin).toHaveBeenCalledWith('debate-prior-1');
  });

  it('title_only — no quote strip, origin NOT a button, excerpt absent from the tree', () => {
    const { queryByTestId, getByTestId, toJSON } = render(
      <CallbackEchoStrip echo={echoFor('title_only')} onOpenOrigin={jest.fn()} />,
    );
    expect(queryByTestId('callback-echo-strip-quote')).toBeNull();
    const origin = getByTestId('callback-echo-strip-origin');
    expect(origin.props.accessibilityRole).toBeUndefined();
    expect(JSON.stringify(toJSON())).not.toContain(EXCERPT);
  });

  it('unavailable — neutral line only, no quote strip', () => {
    const { queryByTestId, getByTestId } = render(
      <CallbackEchoStrip echo={echoFor('unavailable')} onOpenOrigin={jest.fn()} />,
    );
    expect(queryByTestId('callback-echo-strip-quote')).toBeNull();
    expect(getByTestId('callback-echo-strip').props).toBeTruthy();
  });

  it('authorized without an onOpenOrigin handler renders the origin as plain text (no tap)', () => {
    const { getByTestId } = render(<CallbackEchoStrip echo={echoFor('authorized')} />);
    const origin = getByTestId('callback-echo-strip-origin');
    expect(origin.props.accessibilityRole).toBeUndefined();
  });
});
