/**
 * CHIMEIN-P8 Round 2 (#761) — ChimeInAffordance tests (design 4.2 clause 1).
 *
 * The flag-gated "Chime in on this point" control. Proves the actor-gating (flag
 * off / private / observer / principal / someone else move / root reply / seats
 * full => null), the attach + retract call shapes, and doctrine-clean copy. Each
 * dormant case is paired against the eligible baseline (the firing control).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  ChimeInAffordance,
  CHIME_IN_AFFORDANCE_COPY,
  type ChimeInAffordanceProps,
} from '../src/features/debates/ChimeInAffordance';
import type { ChimeInContributionRow } from '../src/features/debates/chimeInContributionModel';

const VIEWER = 'user-viewer';
const INITIATOR = 'user-initiator';
const OPPONENT = 'user-opponent';

function chimeRow(over: Partial<ChimeInContributionRow> = {}): ChimeInContributionRow {
  return {
    id: 'c-1',
    debateId: 'debate-1',
    argumentId: 'my-reply',
    targetArgumentId: 'point-1',
    authorId: VIEWER,
    seatIndex: 1,
    retractedAt: null,
    ...over,
  };
}

const onAttach = jest.fn();
const onRetract = jest.fn();

function props(over: Partial<ChimeInAffordanceProps> = {}): ChimeInAffordanceProps {
  return {
    chimeInEnabled: true,
    roomVisibility: 'public',
    viewerUserId: VIEWER,
    viewerParticipantSide: 'affirmative',
    initiatorUserId: INITIATOR,
    primaryOpponentUserId: OPPONENT,
    candidate: { argumentId: 'my-reply', parentId: 'point-1', authorId: VIEWER },
    contributions: [],
    onAttach,
    onRetract,
    ...over,
  };
}

beforeEach(() => {
  onAttach.mockReset();
  onRetract.mockReset();
});

describe('ChimeInAffordance — dormant (null) cases', () => {
  it('the eligible baseline DOES render (the firing control for the null cases)', () => {
    const { getByTestId } = render(<ChimeInAffordance {...props()} />);
    expect(getByTestId('chime-in-affordance-attach')).toBeTruthy();
  });

  it('renders null when the flag is OFF', () => {
    const { queryByTestId } = render(<ChimeInAffordance {...props({ chimeInEnabled: false })} />);
    expect(queryByTestId('chime-in-affordance')).toBeNull();
  });

  it('renders null in a private room (public-only)', () => {
    const { queryByTestId } = render(<ChimeInAffordance {...props({ roomVisibility: 'private' })} />);
    expect(queryByTestId('chime-in-affordance')).toBeNull();
  });

  it('renders null for an observer (cannot post a side reply)', () => {
    const { queryByTestId } = render(
      <ChimeInAffordance {...props({ viewerParticipantSide: 'observer' })} />,
    );
    expect(queryByTestId('chime-in-affordance')).toBeNull();
  });

  it('renders null for a principal viewer (a principal is never a chime-in)', () => {
    const { queryByTestId } = render(<ChimeInAffordance {...props({ viewerUserId: INITIATOR })} />);
    expect(queryByTestId('chime-in-affordance')).toBeNull();
  });

  it('renders null when the candidate is not the viewer own reply', () => {
    const { queryByTestId } = render(
      <ChimeInAffordance
        {...props({ candidate: { argumentId: 'their-reply', parentId: 'point-1', authorId: 'someone-else' } })}
      />,
    );
    expect(queryByTestId('chime-in-affordance')).toBeNull();
  });

  it('renders null for a root reply with no point (not point-scoped)', () => {
    const { queryByTestId } = render(
      <ChimeInAffordance {...props({ candidate: { argumentId: 'my-reply', parentId: null, authorId: VIEWER } })} />,
    );
    expect(queryByTestId('chime-in-affordance')).toBeNull();
  });

  it('renders null when the chime seats are full and the viewer has not chimed', () => {
    const full: ChimeInContributionRow[] = [
      chimeRow({ id: 'a', argumentId: 'a1', authorId: 'u1', seatIndex: 1 }),
      chimeRow({ id: 'b', argumentId: 'a2', authorId: 'u2', seatIndex: 2 }),
      chimeRow({ id: 'c', argumentId: 'a3', authorId: 'u3', seatIndex: 3 }),
    ];
    const { queryByTestId } = render(<ChimeInAffordance {...props({ contributions: full })} />);
    expect(queryByTestId('chime-in-affordance')).toBeNull();
  });
});

describe('ChimeInAffordance — attach', () => {
  it('renders the attach control and calls onAttach with the point-scoped shape', () => {
    const { getByTestId } = render(<ChimeInAffordance {...props()} />);
    const btn = getByTestId('chime-in-affordance-attach');
    expect(btn.props.accessibilityLabel).toBe(CHIME_IN_AFFORDANCE_COPY.attachA11y);
    fireEvent.press(btn);
    expect(onAttach).toHaveBeenCalledWith({ argumentId: 'my-reply', targetArgumentId: 'point-1' });
    expect(onRetract).not.toHaveBeenCalled();
  });

  it('is disabled while busy', () => {
    const { getByTestId } = render(<ChimeInAffordance {...props({ busy: true })} />);
    expect(getByTestId('chime-in-affordance-attach').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('ChimeInAffordance — retract (already chimed)', () => {
  it('renders the retract control and calls onRetract when the viewer already chimed this reply', () => {
    const { getByTestId, queryByTestId } = render(
      <ChimeInAffordance {...props({ contributions: [chimeRow({ argumentId: 'my-reply' })] })} />,
    );
    expect(queryByTestId('chime-in-affordance-attach')).toBeNull();
    const btn = getByTestId('chime-in-affordance-retract');
    fireEvent.press(btn);
    expect(onRetract).toHaveBeenCalledWith({ argumentId: 'my-reply' });
    expect(onAttach).not.toHaveBeenCalled();
  });
});

describe('ChimeInAffordance — doctrine (ban-list clean copy)', () => {
  it('no affordance string carries a verdict / amplification / third-voice token', () => {
    const BANNED = [
      'winner', 'loser', 'correct', 'true', 'false', 'liar', 'dishonest',
      'popular', 'trending', 'viral', 'upvote', 'downvote', 'third principal', 'third voice',
    ];
    for (const message of Object.values(CHIME_IN_AFFORDANCE_COPY)) {
      const lower = message.toLowerCase();
      for (const token of BANNED) expect(lower).not.toContain(token);
      expect(message).not.toMatch(/[a-z]+_[a-z]+/); // no snake_case leak
    }
  });
});
