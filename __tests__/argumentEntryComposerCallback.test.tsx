/**
 * UX-COMPOSER-005 (#831) — ArgumentEntryComposer Callback slot + draft echo.
 *
 * The Callback affordance is additive-optional: present only when
 * onInsertCallback is threaded (quote_forge on). Absent => no slot, no echo,
 * byte-identical bar. The echo renders only when the active draft carries a
 * pendingCallback.
 */
import React from 'react';
import { Pressable, Text } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/edgeFunctions', () => ({
  ...jest.requireActual('../src/lib/edgeFunctions'),
  submitArgumentDraft: jest.fn(),
}));
jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    SUPABASE_CONFIGURED: true,
    supabase: {
      ...actual.supabase,
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
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

import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { useAppSession } from '../src/features/session/useAppSession';
import { ArgumentEntryComposer } from '../src/features/arguments/composer/ArgumentEntryComposer';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { Debate } from '../src/features/debates/types';

const DEBATE: Debate = {
  id: 'debate-1',
  createdBy: 'host-1',
  title: 'Bike lanes',
  resolution: 'City streets should add protected bike lanes on arterials.',
  description: 'A debate about street safety.',
  status: 'open',
  constitutionId: 'const-1',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
  myParticipantSide: 'affirmative',
  visibility: 'public',
};

const parent: ArgumentRow = {
  id: 'arg-parent',
  debateId: DEBATE.id,
  parentId: null,
  authorId: 'other-user',
  argumentType: 'claim',
  side: 'negative',
  body: 'Protected bike lanes make arterial streets safer for everyone.',
  depth: 0,
  status: 'posted',
  targetExcerpt: null,
  disagreementAxis: null,
  railPayload: {},
  clientValidation: {},
  serverValidation: {},
  clientSubmissionId: null,
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
};

const CALLBACK = {
  targetDebateId: 'debate-prior-1',
  targetTitleSnapshot: 'Bike-lane baseline',
  excerpt: 'Protected lanes reduce collisions on arterials.',
  capturedFromArgumentId: 'arg-9',
};

/** Seeds a pendingCallback onto the active draft after the bar creates it. */
function CallbackSeeder() {
  const { dispatch } = useAppSession();
  return (
    <Pressable
      testID="seed-callback"
      onPress={() => dispatch({ type: 'DRAFT_UPDATED', patch: { pendingCallback: CALLBACK } })}
    >
      <Text>seed</Text>
    </Pressable>
  );
}

function mount(opts: { onInsertCallback?: () => void; withSeeder?: boolean } = {}) {
  return render(
    <AppSessionProvider>
      {opts.withSeeder ? <CallbackSeeder /> : null}
      <ArgumentEntryComposer
        debate={DEBATE}
        selectedParentId={parent.id}
        parentArgument={parent}
        participantSide="affirmative"
        onOpenMore={jest.fn()}
        onSubmitSuccess={jest.fn()}
        onClearParent={jest.fn()}
        onInsertCallback={opts.onInsertCallback}
      />
    </AppSessionProvider>,
  );
}

describe('ArgumentEntryComposer — Callback slot (#831)', () => {
  it('renders the Callback slot and fires onInsertCallback when the flag is on', () => {
    const onInsertCallback = jest.fn();
    const r = mount({ onInsertCallback });
    const slot = r.getByTestId('argument-entry-composer-callback');
    expect(slot.props.accessibilityRole).toBe('button');
    fireEvent.press(slot);
    expect(onInsertCallback).toHaveBeenCalledTimes(1);
  });

  it('renders NO Callback slot when onInsertCallback is absent (byte-identical bar)', () => {
    const r = mount();
    expect(r.queryByTestId('argument-entry-composer-callback')).toBeNull();
  });

  it('renders the draft echo when a pendingCallback is attached and the flag is on', async () => {
    const r = mount({ onInsertCallback: jest.fn(), withSeeder: true });
    expect(r.queryByTestId('callback-draft-echo')).toBeNull();
    await act(async () => {
      fireEvent.press(r.getByTestId('seed-callback'));
    });
    await waitFor(() => expect(r.getByTestId('callback-draft-echo')).toBeTruthy());
    // Remove clears the echo.
    await act(async () => {
      fireEvent.press(r.getByTestId('callback-draft-echo-remove'));
    });
    await waitFor(() => expect(r.queryByTestId('callback-draft-echo')).toBeNull());
  });

  it('never renders the echo when the flag is off, even with a seeded callback', async () => {
    const r = mount({ withSeeder: true });
    await act(async () => {
      fireEvent.press(r.getByTestId('seed-callback'));
    });
    // Flag off (no onInsertCallback) => no echo chrome despite the pending callback.
    expect(r.queryByTestId('callback-draft-echo')).toBeNull();
    expect(r.queryByTestId('argument-entry-composer-callback')).toBeNull();
  });
});
