/**
 * CHIMEIN-P8 Round 2 (#761) — ChimeInGovernanceSurface activation tests.
 *
 * The dormant GAME-005 ChimeInGovernanceControl was mounted nowhere. This surface
 * ACTIVATES it behind the chime_in flag. Proves: flag OFF => null (byte-identical
 * dormant); a non-primary viewer => null; no chime-in => null; flag ON + a primary
 * viewer + an active chime-in => the control renders and a reaction toggles.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ChimeInGovernanceSurface } from '../src/features/debates/ChimeInGovernanceSurface';
import type { ChimeInContributionRow } from '../src/features/debates/chimeInContributionModel';

const INITIATOR = 'user-initiator';
const OPPONENT = 'user-opponent';
const CHIMER = 'user-chimer';

function chimeRow(over: Partial<ChimeInContributionRow> = {}): ChimeInContributionRow {
  return {
    id: 'c-1',
    debateId: 'debate-1',
    argumentId: 'arg-chime-1',
    targetArgumentId: 'point-1',
    authorId: CHIMER,
    seatIndex: 1,
    retractedAt: null,
    ...over,
  };
}

function renderSurface(over: Partial<React.ComponentProps<typeof ChimeInGovernanceSurface>> = {}) {
  return render(
    <ChimeInGovernanceSurface
      chimeInEnabled
      contributions={[chimeRow()]}
      initiatorUserId={INITIATOR}
      primaryOpponentUserId={OPPONENT}
      viewerUserId={INITIATOR}
      {...over}
    />,
  );
}

describe('ChimeInGovernanceSurface — dormant (null) cases', () => {
  it('renders null when the flag is OFF (byte-identical to the dormant control)', () => {
    const { queryByTestId } = renderSurface({ chimeInEnabled: false });
    expect(queryByTestId('chime-in-governance-surface')).toBeNull();
  });

  it('renders null when the viewer is not a primary party (only primaries govern)', () => {
    const { queryByTestId } = renderSurface({ viewerUserId: 'some-observer' });
    expect(queryByTestId('chime-in-governance-surface')).toBeNull();
  });

  it('renders null when there is no active chime-in to govern', () => {
    const { queryByTestId } = renderSurface({ contributions: [] });
    expect(queryByTestId('chime-in-governance-surface')).toBeNull();
  });

  it('renders null when the only chime row is retracted', () => {
    const { queryByTestId } = renderSurface({
      contributions: [chimeRow({ retractedAt: '2026-07-11T00:00:00.000Z' })],
    });
    expect(queryByTestId('chime-in-governance-surface')).toBeNull();
  });

  it('ignores a chime row authored by a primary party (a primary is never a chime-in)', () => {
    const { queryByTestId } = renderSurface({
      contributions: [chimeRow({ authorId: OPPONENT })],
    });
    expect(queryByTestId('chime-in-governance-surface')).toBeNull();
  });
});

describe('ChimeInGovernanceSurface — activated (flag ON + primary viewer + chime-in)', () => {
  it('renders the governance control for a primary viewer with an active chime-in', () => {
    const { getByTestId } = renderSurface();
    expect(getByTestId('chime-in-governance-surface')).toBeTruthy();
    expect(getByTestId('chime-in-governance-control')).toBeTruthy();
  });

  it('renders one control per distinct chime-in author', () => {
    const { getAllByTestId } = renderSurface({
      contributions: [
        chimeRow({ id: 'c-1', argumentId: 'a1', authorId: CHIMER, seatIndex: 1 }),
        chimeRow({ id: 'c-2', argumentId: 'a2', authorId: 'user-chimer-2', seatIndex: 2 }),
        // a second row by the same author collapses to one control
        chimeRow({ id: 'c-3', argumentId: 'a3', authorId: CHIMER, seatIndex: 3 }),
      ],
    });
    expect(getAllByTestId('chime-in-governance-control').length).toBe(2);
  });

  it('toggles a reaction (the useChimeInGovernance in-session state activates)', () => {
    const { getByTestId } = renderSurface();
    const offTrack = getByTestId('chime-in-governance-reaction-off_track');
    // Not applied initially.
    expect(offTrack.props.accessibilityState?.selected).toBe(false);
    fireEvent.press(offTrack);
    // After the toggle the control reflects the applied state.
    expect(getByTestId('chime-in-governance-reaction-off_track').props.accessibilityState?.selected).toBe(
      true,
    );
  });
});
