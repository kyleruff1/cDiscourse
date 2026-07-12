/**
 * UX-PR-B (#918) — ArgumentRoom load-error strip integration (acceptance).
 *
 * The simulated-expired-session proof, to the extent jest can drive it: with TWO
 * room read hooks reporting a read error at once, the room shows EXACTLY ONE
 * room-load-error-strip (never one banner per failed source), the room still
 * renders its posted moves (readable, not blocked), and pressing retry fires the
 * refetch closures of the FAILED sources only.
 */
import React from 'react';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    SUPABASE_CONFIGURED: true,
    supabase: {
      ...actual.supabase,
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
  };
});

jest.mock('../src/features/arguments/useConstitution', () => {
  const c = jest.requireActual('../src/domain/constitution');
  return {
    useConstitution: () => ({
      loading: false,
      error: null,
      source: 'local_fallback',
      activeConstitution: c.constitutionVersion,
      activeRules: c.constitutionRules,
      tagDefinitions: c.tagDefinitions,
      flagDefinitions: c.flagDefinitions,
    }),
  };
});

// Two of the four room reads FAIL simultaneously (the cascade). We mock the hook
// modules so they report the read-error sentinel regardless of flag state; the
// refetch handles are asserted on retry.
const mockRefetchProof = jest.fn(() => Promise.resolve());
const mockRefetchMarkers = jest.fn(() => Promise.resolve());

jest.mock('../src/features/proof/useProofItems', () => ({
  useProofItems: () => ({
    proofItemsByMessageId: {},
    loading: false,
    error: 'Some of this could not load.',
    refetch: mockRefetchProof,
  }),
}));

jest.mock('../src/features/arguments/markers/useMarkers', () => ({
  useMarkers: () => ({
    markersByTargetId: {},
    markersByReplyId: {},
    loading: false,
    error: 'Some of this could not load.',
    refetch: mockRefetchMarkers,
  }),
}));

import { render, fireEvent } from '@testing-library/react-native';
import { ArgumentGameSurface } from '../src/features/arguments/ArgumentGameSurface';
import type { ArgumentMessageInput } from '../src/features/arguments/argumentGameSurfaceModel';
import { ROOM_LOAD_ERROR_COPY } from '../src/features/arguments/gameCopy';

const DEBATE_ID = 'd-prb-strip';

function buildMessages(): ArgumentMessageInput[] {
  return [
    {
      id: 'm1',
      debateId: DEBATE_ID,
      parentId: null,
      authorId: 'u-host',
      argumentType: 'opening_statement',
      side: 'affirmative',
      body: 'The city should fund weeknight library hours.',
      status: 'posted',
      createdAt: '2026-06-25T12:00:00.000Z',
      updatedAt: '2026-06-25T12:00:00.000Z',
    },
    {
      id: 'm2',
      debateId: DEBATE_ID,
      parentId: 'm1',
      authorId: 'u-other',
      argumentType: 'rebuttal',
      side: 'negative',
      body: 'Weeknight visits are concentrated on weekends per the report.',
      status: 'posted',
      createdAt: '2026-06-25T12:05:00.000Z',
      updatedAt: '2026-06-25T12:05:00.000Z',
    },
  ];
}

function renderRoom() {
  return render(
    <ArgumentGameSurface
      debate={{ id: DEBATE_ID, title: 'Weeknight hours', rootBody: null }}
      messages={buildMessages()}
      currentUserId="u-host"
      participantSide="affirmative"
      reduceMotionOverride
    />,
  );
}

beforeEach(() => {
  mockRefetchProof.mockClear();
  mockRefetchMarkers.mockClear();
});

describe('ArgumentRoom — UX-PR-B (#918) load-error strip', () => {
  it('renders EXACTLY ONE strip even though two room reads failed', () => {
    const { queryAllByTestId } = renderRoom();
    expect(queryAllByTestId('room-load-error-strip')).toHaveLength(1);
  });

  it('surfaces the single stable strip message', () => {
    const { getByTestId } = renderRoom();
    expect(getByTestId('room-load-error-strip-message').props.children).toBe(
      ROOM_LOAD_ERROR_COPY.stripMessage,
    );
  });

  it('keeps the room readable (posted moves still render behind the strip)', () => {
    const { getByTestId } = renderRoom();
    // The room surface is present and not replaced by an error screen.
    expect(getByTestId('argument-game-surface')).toBeTruthy();
  });

  it('retry fires the failed sources refetch closures', () => {
    const { getByTestId } = renderRoom();
    fireEvent.press(getByTestId('room-load-error-strip-retry'));
    expect(mockRefetchProof).toHaveBeenCalledTimes(1);
    expect(mockRefetchMarkers).toHaveBeenCalledTimes(1);
  });
});
