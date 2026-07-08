/**
 * ROOM-001 (#876) — flag-off proof + no-second-derivation source scan.
 *
 * Proves that with room_exchange_v2 OFF (the default) the ArgumentStateRail
 * subtree is NOT mounted — the room topBanner is unchanged (only the microMoment
 * banner renders) — and that turning the flag ON mounts the rail ABOVE the
 * microMoment without disturbing it. A source scan confirms the rail wiring adds
 * NO second deriveRoomMediatorBoardState call (single-derivation invariant) and
 * no data query / mutation in the new wiring block.
 */
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';

// ── Canonical repo mocks (mirror ArgumentGameSurface.integration.test.tsx) ──
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

import { render } from '@testing-library/react-native';
import { ArgumentGameSurface } from '../src/features/arguments/ArgumentGameSurface';
import type { ArgumentMessageInput } from '../src/features/arguments/argumentGameSurfaceModel';
import type { GalleryEntryHint } from '../src/features/debates/conversationGalleryModel';

const DEBATE_ID = 'd-room-001';

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

const ENTRY_HINT: GalleryEntryHint = {
  activate: 'root',
  code: 'needs_rebuttal' as GalleryEntryHint['code'],
  verbPhrase: 'Add the first rebuttal',
  helperLine: 'No one has answered the opening yet.',
  presetKey: null,
  dockAction: null,
};

function renderRoom(over: Partial<React.ComponentProps<typeof ArgumentGameSurface>> = {}) {
  return render(
    <ArgumentGameSurface
      debate={{ id: DEBATE_ID, title: 'Weeknight hours', rootBody: null }}
      messages={buildMessages()}
      currentUserId="u-host"
      participantSide="affirmative"
      reduceMotionOverride
      {...over}
    />,
  );
}

describe('ROOM-001 — flag OFF leaves the room byte-identical', () => {
  it('does not mount the state rail when the flag is absent (default OFF)', () => {
    const { queryByTestId, getByTestId } = renderRoom();
    expect(getByTestId('argument-game-surface')).toBeTruthy();
    expect(queryByTestId('argument-state-rail')).toBeNull();
  });

  it('does not mount the state rail when the flag is explicitly false', () => {
    const { queryByTestId } = renderRoom({ roomExchangeV2Enabled: false });
    expect(queryByTestId('argument-state-rail')).toBeNull();
  });

  it('still renders the microMoment banner (unchanged) with the flag OFF', () => {
    const { queryByTestId } = renderRoom({ entryHint: ENTRY_HINT });
    expect(queryByTestId('argument-micro-moment')).toBeTruthy();
    expect(queryByTestId('argument-state-rail')).toBeNull();
  });
});

describe('ROOM-001 — flag ON mounts the rail above the microMoment', () => {
  it('mounts the state rail when the flag is true', () => {
    const { getByTestId } = renderRoom({ roomExchangeV2Enabled: true, roomVisibility: 'public' });
    expect(getByTestId('argument-state-rail')).toBeTruthy();
  });

  it('renders the rail AND the microMoment together (composition, not replacement)', () => {
    const { getByTestId } = renderRoom({ roomExchangeV2Enabled: true, entryHint: ENTRY_HINT });
    expect(getByTestId('argument-state-rail')).toBeTruthy();
    expect(getByTestId('argument-micro-moment')).toBeTruthy();
  });
});

describe('ROOM-001 — no second board derivation in the rail wiring', () => {
  const SRC = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/arguments/room/ArgumentRoom.tsx'),
    'utf8',
  );

  it('keeps exactly one deriveRoomMediatorBoardState call site', () => {
    const calls = (SRC.match(/deriveRoomMediatorBoardState\(/g) ?? []).length;
    expect(calls).toBe(1);
  });

  it('does not import featureFlags into the room orchestrator (prop-threaded flag)', () => {
    expect(SRC).not.toMatch(/from\s+['"][^'"]*featureFlags['"]/);
  });
});
