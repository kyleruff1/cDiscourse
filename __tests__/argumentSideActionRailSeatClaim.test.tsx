/**
 * ARG-ROOM-005 (#616) — ArgumentSideActionRail full-room behavior.
 *
 * When canClaimActiveSeat===false the Join For / Join Against chips render
 * DISABLED (accessibilityState.disabled + 44x44 hitSlop preserved) and a polite
 * observe nudge shows; Watch / Share stay enabled. undefined/true => chips
 * enabled (back-compat). The locked action-set contract is untouched (that lives
 * in railActionGrouping.test.ts).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ArgumentSideActionRail } from '../src/features/arguments/ArgumentSideActionRail';

const NUDGE = 'This argument is full. You can still watch.';

function renderRail(over: Record<string, unknown> = {}) {
  const onAction = jest.fn();
  const utils = render(
    <ArgumentSideActionRail
      viewerRole="observer"
      bubbleActor="other"
      defaultCollapsed={false}
      onAction={onAction}
      windowWidth={1280}
      windowHeight={800}
      reduceMotionOverride
      {...over}
    />,
  );
  return { onAction, ...utils };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

describe('ArgumentSideActionRail — full room (canClaimActiveSeat === false)', () => {
  it('disables the Join For / Join Against chips and shows the observe nudge', () => {
    const { getByTestId } = renderRail({ canClaimActiveSeat: false, fullRoomNotice: NUDGE });

    for (const code of ['join_aff', 'join_neg'] as const) {
      const chip = getByTestId(`rail-action-${code}`);
      expect(chip.props.accessibilityState).toMatchObject({ disabled: true });
      expect(chip.props.accessibilityRole).toBe('button');
    }
    expect(getByTestId('rail-full-room-notice').props.children).toBe(NUDGE);
  });

  it('keeps Watch enabled and still dispatches it', () => {
    const { getByTestId, onAction } = renderRail({
      canClaimActiveSeat: false,
      fullRoomNotice: NUDGE,
    });
    const watch = getByTestId('rail-action-watch');
    expect(watch.props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(watch);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('watch', expect.anything());
  });

  it('a disabled Join chip does not dispatch onAction', () => {
    const { getByTestId, onAction } = renderRail({
      canClaimActiveSeat: false,
      fullRoomNotice: NUDGE,
    });
    fireEvent.press(getByTestId('rail-action-join_aff'));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('disabled Join chips keep a >= 44 px target + hitSlop (accessibility-targets)', () => {
    const { getByTestId } = renderRail({ canClaimActiveSeat: false, fullRoomNotice: NUDGE });
    const chip = getByTestId('rail-action-join_aff');
    const style = flattenStyle(chip.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(chip.props.hitSlop).toBeTruthy();
  });
});

describe('ArgumentSideActionRail — claimable / back-compat', () => {
  it('enables the Join chips and shows no nudge when canClaimActiveSeat === true', () => {
    const { getByTestId, queryByTestId, onAction } = renderRail({ canClaimActiveSeat: true });
    const join = getByTestId('rail-action-join_aff');
    expect(join.props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(join);
    expect(onAction).toHaveBeenCalledWith('join_aff', expect.anything());
    expect(queryByTestId('rail-full-room-notice')).toBeNull();
  });

  it('omitting the props leaves the Join chips enabled (pre-ARG-ROOM-005 behavior)', () => {
    const { getByTestId, queryByTestId, onAction } = renderRail();
    fireEvent.press(getByTestId('rail-action-join_neg'));
    expect(onAction).toHaveBeenCalledWith('join_neg', expect.anything());
    expect(queryByTestId('rail-full-room-notice')).toBeNull();
  });
});
