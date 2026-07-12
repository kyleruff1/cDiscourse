/**
 * UX-PR-B (#918) — JoinDebatePanel inline failure feedback (P2-10).
 *
 * onJoin now returns JoinPanelFeedback. A non-join (full room / failure) keeps
 * the panel mounted and surfaces an inline ErrorNotice; a taken seat resolves
 * joined:true and the parent (not the panel) closes it.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { JoinDebatePanel } from '../src/features/debates/JoinDebatePanel';
import { SEAT_CLAIM_COPY } from '../src/features/arguments/gameCopy';
import type { Debate } from '../src/features/debates/types';

const DEBATE = {
  id: 'd1',
  title: 'Weeknight library hours',
  resolution: 'The city should fund weeknight library hours.',
} as unknown as Debate;

async function selectAndJoin(getByLabelText: (name: string) => unknown) {
  fireEvent.press(getByLabelText('Affirmative') as never);
  await act(async () => {
    fireEvent.press(getByLabelText('Join') as never);
  });
}

describe('JoinDebatePanel — UX-PR-B (#918) inline feedback', () => {
  it('renders an inline ErrorNotice when onJoin reports a failure', async () => {
    const onJoin = jest.fn().mockResolvedValue({
      joined: false,
      message: SEAT_CLAIM_COPY.joinFailed,
    });
    const { getByLabelText, queryByText } = render(
      <JoinDebatePanel debate={DEBATE} onJoin={onJoin} onCancel={jest.fn()} />,
    );
    expect(queryByText(SEAT_CLAIM_COPY.joinFailed)).toBeNull();
    await selectAndJoin(getByLabelText);
    await waitFor(() => {
      expect(queryByText(SEAT_CLAIM_COPY.joinFailed)).toBeTruthy();
    });
  });

  it('surfaces the full-room observe copy in-panel when the room is full', async () => {
    const onJoin = jest.fn().mockResolvedValue({
      joined: false,
      message: SEAT_CLAIM_COPY.fullRoomObserve,
    });
    const { getByLabelText, queryByText } = render(
      <JoinDebatePanel debate={DEBATE} onJoin={onJoin} onCancel={jest.fn()} />,
    );
    await selectAndJoin(getByLabelText);
    await waitFor(() => {
      expect(queryByText(SEAT_CLAIM_COPY.fullRoomObserve)).toBeTruthy();
    });
  });

  it('surfaces NO in-panel error when the join succeeds', async () => {
    const onJoin = jest.fn().mockResolvedValue({ joined: true, message: null });
    const { getByLabelText, queryByText } = render(
      <JoinDebatePanel debate={DEBATE} onJoin={onJoin} onCancel={jest.fn()} />,
    );
    await selectAndJoin(getByLabelText);
    await waitFor(() => {
      expect(onJoin).toHaveBeenCalledTimes(1);
    });
    expect(queryByText(SEAT_CLAIM_COPY.joinFailed)).toBeNull();
    expect(queryByText(SEAT_CLAIM_COPY.fullRoomObserve)).toBeNull();
  });
});
