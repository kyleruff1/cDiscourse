/**
 * SETTLE-001 (#911) — RoomSettledNotice render + creator re-open contract.
 *
 * Renders the calm read-only notice when locked; the creator (canReopen) sees a
 * Re-open control that gates onReopen behind the confirm sheet; non-creators
 * see the notice only. Failure surfaces a neutral inline error (never raw).
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RoomSettledNotice } from '../src/features/debates/RoomSettledNotice';
import { ROOM_SETTLE_COPY } from '../src/features/debates/settleRoomModel';

describe('RoomSettledNotice — render', () => {
  it('renders the settled title + body when the room is locked', () => {
    const { getByTestId, getByText } = render(
      <RoomSettledNotice status="locked" canReopen={false} onReopen={jest.fn()} />,
    );
    expect(getByTestId('room-settled-notice')).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.notice_settled_title)).toBeTruthy();
    expect(getByText(ROOM_SETTLE_COPY.notice_settled_body)).toBeTruthy();
  });

  it('renders nothing for a non-locked room (defensive guard)', () => {
    const { queryByTestId } = render(
      <RoomSettledNotice status="open" canReopen onReopen={jest.fn()} />,
    );
    expect(queryByTestId('room-settled-notice')).toBeNull();
  });
});

describe('RoomSettledNotice — creator re-open affordance (actor-gated)', () => {
  it('a creator (canReopen) sees the Re-open action', () => {
    const { getByTestId } = render(
      <RoomSettledNotice status="locked" canReopen onReopen={jest.fn()} />,
    );
    expect(getByTestId('room-settled-reopen-action')).toBeTruthy();
  });

  it('a non-creator (canReopen=false) does NOT see the Re-open action', () => {
    const { queryByTestId } = render(
      <RoomSettledNotice status="locked" canReopen={false} onReopen={jest.fn()} />,
    );
    expect(queryByTestId('room-settled-reopen-action')).toBeNull();
  });

  it('tapping Re-open opens the confirm sheet WITHOUT calling onReopen', () => {
    const onReopen = jest.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(
      <RoomSettledNotice status="locked" canReopen onReopen={onReopen} />,
    );
    fireEvent.press(getByTestId('room-settled-reopen-action'));
    // The write is gated behind the confirm — opening the sheet is not a write.
    expect(onReopen).not.toHaveBeenCalled();
    expect(getByTestId('room-settle-confirmation-reopen')).toBeTruthy();
  });

  it('confirming the sheet calls onReopen exactly once', async () => {
    const onReopen = jest.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(
      <RoomSettledNotice status="locked" canReopen onReopen={onReopen} />,
    );
    fireEvent.press(getByTestId('room-settled-reopen-action'));
    fireEvent.press(getByTestId('room-settle-confirm'));
    await waitFor(() => expect(onReopen).toHaveBeenCalledTimes(1));
  });

  it('surfaces a neutral inline error when re-open fails (never the raw string)', async () => {
    const onReopen = jest.fn().mockResolvedValue({ ok: false, error: 'permission denied' });
    const { getByTestId, getByText, queryByText } = render(
      <RoomSettledNotice status="locked" canReopen onReopen={onReopen} />,
    );
    fireEvent.press(getByTestId('room-settled-reopen-action'));
    fireEvent.press(getByTestId('room-settle-confirm'));
    await waitFor(() => expect(getByTestId('room-settled-reopen-error')).toBeTruthy());
    expect(getByText(ROOM_SETTLE_COPY.error_network)).toBeTruthy();
    expect(queryByText('permission denied')).toBeNull();
  });
});
