/**
 * ROOM-003 (#829) — ArgumentEntryComposer RNTL suite.
 *
 * Covers the J2 fast-path reply in <=2 taps with ZERO type/side taps (the
 * defaults come from the transition matrix + seat), the disabled voice slot,
 * the More round trip, the context-chip clear, the observer read-only state,
 * and the blocked-state reason (over-length reachable via the input, plus the
 * evidence hard-block via a seeded draft).
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

import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { useAppSession } from '../src/features/session/useAppSession';
import { ArgumentEntryComposer } from '../src/features/arguments/composer/ArgumentEntryComposer';
import { submitArgumentDraft } from '../src/lib/edgeFunctions';
import { ARGUMENT_ENTRY_COMPOSER_COPY as COPY } from '../src/features/arguments/composer/argumentEntryComposerModel';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { Debate } from '../src/features/debates/types';

const mockSubmit = submitArgumentDraft as jest.Mock;

const DEBATE: Debate = {
  id: 'debate-1',
  createdBy: 'host-1',
  title: 'Bike lanes',
  resolution: 'City streets should add protected bike lanes on arterials.',
  description: 'A debate about street safety and protected bike lanes.',
  status: 'open',
  constitutionId: 'const-1',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
  myParticipantSide: 'affirmative',
  visibility: 'public',
};

function parentClaim(overrides: Partial<ArgumentRow> = {}): ArgumentRow {
  return {
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
    ...overrides,
  };
}

/** Harness — seeds the active draft argumentType after the bar has created it. */
function DraftTypeSeeder({ argumentType }: { argumentType: string }) {
  const { dispatch } = useAppSession();
  return (
    <Pressable testID="seed-type" onPress={() => dispatch({ type: 'DRAFT_UPDATED', patch: { argumentType: argumentType as never } })}>
      <Text>seed</Text>
    </Pressable>
  );
}

interface MountOpts {
  participantSide?: Debate['myParticipantSide'];
  parent?: ArgumentRow | null;
  onOpenMore?: () => void;
  onSubmitSuccess?: () => void;
  onClearParent?: () => void;
  withSeeder?: boolean;
}

function mount(opts: MountOpts = {}) {
  const parent = opts.parent === undefined ? parentClaim() : opts.parent;
  // Distinguish an explicit null seat from an absent option (do not coerce).
  const side = 'participantSide' in opts ? opts.participantSide : 'affirmative';
  return render(
    <AppSessionProvider>
      {opts.withSeeder ? <DraftTypeSeeder argumentType="evidence" /> : null}
      <ArgumentEntryComposer
        debate={DEBATE}
        selectedParentId={parent?.id ?? null}
        parentArgument={parent}
        participantSide={side}
        onOpenMore={opts.onOpenMore ?? jest.fn()}
        onSubmitSuccess={opts.onSubmitSuccess ?? jest.fn()}
        onClearParent={opts.onClearParent ?? jest.fn()}
      />
    </AppSessionProvider>,
  );
}

beforeEach(() => {
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue({ ok: true, data: { argument: {}, tags: [], topic_satisfaction_check: null, flags: [], validation: {} } });
});

describe('ROOM-003 bar — J2 fast-path reply (<=2 taps, zero type/side taps)', () => {
  it('types a reply and Sends with a matrix-defaulted type + seat-defaulted side', async () => {
    const onSubmitSuccess = jest.fn();
    const r = mount({ participantSide: 'affirmative', onSubmitSuccess });

    // The bar creates the draft + applies defaults on mount; no type/side taps.
    fireEvent.changeText(
      r.getByTestId('argument-entry-composer-input'),
      'This overlooks the maintenance cost of protected arterial lanes.',
    );

    const send = r.getByTestId('argument-entry-composer-send');
    await waitFor(() => expect(send.props.accessibilityState?.disabled).toBe(false));

    await act(async () => {
      fireEvent.press(send);
    });

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const payload = mockSubmit.mock.calls[0][0];
    expect(payload.argument_type).toBe('rebuttal'); // matrix default for an opponent claim
    expect(payload.side).toBe('affirmative'); // seat default
    expect(payload.parent_id).toBe('arg-parent');
    expect(onSubmitSuccess).toHaveBeenCalledTimes(1);
  });

  it('Send is disabled until a body is typed', async () => {
    const r = mount();
    await waitFor(() => expect(r.getByTestId('argument-entry-composer-input')).toBeTruthy());
    expect(r.getByTestId('argument-entry-composer-send').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('ROOM-003 bar — slots + affordances', () => {
  it('renders a disabled voice slot with honest plain-language copy and no press handler', () => {
    const r = mount();
    const mic = r.getByTestId('argument-entry-composer-mic');
    expect(mic.props.accessibilityState?.disabled).toBe(true);
    expect(r.getByText(COPY.micLabel)).toBeTruthy();
    // Disabled Pressable carries no onPress action.
    expect(mic.props.onPress == null || mic.props.disabled === true).toBe(true);
  });

  it('the Source slot and More button both open the full composer (dock)', () => {
    const onOpenMore = jest.fn();
    const r = mount({ onOpenMore });
    fireEvent.press(r.getByTestId('argument-entry-composer-proof'));
    fireEvent.press(r.getByTestId('argument-entry-composer-more'));
    expect(onOpenMore).toHaveBeenCalledTimes(2);
  });

  it('the context chip clear un-scopes the reply target', () => {
    const onClearParent = jest.fn();
    const r = mount({ onClearParent });
    fireEvent.press(r.getByTestId('argument-entry-composer-chip-clear'));
    expect(onClearParent).toHaveBeenCalledTimes(1);
  });

  it('a root context chip reads New point and is not clearable', () => {
    const r = mount({ parent: null });
    expect(r.getByText(COPY.chipNewPoint)).toBeTruthy();
    expect(r.queryByTestId('argument-entry-composer-chip-clear')).toBeNull();
  });
});

describe('ROOM-003 bar — observer read-only', () => {
  it('an observer sees a calm Join-to-reply prompt and no text field', () => {
    const r = mount({ participantSide: 'observer' });
    expect(r.getByTestId('argument-entry-composer-observer')).toBeTruthy();
    expect(r.getByText(COPY.observerPrompt)).toBeTruthy();
    expect(r.queryByTestId('argument-entry-composer-input')).toBeNull();
    expect(r.queryByTestId('argument-entry-composer-send')).toBeNull();
  });

  it('a seatless viewer (null side) is also read-only', () => {
    const r = mount({ participantSide: null });
    expect(r.getByTestId('argument-entry-composer-observer')).toBeTruthy();
    expect(r.queryByTestId('argument-entry-composer-input')).toBeNull();
  });
});

describe('ROOM-003 bar — blocked state (hard rule only)', () => {
  it('an over-length body surfaces a plain-language blocked reason and disables Send', async () => {
    const r = mount();
    fireEvent.changeText(r.getByTestId('argument-entry-composer-input'), 'x'.repeat(2100));
    await waitFor(() => expect(r.getByTestId('argument-entry-composer-blocked')).toBeTruthy());
    expect(r.getByTestId('argument-entry-composer-send').props.accessibilityState?.disabled).toBe(true);
  });

  it('the evidence hard-block surfaces its source reason and disables Send (no bypass)', async () => {
    const r = mount({ withSeeder: true });
    fireEvent.changeText(
      r.getByTestId('argument-entry-composer-input'),
      'The city report shows weeknight ridership rose after the pilot lanes opened.',
    );
    // Simulate the user choosing Evidence in More (the bar never auto-picks it).
    await act(async () => {
      fireEvent.press(r.getByTestId('seed-type'));
    });
    await waitFor(() => expect(r.getByTestId('argument-entry-composer-blocked')).toBeTruthy());
    expect(r.getByTestId('argument-entry-composer-send').props.accessibilityState?.disabled).toBe(true);
  });
});
