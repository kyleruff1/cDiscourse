/**
 * PROOF-002 (#889) — ProofButton (Source slot) routing + owed state.
 *
 * The Source slot in ArgumentEntryComposer:
 *   - with onOpenProof set -> opens the drawer (not More);
 *   - without onOpenProof -> routes to More (byte-identical to today);
 *   - proofOwed -> the gold + text-owed treatment (reads in monochrome);
 *   - the More button always routes to More.
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

import { render, fireEvent } from '@testing-library/react-native';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { ArgumentEntryComposer } from '../src/features/arguments/composer/ArgumentEntryComposer';
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

function renderBar(props: {
  onOpenMore: () => void;
  onOpenProof?: () => void;
  proofOwed?: boolean;
}) {
  return render(
    <AppSessionProvider>
      <ArgumentEntryComposer
        debate={DEBATE}
        selectedParentId={null}
        parentArgument={null}
        participantSide="affirmative"
        onSubmitSuccess={jest.fn()}
        onClearParent={jest.fn()}
        {...props}
      />
    </AppSessionProvider>,
  );
}

describe('ProofButton routing', () => {
  it('routes the Source slot to the drawer when onOpenProof is set', () => {
    const onOpenMore = jest.fn();
    const onOpenProof = jest.fn();
    const r = renderBar({ onOpenMore, onOpenProof });
    fireEvent.press(r.getByTestId('argument-entry-composer-proof'));
    expect(onOpenProof).toHaveBeenCalledTimes(1);
    expect(onOpenMore).not.toHaveBeenCalled();
  });

  it('routes the Source slot to More when onOpenProof is absent (flag-off byte-identical)', () => {
    const onOpenMore = jest.fn();
    const r = renderBar({ onOpenMore });
    fireEvent.press(r.getByTestId('argument-entry-composer-proof'));
    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });

  it('renders the gold + text owed marker when proofOwed is true', () => {
    const r = renderBar({ onOpenMore: jest.fn(), onOpenProof: jest.fn(), proofOwed: true });
    const owed = r.getByTestId('argument-entry-composer-proof-owed');
    expect(owed).toBeTruthy();
    // Color-independent — the owed state carries a text equivalent.
    const slot = r.getByTestId('argument-entry-composer-proof');
    expect(slot.props.accessibilityLabel).toMatch(/owed/i);
    expect(r.getByText(/Source owed/)).toBeTruthy();
  });

  it('does not render the owed marker in the default (non-owed) state', () => {
    const r = renderBar({ onOpenMore: jest.fn(), onOpenProof: jest.fn() });
    expect(r.queryByTestId('argument-entry-composer-proof-owed')).toBeNull();
  });

  it('the More button always routes to More', () => {
    const onOpenMore = jest.fn();
    const r = renderBar({ onOpenMore, onOpenProof: jest.fn() });
    fireEvent.press(r.getByTestId('argument-entry-composer-more'));
    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });
});
