/**
 * ROOM-003 (#829) — absorbed #830 (optional-modifier pop-out = More).
 *
 * Proves the bar keeps NO modifier on its surface by default and that a
 * reply submits with More NEVER opened: every modifier (type / side / axis /
 * tags / evidence fields) lives behind the single More affordance, which
 * opens the shipped dock. The bar Send posts directly on the fast path.
 */
import React from 'react';

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
import { ArgumentEntryComposer } from '../src/features/arguments/composer/ArgumentEntryComposer';
import { submitArgumentDraft } from '../src/lib/edgeFunctions';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { Debate } from '../src/features/debates/types';

const mockSubmit = submitArgumentDraft as jest.Mock;

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

const PARENT: ArgumentRow = {
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

function mount(onOpenMore = jest.fn()) {
  const r = render(
    <AppSessionProvider>
      <ArgumentEntryComposer
        debate={DEBATE}
        selectedParentId={PARENT.id}
        parentArgument={PARENT}
        participantSide="affirmative"
        onOpenMore={onOpenMore}
        onSubmitSuccess={jest.fn()}
        onClearParent={jest.fn()}
      />
    </AppSessionProvider>,
  );
  return { r, onOpenMore };
}

beforeEach(() => {
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue({ ok: true, data: { argument: {}, tags: [], topic_satisfaction_check: null, flags: [], validation: {} } });
});

describe('ROOM-003 #830 — modifiers live only behind More', () => {
  it('the bar surface shows NO type / side / axis / tag / evidence modifier by default', () => {
    const { r } = mount();
    // Legacy composer modifier affordances are absent from the bar surface.
    expect(r.queryByLabelText('Rebuttal')).toBeNull();
    expect(r.queryByLabelText('Counter-Rebuttal')).toBeNull();
    expect(r.queryByLabelText('Affirmative')).toBeNull();
    expect(r.queryByLabelText('Neutral')).toBeNull();
    expect(r.queryByText('Argument type')).toBeNull();
    expect(r.queryByText('Side')).toBeNull();
    expect(r.queryByTestId('composer-optional-focus')).toBeNull();
    expect(r.queryByTestId('composer-body-input')).toBeNull(); // the bar uses its own input
    // Only the bar affordances are present.
    expect(r.getByTestId('argument-entry-composer-input')).toBeTruthy();
    expect(r.getByTestId('argument-entry-composer-more')).toBeTruthy();
  });

  it('a reply submits with More NEVER opened (fast path)', async () => {
    const { r, onOpenMore } = mount();
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
    expect(onOpenMore).not.toHaveBeenCalled();
  });

  it('More (and the Source slot) open the full composer host', () => {
    const { r, onOpenMore } = mount();
    fireEvent.press(r.getByTestId('argument-entry-composer-more'));
    fireEvent.press(r.getByTestId('argument-entry-composer-proof'));
    expect(onOpenMore).toHaveBeenCalledTimes(2);
  });
});
